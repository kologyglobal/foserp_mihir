# Work Order Costing Rules

Source: `backend/src/modules/manufacturing/costing/work-order-cost.service.ts` (`calculateWorkOrderCost`), models `WorkOrderCostSnapshot`, `WorkOrderCostEntry`.

Calculating a work-order cost builds one **snapshot** (header totals) and a set of **cost entries** (line detail). Calculation can run with `persist: false` (preview) or `persist: true` (default) which writes a new snapshot version.

---

## Inputs pulled per work order

- `bomSnapshot.lines` (planned material, with `item.standardRate`)
- `operations` (planned labour/machine minutes + work-centre/machine `costRate`)
- `dailyLines` (**actual** labour/machine minutes + rates) — see `LABOUR_AND_MACHINE_COSTING.md`
- `InventoryStockMovement` where `workOrderId` and `referenceType ∈ {ISSUE_TO_WO, RETURN_FROM_WO}` (**actual** material) — see `MATERIAL_COSTING_RULES.md`
- `jobWorkOrders` (planned `expectedCost`, actual linked invoice) — see `JOB_WORK_COSTING.md`
- `finishedGoodsReceipts` (non-DRAFT) for `fgReceivedQuantity`
- Resolved costing policy (`resolveCostingPolicy` by `plantCode`)

---

## Planned vs actual (by category)

| Category | Planned | Actual |
|----------|---------|--------|
| Material | Σ `line.requiredQuantity × item.standardRate` | Σ signed movement value (issue − return); provisional fallback if value ≤ 0 |
| Labour | Σ operation minutes / 60 × labour rate | Σ daily-line `labourMinutes` / 60 × labour rate |
| Machine | Σ operation minutes / 60 × machine rate | Σ daily-line `machineMinutes` / 60 × machine rate |
| Job work | Σ `expectedCost` | Σ (linked invoice amount \| `expectedCost`) |
| Overhead | policy method on **planned** drivers | policy method on **actual** drivers |

Operation planned minutes = `setupTimeMinutes + (runTimeBasis = PER_UNIT ? runTimeValue × plannedQuantity : runTimeValue)`.

`goodQuantity = productionOrder.completedGoodQuantity`.

---

## Snapshot fields (`work_order_cost_snapshots`)

Header persists planned/actual for each category plus:

- `scrapCost`, `reworkCost` — currently always `0` (no capture pipeline).
- `totalPlannedCost`, `totalActualCost` (2 dp), `totalPostedCost` (Σ `POSTED` events for the WO).
- `provisionalCost` — absolute provisional portion (material fallback + unlinked job work).
- `varianceAmount = totalActualCost − totalPostedCost`.
- `unitPlannedCost = totalPlanned / plannedQuantity` (4 dp), `unitActualCost = totalActual / goodQuantity` (4 dp).
- `snapshotVersion` — incremented per calculation; unique `(tenantId, productionOrderId, snapshotVersion)`.
- `snapshotType` — code writes `CURRENT_ACTUAL`. Enum also allows `PLANNED`, `FG_RECEIPT`, `WORK_ORDER_CLOSE`, `REVERSAL` (not written by the calculator).
- `status` — string, set to `CALCULATED`.
- `sourceFingerprint` — sha256 (first 40 chars) over `[category, sourceEntityId, amount]` of entries; lets callers detect unchanged inputs.
- `warningSummaryJson` — de-duplicated warning list.

---

## Cost entries (`work_order_cost_entries`)

One entry per real cost source, **upserted** on unique key `(tenantId, costCategory, sourceEntityType, sourceEntityId)` so recalculation updates rather than duplicates. Categories written: `MATERIAL`, `LABOUR`, `MACHINE`, `JOB_WORK`, `OVERHEAD`. (`SCRAP`, `REWORK`, `VARIANCE`, `REVERSAL` exist in the enum but are not produced by the calculator.) Each entry carries `sourceEntityType`, `sourceEntityId`, `rate`, `amount`, `provisional`, and category-specific refs (`itemId`, `workCentreId`, `machineId`, `jobWorkOrderId`, `quantity`, `durationMinutes`).

---

## Completeness status

Derived on each snapshot (`completenessStatus`, VARCHAR(40)):

| Status | Condition |
|--------|-----------|
| `INCOMPLETE_MATERIAL_RATE` / `INCOMPLETE_LABOUR_RATE` / `INCOMPLETE_MACHINE_RATE` / `INCOMPLETE_LABOUR_TIME` / `INCOMPLETE_MACHINE_TIME` | any `INCOMPLETE_*` warning present (first one wins) |
| `COMPLETE_WITH_PROVISIONAL` | no incomplete warning, but provisional cost present |
| `COMPLETE` | no incomplete warning and no provisional cost |
| `NOT_CALCULATED` | reported by `getCostSummary` when no snapshot exists yet |

Warnings raised: `INCOMPLETE_MATERIAL_RATE:<itemId>`, `INCOMPLETE_LABOUR_RATE:<id>`, `INCOMPLETE_MACHINE_RATE:<id>`, `INCOMPLETE_LABOUR_TIME`, `INCOMPLETE_MACHINE_TIME`, `PROVISIONAL_MATERIAL_RATE:<movementId>`, `PROVISIONAL_JOB_WORK:<jobId>`.

`INCOMPLETE_*_TIME` are raised when there are no operations, or no daily lines while the order is `IN_PROGRESS/COMPLETED/CLOSED`.

---

## Allowed actions (from `getCostSummary`)

- No snapshot → `['CALCULATE']`.
- Snapshot present → `['RECALCULATE', …]`; when completeness does **not** start with `INCOMPLETE`, also `RECORD_ABSORPTION` and `FINANCIAL_CLOSE_PREVIEW`.

---

## API

- `POST /work-orders/:id/cost/calculate` (`manufacturing.cost.calculate`) body `{ persist?: boolean }`.
- `GET /work-orders/:id/cost-summary` · `/cost-details` · `/cost-snapshots` (`manufacturing.cost.view`).
