import { z } from "zod";

const networkMode = z.enum(["base-sepolia", "base"]).default("base-sepolia");

export const serverEnv = z
  .object({
    X402_PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
    X402_NETWORK_MODE: networkMode,
    PUBLIC_BASE_URL: z.string().url().optional(),
    CDP_API_KEY_ID: z.string().optional(),
    CDP_API_KEY_SECRET: z.string().optional(),
    ANALYTICS_TOKEN: z.string().optional(),
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
  });

export type NetworkMode = z.infer<typeof networkMode>;

export const CAIP_NETWORK: Record<NetworkMode, `eip155:${number}`> = {
  "base-sepolia": "eip155:84532",
  base: "eip155:8453",
};