# Inventory ↔ Manufacturing Costing Audit (IV-MFG-1)

> Audited against codebase: **2026-07-28**. Code wins over older docs.  
> **No code was modified before this audit was written.**

---

## Executive verdict

| Authority | Status |
|-----------|--------|
| **Quantity SoT** | `InventoryStockMovement` + `InventoryStockBalance` |
| **Inventory valuation SoT** | Inventory Costing engine inside `postStockMovement` (`InventoryValuationMethod` × 4) |
| **Manufacturing material cost today** | Reads `|InventoryStockMovement.value|` — does **not** re-run FIFO/MA/Standard/Specific |
| **Manufacturing valuation enum** | `ManufacturingInventoryValuationMethod` (`MOVING_AVERAGE` \| `FIFO`) — **persisted, unused at runtime** |
| **Gap vs IV-MFG-1 target** | WO material must prefer **`InventoryCostEntry`** as authoritative cost; deprecate mfg valuation enum; cost-trace APIs |

---

## 1. Current quantity SoT

| Artifact | Role |
|----------|------|
| `InventoryStockMovement` | Immutable stock event (qty, warehouse, reference, optional `workOrderId`) |
| `InventoryStockBalance` | On-hand qty + `avgRate` / `stockValue` |
| Serial / lot tables | Identity tracking when applicable |

Manufacturing material issue/return and FG receipt always go through inventory posting (`postIssueToWorkOrder` / `postReturnFromWorkOrder` / `postFgReceipt` → `postStockMovement`). Manufacturing does **not** maintain a parallel qty ledger for stocked items.

---

## 2. Current valuation SoT

**Canonical enum** (`schema.prisma`):

```text
InventoryValuationMethod =
  FIFO
  | MOVING_WEIGHTED_AVERAGE
  | STANDARD_COST
  | SPECIFIC_IDENTIFICATION
```

**Effective method resolution** (tenant-only today):

| Function | File |
|----------|------|
| `mapDefaultCostingMethodToValuationMethod` | `backend/src/modules/inventory/costing/inventory-costing.helpers.ts` |
| `resolveValuationMethodInTx(tx, tenantId)` | same |

Source: `InventorySettings.settings.general.defaultCostingMethod` ∈ `fifo | average | standard | specific`.

**No item-level / legal-entity-level override** in backend. No `getEffectiveValuationMethod({ itemId, … })` export yet (alias of tenant resolver is the required IV-MFG-1 surface).

**Ledger written in same TX as movement:**

| Model | Purpose |
|-------|---------|
| `InventoryCostEntry` | 1:1 with movement (`tenantId`+`inventoryMovementId`) |
| `InventoryCostLayer` + `InventoryCostLayerConsumption` | FIFO / Specific |
| `InventoryItemStandardCostVersion` | Standard |
| `InventoryCostVariance` | Standard (and related) variances |
| `InventoryValuationMethodChange` | Method-change audit |

---

## 3. Every place Inventory determines cost

| Path | Service | Behaviour |
|------|---------|-----------|
| All stock postings | `stock-posting.service.ts` → `postStockMovement` | Resolves method; stamps `rate`/`value`; layers; `recordInventoryCostEntryInTx` |
| GRN inward | `purchase-inventory-posting.ts` → `postGrnStockInward` | Passes GRN line rate; Inventory Costing owns valuation |
| WO issue / return | `movement.service.ts` wrappers | Inventory Costing owns issue/return valuation (incl. FIFO restore) |
| FG receipt | `movement.service.ts` → `resolveFgReceiptRate` | Rate from WO snapshot / standard setting, then Inventory Costing receipt path |
| Method change | `costing.service.ts` + `fifo-opening-stock-migration.service.ts` | Settings update + optional opening layers |
| Returns | `fifo-return-restore.service.ts` | Layer restore for FIFO/Specific |

---

## 4. Every place Manufacturing determines / consumes cost

| Concern | Where | Determines inventory valuation? |
|---------|-------|----------------------------------|
| Material actual | `work-order-cost.service.ts` | **No** — sums `|movement.value|` (fallback `qty × item.standardRate` if value ≤ 0) |
| Labour / machine | Daily production × rate sources from **costing policy** | N/A (not inventory) |
| Job work | Linked invoice / provisional | N/A |
| Overhead | Policy overhead method | N/A |
| Scrap / rework | Allocated from unit actual | N/A |
| FG rate into inventory | `resolveFgReceiptRate` from WO snapshot | Supplies production cost **into** inventory; Inventory then owns FG stock valuation |
| Accounting events | Material issue amount = `|movement.value|` | Consumer of stamped value |

**`ManufacturingCostingPolicy.inventoryValuationMethod`:** stored via Zod/CRUD; **never read** for issue math or WO material calculation.

**`materialValuationSource`:** default `MOVEMENT_UNIT_COST`; **ignored** by calculator (always movement value + provisional fallback).

