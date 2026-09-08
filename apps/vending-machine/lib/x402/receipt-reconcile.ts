import { createPublicClient, http, toEventSelector } from "viem";
import { base, baseSepolia } from "viem/chains";
import { ReceiptError, type ReceiptRecord, type ReceiptStore } from "./receipts";

const AUTH = toEventSelector("AuthorizationUsed(address,bytes32)").toLowerCase();
const TRANSFER = toEventSelector("Transfer(address,address,uint256)").toLowerCase();
type Evidence = { status: string; transactionHash: string; blockNumber: bigint; logs: readonly { address: string; topics: readonly string[]; data: string }[] };
const topicAddress = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;

/** Nonce consumption alone also covers cancellation. Require both exact USDC events. */
export function matchesSettlement(record: ReceiptRecord, receipt: Evidence, transaction: string, head: bigint) {
  if (receipt.status !== "success" || receipt.transactionHash.toLowerCase() !== transaction.toLowerCase() || head < receipt.blockNumber + 11n) return false;
  const logs = receipt.logs.filter(log => log.address.toLowerCase() === record.asset);
  const authorized = logs.some(log => log.topics.length === 3 && log.topics[0].toLowerCase() === AUTH &&
    log.topics[1].toLowerCase() === topicAddress(record.payer) && log.topics[2].toLowerCase() === record.nonce);
  const transferred = logs.some(log => log.topics.length === 3 && log.topics[0].toLowerCase() === TRANSFER &&
    log.topics[1].toLowerCase() === topicAddress(record.payer) && log.topics[2].toLowerCase() === topicAddress(record.payTo) &&
    /^0x[a-fA-F0-9]{64}$/.test(log.data) && BigInt(log.data) === BigInt(record.amount));
  return authorized && transferred;
}
export async function reconcileReceipt(store: ReceiptStore, id: string, transaction: string,
  evidence?: (record: ReceiptRecord, transaction: string) => Promise<{ receipt: Evidence; head: bigint }>) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(transaction)) throw new ReceiptError("invalid_transaction", 400);
  const record = await store.get(id);
  if (!record) throw new ReceiptError("receipt_not_found", 404);
  if (Date.now() >= record.expires || !await store.result(id)) throw new ReceiptError("receipt_expired", 410);
  if (record.state === "settled") return;
  if (record.state !== "settling") throw new ReceiptError("receipt_not_awaiting_settlement", 409);
  const lookup = evidence ?? (async (rec: ReceiptRecord, tx: string) => {
    const chain = rec.network === "eip155:8453" ? base : rec.network === "eip155:84532" ? baseSepolia : null;
    if (!chain) throw new ReceiptError("unsupported_receipt_network", 400);
    const client = createPublicClient({ chain, transport: http(undefined, { timeout: 5000, retryCount: 0 }) });
    const [receipt, head] = await Promise.all([client.getTransactionReceipt({ hash: tx as `0x${string}` }), client.getBlockNumber()]);
    return { receipt, head };
  });
  let proof;
  try { proof = await lookup(record, transaction); } catch { throw new ReceiptError("settlement_evidence_unavailable", 503); }
  if (!matchesSettlement(record, proof.receipt, transaction, proof.head)) throw new ReceiptError("settlement_not_confirmed", 409);
  if (!await store.transition(id, ["settling"], "settled", { transaction })) {
    if ((await store.get(id))?.state !== "settled") throw new ReceiptError("receipt_confirmation_pending");
  }
}
