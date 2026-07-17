# Terms of Service

**x402 Vending Machine**
**Effective Date:** [EFFECTIVE DATE]
**Last Updated:** [LAST UPDATED DATE]

---

## 1. Acceptance of Terms

By accessing or using the x402 Vending Machine API and associated services (collectively, the **"Service"**), you agree to be bound by these Terms of Service ("Terms"). "You" means any person, organization, software agent, or automated client that sends requests to or interacts with the Service.

**If you are operating an automated agent or AI client:** the human or legal entity that configured, deployed, or controls that agent accepts these Terms on its behalf. Automated use does not remove legal responsibility.

If you do not agree to these Terms, do not use the Service.

---

## 2. Description of Service

The Service provides machine-consumable HTTP API utilities, including but not limited to:

- DNS, TLS, and WHOIS lookups
- HTTP probes and endpoint health checks
- Email and MX record inspection
- IP geolocation
- Foreign exchange (FX) and cryptocurrency spot price data
- QR code generation
- Domain intelligence bundles
- Multi-step utility bundles
- **Kronos candle forecast research** - an open-source OHLCV-based research model producing directional forecasts and summaries for informational purposes only (see Section 12 and the separate Research Disclaimer)

The Service is designed for developers and AI agents. It is not a brokerage, exchange, custodial wallet, investment advisor, or financial institution.

---

## 3. Eligibility

You must have the legal capacity to enter into a binding contract in your jurisdiction. If you are acting on behalf of an organization, you represent that you have authority to bind that organization to these Terms.

The Service is not directed at children under the age of 13 (or 16 where applicable under local law). If you are under the applicable age of majority in your jurisdiction, you may not use the Service.

// OPERATOR: If your jurisdiction requires a higher age threshold or explicit age verification, confirm with local counsel.

---

## 4. No User Accounts; Wallet-Based Access

The Service does not require user accounts, passwords, or email registration for core API access. **Payment is the access control mechanism.** Each API call is individually priced; access is granted upon successful payment confirmation.

You are responsible for the security and use of any wallet or signing key you use to interact with the Service. The operator does not custody your private keys and has no ability to reverse on-chain transactions.

---

## 5. Payments

### 5.1 Payment Model

The Service uses the **x402 micropayment protocol**. Unpaid or underpaid requests return an HTTP `402 Payment Required` response. Successful paid requests are settled via the Coinbase CDP facilitator infrastructure on **Base mainnet** in **USDC**.

Payments are sent to the merchant treasury wallet. The operator does not hold, manage, or control user funds at any point in the process.

### 5.2 Finality of Payments

**All payments are final.** Due to the nature of blockchain settlement and the low per-call ticket size of micropayments, the operator does not offer refunds, chargebacks, or credits, except:

- where a server-side error is confirmed and the payment was collected without data being delivered, **and** the operator's infrastructure supports fail-closed settlement (i.e., settlement did not occur); or
- where refusal to refund would violate applicable mandatory consumer protection law in your jurisdiction.

// OPERATOR: Confirm with local counsel whether consumer protection law in your target markets requires mandatory refund rights that override this clause.

### 5.3 Third-Party Settlement Infrastructure

Settlement infrastructure is provided by Coinbase Developer Platform ("CDP") and the Base network. These are third-party services. The operator is not responsible for delays, failures, or changes in those services. Payment confirmation depends on blockchain finality and is outside the operator's control once a transaction is submitted.

---

## 6. Acceptable Use

### 6.1 Permitted Use

You may use the Service for lawful commercial, research, and development purposes consistent with these Terms.

### 6.2 Prohibited Use

You must not:

- Use the Service for any unlawful purpose or in violation of applicable laws or regulations
- Circumvent, attempt to circumvent, or reverse-engineer the payment or access-control mechanisms
- Deliberately send malformed, high-volume, or abusive requests designed to degrade service for others
- Use the Service to process, transmit, or retrieve content that is illegal, defamatory, or infringes third-party rights
- Use the Service in connection with any activity that violates applicable sanctions laws or export control regulations - you represent that you are not located in, or acting on behalf of entities in, jurisdictions subject to relevant trade sanctions
- Resell, repackage, or white-label the Service without the operator's prior written consent
- Use the Kronos research output as the sole basis for financial decisions, trade execution, or investment advice to third parties

// OPERATOR: Confirm sanctions/export control list applicability with local counsel. Consider whether OFAC, EU, or other screening obligations apply to your user base.

### 6.3 Agent Responsibility

If you deploy an automated agent or AI client that uses the Service, **you remain solely responsible** for that agent's payment obligations, compliance with these Terms, and any harm caused by the agent's actions. The operator treats all requests from an agent as if made by the human or organization that controls it.

---

## 7. Rate Limits and Suspension

The operator may impose rate limits at any time to protect service availability. Exceeding rate limits may result in temporary throttling or suspension of access without notice.

The operator may suspend or terminate access to the Service immediately, without notice, if it reasonably determines that your use:

- violates these Terms or applicable law;
- poses a security or integrity risk to the Service or other users; or
- constitutes abuse of the payment or request infrastructure.

Suspension does not entitle you to a refund of prior payments.

---

## 8. Intellectual Property

