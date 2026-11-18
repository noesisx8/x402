# PR #24 + #25 preview review — November 18, 2026

The stack order is `master` → `chore/deps-security-2026-10-20` (#24) → `fix/atomic-payment-admission` (#25). The reviewed combined source started at `5afc46f112ec5b94c2fd1cb77a0fc74791b6af1c`, whose parent is #24's branch tip `9638801b2b28c4b9ff89281d5495436fbbfd9cbe`. GitHub's stack snapshot for #24 still reported `da7ebf4`; the actual branch includes the subsequent evidence/body-parser commit. Do not merge either PR to master as part of preview validation.

## Findings fixed in the follow-up

1. Preview and production inherit the same Redis connection. Both previously wrote `x402:pay:*`, allowing old and new writers to interact during preview tests. Vercel previews now use Base Sepolia only and branch-scoped payment keys; production retains the existing namespace. This provides logical payment-state isolation, not credential or capacity isolation.
2. The deployed preview's discovery JSON advertised Base Sepolia/placeholder pay-to but linked services to `https://vendsdk.com`. Preview discovery now prefers its own `VERCEL_URL` over shared `PUBLIC_BASE_URL`. Production still honors its configured public URL.
3. A retry with an earlier claimed expiry reset the shared use counter to a shorter TTL. Lua admission now retains at least the existing use-counter horizon for both the counter and pending state.

## Local evidence

Clean installs from both app lockfiles. Node 24.22.3 and disposable Redis 8.0.6, extracted into a temporary test directory; no system service installed, no production Redis credentials pulled, no wallet/private key or funded calls.

- Vending: `npm run check`, `npm run test:unit`, `npm run test:payment`, `npm run test:guard` (30/30), `npm run test:payment:redis`, `npm run build` passed.
- The actual route/SDK tests cover initialization recovery, cross-instance exclusion, handler failure without settlement, success/replay, uncertain settlement and storage outage. Added configuration checks reject mainnet previews and keep preview URLs local to the deployment.
- Added real-Redis checks exercise branch isolation with simultaneous production/preview claims and retention of the longer replay horizon after a retry.
- API: `npm run test:security` (build plus 6/6) passed.
- Build retains the existing viem/ox dynamic-import warning.

## Dependency gate

The November 18 registry audit is newer than the report in #24. Vending currently reports 0 critical, 39 high and 9 moderate affected packages; API reports 0 critical and 5 high. These counts include transitive/metavulnerable packages, not that many distinct flaws. Vending roots include decode-uri-component, picomatch, nested Zod 3, Hono and uuid; API roots include nested Zod 3. No forced paywall downgrade, Tailwind major migration or Zod 3→4 override was applied. These audits are release blockers requiring separate compatibility/exposure review before production, not a claim that this preview is vulnerability-free.

## Production gates remain

- Review the current dependency audit and validate compatible remediation or explicit exposure decisions.
- Confirm the Redis provider supports the actual Lua scripts and meets durability/non-eviction requirements. A successful preview command does not prove durability.
- Use the documented external pause/drain plan before changing production writers, including old deployment URLs and Express services sharing production keys.
- Perform the funded receipt/authorization-consumption smoke on portalv2 only, with explicit target/network/pay-to/amount checks.
- Stage and verify a production build before a separately authorized promotion. No production branch merge, environment changes or promotion belongs to this preview task.
