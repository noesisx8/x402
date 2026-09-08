import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.mjs";
import { fixture } from "./fixture.mjs";

async function session(fn, options) {
  const f = fixture(options); const server = createServer(f.client);
  const client = new Client({ name: "vendsdk-contract-tests", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  const call = async (name, args = {}) => (await client.callTool({ name, arguments: args })).structuredContent;
  try { await fn({ client, call, f }); } finally { await client.close(); await server.close(); }
}
test("MCP initialize, five tools, pagination, describe, quote, pay, and budget", async () => session(async ({ client, call }) => {
  const tools = await client.listTools(); assert.equal(tools.tools.length, 5);
  assert.equal(tools.tools.find(t => t.name === "call_service").annotations.idempotentHint, false);
  const page = await call("list_services"); assert.equal(page.services.length, 8);
  const second = await call("list_services", { cursor: page.next_cursor }); assert.equal(second.services.length, 8);
  const third = await call("list_services", { cursor: second.next_cursor }); assert.equal(third.services.length, 3); assert.equal(third.next_cursor, null);
  const detail = await call("describe_service", { slug: "dns-resolve" }); assert.deepEqual(detail.service.input_schema.required, ["host"]);
  const quote = await call("quote_service", { slug: "dns-resolve", query: { host: "example.com" } }); assert.equal(quote.payment_sent, false);
  const paid = await call("call_service", { slug: "dns-resolve", query: { host: "example.com" }, max_price_usdc: "0.003" }); assert.equal(paid.result.ok, true);
  assert.equal((await call("get_budget")).reserved_usdc, "0.003000");
}));
test("MCP missing inputs, unknown service and cursor mismatches are actionable", async () => session(async ({ client, call }) => {
  const result = await client.callTool({ name: "call_service", arguments: { slug: "dns-resolve" } }); assert.equal(result.isError, true);
  assert.equal((await call("describe_service", { slug: "unknown" })).error, "not_found");
  const page = await call("list_services");
  assert.equal((await call("list_services", { search: "dns", cursor: page.next_cursor })).error, "invalid_cursor");
}));
test("MCP uncertain payment requires review; quote and budget remain readable", async () => session(async ({ call }) => {
  const args = { slug: "dns-resolve", query: {}, max_price_usdc: "0.003" };
  assert.equal((await call("call_service", args)).error, "payment_outcome_unknown");
  assert.equal((await call("get_budget")).review_required, true);
  assert.equal((await call("call_service", args)).error, "review_required");
  assert.equal((await call("quote_service", { slug: "dns-resolve" })).payment_sent, false);
}, { dropPaid: true }));
