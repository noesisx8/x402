import { NextResponse } from "next/server";
import { getRecentAnalytics } from "@/lib/analytics";
import { VENDING_SERVICES } from "@/lib/services/registry";
import { serverEnv, CAIP_NETWORK } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    network: CAIP_NETWORK[serverEnv.X402_NETWORK_MODE],
    services: VENDING_SERVICES.length,
    recent_calls: getRecentAnalytics(30),
  });
}