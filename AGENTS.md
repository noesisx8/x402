# x402 project context

You are implementing **x402 V2** (payment metadata in headers; `@x402/*` npm org).

## Host roles (read first)

| Host | Role |
|------|------|
| **portalv2** | Ops PC — paid E2E, private API, secrets, deploy tooling |
| **pikatop** | **Daily driver** — coding only; never production listeners or funded mainnet keys |
| **Vercel / Railway** | Public production |

See `docs/HOSTS.md`.

## GitHub

- **Always use GitHub user `noesisx8`** for this repo (push, PRs, forks, awesome-x402).
- If `gh auth status` shows another account active, switch: `gh auth switch --user noesisx8`.
- Do **not** use `fourthdensity` for `noesisx8/x402`.

## Hard rules

- **Never** bind production API ports or run funded mainnet payer scripts on **pikatop** (daily driver) unless the user explicitly opts into a one-off testnet experiment.
- Default deploy: **Vercel** (vending machine), **Railway** (public API), **portalv2** (private / Tailscale ops).
- Secrets only in host env / Vercel / Railway variables — never commit.
- Use **Base mainnet** USDC for production; **Base Sepolia** for integration tests on **portalv2** only.
- Paid smoke: `cd apps/vending-machine && X402_PRIVATE_KEY=0x… npm run smoke:paid` **on portalv2**.

## Stack

- Node 20+, TypeScript, Express, `@x402/core`, `@x402/evm`, `@x402/express` / `@x402/next`
- Facilitator: Coinbase CDP (hosted) via `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`
- Receiver: `X402_PAY_TO_ADDRESS` (EVM)

## Security checklist (every change)

- Request binding / `requestHash` alignment with facilitator
- Idempotent settlement keys for retries
- Finality window before delivering premium payload
- Rate limits + max payment amount caps
- No private keys in repo; use KMS or host secret store

## Profitability

- Target **50%+ margin** after facilitator + infra + upstream data costs
- Log: 402 count, paid conversion, revenue/call, agent vs human `User-Agent`
- Prefer **exact** scheme first; add **batch-settlement** when volume > ~1k tx/day

## Docs (Coinbase CDP)

- Hosts: `docs/HOSTS.md`
- Phase 0: `docs/PHASE0_STATUS.md`
- FAQ cheat sheet: `docs/CDP_X402_FAQ_REFERENCE.md`
- Service demand: `docs/TOP_X402_SERVICES.md`
- Hub roadmap: `docs/ROADMAP_ULTIMATE_VENDING_HUB.md`
