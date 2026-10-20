import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createPaymentGate } from "@x402-project/request-guard";
import { createApp } from "../dist/server.js";
import { buildRoutes, sdkRouteMatches } from "../dist/x402.js";

const PAY_TO = "0x" + "11".repeat(20);
const FROM = "0x" + "ab".repeat(20);
const SIG = "0x" + "cd".repeat(65);

const env = {
  PORT: 0,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  X402_ENABLED: true,
  X402_NETWORK: "base-sepolia",
  X402_PAY_TO_ADDRESS: PAY_TO,
  X402_FACILITATOR_URL: "http://127.0.0.1:9",
};

const paid = { payTo: PAY_TO, network: "base-sepolia", facilitatorUrl: env.X402_FACILITATOR_URL };

function paymentHeader(nonce) {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      payload: {
        signature: SIG,
        authorization: {
          from: FROM,
          to: PAY_TO,
          value: "2000",
          validAfter: "0",
          validBefore: String(Math.floor(Date.now() / 1000) + 600),
          nonce,
        },
      },
    }),
  ).toString("base64");
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function request(server, method, path, headers = {}) {
  const address = server.address();
  assert(address && typeof address === "object");
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: address.port, path, method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, text });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function startApp(options) {
  const app = await createApp(env, {
    gate: createPaymentGate({ remote: null, paidIpLimit: 50, maxUses: 3 }),
    attachPayment: async (expressApp) => {
      expressApp.use((req, res, next) => {
        if (!sdkRouteMatches("/v1/dns", req.path, req.method) && !sdkRouteMatches("/v1/http-head", req.path, req.method)) {
          next();
          return;
        }
        const header = req.get("payment-signature") || req.get("x-payment");
        if (!header) {
          res.status(402).json({ error: "payment_required" });
          return;
        }
        next();
      });
    },
    ...options,
  });
  const server = http.createServer(app);
  await listen(server);
  return server;
}

test("paid route keys cover HEAD as well as GET", () => {
  const patterns = Object.keys(buildRoutes(paid));
  assert.deepEqual(patterns.sort(), ["/v1/dns", "/v1/http-head"]);
  for (const pattern of patterns) {
    assert.equal(pattern.includes(" "), false, pattern);
    assert.equal(sdkRouteMatches(pattern, pattern, "HEAD"), true);
    assert.equal(sdkRouteMatches(pattern, pattern, "GET"), true);
  }
  assert.equal(sdkRouteMatches("GET /v1/dns", "/v1/dns", "HEAD"), false);
  assert.equal(sdkRouteMatches("GET /v1/http-head", "/v1/http-head", "HEAD"), false);
});

test("HEAD without payment does not call DNS or HTTP probes", async (t) => {
  let dnsCalls = 0;
  let httpCalls = 0;
  const target = http.createServer((_req, res) => {
    httpCalls += 1;
    res.end("secret");
  });
  await listen(target);
  t.after(() => target.close());
  const targetPort = target.address().port;
  const api = await startApp({
    dns: {
      resolve4: async () => {
        dnsCalls += 1;
        return ["1.1.1.1"];
      },
      resolve6: async () => [],
    },
  });
  t.after(() => api.close());

  const headDns = await request(api, "HEAD", "/v1/dns?host=example.com");
  const getDns = await request(api, "GET", "/v1/dns?host=example.com");
  const headHttp = await request(
    api,
    "HEAD",
    `/v1/http-head?url=${encodeURIComponent(`http://127.0.0.1:${targetPort}/secret`)}`,
  );
  assert.equal(headDns.status, 402);
  assert.equal(getDns.status, 402);
  assert.equal(headHttp.status, 402);
  assert.equal(dnsCalls, 0);
  assert.equal(httpCalls, 0);
});

