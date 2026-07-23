# GST tax resolution (masters → finance engine)

## Source of truth

| Layer | Responsibility |
|-------|----------------|
| **Tax masters** | `MasterGstGroup`, `MasterHsnCode`, `MasterGstRate` (CGST/SGST/IGST %, `dateFrom`/`dateTo`, `fromState`/`locationStateCode`, `applicableFor` SALES\|PURCHASE\|BOTH) |
| **Item** | Optional `hsnId` + `gstGroupId` → HSN → group → dated rate |
| **Finance engine** | `resolveLineGstFromMasters` + AR/AP `calculate*` (split/amounts via `gst-calculation` / vendor tax calculator) |
| **GL** | `DefaultAccountMapping` keys `GST_INPUT_*` / `GST_OUTPUT_*` |

## Resolve API

`GET /api/v1/t/:tenantSlug/masters/tax/resolve?applicableFor=SALES|PURCHASE&asOfDate=&fromState=&toState=&itemId=&hsnCode=&gstGroupId=`

Forms must use this (or AR/AP calculate/validate preview) — **do not hardcode 18% / 9+9 in transactional forms**.

## FE helpers

- `services/accounting/taxResolutionApi.ts` → `resolveGstTaxFromMasters`
- `utils/gstEngine.ts` → `computeGstFromTaxMaster` (API); `computeGst` remains demo-only
