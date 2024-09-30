"use client";

import React, { useState } from "react";
import { getContract } from "thirdweb";
import {
  ConnectButton,
  useActiveWallet,
  useWalletBalance,
} from "thirdweb/react";
import { polygon } from "thirdweb/chains";
import { client } from "./client";
import DisconnectIcon from "@/components/DisconnectIcon";
import SwitchIcon from "@/components/SwitchIcon";
import { getUniswapV3Pool } from "thirdweb/extensions/uniswap";

const usdcPolygon = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const sbcPolygon = "0xfdcC3dd6671eaB0709A4C0f3F53De9a333d80798";

// const factoryContract = getContract({
//   client,
//   address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
//   chain: polygon,
// });

// const pools = await getUniswapV3Pool({
//   tokenA: usdcPolygon,
//   tokenB: sbcPolygon,
//   contract: factoryContract,
// });
// console.log(`pools: ${pools}`);

export default function Home() {
  const conversionRate = 0.99;
  const wallet = useActiveWallet();
  const [isSwitched, setIsSwitched] = useState(false);

  const handleSwitch = () => {
    setIsSwitched(!isSwitched);
    // set both input boxes to empty
    const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
    const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
    if (usdcInput) {
      usdcInput.value = "";
    }
    if (sbcInput) {
      sbcInput.value = "";
    }
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
    chain: polygon,
    client,
    tokenAddress: usdcPolygon,
  });

  const {
    data: sbcBalance,
    isLoading: sbcIsLoading,
    isError: sbcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: polygon,
    client,
    tokenAddress: sbcPolygon,
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
          {isSwitched && (
            <>
              <button
                className="text-sm text-zinc-400 hover:text-zinc-200 mr-2"
                onClick={() => {
                  const input = document.getElementById(
                    "sbcInput"
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = sbcBalance
                      ? (Number(sbcBalance.displayValue) / 2).toString()
                      : "0";
                    // trigger onInput event to update usdc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                  }
                }}
              >
                [50%]
              </button>
              <button
                className="text-sm text-zinc-400 hover:text-zinc-200 mr-8"
                onClick={() => {
                  const input = document.getElementById(
                    "sbcInput"
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = sbcBalance
                      ? sbcBalance.displayValue.toString()
                      : "0";
                    // trigger onInput event to update usdc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                  }
                }}
              >
                [max]
              </button>
            </>
          )}

          <span className="font-bold">
            Balance: {sbcIsLoading ? "Loading..." : sbcBalance?.displayValue}
          </span>
        </p>
        <input
          id="sbcInput"
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 font-extrabold text-zinc-600 rounded w-full"
          placeholder="Enter amount"
          onInput={(e) => {
            const input = e.target as HTMLInputElement;
            input.value = input.value.replace(/[^0-9.]/g, "");
            // update usdc input with converted value based on current conversionRate
            const usdcInput = document.getElementById(
              "usdcInput"
            ) as HTMLInputElement;
            if (isSwitched && usdcInput) {
              usdcInput.value = input.value
                ? (Number(input.value) / (1 / conversionRate)).toString()
                : "";
            }
          }}
        />
      </div>
    );
  }

  function UsdcContainer() {
    return (
      <div className="flex flex-col border border-zinc-800 p-4 rounded-lg w-full relative">
        <h2 className="text-lg font-semibold mb-2">USDC</h2>
        <p className="text-sm text-zinc-400 absolute top-4 right-4">
          {!isSwitched && (
            <>
              <button
                className="text-sm text-zinc-400 hover:text-zinc-200 mr-2"
                onClick={() => {
                  const input = document.getElementById(
                    "usdcInput"
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = usdcBalance
                      ? (Number(usdcBalance.displayValue) / 2).toString()
                      : "0";
                    // trigger onInput event to update sbc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                  }
                }}
              >
                [50%]
              </button>
              <button
                className="text-sm text-zinc-400 hover:text-zinc-200 mr-8"
                onClick={() => {
                  const input = document.getElementById(
                    "usdcInput"
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = usdcBalance
                      ? usdcBalance.displayValue.toString()
                      : "0";
                    // trigger onInput event to update sbc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                  }
                }}
              >
                [max]
              </button>
            </>
          )}

          <span className="font-bold">
            Balance: {usdcIsLoading ? "Loading..." : usdcBalance?.displayValue}
          </span>
        </p>
        <input
          id="usdcInput"
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 font-extrabold text-zinc-600 rounded w-full"
          placeholder="Enter amount"
          onInput={(e) => {
            const input = e.target as HTMLInputElement;
            input.value = input.value.replace(/[^0-9.]/g, "");
            console.log(`input.value: ${input.value}`);

            // update sbc input with converted value based on current conversionRate
            const sbcInput = document.getElementById(
              "sbcInput"
            ) as HTMLInputElement;
            console.log(`sbcInput: ${sbcInput}; isSwitched: ${isSwitched}`);
            if (!isSwitched && sbcInput) {
              sbcInput.value = input.value
                ? (Number(input.value) * conversionRate).toString()
                : "";
            }
          }}
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
