# Privacy Policy

**x402 Vending Machine**
**Effective Date:** [EFFECTIVE DATE]
**Last Updated:** [LAST UPDATED DATE]

---

## 1. Who We Are

**Controller / Operator:** [OPERATOR LEGAL NAME]
**Contact:** [OPERATOR CONTACT EMAIL]
**Address:** [OPERATOR ADDRESS]

References to "we," "us," or "our" mean [OPERATOR LEGAL NAME].

---

## 2. Scope

This Privacy Policy explains what data we collect when you or an automated client interacts with the x402 Vending Machine API and website (collectively, the "Service"), how we use it, and your rights.

**This Service does not require user account registration.** We do not collect names, email addresses, or passwords as part of normal API use. The data we handle is limited to what is technically generated when you make an HTTP request and when payments are processed on-chain.

---

## 3. Data We Collect

Because the Service is accessed programmatically and without accounts, the data we process is technical in nature:

### 3.1 Request and Log Data (collected automatically)

| Data type | Examples | Why collected |
|---|---|---|
| IP address | `203.0.113.42` | Security, abuse prevention, rate limiting |
| User-Agent string | Client library, browser, or agent identifier | Debugging, analytics |
| Request path and query | `/api/dns?domain=example.com` | Fulfilling the request, analytics |
| HTTP headers | Accept, Content-Type | Request processing |
| Timestamp | Time of request | Log correlation, debugging |
| Rate-limit keys | Derived identifiers for throttling | Abuse prevention |
| HTTP response codes | `200`, `402`, `429`, `500` | Analytics: paid calls, errors |
| Truncated payment / payer hints | Non-sensitive partial metadata from the x402 flow | Fraud detection, billing integrity |

**We do not log full private keys, wallet seed phrases, or full payment secrets.**

### 3.2 On-Chain / Payment Metadata

Payments are settled on the Base mainnet blockchain via the Coinbase CDP facilitator. On-chain transactions - including payer wallet addresses and transaction hashes - are **publicly visible on the blockchain by design**. We may retain references to transaction hashes or public wallet addresses for billing integrity, audit, and abuse prevention purposes.

We do not custody your funds or private keys at any point.

### 3.3 Analytics Events (server-side)

We may record structured analytics events such as:

- `402_issued` (a request was made without payment)
- `paid_delivery` (payment confirmed, response delivered)
- `error` (server-side failure)
- Endpoint category and response size (not response content)

These events contain no personal content from your queries.

### 3.4 What We Do Not Collect

- Names, email addresses, or passwords (no user accounts)
- Payment card details or fiat banking information
- Full private keys or wallet secrets
- Content of DNS/WHOIS/HTTP responses beyond what is needed to fulfill the request

---

## 4. How We Use Your Data

We use the data described above to:

1. **Provide the Service** - process your API requests and deliver responses
2. **Security and fraud/abuse prevention** - detect malicious requests, spam, and misuse
3. **Debugging and reliability** - diagnose errors and improve service stability
4. **Product analytics** - understand usage patterns at an aggregate level
5. **Legal compliance** - comply with applicable law, respond to lawful requests from authorities, and enforce our Terms of Service

---

## 5. Legal Bases for Processing (EU / UK users)

// OPERATOR: If you have users in the EU or UK, GDPR/UK GDPR apply. The bases below are suggested starting points - confirm with local counsel.

If you are in the European Economic Area (EEA) or United Kingdom, we rely on the following legal bases:

| Processing activity | Legal basis |
|---|---|
| Fulfilling API requests | Performance of a contract (Art. 6(1)(b)) |
| Security, fraud prevention, rate limiting | Legitimate interests (Art. 6(1)(f)) |
| Compliance with legal obligations | Legal obligation (Art. 6(1)(c)) |
| Aggregate product analytics | Legitimate interests (Art. 6(1)(f)) |

Our legitimate interests in processing are: operating a secure, reliable API service; detecting and preventing abuse; and understanding how the Service is used to improve it. We believe these interests are balanced and do not override your fundamental rights.

---

## 6. Data Processors and Sub-processors

We engage the following categories of third-party processors. Each operates under its own terms and privacy policy:

| Category | Provider(s) | Purpose |
|---|---|---|
| Hosting - public resource server | Vercel | Serving the API and website |
| Hosting - inference backend | Railway | Running the Kronos model (not end-user facing) |
| Blockchain / payment facilitator | Coinbase Developer Platform (CDP), Base network | Settling micropayments on-chain |
| Upstream market data | Kronos OHLCV: Bybit, Kraken, Binance.US, Binance.com (cascade); crypto spot: CoinGecko; FX: Frankfurter/ECB | Fulfilling market and forecast requests |
| Open-source model | Kronos (MIT license) | Generating forecast outputs |

We do not sell, rent, or trade your personal data to third parties for marketing purposes.

---

## 7. Data Retention

We aim for short retention periods proportionate to purpose:

| Data type | Suggested retention |
|---|---|
| Server request logs (IP, UA, path) | 7–90 days, unless a security or legal hold requires longer |
| Analytics events | Up to 12 months in aggregate/anonymized form |
| Abuse / rate-limit records | Up to 90 days |
| On-chain references (tx hashes, wallet hints) | As long as needed for billing integrity and legal compliance |

// OPERATOR: Set specific retention periods in your infrastructure configuration and document them internally.

---

## 8. International Data Transfers

Our infrastructure is hosted on Vercel and Railway, which may store and process data in the United States and other jurisdictions. If you are in the EEA or UK, your data may be transferred to countries that do not have an adequacy decision.

// OPERATOR: If you process EEA/UK user data, confirm that your Vercel and Railway configurations include appropriate transfer mechanisms (e.g., Standard Contractual Clauses). Both Vercel and Railway publish DPA/SCCs for enterprise customers.

---

## 9. Your Rights

Because the Service does not use accounts, we cannot link most log data to a specific individual without additional identifying information. However:

- **EEA/UK users** have rights under GDPR/UK GDPR including access, rectification, erasure, restriction, portability, and the right to object to processing based on legitimate interests.
- **California users** may have rights under CCPA/CPRA including the right to know, delete, and opt out of sale (we do not sell personal data).
- **All users** may contact us at [OPERATOR CONTACT EMAIL] to request information about data we hold or to request deletion.

If you contact us with a rights request, please include your public wallet address or transaction hash so we can identify any records associated with you. We will respond within the timeframe required by applicable law.

---

## 10. Cookies and Tracking

The Service API itself does not set cookies. The public website may use essential cookies or session storage for basic functionality only.

**We do not use third-party advertising cookies, tracking pixels, or behavioral advertising.**

// OPERATOR: If you add analytics (e.g., Vercel Analytics, PostHog, Plausible), update this section and assess whether a cookie banner is required for your EU/UK audience.

---

## 11. Children's Privacy

The Service is not directed at children under the age of 13 (or 16 where applicable under local law). We do not knowingly collect personal data from children. If you believe a child has provided us with data, please contact us and we will delete it.

---

## 12. Security

We implement technical and organizational measures appropriate to the risk, including access controls on server logs, short retention periods, and no storage of full private keys or secrets. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security.

---

## 13. Changes to This Policy

We may update this Privacy Policy at any time. Changes will be posted at the Service's public URL with a revised effective date. Continued use of the Service after the effective date constitutes acceptance of the updated Policy.

---

## 14. Contact

For privacy questions, rights requests, or data-related concerns:

**[OPERATOR LEGAL NAME]**
[OPERATOR ADDRESS]
[OPERATOR CONTACT EMAIL]
