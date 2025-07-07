import {
  Currency,
  CurrencyAmount,
  MaxUint256,
  Percent,
  QUOTER_ADDRESSES,
  SWAP_ROUTER_02_ADDRESSES,
  Token,
  TradeType,
} from "@uniswap/sdk-core";
import {
  Pool,
  Route,
  SwapOptions,
  SwapQuoter,
  SwapRouter,
  Trade,
} from "@uniswap/v3-sdk";
import {
  createWalletClient,
  custom,
  decodeFunctionData,
  decodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  Hex,
  http,
  parseSignature,
  WalletClient,
  parseAbiParameters,
  walletActions,
} from "viem";

import { base } from "viem/chains";
import { entryPoint07Address, WaitForUserOperationReceiptTimeoutError } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import JSBI from "jsbi";

import { CurrentConfig, TradeConfig } from "@/config";
import swapRouterAbi from "@/lib/abi/swapRouter.abi";
import swapRouter2Abi from "@/lib/abi/swapRouter2.abi";
import erc20PermitAbi from "@/lib/abi/erc20Permit.abi";
import { getPoolData } from "@/lib/pool";
import {
  TransactionState,
  publicClient,
  pimlicoClient,
  sbcPaymasterClient,
} from "@/lib/providers";
import { fromReadableAmount } from "@/lib/extras";
import { getSmartAccount, ACCOUNT_TYPE } from "@/lib/account-utils";

import { toSimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

import { deserializePermissionAccount, serializePermissionAccount, toPermissionValidator } from "@zerodev/permissions";
import { CallPolicyVersion, ParamCondition, toCallPolicy } from "@zerodev/permissions/policies";
import { toECDSASigner, toWebAuthnSigner } from "@zerodev/permissions/signers";
import {
  addressToEmptyAccount,
  createKernelAccount,
  createKernelAccountClient,
  CreateKernelAccountReturnType,
  createZeroDevPaymasterClient,
  KernelAccountClient,
} from "@zerodev/sdk";
import { KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { toTimestampPolicy } from "@zerodev/permissions/policies"

import { useLocalStorage } from "usehooks-ts";

export type TokenTrade = Trade<Token, Token, TradeType>;

// Trading Functions

export async function createTrade(
  config: TradeConfig,
  inverse = false,
): Promise<TokenTrade> {
  const [poolData, _, __] = await getPoolData();

  const inToken = inverse ? config.tokens.out : config.tokens.in;
  const outToken = inverse ? config.tokens.in : config.tokens.out;

  const pool = new Pool(
    inToken,
    outToken,
    config.tokens.poolFee,
    poolData.sqrtRatioX96,
    poolData.liquidity,
    poolData.tickCurrent,
  );

  const swapRoute = new Route([pool], inToken, outToken);

  const amountOut = await getOutputQuote(swapRoute);

  const uncheckedTrade = Trade.createUncheckedTrade({
    route: swapRoute,
    inputAmount: CurrencyAmount.fromRawAmount(
      inToken,
      fromReadableAmount(config.tokens.amountIn, inToken.decimals).toString(),
    ),
    outputAmount: CurrencyAmount.fromRawAmount(
      outToken,
      JSBI.BigInt(amountOut).toString(),
    ),
    tradeType: TradeType.EXACT_INPUT,
  });

  return uncheckedTrade;
}

export async function executeGaslessTrade(
  trade: TokenTrade,
  config: TradeConfig,
): Promise<{
  txState: TransactionState;
  userOpHash: string;
}> {
  try {
    if (!config.account!.address) {
      throw new Error("Cannot execute a trade without a connected wallet");
    }
    const walletAddress = config.account!.address;

    const owner = createWalletClient({
      account: walletAddress as Hex,
      chain: base,
      transport: custom((window as any).ethereum),
    });

    console.debug("Owner Address", owner.account.address);

    // create a new SimpleAccount instance
    const simpleAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: owner,
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
    });

    // get the sender (counterfactual) address of the SimpleAccount
    const senderAddress = simpleAccount.address;

    console.debug("Sender Address", simpleAccount.address);

    const smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      chain: base,
      bundlerTransport: http(process.env.NEXT_PUBLIC_AA_BASE_URL!),
      paymaster: sbcPaymasterClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    });

    const amountIn = fromReadableAmount(
      config.tokens.amountIn,
      config.tokens.in.decimals as number,
    );

    // now transfer the amountIn to the SimpleAccount
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transferFrom",
      args: [walletAddress as Hex, senderAddress as Hex, amountIn],
    });

    // encode the approval transaction
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [SWAP_ROUTER_02_ADDRESSES(base.id) as Hex, amountIn],
    });

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    // encode the swap transaction
    const options: SwapOptions = {
      // 50 bips, or 0.50%
      slippageTolerance: new Percent(50, 10_000),
      // 20 minutes from the current Unix time
      deadline,
      // the recipient of the output token
      recipient: walletAddress,
    };

    const methodParameters = SwapRouter.swapCallParameters([trade], options);

    // HACK: args should be all elements in args_ except for `deadline`, thus exclude it
    // @dev: this is a really bizzare way to do this, but it works for now. Note that we're
    // using swapRouterAbi to decode the function data, but swapRouter2Abi to encode it without
    // the `deadline` argument. It doesn't seem to work any other way if we're using the
    // Uniswap SDK as-is.
    const swapData_ = methodParameters.calldata as Hex;
    const { functionName, args } = decodeFunctionData({
      abi: swapRouterAbi,
      data: swapData_,
    });

    delete (args as any)[0]["deadline"];

    // re-encode the swap transaction without the `deadline` argument
    const swapData = encodeFunctionData({
      abi: swapRouter2Abi,
      functionName,
      args,
    });

    // package the calls together in the correct order
    const calls = [
      {
        to: config.tokens.in.address as Hex,
        data: transferData,
      },
      {
        to: config.tokens.in.address as Hex,
        data: approveData as Hex,
      },
      {
        to: SWAP_ROUTER_02_ADDRESSES(base.id) as Hex,
        data: swapData,
      },
    ];

    console.debug(
      `Checking token approval for ${config.tokens.in.symbol}; amount ${config.tokens.amountIn}; sender address: ${senderAddress}`,
    );

    const isApproved = await checkTokenApproval(
      config.tokens.in,
      config.tokens.amountIn,
      senderAddress,
    );
    console.debug("Is Approved", isApproved);

    // If the token transfer is not approved, prepend the permit data instruction
    if (!isApproved) {
      // get EOA signature to permit the SimpleAccount to spend the amountIn
      const signature = await getPermitSignature(
        owner,
        config.tokens.in,
        walletAddress,
        senderAddress,
        amountIn,
        deadline,
      );

      const { r, s, v } = parseSignature(signature);

      // encode the permit transaction calldata
      const permitData = encodeFunctionData({
        abi: erc20PermitAbi,
        functionName: "permit",
        args: [
          walletAddress as Hex,
          senderAddress as Hex,
          amountIn,
          deadline,
          v,
          r,
          s,
        ],
      });

      // prepend to the calls array
      calls.unshift({
        to: config.tokens.in.address as Hex,
        data: permitData,
      });
    }

    // send the batch call transaction to the SimpleAccount
    const userOpHash = await smartAccountClient.sendUserOperation({
      calls,
    });

    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash,
      pollingInterval: 1000,
      timeout: 7000,
      retryCount: 7,
    })
    .catch((e) => {
      // if timeout but the userOpHash is still valid, return the userOpHash anyway
      if (e instanceof WaitForUserOperationReceiptTimeoutError && userOpHash.startsWith("0x")) {
        return {
          txState: TransactionState.Sent,
          userOpHash: userOpHash,
        };
      } else {
        console.error(e);
        return {
          txState: TransactionState.Failed,
          userOpHash: userOpHash,
        };
      }
      
    });

    return {
      txState: TransactionState.Sent,
      userOpHash: receipt.userOpHash,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function execute7702GaslessTrade(
  trade: TokenTrade,
  config: TradeConfig,
  sessionKeyAddress: Hex,
  sessionKernelClient: KernelAccountClient,
): Promise<{
  txState: TransactionState;
  userOpHash: string;
}> {
  console.debug("Executing 7702 gasless trade");

  try {
    if (!sessionKernelClient) {
      throw new Error("Session kernel client not found");
    }

    if (!config.account!.address) {
      throw new Error("Cannot execute a trade without a connected wallet");
    }
    const walletAddress = config.account!.address;

    // We'll reuse the sessionKernelClient passed in from the dApp.
    const senderAddress = sessionKernelClient.account!.address;
    console.debug("Session Kernel Sender", senderAddress);

    const smartAccountClient = sessionKernelClient;

    const amountIn = fromReadableAmount(
      config.tokens.amountIn,
      config.tokens.in.decimals as number,
    );

    // now transfer the amountIn to the SimpleAccount
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transferFrom",
      args: [walletAddress as Hex, senderAddress as Hex, amountIn],
    });

    // encode the approval transaction
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      // args: [SWAP_ROUTER_02_ADDRESSES(base.id) as Hex, amountIn],
      args: [SWAP_ROUTER_02_ADDRESSES(base.id) as Hex, BigInt(MaxUint256.toString())],
    });

    // 20 minutes from the current Unix time
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    // encode the swap transaction
    const options: SwapOptions = {
      // 50 bips, or 0.50%
      slippageTolerance: new Percent(50, 10_000),
      // 20 minutes from the current Unix time
      deadline,
      // the recipient of the output token
      recipient: walletAddress,
    };

    const methodParameters = SwapRouter.swapCallParameters([trade], options);

    const swapData_ = methodParameters.calldata as Hex;
    const { functionName, args } = decodeFunctionData({
      abi: swapRouterAbi,
      data: swapData_,
    });

    delete (args as any)[0]["deadline"];

    // re-encode the swap transaction without the `deadline` argument
    const swapData = encodeFunctionData({
      abi: swapRouter2Abi,
      functionName,
      args,
    });

    // package the calls together in the correct order
    const calls = [
      {
        to: config.tokens.in.address as Hex,
        data: transferData,
      },
      // Removed approve call for 7702 session key trade
      {
        to: SWAP_ROUTER_02_ADDRESSES(base.id) as Hex,
        data: swapData,
      },
    ];

    console.debug(
      `Checking token approval for ${config.tokens.in.symbol}; amount ${config.tokens.amountIn}; sender address: ${senderAddress}`,
    );

    try {
      const userOpHash = await smartAccountClient.sendUserOperation({ calls });
      const receipt = await smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
        pollingInterval: 1000,
        timeout: 7000,
        retryCount: 7,
      });
      return {
        txState: TransactionState.Sent,
        userOpHash: receipt.userOpHash,
      };
    } catch (e) {
      const msg = (e as Error)?.message || "";
      if (
        msg.includes("AA22") &&
        (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("not due"))
      ) {
        throw { code: "SESSION_KEY_EXPIRED", original: e };
      }
      throw e;
    }
  } catch (e) {
    const msg = (e as Error)?.message || "";
    if (
      msg.includes("AA22") &&
      (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("not due"))
    ) {
      throw { code: "SESSION_KEY_EXPIRED", original: e };
    }
    throw e;
  }
}

