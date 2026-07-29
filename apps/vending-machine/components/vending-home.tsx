"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Address } from "viem";
import { CATALOG, FAQS, type CatalogCategory, type CatalogTool } from "@/lib/catalog";
import { connectBrowserWallet, paidGet, type ClientNetworkConfig } from "@/lib/x402/paid-fetch-client";

type Props = {
  baseUrl: string;
  contractAddress: string;
  network: string;
};

type SortKey = "name" | "price";

const short = (v: string) => (v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);
const fmt = (n: number) => `$${n.toFixed(n >= 0.01 ? 2 : 3)}`;
function curlFor(baseUrl: string, tool: CatalogTool) {
  const value = tool.endpoint.includes("=") ? "<value>" : "";
  return `curl -X GET "${baseUrl}${tool.endpoint}${value}" \\\n  -H "X-Payment-Proof: <settlement-token>"`;
}

function displayUrl(baseUrl: string, endpoint: string) {
  return `${baseUrl}${endpoint}${endpoint.includes("=") ? "…" : ""}`;
}

export function VendingHome({ baseUrl, contractAddress, network }: Props) {
  const [cat, setCat] = useState<CatalogCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [address, setAddress] = useState<Address | null>(null);
  const [config, setConfig] = useState<ClientNetworkConfig | null>(null);
  const [busyPay, setBusyPay] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<Record<string, "curl" | null>>({});
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [openFaq, setOpenFaq] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const copyText = useCallback((text: string, label: string) => {
    const done = () => showToast(`✓ ${label} copied`);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      });
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    done();
  }, [showToast]);

  useEffect(() => {
    fetch("/api/config/client", { cache: "no-store" })
      .then((r) => r.json() as Promise<ClientNetworkConfig>)
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  const connect = useCallback(async () => {
    if (address) {
      setAddress(null);
      showToast("Wallet disconnected");
      return;
    }
    if (!config) {
      showToast("Wallet config is still loading");
      return;
    }
    try {
      const next = await connectBrowserWallet(config);
      setAddress(next);
      showToast("✓ Wallet connected — USDC on Base");
    } catch (e) {
      showToast(String(e).slice(0, 120));
    }
  }, [address, config, showToast]);

  const pay = useCallback(async (tool: CatalogTool) => {
    if (!config) return showToast("Wallet config is still loading");
    let payer = address;
    if (!payer) {
      try {
        payer = await connectBrowserWallet(config);
        setAddress(payer);
      } catch (e) {
        showToast(String(e).slice(0, 120));
        return;
      }
    }
    setBusyPay(tool.id);
    try {
      const url = `${baseUrl}${tool.endpoint}${tool.endpoint.includes("=") ? "demo" : ""}`;
      const res = await paidGet(url, payer, config);
      showToast(res.ok ? `✓ ${tool.name} settled` : `HTTP ${res.status} returned`);
    } catch (e) {
      showToast(String(e).slice(0, 120));
    } finally {
      setBusyPay(null);
    }
  }, [address, baseUrl, config, showToast]);

  const q = query.trim().toLowerCase();
  const match = (tool: CatalogTool) => `${tool.name} ${tool.id} ${tool.desc}`.toLowerCase().includes(q);
  const bundles = CATALOG.bundles.filter(match);
  const premium = CATALOG.premium.filter(match);
  const utilities = useMemo(() => {
    const list = CATALOG.utilities.filter(match);
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      return (typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv)) * sort.dir;
    });
  }, [q, sort]);
  const empty =
    (cat === "all" && bundles.length === 0 && premium.length === 0 && utilities.length === 0) ||
    (cat === "bundle" && bundles.length === 0) ||
    (cat === "premium" && premium.length === 0) ||
    (cat === "utility" && utilities.length === 0);

  const sortBy = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const arr = (key: SortKey) => (sort?.key === key ? (sort.dir === 1 ? "↑" : "↓") : "");
  const explorerBase = network === "eip155:84532" ? "https://sepolia.basescan.org" : "https://basescan.org";

  return (
    <>
      <div className="bg-grid" />
      <div className="glow" />
      <header>
        <div className="wrap hd">
          <a className="logo" href="#top" aria-label="x402 Vending home"><span className="logo-box">▣</span>x402&nbsp;Vending</a>
          <span className="net-pill"><span className="dot" />Base · {network}</span>
          <nav>
            <a href="#tools">Tools</a><a href="#how">How it works</a><a href="#proof">On-chain proof</a><a href="#faq">FAQ</a>
          </nav>
          <button className={`wallet-btn ${address ? "connected" : ""}`} onClick={connect} type="button" aria-label={address ? "Disconnect wallet" : "Connect wallet"}>{address ? `● ${short(address)}` : "Connect wallet"}</button>
        </div>
      </header>

      <div className="ticker-wrap"><div className="ticker"><span className="live-tag"><span className="dot" />TESTNET READY</span><div className="ticker-track"><div className="tick"><span className="ck">✓</span><span>Real-time settlement feed not connected yet</span><span className="tm"> · waiting for live source</span></div></div></div></div>

      <main id="top">
        <section className="hero wrap">
          <div className="eyebrow">x402 micropayments · settled on Base</div>
          <h1>Agent-grade APIs.<br />One USDC payment. <span className="g">Live settlement.</span></h1>
          <p>19 pay-per-call endpoints for agents and developers. No accounts, no API keys, no subscriptions — your wallet signature is the auth. Failed calls never settle.</p>
          <div className="cta-row"><a className="btn btn-pri" href="#tools">Browse 19 tools ↓</a><a className="btn btn-sec" href="/api/openapi.json">OpenAPI spec ↗</a><a className="btn btn-sec" href="https://github.com/noesisx8/x402">GitHub ↗</a></div>
          <div className="trust-row"><span className="trust-pill">contract <b>{short(contractAddress)}</b> <button onClick={() => copyText(contractAddress, "Contract address")} type="button">copy</button></span><span className="trust-pill"><a href={`${explorerBase}/address/${contractAddress}`}>View on Basescan ↗</a></span><span className="trust-pill"><span className="dot" />settlement guard active</span></div>
        </section>

        <section className="how wrap" id="how"><div className="sec-label">How it works</div><h2>Pay → prove → call. Three steps on testnet.</h2><div className="steps">
          <Step n="1" h="Request an endpoint" p="Hit any tool URL. If unpaid, the server responds 402 Payment Required with the exact USDC price and payment route." />
          <Step n="2" h="Sign with your wallet" p="Your wallet (or agent) signs a USDC transfer on the configured Base network. No account creation, no API key management, no custody." />
          <Step n="3" h="Retry with proof" p="Resend the request with the X-Payment-Proof header. Settlement verifies on-chain and data returns instantly." />
        </div><div className="term"><div className="term-bar"><span className="red" /><span className="amber" /><span className="green" /><span className="term-title">x402 handshake — dns-resolve</span></div><pre className="term-body"><span className="c1">GET /v1/dns-resolve?domain=base.org</span> <span className="cm">→</span> <span className="c2">402 Payment Required</span> <span className="cm">{"{ price: \"$0.004\", payTo: \""}{short(contractAddress)}{"\" }"}</span>{"\n"}<span className="c3">wallet signs USDC transfer</span> <span className="cm">→</span> <span className="c2">testnet settlement</span> <span className="cm">live timing pending</span>{"\n"}<span className="c1">GET + X-Payment-Proof: &lt;live proof&gt;</span> <span className="cm">→</span> <span className="c3">200 OK</span> <span className="cm">{"{ \"A\": [\"145.239.12.9\"], … }"}</span></pre></div></section>

        <section className="stats"><div className="stats-grid"><Stat v="—" l="testnet calls settled" /><Stat v="19" l="configured endpoints" /><Stat v="—" l="live uptime" /><Stat v="—" l="avg settlement" /></div></section>

        <section className="tools wrap" id="tools"><div className="sec-label">Catalog</div><h2>Tools &amp; bundles</h2><div className="controls"><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search tools… (try 'dns' or 'price')" /></label>{(["all", "bundle", "premium", "utility"] as const).map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)} type="button">{c === "all" ? "All" : c === "bundle" ? "Bundles" : c === "premium" ? "Premium" : "Utilities"}</button>)}</div><div className="legend">ⓘ All endpoints are <code>GET</code> · paid via <code>x402</code> · priced in <code>USDC on Base</code> — shown once here instead of on every card.</div>
          {empty && <div className="empty-state">No tools match your search.</div>}
          {(cat === "all" || cat === "bundle") && bundles.length > 0 && <ToolGroup title="Bundles — pay once, call many" tools={bundles} baseUrl={baseUrl} openCard={openCard} setOpenCard={setOpenCard} copyText={copyText} pay={pay} busyPay={busyPay} />}
          {(cat === "all" || cat === "premium") && premium.length > 0 && <ToolGroup title="Premium" tools={premium} baseUrl={baseUrl} openCard={openCard} setOpenCard={setOpenCard} copyText={copyText} pay={pay} busyPay={busyPay} />}
          {(cat === "all" || cat === "utility") && utilities.length > 0 && <div><div className="group-label">Utility atoms — click a row for curl</div><div className="tbl-wrap"><div className="tbl-scroll"><table><thead><tr><th onClick={() => sortBy("name")}>Tool <span className="arr">{arr("name")}</span></th><th>Params</th><th onClick={() => sortBy("price")}>Price <span className="arr">{arr("price")}</span></th><th /></tr></thead><tbody>{utilities.map((t) => <UtilityRow key={t.id} tool={t} baseUrl={baseUrl} open={openRow === t.id} setOpenRow={setOpenRow} copyText={copyText} />)}</tbody></table></div></div></div>}
        </section>

        <section className="proof wrap" id="proof"><div className="sec-label">Trust</div><h2>On-chain proof, not promises</h2><div className="proof-grid"><div className="proof-card"><h3>Settlement contract</h3><div className="contract"><span>{short(contractAddress)}</span><button className="mini-btn" onClick={() => copyText(contractAddress, "Contract address")} type="button">copy</button></div><Info label="Network" value={network} /><Info label="Currency" value="USDC" /><Info label="Failed calls" value="never settle" ok /><div className="settle-row"><span>Source</span><a href="https://github.com/noesisx8/x402">github ↗</a></div></div><div className="proof-card"><h3>Recent settlements</h3><div className="settle-row"><span>Feed status</span><b>ready for real-time testnet data</b></div><p className="desc">No settlement rows are rendered until a live stats source is connected.</p></div></div></section>

        <section className="faq wrap" id="faq"><div className="sec-label">FAQ</div><h2>Questions, answered</h2>{FAQS.map(([question, answer], i) => <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={question}><button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} type="button">{question}<span className="chev">▶</span></button><div className="faq-a" style={{ maxHeight: openFaq === i ? 180 : 0 }}><div>{answer}</div></div></div>)}</section>
      </main>

      <footer><div className="wrap"><div className="ft"><a className="logo" href="#top"><span className="logo-box">▣</span>x402 Vending</a><div className="ft-links"><a href="/terms">Terms</a><a href="/terms#acceptable-use">Acceptable use</a><a href="/api/openapi.json">OpenAPI</a><a href="/api/health">Status</a></div></div><p className="disclaimer">Kronos Forecast output is informational only and is not financial advice. On-chain settlements are final once confirmed. Failed handlers close safely before settlement — you are never charged for a failed call.</p></div></footer>
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}

