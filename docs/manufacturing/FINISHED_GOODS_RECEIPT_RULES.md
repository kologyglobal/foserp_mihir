# Finished Goods Receipt Rules (Phase 7A4)

**Model:** `ProductionFinishedGoodsReceipt`  
**APIs:** eligibility, preview, draft, post under work order; `GET /manufacturing/fg-receipts/:receiptId`

## Eligibility (server)

```
Eligible = max(0, completedGoodQuantity − netReceived)
netReceived = Σ (acceptedQuantity − reversedQuantity) for POSTED | PARTIALLY_REVERSED
```

- Do **not** use planned quantity alone.  
- Quality blockers → eligible unrestricted qty = 0 (hold/quarantine path deferred to warehouse mapping).  
- Partial receipts allowed; WO may stay In Progress.  
- Idempotency key unique per tenant.  
- Posted receipt immutable; reverse via Phase 5C (`manufacturing.fg_receipt.reverse`).

## Tracking

Profile flags `batchTrackingRequired` / `serialTrackingRequired`. Receipt stores `batchOrLotNumber` and `serialNumbersJson`. Full `InventoryLot` / `InventorySerial` masters deferred.

## Accounting

Phase 6B manufacturing accounting flag remains **off by default**. Physical FG post works without GL.
