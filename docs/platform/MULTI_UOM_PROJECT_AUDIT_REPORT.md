# Multi-UOM Full Project Audit Report

**Date:** 2026-08-06  
**Scope:** Entire FOS ERP repository — Item Master through Accounting & Reports  
**Method:** Read-only audit of Prisma schema, migrations, backend services, frontend UI, PDFs, inventory posting, FIFO, and existing test/audit scripts  
**Contract reference:** [`MULTI_UOM_TRANSACTION_CONTRACT.md`](./MULTI_UOM_TRANSACTION_CONTRACT.md), [`../PURCHASE_MULTI_UNIT_UOM.md`](../PURCHASE_MULTI_UNIT_UOM.md)

---

## Executive Summary

Multi-UOM is **production-grade on the transactional purchase→stock path**:

```
Item Master (conversions) → PO (dual qty + snapshot) → GRN (receive in vendor UOM) → Inventory ledger (base) → FIFO (base)
```

It is **not production-grade upstream or downstream** of that path:

```
PR → RFQ → VQ → Comparison  (single qty, no factor snapshot)
QC complete → GRN accepted/rejected UOM columns may drift
Returns, Gate, Sales, Reports  (base-only or free-text UOM)
```

**Recommendation:** Complete Phase B (PR/RFQ/VQ dual-qty schema + UI) and QC UOM sync **before** BIN-wise stock. BIN answers *where* stock is; Multi-UOM answers *how much* — wrong quantities in more locations multiply errors.

### Status at a Glance

| Module | Status | Risk |
|--------|--------|------|
| Item Master | **~80%** | Medium |
| Purchase Requisition | **~40%** | High |
| RFQ | **~30%** | High |
| Vendor Quotation | **~25%** | High |
| Purchase Comparison | **~55%** | Medium–High |
| Purchase Order | **~90%** | Low |
| Gate Entry | **~15%** | Medium |
| GRN | **~75%** | Low–Medium |
| Quality Inspection | **~50%** | Medium–High |
| Inventory Ledger | **~70%** | Low (ledger) / Medium (display) |
| FIFO Costing | **~85%** | Low |
| Stock Transfer | **N/A** | — |
| Production Consumption | **~60%** | Low |
| Sales / Invoice (outbound) | **~20%** | Medium |
| Accounting | **~65%** | Low–Medium |
| Reports & PDFs | **~45%** | Medium |

---

## Locked Quantity Contract

Source: `backend/src/modules/purchase/shared/uom-conversion.ts`

| Field | Meaning |
|-------|---------|
| `uomQuantity` / `receivedUomQuantity` | Vendor / commercial qty (e.g. 5000 KG) |
| `quantity` / `receivedQuantity` | Primary / stock / base qty (e.g. 100 NOS) |
| `uomConversionFactor` | Vendor units **per 1 base unit** (e.g. 50 → 1 NOS = 50 KG) |

**Formulas:**

```
quantity         = uomQuantity / uomConversionFactor
uomQuantity      = quantity × uomConversionFactor
unitCostPrimary  = rate × uomConversionFactor
lineAmount       = rate × uomQuantity
```

**Display rule:** `1 {BASE} = {factor} {TRANSACTION_UOM}` — users enter transaction qty only; base qty is always derived.

---

## Example Scenario Trace (MS PIPE DN25)

| Step | Vendor/commercial | Stock/base | Status |
|------|-------------------|------------|--------|
| Item Master | 1 NOS = 50 KG | Base = NOS | ✅ Supported |
| PR need 100 NOS | Should show 5000 KG estimate | 100 NOS | ⚠️ UI partial; no API snapshot |
| RFQ to vendor | Should say 5000 KG | 100 NOS equiv | ❌ Single qty; UOM not persisted on API RFQ |
| VQ @ ₹80/KG | 5000 KG | — | ⚠️ Comparison→PO path works if VQ qty is commercial |
| PO | 5000 KG @ ₹80 | 100 NOS | ✅ Full dual fields + snapshot |
| Gate truck | 5000 KG expected | — | ❌ Free-text `approxQty` + `uom` string only |
| GRN receive 5100 KG | 5100 KG (2% tolerance) | 102 NOS | ✅ `receivedUomQuantity` drives base |
| QC reject 500 KG | — | — | ⚠️ QC works in base only; GRN `acceptedUomQuantity` may not sync |
| Inventory | Audit optional on movement | +102 NOS on hand | ✅ Ledger is base |
| FIFO layer | — | 102 NOS @ ₹4000/NOS | ✅ Base only (correct) |
| Production consume 10 NOS | — | −10 NOS | ✅ Base only (by design) |
| Purchase Invoice | 5000 KG snapshots | Base qty for match | ✅ Snapshots on invoice line |
| Stock report | — | 92 NOS on hand | ⚠️ No equivalent KG column |

