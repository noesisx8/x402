# Implementation Notes

For the engineer handling legal page deployment on the x402 Vending Machine site.

---

## 1. Suggested Routes

| File | Route | Notes |
|---|---|---|
| `terms.md` | `/terms` | Primary ToS page |
| `privacy.md` | `/privacy` | Privacy Policy |
| `disclaimer.md` | `/disclaimer` | Research & Market Tools Disclaimer |
| *(no separate AUP page)* | `#acceptable-use` anchor in `/terms` | AUP is Section 6 of Terms; link as `/terms#acceptable-use` |

All three pages should be statically generated (SSG is fine - content changes infrequently). A minimal layout with the site footer linking back to all three is sufficient.

---

## 2. What Must Appear on the Homepage

The following must be **visible or one click away** from the homepage:

- [ ] Footer links to `/terms`, `/privacy`, `/disclaimer` (all three)
- [ ] The one-line homepage blurb or equivalent copy making clear this is a research/utility tool, not financial advice

**Do not bury legal links only in a deep `/docs` tree** - they need to be in the footer at every page.

---

## 3. What Should Appear Near Kronos / Premium Tools

Anywhere Kronos endpoints are listed, described, or demonstrated (catalog page, API docs, test wallet UI):

- [ ] The inline research-only disclaimer snippet from `FOOTER_COPY.md`
- [ ] A link to `/disclaimer`

This is especially important on any UI that renders forecast output to a human user (e.g., a browser-based test flow). The Terms already contain a Kronos-specific section (§12), but the inline snippet catches users who don't read the full Terms.

---

## 4. Cookie Banner - Required?

**Assessment: No cookie banner required, based on the described setup.**

Reasoning:
- The Service uses server-side logs only (no client-side analytics cookies described)
- No third-party tracking scripts, advertising pixels, or behavioral analytics cookies are mentioned
- The Privacy Policy notes only essential cookies / session storage on the public website

**However:** If you add any of the following later, reassess immediately:
- Vercel Analytics (uses a first-party cookie/beacon - may require consent in EU)
- PostHog, Mixpanel, Segment, or similar client-side analytics
- Any Google tag, Meta pixel, or third-party marketing script

// OPERATOR: Confirm with your hosting/analytics configuration. Vercel's default `_vercel_analytics` is first-party but may still require disclosure under stricter EU cookie laws (e.g., German TTDSG, French CNIL guidance). When in doubt, add a minimal consent notice.

---

## 5. Open Questions for the Operator

Complete these before publishing:

| # | Question | Where it appears |
|---|---|---|
| 1 | **Legal entity name** - what is the registered or trading name? | All documents |
| 2 | **Contact email** - public-facing email for legal/privacy inquiries | All documents |
| 3 | **Postal address** - required for GDPR Art. 13/14 and some US state laws | Privacy Policy |
| 4 | **Governing law jurisdiction** - which country/state law governs the ToS? | Terms §18 |
| 5 | **Venue** - which courts have jurisdiction for disputes? | Terms §18 |
| 6 | **Effective date** - when do these terms go live? | All documents |
| 7 | **Analytics cookies** - are any client-side scripts present now or planned? | Privacy Policy §10, cookie banner decision |
| 8 | **EU/UK user base** - do you intend to serve EEA/UK users? If yes, GDPR obligations fully apply; confirm SCCs with Vercel/Railway | Privacy Policy §5, §8 |
| 9 | **Upstream data source names** - confirm which exchange APIs (Kraken, Bybit, etc.) are actually used for FX/crypto data, so the disclaimer is accurate | Disclaimer §7, Privacy §6 |
| 10 | **Arbitration clause** - do you want mandatory arbitration instead of courts? (common in US-based SaaS) | Terms §18 |

---

## 6. Acceptable Use Policy

The AUP is integrated as **Section 6** of the Terms of Service rather than a separate page. This is a deliberate choice to reduce the number of pages while keeping all enforceable provisions in one document.

To link directly to it, use the anchor: `/terms#acceptable-use`

If you later need a standalone AUP page (e.g., for API documentation portals), you can extract Section 6 into its own page - the language is already self-contained.

---

## 7. Maintenance Reminders

- Update the **"Last Updated"** date in all documents whenever you make material changes
- If Coinbase CDP, Vercel, Railway, or Kronos change their sub-processor terms materially, update the Privacy Policy §6 and Terms §9
- If you add KYC/AML flows, revise Terms §16 and add a dedicated KYC section to the Privacy Policy
