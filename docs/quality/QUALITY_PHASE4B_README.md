# Quality Phase 4B — Parameters + Inspection Plans

**Status:** Shipped (2026-07-20)  
**Scope:** QC parameter masters, inspection plan masters (+ lines), plan snapshot on inspection create, mandatory parameter results on PASS for IN_PROCESS/FINAL. Incoming GRN QC remains deferred.

## Builds on

- [QUALITY_PHASE4A_README.md](./QUALITY_PHASE4A_README.md) — inspections, NCR, WO blockers

## Deferred (not 4B)

- Incoming GRN QC (`/quality/incoming`)
- Purchase GRN API
- Instruments / calibration
- Replacing opaque `defaultQualityPlanRef` / routing `qualityPlanRef` with FK columns

## Database

Migration: `backend/prisma/migrations/20260720280000_quality_phase4b_plans_parameters/`

| Table | Model |
|-------|--------|
| `quality_parameters` | `QualityParameter` |
| `quality_inspection_plans` | `QualityInspectionPlan` |
| `quality_inspection_plan_lines` | `QualityInspectionPlanLine` |
| `quality_inspection_parameter_results` | `QualityInspectionParameterResult` |

`quality_inspections` gains optional `inspectionPlanId` + `parameterSnapshotJson`.

## API (`/api/v1/t/:tenantSlug/quality`)

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/parameters` | `quality.view` / `quality.create` |
| GET/PATCH | `/parameters/:id` | `quality.view` / `quality.edit` |
| POST | `/parameters/:id/deactivate` | `quality.edit` |
| GET/POST | `/inspection-plans` | `quality.view` / `quality.create` |
| GET/PATCH | `/inspection-plans/:id` | `quality.view` / `quality.edit` |
| PUT | `/inspection-plans/:id/lines` | `quality.edit` |
| POST | `/inspection-plans/:id/deactivate` | `quality.edit` |

Inspections (extended):

- Create resolves plan: explicit `inspectionPlanId` → profile `defaultQualityPlanRef` / item-scoped ACTIVE plan → null
- Snapshot written to `parameterSnapshotJson`
- `POST …/decide` accepts `parameterResults[]`; **PASS** rejected if mandatory snapshot params missing/failing

## Frontend

| Mode | Parameters / Plans | Inspection detail |
|------|--------------------|-------------------|
| Demo (`VITE_USE_API=false`) | Zustand `QcMasterPages` | Demo `QcInspectionDetailPage` |
| API | `ApiQcMasterPages` | `ApiQcInspectionDetailPage` |

Incoming queue unchanged (demo only).

## Seed

Vasant tenant seeds `QP-VISUAL`, `QP-DIM-LEN`, `QP-NOTES` and ACTIVE plans `IP-INPROC-STD`, `IP-FINAL-STD`; sets empty profile `defaultQualityPlanRef` to `IP-INPROC-STD`.

## Tests

```bash
cd backend && npx vitest run tests/quality-phase4b.test.ts
cd backend && npx vitest run tests/quality-phase4a.test.ts
cd frontend && npm run test:quality-phase4b
```

## Related

- ADR-028 — Quality owns plans/inspections/NCR
- Opaque manufacturing plan refs remain string codes for resolve-by-code
