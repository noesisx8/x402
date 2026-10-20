import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicAnswers,
  assertPublicUrl,
  createPaymentGate,
  isPublicIp,
  probeErrorResponse,
  publicErrorMessage,
  publicHttp,
  readSignedPayment,
  resolvePublicAddress,
  upstashPaymentLock,
} from "../dist/index.js";

const FROM = "0x" + "ab".repeat(20);
const NONCE = "0x" + "11".repeat(32);
const SIG = "0x" + "cd".repeat(65);

function paymentHeader(overrides = {}) {
  const body = {
    x402Version: 2,
    payload: {
      signature: SIG,
      authorization: {
        from: FROM,
        to: "0x" + "22".repeat(20),
        value: "1000",
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 600),
        nonce: NONCE,
        ...overrides,
      },
    },
  };
  return Buffer.from(JSON.stringify(body)).toString("base64");
}

test("address policy rejects private, mapped, CGNAT, and documentation ranges", () => {
  for (const address of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::7f00:1",
  ]) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp("1.1.1.1"), true);
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

test("customer URLs reject obfuscated loopback, suffixes, credentials, and odd ports", () => {
  for (const value of [
    "http://2130706433/",
    "http://127.1/",
    "http://0177.0.0.1/",
    "http://0x7f000001/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.1.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://localhost/",
    "http://db.internal/health",
    "http://printer.local/",
    "http://user:pass@example.com/",
    "http://example.com:22/",
    "file:///etc/passwd",
    "http://example.com:8444/",
  ]) {
    assert.throws(() => assertPublicUrl(value), undefined, value);
  }
  assert.equal(assertPublicUrl("https://example.com/a").hostname, "example.com");
  assert.equal(assertPublicUrl("https://example.com:8443/a").port, "8443");
  assert.equal(assertPublicUrl("http://1.1.1.1/").hostname, "1.1.1.1");
});

test("DNS selection fails closed and never dials a private answer", async () => {
  let dials = 0;
  const lookup = async () => [{ address: "10.0.0.5", family: 4 }];
  await assert.rejects(resolvePublicAddress("example.com", lookup), /resolves_to_private_ip/);
  await assert.rejects(
    publicHttp("http://example.com/", "GET", {
      lookup,
      dispatch: async () => {
        dials += 1;
        return { status: 200, headers: {} };
      },
    }),
    /resolves_to_private_ip/,
  );
  assert.equal(dials, 0);
});

test("a resolver error rejects the probe instead of connecting", async () => {
  let dials = 0;
  await assert.rejects(
    publicHttp("http://example.com/secret", "GET", {
      lookup: async () => {
        throw new Error("getaddrinfo ENOTFOUND example.com");
      },
      dispatch: async () => {
        dials += 1;
        return { status: 200, headers: {} };
      },
    }),
    /dns_lookup_failed/,
  );
  assert.equal(dials, 0);
  assert.equal(probeErrorResponse(new Error("dns_lookup_failed")).status, 400);
});

test("mixed public and private answers are rejected before connect", async () => {
  let dials = 0;
  await assert.rejects(
    publicHttp("http://example.com/", "HEAD", {
      lookup: async () => [
        { address: "1.1.1.1", family: 4 },
        { address: "192.168.0.5", family: 4 },
      ],
      dispatch: async () => {
        dials += 1;
        return { status: 200, headers: {} };
      },
    }),
    /resolves_to_private_ip/,
  );
  assert.equal(dials, 0);
});

test("the connect target is the pinned address, and a private redirect is not followed", async () => {
  const dials = [];
  const lookups = [];
  await assert.rejects(
    publicHttp("http://public.test/start", "GET", {
      lookup: async (hostname) => {
        lookups.push(hostname);
        if (hostname === "public.test") return [{ address: "1.1.1.1", family: 4 }];
        return [{ address: "10.0.0.9", family: 4 }];
      },
      dispatch: async (target) => {
        dials.push(target.address);
        return {
          status: 302,
          headers: { location: "http://rebind.test/secret" },
        };
      },
    }),
    /resolves_to_private_ip/,
  );
  assert.deepEqual(dials, ["1.1.1.1"]);
  assert.deepEqual(lookups, ["public.test", "rebind.test"]);
});

test("a redirect to a literal private address is rejected before the second connect", async () => {
  const dials = [];
  await assert.rejects(
    publicHttp("https://example.com/a", "HEAD", {
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
      dispatch: async (target) => {
        dials.push(`${target.address}:${target.port}`);
        assert.equal(target.servername, "example.com");
        return { status: 302, headers: { location: "http://127.0.0.1:8080/latest" } };
      },
    }),
    /private_ip_not_allowed/,
  );
  assert.deepEqual(dials, ["8.8.8.8:443"]);
  const mapped = probeErrorResponse(new Error("private_ip_not_allowed"));
  assert.deepEqual(mapped, { status: 400, error: "host_not_allowed" });
});

test("DNS answers that include a private address are not returned", () => {
  assert.throws(() => assertPublicAnswers(["1.1.1.1", "10.0.0.2"]), /host_not_allowed/);
  assert.doesNotThrow(() => assertPublicAnswers(["1.1.1.1", "2606:4700:4700::1111"]));
});

test("client errors never echo a provider URL or key", () => {
  const leaked = "HTTP request failed.\n\nURL: https://mainnet.base.org/v2/secret-key\nDetails: timeout";
  const message = publicErrorMessage(new Error(leaked));
  assert.equal(message, "request_failed");
  assert.equal(message.includes("http"), false);
  assert.equal(message.includes("secret-key"), false);
  assert.equal(publicErrorMessage(new Error("base_rpc_failed")), "base_rpc_failed");
  assert.equal(publicErrorMessage(new Error("missing host")), "missing_host");
});

