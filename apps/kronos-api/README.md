# kronos-api

Private **Kronos** inference service for the x402 vending machine.

- **Public payments:** Vercel `GET /api/v/kronos-forecast` (x402)
- **This service:** `POST /v1/forecast` with `Authorization: Bearer $KRONOS_API_SECRET`

## Local (portalv2)

```bash
cd apps/kronos-api
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
git clone --depth 1 https://github.com/shiyu-coder/Kronos.git /path/to/Kronos
set KRONOS_REPO_PATH=C:\path\to\Kronos
set KRONOS_API_SECRET=dev-secret
set KRONOS_DEVICE=cpu
uvicorn app.main:app --host 127.0.0.1 --port 8080
```

Health: `GET http://127.0.0.1:8080/health`  
Forecast:

```bash
curl -s -X POST http://127.0.0.1:8080/v1/forecast \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d "{\"symbol\":\"BTCUSDT\",\"interval\":\"1h\",\"lookback\":64,\"pred_len\":6}"
```

## Railway

1. New service, root `apps/kronos-api`, Dockerfile builder.
2. Set `KRONOS_API_SECRET` (same as Vercel).
3. Optional: `KRONOS_MODEL_ID`, `KRONOS_TOKENIZER_ID`, `KRONOS_MAX_LOOKBACK=256`, `KRONOS_MAX_PRED_LEN=24`.
4. First deploy may take several minutes (torch + HF weights).
5. Point Vercel `KRONOS_API_URL` at the Railway HTTPS URL.

## Security

- Never leave this service open without Bearer auth.
- Do not put `KRONOS_API_SECRET` in the repo.
- Vending handler fails closed (400, no settle) if this API is down.
