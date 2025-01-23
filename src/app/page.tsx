"use client";

import { useAccount, useBalance, useWalletClient } from "wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { USDC, SBC } from "@/lib/constants";

import { CurrentConfig } from "@/config";
import { SwapCard } from "@/components/SwapCard";
import { Hex } from "viem";
import Image from "next/image";

export default function Home() {
  const account = useAccount();
  const { address, isConnected, isReconnecting } = account;
  const { data: wallet, isFetched } = useWalletClient();
  if (isFetched && isConnected) {
    CurrentConfig.wallet = wallet!;
    CurrentConfig.account = account!;
  }

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

  return (
    <main className="px-4 pb-10 min-h-[100vh] min-w-[600] flex items-top justify-center container max-w-screen-lg mx-auto">
      <div className="w-3/5 min-w-[540px]">
        <Header />

        <div className="mx-auto min-w-[360px]">
          <WalletCard />

          <SwapCard
            isFetched={isFetched}
            isConnected={isConnected}
            isReconnecting={isReconnecting}
            isUsdcLoading={isUsdcLoading}
            isSbcLoading={isSbcLoading}
            address={address}
            sbcBalance={sbcBalance}
            usdcBalance={usdcBalance}
          />

          <Disclaimer />
        </div>
      </div>
    </main>
  );

  function Header() {
    return (
      <header className="flex flex-col items-center my-20 md:mb-20">
        <Image src="/swapIcon.svg" width={42} height={42} alt="swap" />
        <h1 className="my-4 text-3xl font-semibold tracking-tighter">Swap</h1>
        <div className="w-[360px] flex flex-col items-center mt-2 text-center">
          Swap USDC and SBC with zero gas fees, seamlessly powered by Uniswap.
        </div>
      </header>
    );
  }

  function Disclaimer() {
    return (
      <div className="text-center mt-4 text-xs text-gray-500">
        <div>
          <strong>Disclaimer:</strong> This tool is provided &quot;as-is&quot;
          without warranty. The value you receive is determined by the current
          market rate in the Uniswap pool and may be subject to slippage or
          fees. Transactions are final and cannot be reversed. Please
          double-check all amounts and details before proceeding to ensure
          accuracy. Stablecoin.xyz is not liable for any losses resulting from
          the use of this tool.
        </div>
      </div>
    );
  }

  function WalletCard() {
    return (
      <div className=" bg-card rounded w-auto">
        <div className="flex flex-col relative items-start p-6">
          <h2 className="text-xl font-medium">Your wallet</h2>
          {isConnected && isFetched ? (
            <p className="text-sm text-mutedForeground">
              Wallet is now linked and ready for transactions
            </p>
          ) : (
            <p className="text-sm text-mutedForeground">
              Link your wallet on the Base network to start swapping
            </p>
          )}
          {wallet && <BalanceTable />}
          <div className="ml-auto absolute top-[3.8rem] right-6">
            <ConnectWallet />
          </div>
        </div>
      </div>
    );
  }

  function BalanceTable() {
    return (
      <div className="flex flex-col items-center mt-4 w-full">
        <table className="text-base text-mutedForeground bg-mutedBackground border rounded-lg border-border">
          <thead>
            <tr className="text-mutedForeground">
              <th className="px-4 py-3 w-5/6 text-left">Currency</th>
              <th className="px-4 py-2 w-1/6 text-center">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-mutedForeground">
              <td className="px-4 pb-4 w-5/6 text-lg text-foreground flex items-start space-x-2">
                <Image
                  className=""
                  src="/nav-sbc-logo.svg"
                  width={24}
                  height={24}
                  alt="SBC"
                />
                <span className="ml-2">SBC</span>
              </td>
              <td className="px-4 pb-4 text-lg text-foreground text-center">
                {sbcBalance
                  ? Number(sbcBalance!.formatted).toFixed(3)
                  : "0.000"}
              </td>
            </tr>
            <tr className="text-mutedForeground">
              <td className="px-4 pb-4 w-5/6 text-lg text-foreground flex items-start space-x-2">
                <Image
                  className=""
                  src="/usdclogo.svg"
                  width={24}
                  height={24}
                  alt="USDC"
                />
                <span className="ml-2">USDC</span>
              </td>
              <td className="px-4 pb-4 text-lg text-foreground text-center">
                {usdcBalance
                  ? Number(usdcBalance!.formatted).toFixed(3)
                  : "0.000"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}
