# Official x402 catalog (production)

**Base URL:** https://vending-machine-seven.vercel.app  
**Network:** Base mainnet (`eip155:8453`) · exact USDC  
**Pay-to:** `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697`  
**Facilitator:** Coinbase CDP `https://api.cdp.coinbase.com/platform/v2/x402`  
**Protocol:** x402 V2 (header `Payment-Required` / payment signature)

## Discovery (agents)

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/x402` | Protocol + endpoint list |
| `/.well-known/agent-services.json` | Catalog, prices, pay-to, query params |
| `/api/openapi.json` | OpenAPI 3.1 |
| `/api/health` | Liveness + network_mode |
| `/test` | Human paid wallet smoke |

## Production services (live data only)

| Slug | Price | Live upstream | Status |
|------|-------|---------------|--------|
| `email-validate` | $0.004 | DoH MX (Cloudflare) + format/disposable | Live |
| `ip-lookup` | $0.003 | ipapi.co | Live |
| `weather` | $0.003 | Open-Meteo | Live |
| `crypto-prices` | $0.005 | CoinGecko | Live |
| `qr-code` | $0.002 | api.qrserver.com (probed) | Live |
| `dns-resolve` | $0.003 | DoH Cloudflare | Live · paid E2E |
| `http-head` | $0.002 | fetch HEAD/GET | Live · paid E2E |
| `bundle-infra` | $0.01 | DNS + HEAD + TLS | Live |
| `tls-cert` | $0.004 | TLS handshake | Live · paid E2E |
| `whois-lite` | $0.008 | RDAP (rdap.org) | Live · paid E2E |
| `fx-rate` | $0.003 | Frankfurter/ECB · open.er-api fallback | Live |
| `redirect-trace` | $0.003 | Manual redirect hops, SSRF-safe | Live |

**Policy:** handlers fail closed (HTTP 400) on upstream/empty data so x402 does **not** settle. No `mock_ok` or fabricated business payloads.

## Verification (portalv2)

```bash
cd apps/vending-machine
npm run test:unit
npm run test:live      # handlers hit real upstreams
npm run smoke:unpaid   # production 402 + discovery
```

## One-line listing (awesome-x402 / marketplaces)

> **x402 Vending Machine** — Base mainnet pay-per-call utilities for agents: DNS, TLS, WHOIS, HTTP HEAD, redirect trace, email MX, FX, IP, crypto spot, QR. Discovery: https://vending-machine-seven.vercel.app/.well-known/x402

## Example paid flow

1. `GET /api/v/dns-resolve?host=example.com` → **402** + `Payment-Required`
2. Sign exact USDC payment (wallet / `@x402/fetch`)
3. Retry same URL → **200** + JSON + `PAYMENT-RESPONSE`
