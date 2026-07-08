# Top sought-after x402 services (2026 ecosystem)

Synthesized from Agent.market / PayAPI Market / agentsvc.io / awesome-x402 / Coinbase Exa launch / Messari x402scan trends.

## Tier 1 — highest volume, proven demand ($0.001–$0.01 USDC)

| Category | Examples | Why agents buy |
|----------|----------|----------------|
| Email validation | syntax + MX + disposable detection | Lead gen, outreach bots |
| IP geolocation | country, ASN, proxy/VPN hints | Fraud, routing, compliance |
| DNS / SSL | resolve, cert expiry | Infra monitors, security scans |
| Crypto prices | spot, 24h change, multi-asset | Trading / research agents |
| Exchange / fiat rates | FX pairs | Cross-border reasoning |
| QR code generation | PNG/SVG payload | Payments, onboarding flows |
| HTTP HEAD / uptime | status, latency | Site health pipelines |
| WHOIS / domain intel | registrar, expiry | Brand protection |

## Tier 2 — fast growth, higher margin ($0.01–$0.10)

| Category | Examples |
|----------|----------|
| Web search (x402-native) | Exa /search ~$0.007 per call |
| Page extract / screenshot | pay-per-crawl stacks |
| OCR / PDF extract | document agents |
| Market data bundles | funding, OHLCV, DeFi yields (AgentData-style) |
| SEO / competitive intel packs | multi-step bundles |
| Translation / summarize | per-request NLP |

## Tier 3 — differentiated / lower competition

| Category | Examples |
|----------|----------|
| Multi-step workflows | pay-per-step orchestration |
| Onchain data (x402) | Allium-style per-query |
| Compliance / sanctions screen | B2B agents |
| Inference gateway routing | cheapest model + premium tier |

## Vending machine defaults (this repo)

Ship Tier-1 utilities first: weather (demo), IP, QR, crypto prices, email validate — prices aligned with agentsvc/PayAPI ($0.002–$0.008).

## Discovery

Agents expect: `/.well-known/x402`, `/.well-known/agent-services.json`, OpenAPI, MCP manifest. List on awesome-x402 + Agent.market when live.