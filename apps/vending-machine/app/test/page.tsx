"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import {
  connectBrowserWallet,
  paidGet,
  type ClientNetworkConfig,
} from "@/lib/x402/paid-fetch-client";

const SERVICES = [
  { slug: "qr-code", qs: "data=https://x402.org" },
  { slug: "crypto-prices", qs: "ids=bitcoin,ethereum" },
  { slug: "weather", qs: "city=Berlin" },
  { slug: "email-validate", qs: "email=test@example.com" },
];

export default function TestPage() {
  const [slug, setSlug] = useState(SERVICES[0].slug);
  const [qs, setQs] = useState(SERVICES[0].qs);
  const [out, setOut] = useState("");
  const [config, setConfig] = useState<ClientNetworkConfig | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/config/client")
      .then((r) => r.json())
      .then((j) => setConfig(j as ClientNetworkConfig))
      .catch(() => setOut("Failed to load /api/config/client"));
  }, []);

  const url = `/api/v/${slug}?${qs}`;

  const callUnpaid = useCallback(async () => {
    setBusy(true);
    setOut("Loading…");
    try {
      const res = await fetch(url);
      const text = await res.text();
      setOut(`HTTP ${res.status}\n${text}`);
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }, [url]);

  const connect = useCallback(async () => {
    if (!config) return;
    setBusy(true);
    setOut("Connecting wallet…");
    try {
      const addr = await connectBrowserWallet(config);
      setAddress(addr);
      setOut(`Connected: ${addr}\nNetwork: ${config.chainName}\n${config.hint}`);
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }, [config]);

  const callPaid = useCallback(async () => {
    if (!config || !address) {
      setOut("Connect wallet first.");
      return;
    }
    setBusy(true);
    setOut("402 → sign in wallet → retry…");
    try {
      const res = await paidGet(url, address, config);
      const paymentResponse = res.headers.get("payment-response") ?? res.headers.get("PAYMENT-RESPONSE");
      const text = await res.text();
      let extra = "";
      if (paymentResponse) {
        extra = `\n\n(settlement header present, length ${paymentResponse.length})`;
      }
      setOut(`HTTP ${res.status}\n${text}${extra}`);
    } catch (e) {
      setOut(`Paid call failed:\n${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [address, config, url]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">x402 paid test</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Step 1: unpaid GET expects <strong className="text-amber-400">402</strong>. Step 2: connect wallet on{" "}
        {config?.chainName ?? "…"} with USDC, then <strong className="text-emerald-400">Pay &amp; GET</strong> for{" "}
        <strong className="text-emerald-400">200</strong> + JSON.
      </p>
      {config && (
        <p className="mt-1 text-xs text-zinc-500">
          Server network: {config.caipNetwork} — {config.hint}
        </p>
      )}
      <label className="mt-6 block text-sm">
        Service
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2"
          value={slug}
          onChange={(e) => {
            const pick = SERVICES.find((s) => s.slug === e.target.value);
            setSlug(e.target.value);
            if (pick) setQs(pick.qs);
          }}
        >
          {SERVICES.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.slug}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Query string
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-xs"
          value={qs}
          onChange={(e) => setQs(e.target.value)}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={callUnpaid}
          className="rounded border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          GET (no payment)
        </button>
        <button
          type="button"
          disabled={busy || !config}
          onClick={connect}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {address ? "Reconnect wallet" : "Connect wallet"}
        </button>
        <button
          type="button"
          disabled={busy || !address}
          onClick={callPaid}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          Pay &amp; GET
        </button>
      </div>
      {address && (
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Payer: {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      )}
      <pre className="mt-6 overflow-auto rounded border border-zinc-800 bg-black/40 p-4 text-xs whitespace-pre-wrap">
        {out}
      </pre>
    </main>
  );
}