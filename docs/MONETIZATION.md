# Monetization playbook

## Unit economics (example utility API)

| Cost bucket | Estimate/call |
|-------------|----------------|
| Base USDC gas (facilitator-absorbed or pass-through) | $0.0001–$0.001 |
| Infra (Railway + DNS API) | $0.0002–$0.0005 |
| **Floor price** | **≥ $0.002** |

Target price **$0.003–$0.01** on `/v1/dns` for ~60% margin at 10k calls/day.

## Unique angles (prioritized)

1. **Agent bundles** — single 402 price for multi-step (DNS + HEAD + TLS cert snippet)
2. **MCP tool** — wrap paid routes; list in agent marketplaces
3. **Dynamic pricing** — surge on heavy WHOIS/registrar paths
4. **B2B proxy** — resell with 25–40% markup, your x402 in front
5. **Hybrid** — free `/.well-known` + 10 free calls/day per wallet fingerprint

## Metrics

Track in PostHog / simple SQLite on portalv2:

- `402_issued`, `payment_verified`, `settlement_confirmed`, `200_delivered`
- Revenue per route, conversion rate, unique payer wallets
- Agent share: `User-Agent` / `X-Agent-*` headers

## 1-day MVP

1. Deploy `apps/api` to Railway with one paid route wired in `x402.ts`
2. Test with CDP testnet client from portalv2
3. Publish discovery JSON + one-line README for agents
4. Post to awesome-x402 PR when stable