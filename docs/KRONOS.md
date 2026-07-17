# Kronos + x402 (hybrid deploy)

**Product:** paid research candle forecasts via open-source [Kronos](https://github.com/shiyu-coder/Kronos) (MIT), sold through the Base vending machine.

**Disclaimer:** outputs are **research only**, not financial advice. No guarantee of accuracy or profit.

## Architecture

```text
Agent ──x402 exact USDC──► Vercel apps/vending-machine
                              GET /api/v/kronos-forecast
                              │
                              │  KRONOS_API_URL + Bearer secret
                              ▼
                         Railway apps/kronos-api
                              POST /v1/forecast
                              │  Binance OHLCV + Kronos-mini
                              ▼
                         forecast JSON → settle on Vercel 200
```

| Host | Role |
|------|------|
| **Vercel** | Public x402, catalog, bundles, payment settle |
| **Railway** | Warm Python Kronos inference (CPU first) |
| **portalv2** | Local spike + paid smoke only |

**Not Vercel-only for Kronos:** torch + HF weights do not fit durable serverless inference well.

## Env

### Vercel (`apps/vending-machine`)

| Variable | Notes |
|----------|--------|
| `KRONOS_API_URL` | Railway HTTPS base |
| `KRONOS_API_SECRET` | Shared bearer |
| `X402_MAX_PRICE_USD` | Recommend `0.50` for premium room |

### Railway (`apps/kronos-api`)

| Variable | Notes |
|----------|--------|
| `KRONOS_API_SECRET` | Same as Vercel |
| `KRONOS_MODEL_ID` | default `NeoQuasar/Kronos-mini` |
| `KRONOS_TOKENIZER_ID` | default `NeoQuasar/Kronos-Tokenizer-2k` |
| `KRONOS_DEVICE` | `cpu` (or `cuda` later) |
| `KRONOS_MAX_LOOKBACK` | default `256` |
| `KRONOS_MAX_PRED_LEN` | default `24` |

## SKU

| Slug | Price | Query |
|------|-------|--------|
| `kronos-forecast` | $0.05 | `symbol`, `interval`, `lookback`, `pred_len` |

Allowlist v1: symbols `BTCUSDT`, `ETHUSDT`; intervals `15m`, `1h`, `4h`.

Fail-closed: backend down / bad params → HTTP **400** → **no settle**.

## Ops

1. Deploy Railway from `apps/kronos-api` (Dockerfile).
2. Confirm `GET /health` → `model_loaded: true`.
3. Set Vercel env; redeploy vending machine.
4. Unpaid: `GET …/api/v/kronos-forecast` → 402.
5. portalv2 `/test` paid settle once → Bazaar indexes after ≤10 min.

See also: `deploy/railway/kronos.md`, `apps/kronos-api/README.md`.
