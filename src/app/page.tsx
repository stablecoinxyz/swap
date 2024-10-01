"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BigNumber, ethers, providers } from "ethers";
import { getContract, Hex, sendTransaction } from "thirdweb";
import {
  ConnectButton,
  useActiveAccount,
  useActiveWallet,
  useWalletBalance,
} from "thirdweb/react";
import { polygon } from "thirdweb/chains";
import { ethers5Adapter } from "thirdweb/adapters/ethers5";
import {
  createPool,
  exactInput,
  getPool,
  getUniswapV3Pool,
  quoteExactInput,
} from "thirdweb/extensions/uniswap";
import {
  encodeRouteToPath,
  FACTORY_ADDRESS,
  Pool,
  Route,
} from "@uniswap/v3-sdk";
import { Currency, Price, Token } from "@uniswap/sdk-core";
import IUniswapV3PoolABI from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";

import { client } from "./client";
import { Header } from "@/components/Header";
import DisconnectIcon from "@/components/DisconnectIcon";
import SwitchIcon from "@/components/SwitchIcon";

enum FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

const polygonProvider = new ethers.providers.JsonRpcProvider(
  "https://polygon-rpc.com",
);

const usdcPolygon = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const sbcPolygon = "0xfdcC3dd6671eaB0709A4C0f3F53De9a333d80798";

const USDC = new Token(1, usdcPolygon, 6, "USDC", "USD Coin");
const SBC = new Token(1, sbcPolygon, 18, "SBC", "Stable Coin");

const USDC_SBC_UNISWAP_POOL_ADDRESS =
  "0x98A5a5D8D448A90C5378A07e30Da5148679b4C45";

const poolContract = new ethers.Contract(
  USDC_SBC_UNISWAP_POOL_ADDRESS,
  IUniswapV3PoolABI.abi,
  polygonProvider,
);

// https://docs.uniswap.org/contracts/v3/reference/deployments/polygon-deployments
const uniswapRouterPolygon = getContract({
  client,
  address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  chain: polygon,
});

// async function connectBrowserExtensionWallet() {
//   if (!(window as any).ethereum) {
//     return null;
//   }

//   const { ethereum } = window as any;
//   const provider = new ethers.providers.Web3Provider(ethereum);
//   const accounts = await provider.send("eth_requestAccounts", []);

//   if (accounts.length !== 1) {
//     return;
//   }

//   const walletExtensionAddress = accounts[0];
//   return walletExtensionAddress;
// }

// function createBrowserExtensionProvider(): ethers.providers.Web3Provider | null {
//   try {
//     const provider = new ethers.providers.Web3Provider(
//       (window as any)?.ethereum,
//       "any",
//     );
//     console.log(`Wallet Extension Found: ${provider}`);
//     return provider;
//   } catch (e) {
//     console.log("No Wallet Extension Found");
//     return null;
//   }
// }

export default function Home() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();

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

  // function to return polygon scanner link for a transaction hash
  function getPolygonScanLink(transactionHash: string) {
    return `https://polygonscan.com/tx/${transactionHash}`;
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
    const usdcAmountBigNumber = ethers.utils.parseUnits(usdcAmount, 6);

    const EXACT_OUTPUT = false;
    const usdcToken = new Token(1, usdcPolygon, 6);
    const sbcToken = new Token(1, sbcPolygon, 18);

    const fullPool = await getPoolData();
    const route = new Route([fullPool], usdcToken, sbcToken);
    const path = encodeRouteToPath(route, EXACT_OUTPUT);
    const transaction = exactInput({
      contract: uniswapRouterPolygon,
      params: {
        path: path as Hex,
        recipient: wallet!.getAccount()!.address,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20), // 20 minutes
        amountIn: usdcAmountBigNumber.toBigInt(),
        amountOutMinimum: 0n, // infinite slippage
      },
    });

    if (!account) {
      return { error: "No account for swapUsdcToSbc" };
    }
    const { transactionHash } = await sendTransaction({
      transaction,
      account,
    });

    console.log(`transaction: ${getPolygonScanLink(transactionHash)}`);
  }

  async function doSwap() {
    const usdcInput = document.getElementById("usdcInput") as HTMLInputElement;
    const sbcInput = document.getElementById("sbcInput") as HTMLInputElement;
    const usdcAmount = usdcInput ? usdcInput.value : "";
    const sbcAmount = sbcInput ? sbcInput.value : "";

    // if both inputs are empty, return
    if (!usdcAmount && !sbcAmount) {
      return;
    }

    if (isSwitched) {
      const rate = await quoteSbcToUsdc(sbcAmount);
      console.log(`Swapping ${sbcAmount} SBC for ${usdcAmount} USDC`);
    } else {
      const rate = await quoteUsdcToSbc(usdcAmount);
      console.log(`Swapping ${usdcAmount} USDC for ${rate} SBC`);
      // await swapUsdcToSbc(usdcAmount);
    }
  }

  return (
    <main className="px-4 pb-10 min-h-[100vh] flex items-center justify-center container max-w-screen-lg mx-auto">
      <div className="py-14">
        <Header />

        <div className="flex justify-center mb-14">
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

        <div className="flex justify-center mt-8">
          <button
            onClick={async () => {
              await doSwap();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Swap
          </button>
        </div>
      </div>
    </main>
  );
}
