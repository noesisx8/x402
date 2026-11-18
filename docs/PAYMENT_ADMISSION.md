# Shared payment admission

Paid admission requires the shared Redis REST store (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or the corresponding `UPSTASH_REDIS_REST_*` variables). Do not put token values in URLs or logs. No configuration is changed by this PR.

## State and retry policy

- An atomic Lua claim checks terminal state, lease and use cap, reserves one use, records `pending`, and acquires a 90-second lease with a unique owner token.
- A second instance sees `busy` while the lease exists. Lease expiry does **not** authorize another handler execution: pending without a lease becomes `unknown`.
- Finalization checks ownership and atomically records `used`/`unknown`, or clears pending only for a proven pre-settlement failure. Stale owners cannot release newer claims. Uses remain charged against the attempt cap.
- `finish(status)` conservatively treats failure as unknown. Only callers that know settlement could not have happened may specify `finish(status, "retryable")`. The Next route does this for initialization/verification rejection and handler errors; a handler success followed by a failed SDK response is explicitly returned as HTTP 409 `payment_outcome_unknown` (not the SDK's 402 asking for another payment).
- Store failure before admission returns retryable 503 with `Retry-After: 1`, without verification/handler/settlement. A lost claim response might nevertheless have reserved the payment: later requests can remain busy/unknown. A lost finalize response never reopens the local gate.
- Unknown means **reconcile before retrying**. Check facilitator/chain records using the authorization and transaction evidence through trusted operations tooling. Do not delete keys or automatically create a replacement payment. This PR does not implement a reconciliation service or claim a wallet was not charged.
- Expiry must be in the future and within 24 hours; state survives authorization expiry plus 120 seconds. Missing/long-lived/expired authorizations are rejected as malformed rather than silently truncated to a shorter replay horizon.

The Express API shares the conservative gate defaults; it does not yet classify proven pre-settlement failures as finely as the Next route. Its failure responses may retain the middleware's original status, but the same authorization remains blocked when outcome is uncertain.

## Required release review (not performed by these changes)

1. Use a shared primary with atomic `EVAL` support and durable, non-evicting state. All instances/regions serving the same authorizations must use the same store. Losing/evicting Redis state defeats replay protection; this implementation does not provide exactly-once execution across data loss or independently writable Redis primaries.
2. **Do not mix old and new writers.** Old deployments can still fail open and delete leases without checking ownership. Before rollout, pause paid admission externally and drain old paid requests, including other services using these keys and direct old deployment URLs. Validate the store, then resume only the reviewed build. No production rollout is authorized by this PR.
3. Existing `used` and use-count keys are preserved. Legacy in-flight work without a pending marker cannot be made safe retroactively; draining is required. An availability rollback to an old build restores the old payment risks: keep paid traffic paused, not merely routed to the old build.
4. Verify the actual provider's REST/Lua support, nonproduction configuration, and deployed runtime paths. Local Redis tests do not prove production credentials, storage durability, real-wallet settlement, timeout budgets, or dependency release gates.

## Automated checks (no funds)

On Node 24, install the app with `npm ci --legacy-peer-deps`. Install `redis-server` and `redis-cli` on the test host (Redis 6+; this change was tested on Redis 8.0.5), then:

```sh
cd apps/vending-machine
npm run check
npm run test:unit
npm run test:payment
npm run test:guard
npm run test:payment:redis
npm run build
```

The fixture starts a disposable Redis on a private temporary Unix socket (no Redis TCP listener or persistence) and exposes a loopback-only REST adapter. It never reads production Redis configuration. Tests run the actual Lua scripts on Redis, not an in-memory emulation, and clean up the service and temporary directory. The route suite mocks the facilitator and uses fake signatures, with all external fetches blocked.

Coverage: independent gates and independent route modules, simultaneous claims/finalizes, success replay rejection, repeated definite failures, stale owners, abandoned work/lease expiry, store absence/outage, lost claim/finalize responses, SDK settlement response loss, and expiry validation. A funded wallet-to-chain test remains a separate, explicitly approved portalv2 activity.
