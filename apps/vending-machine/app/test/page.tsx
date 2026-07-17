"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  connectBrowserWallet,
  paidGet,
  type ClientNetworkConfig,
} from "@/lib/x402/paid-fetch-client";

type TestService = {
  slug: string;
  name?: string;
  price?: string;
  category?: string;
  qs: string;
};

export default function TestPage() {
  const [services, setServices] = useState<TestService[]>([]);
  const [slug, setSlug] = useState("");
  const [qs, setQs] = useState("");
  const [out, setOut] = useState("");
  const [config, setConfig] = useState<ClientNetworkConfig | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config/client", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setConfig(j as ClientNetworkConfig))
      .catch(() => setOut("Failed to load /api/config/client"));
  }, []);

  useEffect(() => {
    // Live registry — never a hardcoded list (prevents missing new SKUs like kronos-forecast)
    fetch("/api/config/test-services", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`test-services HTTP ${r.status}`);
        return r.json() as Promise<{ services: TestService[] }>;
      })
      .then((j) => {
        const list = j.services ?? [];
        setServices(list);
        if (list.length > 0) {
          setSlug(list[0].slug);
          setQs(list[0].qs ?? "");
        }
      })
      .catch((e) => {
        setListError(String(e));
        setOut(`Failed to load service list: ${String(e)}`);
      });
  }, []);

  const selected = useMemo(
    () => services.find((s) => s.slug === slug),
    [services, slug],
  );

  const url = slug ? `/api/v/${slug}?${qs}` : "";

  const callUnpaid = useCallback(async () => {
    if (!url) return;
    setBusy(true);
    setOut("Loading…");
    try {
      const res = await fetch(url, { cache: "no-store" });
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
    if (!url) return;
    setBusy(true);
    setOut("402 → sign in wallet → retry…");
    try {
      const res = await paidGet(url, address, config);
      const paymentResponse =
        res.headers.get("payment-response") ?? res.headers.get("PAYMENT-RESPONSE");
      const text = await res.text();
      let extra = "";
      if (paymentResponse) {
        extra = `\n\n(settlement header present, length ${paymentResponse.length})`;
      } else if (res.status === 402) {
        extra =
          "\n\nStill 402: not settled. Use Pay & GET (not the unpaid button), approve USDC in wallet, keep query string unchanged.";
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
        Step 1: unpaid GET expects <strong className="text-amber-400">402</strong>. Step 2: connect
        wallet on {config?.chainName ?? "…"} with USDC, then{" "}
        <strong className="text-emerald-400">Pay &amp; GET</strong> for{" "}
        <strong className="text-emerald-400">200</strong> + JSON.
      </p>
      {config && (
        <p className="mt-1 text-xs text-zinc-500">
          Server network: {config.caipNetwork} — {config.hint}
        </p>
      )}
      {listError && (
        <p className="mt-2 text-sm text-red-400">Service list error: {listError}</p>
      )}
      <label className="mt-6 block text-sm">
        Service ({services.length} from live registry)
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2"
          value={slug}
          disabled={services.length === 0}
          onChange={(e) => {
            const pick = services.find((s) => s.slug === e.target.value);
            setSlug(e.target.value);
            if (pick) setQs(pick.qs ?? "");
          }}
        >
          {services.length === 0 && <option value="">Loading services…</option>}
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.category && s.category !== "atom" ? `[${s.category}] ` : ""}
              {s.slug}
              {s.price ? ` (${s.price})` : ""}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p className="mt-1 text-xs text-zinc-500">
          {selected.name ?? selected.slug}
          {selected.category ? ` · ${selected.category}` : ""}
        </p>
      )}
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
          disabled={busy || !slug}
          onClick={callUnpaid}
          className="rounded border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          GET (no payment) — always 402
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
          disabled={busy || !address || !slug}
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