### 8.1 Service and Site Content

All software, design, branding, and documentation comprising the Service are the property of the operator or its licensors. Nothing in these Terms grants you any ownership interest in the Service.

### 8.2 API Responses

Factual data returned by utility endpoints (DNS records, IP data, FX prices, etc.) is not owned by the operator and may be sourced from third parties or public infrastructure. The operator makes no claim of ownership over raw factual data.

Kronos forecast outputs are generated by an open-source MIT-licensed research model. Use of those outputs is subject to the terms of that license and the Research Disclaimer (see Section 12).

### 8.3 Your Content

You retain ownership of any data or queries you submit to the Service. By submitting queries, you grant the operator a limited right to process that data solely to fulfill your request and for security/analytics purposes described in the Privacy Policy.

---

## 9. Third-Party Services

The Service integrates or depends on third-party services including, without limitation:

- **Coinbase Developer Platform (CDP)** - payment facilitation and blockchain infrastructure
- **Base network** - Layer 2 Ethereum blockchain for settlement
- **Upstream market data providers** (e.g., public exchange APIs for FX and crypto spot prices)
- **Kronos open-source model** (MIT license) - research inference
- **Vercel** - hosting for the public resource server and catalog
- **Railway** - private inference backend hosting (not end-user facing)

The operator is not responsible for the availability, accuracy, or conduct of these third-party services. Their terms and privacy policies apply to their respective services.

---

## 10. Disclaimers of Warranty

**THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."** TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

The operator does not warrant that:

- the Service will be uninterrupted, error-free, or available at any specific time;
- API responses will be accurate, complete, or up to date;
- the Service will meet your specific requirements; or
- any forecast or research output will be accurate or profitable.

No service-level agreement (SLA) is provided unless separately purchased and agreed in writing.

---

## 11. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW:

1. THE OPERATOR'S TOTAL AGGREGATE LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS SHALL NOT EXCEED THE TOTAL AMOUNT OF FEES YOU PAID TO THE SERVICE IN THE **THIRTY (30) DAYS** IMMEDIATELY PRECEDING THE CLAIM.
2. IN NO EVENT SHALL THE OPERATOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

// OPERATOR: Some jurisdictions do not allow exclusion of certain damages or caps on liability. Confirm enforceability with local counsel.

---

## 12. Kronos Research Forecasts - Special Provisions

Kronos forecast outputs are **research only**. They are not financial advice, investment recommendations, offers, or solicitations to buy or sell any asset. See the separate **[Research & Market Tools Disclaimer](/disclaimer)** for full terms applicable to Kronos and all market-data endpoints.

By using any Kronos endpoint, you acknowledge and agree that:

- model outputs may be inaccurate, delayed, or based on incomplete data;
- you assume all risk of relying on or acting on any forecast output; and
- the operator is not a registered investment advisor, broker-dealer, or financial institution.

---

## 13. Not Financial, Investment, Legal, or Tax Advice

Nothing on this site or returned by the Service constitutes financial, investment, legal, or tax advice. You should consult qualified professionals before making decisions based on any data or outputs from the Service.

---

## 14. Indemnification

You agree to indemnify, defend, and hold harmless the operator and its affiliates, officers, employees, and licensors from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to:

- your use of the Service;
- your violation of these Terms;
- your violation of any applicable law or third-party rights; or
- any actions taken by an automated agent or AI client under your control.

---

## 15. Modifications

### 15.1 Modifications to the Service

The operator may modify, suspend, or discontinue any aspect of the Service at any time without notice or liability.

### 15.2 Modifications to These Terms

The operator may update these Terms at any time. Updated Terms will be posted at the Service's public URL with a revised effective date. Continued use of the Service after the effective date constitutes acceptance of the updated Terms. If you do not agree, stop using the Service.

---

## 16. Future Compliance Measures

The operator may introduce identity verification, Know Your Customer (KYC), Anti-Money Laundering (AML), or other compliance checks in the future as required by applicable law or at the operator's discretion. You agree to cooperate with any such measures if introduced.

---

## 17. Termination

Either party may terminate this agreement at any time. You may terminate by ceasing to use the Service. The operator may terminate your access as described in Section 7. Sections 8, 10, 11, 12, 13, 14, and 18 survive termination.

---

## 18. Governing Law and Dispute Resolution

These Terms are governed by the laws of **[GOVERNING LAW JURISDICTION]**, without regard to its conflict-of-law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in **[VENUE]**.

// OPERATOR: Fill in your jurisdiction and venue. Consider whether an arbitration clause is appropriate for your user base and jurisdiction.

---

## 19. Miscellaneous

- **Entire Agreement:** These Terms, together with the Privacy Policy and Research Disclaimer, constitute the entire agreement between you and the operator regarding the Service.
- **Severability:** If any provision of these Terms is found unenforceable, the remaining provisions remain in full force.
- **No Waiver:** Failure to enforce any provision does not constitute a waiver.
- **Assignment:** You may not assign your rights under these Terms without the operator's consent. The operator may assign its rights freely.

---

## 20. Contact

Questions about these Terms:

**[OPERATOR LEGAL NAME]**
[OPERATOR ADDRESS]
[OPERATOR CONTACT EMAIL]
