import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";

import { USDC, SBC } from "@/lib/constants";
import { ethers } from "ethers";

// Sets if the example should run locally or on chain
export enum Environment {
  // LOCAL,
  MAINNET,
  WALLET_EXTENSION,
}

// Inputs that configure this example to run
export interface TradeConfig {
  env: Environment;
  rpc: {
    local: string;
    mainnet: string;
    polygon: string;
  };
  // wallet: {
  //   address: string;
  //   privateKey: string;
  // };
  tokens: {
    in: Token;
    amountIn: number;
    out: Token;
    poolFee: number;
  };
  provider: ethers.providers.JsonRpcProvider | null;
  wallet: any; //ethers.Wallet | null;
  account: any;
}

// Example Configuration

export const CurrentConfig: TradeConfig = {
  env: Environment.WALLET_EXTENSION,
  rpc: {
    local: "http://localhost:8545",
    mainnet: "",
    polygon: "https://polygon-rpc.com",
  },
  // wallet: {
  //   address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  //   privateKey:
  //     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  // },
  tokens: {
    in: USDC,
    amountIn: 1,
    out: SBC,
    poolFee: FeeAmount.LOWEST,
  },
  provider: null,
  wallet: null,
  account: null,
};
