import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP, BlockList, type LookupFunction } from "node:net";

const blocked = new BlockList();
for (const [ip, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(ip,prefix,"ipv4");
const reserved6 = new BlockList();
for (const [ip, bits] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]] as const) reserved6.addSubnet(ip,bits,"ipv6");
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) return !blocked.check(address, "ipv4");
  // Global-unicast IPv6 only; reject documentation and transition/tunnel ranges.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !reserved6.check(address,"ipv6");
}
export function publicUrl(raw: string): URL {
  if (raw.length > 2048) throw new Error("invalid_url");
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password || (url.port && !["80","443","8443"].includes(url.port))) throw new Error("invalid_url");
  if (host === "localhost" || /\.(local|internal|localhost)\.?$/i.test(host) || (isIP(host) && !publicAddress(host))) throw new Error("host_not_allowed");
  return url;
}
export async function pinnedLookup(host: string): Promise<LookupFunction> {
  const clean = host.replace(/^\[|\]$/g, "");
  const addresses = isIP(clean) ? [{ address: clean, family: isIP(clean) }] : await lookup(clean, { all: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error("resolves_to_private_ip");
  const address = addresses[0];
  return ((_host, options, callback) => {
    if (options.all) (callback as unknown as (e: null, a: typeof addresses) => void)(null, [address]);
    else callback(null, address.address, address.family);
  }) as LookupFunction;
}
/** Pin DNS to a checked public address; stop reading at the byte cap. Never auto-follow redirects. */
export async function publicRequest(raw: string, method: "GET" | "HEAD", maxBytes: number, timeoutMs = 8000): Promise<{ response: Response; bytes: number; truncated: boolean }> {
  const url = publicUrl(raw);
  const lookupFn = await pinnedLookup(url.hostname);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method, lookup: lookupFn,
      headers: { "User-Agent": "VendSDK/0.3", Accept: "text/html,application/json,text/plain", "Accept-Encoding": "identity" },
    }, res => {
      const chunks: Buffer[] = []; let bytes = 0; let done = false;
      const finish = (truncated: boolean) => {
        if (done) return; done = true; clearTimeout(timer);
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        const status = res.statusCode ?? 502;
        const body = method === "HEAD" || [204,205,304].includes(status) ? null : Buffer.concat(chunks).toString("utf8");
        resolve({ response: new Response(body, { status, headers }), bytes, truncated });
      };
      res.on("data", (chunk: Buffer) => {
        const available = maxBytes - bytes;
        chunks.push(chunk.subarray(0, Math.max(0, available))); bytes += Math.min(chunk.length, Math.max(0, available));
        if (chunk.length > available) { finish(true); res.destroy(); }
      });
      res.on("end", () => finish(false)); res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new Error("upstream_timeout")), timeoutMs);
    req.on("error", error => { clearTimeout(timer); reject(error); }); req.end();
  });
}
