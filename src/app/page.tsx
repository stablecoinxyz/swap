"use client";

import React, { useState, useMemo } from "react";
import { NumericFormat } from "react-number-format";
import { useAccount, useBalance, useWalletClient } from "wagmi";
import { getPoolData } from "@/lib/pool";
import { USDC, SBC } from "@/lib/constants";
import { createTrade, executeTrade, executeGaslessTrade } from "@/lib/trading";
import { getScannerUrl } from "@/lib/providers";
import SwitchIcon from "@/components/SwitchIcon";
import { CurrentConfig } from "@/config";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { publicClient } from "@/lib/providers";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { TransactionReceipt, Hex } from "viem";
import { base } from "viem/chains";

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
  const [availableLiquidity0, setAvailableLiquidity0] = useState(0);
  const [availableLiquidity1, setAvailableLiquidity1] = useState(0);
  const [price0, setPrice0] = useState(0);
  const [price1, setPrice1] = useState(0);

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

  useMemo(async () => {
    // get pool liquidity and store it in state
    const [pool, _, __, token0Amount, token1Amount] = await getPoolData();
    // console.debug("pool", pool);

    // const availableLiquidity = Number(pool.liquidity);
    // console.debug("Available liquidity", availableLiquidity);
    // console.debug("token0Amount", token0Amount);
    // console.debug("token1Amount", token1Amount);

    // cache the available liquidity
    setAvailableLiquidity0(token0Amount);
    setAvailableLiquidity1(token1Amount);

    // cache the prices
    setPrice0(Number(pool.token0Price.toSignificant()));
    setPrice1(Number(pool.token1Price.toSignificant()));
  }, []);

  return (
    <main className="px-4 pb-10 min-h-[100vh] flex items-top justify-center container max-w-screen-lg mx-auto">
      <div className="w-1/2">
        <Header />

        {isSwitched ? (
          <div className="w-full">
            <SbcContainer />
            <Switcher />
            <UsdcContainer />
          </div>
        ) : (
          <div className="w-full">
            <UsdcContainer />
            <Switcher />
            <SbcContainer />
          </div>
        )}

        <div className="flex justify-center mt-8">
          <button
            type="button"
            className="px-10 py-3 rounded-lg dark:bg-white bg-zinc-950 dark:text-zinc-950 text-neutral-100  hover:font-extrabold disabled:font-normal disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isFetched || !isConnected}
            onClick={async () => {
              const { usdcAmount, sbcAmount } = getTradeAmounts();
              if (!usdcAmount && !sbcAmount) {
                toast({
                  title: "No amount entered",
                  description: `Please enter an amount to swap`,
                  duration: 3000,
                });
                return;
              }
              if (!address) {
                toast({
                  title: "No account found",
                  description: `Please connect your wallet to perform the swap`,
                  duration: 3000,
                });
                return;
              }

              const tradeAmount = isSwitched
                ? Number(sbcAmount.replace(/,/g, ""))
                : Number(usdcAmount.replace(/,/g, ""));
              console.debug({ tradeAmount });
              if (
                tradeAmount > availableLiquidity0 ||
                tradeAmount > availableLiquidity1
              ) {
                toast({
                  title: "Not enough liquidity available",
                  description: `Please swap a smaller amount`,
                  duration: 3000,
                });
                return;
              }

              toast({
                title: "Performing Swap",
                description: `Please wait while we process your transaction...`,
                duration: 9000,
              });

              const receipt = await doSwap(gasless);

              if (!receipt || "error" in receipt) {
                const error = receipt.error || "Please try again later";
                toast({
                  title: "Transaction Failed",
                  description: `😢 ${error}`,
                  duration: 9000,
                });

                return;
              } else if (
                receipt &&
                !("error" in receipt) &&
                "transactionHash" in receipt
              ) {
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
                    window.open(
                      getScannerUrl(base.id, receipt!.transactionHash),
                    );
                  },
                });
              }
            }}
          >
            Swap
          </button>
        </div>
      </div>
    </main>
  );

  function Header() {
    return (
      <header className="flex flex-col items-center my-20 md:mb-20">
        <h1 className="text-2xl font-semibold tracking-tighter">
          Stable Coin | Gasless Swap
        </h1>

        <div className="text-base mt-2">
          A gasless swap of USDC &lt;&mdash;&gt; SBC
          <div className="text-center">
            <a
              href="https://stablecoin.xyz"
              target="_blank"
              className="text-violet-700 hover:font-semibold"
            >
              stablecoin.xyz
            </a>
          </div>
        </div>
      </header>
    );
  }

  function handleSwitch() {
    setIsSwitched(!isSwitched);
    resetTradeAmounts();
  }

  async function quoteUsdcToSbc(usdcAmount: string) {
    return Number(usdcAmount) * Number(price0);
  }

  async function quoteSbcToUsdc(sbcAmount: string) {
    return Number(sbcAmount) * Number(price1);
  }

  async function doSwap(
    gasless: boolean,
  ): Promise<
    TransactionReceipt | { transactionHash: Hex } | { error: string }
  > {
    const { usdcAmount, sbcAmount } = getTradeAmounts();
    // console.debug({ usdcAmount, sbcAmount });
    const config = CurrentConfig;
    config.provider = publicClient;

    config.tokens.amountIn = isSwitched
      ? Number(sbcAmount)
      : Number(usdcAmount);
    config.tokens.in = isSwitched ? SBC : USDC;
    config.tokens.out = isSwitched ? USDC : SBC;

    const trade = await createTrade(config);
    if (!trade) {
      return {
        error: "No trade created",
      };
    }

    let response;
    try {
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
    } catch (error) {
      return {
        error: "Error executing trade",
      };
    }
  }

  function getTradeAmounts() {
    const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
    const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
    const usdcAmount = usdcInput ? usdcInput.value.replace(/,/g, "") : "";
    const sbcAmount = sbcInput ? sbcInput.value.replace(/,/g, "") : "";
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
          className="px-2 py-2 rounded flex items-center justify-center"
          aria-label="Switch"
        >
          <SwitchIcon />
        </button>
      </div>
    );
  }

  function SbcContainer() {
    async function updateUsdcValue(input: HTMLInputElement) {
      const usdcInput = document.getElementById(
        "usdcInput",
      ) as HTMLInputElement;
      const usdcOut = await quoteSbcToUsdc(input.value);
      if (isSwitched && usdcInput) {
        usdcInput.value = input.value ? usdcOut.toFixed(3) : "";
      }
    }

    return (
      <div className="flex flex-col border border-zinc-800 text-zinc-950 bg-zinc-50 p-4 rounded-lg w-full relative">
        <div className="flex flex-row justify-between">
          <h2 className="text-lg font-semibold mb-2">SBC</h2>
          <div className="flex flex-col">
            <span className="flex font-bold text-sm">
              Balance:{" "}
              {!isSbcLoading &&
                sbcBalance &&
                Number(sbcBalance.formatted).toFixed(3)}{" "}
            </span>
            <span className="flex text-sm w-full justify-end mt-1">
              {isSwitched && (
                <span className="flex">
                  <button
                    className="flex text-xs mr-2"
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
                    className="flex text-xs"
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
                </span>
              )}
            </span>
          </div>
        </div>
        <NumericFormat
          id="sbcInput"
          type="text"
          className="mt-2 p-3 text-lg border border-zinc-600 text-zinc-950 bg-zinc-50 font-extrabold rounded w-full text-right"
          placeholder="Enter amount"
          thousandSeparator={true}
          onInput={async (e: any) => {
            const input = e.target as HTMLInputElement;
            input.value = input.value.replace(/[^0-9.]/g, "");

            const value = input.value.replace(/,/g, "");
            const balance = sbcBalance ? Number(sbcBalance.formatted) : 0;
            if (
              parseFloat(value) > balance ||
              parseFloat(value) > availableLiquidity0 ||
              parseFloat(value) > availableLiquidity1
            ) {
              input.value = balance.toFixed(3);
            }
            await updateUsdcValue(input);
          }}
        />
      </div>
    );
  }

  function UsdcContainer() {
    async function updateSbcValue(input: HTMLInputElement) {
      const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
      const sbcOut = await quoteUsdcToSbc(input.value);
      if (!isSwitched && sbcInput) {
        sbcInput.value = input.value ? sbcOut.toFixed(3) : "";
      }
    }

    return (
      <div className="flex flex-col border border-zinc-800 text-zinc-950 bg-zinc-50 p-4 rounded-lg w-full relative">
        <div className="flex flex-row justify-between">
          <h2 className="flex text-lg font-semibold mb-2">USDC</h2>
          <div className="flex flex-col">
            <span className="flex font-bold text-sm">
              Balance:{" "}
              {!isUsdcLoading &&
                usdcBalance &&
                Number(usdcBalance.formatted).toFixed(3)}
            </span>
            <span className="flex text-sm w-full justify-end mt-1">
              {!isSwitched && (
                <span className="flex">
                  <button
                    className="flex text-xs mr-2"
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
                    className="flex text-xs"
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
                </span>
              )}
            </span>
          </div>
        </div>

        <NumericFormat
          id="usdcInput"
          type="text"
          className="mt-2 p-3 text-lg border border-zinc-600 text-zinc-950 bg-zinc-50 font-extrabold rounded w-full text-right"
          placeholder="Enter amount"
          thousandSeparator={true}
          onInput={async (e: any) => {
            const input = e.target as HTMLInputElement;
            const value = input.value.replace(/[^0-9.]/g, "");

            const balance = usdcBalance ? Number(usdcBalance.formatted) : 0;
            if (
              parseFloat(value) > balance ||
              parseFloat(value) > availableLiquidity0 ||
              parseFloat(value) > availableLiquidity1
            ) {
              input.value = balance.toFixed(3);
            }
            await updateSbcValue(input);
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
