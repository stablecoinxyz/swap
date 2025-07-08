"use client";

import { MaxUint256, SWAP_ROUTER_02_ADDRESSES } from "@uniswap/sdk-core";
import { deserializePermissionAccount, serializePermissionAccount, toPermissionValidator } from "@zerodev/permissions";
import { toTimestampPolicy } from "@zerodev/permissions/policies";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { createKernelAccount, createKernelAccountClient, CreateKernelAccountReturnType, createZeroDevPaymasterClient,KernelAccountClient } from "@zerodev/sdk";
import { getEntryPoint,KERNEL_V3_3, KernelVersionToAddressesMap } from "@zerodev/sdk/constants";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { encodeFunctionData,erc20Abi, Hex, http, parseSignature, WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { useAccount, useBalance, useWalletClient } from "wagmi";

import { ConnectWallet } from "@/components/ConnectWallet";
import { SwapCard } from "@/components/SwapCard";
import { CurrentConfig } from "@/config";
import { SBC,USDC } from "@/lib/constants";
import { pimlicoClient, publicClient, sbcPaymasterClient } from "@/lib/providers";

const ZERODEV_APP_ID = process.env.NEXT_PUBLIC_ZERODEV_APP_ID;
const ZERODEV_BASE_URL = `https://rpc.zerodev.app/api/v3/${ZERODEV_APP_ID}/chain/8453`;

const kernelAddresses = KernelVersionToAddressesMap[KERNEL_V3_3];

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

  const [use7702, setUse7702] = useState(false);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<`0x${string}` | undefined>(undefined);
  const [sessionAccountAddress, setSessionAccountAddress] = useState<`0x${string}` | null>(null);

  const [sessionKernelClient, setSessionKernelClient] = useState<KernelAccountClient | null>(null);

  // Local storage for session key and validUntil timestamp
  const [serialisedSessionKey, setSerialisedSessionKey] = useLocalStorage<string | null>(
    `serialisedSessionKey-master:${CurrentConfig?.account?.address}`,
    null,
  );
  const [sessionKeyValidUntil, setSessionKeyValidUntil] = useLocalStorage<number | null>(
    `sessionKeyValidUntil-master:${CurrentConfig?.account?.address}`,
    null,
  );

  const [setupStep, setSetupStep] = useState(0); // 0: none, 1: authorized, 2: session key, 3: approved

  // Remove combined button logic, restore two-step flow
  const [actionStatus, setActionStatus] = useState<'idle' | 'creatingSessionKey' | 'sessionKeyCreated' | 'approving' | 'approved'>('idle');
  const [sessionKeyMessage, setSessionKeyMessage] = useState<string | null>(null);
  const [show7702Tooltip, setShow7702Tooltip] = useState(false);

  const [needsApproval, setNeedsApproval] = useState<boolean>(true);

  // Helper to check if either token needs approval
  const checkNeedsApproval = async (owner: string, spender: string) => {
    try {
      console.log("Allowance check: owner (EOA):", owner);
      console.log("Allowance check: spender (sessionAccount):", spender);
      console.log("USDC contract:", USDC.address);
      console.log("SBC contract:", SBC.address);
      const [usdcAllowance, sbcAllowance] = await Promise.all([
        publicClient.readContract({
          address: USDC.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner as `0x${string}`, spender as `0x${string}`],
        }),
        publicClient.readContract({
          address: SBC.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner as `0x${string}`, spender as `0x${string}`],
        }),
      ]);
      const max = BigInt(MaxUint256.toString());
      const threshold = max / 2n;
      console.log("USDC allowance:", usdcAllowance.toString());
      console.log("SBC allowance:", sbcAllowance.toString());
      setNeedsApproval(BigInt(usdcAllowance) <= threshold || BigInt(sbcAllowance) <= threshold);
    } catch (e) {
      // If error, default to showing approval button
      setNeedsApproval(true);
    }
  };

  // After session key is created or restored, check approval
  useEffect(() => {
    if (
      serialisedSessionKey &&
      sessionKeyValidUntil &&
      Math.floor(Date.now() / 1000) < sessionKeyValidUntil &&
      address &&
      sessionAccountAddress
    ) {
      checkNeedsApproval(address, sessionAccountAddress);
    }
  }, [serialisedSessionKey, sessionKeyValidUntil, address, sessionAccountAddress]);

  // After approval, re-check (wait for tx to be mined)
  const handleApproveTokens = async () => {
    try {
      setActionStatus('approving');
      // Send approval transactions
      const approvalTxs = [
        wallet?.writeContract({
          address: USDC.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          account: address as `0x${string}`,
          chain: base,
          args: [sessionAccountAddress as `0x${string}`, BigInt(MaxUint256.toString())],
        }),
        wallet?.writeContract({
          address: SBC.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          account: address as `0x${string}`,
          chain: base,
          args: [sessionAccountAddress as `0x${string}`, BigInt(MaxUint256.toString())],
        })
      ];
      const results = await Promise.all(approvalTxs);
      console.log('Approve Tokens: EOA approvals complete', results);

      await Promise.all(results.map(tx => publicClient.waitForTransactionReceipt({ hash: tx as `0x${string}` })));
      // Re-check approval after mining
      if (address && sessionAccountAddress) {
        await checkNeedsApproval(address, sessionAccountAddress);
      }
      setActionStatus('approved');
    } catch (e) {
      setActionStatus('sessionKeyCreated');
      setSessionKeyMessage('Error: ' + (e as Error).message || 'Unknown error');
      console.error('Approve Tokens error', e);
    }
  };

  // Step 1: Create Session Key (15min validity)
  const handleCreateSessionKey = async () => {
    try {
      const validDurationSec = 900; // 15 minutes
      const validUntil = Math.floor(Date.now() / 1000) + validDurationSec;
      // If there is an existing validUntil and it's expired, treat as expired and create new key
      if (sessionKeyValidUntil && Math.floor(Date.now() / 1000) >= sessionKeyValidUntil) {
        setSerialisedSessionKey(null);
        setSessionKeyValidUntil(null);
        setSessionKernelClient(null);
        setSessionAccountAddress(null);
        setSessionKeyAddress(undefined);
      }
      setActionStatus('creatingSessionKey');
      await createSessionKey({ validDurationSec });
      setActionStatus('sessionKeyCreated');
      setSessionKeyValidUntil(validUntil); // Store validUntil in local storage
      console.log('Session key created');
    } catch (e) {
      setActionStatus('idle');
      setSessionKeyMessage('Error: ' + (e as Error).message || 'Unknown error');
      console.error('Create Session Key error', e);
    }
  };

  // Update createSessionKey to accept validDurationSec
  const createSessionKey = async ({ validDurationSec = 180 }: { validDurationSec?: number }) => {
    if (!CurrentConfig?.account?.address) {
      throw new Error("Account address not found");
    }
    const eoaAddress = CurrentConfig.account.address;
    console.log("eoaAddress", eoaAddress);

    let sessionKeyKernelAccount: CreateKernelAccountReturnType<"0.7"> | null = null;
    if (serialisedSessionKey) {
      sessionKeyKernelAccount = await deserializePermissionAccount(
        publicClient,
        getEntryPoint("0.7"),
        KERNEL_V3_3,
        serialisedSessionKey,
      );
      console.log("serialisedSessionKey exists", serialisedSessionKey);
      console.log("sessionKeyKernelAccount deserialized", sessionKeyKernelAccount);

    } else {
      const _sessionPrivateKey = generatePrivateKey();
      console.log("sessionPrivateKey", _sessionPrivateKey);

      const sessionAccount = privateKeyToAccount(_sessionPrivateKey as `0x${string}`);
      console.log("sessionAccount", sessionAccount);

      const sessionKeySigner = await toECDSASigner({
        signer: sessionAccount,
      });
      console.log("sessionKeySigner", sessionKeySigner);

      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint: getEntryPoint("0.7"),
        kernelVersion: KERNEL_V3_3,
        signer: sessionKeySigner,
        policies: [
          toTimestampPolicy({
            validAfter: Math.floor(Date.now() / 1000),
            validUntil: Math.floor(Date.now() / 1000) + validDurationSec, // 3 minutes
          })
        ],
      });

      sessionKeyKernelAccount = await createKernelAccount(publicClient, {
        entryPoint: getEntryPoint("0.7"),
        eip7702Account: sessionAccount,
        plugins: {
          regular: permissionPlugin,
        },
        kernelVersion: KERNEL_V3_3,
      });

      // --- Batch approve USDC and SBC for unlimited spending ---
      const approveUSDC = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAP_ROUTER_02_ADDRESSES(base.id) as `0x${string}`, BigInt(MaxUint256.toString())],
      });
      const approveSBC = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SWAP_ROUTER_02_ADDRESSES(base.id) as `0x${string}`, BigInt(MaxUint256.toString())],
      });
      const approvalCalls = [
        { to: USDC.address as `0x${string}`, data: approveUSDC },
        { to: SBC.address as `0x${string}`, data: approveSBC },
      ];
      const tempKernelClient = createKernelAccountClient({
        account: sessionKeyKernelAccount,
        chain: base,
        bundlerTransport: http(ZERODEV_BASE_URL),
        paymaster: createZeroDevPaymasterClient({
          chain: base,
          transport: http(ZERODEV_BASE_URL),
        }),
      });
      const tx = await tempKernelClient.sendUserOperation({ calls: approvalCalls });
      console.log("approval tx", tx);
      // --- End batch approval ---

      setSerialisedSessionKey(await serializePermissionAccount(sessionKeyKernelAccount, _sessionPrivateKey));
    }

    setSessionAccountAddress(sessionKeyKernelAccount.address);

    // zerodev paymaster
    const kernelPaymaster = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_BASE_URL),
    });

    const kernelClient = createKernelAccountClient({
      account: sessionKeyKernelAccount,
      chain: base,
      bundlerTransport: http(ZERODEV_BASE_URL),
      paymaster: {
        getPaymasterData: (userOperation) => {
          return kernelPaymaster.sponsorUserOperation({
            userOperation,
          })
        }
      }
    });

    setSessionKernelClient(kernelClient);
  };
  
  const createKernelClients = async () => {
    const wallet = CurrentConfig.wallet as WalletClient;
    if (!wallet || !wallet.account) {
      throw new Error("createKernelClients: Wallet not found");
    }
    console.log("wallet", wallet);
    console.log("wallet.account", wallet.account);
    
    // Step 1: Manually create and sign EIP-7702 authorization (wagmi doesn't support signAuthorization)
    const nonce = 0n;
    const typedData = {
      domain: {
        name: "Authorization",
        version: "1",
        chainId: base.id,
        verifyingContract: kernelAddresses.accountImplementationAddress,
      },
      types: {
        Authorization: [
          { name: "chainId", type: "uint256" },
          { name: "contractAddress", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "Authorization" as const,
      message: {
        chainId: base.id,
        contractAddress: kernelAddresses.accountImplementationAddress,
        nonce,
      },
    };

    const signature = await wallet.signTypedData({
      account: wallet.account.address,
      ...typedData,
    });
    console.log("Signature", signature);

    // Parse signature into authorization format
    const { r, s, v } = parseSignature(signature);
    const yParity = v !== undefined ? Number(BigInt(v as any) % 2n) : 0;
    
    const authorization = {
      address: kernelAddresses.accountImplementationAddress,
      chainId: base.id,
      nonce: Number(nonce),
      r,
      s,
      v: v || 0n,
      yParity,
    };
    console.log("Authorization", authorization);

    // Step 2: Create the kernel account (smart contract account) 
    const kernelAccount = await createKernelAccount(publicClient, {
      // @ts-expect-error: WalletClient is compatible at runtime
      eip7702Account: wallet,
      entryPoint: getEntryPoint("0.7"),
      kernelVersion: KERNEL_V3_3,
      eip7702Auth: authorization,
    });

    // Set sessionAccountAddress here so the next button is enabled
    setSessionAccountAddress(kernelAccount.address);

    // Step 3: Create kernel account client  
    const kernelClient = createKernelAccountClient({
      account: kernelAccount,
      chain: base,
      bundlerTransport: http(ZERODEV_BASE_URL),
      paymaster: createZeroDevPaymasterClient({
        chain: base,
        transport: http(ZERODEV_BASE_URL),
      }),
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    });

    setSessionKernelClient(kernelClient);
  }

  // Step 1: Authorize (createKernelClients) - now called by checkbox
  const handleAuthorize = async () => {
    try {
      await createKernelClients();
      setSetupStep(1);
      console.log("Authorize: Kernel account authorized");
    } catch (e) {
      console.error("Authorize error", e);
    }
  };

  // New function to approve tokens for smart account
  const approveTokensForSmartAccount = async () => {
    if (!wallet || !sessionAccountAddress) {
      throw new Error("Wallet or session account address not found");
    }
    const approvalTxs = [
      wallet.writeContract({
        address: USDC.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        account: address as `0x${string}`,
        chain: base,
        args: [sessionAccountAddress as `0x${string}`, BigInt(MaxUint256.toString())],
      }),
      wallet.writeContract({
        address: SBC.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        account: address as `0x${string}`,
        chain: base,
        args: [sessionAccountAddress as `0x${string}`, BigInt(MaxUint256.toString())],
      })
    ];
    const results = await Promise.all(approvalTxs);
    console.log("Approve Tokens: EOA approvals complete", results);
  };

  // Timer effect (unchanged) -> REMOVE and replace with expiry logic
  useEffect(() => {
    // If session key is present and validUntil is set, check expiry
    if (serialisedSessionKey && sessionKeyValidUntil) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= sessionKeyValidUntil) {
        setSerialisedSessionKey(null);
        setSessionKernelClient(null);
        setSessionAccountAddress(null);
        setSessionKeyAddress(undefined);
        setUse7702(false);
        setSetupStep(0);
        setSessionKeyValidUntil(null);
        console.log("Session key expired and reset");
      }
    }
    // Optionally, set up an interval to check expiry every 10 seconds
    const interval = setInterval(() => {
      if (serialisedSessionKey && sessionKeyValidUntil) {
        const now = Math.floor(Date.now() / 1000);
        if (now >= sessionKeyValidUntil) {
          setSerialisedSessionKey(null);
          setSessionKernelClient(null);
          setSessionAccountAddress(null);
          setSessionKeyAddress(undefined);
          setUse7702(false);
          setSetupStep(0);
          setSessionKeyValidUntil(null);
          console.log("Session key expired and reset");
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [serialisedSessionKey, sessionKeyValidUntil, setSerialisedSessionKey, setSessionKeyValidUntil]);

  // Error state for swap/trade
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Pass a callback to SwapCard to handle trade errors
  const handleTradeError = (error: any) => {
    if (error?.code === "SESSION_KEY_EXPIRED") {
      setTradeError("Session key expired");
    } else {
      setTradeError("Error executing trade: " + (error?.message || "Unknown error"));
    }
  };

  return (
    <main className="px-4 pb-10 min-h-[100vh] min-w-[600] flex items-top justify-center container max-w-screen-lg mx-auto">
      <div className="w-3/5 min-w-[540px]">
        <Header />

        <div className="mx-auto min-w-[360px]">


          <WalletCard />

          {tradeError && (
            <div className="text-red-600 text-center font-semibold mb-2">{tradeError}</div>
          )}

          <SwapCard
            isFetched={isFetched}
            isConnected={isConnected}
            isReconnecting={isReconnecting}
            isUsdcLoading={isUsdcLoading}
            isSbcLoading={isSbcLoading}
            address={address}
            sbcBalance={sbcBalance}
            usdcBalance={usdcBalance}
            use7702={use7702}
            sessionKeyAddress={sessionKeyAddress}
            sessionKernelClient={sessionKernelClient}
            disabled={use7702 && needsApproval}
          />

          <Disclaimer />
        </div>
      </div>
    </main>
  );

  function Header() {
    return (
      <header className="flex flex-col items-center mt-20 md:mb-20">
        <Image src="/swapIcon.svg" width={42} height={42} alt="swap" />
        <h1 className="my-4 text-3xl font-semibold tracking-tighter">Swap</h1>
        <div className="w-[360px] flex flex-col items-center mt-2 text-center">
          Swap USDC and SBC with zero gas fees, seamlessly powered by Uniswap.
        </div>
        <div className="flex flex-row items-center mt-6">
          <div className="flex items-center space-x-3">
            <input
              id="use7702-checkbox"
              type="checkbox"
              checked={use7702}
              onChange={async () => {
                const now = Math.floor(Date.now() / 1000);
                // If session key and validUntil exist
                if (serialisedSessionKey && sessionKeyValidUntil) {
                  if (now < sessionKeyValidUntil) {
                    // Session key is still valid, skip 'Create Session Key', go to approval step
                    // --- Restore sessionAccountAddress and sessionKernelClient ---
                    const sessionKeyKernelAccount = await deserializePermissionAccount(
                      publicClient,
                      getEntryPoint("0.7"),
                      KERNEL_V3_3,
                      serialisedSessionKey,
                    );
                    setSessionAccountAddress(sessionKeyKernelAccount.address);
                    // Recreate kernel client
                    const kernelPaymaster = createZeroDevPaymasterClient({
                      chain: base,
                      transport: http(ZERODEV_BASE_URL),
                    });
                    const kernelClient = createKernelAccountClient({
                      account: sessionKeyKernelAccount,
                      chain: base,
                      bundlerTransport: http(ZERODEV_BASE_URL),
                      paymaster: {
                        getPaymasterData: (userOperation) => {
                          return kernelPaymaster.sponsorUserOperation({
                            userOperation,
                          });
                        },
                      },
                    });
                    setSessionKernelClient(kernelClient);
                    // --- End restore ---
                    setUse7702(true);
                    setSetupStep(2); // session key created
                    setActionStatus('sessionKeyCreated');
                    setTradeError(null);
                    return;
                  } else {
                    // Session key expired, remove from local storage
                    setSerialisedSessionKey(null);
                    setSessionKeyValidUntil(null);
                    setSessionKernelClient(null);
                    setSessionAccountAddress(null);
                    setSessionKeyAddress(undefined);
                    setUse7702(true);
                    setSetupStep(0);
                    setActionStatus('idle');
                    setSessionKeyMessage(null);
                    setTradeError(null);
                    return;
                  }
                }
                // No session key or validUntil, normal flow
                setUse7702(!use7702);
                setSetupStep(0);
                setActionStatus('idle');
                setSessionKeyMessage(null);
                setTradeError(null);
                if (!use7702) {
                  await handleAuthorize();
                }
              }}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded cursor-pointer"
            />
            <label
              htmlFor="use7702-checkbox"
              className="text-sm font-medium text-foreground cursor-pointer select-none transition-colors"
            >
              <span className="inline-flex items-center">
                Use EIP-7702
                <span
                  className="ml-2 cursor-pointer text-gray-500 hover:text-gray-700 relative"
                  onMouseEnter={() => setShow7702Tooltip(true)}
                  onMouseLeave={() => setShow7702Tooltip(false)}
                >
                  <span className="text-lg font-bold">?</span>
                  {show7702Tooltip && (
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground shadow-lg z-10 w-[360px] break-words whitespace-normal">
                      EIP-7702 lets you upgrade (authorize) your wallet to a smart account and use session keys for seamless, permissioned, gasless swaps.
                      <br /><br />
                      You only need to create a session key and approve spending USDC and SBC once per session!
                    </span>
                  )}
                </span>
              </span>
            </label>
          </div>
        </div>
        {/* 7702 Setup UI - only visible if use7702 is true */}
        {use7702 && (
            <div className="flex flex-col items-center my-4">
              {/* Only show 'Create Session Key' button if there is no valid session key */}
              {(!serialisedSessionKey || !sessionKeyValidUntil || Math.floor(Date.now() / 1000) >= sessionKeyValidUntil) && (actionStatus === 'idle' || actionStatus === 'creatingSessionKey') && (
                <button
                  className={`px-4 py-2 rounded mb-4 ${actionStatus !== 'idle' || !sessionAccountAddress || !use7702 ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white'}`}
                  onClick={handleCreateSessionKey}
                  disabled={actionStatus !== 'idle' || !sessionAccountAddress || !use7702}
                >
                  {actionStatus === 'creatingSessionKey' ? 'Creating Session Key ...' : 'Create Session Key'}
                </button>
              )}
              {serialisedSessionKey && sessionKeyValidUntil && Math.floor(Date.now() / 1000) < sessionKeyValidUntil && (
                <>
                  <div className="flex flex-col items-center mt-1">
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center px-4 py-2 rounded-lg border border-green-400 bg-card text-green-300 text-base font-mono font-semibold shadow">
                        <span className="mr-2 text-lg">⏰</span>
                        <span>
                          Session key valid until&nbsp;
                          <span className="text-green-100 font-bold">
                            {new Date(sessionKeyValidUntil * 1000).toLocaleString()}
                          </span>
                        </span>
                        <button
                          className="ml-4 px-3 py-1 border border-gray-400 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
                          onClick={() => {
                            setSerialisedSessionKey(null);
                            setSessionKernelClient(null);
                            setSessionAccountAddress(null);
                            setSessionKeyAddress(undefined);
                            setUse7702(false);
                            setSetupStep(0);
                            setSessionKeyValidUntil(null);
                            setActionStatus('idle');
                            setSessionKeyMessage(null);
                            setTradeError(null);
                          }}
                        >
                          Revoke
                        </button>
                      </span>
                    </div>
                  </div>
                  {needsApproval &&actionStatus !== 'approved' && (
                    <button
                      className={`px-4 py-2 rounded mt-4 ${(!serialisedSessionKey || !sessionKeyValidUntil || Math.floor(Date.now() / 1000) >= sessionKeyValidUntil || !sessionAccountAddress || !use7702) ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white'}`}
                      onClick={handleApproveTokens}
                      disabled={(!serialisedSessionKey || !sessionKeyValidUntil || Math.floor(Date.now() / 1000) >= sessionKeyValidUntil || !sessionAccountAddress || !use7702)}
                    >
                      {actionStatus === 'approving' ? 'Approving ...' : 'Approve USDC & SBC'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
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
