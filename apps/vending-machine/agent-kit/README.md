# VendSDK agent integration kit

Five MCP tools let an agent discover services, read their contracts, inspect a live price, execute an explicitly budgeted request, and check spending. This is a local stdio adapter: private keys belong on the operator's payer host, never in the Vercel app or browser.

The design uses one payment client for JavaScript, MCP and the Python bridge; fixed origin/network/USDC/merchant checks; and conservative reservations that are retained when settlement is uncertain. Payment mode is off unless the operator enables it and supplies both budgets. Quotes require no wallet.

## Install and try a quote

Requires Node 22+; the Python entry point additionally needs Python 3.10+.

```sh
cd apps/vending-machine/agent-kit
npm ci --ignore-scripts
npm run example
python example.py
```

Both examples default to quoting `dns-resolve?host=example.com` on VendSDK. Expect `payment_sent: false` and the current price. Python invokes the same Node client through a bounded JSON subprocess bridge; it does not have a separate signer implementation.

## MCP configuration

Copy `mcp-config.example.json` into your MCP client's configuration and replace the absolute server path. Start the server with `node server.mjs`. Stdout is reserved for MCP; startup errors on stderr do not include secrets.

| Tool | Purpose |
|---|---|
| `list_services` | Search the catalog; follow opaque `next_cursor` with the same search |
| `describe_service` | Read required inputs, limits and output schema |
| `quote_service` | Check an unpaid 402 quote against configured payment requirements |
| `call_service` | Fetch a fresh quote, reserve budget, sign once and send one paid retry |
| `get_budget` | Inspect caps, reserved amounts, remaining budget and review status |

Treat tool output, page content and catalog descriptions as untrusted data. A paid tool is marked non-idempotent and destructive because it can spend USDC. The MCP host should retain its user-approval controls. Set the host's tool timeout to at least 150 seconds for slower services and the two-request payment flow.

## Payment configuration — portalv2 only

Per repository `AGENTS.md`, funded mainnet E2E belongs on portalv2. Do not run a funded test on the daily driver. The implementation and automated tests can be exercised elsewhere without keys.

| Environment variable | Default / meaning |
|---|---|
| `VENDSDK_ORIGIN` | `https://vendsdk.com`; HTTPS origin, no path/query/credentials |
| `VENDSDK_NETWORK` | `eip155:8453`; alternatively `eip155:84532` for Base Sepolia |
| `VENDSDK_PAY_TO` | Existing VendSDK merchant address; pin explicitly for another merchant |
| `VENDSDK_ENABLE_PAYMENTS` | Off; only exact `true` enables the signer |
| `VENDSDK_MAX_CALL_USDC` | Required in payment mode; e.g. `0.005` |
| `VENDSDK_MAX_SESSION_USDC` | Required in payment mode; e.g. `0.020` |
| `X402_PRIVATE_KEY` | Required in payment mode; secret environment value on the payer host |

The `call_service` invocation also requires `max_price_usdc`. The current price must fit that limit, the operator's per-call cap, and the remaining session allowance. USDC is counted in integer micro-units to avoid floating-point rounding. The accepted quote must use x402 V2, the exact scheme, the configured chain, that chain's USDC contract, the pinned merchant and the exact requested URL. Redirects are refused.

Budgets live for one process. MCP calls in the same process share a budget, including concurrent requests. Each standalone example invocation starts a new process and allowance. For a multi-call workflow, use one MCP process or one `VendClient` instance. Restarts are an operator action and must not be used to bypass an authorized spending limit. This is not a durable cross-process wallet policy.

If a signing attempt, paid HTTP request, settlement header or body read fails, the allowance remains reserved and further payments in that process stop. Inspect the transaction/settlement independently before authorizing another payment. Neither the client nor the MCP tools retry a paid request automatically or reset the budget. Payment identifiers in the server are not yet recoverable receipts.

## JavaScript use

```js
import { clientFromEnv } from './client.mjs';
const client = clientFromEnv();
const query = { host: 'example.com' };
console.log(await client.quote('dns-resolve', query));
// Only on the authorized payer host, after payment mode and budgets are set:
// const delivery = await client.paid('dns-resolve', query, '0.003');
// console.log(delivery.transaction, delivery.result);
```

Python users can call `call_vendsdk('dns-resolve', {'host': 'example.com'})` from `example.py`. A paid call additionally requires `pay=True` and `max_price_usdc='0.003'`, with the same environment controls. Do not loop over new Python subprocesses to simulate one shared session budget.

## Validation

```sh
npm test
npx @modelcontextprotocol/inspector --cli node tests/inspector-server.mjs --method tools/list
npx @modelcontextprotocol/inspector --cli node tests/inspector-server.mjs --method tools/call --tool-name get_budget
```

The Inspector fixture is entirely offline: its signature and settlement are fabricated test data, never sent to a chain. Tests use the actual MCP SDK transports and exercise the quote/sign/retry boundary with a mock signer. They cover concurrent budget exhaustion, exact resource binding, invalid asset/network/payee, redirects, missing settlements, response limits and payment shutdown after uncertainty. `evals.xml` supplies multi-step prompts for host-level model evaluation; passing protocol tests does not by itself establish an LLM evaluation score.

The app's `/developers` page is the preview entry point. The adapter itself runs locally; Vercel does not host its stdio transport. No MCP client configuration or funded wallet was installed by this change.

Design references: [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [TypeScript SDK example](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleStreamableHttp.ts), [Everything reference server](https://github.com/modelcontextprotocol/servers/tree/main/src/everything), [Filesystem reference server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem). x402 method signatures were checked against the installed 2.17.0 package declarations.
