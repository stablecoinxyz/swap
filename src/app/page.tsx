"use client";

import React, { useState, useEffect } from "react";

import {
  ConnectButton,
  useActiveAccount,
  useActiveWallet,
  useWalletBalance,
} from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { polygon as polygonChain } from "thirdweb/chains";

import { getPoolData } from "@/lib/pool";
import { USDC, SBC } from "@/lib/constants";
import { createTrade, executeTrade, executeGaslessTrade } from "@/lib/trading";
import { getPolygonScanUrl } from "@/lib/providers";

import { Header } from "@/components/Header";
import DisconnectIcon from "@/components/DisconnectIcon";
import SwitchIcon from "@/components/SwitchIcon";

import { CurrentConfig } from "@/config";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { client } from "@/app/client";

import { publicClient } from "@/lib/providers";
import { polygon } from "viem/chains";

import {
  TransactionReceipt,
  custom,
  createWalletClient,
  WalletClient,
  Hex,
} from "viem";

export default function Home() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();

  const [isSwitched, setIsSwitched] = useState(false);
  const [userWallet, setUserWallet] = useState<WalletClient | null>(null);
  const [gasless, setGasless] = useState(true);

  const { toast } = useToast();

  const {
    data: usdcBalance,
    isLoading: usdcIsLoading,
    isError: usdcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: polygonChain,
    client,
    tokenAddress: USDC.address,
  });

  const {
    data: sbcBalance,
    isLoading: sbcIsLoading,
    isError: sbcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: polygonChain,
    client,
    tokenAddress: SBC.address,
  });

  useEffect(() => {
    if (!account || !window) {
      return;
    }

    const w = createWalletClient({
      chain: polygon,
      account: account.address as Hex,
      transport: custom((window as any).ethereum!),
    });
    setUserWallet(w);
    // console.debug("Wallet client created", w);
  }, [account]);

  return (
    <main className="px-4 pb-10 min-h-[100vh] flex items-center justify-center container max-w-screen-lg mx-auto">
      <div className="py-14">
        <Header />

        <div className="flex justify-center">
          <div className="flex flex-row -mt-12 mb-16">
            <ConnectButton
              client={client}
              wallets={[createWallet("io.metamask")]}
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

        <div className="flex justify-center mt-8">
          <button
            onClick={async () => {
              toast({
                title: "Performing Swap",
                description: `Please wait while we process your transaction...`,
                duration: 9000,
                onClick: () => {
                  window.open(getPolygonScanUrl(receipt!.transactionHash));
                },
              });

              const receipt = await doSwap(gasless);

              resetTradeAmounts();

              toast({
                title: "Transaction Sent",
                action: (
                  <ToastAction altText="View on PolygonScan">
                    View Status
                  </ToastAction>
                ),
                description: `🎉 Check your transaction status 👉🏻`,
                duration: 9000,
                onClick: () => {
                  window.open(getPolygonScanUrl(receipt!.transactionHash));
                },
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={account === undefined}
          >
            Swap
          </button>
        </div>
      </div>
    </main>
  );

  function handleSwitch() {
    setIsSwitched(!isSwitched);
    resetTradeAmounts();
  }

  async function quoteUsdcToSbc(usdcAmount: string) {
    const pool = await getPoolData();
    return Number(usdcAmount) * Number(pool.token0Price.toSignificant());
  }

  async function quoteSbcToUsdc(sbcAmount: string) {
    const pool = await getPoolData();
    return Number(sbcAmount) * Number(pool.token1Price.toSignificant());
  }

  async function doSwap(
    gasless: boolean,
  ): Promise<TransactionReceipt | { transactionHash: Hex } | null> {
    const { usdcAmount, sbcAmount } = getTradeAmounts();
    if (!usdcAmount && !sbcAmount) {
      return null;
    }
    if (!account) {
      console.error("No account found");
      return null;
    }
    const config = CurrentConfig;

    config.provider = publicClient;
    config.account = account;

    config.tokens.amountIn = isSwitched
      ? Number(sbcAmount)
      : Number(usdcAmount);
    config.tokens.in = isSwitched ? SBC : USDC;
    config.tokens.out = isSwitched ? USDC : SBC;

    if (!config.account!.address) {
      console.error("No wallet address found");
      return null;
    }

    const trade = await createTrade(config);
    if (!trade) {
      console.error("No trade created");
      return null;
    }

    if (gasless) {
      const { userOpHash, txState: status } = await executeGaslessTrade(
        trade,
        config,
        userWallet!,
      );

      console.debug(
        `Executed gasless trade: ${status}; Receipt: ${getPolygonScanUrl(userOpHash)}`,
      );
      return { transactionHash: userOpHash as Hex };
    } else {
      const { receipt, txState: status } = await executeTrade(
        trade,
        config,
        userWallet!,
      );
      console.debug(
        `Executed trade: ${status}; Receipt: ${getPolygonScanUrl(receipt!.transactionHash)}`,
      );
      return receipt;
    }
  }

  function getTradeAmounts() {
    const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
    const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
    const usdcAmount = usdcInput ? usdcInput.value : "";
    const sbcAmount = sbcInput ? sbcInput.value : "";
    return { usdcAmount, sbcAmount };
  }

  function resetTradeAmounts() {
    const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
    const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
    if (usdcInput) {
      usdcInput.value = "";
    }
    if (sbcInput) {
      sbcInput.value = "";
    }
  }

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
                    "sbcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = sbcBalance
                      ? (Number(sbcBalance.displayValue) / 2).toFixed(3)
                      : "0";
                    // trigger onInput event to update usdc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      }),
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
                    "sbcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = sbcBalance
                      ? Number(sbcBalance.displayValue).toFixed(3)
                      : "0";
                    // trigger onInput event to update usdc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      }),
                    );
                  }
                }}
              >
                [max]
              </button>
            </>
          )}

          <span className="font-bold">
            Balance:{" "}
            {sbcIsLoading
              ? "Loading..."
              : sbcBalance && Number(sbcBalance.displayValue).toFixed(3)}
          </span>
        </p>
        <input
          id="sbcInput"
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 font-extrabold text-zinc-600 rounded w-full text-right"
          placeholder="Enter amount"
          onInput={async (e) => {
            const input = e.target as HTMLInputElement;
            input.value = input.value.replace(/[^0-9.]/g, "");
            // update usdc input with converted value based on current conversionRate
            const usdcInput = document.getElementById(
              "usdcInput",
            ) as HTMLInputElement;
            const usdcOut = await quoteSbcToUsdc(input.value);
            if (isSwitched && usdcInput) {
              usdcInput.value = input.value ? usdcOut.toFixed(3) : "";
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
                    "usdcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = usdcBalance
                      ? (Number(usdcBalance.displayValue) / 2).toFixed(3)
                      : "0";
                    // trigger onInput event to update sbc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      }),
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
                    "usdcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = usdcBalance
                      ? Number(usdcBalance.displayValue).toFixed(3)
                      : "0";
                    // trigger onInput event to update sbc input
                    input.dispatchEvent(
                      new Event("input", {
                        bubbles: true,
                        cancelable: true,
                      }),
                    );
                  }
                }}
              >
                [max]
              </button>
            </>
          )}

          <span className="font-bold">
            Balance:{" "}
            {usdcIsLoading
              ? "Loading..."
              : usdcBalance && Number(usdcBalance.displayValue).toFixed(3)}
          </span>
        </p>
        <input
          id="usdcInput"
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 font-extrabold text-zinc-600 rounded w-full text-right"
          placeholder="Enter amount"
          onInput={async (e) => {
            const input = e.target as HTMLInputElement;
            input.value = input.value.replace(/[^0-9.]/g, "");

            const sbcInput = document.getElementById(
              "sbcInput",
            ) as HTMLInputElement;
            const sbcOut = await quoteUsdcToSbc(input.value);
            if (!isSwitched && sbcInput) {
              sbcInput.value = input.value ? sbcOut.toFixed(3) : "";
            }
          }}
        />
      </div>
    );
  }
}
