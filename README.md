# x402 — agent-native micropayment services

HTTP 402 pay-per-call APIs.

**Hosts:** **portalv2** = ops/deploy/paid smoke · **pikatop** = daily driver (no production API, no funded mainnet keys) · public edge = **Vercel** / **Railway**. See `docs/HOSTS.md`.

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
| `apps/vending-machine` | Next.js x402 vending machine (Vercel) |
| `apps/api` | Monetized HTTP API (middleware, routes, discovery) |
| `apps/facilitator-proxy` | Optional thin proxy if you self-host verify/settle later |
| `deploy/railway` | Railway service config + env template |
| `deploy/portalv2` | systemd + env for home server |
| `docs/` | Security, pricing, runbooks |

## Deploy targets (only)

1. **Railway** — `deploy/railway/README.md` — public URL, CDP facilitator keys in Railway variables.
2. **portalv2** — `deploy/portalv2/README.md` — private/Tailscale ops PC; paid E2E and optional `apps/api` here.

**pikatop (daily driver):** edit code and dry-run builds OK. **No** production `npm start` / systemd API / funded `smoke:paid` on pikatop.

## First profitable MVP (suggested)

Utility endpoint bundle: DNS lookup + HTTP HEAD probe + optional WHOIS stub — price **$0.002–$0.01** per call, batch-friendly agents, list on MCP + `.well-known/x402`.

## Phase 0 checks

```bash
cd apps/vending-machine
npm run test:unit          # price caps + settle contract
npm run smoke:unpaid       # live 402 + discovery (no wallet)
# X402_PRIVATE_KEY=0x… npm run smoke:paid   # mainnet paid E2E (funded key only)
```

Production anchor: https://vending-machine-seven.vercel.app · Base mainnet · see `docs/ROADMAP_ULTIMATE_VENDING_HUB.md`.

## References

- Spec / SDK: [coinbase/x402](https://github.com/coinbase/x402), [x402.org](https://x402.org), [docs.cdp.coinbase.com/x402](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers)
- Ecosystem: [awesome-x402](https://github.com/xpaysh/awesome-x402)