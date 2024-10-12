import { CurrentConfig } from "@/config";
import { createPublicClient, http, PublicClient } from "viem";
import { polygon, base } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";

export const publicClient = createPublicClient({
  chain: base,
  transport: http(CurrentConfig.rpc.base),
}) as PublicClient;

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

export function getBaseScanUrl(transactionHash: string) {
  return `https://basescan.org/tx/${transactionHash}`;
}

// export const pimlicoUrl = `https://api.pimlico.io/v2/polygon/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;
export const pimlicoUrl = `https://api.pimlico.io/v2/base/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;

export const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});
