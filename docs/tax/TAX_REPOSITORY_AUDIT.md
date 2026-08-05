# Phase 0 — Tax Repository Audit

**Product:** FOS ERP — Indian GST Compliance Platform (north star)  
**Date:** 2026-08-05  
**Scope:** `backend/`, `frontend/`, existing `docs/accounting/*` and dispatch tax docs  
**Mode:** **Read-only audit — no application code changed in this phase**  
**Method:** Code and schema evidence (Prisma, services, forms, routes, existing docs)

---

## 1. Executive verdict

| Dimension | Score | One-line summary |
|-----------|-------|------------------|
| **Tax masters (HSN / GST group / rate)** | **SOLID** | Effective-dated CGST/SGST/IGST rates, resolve API, master UI |
| **Shared backend resolver** | **PARTIAL** | `resolveLineGstFromMasters` exists; under-used outside AR/AP |
| **Accounting Sales Invoice (AR)** | **SOLID** | Full component line snapshot + GST GL posting |
| **Accounting Vendor Invoice (AP)** | **SOLID / BASIC** | Component tax, RCM/ITC fields, posting maps; statutory ITC incomplete |
| **CRM / Sales commercial (Quote → SO → Proforma / Tax Invoice)** | **PARTIAL** | Single `taxPct`, **silent 18%**, local formulas |
| **Purchase transactional (PO / PI return / VQ)** | **PARTIAL** | HSN snapshots on PO; rate often default 18% |
| **Place of supply** | **BASIC** | Supply-type helpers; seller often hardcoded company state |
| **Party GST classification** | **PARTIAL** | GSTIN + state; composition/SEZ/export flags weak on masters |
| **GST extract** | **BASIC** | Posted AR/AP registers (no portal filing) |
| **e-Invoice / e-Way** | **BASIC** | SIMULATED NIC adapter only |
| **GSTR-1 / 3B / 2B / ITC recon** | **NONE → DEMO** | UI shells / demo; not production filing |
| **TDS / TCS** | **PARTIAL** | Separate from GST math; filing incomplete |
| **Centralized tax engine (north star)** | **NOT MET** | Dual stacks: finance resolver vs commercial `taxPct × base` |

**Phase 0 readiness label (honest):**  
**AUDIT COMPLETE — TAX DETERMINATION NOT READY**  
Foundation for Phase 1 is strong (masters + AR/AP engines). Commercial document chain and silent 18% are the primary blockers to “one tax engine.”

**Do not claim:** FULL GST COMPLIANT / GST PORTAL INTEGRATION READY.

---

## 2. North star vs current architecture

### Target (product mandate)

```text
Document → Party / Registration → Item / HSN-SAC → Place of Supply
  → Tax Classification → GST Resolution → Line Tax Snapshot
  → Accounting Posting → Compliance Register → Return / Portal
```

### As implemented today

```text
Tax masters (MasterGstGroup / MasterHsnCode / MasterGstRate)     SOLID
        │
        ▼
resolveLineGstFromMasters  +  GET …/masters/tax/resolve         SOLID core, limited consumers
        │
        ├── Accounting AR SalesInvoice calculate / post         SOLID snapshots + GL
        ├── Accounting AP VendorInvoice calculate / post        SOLID-ish + RCM/ITC fields
        │
        └── FE taxResolutionApi / computeGstFromTaxMaster       EXISTS, almost unused
                                                                by CRM / SO / PI / PO forms

Parallel commercial path (widely used):
  new line taxPct = 18  →  taxable × taxPct/100  →  computeGst(DEFAULT_GST_RATE)
  Header CGST/SGST/IGST from state compare (often COMPANY_STATE)
  HSN optionally copied from item at save/print only
```

**Implication:** Building a second GST engine would be wrong. Phase 1+ must **extend and adopt** `resolveLineGstFromMasters` / finance calculate paths and **retire** silent commercial defaults.

---

