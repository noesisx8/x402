# x402-trust ops checklist & endpoint map

**As of:** 2026-07-17  
**Production:** https://vending-machine-seven.vercel.app  
**Pay-to:** `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697` (Base / `eip155:8453`)  
**Trust site:** https://x402.fuchss.app  

Host rules: paid USDC calls and funded wallets run only on **portalv2** (or Railway secrets). Never on **pikatop**. See `docs/HOSTS.md`.

---

## What x402-trust is

[x402.fuchss.app](https://x402.fuchss.app) (**x402-trust**) is a **24/7 reputation layer** for the x402 ecosystem. It probes listed endpoints, tracks price / `payTo` history, and scores **real on-chain USDC settlement** so agents can avoid dead, hijacked, or ghost endpoints before they pay.

| Index style | Example | What it optimizes for |
|-------------|---------|------------------------|
| Volume / market | x402scan, Messari-style | Activity, listings |
| **Trust / reliability** | **fuchss x402-trust** | Uptime, envelope compliance, economic proof |

Our own discovery path (Bazaar, Agentic.Market) is in `docs/DISTRIBUTION.md`. This doc is specifically for **trust grades**.

### Free surfaces

| Surface | URL / command |
|---------|----------------|
| Site (agents section) | https://x402.fuchss.app/#agents |
| Ecosystem stats | `GET https://x402.fuchss.app/trust/stats` |
| Top-25 leaderboard | `GET https://x402.fuchss.app/trust/leaderboard` |
| Per-endpoint free page | `https://x402.fuchss.app/endpoint/{id}` |
| Free trust preview (sample A/mid/F) | `GET https://x402.fuchss.app/v1/x402-trust-preview` |
| MCP | `npx -y x402-trust-mcp` · manifest https://x402.fuchss.app/mcp.json |

### Paid surfaces (USDC over x402)

| Endpoint | Price | Use |
|----------|------:|-----|
| `POST /v1/x402-trust` | $0.005 | Full score breakdown for one URL |
| `POST /v1/x402-history` | $0.02 | Observation time-series (up to 90d) |
| `POST /v1/similar` | $0.005 | Higher-scoring alternatives |
| `POST /v1/watch-endpoint-30d` | ~$0.20 | Alerts on payTo / price / spec / delist |
| Bulk tiers | $0.045–$0.50 | Score many endpoints at once |

---

## Scoring model

From `GET /trust/leaderboard` methodology:

```
score = 0.45 × technical-reliability
      + 0.30 × spec-compliance
      + 0.25 × economic-reputation
```

- **Technical** = 0.45 uptime + 0.40 observed-age + 0.15 latency  
  Latency is measured from a **single EU vantage** (includes RTT). Effective latency weight ≈ **6.75%** of the final score.
- **Spec** = 402-envelope validity + x402 version support.
- **Economic** = on-chain settlement activity + price stability + payer diversity.  
  Settlements resolve to the **`payTo` wallet**, not path — multi-route hubs share one wallet and may get a `shared-payto-wallet` flag (softened when payer diversity is strong).

**Grade bands**

| Grade | Score |
|:-----:|------:|
| A | ≥ 80 |
| B | ≥ 65 |
| C | ≥ 50 |
| D | ≥ 35 |
| F | ≥ 0 |

**A-grade leaders** (Bitrefill etc.) sit ~88–90 with dense probes and strong economic signal. A free preview “best” sample (~84 A) had 100% uptime, full compliance, and **hundreds of settlements / 100+ distinct payers**.

---

## Coverage snapshot (2026-07-17)

| Layer | Count | Notes |
|-------|------:|-------|
| Registry (`apps/vending-machine/lib/services/registry.ts`) | **19** | All enabled |
| Live unpaid 402 on Vercel | **19 / 19** | Spec-shaped v2 envelopes |
| CDP Bazaar (payTo) | **18** | Missing only `bundle-outbound` |
| x402-trust (fuchss) listed | **12** | All **B**, scores **68.5–69.8** |

### Why we are B (~69), not A (≥80)

| Factor | Our read | Impact |
|--------|----------|--------|
| Spec compliance | v2 `Payment-Required` + non-empty `accepts` + bazaar extension; empty JSON body is fine for header-carried v2 | Likely strong |
| Uptime | Most routes 98–99.6% | Good; soft spots: `fx-rate`, `tls-cert` |
| Latency | ~0.9–1.3 s from EU → Vercel `iad1` | Low weight |
| Observed age | Newer listings | Docks technical score until history builds |
| **Economic reputation** | Bazaar quality ≈ **1 unique payer**, **1–3 calls / route** (ops smokes) | **Main drag** (25% of score) |

---

## Full endpoint map

Base resource URL: `https://vending-machine-seven.vercel.app/api/v/{slug}`

### On fuchss (12) — all grade B

| Slug | Price | Grade | Score | Uptime 30d | Latency (EU) | Trust page |
|------|------:|:-----:|------:|-----------:|-------------:|------------|
| weather | $0.003 | B | 69.8 | 99.6% | ~910 ms | [77195](https://x402.fuchss.app/endpoint/77195) |
| crypto-prices | $0.005 | B | 69.7 | 99.6% | ~936 ms | [77184](https://x402.fuchss.app/endpoint/77184) |
| qr-code | $0.002 | B | 69.7 | 99.6% | ~961 ms | [77194](https://x402.fuchss.app/endpoint/77194) |
| dns-resolve | $0.003 | B | 69.4 | 99.2% | ~1008 ms | [77201](https://x402.fuchss.app/endpoint/77201) |
| bundle-infra | $0.01 | B | 69.4 | 98.8% | ~936 ms | [77197](https://x402.fuchss.app/endpoint/77197) |
| redirect-trace | $0.003 | B | 69.2 | 99.6% | ~1321 ms | [77182](https://x402.fuchss.app/endpoint/77182) |
| http-head | $0.002 | B | 69.1 | 98.8% | ~1151 ms | [77183](https://x402.fuchss.app/endpoint/77183) |
| ip-lookup | $0.003 | B | 69.1 | 98.3% | ~1005 ms | [77204](https://x402.fuchss.app/endpoint/77204) |
| email-validate | $0.004 | B | 69.0 | 98.8% | ~1166 ms | [77193](https://x402.fuchss.app/endpoint/77193) |
| whois-lite | $0.008 | B | 68.9 | 98.3% | ~1163 ms | [77200](https://x402.fuchss.app/endpoint/77200) |
| tls-cert | $0.004 | B | 68.9 | 97.9% | ~997 ms | [77202](https://x402.fuchss.app/endpoint/77202) |
| fx-rate | $0.003 | B | 68.5 | 97.1% | ~1061 ms | [77203](https://x402.fuchss.app/endpoint/77203) |

### Not on fuchss yet (7)

All return live **HTTP 402**. Six are already in **CDP Bazaar** (settled 2026-07-17) — expect crawl lag. One has never been settled.

| Slug | Price | Live 402 | CDP Bazaar | Last settle (Bazaar) | fuchss | Action |
|------|------:|:--------:|:----------:|----------------------|:------:|--------|
| dns-records | $0.004 | yes | yes | 2026-07-17 | missing | Wait / recheck crawl |
| http-get | $0.004 | yes | yes | 2026-07-17 | missing | Wait / recheck crawl |
| fetch-text | $0.005 | yes | yes | 2026-07-17 | missing | Wait / recheck crawl |
| base-balance | $0.003 | yes | yes | 2026-07-17 | missing | Wait / recheck crawl |
| domain-intel | $0.015 | yes | yes | 2026-07-17 | missing | Wait / recheck crawl |
| kronos-forecast | $0.05 | yes | yes | 2026-07-17 | missing | Wait / recheck crawl |
| **bundle-outbound** | $0.01 | yes | **no** | never | missing | **Seed settle on portalv2** |

### Registry-only completeness (all 19)

| Slug | Category | Price | Bazaar | fuchss |
|------|----------|------:|:------:|:------:|
| email-validate | atom | $0.004 | yes | B 69.0 |
| ip-lookup | atom | $0.003 | yes | B 69.1 |
| weather | atom | $0.003 | yes | B 69.8 |
| crypto-prices | atom | $0.005 | yes | B 69.7 |
| qr-code | atom | $0.002 | yes | B 69.7 |
| dns-resolve | atom | $0.003 | yes | B 69.4 |
| http-head | atom | $0.002 | yes | B 69.1 |
| bundle-infra | bundle | $0.01 | yes | B 69.4 |
| bundle-outbound | bundle | $0.01 | **no** | — |
| tls-cert | atom | $0.004 | yes | B 68.9 |
| whois-lite | atom | $0.008 | yes | B 68.9 |
| fx-rate | atom | $0.003 | yes | B 68.5 |
| redirect-trace | atom | $0.003 | yes | B 69.2 |
| dns-records | atom | $0.004 | yes | — |
| http-get | atom | $0.004 | yes | — |
| fetch-text | atom | $0.005 | yes | — |
| base-balance | atom | $0.003 | yes | — |
| domain-intel | bundle | $0.015 | yes | — |
| kronos-forecast | premium | $0.05 | yes | — |

---

## Manual curl commands (ops)

Use these before writing any automation script. Prefer `curl.exe` on Windows.

### 1) Free liveness + unpaid 402 (any host)

```bash
# Free health
curl -sS "https://vending-machine-seven.vercel.app/api/health"

# Unpaid 402 — expect status 402 + Payment-Required header (base64 JSON)
curl -sS -D - -o /dev/null \
  "https://vending-machine-seven.vercel.app/api/v/weather?city=Berlin"
```

Decode the envelope (PowerShell):

```powershell
$raw = curl.exe -sS -D - -o NUL "https://vending-machine-seven.vercel.app/api/v/weather?city=Berlin"
if ($raw -match 'Payment-Required:\s*(\S+)') {
  [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($matches[1]))
}
```

Sanity checks on the decoded JSON:

- `x402Version` is `2`
- `accepts` is non-empty
- `accepts[0].network` is `eip155:8453`
- `accepts[0].payTo` is our pay-to
- `extensions.bazaar.routeTemplate` is `/api/v/{slug}` (not `:var1`)

### 2) Probe every slug unpaid (expect 402)

```bash
BASE="https://vending-machine-seven.vercel.app/api/v"

curl -sS -o /dev/null -w "%{http_code} email-validate\n"     "$BASE/email-validate?email=test@gmail.com"
curl -sS -o /dev/null -w "%{http_code} ip-lookup\n"          "$BASE/ip-lookup?ip=8.8.8.8"
curl -sS -o /dev/null -w "%{http_code} weather\n"            "$BASE/weather?city=Berlin"
curl -sS -o /dev/null -w "%{http_code} crypto-prices\n"      "$BASE/crypto-prices?ids=bitcoin"
curl -sS -o /dev/null -w "%{http_code} qr-code\n"            "$BASE/qr-code?data=test"
curl -sS -o /dev/null -w "%{http_code} dns-resolve\n"        "$BASE/dns-resolve?host=example.com"
curl -sS -o /dev/null -w "%{http_code} http-head\n"          "$BASE/http-head?url=https://example.com"
curl -sS -o /dev/null -w "%{http_code} bundle-infra\n"       "$BASE/bundle-infra?host=example.com"
curl -sS -o /dev/null -w "%{http_code} bundle-outbound\n"    "$BASE/bundle-outbound?email=test@gmail.com&ip=8.8.8.8&url=https://example.com"
curl -sS -o /dev/null -w "%{http_code} tls-cert\n"           "$BASE/tls-cert?host=example.com"
curl -sS -o /dev/null -w "%{http_code} whois-lite\n"         "$BASE/whois-lite?domain=example.com"
curl -sS -o /dev/null -w "%{http_code} fx-rate\n"            "$BASE/fx-rate?base=USD&symbols=EUR"
curl -sS -o /dev/null -w "%{http_code} redirect-trace\n"     "$BASE/redirect-trace?url=https://httpbin.org/redirect/1"
curl -sS -o /dev/null -w "%{http_code} dns-records\n"        "$BASE/dns-records?host=example.com"
curl -sS -o /dev/null -w "%{http_code} http-get\n"           "$BASE/http-get?url=https://httpbin.org/json"
curl -sS -o /dev/null -w "%{http_code} fetch-text\n"         "$BASE/fetch-text?url=https://example.com"
curl -sS -o /dev/null -w "%{http_code} base-balance\n"       "$BASE/base-balance?address=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697"
curl -sS -o /dev/null -w "%{http_code} domain-intel\n"       "$BASE/domain-intel?host=example.com"
curl -sS -o /dev/null -w "%{http_code} kronos-forecast\n"    "$BASE/kronos-forecast?symbol=BTCUSDT"
```

### 3) CDP Bazaar — how many resources are indexed?

```bash
curl -sS "https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697"
curl -sS "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=vending-machine-seven&network=eip155:8453"
curl -sS "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?payTo=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697"
```

Expect **≥18** resources; target **19** after `bundle-outbound` is seed-settled.

### 4) Free fuchss stats + leaderboard

```bash
curl -sS "https://x402.fuchss.app/trust/stats"
curl -sS "https://x402.fuchss.app/trust/leaderboard"
curl -sS "https://x402.fuchss.app/v1/x402-trust-preview"
```

### 5) Free fuchss per-endpoint snapshot (no pay)

Free pages embed JSON-LD with `trust_score`, `grade`, `uptime_pct_30d`, `avg_latency_ms`. Example for weather:

```bash
curl -sS "https://x402.fuchss.app/endpoint/77195" | findstr /i "trust_score grade uptime"
# or on Unix:
# curl -sS "https://x402.fuchss.app/endpoint/77195" | rg -o '"name":"(trust_score|grade|uptime_pct_30d|avg_latency_ms)","value":[^,}]+'
```

PowerShell extract:

```powershell
$html = (Invoke-WebRequest -Uri "https://x402.fuchss.app/endpoint/77195" -UseBasicParsing).Content
[regex]::Match($html, '"name":"trust_score","value":([\d.]+)').Groups[1].Value
[regex]::Match($html, '"name":"grade","value":"([^"]+)"').Groups[1].Value
[regex]::Match($html, '"name":"uptime_pct_30d","value":([\d.]+)').Groups[1].Value
```

### 6) Paid trust report — **portalv2 only** ($0.005)

Do **not** run funded payers on pikatop. On portalv2, after a wallet / ops key is available:

1. Request without payment → capture 402 requirements from fuchss.
2. Pay via your usual x402 client (`smoke:paid` pattern, `/test` wallet, or ops script).
3. Or, once an ops key exists, call the paid route with the same client stack as vending smokes.

Paid route shape (subject to fuchss API; body may accept `url` / `resource`):

```http
POST https://x402.fuchss.app/v1/x402-trust
Content-Type: application/json

{"url":"https://vending-machine-seven.vercel.app/api/v/weather"}
```

First response is typically **402** with payment requirements; retry with `PAYMENT-SIGNATURE` (x402 v2) after signing.

Use the paid report when free JSON-LD is not enough (flags, activity subscore, recommendations). Prefer one representative URL (`weather` or `crypto-prices`) before bulk.

### 7) Local discovery (agents)

```bash
curl -sS "https://vending-machine-seven.vercel.app/.well-known/agent-services.json"
curl -sS "https://vending-machine-seven.vercel.app/.well-known/x402"
curl -sS "https://vending-machine-seven.vercel.app/api/openapi.json"
```

---

## Ops checklist

### After every deploy

- [ ] Unpaid 402 probe of at least one changed route (status 402 + `Payment-Required`).
- [ ] Decode envelope: v2, `accepts` non-empty, correct `payTo` / network, bazaar `routeTemplate`.
- [ ] On **portalv2**: seed paid settle for **new or changed** routes (browser `/test` or paid smoke).
- [ ] Wait ≤10 minutes; run `cd apps/vending-machine && npm run smoke:bazaar`.
- [ ] Confirm merchant discovery count did not drop.

### Daily (optional, light)

- [ ] `GET /api/health` → 200, `network_mode=base`.
- [ ] Unpaid 402 on 1–2 hot routes (`weather`, `qr-code`).

### Weekly

- [ ] Re-read free fuchss grades for the 12 listed endpoints (JSON-LD or meta).
- [ ] Note min grade / min uptime; flag anything &lt; B or uptime &lt; 97%.
- [ ] CDP merchant discovery: resource count **≥ 18** (target 19).
- [ ] Check whether the “missing 7” have appeared on fuchss (search site or re-scan known ID neighborhood).
- [ ] Soft uptime watchlist: `fx-rate`, `tls-cert`.

### Monthly

- [ ] **Bazaar 30-day rule:** at least one successful settle per important route (or accept delist risk).
- [ ] Seed settle any still-unsettled slug (`bundle-outbound` first).
- [ ] Optional: buy **one** `$0.005` paid trust report for a flagship URL; archive breakdown in notes.
- [ ] Compare cluster average score vs A threshold (80); update this doc’s snapshot table if numbers moved.
- [ ] Ecosystem glance: `GET /trust/stats` (reachable %, volume).

### Path to A (ordered levers)

1. **Real distinct payers + settlements** (economic) — distribution, agent discovery, organic use. Ops self-smokes alone will not get us to A.
2. **Hold ≥99.5% probe uptime** — reduce cold-start / upstream flakes on soft routes.
3. **Age** — accrues automatically with continuous probes; no action except stay listed.
4. **Latency** — last priority (low weight); EU→US RTT is expected.

---

## Gaps & immediate actions

| Priority | Item | Owner host | Notes |
|----------|------|------------|-------|
| P0 | Seed settle **`bundle-outbound`** | portalv2 | Query: `email=test@gmail.com&ip=8.8.8.8&url=https://example.com` · $0.01 |
| P1 | Recheck fuchss for the 6 Bazaar-settled-but-unlisted routes | any | Crawl lag after 2026-07-17 settles |
| P2 | Paid `$0.005` trust report on `weather` or `crypto-prices` | portalv2 | Full breakdown + flags |
| P3 | Optional ops wallet for agent-run trust calls | portalv2 | See below |

### Seed settle cheat sheet (portalv2 `/test` or paid client)

| Route | Example query | Price |
|-------|---------------|------:|
| bundle-outbound | `email=test@gmail.com&ip=8.8.8.8&url=https://example.com` | $0.01 |
| dns-records | `host=example.com` | $0.004 |
| http-get | `url=https://httpbin.org/json` | $0.004 |
| fetch-text | `url=https://example.com` | $0.005 |
| base-balance | `address=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697` | $0.003 |
| domain-intel | `host=example.com` | $0.015 |
| kronos-forecast | `symbol=BTCUSDT&interval=1h` | $0.05 |

Also listed in `docs/DISTRIBUTION.md`.

---

## Future: ops wallet for agent-run x402 calls

When you want agents (or scripts) to buy trust reports without you clicking `/test`:

| Rule | Detail |
|------|--------|
| Host | **portalv2 only** (or Railway secret store) — never pikatop |
| Env name | e.g. `X402_OPS_PRIVATE_KEY` (separate from receiver; **payer** key) |
| Funding | Small Base USDC float (e.g. $5–20) + gas ETH on Base |
| Allowed spends | fuchss trust APIs, seed settles, smoke scripts |
| Caps | Document max per call and daily max in host notes; never commit the key |
| Client | Reuse vending `smoke:paid` / `@x402` client patterns against `https://x402.fuchss.app/v1/x402-trust` |

Do **not** create or fund this wallet until you explicitly ask; this section is the plan only.

---

## Related docs

| Doc | Role |
|-----|------|
| `docs/DISTRIBUTION.md` | Bazaar seed settles, Agentic.Market |
| `docs/HOSTS.md` | portalv2 vs pikatop rules |
| `docs/ROADMAP_ULTIMATE_VENDING_HUB.md` | Phase 3 ecosystem visibility |
| `docs/PHASE0_STATUS.md` | Live production verification |
| `docs/CDP_X402_FAQ_REFERENCE.md` | Facilitator / protocol FAQ |
| `docs/SECURITY.md` | Payment binding, caps, secrets |

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | Initial map: 19 registry, 18 Bazaar, 12 fuchss (all B ~69); manual curl playbook; path to A |
