# gasless-swap

This project is a simple web application that allows users to swap tokens on the Base blockchain without having to pay for gas fees. It uses the [Pimlico](https://pimlico.io/) Paymaster and its Account Abstraction SDK to execute the swaps and [WalletConnect](https://reown.com/) to connect to the user's wallet.

## Demo

You can view the live demo of the project [here](https://swap.stablecoin.xyz/). You need to be on the Base blockchain.

[[!gasless-swap](./public/docs/gasless-swap.png)](#)

After connecting your wallet, you can swap between [USDC](https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913#code) and [SBC](https://basescan.org/token/0xfdcC3dd6671eaB0709A4C0f3F53De9a333d80798#code) tokens in either direction.

You don't need any ETH to pay for gas fees as our Paymaster will cover the fees for you.

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file:

- `NEXT_PUBLIC_PIMLICO_API_KEY` - refer to the [Pimlico dashboard](https://dashboard.pimlico.io/)
- `NEXT_PUBLIC_SPONSORSHIP_POLICY_ID` - create a policy from the [Pimlico dashboard](https://dashboard.pimlico.io/) and get its ID
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - refer to the [WalletConnect dashboard](https://cloud.reown.com/)`

## Run locally

Install dependencies

```bash
npm install
```

Start development server

```bash
npm run dev
```

## Author

- [@Ectsang](https://www.github.com/Ectsang)
