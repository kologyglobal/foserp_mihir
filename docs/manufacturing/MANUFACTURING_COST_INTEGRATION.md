# Manufacturing Cost Integration (Inventory)

> IV-MFG-1 · 2026-07-28

## Material

When material is issued/returned to a work order:

1. Inventory posts the movement and creates `InventoryCostEntry` (method-aware).
2. `calculateWorkOrderCost` prefers that cost entry:
   - `sourceEntityType = INVENTORY_COST_ENTRY`
   - `sourceEntityId = inventoryCostEntry.id`
   - `amount` / `rate` from `totalCost` / `unitCost`
3. If no cost entry exists (legacy/uncosted): fall back to `|movement.value|`, then `qty × standardRate` (provisional).

Manufacturing never walks FIFO layers or maintains a second average.

## Non-material components

Labour, machine, job work, overhead, scrap/rework remain Manufacturing policy-driven. They are **not** inventory valuation methods.

## FG

WO snapshot unit/total actual cost supplies FG receipt rate (`resolveFgReceiptRate`). Inventory Costing then valuates FG stock for subsequent issues/dispatch.

## Traceability

```text
WO → Inventory movement → InventoryCostEntry → WorkOrderCostEntry(MATERIAL)
     (+ FIFO layer consumptions / standard / serial-lot for display)
```

API: `GET …/manufacturing/work-orders/:id/cost-trace/:entryId`
