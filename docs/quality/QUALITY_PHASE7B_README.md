# Quality Phase 7B — Complete Quality Integration

**Status:** Shipped with conditions (2026-07-21)  
**Builds on:** [QUALITY_PHASE4A_README.md](./QUALITY_PHASE4A_README.md), [QUALITY_PHASE4B_README.md](./QUALITY_PHASE4B_README.md)

## Incoming GRN Quality readiness

**Verdict: READY** — Purchase GRN + Purchase QI are the SoT for incoming material QC.

| Check | Result |
|-------|--------|
| Prisma Goods Receipt | Present (`goods_receipts`) |
| Purchase QI | `purchase_quality_inspections` + lines + parameter checklist |
| Fake GRN inside Quality | **Not created** (correct) |

Incoming Quality API returns `{ ready: true, code: 'PURCHASE_INCOMING_QC_AVAILABLE', items, counts }`.

See [INCOMING_QUALITY_WORKFLOW.md](./INCOMING_QUALITY_WORKFLOW.md) and [QUALITY_SCOPE_AND_DEFERRALS.md](./QUALITY_SCOPE_AND_DEFERRALS.md).

Continue with: Production in-process/final, Job Work return QC, plans/revisions, NCR disposition, certificates, workspace KPIs.

## Ownership

| Domain | Owns |
|--------|------|
| Quality | Plans, revisions, inspections, decisions, NCR, certificates, blockers, release *coordination* |
| Inventory | Physical stock, warehouse balances, movements (ISSUE+INWARD for release) |
| Production | Stage ledger, WIP, WO status, FG eligibility gates via blockers |
| Purchase | PO/GRN/supplier return (deferred) |
| Job Work | Dispatch/receipt/reconciliation |
| Accounting | Deferred (no Quality cost / GL) |

## Shipped in 7B

- Inspection plan revisions (immutable `linesSnapshotJson`)
- Sampling methods (FULL / FIXED / PERCENTAGE / MANUAL) via `computeSampleQty`
- Extended decisions: CONDITIONAL_PASS, HOLD, USE_AS_IS (+ approval)
- Partial disposition quantity fields on inspections
- QualityReleaseService (warehouse transfer via Inventory `postStockMovement`)
- NCR disposition / action / verify fields + APIs
- Certificates + certificate gate for PASS when required
- Workspace summary API (real counts; incoming always 0 + note)
- Incoming endpoints that declare NOT READY
- Job Work close quality gate (open SUBCONTRACT_RETURN / NCR)
- Work Order / Job Work quality summary endpoints
- API-mode Incoming FE blocked banner
- Tests: `quality-phase7b.test.ts`
- Documentation set under `docs/quality/`

## Migration

`backend/prisma/migrations/20260721020000_quality_phase7b/`

## Key APIs (`/api/v1/t/:tenantSlug/quality`)

| Area | Paths |
|------|-------|
| Workspace | `GET /workspace/summary`, `GET /workspace/incoming`, `GET /incoming/queue` |
| Plans | `POST /inspection-plans/:id/revise`, `POST .../activate`, `GET .../revisions` |
| Certificates | `GET/POST /certificates`, `POST /certificates/:id/verify` |
| Summaries | `GET /work-orders/:id/summary`, `GET /job-work/:id/summary` |
| NCR | disposition / submit-action / verify (plus existing close) |

## Deferred

- CAPA / audits / calibration / SPC / supplier scorecards (see QUALITY_SCOPE_AND_DEFERRALS)
- Supplier debit note / AP claim polish (Purchase/Accounting)
- Customer RMA / complaints
- Quality cost accounting / automatic GL
- Automatic vendor rating deductions
- Policy B Quality-Hold FG release end-to-end UI polish
- Merging Purchase QI free-form checklist into manufacturing `QualityParameter` masters

## Related docs

- [QUALITY_SCOPE_AND_DEFERRALS.md](./QUALITY_SCOPE_AND_DEFERRALS.md)
- [QUALITY_INSPECTION_PLAN_RULES.md](./QUALITY_INSPECTION_PLAN_RULES.md)
- [INCOMING_QUALITY_WORKFLOW.md](./INCOMING_QUALITY_WORKFLOW.md)
- [PRODUCTION_QUALITY_GATES.md](./PRODUCTION_QUALITY_GATES.md)
- [FINAL_QUALITY_AND_FG_RELEASE.md](./FINAL_QUALITY_AND_FG_RELEASE.md)
- [JOB_WORK_RETURN_QUALITY.md](./JOB_WORK_RETURN_QUALITY.md)
- [NCR_DISPOSITION_WORKFLOW.md](./NCR_DISPOSITION_WORKFLOW.md)
- [QUALITY_DECISION_CORRECTION_POLICY.md](../manufacturing/QUALITY_DECISION_CORRECTION_POLICY.md)
- [QUALITY_CERTIFICATE_RULES.md](./QUALITY_CERTIFICATE_RULES.md)
