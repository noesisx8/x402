/**
 * x402 resource server — run on Railway or portalv2 only (see repo README).
 */
import express from "express";
import { z } from "zod";
import * as dns from "node:dns/promises";
import { attachX402 } from "./x402.js";

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  X402_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  X402_NETWORK: z.enum(["base", "base-sepolia"]).default("base"),
  X402_PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  PUBLIC_BASE_URL: z.string().url().optional(),
});

const env = envSchema.parse(process.env);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "x402-api",
    x402Enabled: env.X402_ENABLED,
    network: env.X402_NETWORK,
  });
});

app.get("/.well-known/x402", (_req, res) => {
  res.json({
    version: 2,
    name: "x402-project-utility-api",
    description: "Pay-per-call utility lookups for agents",
    network: env.X402_NETWORK,
    endpoints: [
      { path: "/v1/dns", scheme: "exact", priceHint: "0.003", asset: "USDC" },
      { path: "/v1/http-head", scheme: "exact", priceHint: "0.002", asset: "USDC" },
    ],
    contact: env.PUBLIC_BASE_URL ?? null,
  });
});

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    "x402 utility API. See /.well-known/x402. Paid routes: /v1/dns, /v1/http-head (402 without payment when X402_ENABLED=true).\n"
  );
});

if (!env.X402_ENABLED) {
  const disabled = (route: string) => (_req: express.Request, res: express.Response) => {
    res.status(503).json({
      error: "x402_disabled",
      message:
        "Set X402_ENABLED=true on Railway or portalv2. Do not enable the API listener on the daily-driver machine.",
      route,
    });
  };
  app.get("/v1/dns", disabled("/v1/dns"));
  app.get("/v1/http-head", disabled("/v1/http-head"));
} else {
  await attachX402(app, {
    payTo: env.X402_PAY_TO_ADDRESS,
    network: env.X402_NETWORK,
    facilitatorUrl: env.X402_FACILITATOR_URL,
  });

  app.get("/v1/dns", async (req, res) => {
    const host = String(req.query.host ?? "").trim().toLowerCase();
    if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) {
      res.status(400).json({ error: "invalid_host" });
      return;
    }
    try {
      const [a, aaaa] = await Promise.all([
        dns.resolve4(host).catch(() => [] as string[]),
        dns.resolve6(host).catch(() => [] as string[]),
      ]);
      res.json({ host, a, aaaa });
    } catch (e) {
      res.status(502).json({ error: "dns_failed", detail: String(e) });
    }
  });

  app.get("/v1/http-head", async (req, res) => {
    const url = String(req.query.url ?? "").trim();
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        res.status(400).json({ error: "invalid_url" });
        return;
      }
      const started = Date.now();
      const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
      const ms = Date.now() - started;
      res.json({
        url,
        status: response.status,
        ms,
        headers: {
          "content-type": response.headers.get("content-type"),
          server: response.headers.get("server"),
        },
      });
    } catch (e) {
      res.status(502).json({ error: "head_failed", detail: String(e) });
    }
  });
}

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`x402-api listening on :${env.PORT} (x402=${env.X402_ENABLED})`);
});