# Dispatch Quantity Reconciliation

Quantities use `roundQty` / decimal-safe helpers (`dispatch-qty.ts`). Do not use raw floating-point for equality.

## Outbound line position (readiness)

| Field | Meaning |
|-------|---------|
| requestedQty | Sum of outbound line quantities |
| reservedQty | Net reserved for outbound |
| pickedQty | Sum pick line `pickedQuantity` |
| packedQty | Sum package line `packedQuantity` |
| challanQty | Issued challan `totalQuantity` |
| postingQty | Current draft quantity to post |
| reversibleQty | Full header qty when CONFIRMED |

## Partial dispatch

Multiple outbound documents may fulfil one SO line. Each posting reconciles **its own** reserved/picked/packed/challan set.
