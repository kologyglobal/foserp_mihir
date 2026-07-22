# Finished Goods Capitalisation Rules

Source: `backend/src/modules/manufacturing/fg-receipts/fg-receipt.service.ts` (posting section).

When a finished-goods receipt is posted, the accumulated work-order cost is capitalised into finished goods **proportionally by accepted good quantity**, with a cumulative cap so total capitalised never exceeds accumulated cost.

---

## Allocation

On FG receipt post, if a latest `WorkOrderCostSnapshot` exists:

```
accumulatedCost      = snapshot.totalActualCost
alreadyCapitalised   = Σ FINISHED_GOODS_RECEIVED amount (status ≠ REVERSED) for the WO
remaining            = max(0, accumulatedCost − alreadyCapitalised)
proportional         = completedGoodQuantity > 0
                         ? accumulatedCost × receiptQuantity / completedGoodQuantity
                         : 0
accountingAmount     = max(0, min(proportional, remaining))
```

`allocationBasis = WORK_ORDER_COST_PROPORTIONAL`. The payload records `snapshotId`, `snapshotVersion`, `accumulatedEligibleActualCost`, `completedGoodQuantity`, `receiptQuantity`, `cumulativeCapitalisedBefore`, `allocatedAmount`, and `zeroDenominatorGuarded` (true when `completedGoodQuantity ≤ 0`).

### Fallback (no snapshot)

If no cost snapshot exists yet, `accountingAmount = |movement.value|` and `allocationBasis = INVENTORY_MOVEMENT_VALUE_FALLBACK`.

---

## Cumulative cap

The `min(proportional, remaining)` guard ensures the sum of all FG capitalisations for a work order never exceeds its accumulated actual cost, even across multiple partial receipts or after recalculations. `max(0, …)` prevents negative capitalisation.

---

## Event recorded

`tryRecordManufacturingAccountingEvent` with:

- `eventType = FINISHED_GOODS_RECEIVED`
- `idempotencyKey = PROD_FG_RCV:<movementId>:V1` (idempotent per FG movement)
- `sourceDocumentType = INVENTORY_STOCK_MOVEMENT`, `sourceDocumentId = movement.id`
- `quantity = receiptQuantity`, `amount = accountingAmount`, `payloadJson = allocation payload`

GL effect when the flag is on: **debit `FINISHED_GOODS_INVENTORY`, credit `WIP_INVENTORY`**. With the flag off the event is stored as `SKIPPED_FLAG_OFF`. `tryRecord…` skips silently when the tenant has no legal entity, so shop-floor FG receipt is never blocked by missing finance setup.

---

## Reversal

Reversing an FG receipt (Phase 5C correction) records a proportional `MANUFACTURING_REVERSAL` event (debit `WIP_INVENTORY`, credit `FINISHED_GOODS_INVENTORY`) — see `MANUFACTURING_REVERSAL_ACCOUNTING.md`. Reversed amounts are excluded from `alreadyCapitalised` for future allocations.
