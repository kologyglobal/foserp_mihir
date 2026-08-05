# Item Master — Functional Rules (Source of Truth)

**Status:** Frozen for Multi-UOM Phase 1 planning  
**Last verified:** 2026-08-05  
**Scope:** Item Master → Purchase → Inventory → Production material flow  
**Related:** [`item-master-gap-report.md`](./item-master-gap-report.md), [`../PURCHASE_MULTI_UNIT_UOM.md`](../PURCHASE_MULTI_UNIT_UOM.md), [`../platform/MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md`](../platform/MULTI_UOM_PHASE1_IMPLEMENTATION_PLAN.md)

---

## Principle

Item Master is the **single brain** for how an item behaves across modules.

Downstream documents (PR, PO, GRN, stock movements, production issues) must **read and enforce** Item Master rules — not invent parallel logic.

If Purchase Setup or tenant defaults apply, they are **fallbacks only** when Item Master leaves a field empty (e.g. receiving tolerance not set on item).

---

## Item Master is the source of truth for

| Area | Controlled by | Notes |
|------|---------------|-------|
| **Stock UOM** | Item Master (`baseUomId`) | All inventory, FIFO, and stock balances post in base UOM. |
| **Purchase UOM** | Item UOM Conversion (`MasterItemUomConversion`) | Default purchase unit = row with `isDefaultPurchase` among `isPurchaseAllowed` rows. Legacy fallback: `purchaseUomId`. |
| **Conversion factor** | Item UOM Conversion | Vendor units **per 1 base unit** (e.g. factor 50 ⇒ 1 NOS = 50 KG). |
| **Purchase allowed** | Item UOM Conversion (`isPurchaseAllowed`) | Which alternate UOMs may appear on PO / GRN / vendor docs. Base row may be purchase-allowed (factory enters NOS on PR). |
| **GRN quantity tolerance** | Item Master (`receivingToleranceId`) | Excess vs open PO **unit** qty. Dual-read legacy: `receivingTolerancePercentage`. |
| **Weight tolerance** | Item Master (`weightReceivingToleranceId`) | Excess vs expected weight when weight receipt applies. |
| **Receipt entry mode** | Item Master (`receiptEntryMode`) | `UNIT_ONLY` \| `WEIGHT_ONLY` \| `UNIT_AND_WEIGHT` — drives GRN fields and weight evaluation. |
| **Standard weight / weight UOM** | Item Master | `standardWeightPerBaseUnit`, `weightUomId`, `requireWeightAtReceipt`. |
| **QC requirement** | Item Master (`qcRequired`) | Incoming inspection on GRN when enabled. |
| **Batch / serial tracking** | Item Master (`batchTracked`, `serialTracked`) | Per-item traceability on GRN and inventory posting. |
| **Consumption allowed** | Item UOM Conversion *(planned)* | Which UOM production/WO may issue in. **Not in schema yet** — see gap report. |
| **Consumption UOM** | Item UOM Conversion *(planned)* | Default issue UOM for BOM/WO. **Not in schema yet.** |
| **Sales UOM** | Item Master (`salesUomId`) | CRM / SO line UOM; falls back to base UOM when null. |
| **Sales price (interim)** | Item Master (`defaultSalesRate`) | CRM sales price — not `standardRate`. |
| **Purchasable flag** | Item Master (`isPurchasable`) | Gate for PO / GRN catalog. |
| **Stockable flag** | Item Master (`isStockable` / `inventoryType`) | Gate for inventory posting. |

---

## Explicitly NOT Item Master (by design)

| Area | Belongs to | Reason |
|------|------------|--------|
| **Reorder level / reorder qty** | Inventory Planning (`Item + Warehouse`) | Same SKU can differ by plant/warehouse. Fields remain on `MasterItem` for legacy/demo only; **removed from Item Master UI** (2026-08-05). Target: `Inventory Planning Setup`. |
| **Over-receipt policy (tenant)** | Purchase Setup | Tenant-wide default when item tolerance is blank. |
| **Vendor rate** | PO / VQ / comparison | Commercial; not master. |
| **GST split (CGST/SGST/IGST)** | Finance tax resolver | SO/PO use flat `taxPct` until finance bridge is unified. **On hold.** |

---

## UOM conversion semantics (canonical)

### Direction (must be shown to users)

Always express as:

```text
1 {BASE} = {FACTOR} {PURCHASE_UOM}
```

Example: **1 NOS = 50 KG** — never show only `Factor: 50`.

### Storage (database)

