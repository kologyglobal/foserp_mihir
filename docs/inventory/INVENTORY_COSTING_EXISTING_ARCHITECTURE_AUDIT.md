# Inventory Costing Existing Architecture Audit

Last updated: 2026-07-27

## 0. Goal of this audit

Document what the current FOS ERP repository does today for:

1) **Physical stock** (quantity, reservations, lots/serials, stock counts, transfers, dispatch/receipts, corrections/reversals).
2) **Inventory valuation / costing as it exists today** (what value is stored where, how it is calculated, and which “methods” are effectively implemented).
3) **Manufacturing costing** (WO cost snapshots/entries, absorption/variance, corrections, financial close).
4) **Finance integration** (central posting engine, GL mapping, idempotency, how inventory vs manufacturing GL is kept from double posting).

No schema changes or new engines are introduced by this audit.

## 1. Core terminology (as implemented in this repo today)

### A) Physical stock (SoT)

**Source of truth:** `InventoryStockMovement` + cached `InventoryStockBalance`.

Prisma models:
- `InventoryStockMovement` (ledger) — `backend/prisma/schema.prisma`
- `InventoryStockBalance` (cached balance) — `backend/prisma/schema.prisma`
- `InventoryStockReservation` (reservation demand) — `backend/prisma/schema.prisma`

Important invariant is explicitly stated:
- `Inventory accounting GL events` are computed from stock movements for **non-manufacturing-owned reference types**.
- Manufacturing-owned reference types are excluded from inventory GL to avoid double posting.

### B) Inventory valuation (financial value of physical stock)

**Where value lives today:** `InventoryStockMovement.value`, `InventoryStockBalance.avgRate`, `InventoryStockBalance.stockValue`.

**Effective valuation method implemented:** **Moving weighted average** (per movement posting logic).

### C) Manufacturing costing

Manufacturing cost accumulation is **not** a physical stock ledger re-implementation.

Instead, it uses:
- `WorkOrderCostSnapshot` (planned/current_actual snapshots)
- `WorkOrderCostEntry` (additive cost entries by category)
- `ProductionAccountingEvent` (GL-postable event trail for manufacturing)

## 2. Inventory (physical stock) — repository audit

### 2.1 Key models

#### Inventory ledger & balance
- `InventoryStockMovement`:
  - `movementType`: `OPENING | INWARD | ISSUE | ADJUSTMENT`
  - `referenceType` (what the movement belongs to): `GRN | ISS | ISSUE_TO_WO | RETURN_FROM_WO | WIP_RECEIVE | WIP_TRANSFER | FG_RECEIPT | FG_DISPATCH | ...`
  - `quantity`: signed (inward/opening positive; issue negative; adjustment either sign)
  - `rate` and `value`
  - tracking snapshots: `batchNumberSnapshot`, `serialNumberSnapshot`
  - linkage: `workOrderId`, `reservationId`, `batchId`, `serialId`
  - idempotency: `idempotencyKey` (unique within tenant)
  - `balanceAfter` (cached after the transaction)

- `InventoryStockBalance` (cached per item+warehouse):
  - `onHandQty`, `reservedQty`, QC/blocked/rejected splits
  - valuation state: `avgRate`, `stockValue`

#### Tracking identity (lot/serial)
- `InventoryBatch`, `InventoryBatchBalance`
- `InventorySerial`
- `InventorySerialMovement` (per serial per stock movement)
- `InventoryLot`, `InventoryLotMovement` (per lot per stock movement)

These identity models exist and are used for traceability, but they do **not** by themselves create a cost-layer model.

#### Reservations (quantity-only physical demand)
- `InventoryStockReservation`:
  - `quantity`, `fulfilledQty`, `releasedQty`
  - links to demand sources:
    - `demandType`: `SO | WO | DISPATCH`
    - `salesOrderId/LineId`, `dispatchRequirementId`, `outboundDispatch*`
    - `productionMaterials` (WO material requirements)

### 2.2 Inventory settings

Tenant inventory policy/settings are stored as JSON:
- `InventorySettings.settings` (Prisma model)
- FE shape matches `backend/src/modules/inventory/setup/setup.schemas.ts`

