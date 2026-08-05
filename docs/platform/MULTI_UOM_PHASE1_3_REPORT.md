# Phase 1.3 Implementation Report — GRN Frontend

**Date:** 2026-08-05  
**Branch:** `fix/multi-uom-phase1`

## Current issue

GRN editor seeded base pending qty as purchase qty, and `onChange` set `receivedQty = receivedUomQty`, causing under-receipt when backend divided by factor. Save payload could send base qty as `receivedUomQuantity`.

## Change made

- `grnLineDraft.ts`: track `uomConversionFactor`, `baseUom`, `pendingUomQty`, `orderedUomQty`; seed purchase open qty in `receivedUomQty`, base in `receivedQty`.
- `GrnEditorPage`: user edits purchase qty only; `receivedQty = purchaseQtyToBaseQty(v, factor)`; show base qty sub-line.
- `buildInput` / `GrnInput`: pass both `receivedUomQty` and `receivedQty`.
- `purchaseMappers.mapDomainGrnInputToApiPayload`: prefer explicit `receivedUomQty` (no base→purchase fallback).
- `GrnDetailPage`: dual display on Received column (vendor + stock qty).

## Files changed

- `frontend/src/modules/purchase/grnLineDraft.ts`
- `frontend/src/modules/purchase/GrnEditorPage.tsx`
- `frontend/src/modules/purchase/GrnDetailPage.tsx`
- `frontend/src/services/purchase/purchaseMappers.ts`

## Tests passed

- Unit: GRN 5100 KG → 102 NOS, partial 4500→90, excess 5300→106 in `multi-uom-phase1-unit.test.ts`
- Manual QA required on GRN editor (API mode)

## Remaining risks

- Demo mode (`VITE_USE_API=false`) not updated (explicitly out of scope).
- Accepted/rejected qty still edited in base UOM (backend semantics); label clarity Phase A.