## 3. Area findings

### 3.1 Hardcoded 18% and silent defaults — **PARTIAL (high contamination)**

| Location | Evidence |
|----------|----------|
| `frontend/src/types/invoice.ts` | `DEFAULT_GST_RATE = 18`, `COMPANY_STATE`, `COMPANY_GSTIN` |
| `frontend/src/utils/gstEngine.ts` | `computeGst(..., gstRate = DEFAULT_GST_RATE)`; API mode only **warns** |
| `backend/.../quotation.constants.ts` | `DEFAULT_GST_PCT = 18` |
| `backend/.../commercial.service.ts` | `taxPct ?? 18` |
| `backend/.../sales-order.workflow.ts` / validation | default `taxPct` 18 |
| `backend/.../crm-unified-sales-invoice.service.ts` | `gstRate: String(l.taxPct ?? 18)` |
| Prisma | `CrmProformaInvoiceLine.taxPct` / `CrmTaxInvoiceLine.taxPct` `@default(18)` |
| SO / PI UI | `SalesOrderLinesEditor` `newSoLineDraft` `taxPct: 18`; proforma same; product pick **does not** set rate from item |
| Purchase | `gstRatePct: 18` in PO / return / VQ editors, facade seeds |
| Inventory demo item form | free `gstRate: 18` parallel to MasterItem |
| Tests / seeds | Many fixtures use explicit 18 (acceptable for fixtures if labeled) |

**Gap vs north star:** “Never default silently to 18%” — **violated** across commercial and purchase UIs.

Existing policy doc already states the correct rule:  
[`docs/accounting/GST_TAX_RESOLUTION.md`](../accounting/GST_TAX_RESOLUTION.md) — *do not hardcode 18% in transactional forms*. **Not enforced.**

---

### 3.2 Item GST / HSN — **BASIC**

| Surface | Fields |
|---------|--------|
| **Prisma `MasterItem`** | `hsnCode`, optional `hsnId`, `gstGroupId` — **no denormalized rate** (correct if always resolved) |
| **Item master UI** | Tax group / HSN wiring in masters item pages |
| **Inventory item form** | Parallel free-text HSN + numeric GST % (demo-style) |
| **PO lines** | `hsnId`, `gstGroupId`, HSN/group **code snapshots** |
| **SalesInvoiceLine (AR)** | `hsnCodeSnapshot` + component rates/amounts |
| **SO / PI commercial lines** | Often single `taxPct`; HSN filled at build/print from item |

**Gap:** Item tax profile incomplete for export/SEZ/RCM/cess rules. Dual item surfaces risk inconsistent tax.

---

### 3.3 GST masters — **SOLID**

| Model | Role |
|-------|------|
| `MasterGstGroup` | Group codes (goods type, status) |
| `MasterHsnCode` | HSN/SAC → `gstGroupId` |
| `MasterGstRate` | `cgst` / `sgst` / `igst`, `dateFrom` / `dateTo`, `fromState`, `locationStateCode`, `applicableFor` SALES\|PURCHASE\|BOTH |

| Delivery | Path |
|----------|------|
| Seed | `backend/prisma/gstTaxSeedData.ts` |
| API | `GET /api/v1/t/:tenantSlug/masters/tax/resolve` — `tax-resolve.controller.ts` |
| Engine | `backend/src/modules/accounting/shared/master-resolvers/accounting-tax-resolver.ts` → `resolveLineGstFromMasters` |
| UI | `frontend/src/modules/masters/{hsn,gst-group,gst-rate}/*` |
| Permissions | `master.hsn.*`, `master.gst_group.*`, `master.gst_rate.*` |

**Gaps in masters vs Phase 1 target:**

- No first-class **UTGST** column (SGST reused or zeroed).
- **Cess / compensation cess** not first-class on `MasterGstRate` (AR line has cess amounts; rate master limited).
- **Tax category enum** (TAXABLE / NIL / EXEMPT / ZERO_RATED / NON_GST / RCM / EXPORT_* / SEZ_*) not on rate/group master as statutory classification SoT.
- SAC vs HSN distinction soft (same `MasterHsnCode` table).

