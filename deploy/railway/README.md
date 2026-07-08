# Railway deployment

## Service

- Root directory: `apps/api`
- Build: `npm ci && npm run build`
- Start: `npm run start:deploy`
- Healthcheck path: `/health`

## Variables (Railway dashboard)

| Variable | Required | Notes |
|----------|----------|-------|
| `X402_PAY_TO_ADDRESS` | yes | USDC receiver on Base |
| `X402_NETWORK` | yes | `base` prod, `base-sepolia` test |
| `X402_ENABLED` | yes | `true` on deploy hosts only |
| `X402_FACILITATOR_URL` | no | default `https://x402.org/facilitator`; CDP URL when using Coinbase facilitator |
| `PUBLIC_BASE_URL` | yes | Railway public URL (discovery) |
| `NODE_ENV` | yes | `production` |

## Notes

- Free CDP facilitator tier (~1k tx/mo) is enough for MVP validation.
- After first deploy, hit `/` and `/.well-known/x402`, then configure client with `@x402/client` from a **deploy host** or agent runtime — not daily driver unless testing.

## Optional `railway.toml` (place in `apps/api` if using Railway config-as-code)

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm run start:deploy"
healthcheckPath = "/health"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
```