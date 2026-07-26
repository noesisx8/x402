import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "x402 Vending Machine",
  description:
    "Pay-per-call HTTP utilities and AI-ready research tools, settled in USDC on Base — no accounts required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <SiteHeader />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
