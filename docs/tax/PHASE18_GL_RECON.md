# Phase 18 — GST Subledger vs GL Control Reconciliation

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · LIVE portal · auto journal posts · silent re-tax

---

## Why this phase

Phases 12–17 cover portal (SIM), UAT, annual, ops cockpit, rate hygiene, and GSTIN data quality.  
**Phase 18** closes the finance close gap: **does GST ledger agree with CoA GST control accounts for the return period?**

---

## Scope

| Area | Behaviour |
|------|-----------|
| Buckets | Output CGST/SGST/IGST/CESS, Input *, RCM * payable → `DefaultAccountMapping` keys |
| Comparison | GST ledger `taxAmount` sum by `taxType` vs GL period net (credit−debit liability / debit−credit asset) |
| Tolerance | Default ₹1 (configurable) |
| Status | MATCH · VARIANCE · UNMAPPED · NO_ACTIVITY |
| Evidence | `gst_gl_recon_runs` |
| FE | `/accounting/tax-compliance/gst/gl-recon` dual-mode |

Does **not** post adjusting journals or re-tax SI/VI.

---

## Migration

`20260806030000_gst_phase18_gl_recon` → `gst_gl_recon_runs`

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.gl_recon.view` | Capability + report + list runs |
| `tax.gst.gl_recon.manage` | Persist / acknowledge evidence |

Also: `tax.gst.view`, `finance.tax.view`, `tax.gst.reconcile`, `tax.gst.setup.manage`.

Finance Manager pack includes both.

Flag: `GST_PHASE18_GL_RECON_ENABLED` (default **true**).

---

## API (`…/tax-compliance/gl-recon`)

| Method | Path |
|--------|------|
| GET | `/capability` |
| GET | `/report?legalEntityId&returnPeriod&tolerance&companyGstin` |
| GET | `/runs` |
| POST | `/runs` |
| POST | `/runs/:id/acknowledge` |

---

## Tests

`backend/tests/gst-gl-recon-phase18.test.ts`

---

## Conditions

1. Migrate + `db:sync-permissions`  
2. Maintain default account mappings for GST_* keys  
3. Period date range from `returnPeriod` vs postingDate (opening bal not in period slice)  
4. Credit notes / multi-vouchers may cause legitimate variances — investigate books, no auto-fix  
5. Never FULL GST COMPLIANT from recon score alone  

---

## Key paths

- `gst-gl-recon.util.ts` / `gst-gl-recon.service.ts`
- `GstGlReconPage.tsx`
- Migration `20260806030000_gst_phase18_gl_recon`