Relevant setting:
- `general.defaultCostingMethod` options: `standard | average | fifo | specific`

**Audit finding:** the repository contains settings to choose “costing method”, but the current physical valuation logic in `stock-posting.service.ts` uses moving-average mechanics (see section 3). So **method selection is currently not wired into valuation math** for inventory stock ledger.

### 2.3 Stock movements — how quantities and valuations are posted today

All posting funnels into:
- `backend/src/modules/inventory/shared/stock-posting.service.ts` (`postStockMovement`)

Key valuation math (moving average at ledger level):
- The posting service computes a single `rate` and `value` per movement:
  - if caller provided a positive `input.rate`, it uses it
  - otherwise it reuses the previous cached `balance.avgRate`
  - `value = rate * abs(signedQty)`
- It then updates cached valuation state:
  - receipts update average rate (weighted by prior on-hand qty and receipt qty)
  - issues keep `avgRate` unchanged (so they “consume value” at the existing average)

Concurrency & idempotency:
- `postStockMovement` supports `input.idempotencyKey` and returns existing movement if duplicate.

Reservation consumption:
- For negative quantity movements (issues), the service asserts negative movement policy and optionally consumes reservations:
  - `ISSUE_TO_WO`: consumes active WO reservation (unless `consumeWoReservation !== false`)
  - `FG_DISPATCH`: consumes active dispatch (and possibly SO) reservations
  - Reservation consumption updates `fulfilledQty` and reservation status.

### 2.4 Operations covered by physical ledger reference types

Current `InventoryReferenceType` enum includes:
- Purchase receipts: `GRN`
- Purchase return: `PURCHASE_RETURN` / uses `referenceType` variants for return/issue
- Manufacturing material issue/return:
  - `ISSUE_TO_WO`
  - `RETURN_FROM_WO`
- WIP and FG capitalization stages:
  - `WIP_RECEIVE`, `WIP_TRANSFER`, `MOVE_TO_WIP`, `MOVE_FROM_WIP`
  - `SA_RECEIPT`, `FG_RECEIPT`
- Dispatch / COGS trigger:
  - `FG_DISPATCH`
- Transfers & reversals:
  - `TRANSFER_DISPATCH`, `TRANSFER_RECEIPT`, `TRANSFER_REVERSAL`
- QC flows:
  - `QUALITY_RELEASE`, `QUALITY_HOLD`, `QUALITY_REJECT`
- Stock count and reversals:
  - `STOCK_COUNT`, `STOCK_COUNT_REVERSAL`

### 2.5 GRN (purchase inbound) integration

GRN inward posting is implemented in:
- `backend/src/modules/purchase/shared/purchase-inventory-posting.ts` (`postGrnStockInward`)

It calls:
- `postStockMovement(... movementType: 'INWARD', referenceType: 'GRN', rate: line.rate, referenceNo: grnNumber ...)`

**Meaning:** GRN supplies the valuation rate used for the receipt.

### 2.6 Returns / reversal behavior (inventory ledger)

Inventory reversals are generally modeled as compensating stock movements with:
- matching `referenceType` suffixes (e.g. `TRANSFER_REVERSAL`, `GRN reverse` as issue movements, `ADJUSTMENT_REVERSAL`).

Cost restoration behavior:
- Because physical valuation uses moving-average mechanics, reversals restore inventory quantity and value as implied by the moving-average state at posting time.
- Some reversal flows pass explicit `rate` (e.g. transfer reverse uses `line.rate`, inventory adjustment reversal uses `line.rate`), but GRN reversals may rely on cached avg rate if rate is not provided.

### 2.7 Inventory corrections & stock adjustments

Inventory adjustments are implemented in:
- `backend/src/modules/inventory/adjustments/adjustment.service.ts`

Posting:
- creates `ADJUSTMENT` movement with `referenceType: CONTROLLED_ADJUSTMENT`
- uses explicit `line.rate` (caller-provided)

Reversal:
- creates compensating `ADJUSTMENT` with `referenceType: ADJUSTMENT_REVERSAL`
- uses `line.rate` again.

So corrections/restatements can preserve a supplied valuation basis.

