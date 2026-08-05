# Item Master — Gap Report (Purchase + Inventory + Production)

**Status:** Analysis only — **no implementation in this document**  
**Date:** 2026-08-05  
**Prerequisite doc:** [`item-master-functional-rules.md`](./item-master-functional-rules.md)  
**Next step:** Lock Item Master → start [`MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md`](../platform/MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md)

---

## Executive summary

Item Master is **~75% ready** for multi-UOM purchase flow. Backend schema and PO/GRN services already support dual qty, receipt modes, and weight tolerance. The largest gaps are:

1. **PR does not yet lead with factory (base) requirement + explicit expected purchase qty**
2. **Consumption UOM** missing entirely (production issue path)
3. **Conversion UX** still shows “Factor (per 1 NOS)” instead of “1 NOS = 50 KG”
4. **No explicit “Weight managed item” flag** — inferred from `receiptEntryMode` (works but opaque)
5. **Reorder** still in DB on `MasterItem` but correctly removed from UI — needs **Inventory Planning (Item + Warehouse)** home

**Recommendation:** Do **not** add random UI fields. Complete the table below in order: Consumption UOM (schema) → conversion labels → PR dual-qty UX → then Multi-UOM Phase 1 purchase stabilization.

---

## 1. Current fields (as implemented)

### 1.1 Database — `MasterItem`

| Field | In UI | Used downstream | Notes |
|-------|-------|-----------------|-------|
| `code`, `name`, `itemDescription` | Yes | All modules | |
| `categoryId`, `itemType`, `productType`, `inventoryType` | Yes | Filters, posting type | |
| `baseUomId` | Yes | Stock UOM SoT | |
| `purchaseUomId`, `uomConversionFactor`, `purchaseQtyPerUom` | Legacy | Fallback if no conversion rows | Deprecated path; prefer `MasterItemUomConversion` |
| `uomConversions[]` | Yes (editor) | PO/PR/GRN UOM pickers | |
| `receivingToleranceId`, `receivingTolerancePercentage` | Yes | GRN unit tolerance | Legacy % dual-read |
| `weightReceivingToleranceId` | Yes | GRN weight tolerance | When weight receipt |
| `receiptEntryMode` | Yes | GRN evaluator | UNIT_ONLY / WEIGHT_ONLY / UNIT_AND_WEIGHT |
| `standardWeightPerBaseUnit`, `weightUomId` | Yes | GRN expected weight | |
| `requireWeightAtReceipt` | Yes | GRN validation | |
| `batchTracked`, `serialTracked` | Yes | GRN + inventory | Recently wired from hardcoded false |
| `qcRequired`, `qualityTestGroupCode` | Yes | GRN / QI | |
| `salesUomId`, `defaultSalesRate`, `salesAllowed` | Yes | CRM / SO | |
| `reorderLevel`, `reorderQty` | **No** (UI removed) | Demo inventory planning only | Still in DB/API — **technical debt** |
| `standardRate` | Yes | Purchase reference | Not sales price |
| `isPurchasable`, `isStockable`, `isBlocked` | Yes | Catalog gates | |

### 1.2 Database — `MasterItemUomConversion`

| Field | In UI | Used downstream |
|-------|-------|-----------------|
| `uomId` | Yes | Alternate UOM |
| `conversionFactor` | Yes (as “Factor per 1 base”) | PO/GRN/PR factor |
| `isPurchaseAllowed` | Yes | UOM picker filter |
| `isDefaultPurchase` | Yes | Default PO/PR UOM |
| `isConsumptionAllowed` | **Missing** | — |
| `isDefaultConsumption` | **Missing** | — |

### 1.3 Frontend — Item edit (`ItemPages.tsx`)

Sections: General, Purchase, Sales, Tax, Inventory (snapshot only), Quality, Manufacturing, Attachments.

Purchase section includes: UOM conversion grid, standard rate, qty + weight tolerances, receipt entry mode, weight fields.

### 1.4 Backend — Item API

`item.validation.ts` accepts: `batchTracked`, `serialTracked`, `receiptEntryMode`, `weightReceivingToleranceId`, `uomConversions[]`, etc.

Item service persists conversions via `item-uom-conversion.service.ts`.

---

## 2. Missing fields (required for full Purchase + Inventory + Production)

