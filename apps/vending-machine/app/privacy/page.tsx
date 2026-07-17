import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · x402 Vending Machine",
  description: "Privacy Policy for the x402 Vending Machine API and website.",
};

export default function PrivacyRoute() {
  return <LegalPage slug="privacy" />;
}
