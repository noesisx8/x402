import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "x402 Vending Machine — Agent-grade APIs, settled on Base",
  description:
    "19 pay-per-call x402 endpoints for agents and developers, settled in USDC on Base with no accounts or API keys.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
