import Image from "next/image";
import Link from "next/link";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";

/** Vendor Buddy — x402 vending machine mascot (top-left brand mark). */
export function SiteHeader() {
  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="x402 Vending Machine home"
        >
          <Image
            src="/vendorbuddy.png"
            alt="Vendor Buddy, the x402 vending machine mascot"
            width={56}
            height={56}
            className="h-12 w-12 rounded-xl object-cover shadow-md shadow-emerald-950/40 ring-1 ring-zinc-700/80 transition group-hover:ring-emerald-500/40 sm:h-14 sm:w-14"
            priority
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-300">
              x402 Vending Machine
            </p>
            <p className="text-xs text-zinc-500">Vendor Buddy · Base USDC hub</p>
          </div>
        </Link>
        <span className="hidden rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-xs text-zinc-400 sm:inline">
          Base · {network}
        </span>
        <nav className="ml-auto flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <Link className="hover:text-emerald-400" href="/#tools">
            Tools
          </Link>
          <Link className="hover:text-emerald-400" href="/#how">
            How it works
          </Link>
          <Link className="hover:text-emerald-400" href="/#proof">
            Proof
          </Link>
          <Link className="hover:text-emerald-400" href="/#faq">
            FAQ
          </Link>
          <Link className="hover:text-emerald-400" href="/test">
            /test
          </Link>
          <Link className="hover:text-emerald-400" href="/disclaimer">
            Disclaimer
          </Link>
        </nav>
      </div>
    </header>
  );
}
