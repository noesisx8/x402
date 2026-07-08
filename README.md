# x402 — agent-native micropayment services

HTTP 402 pay-per-call APIs. **Do not run production servers on the daily-driver workstation.** Deploy to **Railway** (public edge) and/or **portalv2** (private / Tailscale).

## Architecture

```
Client / AI agent
    │  GET /resource  → 402 + PAYMENT-REQUIRED (headers, V2)
    │  GET + X-PAYMENT (signed payload)
    ▼
Resource server (apps/api) — Express + @x402/express
    │  verify (facilitator)
    │  settle (on-chain USDC, Base mainnet recommended)
    ▼
Facilitator — Coinbase CDP hosted (default) or self-hosted proxy (apps/facilitator-proxy)
```

## Repo layout

| Path | Purpose |
|------|---------|
| `apps/api` | Monetized HTTP API (middleware, routes, discovery) |
| `apps/facilitator-proxy` | Optional thin proxy if you self-host verify/settle later |
| `deploy/railway` | Railway service config + env template |
| `deploy/portalv2` | systemd + env for home server |
| `docs/` | Security, pricing, runbooks |

## Deploy targets (only)

1. **Railway** — `deploy/railway/README.md` — public URL, CDP facilitator keys in Railway variables.
2. **portalv2** — `deploy/portalv2/README.md` — bind `127.0.0.1` or Tailscale Serve; no listeners on daily driver.

Local machine: edit code, `npm test` / dry-run builds OK. **No `npm start` / `docker compose up` for API in daily workflow** unless you explicitly opt into testnet on a throwaway port.

## First profitable MVP (suggested)

Utility endpoint bundle: DNS lookup + HTTP HEAD probe + optional WHOIS stub — price **$0.002–$0.01** per call, batch-friendly agents, list on MCP + `.well-known/x402`.

## References

- Spec / SDK: [coinbase/x402](https://github.com/coinbase/x402), [x402.org](https://x402.org), [docs.cdp.coinbase.com/x402](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- Ecosystem: [awesome-x402](https://github.com/xpaysh/awesome-x402)