# portalv2 deployment

Run the same `apps/api` artifact on **portalv2** when you want private/Tailscale access or colocate with other homelab services.

## Build on portalv2 (recommended)

```bash
cd /path/to/x402/apps/api
npm ci
npm run build
```

## Environment

Copy `apps/api/.env.example` → `/etc/x402-api.env` (root-only, mode 600). Fill CDP keys and `X402_PAY_TO_ADDRESS`.

## systemd unit (example)

File: `/etc/systemd/system/x402-api.service`

```ini
[Unit]
Description=x402 utility API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=x402
WorkingDirectory=/opt/x402/apps/api
EnvironmentFile=/etc/x402-api.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
# Bind only on portalv2 — expose via Tailscale Serve if needed
Environment=PORT=18080

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now x402-api
curl -sS http://127.0.0.1:18080/health
```

## Daily driver rule

Sync code via git; **do not** enable this unit on the daily-driver machine. SSH to portalv2 for deploy/restart.

## Tailscale Serve (optional)

Mirror your Hermes dashboard pattern: serve `https://<portalv2>.<tailnet>.ts.net/x402` → `http://127.0.0.1:18080` with basic auth in front of paid routes if exposed.