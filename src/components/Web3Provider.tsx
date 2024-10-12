"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { polygon, base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { CurrentConfig } from "@/config";

const config = createConfig(
  getDefaultConfig({
    chains: [base, polygon],
    transports: {
      [base.id]: http(CurrentConfig.rpc.base),
      [polygon.id]: http(CurrentConfig.rpc.polygon),
    },

    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,

    // Required App Info
    appName: "Gasless Swap | Stable Coin",

    // Optional App Info
    appDescription: "A gasless swap app",
    appUrl: "https://swap.stablecoin.xyz", // your app's url
    appIcon: "https://family.co/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);

const queryClient = new QueryClient();

interface Web3ProviderProps {
  children: React.ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
