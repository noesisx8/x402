# x402 project context

You are implementing **x402 V2** (payment metadata in headers; `@x402/*` npm org).

## Hard rules

- **Never** bind production API ports on the user's daily-driver Linux box unless they explicitly ask for a one-off testnet smoke test.
- Default deploy: **Railway** (public) and **portalv2** (private). Secrets only in host env / Railway variables — never commit.
- Use **Base mainnet** USDC for production; **Base Sepolia** for integration tests on deploy hosts only.

## Stack

- Node 20+, TypeScript, Express, `@x402/core`, `@x402/evm`, `@x402/express`
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

- FAQ cheat sheet: `docs/CDP_X402_FAQ_REFERENCE.md` ← **https://docs.cdp.coinbase.com/x402/support/faq**
- Service demand: `docs/TOP_X402_SERVICES.md`