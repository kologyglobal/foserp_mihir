# Manufacturing Phase 2A — Production Demands + Work Orders

**Status:** Backend implemented and tested. Frontend (API-backed Work Orders register/create/detail, Today dashboard, Control Room) implemented in `frontend/src/modules/manufacturing/{work-orders,today}` — see [Frontend](#frontend) below.

## Scope

Phase 2A delivers the production execution "spine" on top of the Phase 1 setup foundation (work centres, machines, BOMs, routings, manufacturing profiles):

- **Production Demands** — the need to produce something, sourced from a confirmed Sales Order line or created manually. Tracks requested/converted/remaining/cancelled quantity.
- **Work Orders** (Prisma model `ProductionOrder`, UI label "Work Order", number prefix `WO-`) — the shop-floor execution record: DRAFT → released with immutable BOM/routing snapshots → started → progressed stage-by-stage → completed.
- **Stage/operation execution** — good/rework/rejected/scrap quantity recording per stage (and optionally per operation), with dependency-aware readiness promotion (parallel stages, assembly stages that wait on multiple predecessors).
- **Progress correction** — auditable reversal + re-entry of a mis-recorded progress ledger entry.
- **Dashboards** — Today overview and Control Room overview (status/health aggregates, work-centre load).

### Explicitly out of scope (absolute constraints — not implemented)

- **No inventory** — no stock reservation, material issue, or finished-goods receipt. `materialControlStatus` is always `NOT_CONNECTED` for the life of the order in this phase.
- **No Purchase Requisition** generation from shortages.
- **No Quality inspection transactions** — `qualityStatus` is always `PENDING_INTEGRATION`.
- **No manufacturing GL/costing** postings.
- Phase 1 manufacturing masters (work centres, machines, BOMs, routings, profiles) are **unchanged**.

Completing a work order returns a `warnings[]` array (`FINISHED_GOODS_RECEIPT_PENDING`, `QUALITY_INTEGRATION_PENDING`, `DISPATCH_PENDING`) to make these downstream gaps explicit to callers.

## Data model

New Prisma enums: `ProductionDemandSourceType`, `ProductionDemandStatus`, `ProductionOrderStatus`, `ProductionOrderHealth`, `ProductionOrderMaterialControlStatus`, `ProductionOrderQualityStatus`, `ProductionStageStatus`, `ProductionStageLedgerTxnType`, `ProductionHoldReasonCategory`, `ProductionActivityType`.

New Prisma models (all tenant-scoped, soft-deleted where applicable, UUID ids): `ProductionDemand`, `ProductionOrder`, `ProductionOrderBomSnapshot`, `ProductionOrderBomLine`, `ProductionOrderRoutingSnapshot`, `ProductionOrderStage`, `ProductionOrderOperation`, `ProductionOrderDependency`, `ProductionStageLedger`, `ProductionActivity`.

Migration: `backend/prisma/migrations/20260720150000_manufacturing_phase2a_work_orders/migration.sql`.

Code series: `PRODUCTION_DEMAND` → prefix `PD` (e.g. `PD-000001`), `PRODUCTION_ORDER` → prefix `WO` (e.g. `WO-000001`).

**Snapshotting.** On release, a work order's BOM lines and routing (stage groups → operations → operation dependencies) are copied verbatim into `ProductionOrderBomSnapshot`/`ProductionOrderBomLine` and `ProductionOrderRoutingSnapshot`/`ProductionOrderStage`/`ProductionOrderOperation`/`ProductionOrderDependency`. Later revisions or re-activations of the master BOM/routing never retroactively change an already-released order.

## API surface

Base path: `/api/v1/t/{tenantSlug}/manufacturing`.

| Resource | Endpoints |
|---|---|
| Demands | `GET/POST /demands`, `GET /demands/:id`, `POST /demands/:id/cancel` |
| SO conversion | `GET /demand-sources/sales-orders` (eligible SOs), `GET /demand-sources/sales-orders/:salesOrderId/lines` (per-line readiness), `POST /demand-sources/sales-orders/:salesOrderId/lines/:lineRef/convert` |
| Work orders | `GET/POST /work-orders`, `GET /work-orders/summary`, `GET /work-orders/:id`, `GET /work-orders/:id/detail`, `GET /work-orders/:id/activities`, `GET /work-orders/:id/ledger` |
| Work order lifecycle | `POST /work-orders/:id/release`\|`start`\|`hold`\|`resume`\|`complete`\|`cancel` |
| Progress | `POST /work-orders/:id/progress`, `POST /work-orders/:id/stages/complete`, `POST /work-orders/:id/progress/correct` |
| Dashboards | `GET /today`, `GET /control-room` |

Swagger paths are documented under tags `Production Demands`, `Work Orders`, `Production Dashboards` in `backend/src/config/swagger.ts`.

## Business rules

- **SO eligibility.** A sales order line is convertible when the SO is `confirmed` or `in_production`, and its `productId` resolves (directly as a `MasterItem`, or via `MasterProduct.fgItemId`) to an item with an **ACTIVE** manufacturing profile + default BOM version + default routing version. Remaining-to-convert = requested − already-converted for that `salesOrderId:lineId` key.
- **Conversion is atomic + idempotent.** `POST .../convert` (optional `idempotencyKey`) creates/updates a `ProductionDemand` keyed by `(tenantId, sourceLineKey)`, creates a DRAFT work order, and increments the demand's converted/remaining quantities in one transaction. Replaying the same `idempotencyKey` returns the original result. The sales order flips to `in_production` on its first conversion.
- **Manual creation** requires the profile's `directProductionOrderAllowed` flag.
- **Release (DRAFT → READY)** snapshots BOM + routing (see above) and computes initial stage/operation readiness: operations with no mandatory predecessor start `READY`; everything else starts `NOT_STARTED`. Parallel stages with no dependency between them are both `READY` immediately.
- **Start (READY → IN_PROGRESS)** stamps `actualStartAt`.
- **Progress recording** validates the work order is `IN_PROGRESS` and the stage is `READY`/`IN_PROGRESS`; rejects negative quantities and totals exceeding the stage's planned quantity plus the profile's `overproductionTolerancePercent`. Only the *final* stage's good quantity rolls up into the order's `completedGoodQuantity`/`completionPercent`. Idempotent via `idempotencyKey` on the ledger entry.
- **Stage completion** — under flexible execution (`flexibleExecution`, default on), good quantity below planned is **allowed** (warning on activity / `warnings[]`). When `qualityRequired`, the default flexible path **completes the stage and promotes successors** (QC deferred/overridable via `skipQcGate` + `qcOverrideReason`); set `skipQcGate: false` for the strict `QC_PENDING` + inspection path. See [`FLEXIBLE_WO_EXECUTION.md`](FLEXIBLE_WO_EXECUTION.md).
- **Work order completion** requires every non-optional stage to be `COMPLETED`/`SKIPPED` (or `QC_PENDING` when `allowCloseWithoutQc`); stamps `actualCompletedAt`. Quality blockers become **warnings** when flexible / allowCloseWithoutQc. FG/GL remain non-blocking warnings where posting is not ready.
- **Hold/Resume.** Hold requires a `reasonCategory` and stores `previousStatusBeforeHold`; resume restores that status.
- **Progress correction** creates a `REVERSAL` ledger entry (mirroring the original) plus a new `CORRECTION` entry with the corrected quantities, adjusting stage/operation/order totals by the delta. An entry can only be corrected once.
- **Health.** `ON_HOLD` status or the presence of a `BLOCKED` stage → `BLOCKED`; overdue and not `COMPLETED` → `DELAYED`; low completion relative to time elapsed → `ATTENTION`; otherwise `ON_TRACK`.

## Permissions

New permission keys added to `backend/src/constants/permissions.ts` (existing `manufacturing.work_orders.*` create/view/start/hold/resume/cancel keys are reused from Phase 1 scaffolding):

```
manufacturing.demand.view
manufacturing.demand.create
manufacturing.demand.convert
manufacturing.work_orders.release
manufacturing.work_orders.assign
manufacturing.stage.view
manufacturing.stage.execute
manufacturing.progress.record
manufacturing.progress.correct
manufacturing.timeline.view
manufacturing.control_room.view
```

Roles updated: **Production Supervisor** (adds start/hold/resume, progress.record, stage.execute, control_room.view, demand.view), **Production Engineer** (adds demand.view, work_orders.view, stage.view, timeline.view). **Production Manager** already receives the full `production.*`/`manufacturing.*` permission set unchanged.

## Testing

`backend/tests/manufacturing-phase2a.test.ts` (11 tests) + `backend/tests/manufacturing/helpers/production-fixture.ts` (fixture: active profile/BOM/routing with two parallel stages feeding a final assembly stage, plus confirmed/open Sales Order builders):

- Manual demand + manual work order creation; idempotency key replay.
- SO conversion: blocks unconfirmed SO, partial conversion + remaining tracking + over-conversion block, idempotent replay, SO flips to `in_production`.
- Release into immutable BOM/routing snapshots with correct initial parallel-stage readiness; a later BOM revision does not retroactively change the released snapshot.
- Full execution lifecycle: start → progress (negative rejected, idempotent duplicate) → stage complete (successor stays blocked until *both* parallel predecessors are done) → complete without any inventory mutation.
- Blocks completion while a mandatory stage is incomplete.
- Hold → resume back to prior status.
- Progress correction (reversal + corrected re-entry).
- Tenant isolation (404 across tenants) and 403 without permission.

Run: `npx vitest run tests/manufacturing-phase2a.test.ts tests/manufacturing-phase1.test.ts` (23 tests total, Phase 1 regression included).

## Frontend

Implemented for `VITE_USE_API=true` (API mode); demo mode (`VITE_USE_API=false`) keeps the pre-existing Phase 1 demo Work Order pages untouched — every route below branches on `isApiMode()` so demo behavior is never mixed with live API data.

**Types & API client:**
- `frontend/src/types/manufacturingProduction.ts` — Phase 2A DTOs (demands, work orders, stages, operations, snapshots, dashboards) mirrored 1:1 from the Prisma models/controller response shapes above, plus status/health label maps.
- `frontend/src/services/api/manufacturingApi.ts` — extended with `listDemands`, `getDemand`, `createManualDemand`, `cancelDemand`, `listEligibleSalesOrders`, `getSalesOrderLineEligibility`, `convertSalesOrderLine`, `listWorkOrders`, `getWorkOrdersSummary`, `getWorkOrder`, `getWorkOrderDetail`, `getWorkOrderActivities`, `getWorkOrderLedger`, `createManualWorkOrder`, `cancelWorkOrder`, `releaseWorkOrder`, `startWorkOrder`, `holdWorkOrder`, `resumeWorkOrder`, `completeWorkOrder`, `recordProgress`, `completeStage`, `correctProgress`, `getTodayDashboard`, `getControlRoomDashboard`.

**Pages:**
- `frontend/src/modules/manufacturing/work-orders/ApiWorkOrderRegisterPage.tsx` — list (WO#, Product, Source, Planned/Completed Qty, Due, Status, Health, Supervisor) with status/health filters and status-driven row actions (release/start/hold/resume/cancel).
- `frontend/src/modules/manufacturing/work-orders/ApiWorkOrderCreatePage.tsx` — two creation modes: **Manual** (product/qty/dates/priority) and **From Sales Order** (eligible SO → line eligibility → convert), both idempotency-keyed.
- `frontend/src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx` — header with single primary lifecycle action; tabs for Overview, Stages (+ Record Progress drawer, Complete Stage), BOM Snapshot (read-only), Materials (disabled — "Inventory integration pending"), Timeline (activities), Ledger. Shows "Material Control: Not connected to Inventory" / "Quality: Pending integration" notices, and on `COMPLETED` shows "Operational Production Complete — Finished Goods Receipt pending".
- `frontend/src/modules/manufacturing/work-orders/components/RecordProgressDrawer.tsx` — Good/Rework/Rejected/Scrap quantity entry against a stage, idempotency-keyed.
- `frontend/src/modules/manufacturing/today/TodayPage.tsx` — Today dashboard (`GET /today`): running/due-today/delayed/on-hold/completed-today panels.
- `frontend/src/modules/manufacturing/ApiProductionControlRoomView.tsx` — Control Room (`GET /control-room` + `GET /work-orders/summary`) status/health/work-centre/current-stage breakdowns; wired into `ProductionControlRoomPage.tsx` via an `isApiMode()` branch (demo dashboard unchanged for `VITE_USE_API=false`).

**Routing & navigation:** `frontend/src/routes/manufacturingRoutes.tsx` branches `/manufacturing/work-orders`, `/manufacturing/work-orders/new`, and `/manufacturing/work-orders/:workOrderId` on `isApiMode()` (API pages vs. demo pages) and adds `/manufacturing/today`. `frontend/src/config/navigation.ts` adds a **Today** nav item next to Control Room; Work Orders and Control Room remain top-level, Setup items remain grouped under **Setup**.

**Permissions:** `frontend/src/utils/permissions/manufacturing.ts` adds the eleven Phase 2A keys listed above to `MANUFACTURING_PERMISSIONS` and to the Owner/Production Manager/Supervisor/Viewer role sets, plus a new `useManufacturingWorkOrderPermissions()` hook (`canViewWo`, `canCreateWo`, `canRelease`, `canAssign`, `canStart`, `canProgress`, `canCorrectProgress`, `canHold`, `canResume`, `canComplete`, `canCancel`, `canViewDemand`, `canCreateDemand`, `canConvertDemand`, `canViewStage`, `canExecuteStage`, `canViewTimeline`, `canViewControlRoom`), re-exported from `frontend/src/utils/permissions/index.ts`.

**Explicitly not implemented in the frontend** (matching backend scope): no inventory/stock UI, no fake material availability, no quality inspection UI, no finished-goods receipt UI.

**Smoke test:** `frontend/scripts/test-manufacturing-phase2a-smoke.ts` (`npm run test:manufacturing-phase2a`) — file existence, API client export names, permission keys, route/nav wiring, `isApiMode()` branching. Regression: `npm run test:manufacturing-setup` (Phase 1) still passes; `npx tsc -b --noEmit` passes with no new errors.
