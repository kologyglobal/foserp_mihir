# Multi-UOM Transaction Contract

**Status:** Approved (Phase 0) — binding for all purchase, inventory, manufacturing, and sales quantity work.  
**Scope:** Platform-wide inventory quantity framework (not purchase-only).  
**Source of truth in code:** `backend/src/modules/purchase/shared/uom-conversion.ts`

---

## 1. Purpose

Manufacturing ERP documents must always answer two questions:

1. **Commercial quantity** — what the supplier or customer sees (e.g. 5000 KG).
2. **Inventory quantity** — what the ledger stores (e.g. 100 NOS).

If any document stores only one quantity without the other, conversion factor, and UOM identifiers, the audit trail breaks across PR → RFQ → PO → GRN → stock → FIFO → production → invoice → accounting.

---

## 2. Master data architecture (do not rebuild)

```
MasterItem (baseUomId = stock UOM)
    │
    ├── MasterItemUomConversion[]  (alternate units + factor + allowed flags)
    │
    └── MasterReceivingTolerance (qty) + weightReceivingTolerance (weight) via FK — reusable masters
```

- **One base UOM per item** — all stock, FIFO, and production consumption use this.
- **Multiple conversion rows** — not separate “purchase UOM / stock UOM / consumption UOM” columns on the item.
- **Legacy fields** (`purchaseUomId`, `uomConversionFactor` on `MasterItem`) are denormalized mirrors of the default conversion row; new code must read from `uomConversions` first.

### Conversion factor semantics (locked)

```
conversionFactor = vendor/alternate units per 1 base unit
```

Example: **1 NOS = 50 KG** → `conversionFactor = 50` (KG is the alternate UOM).

Display rule for users:

```
1 {BASE} = {factor} {TRANSACTION_UOM}
```

---

## 3. Formulas (locked)

| Derived field | Formula |
|---------------|---------|
| Base (stock) quantity | `quantity = uomQuantity / uomConversionFactor` |
| Transaction quantity | `uomQuantity = quantity × uomConversionFactor` |
| Cost per base unit | `unitCostPrimary = rate × uomConversionFactor` |
| Line amount | `amount = rate × uomQuantity` (= `unitCostPrimary × quantity`) |

Where:

- `uomQuantity` — qty in **transaction/commercial** UOM (purchase, sales pack, etc.)
- `quantity` — qty in **base/stock** UOM
- `rate` — unit price **per transaction UOM** (e.g. ₹80/KG)
- `uomConversionFactor` — snapshot at document post time

**Rate UOM rule:** Always display and calculate rate as **per commercial/transaction UOM** (`₹{rate} / {purchaseUomCode}`). Never label vendor rate as per base unit unless factor is 1.

**Single editable quantity rule:** Users enter **transaction quantity** only. Base quantity is always calculated, never independently edited.

---

## 4. Field naming by document

| Concept | PO / GRN / Invoice lines | PR (Phase B) | Stock movement |
|---------|--------------------------|--------------|----------------|
| Transaction qty | `uomQuantity` / `receivedUomQuantity` / `uomQuantitySnapshot` | `purchaseUomQuantity` | `uomQuantity` (audit) |
| Transaction UOM | `uomId` + code snapshot | `purchaseUomId` | `uomId` |
| Base qty | `quantity` / `receivedQuantity` | `requiredQuantity` (requirement) + derived base | `quantity` (signed, ledger) |
| Base UOM | item `baseUomId` (+ snapshot where added) | `requiredUomId` | item `baseUomId` (+ `baseUomCodeSnapshot` Phase C) |
| Factor snapshot | `uomConversionFactor` | `uomConversionFactor` | `uomConversionFactor` |
| Rate UOM | implicit = transaction `uomId`; UI must label `₹rate / {UOM}` | same | N/A |

---

## 5. Snapshot rule (immutable after approval)

After a document line is **submitted / approved / posted** (per document workflow):

- `uomConversionFactor` **must not change** on that line.
- `uomId` / UOM code snapshots **must not change** on that line.
- Recalculation from current item master is **forbidden** for historical rows.

Example:

| When | Item master | PO line factor | Correct behaviour |
|------|-------------|----------------|-------------------|
| PO created | 1 NOS = 50 KG | 50 | Store 50 |
| 6 months later | 1 NOS = 52 KG | 50 | PO unchanged |
| New PO | 1 NOS = 52 KG | 52 | New PO uses 52 |

Item master changes affect **new documents only**.

---

## 6. Purchase requisition dual-UOM (Option A — approved)

PR is the **business requirement** anchor.

| Field | Meaning | Example |
|-------|---------|---------|
| `requiredQuantity` + `requiredUomId` | Production / department need | 100 NOS |
| `purchaseUomQuantity` + `purchaseUomId` | Buyer estimate in vendor unit | 5000 KG |
| `uomConversionFactor` | Snapshot at PR submit | 50 |

Audit answer: *“We bought 5000 KG because production requested 100 NOS at factor 50.”*

RFQ and vendor quotation inherit the same dual-qty pattern in Phase B.

---

## 7. Vendor quotation comparison (Phase B — required before PO)

