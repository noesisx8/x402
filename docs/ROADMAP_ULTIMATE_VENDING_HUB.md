# Roadmap: Ultimate x402 Vending Machine Hub (Base Mainnet)

**North star:** One discoverable, agent-native **pay-per-call utility hub** on **Base mainnet USDC**, listed in the x402 ecosystem, with **>50% margin** after facilitator + upstream costs, and **real money** landing at your pay-to wallet.

**Production anchor (today):**

| Item | Value |
|------|--------|
| App | https://vending-machine-seven.vercel.app |
| Network | `base` → `eip155:8453` |
| Pay-to | `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697` |
| Facilitator | CDP `https://api.cdp.coinbase.com/platform/v2/x402` + JWT auth (wired) |
| Catalog | 12 slugs — see `docs/OFFICIAL_CATALOG.md` (live data only) |

---

## Phase 0 — Production truth (do first)

**Goal:** Every unpaid call → **402**; every valid paid call → **settle → 200**; no silent failures.

| # | Task | Owner | Status | Done when |
|---|------|--------|--------|-----------|
| 0.1 | Confirm Vercel **Production** env: `X402_NETWORK_MODE=base`, pay-to, CDP keys, `PUBLIC_BASE_URL` | Ops | **Done** (live: `base`, pay-to `0xc648…`, CDP JWT) | Redeploy after any env change |
| 0.2 | **Paid E2E smoke** on mainnet: wallet with **Base USDC** → paid GET → **200** + JSON | You | **Done** (2026-07-09): browser `/test` → `crypto-prices` → 200 + settlement header | Tx / settlement header present; pay-to receives USDC |
| 0.3 | **`/test` paid flow** (wallet + `@x402/fetch`) | Dev | **Done** | Button: Pay & GET → 200 |
| 0.4 | **Idempotency:** document retry behavior; no settle on handler ≥400 | Dev | **Done** (`docs/SECURITY.md` + `scripts/phase0-unit.mjs`) | Note + unit contract |
| 0.5 | **Caps** + unpaid **rate limit** | Dev | **Done** (`lib/pricing.ts`, `lib/rate-limit.ts`) | Abuse can’t drain facilitator quota |
| 0.6 | **Observability:** lifecycle logs + `/api/admin/stats` | Dev | **Done** (`lib/analytics.ts`; token-gated full log) | `scope:x402` JSON logs |

**Unpaid automation (no wallet):** `node apps/vending-machine/scripts/smoke-unpaid.mjs`

**Blockers if paid E2E fails:** wrong network in wallet, insufficient USDC, CDP key scopes, clock skew on JWT (rare).

---

## Phase 1 — “Real payments” operations

**Goal:** You treat this like a product, not a demo.

| # | Task | Notes |
|---|------|--------|
| 1.1 | **Treasury:** monitor pay-to on Base (USDC); optional separate hot wallet vs cold | Coinbase Wallet / portfolio view |
| 1.2 | **Facilitator billing:** CDP free tier (1k tx/mo) then ~$0.001/tx — model in spreadsheet | See `docs/MONETIZATION.md` |
| 1.3 | **Upstream cost map** per slug (geo API, CoinGecko, Open-Meteo) | Price floor ≥ **$0.002**; target **60%+ margin** |
| 1.4 | **Refund policy** (none for micropayments) + **status page** link on `/` | Reduces chargeback confusion |
| 1.5 | **Git + CI:** push `noesisx8/x402`, Vercel Git deploy, root `apps/vending-machine` | Auto-deploy on `master` |

---

## Phase 2 — Catalog: Tier-1 hub (demand-aligned)

**Goal:** Match what agents actually buy (see `docs/TOP_X402_SERVICES.md`).

**Shipped (Phase 2 hub — complete):**

| Slug | Price (USDC) | Upstream | Margin lever | Status |
|------|----------------|----------|----------------|--------|
| `dns-resolve` | $0.003 | DoH (Cloudflare) + system fallback | Cache TTL 60s | **Live** (paid E2E OK) |
| `http-head` | $0.002 | `fetch` HEAD (GET fallback) | Timeout 7s, SSRF guards | **Live** |
| `bundle-infra` | $0.01 | DNS + HEAD + TLS one 402 | **Agent bundle** | **Live** |
| `tls-cert` | $0.004 | TLS handshake peek | Solo cert route | **Live** (paid E2E OK) |
| `whois-lite` | $0.008 | RDAP (`rdap.org` bootstrap) | Lite fields only | **Live** (paid E2E OK) |

**Registry pattern (already in repo):** one object in `registry.ts` → auto route + discovery + OpenAPI.

**Quality bar per service:**

- Deterministic JSON schema documented in OpenAPI  
- Handler errors → **400** (no settle on failure — `withX402` guarantee)  
- Timeouts ≤ 8s (Vercel serverless)  
- No API keys in responses  

---

## Phase 3 — Ecosystem visibility (“active in the ecosystem”)

**Goal:** Agents and marketplaces **find** you without a direct link.

| # | Surface | Action |
|---|---------|--------|
| 3.1 | **Local discovery** (done) | `/.well-known/agent-services.json`, `/.well-known/x402`, `/api/openapi.json` |
| 3.2 | **CDP Bazaar** | `bazaarResourceServerExtension` + `declareDiscoveryExtension()` per route | **Coded** — index after post-deploy paid settle; see `docs/DISTRIBUTION.md` |
| 3.3 | **awesome-x402** | PR with one-line description + production URL | **PR #778** open |
| 3.4 | **Agentic.Market / Agent.market** | Appear via Bazaar settle traffic + discovery URLs | **Playbook in DISTRIBUTION.md** |
| 3.5 | **x402scan / Messari-style indexes** | Monitor; submit when forms exist | SEO for agents |
| 3.6 | **MCP server** | Expose top slugs as tools pointing at same URLs | Claude / Cursor agents |
| 3.7 | **Branding** | Name, logo, `description` on every route; consistent `PUBLIC_BASE_URL` in discovery | Trust |

