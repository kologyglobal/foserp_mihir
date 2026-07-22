# Report Calculation Rules (Phase 7D)

Key formulas and their exact source, taken from `backend/src/modules/ops-reports/`. Where a
metric is directional rather than audit-grade, that is called out. No cost or OEE metrics are
computed anywhere in Phase 7D.

Date filters are resolved in the tenant timezone (default `Asia/Kolkata`) and converted to a
half-open UTC range `[start, end)`. Each report's `dateBasis` (in `registry.ts`) names the
field the date range is applied to.

---

## Work order progress (`work-order-progress`)

- `completionPercent` is read directly from `ProductionOrder.completionPercent` (maintained by
  the Phase 2A stage-ledger posting engine) — **not** recomputed in the report.
- `stagesTotal` = count of stages; `stagesCompleted` = stages with `status === 'COMPLETED'`.
- Quantities (`completedGoodQuantity`, `reworkQuantity`, `rejectedQuantity`, `scrapQuantity`)
  are the persisted order totals.
- Result set capped at 3000 orders (warning emitted at the cap).

## Production Control Tower attention list (`production-control`)

- Attention list = open work orders (status **not** `COMPLETED`/`CLOSED`/`CANCELLED`) that are
  **overdue** (`requiredCompletionDate` in the past) **OR** have `healthStatus !== ON_TRACK`.
- No OEE, no cost.

## Plan vs actual (`plan-vs-actual`)

- Only plan lines whose plan status is `PLANNED`, `WORK_ORDERS_CREATED`, or `CLOSED` are
  included (`DRAFT`/`CANCELLED` excluded).
- `actualCompletedQuantity` = the linked `ProductionOrder.completedGoodQuantity`.
- `variance` = `actualCompletedQuantity − demandQuantity` (rounded to 4 dp).
- **Caveat:** plan lines with no linked work order show `actualCompletedQuantity = 0` and the
  report emits a warning counting the unlinked lines.

## WIP position — material held (`wip-position`)

- `wipQuantity = issuedQty − returnedQty`, floored at 0 (material still in the work order's
  custody). Only lines with `issuedQty > 0` and `wipQuantity > 0` are shown, for open work
  orders (`DRAFT`/`READY`/`IN_PROGRESS`/`ON_HOLD`).
- **No parallel stock ledger** — Inventory remains the SoT for physical stock. This is a
  custody view over `ProductionOrderMaterial`, not a stock balance.

## WIP ageing — date basis (`wip-ageing`)

- Age = `now − stage.startedAt` for stages currently `IN_PROGRESS`/`ON_HOLD`.
- **Fallback:** when `startedAt` is null, age is computed from `stage.updatedAt`, the row's
  `ageSource` shows `updatedAt (fallback)`, and the report emits a warning counting the
  fallback rows. See `WIP_AGEING_RULES.md` for the bucket definitions.

## Material readiness / reconciliation (`material-readiness`, `material-reconciliation`)

- `material-readiness`: one row per `ProductionOrderMaterial` line for open work orders
  (`requiredQty` / `reservedQty` / `issuedQty` / `shortageQty` are persisted line values).
- `material-reconciliation`: reuses the Phase 7A material-position / reconciliation engine per
  work order, bounded to the 200 most recently updated open/on-hold work orders per query.

## Job work (`job-work-ageing`, `job-work-reconciliation`)

- Ageing: age = `now − materialSentAt` (fallback `createdAt`) for job work orders not
  `CLOSED`/`CANCELLED`. Same buckets as WIP ageing.
- Reconciliation: `outstandingQty = sentQty − receivedQty` (material still with the vendor).

## First-pass acceptance / yield (`production-quality`) — PARTIAL

- `firstPassYieldPercent = acceptedQty / inspectedQty × 100`, aggregated per item from
  `QualityInspection` decided in range.
- **Caveat (why PARTIAL):** the schema records the accepted/rework/rejected split *at decision
  time* but does not track whether an accepted unit passed on the first attempt without any
  prior rework loop. This is therefore a **decision-based** first-pass yield
  (accepted-at-decision ÷ inspected), **not** a strict rework-excluded first-pass yield. Treat
  as directional, not audit-grade.

## Rework & rejection rates (`rework-rejection`)

- Aggregated from `ProductionOrderStage` totals grouped by product item + stage name.
- Rates computed against the denominator `(good + rework + rejected + scrap)`.

## Stage / work-centre performance (`stage-performance`, `work-centre-performance`)

- Stage cycle time = `completedAt − startedAt` for `COMPLETED` stages in range, grouped by
  stage code + work centre.
- Work centre: throughput from `DailyProductionLine`, downtime from `ProductionDowntime`.
- **Deliberately excludes OEE / availability / performance / quality-factor calculations.**

## Dispatch fulfilment & performance (`sales-order-fulfilment`, `dispatch-performance`)

- `fulfilmentPercent = dispatchedQty / orderedQty × 100`, from CONFIRMED `OutboundDispatch`
  lines linked by `salesOrderId` (via the CRM sales-order fulfilment service; `orderedQty` is
  net of cancelled quantity).
- Dispatch performance `leadTimeDays = dispatch.confirmedAt − salesOrder.orderDate`, computed
  only when the dispatch is linked to a sales order.

## Dispatch "on-time" definition

There is **no separate on-time SLA flag** stored on a dispatch. On-time behaviour is expressed
two ways, both derived from live dates:

1. **Dispatch lead time** (`dispatch-performance`): `confirmedAt − orderDate` in days — a trend,
   not a pass/fail SLA.
2. **Overdue sales-order lines** (Operational Exception Centre): a sales-order line is treated
   as late when its `requiredDate` (or `expectedDeliveryDate`) is in the past **and** it still
   has undispatched remaining quantity (`netOrderedQty − dispatchedQty > 0`). See
   `OPERATIONAL_EXCEPTION_CENTRE.md`.

No target/SLA calendar or promised-vs-actual on-time percentage is fabricated.