---

## Audit Area 1: Item Master

### Module
Item Master (`MasterItem`, `MasterItemUomConversion`)

### Current Implementation
- **Base UOM** (`baseUomId`) — required; stock ledger anchor.
- **Conversion table** (`MasterItemUomConversion`) — multiple alternate UOMs per item with `conversionFactor`, `isPurchaseAllowed`, `isDefaultPurchase`.
- **Legacy mirror** — `purchaseUomId`, `uomConversionFactor`, deprecated `purchaseQtyPerUom` synced from default conversion row via `item-uom-conversion.service.ts`.
- **Sales UOM** — `salesUomId` (optional; falls back to base).
- **Weight / receipt modes** — `receiptEntryMode`, `weightUomId`, `standardWeightPerBaseUnit`, quantity + weight tolerances.
- **No dedicated `consumptionUomId`** — production/BOM uses base UOM by design.

### Database Support
| Requirement | Status |
|-------------|--------|
| Base UOM | ✅ `baseUomId` |
| Purchase UOM | ✅ Via conversion rows + legacy `purchaseUomId` |
| Sales UOM | ✅ `salesUomId` |
| Consumption UOM | ⚠️ Implicit = base (no separate column) |
| Conversion table | ✅ `master_item_uom_conversions` |
| Decimal precision | ✅ `Decimal(18,4)` |
| Weight handling | ✅ Weight UOM + tolerance masters |
| Conversion direction | ✅ Documented: units of alternate per 1 base |

### API Support
- CRUD via `/masters/items` with `uomConversions[]`.
- `resolvePurchaseLineUomFromMappings()` resolves PO line UOM from item mappings.
- Validation in `item.validation.ts`.

### Frontend Support
- **Edit:** `ItemUomConversionEditor.tsx` — clear “1 BASE = N FACTOR UOM” labels.
- **View:** Detail page shows base UOM only; no read-only conversion table.
- Unused legacy component: `ItemPurchaseMultiUnitFields.tsx`.

### Missing
1. **Vendor-specific purchase UOM** — one item can have multiple purchase-allowed UOMs (Vendor A: KG, Vendor B: MTR) via conversion rows, but **no per-vendor UOM preference** on vendor-item master.
2. **Effective-dated conversions** — master change applies to new docs only; no history table for “factor was 50 on date X”.
3. **Consumption UOM column** — deferred; BOM uses base.
4. **Item detail view** — no conversion table readout.

### Risk Level
**Medium** — architecture is correct; legacy dual-path and missing vendor-specific UOM can cause user confusion.

### Recommended Fix
1. Keep `MasterItemUomConversion` as SoT; finish deprecating legacy-only reads.
2. Add read-only conversion table on Item detail page.
3. Phase C: vendor-item default purchase UOM (optional).
4. Document that consumption UOM = base unless future pack-UOM consumption is scoped.

---

## Audit Area 2: Purchase Requisition

### Module
Purchase Requisition (`PurchaseRequisitionLine`)

### Current Implementation
- Stores `requiredQuantity` + `uomId` only.
- Frontend editor shows dual qty via `PurchaseLineQtyCell` (resolves factor from item master client-side).
- `orderedQuantity` tracks PO conversion in same scalar field — ambiguous when PR UOM ≠ PO commercial UOM.
- Phase B contract approved but **not migrated**.

### Database Support
| Field | Present |
|-------|---------|
| `requiredQuantity` | ✅ |
| `requiredUomId` / `uomId` | ✅ |
| `purchaseUomQuantity` | ❌ |
| `purchaseUomId` | ❌ |
| `uomConversionFactor` (snapshot) | ❌ |
| `baseQuantity` (explicit) | ❌ |

### API Support
- Create/update accepts `requiredQuantity`, `uomId`.
- No server-side dual-qty normalization or factor snapshot.

### Frontend Support
- Editor: dual display when item has alternate purchase UOM.
- Detail: may show wrong base sub-line (factor not re-resolved from API).
- Print: **broken** — `PurchaseRequisitionPrintPage` passes `l.quantity` as stock qty without factor.
- Planning sheet: single UOM only.

### Missing
- Dual-qty persistence (Phase B schema).
- Snapshot at PR submit.
- PR→PO should pass both requirement qty (NOS) and purchase qty (KG).

