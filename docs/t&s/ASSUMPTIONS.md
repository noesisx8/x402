# Assumptions

Material assumptions made during drafting. Review each and correct where inaccurate before publishing.

---

## Business & Legal Structure

1. **No legal entity yet determined.** All entity name, address, and contact fields are left as placeholders. The operator must fill these before publishing - some jurisdictions require a legal name and address to appear in a privacy policy by law (e.g., GDPR Art. 13).

2. **Governing law and venue are unknown.** Placeholders used throughout. The choice of law will affect which warranty exclusions and liability caps are enforceable. US, UK, EU, and Singapore all have meaningful differences here.

3. **No arbitration clause included.** A court-based dispute resolution clause was used. If the operator prefers mandatory arbitration (common in US consumer-facing SaaS), a separate arbitration/class-action-waiver clause should be added by counsel.

---

## Product & Payment

4. **Fail-closed settlement assumed to be the intended behavior.** The no-refund clause includes a narrow exception "where the operator's infrastructure supports fail-closed settlement." This reflects the brief's statement that the stack is "fail-closed on handler errors." If the production stack does not reliably prevent settlement on failed requests, this exception language needs revision.

5. **No custodial user balances.** The brief explicitly states this. If a prepaid credit or balance system is added later, the Terms and Privacy Policy require significant revision (potentially triggering money transmission / e-money regulations in many jurisdictions).

6. **Coinbase CDP is treated as infrastructure, not a co-party.** The Terms mention CDP at a high level as settlement infrastructure. If Coinbase's CDP terms require specific pass-through disclosures to end users, those should be reviewed and incorporated.

7. **x402 is a novel payment scheme.** There is limited regulatory precedent specifically for x402 micropayments. The no-refund framing and "payment as access control" model are drafted on best-effort SaaS/API patterns, but this area may develop. // OPERATOR: Monitor regulatory guidance on micropayment and crypto payment finality in your jurisdiction.

---

## Data & Privacy

8. **Server-side logs only; no client-side cookies or analytics scripts.** If Vercel Analytics, PostHog, or any third-party script is added, the Privacy Policy and cookie section must be updated, and a cookie consent mechanism may be required for EU/UK users.

9. **No email addresses or names are collected in normal operation.** If a contact form, mailing list, waitlist, or support ticket system is added, a separate data collection notice is required.

10. **On-chain data is public.** The Privacy Policy notes that payer wallet addresses and transaction hashes are publicly visible on the Base blockchain. This is a fundamental property of public blockchains and cannot be remediated by a privacy policy - it is disclosed rather than promised as private.

11. **GDPR applicability assumed possible.** EU/UK-style legal bases are included with `// OPERATOR:` flags. If the operator concludes they have no EU/UK users and no establishment in those regions, the GDPR sections can be simplified. However, global internet access means EU/UK exposure is likely.

---

## Kronos & Market Data

12. **Upstream data providers confirmed (2026-07-17).** Kronos OHLCV cascade: Bybit → Kraken → Binance.US → Binance.com. Crypto spot atom: CoinGecko. FX atom: Frankfurter/ECB (+ open.er-api fallback). Documents updated accordingly.

13. **Kronos is MIT-licensed open source.** This is taken from the brief. The MIT license imposes no additional end-user obligations beyond attribution, but if the operator has made modifications and distributes the model or its outputs commercially, confirming compliance with the MIT license terms is advisable.

14. **Kronos outputs are treated as non-regulated research.** This drafting assumes the operator is not registered as a financial advisor or broker. If the operator or any affiliate holds a financial services license, the disclaimer language may need to be updated to reflect that regulatory status rather than disclaim it.

---

## Scope

15. **No Acceptable Use Policy page was created as a separate file.** The AUP is Section 6 of the Terms. If a standalone page is needed for API documentation, extract Section 6 verbatim.

16. **No gambling, sweepstakes, or regulated financial product language included.** Consistent with the brief's explicit instruction.

17. **KYC/AML not currently implemented.** A forward-looking "we may introduce compliance checks" clause is included in Terms §16. This is intentionally minimal - do not expand it without counsel if you are in a jurisdiction with active crypto compliance obligations (e.g., EU MiCA, UK FCA registration requirements).

---

## General

18. **These documents are a starting point, not a final legal opinion.** They are drafted using standard SaaS/API patterns adapted to the described product. They have not been reviewed by a licensed attorney in any specific jurisdiction. Before publishing, the operator should have a qualified attorney review the documents, particularly: (a) governing law and liability cap enforceability; (b) whether the operator's activities trigger financial services, payment, or money transmission regulation; and (c) GDPR/CCPA compliance if material user populations are in the EU/UK or California.
