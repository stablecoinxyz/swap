import { ethers } from "ethers";
import IUniswapV3PoolABI from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { computePoolAddress, FeeAmount, Pool } from "@uniswap/v3-sdk";

import { CurrentConfig } from "@/config";
import { POOL_FACTORY_CONTRACT_ADDRESS, USDC, SBC } from "@/lib/constants";
import { getPolygonProvider } from "@/lib/providers";

interface PoolInfo {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: ethers.BigNumber;
  liquidity: ethers.BigNumber;
  tick: number;
}

export async function getPoolData(
  poolContract: ethers.Contract,
): Promise<Pool> {
  const [slot0, liquidity] = await Promise.all([
    poolContract.slot0(),
    poolContract.liquidity(),
  ]);

  const fullPool = new Pool(
    USDC,
    SBC,
    FeeAmount.LOWEST,
    slot0.sqrtPriceX96,
    liquidity,
    slot0.tick,
  );
  return fullPool;
}

export async function getPoolInfo(
  provider: ethers.providers.BaseProvider,
): Promise<PoolInfo> {
  if (!provider) {
    throw new Error("No provider");
  }

  const currentPoolAddress = computePoolAddress({
    factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA: CurrentConfig.tokens.in,
    tokenB: CurrentConfig.tokens.out,
    fee: CurrentConfig.tokens.poolFee,
  });

  const poolContract = new ethers.Contract(
    currentPoolAddress,
    IUniswapV3PoolABI.abi,
    provider,
  );

  const [token0, token1, fee, tickSpacing, liquidity, slot0] =
    await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.tickSpacing(),
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

  return {
    token0,
    token1,
    fee,
    tickSpacing,
    liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}

const USDC_SBC_UNISWAP_POOL_ADDRESS =
  "0x98A5a5D8D448A90C5378A07e30Da5148679b4C45";

export const sbcPoolContract = new ethers.Contract(
  USDC_SBC_UNISWAP_POOL_ADDRESS,
  IUniswapV3PoolABI.abi,
  getPolygonProvider(),
);
