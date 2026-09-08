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
  const [paidActivity, setPaidActivity] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
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
          // Deep link from catalog Pay buttons: /test?tool=<slug>
          const wanted =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("tool")
              : null;
          const pick = list.find((s) => s.slug === wanted) ?? list[0];
          setSlug(pick.slug);
          setQs(pick.qs ?? "");
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
    setPaidActivity(null);
    setFailure(null);
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
    setPaidActivity(null);
    setFailure(null);
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
    setFailure(null);
    setPaidActivity(`Waiting for wallet signature${selected?.slug ? ` for ${selected.slug}` : ""}. Keep this page open.`);
    setOut("402 → sign in wallet → retry…");
    try {
      const res = await paidGet(url, address, config);
      setPaidActivity("Payment submitted. Vercel is verifying settlement and running the service…");
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
      const output = `HTTP ${res.status}\n${text}${extra}`;
      setOut(output);
      if (!res.ok) {
        setFailure(output);
      }
    } catch (e) {
      const message = `Paid call failed:\n${String(e)}`;
      setFailure(message);
      setOut(message);
    } finally {
      setBusy(false);
      setPaidActivity(null);
    }
  }, [address, config, selected?.slug, url]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">x402 paid test</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
        Step 1: unpaid GET expects <strong className="text-amber-600 dark:text-amber-400">402</strong>. Step 2: connect
        wallet on {config?.chainName ?? "…"} with USDC, then{" "}
        <strong className="text-emerald-600 dark:text-emerald-400">Pay &amp; GET</strong> for{" "}
        <strong className="text-emerald-600 dark:text-emerald-400">200</strong> + JSON.
      </p>
      {config && (
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
          Server network: {config.caipNetwork} — {config.hint}
        </p>
      )}
      {listError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">Service list error: {listError}</p>
      )}
      <label className="mt-6 block text-sm text-gray-800 dark:text-zinc-200">
        Service ({services.length} from live registry)
        <select
          className="mt-1 w-full rounded border border-gray-200 bg-white/60 p-2 text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
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
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
          {selected.name ?? selected.slug}
          {selected.category ? ` · ${selected.category}` : ""}
        </p>
      )}
      <label className="mt-4 block text-sm text-gray-800 dark:text-zinc-200">
        Query string
        <input
          className="mt-1 w-full rounded border border-gray-200 bg-white/60 p-2 font-mono text-xs text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          value={qs}
          onChange={(e) => setQs(e.target.value)}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !slug}
          onClick={callUnpaid}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          GET (no payment) — always 402
        </button>
        <button
          type="button"
          disabled={busy || !config}
          onClick={connect}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {address ? "Reconnect wallet" : "Connect wallet"}
        </button>
        <button
          type="button"
          disabled={busy || !address || !slug}
          onClick={callPaid}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Pay &amp; GET
        </button>
      </div>
      {address && (
        <p className="mt-2 font-mono text-xs text-gray-500 dark:text-zinc-500">
          Payer: {address.slice(0, 6)}…{address.slice(-4)}
        </p>
      )}
      {paidActivity && (
        <div
          className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-800 shadow-lg shadow-emerald-950/10 dark:text-emerald-200"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-ping rounded-full bg-emerald-400" />
            <div>
              <p className="font-medium">Payment in progress</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{paidActivity}</p>
            </div>
          </div>
        </div>
      )}
      {failure && (
        <div
          className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <p className="font-semibold">Something didn&apos;t work</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs text-red-900 dark:text-red-100">
            {failure}
          </pre>
        </div>
      )}
      <pre className="mt-6 overflow-auto rounded border border-gray-200 bg-gray-50/80 p-4 text-xs whitespace-pre-wrap text-gray-800 dark:border-zinc-800 dark:bg-black/40 dark:text-zinc-200">
        {out}
      </pre>
      {slug === "kronos-forecast" && (
        <p className="mt-4 text-xs text-gray-500 dark:text-zinc-500">
          <strong className="text-gray-700 dark:text-zinc-400">Research only.</strong> Kronos outputs are not financial
          advice or trading signals.{" "}
          <a className="text-emerald-600 underline dark:text-emerald-400" href="/disclaimer">
            Full disclaimer →
          </a>
        </p>
      )}
      <p className="mt-8 text-xs text-gray-400 dark:text-zinc-600">
        <a className="underline hover:text-gray-600 dark:hover:text-zinc-400" href="/terms">
          Terms
        </a>
        {" · "}
        <a className="underline hover:text-gray-600 dark:hover:text-zinc-400" href="/privacy">
          Privacy
        </a>
        {" · "}
        <a className="underline hover:text-gray-600 dark:hover:text-zinc-400" href="/disclaimer">
          Research Disclaimer
        </a>
      </p>
    </main>
  );
}
