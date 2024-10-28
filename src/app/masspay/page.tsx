"use client";
import { useState } from "react";
import { useAccount, useBalance, useWalletClient } from "wagmi";
import { TransactionReceipt, Hex } from "viem";
import { SBC } from "@/lib/constants";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@radix-ui/react-label";

export default function MassPayPage() {
  const account = useAccount();
  const { address, isConnected } = account;
  const { data: wallet, isFetched } = useWalletClient();

  const [addrAmt, setAddrAmt] = useState<string>("");

  const {
    data: sbcBalance,
    isLoading: isSbcLoading,
    isError: isSbcError,
  } = useBalance({
    address,
    token: SBC.address as Hex,
  });

  const btnClasses =
    "mt-2 py-3 dark:bg-white bg-violet-600 dark:text-zinc-900 text-neutral-100 hover:font-extrabold disabled:font-normal disabled:cursor-not-allowed disabled:opacity-50 rounded-lg w-full";
  const placeholder = `Enter a list of addresses and amounts separated by a comma. 
e.g.

0xB5f6fECd59dAd3d5bA4Dfe8FcCA6617CE71B99f9, 0.01
0x589c0e47DE10e0946e2365580B700790AAAbe9f7, 0.001
...
`;

  /* 
  0xB5f6fECd59dAd3d5bA4Dfe8FcCA6617CE71B99f9, 0.01
0x089c0e47DE10e0946e2365580B700790AAAbe9f7, 0.02
0x15f6fECd59dAd3d5bA4Dfe8FcCA6617CE71B99f9, 0.03
0x289c0e47DE10e0946e2365580B700790AAAbe9f7, 0.04
0x85f6fECd59dAd3d5bA4Dfe8FcCA6617CE71B99f9, 0.05
0x989c0e47DE10e0946e2365580B700790AAAbe9f7, 0.06
0x089c0e47DE10e0946e2365580B700790AAAbe9f7, 0.07
0xA89c0e47DE10e0946e2365580B700790AAAbe9f7, 0.08
  */

  const totalAmtToSend = addrAmt
    .split("\n")
    .map((line) => line.split(",")[1])
    .reduce((acc, val) => acc + parseFloat(val), 0);

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
                  width="24"
                  height="24"
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
            id="addressesAmounts"
            value={addrAmt}
            className="w-full h-48 mt-4 p-2 border border-gray-700 rounded-lg text-sm"
            placeholder={placeholder}
            onChange={(e) => setAddrAmt(e.target.value)}
          />

          <Dialog>
            <DialogTrigger asChild>
              <button className={btnClasses} disabled={!addrAmt.length}>
                Continue
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Confirm Recipients And Amounts</DialogTitle>
                <DialogDescription>
                  Make sure everything looks good below before you send your
                  SBC.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-6 items-center gap-2 pt-4">
                <div className="col-span-5 text-sm font-extrabold">Address</div>
                <div className="text-sm font-extrabold">Amount</div>
                {addrAmt.split("\n").map((line, idx) => {
                  const [addr, amt] = line.split(",");
                  if (idx < 3 || idx > addrAmt.split("\n").length - 4) {
                    return (
                      <>
                        <div className="col-span-5 text-sm p-2 border">
                          {addr}
                        </div>
                        <div className="bg-zinc-100 p-2 text-right">{amt}</div>
                      </>
                    );
                  } else if (idx === 3) {
                    return (
                      <>
                        <div className="col-span-6 text-sm text-center p-2">
                          ...
                        </div>
                      </>
                    );
                  } else {
                    return null;
                  }
                })}
              </div>

              <div className="grid grid-cols-2 text-sm mt-4">
                <div className="">Beginning balance:</div>
                <div className="text-right">
                  {sbcBalance && Number(sbcBalance.formatted).toFixed(6)}
                </div>
                <div className="">Recipients:</div>
                <div className="text-right">
                  {addrAmt.split("\n").length} addresses
                </div>
                <div className="">Total amount to send:</div>
                <div className="text-right">{sbcBalance && totalAmtToSend}</div>
                <div className="">Ending balance:</div>
                <div className="text-right">
                  {sbcBalance &&
                    (Number(sbcBalance.formatted) - totalAmtToSend).toFixed(6)}
                </div>
              </div>

              <DialogFooter>
                <button type="submit" className={btnClasses}>
                  Send
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
