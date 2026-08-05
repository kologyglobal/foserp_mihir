# Phase 4 — Reverse Charge (RCM)

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT / portal payment (PMT-06) / returns preparation  

---

## Scope (from plan)

Productize reverse charge from **purchase (AP Vendor Invoice)** through **liability booking → payment confirmation → ITC recognition + register**. Incomplete setup → `RCM_ACCOUNTING_PENDING` / block post. Extends existing AP path only — **not** a second purchase tax engine.

---

## Delivered

### AP calculation / post guard
- Missing `RCM_*_PAYABLE` accounts emit **`VENDOR_INVOICE_RCM_ACCOUNTING_PENDING`** (message includes `RCM_ACCOUNTING_PENDING`) and **block** invoice validation/post readiness.
- RCM payable components also require maps when **line-level** reverse-charge tax is present (rcm tax totals &gt; 0), not only header `taxTreatment = REVERSE_CHARGE`.
- Info note: self-assessed tax excluded from vendor payable; payment/ITC gate message on RCM docs.

### Concurrent AP GL (unchanged identity)
On RCM VI post (when accounts ready):

- Dr expense / recoverable INPUT GST  
- Cr vendor (excl. tax) + **RCM_*_PAYABLE**

GL remains accounting truth via shared `post()`. Register tracks **compliance** lifecycle separately.

### RCM register
- Model `GstRcmRegisterEntry` / table `gst_rcm_register_entries`
- Statuses: `LIABILITY_POSTED` → `LIABILITY_PAID` → `ITC_RECOGNIZED` | `ITC_NOT_CLAIMABLE` | `VOID`
- Written on successful **posted** VI with `taxTreatment = REVERSE_CHARGE` (same tx as GST ledger)
- Pure util: `rcm-lifecycle.util.ts` (transitions + ITC gate)

### API (`/api/v1/t/:tenantSlug/accounting/tax-compliance`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/rcm-register` | `tax.gst.view` or `finance.tax.view` |
| POST | `/rcm-register/:id/mark-liability-paid` | `tax.gst.setup.manage` or `tax.gst.reconcile` |
| POST | `/rcm-register/:id/recognize-itc` | same |
| POST | `/rcm-register/:id/mark-not-claimable` | same |

### Frontend dual-mode
- Reverse Charge page uses **RCM register API** in API mode; demo seed + local lifecycle actions when `VITE_USE_API=false`.
- Actions: Mark liability paid → Recognize ITC.

### Migration
`backend/prisma/migrations/20260805160000_gst_phase4_rcm_register`

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx prisma generate   # can be slow
```

### Tests
```bash
npx vitest run tests/gst-rcm-lifecycle.test.ts
npx vitest run tests/finance/finance-ap-vendor-invoice-calculation.test.ts
```

---

## Conditions

1. **Liability “paid” is compliance confirmation** — not PMT-06 / cash-ledger bank posting (Phase 8).  
2. **INPUT GST still booked on concurrent VI post** when eligible; register ITC recognition does **not** re-post input GST.  
3. **Tenant must map** `GST_RCM_CGST_PAYABLE` / `SGST` / `IGST` (or invoice overrides) or posts stay blocked.  
4. **Register backfill** of previously posted RCM VIs not shipped.  
5. **Purchase module PI** reverse charge remains handoff to AP VI — AP is compliance anchor.  
6. **RCM on vendor adjustments** / multi-GSTIN not fully productized here.

---

## Deliberately excluded

- Live GST portal payment / challan generation  
- Auto-claim of ITC from GSTR-2B for RCM  
- Full returns prep period lock (Phase 5)  
- SEZ/export-only RCM edge cases  
- ANY claim of FULL GST COMPLIANT

---

## Phase 3 dependency

Phase 3 GSTR-2B schema/match/API may already exist in-repo; **Phase 4 did not require re-doing Phase 3**. RCM ITC claim class in 2B match util remains advisory (`RCM_ELIGIBLE` + liability confirmation note).

---

## Verdict

**REVERSE CHARGE (RCM) — READY WITH CONDITIONS**

Stop for product review before Phase 5 returns preparation emphasis (or after concurrent Phase 5 work if already in flight — this phase owns **RCM lifecycle only**).
