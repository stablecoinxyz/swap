import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stable Coin | MassPay",
  description: "",
  keywords: "",
};

export default function MassPayPage() {
  return (
    <main className="px-4 pb-10 min-h-[100vh] flex items-top justify-center container max-w-screen-lg mx-auto">
      <div className="w-1/2">
        <Header />
      </div>
    </main>
  );

  function Header() {
    return (
      <header className="flex flex-col items-center my-20 md:mb-20">
        <h1 className="text-2xl font-semibold tracking-tighter">
          Stable Coin | MassPay
        </h1>

        <p className="text-base">
          A gasless mass pay (airdrop) of SBC from{" "}
          <a
            href="https://stablecoin.xyz"
            target="_blank"
            className=" underline"
          >
            stablecoin.xyz
          </a>
        </p>
      </header>
    );
  }
}
