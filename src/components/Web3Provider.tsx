"use client";

import { WagmiProvider, createConfig, http, fallback } from "wagmi";
import { base } from "wagmi/chains";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { CurrentConfig } from "@/config";

const fallbacks = [http(CurrentConfig.rpc.base)];

if (process.env.NEXT_PUBLIC_ALCHEMY_BASE_ENDPOINT) {
  fallbacks.push(http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_ENDPOINT));
}

const config = createConfig(
  getDefaultConfig({
    chains: [base],
    transports: {
      [base.id]: fallback(fallbacks),
    },

    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,

    // Required App Info
    appName: "Gasless Swap | Stable Coin",

    // Optional App Info
    appDescription: "A gasless swap app",
    appUrl: "https://swap.stablecoin.xyz",
    appIcon: "https://swap.stablecoin.xyz/sbc-logo.svg", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // gcTime: 1000 * 5, // 5 seconds
      structuralSharing: true,
      staleTime: 1000 * 1, // 1 second
    },
  },
});

interface Web3ProviderProps {
  children: React.ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="midnight">{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
