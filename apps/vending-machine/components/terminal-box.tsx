import Link from "next/link";
import { CopyButton } from "@/components/copy-button";

/**
 * Terminal window with traffic-light header, CRT scanlines and phosphor
 * green glow (pip-boy inspired, x402 themed). Server-safe: the only client
 * piece inside is the CopyButton.
 */
export function TerminalBox({
  title,
  copyText,
  payHref,
  payLabel,
  children,
}: {
  title: string;
  copyText?: string;
  /** When set, renders a Pay button in the header linking to the paid test flow. */
  payHref?: string;
  payLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="crt-screen font-mono text-xs leading-6">
      <div className="relative z-10 flex items-center gap-1.5 border-b border-zinc-800/70 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        <span className="ml-2 truncate text-zinc-500">{title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {copyText && <CopyButton text={copyText} />}
          {payHref && (
            <Link
              href={payHref}
              className="rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 font-sans text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
            >
              {payLabel ?? "Pay →"}
            </Link>
          )}
        </span>
      </div>
      <div className="relative px-3 py-3">
        <div className="crt-scanlines" />
        {children}
      </div>
    </div>
  );
}