### Risk Level
**High** — upstream demand document; wrong interpretation propagates to RFQ/PO.

### Recommended Fix
1. **Phase B migration:** add `purchaseUomQuantity`, `purchaseUomId`, `uomConversionFactor`, clarify `requiredQuantity` as base requirement.
2. Snapshot factor on PR approval/submit.
3. Fix PR print + detail to use `resolveDualQtyForPrint`.
4. PR→PO mapping: pass commercial qty to PO `uomQuantity`.

---

## Audit Area 3: RFQ

### Module
Request for Quotation (`RequestForQuotationLine`)

### Current Implementation
- Mirrors PR: `requiredQuantity` + `uomId`.
- Editor has dual UI; API mapper **drops UOM on save** and returns `uom: ''` on load.
- No conversion factor on line.

### Database Support
Single qty + `uomId` only. No dual fields.

### API Support
Partial — stores `uomId` in DB but frontend domain mapper loses it.

### Frontend Support
| Surface | Dual UOM |
|---------|----------|
| Editor | ✅ |
| Detail | ❌ |
| Print | ❌ |

### Missing
- Persist UOM + factor on RFQ line.
- PDF showing “Required: 5000 KG (equiv. 100 NOS)”.
- PR→RFQ factor carry-forward.

### Risk Level
**High** — vendor communication uses wrong or blank UOM after reload.

### Recommended Fix
1. Phase B: same dual fields as PR.
2. Fix `mapDomainRfqInputToApiPayload` / `mapApiRfqToDomain`.
3. RFQ print dual-qty columns.

---

## Audit Area 4: Vendor Quotation

### Module
Vendor Quotation (`VendorQuotationLine`)

### Current Implementation
- `quantity` + `uomId` + `rate` — **commercial qty intended** on award→PO path.
- Frontend: free-text `uom` input, no item-master UOM picker, no conversion factor.
- Rate assumed per whatever UOM vendor typed.

### Database Support
Single `quantity`, `uomId`, `rate`. No `uomQuantity`/`quantity` split.

### API Support
Stores `uomId` in DB; frontend often sends empty.

### Frontend Support
No multi-UOM integration. Comparison grid: `{quantity} {uom}` single column.

### Missing
- Dual qty display (vendor qty + stock equivalent).
- Normalized rate per base for comparison.
- UOM validation against item allowed purchase UOMs.

### Risk Level
**High** — vendor quotes ambiguous; comparison ranking can compare apples to oranges if UOMs differ.

### Recommended Fix
1. Phase B: `uomQuantity` (commercial), derived base qty, factor snapshot.
2. VQ editor: item-linked UOM picker + dual qty cell (reuse PO pattern).
3. Show `₹80/KG` and `₹4000/NOS` side by side.

---

## Audit Area 5: Purchase Comparison

### Module
Vendor Comparison (`VendorComparisonLine`)

### Current Implementation
- Stores `quantity`, `rate`, `amount` — **no UOM id or factor** on comparison line.
- Award → PO: VQ `quantity` → PO `uomQuantity`, then `preparePurchaseOrderLinesForCreate()` normalizes (Phase 1.1 fix).
- Works when VQ qty is in commercial UOM and item factor is correct.

### Database Support
No dual fields on `VendorComparisonLine`.

### API Support
PO creation path fixed in Phase 1.1 (`MULTI_UOM_PHASE1_1_REPORT.md`).

### Frontend Support
Single qty/rate columns; no normalized “cost per NOS” column.

### Missing
- Comparison normalized to base UOM for ranking.
- Display both vendor rate and base rate.
- Snapshot UOM on comparison line.

### Risk Level
**Medium–High** — PO path safe if VQ commercial; UI comparison still misleading.

### Recommended Fix
1. Comparison service: compute `unitCostPrimary` per line for display/ranking.
2. Phase B: persist UOM + factor on comparison lines.
3. UI column: “Rate / KG” and “Rate / NOS”.

---

## Audit Area 6: Purchase Order

### Module
Purchase Order (`PurchaseOrderLine`) — **reference implementation**

### Current Implementation
Full dual-qty model with snapshots at create/edit.

### Database Support
| Field | Present |
|-------|---------|
| `quantity` (base) | ✅ |
| `uomQuantity` (commercial) | ✅ |
| `uomId` | ✅ |
| `uomConversionFactor` | ✅ |
| `unitCostPrimary` | ✅ |
| `rate` (per commercial UOM) | ✅ |
| `receivedQuantity` (base cumulative) | ✅ |

