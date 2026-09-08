import { clientFromEnv, VendError } from "./client.mjs";

// Default: a quote only. --json is the shared bridge used by the Python example.
try {
  const client = clientFromEnv();
  let input = { action: "quote", slug: "dns-resolve", query: { host: "example.com" } };
  if (process.argv.includes("--json")) {
    let text = "";
    for await (const chunk of process.stdin) {
      text += chunk;
      if (text.length > 16_000) throw new VendError("invalid_input", "Input exceeds 16 KB.");
    }
    input = JSON.parse(text);
  }
  let output;
  if (input.action === "quote") output = await client.quote(input.slug, input.query);
  else if (input.action === "pay") output = await client.paid(input.slug, input.query, input.max_price_usdc);
  else throw new VendError("invalid_action", "Use action quote or pay.");
  process.stdout.write(`${JSON.stringify(output)}\n`);
} catch (e) {
  process.stdout.write(`${JSON.stringify(e instanceof VendError ? { error: e.code, message: e.message } : { error: "example_failed", message: "Check the example inputs and service configuration." })}\n`);
  process.exitCode = 1;
}
