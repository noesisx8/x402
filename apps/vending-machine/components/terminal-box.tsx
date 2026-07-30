import { CopyButton } from "@/components/copy-button";

/**
 * Terminal window with traffic-light header, CRT scanlines and phosphor
 * green glow (pip-boy inspired, x402 themed). Server-safe: the only client
 * piece inside is the CopyButton.
 */
export function TerminalBox({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="crt-screen font-mono text-xs leading-6">
      <div className="relative z-10 flex items-center gap-1.5 border-b border-zinc-800/70 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        <span className="ml-2 truncate text-zinc-500">{title}</span>
        {copyText && (
          <span className="ml-auto shrink-0">
            <CopyButton text={copyText} />
          </span>
        )}
      </div>
      <div className="relative px-3 py-3">
        <div className="crt-scanlines" />
        {children}
      </div>
    </div>
  );
}
