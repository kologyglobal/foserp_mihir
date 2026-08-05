# Commercial HSN/GST Implementation Notes

**Date:** 2026-08-05  
**Engine reused:** `resolveGstTax` (BE) + `resolveCommercialLineTax` (FE) — no second tax engine.

## What shipped

### Backend
- Extended `SalesOrderLineDto` with HSN + scheme + component rates/amounts (JSON lines).
- `salesOrderLineSchema` accepts optional snapshot fields; `taxPct` no longer defaults to inventing 18%.
- `buildLinesFromInput` persists HSN and computes CGST/SGST/UTGST/IGST amounts from scheme.
- **SO header GST fields** (migration `20260805310000_so_place_of_supply_tax_header`):
  `placeOfSupply`, `placeOfSupplyStateCode`, `placeOfSupplySource`, `placeOfSupplyOverride`,
  `placeOfSupplyOverrideReason`, `supplierStateCode`, `supplyType`, `gstScheme`, component totals, cess.
- `resolveCommercialPlaceOfSupply` / `resolveCommercialSupplyType` (`commercial-supply-context.ts`).
- SO create/update/Q→SO convert resolve header PoS + supply type; override requires
  `crm.commercial.tax_place_override` + reason → audit `PLACE_OF_SUPPLY_OVERRIDE`.
- MasterGstRate **utgst** + **cess** columns; `applySchemeToMasterRate` sets `utgst_pair` for UT intra.

### Frontend
- `CommercialGstSupplyPanel` — auto PoS, **read-only supply type**, authorised override checkbox + reason.
- Wired on SO create + edit; Money-In Invoice + Credit Note supply type is display-only (derived).
- `commercialSupplyContext.ts` mirrors BE pure resolution for previews.

## Verify

1. Create SO: customer MH, company GJ → supply type Inter-state; header stored on save.
2. Override PoS with permission + reason → audit log action `PLACE_OF_SUPPLY_OVERRIDE`.
3. UT supplier+PoS (Delhi 07) → scheme `utgst_pair`.
4. Unit tests: `commercial-supply-pos-conversion.test.ts`, `commercial-conversion-chain.test.ts`,
   `sales-order-line-tax-snapshot.test.ts`.

See `docs/COMMERCIAL_HSN_GST_AUDIT.md` and `docs/COMMERCIAL_HSN_GST_UAT.md`.
