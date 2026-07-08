# Coinbase CDP x402 — FAQ reference (for this repo)

Canonical source: **https://docs.cdp.coinbase.com/x402/support/faq**

Use this page when configuring `apps/vending-machine`, `apps/api`, or deploy env. It is a **curated cheat sheet**, not a substitute for the live docs.

---

## Facilitators

### Who runs facilitators?

Coinbase Developer Platform (CDP) operates the first production facilitator. Others can self-host from the open x402 codebase (many EVM networks). Community directories: [x402scan](https://x402scan.com), Agentic.Market, Pay.sh, ampersend discover.

### Free testnet without CDP signup?

**Yes.** `https://x402.org/facilitator` — no API keys. **Base Sepolia** and **Solana Devnet** only. Good for demos and local smoke (402 without settle).

### Production recommendation?

**CDP facilitator** for testnet **and** mainnet: `https://api.cdp.coinbase.com/platform/v2/x402` with **CDP API keys** on the resource server (verify/settle). Free tier: **1,000 tx/month**, then **$0.001/tx** (gas still on-chain separately). See [Facilitator pricing](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator#pricing).

| Facilitator | URL | Networks | Auth |
|-------------|-----|----------|------|
| **CDP (recommended)** | `https://api.cdp.coinbase.com/platform/v2/x402` | Base, Base Sepolia, Polygon, Arbitrum, World, Solana, devnets | CDP API keys |
| x402.org (testnet) | `https://x402.org/facilitator` | Base Sepolia, Solana Devnet | None |

**This repo default:** vending-machine `.env.example` uses x402.org for zero-friction dev; **switch URL + keys for Vercel prod** and Bazaar listing.

---

## Networks & money

- **Network IDs (CAIP):** Base `eip155:8453`, Base Sepolia `eip155:84532` (see [Network support](https://docs.cdp.coinbase.com/x402/network-support)).
- **CDP supports ERC-20 on EVM** via **EIP-3009** (USDC, EURC — gasless auth) or **Permit2** (other ERC-20).
- **Scheme:** we use **`exact`** (per-request USDC amount) in middleware/route config.

---

## Buyer / seller flow (FAQ-aligned)

1. Client requests protected resource → **402** + `PAYMENT-REQUIRED`.
2. Client signs payment payload (scope includes URL/method; body binding depends on scheme).
3. Client retries with **`PAYMENT-SIGNATURE`** (SDKs often handle POST to resource server).
4. Resource server **verifies** (local or facilitator `/verify`).
5. Handler runs; on success (typically status **&lt; 400**), **settle** via facilitator `/settle` or direct chain.
6. Client receives payload.

**POST APIs:** use `declareDiscoveryExtension` with `bodyType: "json"` and `inputSchema` for Bazaar — see [Bazaar POST example](https://docs.cdp.coinbase.com/x402/bazaar#discovery-extension-options).

---

## Bazaar (discovery layer)

- **CDP Bazaar** indexes services that use the **CDP facilitator** and complete **verify + settle** at least once per listed URL.
- **Read-only discovery APIs** (`GET …/discovery/*`) do **not** require API keys; your **seller** still needs CDP keys for verify/settle.
- **Test Bazaar:** CDP facilitator on Base Sepolia + CDP keys — same discovery endpoints as prod testnet.
- **x402.org** has a **separate** catalog: `https://x402.org/facilitator/discovery/resources` — not the CDP Bazaar.

**Our vending machine today:** `/.well-known/agent-services.json` + OpenAPI are **self-hosted** discovery. To appear in **CDP Bazaar**, point facilitator at CDP, register `bazaarResourceServerExtension` + `declareDiscoveryExtension()` per [Bazaar seller integration](https://docs.cdp.coinbase.com/x402/bazaar#seller-integration).

---

## Extensions (beyond pay)

- **Bazaar** — marketplace listing (above).
- **Sign-in-with-x** — auth extension (see FAQ / extensions docs).

---

## Buyers (quick pointers)

- Wallet with USDC on chosen network (CDP non-custodial wallet, viem, AgentKit, etc.).
- [Quickstart for buyers](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers).
- Env for CDP wallet flows often includes `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` (buyer side — **not** the same as seller facilitator keys, but same CDP account family).

---

## Sellers (quick pointers)

- [Quickstart for sellers](https://docs.cdp.coinbase.com/x402/quickstart-for-sellers) — middleware, payTo, facilitator URL, route examples.
- **Profitability:** facilitator fee + gas + upstream API cost; cap max payment per route; log 402 vs paid 200.

---

## FAQ topics to read on the live page

When debugging, open the full FAQ for sections on:

- Facilitator choice, outages, and self-hosting
- Testnet vs mainnet wallets and USDC
- Payment failures, verify errors, settlement timing
- Supported tokens and networks
- Agent / MCP / Bazaar discovery
- Security and request binding

---

## Map to this monorepo

| App | Facilitator env | Discovery |
|-----|-----------------|-----------|
| `apps/vending-machine` | `X402_FACILITATOR_URL`, optional `CDP_API_KEY_*` | Local well-known + OpenAPI; CDP Bazaar = follow-up |
| `apps/api` | Same pattern via Express `@x402/express` | `/.well-known/x402` |

**Security checklist:** `docs/SECURITY.md`  
**Service demand research:** `docs/TOP_X402_SERVICES.md`