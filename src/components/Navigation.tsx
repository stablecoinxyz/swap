"use client";

import Image from "next/image";
import Link from "next/link";

export function Navigation() {
  return (
    <nav className="fixed w-full bg-card flex flex-row z-50">
      <div className="flex w-1/3 text-left p-4 ">
        <Image src="nav-sbc-logo.svg" alt="Stablecoin" width={24} height={24} />
        <h1 className="text-xl font-neutral ml-2">SBC</h1>
      </div>

      <ul className="w-1/3 flex justify-center space-x-4">
        <li className="m-4 flex flex-row space-x-2 align-baseline">
          <Link href="/">
            <div className="flex flex-row space-x-2 align-baseline">
              <Image
                src="swapNavActive.svg"
                alt="Home"
                width={24}
                height={24}
              />
              <span>Swap</span>
            </div>
          </Link>
        </li>
        <li className="m-4 flex flex-row space-x-2 align-baseline">
          <Link href="https://masspay.stablecoin.xyz" className="font-bold">
            <div className="flex flex-row space-x-2 align-baseline">
              <Image
                src="masspayNavInactive.svg"
                alt="Home"
                width={24}
                height={24}
              />
              <span>MassPay</span>
            </div>
          </Link>
        </li>
      </ul>

      <div className="w-1/3 flex">&nbsp;</div>
    </nav>
  );
}
