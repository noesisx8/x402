# Distribution: CDP Bazaar + Agentic.Market / Agent.market

## What we wired (code)

| Piece | Location |
|-------|----------|
| `bazaarResourceServerExtension` | `apps/vending-machine/lib/x402/resource-server.ts` |
| `declareDiscoveryExtension()` per route | `lib/x402/bazaar.ts` + `serviceRouteConfig()` |
| Example query/output per slug | `lib/services/registry.ts` → `discovery` |
| Smoke | `npm run smoke:bazaar` |

Facilitator must remain CDP:

`X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402`

## How Bazaar listing works (no separate form)

1. Route returns **402** with **`extensions.bazaar`** (we emit this).
2. Buyer pays; CDP **verify → settle** succeeds.
3. CDP catalogs that **resource URL** (needs `paymentPayload.resource`).
4. Catalog/search cache: up to **~10 minutes**.
5. Stay visible: at least one settle every **30 days**.

### After deploy — seed the index

On **portalv2**, pay once per important route (or at least once for a representative URL) via:

https://vending-machine-seven.vercel.app/test  

Recommended seed set (cheap):

| Route | Query | Price |
|-------|--------|-------|
| `dns-resolve` | `host=example.com` | $0.003 |
| `fx-rate` | `base=USD&symbols=EUR` | $0.003 |
| `http-head` | `url=https://example.com` | $0.002 |

Then wait ≤10 minutes and run:

```bash
cd apps/vending-machine
npm run smoke:bazaar
```

### Check catalog yourself

```http
GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697
GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=vending-machine-seven&network=eip155:8453
GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?payTo=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697
```

MCP surface (agents):

`https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp`

Docs: https://docs.cdp.coinbase.com/x402/bazaar

---

## Agentic.Market / Agent.market

Coinbase’s public marketplace is **[Agentic.Market](https://agentic.market/)** (often called Agent.market in coverage). It is a **directory of x402 services** built for humans and agents — live pricing, categories, no API keys to browse.

### How services appear

- Many marketplace entries are fed from **protocol discovery / Bazaar-style indexing** once you have real CDP settle traffic + public discovery URLs.
- There is typically **no separate “submit form”** required if you are already on Base + CDP facilitator + Bazaar metadata (our path).
- Explore: https://agentic.market/

### What to do after Bazaar shows your URLs

1. Confirm merchant discovery lists our resources.
2. Search Agentic.Market for `vending-machine-seven` or your pay-to.
3. If missing after 24h of indexed Bazaar traffic, use Coinbase CDP Discord **#x402** or marketplace support to request crawl of:
   - https://vending-machine-seven.vercel.app/.well-known/x402  
   - https://vending-machine-seven.vercel.app/.well-known/agent-services.json  

### Listing blurb (copy/paste)

> **x402 Vending Machine** — Base mainnet **bundler hub** for AI agents: multi-step packs (infra, outbound, domain intel) + utilities + Kronos research candle forecasts. Exact USDC via CDP. Discovery: https://vending-machine-seven.vercel.app/.well-known/x402

---

## Other distribution (optional)

| Channel | Action |
|---------|--------|
| awesome-x402 | PR #778 (open) |
| PayAPI.market | Free list at https://payapi.market/list if desired |
| Self-hosted | Already: agent-services.json + OpenAPI |

## Success criteria

- [x] Code: Bazaar extension + per-route discovery metadata  
- [x] Deploy live  
- [x] `Payment-Required` contains `bazaar`  
- [x] ≥1 paid settle after Bazaar deploy (merchant catalog indexed)  
- [x] Merchant discovery returns our URLs (**11/12** as of 2026-07-10)  
- [x] Semantic search by domain / payTo returns our URLs  
- [ ] Optional: seed **`crypto-prices`** if missing from merchant list  
- [x] **Visible on Agentic.Market** (2026-07-10 — user confirmed; found via Bazaar)

### Verified snapshot (2026-07-10)

| Check | Result |
|-------|--------|
| Merchant `payTo=0xc648…b697` | **11+** resources (expand after re-settle on new tools) |
| Search `query=vending-machine-seven` | **hits include our routes** |
| Search `payTo=…` | **yes** |
| **Agentic.Market** | **Live** — Found on Bazaar |
| Catalog size | **17** live tools (quality expansion) |
| Bazaar `routeTemplate` | Pinned to `/api/v/{slug}` (not `:var1`) |

**New tools to seed (pay once each on `/test` after deploy):**  
`bundle-outbound`, `kronos-forecast` (needs Railway `KRONOS_API_*`), plus any still-missing: `dns-records`, `fetch-text`, `domain-intel`

```http
GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697
GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=vending-machine-seven&network=eip155:8453
```
