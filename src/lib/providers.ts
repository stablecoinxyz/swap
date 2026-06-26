import { createPublicClient, http, PublicClient } from "viem";
import { createPaymasterClient } from "viem/account-abstraction";
import { base } from "viem/chains";

export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_ENDPOINT as string, {
    timeout: 240_000,
  }),
}) as PublicClient;

export enum TransactionState {
  Failed = "Failed",
  New = "New",
  Rejected = "Rejected",
  Sending = "Sending",
  Sent = "Sent",
}

export function getScannerUrl(chainId: number, transactionHash: string) {
  switch (chainId) {
    case base.id:
      return `https://basescan.org/tx/${transactionHash}`;
    default:
      return `chainId ${chainId} not supported`;
  }
}

export const sbcPaymasterUrl = process.env.NEXT_PUBLIC_AA_BASE_URL!;

export const sbcPaymasterClient = createPaymasterClient({
  transport: http(sbcPaymasterUrl),
});
