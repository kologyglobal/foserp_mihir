# Production — Database Design (Proposal Only)

**Status:** Implemented through Phase 2B. See `docs/manufacturing/PRODUCTION_PHASE2B_README.md`.  
**Verified:** 2026-07-20 against repository code.

Phase 2B models: `ProductionAssignment`, `DailyProductionBatch`, `DailyProductionLine`, `ProductionIssue`, `ProductionDowntime` (migration `20260720160000_manufacturing_phase2b_daily_ops`). Soft `shiftCode`/`employeeId` until HR masters exist.

---

## 1. Existing relevant models (reuse / reference)

| Model | Path / table | Production use |
|-------|--------------|----------------|
| `MasterItem` | `master_items` | BOM components, FG, SFG |
| `MasterProduct` | `master_products` | Sellable offering → `fgItemId` |
| `MasterUom` | `master_uoms` | All quantities |
| `MasterWarehouse` / `MasterLocation` | | Issue / FG / WIP WH |
| `MasterVendor` | | Subcontract |
| `CrmCompany` | | MTO customer |
| `CrmSalesOrder` | `crm_sales_orders` | Demand source (lines JSON today) |
| `CostCentre` | `cost_centres` | Cost dimension |
| `Branch` / `LegalEntity` | Finance org | Posting scope later |
| `User` | `users` | Operators / audit |
| `CodeSeries` | | Extend entity enum for WO/BOM |
| `CrmAttachment` | | Extend entity types |
| `FinanceFeatureControl` | | `MANUFACTURING_ACCOUNTING` |
| `PostingEvent` | | Future GL (not Phase 1) |
| `AuditLog` | | System audit |

**Not present:** Bom, Routing, WorkCentre, Machine, ProductionOrder, WIP ledger, Quality inspection, Inventory stock, Purchase PR.

`MasterItem.productionBomId` / `routingNo` are soft strings — replace with real FKs when masters exist.

---

## 2. Design principles

1. UUID PKs, `tenantId`, soft `deletedAt`, `createdBy`/`updatedBy`, timestamps.  
2. `Decimal(18,4)` quantities; `Decimal(18,2)` money.  
3. Snapshots on release — master BOM/routing edits do not rewrite open orders.  
4. Logical stage ledger in Production; physical stock in Inventory (future).  
5. Idempotency keys on posting-sensitive writes.  
6. Generic Manufacturing Profile — no trailer-only tables.

---

## 3. Proposed models

### 3.1 ManufacturingProfile

| | |
|--|--|
| **Purpose** | Generic discrete-manufacturing template bound to finished item (MTS/MTO/ATO/ETO/job shop/repetitive/project) |
| **Key fields** | `id`, `tenantId`, `code`, `name`, `finishedItemId`, `profileType` (enum), `executionMode` (SIMPLE\|DETAILED), `defaultBomId?`, `defaultRoutingId?`, `qualityPlanId?`, `status`, audit |
| **Relationships** | → MasterItem; optional BOM/Routing |
| **Unique** | `@@unique([tenantId, code])`; one ACTIVE default per finished item (partial/app enforced) |
| **Indexes** | `tenantId+finishedItemId+status` |
| **Status** | DRAFT, ACTIVE, INACTIVE |
| **Reuse** | New |
| **Migration risk** | Low (greenfield) |

### 3.2 ManufacturingBom / Version / Line

| Model | Purpose | Key fields | Unique / indexes |
|-------|---------|------------|------------------|
| `ManufacturingBom` | BOM header for finished/SFG item | `code`, `finishedItemId`, `baseQty`, `baseUomId`, `status` | `tenantId+code` |
| `ManufacturingBomVersion` | Immutable version | `bomId`, `versionNo`, `isCurrent`, `effectiveFrom` | `tenantId+bomId+versionNo` |
| `ManufacturingBomLine` | Component | `versionId`, `lineNo`, `componentItemId`, `qty`, `uomId`, `scrapPct`, `issueWarehouseId?`, `backflush`, `operationId?` | `versionId+lineNo` |

**Status:** DRAFT → ACTIVE → OBSOLETE.  
**Reuse:** Replaces FE dual BOM stores; links Item/UOM/Warehouse.  
**Risk:** Medium — FE demo data migration optional; soft `MasterItem.productionBomId` cleanup.

### 3.3 ManufacturingRouting / Version / StageGroup / Operation / Dependency

| Model | Purpose |
|-------|---------|
| `ManufacturingRouting` | Process template for finished item |
| `ManufacturingRoutingVersion` | Versioned snapshot source |
| `ManufacturingStageGroup` | Coarse stages for Simple mode / shopfloor (e.g. Fabrication, Assembly, Final QC) |
| `ManufacturingRoutingOperation` | Detailed op: sequence, workCentreId, plannedMinutes, qcRequired, subcontractable, scrapAllowed |
| `ManufacturingOperationDependency` | Predecessor edges (supports parallel chassis/tank style graphs) |

**Status:** DRAFT → ACTIVE → INACTIVE. One ACTIVE routing per finished item (app rule).  
**Constraints:** No circular dependencies (service validation).  
**Risk:** Medium — align with FE Route Master UX.

### 3.4 ManufacturingWorkCentre / ManufacturingMachine

| Model | Purpose | Notes |
|-------|---------|-------|
| `ManufacturingWorkCentre` | Capacity / cost / plant tag | Reference warehouse optional; `plantCode` until Plant master |
| `ManufacturingMachine` | Optional asset under WC | Defer if SIMPLE mode only in Phase 1 |

**Status:** ACTIVE / INACTIVE.  
**Risk:** Low. Avoid duplicating FA Asset.

