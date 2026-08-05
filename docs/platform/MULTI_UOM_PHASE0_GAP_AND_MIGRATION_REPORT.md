# Multi-UOM Phase 0 — Gap Report, Migration Impact & API Contract Changes

**Status:** Approved baseline — no feature code until this report is acknowledged.  
**Approved plan:** Phase 0 + Phase A + Phase B (PR Option A) + Phase C; keep tolerance masters.  
**Contract:** `docs/platform/MULTI_UOM_TRANSACTION_CONTRACT.md`

---

## 1. Executive summary

The core UOM engine is **correct and must not be rebuilt**. Gaps are:

1. **Upstream documents** (PR, RFQ, VQ) lack dual qty + factor snapshots.
2. **UI visibility** — PO/GRN hide conversion and rate UOM.
3. **Platform consistency** — inventory movement lacks base UOM code snapshot.
4. **Item flags** — missing `allowDecimalQuantity`, `isSalesAllowed`, `isConsumptionAllowed` on conversion rows.

---

## 2. Database gap report

### 2.1 MasterItem

| Column | Status | Action |
|--------|--------|--------|
| `baseUomId` | ✅ Exists | Keep |
| `allowDecimalQuantity` | ❌ Missing | **Phase B migration** |
| `receivingToleranceId` | ✅ Exists | Keep (qty tolerance via master) |
| `weightReceivingToleranceId` | ✅ Exists | Keep (weight tolerance via master) |
| `purchaseUomId`, `uomConversionFactor` | ✅ Legacy sync | Keep; read conversions first |
| `receiptEntryMode`, weight fields | ✅ Exists | GRN Phase C UI |

### 2.2 MasterItemUomConversion

| Column | Status | Action |
|--------|--------|--------|
| `itemId`, `uomId`, `conversionFactor` | ✅ Exists | Keep |
| `isPurchaseAllowed` | ✅ Exists | Keep |
| `isDefaultPurchase` | ✅ Exists | Keep |
| `isSalesAllowed` | ❌ Missing | **Phase B migration** |
| `isConsumptionAllowed` | ❌ Missing | **Phase B migration** |

### 2.3 PurchaseRequisitionLine

| Column | Status | Action |
|--------|--------|--------|
| `requiredQuantity`, `uomId` | ✅ Exists | Rename semantics: `requiredUomId` display only (keep `uomId` column) |
| `purchaseUomQuantity` | ❌ Missing | **Phase B** |
| `purchaseUomId` | ❌ Missing | **Phase B** |
| `baseQuantity` | ❌ Not needed if `requiredQuantity` is base | Option A: required = base need |
| `uomConversionFactor` | ❌ Missing | **Phase B snapshot** |

**Option A mapping (approved):**

```
requiredQuantity  = production need (usually base UOM qty)
uomId             = required UOM (usually base UOM id)
purchaseUomQuantity + purchaseUomId + uomConversionFactor = buyer/vendor estimate
```

### 2.4 RequestForQuotationLine

| Column | Status | Action |
|--------|--------|--------|
| `requiredQuantity`, `uomId` | ✅ Single qty | **Phase B:** add `uomQuantity`, `uomConversionFactor`; clarify `requiredQuantity` as base or add `baseQuantity` |

Proposed Phase B columns (mirror PO):

- `uomQuantity` — RFQ commercial qty
- `uomId` — already exists (commercial UOM)
- `quantity` — base/stock qty (new, or repurpose `requiredQuantity`)
- `uomConversionFactor`

### 2.5 VendorQuotationLine

Same as RFQ line — **Phase B** add dual qty + factor snapshot.

### 2.6 PurchaseOrderLine

| Column | Status | Action |
|--------|--------|--------|
| `uomQuantity`, `quantity`, `uomId`, `uomConversionFactor` | ✅ Complete | Phase A UI only |
| `unitCostPrimary`, `rate` | ✅ Complete | Label rate UOM in UI |
| `baseUomId` snapshot | ⚠️ Derived from item | Optional Phase B: `baseUomCodeSnapshot` for audit |
| `rateUomId` | ⚠️ Implicit = `uomId` | Phase A UI label; optional explicit column later |

