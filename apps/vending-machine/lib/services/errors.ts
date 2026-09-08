/** Public error contract: never return raw upstream responses or internal errors. */
export function serviceFailure(error: unknown): { status: number; error: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out/i.test(message)) {
    return { status: 504, error: "upstream_timeout", retryable: true };
  }
  if (/^(missing[ _]|invalid[ _]|missing_or_invalid_|(?:symbol|interval|model)_not_allowed|(?:url_auth|host|private_ip|port)_not_allowed|resolves_to_private_ip|redirect_private|url_too_long|city_not_found|domain_not_found|dns_no_records)/.test(message)) {
    return { status: 400, error: "invalid_request", retryable: false };
  }
  if (message.startsWith("kronos_not_configured")) {
    return { status: 503, error: "service_unavailable", retryable: true };
  }
  return { status: 502, error: "upstream_failure", retryable: true };
}
