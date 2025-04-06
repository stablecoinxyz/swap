import { CurrentConfig } from "@/config";
import { Chain, createPublicClient, http, PublicClient } from "viem";
import { base } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createPaymasterClient } from "viem/account-abstraction";

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

export function pimlicoUrlForChain(chain: Chain) {
  try {
    return `https://api.pimlico.io/v2/${chain.name.toLowerCase()}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;
  } catch (e) {
    return `chain ${chain.name} not supported`;
  }
}

export const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrlForChain(base)),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

export const sbcPaymasterClient = createPaymasterClient({
  transport: http(process.env.NEXT_PUBLIC_PAYMASTER_SERVICE_URL!),
});

