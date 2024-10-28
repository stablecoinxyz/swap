import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stable Coin | MassPay",
  description: "",
  keywords: "",
};

export default function MassPayLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
