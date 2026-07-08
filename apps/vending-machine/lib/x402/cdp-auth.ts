import { generateJwt } from "@coinbase/cdp-sdk/auth";

const CDP_API_HOST = "api.cdp.coinbase.com";
const CDP_X402_PREFIX = "/platform/v2/x402";

function isCdpFacilitatorUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === CDP_API_HOST && u.pathname.replace(/\/+$/, "").endsWith("/platform/v2/x402");
  } catch {
    return false;
  }
}

async function authorizationHeader(
  method: "GET" | "POST",
  requestPath: string,
  apiKeyId: string,
  apiKeySecret: string,
): Promise<Record<string, string>> {
  const jwt = await generateJwt({
    apiKeyId,
    apiKeySecret,
    requestMethod: method,
    requestHost: CDP_API_HOST,
    requestPath,
    expiresIn: 120,
  });
  return { Authorization: `Bearer ${jwt}` };
}

/** JWT headers for CDP-hosted x402 facilitator (verify / settle / supported). */
export async function createCdpFacilitatorAuthHeaders(
  apiKeyId: string,
  apiKeySecret: string,
): Promise<{
  verify: Record<string, string>;
  settle: Record<string, string>;
  supported: Record<string, string>;
}> {
  const [verify, settle, supported] = await Promise.all([
    authorizationHeader("POST", `${CDP_X402_PREFIX}/verify`, apiKeyId, apiKeySecret),
    authorizationHeader("POST", `${CDP_X402_PREFIX}/settle`, apiKeyId, apiKeySecret),
    authorizationHeader("GET", `${CDP_X402_PREFIX}/supported`, apiKeyId, apiKeySecret),
  ]);
  return { verify, settle, supported };
}

export function shouldUseCdpFacilitatorAuth(
  facilitatorUrl: string,
  apiKeyId?: string,
  apiKeySecret?: string,
): boolean {
  return isCdpFacilitatorUrl(facilitatorUrl) && Boolean(apiKeyId?.trim() && apiKeySecret?.trim());
}