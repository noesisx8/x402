import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "x402 Vending Machine",
  description:
    "Pay-per-call HTTP utilities and AI-ready research tools, settled in USDC on Base — no accounts required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <ThemeProvider>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