### 2.8 Inventory reconciliation

Read-only diagnostic:
- `backend/src/modules/inventory/balances/reconciliation.service.ts`

Audit finding:
- reconciliation is **quantity-only** (compares `InventoryStockBalance` totals vs aggregated `InventoryStockMovement.quantity` and reservation deltas).
- It does **not** reconcile valuation (`avgRate`, `stockValue`) vs a valuation-aware ledger.

## 3. Inventory valuation engine — what exists today

### 3.1 Effective method implemented

Physical stock posting math in `backend/src/modules/inventory/shared/stock-posting.service.ts` implements:
- **moving weighted average**
- no explicit FIFO cost layer consumption
- no “standard cost” valuation carry
- no “specific identification” valuation per serial/lot cost

### 3.2 How receipts vs issues affect avgRate

Receipt movements:
- If `input.rate > 0`, use it
- avgRate is recalculated using:
  - previous on-hand quantity/value implied by `previousAvgRate`
  - plus receipt qty at `rate`

Issue movements:
- If no rate supplied, it consumes at the existing cached `avgRate`
- avgRate stays unchanged for the balance row.

### 3.3 Cost layers and cost entries

There are **no inventory cost layer models** in Prisma schema.

Only manufacturing has “cost entries”, stored as:
- `WorkOrderCostSnapshot`
- `WorkOrderCostEntry`

Inventory valuation today is implicit:
- stored directly as movement `rate/value`
- derived from cached avg state.

### 3.4 FIFO / Specific Identification support status

There is:
- tracking identity infrastructure (lot/serial models)
- inventory settings that mention FIFO/specific

But there is:
- no FIFO cost-layer table
- no issue allocation algorithm consuming oldest eligible layers
- no explicit mapping from serial/lot to unit cost distinct from moving-average.

## 4. Manufacturing costing & actual work order cost — repository audit

### 4.1 Costing policy models

Manufacturing costing policy is implemented via:
- `ManufacturingCostingPolicy`
- includes:
  - `costingMethod`: `ACTUAL | PLANNED_AS_PROVISIONAL | STANDARD_WITH_VARIANCE`
  - `inventoryValuationMethod`: `MOVING_AVERAGE | FIFO` (present in schema)
  - rate sources (labour/machine/job work) and overhead model

Audit finding:
- `inventoryValuationMethod` exists in policy, but current material issue valuation into WO uses `InventoryStockMovement.value` (which is already moving-average based in the physical ledger).
- FIFO allocation inside WO cost calculation is not implemented as a separate algorithm in the WO cost calculation service.

### 4.2 Work Order cost snapshots & entries

Prisma models:
- `WorkOrderCostSnapshot`
  - types: `PLANNED | CURRENT_ACTUAL | FG_RECEIPT | WORK_ORDER_CLOSE | REVERSAL`
  - stores: planned/actual material/labour/machine/jobWork/overhead totals and unit costs
  - stores: provisional cost, variance amount, warnings, fingerprint
- `WorkOrderCostEntry`
  - additive entries by `WorkOrderCostCategory` (MATERIAL, LABOUR, MACHINE, JOB_WORK, OVERHEAD, SCRAP, REWORK, VARIANCE, REVERSAL)
  - supports reversal linkage:
    - `reversalOfCostEntryId`
  - links to `ProductionAccountingEvent` when accounting events are recorded.

Code:
- `backend/src/modules/manufacturing/costing/work-order-cost.service.ts`

### 4.3 Material issues/returns into WO (physical → manufacturing cost)

Manufacturing material requirements exist as:
- `ProductionOrderMaterial`:
  - required/reserved/issued/returned/shortage qty
  - optionally tied to an `InventoryStockReservation`

Physical movement reference types:
- `ISSUE_TO_WO` and `RETURN_FROM_WO`

Cost calculation inside WO:
- Work order cost service uses the **movement.value and movement.quantity** from inventory movements.
- For material variance under `STANDARD_WITH_VARIANCE`, it computes standard based on `MasterItem.standardRate` and compares it with movement.value (actual).

Therefore, **Actual Work Order Cost** today is:
- “actual material/labour/machine/job work/overhead” accumulated inside WO cost snapshot
- with material cost sourced from the inventory movement values.

