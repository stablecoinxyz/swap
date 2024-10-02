// This file stores web3 related constants such as addresses, token definitions, ETH currency references and ABI's

import { ChainId, Token } from "@uniswap/sdk-core";

// Addresses

export const POOL_FACTORY_CONTRACT_ADDRESS =
  "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const QUOTER_CONTRACT_ADDRESS =
  "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
export const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Currencies and Tokens
export const USDC_CONTRACT_ADDRESS =
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export const SBC_CONTRACT_ADDRESS =
  "0xfdcC3dd6671eaB0709A4C0f3F53De9a333d80798";

export const USDC = new Token(
  ChainId.POLYGON,
  USDC_CONTRACT_ADDRESS,
  6,
  "USDC",
  "USD Coin",
);
export const SBC = new Token(
  ChainId.POLYGON,
  SBC_CONTRACT_ADDRESS,
  18,
  "SBC",
  "Stable Coin",
);

// ABI's

export const ERC20_ABI = [
  // Read-Only Functions
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",

  // Authenticated Functions
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address _spender, uint256 _value) returns (bool)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

// Transactions

export const MAX_FEE_PER_GAS = 100000000000;
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000;
