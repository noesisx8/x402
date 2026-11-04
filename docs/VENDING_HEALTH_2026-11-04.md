# Vending-machine health and x402 upgrade — November 4, 2026

PR: https://github.com/noesisx8/x402/pull/24. Investigation and preview only;
production rollout, merge, and funded testing require separate approval.

## Refreshed production evidence

Vercel team `x-vendor`, project `vending-machine`: both `vendsdk.com` and
`vending-machine-seven.vercel.app` still point to READY deployment
`dpl_FSiCRHDp4qEFKMeTZawWE7YhHkTc`, master commit
`babe76434a4c06316ce4acbd700656f7b8843de8`. PR #24 was open and unmerged at
`fc13c2a13658b832e2a9d3d8230c3c4dd27b7ce8` before this refresh.

Read-only Vercel CDN request-count query, production environment, November 3
07:20Z–November 4 07:20Z: **17 HTTP 502s**, all on `/api/v/…`.
`bundle-infra`, `domain-intel`, `fx-rate`, `http-head`, and `weather` had two
each; seven other service routes had one each. Runtime message-content search
over the corresponding window found 17 `scope=x402`, `event=error`,
`error=request_failed` records with 0–1 ms application durations. These records
are **info-level stdout**; severity-error queries alone miss them.

The supplied weather request `4ndfk-1793731179423-461d82ab3a43` correlates to
the November 3 18:39:39.485Z application error (0 ms). Request trace lookup
returned 404; the retained event contains no exception details. Failed CDN
requests used JSON, wildcard, or empty Accept headers, with crawler/monitor
user agents. No evidence identifies service upstreams or a facilitator outage.

Production unpaid smoke passed around November 4 07:18Z: health, client
configuration, 19-service discovery, 14 paid endpoints returning 402 with V2
requirements, and unknown-service 404. Additional homepage, OpenAPI and x402
discovery requests returned 200. Weather GET/HEAD/encoded-path/HTML-Accept
requests returned 402 and full request-URL requirements; trailing slash
redirected to the gate and POST returned 405. The intermittent 502 was not
reproduced against production.

Existing production traffic now includes six `payment_present` records and
five `settlement_response` status-200 records on November 4, 03:24–05:16Z
(`kronos-forecast`, `http-head`, `whois-lite`, `dns-resolve`, `http-get`). The
sixth request returned handler 400 `missing_email` without a settlement event.
These are application observations, **not independent on-chain verification**.
No funded request was initiated during this investigation.

## Reproduced failure and change

The installed SDK reproduces this sequence with a mocked facilitator:

1. The app initializes one resource server and caches service wrappers.
2. Creating a wrapper for another slug eagerly initializes its HTTP server.
3. That calls the same resource server's `initialize()`, which clears its
   supported-kind/client maps before awaiting the facilitator's `/supported`.
4. A warm wrapper runs during that gap and immediately throws
   `Facilitator does not support …`; the app sanitizes it to `request_failed`.

This proves a source-level race with the same sanitized error and immediate
failure signature. **It does not prove that this caused the historical 502s**:
the original exception was discarded. Other initialization, SDK-processing,
and transport failures remain possible until the new diagnostics are observed.

`SingleInitResourceServer` now single-flights initialization, caches success,
and resets rejection for retry. Each HTTP wrapper still initializes and validates
its own route configuration. Initialization is inside the route's safe catch so
admitted payments are released on failure; the application singleton also retries
after failed initialization. Own-property service lookup and a Map wrapper cache
avoid inherited object-property slugs.

Internal errors add fixed `stage`, allowlisted `errorClass`, `errorCode`, and
optional network-cause code. Returned SDK 5xx responses get a fixed diagnostic
label. No exception message, stack, headers, full payment, upstream URL, or
credential is added. The public payment-pipeline response remains safe JSON 502.

## Dependency and framework decision

