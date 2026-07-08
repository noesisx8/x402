# x402 Vending Machine (Vercel)

Modular Next.js 15 App Router hub: add paid utilities in `lib/services/registry.ts`, deploy to Vercel, settle USDC via x402 V2 (`exact` scheme).

**Do not run production on your daily driver** — deploy only to Vercel (or portalv2/Railway sibling `apps/api`).

## Research: what sells

See `../../docs/TOP_X402_SERVICES.md` — Tier-1 utilities (email, IP, DNS, crypto, QR) match agentsvc / PayAPI demand.

## Quick start

```bash
cd apps/vending-machine
cp .env.example .env.local
# Set X402_PAY_TO_ADDRESS to your Base Sepolia or Base mainnet wallet
npm install --legacy-peer-deps
npm run dev   # local UI only; paid flow needs facilitator + funded wallet
```

## Add a service (minimal)

1. Implement handler in `lib/services/handlers.ts`
2. Append entry to `VENDING_SERVICES` in `lib/services/registry.ts` (slug, price, description, queryParams, handler)
3. Redeploy — route `GET /api/v/{slug}` is live with x402 protection via `withX402`

## x402 flow (per request)

1. Client `GET /api/v/ip-lookup?ip=8.8.8.8`
2. Server `402` + `PAYMENT-REQUIRED` (price, network, payTo)
3. Client signs USDC authorization, retries with `PAYMENT-SIGNATURE`
4. Facilitator verify → handler runs → settle on success (status &lt; 400)

## Environment (Vercel)

| Variable | Required | Notes |
|----------|----------|-------|
| `X402_PAY_TO_ADDRESS` | yes | USDC receive address |
| `X402_FACILITATOR_URL` | no | Default `https://x402.org/facilitator`; Coinbase CDP URL when using CDP keys |
| `X402_NETWORK_MODE` | no | `base-sepolia` (default) or `base` |
| `PUBLIC_BASE_URL` | yes in prod | e.g. `https://your-app.vercel.app` |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` | optional | When facilitator is Coinbase CDP |

## Deploy Vercel

1. Import repo; **Root Directory** = `apps/vending-machine`
2. Framework: Next.js
3. Set env vars above
4. Deploy

`vercel.json` included for install flags.

## Discovery (agents / MCP)

- `/.well-known/agent-services.json` — catalog
- `/.well-known/x402` — protocol hint
- `/api/openapi.json` — OpenAPI 3.1

## Security

- `withX402` settles only after successful handler (&lt; 400)
- Bind payments to request URL/path via x402 request hash (SDK)
- Use idempotent upstream calls; rate-limit at Vercel edge if abused
- Never commit `.env.local`; rotate CDP keys on Railway/Vercel only
- Mainnet: audit payTo address, monitor facilitator errors

## Profitability

- Target 50%+ margin: price $0.002–0.008 on near-free upstreams (geo, CoinGecko, QR)
- Bundle high-margin packs later (SEO audit, multi-step crawl)
- List on Agent.market / awesome-x402 when stable
- Track conversion: 402 count vs 200 count (add Vercel Analytics or persist `lib/analytics` to KV)

## Docker (optional)

```bash
docker build -t x402-vending .
docker run -p 3000:3000 --env-file .env.local x402-vending
```

## Batch settlement

Current routes use `exact` per call. For volume, add facilitator that supports batch-settlement and register `upto` scheme in `serviceRouteConfig` when your facilitator documents support.

## Related

- Express API (Railway / portalv2): `../api`
- Security notes: `../../docs/SECURITY.md`