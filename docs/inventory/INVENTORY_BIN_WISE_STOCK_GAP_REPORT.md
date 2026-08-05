# Inventory BIN-Wise Stock Management — Architecture Gap Report

**Version:** 1.0  
**Date:** 2026-08-05  
**Status:** Phase 1 audit complete — **no code changes**  
**Scope:** Warehouse + BIN + stock ledger + purchase snapshots + tax per line  
**Prerequisite:** Multi-UOM Phase 1 stabilized; Purchase certification in progress  

---

## Executive summary

FOS ERP today can correctly convert **5000 KG → 100 NOS** on purchase documents, but **inventory SoT is item × warehouse only**. BIN exists as **master data** and **purchase document metadata** — it does **not** drive balances, movements, costing, or production consumption.

| Layer | BIN support today |
|-------|-------------------|
| Master data (Warehouse / Location / Bin) | ✅ Complete |
| PO / GRN line capture (bin picker) | ⚠️ Partial (optional, not posted) |
| Stock balance & movements | ❌ Warehouse only |
| GRN → inventory posting | ❌ Ignores line `binId` |
| Bin transfer (A → B, same WH) | ❌ Missing |
| Item default warehouse / bin | ❌ Missing on `MasterItem` |
| Tax snapshots (HSN/GST) on full chain | ⚠️ PO partial; GRN/Invoice weak |
| Bin-wise reports | ❌ Missing |

**Recommendation:** Complete Purchase P1 certification, then implement **Inventory Location + Transaction Master Hardening** **before** Phase B PR Multi-UOM expansion.

---

## Dependency order (production ERP)

```text
Item Master
      │
Multi-UOM (Phase 1 done; certification pending)
      │
Warehouse + BIN  ← THIS PHASE
      │
Purchase → GRN → Stock Ledger
      │
Production Consumption
      │
Accounting
```

Without BIN-wise ledger, production material traceability and physical stock accuracy will remain gaps even when purchase math is correct.

---

## 1. What exists today

### 1.1 Master hierarchy (✅ live)

```text
Plant → Warehouse → Storage Location → Bin
```

| Model | Table | Key fields |
|-------|-------|------------|
| `MasterWarehouse` | `master_warehouses` | `code`, `name`, `plantId`, `warehouseType` |
| `MasterLocation` | `master_locations` | `warehouseId`, address/GST flags |
| `MasterBin` | `master_bins` | `warehouseId`, `storageLocationId`, `code`, `name`, `binType` |

- **Backend:** registry CRUD, hierarchy validation, RBAC `master.bin.*`
- **Frontend:** `frontend/src/modules/masters/bin/BinPages.tsx` — full list/create/edit
- **Seed:** `backend/scripts/seed-inventory-setup.ts` — default bins per location

### 1.2 Inventory ledger (✅ warehouse-level — live)

| Model | Granularity | Unique key |
|-------|-------------|------------|
| `InventoryStockBalance` | item + **warehouse** | `(tenantId, itemId, warehouseId)` |
| `InventoryStockMovement` | item + **warehouse** | no `binId` field |
| `InventoryCostLayer` | item + **warehouse** | FIFO/MA at WH level |
| `InventoryBatchBalance` | batch + **warehouse** + status | |

**Posting:** `backend/src/modules/inventory/shared/stock-posting.service.ts` — `PostStockMovementInput` accepts `warehouseId` only.

**Docs:** `docs/inventory/INVENTORY_PHASE3A_README.md` explicitly defers bin as stock dimension.

### 1.3 Purchase documents — bin & tax (⚠️ partial)

| Document line | Warehouse | Location | Bin | HSN snapshot | GST snapshot |
|---------------|-----------|----------|-----|--------------|--------------|
| `PurchaseRequisitionLine` | `warehouseId` | — | `binId` (weak) | ❌ | ❌ |
| `PurchaseOrderLine` | header `deliveryWarehouseId` | — | `binId` FK | ✅ `hsnCodeSnapshot`, `gstGroupCodeSnapshot` | ❌ rate not persisted |
| `GoodsReceiptLine` | `warehouseId` | `storageLocationId` | `binId`, `binCodeSnapshot` | ❌ | ❌ |
| `PurchaseInvoiceLine` | ❌ | ❌ | ❌ | ❌ | flat `taxRatePct` only |

**PO enrichment:** `purchase-order.service.ts` resolves HSN/GST/bin from item master on save.

**GRN UI:** `GrnEditorPage.tsx` — per-line bin `Select`; frontend draft copies PO bin (`grnLineDraft.ts`).

### 1.4 GRN → inventory posting (❌ bin ignored)

`postGrnStockInward` passes **header** `warehouseId` only:

```57:61:backend/src/modules/purchase/shared/purchase-inventory-posting.ts
    const movement = await postStockMovement(
      {
        tenantId: input.tenantId,
        itemId: line.itemId,
        warehouseId: input.warehouseId,
```

Line `binId`, `storageLocationId` are saved on `GoodsReceiptLine` but **never consumed** at post time.

