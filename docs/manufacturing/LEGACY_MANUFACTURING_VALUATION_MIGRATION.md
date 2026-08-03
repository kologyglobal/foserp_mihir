# Legacy Manufacturing Valuation Migration

> IV-MFG-1 · 2026-07-28

## Problem

Two valuation enums existed:

| Enum | Values | Role |
|------|--------|------|
| `InventoryValuationMethod` | FIFO, MOVING_WEIGHTED_AVERAGE, STANDARD_COST, SPECIFIC_IDENTIFICATION | **Canonical** — used by `postStockMovement` |
| `ManufacturingInventoryValuationMethod` | MOVING_AVERAGE, FIFO | **Legacy** — stored on `ManufacturingCostingPolicy`, **not used** for valuation |

## Mapping

| Manufacturing (legacy) | Inventory (canonical) |
|------------------------|-------------------------|
| `MOVING_AVERAGE` | `MOVING_WEIGHTED_AVERAGE` |
| `FIFO` | `FIFO` |

Helper: `mapLegacyManufacturingValuationMethod` in `inventory-costing.helpers.ts`.

## Policy (IV-MFG-1)

1. **Do not drop** the Prisma enum or `inventoryValuationMethod` column.
2. Mark field **@deprecated** in schema comments / Zod / policy service.
3. New features must call Inventory Costing (`getEffectiveValuationMethod` / cost entries).
4. API may still accept the legacy field for backward compatibility; values are **ignored** for cost math.
5. UI should not expose manufacturing inventory valuation method as a control.
6. Drop schema only in a **future explicit migration** after all readers are gone and data is verified.

## Safe removal checklist (later phase)

- [ ] No API clients send/require `inventoryValuationMethod` on costing policy
- [ ] No reports filter on the column
- [ ] Adapter tests green
- [ ] Explicit Prisma migration removes column + enum
- [ ] Changelog notes irreversible migration

**Recommendation:** Keep through next controlled UAT; remove earliest in **IV-MFG-2** after golden-path sign-off.
