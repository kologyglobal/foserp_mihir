# Phase 13 — GST Go-Live / UAT Gate & Books Hardening

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Exit label candidacy:** **GST GO-LIVE UAT GATE READY** (books + register only)  
**Does not claim:** FULL GST COMPLIANT · LIVE GSTN GSTR submit certify · GSP certification

---

## Plan context

`TAX_IMPLEMENTATION_PLAN.md` ends at **Phase 12 (portal filing)**. Phase 13 is the **documented next hardening slice**: statutory go-live / UAT axes from Plan § Phase 12 exit candidacy, plus period books reconciliation and pre-file readiness **on top of** Phase 5 prep + optional Phase 12 filing sessions.

---

## Scope shipped

| Area | Behaviour |
|------|-----------|
| Period books reconcile | Ledger vs GSTR-1/3B status/snapshots vs payment vs 2B open work vs null companyGstin vs optional Phase 12 session status |
| Pre-file gate | Advises whether Phase 12 package may be created (both returns locked + no blockers) |
| Go-live UAT gate | Axes from plan: Live IRN, Live e-Way, GSTR-1/3B recon, GSTR-2B recon, payment, multi-GSTIN, statutory UAT — **`canClaimFullGstCompliant` always false** |
| UAT sign-off register | Maker submit → checker approve (different user) → revoke; freezes gate snapshot |
| Audit pack / notices foundation | Thin adapters onto Phase 15 tables (`gst_audit_export_packs`, `gst_compliance_notices`) for ops facade rollup |
| GSTR-9 foundation rollup | Lightweight FY month lock coverage only — **Phase 14 owns worksheets** |
| FE | `/accounting/tax-compliance/gst/go-live` dual-mode cockpit |

---

## Migration

`backend/prisma/migrations/20260805250000_gst_phase13_compliance_hardening`

Table: `gst_compliance_uat_signoffs`

**Ordered after** Phase 12 `20260805240000_gst_phase12_portal_filing`. Does **not** recreate Phase 14 annual / Phase 15 notices+audit tables.

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.compliance.view` | Read period health / go-live gate / matrix |
| `tax.gst.compliance.uat` | Create / submit / approve / revoke UAT sign-offs |

Also accepted for reads: `tax.gst.view`, `finance.tax.view`. Finance Manager role pack includes both.

---

## API (`…/tax-compliance/hardening`)

| Method | Path |
|--------|------|
| GET | `/capability-matrix` |
| GET | `/period-health?legalEntityId&returnPeriod&companyGstin?` |
| GET | `/reconcile` (same payload as period-health) |
| GET | `/go-live-gate?legalEntityId&companyGstin?` |
| GET/POST | `/uat-signoffs` |
| PATCH | `/uat-signoffs/:id` |
| POST | `/uat-signoffs/:id/submit` \| `/approve` \| `/revoke` |

---

## Tests

```bash
cd backend
npx vitest run tests/gst-hardening-phase13.test.ts
```

---

## Phase 12 / 14 / 15 collision notes

| Track | Relationship |
|-------|----------------|
| **Phase 12** | Schema + filing routes in flight / present. Phase 13 **observes** session status in period health; does **not** reimplement submit/LIVE. |
| **Phase 14** | Annual GSTR-9 worksheets + FY archive — **not** owned here; GSTR-9 util is lightweight rollup only. |
| **Phase 15** | Multi-period cockpit is a **facade** over Phase 13 period health + audit/notice adapters. Phase 13 does not own multi-period UI. |

---

## READY WITH CONDITIONS

1. `migrate deploy` including `20260805250000_gst_phase13_compliance_hardening` (+ Phase 12 if using filing sessions).  
2. `db:sync-permissions` for `tax.gst.compliance.view` / `tax.gst.compliance.uat`.  
3. Optional feature flag: `GST_PHASE13_HARDENING_ENABLED=false` disables APIs.  
4. LIVE portal still requires Phase 12 `GST_PORTAL_FILING_*` UAT env flags + certified transport — never auto-claimed.  
5. UAT checker ≠ maker enforced on approve.  
6. Not FULL GST COMPLIANT even with all axes APPROVED.

---

## Still NOT ready

- FULL GST COMPLIANT product claim  
- Certified LIVE GSP/GSTN submit  
- Automatic IRN/e-Way “tested” detection from production telemetry (ops mark axes via UAT register)  
- Full annual GSTR-9 engine (Phase 14)  
- Multi-period ops chrome owned by Phase 15  

---

## Verdict

**GST GO-LIVE / UAT HARDENING — READY WITH CONDITIONS**

Stop before marketing ANY full-compliance label.
