# Phase 0 status (synced)

Last updated: 2026-07-09

## Host roles

| Host | Role |
|------|------|
| **portalv2** (this Windows PC) | Ops — paid E2E, secrets, deploy |
| **pikatop** | Daily driver — **do not** run funded smoke or production API here |
| GitHub `noesisx8/x402` | Canonical remote |

See `docs/HOSTS.md`.

## Canonical copies

| Path | Role |
|------|------|
| `C:\Users\willd\x402` on **portalv2** | Ops working copy (clean source; `npm install` when needed) |
| `pikatop:~/Projects/x402` | Optional daily-driver clone for editing only |
| `C:\Users\willd\pikatoptermux\x402` | Docs/agent mirror |
| `origin/master` | Source of truth |

Sync with **git pull / push**, not full `node_modules` copies.

## Live production (verified unpaid)

| Check | Result |
|-------|--------|
| URL | https://vending-machine-seven.vercel.app |
| `GET /api/health` | 200, `network_mode=base`, CDP auth, caps |
| Unpaid `GET /api/v/qr-code?data=…` | **402** + `Payment-Required` (amount `2000` = $0.002) |
| Pay-to | `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697` |
| Facilitator | CDP `https://api.cdp.coinbase.com/platform/v2/x402` |

## Checklist

- [x] 0.1 Production env on Base + CDP
- [ ] 0.2 Paid E2E once with funded wallet — **run on portalv2** (`npm run smoke:paid`)
- [x] 0.3 `/test` UI
- [x] 0.4 Idempotency docs + unit contract
- [x] 0.5 Price cap + unpaid rate limit
- [x] 0.6 Lifecycle analytics + token-gated admin stats

## Operator: finish 0.2 (portalv2 only)

On **portalv2** (this PC). `npm install` already done under `apps/vending-machine`.

**Option A — env file (preferred, never paste key in chat):**

```powershell
cd C:\Users\willd\x402\apps\vending-machine
# create gitignored file (one line):
# X402_PRIVATE_KEY=0xYOUR_FUNDED_BASE_KEY
notepad .env.local
npm run smoke:paid
```

**Option B — session env:**

```powershell
cd C:\Users\willd\x402\apps\vending-machine
$env:X402_PRIVATE_KEY = "0x…"
npm run smoke:paid
```

**Option C — browser:** https://vending-machine-seven.vercel.app/test → Connect wallet → Pay & GET.

Confirm USDC leave the payer and settle toward pay-to on Basescan.

### portalv2 progress (2026-07-09)

- [x] `gh` as **noesisx8**; `git push origin master` OK
- [x] `npm install --legacy-peer-deps` in `apps/vending-machine`
- [x] `npm run test:unit` + `npm run smoke:unpaid` (all pass)
- [ ] `npm run smoke:paid` — blocked until `X402_PRIVATE_KEY` is set on portalv2