### API Support
✅ `preparePurchaseOrderLinesForCreate()`, `enrichPoLinesWithItemUomMappings`, factor validation.

### Frontend Support
✅ Editor, detail, revise, print — stacked vendor/base qty, factor visible on revise.

### Missing
- `receivedUomQuantity` on PO line (derived for display only).
- Planning “Create PO” modal: single qty display.

### Risk Level
**Low**

### Recommended Fix
Minor UX: planning modal dual qty; optional `receivedUomQuantity` denormalized column for reporting.

---

## Audit Area 7: Gate Entry

### Module
Gate (`GateMaterialInward`)

### Current Implementation
- Logistics/security module — **not integrated with PO dual qty**.
- Fields: `approxQty` (float), `uom` (free string), `materialSummary`, `linesJson` (JSON blob).
- Optional `linkedGrnNumber`; no structured PO line linkage with expected commercial qty.

### Database Support
No `uomQuantity`, `uomConversionFactor`, or PO line FK on gate lines.

### API Support
Demo/API gate services — no purchase UOM resolution.

### Frontend Support
Mobile gate + register pages — approximate qty entry, no PO line expected qty pull.

### Missing
- Expected qty from PO in **vendor UOM** (5000 KG not 100 NOS).
- Weighbridge / gross weight tied to commercial UOM.
- Tolerance preview at gate.

### Risk Level
**Medium** — operational mismatch between truck weight and ERP expectation; does not corrupt ledger directly but causes receiving errors.

### Recommended Fix
1. Gate inward from PO: prefill `expectedUomQty` + UOM code from PO line.
2. Show stock equivalent for security staff.
3. Phase after PR/PO path stable — gate is advisory until GRN.

---

## Audit Area 8: GRN

### Module
Goods Receipt (`GoodsReceiptLine`) — **strong implementation**

### Current Implementation
- User enters **vendor UOM** (`receivedUomQuantity`); base computed via `resolveDualQuantities`.
- Full dual columns: ordered/received/accepted/rejected in both UOMs.
- Tolerance (qty + weight) with excess/short/damage handling in base.
- Factor copied from PO; **cannot override** on receive (`assertGrnLineMatchesPoUom`).

### Database Support
✅ All dual fields + `uomCodeSnapshot`, tax snapshots, tolerance snapshots.

### API Support
✅ `goods-receipt.service.ts` — prefer `receivedUomQuantity`, compute base.

### Frontend Support
✅ Editor (receive in vendor UOM), print (dual), detail partial (Received dual; Ordered/Accepted/Rejected often base-only).

### Missing
1. QC complete does not update `acceptedUomQuantity` / `rejectedUomQuantity` when primary qty changes.
2. Partial reverse: `reversedQuantity` base only — no `reversedUomQuantity`.
3. Detail columns inconsistent for dual display.

### Risk Level
**Low–Medium** — receive path solid; QC sync gap causes vendor-qty column drift.

### Recommended Fix
1. **P1:** On QI complete, recompute GRN `acceptedUomQuantity` / `rejectedUomQuantity` from factor snapshot.
2. Mirror UOM on partial reverse lines.
3. Detail page: dual qty on all tracking columns.

---

## Audit Area 9: Quality Inspection

### Module
Quality Inspection (`PurchaseQualityInspectionLine`)

### Current Implementation
- All quantities in **base UOM only**: `inspectedQuantity`, `acceptedQuantity`, `rejectedQuantity`.
- Created from GRN `receivedQuantity` (base) / `acceptedForQcQuantity`.
- On complete: updates GRN `acceptedQuantity` / `rejectedQuantity` (base) — **not** vendor UOM columns.

### Database Support
No UOM fields on QI line.

### API Support
Base qty math only.

### Frontend Support
Single qty fields; no dual display for dual-UOM GRNs.

### Missing
- QC in vendor UOM option (inspect 5000 KG, reject 500 KG).
- Sync to GRN `acceptedUomQuantity` / `rejectedUomQuantity`.
- Clear labeling: “Reject 500 KG = 10 NOS”.

### Risk Level
**Medium–High** — users may mis-enter or misread quantities on weight-based items.

### Recommended Fix
1. QI UI: show received in both UOMs; accept/reject in vendor UOM with base preview.
2. Backend: on complete, update both primary and vendor GRN columns using frozen factor.

---

## Audit Area 10: Inventory Ledger

### Module
Inventory (`InventoryStockMovement`, `InventoryStockBalance`)

