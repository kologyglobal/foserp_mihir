# Commercial HSN/GST Implementation Notes

**Date:** 2026-08-05 (completion pass)  
**Engine reused:** `resolveGstTax` (BE) + `resolveCommercialLineTax` (FE) + **shared pure PoS/supply** in `commercial-supply-context` — no second tax engine.

---

## Architecture

```text
Legal entity / branch GST state (supplier)
  + ship-to / bill-to / customer GSTIN / customer master
  → resolveCommercialPlaceOfSupply
  → resolveCommercialSupplyType  (INTRA / INTER / UNRESOLVED + scheme)
  → applyDocumentTaxSchemeToLines (clear opposite components)
  → SO header columns + line JSON snapshot
  → Q convert / forms / 360 / PDF use saved snapshot
```

### Priority (goods)

1. Authorised Place of Supply override (+ reason + `crm.commercial.tax_place_override`)  
2. Ship-to / delivery state  
3. Customer GSTIN registration state (`CUSTOMER_GSTIN`)  
4. Bill-to address  
5. Customer master state (`CUSTOMER`)  
6. `UNRESOLVED` — **confirm/post blocked**

Services reverse bill-to vs ship-to for steps 2/4.

**Important:** Auto path **does not** re-use a previously saved PoS unless override is on. This prevents sticky wrong supply when ship-to changes.

---

## Backend

| Piece | Location |
|-------|----------|
| PoS + supply pure resolvers | `backend/src/modules/tax/commercial-supply-context.ts` |
| SO header resolve + line realign + override gate | `backend/src/modules/crm/sales-orders/sales-order-tax-header.ts` |
| Scheme realign + confirm validation | `applyDocumentTaxSchemeToLines` / `assertConfirmable` in `sales-order.workflow.ts` |
| Create/update persist aligned lines + tax header | `sales-order.service.ts` |
| Q→SO convert tax header + snapshot lines | `quotation.convert.ts` |
| Quotation price line snapshot fields | `quotation.types.ts` + `quotation.validation.ts` (JSON lines — **no migration**) |
| Rate scheme (UTGST/cess on master) | `applySchemeToMasterRate` in `gst-tax-resolve.service.ts` |
| Permission | `crm.commercial.tax_place_override` |
| Audit | `PLACE_OF_SUPPLY_OVERRIDE` with reason, by, at |

### Sales Order header columns (existing migration)

`placeOfSupply`, `placeOfSupplyStateCode`, `placeOfSupplySource`, `placeOfSupplyOverride`,  
`placeOfSupplyOverrideReason`, `supplierStateCode`, `supplyType`, `gstScheme`,  
`cgstAmount` / `sgstAmount` / `utgstAmount` / `igstAmount` / `cessAmount`

Overridden **by/at** stored on **audit log** `newValues` (no extra columns required).

### State name fields

Not separate columns: codes + labels via `formatPlaceOfSupplyLabel` / stored `placeOfSupply` label string.

---

## Frontend

| Piece | Location |
|-------|----------|
| PoS/supply mirror | `frontend/src/utils/commercialSupplyContext.ts` |
| Supply panel (auto PoS, read-only type, source, explanation, override) | `CommercialGstSupplyPanel.tsx` |
| SO create / edit | `SalesOrderCreatePage` / `SalesOrderFormPage` |
| Proforma / commercial tax invoice form | Proforma + CRM commercial pages |
| Money-in SI / CN | Supply type **read-only** derivation |

---

## Conversion chain

| Step | Behaviour |
|------|-----------|
| Quotation lines | Optional HSN + scheme + component snapshot fields in JSON `priceLines` |
| Q → SO (API) | Copy snapshot fields; `resolveSalesOrderTaxHeader` realigns scheme; header PoS persisted |
| Q → SO (demo FE) | `buildSalesOrderLinesFromQuotationDocument` carries HSN / scheme / components |
| SO → PI | Prefill + bridge send header PoS/seller; BE `buildProformaPayload` prefers SO header |
| SO/PI → TI | Prefill + commercial store/API include PoS + line scheme; UI seeds GST panel from upstream |
| CRM TI → Accounting SI | Unified SI (`createUnifiedInvoice`) resolves PoS: input → SO → PI → party — **not party-only** |
| Money-in SI from PI | Form sets PoS from prefill after customer defaults |

Re-resolve runs only when tax-determining fields change on write — not silently on mere convert without address/customer change. Header recompute still runs on SO create/confirm so supplier LE state is correct.

---

## Posting / confirm guards

`assertConfirmable` requires:

- Supplier state + PoS state code present  
- `supplyType` / `gstScheme` not `UNRESOLVED`  
- Inter lines: no CGST/SGST/UTGST amounts  
- Intra lines: no IGST amounts  

Message: GST treatment changed / complete delivery tax details.

---

## Tests

```bash
cd backend
npx vitest run tests/commercial-supply-pos-conversion.test.ts tests/commercial-conversion-chain.test.ts
```

Also: `sales-order-line-tax-snapshot.test.ts`, `gst-tax-scheme.test.ts` as applicable.

---

## UTGST / Cess readiness (honest)

| Layer | Status |
|-------|--------|
| Master columns utgst/cess | Present on MasterGstRate |
| applySchemeToMasterRate | Returns utgst_pair + rates |
| SO line utgstRate/Amount | Supported in buildLinesFromInput |
| SO header utgstAmount | Column present |
| Full rate master population | Tenant-dependent |
| PDF all surfaces for UTGST | Partial |
| Accounting SI line cess full path | Partial depending on AR bridge |

**Do not claim full UTGST/cess production readiness** without tenant master + UAT on print/post.

See audit + UAT docs and the completion report below.
