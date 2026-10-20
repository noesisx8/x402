/**
 * Optional cross-isolate lock via Upstash Redis REST (Vercel KV).
 * In-memory admission still runs when this is unset or unreachable.
 */

export type RemoteClaim = "claimed" | "busy" | "used" | "capped";

export type RemotePaymentLock = {
  claim(fingerprint: string, ttlSec: number, maxUses: number): Promise<RemoteClaim>;
  finish(fingerprint: string, httpStatus: number, ttlSec: number, maxUses: number): Promise<void>;
};

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

function unwrapPipeline(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => {
      if (item && typeof item === "object" && "result" in item) {
        return (item as { result: unknown }).result;
      }
      return item;
    });
  }
  if (payload && typeof payload === "object" && "result" in payload) {
    return unwrapPipeline((payload as { result: unknown }).result);
  }
  throw new Error("payment_lock_unavailable");
}

export function upstashPaymentLock(restUrl: string, token: string, fetchImpl: FetchLike = fetch): RemotePaymentLock {
  const base = restUrl.replace(/\/$/, "");
  const stateKey = (fingerprint: string) => `x402:pay:state:${fingerprint}`;
  const usesKey = (fingerprint: string) => `x402:pay:uses:${fingerprint}`;
  const lockKey = (fingerprint: string) => `x402:pay:lock:${fingerprint}`;

  async function pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const response = await fetchImpl(`${base}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands),
    });
    if (!response.ok) throw new Error("payment_lock_unavailable");
    return unwrapPipeline(await response.json());
  }

  return {
    async claim(fingerprint, ttlSec, maxUses) {
      const lockTtl = Math.min(90, Math.max(30, ttlSec));
      const [state, uses, locked] = await pipeline([
        ["GET", stateKey(fingerprint)],
        ["GET", usesKey(fingerprint)],
        ["SET", lockKey(fingerprint), "1", "NX", "EX", String(lockTtl)],
      ]);
      const hold = locked === "OK";
      if (state === "used") {
        if (hold) await pipeline([["DEL", lockKey(fingerprint)]]);
        return "used";
      }
      const useCount = Number(uses ?? 0);
      if (Number.isFinite(useCount) && useCount >= maxUses) {
        if (hold) await pipeline([["DEL", lockKey(fingerprint)]]);
        return "capped";
      }
      return hold ? "claimed" : "busy";
    },

    async finish(fingerprint, httpStatus, ttlSec, maxUses) {
      if (httpStatus < 400) {
        await pipeline([
          ["SET", stateKey(fingerprint), "used", "EX", String(ttlSec)],
          ["DEL", lockKey(fingerprint)],
        ]);
        return;
      }
      const [uses] = await pipeline([
        ["INCR", usesKey(fingerprint)],
        ["EXPIRE", usesKey(fingerprint), String(ttlSec)],
        ["DEL", lockKey(fingerprint)],
      ]);
      if (Number(uses) >= maxUses) {
        await pipeline([["SET", stateKey(fingerprint), "used", "EX", String(ttlSec)]]);
      }
    },
  };
}

export function upstashPaymentLockFromEnv(env: NodeJS.ProcessEnv = process.env): RemotePaymentLock | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return upstashPaymentLock(url, token);
}
