import { BaseProvider } from "@ethersproject/providers";
import { BigNumber, ethers } from "ethers";

import { CurrentConfig, TradeConfig } from "../config";

// Single copies of provider and wallet
const polygonProvider = new ethers.providers.JsonRpcProvider(
  CurrentConfig.rpc.polygon,
);

let walletExtensionAddress: string | null = null;

// Interfaces

export enum TransactionState {
  Failed = "Failed",
  New = "New",
  Rejected = "Rejected",
  Sending = "Sending",
  Sent = "Sent",
}

// Provider and Wallet Functions
export function getPolygonProvider(): BaseProvider {
  return polygonProvider;
}

export async function sendTransaction(
  transaction: ethers.providers.TransactionRequest,
  config: TradeConfig,
): Promise<{
  txState: TransactionState;
  receipt: ethers.providers.TransactionReceipt | null;
}> {
  const provider = config.provider;
  if (!provider) {
    return {
      receipt: null,
      txState: TransactionState.Failed,
    };
  }

  if (transaction.value) {
    transaction.value = BigNumber.from(transaction.value);
  }

  const txRes = await config.wallet!.sendTransaction(transaction);

  let receipt = null;

  try {
    while (receipt === null) {
      receipt = await provider.getTransactionReceipt(txRes.hash);

      if (receipt === null) {
        continue;
      }
    }
  } catch (e) {
    console.error(`Receipt error:`, e);
  }

  if (receipt) {
    return {
      receipt,
      txState: TransactionState.Sent,
    };
  } else {
    return {
      receipt: null,
      txState: TransactionState.Failed,
    };
  }
}

// function to return polygon scanner URL for a transaction hash
export function getPolygonScanUrl(transactionHash: string) {
  return `https://polygonscan.com/tx/${transactionHash}`;
}
