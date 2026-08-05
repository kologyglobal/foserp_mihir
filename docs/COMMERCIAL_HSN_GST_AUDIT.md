# Commercial HSN/SAC & GST Architecture Audit

**Date:** 2026-08-05  
**Scope:** Quotation → Sales Order → Proforma → CRM Tax Invoice → Money-In Sales Invoice / Credit Notes  
**Status:** Phase 1 complete — source of truth for Phase 2–16 implementation

---

## 1. Verdict

| Decision | Detail |
|----------|--------|
| **Tax engine** | **Reuse only** `backend/src/modules/tax/gst-tax-resolve.service.ts` → `resolveGstTax` |
| **Master lane** | `resolveLineGstFromMasters` in `accounting-tax-resolver.ts` |
| **FE facade** | `frontend/src/utils/commercialLineTax.ts` → `resolveCommercialLineTax` → API `/masters/tax/resolve` |
| **Supply type (AR)** | `gst-supply-determination.service.ts` + `SalesInvoiceSupplyType` |
| **CRM header split** | `commercial.service.ts` `buildGst` (half/half vs IGST from states) — does **not** call `resolveGstTax` on save |
| **Best snapshot** | Money-In `SalesInvoiceLine` (full CGST/SGST/IGST rates + amounts + `hsnCodeSnapshot`) |
| **Weakest snapshot** | Quotation `priceLines` + Sales Order `lines` JSON — **no HSN**, single `taxPct` only |

**Do not** invent a second tax engine. Extend snapshots + reconversion mappers + UI columns + call `resolveGstTax` / FE facade on tax-determining field changes.

---

## 2. Existing tax resolution

### 2.1 Backend

| Symbol | File | Role |
|--------|------|------|
| `resolveGstTax` | `backend/src/modules/tax/gst-tax-resolve.service.ts` | Authoritative determination; scheme `cgst_sgst` \| `igst` \| `utgst_pair` |
| HTTP | `GET …/masters/tax/resolve` | `tax-resolve.controller.ts` |
| `resolveLineGstFromMasters` | `accounting-tax-resolver.ts` | Master HSN → GST group → dated rate |
| `determineSupplyType` | `gst-supply-determination.service.ts` | INTRA/INTER/EXPORT/SEZ |
| `computeLineTaxes` / `splitGstRate` | `gst-calculation.service.ts` | AR amount split |
| `buildGst` | `crm/commercial/commercial.service.ts` | CRM PI/TI header tax from states + avg line rate |
| `buildSalesLineSnapshots` / `normalizeSalesLineForWrite` | `crm/shared/crm-item-resolver.ts` | Item code/name; HSN available for write if passed |

### 2.2 Frontend

| Symbol | File |
|--------|------|
| `resolveCommercialLineTax` | `utils/commercialLineTax.ts` |
| `resolveGstTaxFromMasters` | `services/accounting/taxResolutionApi.ts` |
| `lineTaxAmounts` | `utils/commercialLineTax.ts` |
| `determineSalesGstSupply` / `resolvePlaceOfSupplyFromBilling` | `utils/gstSupply.ts` |
| `computeGst` | `utils/gstEngine.ts` (demo; avoid inventing 18% on commercial path) |

### 2.3 Enums (reuse — no duplicates)

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