---

### 3.4 Legal Entity / Branch GSTIN — **BASIC**

Schema supports:

- `LegalEntity.gstin`, `stateCode`, address JSON  
- `Branch.gstin`, `stateCode`  
- `MasterLocation.gstin`  
- AR `SalesInvoice.legalEntityId` (+ optional branch)

**Gap:** Print and many commercial FE paths still use **hardcoded** `COMPANY_*` (e.g. Maharashtra plant constants) instead of active LE/branch registration. Multi-GSTIN compliance isolation is **not** end-to-end.

---

### 3.5 Customer / Vendor GST party — **PARTIAL**

| Party | Today |
|-------|--------|
| **CrmCompany** | `gstin?`, `state?`, `pan?` — no composition / SEZ / registration-type enum |
| **MasterVendor** | `gstin`, `gstVendorType` (string, default `registered`), state |
| **AR SalesInvoice** | `taxTreatment` enum REGISTERED \| UNREGISTERED \| EXPORT_* \| SEZ_* \| NON_GST; GSTIN/state **snapshots** |
| **Inference** | Often “has GSTIN ⇒ REGISTERED” at invoice time |

**Gap:** Full party classification (composition, unregistered vs consumer, SEZ, export country, POS override, exemption certificate) not complete on CRM/vendor masters.

---

### 3.6 Place of supply — **BASIC**

| Component | Path |
|-----------|------|
| FE sales/purchase supply helpers | `frontend/src/utils/gstSupply.ts`, `gstStateCode.ts` |
| BE supply type | `gst-supply-determination.service.ts` (INTRA / INTER / EXPORT / SEZ) |
| AP calculators | Vendor invoice / adjustment tax calculators with POS vs states |
| Purchase setup defaults | `placeOfSupplyState` / code |
| Document fields | PO/PI place of supply; AR `placeOfSupply` |

**Gaps:**

- Commercial FE frequently falls back to `COMPANY_STATE`.
- POS not always normalized GST state code on CRM headers.
- No single mandatory backend resolution for quote/SO/proforma before totals.

---

### 3.7 Shared tax resolution — **PARTIAL (built, under-consumed)**

| API / function | Consumers |
|----------------|-----------|
| `resolveLineGstFromMasters` | AR enrich, AP calc, tax resolve endpoint |
| `enrichLinesWithMasterGstRates` | When line has **no** explicit rates — still leaves line unchanged if resolve null |
| `resolveGstTaxFromMasters` (FE) | Returns null in demo; almost **no** SO/quote/PI production callers |
| `computeGstFromTaxMaster` | Defined in `gstEngine.ts`; not wired into commercial forms |
| `computeGst` | Still used widely for header split |

**Critical:** Empty rate + unresolved master → commercial UI still shows **18%** rather than **UNRESOLVED** / blocker.

---

### 3.8 Sales commercial documents — **PARTIAL**

| Document | Tax model | Notes |
|----------|-----------|-------|
| Quotation | `taxPct` / header gst % | Defaults 18; local line total engines |
| Sales Order | `taxPct` | Line editor hardcodes 18; pick does not resolve master |
| Proforma | Line `taxPct` default 18; header cgst/sgst/igst | HSN from item at build; totals via `computeGst` |
| CRM Tax Invoice | Line taxPct default 18 | Deprecated dual-ledger; bridges to AR |
| **Sales Invoice (Accounting)** | Component rates + amounts + snapshots | Canonical for posting and extract |

Print docs (Proforma / Tax Invoice / SO) can show HSN and CGST/SGST/IGST **breakout**, but breakout often derived from flat line rate + state, not rule version snapshots.

---

### 3.9 Purchase documents — **PARTIAL**

