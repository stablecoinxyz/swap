import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";

import { USDC, SBC } from "@/lib/constants";
import { PublicClient, WalletClient } from "viem";
import { UseAccountReturnType } from "wagmi";
export interface TradeConfig {
  rpc: {
    local: string;
    mainnet: string;
    polygon: string;
    base: string;
  };
  tokens: {
    in: Token;
    amountIn: number;
    out: Token;
    poolFee: number;
  };
  provider: PublicClient | null;
  wallet: WalletClient | null;
  account: UseAccountReturnType | null;
}

export const CurrentConfig: TradeConfig = {
  rpc: {
    local: "http://localhost:8545",
    mainnet: "",
    polygon: "https://polygon-rpc.com",
    base: "https://base-rpc.publicnode.com", //https://base.llamarpc.com",
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
