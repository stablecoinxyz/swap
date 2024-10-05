import { CurrentConfig } from "@/config";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

export const publicClient = createPublicClient({
  chain: polygon,
  transport: http(CurrentConfig.rpc.polygon),
});

export enum TransactionState {
  Failed = "Failed",
  New = "New",
  Rejected = "Rejected",
  Sending = "Sending",
  Sent = "Sent",
}

export function getPolygonScanUrl(transactionHash: string) {
  return `https://polygonscan.com/tx/${transactionHash}`;
}