### Current Implementation
- **Ledger SoT:** `quantity` signed, always **base UOM**.
- Movements optionally store audit: `uomQuantity`, `uomId`, `uomConversionFactor` (GRN inward posts these).
- Balances: `onHandQty` and status buckets — base only.

### Database Support
| Concept | Support |
|---------|---------|
| Transaction qty (audit) | ✅ Optional on movement |
| Base qty (ledger) | ✅ Required |
| Balance buckets | ✅ Base only |

### API Support
- `postGrnStockInward` passes vendor qty audit fields.
- Issues/consumption/transfers: base qty only, often **no** UOM audit on movement.

### Frontend Support
Inventory pages: base UOM only (by design for stock).

### Missing
1. Balance API recomputes display `uomQuantity = onHand × current master factor` (`inventory.mappers.ts`) — **uses live factor, not receipt snapshot**.
2. Reverse/issue movements omit UOM audit.
3. No “equivalent KG” on stock detail.

### Risk Level
**Low** for stock correctness; **Medium** for reporting/display.

### Recommended Fix
1. Stop live factor recompute for historical display; use weighted average or last receipt factor.
2. Optional equivalent UOM on stock detail (informational).
3. Add UOM audit on all purchase-linked movements.

---

## Audit Area 11: FIFO Costing

### Module
FIFO (`InventoryCostLayer`, `InventoryCostLayerConsumption`)

### Current Implementation
- All layer quantities in **base UOM** (`originalQuantity`, `remainingQuantity`).
- `unitCost` = cost per base unit (`unitCostPrimary` from PO/GRN).
- GRN inward creates layers from base qty × `unitCostPrimary`.

### Database Support
✅ Base-only (correct design).

### API Support
✅ `purchase-inventory-posting.ts` → FIFO from base.

### Frontend Support
N/A (costing backend).

### Missing
None material for Multi-UOM — design is correct.

Example: 5000 KG @ ₹400,000 → layer 100 NOS @ ₹4,000/NOS ✅

### Risk Level
**Low**

### Recommended Fix
Maintain base-only contract; document in manufacturing costing guide.

---

## Audit Area 12: Production Consumption

### Module
Manufacturing (`ManufacturingBomLine`, `ProductionOrderMaterial`, material issue)

### Current Implementation
- BOM lines: `quantity` + `uomId` (expected = base).
- Material issue posts base qty via `postIssueToWorkOrder`.
- No pack-UOM consumption path.

### Database Support
Base UOM on BOM version snapshot (`baseUomId`).

### API Support
Issue in base only.

### Frontend Support
Base UOM on BOM/work-order pages.

### Missing
- Explicit “consumption UOM” separate from base (not required if factory always plans in NOS).
- Equivalent commercial qty display when consuming pipe stock.

### Risk Level
**Low** — consistent with “stock always in base” rule.

### Recommended Fix
Optional UI: show “10 NOS (= 500 KG)” on material issue confirmation for dual-UOM items.

---

## Audit Area 13: Stock Transfer

### Module
Stock Transfer

### Current Implementation
**No dedicated stock transfer module found** in Prisma schema (`StockTransfer` model absent). Inventory movements may support transfer posting separately.

### Database Support
N/A

### Risk Level
**N/A** — module not implemented.

### Recommended Fix
When built: transfers in **base UOM only**; optional display equivalent; no separate conversion on transfer.

---

## Audit Area 14: Sales & Outbound Invoice

### Module
CRM Sales Order (`CrmSalesOrder`), quotations

### Current Implementation
- Sales order lines stored in JSON (`lines` field) — typically single `qty` per line.
- `salesUomId` on item master; no dual-qty on sales documents.
- CRM/quotation→SO conversion — no multi-UOM pattern.

### Database Support
No `uomQuantity` / factor on sales lines (JSON schema).

### API Support
Base/commercial single qty.

### Frontend Support
Single UOM on sales order forms.

### Missing
Entire outbound dual-UOM path (sell in BOX, stock in NOS, etc.).

### Risk Level
**Medium** — purchase path mature; sales path not started.

### Recommended Fix
Phase D (post Phase B): mirror PO pattern for sales orders / dispatch / sales invoice.

---

## Audit Area 15: Accounting

### Module
Purchase Invoice, GL posting

### Current Implementation
- **Purchase Invoice Line:** `quantity` (base), `uomQuantitySnapshot`, `uomConversionFactorSnapshot`, `purchaseUomCodeSnapshot`.
- Amount = rate × commercial qty (via snapshots from GRN/PO).
- GL/inventory events use **base** `movement.quantity`.
- Purchase return AP handoff: base qty only.

### Database Support
✅ Invoice snapshots; ✅ base for valuation.

