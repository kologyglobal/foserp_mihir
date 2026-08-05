# Phase 0 — GST / Tax Gap Matrix

**Date:** 2026-08-05  
**Companion:** [`TAX_REPOSITORY_AUDIT.md`](./TAX_REPOSITORY_AUDIT.md)  
**Legend:**  
- **Have** = usable production path exists  
- **Partial** = schema or module path exists, incomplete adoption  
- **Missing** = not built or demo-only only  
- **Priority:** P0 blocker for TAX DETERMINATION / P1 GST ACCOUNTING / P2 returns / P3 portal  

---

## 1. Capability matrix

| Capability (north star) | Current state | Have / Partial / Missing | Priority | Phase |
|-------------------------|---------------|--------------------------|----------|-------|
| Effective-dated HSN/SAC master | `MasterHsnCode` + UI | **Have** | — | 0 reuse |
| Effective-dated GST rate (CGST/SGST/IGST) | `MasterGstRate` + UI | **Have** | — | 0 reuse |
| GST group ↔ item / HSN | `MasterGstGroup`, item FKs | **Have** | — | 0 reuse |
| UTGST first-class | Not distinct | **Partial** (via SGST) | P1 | 1 |
| Cess / compensation cess on rate master | Lines have cess amts; rate master limited | **Partial** | P1 | 1 |
| Tax categories TAXABLE/NIL/EXEMPT/… | AR taxTreatment partial; group lacks full taxonomy | **Partial / Missing** | P0 | 1 |
| Central `resolveGstTax` contract | `resolveLineGstFromMasters` + HTTP | **Partial** (subset inputs/outputs) | P0 | 1 |
| Never silent 18% | Widespread defaults | **Missing** (policy exists, not enforced) | P0 | 1 |
| UNRESOLVED / block post without rule | Enrich leaves blank; UI defaults 18 | **Missing** | P0 | 1 |
| Line tax snapshot (all commercial docs) | AR/AP SI/VI strong; Quote/SO/PI weak | **Partial** | P0 | 1 |
| Product pick → HSN + rate hydrate | SO/PI pick price only | **Missing** | P0 | 1 |
| One formula — no page-local GST | Many forms own `taxPct` math | **Missing** | P0 | 1 |
| Party: GSTIN, state | Company/vendor | **Have** | — | 1 refine |
| Party: registration type, composition, SEZ, unregistered, export | Invoice taxTreatment; weak masters | **Partial** | P0 | 1 |
| POS: bill-to / ship-to / LE GSTIN / branch | Helpers + AP path | **Partial** | P0 | 1 |
| POS: export/SEZ special cases | Supply service basics | **Partial** | P2 | 10 |
| Seller LE/branch GSTIN on print/docs | COMPANY_* hardcodes FE | **Partial** | P0 | 1 + 9 |
| UI: HSN, scheme, CGST/SGST/IGST columns | Accounting forms better; commercial flat % | **Partial** | P0 | 1 |
| User cannot free-pick CGST vs IGST | Commercial % dropdown only; AP better | **Partial** | P0 | 1 |
| `tax.gst.override` + audit | Not present | **Missing** | P1 | 1 |
| Permission split prepare/review/file | FE demo broader than BE | **Partial** | P2 | 5 |
| OUTPUT/INPUT GST GL maps | Mapping keys exist | **Have** | P1 config | 2 |
| Full mapping set (round-off, interest, late fee, ITC ineligible) | Partial keys | **Partial** | P1 | 2 |
| GST subledger / compliance transaction ledger | Extract from SI/VI; not full subledger model | **Partial** | P1 | 2 |
| CN/DN tax reverse vs original | AR CN / AP adjustment | **Have / Partial** | P1 | 2 |
| ITC eligibility classification | AP enums + recoverable split | **Partial** | P1 | 3 |
| GSTR-2B import immutable batches | Demo UI | **Missing** | P2 | 3 |
| 2B match worklist | Demo | **Missing** | P2 | 3 |
| RCM separate liability → ITC | AP RCM path | **Partial** | P1 | 4 |
| Sales GST / purchase GST registers live | Extract outward/inward | **Partial** | P1 | 5 |
| GSTR-1 / 3B preparation states | Demo filing previews | **Missing** | P2 | 5 |
| Period lock after file | Not complete | **Missing** | P2 | 5 |
| e-Invoice IRN on SI | SIMULATED adapter | **Partial** | P2 | 6 |
| Live IRP | LIVE throws | **Missing** | P3 | 6 / 12 |
| e-Way Part A/B | SIMULATED | **Partial** | P2 | 7 |
| Live e-Way | Missing | **Missing** | P3 | 7 / 12 |
| GST payment / cash ledger / PMT-06 | Demo | **Missing** | P2 | 8 |
| Multi-GSTIN isolation | Schema ready; weak wiring | **Partial** | P1 | 9 |
| Export / LUT / SEZ | TaxTreatment flags; no full LUT lifecycle | **Partial** | P2 | 10 |
| Advances / job work / special flows | Scattered or none | **Missing / Partial** | P3 | 11 |
| Portal filing GSTR-1/3B | Deferred | **Missing** | P3 | 12 |
| TDS/TCS separate engine (Act 2025) | Partial TDS; not Act 2025 | **Partial / Missing** | P2 | TDS track (parallel) |

