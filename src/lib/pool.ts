import { V3_CORE_FACTORY_ADDRESSES } from "@uniswap/sdk-core";
import {
  computePoolAddress,
  FeeAmount,
  Pool,
  TICK_SPACINGS,
} from "@uniswap/v3-sdk";
import { getContract, Hex } from "viem";
import { base } from "viem/chains";

import uniswapV3PoolAbi from "@/lib/abi/uniswapV3Pool.abi";
import { SBC,USDC } from "@/lib/constants";
import { publicClient } from "@/lib/providers";

const Q96 = 2 ** 96;

function getTickAtSqrtPrice(sqrtPriceX96: number) {
  let tick = Math.floor(Math.log((sqrtPriceX96 / Q96) ** 2) / Math.log(1.0001));
  return tick;
}

async function getTokenAmounts(
  liquidity: number,
  sqrtPriceX96: number,
  tickLow: number,
  tickHigh: number,
  Decimal0: number,
  Decimal1: number,
) {
  let sqrtRatioA = Math.sqrt(1.0001 ** tickLow);
  let sqrtRatioB = Math.sqrt(1.0001 ** tickHigh);
  let currentTick = getTickAtSqrtPrice(sqrtPriceX96);
  let sqrtPrice = sqrtPriceX96 / Q96;
  let amount0 = 0;
  let amount1 = 0;
  if (currentTick < tickLow) {
    amount0 = Math.floor(
      liquidity * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB)),
    );
  } else if (currentTick >= tickHigh) {
    amount1 = Math.floor(liquidity * (sqrtRatioB - sqrtRatioA));
  } else if (currentTick >= tickLow && currentTick < tickHigh) {
    amount0 = Math.floor(
      liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB)),
    );
    amount1 = Math.floor(liquidity * (sqrtPrice - sqrtRatioA));
  }

  const amount0Human = (amount0 / 10 ** Decimal0).toFixed(Decimal0);
  const amount1Human = (amount1 / 10 ** Decimal1).toFixed(Decimal1);
  return [amount0, amount1, amount0Human, amount1Human];
}

// REF: https://docs.uniswap.org/sdk/v3/guides/advanced/pool-data
export async function getPoolData(): Promise<[Pool, any, any, number, number]> {
  try {
    const address = computePoolAddress({
      factoryAddress: V3_CORE_FACTORY_ADDRESSES[base.id],
      fee: FeeAmount.LOWEST,
      tokenA: USDC,
      tokenB: SBC,
    }) as Hex;

    const poolContract = getContract({
      address,
      abi: uniswapV3PoolAbi,
      client: publicClient,
    });

    // Get the slot0 and liquidity
    const [slot0, liquidity] = await Promise.all([
      poolContract.read.slot0(),
      poolContract.read.liquidity(),
    ]);

    const [sqrtPriceX96, currentTick, _, __, ___, ____, _____] = slot0 as any;

    const fullPool = new Pool(
      USDC,
      SBC,
      FeeAmount.LOWEST,
      sqrtPriceX96.toString(),
      (liquidity as bigint).toString(),
      currentTick,
    );

    // Get token amounts
    // @dev This code was taken from Uniswap docs but I for the life of me
    // can't return the current TVL of the pool. For now, I found 4 ticks
    // above and below the current tick will return close enough to the
    // actual token amounts. For the sake of this PoC, I won't spend more
    // time on this.
    // PRs containing a fix for this is welcome!
    const [a, b, token0Amount, token1Amount] = await getTokenAmounts(
      Number(liquidity as bigint),
      Number((slot0 as any)[0].toString()),
      currentTick - TICK_SPACINGS[FeeAmount.LOWEST] * 4,
      currentTick + TICK_SPACINGS[FeeAmount.LOWEST] * 4,
      USDC.decimals,
      SBC.decimals,
    );

    return [fullPool, _, __, Number(token0Amount), Number(token1Amount)];
  } catch (error) {
    console.error("Error fetching pool data", error);
    throw error;
  }
}
