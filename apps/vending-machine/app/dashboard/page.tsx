"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DashboardStats,
  HourlyActivity,
  ServiceBreakdown,
  BlockchainSettlements,
  RecentCalls,
} from "@/components/dashboard/dashboard-stats";

type DashboardData = {
  network: {
    mode: string;
    caip: string;
    payTo: string;
    blockchainConfigured: boolean;
  };
  caps: {
    maxPriceUsd: number;
    unpaidRateLimit: number;
    unpaidWindowMs: number;
  };
  services: {
    total: number;
    list: Array<{ slug: string; name: string; price: string; category: string }>;
  };
  analytics: {
    source?: "redis" | "memory";
    summary: {
      total: number;
      byEvent: Record<string, number>;
      bySlug: Record<string, number>;
    };
    recentCalls: Array<{
      event: string;
      slug: string;
      status?: number;
      ms?: number;
      at: string;
      payerHint?: string;
    }>;
    estimatedRevenue: string;
    hourlyActivity: number[];
    bySlug: Record<string, { calls: number; revenue: number; price: string | null }>;
  };
  blockchain: {
    totalSettlements: number;
    totalUsdc: string;
    avgUsdc: string;
    latestBlock: number;
    recentSettlements: Array<{
      hash: string;
      from: string;
      to: string;
      amountUsdc: string;
      timestamp: string;
      blockNumber: number;
      confirmations: number;
    }>;
  };
};

const POLL_MS = 15_000;
const TOKEN_KEY = "x402-dashboard-token";

function AuthForm({ onAuth }: { onAuth: (token: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!input.trim()) {
        setError("Enter your analytics token");
        return;
      }
      // Quick validation: try fetching with the token
      try {
        const res = await fetch(`/api/dashboard/stats?token=${encodeURIComponent(input.trim())}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error ?? "Invalid token");
          return;
        }
        localStorage.setItem(TOKEN_KEY, input.trim());
        onAuth(input.trim());
      } catch (e) {
        setError(String(e));
      }
    },
    [input, onAuth],
  );

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">x402 Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
          Enter your analytics token to access the admin dashboard.
        </p>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ANALYTICS_TOKEN"
          className="w-full rounded-md border border-gray-200 bg-white/60 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-500/60 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-600"
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
        >
          Access Dashboard
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-gray-400 dark:text-zinc-600">
        Set ANALYTICS_TOKEN in your environment variables to generate a token.
      </p>
    </main>
  );
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/dashboard/stats?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!token) {
    return <AuthForm onAuth={setToken} />;
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">x402 Dashboard</h1>
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load: {error}</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setToken(null);
            }}
            className="mt-2 rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">x402 Dashboard</h1>
        <p className="mt-4 text-sm text-gray-500 dark:text-zinc-500">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">x402 Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
            Real-time monitoring · {data.network.mode} · {data.services.total} services
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 dark:text-zinc-600">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Loading…"}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                data.network.blockchainConfigured ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-xs text-gray-500 dark:text-zinc-500">
              {data.network.blockchainConfigured ? "Blockchain connected" : "Blockchain offline"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setToken(null);
            }}
            className="mt-2 text-xs text-gray-500 underline hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-8">
        <DashboardStats data={data} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <HourlyActivity data={data} />
        <ServiceBreakdown data={data} />
      </div>

      <div className="mt-6">
        <BlockchainSettlements data={data} />
      </div>

      <div className="mt-6">
        <RecentCalls data={data} />
      </div>
    </main>
  );
}
