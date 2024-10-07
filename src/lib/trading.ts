import {
  Currency,
  CurrencyAmount,
  Percent,
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

import { CurrentConfig, TradeConfig } from "@/config";
import {
  QUOTER_CONTRACT_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  MAX_FEE_PER_GAS,
  MAX_PRIORITY_FEE_PER_GAS,
} from "@/lib/constants";
import { getPoolData } from "@/lib/pool";
import { TransactionState, publicClient } from "@/lib/providers";
import { fromReadableAmount } from "@/lib/extras";

import { erc20Abi, Hex, TransactionReceipt, WalletClient } from "viem";
import { polygon } from "viem/chains";

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
    chain: polygon,
    data: methodParameters.calldata as Hex,
    to: SWAP_ROUTER_ADDRESS,
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

// Helper Quoting and Pool Functions

async function getOutputQuote(route: Route<Currency, Currency>) {
  const provider = new ethers.BrowserProvider((window as any).ethereum, "any");

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

  const quoteCallReturnData = await provider.call({
    to: QUOTER_CONTRACT_ADDRESS,
    data: calldata,
  });

  return ethers.AbiCoder.defaultAbiCoder().decode(
    ["uint256"],
    quoteCallReturnData,
  );
}

export async function checkTokenApproval(
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
      args: [address as Hex, SWAP_ROUTER_ADDRESS],
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

export async function getTokenTransferApproval(
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
      chain: polygon,
      args: [
        SWAP_ROUTER_ADDRESS,
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
