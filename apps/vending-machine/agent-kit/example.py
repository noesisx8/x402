"""Python entry point using the same Node x402 implementation and payment limits.

Default use is quote-only. Funded calls belong on portalv2, per AGENTS.md.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def call_vendsdk(slug, query, *, pay=False, max_price_usdc=None):
    request = {"action": "pay" if pay else "quote", "slug": slug, "query": query}
    if pay:
        if max_price_usdc is None:
            raise ValueError("Paid calls require max_price_usdc")
        request["max_price_usdc"] = max_price_usdc
    # One Node process = one session budget. For multi-call workflows use MCP.
    process = subprocess.run(
        ["node", str(Path(__file__).with_name("example.mjs")), "--json"],
        input=json.dumps(request), text=True, capture_output=True, check=False,
        timeout=150,
    )
    return json.loads(process.stdout)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", default="dns-resolve")
    parser.add_argument("--query", default='{"host":"example.com"}')
    parser.add_argument("--pay", action="store_true")
    parser.add_argument("--max-price-usdc")
    args = parser.parse_args()
    try:
        result = call_vendsdk(args.slug, json.loads(args.query), pay=args.pay,
                              max_price_usdc=args.max_price_usdc)
        print(json.dumps(result))
        sys.exit(1 if "error" in result else 0)
    except (ValueError, subprocess.SubprocessError, OSError):
        print(json.dumps({"error": "example_failed", "message": "Check inputs, Node installation and service availability. No automatic retry was made."}))
        sys.exit(1)
