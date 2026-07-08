import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "x402 Vending Machine",
  description: "Modular pay-per-call APIs for AI agents (USDC / x402 V2)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}