### 3.5 ProductionOrder (Work Order)

| | |
|--|--|
| **Purpose** | Executable production document (UI: Work Order) |
| **Key fields** | `workOrderNo`, `profileId?`, `finishedItemId`, `plannedQty`, `goodQty`, `reworkQty`, `rejectQty`, `scrapQty`, `uomId`, `status`, `priority`, `warehouseId`, `salesOrderId?`, `salesOrderLineId?`, `customerId?`, `projectRef?`, `costCentreId?`, `sourceType` (SALES_ORDER\|MANUAL\|STOCK\|PROJECT), `releasedAt`, `startedAt`, `completedAt`, `closedAt`, `idempotencyKey?` |
| **Snapshots** | `bomVersionId`, `routingVersionId` + snapshot tables |
| **Unique** | `tenantId+workOrderNo` |
| **Indexes** | status, dueDate, salesOrderId, finishedItemId |
| **Status enum** | DRAFT, READY, RELEASED, IN_PROGRESS, ON_HOLD, QC_PENDING, QC_HOLD, COMPLETED, CLOSED, CANCELLED |
| **Reuse** | New (maps FE WO) |
| **Risk** | High coupling to Inventory/Quality when those land — keep FKs nullable initially |

### 3.6 Snapshots & materials

| Model | Purpose |
|-------|---------|
| `ProductionOrderBomSnapshot` / lines | Frozen BOM at release |
| `ProductionOrderMaterial` | Requirement, reserved, issued, returned, shortageQty; links PR id later |
| `ProductionOrderStage` | Stage group instance on order |
| `ProductionOrderOperation` | Op instance; status; planned/actual times; qcRequired |

### 3.7 Execution & ledger

| Model | Purpose |
|-------|---------|
| `ProductionUpdate` | Daily / operator submission (good/rework/reject/scrap); `idempotencyKey` unique |
| `ProductionStageLedger` | Append-only stage qty movements (logical WIP) |
| `ProductionWipMovement` | Intent to move WIP / SFG — Inventory posts physical |
| `ProductionRuntimeChange` | BOM/routing/qty change request + approval state |
| `ProductionIssue` | Downtime / breakdown / material / quality issue; optional `maintenanceRequestId` |
| `ProductionActivity` | Immutable timeline |
| `ProductionOrderSplitLink` | Parent/child after split |
| `ProductionAccountingEvent` | Event store; `postedAt` null until mfg accounting; unique `idempotencyKey` |

### 3.8 Demand pegging

| Model | Purpose |
|-------|---------|
| `ProductionDemand` | From SO line / manual / stock; `requestedQty`, `convertedQty`, `remainingQty`, `status` |

Unique: prevent over-conversion via transactional remaining check + optional `@@unique` on open peg keys.

---

## 4. Reference-only (do not duplicate)

Quality Plan / Inspection / NCR · Inventory StockBalance / Movement / Reservation · Purchase Requisition / PO · Dispatch · GL Voucher · Customer / Vendor / Item / UOM / Warehouse · CostCentre · Project (until shared master)

Production stores **foreign keys and quantities of intent**, not balances or GL.

---

## 5. Tenant strategy

Every table: `tenantId` + `@@index([tenantId, deletedAt])` + `tenantActiveFilter()` in repos.  
Cross-tenant FK rejected. Unique codes scoped per tenant.

---

## 6. Transactions & idempotency (DB level)

| Operation | Requires `$transaction` | Idempotency |
|-----------|-------------------------|-------------|
| Release PO (snapshot) | Yes | release key |
| SO conversion | Yes (demand + PO) | convert key |
| Daily update | Yes (ledger + op qty) | `ProductionUpdate.idempotencyKey` |
| Material issue request | Yes with Inventory when available | issue key |
| FG receipt signal | Yes with Inventory | fg key |
| Split / close | Yes | close key |
| Accounting event write | Same TX as source | event key |

---

## 7. Migration risks

| Risk | Mitigation |
|------|------------|
| Dual FE BOM/routing data | No auto-import; Phase 1 greenfield masters |
| Soft `productionBomId` on Item | Migrate to FK in later phase |
| SO lines JSON | Peg by stable line `id` inside JSON until normalize |
| Inventory not ready | Nullable reservation/issue FKs; stage ledger alone for Phase 2 |
| Naming WorkOrder vs ProductionOrder | DTO alias `workOrderNo`; single table |
| Trailer-specific columns | Forbidden — use profile attributes / JSON `attributes` sparingly |

---

## 8. Deferred fields / models

- Full Plant master (use `plantCode` string)  
- Bin / heat (Inventory-owned later)  
- UOM conversion table (shared later)  
- Machine capacity calendars  
- MRP run tables  
- Manufacturing GL posting links (`postedVoucherId` nullable until accounting)  
- Employee HR master  

---

## 9. Model decision vs audit list

| Proposed | Decision |
|----------|----------|
| ManufacturingProfile | **New** |
| ManufacturingBom* | **New** (replace FE stores) |
| ManufacturingRouting* / StageGroup / Op / Dependency | **New** |
| ManufacturingWorkCentre | **New** |
| ManufacturingMachine | **New** or **Deferred** (Phase 1 optional) |
| ProductionOrder* | **New** |
| ProductionUpdate / StageLedger / WipMovement | **New** |
| ProductionRuntimeChange / Issue / Activity / SplitLink | **New** (Phase 5 for runtime) |
| ProductionAccountingEvent | **New** (persist only) |
| Inventory / Quality / Purchase docs | **Reference only** |
| Existing MasterItem BOM strings | **Extend** → real FKs later |
