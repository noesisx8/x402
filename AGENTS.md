# x402 project context

Agent-native micropayment services: HTTP 402 pay-per-call APIs settling USDC on Base via the **x402 V2** protocol (`@x402/*` npm org, Coinbase CDP facilitator). Canonical remote: `https://github.com/noesisx8/x402.git` (`origin/master` is the source of truth).

## Repository layout

| Path | Purpose |
|------|---------|
| `apps/vending-machine` | **Main product.** Next.js 15 App Router paid-services hub, deployed to Vercel. Services catalog in `lib/services/registry.ts`; dynamic paid route `app/api/v/[slug]/route.ts`. |
| `apps/api` | Standalone Express 4 monetized API (DNS lookup, HTTP HEAD probe). Deployed to Railway or portalv2 only. |
| `apps/kronos-api` | Python/FastAPI Kronos forecast service (Docker, Railway). See `docs/KRONOS.md`, `deploy/railway/kronos.md`. |
| `apps/facilitator-proxy` | Empty placeholder — reserved for a self-hosted verify/settle proxy. |
| `deploy/railway` | Railway service config + env template for `apps/api` and `apps/kronos-api`. |
| `deploy/portalv2` | systemd unit + env layout for running `apps/api` on the ops PC. |
| `docs/` | `HOSTS.md` (authoritative host roles), `SECURITY.md` (checklist), `PHASE0_STATUS.md`, `CDP_X402_FAQ_REFERENCE.md`, `TOP_X402_SERVICES.md`, `MONETIZATION.md`, `DISTRIBUTION.md`, `KRONOS.md`, `OFFICIAL_CATALOG.md`, `ROADMAP_ULTIMATE_VENDING_HUB.md`. |

No monorepo tooling — each app has its own `package.json` / lockfile; `cd` into the app to work on it.

## Host roles (read first — hard rules)

| Host | Role |
|------|------|
| **portalv2** | Ops PC (Windows, Tailscale) — paid E2E, private API, secrets, deploy tooling |
| **pikatop** | **Daily driver** (Linux) — coding only; **never** production listeners or funded mainnet keys |
| **Vercel / Railway** | Public production |

- **Never** bind production API ports (`X402_ENABLED=true`) or run funded mainnet payer scripts on **pikatop** unless the user explicitly opts into a one-off testnet experiment.
- Paid smoke (`npm run smoke:paid` with `X402_PRIVATE_KEY`) runs **on portalv2 only**.
- Secrets live only in host env / Vercel / Railway variables — never commit `.env`.
- Production settles on **Base mainnet** USDC; **Base Sepolia** is for integration tests (portalv2 only).
- Sync machines via git pull/push, not file copies.

## GitHub

- **Always use GitHub user `noesisx8`** for this repo (push, PRs, forks, awesome-x402).
- If `gh auth status` shows another account active, switch: `gh auth switch --user noesisx8`.
- Do **not** use `fourthdensity` for `noesisx8/x402`.

## Stack

- Node 20+, TypeScript 5.7 (strict), ESM (`"type": "module"`)
- `apps/vending-machine`: Next.js 15, React 19, Tailwind 3, zod, viem, `@x402/next`, `@x402/core`, `@x402/evm`, `@x402/fetch`, `@coinbase/cdp-sdk`
- `apps/api`: Express 4, zod, `@x402/express`, `@x402/core`, `@x402/evm`
- Facilitator: Coinbase CDP hosted (`https://api.cdp.coinbase.com/platform/v2/x402`, JWT auth via `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET`) or public `https://x402.org/facilitator` (testnet default)
- Receiver: `X402_PAY_TO_ADDRESS` (EVM). Production pay-to: `0xc648116b5deBE4AF7D78838AA468d07e0A9Ab697`
- Live production: https://vending-machine-seven.vercel.app (Base mainnet, CDP facilitator)

## Build, test, run commands

All run inside the app directory. Install with `npm install --legacy-peer-deps` (vending-machine; required by peer deps — also set in `vercel.json`).

```bash
# apps/vending-machine (Vercel)
npm run dev            # local UI only; paid flow needs facilitator + funded wallet
npm run build          # next build
npm run check          # tsc --noEmit (type check)
npm run lint           # next lint
npm run test:unit      # node scripts/phase0-unit.mjs — price caps + rate-limit contract (no network)
npm run smoke:unpaid   # live 402 + discovery against production (no wallet)
npm run smoke:paid     # PAID mainnet E2E — portalv2 only, needs X402_PRIVATE_KEY=0x…

# apps/api (Railway / portalv2)
npm run build          # tsc -p tsconfig.json → dist/
npm run check          # tsc --noEmit
npm run start:deploy   # node dist/index.js (deploy hosts only)
```

