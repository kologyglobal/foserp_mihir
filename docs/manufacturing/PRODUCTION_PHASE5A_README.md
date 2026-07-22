# Manufacturing Phase 5A — Work Order Runtime Changes

**Status:** Shipped (2026-07-20)  
**Depends on:** Manufacturing Phases 1–2B, materials 3C, Quality 4A, Job Work 4B

## Scope

Controlled exceptions on an in-flight work order without rewriting immutable history (stage ledger, completed quantities, QC, job-work dispatches, inventory).

Base path: `/api/v1/t/:tenantSlug/manufacturing/work-orders/:workOrderId/runtime-changes`

| Capability | Endpoint | Permission |
|------------|----------|------------|
| List / get | `GET /`, `GET /:changeId` | `runtime_change.view` (+ type keys) |
| Preview impact | `POST /preview` | type-specific request |
| Create / update draft | `POST /`, `PATCH /:changeId` | `request` + type |
| Validate / submit | `POST /:changeId/validate`, `…/submit` | `request` |
| Approve / reject | `POST /:changeId/approve`, `…/reject` | `approve` / `reject` |
| Apply / cancel | `POST /:changeId/apply`, `…/cancel` | `apply` / `request` |

## Change types (15)

Quantity, due date, priority, supervisor, operator, machine, work centre, add/repeat/skip operation, convert remaining to job work, WO hold/resume, stage hold/resume.

## Lifecycle

`DRAFT → (PENDING_APPROVAL → APPROVED | REJECTED) → APPLIED` (or `FAILED` / cancel from draft)

Low-risk rules can auto-approve on submit; DRAFT may apply directly when approval is not required.

## Approval model

**Manufacturing-local** approve/reject on `ProductionRuntimeChange` + `ManufacturingRuntimeChangeRule`. Does **not** use Finance `ApprovalDocumentType` / `FinanceApprovalRequest`. See ADR-035 and `RUNTIME_CHANGE_APPROVAL_MATRIX.md`.

## Database

- Migration: `20260720220000_manufacturing_phase5a_runtime_changes`
- Models: `ProductionRuntimeChange`, `ManufacturingRuntimeChangeRule`
- Code series: `PRODUCTION_RUNTIME_CHANGE` → `RC-`

## Frontend (API mode)

- `RuntimeChangeDrawer` + **Change / Exception** on `ApiWorkOrderDetailPage`
- **Changes** tab listing runtime changes
- Demo WO detail unchanged (`!isApiMode()` hides Change menu)

## Tests

```bash
cd backend && npx vitest run tests/manufacturing-phase5a.test.ts
cd frontend && npm run test:manufacturing-phase5a
```

## Out of scope (Phase 5B+)

Material/WIP transfers, WO split, stock reversals, planning, costing, manufacturing accounting, OEE.
