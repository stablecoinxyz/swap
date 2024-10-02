import { BaseProvider } from "@ethersproject/providers";
import { BigNumber, ethers, providers } from "ethers";

import { CurrentConfig, Environment, TradeConfig } from "../config";

// Single copies of provider and wallet
const polygonProvider = new ethers.providers.JsonRpcProvider(
  CurrentConfig.rpc.polygon,
);

// const wallet = createWallet();

const browserExtensionProvider = createBrowserExtensionProvider();
let walletExtensionAddress: string | null = null;

// Interfaces

export enum TransactionState {
  Failed = "Failed",
  New = "New",
  Rejected = "Rejected",
  Sending = "Sending",
  Sent = "Sent",
}

// Provider and Wallet Functions
export function getPolygonProvider(): BaseProvider {
  return polygonProvider;
}

// export function getProvider(): providers.Provider | null {
//   // console.log(`CurrentConfig.env: ${CurrentConfig.env}`);
//   // return CurrentConfig.env === Environment.WALLET_EXTENSION
//   //   ? browserExtensionProvider
//   //   : wallet.provider;
//   return browserExtensionProvider;
// }

// export function getWalletAddress(): string | null {
//   console.log(`CurrentConfig.env: ${CurrentConfig.env}`);
//   return CurrentConfig.env === Environment.WALLET_EXTENSION
//     ? walletExtensionAddress
//     : wallet.address;
// }

export async function sendTransaction(
  transaction: ethers.providers.TransactionRequest,
  config: TradeConfig,
): Promise<TransactionState> {
  // if (CurrentConfig.env === Environment.WALLET_EXTENSION) {
  //   return sendTransactionViaExtension(transaction, provider);
  // } else {
  //   if (transaction.value) {
  //     transaction.value = BigNumber.from(transaction.value);
  //   }
  return sendTransactionViaWallet(transaction, config);
  // }
}

export async function connectBrowserExtensionWallet() {
  if (!(window as any).ethereum) {
    return null;
  }

  const { ethereum } = window as any;
  const provider = new ethers.providers.Web3Provider(ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);

  if (accounts.length !== 1) {
    return;
  }

  walletExtensionAddress = accounts[0];
  console.log(`Connected to wallet: ${walletExtensionAddress}`);
  return walletExtensionAddress;
}

// Internal Functionality

// function createWallet(): ethers.Wallet {
//   let provider = polygonProvider;
//   // if (CurrentConfig.env == Environment.LOCAL) {
//   //   provider = new ethers.providers.JsonRpcProvider(CurrentConfig.rpc.local);
//   // }
//   return new ethers.Wallet(CurrentConfig.wallet.privateKey, provider);
// }

function createBrowserExtensionProvider(): ethers.providers.Web3Provider | null {
  try {
    const provider = new ethers.providers.Web3Provider(
      (window as any).ethereum,
      "any",
    );
    console.log(`Browser Extension Provider: ${JSON.stringify(provider)}`);
    return provider;
  } catch (e) {
    console.log("No Wallet Extension Found");
    return null;
  }
}

// Transacting with a wallet extension via a Web3 Provider
async function sendTransactionViaExtension(
  transaction: ethers.providers.TransactionRequest,
  provider: any,
): Promise<TransactionState> {
  console.log("sendTransactionViaExtension", transaction);
  try {
    const receipt = await browserExtensionProvider?.send(
      "eth_sendTransaction",
      [transaction],
    );
    if (receipt) {
      return TransactionState.Sent;
    } else {
      return TransactionState.Failed;
    }
  } catch (e) {
    console.log(e);
    return TransactionState.Rejected;
  }
}

async function sendTransactionViaWallet(
  transaction: ethers.providers.TransactionRequest,
  config: TradeConfig,
): Promise<TransactionState> {
  console.log("sendTransactionViaWallet", transaction);
  if (transaction.value) {
    transaction.value = BigNumber.from(transaction.value);
  }

  console.log("using wallet", config.wallet);

  const txRes = await config.wallet.sendTransaction(transaction);

  let receipt = null;
  const provider = config.provider; //getProvider();
  if (!provider) {
    return TransactionState.Failed;
  }

  while (receipt === null) {
    try {
      receipt = await provider.getTransactionReceipt(txRes.hash);

      if (receipt === null) {
        continue;
      }
    } catch (e) {
      console.log(`Receipt error:`, e);
      break;
    }
  }

  // Transaction was successful if status === 1
  if (receipt) {
    return TransactionState.Sent;
  } else {
    return TransactionState.Failed;
  }
}

// function to return polygon scanner link for a transaction hash
export function getPolygonScanLink(transactionHash: string) {
  return `https://polygonscan.com/tx/${transactionHash}`;
}
