import Image from "next/image";
import Link from "next/link";
import { CAIP_NETWORK, serverEnv } from "@/lib/env";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectWallet } from "@/components/connect-wallet";

/** Vendor Buddy — x402 vending machine mascot (top-left brand mark). */
export function SiteHeader() {
  const network = CAIP_NETWORK[serverEnv.X402_NETWORK_MODE];
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/95">
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
            className="h-12 w-12 rounded-xl object-cover shadow-md shadow-emerald-950/40 ring-1 ring-gray-200 transition group-hover:ring-emerald-500/40 dark:shadow-emerald-950/40 dark:ring-zinc-700/80 sm:h-14 sm:w-14"
            priority
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 dark:text-zinc-100 dark:group-hover:text-emerald-300">
              x402 Vending Machine
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Vendor Buddy · Base USDC hub</p>
          </div>
        </Link>
        <span className="hidden rounded border border-gray-200 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400 sm:inline">
          Base · {network}
        </span>
        <nav className="ml-auto hidden flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-zinc-400 md:flex">
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/#tools">
            Tools
          </Link>
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/#how">
            How it works
          </Link>
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/#proof">
            Proof
          </Link>
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/#faq">
            FAQ
          </Link>
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/test">
            /test
          </Link>
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/dashboard">
            Dashboard
          </Link>
          <Link className="hover:text-emerald-600 dark:hover:text-emerald-400" href="/disclaimer">
            Disclaimer
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ConnectWallet />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
