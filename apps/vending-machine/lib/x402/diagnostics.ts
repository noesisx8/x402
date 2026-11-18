export type PaymentPipelineStage = "wrapper_initialization" | "payment_processing";

const ERROR_CLASSES = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "AbortError", "TimeoutError",
  "RouteConfigurationError", "FacilitatorResponseError", "VerifyError", "SettleError",
]);
const NETWORK_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
]);

/** Internal diagnostics contain only fixed labels, never messages, URLs or payloads. */
export function paymentPipelineDiagnostics(error: unknown): {
  errorClass: string;
  errorCode: string;
  networkErrorCode?: string;
} {
  const name = error instanceof Error ? error.name : "unknown";
  let errorCode = "payment_pipeline_failed";
  if (name === "RouteConfigurationError") errorCode = "route_configuration_invalid";
  else if (name === "FacilitatorResponseError") errorCode = "facilitator_response_invalid";
  else if (error instanceof Error) {
    if (error.message.startsWith("Failed to initialize: no supported payment kinds loaded")) {
      errorCode = "facilitator_initialization_failed";
    } else if (error.message.startsWith("Facilitator does not support ")) {
      errorCode = "facilitator_capability_unavailable";
    }
  }

  let networkErrorCode: string | undefined;
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code = (current as Error & { code?: unknown }).code;
    if (typeof code === "string" && NETWORK_CODES.has(code)) {
      networkErrorCode = code;
      break;
    }
    current = current.cause;
  }
  return {
    errorClass: ERROR_CLASSES.has(name) ? name : "unknown",
    errorCode,
    ...(networkErrorCode ? { networkErrorCode } : {}),
  };
}
