export type CatalogCategory = "bundle" | "premium" | "utility";

export type CatalogTool = {
  id: string;
  name: string;
  cat: CatalogCategory;
  price: number;
  desc: string;
  endpoint: string;
  latency: number;
  uptime: number;
  sample: Record<string, unknown>;
  params?: string;
};

export const CATALOG = {
  bundles: [
    { id: "starter-bundle", name: "Agent Starter Bundle", cat: "bundle", price: 0.01, desc: "One payment unlocks all 15 utility atoms for the session. Best value for agents doing mixed lookups.", endpoint: "/v1/bundle/starter", latency: 96, uptime: 99.99, sample: { bundle: "starter", session: "sess_9f2a…c4", unlocks: 15, expires_in: "24h", settled: "0x7f3a…9b2c" } },
    { id: "research-bundle", name: "Research Bundle", cat: "bundle", price: 0.03, desc: "Kronos Forecast + Deep Web Intel + all utilities. One route for full research pipelines.", endpoint: "/v1/bundle/research", latency: 112, uptime: 99.98, sample: { bundle: "research", session: "sess_41bd…e8", unlocks: 17, expires_in: "24h", settled: "0x2c8e…41fa" } },
  ],
  premium: [
    { id: "kronos-forecast", name: "Kronos Forecast", cat: "premium", price: 0.05, desc: "Short-horizon BTC/ETH forecast with confidence bands. Informational only — not financial advice.", endpoint: "/v1/kronos?symbol=", latency: 210, uptime: 99.95, sample: { symbol: "BTC", horizon: "4h", direction: "up", confidence: 0.71, band: [67200, 68900], disclaimer: "not financial advice" } },
    { id: "deep-web-intel", name: "Deep Web Intel", cat: "premium", price: 0.02, desc: "Multi-source page intelligence: content extraction, tech stack, outbound links, reputation signals.", endpoint: "/v1/intel?url=", latency: 340, uptime: 99.93, sample: { url: "https://example.com", title: "Example", stack: ["nginx", "react"], links: 14, reputation: "clean" } },
  ],
  utilities: [
    { id: "dns-resolve", name: "dns-resolve", cat: "utility", price: 0.004, params: "domain", desc: "A / AAAA / MX / TXT records.", endpoint: "/v1/dns-resolve?domain=", latency: 84, uptime: 99.98, sample: { domain: "base.org", A: ["145.239.12.9"], AAAA: ["2a00:e70:1::9"], MX: ["mail.base.org"], TXT: ["v=spf1 -all"] } },
    { id: "email-validate", name: "email-validate", cat: "utility", price: 0.003, params: "email", desc: "Syntax, MX, disposable & role checks.", endpoint: "/v1/email-validate?email=", latency: 122, uptime: 99.97, sample: { email: "agent@base.org", valid: true, mx: true, disposable: false, role_account: false } },
    { id: "ip-geolocate", name: "ip-geolocate", cat: "utility", price: 0.003, params: "ip", desc: "Geo, ASN and hosting detection.", endpoint: "/v1/ip-geolocate?ip=", latency: 91, uptime: 99.99, sample: { ip: "145.239.12.9", country: "FR", asn: "AS16276", org: "OVH", hosting: true } },
    { id: "url-metadata", name: "url-metadata", cat: "utility", price: 0.004, params: "url", desc: "Title, description, OG tags, favicon.", endpoint: "/v1/url-metadata?url=", latency: 188, uptime: 99.9, sample: { url: "https://base.org", title: "Base", description: "A secure, low-cost Ethereum L2", og_image: "https://base.org/og.png" } },
    { id: "http-headers", name: "http-headers", cat: "utility", price: 0.002, params: "url", desc: "Response headers & redirect chain.", endpoint: "/v1/http-headers?url=", latency: 76, uptime: 99.99, sample: { url: "https://base.org", status: 200, server: "cloudflare", redirects: 0, "cache-control": "max-age=300" } },
    { id: "ssl-inspect", name: "ssl-inspect", cat: "utility", price: 0.004, params: "domain", desc: "Certificate chain, expiry, issuer.", endpoint: "/v1/ssl-inspect?domain=", latency: 134, uptime: 99.96, sample: { domain: "base.org", issuer: "Let's Encrypt", expires: "2026-10-14", days_left: 79, valid: true } },
    { id: "whois-lookup", name: "whois-lookup", cat: "utility", price: 0.005, params: "domain", desc: "Registrar, creation & expiry dates.", endpoint: "/v1/whois?domain=", latency: 240, uptime: 99.9, sample: { domain: "base.org", registrar: "MarkMonitor", created: "2003-04-01", expires: "2027-04-01" } },
    { id: "text-sentiment", name: "text-sentiment", cat: "utility", price: 0.004, params: "text", desc: "Polarity, magnitude, key phrases.", endpoint: "/v1/sentiment?text=", latency: 156, uptime: 99.94, sample: { polarity: 0.62, label: "positive", magnitude: "medium", phrases: ["live settlement", "agent-grade"] } },
    { id: "token-price", name: "token-price", cat: "utility", price: 0.003, params: "symbol", desc: "Spot price with 24h change.", endpoint: "/v1/token-price?symbol=", latency: 68, uptime: 99.99, sample: { symbol: "ETH", usd: 3521.44, change_24h: 2.31, source: "aggregated", ts: 1753660800 } },
    { id: "gas-oracle", name: "gas-oracle", cat: "utility", price: 0.002, params: "—", desc: "Base gas: slow / standard / fast.", endpoint: "/v1/gas-oracle", latency: 44, uptime: 100, sample: { chain: "base", slow: 0.0011, standard: 0.0014, fast: 0.0021, unit: "gwei" } },
    { id: "ens-resolve", name: "ens-resolve", cat: "utility", price: 0.003, params: "name", desc: "ENS name → address + records.", endpoint: "/v1/ens-resolve?name=", latency: 88, uptime: 99.98, sample: { name: "vitalik.eth", address: "0xd8dA…6045", avatar: "https://…", twitter: "VitalikButerin" } },
    { id: "address-validate", name: "address-validate", cat: "utility", price: 0.002, params: "address", desc: "Checksum + contract/EOA detection.", endpoint: "/v1/address-validate?address=", latency: 39, uptime: 100, sample: { address: "0x8A3f…E21b", valid: true, checksum: true, type: "contract" } },
    { id: "qr-generate", name: "qr-generate", cat: "utility", price: 0.003, params: "data", desc: "QR PNG/SVG for any payload.", endpoint: "/v1/qr?data=", latency: 52, uptime: 99.99, sample: { data: "https://base.org", format: "png", size: 512, url: "https://cdn…/qr.png" } },
    { id: "hash-compute", name: "hash-compute", cat: "utility", price: 0.002, params: "input, algo", desc: "keccak256 / sha256 / md5.", endpoint: "/v1/hash?input=&algo=", latency: 31, uptime: 100, sample: { algo: "keccak256", input: "hello", hash: "0x1c8a…ff9507" } },
    { id: "timestamp-verify", name: "timestamp-verify", cat: "utility", price: 0.002, params: "tx", desc: "Confirm a tx timestamp on Base.", endpoint: "/v1/timestamp?tx=", latency: 97, uptime: 99.97, sample: { tx: "0x7f3a…9b2c", block: 18392044, timestamp: 1753660800, confirmed: true } },
  ],
} satisfies Record<string, CatalogTool[]>;

export const FAQS = [
  ["What is x402?", "x402 is an open payment protocol that revives the HTTP 402 Payment Required status code. Instead of accounts and API keys, each request carries a USDC micropayment on Base. Your wallet signature is the authentication — there is nothing to register and nothing to leak."],
  ["What happens if a call fails?", "Failed handlers close safely before settlement. If an upstream lookup errors or times out, the payment never finalizes and the USDC stays in your wallet. You are only ever charged for successful responses."],
  ["Do I need an account or API key?", "No. Connect any EVM wallet with USDC on Base and sign per call — or let your agent sign programmatically. There are no subscriptions, no tiers, and no keys to rotate."],
  ["What does a bundle unlock?", "One bundle payment issues a session token (24h) that unlocks its toolset at a flat rate. The Agent Starter Bundle covers all 15 utility atoms for $0.01 — cheaper than three individual calls."],
  ["Is Kronos Forecast financial advice?", "No. Kronos output is informational only — a probabilistic short-horizon signal with published confidence bands. Never trade on it alone."],
] as const;

export const ALL_TOOLS: CatalogTool[] = [...CATALOG.bundles, ...CATALOG.premium, ...CATALOG.utilities];
