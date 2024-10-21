"use client";

import React, { useState, useEffect } from "react";

import { ConnectKitButton } from "connectkit";

import { useAccount, useBalance, useWalletClient } from "wagmi";

import { getPoolData } from "@/lib/pool";
import { USDC, SBC } from "@/lib/constants";
import { createTrade, executeTrade, executeGaslessTrade } from "@/lib/trading";
import { getScannerUrl } from "@/lib/providers";
import { Header } from "@/components/Header";
import SwitchIcon from "@/components/SwitchIcon";
import { CurrentConfig } from "@/config";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { publicClient } from "@/lib/providers";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { TransactionReceipt, Hex } from "viem";
import { polygon, base } from "viem/chains";

export default function Home() {
  const account = useAccount();
  const { address, isConnected } = account;
  const { data: wallet, isFetched } = useWalletClient();
  if (isFetched && isConnected) {
    CurrentConfig.wallet = wallet!;
    CurrentConfig.account = account!;
  }

  const [isSwitched, setIsSwitched] = useState(false);
  const [gasless, setGasless] = useState(true);

  const { toast } = useToast();

  const {
    data: usdcBalance,
    isLoading: isUsdcLoading,
    isError: isUsdcError,
  } = useBalance({
    address,
    token: USDC.address as Hex,
  });

  const {
    data: sbcBalance,
    isLoading: isSbcLoading,
    isError: isSbcError,
  } = useBalance({
    address,
    token: SBC.address as Hex,
  });

  // useEffect(() => {
  //   // add class for light mode
  //   if (!gasless) {
  //     document.documentElement.classList.remove("dark");
  //     document.documentElement.classList.add("theme");
  //   } else {
  //     document.documentElement.classList.add("dark");
  //     document.documentElement.classList.remove("theme");
  //   }
  // }, [gasless]);
  return (
    <main className="px-4 pb-10 min-h-[100vh] flex items-center justify-center container max-w-screen-lg mx-auto">
      <div className="py-8">
        <Header />

        <div className="flex justify-center">
          <div className="flex flex-col -mt-8 mb-16 space-y-4">
            <ConnectKitButton />
            <GaslessSwitch />
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
              const { usdcAmount, sbcAmount } = getTradeAmounts();
              if (!usdcAmount && !sbcAmount) {
                console.log("No amount entered");
                return;
              }
              if (!address) {
                console.error("No account found");
                return;
              }
              toast({
                title: "Performing Swap",
                description: `Please wait while we process your transaction...`,
                duration: 9000,
                onClick: () => {
                  window.open(getScannerUrl(base.id, receipt!.transactionHash));
                },
              });

              const receipt = await doSwap(gasless);

              resetTradeAmounts();

              toast({
                title: "Transaction Sent",
                action: (
                  <ToastAction altText="View on BaseScan">
                    View Status
                  </ToastAction>
                ),
                description: `🎉 Check your transaction status 👉🏻`,
                duration: 9000,
                onClick: () => {
                  window.open(getScannerUrl(base.id, receipt!.transactionHash));
                },
              });
            }}
            className="px-4 py-2  dark:bg-white bg-zinc-950 dark:text-zinc-950 text-neutral-100 rounded hover:font-extrabold disabled:font-normal disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isFetched || !isConnected}
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
      console.log("No amount entered");
      return null;
    }
    if (!address) {
      console.error("No account found");
      return null;
    }
    const config = CurrentConfig;
    config.provider = publicClient;

    config.tokens.amountIn = isSwitched
      ? Number(sbcAmount)
      : Number(usdcAmount);
    config.tokens.in = isSwitched ? SBC : USDC;
    config.tokens.out = isSwitched ? USDC : SBC;

    const trade = await createTrade(config);
    if (!trade) {
      console.error("No trade created");
      return null;
    }

    let response;
    if (gasless) {
      const { userOpHash, txState: status } = await executeGaslessTrade(
        trade,
        config,
      );

      console.debug(
        `Executed gasless trade: ${status}; Receipt: ${getScannerUrl(base.id, userOpHash)}`,
      );

      response = { transactionHash: userOpHash as Hex };
    } else {
      const { receipt, txState: status } = await executeTrade(
        trade,
        config,
        CurrentConfig.wallet!,
      );

      console.debug(
        `Executed trade: ${status}; Receipt: ${getScannerUrl(base.id, receipt!.transactionHash)}`,
      );

      response = { transactionHash: receipt!.transactionHash };
    }
    return response;
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
          className="px-2 py-2  rounded flex items-center justify-center"
          aria-label="Switch"
        >
          <SwitchIcon />
        </button>
      </div>
    );
  }

  function SbcContainer() {
    return (
      <div className="flex flex-col border border-zinc-800 text-zinc-950 bg-zinc-50 p-4 rounded-lg w-full relative">
        <h2 className="text-lg font-semibold mb-2">SBC</h2>
        <p className="text-sm absolute top-4 right-4">
          {isSwitched && (
            <>
              <button
                className="text-sm mr-2"
                onClick={() => {
                  const input = document.getElementById(
                    "sbcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = sbcBalance
                      ? (Number(sbcBalance.formatted) / 2).toFixed(3)
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
                className="text-sm mr-8"
                onClick={() => {
                  const input = document.getElementById(
                    "sbcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = sbcBalance
                      ? Number(sbcBalance.formatted).toFixed(3)
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
            {!isSbcLoading &&
              sbcBalance &&
              Number(sbcBalance.formatted).toFixed(3)}{" "}
          </span>
        </p>
        <input
          id="sbcInput"
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 text-zinc-950 bg-zinc-50 font-extrabold rounded w-full text-right"
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
          onBlur={async (e) => {
            // set the input to the max value if it exceeds the balance
            const input = e.target as HTMLInputElement;
            const value = Number(input.value);

            const balance = sbcBalance ? Number(sbcBalance.formatted) : 0;
            if (value > balance) {
              input.value = balance.toFixed(3);
              // trigger onInput event to update usdc input
              input.dispatchEvent(
                new Event("input", {
                  bubbles: true,
                  cancelable: true,
                }),
              );
            }

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
      <div className="flex flex-col border border-zinc-800 text-zinc-950 bg-zinc-50 p-4 rounded-lg w-full relative">
        <h2 className="text-lg font-semibold mb-2">USDC</h2>
        <p className="text-sm  absolute top-4 right-4">
          {!isSwitched && (
            <>
              <button
                className="text-sm mr-2"
                onClick={() => {
                  const input = document.getElementById(
                    "usdcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = usdcBalance
                      ? (Number(usdcBalance.formatted) / 2).toFixed(3)
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
                className="text-sm mr-8"
                onClick={() => {
                  const input = document.getElementById(
                    "usdcInput",
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = usdcBalance
                      ? Number(usdcBalance.formatted).toFixed(3)
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
            {!isUsdcLoading &&
              usdcBalance &&
              Number(usdcBalance.formatted).toFixed(3)}
          </span>
        </p>
        <input
          id="usdcInput"
          type="text"
          className="mt-auto p-2 text-lg border border-zinc-600 text-zinc-950 bg-zinc-50 font-extrabold rounded w-full text-right"
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
          onBlur={async (e) => {
            // set the input to the max value if it exceeds the balance
            const input = e.target as HTMLInputElement;
            const value = Number(input.value);

            const balance = usdcBalance ? Number(usdcBalance.formatted) : 0;
            if (value > balance) {
              input.value = balance.toFixed(3);
              // trigger onInput event to update sbc input
              input.dispatchEvent(
                new Event("input", {
                  bubbles: true,
                  cancelable: true,
                }),
              );
            }

            // update sbc input with converted value based on current conversionRate
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

  function GaslessSwitch() {
    const migratedToUniversalRouter = false;
    if (!migratedToUniversalRouter) {
      return null;
    } else {
      return (
        <div className="flex flex-row space-x-2 justify-center content-center ">
          <Switch
            className="flex border-zinc-400"
            id="gasless-switch"
            checked={gasless}
            onCheckedChange={() => setGasless(!gasless)}
          />
          <Label
            htmlFor="gasless-switch"
            className="flex dark:bg-zinc-950 text-zinc-950 dark:text-neutral-100 pt-0.5 text-xs"
          >
            <p>Gasless: {gasless ? "ON" : "OFF"}</p>
          </Label>
        </div>
      );
    }
  }
}
