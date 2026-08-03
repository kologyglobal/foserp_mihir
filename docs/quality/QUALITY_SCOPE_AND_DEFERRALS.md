# Quality — Scope, Verdict & Explicit Deferrals

**Last verified:** 2026-07-30  
**Honest verdict:** **READY WITH CONDITIONS** for the *shipped Quality scope* (manufacturing QC engine + Purchase incoming QI). Not a full enterprise QMS.

Code wins over older Phase 7B “incoming blocked” docs — Purchase GRN + Purchase QI are live; `/quality/incoming` queues GRN `QC_PENDING` + open Purchase QI.

---

## What is in scope (shipped)

### A. Manufacturing Quality engine (`/api/v1/t/:tenantSlug/quality`)

| Area | Evidence |
|------|----------|
| Parameters CRUD | `quality/parameters` + Phase 4B tests / FE `ApiQcMasterPages` |
| Inspection plans + lines + revisions | `quality/inspection-plans` + Phase 4B/7B |
| In-process / final / job-work inspections | `quality/inspections` + decide lifecycle + parameter results table |
| Mandatory parameter results on PASS | Phase 4B decide gating |
| NCR open/close/disposition | `quality/ncrs` |
| Certificates + certificate gate | `quality/certificates` |
| WO / stage blockers + release coordination | blockers + QualityReleaseService |
| Workspace KPIs + incoming queue | `workspace.service` (incoming = Purchase GRN/QI) |
| Permissions | `quality.*` (+ manufacturing.quality.* for shopfloor) |
| Tenant isolation | live suites when MySQL up (`quality-phase4a/4b/7b`) |
| FE API mode | `qualityRoutes.tsx` dual-mode Api* pages |

### B. Purchase incoming QI (`/api/v1/t/:tenantSlug/purchase/quality-inspections`)

| Area | Evidence |
|------|----------|
| Create from GRN, complete ACCEPT/REJECT, hold, cancel | `purchase-qi-lifecycle.test.ts` |
| Fail-closed inventory release on complete | same suite + QI service transaction |
| Parameter checklist + inspection plan persistence | migration `20260730110000_purchase_qi_parameter_checklist`; create seeds defaults; PATCH persists results |
| Permissions | `purchase.qi.*` |
| FE | `QualityInspectionDetailPage` via `purchaseApiFacade` |

Ownership: **Purchase owns** supplier return / GRN stock disposition. **Quality owns** manufacturing plans/inspections/NCR/certificates and the shared incoming *queue view*.

---

## Explicit deferrals (not defects)

Do **not** expand Quality completion into these unless product prioritizes a greenfield QMS:

| Deferred | Reason |
|----------|--------|
| CAPA / audit management / document control | No scaffolding |
| Calibration / instrument scheduling | Deferred in Phase 4B/7B |
| SPC / AQL / LIMS | Deferred in Phase 7B |
| Supplier scorecards / automatic vendor rating | Deferred |
| Quality cost accounting / GL | Deferred |
| Customer RMA / complaints | Deferred |
| Unifying Purchase QI checklist with manufacturing `QualityParameter` masters | Purchase QI uses free-form checklist rows by design |
| Dedicated HOLD status enum on Purchase QI | Hold maps to `DEVIATION_PENDING` (works; rename optional) |

---

## Conditions before calling Production-ready without caveat

1. ✅ **Closed 2026-07-30** — migration `20260730110000_purchase_qi_parameter_checklist` deployed (`migrate deploy` → "No pending migrations to apply"). Its over-length index was renamed to `qi_params_tenant_qi_idx` to clear MySQL's 64-char identifier limit.
2. ✅ **Closed 2026-07-30** — `npx vitest run tests/purchase-qi-lifecycle.test.ts tests/quality-phase4a.test.ts tests/quality-phase4b.test.ts tests/quality-phase7b.test.ts` against live MySQL `fos_erp`: **4 files / 23 tests PASS, 0 failed, 0 skipped**.
3. ⬜ Optional human SPA walk: Purchase QI parameter save/reload; `/quality/incoming` → open QI; manufacturing decide with mandatory params.

> Phase 4A/4B require strict execution — their fixtures seed `manufacturingSettings` with `flexibleExecution: false`, because the server default (`true`) intentionally softens the QC gate.

---

## Related docs

- [QUALITY_PHASE4A_README.md](./QUALITY_PHASE4A_README.md)
- [QUALITY_PHASE4B_README.md](./QUALITY_PHASE4B_README.md)
- [QUALITY_PHASE7B_README.md](./QUALITY_PHASE7B_README.md)
- [INCOMING_QUALITY_WORKFLOW.md](./INCOMING_QUALITY_WORKFLOW.md)
