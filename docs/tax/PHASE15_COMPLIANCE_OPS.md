# Phase 15 — GST Compliance Ops Cockpit

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · LIVE GST portal notices · GSTR-9/9C official file · Phase 12 LIVE submit

---

## Scope

Plan Phase 15 was not numbered in the original 0–12 track. This phase delivers the **post-portal operational gap** called out by Phase 13’s readiness matrix (notices / multi-period audit packs) and by Phase 14 docs (cockpit health owned later):

| Area | Behaviour |
|------|-----------|
| Multi-period health | Rolls up Phase 13 `getPeriodHealth` across a period range (max 24 months) |
| Compliance cockpit | Focus period + lookback health, open notices, recent packs |
| Notices log | CRUD against Phase 13 table `gst_compliance_notices` (manual tracker) |
| Audit export packs | Multi-period freeze into `gst_compliance_audit_packs` (per month row + digest) |
| GSTR-9 foundation API | Lightweight FY month coverage roll-up — **not** Phase 14 worksheet engine |

Reuses GSTR prep / ledger / payment / 2B / Phase 13 scoring — **no second tax engine**.

---

## Migration

`20260805300000_gst_phase15_compliance_ops` — **no new tables** (reuses Phase 13 DDL).

Requires prior: `20260805250000_gst_phase13_compliance_hardening` (notices + audit pack tables).

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.ops.view` | Cockpit / health / packs / notices read |
| `tax.gst.ops.manage` | Create/update notices; archive packs |
| `tax.gst.ops.export` | Generate audit packs |

Also accepted: `tax.gst.view`, `finance.tax.view`, `tax.gst.setup.manage`.

---

## API (`…/tax-compliance/ops`)

| Method | Path |
|--------|------|
| GET | `/capability-matrix` |
| GET | `/cockpit?legalEntityId&returnPeriod` |
| GET | `/period-health?legalEntityId&periodFrom&periodTo` |
| GET | `/gstr9-annual?legalEntityId&financialYearLabel` |
| GET/POST | `/audit-packs` (+ `GET :id`, `POST :id/void` → archive) |
| GET/POST | `/notices` (+ `PATCH :id`) |

---

## Frontend

`/accounting/tax-compliance/gst/compliance-cockpit` — dual-mode (demo fixture + API).

---

## Tests

`backend/tests/gst-compliance-ops-phase15.test.ts` — pure util tests (health, FY months, audit manifest, notice due, capability honesty).

---

## Collision notes (Phases 12–14 / 16)

| Phase | Role vs Phase 15 |
|-------|------------------|
| 12 | Portal filing sessions — observed only; not reimplemented |
| 13 | Period health engine + DDL for notices/audit packs — **tables reused**, period health **rollup** |
| 14 | GSTR-9 **worksheet** + FY archive — Phase 15 only ships foundation/coverage roll-up |
| 16 | Rate master ops — orthogonal |

---

## READY WITH CONDITIONS

1. `migrate deploy` including Phase 13 + Phase 15 placeholder (and 12/14 as needed)  
2. `db:sync-permissions` for `tax.gst.ops.*`  
3. LE GSTIN must be set (hard readiness from Phase 13 health)  
4. Notices are **manual** — not GSTN notice download  
5. Audit packs are digests / JSON freezes — not portal packages  
6. Disable with `GST_PHASE15_COMPLIANCE_OPS_ENABLED=false` if required  

---

## Still NOT ready

- FULL GST COMPLIANT  
- LIVE portal filing / notice portal sync  
- GSTR-9 / 9C statutory e-file  
- Automatic notice ingestion  

**Verdict:** **GST COMPLIANCE OPS COCKPIT — READY WITH CONDITIONS**
