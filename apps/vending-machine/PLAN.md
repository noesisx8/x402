# x402 enhancement plan

Date: 2026-09-08. Baseline: master at 33f3ab2052a33057a631ba4529c37caa0dd0677c.
Target: x-vendor / vending-machine, apps/vending-machine. Production: https://vendsdk.com.

## Delivery sequence

Progress: phases 1 and 2 are implemented for draft PR #20 review. The separate agent-kit provides five MCP tools, explicit spending caps, ambiguous-payment blocking and JavaScript/Python examples; payments default off. Validation includes 14 adapter tests, five contract/extraction tests, a production build, all five tools through the official Inspector CLI with mocked payments, and live unpaid examples. Ten model-evaluation prompts are supplied but have not been scored with an external model. Funded E2E remains on portalv2 before release.

Structured extraction from phase 5 is also implemented with bounded HTML parsing and fixture tests. Phase 3 now has opt-in durable receipts, authenticated capability retrieval, duplicate-authorization claims, and known-transaction reconciliation; see RECEIPTS.md for limits and the portalv2/real-storage release gate. Domain health (phase 4), Kronos evaluation (phase 6) and the remaining branding audit are pending. Branch investigation below is unchanged; no branches were deleted.

### 1. Reliability and first-call preview (this branch)
- Recover resource-server initialization after facilitator failure and contain initialization failures in the route error boundary.
- Apply a 120-request/minute per-IP baseline before payment verification, retaining the stricter 30/minute unpaid per-service limit. This remains per isolate; distributed enforcement is a later infrastructure step.
- Bound Redis analytics reads/writes to 500ms so analytics outages cannot indefinitely delay paid delivery.
- Return safe, distinguishable 400 validation, 502 upstream, 503 unavailable and 504 timeout errors. Preserve no settlement on handler failure. Never include raw upstream errors in public responses or logs.
- Make /test a guided VendSDK playground: inspect an unpaid quote, decode PAYMENT-REQUIRED, connect wallet, approve payment, inspect result. Clear quote on input changes.
- Extend OpenAPI with stable operation IDs, categories, parameter descriptions/examples, success envelopes and settlement headers, and documented errors.
- Validate TypeScript, unit and reliability contracts, production build, preview UI and unpaid discovery/payment challenges. No funded mainnet tests on this coding host.
- Open a draft PR against master and inspect its automatic Vercel preview. User reviews preview before merge or production deployment.

### 2. Complete API contracts and agent integration
- Reconcile feat/openapi-bundles-mcp before adding another MCP adapter.
- Define explicit per-service input/output schemas from actual handler validation; include defaults and numeric limits rather than guessing them from parameter names or example values.
- Generate OpenAPI and discovery from those same contracts; validate example payloads against schemas.
- Add runnable JavaScript/Python examples and an MCP adapter with explicit per-call/session budgets, network checks and no automatic re-payment after ambiguous settlement.
- Acceptance: clean-install examples complete a mocked 402/sign/retry flow and stop at configured spending limits; every enabled service has validated schemas and examples.

### 3. Recoverable payment receipts
- Evaluate installed x402 payment-identifier/receipt extension support and facilitator compatibility.
- Design durable result storage keyed by payment identifier plus exact resource/query and payer identity, with TTL, size limits and access control.
- Persist execution/result state before settlement and reconcile confirmed transactions; distinguish pending, settled, failed, expired and delivered states.
- Provide authenticated retrieval without a second charge. Never treat a replayed authorization as proof of a new payment.
- Acceptance: concurrent retries, dropped connections after settlement, expired results and unauthorized retrieval tests; paid E2E on portalv2 before release.

### 4. Domain health flagship
- Extend existing domain-intel bundle rather than duplicate DNS/TLS/WHOIS services.
- Add SPF and DMARC checks, certificate expiry and redirect findings, evidence timestamps, partial-result status and actionable recommendations.
- Reuse public-host validation and SSRF protection for every redirect/DNS resolution; cap request fan-out, runtime and response size.
- Price after measuring upstream cost/latency under the existing cap.
- Acceptance: deterministic healthy/misconfigured domains, blocked private targets, upstream failure, partial results and cost tests.

### 5. Structured extraction
- Build on fetch-text with Markdown/structured fields, source URL, retrieval time and truncation indicators.
- Constrain content types, bytes, redirects and extraction selectors; retain SSRF protections. Treat retrieved text as untrusted data.
- Acceptance: representative HTML fixtures, oversized pages, malformed markup, private redirects and missing fields.

### 6. Kronos research reports
- Reconcile active PR #13 before changing runtime budgets; verify Vercel plan duration and Railway observed latency.
- Add historical evaluation, baseline comparisons, model/data timestamps and uncertainty measures with documented methodology.
- Avoid implying calibrated confidence without evaluation data. Keep the existing research disclaimer.
- Acceptance: reproducible held-out evaluation and no data leakage; measured cold/warm latency fits deployed timeout settings.

### 7. Branding and rollout
- Use VendSDK as the primary product name; retain x402 as the protocol descriptor. Playground and API title start that consolidation in this preview.
- Audit homepage, navigation, metadata, discovery and help text for conflicting names, preserving useful legacy links.
- Each phase gets a focused PR and preview. Merge only after user review; inspect production telemetry and unpaid smoke after an authorized release.
- Run dependency audit on deploy host before release. Track existing advisories separately; do not blindly apply breaking dependency upgrades.

## Branch investigation

No remote branches deleted and no existing PRs merged/closed. Findings are a snapshot; re-fetch before cleanup.

| Branch | Finding | Action |
|---|---|---|
| feat/how-it-works-flow | Fully reachable from master; zero unique commits | Safe cleanup candidate after verifying no deployment depends on it |
| vercel-agent/add-kronos-hf-xet | PR #15 merged; remaining commit patch-equivalent to master | Safe cleanup candidate after rechecking head |
| vercel-agent/optimize-vending-latency | PR #10 closed unmerged; 3 unique patches | Retain until changes are reviewed or archived intentionally |
| feat/openapi-bundles-mcp | 2 unique patches, 17 commits behind master | Review/reconcile; overlaps phase 2 |
| vercel-agent/fix-x402-payment-header | PR #11 open | Retain; verify assumptions against installed x402 V2 before adopting |
| vercel-agent/kronos-timeout-ui-fixes | PR #13 open, conflicts reported | Retain; reconcile overlap with error handling/playground |
| dependabot/npm_and_yarn/apps/vending-machine/npm_and_yarn-7d8db7246a | PR #14 open | Retain; evaluate dependency update separately |
| vercel-agent/vendsdk-domain-migration | PR #16 open | Retain; reconcile branding/canonical URL changes |
| vercel-agent/x402-domain-envelope-check | PR #17 open | Retain; reuse stronger smoke assertions where appropriate |
| vercel-agent/brave-wallet-provider-fix | PR #18 open; provider-selection PR #19 merged from a different branch | Retain; merged provider selection does not prove event-listener removal is redundant |

Cleanup procedure: re-fetch refs, check open PRs and preview associations, verify ancestry or patch equivalence, record exact head SHA, then delete only confirmed obsolete heads in a separate authorized cleanup. Never delete a branch solely because it is old or its PR is closed.
