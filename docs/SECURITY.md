# x402 security checklist

## Before mainnet

- [ ] `X402_PAY_TO_ADDRESS` is a dedicated hot wallet or smart wallet with spend limits
- [ ] CDP API keys scoped to facilitator only; rotated on leak
- [ ] Max price per route capped in middleware config
- [ ] Request hash / URL binding verified (no payment for different path than signed)
- [ ] Replay: facilitator nonce / idempotency understood for your scheme (`exact` vs `batch-settlement`)
- [ ] Wait for settlement finality before returning sensitive data
- [ ] Rate limit unpaid 402 spam (per IP + per payer address when known)
- [ ] Audit logs: payment id, route, amount, payer, settlement tx (no PII in logs)
- [ ] Dependency pin + `npm audit` on deploy host

## Operational

- Separate Railway (public) vs portalv2 (private) keys if both run
- Alert on verify failures spike (attack or misconfiguration)
- Plan facilitator failover: CDP outage → pause paid routes or failover proxy