import { computePoolAddress, FeeAmount, Pool } from "@uniswap/v3-sdk";
import { V3_CORE_FACTORY_ADDRESSES } from "@uniswap/sdk-core";

import { getContract, Hex } from "viem";
import { base } from "viem/chains";

import { USDC, SBC } from "@/lib/constants";
import { publicClient } from "@/lib/providers";
import uniswapV3PoolAbi from "@/lib/abi/uniswapV3Pool.abi";

export async function getPoolData(): Promise<Pool> {
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

  const [slot0, liquidity] = await Promise.all([
    poolContract.read.slot0(),
    poolContract.read.liquidity(),
  ]);

  const fullPool = new Pool(
    USDC,
    SBC,
    FeeAmount.LOWEST,
    (slot0 as any)[0].toString(),
    (liquidity as any).toString(),
    (slot0 as any)[1],
  );
  return fullPool;
}