### API Support
✅ `purchase-invoice.service.ts` derives vendor qty from upstream snapshots.

### Frontend Support
✅ Purchase invoice print shows dual qty.

### Missing
- Reconciliation report: vendor qty vs stock qty side by side.
- Return documents: no commercial qty on AP credit.

### Risk Level
**Low–Medium** — purchase invoice trail good; returns weak.

### Recommended Fix
1. Three-way match UI: invoice KG vs GRN KG vs PO KG, stock NOS separately.
2. Return line: optional `returnUomQuantity` snapshot.

---

## Audit Area 16: Reports & PDFs

### PDF / Print Status

| Document | Dual UOM | Snapshots | Notes |
|----------|----------|-----------|-------|
| PO | ✅ | ✅ | Gold reference |
| GRN | ✅ | ✅ | Ordered + received dual |
| Purchase Invoice | ✅ | ✅ | Snapshot fields |
| PR | ❌ Broken | ❌ | Wrong `resolveDualQtyForPrint` inputs |
| RFQ | ❌ | ❌ | Single qty |
| Purchase Return | ❌ | ❌ | Single qty |
| QI | ❌ | — | Not audited for print |

### Reports
- Purchase report runner: no multi-UOM helpers found.
- Stock summary: base qty only, no equivalent column.
- No “Purchased KG / Stock NOS” report.

### Risk Level
**Medium**

### Recommended Fix
1. Fix PR print immediately (quick win).
2. Add stock summary equivalent UOM column (informational).
3. Purchase analytics: group by commercial UOM for vendor spend, base UOM for consumption.

---

## Cross-Cutting Findings

### Where Multi-UOM Exists
| Layer | Location |
|-------|----------|
| Master | `MasterItemUomConversion`, legacy fields |
| Transaction | PO lines, GRN lines, PI lines |
| Audit | Inventory movement (partial) |
| Tests | `multi-uom-phase1-unit.test.ts`, `test-purchase-multi-unit-uom-flow.ts` |
| SQL audit | `audit-multi-uom-data-consistency.sql` |

### Where Conversion Logic Exists
- `backend/src/modules/purchase/shared/uom-conversion.ts` — canonical formulas
- `backend/src/modules/items/item-uom-conversion.service.ts` — master sync + resolve
- `purchase-order.workflow.ts` — PO line normalization
- `goods-receipt.service.ts` — GRN receive normalization
- `frontend/src/utils/purchaseLineUom.ts`, `purchaseLineHasDualUom`

### Where Conversion Is Missing
PR, RFQ, VQ, Comparison (DB), QI (complete sync), Returns, Gate, Sales, Reports.

### Where Only Base Quantity Is Stored
QI lines, Return lines, FIFO layers, Inventory balances, Production issues, Comparison lines.

### Where Snapshots Are Missing
PR, RFQ, VQ, Comparison, QI, Returns, Gate; inventory balance display uses live master.

### Where UI Can Create User Mistakes
1. PR detail/print wrong base qty.
2. RFQ reload loses UOM.
3. VQ free-text UOM.
4. QI single-UOM entry on weight items.
5. Return UI label vs base qty from GRN.
6. Comparison without normalized rate.

---

## Existing Test & Audit Coverage

| Asset | Path | Covers |
|-------|------|--------|
| Data consistency SQL | `backend/scripts/audit-multi-uom-data-consistency.sql` | PO drift, GRN drift, items missing conversions |
| E2E live test | `backend/scripts/test-purchase-multi-unit-uom-flow.ts` | PO→GRN→inventory multi-line |
| Unit tests | `backend/tests/purchase/multi-uom-phase1-unit.test.ts` | Formulas, comparison→PO, invoice amount |
| Seed | `backend/scripts/seed-multi-uom-test-items.ts` | KG/MTR test items |

**Not covered:** PR/RFQ/VQ drift, QC UOM sync, return lines, balance display factor, partial-reverse UOM.

**Pre-BIN gate:** Run audit SQL (expect 0 PO/GRN drift) + E2E script before bin-wise stock.

---

## Priority Implementation Order

**Approved 2026-08-06** — execution order (do not start BIN until Sprint 5):

| Sprint | Scope | Status |
|--------|-------|--------|
| **Sprint 1** | QI → GRN UOM sync; GRN/QC/reverse validation; audit SQL QC drift check | **P0 — in progress** |
| **Sprint 2** | Phase B PR dual UOM (schema + UI: required NOS + purchase estimate KG + factor snapshot) | Planned |
| **Sprint 3** | RFQ / VQ / Comparison normalized ranking | Planned |
| **Sprint 4** | Purchase return commercial qty + reports | Planned |
| **Sprint 5** | BIN-wise stock | **Blocked** until Sprints 1–4 |

