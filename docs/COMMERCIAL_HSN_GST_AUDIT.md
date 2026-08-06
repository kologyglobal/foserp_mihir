# Commercial HSN/SAC & GST Architecture Audit

**Date:** 2026-08-05 (updated after auto PoS / supply / snapshot completion pass)  
**Scope:** Quotation → Sales Order → Proforma → CRM Tax Invoice → Money-In Sales Invoice / Credit Notes  
**Status:** Auto Place of Supply + Supply Type + SO header snapshot **READY WITH CONDITIONS** — see `COMMERCIAL_HSN_GST_IMPLEMENTATION.md` and UAT checklist.

---

## 1. Verdict

| Decision | Detail |
|----------|--------|
| **Tax engine** | **Reuse only** `resolveGstTax` + shared pure PoS/`resolveCommercialSupplyType` (`commercial-supply-context.ts`) |
| **Master lane** | `resolveLineGstFromMasters` in `accounting-tax-resolver.ts` |
| **FE facade** | `commercialLineTax.ts` + `commercialSupplyContext.ts` (mirror BE PoS/supply) |
| **SO tax header** | `sales-order-tax-header.ts` — PoS, supply type, scheme totals, line realign |
| **Best snapshot** | Money-In `SalesInvoiceLine` + SO `lines` JSON components when saved via workflow |
| **Former weakest** | Quotation `priceLines` — **now accepts** full optional HSN/scheme snapshot fields (JSON) |

**Do not** invent a second tax engine.

### Confirmed 2026-08-05 completion pass

| Capability | State |
|------------|--------|
| Auto PoS priority (override → ship → GSTIN → bill-to → customer) | Done |
| Sticky non-override saved PoS removed | Done |
| Supply type read-only | Done |
| Override permission + reason + audit | Done |
| Confirm blocks UNRESOLVED / dual scheme | Done |
| Q line DTO snapshot fields | Done (optional JSON) |
| Full PI→TI→AR E2E | Manual UAT remaining |

**No migration in this pass** (SO header used existing columns). **No commit/push/deploy.**

---

## 2. Existing tax resolution

### 2.1 Backend

| Symbol | File | Role |
|--------|------|------|
| `resolveGstTax` | `gst-tax-resolve.service.ts` | Rate determination |
| `resolveCommercialPlaceOfSupply` | `commercial-supply-context.ts` | PoS priority |
| `resolveCommercialSupplyType` | same | Intra/Inter + scheme |
| `resolveSalesOrderTaxHeader` | `sales-order-tax-header.ts` | SO header + re-align lines |
| `applyDocumentTaxSchemeToLines` | `sales-order.workflow.ts` | Clear dual-scheme amounts |
| HTTP tax resolve | `GET …/masters/tax/resolve` | Masters API |

### 2.2 Frontend

| Symbol | File |
|--------|------|
| `resolveCommercialLineTax` | `utils/commercialLineTax.ts` |
| `resolveCommercialPlaceOfSupply` | `utils/commercialSupplyContext.ts` |
| `CommercialGstSupplyPanel` | `components/sales/CommercialGstSupplyPanel.tsx` |

### 2.3 Enums (reuse — no duplicates)

| Name | Values |
|------|--------|
| Supply type | `INTRA_STATE` \| `INTER_STATE` \| `UNRESOLVED` |
| Tax scheme | `cgst_sgst` \| `igst` \| `utgst_pair` \| `UNRESOLVED` (string) |
| PoS source | `OVERRIDE` \| `SHIP_TO` \| `BILL_TO` \| `CUSTOMER_GSTIN` \| `CUSTOMER` \| `UNRESOLVED` \| `AUTO` |

---

For full historical gap tables and older document matrices, retain the sections below as archive context; treat the **Completion report in COMMERCIAL_HSN_GST_UAT.md** as the live checklist.

---

## Archive notes (pre-completion)

Weakest commercial line storage was single `taxPct` — SO workflow and quote DTO now carry optional component snapshots. CRM commercial `buildGst` may still average rates for older CRM PI/TI paths; prefer `CommercialGstSupplyPanel` + line resolve on new work.


| Name | Values | Path |
|------|--------|------|
| `GstTaxScheme` | `cgst_sgst`, `igst`, `utgst_pair` | BE tax resolve |
| `SalesInvoiceSupplyType` | `INTRA_STATE`, `INTER_STATE`, `EXPORT`, `SEZ`, `NON_GST` | Prisma + money-in |
| FE `GstScheme` | `cgst_sgst`, `igst` | `types/invoice.ts` (incomplete vs UTGST) |
| CRM `gstScheme` string | `cgst_sgst` / `igst` on PI/TI headers | Prisma columns |

**Note:** `utgst_pair` is typed in `resolveGstTax` but not fully applied in scheme split today (UTGST rate often 0).

---

## 3. Persistence by document