async function getOutputQuote(route: Route<Currency, Currency>) {
  const provider = publicClient;

  if (!provider) {
    throw new Error("Provider required to get pool state");
  }

  const { calldata } = SwapQuoter.quoteCallParameters(
    route,
    CurrencyAmount.fromRawAmount(
      CurrentConfig.tokens.in,
      fromReadableAmount(
        CurrentConfig.tokens.amountIn,
        CurrentConfig.tokens.in.decimals,
      ).toString(),
    ),
    TradeType.EXACT_INPUT,
    {
      useQuoterV2: true,
    },
  );

  const { data: quoteCallReturnData } = await provider.call({
    to: QUOTER_ADDRESSES[base.id] as Hex,
    data: calldata as Hex,
  });

  return decodeAbiParameters(
    parseAbiParameters("uint256"),
    quoteCallReturnData as Hex,
  );
}

async function checkTokenApproval(
  token: Token,
  amountIn: number,
  address: string,
): Promise<boolean> {
  if (!address) {
    console.error("No address provided");
    return false;
  }

  try {
    const allowance = await publicClient.readContract({
      address: token.address as Hex,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address as Hex, SWAP_ROUTER_02_ADDRESSES(base.id) as Hex],
    });

    const status =
      BigInt(allowance.toString()) >=
      BigInt(fromReadableAmount(amountIn, token.decimals).toString());

    console.debug("Allowance", allowance, status);
    return status;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// async function getTokenTransferApproval(
//   config: TradeConfig,
//   wallet: WalletClient,
// ): Promise<string> {
//   const address = config.account!.address;
//   if (!address) {
//     console.error("No address provided");
//     return TransactionState.Failed;
//   }

//   try {
//     const hash = await wallet.writeContract({
//       address: config.tokens.in.address as Hex,
//       abi: erc20Abi,
//       functionName: "approve",
//       account: config.account!.address as Hex,
//       chain: base, // polygon,
//       args: [
//         SWAP_ROUTER_02_ADDRESSES(base.id) as Hex,
//         BigInt(
//           fromReadableAmount(
//             config.tokens.amountIn,
//             config.tokens.in.decimals,
//           ).toString(),
//         ),
//       ],
//     });
//     return hash;
//   } catch (e) {
//     console.error(e);
//     return TransactionState.Failed;
//   }
// }

async function getPermitSignature(
  wallet: WalletClient,
  token: Token,
  owner: string,
  spender: string,
  value: BigInt,
  deadline: number,
): Promise<Hex> {
  try {
    const domain = {
      name: token.name!,
      version: getDomainVersion(token.name!, base.id),
      chainId: base.id,
      verifyingContract: token.address as Hex,
    };
    console.debug("Domain", domain);
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const nonce = await publicClient.readContract({
      address: token.address as Hex,
      abi: erc20PermitAbi,
      functionName: "nonces",
      args: [owner as Hex],
    });
    console.debug("Nonce", nonce);
    const message = {
      owner,
      spender,
      value,
      nonce,
      deadline,
    };
    console.debug("Message", message);
    const signature = await wallet.signTypedData({
      account: owner as Hex,
      domain,
      types,
      primaryType: "Permit",
      message,
    });
    return signature as Hex;
  } catch (e) {
    console.error(e);
    return "0x";
  }
}

function getDomainVersion(tokenName: string, chainId: number): string {
  // USDC seems to be using version 2 while everything else is version 1
  return tokenName === "USD Coin" ? "2" : "1";
}
