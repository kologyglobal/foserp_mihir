# Commercial HSN/GST UI/UX UAT Results

**Date:** 2026-08-05T09:26:57.084Z
**Runner:** scripts/test-uat-commercial-hsn-gst-ui.ts

| Result | Count |
|--------|------:|
| PASS | 23 |
| FAIL | 1 |
| Total | 24 |

## Cases

| ID | Area | Result | Label | Detail |
|----|------|--------|-------|--------|
| UI-01 | Supply panel | PASS | CommercialGstSupplyPanel: supply type is Input readOnly (not editable Select) |  |
| UI-02 | Supply panel | PASS | Authorised override gated by crm.commercial.tax_place_override + reason field |  |
| UI-03 | SO forms | PASS | SO Create + Edit wire CommercialGstSupplyPanel |  |
| UI-04 | SO forms | PASS | SO Create Product grid has HSN/SAC column + tax resolve on item pick |  |
| UI-05 | SO 360 | PASS | Order lines show HSN + scheme + component breakout helpers |  |
| UI-06 | Proforma | PASS | Proforma form has GST supply panel |  |
| UI-07 | Tax invoice | PASS | CRM TI form has supply panel + HSN + Scheme columns + master tax resolve |  |
| UI-08 | Money-In | PASS | AR Invoice + Credit Note supply type are display-only (no free-pick register Select) |  |
| UI-09 | Tax resolve | PASS | FE resolveCommercialLineTax swallows API errors (no uncaught throw) |  |
| UI-10 | No silent 18% | PASS | Tax invoice blank line taxPct starts at 0; commercial tax never invents 18 in snapshot helpers |  |
| UX-01 | PoS auto | PASS | Goods prefer ship-to → Maharashtra (27) | source=SHIP_TO code=27 |
| UX-02 | PoS override | PASS | Override to Gujarat code 24 |  |
| UX-03 | Supply type | PASS | GJ supplier + MH PoS → Inter-state / IGST | Inter-state |
| UX-04 | Supply type | PASS | Delhi intra → CGST+UTGST scheme | CGST + UTGST |
| UX-05 | Supply type | PASS | Missing PoS → Unresolved (UX warning path) |  |
| UX-06 | Supply type | PASS | MH+MH → Intra CGST+SGST |  |
| BE-01 | Unit tests | PASS | Commercial supply + conversion + SO tax snapshot tests | 13 tests |
| LIVE-00 | Live API | PASS | Login ok | admin@vasant-trailers.com (live) |
| LIVE-01 | Permissions | FAIL | Session has tax_place_override or tenant.manage (override chrome) | none (live) |
| LIVE-02 | GST rates master | PASS | GET masters/gst-rates returns 200 (utgst/cess columns exist) | HTTP 200 (live) |
| LIVE-03 | Sales orders | PASS | GET crm/sales-orders returns 200 (placeOfSupply columns exist) | HTTP 200 (live) |
| LIVE-04 | Tax resolve | PASS | GET masters/tax/resolve accepts request (no reverseCharge Zod 500) | resolved=true scheme=cgst_sgst rate=18 (live) |
| LIVE-05 | Tax resolve | PASS | MH→GJ resolve returns (prefer igst when rate found) | scheme=igst resolved=true (live) |
| LIVE-06 | SO DTO | PASS | List DTO exposes placeOfSupply / supplyType fields (null ok for legacy rows) | keys: gstAmount, placeOfSupply, placeOfSupplyStateCode, placeOfSupplySource, placeOfSupplyOverride, placeOfSupplyOverrideReason, supplyType, gstScheme, cgstAmount, sgstAmount, utgstAmount, igstAmount (live) |

## Manual UX still recommended

1. Open SO Create — verify GST supply strip above commercial, HSN column after item pick.
2. Tax Invoice New — supply panel + scheme after item pick.
3. Money-In Invoice — supply type shows Intra/Inter without dropdown.
4. Override PoS with reason (admin) — save and confirm audit if available.
