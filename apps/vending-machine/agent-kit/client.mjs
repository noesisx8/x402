const NETWORKS = {
  "eip155:8453": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "eip155:84532": "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
};
const DEFAULT_PAYEE = "0xc648116b5debe4af7d78838aa468d07e0a9ab697";

export class VendError extends Error {
  constructor(code, message) { super(message); this.name = "VendError"; this.code = code; }
}
export function microUsdc(value) {
  if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,6})?$/.test(value)) {
    throw new VendError("invalid_budget", "Use a nonnegative decimal USDC string with at most six decimal places.");
  }
  const [whole, fractional = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fractional.padEnd(6, "0"));
}
function dollars(amount) { return `${amount / 1_000_000n}.${String(amount % 1_000_000n).padStart(6, "0")}`; }
function decodedHeader(value) {
  if (!value || value.length > 64_000) throw new Error("header");
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}
export async function readJson(response, cap = 1_000_000) {
  const reader = response.body?.getReader();
  if (!reader) throw new VendError("invalid_response", "The service returned an empty response.");
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > cap) throw new VendError("response_too_large", "The response exceeded the client byte limit.");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    await reader.cancel().catch(() => {});
    if (e instanceof VendError) throw e;
    throw new VendError("invalid_response", "The service returned unreadable JSON.");
  }
}

/** A single process/session budget. Reservations are never released after signing begins. */
export class VendClient {
  constructor({ origin = "https://vendsdk.com", network = "eip155:8453", payTo = DEFAULT_PAYEE,
    maxCall = "0", maxSession = "0", sign, fetchFn = fetch, allowLocalhost = false } = {}) {
    const base = new URL(origin);
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/" ||
      (base.protocol !== "https:" && !(allowLocalhost && base.protocol === "http:" && base.hostname === "127.0.0.1"))) {
      throw new VendError("invalid_origin", "Configure a fixed HTTPS service origin without a path or credentials.");
    }
    if (!NETWORKS[network] || !/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new VendError("invalid_config", "Configure Base or Base Sepolia and a valid merchant address.");
    this.origin = base.origin; this.network = network; this.payTo = payTo.toLowerCase();
    this.maxCall = microUsdc(maxCall); this.maxSession = microUsdc(maxSession);
    this.sign = sign; this.fetchFn = fetchFn; this.reserved = 0n; this.blocked = false;
  }
  budget() {
    return { payments_enabled: Boolean(this.sign && this.maxCall > 0n && this.maxSession > 0n),
      max_call_usdc: dollars(this.maxCall), max_session_usdc: dollars(this.maxSession),
      reserved_usdc: dollars(this.reserved), remaining_usdc: dollars(this.maxSession - this.reserved),
      review_required: this.blocked, scope: "this process; restart starts a new budget" };
  }
  url(slug, query = {}) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug)) throw new VendError("invalid_service", "Choose a service slug from list_services.");
    const url = new URL(`/api/v/${slug}`, this.origin);
    if (!query || typeof query !== "object" || Array.isArray(query)) throw new VendError("invalid_query", "Query must be an object of scalar values.");
    for (const [key, value] of Object.entries(query)) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key) || !["string", "number", "boolean"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value)) || String(value).length > 2048) throw new VendError("invalid_query", "Query values must be bounded strings, numbers or booleans.");
      url.searchParams.set(key, String(value));
    }
    if (url.href.length > 8192) throw new VendError("invalid_query", "Shorten the query to less than 8 KB.");
    return url.href;
  }
  async request(url, headers = {}) {
    try { return await this.fetchFn(url, { method: "GET", redirect: "error", headers, signal: AbortSignal.timeout(65_000) }); }
    catch { throw new VendError("connection_failed", "The service did not return a response. Paid attempts are never retried automatically."); }
  }
  async catalog() {
    const res = await this.request(`${this.origin}/.well-known/agent-services.json`);
    if (!res.ok) throw this.httpError(res.status);
    const body = await readJson(res);
    if (!Array.isArray(body.services) || body.services.length > 200) throw new VendError("invalid_catalog", "The catalog is unavailable or invalid.");
    return body.services;
  }
  httpError(status) {
    if (status === 429) return new VendError("rate_limited", "Rate limit reached. Wait for the service rate window before requesting another quote.");
    if (status === 400) return new VendError("invalid_request", "Check required parameters and limits using describe_service.");
    if (status === 404) return new VendError("not_found", "Choose an available service from list_services.");
    return new VendError("service_unavailable", `Service returned HTTP ${status}. Check configuration and availability before trying again.`);
  }
  async challenge(slug, query) {
    const url = this.url(slug, query); const res = await this.request(url);
    if (res.status !== 402) { await res.body?.cancel(); throw this.httpError(res.status); }
    let required;
    try { required = decodedHeader(res.headers.get("payment-required")); }
    catch { throw new VendError("invalid_quote", "The server did not provide valid x402 payment requirements."); }
    finally { await res.body?.cancel(); }
    if (required.x402Version !== 2 || required.resource?.url !== url || !Array.isArray(required.accepts)) throw new VendError("invalid_quote", "The quote version or exact resource URL does not match this request.");
    const accepted = required.accepts.find(r => r.scheme === "exact" && r.network === this.network &&
      typeof r.asset === "string" && r.asset.toLowerCase() === NETWORKS[this.network] &&
      typeof r.payTo === "string" && r.payTo.toLowerCase() === this.payTo &&
      typeof r.amount === "string" && /^[1-9]\d{0,14}$/.test(r.amount));
    if (!accepted) throw new VendError("untrusted_quote", "The quote does not match the configured network, USDC asset, merchant and exact payment scheme.");
    return { url, required: { ...required, accepts: [accepted] }, accepted, amount: BigInt(accepted.amount) };
  }
  async quote(slug, query = {}) {
    const q = await this.challenge(slug, query);
    return { service: slug, url: q.url, price_usdc: dollars(q.amount), network: this.network,
      pay_to: this.payTo, asset: q.accepted.asset, payment_sent: false };
  }
  async paid(slug, query, maxPrice) {
    if (!this.budget().payments_enabled) throw new VendError("payments_disabled", "Payments are disabled. The operator must configure a signer and explicit per-call/session budgets.");
    if (this.blocked) throw new VendError("review_required", "A previous payment outcome is uncertain. Operator review is required; do not create another payment.");
    const limit = microUsdc(maxPrice);
    const q = await this.challenge(slug, query);
    // Synchronous reservation after the quote protects concurrent tool calls.
    if (this.blocked || q.amount > limit || q.amount > this.maxCall || this.reserved + q.amount > this.maxSession) throw new VendError("budget_exceeded", "This call exceeds its price cap or remaining session budget, or payment review is required.");
    this.reserved += q.amount;
    try {
      const header = await this.sign(q.required);
      if (typeof header !== "string" || !header || header.length > 64_000) throw new Error("invalid signature");
      const res = await this.request(q.url, { "PAYMENT-SIGNATURE": header });
      if (!res.ok) { await res.body?.cancel(); throw new Error("paid request failed"); }
      const settlement = decodedHeader(res.headers.get("payment-response"));
      if (settlement.success !== true || settlement.network !== this.network || typeof settlement.transaction !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(settlement.transaction)) throw new Error("unconfirmed settlement");
      const result = await readJson(res);
      return { service: slug, price_usdc: dollars(q.amount), transaction: settlement.transaction,
        network: this.network, result, budget: this.budget() };
    } catch {
      this.blocked = true;
      throw new VendError("payment_outcome_unknown", "Payment was attempted but delivery/settlement could not be confirmed. Funds may have settled. Budget remains reserved; stop and have the operator inspect settlement before paying again.");
    }
  }
}

