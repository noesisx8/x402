/**
 * In-memory payment lifecycle analytics (Phase 0.6).
 * Survives within a serverless isolate only — enough for ops smoke + admin debug.
 * No secrets, no full payment payloads.
 */

export type AnalyticsEvent =
  | "402_issued"
  | "payment_present"
  | "verify_context"
  | "handler_ok"
  | "handler_fail"
  | "200_delivered"
  | "settlement_response"
  | "rate_limited"
  | "error";

export type CallLog = {
  event: AnalyticsEvent;
  slug: string;
  status?: number;
  ms?: number;
  /** Truncated payer hint when known from payment header (never full secrets). */
  payerHint?: string;
  userAgentHint?: string;
  error?: string;
  at: string;
};

const MAX = 500;
const buffer: CallLog[] = [];

export type LogInput = Omit<CallLog, "at">;

export async function logCall(partial: LogInput): Promise<void> {
  buffer.push({ ...partial, at: new Date().toISOString() });
  if (buffer.length > MAX) buffer.shift();

  // Paid deliveries are also persisted cross-isolate so the public ticker works.
  // Privacy: no payer hints in the shared store — slug + latency + time only.
  if (partial.event === "200_delivered") {
    await persistSettlement({
      slug: partial.slug,
      ms: partial.ms ?? null,
      at: new Date().toISOString(),
    });
  }

  // Structured line for Vercel/runtime log drains
  const line = {
    scope: "x402",
    ...partial,
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(line));
}

/* ------------------------------------------------------------------
 * Cross-isolate settlement store (Upstash Redis / Vercel KV via REST).
 * Vercel runs each API route in its own function instance, so the
 * in-memory ring buffer above is invisible to /api/stats/public.
 * When Redis env vars are absent, everything falls back to in-memory.
 * ------------------------------------------------------------------ */

export type SettlementRecord = {
  slug: string;
  ms: number | null;
  at: string;
};

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const SETTLEMENTS_KEY = "x402:settlements";
const SETTLEMENTS_MAX = 49; // LPUSH newest-first, LTRIM keeps 50

function redisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/** Best-effort persist; never throws into the request path. */
export async function persistSettlement(rec: SettlementRecord): Promise<void> {
  if (!redisConfigured()) return;
  try {
    await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${REDIS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["LPUSH", SETTLEMENTS_KEY, JSON.stringify(rec)],
        ["LTRIM", SETTLEMENTS_KEY, 0, SETTLEMENTS_MAX],
      ]),
    });
  } catch {
    // Redis hiccup — analytics must never break a paid response
  }
}

/** Newest-first persisted settlements, or null when Redis is not configured. */
export async function getPersistedSettlements(limit = 20): Promise<SettlementRecord[] | null> {
  if (!redisConfigured()) return null;
  try {
    const res = await fetch(`${REDIS_URL}/lrange/${SETTLEMENTS_KEY}/0/${limit - 1}`, {
      headers: { authorization: `Bearer ${REDIS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string[] };
    return (json.result ?? [])
      .map((s) => {
        try {
          return JSON.parse(s) as SettlementRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is SettlementRecord => r !== null);
  } catch {
    return null;
  }
}

export function getRecentAnalytics(limit = 50): CallLog[] {
  return buffer.slice(-limit).reverse();
}

export function getAnalyticsSummary(): {
  total: number;
  byEvent: Record<string, number>;
  bySlug: Record<string, number>;
} {
  const byEvent: Record<string, number> = {};
  const bySlug: Record<string, number> = {};
  for (const e of buffer) {
    byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
    bySlug[e.slug] = (bySlug[e.slug] ?? 0) + 1;
  }
  return { total: buffer.length, byEvent, bySlug };
}

/** Short UA class for agent vs browser heuristics. */
export function userAgentHint(ua: string | null): string {
  if (!ua) return "unknown";
  const s = ua.slice(0, 80);
  if (/bot|agent|curl|python|axios|httpx|fetch/i.test(s)) return `agent:${s.slice(0, 40)}`;
  if (/mozilla|chrome|safari/i.test(s)) return "browser";
  return s.slice(0, 40);
}

/**
 * Extract a non-sensitive payer hint from payment-signature / x-payment header.
 * Prefer truncated address-like substrings; never log the full payload.
 */
export function payerHintFromPaymentHeader(header: string | null): string | undefined {
  if (!header) return undefined;
  // Common: base64 JSON or raw JSON with "from" / "payer" / "payload.authorization.from"
  try {
    let raw = header;
    // strip "eip155:..." prefixes if present
    if (!raw.startsWith("{") && !raw.startsWith("eyJ")) {
      // may be base64
    }
    if (raw.startsWith("eyJ")) {
      // base64url JWT-like or base64 JSON — try base64 decode of first segment
      const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
      const json = Buffer.from(b64.slice(0, 4000), "base64").toString("utf8");
      raw = json;
    }
    const addr = raw.match(/0x[a-fA-F0-9]{40}/);
    if (addr) {
      const a = addr[0];
      return `${a.slice(0, 6)}…${a.slice(-4)}`;
    }
  } catch {
    // ignore
  }
  return `len:${header.length}`;
}