---

## 5. Duplicate valuation calculations

| Location | Risk |
|----------|------|
| Manufacturing FIFO/MA engine | **None** — no second layer walk |
| `work-order-cost` provisional `standardRate` when `movement.value = 0` | **Re-rates** material outside Inventory Cost Entry (provisional) |
| Cost preview (`manufacturing-cost-preview`) | Parallel sum of movement values (read-only) |
| FG accounting proportional snapshot vs movement.value | Two FG amount paths for accounting vs inventory stamp |
| Legacy mfg enum vs inventory settings | **Config duplicate** (misleading UI/API field), not runtime duplicate math |

---

## 6. Legacy enum consumers

```text
ManufacturingInventoryValuationMethod = MOVING_AVERAGE | FIFO
```

| Consumer | Usage |
|----------|-------|
| `ManufacturingCostingPolicy.inventoryValuationMethod` | DB column, default `MOVING_AVERAGE` |
| `costing.schemas.ts` | Accept on create/update |
| `BUILT_IN_COSTING_POLICY` | Hardcoded `'MOVING_AVERAGE'` |
| Frontend `ManufacturingCostingPolicy` type | **Omits** field |
| Stock posting / WO cost | **Does not use** |

**Map to canonical:**

| Legacy | Inventory |
|--------|-----------|
| `MOVING_AVERAGE` | `MOVING_WEIGHTED_AVERAGE` |
| `FIFO` | `FIFO` |

Do **not** drop DB enum/column in IV-MFG-1.

---

## 7. Purchase costing dependencies

```text
PO → GRN → postGrnStockInward → postStockMovement → InventoryCostEntry [/ layers]
```

Purchase does not implement FIFO/MA. Rate = GRN line rate (acquisition input).

**Deferred (document only):**

- Invoice price difference vs GRN
- Freight / landed cost roll-up
- Retroactive revaluation of consumed stock / WO material
- Purchase credit note / return cost unwind beyond existing inventory reverse paths

---

## 8. FG valuation path

```text
WO cost calculate → WorkOrderCostSnapshot (unitActualCost)
  → FG receipt (no explicit rate) → resolveFgReceiptRate
  → postStockMovement(FG_RECEIPT) → InventoryCostEntry for FG
```

Manufacturing supplies **production cost basis**. Inventory Costing applies the tenant FG valuation method for subsequent relief (dispatch/COGS).

---

## 9. Accounting dependencies

```text
Operational movement → Inventory Costing → (optional) inventory accounting events
Material issue → ProductionAccountingEvent(MATERIAL_ISSUED) amount = |movement.value|
Absorption / financial close → posting orchestrator → central GL (when MANUFACTURING_ACCOUNTING enabled)
```

Readiness gates (WIP/FG/variance mappings, open period, failed events, inventory reconcile sign-off, pilot finance) must remain. Live Manufacturing Accounting GL remains **blocked** until costing UAT per `REMAINING_WORK.md`.

---

## 10. Migration risk

| Risk | Mitigation |
|------|------------|
| Dropping mfg enum | **Do not** — mark legacy + adapter |
| Changing WO material source key to `INVENTORY_COST_ENTRY` | Recalculate cleans orphan MATERIAL rows keyed by movement |
| Historical movements with value=0 and no cost entry | Keep provisional fallback; warn |
| Docs claiming “no FIFO engine” | Superseded by Phase A–C (2026-07-27) |
| Enabling manufacturing GL company-wide | Out of scope; keep flag + readiness |

---

## Target architecture (after IV-MFG-1)

```text
Purchase / Opening / Adjustment
        ↓
Inventory Stock Movement
        ↓
Inventory Costing Engine   ← InventoryValuationMethod (canonical)
        ↓
Inventory Cost Entry / Layer
        ↓
Material Issue to WO
        ↓
WorkOrderCostEntry (MATERIAL) ← source = INVENTORY_COST_ENTRY
        ↓
WO Cost Snapshot (+ labour / machine / JW / OH / scrap)
        ↓
FG Receipt (production cost from WO) → Inventory Costing → FG valuation
        ↓
Dispatch / future COGS (Inventory-owned)
```

---

## Implementation backlog derived from this audit

1. Mark `ManufacturingInventoryValuationMethod` legacy; map to inventory enum; stop new feature use.
2. Prefer `InventoryCostEntry` in `calculateWorkOrderCost` material loop.
3. Expose `getEffectiveValuationMethod` (wrap `resolveValuationMethodInTx`).
4. Cost-trace API + WO Costing UI material table / drawer.
5. Item costing summary read API.
6. Refresh docs (`MATERIAL_COSTING_RULES`, architecture, migration).
7. Regression: inventory costing + manufacturing cost tests.

**Non-goals (this phase):** new valuation methods, LIFO, landed-cost rewrite, company-wide mfg GL enablement, COGS redesign.