export function clientFromEnv(env = process.env) {
  const enabled = env.VENDSDK_ENABLE_PAYMENTS === "true";
  if (enabled && (!env.VENDSDK_MAX_CALL_USDC || !env.VENDSDK_MAX_SESSION_USDC || !env.X402_PRIVATE_KEY)) throw new VendError("missing_config", "Payment mode requires explicit call/session budgets and X402_PRIVATE_KEY on the authorized payer host.");
  const network = env.VENDSDK_NETWORK ?? "eip155:8453";
  const sign = enabled ? async required => {
    const [{ x402Client }, { ExactEvmScheme }, { privateKeyToAccount }, { encodePaymentSignatureHeader }] = await Promise.all([
      import("@x402/core/client"), import("@x402/evm/exact/client"), import("viem/accounts"), import("@x402/core/http"),
    ]);
    const account = privateKeyToAccount(env.X402_PRIVATE_KEY);
    const client = new x402Client().register(network, new ExactEvmScheme(account));
    return encodePaymentSignatureHeader(await client.createPaymentPayload(required));
  } : undefined;
  return new VendClient({ origin: env.VENDSDK_ORIGIN, network, payTo: env.VENDSDK_PAY_TO ?? DEFAULT_PAYEE,
    maxCall: enabled ? env.VENDSDK_MAX_CALL_USDC : "0", maxSession: enabled ? env.VENDSDK_MAX_SESSION_USDC : "0", sign });
}