test("a forged payment header never reaches the probe or a private target", async (t) => {
  let hits = 0;
  const target = http.createServer((_req, res) => {
    hits += 1;
    res.end("secret");
  });
  await listen(target);
  t.after(() => target.close());
  const api = await startApp();
  t.after(() => api.close());
  const forged = Buffer.from(JSON.stringify({ x402Version: 2, accepted: { scheme: "exact" } })).toString("base64");
  const response = await request(
    api,
    "GET",
    `/v1/http-head?url=${encodeURIComponent(`http://127.0.0.1:${target.address().port}/secret`)}`,
    { "payment-signature": forged },
  );
  assert.equal(response.status, 400);
  assert.equal(response.json.error, "payment_malformed");
  assert.equal(hits, 0);
});

test("a paid client still cannot read loopback or a private redirect", async (t) => {
  let hits = 0;
  const target = http.createServer((_req, res) => {
    hits += 1;
    res.end("secret");
  });
  await listen(target);
  t.after(() => target.close());
  const dials = [];
  const api = await startApp({
    http: {
      lookup: async () => [{ address: "1.1.1.1", family: 4 }],
      dispatch: async (probe) => {
        dials.push(probe.address);
        return { status: 302, headers: { location: `http://127.0.0.1:${target.address().port}/secret` } };
      },
    },
  });
  t.after(() => api.close());
  const header = paymentHeader("0x" + "44".repeat(32));
  const literal = await request(
    api,
    "GET",
    `/v1/http-head?url=${encodeURIComponent(`http://127.0.0.1:${target.address().port}/secret`)}`,
    { "payment-signature": header },
  );
  assert.equal(literal.status, 400);
  assert.equal(literal.json.error, "host_not_allowed");
  assert.equal(JSON.stringify(literal.json).includes("secret"), false);
  assert.equal(hits, 0);

  const redirected = await request(
    api,
    "GET",
    `/v1/http-head?url=${encodeURIComponent("https://example.com/start")}`,
    { "payment-signature": paymentHeader("0x" + "45".repeat(32)) },
  );
  assert.equal(redirected.status, 400);
  assert.equal(redirected.json.error, "host_not_allowed");
  assert.deepEqual(dials, ["1.1.1.1"]);
  assert.equal(hits, 0);
});

test("DNS echoes neither internal names nor private answers", async (t) => {
  let calls = 0;
  const api = await startApp({
    dns: {
      resolve4: async () => {
        calls += 1;
        return ["10.1.2.3", "1.1.1.1"];
      },
      resolve6: async () => [],
    },
  });
  t.after(() => api.close());
  const internal = await request(api, "GET", "/v1/dns?host=db.railway.internal", {
    "payment-signature": paymentHeader("0x" + "46".repeat(32)),
  });
  assert.equal(internal.status, 400);
  assert.equal(internal.json.error, "host_not_allowed");
  assert.equal(calls, 0);

  const split = await request(api, "GET", "/v1/dns?host=example.com", {
    "payment-signature": paymentHeader("0x" + "47".repeat(32)),
  });
  assert.equal(split.status, 400);
  assert.equal(split.json.error, "host_not_allowed");
  assert.equal(JSON.stringify(split.json).includes("10.1.2.3"), false);
  assert.equal(calls, 1);
});

test("the same payment cannot run the DNS handler more than once at a time", async (t) => {
  let calls = 0;
  const api = await startApp({
    dns: {
      resolve4: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return ["1.1.1.1"];
      },
      resolve6: async () => [],
    },
  });
  t.after(() => api.close());
  const header = paymentHeader("0x" + "48".repeat(32));
  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      request(api, "GET", "/v1/dns?host=example.com", { "payment-signature": header }),
    ),
  );
  const ok = responses.filter((response) => response.status === 200);
  const blocked = responses.filter((response) => response.status === 429);
  assert.equal(ok.length, 1);
  assert.equal(blocked.length, 7);
  assert.ok(blocked.every((response) => response.json.error === "payment_already_in_progress"));
  assert.equal(calls, 1);
  assert.deepEqual(ok[0].json.a, ["1.1.1.1"]);
});
