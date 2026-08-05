# Phase 1.2 Implementation Report — Purchase Invoice

**Date:** 2026-08-05  
**Branch:** `fix/multi-uom-phase1`

## Current issue

`buildLines` computed `amount = baseQuantity × vendorRate` (e.g. 100 NOS × ₹80 = ₹8,000 instead of 5000 KG × ₹80 = ₹4,00,000).  
`evaluateMatching` used the same wrong basis for quantity and amount tolerance.

## Change made

- Invoice line amount: `lineAmountFromVendor(rate, vendorQty)` using `uomQuantitySnapshot` from dual-UOM snapshots.
- Three-way matching compares **commercial/vendor quantities** (`uomQuantitySnapshot` vs PO/GRN `uomQuantity` / `receivedUomQuantity`).
- Expected amount: `lineAmountFromVendor(poRate, expectedVendorQty)`.

## Files changed

- `backend/src/modules/purchase/invoices/purchase-invoice.service.ts`

## Tests passed

- `multi-uom-phase1-unit.test.ts` — invoice amount 5000×80 ≠ 100×80

## Remaining risks

- Manual invoice entry without PO/GRN still sends base `quantity` only; snapshot derivation must remain correct.
- Frontend invoice editor still single-qty display (Phase A UX).
