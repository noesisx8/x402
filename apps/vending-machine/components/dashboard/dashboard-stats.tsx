"use client";

import { useMemo } from "react";
import { BarChart, Sparkline } from "./charts";

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
    paidDeliveries?: number;
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

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-gray-200 bg-gray-50/60 dark:border-zinc-800 dark:bg-zinc-900/50"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-zinc-100"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}

export function DashboardStats({ data }: { data: DashboardData }) {
  const { analytics, blockchain, network, services, caps } = data;

  const total402 = analytics.summary.byEvent["402_issued"] ?? 0;
  const totalErrors = analytics.summary.byEvent["error"] ?? 0;
  // Prefer the cross-isolate counter; fall back to the local buffer.
  const totalDeliveries =
    analytics.paidDeliveries ?? analytics.summary.byEvent["200_delivered"] ?? 0;
  const fromShared = analytics.source === "redis";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Paid Deliveries"
          value={totalDeliveries}
          sub={
            fromShared
              ? "from shared settlement log"
              : `${total402} 402 issued · ${totalErrors} errors (this isolate)`
          }
          accent
        />
        <StatCard
          label="Est. Revenue"
          value={`$${analytics.estimatedRevenue}`}
          sub={fromShared ? "From shared settlement log" : "From in-memory analytics"}
          accent
        />
        <StatCard
          label="On-Chain USDC"
          value={`$${blockchain.totalUsdc}`}
          sub={
            network.blockchainConfigured
              ? `${blockchain.totalSettlements} verified settlements`
              : "Blockchain not configured"
          }
        />
        <StatCard
          label="Active Services"
          value={services.total}
          sub={`Max price cap $${caps.maxPriceUsd}`}
        />
      </div>

      {/* Network Info */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Network Configuration</h3>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          <div>
            <span className="text-gray-500 dark:text-zinc-500">Mode:</span>{" "}
            <span className="font-mono text-gray-800 dark:text-zinc-200">{network.mode}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-zinc-500">CAIP:</span>{" "}
            <span className="font-mono text-gray-800 dark:text-zinc-200">{network.caip}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-zinc-500">Pay To:</span>{" "}
            <span className="font-mono text-gray-800 dark:text-zinc-200">{truncateAddress(network.payTo)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-zinc-500">Blockchain:</span>{" "}
            <span className={network.blockchainConfigured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {network.blockchainConfigured ? "Connected ✓" : "Not configured"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-zinc-500">Rate Limit:</span>{" "}
            <span className="text-gray-800 dark:text-zinc-200">
              {caps.unpaidRateLimit} / {Math.round(caps.unpaidWindowMs / 1000)}s
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-zinc-500">Latest Block:</span>{" "}
            <span className="font-mono text-gray-800 dark:text-zinc-200">
              {blockchain.latestBlock > 0 ? blockchain.latestBlock.toLocaleString() : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HourlyActivity({ data }: { data: DashboardData }) {
  const total = data.analytics.hourlyActivity.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Activity (Last 24h)</h3>
        <span className="text-xs text-gray-500 dark:text-zinc-500">{total} calls</span>
      </div>
      <div className="mt-3">
        <Sparkline data={data.analytics.hourlyActivity} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400 dark:text-zinc-600">
        <span>24h ago</span>
        <span>12h ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}

export function ServiceBreakdown({ data }: { data: DashboardData }) {
  const items = useMemo(() => {
    return Object.entries(data.analytics.bySlug)
      .map(([slug, stats]) => ({
        label: slug,
        value: stats.calls,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Top Services</h3>
      <div className="mt-3">
        <BarChart
          items={items.map((i) => ({
            label: i.label,
            value: i.value,
          }))}
          max={max}
        />
      </div>
    </div>
  );
}

export function BlockchainSettlements({ data }: { data: DashboardData }) {
  const { blockchain, network } = data;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">On-Chain Settlements</h3>
        <span className="text-xs text-gray-500 dark:text-zinc-500">
          {network.blockchainConfigured ? "Verified on Base" : "Not configured"}
        </span>
      </div>
      {blockchain.recentSettlements.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-zinc-500">
          {network.blockchainConfigured
            ? "No USDC transfers found for this address yet."
            : "Set BASESCAN_API_KEY and a real X402_PAY_TO_ADDRESS to see on-chain data."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
                <th className="px-2 py-1.5 font-medium">Tx Hash</th>
                <th className="px-2 py-1.5 font-medium">From</th>
                <th className="px-2 py-1.5 font-medium">Amount</th>
                <th className="px-2 py-1.5 font-medium">Block</th>
                <th className="px-2 py-1.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {blockchain.recentSettlements.map((s) => (
                <tr key={s.hash} className="border-b border-gray-100 dark:border-zinc-800/60">
                  <td className="px-2 py-1.5 font-mono text-gray-700 dark:text-zinc-300">
                    <a
                      href={`https://basescan.org/tx/${s.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {truncateAddress(s.hash)}
                    </a>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-zinc-400">{truncateAddress(s.from)}</td>
                  <td className="px-2 py-1.5 text-emerald-600 dark:text-emerald-400">{s.amountUsdc} USDC</td>
                  <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-zinc-400">
                    {s.blockNumber.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 dark:text-zinc-500">{ago(s.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RecentCalls({ data }: { data: DashboardData }) {
  const calls = data.analytics.recentCalls.slice(0, 20);

  const eventColor: Record<string, string> = {
    "200_delivered": "text-emerald-600 dark:text-emerald-400",
    "402_issued": "text-amber-600 dark:text-amber-400",
    payment_present: "text-sky-600 dark:text-sky-400",
    handler_ok: "text-gray-700 dark:text-zinc-300",
    handler_fail: "text-red-600 dark:text-red-400",
    settlement_response: "text-emerald-500 dark:text-emerald-300",
    rate_limited: "text-orange-600 dark:text-orange-400",
    error: "text-red-700 dark:text-red-500",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Recent Calls</h3>
      {calls.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-zinc-500">No calls recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 dark:border-zinc-800 dark:text-zinc-500">
                <th className="px-2 py-1.5 font-medium">Event</th>
                <th className="px-2 py-1.5 font-medium">Service</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">MS</th>
                <th className="px-2 py-1.5 font-medium">Payer</th>
                <th className="px-2 py-1.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c, i) => (
                <tr key={`${c.at}-${i}`} className="border-b border-gray-100 dark:border-zinc-800/60">
                  <td className={`px-2 py-1.5 ${eventColor[c.event] ?? "text-gray-500 dark:text-zinc-400"}`}>
                    {c.event}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-gray-700 dark:text-zinc-300">{c.slug}</td>
                  <td className="px-2 py-1.5 text-gray-500 dark:text-zinc-400">{c.status ?? "—"}</td>
                  <td className="px-2 py-1.5 text-gray-500 dark:text-zinc-400">{c.ms ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-gray-500 dark:text-zinc-500">
                    {c.payerHint ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 dark:text-zinc-500">{ago(c.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
