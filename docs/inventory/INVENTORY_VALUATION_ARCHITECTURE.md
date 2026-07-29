# Inventory Valuation Architecture (canonical)

> IV-MFG-1 · 2026-07-28 · See also [INVENTORY_MANUFACTURING_COSTING_AUDIT.md](./INVENTORY_MANUFACTURING_COSTING_AUDIT.md)

## Rule

**Inventory Costing** is the sole authority for inventory quantity valuation.

**Manufacturing Costing** consumes posted inventory costs for material and accumulates production costs (labour, machine, job work, overhead, scrap/rework, variance).

```text
Purchase / Opening / Adjustment
  → InventoryStockMovement
  → Inventory Costing Engine
  → InventoryCostEntry [/ Layer / Variance]
  → Material issue to WO
  → WorkOrderCostEntry (MATERIAL) from InventoryCostEntry
  → WO Cost Snapshot
  → FG receipt (production cost basis)
  → Inventory Costing (FG stock)
  → Dispatch / COGS (Inventory-owned)
```

## Canonical methods

`InventoryValuationMethod`:

| Method | Inventory behaviour | Manufacturing material |
|--------|---------------------|------------------------|
| `FIFO` | Consume oldest open layers | Exact posted issue total |
| `MOVING_WEIGHTED_AVERAGE` | Issue at balance avgRate | Exact posted issue total |
| `STANDARD_COST` | Inventory at approved standard; variance separate | Exact posted issue total (fail-closed if no standard) |
| `SPECIFIC_IDENTIFICATION` | Serial/lot/pool layers | Exact identity cost |

Manufacturing **must not** set `materialValuationMethod = FIFO` (or any inventory method). That decision lives in Inventory settings.

## Effective method

```ts
getEffectiveValuationMethod({ tenantId })
// → { method, source: 'TENANT_INVENTORY_SETTINGS', … }
```

Today resolution is **tenant** `InventorySettings.general.defaultCostingMethod` only (no item override).

## Separation of concerns

| Question | Owner |
|----------|-------|
| What is this stock worth? | Inventory Costing |
| What did this WO cost? | Manufacturing (material from Inventory + conversion costs) |
| What GL to post? | Accounting posting engine + mappings |

## Legacy

`ManufacturingInventoryValuationMethod` (`MOVING_AVERAGE` \| `FIFO`) on `ManufacturingCostingPolicy` is **legacy / unused**. See [LEGACY_MANUFACTURING_VALUATION_MIGRATION.md](../manufacturing/LEGACY_MANUFACTURING_VALUATION_MIGRATION.md).