**Discovery checklist (agents expect):**

```
GET /.well-known/agent-services.json   → services + prices
GET /.well-known/x402                  → protocol metadata
GET /api/openapi.json                  → machine-readable API
GET /api/health                        → free liveness
```

---

## Phase 4 — Agent & human UX

**Goal:** Zero-friction pay-per-call for bots **and** a credible landing for humans.

| # | Deliverable |
|---|-------------|
| 4.1 | **`@x402/client` smoke script** in `apps/vending-machine/scripts/paid-fetch.mjs` (run on portalv2/Railway only with funded wallet) |
| 4.2 | **Paid `/test` page** (wallet connect + auto 402 → sign → retry) |
| 4.3 | **Home page:** live catalog, example `curl`, link to OpenAPI, “for agents” section |
| 4.4 | **Optional paywall HTML** on browser 402 via `@x402/paywall` for non-API page routes |
| 4.5 | **Batch / agent credits** (later): prepaid balance or session token — Tier 3 |

---

## Phase 5 — Economics & defensibility

**Goal:** **50%+ margin** and pricing power.

| Lever | Implementation |
|-------|----------------|
| Bundles | Single price for multi-step (`bundle-infra`) |
| Caching | Redis / edge cache on idempotent reads (IP, crypto, DNS) |
| Dynamic pricing | Surge on WHOIS / heavy paths |
| Tiered SKUs | `crypto-prices` vs `crypto-prices-pro` (more ids) |
| Hybrid funnel | Free discovery + paid execution only |
| B2B resale | Your x402 in front of wholesale API (25–40% markup) |

**Metrics (extend `lib/analytics.ts` or PostHog):**

- `402_issued`, `payment_verified`, `settlement_confirmed`, `200_delivered`  
- Revenue per slug, conversion (402 → 200), unique payers  
- Agent ratio: `User-Agent` / custom `X-Agent-Id`  

---

## Phase 6 — Platform scale (beyond Vercel)

**Goal:** Volume, privacy, and sibling products without violating daily-driver rule.

| # | Item | Where |
|---|------|--------|
| 6.1 | **`apps/api`** Express API on **Railway** or **portalv2** | DNS/WHOIS heavy routes, long timeouts |
| 6.2 | **Facilitator proxy** `apps/facilitator-proxy` | Only if you need custom policies |
| 6.3 | **Batch settlement** | When > ~1k tx/day (x402 V2 extensions) |
| 6.4 | **portalv2** private admin + analytics DB | Tailscale; no public PII |
| 6.5 | **Docker** path on portalv2 | `DOCKER_BUILD=1` image already supported |

---

## Security & compliance (every phase)

From `AGENTS.md` + `docs/SECURITY.md`:

- Request binding / `requestHash` aligned with facilitator  
- Idempotent settlement keys for retries  
- Finality window before premium payload if high-risk data  
- Rate limits + max payment caps  
- **No private keys in repo** — CDP keys only in Vercel/host env  
- Log facilitator errors without leaking JWT or secrets  

---

## Suggested execution order (30 / 60 / 90 days)

### Days 1–7 (mainnet live)

1. Phase **0.2** — mainnet paid E2E on one slug  
2. Phase **0.3** — paid `/test` UI  
3. Phase **1.5** — GitHub + Vercel Git deploy  
4. Phase **3.3** — awesome-x402 PR  

### Days 8–30 (hub credibility)

5. Phase **2** — add `dns-resolve`, `http-head`, `bundle-infra`  
6. Phase **3.2** — CDP Bazaar extension  
7. Phase **4.3** — landing + OpenAPI polish  
8. Phase **0.6** — real analytics  

### Days 31–90 (ultimate hub)

9. Phase **3.4–3.6** — marketplaces + MCP  
10. Phase **5** — caching + bundles + pricing review  
11. Phase **6** — Railway for heavy routes; batch settlement if volume warrants  

---

## Definition of “ultimate hub” (exit criteria)

- [ ] **Base mainnet** only for production catalog  
- [ ] **10+** paid utilities with documented OpenAPI  
- [ ] **CDP Bazaar** (or equivalent) listing with your pay-to  
- [ ] **≥1 external marketplace** listing driving traffic  
- [ ] **Paid E2E** documented and repeatable  
- [ ] **Conversion + revenue** visible per slug weekly  
- [ ] **>50% gross margin** on top 5 slugs by volume  
- [ ] **MCP or agent SDK** one-liner for third-party integration  

---

## Quick commands

```bash
# Local build (vending)
cd apps/vending-machine && npm run build

# Deploy production (after env set)
cd apps/vending-machine && npx vercel@latest --prod --yes

# Unpaid smoke (expect 402)
curl -sI "https://vending-machine-seven.vercel.app/api/v/qr-code?data=test" | head -1
```

---

## References

- `docs/TOP_X402_SERVICES.md` — demand research  
- `docs/MONETIZATION.md` — unit economics  
- `docs/CDP_X402_FAQ_REFERENCE.md` — facilitator & networks  
- `docs/SETUP_NEW_GITHUB_VERCEL.md` — deploy accounts  
- CDP FAQ: https://docs.cdp.coinbase.com/x402/support/faq  

**Next single action:** Complete **Phase 0.2** (one real mainnet USDC payment → 200 on `qr-code`), then say **add paid test UI** or **add dns + bundle routes** and we implement the next slice.