---

## 2. Document coverage matrix

| Document | Uses master resolve? | Line tax snapshot (components)? | Silent 18% risk | Gap severity |
|----------|----------------------|---------------------------------|-----------------|--------------|
| CRM Quotation | No (local taxPct) | No | High | P0 |
| Sales Order | No | No (taxPct only) | High | P0 |
| Proforma Invoice | No | taxPct + header split | High | P0 |
| CRM Tax Invoice | No / bridge | Weak until AR | High | P0 |
| Sales Tax Invoice (AR) | Enrich optional | Yes | Medium (when caller supplies 18) | P0 bridge |
| Credit Note (customer) | From original rates | Yes (proportional) | Low if original good | P1 |
| Purchase Order | HSN/group partial | Rate not full | High | P0 |
| Purchase Invoice (purchase) | Limited | gstRatePct | High | P0 |
| Vendor Invoice (AP) | Yes (calc path) | Yes | Medium | P1 |
| Vendor debit adj | ITC treatments | Yes | Low–Med | P1 |
| Purchase Return | Defaults 18 | Limited | High | P0 |
| Dispatch → SI | Via AR path | Via AR | Depends | P1 |

---

## 3. Silent-18% gap map (fix targets for Phase 1)

| Layer | Examples | Action |
|-------|----------|--------|
| Constants | `DEFAULT_GST_RATE`, `DEFAULT_GST_PCT` | Remove from transactional paths; seeds/tests only with explicit fixture docs |
| Schema | Proforma/TaxInvoice line `@default(18)` | Default 0 or null + validation, not 18 |
| Backend fallbacks | `taxPct ?? 18` commercial/SO/bridge | `?? unresolved` → 422 |
| Line drafts | `newSoLineDraft`, PI `taxPct: '18'` | Start empty; resolve on item select |
| Product pick | Sets price only | Set HSN + resolve rates |
| Purchase seeds | `gstRatePct: 18` | Resolve or UNRESOLVED |
| Print fallbacks | SO print `taxPct = 18` | Use persisted snapshot only |

---

## 4. Resolver gap (current vs target API)

| Target `resolveGstTax` input | Current `resolveLineGstFromMasters` |
|------------------------------|-------------------------------------|
| tenantId | Yes |
| legalEntityId / branchId | No (caller supplies states) |
| customerOrVendorId | No (states only) |
| itemId | Yes |
| documentType | via applicableFor SALES/PURCHASE |
| documentDate | asOfDate |
| billing/shipping/POS | fromState/toState only |
| transactionDirection | applicableFor |

| Target return | Current |
|---------------|---------|
| hsnSacCode | Indirect (lookup) |
| taxCategory | Missing |
| gstRate / scheme / CGST SGST UTGST IGST cess | Partial (CGST/SGST/IGST map) |
| reverseCharge | Missing on resolve |
| ruleId / ruleVersion | Rate row id partial; no version stamp always persisted commercial |
| warnings / blockers | Returns null only |

**Gap:** Extend resolver contract in Phase 1 **on the existing service**, do not invent a parallel engine.

---

## 5. Security & audit gaps

| Control | Status |
|---------|--------|
| Tenant isolation on tax masters & resolve | Have |
| Finance tax view / extract / e-doc manage | Have |
| override permission | Missing |
| Return maker vs filer | Missing |
| Tax rule / HSN / override audit trail | Partial (master audit fields; no tax-event ledger) |
| Portal idempotency | Sim adapters only |

---

## 6. Readiness gates (honest)

| Label | Can claim now? | Blocked by |
|-------|----------------|------------|
| TAX DETERMINATION READY | **No** | Silent 18%, commercial not on resolver, incomplete party/POS, line snapshots |
| GST ACCOUNTING READY | **No** (partial AR/AP only) | Commercial→AR consistency; subledger; full mapping set |
| GST RETURNS PREPARATION READY | **No** | No period state machine, GSTR drafts |
| GST PORTAL INTEGRATION READY | **No** | SIMULATED only |
| FULL GST COMPLIANCE READY | **No** | Live IRN, e-way, GSTR, payment, multi-GSTIN UAT |

---

## 7. Non-goals (reaffirm)

- Do **not** duplicate SalesInvoice / VendorInvoice / posting engines.  
- Do **not** claim compliance from UI or extract alone.  
- Do **not** fold TDS/TCS into GST line resolve.  
- Do **not** implement Phase 12 live filing before Phase 1–11 UAT.