test("a forged payment envelope is rejected before any verify callback", async () => {
  const gate = createPaymentGate({ paidIpLimit: 5, remote: null });
  let verifies = 0;
  const forged = Buffer.from(JSON.stringify({ x402Version: 2, accepted: { scheme: "exact" } })).toString("base64");
  const decision = await gate.begin(forged, "203.0.113.10");
  assert.equal(decision.ok, false);
  if (!decision.ok) {
    assert.equal(decision.status, 400);
    assert.equal(decision.error, "payment_malformed");
  }
  assert.equal(verifies, 0);
  assert.equal(readSignedPayment(forged), null);
});

test("paid attempts are rate limited per IP even when the envelope is forged", async () => {
  const gate = createPaymentGate({ paidIpLimit: 2, remote: null });
  const forged = Buffer.from(JSON.stringify({ x402Version: 2, accepted: {} })).toString("base64");
  assert.equal((await gate.begin(forged, "198.51.100.8")).status, 400);
  assert.equal((await gate.begin(forged, "198.51.100.8")).status, 400);
  const blocked = await gate.begin(forged, "198.51.100.8");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 429);
});

test("one authorization cannot run the handler more than once concurrently", async () => {
  const gate = createPaymentGate({ maxUses: 3, remote: null });
  const header = paymentHeader();
  let running = 0;
  let maxRunning = 0;
  let admitted = 0;
  const results = await Promise.all(
    Array.from({ length: 16 }, () =>
      (async () => {
        const decision = await gate.begin(header, "203.0.113.20");
        if (!decision.ok) return decision;
        admitted += 1;
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 30));
        running -= 1;
        await decision.finish(200);
        return decision;
      })(),
    ),
  );
  assert.equal(admitted, 1);
  assert.equal(maxRunning, 1);
  const rejected = results.filter((result) => !result.ok);
  assert.equal(rejected.length, 15);
  assert.ok(rejected.every((result) => result.error === "payment_already_in_progress"));
  const again = await gate.begin(header, "203.0.113.20");
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.error, "payment_already_used");
});

test("failed handler runs consume the authorization after the use cap", async () => {
  const gate = createPaymentGate({ maxUses: 3, remote: null });
  const header = paymentHeader({ nonce: "0x" + "22".repeat(32) });
  let runs = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decision = await gate.begin(header, "203.0.113.21");
    assert.equal(decision.ok, true);
    if (decision.ok) {
      runs += 1;
      await decision.finish(400);
    }
  }
  const blocked = await gate.begin(header, "203.0.113.21");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "payment_use_cap");
  assert.equal(runs, 3);
});

test("the same payer is blocked after repeated free failures", async () => {
  const gate = createPaymentGate({ maxUses: 3, payerFailLimit: 4, paidPayerLimit: 100, remote: null });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const header = paymentHeader({ nonce: "0x" + attempt.toString(16).padStart(64, "0") });
    const decision = await gate.begin(header, "203.0.113.22");
    assert.equal(decision.ok, true, `attempt ${attempt}`);
    if (decision.ok) await decision.finish(400);
  }
  const next = await gate.begin(paymentHeader({ nonce: "0x" + "33".repeat(32) }), "203.0.113.22");
  assert.equal(next.ok, false);
  if (!next.ok) assert.equal(next.error, "payer_fail_budget");
});

test("a permit2 envelope is admitted and fingerprinted from its payer and nonce", async () => {
  const gate = createPaymentGate({ remote: null });
  const nonce = "123456789";
  const header = Buffer.from(
    JSON.stringify({
      x402Version: 2,
      payload: {
        signature: SIG,
        permit2Authorization: {
          from: FROM,
          permitted: { token: "0x" + "44".repeat(20), amount: "1" },
          spender: "0x" + "55".repeat(20),
          nonce,
          deadline: String(Math.floor(Date.now() / 1000) + 600),
          witness: { to: "0x" + "66".repeat(20), validAfter: "0" },
        },
      },
    }),
  ).toString("base64");
  const signed = readSignedPayment(header);
  assert.ok(signed);
  assert.equal(signed.fingerprint, `${FROM.toLowerCase()}:${nonce}`);
  const decision = await gate.begin(header, "203.0.113.23");
  assert.equal(decision.ok, true);
  if (decision.ok) await decision.finish(200);
});

test("redis lock claims with SET NX and a second claim is busy", async () => {
  const keys = new Map();
  const fetchImpl = async (_url, init) => {
    const commands = JSON.parse(init.body);
    const results = commands.map((command) => {
      const [op, key, value] = command;
      if (op === "GET") return { result: keys.get(key) ?? null };
      if (op === "SET" && command.includes("NX")) {
        if (keys.has(key)) return { result: null };
        keys.set(key, value);
        return { result: "OK" };
      }
      if (op === "SET") {
        keys.set(key, value);
        return { result: "OK" };
      }
      if (op === "DEL") {
        keys.delete(key);
        return { result: 1 };
      }
      if (op === "INCR") {
        const next = Number(keys.get(key) ?? 0) + 1;
        keys.set(key, String(next));
        return { result: next };
      }
      if (op === "EXPIRE") return { result: 1 };
      throw new Error(`unexpected ${op}`);
    });
    return { ok: true, json: async () => results };
  };
  const lock = upstashPaymentLock("https://example.upstash.io", "token", fetchImpl);
  const fingerprint = `${FROM.toLowerCase()}:${NONCE}`;
  assert.equal(await lock.claim(fingerprint, 120, 3), "claimed");
  assert.equal(await lock.claim(fingerprint, 120, 3), "busy");
  await lock.finish(fingerprint, 200, 120, 3);
  assert.equal(await lock.claim(fingerprint, 120, 3), "used");
});