### 4.4 FG receipt capitalization (key bridge between manufacturing cost and inventory ledger)

Finished goods receipt posting:
- `backend/src/modules/manufacturing/fg-receipts/fg-receipt.service.ts`

But the actual inventory stock posting is done via:
- `backend/src/modules/inventory/movements/movement.service.ts` (`postFgReceipt`)

Critical behavior:
- `postFgReceipt` resolves the stock posting `rate` using:
  - `WorkOrderCostSnapshot.unitActualCost` if present
  - else `WorkOrderCostSnapshot.unitPlannedCost`
  - else fallback to `MasterItem.standardRate`

So the inventory ledger **can** be valued at WO actual/planned unit cost during FG receipt.

Accounting event amount:
- `fg-receipt.service.ts` records a `ProductionAccountingEvent` (`FINISHED_GOODS_RECEIVED`) with amount derived from:
  - the inventory movement value, then optionally adjusted for capitalization quantity rules:
    - for standard costing: uses planned quantity
    - otherwise uses completed good quantity
    - applies proportional capitalization based on snapshot totals and already-capitalized amounts.

### 4.5 Absorption, variance, and financial close

Absorption (labor/machine/overhead/job work) is recorded and optionally posted:
- `backend/src/modules/manufacturing/costing/posting-orchestrator.service.ts`

Variance:
- `work-order-cost.service.ts` computes variance components when policy is `STANDARD_WITH_VARIANCE`
- recorded as `WorkOrderCostEntry` category `VARIANCE` (source `STANDARD_COST_VARIANCE`)

Financial close:
- produces `ProductionAccountingEventType.PRODUCTION_VARIANCE` using residual variance based on snapshot vs posted accounting event sums.

### 4.6 Reversals and corrections in manufacturing

Manufacturing corrections are modeled as compensating transactions (Phase 5C+).

Prisma notes in schema:
- manufacturing corrections/FG receipt corrections state:
  - “compensating transactions only”
  - “never edit/delete posted ledgers or stock rows”

Cost entry reversals:
- `WorkOrderCostEntry.reversalOfCostEntryId` supports cost-lineage restoration.

## 5. Finance integration — central posting and inventory/manufacturing GL separation

### 5.1 Inventory accounting (inventory GL events)

GL posting from physical inventory:
- `backend/src/modules/inventory/accounting/inventory-accounting-event.service.ts`

It:
1. Creates an idempotent `InventoryAccountingEvent` row (status may be skipped/failed)
2. If finance feature flag is enabled and event is mapping-ready, posts a balanced `SYSTEM` voucher via central posting engine.

Inventory accounting mapping:
- `backend/src/modules/inventory/accounting/inventory-accounting-builder.service.ts`

Mappings exist for:
- `GRN_INWARD`, `GRN_REVERSAL`, `STOCK_ADJUSTMENT`, `STOCK_ADJUSTMENT_REVERSAL`,
- `FG_DISPATCH`, `FG_DISPATCH_REVERSAL`

Double-post prevention (explicit):
- `MANUFACTURING_OWNED_REFERENCE_TYPES` includes:
  - `ISSUE_TO_WO`, `RETURN_FROM_WO`, `WIP_RECEIVE`, `WIP_TRANSFER`, `MOVE_TO_WIP`, `MOVE_FROM_WIP`, `SA_RECEIPT`, `FG_RECEIPT`, `SUBCON_OUT`, `SUBCON_IN`
- inventory accounting event derivation returns `null` for these types.

So manufacturing accounting owns those GL consequences.

### 5.2 Manufacturing accounting (production accounting events)

Manufacturing GL posting:
- `backend/src/modules/manufacturing/accounting/manufacturing-accounting-builder.service.ts`

It maps:
- `MATERIAL_ISSUED` / `MATERIAL_RETURNED` to `WIP_INVENTORY` and `RAW_MATERIAL_INVENTORY`
- `FINISHED_GOODS_RECEIVED` to `FINISHED_GOODS_INVENTORY` and `WIP_INVENTORY`
- absorptions into specific absorption accounts (LABOUR_ABSORPTION, MACHINE_ABSORPTION, PRODUCTION_OVERHEAD_ABSORPTION, JOB_WORK_ABSORPTION)
- variance into `PRODUCTION_VARIANCE`

