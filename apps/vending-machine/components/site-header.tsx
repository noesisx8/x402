import Image from "next/image";
import Link from "next/link";

/** Vendor Buddy — x402 vending machine mascot (top-left brand mark). */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
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
        <nav className="ml-auto flex flex-wrap items-center gap-3 text-xs text-zinc-400">
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