**Result:** Stock increases at warehouse aggregate; GRN line bin is put-away **hint / audit only**.

### 1.5 Item Master (⚠️ partial)

| Field | `MasterItem` | UI |
|-------|--------------|-----|
| HSN / GST group | ✅ relational + `hsnCode` | Tax section live |
| Default warehouse | ❌ (category `defaultWarehouseId` only) | ❌ |
| Default bin | ❌ | ❌ |
| On-hand qty display | read-only aggregate | Inventory section read-only |

**Rule alignment:** Default BIN must be **suggestion only** — not implemented yet.

### 1.6 Transfers (⚠️ inter-warehouse only)

- `InventoryTransfer` — `fromWarehouseId` → `toWarehouseId`; **no bin fields**
- Put-away workbench prefills same-WH transfer — **cannot model bin relocation**
- No intra-warehouse bin-to-bin transfer document

### 1.7 Item 360 “Bin” tab (honest partial)

`operationalViewsService.ts` — shows GRN line destinations from documents; explicitly **not** bin balance SoT.

---

## 2. Gap matrix vs your requirements

| # | Requirement | Status | Gap |
|---|-------------|--------|-----|
| 1 | BIN master under warehouse | ✅ Done | — |
| 2 | Item default warehouse + bin (suggestion) | ❌ Missing | No fields on `MasterItem`; no resolve chain |
| 3 | Stock ledger BIN-wise | ❌ Missing | Balance key is item×WH only |
| 4 | GRN: warehouse + BIN on line | ⚠️ UI/DB | Not posted to ledger |
| 5 | Transaction snapshots (HSN/GST/UOM) | ⚠️ Partial | PO HSN/group yes; GST rate FE-only; GRN/Invoice weak |
| 6 | GST per item line (not header only) | ⚠️ Partial | PO FE calc; invoice flat `taxRatePct` |
| 7 | Bin transfer A → B (same WH) | ❌ Missing | No model or movement type |
| 8 | Stock reports: item / WH / BIN | ⚠️ WH only | Bin summary not possible |
| 9 | GRN suggests default BIN from item | ❌ Missing | Manual pick only |
| 10 | Same item in multiple BINs | ❌ Not trackable | No bin balance rows |

---

## 3. Critical architectural finding

```text
┌─────────────────────────────────────────────────────────┐
│  Purchase layer (PO / GRN)                               │
│  binId, storageLocationId, binCodeSnapshot  ✅ captured   │
└──────────────────────────┬──────────────────────────────┘
                           │ postGrnStockInward
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Inventory layer                                         │
│  InventoryStockMovement.warehouseId only  ❌ no binId   │
│  InventoryStockBalance (item × warehouse)                 │
└─────────────────────────────────────────────────────────┘
```

**The gap is not master data — it is ledger + posting + consumption keyed by bin.**

---

## 4. Snapshot / tax audit (transaction immutability)

Government rate changes must not rewrite history. Current state:

| Snapshot | Item Master | PO Line | GRN Line | Invoice Line |
|----------|-------------|---------|----------|--------------|
| `itemCodeSnapshot` | live | ✅ | ✅ (name/code) | ✅ |
| `hsnCodeSnapshot` | live | ✅ | ❌ | ❌ |
| `gstGroupCodeSnapshot` | live | ✅ | ❌ | ❌ |
| `gstRatePct` / CGST/SGST/IGST | via master | ❌ DB (FE calc) | ❌ | flat `taxRatePct` |
| `uomConversionFactor` snapshot | live | ✅ | ✅ | ✅ |
| `binCodeSnapshot` | — | ❌ | ✅ | ❌ |
| `warehouseId` | — | header | ✅ line | ❌ |

**Finance note:** `item-master-functional-rules.md` — GST split bridge **on hold**; PO uses flat tax in UI until finance unified.

---

## 5. Example: your factory scenario

**Target state:**

```text
MS PIPE DN25
Warehouse: Raw Material Store
BIN: RM-A01-001
Stock: 100 NOS (5000 KG equivalent)
HSN: 7306 | GST: 18% (snapshotted on PO/GRN/Invoice)
```

**Today after GRN post:**

```text
MS PIPE DN25
Warehouse: Raw Material Store (header)
BIN: RM-A01-001 (GRN line document only — not in ledger)
Stock balance: 100 NOS at WAREHOUSE level
HSN/GST on GRN line: not snapshotted
```

---

## 6. Recommended implementation phases

Aligned with your Phase 1–4 plan. **Do not code until audit approved.**

### Phase 1 — Audit ✅ (this document)

No code. Gap report + sign-off.

### Phase 2 — Database & ledger foundation

| Change | Notes |
|--------|-------|
| `binId` (+ optional `storageLocationId`) on `InventoryStockMovement` | Required for traceability |
| Extend `InventoryStockBalance` unique key to include `binId` | Or separate `InventoryBinBalance` table |
| Migration backfill | Existing WH balances → “unassigned” bin or default bin per WH |
| `defaultWarehouseId`, `defaultBinId` on `MasterItem` | **Suggestion only** — nullable |
| Item×warehouse default bin policy table (optional) | Same item, different bins per WH |

