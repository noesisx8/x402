import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { x402ResourceServer } from "@x402/core/server";

export const RESULT_TTL = 24 * 60 * 60;
export const RECORD_TTL = 7 * RESULT_TTL;
export const RESULT_LIMIT = 128 * 1024;
export const RECEIPT_HEADER = "x-vendsdk-receipt";
export type ReceiptState = "pending" | "prepared" | "settling" | "settled" | "failed";
export type ReceiptRecord = {
  id: string; binding: string; authorization: string; payer: string; nonce: string;
  network: string; asset: string; payTo: string; amount: string;
  state: ReceiptState; created: number; expires: number; transaction?: string;
};
export interface ReceiptStore {
  get(id: string): Promise<ReceiptRecord | null>;
  result(id: string): Promise<string | null>;
  claim(record: ReceiptRecord): Promise<boolean>;
  transition(id: string, from: ReceiptState[], to: ReceiptState, options?: { body?: string; transaction?: string }): Promise<boolean>;
}
export class ReceiptError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function receiptId(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ReceiptError("invalid_receipt_token", 400);
  return digest(token);
}

/** Header contents are only binding hints here. Claim occurs after facilitator verification. */
export function receiptRecord(token: string, header: string, url: string, now = Date.now()): ReceiptRecord {
  try {
    if (header.length > 64_000) throw new Error();
    const p = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const a = p.payload?.authorization;
    const accepted = p.accepted;
    const address = /^0x[a-fA-F0-9]{40}$/;
    const assets: Record<string, string> = { "eip155:8453": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "eip155:84532": "0x036cbd53842c5426634e7929541ec2318f3dcf7e" };
    if (p.x402Version !== 2 || p.resource?.url !== url || accepted?.scheme !== "exact" ||
      !address.test(a?.from) || !address.test(a?.to) || !/^0x[a-fA-F0-9]{64}$/.test(a?.nonce) ||
      typeof a.value !== "string" || !/^[1-9]\d{0,14}$/.test(a.value) ||
      typeof a.validBefore !== "string" || !/^\d{1,12}$/.test(a.validBefore) ||
      typeof accepted.asset !== "string" || !assets[accepted.network] || accepted.asset.toLowerCase() !== assets[accepted.network] ||
      accepted.payTo?.toLowerCase() !== a.to.toLowerCase() || accepted.amount !== a.value) throw new Error();
    // Recovery supports short-lived EIP-3009 authorizations only, not Permit2 or upto.
    if (Number(a.validBefore) > now / 1000 + 600) throw new Error();
    const payer = a.from.toLowerCase(), nonce = a.nonce.toLowerCase(), asset = accepted.asset.toLowerCase();
    const authorization = digest(JSON.stringify([accepted.network, asset, payer, nonce]));
    return { id: receiptId(token), authorization, binding: digest(JSON.stringify([url, authorization, a.to.toLowerCase(), a.value])),
      payer, nonce, asset, network: accepted.network, payTo: a.to.toLowerCase(), amount: a.value,
      state: "pending", created: now, expires: now + RESULT_TTL * 1000 };
  } catch (e) {
    if (e instanceof ReceiptError) throw e;
    throw new ReceiptError("unsupported_receipt_payment", 400);
  }
}

export class ReceiptSession {
  claimed = false;
  constructor(public store: ReceiptStore, public record: ReceiptRecord) {}
  async claim() {
    if (!await this.store.claim(this.record)) throw new ReceiptError("receipt_or_authorization_in_use", 409);
    this.claimed = true;
  }
  async prepare(body: string) {
    if (Buffer.byteLength(body) > RESULT_LIMIT) throw new ReceiptError("receipt_result_too_large", 413);
    if (!await this.store.transition(this.record.id, ["pending"], "prepared", { body })) throw new ReceiptError("receipt_prepare_failed");
  }
  async beforeSettle() {
    if (!await this.store.transition(this.record.id, ["prepared"], "settling")) throw new ReceiptError("receipt_not_prepared");
  }
  async settled(transaction: string, network: string) {
    if (network !== this.record.network || !/^0x[a-fA-F0-9]{64}$/.test(transaction)) throw new ReceiptError("receipt_settlement_unconfirmed");
    if (!await this.store.transition(this.record.id, ["settling"], "settled", { transaction })) throw new ReceiptError("receipt_confirmation_pending");
  }
  async failed() {
    if (this.claimed) await this.store.transition(this.record.id, ["pending", "prepared"], "failed");
  }
}
export const receiptContext = new AsyncLocalStorage<ReceiptSession>();

export function installReceiptHooks(server: x402ResourceServer) {
  server.onBeforeSettle(async () => {
    const receipt = receiptContext.getStore();
    if (!receipt) return;
    try { await receipt.beforeSettle(); }
    catch { return { abort: true, reason: "receipt_storage_unavailable", message: "Result could not be durably prepared; settlement was not started." }; }
  });
  server.onAfterSettle(async ({ result }) => {
    const receipt = receiptContext.getStore();
    if (receipt && result.success) await receipt.settled(result.transaction, result.network);
  });
}

/** No result is released until settlement is confirmed; retrieval never executes or pays. */
export async function recoverReceipt(store: ReceiptStore, id: string, now = Date.now()) {
  const record = await store.get(id);
  if (!record) return { status: 404, body: { error: "receipt_not_found" } };
  if (now >= record.expires) return { status: 410, body: { error: "receipt_expired" } };
  if (record.state === "failed") return { status: 409, body: { error: "receipt_failed", payment_sent: false } };
  if (record.state !== "settled") return { status: 202, body: { state: record.state, message: "Outcome pending. Do not pay again. Reconcile a known transaction if available." } };
  const result = await store.result(id);
  if (result === null) return { status: 410, body: { error: "receipt_result_expired" } };
  return { status: 200, body: { state: "settled", transaction: record.transaction, network: record.network, result: JSON.parse(result), recovered: true } };
}
