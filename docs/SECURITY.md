# x402 security checklist

## Before mainnet

- [x] `X402_PAY_TO_ADDRESS` is a dedicated merchant wallet (production: `0xc648…b697`)
- [x] CDP API keys scoped to facilitator only; stored in Vercel env (never in git)
- [x] Max price per route capped (`lib/pricing.ts` → `GLOBAL_MAX_PRICE_USD`, default **$0.05**)
- [x] Request hash / URL binding: `Payment-Required.resource.url` includes full request URL (path + query); client must retry same URL
- [x] Replay / idempotency understood for `exact` scheme (see below). App ledger single-flights a payment fingerprint; facilitator verify is not the lock
- [x] Settlement only after successful handler (`withX402` settles only when status **&lt; 400**)
- [x] Rate limit unpaid 402 spam (per IP + slug) and the paid lane (per IP and per payer)
- [x] Customer-URL probes fail closed, pin the resolved address, and follow redirects manually (`packages/request-guard`)
- [x] `apps/api` paid routes match every HTTP method, so HEAD cannot skip the paywall
- [x] Client errors are stable codes. Probe and RPC failures do not echo upstream URLs
- [x] Audit logs: event, slug, status, ms, payer hint, UA class — no secrets (`lib/analytics.ts`)
- [ ] Dependency pin + `npm audit` on deploy host (run before each release)

## Idempotency & retries (Phase 0.4)

| Scenario | Expected behavior |
|----------|-------------------|
| Unpaid GET | **402** + `Payment-Required` (no on-chain settle) |
| Paid GET, handler **200** | Facilitator **verify → settle** once; body delivered. The same fingerprint cannot enter the handler twice in parallel |
| Paid GET, handler **400** (bad input / upstream miss) | **No settle** (`withX402` cancels settlement). The fingerprint still consumes one of at most 3 uses |
| Forged or incomplete `PAYMENT-SIGNATURE` | **400** `payment_malformed` before any facilitator verify |
| Same fingerprint already in flight | **429** `payment_already_in_progress` |
| Same fingerprint already consumed, or uses exhausted | **409** `payment_already_used` or **429** `payment_use_cap` |
| Client retries **same** payment payload after successful settle | App ledger returns **409**. Do not rely on the facilitator to dedup concurrent verifies |
| Client retries after **network drop** post-settle | Reconcile facilitator/chain outcome first. Never automatically issue a new payment or assume no charge |
| Different path/query than signed `resource.url` | Verify fails — payment not accepted for another route |

**Contract tests (local, no chain):**

```bash
cd apps/vending-machine
node scripts/phase0-unit.mjs          # price cap + settle-status rules
node scripts/smoke-unpaid.mjs         # production 402 + discovery (no wallet)
```

**Paid E2E (funded key on portalv2 only — not pikatop):**

```powershell
# portalv2
cd C:\Users\willd\x402\apps\vending-machine
$env:X402_PRIVATE_KEY="0x…"
npm run smoke:paid
```

## Rate limits & caps (Phase 0.5)

| Control | Default | Env override |
|---------|---------|--------------|
| Max price / route | $0.05 | `X402_MAX_PRICE_USD` |
| Unpaid requests / window / IP+slug | 30 / 60s | `X402_UNPAID_RATE_LIMIT`, `X402_UNPAID_RATE_WINDOW_MS` |
| Paid requests / window / IP | 20 / 60s | `X402_PAID_RATE_LIMIT`, `X402_PAID_RATE_WINDOW_MS` |
| Paid requests / window / payer | 30 / 60s | `X402_PAID_PAYER_RATE_LIMIT`, `X402_PAID_RATE_WINDOW_MS` |
| Handler runs per payment fingerprint | 3 | `X402_PAYMENT_MAX_USES` |
| Consecutive paid failures per payer | 8 / window | `X402_PAYER_FAIL_LIMIT` |

The fingerprint is `lower(authorization.from) + ":" + lower(authorization.nonce)` (EIP-3009 or Permit2). Shared Redis is now required for paid admission: missing configuration or store errors return **503 `payment_lock_unavailable`** before verification or handler work. Unpaid discovery remains available. Claims and owner-checked finalization are atomic Lua operations; uses are reserved on claim. An expired lease never makes abandoned work retryable: its pending state becomes **409 `payment_outcome_unknown`** until authorization expiry plus a safety margin. An uncertain settlement must be reconciled, not automatically retried or described as uncharged.

Authorizations must have a future expiry no more than 24 hours away; the ledger retains state through that expiry plus 120 seconds. Local-only admission requires explicit test/development opt-in and is prohibited under `NODE_ENV=production`. See [Payment admission](PAYMENT_ADMISSION.md) for tests, migration and Redis durability assumptions.

## Customer-URL and DNS probes

Shared by the vending machine and `apps/api` via `packages/request-guard`:

- Resolver errors fail closed (`dns_lookup_failed`). Private, loopback, link-local, CGNAT, and documentation addresses are rejected, including v4-mapped IPv6.
- Hostnames `localhost`, `.localhost`, `.local`, `.internal`, and `.localdomain` are rejected before DNS.
- The address used for connect is the one that was checked (`host` is the pinned IP, TLS `servername` stays the public hostname).
- Redirects are manual. Every `Location` is checked and pinned again. Customer URLs do not use `redirect: "follow"`.
- Ports are limited to 80, 443, and 8443.
- `/v1/dns` and the vending DNS helpers drop the whole answer if any A/AAAA is private. They do not cache or return those addresses.
- Clients see `host_not_allowed`, `port_not_allowed`, `dns_lookup_failed`, or `upstream_failed`. Responses do not include the socket error class or a private address.
- Fixed upstreams (DoH, FX, RDAP, geo, weather, market data) are unchanged and may follow their own redirects.

`apps/api` route keys are `"/v1/dns"` and `"/v1/http-head"` (any method). HEAD without a payment receives the same 402 as GET. `HOST` defaults to `0.0.0.0` for Railway. portalv2 sets `HOST=127.0.0.1`.

Kronos (`apps/kronos-api`) rejects bodies over 64 KiB with 413 before auth and before JSON parsing, and uvicorn is started with `--http h11 --limit-concurrency` (default 16). Its bind stays `0.0.0.0` on Railway.

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
