# Phase 3 — ITC & GSTR-2B Reconciliation

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · portal 2B download · automatic ITC claim · GSTR-3B ITC auto-fill  

---

## Scope (what this phase is)

Internal workbench to:

1. **Import** offline GSTR-2B JSON lines into an **immutable** batch  
2. **Match** those lines to **POSTED** Accounting `VendorInvoice` records only  
3. **Suggest** an ITC claim class for review (never auto-claim)  
4. Open **vendor follow-ups** for exceptions / missing-in-books / books-not-in-2B  

Does **not** replace AP `InputTaxCreditEligibility` review on vendor invoices.

---

## Principles (honoured)

| Rule | Implementation |
|------|----------------|
| No auto-claim ITC | `suggestItcClaimClass` always returns `autoClaimBlocked: true`, including MATCHED+ELIGIBLE |
| Immutable import | Row amounts fixed at import; correct via void + re-import |
| Match posted only | Reconcile queries `VendorInvoice.status = POSTED` |
| One AP engine | Does not re-resolve tax or rewrite VI tax snapshots |
| Honest labels | Offline file import; SIMULATED provider mode; not portal-ready |

---

## Data model

Migration: `backend/prisma/migrations/20260805140000_gst_phase3_gstr2b_itc`

| Table | Role |
|-------|------|
| `gstr2b_import_batches` | LE + return period (`yyyy-MM`), status IMPORTED → RECONCILING → RECONCILED / VOID, counters |
| `gstr2b_import_rows` | Frozen 2B line values + match metadata + `itcClaimClass` suggestion |
| `gstr2b_vendor_follow_ups` | Exception worklist (OPEN / IN_PROGRESS / RESOLVED / WAIVED) |

Enums: `GstItcClaimClass`, `Gstr2bBatchStatus`, `Gstr2bMatchStatus`, `Gstr2bFollowUpStatus`.

---

## Backend services

| File | Responsibility |
|------|----------------|
| `gstr2b-match.util.ts` | Pure normalize / score / pickBest / suggestItcClaimClass |
| `gstr2b-import.service.ts` | Import batch, list batches/rows, void |
| `gstr2b-reconcile.service.ts` | Match to posted VIs, summary, follow-ups |

Match scoring prioritizes GSTIN + invoice number + date proximity + taxable/tax amount tolerances. Best candidate is claimed exclusively within a batch (one books invoice → one 2B row).

---

## API

Base: `/api/v1/t/:tenantSlug/accounting/tax-compliance`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/gstr2b/batches` | `tax.gst.reconcile` |
| GET | `/gstr2b/batches?legalEntityId=&returnPeriod=` | `tax.gst.view` \| `tax.gst.reconcile` \| `finance.tax.view` |
| GET | `/gstr2b/batches/:batchId` | view (any of above) |
| GET | `/gstr2b/batches/:batchId/rows` | view |
| GET | `/gstr2b/batches/:batchId/summary` | view |
| POST | `/gstr2b/batches/:batchId/reconcile` | `tax.gst.reconcile` |
| POST | `/gstr2b/batches/:batchId/void` | `tax.gst.reconcile` |
| GET | `/gstr2b/follow-ups?legalEntityId=` | view |
| PATCH | `/gstr2b/follow-ups/:followUpId` | `tax.gst.reconcile` |

Import body (abbrev.):

```json
{
  "legalEntityId": "uuid",
  "returnPeriod": "2026-06",
  "fileName": "gstr2b.json",
  "rows": [
    {
      "supplierGstin": "27AAAAA0000A1Z5",
      "supplierName": "Vendor",
      "invoiceNumber": "INV-1",
      "invoiceDate": "2026-06-15",
      "taxableValue": 10000,
      "cgstAmount": 900,
      "sgstAmount": 900,
      "igstAmount": 0,
      "cessAmount": 0
    }
  ]
}
```

Tenant isolation: all queries filter `tenantId`; LE validated via `getLegalEntityOrThrow`.

---

## Permissions

- Register / sync: `tax.gst.reconcile` (new), existing `tax.gst.view`  
- Finance Manager role pack gains `tax.gst.view` + `tax.gst.reconcile` + `tax.gst.setup.manage`  
- Ops: `npm run db:sync-permissions` (or project equivalent) after deploy  

---

## Frontend (dual-mode)

| Mode | Behaviour |
|------|-----------|
| Demo `VITE_USE_API=false` | Existing seed GSTR-2B + ITC workbench + Accept/Reject session notes |
| API `VITE_USE_API=true` | List/import batch, reconcile, show rows/summary from API; Accept/Reject disabled (no auto claim writeback) |

Pages: `Gstr2bImportPage.tsx`, `ItcReconciliationPage.tsx` via `taxComplianceService.ts` / `taxComplianceApi.ts`.

---

## Migration deploy

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx prisma generate
```

---

## Tests

```bash
cd backend
npx vitest run tests/gstr2b-match.util.test.ts
```

Asserts full match scoring, GSTIN mismatch, no-auto-claim on MATCHED+ELIGIBLE, RCM/INELIGIBLE paths.

---

## Conditions (READY WITH CONDITIONS)

1. **No GST portal integration** — offline JSON body import only (SIMULATED).  
2. **No auto ITC claim / no 3B auto-fill** — suggestions + follow-ups only; AP `itcEligibility` remains the review field.  
3. **Sample import from FE** uses demo seed rows when only a file name is provided — production should POST real 2B extracts.  
4. **Match quality** is heuristic (score thresholds), not statutory portal matching.  
5. **Reviewer Accept/Reject** is demo-only; API mode does not write claim status back to books.  
6. **Missing-in-2B** is counted vs posted VIs in a period window — not a full GSTR-2A register.  
7. Run migrate + permission sync before production use.

---

## Intentionally excluded

- Live GSP / GSTN download of GSTR-2B  
- HSN-level / multi-document 2B section mapping (B2B/CDN/etc. full schemas)  
- ITC ledger posting / availment journals from this workbench  
- GSTR-3B auto-populate  
- ISD / import of services / special credit rules  
- Historical bulk portal archive loaders  
- Claiming capital goods instalments / rule 36(4) mechanics  

Next phases continue reverse charge productization (Phase 4) and returns preparation (Phase 5) per `TAX_IMPLEMENTATION_PLAN.md`.