Foundation order:

```
Correct Quantity → Correct Conversion → Correct Stock → Correct Location (BIN)
```

| Priority | Item | Effort | Blocks |
|----------|------|--------|--------|
| **P0** | QI complete → sync GRN `acceptedUomQuantity` / `rejectedUomQuantity` | M | GRN vendor-qty reports, vendor disputes |
| **P0** | Extend `audit-multi-uom-data-consistency.sql` with QC UOM drift | S | Certification |
| **P1** | Phase B schema: PR dual fields + migration | L | Upstream chain |
| **P1** | PR UI: Required + Expected Purchase columns | M | Buyer errors |
| **P2** | RFQ/VQ persist UOM + factor snapshot; comparison normalize | L | Sourcing |
| **P2** | Purchase return commercial qty + snapshot | M | Vendor credits |
| **P3** | Inventory movement UOM snapshot (Phase C); balance display fix | M | Production audit trail |
| **P3** | Stock reports equivalent UOM | M | Management reporting |
| **P4** | Sales dual-UOM (Phase D) | L | Outbound |
| **P5** | BIN module | L | — |

---

## Audit Area 16: Stock Movement UOM Snapshot (Phase C)

| Aspect | Finding |
|--------|---------|
| **Module** | Inventory → `InventoryStockMovement` |
| **Current implementation** | Ledger **SoT = base `quantity`**. GRN inward optionally stores `uomQuantity`, `uomId`, `uomConversionFactor` as **audit** (not used for balance). Production issue, dispatch, returns, adjustments: **base qty only** — no commercial UOM on movement. |
| **Database support** | Partial — audit columns exist on movement; **missing** `baseUomCodeSnapshot`, `transactionUomCodeSnapshot`, factor snapshot on non-GRN paths. |
| **API support** | Posting correct in base; no historical commercial qty on consumption movements. |
| **Frontend support** | Movement lists show base UOM only. |
| **Missing** | When worker consumes 5 NOS and master factor later changes 50→55 KG, historical movement must stay **250 KG equivalent**, not recalculate to 275 KG. Requires **factor snapshot on movement at post time**. |
| **Risk level** | **Medium** (production consumption & audit depend on this) |
| **Recommended fix** | Phase C: add `baseUomCodeSnapshot` + persist `uomConversionFactor` on **all** stock movements that reference dual-UOM items; never recompute commercial qty from live master in reports. |

**Example:**

| Event | Base | Commercial (snapshot) |
|-------|------|---------------------|
| GRN inward | +100 NOS | +5000 KG @ factor 50 |
| Production issue | −5 NOS | −250 KG @ factor 50 (frozen) |
| Master change next week | — | Old movements unchanged |

---

## Approved Architecture Review (2026-08-06)

Broken chain (confirmed):

```
PR ❌  →  RFQ ❌  →  VQ ❌  →  Comparison ⚠️  →  PO ✅  →  GRN ✅  →  QI ❌  →  Inventory ✅  →  Invoice ✅
     ↑ before PO creation                              ↑ after GRN acceptance
```

**Hard parts already built:** PO dual qty, GRN conversion, FIFO base costing, tax snapshots.

**Focus areas:** material requirement origin (PR→VQ) and quantity change after receipt (QC, returns).

### QC transaction model (target)

Every QC disposition maintains **both**:

- **Base qty** — stock (e.g. 10 NOS rejected)
- **Commercial qty** — vendor/accounting (e.g. 500 KG rejected)
- **Factor snapshot** — from GRN line (e.g. 1 NOS = 50 KG)

**Sprint 1 deliverable:** `GRN → QC → Stock` keeps 100 NOS / 5000 KG consistent on accepted and rejected columns.

---

## Sprint 1 Implementation Log

| Change | Path | Notes |
|--------|------|-------|
| `syncGrnAcceptedRejectedUomFromBase()` | `backend/src/modules/purchase/shared/uom-conversion.ts` | Base × factor → commercial UOM |
| QI complete updates GRN | `quality-inspection.service.ts` | Sets `acceptedUomQuantity`, `rejectedUomQuantity` |
| Unit tests | `backend/tests/purchase/qi-grn-uom-sync.test.ts` | 90 NOS + 10 NOS @ 50 → 4500 + 500 KG |
| Audit SQL check #4/#5 | `audit-multi-uom-data-consistency.sql` | `grn_qc_uom_drift` gate |

