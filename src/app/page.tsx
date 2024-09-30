"use client";

// import Image from "next/image";
// import thirdwebIcon from "@public/thirdweb.svg";
import React, { useState } from "react";
import {
  ConnectButton,
  useActiveWallet,
  useWalletBalance,
} from "thirdweb/react";
import { sepolia } from "thirdweb/chains";
import { createWalletConnectClient } from "thirdweb/wallets";
import { client } from "./client";
import DisconnectIcon from "@/components/DisconnectIcon";
import SwitchIcon from "@/components/SwitchIcon";

const usdcSepolia = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const sbcSepolia = "0xA21658B5702C838FAd4AA840a07023ccDeAa1A85";

export default function Home() {
  const wallet = useActiveWallet();
  const [isSwitched, setIsSwitched] = useState(false);

  const handleSwitch = () => {
    setIsSwitched(!isSwitched);
  };

  wallet?.subscribe("accountChanged", (account) => {
    console.log(`accountChanged: ${account}`);
  });

  wallet?.subscribe("chainChanged", (chain) => {
    console.log(`chainChanged: ${chain}`);
  });

  const {
    data: usdcBalance,
    isLoading: usdcIsLoading,
    isError: usdcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: sepolia,
    client,
    tokenAddress: usdcSepolia,
  });

  const {
    data: sbcBalance,
    isLoading: sbcIsLoading,
    isError: sbcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: sepolia,
    client,
    tokenAddress: sbcSepolia,
  });

  function Switcher() {
    return (
      <div className="flex justify-center my-4">
        <button
          onClick={handleSwitch}
          className="px-2 py-2 bg-white-600 text-white rounded flex items-center justify-center"
          aria-label="Switch"
        >
          <SwitchIcon />
        </button>
      </div>
    );
  }

  function SbcContainer() {
    return (
      <div className="flex flex-col border border-zinc-800 p-4 rounded-lg w-full relative">
        <h2 className="text-lg font-semibold mb-2">SBC</h2>
        <p className="text-sm text-zinc-400 absolute top-4 right-4">
          Balance: {sbcIsLoading ? "Loading..." : sbcBalance?.displayValue}
        </p>
        <input
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 rounded w-full"
          placeholder="Enter amount"
        />
      </div>
    );
  }

  function UsdcContainer() {
    return (
      <div className="flex flex-col border border-zinc-800 p-4 rounded-lg w-full relative">
        <h2 className="text-lg font-semibold mb-2">USDC</h2>
        <p className="text-sm text-zinc-400 absolute top-4 right-4">
          Balance: {usdcIsLoading ? "Loading..." : usdcBalance?.displayValue}
        </p>
        <input
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 rounded w-full"
          placeholder="Enter amount"
        />
      </div>
    );
  }

  return (
    <main className="p-4 pb-10 min-h-[100vh] flex items-center justify-center container max-w-screen-lg mx-auto">
      <div className="py-20">
        <Header />

        <div className="flex justify-center mb-20">
          <div className="flex flex-row">
            <ConnectButton
              client={client}
              appMetadata={{
                name: "Stable Coin | Gasless Swap",
                url: "https://stablecoin.xyz",
              }}
            />
            {wallet && (
              <button
                onClick={() => wallet.disconnect()}
                className="ml-2 px-2 py-2 bg-white-600 text-white rounded flex items-center justify-center"
                style={{ height: "40px" }} // Adjust height to match ConnectButton
                aria-label="Disconnect"
              >
                <DisconnectIcon />
              </button>
            )}
          </div>
        </div>

        {isSwitched ? (
          <>
            <SbcContainer />
            <Switcher />
            <UsdcContainer />
          </>
        ) : (
          <>
            <UsdcContainer />
            <Switcher />
            <SbcContainer />
          </>
        )}
        {/* <ThirdwebResources /> */}
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-col items-center mb-20 md:mb-20">
      {/* <Image
        src={thirdwebIcon}
        alt=""
        className="size-[150px] md:size-[150px]"
        style={{
          filter: "drop-shadow(0px 0px 24px #a726a9a8)",
        }}
      /> */}

      <h1 className="text-2xl md:text-6xl font-semibold md:font-bold tracking-tighter mb-6 text-zinc-100">
        Stable Coin | Gasless Swap
      </h1>

      <p className="text-zinc-300 text-base">
        A gasless swap of USDC to SBC from{" "}
        <a
          href="https://stablecoin.xyz"
          target="_blank"
          className="text-zinc-400 underline"
        >
          stablecoin.xyz
        </a>
      </p>
    </header>
  );
}

function ThirdwebResources() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 justify-center">
      <ArticleCard
        title="thirdweb SDK Docs"
        href="https://portal.thirdweb.com/typescript/v5"
        description="thirdweb TypeScript SDK documentation"
      />

      <ArticleCard
        title="Components and Hooks"
        href="https://portal.thirdweb.com/typescript/v5/react"
        description="Learn about the thirdweb React components and hooks in thirdweb SDK"
      />

      <ArticleCard
        title="thirdweb Dashboard"
        href="https://thirdweb.com/dashboard"
        description="Deploy, configure, and manage your smart contracts from the dashboard."
      />
    </div>
  );
}

function ArticleCard(props: {
  title: string;
  href: string;
  description: string;
}) {
  return (
    <a
      href={props.href + "?utm_source=next-template"}
      target="_blank"
      className="flex flex-col border border-zinc-800 p-4 rounded-lg hover:bg-zinc-900 transition-colors hover:border-zinc-700"
    >
      <article>
        <h2 className="text-lg font-semibold mb-2">{props.title}</h2>
        <p className="text-sm text-zinc-400">{props.description}</p>
      </article>
    </a>
  );
}
