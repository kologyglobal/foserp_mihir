# Quality Phase 4A — Inspection + NCR foundation

**Status:** Shipped (2026-07-20)  
**Scope:** Manufacturing in-process/final inspections, NCR on reject, production hold/blocker enforcement.

## Deferred (not 4A)

- Job Work / subcontracting QC (partial via 4B receive path; plans still optional)
- ~~Inspection plans & parameter masters~~ → **Phase 4B** ([QUALITY_PHASE4B_README.md](./QUALITY_PHASE4B_README.md))
- Incoming GRN QC
- Full dual-mode Quality SPA (4B dual-mode for parameters/plans + inspection detail; incoming still demo)

## Database

Migration: `backend/prisma/migrations/20260720200000_quality_phase4a_inspections/migration.sql`

- `quality_inspections` — `QualityInspection`
- `quality_ncrs` — `QualityNcr`
- Code series: `QUALITY_INSPECTION` (QI-*), `QUALITY_NCR` (NCR-*)
- `production_orders.qualityStatus` expanded enum
- Production activities: `QC_*`, `NCR_*`

## API (`/api/v1/t/:tenantSlug/quality`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/inspections` | `quality.view` |
| POST | `/inspections` | `quality.create` |
| GET | `/inspections/:id` | `quality.view` |
| POST | `/inspections/:id/decide` | `quality.submit` or `manufacturing.quality.inspect` |
| POST | `/inspections/:id/cancel` | `quality.cancel` |
| GET | `/ncrs` | `quality.view` |
| GET | `/ncrs/:id` | `quality.view` |
| POST | `/ncrs/:id/close` | `quality.approve` or `quality.close` |
| GET | `/production-orders/:productionOrderId/blockers` | `quality.view` |

Manufacturing convenience:

| GET | `/manufacturing/work-orders/:id/quality-blockers` | `manufacturing.work_orders.view` |

## Production integration

### Release

- Any routing stage with `qualityRequired` → `qualityStatus = PENDING_QC`
- Otherwise → `NOT_APPLICABLE`

### completeStage

When `stage.qualityRequired`:

1. Operations marked COMPLETED (shopfloor work done)
2. Stage → `QC_PENDING` (not COMPLETED)
3. Pending `IN_PROCESS` inspection created (idempotency `stage-qc:{stageId}`)
4. WO `qualityStatus` → `PENDING_QC` / `IN_QC`
5. Successors **not** promoted until inspection PASS

Returns `{ stage, inspection, awaitingQuality: true }`.

### decide PASS (IN_PROCESS)

- Stage → COMPLETED + successor promotion (shared `stage-completion.service`)
- Activity `QC_PASSED`

### decide REJECT

- Creates `QualityNcr` (OPEN)
- WO `qualityStatus` → `FAILED`; stage → `BLOCKED`
- Activities `QC_REJECTED`, `NCR_OPENED`

### decide REWORK

- WO `qualityStatus` → `HOLD`; stage stays `QC_PENDING`
- Activity `QC_REWORK` (no rework WO in 4A)

### completeWorkOrder

Blocked when `collectQualityBlockers` reports:

- Open PENDING/REWORK inspections
- Open NCRs
- Mandatory `qualityRequired` stages still `QC_PENDING`
- Product `qcRequired` or any stage `qualityRequired` without passed FINAL inspection

On success: omit `QUALITY_INTEGRATION_PENDING` warning when `qualityStatus` is `PASSED` or `NOT_APPLICABLE`.

## Frontend (API mode)

- `frontend/src/services/api/qualityApi.ts`
- `ApiQcQueuePage` at `/quality/queue` when `VITE_USE_API=true`
- WO detail shows quality status, blockers, open inspections link

## Tests

```bash
cd backend && npx vitest run tests/quality-phase4a.test.ts
cd frontend && npm run test:quality-phase4a
```

## Related

- ADR-028 — Quality ownership outside Production (**Accepted** for 4A)
- `docs/manufacturing/PRODUCTION_PHASE_PLAN.md`
