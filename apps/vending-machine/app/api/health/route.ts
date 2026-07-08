import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "x402-vending-machine" });
}