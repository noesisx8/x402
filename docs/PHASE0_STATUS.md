# Phase 0 status (synced)

Last updated: 2026-07-09

## Canonical locations

| Path | Role |
|------|------|
| `pikatop:/home/willd/Projects/x402` | Source of truth monorepo + git |
| `C:\Users\willd\x402` | Clean Windows working copy (source only; no `node_modules`) |
| `C:\Users\willd\pikatoptermux\x402` | Docs/agent mirror for Termux handoff |

Do **not** use incomplete partial clones. After edits, sync pikatop ↔ Windows before push.

## Live production (verified unpaid)

| Check | Result |
|-------|--------|
| URL | https://vending-machine-seven.vercel.app |
| `GET /api/health` | 200, `network_mode=base`, CDP auth when keys present |
| `GET /api/config/client` | `eip155:8453` Base Mainnet |
| Unpaid `GET /api/v/qr-code?data=…` | **402** + `Payment-Required` (amount `2000` = $0.002) |
| Pay-to | `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697` |
| Facilitator | CDP `https://api.cdp.coinbase.com/platform/v2/x402` |

## Checklist

- [x] 0.1 Production env on Base + CDP
- [ ] 0.2 Paid E2E once with funded wallet (`npm run smoke:paid`)
- [x] 0.3 `/test` UI
- [x] 0.4 Idempotency docs + unit contract
- [x] 0.5 Price cap + unpaid rate limit
- [x] 0.6 Lifecycle analytics + token-gated admin stats

## Operator: finish 0.2

On portalv2 or any non-daily-driver with Node 20+:

```bash
cd ~/Projects/x402/apps/vending-machine   # or Windows clone
npm install --legacy-peer-deps
X402_PRIVATE_KEY=0x… npm run smoke:paid
```

Confirm USDC leave the payer wallet and settle toward pay-to on Basescan.
