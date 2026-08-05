# Phase 1.1 Implementation Report — Comparison → PO

**Date:** 2026-08-05  
**Branch:** `fix/multi-uom-phase1`

## Current issue

`createPurchaseOrderFromComparison` wrote VQ `quantity` directly to PO `quantity` (base/stock field) without `uomQuantity`, `uomConversionFactor`, or `unitCostPrimary`. For KG→NOS items, 5000 KG became 5000 NOS.

## Change made

- Exported `preparePurchaseOrderLinesForCreate()` and `computePurchaseOrderTotals()` from `purchase-order.service.ts` — same pipeline as manual PO create.
- Comparison → PO maps VQ lines with **`uomQuantity = line.quantity`** (commercial/vendor qty per approved semantics).
- PO create uses normalized lines with dual qty + factor snapshot; totals recalculated from normalized line amounts.

## Files changed

- `backend/src/modules/purchase/orders/purchase-order.service.ts`
- `backend/src/modules/purchase/comparisons/comparison.service.ts`

## Tests passed

- Unit math covered in `multi-uom-phase1-unit.test.ts` (commercial 5000 KG → 100 NOS)
- Existing `purchase-module-coverage.test.ts` RFQ path should still pass (factor-1 test items)

## Remaining risks

- VQ lines without `itemId` / UOM mapping still fail at enrichment (expected).
- VQ `amount` on quotation header may differ slightly from recalculated PO subtotal (PO line amounts are authoritative).
