import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";

import { USDC, SBC } from "@/lib/constants";
import { ethers } from "ethers";

export interface TradeConfig {
  rpc: {
    local: string;
    mainnet: string;
    polygon: string;
  };
  tokens: {
    in: Token;
    amountIn: number;
    out: Token;
    poolFee: number;
  };
  provider: ethers.providers.JsonRpcProvider | null;
  wallet: ethers.Signer | null;
  account: any;
}

// App Configuration - Defaults

export const CurrentConfig: TradeConfig = {
  rpc: {
    local: "http://localhost:8545",
    mainnet: "",
    polygon: "https://polygon-rpc.com",
  },
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
