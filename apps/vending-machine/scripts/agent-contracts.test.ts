import test from "node:test";
import assert from "node:assert/strict";
import { VENDING_SERVICES, SERVICES_BY_SLUG } from "../lib/services/registry";
import { validInput, validOutput } from "../lib/services/validation";
import { extractHtml } from "../lib/services/extraction";
import { publicAddress, publicUrl } from "../lib/services/public-fetch";

test("all published catalog examples validate against their contracts", () => {
  for (const service of VENDING_SERVICES) {
    assert.equal(validInput(service, service.discovery!.exampleQuery), true, `${service.slug} input`);
    assert.equal(validOutput(service, service.discovery!.exampleOutput), true, `${service.slug} output`);
  }
});
test("extraction formats and numerical bounds are usable through runtime validation", () => {
  for (const format of ["text", "markdown", "structured"]) {
    assert.equal(validInput(SERVICES_BY_SLUG["fetch-text"], { url: "https://example.com", format, max_chars: "12000" }), true);
  }
  assert.equal(validInput(SERVICES_BY_SLUG["fetch-text"], { url: "https://example.com", max_chars: "Infinity" }), false);
  assert.equal(validInput(SERVICES_BY_SLUG["fetch-text"], { url: "https://example.com", max_chars: "20001" }), false);
  assert.equal(validOutput(SERVICES_BY_SLUG["fetch-text"], { service: "fetch-text", ok: true, markdown: "", text: "hello" }), true);
});
test("structured extraction parses headings and relative links and discards active content", () => {
  const result = extractHtml('<title>Sample</title><h1>Heading</h1><p>Useful <b>text</b></p><a href="/docs">Docs</a><a href="javascript:alert(1)">Bad</a><script>private code</script>', "https://example.com/page", 1000);
  assert.equal(result.title, "Sample");
  assert.deepEqual(result.headings, [{ level: 1, text: "Heading" }]);
  assert.deepEqual(result.links, [{ text: "Docs", url: "https://example.com/docs" }]);
  assert.ok(result.markdown.startsWith("# Heading")); assert.ok(!result.text.includes("private code"));
  assert.equal(result.truncated, false);
});
test("malformed and oversized HTML stays bounded", () => {
  const result = extractHtml(`<h2>Open heading<p>${"x".repeat(2000)}`, "https://example.com", 500);
  assert.ok(result.text.length <= 500); assert.ok(result.markdown.length <= 500); assert.equal(result.truncated, true);
});
test("public-address checks reject private, reserved and mapped addresses", () => {
  for (const address of ["127.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "2001:db8::1", "2002:7f00:1::"]) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
  assert.throws(() => publicUrl("http://127.0.0.1"));
  assert.throws(() => publicUrl("https://example.com:22"));
});