All vendor quotes must normalize to **cost per base UOM** before rank/compare.

Example:

| Vendor | Quote | Total | Base qty | Cost / NOS |
|--------|-------|-------|----------|------------|
| A | 5000 KG @ ₹80/KG | ₹4,00,000 | 100 NOS | ₹4,000/NOS |
| B | 100 NOS @ ₹4,200/NOS | ₹4,20,000 | 100 NOS | ₹4,200/NOS |

Winner: Vendor A (₹200/NOS cheaper).

Comparison engine must use **line snapshot factor**, not live item master.

---

## 8. GRN display contract (Phase A/C UI)

GRN must never hide conversion. Minimum visible set per line:

| Field | Example |
|-------|---------|
| PO transaction qty | 5000 KG |
| PO stock qty | 100 NOS |
| Received transaction qty | 5100 KG |
| Received stock qty | 102 NOS |
| Qty tolerance | 2% |
| Variance | 2% |
| Weight tolerance / variance | when `receiptEntryMode` includes weight |
| Status | EXACT / WITHIN_TOLERANCE / REQUIRES_APPROVAL |

Backend fields already exist; UI must surface them.

---

## 9. Tolerance architecture (keep masters — do not flatten)

Do **not** add `quantityTolerance`, `weightTolerance`, `valueTolerance` as flat `%` columns on `MasterItem`.

Use:

```
MasterReceivingTolerance (reusable band)
        │
        ├── MasterItem.receivingToleranceId        (quantity / unit excess)
        └── MasterItem.weightReceivingToleranceId  (weight excess)
```

GRN lines snapshot tolerance master codes and percentages at receive time (`*Snapshot` fields).

Value tolerance (invoice vs GRN) remains an AP/three-way-match concern unless a separate epic adds it.

---

## 10. Receiving condition (Phase C)

GRN line receiving condition:

- `NORMAL` | `SHORT` | `EXCESS` | `DAMAGE` | `REJECTED`

System **suggests** condition from received vs PO qty and tolerance; user confirms. Short/excess/damage qty fields already exist on `GoodsReceiptLine`; workflow ties to QC hold and returns.

---

## 11. Decimal and fractional quantity rules

| Layer | Rule |
|-------|------|
| `MasterUom.decimalPlaces` | Display/entry precision per UOM (NOS=0, MTR=3, KG=3) |
| `MasterItem.allowDecimalQuantity` (Phase B) | Whether base qty may be fractional for this item |
| Internal calc | Full precision until final display/round |
| Physical items (pipe count) | `allowDecimalQuantity = false` → round base qty on post |
| Liquids / bulk | `allowDecimalQuantity = true` |

---

## 12. Document chain coverage matrix

| Document | Dual qty today | Factor snapshot | Phase |
|----------|----------------|-----------------|-------|
| Purchase Requisition | ❌ | ❌ | B |
| RFQ | ❌ | ❌ | B |
| Vendor Quotation | ❌ | ❌ | B |
| Purchase Order | ✅ | ✅ | A UI |
| GRN | ✅ | ✅ | A/C UI |
| Purchase Invoice | ✅ | ✅ | A label |
| Purchase Return | partial | partial | B enrich |
| Inventory movement | base + audit uom | partial | C `baseUomCodeSnapshot` |
| Production consumption | base only | N/A | always base UOM |

---

## 13. Golden flow test (required before production)

One automated integration test must cover:

```
Item: Pipe (base NOS, 50 KG = 1 NOS)

PR:     required 100 NOS, purchase estimate 5000 KG, factor 50
RFQ:    5000 KG
VQ A:   5000 KG @ ₹80/KG  → ₹4000/NOS normalized
PO:     5000 KG → 100 NOS stock, factor 50
GRN:    5100 KG → 102 NOS, 2% tolerance → accepted
Stock:  +102 NOS ledger
Invoice:5100 KG snapshot
FIFO:   unit cost = (5100 × 80) / 102 = ₹4000/NOS (within rounding)
```

File target: `backend/tests/purchase/multi-uom-golden-flow.test.ts` (Phase B).

---

## 14. Developer checklist (before any quantity PR)

- [ ] Both transaction and base quantities defined or derived
- [ ] Factor snapshot stored on submit
- [ ] Rate labelled with transaction UOM
- [ ] No second editable qty field
- [ ] Rounding respects UOM decimal places + item `allowDecimalQuantity`
- [ ] Tests use locked formulas from `uom-conversion.ts`
- [ ] UI shows conversion preview on item/UOM change

---

## 15. Related code & docs

| Resource | Path |
|----------|------|
| Conversion math | `backend/src/modules/purchase/shared/uom-conversion.ts` |
| Item UOM resolution | `backend/src/modules/purchase/shared/item-uom-resolution.ts` |
| Item conversion CRUD | `backend/src/modules/items/item-uom-conversion.service.ts` |
| Item Master UI | `frontend/src/components/masters/ItemUomConversionEditor.tsx` |
| PO qty cell | `frontend/src/components/purchase/PurchaseLineQtyCell.tsx` |
| Phase 0 gap & migration | `docs/platform/MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md` |