| Package | Production | Refreshed PR |
|---|---:|---:|
| Six direct `@x402/*` packages | 2.17.0 (paywall 2.20.0) | 2.29.0, exact pins |
| Next.js | 15.5.22 | 16.4.5, exact pin |
| Direct Zod | 3.25.76 | 4.6.7 |
| Sharp | 0.35.3 | 0.35.5 |
| Axios | 1.19.0 | 1.20.0 |
| follow-redirects | 1.16.0 | 1.16.2 |
| postcss-selector-parser | 6.1.4 | 6.1.5 |

The original PR's other compatible patches, including its separate `apps/api`
patches, are retained. No force audit fix, package downgrade, or Tailwind major
upgrade is used.

Fresh npm metadata declares `@x402/next@2.29.0` peers `next >=16.4.1` and optional
paywall `^2.29.0`; Next 16.4.5 satisfies them and React 19 satisfies both Next
and paywall. The old x402 2.17 package already required Next >=16.2.6, so staying
on Next 15 would retain an unsupported pairing. Next 15.5.29 is a security-only
alternative if the framework migration is deferred, not a supported x402 2.29
solution. `--legacy-peer-deps` remains the repository install mode; it is not
evidence of compatibility.

Next 16 requires Node >=20.9. Production is configured for Node 24; local checks
use Node 22.22.3. A first preview revealed that a broad `engines.node >=20.9`
override selected Node 26 despite that project setting; the override was removed
so deployments retain the existing project Node 24 selection. Dev/build
explicitly select Webpack to retain the shared guard's
`.js` to `.ts` resolution. Next generated the React JSX runtime and dev-type
include changes. The obsolete `next lint` script was removed (the app had no
configured ESLint dependency); `check` is the static check. Existing async params
already satisfy Next 16. No Cache Components or React Compiler migration is added.

Core 2.29 moves untrusted payment schemas to patched Zod 4 and bounds collection
sizes. App direct Zod validates environment strings and enums; it has no use of
removed `.errors` APIs. Do not globally override transitive Zod 3 to a new major.

Published fixes since 2.17 also cover wildcard line terminators, raw/decoded
paths and encoded separators, HEAD protection, facilitator capability validation,
typed timeout errors, and bounded facilitator response bodies. These do not
prevent the app's shared initialization race. The installed 2.29 client defaults
to a 90-second facilitator timeout, longer than this route's 60-second maximum;
an explicit end-to-end timeout budget remains follow-up work and cannot explain
the immediate 0–1 ms failures.