| # | Proposed field | Purpose | Priority |
|---|----------------|---------|----------|
| 1 | **Consumption allowed** (per conversion row) | WO/BOM may issue in GRAM while stock is KG | **High** (production) |
| 2 | **Consumption UOM / default consumption** | Explicit factory issue unit | **High** |
| 3 | **Weight managed item** (boolean) OR document `receiptEntryMode ≠ UNIT_ONLY` as equivalent | Clear GRN “ask weight?” without reading enum | **Medium** (UX) |
| 4 | **Conversion direction label** in UI | “1 NOS = 50 KG” everywhere | **High** (UX, zero schema) |
| 5 | **Reorder at Item + Warehouse** | Replace `MasterItem.reorderLevel/Qty` | **Medium** (planning module) |
| 6 | **PR: requirement UOM vs purchase UOM columns** | Factory 100 NOS + expected 5000 KG | **High** (Phase B or PR enhancement) |

---

## 3. Database impact (proposed, not applied)

### 3.1 Consumption UOM (new)

```sql
-- Illustrative only — not migrated
ALTER TABLE master_item_uom_conversions
  ADD COLUMN isConsumptionAllowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN isDefaultConsumption BOOLEAN NOT NULL DEFAULT false;
```

Optional on `MasterItem`:

```sql
-- consumptionUomId UUID NULL  -- only if single default insufficient
```

**Migration risk:** Low — additive columns, default false.

### 3.2 Reorder relocation (future)

- New table e.g. `inventory_item_warehouse_policy (tenantId, itemId, warehouseId, reorderLevel, reorderQty, …)`
- Deprecate `MasterItem.reorderLevel/reorderQty` after data migration
- **Do not** re-expose reorder on Item Master UI

### 3.3 Weight managed flag (optional)

Could add `weightManaged Boolean` on `MasterItem` **or** derive from `receiptEntryMode != UNIT_ONLY` in code only (no migration). **Recommend derive-first** to avoid duplicate truth.

---

## 4. API impact

| Area | Current | Gap |
|------|---------|-----|
| `GET/POST/PATCH /masters/items` | Returns `uomConversions`, receipt fields, batch/serial | Add consumption flags when schema exists |
| `ItemDto` / `mapItemDto` / `itemToApiPayload` | Purchase conversion fields mapped | Extend for consumption |
| `purchaseApiFacade` mapMasterItem | Maps `batchControlled` from `batchTracked` | OK |
| PR line API | `requiredQuantity`, `uomId` only — **no** `uomConversionFactor` on `PurchaseRequisitionLine` | Factor resolved client-side from item; consider snapshot on line for audit |
| PO line API | `quantity`, `uomQuantity`, `uomConversionFactor`, `rate` | OK — matches contract |
| GRN line API | Dual qty + weight fields in backend | Frontend editor partially aligned — see Phase 1 plan |

---

## 5. UI impact

| Screen | Current behavior | Gap vs target |
|--------|------------------|---------------|
| **Item Master — UOM grid** | “Factor (per 1 NOS)” numeric | Show **1 NOS = 50 KG** sentence + factor |
| **Item Master — Purchase** | Receipt mode + weight fields present | Add helper text linking mode → GRN columns |
| **Item Master — Inventory** | Read-only snapshot only | OK after reorder removal |
| **PR lines** | Single qty cell; `PurchaseLineQtyCell` shows base qty as subline when dual UOM | **No explicit “Required (factory)” vs “Expected purchase” columns**; default UOM is purchase default, not base-first |
| **PO lines** | Qty cell shows purchase + base subline; rate per purchase UOM | Column headers still generic (“Qty”, “UOM”) — not split table user asked for |
| **GRN lines** | Receiving in purchase qty; tolerance columns exist | Full dual-UOM display + variance labels per Phase 6 spec — **in progress** ([`MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md`](../platform/MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md)) |
| **Inventory item form** | Separate `batchTracking` in demo inventory module | Must stay synced with Item Master in API mode |
| **Production issue** | Uses inventory item UOM | No consumption UOM from Item Master |

---

## 6. Flow verification (your Phases 3–6)

### Phase 3 — Three master items

| Item | Can configure today? | Blockers |
|------|----------------------|----------|
| RM-MS-PIPE-DN25 | **Yes** — base NOS, purchase KG, factor 50, UNIT_AND_WEIGHT, 2% qty tol | Create in Item Master + receiving tolerance master |
| RM-MS-PIPE-6M | **Yes** — 1 NOS = 6 MTR, 1% tol | Same |
| FG-CAST-WHEEL | **Yes** — weight tol 5% via `weightReceivingToleranceId` | Ensure weight receipt mode set |

### Phase 4 — Purchase Requisition

**Question:** Can PR show factory 100 NOS **and** expected purchase 5000 KG?

