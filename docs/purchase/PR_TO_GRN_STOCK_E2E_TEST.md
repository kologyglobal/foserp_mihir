# PR → GRN → Stock Entry — End-to-End Test

**Purpose:** Certify the full procurement chain from **Purchase Requisition** through **Goods Receipt** to **inventory stock posting**, with **Multi-UOM** math (commercial KG → stock NOS).

**Audience:** QA, UAT, engineering sign-off  
**Tenant (default):** `vasant-trailers`  
**Related docs:**

| Document | Path |
|----------|------|
| Multi-UOM contract | `docs/platform/MULTI_UOM_TRANSACTION_CONTRACT.md` |
| PO→GRN automated test plan | `docs/PURCHASE_MULTI_UNIT_UOM_TEST_PLAN.md` |
| Module certification | `docs/purchase/PURCHASE_MODULE_CERTIFICATION_TEST_PLAN.md` |
| GRN / QI / inventory | `docs/purchase/GRN_QI_INVENTORY_FLOW.md` |

---

## 1. What this test proves

| Stage | Must hold |
|-------|-----------|
| **PR** | Approved demand saved; planning row created when `rfqRequired=false` |
| **Planning → PO** | PO lines carry correct dual qty + factor snapshot from item master |
| **GRN** | `receivedUomQuantity` (commercial) converts to `receivedQuantity` (base) |
| **Stock** | `inventory_stock_balances.onHandQty` increases by **base qty only** |
| **Movement** | INWARD movement references GRN; qty = base; optional UOM snapshot |
| **Traceability** | PR line linked to PO line; PO received qty matches GRN |

**Inventory rule (locked):** ledger stores **base UOM quantity** only. Commercial qty is audit/display on document lines and movement snapshots.

---

## 2. Preconditions

Run once per environment (local MySQL or stage).

```bash
cd backend

# Migrations
npx tsx scripts/prisma-cli.ts migrate deploy

# Certification items (MS Pipe KG, MTR, Casting)
TENANT_SLUG=vasant-trailers npx tsx scripts/seed-multi-uom-test-items.ts
```

| ID | Check |
|----|-------|
| P1 | Tenant `vasant-trailers` (or set `TENANT_SLUG`) |
| P2 | UOMs: `NOS`, `KG`, `MTR` active |
| P3 | Item `MS-PIPE-DN25-KG`: base=NOS, purchase=KG, factor=**50** |
| P4 | Active vendor with GSTIN (test vendor `VND-MUOM-01` created by script if missing) |
| P5 | Active warehouse (`BO-MAIN`, `WH-RM-01`, or any active WH) |
| P6 | Users: `purchase@vasant-trailers.com` (maker), `admin@vasant-trailers.com` (approver) |
| P7 | Permissions: PR create/submit/approve, planning create PO, PO approve, GRN submit/post |
| P8 | Backend running **or** use live script (starts in-process app) |

**Item master sanity (SQL):**

```sql
SELECT i.code, pu.code AS purchase_uom, i.uom_conversion_factor,
       cu.code AS conv_uom, c.conversion_factor, c.is_default_purchase
FROM master_items i
JOIN master_uoms pu ON pu.id = i.purchase_uom_id
JOIN master_item_uom_conversions c ON c.item_id = i.id AND c.tenant_id = i.tenant_id
JOIN master_uoms cu ON cu.id = c.uom_id
WHERE i.code = 'MS-PIPE-DN25-KG' AND i.deleted_at IS NULL;
```

Expected: default purchase row **KG**, factor **50**.

---

## 3. Golden scenario — `E2E-PR-GRN-01`

**Item:** `MS-PIPE-DN25-KG` (1 NOS = 50 KG)  
**Commercial order:** 5000 KG @ ₹80/KG  
**Expected stock:** +100 NOS  
**Expected amount:** ₹400,000  

### 3.1 Quantity matrix

| Document | Commercial (KG) | Factor | Base (NOS) | Rate | Amount |
|----------|-----------------|--------|------------|------|--------|
| PR line* | 5000 | 50 | 100 (derived on PO) | ₹80/KG est. | — |
| PO line | 5000 | 50 | 100 | ₹80/KG | 400,000 |
| GRN line | 5000 | 50 | 100 | — | — |
| Stock Δ | — | — | **+100** | FIFO ~₹4000/NOS | — |

