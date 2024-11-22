"use client";

import Link from "next/link";

export function Navigation() {
  return (
    <nav className="fixed">
      <ul className="flex space-x-4">
        <li className="m-4 ml-8">
          <Link href="/" className="font-bold">
            Swap
          </Link>
        </li>
        <li className="m-4">
          <Link href="https://masspay.stablecoin.xyz" target="_blank">
            MassPay
          </Link>
        </li>
      </ul>
    </nav>
  );
}
