# x402 security checklist

## Before mainnet

- [x] `X402_PAY_TO_ADDRESS` is a dedicated merchant wallet (production: `0xc648…b697`)
- [x] CDP API keys scoped to facilitator only; stored in Vercel env (never in git)
- [x] Max price per route capped (`lib/pricing.ts` → `GLOBAL_MAX_PRICE_USD`, default **$0.05**)
- [x] Request hash / URL binding: `Payment-Required.resource.url` includes full request URL (path + query); client must retry same URL
- [x] Replay / idempotency understood for `exact` scheme (see below)
- [x] Settlement only after successful handler (`withX402` settles only when status **&lt; 400**)
- [x] Rate limit unpaid 402 spam (per IP + slug, in-memory isolate limiter)
- [x] Audit logs: event, slug, status, ms, payer hint, UA class — no secrets (`lib/analytics.ts`)
- [ ] Dependency pin + `npm audit` on deploy host (run before each release)

## Idempotency & retries (Phase 0.4)

| Scenario | Expected behavior |
|----------|-------------------|
| Unpaid GET | **402** + `Payment-Required` (no on-chain settle) |
| Paid GET, handler **200** | Facilitator **verify → settle** once; body delivered |
| Paid GET, handler **400** (bad input / upstream miss) | **No settle** (`withX402` cancels settlement) |
| Client retries **same** payment payload after successful settle | Facilitator rejects / no double-credit; client must not re-use spent authorization |
| Client retries after **network drop** post-settle | Treat as read-only retry with **new** payment if first settle confirmed; check `PAYMENT-RESPONSE` / explorer |
| Different path/query than signed `resource.url` | Verify fails — payment not accepted for another route |

**Contract tests (local, no chain):**

```bash
cd apps/vending-machine
node scripts/phase0-unit.mjs          # price cap + settle-status rules
node scripts/smoke-unpaid.mjs         # production 402 + discovery (no wallet)
```

**Paid E2E (funded key, deploy host only):**

```bash
X402_PRIVATE_KEY=0x… node scripts/paid-fetch.mjs
```

## Rate limits & caps (Phase 0.5)

| Control | Default | Env override |
|---------|---------|--------------|
| Max price / route | $0.05 | `X402_MAX_PRICE_USD` |
| Unpaid requests / window / IP+slug | 30 / 60s | `X402_UNPAID_RATE_LIMIT`, `X402_UNPAID_RATE_WINDOW_MS` |

Catalog prices are validated at module load (`registry.ts`). Misconfigured `$1.00` routes fail closed at boot.

## Observability (Phase 0.6)

Events: `402_issued`, `payment_present`, `handler_ok`, `handler_fail`, `200_delivered`, `settlement_response`, `rate_limited`, `error`.

- Vercel logs: JSON lines with `"scope":"x402"`
- `GET /api/admin/stats` — summary always public (counts only); full `recent_calls` requires `Authorization: Bearer $ANALYTICS_TOKEN`

## Operational

- Separate Railway (public) vs portalv2 (private) keys if both run
- Alert on verify failures spike (attack or misconfiguration)
- Plan facilitator failover: CDP outage → pause paid routes or failover proxy
- **No private keys in repo** — CDP secrets + any payer keys only in host env
