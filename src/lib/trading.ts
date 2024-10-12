import {
  Currency,
  CurrencyAmount,
  Percent,
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
import { ethers } from "ethers";
import JSBI from "jsbi";

import { abi as swapRouterAbi } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json";
import { abi as swapRouter2Abi } from "@uniswap/swap-router-contracts/artifacts/contracts/V3SwapRouter.sol/V3SwapRouter.json";
import { abi as erc20PermitAbi } from "@openzeppelin/contracts/build/contracts/IERC20Permit.json";
// import { abi as quoterAbi } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoter.sol/IQuoter.json";

import { CurrentConfig, TradeConfig } from "@/config";
import {
  QUOTER_CONTRACT_ADDRESS,
  MAX_FEE_PER_GAS,
  MAX_PRIORITY_FEE_PER_GAS,
} from "@/lib/constants";
import { getPoolData } from "@/lib/pool";
import {
  TransactionState,
  publicClient,
  pimlicoClient,
  pimlicoUrl,
} from "@/lib/providers";
import { fromReadableAmount } from "@/lib/extras";
import { getPolygonScanUrl, getBaseScanUrl } from "@/lib/providers";

import {
  Account,
  createWalletClient,
  custom,
  decodeFunctionData,
  decodeAbiParameters,
  DecodeAbiParametersReturnType,
  encodeFunctionData,
  erc20Abi,
  Hex,
  http,
  parseSignature,
  TransactionReceipt,
  WalletClient,
  parseAbiParameters,
} from "viem";
import { keccak256, toBytes } from "viem";
import { base, polygon } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";

import { toSimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";

export type TokenTrade = Trade<Token, Token, TradeType>;

// Trading Functions

export async function createTrade(
  config: TradeConfig,
  inverse = false,
): Promise<TokenTrade> {
  const poolData = await getPoolData();

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

  const amountOut = await getOutputQuote(swapRoute, config);

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

export async function executeTrade(
  trade: TokenTrade,
  config: TradeConfig,
  wallet: WalletClient,
): Promise<{
  txState: TransactionState;
  receipt: TransactionReceipt | null;
}> {
  if (!wallet || !config.account!.address) {
    throw new Error("Cannot execute a trade without a connected wallet");
  }

  const walletAddress = config.account!.address;

  // Check if the token transfer is approved
  console.debug(
    `Checking token approval for ${config.tokens.in.symbol}; amount ${config.tokens.amountIn}; address: ${walletAddress}`,
  );
  const isApproved = await checkTokenApproval(
    config.tokens.in,
    config.tokens.amountIn,
    walletAddress,
  );

  // If the token transfer is not approved, approve it
  if (!isApproved) {
    const resp = await getTokenTransferApproval(config, wallet);

    if (resp === TransactionState.Failed) {
      console.error("Token Approval Failed");
      return {
        txState: TransactionState.Failed,
        receipt: null,
      };
    }

    // resp is the transaction hash, wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: resp as Hex,
    });
    console.debug("Approval Receipt", receipt);
  }

  const options: SwapOptions = {
    // 50 bips, or 0.50%
    slippageTolerance: new Percent(50, 10_000),

    // 20 minutes from the current Unix time
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,

    recipient: walletAddress,
  };

  const methodParameters = SwapRouter.swapCallParameters([trade], options);
  console.debug("Method Parameters", methodParameters);

  const txHash = await wallet.sendTransaction({
    account: config.account!.address as Hex,
    chain: base, // polygon,
    data: methodParameters.calldata as Hex,
    to: SWAP_ROUTER_02_ADDRESSES(base.id), //polygon.id),
    value: BigInt(methodParameters.value),
    from: walletAddress,
    maxFeePerGas: BigInt(MAX_FEE_PER_GAS),
    maxPriorityFeePerGas: BigInt(MAX_PRIORITY_FEE_PER_GAS),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  return {
    txState: TransactionState.Sent,
    receipt,
  };
}

export async function executeGaslessTrade(
  trade: TokenTrade,
  config: TradeConfig,
  // wallet: WalletClient,
): Promise<{
  txState: TransactionState;
  userOpHash: string;
}> {
  if (!config.account!.address) {
    throw new Error("Cannot execute a trade without a connected wallet");
  }
  const walletAddress = config.account!.address;

  const owner = createWalletClient({
    account: walletAddress as Hex,
    chain: base, // polygon,
    transport: custom((window as any).ethereum),
  });

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
  console.debug("Sender Address", simpleAccount.address);
  const senderAddress = simpleAccount.address;

  const amountIn = fromReadableAmount(
    config.tokens.amountIn,
    config.tokens.in.decimals as number,
  );

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: base, // polygon,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  // now transfer the amountIn to the SimpleAccount
  const erc20ContractAbi = new ethers.Interface(erc20Abi);
  const transferData = erc20ContractAbi.encodeFunctionData("transferFrom", [
    walletAddress,
    senderAddress,
    amountIn,
  ]) as Hex;

  // encode the approval transaction
  const approveData = erc20ContractAbi.encodeFunctionData("approve", [
    SWAP_ROUTER_02_ADDRESSES(base.id), //polygon.id),
    amountIn,
  ]);

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

  // HACK: args should be all elements in args_ except for `deadline`, thus exclude it
  delete (args as any)[0]["deadline"];

  const swapData = encodeFunctionData({
    abi: swapRouter2Abi,
    functionName,
    args,
  });

  console.debug(`methodParameters`, methodParameters);

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

  // Check if the token transfer is approved for the sender
  console.debug(
    `Checking token approval for ${config.tokens.in.symbol}; amount ${config.tokens.amountIn}; sender address: ${senderAddress}`,
  );
  const isApproved = await checkTokenApproval(
    config.tokens.in,
    config.tokens.amountIn,
    senderAddress,
  );

  // If the token transfer is not approved, prepend the permit data
  if (!isApproved) {
    // get eoa signature to permit the SimpleAccount to spend the amountIn
    const signature = await getPermitSignature(
      owner,
      config.tokens.in,
      walletAddress,
      senderAddress,
      amountIn,
      deadline,
    );
    const { r, s, yParity, v } = parseSignature(signature);
    console.debug("Signature", signature);
    console.debug({ yParity, v, r, s });

    const erc20PermitContractAbi = new ethers.Interface(erc20PermitAbi);
    const permitData = erc20PermitContractAbi.encodeFunctionData("permit", [
      walletAddress,
      senderAddress,
      amountIn,
      deadline,
      v,
      r,
      s,
    ]) as Hex;

    // // run the permit function on the ERC20 token to get EOA signature
    // const permitTxHash = await owner.writeContract({
    //   address: config.tokens.in.address as Hex,
    //   abi: erc20PermitAbi,
    //   functionName: "permit",
    //   args: [walletAddress, senderAddress, amountIn, deadline, v, r, s],
    // });
    // console.debug("Permit Tx URL", getBaseScanUrl(permitTxHash)); // getPolygonScanUrl(permitTxHash));

    calls.unshift({
      to: config.tokens.in.address as Hex,
      data: permitData,
    });
  }

  const userOpHash = await smartAccountClient.sendTransaction({
    calls,
    paymasterContext: {
      sponsorshipPolicyId: "sp_base_gas_credits",
    },
  });

  return {
    txState: TransactionState.Sent,
    userOpHash,
  };
}

// Helper Quoting and Pool Functions

async function getOutputQuote(
  route: Route<Currency, Currency>,
  config: TradeConfig,
) {
  const provider = publicClient; //config.provider; //new ethers.BrowserProvider((window as any).ethereum, "any");

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
    to: QUOTER_CONTRACT_ADDRESS,
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
      args: [address as Hex, SWAP_ROUTER_02_ADDRESSES(base.id)],
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

async function getTokenTransferApproval(
  config: TradeConfig,
  wallet: WalletClient | null,
): Promise<string> {
  const address = config.account!.address;
  if (!address) {
    console.error("No address provided");
    return TransactionState.Failed;
  }

  try {
    const hash = await wallet!.writeContract({
      address: config.tokens.in.address as Hex,
      abi: erc20Abi,
      functionName: "approve",
      account: config.account!.address as Hex,
      chain: base, // polygon,
      args: [
        SWAP_ROUTER_02_ADDRESSES(base.id), //polygon.id),
        BigInt(
          fromReadableAmount(
            config.tokens.amountIn,
            config.tokens.in.decimals,
          ).toString(),
        ),
      ],
    });
    return hash;
  } catch (e) {
    console.error(e);
    return TransactionState.Failed;
  }
}

async function getPermitSignature(
  wallet: WalletClient,
  token: Token,
  owner: string,
  spender: string,
  value: BigInt,
  deadline: number,
): Promise<Hex> {
  try {
    console.debug("wallet is", wallet.account!.address);
    const domain = {
      name: token.name!,
      version: "1",
      chainId: base.id, // polygon.id,
      verifyingContract: token.address,
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