| Capability | Status |
|------------|--------|
| Enter qty in NOS (base) if base is purchase-allowed | **Partial** — base row in conversion grid must have Purchase ✓ |
| Enter qty in KG (default purchase UOM) | **Yes** |
| Auto-show opposite UOM qty | **Partial** — small subline in `PurchaseLineQtyCell`, not dedicated columns |
| Persist conversion on PR line | **No** — not stored on `PurchaseRequisitionLine`; recomputed from item |
| Buyer sees expected KG when factory wrote NOS | **Risky** — easy to miss subline; **biggest PR gap** |

### Phase 5 — PO creation

**Target:** MS Pipe 5000 KG / 100 NOS @ ₹80/KG

| Capability | Status |
|------------|--------|
| Dual qty on line | **Yes** (subline display) |
| Rate per purchase UOM | **Yes** when PO line uses purchase UOM |
| Explicit column headers Purchase vs Stock | **No** — generic “Qty” / “UOM” |
| Comparison → PO dual qty | **Gap** — Phase 1 plan item #1 |

### Phase 6 — GRN

**Target:** Ordered 5000 KG → Received 5100 KG → 102 NOS, +2% within tolerance

| Capability | Status |
|------------|--------|
| Backend tolerance evaluation | **Yes** (`receipt-line-evaluator`, item tolerances) |
| Per-item batch/serial | **Yes** (recent) |
| Editor dual-UOM columns | **Partial** — Phase 1 GRN frontend work pending |
| Weight variance for casting | **Backend yes**; UI shows weight columns when mode ≠ UNIT_ONLY |

---

## 7. Reorder fields — disposition (Phase 7)

| Layer | Status | Action |
|-------|--------|--------|
| Item Master UI | **Removed** (2026-08-05) | Keep out |
| `MasterItem.reorderLevel/Qty` | Still in DB, seed, inventory live | **Do not use for new features** |
| `inventoryItemsLive` / planning | Reads item reorder | Migrate to **Item + Warehouse** policy |
| Target home | **Inventory Planning Setup** | New module/table — not Item Master |

Same item, different plants:

```text
Plant A warehouse: min 100 NOS
Plant B warehouse: min 500 NOS
```

---

## 8. Recommended implementation order (after this report)

```text
1. Lock item-master-functional-rules.md          ← done
2. Lock this gap report                          ← done
3. Item Master UX: conversion labels only        ← small, high value
4. Multi-UOM Phase 1 (Comparison→PO, Invoice, GRN FE, tests)  ← existing plan
5. Schema: consumption UOM on conversion table   ← Phase B
6. PR: factory qty + expected purchase columns    ← Phase B
7. Inventory Planning: reorder by item+warehouse ← separate track
8. Seed three UAT items + scripted flow test
```

**Do not start Step 4 until Steps 1–2 are accepted.**

---

## 9. Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Buyer manually converts NOS→KG on PR | **High** | PR dual-column UX + default base-first for internal reqs |
| `Factor: 50` mis-entry (inverse) | **High** | Direction labels “1 NOS = 50 KG” |
| Reorder in DB confuses reports | **Medium** | Document deprecated; migrate to warehouse policy |
| Demo inventory reorder vs Item Master | **Medium** | API mode uses item reorder from DTO until planning module |
| Two brains for batch/serial (inventory form vs item master) | **Medium** | API mode: Item Master only |

---

## 10. Files reviewed (evidence)

| Area | Path |
|------|------|
| Item form | `frontend/src/modules/masters/item/ItemPages.tsx` |
| UOM editor | `frontend/src/components/masters/ItemUomConversionEditor.tsx` |
| UOM utils | `frontend/src/utils/purchaseLineUom.ts` |
| PR lines UI | `frontend/src/components/purchase/PurchaseRequisitionLinesTable.tsx` |
| PO lines UI | `frontend/src/components/purchase/PurchaseOrderLinesTable.tsx` |
| Qty cell | `frontend/src/components/purchase/PurchaseLineQtyCell.tsx` |
| Schema | `backend/prisma/schema.prisma` (`MasterItem`, `MasterItemUomConversion`, `PurchaseRequisitionLine`) |
| Multi-UOM contract | `docs/PURCHASE_MULTI_UNIT_UOM.md` |
| Phase 1 plan | `docs/platform/MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md` |

---

## 11. Sign-off checklist

Before coding Multi-UOM Phase 1:

- [ ] Product owner accepts [`item-master-functional-rules.md`](./item-master-functional-rules.md)
- [ ] Product owner accepts this gap report priorities
- [ ] Three UAT items (Phase 3) agreed as regression fixtures
- [ ] Reorder confirmed **out of Item Master** permanently
- [ ] Consumption UOM scoped to Phase B (not blocking Phase 1 PO/GRN)

---

*Report generated from codebase inspection — no schema or UI changes applied.*