| Document | Maturity |
|----------|----------|
| Purchase Order | HSN/group FKs + snapshots; rate UI default 18 |
| Purchase Invoice (purchase module) | `gstRatePct`, RCM flag — lighter than accounting AP |
| Vendor Invoice (Accounting AP) | Full components, RCM, ITC fields, postings |
| Vendor adjustments / debit notes | ITC add/reverse treatments |

---

### 3.10 Accounting posting — **SOLID**

`DefaultAccountMapping` / finance constants include:

- `GST_INPUT_CGST|SGST|IGST` (+ cess variant usage)
- `GST_OUTPUT_CGST|SGST|IGST` (+ CESS)
- RCM payable components on AP path

Sales builder credits output GST; vendor path debits input GST / RCM payables per mapping — **account IDs not hardcoded in code** (mapping keys are).

**Gap:** Not all Phase-2 north-star keys (interest, late fee, ITC ineligible expense ledger types as first-class everywhere) fully productized; depends on tenant mapping completeness.

---

### 3.11 Credit / debit notes — **BASIC**

- Customer credit notes: component snapshots; ratios from original invoice (good for immutability).
- Vendor adjustments: ITC reverse/add.
- Do not rewrite posted original invoices (aligned with north star).

**Gap:** Full GSTR amendment register and return-period linkage incomplete.

---

### 3.12 GST extract / registers — **BASIC**

| Endpoint (permission) | Source |
|-----------------------|--------|
| `…/tax-compliance/outward-supplies` (`finance.tax.view`) | Posted SalesInvoice |
| `…/tax-compliance/inward-supplies` | Posted VendorInvoice |
| `…/tax-compliance/summary` | KPIs |

Status documented in [`docs/accounting/TAX_COMPLIANCE_STATUS.md`](../accounting/TAX_COMPLIANCE_STATUS.md).

**Not production:** GSTR-1/3B/2B import filing, amendment locks, GST payment challans (demo shells).

---

### 3.13 e-Invoice / e-Way — **BASIC (SIMULATED)**

| Table | Purpose |
|-------|---------|
| `GstEInvoice` | IRN, ack, QR payload, provider mode |
| `GstEWayBill` | EWB #; source SALES_INVOICE \| DELIVERY_CHALLAN |

Adapter: `nic-gst.adapter.ts` — `SIMULATED` only; LIVE throws until configured. Env `GST_NIC_PROVIDER`.

Permissions: `finance.tax.einvoice.manage`, `finance.tax.eway.manage`.

---

### 3.14 RCM / ITC — **BASIC**

- Real on **AP Vendor Invoice** (flags, RCM amounts, ITC eligibility enums, recoverable split).
- Purchase inventory PI: simple reverse-charge flag / demo totals.
- ITC recon UI: demo.
- Statutory rule engine for blocked credits: incomplete.

---

### 3.15 TDS / TCS boundary — **PARTIAL (correctly separate)**

- TDS rates/treatments on vendor invoice and customer receipts; mapping keys `TDS_PAYABLE` / `TDS_RECEIVABLE`.
- TCS largely setup + manual amounts on purchase, not full statutory engine.
- **Not mixed into GST line percentage engines** — boundary is good; completeness is not.

Income-tax Act 2025 post-1-Apr-2026 section structure: **not implemented** (future withholding engine).

---

### 3.16 Permissions — **BASIC**

| Present | Missing vs platform brief |
|---------|---------------------------|
| `finance.tax.view`, `.extract`, `.einvoice.manage`, `.eway.manage` | `tax.gst.override`, return prepare/review/file split |
| `master.hsn.*`, `master.gst_group.*`, `master.gst_rate.*` | Maker/checker filer matrix as dedicated codes |

FE seed sometimes exposes broader `accounting.tax.*` labels than backend enforces.

---

### 3.17 Demo vs API — **PARTIAL**

