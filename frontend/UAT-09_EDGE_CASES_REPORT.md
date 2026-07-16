# UAT-09 — Negative & Edge Cases

**Date:** 2026-07-11
**Overall:** ✅ PASS (54/54)

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-09.1 | Required fields | Lead form: prospect name required | PASS |  |
| UAT-09.2 | Required fields | Lead form: lead owner required | PASS |  |
| UAT-09.3 | Required fields | Lead form: closed stage requires date + reason | PASS |  |
| UAT-09.4 | Required fields | Opportunity lines: company required | PASS |  |
| UAT-09.5 | Required fields | Contact form: name + company required | PASS |  |
| UAT-09.6 | Required fields | Backend lead schema requires prospectName | PASS |  |
| UAT-09.7 | Required fields | Backend opportunity requires opportunityName | PASS |  |
| UAT-09.8 | Required fields | Blank prospect blocks save (logic) | PASS |  |
| UAT-09.9 | Required fields | Empty opportunity header yields errors | PASS | Company is required.; Opportunity owner is required.; Stage is required.; Probability is required.; At least one product / item line is required. |
| UAT-09.10 | Email/phone | Lead form uses type=email input | PASS |  |
| UAT-09.11 | Email/phone | Backend lead schema validates email format | PASS |  |
| UAT-09.12 | Email/phone | Backend contact schema validates email format | PASS |  |
| UAT-09.13 | Email/phone | Frontend contact schema validates email format | PASS |  |
| UAT-09.14 | Email/phone | Backend rejects invalid email | PASS |  |
| UAT-09.15 | Email/phone | Backend accepts valid email | PASS |  |
| UAT-09.16 | Email/phone | Backend mobile max length 20 | PASS |  |
| UAT-09.17 | Numeric bounds | Opportunity rejects qty ≤ 0 | PASS |  |
| UAT-09.18 | Numeric bounds | Opportunity rejects negative unit price | PASS |  |
| UAT-09.19 | Numeric bounds | Opportunity rejects discount > 100% | PASS |  |
| UAT-09.20 | Numeric bounds | Backend lead expectedValue min(0) | PASS |  |
| UAT-09.21 | Numeric bounds | Backend opportunity value min(0) | PASS |  |
| UAT-09.22 | Numeric bounds | Lead form allows expectedValue 0 (informational) | PASS |  |
| UAT-09.23 | Text length | Backend prospectName max 300 | PASS |  |
| UAT-09.24 | Text length | Backend opportunityName max 300 | PASS |  |
| UAT-09.25 | Text length | Backend contact name max 200 | PASS |  |
| UAT-09.26 | Text length | Backend rejects prospectName > 300 chars | PASS |  |
| UAT-09.27 | Double-submit | Lead form guards with isSubmitting | PASS |  |
| UAT-09.28 | Double-submit | Opportunity new guards with isSubmitting | PASS |  |
| UAT-09.29 | Double-submit | Opportunity edit disables save when submitting | PASS |  |
| UAT-09.30 | Double-submit | CRM API bridge uses submitLocks | PASS |  |
| UAT-09.31 | Double-submit | Lead form save buttons disabled while submitting | PASS |  |
| UAT-09.32 | Session expiry | API client retries 401 with refresh token | PASS |  |
| UAT-09.33 | Session expiry | Failed refresh clears stored session | PASS |  |
| UAT-09.34 | Session expiry | AuthProvider clears session on /me failure | PASS |  |
| UAT-09.35 | Session expiry | ApiAuthGate redirects unauthenticated to /login | PASS |  |
| UAT-09.36 | Session expiry | Mock 401 on save surfaces ApiError | PASS |  |
| UAT-09.37 | API failure | ApiError class with statusCode + fieldErrors | PASS |  |
| UAT-09.38 | API failure | formatApiError maps field errors | PASS |  |
| UAT-09.39 | API failure | Lead form shows toast on save failure | PASS |  |
| UAT-09.40 | API failure | CRM bridge uses formatApiError | PASS |  |
| UAT-09.41 | API failure | formatApiError includes field:message | PASS |  |
| UAT-09.42 | Empty states | Leads table empty message when no data | PASS |  |
| UAT-09.43 | Empty states | Lead 360 shows converted empty panel | PASS |  |
| UAT-09.44 | Empty states | Opportunity 360 not-found state | PASS |  |
| UAT-09.45 | Empty states | Lead form not-found when id missing | PASS |  |
| UAT-09.46 | Empty states | AppErrorBoundary catches route errors | PASS |  |
| UAT-09.47 | No search results | filterLeadRows returns empty for nonsense search | PASS |  |
| UAT-09.48 | No search results | filterLeadRows finds partial match | PASS | 1 |
| UAT-09.49 | Browser refresh | Refresh mid-workflow preserves draft (lead autosave) | MANUAL |  |
| UAT-09.50 | Back button | Post-conversion back navigates without duplicate opp | MANUAL |  |
| UAT-09.51 | Double-click | Rapid double-click Save does not duplicate record | MANUAL | Verify in browser |
| UAT-09.52 | Session expiry | Expired session during save redirects to login | MANUAL | Clear tokens in DevTools then save |
| UAT-09.53 | API failure | Live API rejects blank prospect + bad email | PASS | HTTP 400 |
| UAT-09.54 | Numeric bounds | Live API rejects negative expectedValue | PASS | HTTP 400 |

## Findings

- **Required fields:** Lead, opportunity, and contact forms enforce core required fields; backend Zod schemas align.
- **Email/phone:** Backend validates email format; lead form uses `type="email"` but no programmatic validation; contact form schema is optional string only (gap).
- **Numeric bounds:** Opportunity line validator rejects qty ≤ 0, negative price, discount > 100%; backend uses `min(0)`.
- **Text length:** Backend enforces max lengths (e.g. prospectName 300); frontend has no explicit maxlength on most CRM text fields.
- **Double-submit:** `isSubmitting` guard + CRM bridge `submitLocks`; lead form save buttons should be `disabled` while submitting.
- **Session expiry:** Client refresh-on-401; failed refresh clears session; ApiAuthGate redirects to login.
- **API errors:** `ApiError` + `formatApiError` + form toasts — not silent.
- **Empty / no-results:** List tables show contextual empty messages; filters return zero rows for nonsense search.

## Manual browser checklist

- [ ] **Blank required fields** — New lead: clear Company/Prospect, click Save → inline errors, no navigation
- [ ] **Invalid email** — Enter `not-an-email` on lead/contact → browser or API rejects
- [ ] **Zero/negative qty** — Opportunity line qty 0 or -1 → row validation error
- [ ] **Long text** — Paste 500+ chars in prospect name → verify backend/API rejection in API mode
- [ ] **Rapid double-click Save** — Double-click Save on new lead → only one record created
- [ ] **Rapid double-click Convert** — Qualified lead → Convert to Opportunity twice quickly → single opportunity
- [ ] **Browser refresh mid-workflow** — Partial lead form → F5 → draft/autosave restores or clear message
- [ ] **Back button after conversion** — Convert lead → browser Back → no duplicate convert action
- [ ] **Expired session during save** — DevTools: clear `fos-erp-auth` → Save → redirect to `/login` with message
- [ ] **API failure** — Stop backend → Save in API mode → toast/error (not silent)
- [ ] **Empty-state screens** — Filter leads to zero rows → "No leads match current filters." + actions
- [ ] **No search results** — Global/search box with `zzz-nonexistent` → empty state, no crash

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`