function Step({ n, h, p }: { n: string; h: string; p: string }) { return <div className="step"><div className="step-num">{n}</div><h3>{h}</h3><p>{p}</p></div>; }
function Stat({ v, l }: { v: string; l: string }) { return <div className="stat"><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div>; }
function Info({ label, value, ok }: { label: string; value: string; ok?: boolean }) { return <div className="settle-row"><span>{label}</span><b className={ok ? "up-ok" : ""}>{value}</b></div>; }

function ToolGroup(props: { title: string; tools: CatalogTool[]; baseUrl: string; openCard: Record<string, "curl" | null>; setOpenCard: Dispatch<SetStateAction<Record<string, "curl" | null>>>; copyText: (text: string, label: string) => void; pay: (tool: CatalogTool) => void; busyPay: string | null }) {
  return <div><div className="group-label">{props.title}</div><div className="cards">{props.tools.map((tool) => <ToolCard key={tool.id} {...props} tool={tool} />)}</div></div>;
}

function ToolCard({ tool, baseUrl, openCard, setOpenCard, copyText, pay, busyPay }: { tool: CatalogTool; baseUrl: string; openCard: Record<string, "curl" | null>; setOpenCard: Dispatch<SetStateAction<Record<string, "curl" | null>>>; copyText: (text: string, label: string) => void; pay: (tool: CatalogTool) => void; busyPay: string | null }) {
  const open = openCard[tool.id];
  const setOpen = (kind: "curl") => setOpenCard((s) => ({ ...s, [tool.id]: s[tool.id] === kind ? null : kind }));
  return <article className="card"><div className="card-top"><h3>{tool.name}</h3><span className={`price ${tool.cat}`}>{fmt(tool.price)}</span></div><p className="desc">{tool.desc}</p><div className="endpoint"><span>{displayUrl(baseUrl, tool.endpoint)}</span><button className="mini-btn" onClick={() => copyText(`${baseUrl}${tool.endpoint}`, "Endpoint URL")} type="button">copy</button></div><div className="health"><span>metrics <b>pending live feed</b></span></div><div className="card-actions"><button className="act pay" onClick={() => pay(tool)} type="button" disabled={busyPay === tool.id}>{busyPay === tool.id ? "Paying…" : `Pay ${fmt(tool.price)}`}</button><button className="act" onClick={() => setOpen("curl")} type="button">curl</button></div><Expander title="curl" open={open === "curl"} text={curlFor(baseUrl, tool)} copyText={copyText} label="curl command" /></article>;
}

