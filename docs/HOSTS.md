# Host roles (authoritative)

| Host | Role | What runs here |
|------|------|----------------|
| **portalv2** | Ops / deploy / paid smoke PC (Windows, Tailscale) | Git working copy, `npm run smoke:paid`, Express API if private, secrets in env, Vercel CLI, CDP-adjacent ops |
| **pikatop** | **Daily driver** (Linux) | Code edit, browse, normal desktop use. **No** production API listeners. **No** funded mainnet payer keys by default. |
| **Vercel** | Public edge | `apps/vending-machine` production |
| **Railway** (optional) | Public long-running API | `apps/api` when needed |

## Rules

1. **Production pay-per-call traffic** → Vercel (vending) and/or Railway (`apps/api`).
2. **Paid E2E with a funded private key** → **portalv2 only** (`X402_PRIVATE_KEY` in shell env, never committed).
3. **pikatop** may hold a git clone for development, but do not enable `X402_ENABLED` API units or leave hot wallets there.
4. Canonical remote: `https://github.com/noesisx8/x402.git` — sync portalv2 ↔ pikatop via git, not ad-hoc tarballs of `node_modules`.

## This session

- Shell hostname **portalv2** = the machine Phase 0.2 paid smoke is meant for.
- **pikatop** = daily driver; treat it like a laptop, not a payment host.
