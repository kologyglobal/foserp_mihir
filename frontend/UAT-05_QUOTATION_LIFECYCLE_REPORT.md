# UAT-05 — Quotation Lifecycle

**Date:** 2026-07-29
**Overall:** ❌ FAIL (50/64)

## Critical path

Opportunity → Quotation → Approval → Revision → Approved Quotation → Sales Order

| ID | Area | Test | Status | Notes |
|----|------|------|--------|-------|
| UAT-05.1 | Routes | CRM quotation list/new/detail routes | PASS |  |
| UAT-05.2 | Routes | Editor, preview, print, revisions routes | PASS |  |
| UAT-05.3 | Store | createQuotationFromOpportunity in crmStore | PASS |  |
| UAT-05.4 | Store | Approval workflow actions in crmStore | PASS |  |
| UAT-05.5 | Store | Revision + SO conversion in crmStore | PASS |  |
| UAT-05.6 | Bridge | quotationApiBridge CRUD + lifecycle | PASS |  |
| UAT-05.7 | Backend | Quotation routes: submit/approve/reject/revisions | PASS |  |
| UAT-05.8 | Backend | Approve requires crm.quotation.approve permission | PASS |  |
| UAT-05.9 | Backend | Duplicate opportunity quotation blocked | PASS |  |
| UAT-05.10 | UI | Approval panel shows threshold warnings | PASS |  |
| UAT-05.11 | UI | Revision history marks Latest revision | PASS |  |
| UAT-05.12 | UI | Convert to SO action component | FAIL |  |
| UAT-05.13 | Tax/discount/totals | Line total = qty × price × (1-discount) + GST | PASS | 224200 |
| UAT-05.14 | Tax/discount/totals | Line total matches expected ₹2,24,200 | PASS |  |
| UAT-05.15 | Tax/discount/totals | Summary taxable value after discount | PASS |  |
| UAT-05.16 | Tax/discount/totals | Summary GST amount | PASS |  |
| UAT-05.17 | Tax/discount/totals | Grand total includes freight/install/custom | PASS |  |
| UAT-05.18 | Tax/discount/totals | calcPriceSummary exported from crmQuotationCalc | PASS |  |
| UAT-05.19 | Create quotation | Quotation created from opportunity | PASS | quo-b9df5980 |
| UAT-05.20 | Create quotation | Opportunity linked to quotation | PASS |  |
| UAT-05.21 | Create quotation | Sales header quotation exists | PASS |  |
| UAT-05.22 | Line items | Document has at least one price line | PASS | 1 lines |
| UAT-05.23 | Line items | Price line has qty and unit price | PASS |  |
| UAT-05.24 | Line items | Document grand total computed | PASS | 2099999.98 |
| UAT-05.25 | Draft state | New document status is draft | PASS |  |
| UAT-05.26 | Draft state | Draft document is not locked | PASS |  |
| UAT-05.27 | Draft state | Draft quotation cannot convert to SO | PASS |  |
| UAT-05.28 | Draft state | Convert button hidden for draft | FAIL |  |
| UAT-05.29 | Approval restrictions | Amount threshold defined (₹50L) | PASS |  |
| UAT-05.30 | Approval restrictions | Discount threshold defined (10%) | PASS |  |
| UAT-05.30b | Approval restrictions | Backend discount threshold matches frontend (10%) | PASS |  |
| UAT-05.31 | Approval restrictions | Sales manager can approve | PASS |  |
| UAT-05.32 | Approval restrictions | High-value submit → pending_approval | PASS | pending_approval |
| UAT-05.33 | Approval restrictions | Shop floor cannot approve quotation | PASS | Requires sales → approve — your role (Shop Floor Operator) does not have this permission |
| UAT-05.34 | Reject/revise | Rejected document status | FAIL |  |
| UAT-05.35 | Reject/revise | Rejected quotation cannot convert | PASS |  |
| UAT-05.36 | Revision numbering | New revision number increments | PASS | rev 2 |
| UAT-05.37 | Revision numbering | New revision starts as draft | PASS |  |
| UAT-05.38 | Original preserved | Original revision locked after revise | PASS |  |
| UAT-05.39 | Original preserved | Original revision status unchanged (rejected) | FAIL |  |
| UAT-05.40 | Original preserved | Both revisions exist for quotation | PASS |  |
| UAT-05.41 | Approved version | Latest document is approved | PASS | approved |
| UAT-05.42 | Approved version | getLatestQuotationDocument returns highest revision | PASS |  |
| UAT-05.43 | Approved version | Approval history contains approved action | PASS |  |
| UAT-05.44 | Approved version | Convert button visible for latest approved | PASS |  |
| UAT-05.45 | Approved version | Old revision convert button hidden | PASS |  |
| UAT-05.46 | Invalid conversion | Approved quotation passes validation | FAIL |  |
| UAT-05.47 | Invalid conversion | Expired quotation blocked | PASS |  |
| UAT-05.48 | Invalid conversion | Validation checks approval history | PASS |  |
| UAT-05.49 | Invalid conversion | Non-latest revision blocked | PASS | Only the latest quotation revision can be converted to a Sales Order. |
| UAT-05.50 | Sales Order | Approved quotation converts to SO | FAIL |  |
| UAT-05.51 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.52 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.53 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.54 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.55 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.56 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.57 | Sales Order / double conversion | Conversion step | FAIL | Select an Item for 45 m³ tipper trailer. |
| UAT-05.58 | Backend workflow | assertDocumentSubmittable blocks locked non-draft | PASS |  |
| UAT-05.59 | Backend workflow | assertDocumentApprovable checks status | PASS |  |
| UAT-05.60 | Live API | Login for quotation tests | PASS | Login successful |
| UAT-05.61 | Live API | List quotations endpoint | PASS | HTTP 200 |
| UAT-05.62 | Live API | Fetch open opportunity for quotation | PASS | 7545f5a2-4935-42c5-9833-66c77f92d580 |
| UAT-05.63 | Live API | Create quotation | FAIL | Validation failed |

## Findings

- Frontend discount approval threshold: **10%** (`types/crm.ts`)
- Backend discount approval threshold aligned at **10%** (`quotation.constants.ts` + frontend `types/crm.ts`)
- SO conversion available via `POST /crm/quotations/:id/convert-to-sales-order` (API mode)
- Live API tests run only when backend is reachable on `:5000`

## Manual sign-off checklist

- [ ] Open CRM → Opportunities → create quotation from open opportunity
- [ ] Quotation editor: add/edit line items, verify tax/discount/grand total
- [ ] Save as draft — document editable, no convert button
- [ ] Submit for approval — pending when above ₹50L or discount >10%
- [ ] Approve as sales manager; shop-floor role cannot approve
- [ ] Reject quotation, create revision — rev number increments, old rev locked
- [ ] Revisions page shows **Latest** badge on current revision
- [ ] Approve latest revision — convert button appears on 360 page
- [ ] Create Sales Order — opportunity won, quotation converted
- [ ] Second convert attempt blocked with clear message
- [ ] (API mode) Quotation CRUD syncs via `quotationApiBridge`

## Demo credentials

- Tenant: `vasant-trailers`
- Email: `admin@vasant-trailers.com`
- Password: `Admin@123`