Posting orchestrator:
- records `ProductionAccountingEvent` and posts it through central accounting posting service.

### 5.3 Central posting engine and idempotency

Generic accounting post engine:
- `backend/src/modules/accounting/posting/posting.service.ts`

Key characteristics:
- Uses posting idempotency (`posting-idempotency.service.ts`)
- Reserves voucher numbers
- Creates `accountingVoucher` + `accountingVoucherLine` + `GeneralLedgerEntry` rows
- Applies GL lines in a single posting transaction.

This is the central mechanism by which both inventory and manufacturing events become GL.

## 6. Item master valuation fields & tracking configuration

Item master:
- `MasterItem.standardRate` (Prisma model)

Tracking settings:
- `MasterItem.batchTracked`, `MasterItem.serialTracked`

This is used today for:
- Standard cost variance calculations in manufacturing (`STANDARD_WITH_VARIANCE`)
- Fallback rate for FG receipt valuation when WO snapshot costs are unavailable.

Audit finding:
- There is no effective standard-cost valuation engine at inventory ledger level.
- Inventory ledger valuation can be influenced by WO costs at FG receipt time, but ongoing inventory carry still follows moving-average mechanics.

## 7. Existing calculation paths (summary)

### 7.1 Physical stock quantity
1. Reservation created/updated in `InventoryStockReservation` (quantity allocation SoT)
2. Posting consumes reservations for issue movements.
3. `postStockMovement` updates:
   - `InventoryStockMovement` (signed qty, rate, value, balanceAfter)
   - `InventoryStockBalance` (onHand/reserved/QC splits, `avgRate`, `stockValue`)
   - lot/serial movements for traceability.

### 7.2 Inventory valuation (implicit moving average)
1. Receipts supply `rate`:
   - GRN inward uses `GoodsReceiptLine.rate`
2. Issues use cached `balance.avgRate` unless caller supplies an explicit positive `rate`.
3. avgRate recalculates on receipts.

### 7.3 Actual Work Order Cost (manufacturing)
1. Work order cost calc uses inventory movement values for material issues/returns.
2. Additional WO cost components are computed from:
   - labour runtime & rate sources
   - machine runtime & rate sources
   - job work sources
   - overhead method
3. Total is summarized in `WorkOrderCostSnapshot` and decomposed into `WorkOrderCostEntry`.

### 7.4 Manufacturing cost → inventory valuation bridge
1. FG receipt resolves `postFgReceipt` stock movement `rate` from WO snapshot unit actual/planned.
2. FG receipt also creates manufacturing accounting event (`FINISHED_GOODS_RECEIVED`) with a capitalization amount potentially proportional/standardized.
3. Inventory accounting GL does not handle `FG_RECEIPT` reference types (manufacturing-owned).

## 8. Migration impact analysis (for future costing engine work)

### 8.1 Risk: current inventory valuation is implicit and moving-average based

Future engines (FIFO / weighted average / specific identification / standard) must not create a second physical ledger.

However, current design:
- stores valuation directly on physical movement rows (`rate/value`)
- uses cached avgRate on balances
- uses moving-average math everywhere in `postStockMovement`

Therefore any future method changes will require either:
- restructuring valuation computation while preserving physical ledger and idempotency guarantees, or
- introducing additive valuation layers and ensuring `InventoryStockMovement.value` remains consistent with the configured method.

### 8.2 Risk: manufacturing capitalization vs moving-average carry mismatch

FG receipt valuation uses WO unitActualCost/unitPlannedCost snapshot.

But inventory ledger and cached moving-average are still updated through moving-average logic.

This can create:
- valuation drift scenarios between:
  - cached avgRate/stored stockValue
  - accounting inventory accounts (posted by manufacturing accounting events)

Today, reconciliation is only quantity-based; no valuation reconciliation exists.

Future work should include valuation reconciliation equations and tie-outs.

### 8.3 Duplicate ledger risks are currently mitigated by reference-type ownership

