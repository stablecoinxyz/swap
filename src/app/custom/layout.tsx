import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stable Coin | Custom Paymaster",
  description: "",
  keywords: "",
};

export default function CustomPaymasterLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
