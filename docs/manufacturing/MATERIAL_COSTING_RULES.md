# Material Costing Rules

Source: `backend/src/modules/manufacturing/costing/work-order-cost.service.ts` (material section), `accounting/manufacturing-cost-preview.service.ts`.

Material actual cost is derived from **inventory stock movements** already recorded against the work order. Manufacturing does not re-value stock; it reads the value the inventory movement carried.

---

## Movement value is the basis

Movements read: `InventoryStockMovement` where `workOrderId = <WO>` and `referenceType ∈ {ISSUE_TO_WO, RETURN_FROM_WO}`, ordered by `createdAt asc`.

For each movement:

- `direction = RETURN_FROM_WO ? −1 : +1`
- `movementValue = |movement.value|`
- Actual material cost accumulates `direction × amount`.

So actual material = **Σ issued value − Σ returned value**, using the value stamped on each movement.

> There is **no moving-average, FIFO, or standard-cost revaluation engine** in inventory. Whatever `InventoryStockMovement.value` holds is taken as-is.

---

## Provisional fallback (value = 0)

Inventory valuation is still thin, so movements often carry `value = 0`. When `movementValue ≤ 0`:

- `fallback = |quantity| × item.standardRate`
- `amount = movementValue > 0 ? movementValue : fallback`
- The entry is marked `provisional = true` and the fallback amount is added to the snapshot's `provisionalCost`.

Warning raised depends on whether a usable standard rate exists:

| Condition | Warning | Completeness effect |
|-----------|---------|---------------------|
| `item.standardRate > 0` | `PROVISIONAL_MATERIAL_RATE:<movementId>` | contributes to `COMPLETE_WITH_PROVISIONAL` |
| `item.standardRate ≤ 0` | `INCOMPLETE_MATERIAL_RATE:<itemId>` | forces `INCOMPLETE_MATERIAL_RATE` |

If the movement value is present (> 0) the entry is **not** provisional.

---

## Cost entry written

One `WorkOrderCostEntry` per movement:

- `costCategory = MATERIAL`, `sourceEntityType = INVENTORY_STOCK_MOVEMENT`, `sourceEntityId = movement.id`
- `quantity = direction × |movement.quantity|`
- `rate = amount / |quantity|` (or amount when quantity is 0)
- `amount = direction × amount`
- `provisional` per the rule above

Upsert key `(tenantId, MATERIAL, INVENTORY_STOCK_MOVEMENT, movementId)` — recalculation refreshes, never duplicates.

---

## No historical rewrite

- Manufacturing **never** back-writes `InventoryStockMovement.value`. If a movement was posted at 0, the fallback is applied **only** inside the cost snapshot; the underlying inventory record is untouched.
- When inventory valuation later improves, the next recalculation naturally picks up the real movement value and drops the provisional flag — **no migration or rewrite of past movements**.
- Planned material (BOM snapshot × `standardRate`) is informational; it does not feed the provisional/actual figures.

---

## Preview endpoint

`GET /manufacturing/work-orders/:id/cost-preview` (in the accounting module) sums `ISSUE_TO_WO` / `RETURN_FROM_WO` / `FG_RECEIPT` movement values directly and returns `estimatedTotalCost = net material value`, with an explicit note: *"Cost preview uses inventory movement value/rate (often zero until valuation rules mature)."* It requires no feature flag.
