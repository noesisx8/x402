import { RECORD_TTL, RESULT_TTL, ReceiptError, type ReceiptRecord, type ReceiptState, type ReceiptStore } from "./receipts";

// Both indexes are claimed in one Redis operation. There is no process-local fallback.
export const CLAIM = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
return 1`;
export const TRANSITION = `
local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
local rec = cjson.decode(raw); local allowed = cjson.decode(ARGV[1]); local ok = false
for _, state in ipairs(allowed) do if rec.state == state then ok = true end end
if not ok then return 0 end
local ttl = redis.call('TTL', KEYS[1]); if ttl <= 0 then return 0 end
if ARGV[3] ~= '' then
  local time = redis.call('TIME'); local remaining = math.floor(rec.expires / 1000 - tonumber(time[1]))
  if remaining <= 0 then return 0 end
  redis.call('SET', KEYS[2], ARGV[3], 'EX', math.min(remaining, tonumber(ARGV[5])))
end
rec.state = ARGV[2]
if ARGV[4] ~= '' then rec.transaction = ARGV[4] end
if rec.state == 'failed' then redis.call('DEL', KEYS[2]) end
redis.call('SET', KEYS[1], cjson.encode(rec), 'EX', ttl)
return 1`;

export class RedisReceiptStore implements ReceiptStore {
  constructor(private url: string, private token: string, private prefix: string, private fetchFn: typeof fetch = fetch) {}
  private key(id: string) { return `${this.prefix}:record:${id}`; }
  private async command(args: (string | number)[]) {
    try {
      const res = await this.fetchFn(this.url, { method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify(args), signal: AbortSignal.timeout(2000), cache: "no-store", redirect: "error" });
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (body.error || !("result" in body)) throw new Error();
      return body.result;
    } catch { throw new ReceiptError("receipt_storage_unavailable"); }
  }
  async get(id: string): Promise<ReceiptRecord | null> { const raw = await this.command(["GET", this.key(id)]); return raw ? JSON.parse(raw) : null; }
  async result(id: string): Promise<string | null> { return this.command(["GET", `${this.prefix}:result:${id}`]); }
  async claim(record: ReceiptRecord) { return (await this.command(["EVAL", CLAIM, 2, this.key(record.id), `${this.prefix}:auth:${record.authorization}`, JSON.stringify(record), RECORD_TTL])) === 1; }
  async transition(id: string, from: ReceiptState[], to: ReceiptState, options: { body?: string; transaction?: string } = {}) {
    return (await this.command(["EVAL", TRANSITION, 2, this.key(id), `${this.prefix}:result:${id}`, JSON.stringify(from), to, options.body ?? "", options.transaction ?? "", RESULT_TTL])) === 1;
  }
}
export function getReceiptStore(): ReceiptStore | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new RedisReceiptStore(url, token, `vendsdk:receipts:v1:${process.env.VERCEL_ENV ?? "local"}`);
}
