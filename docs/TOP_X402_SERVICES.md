# Top sought-after x402 services (2026 ecosystem)

Synthesized from Agent.market / PayAPI Market / agentsvc.io / awesome-x402 / Coinbase Exa launch / Messari x402scan trends.

## Tier 1 — highest volume, proven demand ($0.001–$0.01 USDC)

| Category | Examples | Why agents buy | Our catalog |
|----------|----------|----------------|-------------|
| Email validation | syntax + MX + disposable | Lead gen, outreach bots | `email-validate` (live MX) |
| IP geolocation | country, ASN | Fraud, routing | `ip-lookup` |
| DNS / SSL | resolve, cert expiry | Infra monitors | `dns-resolve`, `tls-cert` |
| Crypto prices | spot multi-asset | Trading / research | `crypto-prices` |
| Exchange / fiat rates | FX pairs | Cross-border reasoning | `fx-rate` |
| QR code generation | PNG payload | Payments, onboarding | `qr-code` |
| HTTP HEAD / uptime | status, latency | Site health | `http-head`, `redirect-trace` |
| WHOIS / domain intel | registrar, expiry | Brand protection | `whois-lite` |
| Bundles | multi-step one 402 | Agent efficiency | `bundle-infra` |

## Tier 2 — fast growth, higher margin ($0.01–$0.10)

| Category | Examples | Status for us |
|----------|----------|----------------|
| Web search (x402-native) | Exa /search | Deferred (upstream cost) |
| Page extract / screenshot | pay-per-crawl | Deferred |
| OCR / PDF extract | document agents | Deferred |
| Market data bundles | OHLCV, funding | Deferred |
| SEO packs | multi-step | Deferred |

## Official production list

See **`docs/OFFICIAL_CATALOG.md`** — verified live-data catalog for marketplace / awesome-x402 listing.

## Discovery

Agents expect: `/.well-known/x402`, `/.well-known/agent-services.json`, OpenAPI, MCP. List on awesome-x402 + Agent.market when live.
