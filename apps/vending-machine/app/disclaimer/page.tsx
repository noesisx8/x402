import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Research Disclaimer · x402 Vending Machine",
  description:
    "Research and market tools disclaimer for Kronos forecasts and related endpoints.",
};

export default function DisclaimerRoute() {
  return <LegalPage slug="disclaimer" />;
}
