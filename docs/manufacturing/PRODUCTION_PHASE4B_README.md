# Manufacturing Phase 4B — Job Work / Subcontracting Foundation

**Status:** Shipped (2026-07-20)  
**Depends on:** Inventory Phase 3A, Quality Phase 4A (optional QC on receive), Manufacturing Phase 2A

## Scope

Tenant-scoped Job Work documents with explicit lifecycle:

`DRAFT → MATERIAL_SENT → PARTIALLY_RECEIVED / RECEIVED → RECONCILIATION_PENDING → CLOSED` (or `CANCELLED`)

| Capability | Endpoint | Permission |
|------------|----------|------------|
| List / get | `GET /job-work`, `GET /job-work/:id` | `manufacturing.job_work.view` |
| Create / edit draft | `POST /job-work`, `PATCH /job-work/:id` | `create` / `edit` |
| Dispatch material | `POST /job-work/:id/dispatch` | `dispatch` |
| Receive output | `POST /job-work/:id/receive` | `receive` |
| Return material | `POST /job-work/:id/return-material` | `return_material` |
| Reconcile | `POST /job-work/:id/reconcile` | `reconcile` |
| Approve difference | `POST /job-work/:id/approve-difference` | `approve_difference` |
| Link invoice (soft) | `POST /job-work/:id/link-invoice` | `link_invoice` |
| Close / cancel | `POST /job-work/:id/close`, `.../cancel` | `close` / `cancel` |

Base path: `/api/v1/t/:tenantSlug/manufacturing/job-work`

## Behaviour

- **Number series:** `JOB_WORK_ORDER` → `JW-######`
- **Dispatch:** updates material line sent qty; status → `MATERIAL_SENT`; stockable material posts Inventory `ISSUE` / `SUBCON_OUT` (rejects insufficient free stock)
- **Receive:** updates received/accepted qty; status → `PARTIALLY_RECEIVED` or `RECEIVED`; stockable output posts `INWARD` / `SUBCON_IN`; when `qualityRequired`, creates QualityInspection `SUBCONTRACT_RETURN` linked via `jobWorkOrderId`
- **Reconcile / close:** material balance lines; close requires `RECEIVED` or approved reconciliation difference
- **Cancel:** draft or pre-receipt only

## Database

- Migration: `20260720210000_manufacturing_phase4b_job_work`
- Models: `JobWorkOrder`, `JobWorkMaterialLine`, `JobWorkDispatch` (+ lines), `JobWorkReceipt`
- `QualityInspection.jobWorkOrderId` optional FK

## Frontend

- Dual-mode via `jobWorkService` (`isApiMode()` → manufacturing API; else demo seed)
- Form loads vendors / items / warehouses from masters in API mode
- Existing register + detail pages reuse demo UI shapes via `jobWorkApiMapper`

## Tests

```bash
cd backend && npx vitest run tests/manufacturing-phase4b.test.ts
cd frontend && npm run test:manufacturing-phase4b
```

## Out of scope (deferred)

- Purchase PO / challan as SoT
- Vendor invoice / AP posting / GL job costing
- Inventory reverse on cancel after dispatch
- Full Quality SPA disposition for subcontract returns
