"use client";
import Image from "next/image";
import { Fragment, useState, useMemo } from "react";
import { useAccount, useBalance, useChainId, useWalletClient } from "wagmi";
// import { useCapabilities, useWriteContracts } from "wagmi/experimental";
import {
  Hex,
  custom,
  createWalletClient,
  parseAbi,
  createClient,
  createPublicClient,
  PublicClient,
  http,
} from "viem";
import { base, baseSepolia, localhost } from "viem/chains";
import {
  type BundlerActions,
  type PaymasterActions,
  type SmartAccount,
  bundlerActions,
  entryPoint07Address,
  paymasterActions,
  createPaymasterClient,
} from "viem/account-abstraction";
// import { ethers } from "ethers";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";

// import { Capabilities } from "@/components/Capabilities";
import { SBC, SBC_BASE_SEPOLIA } from "@/lib/constants";
import { publicClient } from "@/lib/providers";
import { CurrentConfig } from "@/config";
import { paymasterActionsEip7677 } from "@/lib/eip7677";
import { pimlicoActions } from "permissionless/actions/pimlico";
import { defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PAYMASTER_SERVER_URL = process.env.NEXT_PUBLIC_PAYMASTER_SERVICE_URL!;
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL!;

export default function CustomPaymasterPage() {
  const account = useAccount();
  const { address, isConnected } = account;

  const { data: wallet, isFetched } = useWalletClient();
  if (isFetched && isConnected) {
    CurrentConfig.wallet = wallet!;
    CurrentConfig.account = account!;
  }

  console.debug("Setting up with Paymaster Server URL", PAYMASTER_SERVER_URL);

  // @DEV: Required for EIP5792Approach
  // const { data: availableCapabilities } = useCapabilities({
  //   account: account.address,
  // });
  // const capabilities = useMemo(() => {
  //   if (!availableCapabilities || !account.chainId) return;
  //   const capabilitiesForChain = availableCapabilities[account.chainId];
  //   if (
  //     capabilitiesForChain["paymasterService"] &&
  //     capabilitiesForChain["paymasterService"].supported
  //   ) {
  //     return {
  //       paymasterService: {
  //         url: PAYMASTER_SERVER_URL,
  //       },
  //     };
  //   }
  // }, [availableCapabilities, account.chainId]);
  // const { writeContracts } = useWriteContracts();

  const {
    data: sbcBalance,
    isLoading: isSbcLoading,
    isError: isSbcError,
  } = useBalance({
    address,
    token: SBC_BASE_SEPOLIA.address as Hex,
  });

  const btnClasses =
    "mt-2 py-3 dark:bg-white bg-violet-600 dark:text-zinc-900 text-neutral-100 hover:font-extrabold disabled:font-normal disabled:cursor-not-allowed disabled:opacity-50 rounded-lg w-full";

  return (
    <main className="px-4 pb-10 min-h-[100vh] min-w-[600] flex items-top justify-center container max-w-screen-lg mx-auto">
      <div className="w-1/2">
        <Header />

        <div className="mx-auto min-w-[100px]">
          <WalletBalanceInfo />

          <button className={btnClasses} onClick={buildUserOp}>
            Send 0.00001 SBC to vitalik.eth
          </button>
        </div>
      </div>
    </main>
  );

  async function buildUserOp() {
    // const walletAddress = CurrentConfig.account!.address;
    const ownerAddress = privateKeyToAccount(
      process.env.NEXT_PUBLIC_LOCAL_PRIVATE_KEY as Hex,
    ).address;
    const owner = createWalletClient({
      account: ownerAddress, //walletAddress as Hex,
      chain: localAA, // baseSepolia,
      transport: custom((window as any).ethereum),
    });
    console.debug("Owner Address", owner.account.address);

    // const owner = privateKeyToAccount(
    //   process.env.NEXT_PUBLIC_LOCAL_PRIVATE_KEY as Hex,
    // );

    // console.debug("Owner Address", owner.address);

    // EIP5792Approach(owner);
    await MiddlewareApproach(owner);
  }

  function Header() {
    return (
      <header className="flex flex-col items-center my-20 mb-6">
        <h1 className="text-2xl font-semibold tracking-tighter">
          Stable Coin | Custom Paymaster
        </h1>

        <div className="text-base mt-2">
          An open-sourced paymaster solution from
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
        <div className="fixed bottom-0 text-center my-2 bg-yellow-100 p-2">
          Ensure your wallet is connected to Base Sepolia (Chain ID: 84532)
        </div>
      </header>
    );
  }

  function WalletBalanceInfo() {
    return (
      <div className="mb-2 text-lg bg-slate-50 p-4 rounded w-auto">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex flex-row space-x-2 text-normal font-semibold">
            <Image
              className="flex"
              src="/sbc-logo.svg"
              alt="Stable Coin Inc."
              width="24"
              height="24"
            />
            <div className="flex">SBC (Base Sepolia)</div>
          </div>
          <div className="flex text-sm">{SBC_BASE_SEPOLIA.address}</div>
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
    );
  }

  async function MiddlewareApproach(owner: any) {
    const localPublicClient = createPublicClient({
      chain: localAA,
      transport: http(localAA.rpcUrls.default.http[0]),
    }) as PublicClient;

    const simpleAccount = await toSimpleSmartAccount({
      client: localPublicClient,
      owner: owner,
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
    });

    // const key = "public";
    // const name = "SBC Bundler Client";
    // const sbcClient = createClient({
    //   key,
    //   name,
    //   type: "sbcClient",
    //   transport: http(PAYMASTER_SERVER_URL),
    // })
    //   .extend(bundlerActions)
    //   .extend(paymasterActions)
    //   .extend(
    //     pimlicoActions({
    //       entryPoint: {
    //         address: entryPoint07Address,
    //         version: "0.7",
    //       },
    //     }),
    //   );

    // .extend(paymasterActionsEip7677({ entryPoint: entryPoint07Address }));

    const pmClient = createPaymasterClient({
      transport: http(PAYMASTER_SERVER_URL),
    });

    console.debug("SBC Client", pmClient);

    // create the smart account client with owner's wallet and paymasterClient
    const smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      chain: localAA,
      bundlerTransport: http(process.env.NEXT_PUBLIC_BUNDLER_URL!),
      paymaster: pmClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return {
            maxFeePerGas: 10n,
            maxPriorityFeePerGas: 10n,
          };
        },
      },
    });

    console.debug("Smart Account Client", smartAccountClient);

    // build simple user operation
    const txHash = await smartAccountClient.sendTransaction({
      calls: [
        {
          to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", // vitalik.eth
          value: 0n,
          data: "0x1234678",
        },
      ],
      paymasterContext: {
        policyId: "jello",
      },
    });

    console.debug("Transaction Hash", txHash);
  }

  // function EIP5792Approach(owner: any) {
  //   // DEV- Ends up in several dead-ends
  //   // Keeping it here for reference
  //
  //   // owner is coinbase smart wallet (EIP5792 compatiable), which we'll use as-is
  //   const senderAddress = owner.account.address;
  //   // make a minimal ABI
  //   const abi = parseAbi([
  //     "function approve(address, uint256) returns (bool)",
  //     "function transferFrom(address, address, uint256) returns (bool)",
  //   ]);
  //   // Approve the paymaster to spend 100 SBC, and send 10 SBC to Eric
  //   writeContracts({
  //     capabilities,
  //     contracts: [
  //       {
  //         address: SBC_BASE_SEPOLIA.address as Hex,
  //         abi,
  //         functionName: "approve",
  //         args: [senderAddress, 100n],
  //       },
  //       {
  //         address: SBC_BASE_SEPOLIA.address as Hex,
  //         abi,
  //         functionName: "transferFrom",
  //         args: [
  //           senderAddress,
  //           "0x124b082e8DF36258198da4Caa3B39c7dFa64D9cE", // Eric
  //           10n,
  //         ],
  //       },
  //     ],
  //   });
  // }
}

export const localAA = defineChain({
  id: 31337,
  name: "local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});
