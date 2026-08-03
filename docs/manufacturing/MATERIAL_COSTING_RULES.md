# Material Costing Rules

Source: `backend/src/modules/manufacturing/costing/work-order-cost.service.ts` (material section).  
Architecture: [INVENTORY_VALUATION_ARCHITECTURE.md](../inventory/INVENTORY_VALUATION_ARCHITECTURE.md) · IV-MFG-1.

Material actual cost is derived from **Inventory Cost Entries** posted when stock moves against the work order. Manufacturing does **not** re-value stock (no FIFO/MA walk in Manufacturing).

---

## Preferred source: Inventory Cost Entry

Movements read: `InventoryStockMovement` where `workOrderId = <WO>` and `referenceType ∈ {ISSUE_TO_WO, RETURN_FROM_WO}`, including related `costEntries` (1:1).

For each movement:

- `direction = RETURN_FROM_WO ? −1 : +1`
- If an `InventoryCostEntry` exists:
  - `amount = |costEntry.totalCost|`
  - `rate = costEntry.unitCost`
  - `sourceEntityType = INVENTORY_COST_ENTRY`
  - `sourceEntityId = costEntry.id`
  - not provisional
- Else (legacy / uncosted):
  - Prefer `|movement.value|`
  - If value ≤ 0 → `qty × item.standardRate` (provisional)
  - `sourceEntityType = INVENTORY_STOCK_MOVEMENT`
  - Warning `MISSING_INVENTORY_COST_ENTRY` or provisional/incomplete material rate

Actual material = **Σ issued − Σ returned** using those amounts.

Inventory Costing (`postStockMovement`) is the valuation engine for FIFO / Moving Weighted Average / Standard / Specific Identification.

---

## Cost entry written

One `WorkOrderCostEntry` per movement:

- Prefer `INVENTORY_COST_ENTRY` source key when cost entry exists
- Recalculation deletes orphan MATERIAL rows not in the new key set, then upserts

---

## No historical rewrite

- Manufacturing never back-writes inventory movement or cost entry amounts.
- Corrections go through inventory reverse/correct → recalculate WO cost.

---

## Legacy policy field

`ManufacturingCostingPolicy.inventoryValuationMethod` is **deprecated and unused**. See [LEGACY_MANUFACTURING_VALUATION_MIGRATION.md](./LEGACY_MANUFACTURING_VALUATION_MIGRATION.md).
