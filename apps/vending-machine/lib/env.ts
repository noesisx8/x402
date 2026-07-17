import { z } from "zod";

const networkMode = z.enum(["base-sepolia", "base"]).default("base-sepolia");

/**
 * Server env for paid routes.
 * Placeholder pay-to allows `next build` without secrets; production MUST set real values.
 */
export const serverEnv = z
  .object({
    X402_PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
    X402_NETWORK_MODE: networkMode,
    PUBLIC_BASE_URL: z.string().url().optional(),
    CDP_API_KEY_ID: z.string().optional(),
    CDP_API_KEY_SECRET: z.string().optional(),
    /** Protects /api/admin/stats full payload */
    ANALYTICS_TOKEN: z.string().optional(),
    /** Optional override; default 0.05 via pricing.ts — set 0.50 for premium Kronos tiers */
    X402_MAX_PRICE_USD: z.string().optional(),
    /** Railway / portalv2 Kronos inference base URL (no trailing slash required) */
    KRONOS_API_URL: z.string().url().optional(),
    /** Shared secret for Authorization: Bearer on kronos-api */
    KRONOS_API_SECRET: z.string().optional(),
  })
  .parse({
    X402_PAY_TO_ADDRESS:
      process.env.X402_PAY_TO_ADDRESS?.trim() ||
      "0x1111111111111111111111111111111111111111",
    X402_FACILITATOR_URL: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    X402_NETWORK_MODE: process.env.X402_NETWORK_MODE ?? "base-sepolia",
    PUBLIC_BASE_URL:
      process.env.PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
    CDP_API_KEY_ID: process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET,
    ANALYTICS_TOKEN: process.env.ANALYTICS_TOKEN,
    X402_MAX_PRICE_USD: process.env.X402_MAX_PRICE_USD,
    KRONOS_API_URL: process.env.KRONOS_API_URL?.trim() || undefined,
    KRONOS_API_SECRET: process.env.KRONOS_API_SECRET,
  });

export type NetworkMode = z.infer<typeof networkMode>;

export const CAIP_NETWORK: Record<NetworkMode, `eip155:${number}`> = {
  "base-sepolia": "eip155:84532",
  base: "eip155:8453",
};

/** True when pay-to is still the build placeholder (not a real merchant wallet). */
export function isPlaceholderPayTo(addr = serverEnv.X402_PAY_TO_ADDRESS): boolean {
  return /^0x1{40}$/i.test(addr) || addr.toLowerCase() === "0x1111111111111111111111111111111111111111";
}