### 2.7 GoodsReceiptLine

| Column | Status | Action |
|--------|--------|--------|
| Dual receive qty | ✅ Complete | Phase A/C UI |
| Tolerance + weight snapshots | ✅ Complete | Phase C UI |
| `shortQuantity`, `excessQuantity`, `damagedQuantity` | ✅ Exist | Phase C receiving condition UX |
| Receiving condition enum | ❌ Missing | **Phase C** — suggest from variance |

### 2.8 PurchaseInvoiceLine

| Column | Status | Action |
|--------|--------|--------|
| `uomQuantitySnapshot`, `uomConversionFactorSnapshot` | ✅ Exist | Phase A rate UOM label |
| `purchaseUomCodeSnapshot` | ✅ Exists | Keep |

### 2.9 InventoryStockMovement

| Column | Status | Action |
|--------|--------|--------|
| `quantity` (base, signed) | ✅ Exists | Keep |
| `uomQuantity`, `uomId`, `uomConversionFactor` | ✅ Audit optional | Keep |
| `baseUomCodeSnapshot` | ❌ Missing | **Phase C migration** |

### 2.10 Conversion snapshot coverage

| Table | Snapshot field | Status |
|-------|----------------|--------|
| PO line | `uomConversionFactor` | ✅ |
| GRN line | `uomConversionFactor` | ✅ |
| Invoice line | `uomConversionFactorSnapshot` | ✅ |
| PR line | — | ❌ Phase B |
| RFQ line | — | ❌ Phase B |
| VQ line | — | ❌ Phase B |
| Stock movement | `uomConversionFactor` | ✅ partial |

---

## 3. Migration impact report (Phase B + C)

### 3.1 New migrations (planned)

| Migration | Tables | Risk | Backfill |
|-----------|--------|------|----------|
| `item_allow_decimal_quantity` | `master_items` | Low | Default `false` for integer UOM items, `true` for weight/volume |
| `item_uom_conversion_flags` | `master_item_uom_conversions` | Low | `isSalesAllowed=false`, `isConsumptionAllowed=true` for base row |
| `pr_dual_uom` | `purchase_requisition_lines` | **Medium** | `purchaseUomQuantity = requiredQuantity × factor`, `purchaseUomId = item default purchase UOM`, factor from item |
| `rfq_dual_uom` | `request_for_quotation_lines` | Medium | Copy from linked PR line or item default |
| `vq_dual_uom` | `vendor_quotation_lines` | Medium | Copy from RFQ line |
| `stock_movement_base_uom_snapshot` | `inventory_stock_movements` | Low | Backfill from item.baseUom → UOM code |
| `grn_receiving_condition` (optional) | `goods_receipt_lines` | Low | Derive from short/excess/damage qty > 0 |

### 3.2 Non-destructive rules

- All new columns **nullable or defaulted**; no drop of existing columns in Phase B.
- Legacy `MasterItem.purchaseUomId` remains synced from default conversion row.
- Existing PO/GRN rows: **no factor recalculation** — audit script only.

### 3.3 Rollback

Each migration is additive. Rollback = deploy previous app version; new columns ignored.

---

## 4. API contract changes (by phase)

### Phase A — UI only (no breaking API changes)

| Endpoint | Change |
|----------|--------|
| PO GET | No schema change; FE displays existing dual fields |
| GRN GET | No schema change; FE displays dual + tolerance |
| Item GET | No schema change; label copy only |

Optional additive response fields (non-breaking):

- `lines[].rateUomCode` — duplicate of `uom` for explicit labelling
- `lines[].baseUomCode` — from item for display

### Phase B — breaking/additive API changes

#### Purchase Requisition

**Request (create/update line):**

