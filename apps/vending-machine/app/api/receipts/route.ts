import { NextRequest, NextResponse } from "next/server";
import { getReceiptStore } from "@/lib/x402/receipt-store";
import { receiptId, ReceiptError, recoverReceipt, RESULT_TTL, RESULT_LIMIT } from "@/lib/x402/receipts";
import { reconcileReceipt } from "@/lib/x402/receipt-reconcile";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Capability stays in Authorization, never in a URL or lifecycle logs. */
export async function GET() {
  return NextResponse.json({ available: Boolean(getReceiptStore()), protocol: "vendsdk-receipts-v1", result_ttl_seconds: RESULT_TTL,
    max_result_bytes: RESULT_LIMIT, payment_scheme: "exact-eip3009", request_header: "X-VendSDK-Receipt",
    retrieval: "POST with Authorization: Bearer <client-generated 32-byte hex token>",
    reconciliation: "Same POST with X-VendSDK-Transaction: <transaction hash>; requires 12 chain confirmations" }, { headers });
}
export async function POST(request: NextRequest) {
  const limit = checkRateLimit(`receipt:${clientIpFromHeaders(request.headers)}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSec) } });
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) throw new ReceiptError("receipt_authorization_required", 401);
    const id = receiptId(auth.slice(7));
    const store = getReceiptStore();
    if (!store) throw new ReceiptError("receipt_storage_unavailable");
    const transaction = request.headers.get("x-vendsdk-transaction");
    if (transaction) await reconcileReceipt(store, id, transaction);
    const result = await recoverReceipt(store, id);
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ReceiptError ? e.code : "receipt_storage_unavailable" }, { status: e instanceof ReceiptError ? e.status : 503, headers });
  }
}
