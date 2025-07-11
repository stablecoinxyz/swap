import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Navigation } from "@/components/Navigation";
import { Toaster } from "@/components/ui/toaster";
import { Web3Provider } from "@/components/Web3Provider";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>
          <div className="bg-background text-foreground">
            <Navigation />
            <div className="py-12">{children}</div>
          </div>
        </Web3Provider>
        <Toaster />
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: "SBC Swap",
  description: "Swap USDC and SBC without gas fees",
  keywords: "SBC, Stable Coin, stablecoins, swap, gasless, crypto, blockchain",
  twitter: {
    card: "summary",
    site: "@stablecoinxyz",
    creator: "@stablecoinxyz",
    title: "SBC Swap",
    description: "Swap USDC and SBC without gas fees",
    images: [
      {
        url: "https://swap.stablecoin.xyz/SwapOpenGraph.png",
        alt: "SBC Swap",
      },
    ],
  },
  openGraph: {
    type: "website",
    url: "https://swap.stablecoin.xyz",
    siteName: "SBC Swap",
    title: "SBC Swap",
    description: "Swap USDC and SBC without gas fees",
    images: [
      {
        url: "https://swap.stablecoin.xyz/SwapOpenGraph.png",
        alt: "SBC Swap",
      },
    ],
  },
  metadataBase: new URL("https://swap.stablecoin.xyz"),
};
