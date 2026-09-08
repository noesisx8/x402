import { VendClient } from "../client.mjs";
export const merchant = "0xc648116b5debe4af7d78838aa468d07e0a9ab697";
export const network = "eip155:8453";
export const asset = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const transaction = `0x${"ab".repeat(32)}`;
export const header = value => Buffer.from(JSON.stringify(value)).toString("base64");
export function fixture(options = {}) {
  const calls = []; const signatures = [];
  const services = Array.from({ length: 19 }, (_, i) => ({
    slug: i === 0 ? "dns-resolve" : `service-${i}`, name: i === 0 ? "DNS resolve" : `Service ${i}`,
    description: "Fixture public DNS lookup", price_usdc_hint: "$0.003", category: "atom",
    input_schema: { type: "object", properties: { host: { type: "string" } }, required: ["host"] },
  }));
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/.well-known/agent-services.json")) return Response.json({ services });
    if (init.headers["PAYMENT-SIGNATURE"]) {
      if (options.dropPaid) throw new Error("private diagnostic: NEVER DISCLOSE");
      if (options.paidStatus) return Response.json({}, { status: options.paidStatus });
      return Response.json({ service: "dns-resolve", ok: true, a: ["93.184.216.34"] }, {
        headers: options.noReceipt ? {} : { "PAYMENT-RESPONSE": header({ success: true, network, transaction }) },
      });
    }
    const required = { x402Version: 2, resource: { url }, accepts: [{ scheme: "exact", network, asset,
      payTo: merchant, amount: options.amount ?? "3000", maxTimeoutSeconds: 120, extra: { name: "USDC", version: "2" }, ...options.option }] };
    options.mutate?.(required);
    return Response.json({}, { status: 402, headers: { "PAYMENT-REQUIRED": header(required) } });
  };
  const client = new VendClient({ maxCall: "0.005", maxSession: "0.006", fetchFn,
    sign: options.disabled ? undefined : async required => { signatures.push(required); return "fixture-signature"; },
    ...options.client });
  return { client, calls, signatures, services };
}