| Document | Line storage | HSN | taxPct | CGST/SGST/IGST line | Header scheme | PoS |
|----------|--------------|-----|--------|---------------------|---------------|-----|
| Quotation document | `priceLines` JSON | ✗ | ✓ | ✗ | ✗ | partial |
| Sales Order | `lines` JSON | ✗ | ✓ | ✗ | ✗ | ✗ |
| Proforma | `CrmProformaInvoiceLine` | ✓ `hsnCode` | ✓ | ✗ | ✓ | ✓ |
| CRM Tax Invoice | `CrmTaxInvoiceLine` | ✓ | ✓ | ✗ | ✓ | ✓ |
| Money-In SI | `SalesInvoiceLine` | ✓ snapshot | via rates | **full** | via supplyType | ✓ |
| Credit note | `CustomerCreditNoteLine` | ✓ snapshot | via rates | **full** | via supplyType | ✓ |

Ideal commercial line snapshot (target): item identity + **hsnId/hsnCode** (+ sac as code) + taxGroup + **taxScheme** + component rates/amounts + taxable/line total. Prefer extending **JSON contracts** first (SO/quote); SQL columns exist already for PI/TI HSN.

---

## 4. UI gaps (user-visible)

| Surface | HSN column | Scheme / breakup | Persist on save |
|---------|------------|------------------|-----------------|
| SO Create | ✗ | GST % only | ✗ HSN |
| SO Edit (`ErpProductPricingPanel`) | ✓ display | hint | lost in SoLineDraft |
| SO 360 `OrderLineItemsPanel` | ✗ | ✗ | n/a |
| Proforma form | ✓ (live master) | partial | HSN saved on line |
| Tax Invoice form | ✗ | GST % | HSN often on line |
| Money-In SI | ✓ | full | ✓ |
| SO PDF | join master | partial | live master risk |
| PI / TI PDF | line HSN | footer components | better |

---

## 5. Conversion carry

| Path | taxPct | HSN | Scheme components |
|------|--------|-----|-------------------|
| Q → SO | ✓ | ✗ | ✗ |
| SO → PI | ✓ | re-read **Item master** | header re-derive |
| PI → TI | ✓ | if on PI | header |
| TI → SI | ✓ | `hsnCodeSnapshot` | AR recalc |

---

## 6. Root causes (current problems)

1. **SO/Quote line contracts omit HSN** — cannot show 360/PDF from snapshot.
2. **SoLineDraft mapping drops HSN** even when panel shows it from item.
3. **Tax Invoice form** omits HSN column though type has `hsnCode`.
4. **Proforma** displays item master HSN, not exclusive line snapshot priority in all paths.
5. **Supply type UI** may still be user-editable on some money-in/forms — should be system-calculated except authorised override.
6. **No SO placeOfSupply** — scheme only solidifies at PI/TI.
7. **PDF SO** can use live item join for HSN.
8. **Some paths default 18%** (`DEFAULT_GST_RATE`) — conflicts with “never invent 18”.

---

## 7. Implementation strategy (Phases 2–16)

1. Extend **commercial line snapshot type** (FE + BE shared fields on SO/quote JSON + pass through PI/TI).
2. On item select: always `resolveCommercialLineTax` / BE `resolveGstTax` with from/to state.
3. Save snapshot fields; never re-write posted docs.
4. **Read order:** line snapshot → item master fallback → empty + warning.
5. Auto **supplyType** from supplier state vs PoS; scheme CGST+SGST / IGST / CGST+UTGST.
6. UI: system PoS + supply type; HSN columns; SO 360 breakup.
7. Conversions copy snapshot; re-resolve only when tax-determining fields change.
8. PDF/print use line snapshot only.
9. Tests for INTRA/INTER/UT, missing PoS, conversion, master change.
10. Migrations **only** if new first-class SQL columns required (prefer JSON for SO; PI already has hsnCode).

---

## 8. Key file index

```
backend/src/modules/tax/gst-tax-resolve.service.ts
backend/src/modules/accounting/shared/master-resolvers/accounting-tax-resolver.ts
backend/src/modules/crm/commercial/commercial.service.ts
backend/src/modules/crm/sales-orders/sales-order.types.ts
backend/src/modules/crm/sales-orders/sales-order.workflow.ts
backend/src/modules/crm/quotations/quotation.convert.ts
backend/src/modules/crm/shared/crm-item-resolver.ts
frontend/src/utils/commercialLineTax.ts
frontend/src/utils/gstSupply.ts
frontend/src/components/erp/ErpProductPricingSection.tsx
frontend/src/components/sales/SalesOrderLinesEditor.tsx
frontend/src/modules/sales/SalesOrderCreatePage.tsx
frontend/src/modules/crm/commercial/CrmCommercialPages.tsx
frontend/src/modules/sales/ProformaInvoiceFormPage.tsx
docs/accounting/GST_TAX_RESOLUTION.md
docs/tax/PHASE1_TAX_DETERMINATION.md
```
