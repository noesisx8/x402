# Official x402 catalog (production)

**Base URL:** https://vending-machine-seven.vercel.app  
**Network:** Base mainnet (`eip155:8453`) · exact USDC  
**Pay-to:** `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697`  
**Facilitator:** Coinbase CDP `https://api.cdp.coinbase.com/platform/v2/x402`  
**Protocol:** x402 V2 + Bazaar discovery extensions  

## Discovery (agents)

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/x402` | Protocol + full endpoint list |
| `/.well-known/agent-services.json` | Catalog, prices, pay-to, query params |
| `/api/openapi.json` | OpenAPI 3.1 |
| `/llms.txt` | Agent-oriented tool map |
| `/api/health` | Liveness + network_mode |
| `/test` | Human paid wallet smoke |

## Production services (live data only)

### Core utilities
| Slug | Price | Live upstream |
|------|-------|---------------|
| `email-validate` | $0.004 | DoH MX |
| `ip-lookup` | $0.003 | ipapi.co |
| `weather` | $0.003 | Open-Meteo |
| `crypto-prices` | $0.005 | CoinGecko (+ 24h change) |
| `qr-code` | $0.002 | api.qrserver.com |
| `fx-rate` | $0.003 | Frankfurter/ECB |

### Infra & security
| Slug | Price | Live upstream |
|------|-------|---------------|
| `dns-resolve` | $0.003 | DoH A/AAAA |
| `dns-records` | $0.004 | DoH multi-type |
| `http-head` | $0.002 | HEAD/GET |
| `http-get` | $0.004 | capped body GET |
| `redirect-trace` | $0.003 | hop chain |
| `tls-cert` | $0.004 | TLS handshake |
| `whois-lite` | $0.008 | RDAP |
| `bundle-infra` | $0.01 | DNS+HEAD+TLS |
| `bundle-outbound` | $0.01 | email MX + IP geo + HEAD |
| `domain-intel` | $0.015 | DNS+TLS+WHOIS+HEAD |

### Agent-native
| Slug | Price | Live upstream |
|------|-------|---------------|
| `fetch-text` | $0.005 | page → plain text |
| `base-balance` | $0.003 | Base ETH + USDC |

### Premium
| Slug | Price | Live upstream |
|------|-------|---------------|
| `kronos-forecast` | $0.05 | Binance OHLCV + Kronos-mini (Railway) |

**Policy:** fail closed on upstream errors (no settle). No mock payloads. Bazaar `routeTemplate` pinned to `/api/v/{slug}`.  
**Positioning:** Base x402 **bundler hub** — multi-step packs first; Kronos research forecasts are not financial advice. See `docs/KRONOS.md`.

## Distribution

- CDP Bazaar + Agentic.Market: `docs/DISTRIBUTION.md`
- awesome-x402 PR: https://github.com/xpaysh/awesome-x402/pull/778