Inventory accounting excludes manufacturing-owned reference types by design.

Any future inventory valuation engine must preserve:
- correct partitioning of which component owns which GL posting.

Otherwise double-posting can occur.

## 9. Recommendations (for the next phase, not implemented here)

### 9.1 Separate concepts explicitly

Current repo partially separates:
- physical stock ledger (inventory stock movements)
- manufacturing cost entries (WO cost entries)
- accounting events (inventory accounting + manufacturing accounting)

But inventory valuation method selection is not realized as a strategy engine.

Recommendations:
1. Introduce a dedicated **inventory valuation engine** that transforms physical ledger movements into cost facts.
2. Keep physical ledger as SoT for quantity.
3. Keep manufacturing costing as SoT for actual work order costs, but source material cost from valuation engine outputs (not directly from implicit moving-average state).
4. Keep GL posting under central posting engine using existing event models.

### 9.2 Additive costing layer models (Phase 1 foundation)

Given the repo has:
- no cost layer tables
- no inventory cost entries

introduce additive models that reference physical movement ids, without rewriting them.

### 9.3 Method change lifecycle (high-risk)

Inventory settings allow selecting standard/average/fifo/specific, but method change is not a governed lifecycle today.

Any future method change must:
- prevent “in-place” method flips
- apply from an effective date
- keep historical movements consistent with historical method basis.

### 9.4 Ensure valuation reconciliation is implemented

Current reconciliation service is quantity-only.

Future reconciliation should:
- tie inventory valuation evidence (layers/cost entries)
- to `InventoryStockBalance.stockValue`
- and to GL inventory accounts by legal entity.

## 10. Checklist of audited components (mapping to the user’s requested audit scope)

### Inventory audited
- `InventoryStockMovement` (ledger SoT for quantity + implicit valuation)
- `InventoryStockBalance` (cached balance with `avgRate`, `stockValue`)
- reservations: `InventoryStockReservation` + consumption logic in `stock-posting.service.ts`
- inward/issue/return flows: `referenceType` driven in `InventoryReferenceType` and `movement.service.ts` and purchase posting
- transfers: `inventory/transfers/transfer.service.ts` uses `InventoryPostingService.post` with explicit rate on dispatch/receive
- FG receipt & material/WIP flows: manufacturing uses `postFgReceipt` which resolves rate from WO snapshots
- dispatch: FG dispatch issue is blocked from direct posting when hardened dispatch posting is enabled and is posted through dispatch posting service
- corrections/reversals:
  - adjustments: `CONTROLLED_ADJUSTMENT` + `ADJUSTMENT_REVERSAL` with explicit rate
  - transfer reversal: uses `TRANSFER_REVERSAL` with explicit `rate: line.rate`
- lot/serial fields:
  - `batchId/serialId` on movement
  - `InventorySerialMovement` and `InventoryLotMovement`
- opening stock:
  - `postOpening` calls `postStockMovement` with referenceType `OPN`
- GRN integration:
  - `postGrnStockInward` uses `rate: line.rate`, referenceType `GRN`

### Manufacturing audited
- Work order costing:
  - `WorkOrderCostSnapshot`, `WorkOrderCostEntry`
- consumption sourcing:
  - material costs in WO cost calc use inventory movements (`ISSUE_TO_WO`, `RETURN_FROM_WO`) quantities/values
- absorption:
  - `posting-orchestrator.service.ts` records and optionally posts absorption events
- variance:
  - `STANDARD_WITH_VARIANCE` produces variance entries
- corrections:
  - compensating transactions with reversal lineage for cost entries
- financial close:
  - records `PRODUCTION_VARIANCE` events using residual variance

### Finance audited
- central posting engine:
  - `backend/src/modules/accounting/posting/posting.service.ts`
  - idempotent posting events & voucher/GL creation
- inventory GL mapping:
  - `backend/src/modules/inventory/accounting/inventory-accounting-builder.service.ts`
- manufacturing GL mapping:
  - `backend/src/modules/manufacturing/accounting/manufacturing-accounting-builder.service.ts`
- WIP/FG/variance/material consumption keys exist as account mapping keys in templates and readiness services.