Recent upstream main adds non-object payment-header rejection, facilitator hook
isolation, and stronger exact-EVM malformed-payload checks. These are unpublished
and **not claimed as included in 2.29**. Our request gate already rejects
non-object/oversized incoming envelopes; it does not replace the unpublished
client-response decoder changes or full facilitator validation. See the
[published changelog](https://github.com/x402-foundation/x402/blob/e4a086819f419e9395acbbdc1679fe6627029ff7/typescript/packages/core/CHANGELOG.md),
[decoder change](https://github.com/x402-foundation/x402/commit/3c0a740ef84f5a58215a75b709b2f3332839463c),
[hook change](https://github.com/x402-foundation/x402/commit/70749431c4936e71c874177931b8be3cefe2a0ac),
and [EVM change](https://github.com/x402-foundation/x402/commit/70303ce66282641d1d1b64bd4a54b1c4389ca4e9).

Primary references: [published x402 peer metadata](https://registry.npmjs.org/@x402%2fnext/2.29.0),
[core changelog](https://github.com/x402-foundation/x402/blob/main/typescript/packages/core/CHANGELOG.md),
[Next 16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

## Audit and exposure

Refreshed comparable standalone `npm audit --json` / lockfile audits (findings
include dependent propagation; audit exits 1 because findings remain):

| Lockfile | Critical | High | Moderate | Total |
|---|---:|---:|---:|---:|
| master `babe764` | 1 | 33 | 18 | 52 |
| original PR #24 `fc13c2a` | 0 | 32 | 8 | 40 |
| this upgrade | 0 | 26 | 8 | 34 |

The clean `npm ci --legacy-peer-deps` install summary reports 30
(23 high, 7 moderate), while the standalone audit includes optional lockfile
entries and reports 34. The table uses the broader, comparable standalone audit.

The remaining findings originate in three dependencies:

- **Zod 3**, under CDP SDK and Reown. No patched 3.x exists. The app imports CDP's
  JWT helper, which does not perform Zod collection validation; no exposed
  oversized-collection path was identified there. Reown wallet use still needs
  upstream remediation. The latest CDP SDK still declares Zod 3.
- **decode-uri-component 0.2.2**, in wallet query-string parsing: CPU exhaustion
  on malformed encoded input. Patched 0.5.1 is ESM and outside callers' `^0.2`
  contract; forcing it can break CommonJS wallet code.
- **UUID 8/9**, in MetaMask/wallet dependencies: bounds issue requires v3/v5/v6
  with a supplied buffer. No such app usage was found. A forced UUID major is
  not included.

The wallet tree retains historical optional peer conflicts around wagmi-core,
React/use-sync-external-store, and older ABIType's Zod 3 peer. A normal npm
peer-resolution experiment completed with warnings; the repository legacy
install mode does not yield a clean whole-wallet `npm ls`. The direct x402/Next
requirements were checked separately. This PR does not claim the entire wallet
tree is fully supported or vulnerability-free.

Upstream paywall HTML contains prebundled browser JavaScript. npm overrides do
not rewrite those embedded bundles; wallet security cannot be inferred from
lockfile changes alone. These residuals require an upstream wallet migration
and explicit wallet/funded validation before rollout.

## Validation and release gates

Clean `npm ci --legacy-peer-deps` completed. Local checks: `npm run check`,
`npm run test:unit`, `npm run test:payment`, and
`npm run build` passed. Build emits the existing viem/ox dynamic-import warning.
The sandbox initially returned empty TypeScript subprocess output; the same
build passed outside the sandbox without disabling checks. `apps/api`
`npm run test:security` passed 6/6 outside the sandbox. Shared request-guard
contracts also passed (16/16).

The new in-process payment suite blocks network access and uses a fake
facilitator and fake signatures. It tests the original race, single-flight
capability loading, per-wrapper route validation, failed-init retry and admission
cleanup, unpaid HEAD/encoding/HTML/query variants, malformed-payment rejection,
handler 400 with no settle, replay/use caps, and one mocked success with a
settlement header. This is not a real signature, facilitator, or chain test.

The first exact preview (`c969d4c`, deployment `dpl_9qBQGd7dF4ofLtZoaRvwzyCxQpJg`)
was READY and passed unpaid API/discovery/method/path checks: GET/HEAD/encoded
and browser requests 402 with V2 requirements and full URL binding, unsupported
methods 405, malformed payment 400, and inherited-property slug 404. Its
configuration is Base Sepolia with placeholder merchant/no CDP auth, not a copy
of production configuration. Info-level logs after probes showed expected
402/400 events and no `request_failed`. This preview used Node 26; final runtime
verification follows the engine-override correction described above.

Browser UI verification reached Vercel two-factor sign-in and remains pending
user sign-in. Automatic approval review rejected a protected-fetch call because
it creates/reuses an access-sharing URL; that method was stopped. No security
protection was disabled. A live wallet signing/settlement test is still
pending; funded smoke may run **only on portalv2 after explicit approval**.

Proposed rollout after review and explicit approval: repeat audit on the deploy
host; verify preview and funded portalv2 smoke; stage a production build with the
approved production variables; run unpaid checks; promote only after approval.
Watch CDN 5xx plus info-level `scope=x402` message content and new diagnostic
labels, and confirm lifecycle/settlement behavior. Keep the old deployment ID.

Rollback after approval: restore production alias to
`dpl_FSiCRHDp4qEFKMeTZawWE7YhHkTc` (`babe764`) and verify unpaid requirements,
discovery and domains. No schema/data migration is involved. The old deployment
retains its dependency vulnerabilities; rollback is an availability measure,
not a security fix. Vercel rollback can disable automatic production assignment,
so check project promotion state before the next release.