```json
{
  "requiredQuantity": 100,
  "uomId": "<base-uom-id>",
  "purchaseUomQuantity": 5000,
  "purchaseUomId": "<kg-uom-id>",
  "uomConversionFactor": 50
}
```

**Response line:** same fields + computed validation messages.

**Validation:**

- If dual UOM: `requiredQuantity ≈ purchaseUomQuantity / factor` (within epsilon)
- Factor must match item conversion row unless approver override (future)

#### RFQ / Vendor Quotation lines

Mirror PO line shape:

```json
{
  "uomQuantity": 5000,
  "uomId": "<kg>",
  "quantity": 100,
  "uomConversionFactor": 50,
  "rate": 80
}
```

#### Vendor comparison

**New computed fields on comparison DTO:**

```json
{
  "normalizedUnitCostPrimary": 4000,
  "baseUomCode": "NOS",
  "savingsVsHighest": 200
}
```

#### Item UOM conversion

**Request row:**

```json
{
  "uomId": "...",
  "conversionFactor": 50,
  "isPurchaseAllowed": true,
  "isDefaultPurchase": true,
  "isSalesAllowed": false,
  "isConsumptionAllowed": true
}
```

#### Master Item

```json
{
  "allowDecimalQuantity": false
}
```

### Phase C — additive

#### GRN line response

```json
{
  "suggestedReceivingCondition": "EXCESS",
  "receivingCondition": "EXCESS",
  "poUomQuantity": 5000,
  "poQuantity": 100,
  "receivedUomQuantity": 5100,
  "receivedQuantity": 102
}
```

#### Inventory movement

```json
{
  "baseUomCodeSnapshot": "NOS"
}
```

---

## 5. Frontend contract changes (by phase)

| Area | Phase A | Phase B |
|------|---------|---------|
| Item Master | Conversion label “1 NOS = 50 KG” | Sales/consumption checkboxes; allow decimal toggle |
| PO lines | Split columns; conversion preview; rate UOM | Item pick uses conversion table default |
| GRN lines | Dual qty display; conversion preview | Receiving condition suggest/confirm |
| PR editor | — | Dual qty (required + purchase estimate) |
| RFQ / VQ | — | Dual qty + normalized compare column |
| Demo seed | — | Sample pipe item with 3 conversion rows |

---

## 6. Existing data validation

Run read-only audit (local/staging):

```bash
# From backend/
mysql ... < scripts/audit-multi-uom-data-consistency.sql
```

Checks:

1. PO lines: `ABS(quantity - uomQuantity/uomConversionFactor) > 0.01` where factor > 0
2. GRN lines: same for received qty
3. Items with `purchaseUomId` but no conversion row
4. PO lines with `uomId` not in item allowed purchase UOMs

---

## 7. Approved phase sequence

| Phase | Deliverables | Code? |
|-------|--------------|-------|
| **0** | This doc + contract + audit SQL | Docs only ✅ |
| **A** | PO/GRN UI, conversion preview, rate UOM labels | FE only |
| **B** | PR/RFQ/VQ dual UOM migrations + API + VQ compare + decimal rules + golden test | BE + FE |
| **C** | GRN tolerance/condition UI, stock base UOM snapshot, QC visibility | BE + FE |
| **D** | Vendor analytics, vendor item catalog | Later |

---

## 8. Sign-off checklist

- [x] Keep `MasterItemUomConversion` architecture
- [x] PR Option A (required base + purchase estimate)
- [x] Keep `MasterReceivingTolerance` masters (no flat % on item)
- [x] VQ compare normalized to base UOM before PO (Phase B)
- [x] Golden flow test before production
- [x] Migration impact + API contract documented before coding
- [ ] Stakeholder ack on Phase A start
- [ ] Stakeholder ack on Phase B migration window

---

## 9. Next action

**Await explicit “Start Phase A”** — then implement UI-only changes per contract §4–§8 without altering backend quantity logic.

**Phase B** requires migration deploy plan and golden test scaffold in same PR series.