Optional Docker for the vending machine: `docker build -t x402-vending .` in `apps/vending-machine`.

## Code organization & conventions (vending-machine)

- **Add a paid service**: implement a handler in `lib/services/handlers.ts`, then append one entry (`slug`, `price` like `"$0.003"`, `description`, `queryParams`, `handler`) to `VENDING_SERVICES` in `lib/services/registry.ts`. The route `GET /api/v/{slug}` goes live automatically; discovery (`/.well-known/agent-services.json`, `/api/openapi.json`) derives from the registry.
- **x402 flow** (`app/api/v/[slug]/route.ts`): handlers are wrapped with `withX402` from `@x402/next`; the shared facilitator-backed resource server is a per-isolate singleton (`lib/x402/resource-server.ts`). Settlement runs **only when the handler returns status < 400** — handlers signal bad input by returning 400, which cancels settlement (no charge on bad input).
- **Prices are display strings** (`"$0.003"`) parsed by `lib/pricing.ts`; every registry price is validated against `GLOBAL_MAX_PRICE_USD` (default **$0.05**, env `X402_MAX_PRICE_USD`) at module load — misconfigured routes fail closed at boot. Recommended floor: $0.002.
- **Env validation** is zod-based at startup: `lib/env.ts` (vending-machine, with a placeholder pay-to so `next build` works without secrets) and inline in `apps/api/src/index.ts`.
- **Networks** are CAIP-2: `base` → `eip155:8453`, `base-sepolia` → `eip155:84532`.
- Path alias `@/` → `apps/vending-machine/` root. TypeScript strict mode; match the existing style (small focused modules, doc comments on exported behavior, no new abstractions for one-off logic).
- CDP facilitator auth is only attached when the facilitator URL is the CDP host and both CDP keys are present (`lib/x402/cdp-auth.ts`, `shouldUseCdpFacilitatorAuth`).

## Testing strategy

No test framework — three plain-node scripts in `apps/vending-machine/scripts/`:

- `phase0-unit.mjs` — inline mirrors of the pure logic in `lib/pricing.ts` / `lib/rate-limit.ts` asserted with `node:assert`. **If you change that logic, update the mirrors in this script too** (header comment says to keep them in sync).
- `smoke-unpaid.mjs` — hits production unpaid: expects 402 + `Payment-Required` headers and discovery endpoints.
- `paid-fetch.mjs` — funded paid E2E via `@x402/fetch`; **portalv2 only**.

Always run `npm run check` (tsc) and `npm run test:unit` after changes. Run `npm audit` on the deploy host before each release.

## Security considerations (every change — see docs/SECURITY.md)

- Request binding: `Payment-Required.resource.url` includes the full request URL (path + query); payments are not portable across routes.
- Settlement only after successful handler (< 400); facilitator rejects reused authorizations (exact-scheme idempotency).
- Unpaid 402 spam is rate-limited per IP+slug (in-memory per serverless isolate; 30 req/60s default, `X402_UNPAID_RATE_LIMIT` / `X402_UNPAID_RATE_WINDOW_MS`).
- Per-route price cap ($0.05 default) fails closed at boot.
- Analytics (`lib/analytics.ts`) logs lifecycle events (`402_issued`, `payment_present`, `handler_ok/fail`, `200_delivered`, `settlement_response`, `rate_limited`, `error`) — in-memory ring buffer, truncated payer hints, **never** secrets or full payment payloads. `GET /api/admin/stats` full payload requires `Authorization: Bearer $ANALYTICS_TOKEN`.
- No private keys in the repo — CDP secrets and payer keys live only in host env / Vercel / Railway variables.

## Deployment

- **Vercel** (`apps/vending-machine`): import repo, Root Directory = `apps/vending-machine`, framework Next.js, set env vars (`X402_PAY_TO_ADDRESS`, `X402_FACILITATOR_URL`, `X402_NETWORK_MODE`, `PUBLIC_BASE_URL`, optionally `CDP_API_KEY_*`). `vercel.json` pins the install command.
- **Railway** (`apps/api`): root dir `apps/api`, build `npm ci && npm run build`, start `npm run start:deploy`, healthcheck `/health`. See `deploy/railway/README.md`.
- **portalv2** (`apps/api`, private/Tailscale): systemd unit + `/etc/x402-api.env` (mode 600). See `deploy/portalv2/README.md`.
- `apps/api` refuses paid routes with **503 `x402_disabled`** unless `X402_ENABLED=true` — a guard against enabling the listener on the daily driver.

## Profitability context

Target **50%+ margin** per call; prices $0.002–$0.008 on near-free upstreams (geo, CoinGecko, Open-Meteo, QR). Track 402 count vs paid conversion in analytics. Current scheme is `exact` per call; consider batch settlement only past ~1k tx/day.