---

## Per-Module Detail Table

| Module | Current Implementation | Database Support | API Support | Frontend Support | Missing | Risk | Recommended Fix |
|--------|------------------------|------------------|-------------|------------------|---------|------|-----------------|
| Item Master | Conversion table + legacy sync | 80% | ✅ | Edit ✅ / View partial | Vendor UOM, consumption col, detail view | Medium | Detail table; vendor-item UOM |
| PR | Client dual UI | 30% | Single qty | Editor ✅ / Print ❌ | Dual schema, snapshot | High | Phase B migration |
| RFQ | Editor dual only | 30% | UOM lost in mapper | Detail/print ❌ | Persist UOM+factor | High | Fix mappers + Phase B |
| VQ | Single qty | 25% | Partial | No integration | Full dual UOM | High | VQ editor like PO |
| Comparison | PO normalize on award | 40% | PO path ✅ | Single column | Normalized ranking | Med–High | Base rate column |
| PO | Full dual | 95% | ✅ | ✅ | Minor UX | Low | Reference — maintain |
| Gate | Free-text qty | 10% | ❌ | Approx only | PO commercial qty | Medium | PO prefill |
| GRN | Full dual receive | 90% | ✅ | Mostly ✅ | QC sync, reverse UOM | Low–Med | QC sync P1 |
| QC | Base only → **UOM sync on complete (Sprint 1)** | 20% | Base | Single qty | Vendor UOM on GRN line | Med–High | ✅ Sync done; optional QI dual display next |
| Inventory | Base ledger | 85% | ✅ ledger | Base only | Display factor | Low/Med | Fix balance mapper |
| FIFO | Base only | 100% | ✅ | N/A | None | Low | Keep design |
| Production | Base consume | 70% | ✅ | Base | Display equivalent | Low | Optional UI hint |
| Stock Transfer | Not built | N/A | N/A | N/A | Entire module | N/A | Base-only when built |
| Sales | Single qty JSON | 20% | Partial | Single | Outbound dual | Medium | Phase D |
| Accounting | PI snapshots | 75% | ✅ PI | PI print ✅ | Return commercial | Low–Med | Return UOM snapshot |
| Reports/PDF | PO/GRN/PI only | N/A | N/A | Mixed | PR/RFQ/Return | Medium | Fix PR print first |

---

## Related Documentation

| Doc | Purpose |
|-----|---------|
| [`MULTI_UOM_TRANSACTION_CONTRACT.md`](./MULTI_UOM_TRANSACTION_CONTRACT.md) | Binding contract |
| [`MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md`](./MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md) | Phase B field plan |
| [`MULTI_UOM_PHASE1_FINAL_REPORT.md`](./MULTI_UOM_PHASE1_FINAL_REPORT.md) | PO/GRN/Invoice stabilization |
| [`../master/item-master-gap-report.md`](../master/item-master-gap-report.md) | Item Master gaps |
| [`../inventory/INVENTORY_BIN_WISE_STOCK_GAP_REPORT.md`](../inventory/INVENTORY_BIN_WISE_STOCK_GAP_REPORT.md) | BIN prerequisite note |
| [`../purchase/PURCHASE_MODULE_CERTIFICATION_TEST_PLAN.md`](../purchase/PURCHASE_MODULE_CERTIFICATION_TEST_PLAN.md) | Certification checklist |

---

## Conclusion

Multi-UOM is a **transaction consistency layer**, not a single Purchase feature. The repository has a **clear contract** on **PO → GRN → Inventory → FIFO**. Upstream (PR→VQ) and post-receipt (QC, returns) were the gaps.

**Sprint 1 (P0) shipped:** QI complete now syncs GRN `acceptedUomQuantity` / `rejectedUomQuantity` from base qty × GRN factor snapshot — e.g. reject 10 NOS @ factor 50 → 500 KG on the GRN line.

**Do not proceed with BIN-wise stock until:**
1. `audit-multi-uom-data-consistency.sql` returns zero drift (including `grn_qc_uom_drift`) on target environment.
2. Sprint 2 Phase B PR dual UOM is implemented.
3. Sprint 3 RFQ/VQ/comparison normalization is scheduled.

**Next sprint:** Phase B PR schema (`purchaseEstimateQuantity`, `purchaseEstimateUomId`, `uomConversionFactorSnapshot`) + UI showing Required NOS + Expected Purchase KG.

---

*Audit baseline 2026-08-06. Sprint 1 P0 (QI→GRN UOM sync) implemented same day.*
