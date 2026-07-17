# Pre-publish checklist (legal pages)

## 1. Fill all `[PLACEHOLDERS]` via Vercel env

Set on **Production** (and Preview if you want):

| Env var | Example / notes |
|---------|-----------------|
| `LEGAL_OPERATOR_NAME` | Registered or trading name |
| `LEGAL_CONTACT_EMAIL` | Public legal/privacy inbox |
| `LEGAL_OPERATOR_ADDRESS` | Postal address (GDPR Art. 13 may require) |
| `LEGAL_GOVERNING_LAW` | e.g. `the State of Delaware, United States` |
| `LEGAL_VENUE` | e.g. `state and federal courts located in Wilmington, Delaware` |
| `LEGAL_EFFECTIVE_DATE` | ISO date when policies go live (default in code: `2026-07-17`) |
| `LEGAL_LAST_UPDATED` | Optional; defaults to effective date |

Until these are set, pages still render but show interim operator name / `[PLACEHOLDER]`-style contact, and the site footer shows a **draft** notice.

## 2. Upstream data providers — **DONE**

Kronos OHLCV: **Bybit → Kraken → Binance.US → Binance.com**  
Spot: CoinGecko · FX: Frankfurter/ECB  

Updated in `disclaimer.md` / `privacy.md` (both `docs/t&s` and `content/legal`).

## 3. Fail-closed settlement — **CONFIRMED in code**

`apps/vending-machine/app/api/v/[slug]/route.ts`: handler errors return **HTTP ≥ 400**; comment and `@x402/next` `withX402` behavior: **settlement skipped** when status ≥ 400.

Terms §5.2 narrow exception is consistent with this stack for **failed handler responses**. Edge cases (client disconnect mid-flight after settle) remain blockchain realities — already covered by finality language.

**Operator test (recommended once):** force a 400 (bad Kronos params or bad email) with payment present → confirm **no** settlement header / no charge.

## 4. EU/UK decision — **OPERATOR**

If serving EEA/UK users: confirm **Vercel + Railway DPA/SCCs** before treating Privacy §5/§8 as complete. Not automated in this repo.

## 5. Attorney review — **OPERATOR**

Especially: governing law, venue, liability cap enforceability, crypto/micropayment characterization, GDPR if EU/UK.

---

⚠️ These docs are practical SaaS/API drafts, **not** a legal opinion.
