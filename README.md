# gasless-swap

This project is a simple web application that allows users to swap tokens on the Base blockchain without having to pay for gas fees. It uses the [Pimlico](https://pimlico.io/) Paymaster and its Account Abstraction SDK to execute the swaps and [WalletConnect](https://reown.com/) to connect to the user's wallet.

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
