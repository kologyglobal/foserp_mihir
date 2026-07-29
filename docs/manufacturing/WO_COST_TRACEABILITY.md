# Work Order Cost Traceability

> IV-MFG-1 · 2026-07-28

## Material line → inventory

| Field | Source |
|-------|--------|
| Quantity / rate / amount | `InventoryCostEntry` (preferred) |
| Valuation method | `InventoryCostEntry.valuationMethod` |
| Movement | `InventoryCostEntry.inventoryMovementId` |
| FIFO layers | `InventoryCostLayerConsumption` for issue entry |
| Specific | `lotId` / `serialId` on cost entry |
| Standard | Active standard version + `InventoryCostVariance` when present |

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/manufacturing/work-orders/:id/cost-details` | `manufacturing.cost.view` |
| GET | `/manufacturing/work-orders/:id/cost-trace/:entryId` | `manufacturing.cost.view` |
| GET | `/inventory/costing/cost-entries?workOrderId=` | `inventory.view_cost` (etc.) |

## UI

Work Order → Costing tab: material table with valuation method + “Trace” drawer (no React-side cost recalculation).
