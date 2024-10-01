export function Header() {
  return (
    <header className="flex flex-col items-center mb-20 md:mb-20">
      <h1 className="text-2xl font-semibold tracking-tighter text-zinc-100">
        Stable Coin | Gasless Swap
      </h1>

      <p className="text-zinc-300 text-base">
        A gasless swap of USDC to SBC from{" "}
        <a
          href="https://stablecoin.xyz"
          target="_blank"
          className="text-zinc-400 underline"
        >
          stablecoin.xyz
        </a>
      </p>
    </header>
  );
}
