# Phase 17 — GST Data Quality, companyGstin Backfill & Books Freeze Checklist

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · LIVE portal · silent re-tax · legal period lock equivalent to statutory freeze

---

## Why this phase

Plan core ends at Phase 12; residuals **13–16** already cover UAT gate, annual worksheets, multi-period ops, rate master hygiene.

**Phase 17** closes the practical multi-GSTIN residual from Phase 9:

| Gap | Phase 17 answer |
|-----|-----------------|
| Historical SI/ledger `companyGstin` **null** | Scan + dry-run + confirm apply (null-only) |
| Mixed GSTIN slices | Contamination findings (reuse Phase 9 util) |
| Before period freeze / lock ceremony | Books freeze **checklist** (advisory) |
| Ops evidence | `gst_data_quality_runs` |

Does **not** reimplement portal filing, UAT axes, annual worksheets, notices cockpit, or rate master ops.

---

## Scope (shipped)

| Area | Behaviour |
|------|-----------|
| Scan | Null `companyGstin`, FILED-with-null, multi-GSTIN mix, missing supplyClass (info) |
| Backfill plan | Branch → LE → snapshot; require full 15-char GSTIN; never overwrite non-null |
| Apply | `confirm=true`; updates only `companyGstin IS NULL`; **does not change tax amounts** |
| Freeze checklist | GSTIN complete, single GSTIN, resolvable nulls, GSTR prep observed, open RCM WARN; honest label always FAIL for FULL GST COMPLIANT |
| Evidence | Persist freeze JSON report |
| FE | `/accounting/tax-compliance/gst/data-quality` dual-mode |

---

## Migration

`20260806020000_gst_phase17_data_quality` → table `gst_data_quality_runs` only.

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.quality.view` | Scan / freeze readiness / list runs |
| `tax.gst.quality.manage` | Dry-run, apply backfill, evidence runs |

Also: `tax.gst.view`, `finance.tax.view`, `tax.gst.reconcile` (read/dry-run paths), `tax.gst.setup.manage`.

Finance Manager pack includes both quality keys.

Feature flag: `GST_PHASE17_DATA_QUALITY_ENABLED` (default **true**).

---

## API (`…/tax-compliance/data-quality`)

| Method | Path |
|--------|------|
| GET | `/capability` |
| GET | `/scan?legalEntityId&returnPeriod` |
| GET | `/freeze-readiness?…` |
| POST | `/backfill/dry-run` |
| POST | `/backfill/apply` (`confirm: true`) |
| GET | `/runs` |
| POST | `/runs` |
| POST | `/runs/:id/acknowledge` |

---

## Tests

`backend/tests/gst-data-quality-phase17.test.ts` — pure util cases (null GSTIN, contamination, backfill plan, freeze honesty).

---

## Conditions

1. `migrate deploy` incl. Phase 17  
2. `db:sync-permissions` for `tax.gst.quality.*`  
3. Maintain LE / branch GSTIN masters or unresolvable rows remain  
4. Backfill is **remediation**, not tax re-determination  
5. Freeze checklist ready ≠ portal filed ≠ FULL GST COMPLIANT  

---

## Key paths

- `backend/src/modules/accounting/tax-compliance/gst-data-quality.util.ts`
- `backend/src/modules/accounting/tax-compliance/gst-data-quality.service.ts`
- `frontend/src/modules/accounting/tax-compliance/GstDataQualityPage.tsx`
- Migration: `backend/prisma/migrations/20260806020000_gst_phase17_data_quality/migration.sql`
