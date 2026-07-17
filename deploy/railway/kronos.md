# Railway: kronos-api

## Service

| Field | Value |
|-------|--------|
| Root directory | `apps/kronos-api` |
| Builder | Dockerfile |
| Healthcheck | `GET /health` |
| Start | `sh -c 'exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}'` (shell required for `$PORT` expansion on Dockerfile services) |

## Variables

| Variable | Required | Example |
|----------|----------|---------|
| `KRONOS_API_SECRET` | yes | long random (match Vercel) |
| `KRONOS_DEVICE` | no | `cpu` |
| `KRONOS_MODEL_ID` | no | `NeoQuasar/Kronos-mini` |
| `KRONOS_TOKENIZER_ID` | no | `NeoQuasar/Kronos-Tokenizer-2k` |
| `KRONOS_MAX_LOOKBACK` | no | `256` |
| `KRONOS_MAX_PRED_LEN` | no | `24` |
| `PORT` | auto | Railway injects |

## Resources

- Start **CPU** 1–2 vCPU / 2–4 GB RAM.
- First boot downloads HF weights — healthcheck timeout **300s** in `railway.toml`.
- Upgrade GPU only if p95 forecast &gt; ~25s at default lookback/pred_len.

## After deploy

1. Copy public HTTPS URL → Vercel `KRONOS_API_URL`.
2. Set the same `KRONOS_API_SECRET` on Vercel.
3. Redeploy vending machine.
4. Smoke:

```bash
curl -s "$KRONOS_API_URL/health"
curl -s -X POST "$KRONOS_API_URL/v1/forecast" \
  -H "Authorization: Bearer $KRONOS_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","interval":"1h","lookback":64,"pred_len":6}'
```

## Security

- Bearer required on `/v1/*`.
- Do not expose unauthenticated inference.
- Vending machine must not ship the secret to the browser.
