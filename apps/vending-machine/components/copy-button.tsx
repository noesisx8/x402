"use client";

import { useState } from "react";

/** Small clipboard button used across the catalog and trust sections. */
export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable (permissions) — no-op
        }
      }}
      className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500 transition hover:border-emerald-500/50 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-emerald-400"
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
