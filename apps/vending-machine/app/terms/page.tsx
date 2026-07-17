import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · x402 Vending Machine",
  description: "Terms of Service for the x402 Vending Machine API and research tools.",
};

export default function TermsRoute() {
  return <LegalPage slug="terms" />;
}