function Expander({ title, open, text, copyText, label }: { title: string; open: boolean; text: string; copyText: (text: string, label: string) => void; label: string }) { return <div className={`expand ${open ? "open" : ""}`}><div className="ex-h"><span>{title}</span><button className="mini-btn" onClick={() => copyText(text, label)} type="button">copy</button></div><pre>{text}</pre></div>; }

function UtilityRow({ tool, baseUrl, open, setOpenRow, copyText }: { tool: CatalogTool; baseUrl: string; open: boolean; setOpenRow: (id: string | null) => void; copyText: (text: string, label: string) => void }) {
  const curl = curlFor(baseUrl, tool);
  return <><tr className={`row ${open ? "open" : ""}`} onClick={() => setOpenRow(open ? null : tool.id)}><td><span className="t-name"><span className="chev">▶</span>{tool.name}</span></td><td>{tool.params}</td><td><span className="price utility">{fmt(tool.price)}</span></td><td><button className="mini-btn" onClick={(e) => { e.stopPropagation(); copyText(curl, "curl command"); }} type="button">copy curl</button></td></tr>{open && <tr className="detail"><td colSpan={4}><div className="detail-grid"><div><div className="ex-h"><span>curl</span><button className="mini-btn" onClick={() => copyText(curl, "curl command")} type="button">copy</button></div><pre>{curl}</pre></div></div><div className="detail-desc">{tool.desc}</div></td></tr>}</>;
}
