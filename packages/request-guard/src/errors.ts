const SAFE_CODE = /^[a-z][a-z0-9_]{0,80}$/;

const POLICY_CODES = new Set([
  "host_not_allowed",
  "private_ip_not_allowed",
  "resolves_to_private_ip",
  "port_not_allowed",
  "dns_lookup_failed",
  "dns_no_records",
  "invalid_url",
  "invalid_protocol",
  "invalid_host",
  "url_auth_not_allowed",
  "url_too_long",
  "missing_url",
  "missing_host",
  "too_many_redirects",
]);

/**
 * Client-facing error text. Stable codes only.
 * Messages that carry a URL, header secret, or provider endpoint collapse to `request_failed`
 * unless they already start with a safe code (`base_rpc_failed`).
 */
export function publicErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const code = raw.split(":")[0]?.trim() ?? "";
  const leaks = /https?:\/\//i.test(raw) || /\b(api[_-]?key|secret|bearer|quiknode|alchemy|infura)\b/i.test(raw);
  if (leaks) {
    if (SAFE_CODE.test(code) && code !== "http" && code !== "https") return code;
    return "request_failed";
  }
  if (SAFE_CODE.test(code)) return code;
  const underscored = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (SAFE_CODE.test(underscored)) return underscored;
  return "request_failed";
}

/** Map a probe failure to a status and a code that does not distinguish socket error classes. */
export function probeErrorResponse(error: unknown): { status: 400 | 502; error: string } {
  const code = publicErrorMessage(error);
  if (!POLICY_CODES.has(code)) return { status: 502, error: "upstream_failed" };
  if (code === "private_ip_not_allowed" || code === "resolves_to_private_ip") {
    return { status: 400, error: "host_not_allowed" };
  }
  return { status: 400, error: code };
}
