import IUniswapV3PoolABI from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { FeeAmount, Pool } from "@uniswap/v3-sdk";

import { USDC, SBC } from "@/lib/constants";
import { getContract } from "viem";

import { publicClient } from "@/lib/providers";

const USDC_SBC_UNISWAP_POOL_ADDRESS =
  "0x98A5a5D8D448A90C5378A07e30Da5148679b4C45";

export async function getPoolData(): Promise<Pool> {
  const poolContract = getContract({
    address: USDC_SBC_UNISWAP_POOL_ADDRESS,
    abi: IUniswapV3PoolABI.abi,
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