\*PR today stores a **single** `requiredQuantity` + `uomId`. For full dual-UOM through the chain, enter demand in **purchase UOM (KG)** on the PR line until Sprint 2 Phase B adds explicit `purchaseUomQuantity` columns. See §7.

### 3.2 Manual UI steps

Use run id in remarks, e.g. `E2E-PR-GRN-20260806-01`.

| Step | Screen | Action | Data |
|------|--------|--------|------|
| 1 | Purchase → Requisitions → New | Create PR | Department required; Warehouse = receiving WH; **RFQ required = No** |
| 2 | PR lines | Add line | Item `MS-PIPE-DN25-KG`; qty **5000**; UOM **KG**; est. rate **80**; preferred vendor |
| 3 | PR | Save → Submit | — |
| 4 | PR | Approve | Use approver account (repeat if multi-level matrix) |
| 5 | Planning sheet | Open row from PR | Confirm PPS row; vendor + rate filled |
| 6 | Planning | Create PO | Select row → Create PO; delivery WH = same as PR |
| 7 | PO | Submit → Approve → Send to vendor | — |
| 8 | GRN → New from PO | Receive full qty | **5000 KG** per line (Fill Pending if shown) |
| 9 | GRN | Submit | QC off → auto inventory post (or Post inventory) |
| 10 | Inventory → Stock balance | Verify | Item `MS-PIPE-DN25-KG`, WH: **+100 NOS** |

### 3.3 Expected UI checks

- PO line shows **5000 KG** and **100 NOS** (not 5000 NOS).
- GRN line shows matching received commercial + base qty.
- PR status → **Converted to PO** (or Partially converted if split).
- PO status → **Fully received** after GRN post.
- No GST total on PR (demand-only; no estimate GST block).

### 3.4 Automated run (recommended)

```bash
cd backend
TENANT_SLUG=vasant-trailers npm run test:pr-to-grn-stock-e2e
```

Script path: `backend/scripts/test-pr-to-grn-stock-e2e.ts`

Covers: PR create → submit → approve → planning → PO → GRN → stock balance + movement assertions.

Env overrides: `TENANT_SLUG`, `MAKER_EMAIL`, `MAKER_PASSWORD`, `APPROVER_EMAIL`, `APPROVER_PASSWORD`.

---

## 4. Alternate scenario — `E2E-PR-GRN-02` (base demand only)

**When:** PR entered in **stock UOM (NOS)** — typical “need 100 pieces” demand.

| Step | PR line | Expected PO (Phase 1) | Stock after full GRN |
|------|---------|-------------------------|----------------------|
| Demand | 100 NOS | May stay 100 NOS / factor 1 on PO* | +100 NOS |

\*Until Sprint 2, planning passes PR qty as `uomQuantity` with PR line `uomId`. If line UOM is **NOS**, PO enrichment may keep base UOM (factor 1) rather than default purchase KG. **Stock outcome is still +100 NOS** if GRN receives 100 NOS — but commercial KG columns on PO/GRN may not show 5000 KG. Track as **Phase B** gap if commercial traceability is required from PR onward.

**Pass criteria (Phase 1):** stock +100 NOS; PR→PO link; no conversion drift on posted qty.

---

## 5. QC path extension — `E2E-PR-GRN-03`

Add after step 8 when item has `qcRequired=true` (e.g. `CASTING-KG-MUOM`):

| Step | Action | Expected |
|------|--------|----------|
| GRN submit | Inspection required | Stock in **QC_HOLD**, not unrestricted |
| QI from GRN | Accept full commercial qty | GRN `acceptedQuantity` / `acceptedUomQuantity` synced (Sprint 1 fix) |
| Post transfer | QI complete | Unrestricted stock += base qty; UOM qty = base × factor |

Verify with audit SQL §6 (`grn_qc_uom_drift` = 0).

---

## 6. SQL verification (post-run)

Replace `:grnNumber`, `:poNumber`, `:prNumber` with document numbers from the run.

