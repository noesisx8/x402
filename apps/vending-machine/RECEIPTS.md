# Recoverable payment receipts

This preview adds opt-in recovery for exact EIP-3009 USDC payments on Base and Base Sepolia. Existing calls without `X-VendSDK-Receipt` use the normal payment path. Permit2 and `upto` authorizations are not supported by this recovery implementation.

## Storage and retention

The server reuses configured Upstash/Vercel KV REST credentials (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). No new account is created and there is no in-memory production fallback. Requests opting into receipts fail closed if storage cannot be reached. `GET /api/receipts` reports configuration availability, not a connectivity guarantee.

Keys use `vendsdk:receipts:v1:<VERCEL_ENV or local>` to separate preview and production. An atomic Redis script claims the receipt capability hash and a network/USDC/payer/authorization-nonce index together. A second script checks state before changing it and writing results. Redis must support EVAL and the documented commands; use a durable, non-evicting deployment. Budget storage for paid result volume and provider backups. No environment values or raw payment signatures are stored in receipts.

Results expire after 24 hours and are capped at 128 KiB before settlement. Metadata and authorization tombstones expire after seven days. Only short-lived authorizations (validBefore no more than ten minutes ahead) are accepted for recovery. Metadata includes payer, merchant, amount, network, nonce, state and transaction; the exact URL/query binding is hashed. Results may themselves contain sensitive service data, so restrict Redis access and configure provider retention/backups appropriately.

## Client flow

1. Check `GET /api/receipts`, then enable `VENDSDK_ENABLE_RECEIPTS=true` in the agent kit. Normal payment consent, signer configuration and spending caps still apply.
2. Generate a cryptographically random 32-byte lowercase hex capability before the paid request. Send it in `X-VendSDK-Receipt` with the signed request. The capability is a bearer secret: never put it in URLs or logs, and never confuse it with a wallet key.
3. The kit generates a token internally and returns only a local `receipt_handle`. On an uncertain-payment error, use MCP `recover_receipt` with that handle in the same process. It never signs or releases budget.
4. For recovery after a process restart, your application must securely persist its own token **before** payment and pass it as the fourth argument to `client.paid(slug, query, maxPrice, token)`. Retrieve with `client.recover(token, optionalTransaction)`. The supplied examples do not automatically persist secrets to disk.
5. HTTP callers use `POST /api/receipts` with `Authorization: Bearer <saved capability>`. There is no request body. For reconciliation, additionally send `X-VendSDK-Transaction: <known transaction hash>`.

The server stores only the SHA-256 capability hash. Possession of the original capability authorizes reading its one receipt. The payment is verified before the server claims storage or executes a service. The receipt is bound to the exact resource/query, payer and authorization nonce; an existing capability used for another binding returns 409. A different capability cannot claim the same nonce. Repeating the original paid request with the same capability returns the stored result only after settlement, without executing or settling again. Prefer the retrieval endpoint: it does not carry a payment signature at all.

## States and ambiguous settlement

| State | Meaning and permitted recovery |
|---|---|
| `pending` | Verified request claimed; result not yet prepared. Retrieval returns 202. A crash here never restarts execution automatically. |
| `prepared` | Result durably stored; settlement has not started. Retrieval returns 202. |
| `settling` | State persisted before calling the facilitator. Outcome may be unknown; retrieval returns 202. |
| `settled` | Facilitator confirmed success or chain evidence was verified. Retrieval returns 200 with result and transaction. |
| `failed` | Handler or preparation failed before settlement; result is removed and retrieval returns 409. |
| expired | After 24 hours, retrieval returns 410 while metadata remains; after metadata expiry, 404. No automatic execution or repayment. |

The SDK contains after-settlement hook failures, so the original response can succeed even if confirmation storage fails. The pre-settlement result remains in `settling` and can be reconciled. Recovery requires a known transaction hash and checks a successful receipt with at least 12 confirmations, the exact USDC contract, the payer's matching `AuthorizationUsed` nonce event, and the matching amount/merchant `Transfer` event. Cancellation, nonce consumption alone, another payer/asset/amount, a reverted transaction and insufficient confirmations are rejected. This follows the [EIP-3009 events](https://eips.ethereum.org/EIPS/eip-3009). RPC reads use the pinned Base/Base Sepolia chain endpoints; retrieval does not submit a transaction.

If both the facilitator response and transaction hash are lost, the operator must obtain the hash from facilitator/chain records. This preview does not scan chain history automatically. A failed or expired receipt is not a refund promise. The system does not claim it can know whether response bytes reached the caller; repeated delivery is safe and does not change settlement state.

## Validation and release gate

`npm run test:receipts` exercises receipt binding, concurrency, failed/oversized/expired/unauthorized results, Redis transport failures and reconciliation evidence. Integration tests use the actual installed Next x402 wrapper and a mock facilitator, including lost settlement responses and storage failures before/after settlement. `npm run test:agent` covers client/MCP recovery without signing again or revealing capabilities. These are not real-money tests or a real Redis failover test.

Before release, run paid E2E **on portalv2 only** with dedicated test storage: verify atomic claims across two app instances, receipt expiration, a dropped client connection after settlement, and recovery after restarting the client with a securely saved token. Confirm the deployed facilitator's real EIP-3009 payload and transaction evidence, configured Redis EVAL support/retention, and the Base RPC endpoint. Production merge remains pending review.
