import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import test from "node:test";
import { settledBundlePart } from "../lib/services/handlers";
import { tlsCertPeek } from "../lib/services/infra";
import { _resetRateLimitForTests, checkVendingRequestRateLimit } from "../lib/rate-limit";
import {
  isPublicIp,
  publicRequest,
  publicUrl,
  resolvePublicAddress,
} from "../lib/services/public-network";
import { retryableInitializer } from "../lib/x402/retryable-initializer";

test("public address policy rejects local, private, reserved, and mapped addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.168.1.2",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b:1::a9fe:a9fe",
  ]) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp("1.1.1.1"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

test("HTTP deadline is absolute even while an upstream drips bytes", async (t) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    const timer = setInterval(() => response.write("x"), 10);
    response.on("close", () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert(address && typeof address === "object");

  const started = Date.now();
  await assert.rejects(
    publicRequest(
      `http://example.test:${address.port}/`,
      "GET",
      1000,
      started + 60,
      {},
      async () => ({ address: "127.0.0.1", family: 4 }),
    ),
    /upstream_timeout/,
  );
  assert(Date.now() - started < 250);
});

test("TLS deadline is absolute while a peer drips an incomplete handshake", async (t) => {
  const sockets = new Set<import("node:net").Socket>();
  const server = createTcpServer((socket) => {
    sockets.add(socket);
    // Valid TLS record header declaring a 16 KiB handshake body, delivered slowly.
    socket.write(Buffer.from([0x16, 0x03, 0x03, 0x40, 0x00]));
    const timer = setInterval(() => {
      if (socket.writable) socket.write(Buffer.from([0]));
    }, 10);
    socket.on("close", () => clearInterval(timer));
    socket.on("error", () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    sockets.forEach((socket) => socket.destroy());
    server.close();
  });
  const address = server.address();
  assert(address && typeof address === "object");

  const started = Date.now();
  await assert.rejects(
    tlsCertPeek("example.test", address.port, {
      timeoutMs: 60,
      resolveAddress: async () => ({ address: "127.0.0.1", family: 4 }),
      allowedPorts: [address.port],
    }),
    /tls_timeout/,
  );
  assert(Date.now() - started < 250);
});

test("customer URLs reject unsafe schemes, credentials, and hosts", () => {
  for (const value of [
    "file:///etc/passwd",
    "http://user:pass@example.com/",
    "http://localhost/",
    "http://169.254.169.254/latest/meta-data/",
  ]) {
    assert.throws(() => publicUrl(value));
  }
  assert.equal(publicUrl("https://example.com/a?b=1").hostname, "example.com");
  assert.throws(() => publicUrl("http://[::1]/"));
});

test("DNS selection rejects the whole answer set when one answer is private", async () => {
  const lookup = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ];
  await assert.rejects(
    resolvePublicAddress("example.com", Date.now() + 100, lookup),
    /resolves_to_private_ip/,
  );
});

test("DNS lookup is included in the operation deadline", async () => {
  const lookup = () => new Promise<{ address: string; family: number }[]>(() => undefined);
  await assert.rejects(
    resolvePublicAddress("example.com", Date.now() + 10, lookup),
    /upstream_timeout/,
  );
});

test("bundle partial failures never serialize the underlying exception", () => {
  const marker = "secret-upstream-diagnostic";
  const part = settledBundlePart({ status: "rejected", reason: new Error(marker) });
  assert.deepEqual(part, { ok: false, error: "upstream_check_failed" });
  assert.equal(JSON.stringify(part).includes(marker), false);
});

test("a forged payment header cannot bypass route request throttling", () => {
  _resetRateLimitForTests();
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10",
    "payment-signature": "forged",
  });
  for (let count = 0; count < 120; count++) {
    assert.equal(checkVendingRequestRateLimit(headers, "dns-resolve").rateLimit.allowed, true);
  }
  assert.equal(checkVendingRequestRateLimit(headers, "dns-resolve").rateLimit.allowed, false);
});

test("failed initialization is retried while concurrent callers share one attempt", async () => {
  let attempts = 0;
  let rejectFirst: ((error: Error) => void) | undefined;
  const initialize = retryableInitializer(async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Promise<{ ready: true }>((_resolve, reject) => {
        rejectFirst = reject;
      });
    }
    return { ready: true };
  });

  const firstAttempt = initialize();
  const concurrentAttempt = initialize();
  assert.equal(firstAttempt, concurrentAttempt);
  assert.equal(attempts, 1);
  const failedResults = Promise.allSettled([firstAttempt, concurrentAttempt]);
  rejectFirst?.(new Error("temporary_facilitator_failure"));
  const results = await failedResults;
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "rejected");
  assert.match(String(results[0].status === "rejected" && results[0].reason), /temporary_facilitator_failure/);

  const [first, second] = await Promise.all([initialize(), initialize()]);
  assert.deepEqual(first, { ready: true });
  assert.equal(first, second);
  assert.equal(attempts, 2);
});

test("stalled analytics reads and writes return within their deadline", async () => {
  process.env.KV_REST_API_URL = "https://analytics.invalid";
  process.env.KV_REST_API_TOKEN = "test-only";
  const { getPersistedSettlements, persistSettlement } = await import("../lib/analytics");
  const originalFetch = globalThis.fetch;
  const keepAlive = setInterval(() => undefined, 1000);
  try {
    globalThis.fetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    const started = Date.now();
    await persistSettlement({ slug: "test", ms: 1, at: new Date().toISOString() });
    assert.equal(await getPersistedSettlements(), null);
    assert(Date.now() - started < 1500);
  } finally {
    clearInterval(keepAlive);
    globalThis.fetch = originalFetch;
  }
});
