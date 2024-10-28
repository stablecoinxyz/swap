"use client";

import { useAccount, useBalance, useWalletClient } from "wagmi";
import { TransactionReceipt, Hex } from "viem";
import { SBC } from "@/lib/constants";
import Image from "next/image";

export default function MassPayPage() {
  const account = useAccount();
  const { address, isConnected } = account;
  const { data: wallet, isFetched } = useWalletClient();

  const {
    data: sbcBalance,
    isLoading: isSbcLoading,
    isError: isSbcError,
  } = useBalance({
    address,
    token: SBC.address as Hex,
  });

  const placeholder = `Enter a list of addresses and amounts separated by a comma. 
e.g.

0xB5f6fECd59dAd3d5bA4Dfe8FcCA6617CE71B99f9, 0.01
0x589c0e47DE10e0946e2365580B700790AAAbe9f7, 0.001
...
`;

  return (
    <main className="px-4 pb-10 min-h-[100vh] min-w-[600] flex items-top justify-center container max-w-screen-lg mx-auto">
      <div className="w-1/2">
        <Header />
        <div className="mx-auto min-w-[100px]">
          <div className="mb-2 text-lg bg-slate-50 p-2 rounded w-auto">
            <div className="flex flex-col items-center space-y-1">
              <div className="flex flex-row space-x-1 text-normal font-semibold">
                <Image
                  className="flex"
                  src="/sbc-logo.svg"
                  alt="Stable Coin Inc."
                  width={24}
                  height={24}
                />
                <div className="flex">SBC</div>
              </div>
              <div className="flex text-sm">{SBC.address}</div>
              {sbcBalance && (
                <div className="flex px-4 py-2 rounded-lg bg-yellow-50">
                  Balance:{" "}
                  {!isSbcLoading &&
                    sbcBalance &&
                    Number(sbcBalance.formatted).toFixed(3)}{" "}
                </div>
              )}
            </div>
          </div>
          <textarea
            className="w-full h-48 mt-4 p-2 border border-gray-700 rounded-lg text-sm"
            placeholder={placeholder}
          />
          <button
            className="mt-2 py-3 dark:bg-white bg-violet-700
          dark:text-zinc-900 text-neutral-100 hover:font-extrabold
          disabled:font-normal disabled:cursor-not-allowed disabled:opacity-50 rounded-lg w-full"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );

  function Header() {
    return (
      <header className="flex flex-col items-center my-20 mb-6">
        <h1 className="text-2xl font-semibold tracking-tighter">
          Stable Coin | MassPay
        </h1>

        <div className="text-base mt-2">
          A gasless mass pay utility from
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
}
