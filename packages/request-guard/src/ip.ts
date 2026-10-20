import { BlockList, isIP } from "node:net";

const blocked = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

function ipv4FromHexPair(mapped: string): string | null {
  const words = mapped.split(":");
  if (words.length !== 2 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  const high = Number.parseInt(words[0], 16);
  const low = Number.parseInt(words[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

/** True when `address` is a routable public unicast address. */
export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family !== 6) return false;

  const lower = address.toLowerCase();
  const mapped = lower.match(/^::ffff:(.+)$/)?.[1];
  if (mapped) {
    if (isIP(mapped) === 4) return isPublicIp(mapped);
    const dotted = ipv4FromHexPair(mapped);
    if (!dotted) return false;
    return isPublicIp(dotted);
  }

  // 6to4 embeds an IPv4 address. Reject the address when that IPv4 is non-public.
  const sixToFour = lower.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/);
  if (sixToFour) {
    const dotted = ipv4FromHexPair(`${sixToFour[1]}:${sixToFour[2]}`);
    if (!dotted || !isPublicIp(dotted)) return false;
  }

  return !blocked.check(lower, "ipv6");
}

export function stripHostBrackets(host: string): string {
  const value = host.trim().toLowerCase().replace(/\.$/, "");
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1);
  return value;
}

/**
 * Reject loopback names, internal suffixes, and non-public IP literals.
 * Returns a normalized host suitable for DNS.
 */
export function assertPublicHostname(raw: string): string {
  const host = stripHostBrackets(raw);
  if (!host || host.length > 253) throw new Error("invalid_host");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain")
  ) {
    throw new Error("host_not_allowed");
  }
  if (host.includes(":") || isIP(host) !== 0) {
    if (!isPublicIp(host)) throw new Error("private_ip_not_allowed");
    return host;
  }
  if (!host.includes(".") || host.startsWith(".") || host.includes("..") || !/^[a-z0-9.-]+$/.test(host)) {
    throw new Error("invalid_host");
  }
  return host;
}

/** Reject the whole answer set when any address is non-public. Does not echo the addresses. */
export function assertPublicAnswers(addresses: readonly string[]): void {
  if (addresses.length === 0) throw new Error("dns_no_records");
  for (const address of addresses) {
    if (!isPublicIp(address)) throw new Error("host_not_allowed");
  }
}
