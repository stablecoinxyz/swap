"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

import {
  ConnectButton,
  useActiveAccount,
  useActiveWallet,
  useWalletBalance,
} from "thirdweb/react";
import { polygon } from "thirdweb/chains";
import { createWallet } from "thirdweb/wallets";

import { encodeRouteToPath, FeeAmount, Pool, Route } from "@uniswap/v3-sdk";
import IUniswapV3PoolABI from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";

import { USDC, SBC } from "@/lib/constants";
import { TokenTrade, createTrade, executeTrade } from "@/lib/trading";
import {
  connectBrowserExtensionWallet,
  // getProvider,
  getPolygonProvider,
  getPolygonScanLink,
  TransactionState,
} from "@/lib/providers";

import { Header } from "@/components/Header";
import DisconnectIcon from "@/components/DisconnectIcon";
import SwitchIcon from "@/components/SwitchIcon";

import { client } from "./client";
import { CurrentConfig } from "@/config";
import { ethers5Adapter } from "thirdweb/adapters/ethers5";

const USDC_SBC_UNISWAP_POOL_ADDRESS =
  "0x98A5a5D8D448A90C5378A07e30Da5148679b4C45";

const poolContract = new ethers.Contract(
  USDC_SBC_UNISWAP_POOL_ADDRESS,
  IUniswapV3PoolABI.abi,
  getPolygonProvider(),
);

// const useOnBlockUpdated = (callback: (blockNumber: number) => void) => {
//   useEffect(() => {
//     const subscription = getProvider()?.on("block", callback);
//     return () => {
//       subscription?.removeAllListeners();
//     };
//   });
// };

// https://docs.uniswap.org/contracts/v3/reference/deployments/polygon-deployments
// const uniswapRouterPolygon = getContract({
//   client,
//   address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
//   chain: polygon,
// });

export default function Home() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();

  // console.log("wallet:", wallet);
  // console.log("account:", account);

  const [isSwitched, setIsSwitched] = useState(false);
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [trade, setTrade] = useState<TokenTrade>();
  const [txState, setTxState] = useState<TransactionState>(
    TransactionState.New,
  );

  // useOnBlockUpdated(async (blockNumber: number) => {
  //   // refreshBalances();
  //   setBlockNumber(blockNumber);
  // });

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

  wallet?.subscribe("onConnect", (walletId) => {
    console.log(`onConnect: ${walletId}`);
  });

  const {
    data: usdcBalance,
    isLoading: usdcIsLoading,
    isError: usdcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: polygon,
    client,
    tokenAddress: USDC.address,
  });

  const {
    data: sbcBalance,
    isLoading: sbcIsLoading,
    isError: sbcIsError,
  } = useWalletBalance({
    address: wallet?.getAccount()?.address,
    chain: polygon,
    client,
    tokenAddress: SBC.address,
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

            // update sbc input with converted value based on current rate from the pool
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

  async function getPoolData() {
    const [slot0, liquidity] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
    ]);

    const fullPool = new Pool(
      USDC,
      SBC,
      FeeAmount.LOWEST,
      slot0.sqrtPriceX96,
      liquidity,
      slot0.tick,
    );
    return fullPool;
  }

  async function quoteUsdcToSbc(usdcAmount: string) {
    const pool = await getPoolData();
    return Number(usdcAmount) * Number(pool.token0Price.toSignificant());
  }

  async function quoteSbcToUsdc(sbcAmount: string) {
    const pool = await getPoolData();
    return Number(sbcAmount) * Number(pool.token1Price.toSignificant());
  }

  async function swapUsdcToSbc(usdcAmount: string) {
    const config = CurrentConfig;
    config.tokens.amountIn = Number(usdcAmount);
    config.tokens.in = USDC;
    config.tokens.out = SBC;
    config.provider = ethers5Adapter.provider.toEthers({
      chain: polygon,
      client,
    });
    config.wallet = await ethers5Adapter.signer.toEthers({
      chain: polygon,
      client,
      account: account!,
    });
    config.account = account;

    if (!config.account.address) {
      console.error("No wallet address found");
      return;
    }

    const trade = await createTrade(config);
    if (!trade) {
      console.error("No trade created");
      return;
    }
    const executedTradeStatus = await executeTrade(trade, config);
    console.log(`Executed trade: ${executedTradeStatus}`);
  }

  async function swapSbcToUsdc(sbcAmount: string) {
    const config = CurrentConfig;
    config.tokens.amountIn = Number(sbcAmount);
    config.tokens.in = SBC;
    config.tokens.out = USDC;
    config.provider = ethers5Adapter.provider.toEthers({
      chain: polygon,
      client,
    });
    config.wallet = await ethers5Adapter.signer.toEthers({
      chain: polygon,
      client,
      account: account!,
    });
    config.account = account;

    if (!config.account.address) {
      console.error("No wallet address found");
      return;
    }

    const trade = await createTrade(config);
    if (!trade) {
      console.error("No trade created");
      return;
    }
    const executedTradeStatus = await executeTrade(trade, config);
    console.log(`Executed trade: ${executedTradeStatus}`);
  }

  async function doSwap() {
    const { usdcAmount, sbcAmount } = getTradeAmounts();
    if (!usdcAmount && !sbcAmount) {
      return;
    }

    if (isSwitched) {
      const rate = await quoteSbcToUsdc(sbcAmount);
      console.log(`Swapping ${sbcAmount} SBC for ${rate} USDC`);
      await swapSbcToUsdc(sbcAmount);
    } else {
      const rate = await quoteUsdcToSbc(usdcAmount);
      console.log(`Swapping ${usdcAmount} USDC for ${rate} SBC`);
      await swapUsdcToSbc(usdcAmount);
    }
  }

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
              await doSwap();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={
              account === undefined ||
              // txState === TransactionState.Sending ||
              // txState === TransactionState.Confirming ||
              (window as any).ethereum === undefined // TODO: fix these conditions
            }
          >
            Swap
          </button>
        </div>
        <div
          className="text-zinc-300 text-xs absolute top-4 right-6"
          style={{ zIndex: 1000 }}
        >
          {blockNumber > 0 && <span>Block: {blockNumber}</span>}
        </div>
      </div>
    </main>
  );

  function getTradeAmounts() {
    const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
    const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
    const usdcAmount = usdcInput ? usdcInput.value : "";
    const sbcAmount = sbcInput ? sbcInput.value : "";
    return { usdcAmount, sbcAmount };
  }
}
