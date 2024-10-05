import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";

import { USDC, SBC } from "@/lib/constants";
import { PublicClient, WalletClient } from "viem";
import { Account } from "thirdweb/wallets";
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
  provider: PublicClient | null;
  wallet: WalletClient | null;
  account: Account | null;
}

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
