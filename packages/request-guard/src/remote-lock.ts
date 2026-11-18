/** Cross-isolate admission via Redis REST. Pending claims never become retryable on lease expiry. */
export type RemoteClaim = "claimed" | "busy" | "used" | "capped" | "unknown";
export type PaymentOutcome = "used" | "retryable" | "unknown";
export type RemotePaymentLock = {
  claim(fingerprint: string, owner: string, ttlSec: number, maxUses: number): Promise<RemoteClaim>;
  finish(fingerprint: string, owner: string, outcome: PaymentOutcome): Promise<boolean>;
};

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

// All reads, the use reservation and the lease acquisition run in a single Redis operation.
const CLAIM = `
local state = redis.call('GET', KEYS[1])
if state == 'used' then return 'used' end
if state == 'unknown' then return 'unknown' end
if redis.call('EXISTS', KEYS[3]) == 1 then return 'busy' end
if state == 'pending' then
  redis.call('SET', KEYS[1], 'unknown', 'KEEPTTL')
  return 'unknown'
end
local uses = tonumber(redis.call('GET', KEYS[2]) or '0')
if uses >= tonumber(ARGV[3]) then return 'capped' end
local ttl = math.max(tonumber(ARGV[2]), redis.call('TTL', KEYS[2]))
redis.call('SET', KEYS[1], 'pending', 'EX', ttl)
redis.call('SET', KEYS[2], uses + 1, 'EX', ttl)
redis.call('SET', KEYS[3], ARGV[1], 'EX', math.min(90, ttl))
return 'claimed'
`;

const FINISH = `
if redis.call('GET', KEYS[3]) ~= ARGV[1] then return 0 end
if ARGV[2] == 'retryable' then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
end
redis.call('DEL', KEYS[3])
return 1
`;

export function upstashPaymentLock(
  restUrl: string,
  token: string,
  fetchImpl: FetchLike = fetch,
  keyPrefix = "x402:pay",
): RemotePaymentLock {
  const base = restUrl.replace(/\/$/, "");
  const keys = (fingerprint: string) => [
    `${keyPrefix}:state:${fingerprint}`,
    `${keyPrefix}:uses:${fingerprint}`,
    `${keyPrefix}:lock:${fingerprint}`,
  ];
  async function evaluate(script: string, fingerprint: string, args: (string | number)[]): Promise<unknown> {
    const response = await fetchImpl(base, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(["EVAL", script, 3, ...keys(fingerprint), ...args]),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("payment_lock_unavailable");
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || "error" in payload || !("result" in payload)) {
      throw new Error("payment_lock_unavailable");
    }
    return (payload as { result: unknown }).result;
  }
  return {
    async claim(fingerprint, owner, ttlSec, maxUses) {
      const result = await evaluate(CLAIM, fingerprint, [owner, ttlSec, maxUses]);
      if (typeof result !== "string" || !["claimed", "busy", "used", "capped", "unknown"].includes(result)) {
        throw new Error("payment_lock_unavailable");
      }
      return result as RemoteClaim;
    },
    async finish(fingerprint, owner, outcome) {
      const result = await evaluate(FINISH, fingerprint, [owner, outcome]);
      if (result !== 0 && result !== 1) throw new Error("payment_lock_unavailable");
      return result === 1;
    },
  };
}

/** Vercel previews use testnet and branch-local keys, never the production ledger. */
export function upstashPaymentLockFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): RemotePaymentLock | null {
  let keyPrefix = "x402:pay";
  if (env.VERCEL_ENV === "preview") {
    if (env.X402_NETWORK_MODE && env.X402_NETWORK_MODE !== "base-sepolia") {
      throw new Error("preview_requires_base_sepolia");
    }
    const branch = env.VERCEL_GIT_COMMIT_REF?.trim();
    if (!branch) throw new Error("preview_payment_branch_missing");
    keyPrefix = `x402:preview:${encodeURIComponent(branch)}:pay`;
  }
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return upstashPaymentLock(url, token, fetchImpl, keyPrefix);
}