| Field | Meaning |
|-------|---------|
| `MasterItem.baseUomId` | Stock / primary UOM |
| `MasterItemUomConversion.conversionFactor` | Units of `uomId` per **1** base unit |
| `PurchaseOrderLine.quantity` | Base / stock qty |
| `PurchaseOrderLine.uomQuantity` | Vendor / purchase qty |
| `PurchaseOrderLine.uomConversionFactor` | Snapshot of factor at transaction time |
| `PurchaseOrderLine.rate` | Rate per **purchase UOM** |

Formulas (see [`PURCHASE_MULTI_UNIT_UOM.md`](../PURCHASE_MULTI_UNIT_UOM.md)):

```text
quantity = uomQuantity / uomConversionFactor
lineAmount = rate × uomQuantity
unitCostPrimary = rate × uomConversionFactor
```

Inventory and costing always use **base qty** (`quantity`).

---

## Receipt entry mode → GRN behavior

| Mode | GRN asks | Tolerance |
|------|----------|-----------|
| **UNIT_ONLY** | Purchase/base unit qty only | `receivingToleranceId` on unit variance |
| **WEIGHT_ONLY** | Weight qty (+ weight UOM) | `weightReceivingToleranceId` on weight variance |
| **UNIT_AND_WEIGHT** | Both unit qty and weight | Both tolerances; weight compared to `standardWeightPerBaseUnit × base qty` |

`requireWeightAtReceipt` blocks save/post when weight is missing for weight-capable modes.

---

## Traceability flags → GRN behavior

| Flag | When received qty > 0 |
|------|------------------------|
| `batchTracked` | Batch or lot number required |
| `serialTracked` | Serial number required |
| `qcRequired` | QC / inspection path on GRN |

Tenant Purchase Setup may add **global** batch/serial/expiry requirements on top; item flags are **per-SKU** minimum.

---

## Downstream module contract (read-only rules)

### Purchase Requisition

- Lines store `requiredQuantity` + `uomId` (selected from Item Master purchase-allowed UOMs).
- **Requirement:** When factory enters base UOM qty, system must show **derived purchase qty** (and vice versa) before PO — see gap report (PR dual display).
- Rate on PR is **estimated**; not authoritative.

### Purchase Order

- Default line UOM = Item Master default purchase UOM.
- User may switch among purchase-allowed UOMs.
- Must show **purchase qty + stock qty** when factor ≠ 1.
- Rate is always per **purchase UOM**.

### GRN

- Receive in **purchase UOM**; derive base qty via factor.
- Enforce item receipt mode, tolerances, batch/serial, QC.
- Display ordered/received in both UOMs when dual-UOM item.

### Inventory

- Balances in **base UOM** only.
- Batch/serial from Item Master flags.

### Production / WO issue *(target state)*

- Issue qty in **consumption UOM** (when different from stock).
- Convert to base for ledger — requires Consumption UOM on conversion table (planned).

---

## Reference test items (UAT fixtures)

Use these three items to validate Item → Purchase → GRN before Phase 1 coding:

### Item 1 — RM-MS-PIPE-DN25 (KG purchase, unit+weight)

| Attribute | Value |
|-----------|-------|
| Base UOM | NOS |
| Purchase UOM | KG |
| Conversion | 1 NOS = 50 KG |
| Receipt mode | UNIT_AND_WEIGHT |
| Qty tolerance | 2% |
| Batch/serial | As needed for steel |

### Item 2 — RM-MS-PIPE-6M (length purchase)

| Attribute | Value |
|-----------|-------|
| Base UOM | NOS |
| Purchase UOM | MTR |
| Conversion | 1 NOS = 6 MTR |
| Qty tolerance | 1% |
| Receipt mode | UNIT_ONLY |

### Item 3 — FG-CAST-WHEEL (casting, weight tolerance)

| Attribute | Value |
|-----------|-------|
| Base UOM | NOS |
| Purchase UOM | KG |
| Conversion | 1 NOS = 25 KG |
| Weight tolerance | 5% |
| Receipt mode | UNIT_AND_WEIGHT (recommended) |

---

## Change control

1. **Freeze** this document before Multi-UOM Purchase Phase 1 implementation.
2. Any new Item Master field must update this table + gap report + API DTO.
3. Modules must not hardcode `batchControlled: false`, `factor: 1`, or ignore `receiptEntryMode` — Item Master wins.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-08-05 | Initial freeze: source-of-truth table, reorder moved out of Item Master UI, Multi-UOM contract linked |
