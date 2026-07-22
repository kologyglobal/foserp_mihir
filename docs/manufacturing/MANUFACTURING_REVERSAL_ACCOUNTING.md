# Manufacturing Reversal Accounting

Source: `backend/src/modules/manufacturing/corrections/handlers/fg-correction.handler.ts`, `accounting/manufacturing-accounting-builder.service.ts`.

Manufacturing corrections use the **Phase 5C compensating-transaction pattern** (ADR-036): posted documents are never edited or deleted. When a correction affects a capitalised cost, a `MANUFACTURING_REVERSAL` accounting event is recorded so the GL can be un-wound through the same posting engine.

---

## Phase 5C linkage

- FG-receipt reversal is a Phase 5C correction: it posts a **compensating `ISSUE`** stock movement out of the FG warehouse (`REV-FG-<movementNumber>`), leaving the original `FG_RECEIPT` movement intact, and updates `ProductionFinishedGoodsReceipt.reversedQuantity` + status (`PARTIALLY_REVERSED` / `FULLY_REVERSED`).
- The correction is quantity-capped by remaining reversible quantity (`acceptedQuantity − reversedQuantity`); it is `HIGH` risk and approval-required.
- Inventory quantity is corrected by the compensating movement; the GL is un-wound by a separate accounting event (below), consistent with 5C's "inventory correction ≠ automatic finance reversal" rule.

---

## The `MANUFACTURING_REVERSAL` event

If an original `FINISHED_GOODS_RECEIVED` accounting event exists for the reversed FG movement, the handler records a proportional reversal:

```
originalQty        = |originalEvent.quantity|
proportionalAmount = originalQty > 0
                       ? |originalEvent.amount| × reversedQty / originalQty
                       : 0
```

When `proportionalAmount > 0`, a `ProductionAccountingEvent` is created:

- `eventType = MANUFACTURING_REVERSAL`, `status = RECORDED`
- `idempotencyKey = P7E_FG_REV:<reversalMovementId>:V1`
- `sourceDocumentType = INVENTORY_STOCK_MOVEMENT`, `sourceDocumentId = <compensating movement id>`
- `amount = proportionalAmount`
- `payloadJson`: `originalEventId`, `originalMovementId`, `reversedQuantity`, and the mapping keys **`debitMappingKey = WIP_INVENTORY`**, **`creditMappingKey = FINISHED_GOODS_INVENTORY`**

---

## Posting a reversal

`MANUFACTURING_REVERSAL` is MappingReady. The builder reads `debitMappingKey` / `creditMappingKey` from the payload (throwing if either is missing) and posts a balanced SYSTEM voucher via `post()`. For an FG reversal this is the inverse of capitalisation — **debit `WIP_INVENTORY`, credit `FINISHED_GOODS_INVENTORY`** — moving cost back into WIP.

The event is recorded `RECORDED` (not auto-posted), so it follows the same manual validate → post → retry lifecycle as other events (see `MANUFACTURING_POSTING_EVENTS.md`).

---

## Effect on downstream figures

- Reversed FG amounts are excluded from `alreadyCapitalised` (`status ≠ REVERSED`) so future FG capitalisation allocations are correct.
- WIP value (`cumulative actual − FG capitalised`) rises back as capitalised FG is reversed.

> Only the FG-receipt reversal path currently emits `MANUFACTURING_REVERSAL`. There is no automatic cascade reversal of absorption or variance events; those would be corrected by recalculation / a new delta event.
