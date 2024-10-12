// This file stores web3 related constants such as addresses, token definitions, ETH currency references and ABI's

import { ChainId, Token } from "@uniswap/sdk-core";

// Addresses

// polygon
// export const POOL_FACTORY_CONTRACT_ADDRESS =
//   "0x1F98431c8aD98523631AE4a59f267346ea31F984";

// base
export const POOL_FACTORY_CONTRACT_ADDRESS =
  "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

// polygon
// export const QUOTER_CONTRACT_ADDRESS =
// "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";

// base
export const QUOTER_CONTRACT_ADDRESS =
  "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

// export const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Currencies and Tokens
export const USDC_CONTRACT_ADDRESS =
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export const SBC_CONTRACT_ADDRESS =
  "0xfdcC3dd6671eaB0709A4C0f3F53De9a333d80798";

// export const USDC = new Token(
//   ChainId.POLYGON,
//   USDC_CONTRACT_ADDRESS,
//   6,
//   "USDC",
//   "USD Coin",
// );
export const USDC = new Token(
  ChainId.BASE,
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  6,
  "USDC",
  "USD Coin",
);
// export const SBC = new Token(
//   ChainId.POLYGON,
//   SBC_CONTRACT_ADDRESS,
//   18,
//   "SBC",
//   "Stable Coin",
// );
export const SBC = new Token(
  ChainId.BASE,
  SBC_CONTRACT_ADDRESS,
  18,
  "SBC",
  "Stable Coin",
);

export const MAX_FEE_PER_GAS = 100000000000;
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000;
