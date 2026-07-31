import Link from "next/link";
import { getLegalOperator } from "@/lib/legal";

export function SiteFooter() {
  const op = getLegalOperator();
  return (
    <footer className="mt-16 border-t border-gray-200 px-6 py-8 text-sm text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {op.year} {op.name}. All rights reserved.
          {op.incomplete && (
            <span className="ml-2 text-amber-600/90 dark:text-amber-500/90">
              (Legal draft — set LEGAL_* env before relying on policies)
            </span>
          )}
        </p>
        <nav className="flex flex-wrap gap-x-3 gap-y-1">
          <Link className="text-emerald-600/90 underline hover:text-emerald-500 dark:text-emerald-400/90 dark:hover:text-emerald-300" href="/terms">
            Terms of Service
          </Link>
          <span className="text-gray-300 dark:text-zinc-700">·</span>
          <Link className="text-emerald-600/90 underline hover:text-emerald-500 dark:text-emerald-400/90 dark:hover:text-emerald-300" href="/privacy">
            Privacy Policy
          </Link>
          <span className="text-gray-300 dark:text-zinc-700">·</span>
          <Link className="text-emerald-600/90 underline hover:text-emerald-500 dark:text-emerald-400/90 dark:hover:text-emerald-300" href="/disclaimer">
            Research Disclaimer
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-3 max-w-4xl text-xs text-gray-400 dark:text-zinc-600">
        Micropayments in USDC on Base are final when settled. Kronos and market tools are research-only —{" "}
        <Link className="underline hover:text-gray-600 dark:hover:text-zinc-400" href="/disclaimer">
          not financial advice
        </Link>
        .
      </p>
    </footer>
  );
}
