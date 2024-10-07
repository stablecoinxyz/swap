import { CurrentConfig } from "@/config";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";

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

export const pimlicoUrl = `https://api.pimlico.io/v2/polygon/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;

export const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});
