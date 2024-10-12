import { ChainId, Token } from "@uniswap/sdk-core";

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