**Invariant:** Warehouse-level balance = SUM(bin balances) for reconciliation.

### Phase 3 — Transaction snapshots

| Document | Add / extend |
|----------|--------------|
| PO line | Persist `gstRatePct`, CGST/SGST/IGST snapshots |
| GRN line | `hsnCodeSnapshot`, `gstGroupCodeSnapshot`, `gstRatePct` from PO/item |
| Invoice line | HSN/GST snapshots from GRN/PO chain |
| All lines | Keep existing UOM snapshots (Multi-UOM) |

### Phase 4 — Posting & inbound path

| Change | Notes |
|--------|-------|
| GRN post uses **line** `binId` | Fallback: PO bin → item default → setup default |
| Default BIN suggestion on GRN open | From item master; user can override |
| Bin-targeted `postStockMovement` | Update bin balance atomically |
| Replace same-WH put-away with bin transfer or direct bin inward | |

### Phase 5 — Outbound & internal moves

| Change | Notes |
|--------|-------|
| Bin transfer document (intra-WH) | ISSUE bin A + INWARD bin B |
| WO issue / dispatch pick from bin | Consume from specific bin |
| Stock count & adjustment by bin | |
| FIFO/costing policy | Document: layers at WH vs bin |

### Phase 6 — UI & reporting

| Screen | Change |
|--------|--------|
| Item Master | Default warehouse + bin (suggestion) |
| GRN editor | Pre-fill warehouse/bin; show HSN/GST |
| PO / Invoice | Per-line GST display from snapshots |
| Reports | Item / WH / BIN summaries |
| Item 360 Bin tab | Read bin balances (not GRN docs only) |

---

## 7. What NOT to do

| Anti-pattern | Why |
|--------------|-----|
| Add BIN UI only without ledger | Current state — creates false confidence |
| Hard-lock default BIN | Same item exists in multiple bins |
| GST at PO header only | Multi-rate POs (18% + 12%) break |
| Skip snapshots on GRN/Invoice | Master changes rewrite history |
| Bin transfer via inter-WH transfer same WH | Put-away hack — no bin SoT |

---

## 8. Test plan preview (after implementation + dummy data)

When you add dummy data and test (your next step after approval):

| Scenario | Expected |
|----------|----------|
| GRN 100 NOS → BIN RM-A01-001 | Bin balance +100; WH balance +100 |
| Same item GRN 50 NOS → BIN RM-A02-003 | Two bin rows; WH total 150 |
| Bin transfer 30 NOS A→B | A=70, B=30; WH unchanged |
| PO line GST 18% snapshotted | GRN/Invoice show 18% even if master → 12% |
| Item default bin suggestion | GRN pre-fills; user can change |
| SQL reconciliation | `SUM(bin qty) = WH qty` per item |

---

## 9. Relationship to other work

| Work stream | Order |
|-------------|-------|
| Purchase P1 certification (CERT-01–11) | **First** — finish blockers |
| SQL drift audit (Multi-UOM) | ✅ PASS (0 drift) |
| **Inventory BIN phase (this report)** | **Second** — before Phase B PR dual-UOM |
| Phase B PR/RFQ/VQ dual-UOM | **Third** — after BIN ledger live |

---

## 10. Key file references

| Concern | Path |
|---------|------|
| Bin masters | `backend/prisma/schema.prisma` ~2921–2948 |
| WH-only balance | `backend/prisma/schema.prisma` ~13229–13251 |
| Movement (no bin) | `backend/prisma/schema.prisma` ~13254–13297 |
| PO line HSN/bin | `backend/prisma/schema.prisma` ~7122–7126 |
| GRN line bin | `backend/prisma/schema.prisma` ~7435–7438 |
| Invoice line tax | `backend/prisma/schema.prisma` ~8024–8047 |
| GRN post ignores bin | `backend/src/modules/purchase/shared/purchase-inventory-posting.ts` |
| Stock posting | `backend/src/modules/inventory/shared/stock-posting.service.ts` |
| GRN bin UI | `frontend/src/modules/purchase/GrnEditorPage.tsx` |
| Item master inventory | `frontend/src/modules/masters/item/ItemPages.tsx` |
| Bin master UI | `frontend/src/modules/masters/bin/BinPages.tsx` |
| Ledger defers bin | `docs/inventory/INVENTORY_PHASE3A_README.md` |
| Item master rules | `docs/master/item-master-functional-rules.md` |

---

## 11. Sign-off checklist (Phase 1 audit)

- [x] Warehouse / Location / Bin models reviewed
- [x] Stock balance & movement granularity confirmed (WH only)
- [x] GRN posting path traced (bin not consumed)
- [x] PO/GRN/Invoice snapshot gaps documented
- [x] Bin transfer gap documented
- [x] Phase 2–6 implementation order proposed
- [ ] **Stakeholder approval to proceed to Phase 2 schema** — pending

---

## Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-08-05 | Initial architecture gap audit — no code changes |
