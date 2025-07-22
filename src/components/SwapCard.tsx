"use client";
import { KernelAccountClient } from "@zerodev/sdk";
import Image from "next/image";
import { memo, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";
import { Hex, TransactionReceipt } from "viem";
import { base } from "viem/chains";

import { ToastAction } from "@/components/ui/toast";
import { CurrentConfig } from "@/config";
import { useToast } from "@/hooks/use-toast";
import { SBC, USDC } from "@/lib/constants";
import { getPoolData } from "@/lib/pool";
import { getScannerUrl } from "@/lib/providers";
import { publicClient } from "@/lib/providers";
import { createTrade, execute7702GaslessTrade, executeGaslessTrade } from "@/lib/trading";

function getTradeAmounts(): { usdcAmount: string; sbcAmount: string } {
  const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
  const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
  const usdcAmount = usdcInput ? usdcInput.value.replace(/,/g, "") : "";
  const sbcAmount = sbcInput ? sbcInput.value.replace(/,/g, "") : "";
  return { usdcAmount, sbcAmount };
}

function resetTradeAmounts(): void {
  const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
  const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
  if (usdcInput) {
    usdcInput.value = "";
  }
  if (sbcInput) {
    sbcInput.value = "";
  }
}

const SwapCard = memo(
  ({
    isFetched,
    isConnected,
    isReconnecting,
    isUsdcLoading,
    isSbcLoading,
    address,
    sbcBalance,
    usdcBalance,
    use7702,
    sessionKeyAddress,
    sessionKernelClient,
    disabled,
  }: {
    isFetched: boolean;
    isConnected: boolean;
    isReconnecting: boolean;
    isUsdcLoading: boolean;
    isSbcLoading: boolean;
    address: Hex | undefined;
    sbcBalance:
    | {
      decimals: number;
      formatted: string;
      symbol: string;
      value: bigint;
    }
    | undefined;
    usdcBalance:
    | {
      decimals: number;
      formatted: string;
      symbol: string;
      value: bigint;
    }
    | undefined;
    use7702: boolean;
    sessionKeyAddress: Hex | undefined;
    sessionKernelClient: KernelAccountClient | null;
    disabled?: boolean;
  }) => {
    const [isSwitched, setIsSwitched] = useState(false);
    const [availableLiquidity0, setAvailableLiquidity0] = useState(0);
    const [availableLiquidity1, setAvailableLiquidity1] = useState(0);
    const [price0, setPrice0] = useState(0);
    const [price1, setPrice1] = useState(0);

    const { toast } = useToast();

    useMemo(async () => {
      // get pool liquidity and store it in state
      const [pool, _, __, token0Amount, token1Amount] = await getPoolData();

      // cache the available liquidity
      setAvailableLiquidity0(token0Amount);
      setAvailableLiquidity1(token1Amount);

      // cache the prices
      setPrice0(Number(pool.token0Price.toSignificant()));
      setPrice1(Number(pool.token1Price.toSignificant()));
    }, []);

    function handleSwitch() {
      setIsSwitched(!isSwitched);
      resetTradeAmounts();
    }

    function quoteUsdcToSbc(usdcAmount: string): number {
      return Number(usdcAmount) * Number(price0);
    }

    function quoteSbcToUsdc(sbcAmount: string): number {
      return Number(sbcAmount) * Number(price1);
    }

    function Switcher() {
      return (
        <div className="flex justify-center my-4 top-[170px] left-[270px] absolute z-30">
          <button
            onClick={handleSwitch}
            className="px-2 py-2 rounded flex items-center justify-center hover:cursor-pointer"
            aria-label="Switch"
          >
            <Image src="/switcher.svg" width={48} height={48} alt="switch" />
          </button>
        </div>
      );
    }

    function SbcContainer() {
      async function updateUsdcValue(input: HTMLInputElement) {
        const usdcInput = document.getElementById(
          "usdcInput",
        ) as HTMLInputElement;
        const usdcOut = quoteSbcToUsdc(input.value);
        if (isSwitched && usdcInput) {
          usdcInput.value = input.value ? usdcOut.toFixed(3) : "";
        }
      }

      return (
        <div className="flex flex-col border border-border text-foreground bg-card rounded-lg w-full relative pb-8">
          <div className="flex flex-row justify-between pt-2">
            <h2 className="flex text-lg font-semibold space-r-2 p-4">
              <span className="flex mr-3 text-2xl">
                {!isSwitched ? "Buy" : "Sell"}
              </span>
              <Image src="/sbcSelector.svg" width={90} height={100} alt="SBC" />
            </h2>
            <div className="flex flex-col">
              <div className="flex text-sm w-full justify-end space-4">
                {isSwitched ? (
                  <span className="flex p-4">
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
                      <Image
                        src="/Badge50pct.svg"
                        width={54}
                        height={54}
                        alt="sbc50pct"
                      />
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
                      <Image
                        src="/BadgeMax.svg"
                        width={54}
                        height={54}
                        alt="sbcMax"
                      />
                    </button>
                  </span>
                ) : (
                  <span className="flex p-6">
                    1 USDC = {quoteUsdcToSbc("1")} SBC
                    <div className="group relative">
                      <Image
                        className="ml-2 hover:cursor-pointer"
                        src="/CircleHelp.svg"
                        width={16}
                        height={16}
                        alt="help"
                      />
                      <div className="absolute z-50 hidden group-hover:block border border-border bg-popover text-popover-foreground p-2 rounded-md -right-56 top-0 w-48 text-sm">
                        The value you receive is based on the current market
                        rate in the Uniswap pool and may include fees or
                        slippage.
                      </div>
                    </div>
                  </span>
                )}
              </div>
            </div>
          </div>

          <NumericFormat
            id="sbcInput"
            type="text"
            className="relative m-4 p-6 text-xl border border-border text-mutedForeground bg-background rounded w-7/8"
            placeholder="Enter amount"
            thousandSeparator={true}
            size={12}
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
            disabled={disabled}
          />
          <div
            id="showSbcBalance"
            className="absolute right-8 bottom-7 text-right w-1/3 mb-12 text-sm"
          >
            ${sbcBalance ? Number(sbcBalance.formatted).toFixed(3) : "0.000"}
          </div>
        </div>
      );
    }

    function UsdcContainer() {
      async function updateSbcValue(input: HTMLInputElement) {
        const sbcInput = document.getElementById(
          "sbcInput",
        ) as HTMLInputElement;
        const sbcOut = quoteUsdcToSbc(input.value);
        if (!isSwitched && sbcInput) {
          sbcInput.value = input.value ? sbcOut.toFixed(3) : "";
        }
      }

      return (
        <div className="flex flex-col border border-border text-foreground bg-card rounded-lg w-full relative pb-8">
          <div className="flex flex-row justify-between pt-2">
            <h2 className="flex text-lg font-semibold space-r-2 p-4">
              <span className="flex mr-3 text-2xl">
                {isSwitched ? "Buy" : "Sell"}
              </span>
              <Image
                src="/usdcSelector.svg"
                width={100}
                height={100}
                alt="USDC"
              />
            </h2>
            <div className="flex flex-col">
              <div className="flex text-sm w-full justify-end space-4">
                {!isSwitched ? (
                  <span className="flex p-4">
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
                      <Image
                        src="/Badge50pct.svg"
                        width={54}
                        height={54}
                        alt="usdc50pct"
                      />
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
                      <Image
                        src="/BadgeMax.svg"
                        width={54}
                        height={54}
                        alt="usdcMax"
                      />
                    </button>
                  </span>
                ) : (
                  <span className="flex p-6">
                    1 SBC = {quoteSbcToUsdc("1")} USDC
                    <div className="group relative">
                      <Image
                        className="ml-2 hover:cursor-pointer"
                        src="/CircleHelp.svg"
                        width={16}
                        height={16}
                        alt="help"
                      />
                      <div className="absolute z-50 hidden group-hover:block border border-border bg-popover text-popover-foreground p-2 rounded-md -right-56 top-0 w-48 text-sm">
                        The value you receive is based on the current market
                        rate in the Uniswap pool and may include fees or
                        slippage.
                      </div>
                    </div>
                  </span>
                )}
              </div>
            </div>
          </div>

          <NumericFormat
            id="usdcInput"
            type="text"
            className="relative m-4 p-6 text-xl border border-border text-mutedForeground bg-background rounded w-7/8"
            placeholder="Enter amount"
            thousandSeparator={true}
            size={12}
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
            disabled={disabled}
          />
          <div
            id="showUsdcBalance"
            className="absolute right-8 bottom-7 text-right w-1/3 mb-12 text-sm"
          >
            ${usdcBalance ? Number(usdcBalance.formatted).toFixed(3) : "0.000"}
          </div>
        </div>
      );
    }

    async function doSwap(): Promise<
      TransactionReceipt | { transactionHash: Hex } | { error: string }
    > {
      const { usdcAmount, sbcAmount } = getTradeAmounts();

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
        if (use7702) {
          const { txState: status, txHash } = await execute7702GaslessTrade(
            trade,
            config,
            sessionKeyAddress!,
            sessionKernelClient!,
          );

          console.debug(
            `Executed 7702 gasless trade: ${status}; Receipt: ${getScannerUrl(base.id, txHash)}`,
          );

          response = { transactionHash: txHash as Hex };
        } else {
          const { txHash, txState: status } = await executeGaslessTrade(
            trade,
            config,
          );

          console.debug(
            `Executed gasless trade: ${status}; Receipt: ${getScannerUrl(base.id, txHash)}`,
          );

          response = { transactionHash: txHash as Hex };
        }

        return response;
      } catch (error) {
        return {
          error: "Error executing trade",
        };
      }
    }

    return (
      <div className="flex flex-col items-center my-8 border-border border rounded-lg">
        {isFetched && isConnected ? (
          <>
            {isSwitched ? (
              <div className="w-full bg-card text-foreground relative">
                <SbcContainer />
                <Switcher />
                <UsdcContainer />
              </div>
            ) : (
              <div className="w-full bg-card text-foreground relative">
                <UsdcContainer />
                <Switcher />
                <SbcContainer />
              </div>
            )}

            <div className="w-full bg-card text-foreground flex justify-center p-4">
              <button
                type="button"
                className="px-10 py-3 rounded-lg bg-primary hover:bg-accent text-white w-full"
                disabled={!isFetched || !isConnected || isReconnecting || disabled}
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

                  const receipt = await doSwap();

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
          </>
        ) : (
          <div className="flex flex-col items-center p-8">
            <Image alt="wallet" src="walletIcon.svg" width={36} height={36} />
            <div className="text-2xl my-4">Connect your wallet</div>
            <div className="text-mutedForeground">
              Start by connecting your wallet
            </div>
          </div>
        )}
      </div>
    );
  },
);

export { SwapCard };