```sql
-- PR → planning link
SELECT pr.requisition_number, pr.status, pps.planning_number, pps.net_purchase_quantity, u.code AS uom
FROM purchase_requisitions pr
JOIN purchase_planning_rows pps ON pps.purchase_requisition_id = pr.id
JOIN master_uoms u ON u.id = pps.uom_id
WHERE pr.requisition_number = :prNumber;

-- PO dual qty
SELECT pol.line_number, pol.uom_quantity, pol.quantity, pol.uom_conversion_factor,
       pol.rate, pol.amount, pol.unit_cost_primary
FROM purchase_order_lines pol
JOIN purchase_orders po ON po.id = pol.purchase_order_id
WHERE po.order_number = :poNumber;

-- GRN dual qty
SELECT grl.line_number, grl.received_uom_quantity, grl.received_quantity,
       grl.uom_conversion_factor, grl.accepted_quantity, grl.accepted_uom_quantity
FROM goods_receipt_lines grl
JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
WHERE gr.grn_number = :grnNumber;

-- Stock balance delta (note warehouse id)
SELECT isb.on_hand_qty, mi.code
FROM inventory_stock_balances isb
JOIN master_items mi ON mi.id = isb.item_id
WHERE mi.code = 'MS-PIPE-DN25-KG';

-- Latest INWARD movement
SELECT movement_number, quantity, uom_quantity, uom_conversion_factor, reference_type, reference_no
FROM inventory_stock_movements
WHERE reference_type = 'GRN' AND reference_no = :grnNumber
ORDER BY created_at DESC LIMIT 1;
```

**Data consistency gate (run full audit):**

```bash
# In MySQL client — all summary counts should be 0
source backend/scripts/audit-multi-uom-data-consistency.sql
```

---

## 7. Pass / fail checklist

| # | Check | Pass |
|---|-------|------|
| 1 | PR approved; planning row exists (`rfqRequired=false`) | ☐ |
| 2 | PO created from planning; linked to PR line | ☐ |
| 3 | PO `uom_quantity=5000`, `quantity=100`, `factor=50` (golden) | ☐ |
| 4 | GRN `received_uom_quantity=5000`, `received_quantity=100` | ☐ |
| 5 | Stock `onHandQty` increased by **100** (base NOS) | ☐ |
| 6 | INWARD movement qty = 100; ref = GRN number | ☐ |
| 7 | PO `received_quantity=100`; status Fully received | ☐ |
| 8 | PR status Converted to PO | ☐ |
| 9 | Audit `grn_qc_uom_drift` = 0 (if QC path) | ☐ |
| 10 | Automated script exits 0 | ☐ |

**Sign-off:** Record run id, tenant, DB, script output, and approver name in `docs/purchase/PURCHASE_COMPLETION_TEST_RESULTS.md` when certifying stage/live.

---

## 8. Known gaps (do not fail golden stock test)

| Gap | Status | Notes |
|-----|--------|-------|
| PR dual-qty columns (`purchaseUomQuantity`, factor snapshot) | Sprint 2 | PR is demand-only; use purchase UOM on line for commercial traceability today |
| RFQ → VQ → Comparison dual qty | Sprint 3 | Use direct PR path for this E2E |
| Stock movement UOM snapshot on all movement types | Phase C | GRN INWARD may have snapshot; verify per item |
| BIN-wise location | Sprint 5 | Blocked until Multi-UOM upstream complete |

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| POST `/purchase/requisitions` 500 | Missing tax snapshot columns on live DB | Run `backend/scripts/live-fix-purchase-upstream-tax-snapshots.sql` |
| GRN API P2022 | Missing partial-reverse columns | Run `backend/scripts/live-fix-grn-reversed-accepted-qty.sql` |
| PO shows 5000 NOS | Comparison/PR qty treated as base | Enter PR in KG or fix comparison path (CERT-02) |
| Stock unchanged after GRN | QC hold or tolerance block | Complete QI or approve tolerance; check GRN status |
| Planning “rate required” | No `expectedRate` on row | Set preferred vendor + estimated rate on PR line |

---

## 10. Test inventory map

| Test | Path | Scope |
|------|------|-------|
| **This doc — golden** | `npm run test:pr-to-grn-stock-e2e` | PR → Planning → PO → GRN → Stock |
| Multi-item PO→GRN | `npm run test:purchase-multi-unit-uom-live` | PO direct (no PR) |
| Demo smoke (mock) | `frontend/scripts/smoke-purchase-e2e-flow.ts` | Full chain incl. RFQ/invoice (Zustand) |
| QI → GRN UOM sync | `npm test -- tests/purchase/qi-grn-uom-sync.test.ts` | Unit |

**Recommendation:** Run **`test:pr-to-grn-stock-e2e`** before stage sign-off; run **`test:purchase-multi-unit-uom-live`** for multi-item PO regression; run audit SQL after both.
