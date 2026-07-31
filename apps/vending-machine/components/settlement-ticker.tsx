"use client";

import { useEffect, useState } from "react";

type Settlement = {
  slug: string;
  price: string | null;
  ms: number | null;
  at: string;
};

type Feed = { count: number; settlements: Settlement[] };

const POLL_MS = 15_000;

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Item({ s }: { s: Settlement }) {
  return (
    <span className="mx-4 inline-flex items-center gap-2 whitespace-nowrap text-xs text-gray-600 dark:text-zinc-400">
      <span className="text-emerald-600 dark:text-emerald-400">settled</span>
      <span className="font-mono text-gray-800 dark:text-zinc-200">{s.slug}</span>
      {s.price && <span>{s.price} USDC</span>}
      {s.ms != null && <span className="text-gray-400 dark:text-zinc-500">{s.ms}ms</span>}
      <span className="text-gray-400 dark:text-zinc-600">{ago(s.at)}</span>
    </span>
  );
}

/**
 * Live settlement ticker. Polls /api/stats/public and scrolls recent paid
 * deliveries. The feed is per-edge-isolate (in-memory analytics), so the
 * empty state is honest rather than fake zeros.
 */
export function SettlementTicker() {
  const [feed, setFeed] = useState<Feed | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/stats/public", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Feed;
        if (!cancelled) setFeed(json);
      } catch {
        // network hiccup — keep last good feed
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const items = feed?.settlements ?? [];

  return (
    <div
      aria-live="polite"
      className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/60 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      {items.length === 0 ? (
        <p className="px-2 text-xs text-gray-500 dark:text-zinc-500">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-gray-400 align-middle dark:bg-zinc-600" />
          No paid calls observed by this edge isolate yet — the feed updates automatically as
          settlements land.
        </p>
      ) : (
        <div className="ticker-track" style={{ ["--ticker-items" as string]: items.length }}>
          {/* duplicated for a seamless loop */}
          {[...items, ...items].map((s, i) => (
            <Item key={`${s.at}-${i}`} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
