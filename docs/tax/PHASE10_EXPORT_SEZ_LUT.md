# Phase 10 — Export / SEZ / LUT

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Exit label candidacy:** **EXPORT / SEZ / LUT BOOKS READY**  
**Does not claim:** GST portal LUT bond filing · shipping bill portal · RFD refund submit · **FULL GST COMPLIANT**

---

## Scope (from plan)

- Classification **beyond zero%** (WPAY / WOPAY export & SEZ)  
- LUT number / validity presence checks  
- Shipping bill / currency fields on sales invoice (snapshot)  
- Refund register **foundation** (books drafts only)

---

## Shipped

### Pure util
- `export-sez-lut.util.ts` — classification, LUT validity, zero-rated rate force, refund propose, GSTR partition WPAY/WOPAY

### Schema / migration
- `GstLut` → `gst_luts`  
- `GstExportRefundClaim` → `gst_export_refund_claims`  
- Sales invoice: `lutId`, `lutNumberSnapshot`, `shippingBillNumber`, `shippingBillDate`, `shippingPortCode`, `exportFobValue`  
- Migration `20260805220000_gst_phase10_export_sez_lut`

### Tax determination (reuse Phase 1 engine)
- `resolveGstTax` accepts `taxTreatmentHint` → applies zero-rated WPAY (IGST only) or WOPAY (0% rates), category `ZERO_RATED`  
- Soft LUT warning when `lutPresent=false`  
- Query: `GET /masters/tax/resolve?taxTreatment=EXPORT_WITHOUT_TAX&…`

### SI commercial path (reuse existing enums)
- Treatments already exist: `EXPORT_WITH_TAX` / `EXPORT_WITHOUT_TAX` / `SEZ_WITH_TAX` / `SEZ_WITHOUT_TAX`  
- `isZeroGstSupply` zeroes WOPAY  
- Post validation: LUT required for WOPAY; **hard blocker** only if `GST_EXPORT_LUT_HARD_BLOCK=true` (default soft warnings)

### GST ledger
- Stamps `taxTreatment`, `supplyType`, `zeroRatedMode`, LUT/shipping bill on `sourceSnapshot`  
- **Zero-tax OUTPUT_IGST** rows for WOPAY so export appears in registers

### Registers / GSTR-1 prep
- Export/SEZ filter uses treatment + POS  
- GSTR-1 sections add `exportSezWpay` / `exportSezWopay`

### API (`…/tax-compliance`)

| Method | Path |
|--------|------|
| GET | `/export/luts?legalEntityId=` |
| POST | `/export/luts` |
| POST | `/export/validate` |
| GET | `/export/register?legalEntityId=&returnPeriod=` |
| GET | `/export/refund-claims` |
| POST | `/export/refund-claims/propose` |
| POST | `/export/refund-claims/:id/submit-external` |

### Permissions
| Code | Use |
|------|-----|
| `tax.gst.export.view` | View LUT / register / refunds |
| `tax.gst.lut.manage` | Mutate LUT / propose refunds (also `tax.gst.setup.manage`) |
| view fallback | `tax.gst.view` / `finance.tax.view` |

### FE
- `/accounting/tax-compliance/gst/export-sez-lut` — dual-mode (API actions; demo empty lists)

### Tests
- `backend/tests/gst-export-phase10.test.ts`

---

## READY WITH CONDITIONS

1. Configure active LUT for each LE/GSTIN before WOPAY invoices  
2. Set `GST_EXPORT_LUT_HARD_BLOCK=true` in environments that must refuse post without LUT  
3. Sales invoice UI: set tax treatment + optional shipping bill / LUT link when editing export SI (fields exist; some commercial forms may still need widgets)  
4. Refund claims are **books drafts** — capture external ARN only  
5. Historical ledger rows without treatment stamp still use POS heuristics only  
6. Never claim portal export packing list / ICEGATE integration  

---

## Still NOT ready

- FULL GST COMPLIANT  
- Portal LUT bond file / amend  
- Shipping bill / let export integration  
- RFD-01 / refund credit ledger automation  
- Phase 11 advances / job work  

**Stop for product review before Phase 11.**
