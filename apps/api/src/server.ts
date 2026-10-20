/**
 * x402 resource server. The listener lives in index.ts so tests can import the app
 * without binding a port. Enable paid routes only on Railway or portalv2.
 */

import express from "express";
import { z } from "zod";
import {
  clientIpFromHeaders,
  createPaymentGate,
  probeErrorResponse,
  upstashPaymentLockFromEnv,
  type PaymentGate,
  type PublicHttpOptions,
} from "@x402-project/request-guard";
import { attachX402, paymentHeaderOf, routeRequiresPayment, type X402Env } from "./x402.js";
import { readDns, readHttpHead, type DnsResolvers } from "./probes.js";

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  X402_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  X402_NETWORK: z.enum(["base", "base-sepolia"]).default("base"),
  X402_PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  PUBLIC_BASE_URL: z.string().url().optional(),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return envSchema.parse(source);
}

export type CreateAppOptions = {
  /** Replaces facilitator setup. Production uses attachX402. */
  attachPayment?: (app: express.Express, env: X402Env) => Promise<void>;
  gate?: PaymentGate;
  dns?: DnsResolvers;
  http?: PublicHttpOptions;
};

function clientIp(req: express.Request): string {
  return clientIpFromHeaders({
    get(name) {
      return req.header(name) ?? null;
    },
  });
}

function x402EnvOf(env: ApiEnv): X402Env {
  return {
    payTo: env.X402_PAY_TO_ADDRESS,
    network: env.X402_NETWORK,
    facilitatorUrl: env.X402_FACILITATOR_URL,
  };
}

export async function createApp(env: ApiEnv, options: CreateAppOptions = {}): Promise<express.Express> {
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
      "x402 utility API. See /.well-known/x402. Paid routes: /v1/dns, /v1/http-head (402 without payment when X402_ENABLED=true).\n",
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
    return app;
  }

  const paid = x402EnvOf(env);
  const gate = options.gate ?? createPaymentGate({ remote: upstashPaymentLockFromEnv() });

  app.use(async (req, res, next) => {
    try {
      if (!routeRequiresPayment(paid, req.path, req.method)) {
        next();
        return;
      }
      const header = paymentHeaderOf(req);
      const ip = clientIp(req);
      if (!header) {
        const limit = gate.takeUnpaid(ip, req.path);
        if (!limit.allowed) {
          res.set("Retry-After", String(limit.retryAfterSec));
          res.status(429).json({ error: "rate_limited", retry_after_sec: limit.retryAfterSec });
          return;
        }
        next();
        return;
      }
      const admission = await gate.begin(header, ip);
      if (!admission.ok) {
        if (admission.retryAfterSec) res.set("Retry-After", String(admission.retryAfterSec));
        res.status(admission.status).json({
          error: admission.error,
          ...(admission.retryAfterSec ? { retry_after_sec: admission.retryAfterSec } : {}),
        });
        return;
      }
      res.on("finish", () => {
        void admission.finish(res.statusCode || 500);
      });
      next();
    } catch {
      if (!res.headersSent) res.status(400).json({ error: "payment_malformed" });
    }
  });

  await (options.attachPayment ?? attachX402)(app, paid);

  app.get("/v1/dns", async (req, res) => {
    const host = String(req.query.host ?? "").trim();
    try {
      const found = await readDns(host, options.dns);
      res.json(found);
    } catch (error) {
      const body = probeErrorResponse(error);
      res.status(body.status).json({ error: body.error });
    }
  });

  app.get("/v1/http-head", async (req, res) => {
    const url = String(req.query.url ?? "").trim();
    try {
      const head = await readHttpHead(url, options.http);
      res.json(head);
    } catch (error) {
      const body = probeErrorResponse(error);
      res.status(body.status).json({ error: body.error });
    }
  });

  return app;
}