| Mode | Behaviour |
|------|-----------|
| Demo | Local `computeGst`, seed tax compliance data; resolve API null |
| API | AR/AP can enrich from masters; commercial UIs still default 18 and local math |

**Risk:** API mode can look “live” while documents still invent tax — violates dual-mode integrity expectations for tax truth.

---

## 4. Reuse inventory (must keep)

Do **not** recreate:

| Asset | Location / role |
|-------|-----------------|
| Master GST graph | Prisma + master UI + seed |
| `resolveLineGstFromMasters` | accounting-tax-resolver |
| Tax resolve HTTP API | masters tax/resolve |
| AR SalesInvoice line snapshots + posting | sales-invoice-* services |
| AP VendorInvoice + RCM/ITC + posting | vendor-invoice-* |
| Central GL posting engine | shared post() |
| GST extract | gst-extract.service / tax-compliance routes |
| Simulated NIC e-invoice / e-way | GstEInvoice / GstEWayBill |
| Default account mapping keys | GST_INPUT_* / GST_OUTPUT_* / RCM_* |
| FE tax resolution client | taxResolutionApi.ts |
| Supply determination helpers | gstSupply / BE supply service |
| Credit note proportional tax | customer-credit-note-calculation |
| Existing docs | GST_TAX_RESOLUTION, TAX_COMPLIANCE_STATUS, UNIFIED_SALES_INVOICE, AP_CALCULATION_RULES |

---

## 5. Highest-risk defects (ordered)

1. **Silent 18%** on commercial line create and product pick (no master resolve).  
2. **Two tax math stacks** (JS number commercial vs Decimal AR/AP).  
3. **No mandatory UNRESOLVED state** when HSN/group/rate missing.  
4. **Line snapshot incompleteness** until Accounting invoice.  
5. **Seller GSTIN / POS** from constants instead of LE/branch.  
6. **Party classification** insufficient for export/SEZ/composition.  
7. **Portal** simulated only; returns demo.  
8. **Override path** without `tax.gst.override` + audit.

---

## 6. Related documentation (pre-Phase-0)

| Document | Relevance |
|----------|-----------|
| `docs/accounting/GST_TAX_RESOLUTION.md` | Policy: masters → resolve only |
| `docs/accounting/TAX_COMPLIANCE_STATUS.md` | Extract + e-invoice SIM status |
| `docs/accounting/UNIFIED_SALES_INVOICE.md` | Canonical AR SI |
| `docs/accounting/AP_CALCULATION_RULES.md` | AP GST/RCM/ITC |
| `docs/accounting/CRM_TAX_INVOICE_MONEY_IN_BRIDGE.md` | CRM → AR bridge |
| `docs/dispatch/DISPATCH_EWAY_BILL.md` / auto SI | Dispatch/e-way adjacent |
| `docs/master-module-audit.md` | Masters + sales hardcode warning |

---

## 7. Phase 0 exit criteria

| Criterion | Status |
|-----------|--------|
| Audit of hardcoded rates | Done (this doc §3.1) |
| Audit of masters / party / POS / docs / adapters | Done |
| Gap matrix | [`TAX_GAP_MATRIX.md`](./TAX_GAP_MATRIX.md) |
| Implementation plan (phased) | [`TAX_IMPLEMENTATION_PLAN.md`](./TAX_IMPLEMENTATION_PLAN.md) |
| Code changes for GST product | **Out of scope for Phase 0** |

---

## 8. Verdict

| Label | Outcome |
|-------|---------|
| Phase 0 Audit | **COMPLETE** |
| TAX DETERMINATION READY | **NO** |
| GST ACCOUNTING READY | **PARTIAL** (AR/AP only) |
| GST RETURNS PREPARATION READY | **NO** |
| GST PORTAL INTEGRATION READY | **NO** |
| FULL GST COMPLIANCE READY | **NO** |

**Stop for review.** Proceed to Phase 1 only after approval of gap matrix and plan.
