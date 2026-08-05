# Purchase Module Certification Test Plan

**Version:** 1.0  
**Date:** 2026-08-05  
**Status:** Certification baseline (documentation only — no code changes)  
**Tenant (default):** `vasant-trailers`  
**Environment:** Staging / local MySQL with `VITE_USE_API=true`

---

## 1. Purpose

This plan certifies the **end-to-end Purchase module** from Item Master through accounting, with emphasis on **Multi-UOM** (commercial vs stock quantity), **tolerance**, **QC hold**, and **three-way match**.

It is the official QA checklist before production sign-off. Execute after Phase 1 Multi-UOM stabilization; re-run after Phase B (PR/RFQ/VQ dual-UOM schema).

### Source documents

| Document | Path |
|----------|------|
| Multi-UOM Transaction Contract | `docs/platform/MULTI_UOM_TRANSACTION_CONTRACT.md` |
| Phase 1 Final Report | `docs/platform/MULTI_UOM_PHASE1_FINAL_REPORT.md` |
| Item Master Functional Rules | `docs/master/item-master-functional-rules.md` |
| GRN / QI flow | `docs/purchase/GRN_QI_INVENTORY_FLOW.md` |
| Three-way matching | `docs/purchase/THREE_WAY_MATCHING.md` |
| AP integration | `docs/purchase/PURCHASE_AP_INTEGRATION.md` |

### Certification levels

| Level | Meaning |
|-------|---------|
| **P1 — Pass (Phase 1)** | Required for current release; PO→GRN→Invoice→Stock certified |
| **P2 — Pass (Phase B)** | Required before full PR→RFQ→VQ chain certification |
| **Known gap** | Documented limitation; fail is expected until Phase B/A |

---

## 2. Test database seed

### 2.1 Prerequisites

Run on a **dedicated certification tenant** or isolated staging DB (never production first run).

| Prerequisite | Verify |
|--------------|--------|
| MySQL reachable | `npx tsx scripts/prisma-cli.ts migrate deploy` |
| Tenant exists | slug `vasant-trailers` (or set `TENANT_SLUG`) |
| UOM master | NOS, KG, MTR with `decimalPlaces` (0, 3, 3) |
| Vendor | Active vendor with GSTIN (e.g. existing test vendor) |
| Warehouse + location | Default receiving + QC hold locations in Purchase Setup |
| Users | `purchase@…` (maker), `admin@…` (approver), permissions for PR/PO/GRN/QI/Invoice |
| Purchase Setup | `requireGrnMatch`, tolerance defaults, QC paths configured |

### 2.2 Seed scripts (run order)

```bash
cd backend

# 1) Multi-UOM certification items (Pipe KG, Pipe MTR, Casting)
TENANT_SLUG=vasant-trailers npx tsx scripts/seed-multi-uom-test-items.ts

# 2) Optional: full MUOM live flow helper items (PIPE-MUOM-MTR, etc.)
# npm run test:purchase-multi-unit-uom-live  # creates items if missing

# 3) Receiving tolerance masters (if seed script did not create)
# MUOM-QTY-2 (2%), MUOM-WGT-5 (5%) — created by seed-multi-uom-test-items.ts
```

### 2.3 Certification item catalog

Align with `item-master-functional-rules.md` reference fixtures.

| Code | Name | Base | Purchase | Factor | Receipt mode | Qty tol | Weight tol | QC | Batch |
|------|------|------|----------|--------|--------------|---------|------------|-----|-------|
| `MS-PIPE-DN25-KG` | MS Pipe DN25 | NOS | KG | 50 | UNIT_ONLY | 2% | — | Off | Optional |
| `MS-PIPE-LEN-MTR` | MS Pipe 6M | NOS | MTR | 6 | UNIT_ONLY | 2% | — | Off | Off |
| `CASTING-KG-MUOM` | Casting wheel | NOS | KG | 25 | UNIT_AND_WEIGHT | 0% | 5% | On | Off |
| `BOLT-MUOM-NOS` | Bolt 1:1 | NOS | NOS | 1 | UNIT_ONLY | 0% | — | Off | Off |

**Item Master validation after seed:**

```sql
SELECT i.code, i.base_uom_id, pu.code AS purchase_uom, i.uom_conversion_factor,
       c.uom_id, cu.code AS conv_uom, c.conversion_factor, c.is_purchase_allowed, c.is_default_purchase
FROM master_items i
LEFT JOIN master_uoms pu ON pu.id = i.purchase_uom_id
LEFT JOIN master_item_uom_conversions c ON c.item_id = i.id AND c.tenant_id = i.tenant_id
LEFT JOIN master_uoms cu ON cu.id = c.uom_id
WHERE i.code IN ('MS-PIPE-DN25-KG','MS-PIPE-LEN-MTR','CASTING-KG-MUOM')
  AND i.deleted_at IS NULL;
```

Expected: each item has base NOS row (factor 1) + default purchase row with correct factor.

### 2.4 Test vendors (for comparison scenarios)

| Vendor | Role in tests |
|--------|----------------|
| Vendor A | Wins comparison — 5000 KG @ ₹80/KG |
| Vendor B | Loser — 100 NOS @ ₹4,200/NOS (same base cost higher) |

Create or reuse two active vendors; record IDs in test run sheet.

### 2.5 Document number prefix

Use run id in remarks for traceability, e.g. `CERT-MUOM-20260805-01`.

---

## 3. Test scenarios

### Legend

- **Commercial qty** = vendor/purchase UOM qty (`uomQuantity`, `receivedUomQuantity`)
- **Stock qty** = base/inventory qty (`quantity`, `receivedQuantity`)
- **Factor** = vendor units per 1 base unit (50 KG = 1 NOS → factor 50)

---

### Scenario CERT-01 — Golden flow (KG → NOS, full chain)

**Level:** P1 (PO direct) / P2 (full PR→RFQ→VQ path after Phase B)

| Step | Action | Data |
|------|--------|------|
| 1 | Create PO (or Comparison→PO after Phase B) | Item `MS-PIPE-DN25-KG`, 5000 KG @ ₹80/KG |
| 2 | Approve & release PO | — |
| 3 | Create GRN | Receive 5000 KG |
| 4 | Submit GRN | No QC |
| 5 | Create invoice from GRN | Match PO + GRN |
| 6 | Post invoice (if workflow requires) | — |

**Expected results:**

| Check | Expected |
|-------|----------|
| PO line | `uom_quantity=5000`, `quantity=100`, `uom_conversion_factor=50`, `unit_cost_primary=4000`, `amount=400000` |
| GRN line | `received_uom_quantity=5000`, `received_quantity=100`, factor=50 |
| Stock balance | +100 NOS |
| FIFO layer | unit cost ≈ ₹4000/NOS |
| Invoice line | `uom_quantity_snapshot=5000`, `quantity=100`, `amount=400000` |
| PO open qty | 0 NOS |

---

### Scenario CERT-02 — Comparison → PO (Phase 1 fix)

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PR → RFQ → VQ | VQ line: 5000 KG @ ₹80/KG (commercial qty) |
| 2 | Comparison → award → create PO | Vendor A |

**Expected:** PO **not** 5000 NOS. PO = 5000 KG / 100 NOS / factor 50.

---

### Scenario CERT-03 — GRN within tolerance (+2%)

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PO | 5000 KG → 100 NOS |
| 2 | GRN | Receive **5100 KG** |

**Expected:**

| Check | Expected |
|-------|----------|
| Stock qty | 102 NOS |
| Tolerance status | WITHIN_TOLERANCE or EXACT (item 2%) |
| PO received | 102 NOS base |

---

### Scenario CERT-04 — GRN excess (approval required)

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PO | 5000 KG |
| 2 | GRN | Receive **5300 KG** (+6%) |

**Expected:** Tolerance status REQUIRES_APPROVAL or EXCESS_OUTSIDE_TOLERANCE; stock not posted until approved (per setup).

---

### Scenario CERT-05 — Partial GRN (short receipt)

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PO | 5000 KG → 100 NOS |
| 2 | GRN #1 | 4500 KG → 90 NOS |
| 3 | GRN #2 | Remaining 500 KG → 10 NOS |

**Expected:** After GRN#1: PO open 10 NOS; stock +90; receiving condition suggests SHORT on line 1.

---

### Scenario CERT-06 — MTR → NOS conversion

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PO | Item `MS-PIPE-LEN-MTR`, 30 MTR @ ₹30/MTR |
| 2 | GRN | 30 MTR |

**Expected:** PO/GRN stock qty = 10 NOS; amount = ₹900; `unit_cost_primary=90`.

---

### Scenario CERT-07 — QC hold path

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PO + GRN | Item `CASTING-KG-MUOM`, qcRequired=true, 250 KG → 10 NOS |
| 2 | Submit GRN | Inspection required |
| 3 | Create QI from GRN | — |
| 4 | QI accept | 250 KG / 10 NOS |

**Expected:**

| Check | Expected |
|-------|----------|
| After GRN submit | Stock in QC_HOLD (not unrestricted) |
| After QI complete | Transfer to UNRESTRICTED accepted qty |
| Movement | Base qty only on balance |

---

### Scenario CERT-08 — Weight tolerance (casting)

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | PO | CASTING, 250 KG, standard weight 10 KG/NOS → expected 100 KG |
| 2 | GRN | Receive 250 KG, weight 106 KG (+6% vs expected) |

**Expected:** Weight tolerance flags EXCESS; qty tolerance 0% on units.

---

### Scenario CERT-09 — Invoice three-way match

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | Complete CERT-01 or CERT-03 | — |
| 2 | Invoice | Vendor qty 5100 KG @ ₹80/KG (if CERT-03) |

**Expected:**

| Check | Expected |
|-------|----------|
| Line amount | 5100 × 80 = **408000** (not 102 × 80) |
| Qty match | Commercial qty vs GRN `received_uom_quantity` |
| Rate match | Within setup tolerance |

---

### Scenario CERT-10 — Factor snapshot immutability

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | Create PO at factor 50 | MS-PIPE-DN25-KG |
| 2 | Change item master factor to 52 | After PO approved |
| 3 | New PO | Same item |

**Expected:** Old PO line factor remains 50; new PO uses 52.

---

### Scenario CERT-11 — Purchase Return (material return)

**Level:** P1

| Step | Action | Data |
|------|--------|------|
| 1 | GRN received 100 NOS | CERT-01 |
| 2 | PRT partial return | 50 NOS to vendor |

**Expected:** Stock −50 NOS; GRN returnable qty updated; ISSUE movement.

---

### Scenario CERT-12 — PR / RFQ / VQ dual-UOM (Phase B)

**Level:** P2 — **Known gap until Phase B schema**

| Step | Action | Data |
|------|--------|------|
| 1 | PR | Required 100 NOS + purchase estimate 5000 KG |
| 2 | RFQ | 5000 KG |
| 3 | VQ compare | Normalize cost/NOS |

**Expected (Phase B):** Full audit trail PR→RFQ→VQ→PO with dual fields + factor snapshot.

**Current (Phase 1):** PR/RFQ/VQ store single qty; certify PO path via direct PO or Comparison→PO only.

---

### Scenario CERT-13 — Accounting / AP handoff

**Level:** P1 (when AP module enabled)

| Step | Action | Data |
|------|--------|------|
| 1 | Post purchase invoice | From CERT-01 |
| 2 | Verify vendor invoice / GRIR | Money Out |

**Expected:** AP document total = invoice total; GL inventory/GRIR per `PURCHASE_AP_INTEGRATION.md`.

---

## 4. Expected results summary matrix

| Scenario | PO commercial | PO stock | GRN commercial | GRN stock | Invoice amt basis | Stock Δ |
|----------|---------------|----------|------------------|-----------|-------------------|---------|
| CERT-01 | 5000 KG | 100 NOS | 5000 KG | 100 NOS | vendor qty × rate | +100 |
| CERT-03 | 5000 KG | 100 NOS | 5100 KG | 102 NOS | 5100×80 | +102 |
| CERT-05a | 5000 KG | 100 NOS | 4500 KG | 90 NOS | 4500×80 | +90 |
| CERT-06 | 30 MTR | 10 NOS | 30 MTR | 10 NOS | 900 | +10 |
| CERT-02 | 5000 KG | 100 NOS | — | — | — | — |

---

## 5. SQL validation queries

Replace `@tenant_id` and `@doc_number` per run. Existing script: `backend/scripts/audit-multi-uom-data-consistency.sql`.

### 5.1 Global dual-UOM drift (must return 0 rows post-cert)

```sql
-- PO lines: quantity = uom_quantity / factor
SELECT po.order_number, pol.line_number, pol.uom_quantity, pol.quantity, pol.uom_conversion_factor
FROM purchase_order_lines pol
JOIN purchase_orders po ON po.id = pol.purchase_order_id
WHERE po.tenant_id = @tenant_id AND po.deleted_at IS NULL
  AND pol.uom_conversion_factor > 0
  AND ABS(pol.quantity - (pol.uom_quantity / pol.uom_conversion_factor)) > 0.01;

-- GRN lines: received_quantity = received_uom_quantity / factor
SELECT gr.grn_number, grl.line_number, grl.received_uom_quantity, grl.received_quantity, grl.uom_conversion_factor
FROM goods_receipt_lines grl
JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
WHERE gr.tenant_id = @tenant_id AND gr.deleted_at IS NULL
  AND grl.uom_conversion_factor > 0
  AND grl.received_uom_quantity > 0
  AND ABS(grl.received_quantity - (grl.received_uom_quantity / grl.uom_conversion_factor)) > 0.01;
```

### 5.2 Trace one certification PO end-to-end

```sql
SET @order_number = 'PO-000XXX';

SELECT 'PO' AS doc, pol.line_number, pol.uom_quantity, pol.quantity, pol.uom_conversion_factor,
       pol.rate, pol.unit_cost_primary, pol.amount
FROM purchase_order_lines pol
JOIN purchase_orders po ON po.id = pol.purchase_order_id
WHERE po.order_number = @order_number AND po.tenant_id = @tenant_id;

SELECT 'GRN' AS doc, gr.grn_number, grl.line_number, grl.received_uom_quantity, grl.received_quantity,
       grl.uom_conversion_factor, grl.tolerance_status, grl.accepted_quantity
FROM goods_receipt_lines grl
JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
JOIN purchase_orders po ON po.id = pol.purchase_order_id
WHERE po.order_number = @order_number;

SELECT 'INVOICE' AS doc, pil.line_number, pil.uom_quantity_snapshot, pil.quantity,
       pil.uom_conversion_factor_snapshot, pil.rate, pil.amount
FROM purchase_invoice_lines pil
JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
JOIN purchase_orders po ON po.id = pi.purchase_order_id
WHERE po.order_number = @order_number;
```

### 5.3 Stock balance (base UOM)

```sql
SELECT i.code, w.code AS warehouse, sb.quantity AS balance
FROM inventory_stock_balances sb
JOIN master_items i ON i.id = sb.item_id
JOIN master_warehouses w ON w.id = sb.warehouse_id
WHERE sb.tenant_id = @tenant_id
  AND i.code IN ('MS-PIPE-DN25-KG','MS-PIPE-LEN-MTR','CASTING-KG-MUOM');
```

### 5.4 FIFO cost layer from GRN receipt

```sql
SELECT i.code, cl.original_quantity, cl.remaining_quantity, cl.unit_cost, cl.receipt_date, sm.movement_number
FROM inventory_cost_layers cl
JOIN master_items i ON i.id = cl.item_id
JOIN inventory_stock_movements sm ON sm.id = cl.source_movement_id
WHERE cl.tenant_id = @tenant_id
  AND i.code = 'MS-PIPE-DN25-KG'
ORDER BY cl.receipt_date DESC
LIMIT 5;
```

### 5.5 Comparison → PO dual fields

```sql
SELECT po.order_number, po.origin, pol.uom_quantity, pol.quantity, pol.uom_conversion_factor
FROM purchase_orders po
JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
WHERE po.tenant_id = @tenant_id
  AND po.origin = 'RFQ_COMPARISON'
  AND po.deleted_at IS NULL
ORDER BY po.created_at DESC
LIMIT 10;
```

Expected: `uom_quantity > 0` and `quantity = uom_quantity / factor` for MUOM items.

### 5.6 Invoice amount sanity (not base × vendor rate)

```sql
SELECT pi.invoice_number, pil.line_number, pil.quantity AS base_qty,
       pil.uom_quantity_snapshot AS vendor_qty, pil.rate,
       pil.amount,
       pil.uom_quantity_snapshot * pil.rate AS expected_amount
FROM purchase_invoice_lines pil
JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
WHERE pi.tenant_id = @tenant_id
  AND pil.uom_quantity_snapshot IS NOT NULL
  AND ABS(pil.amount - (pil.uom_quantity_snapshot * pil.rate)) > 1;
```

Expected: **0 rows** for dual-UOM invoices.

### 5.7 QC hold movements

```sql
SELECT sm.movement_number, sm.movement_type, sm.quantity, sm.stock_status, gr.grn_number
FROM inventory_stock_movements sm
JOIN goods_receipts gr ON gr.id = sm.reference_id AND sm.reference_type = 'GOODS_RECEIPT'
WHERE sm.tenant_id = @tenant_id
  AND sm.stock_status IN ('QC_HOLD','UNRESTRICTED')
ORDER BY sm.created_at DESC
LIMIT 20;
```

---

## 6. API validation checklist

Base path: `/api/v1/t/{tenantSlug}/purchase/…`  
Auth: Bearer token; all responses tenant-scoped.

### 6.1 Item Master

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| IM-1 | `/items/{id}` | GET | `uomConversions[]` with base + purchase rows; factor direction 1 BASE = X PURCHASE |
| IM-2 | `/items` | POST/PUT | Changing factor does not alter existing PO lines |

### 6.2 Purchase Requisition

| # | Endpoint | Method | Assert | Level |
|---|----------|--------|--------|-------|
| PR-1 | `/requisitions` | POST | Line saves `requiredQuantity`, `uomId` | P1 |
| PR-2 | `/requisitions/{id}` | GET | Dual qty fields when Phase B live | P2 |
| PR-3 | `/requisitions/{id}/convert-to-rfq` | POST | RFQ lines inherit qty + uomId | P1 |

### 6.3 RFQ

| # | Endpoint | Method | Assert | Level |
|---|----------|--------|--------|-------|
| RFQ-1 | `/rfqs/{id}` | GET | Lines have `uomId` populated from PR | P1 |
| RFQ-2 | `/rfqs/{id}/send` | POST | Status SENT | P1 |

### 6.4 Vendor Quotation

| # | Endpoint | Method | Assert | Level |
|---|----------|--------|--------|-------|
| VQ-1 | `/vendor-quotations` | POST | `quantity` = commercial qty, `uomId`, `rate` | P1 |
| VQ-2 | `/vendor-quotations/{id}/submit` | POST | Status SUBMITTED | P1 |

### 6.5 Comparison

| # | Endpoint | Method | Assert | Level |
|---|----------|--------|--------|-------|
| CMP-1 | `/comparisons` | POST | Lines from submitted VQs | P1 |
| CMP-2 | `/comparisons/{id}/award` | POST | Vendor selected | P1 |
| CMP-3 | `/comparisons/{id}/create-po` | POST | PO lines: `uomQuantity`, `quantity`, `uomConversionFactor`, `unitCostPrimary` | **P1 critical** |
| CMP-4 | `/comparisons/{id}/create-po` | POST | Duplicate → 409 | P1 |

### 6.6 Purchase Order

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| PO-1 | `/orders` | POST | Dual qty from `uomQuantity`; enrichment rejects wrong factor |
| PO-2 | `/orders/{id}` | GET | `lines[].uomQuantity`, `quantity`, `uomConversionFactor`, `unitCostPrimary` |
| PO-3 | `/orders/{id}/submit` → approve | POST | Workflow; factor unchanged after approve |
| PO-4 | `/orders/{id}/lines` | — | `amount = rate × uomQuantity` |

### 6.7 GRN

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| GRN-1 | `/grn` | POST | `receivedUomQuantity` → `receivedQuantity = receivedUom / factor` |
| GRN-2 | `/grn/{id}` | GET | Dual receive qty; tolerance snapshots |
| GRN-3 | `/grn/{id}/submit` | POST | Stock movement base qty; optional `uomQuantity` audit |
| GRN-4 | `/grn/{id}/submit` | POST | QC item → QC_HOLD movement first |

### 6.8 Quality Inspection

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| QI-1 | `/quality-inspections` | POST | Linked to GRN |
| QI-2 | `/quality-inspections/{id}/complete` | POST | Accepted/rejected base qty; release from QC_HOLD |

### 6.9 Purchase Invoice

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| PI-1 | `/invoices` | POST | `amount = uomQuantitySnapshot × rate` (dual-UOM) |
| PI-2 | `/invoices/{id}` | GET | Snapshots: `uomQuantitySnapshot`, `uomConversionFactorSnapshot` |
| PI-3 | `/invoices/from-grn/{id}` | POST | Prefill vendor qty from GRN |
| PI-4 | `/invoices/{id}/submit` | POST | Three-way match uses commercial qty |

### 6.10 Inventory (read-only cert)

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| INV-1 | `/inventory/stock-balances` | GET | Balance in base UOM |
| INV-2 | `/inventory/movements` | GET | GRN reference; signed base `quantity` |

### 6.11 Purchase Return

| # | Endpoint | Method | Assert |
|---|----------|--------|--------|
| PRT-1 | `/returns` | POST | From GRN line |
| PRT-2 | `/returns/{id}/complete` | POST | ISSUE movement; base qty |

---

## 7. UI validation checklist

**Mode:** API (`VITE_USE_API=true`). Demo mode out of certification scope per Phase 1.

### 7.1 Item Master

| # | Screen | Check |
|---|--------|-------|
| UI-IM-1 | Item edit → UOM conversions | Shows “1 NOS = 50 KG” style (not bare factor) |
| UI-IM-2 | UOM conversions table | Base row factor 1; purchase allowed + default flags |
| UI-IM-3 | Receipt entry mode | UNIT_ONLY / UNIT_AND_WEIGHT matches item rules |
| UI-IM-4 | Tolerance FKs | Receiving + weight tolerance linked |

### 7.2 Purchase Requisition

| # | Screen | Check | Level |
|---|--------|-------|-------|
| UI-PR-1 | PR editor lines | UOM from item; qty cell shows purchase + base when dual | P1 partial |
| UI-PR-2 | PR save/reload | Factor not lost (Phase B: persisted) | P2 |

### 7.3 RFQ / Vendor Quotation

| # | Screen | Check | Level |
|---|--------|-------|-------|
| UI-RFQ-1 | RFQ editor | UOM from master (not free text) | P2 |
| UI-VQ-1 | VQ editor | Rate shown with UOM; qty = commercial | P1 |

### 7.4 Comparison

| # | Screen | Check |
|---|--------|-------|
| UI-CMP-1 | Comparison grid | Vendor rates comparable (Phase B: cost/NOS column) |
| UI-CMP-2 | Create PO action | PO opens with correct dual qty |

### 7.5 Purchase Order

| # | Screen | Check |
|---|--------|-------|
| UI-PO-1 | PO editor lines | Purchase qty editable; stock qty read-only below |
| UI-PO-2 | UOM picker | Only purchase-allowed UOMs from item |
| UI-PO-3 | Rate column | Implied `/ KG` or `/ MTR` label (Phase A UX) |
| UI-PO-4 | PO detail / print | Dual qty on print (`PurchasePrintDualQtyCell`) |

### 7.6 GRN

| # | Screen | Check |
|---|--------|-------|
| UI-GRN-1 | GRN editor receive column | User enters **purchase qty only** |
| UI-GRN-2 | GRN editor | Base qty shown under input (e.g. 5100 KG → 102 NOS) |
| UI-GRN-3 | GRN detail | Received shows vendor + stock qty |
| UI-GRN-4 | Tolerance / condition | Status + short/excess visible |
| UI-GRN-5 | GRN print | Dual ordered/received qty |

### 7.7 Quality Inspection

| # | Screen | Check |
|---|--------|-------|
| UI-QI-1 | QI from GRN | Lines match GRN accepted-for-QC qty |
| UI-QI-2 | QI complete | GRN status → inventory posted unrestricted |

### 7.8 Purchase Invoice

| # | Screen | Check |
|---|--------|-------|
| UI-PI-1 | Invoice from GRN | Amount matches vendor qty × rate |
| UI-PI-2 | Invoice print | Dual qty snapshot when present |
| UI-PI-3 | Match warnings | Commercial qty tolerance messages |

### 7.9 Inventory / Accounting

| # | Screen | Check |
|---|--------|-------|
| UI-INV-1 | Stock inquiry | Balance in NOS (base) |
| UI-INV-2 | FIFO layers | Unit cost = `unitCostPrimary` from GRN |
| UI-AP-1 | Vendor invoice (Money Out) | Total matches purchase invoice |

---

## 8. Sign-off criteria

### Phase 1 certification (minimum for release)

- [ ] CERT-01, CERT-02, CERT-03, CERT-05, CERT-06 pass (API + SQL)
- [ ] SQL sections 5.1 and 5.6 return **0 drift rows**
- [ ] UI-GRN-1/2/3 pass on MS-PIPE-DN25-KG
- [ ] UI-PO-1 pass
- [ ] `multi-uom-phase1-unit.test.ts` — 11/11 pass in CI
- [ ] Known gaps documented for PR/RFQ/VQ (CERT-12 deferred)

### Full certification (post Phase B)

- [ ] CERT-12 pass (PR dual-UOM persisted end-to-end)
- [ ] Golden flow automated test green
- [ ] All UI checklist items P2 marked pass

---

## 9. Test execution log template

| Run ID | Date | Tester | Scenarios | SQL drift | API | UI | Result |
|--------|------|--------|-----------|-----------|-----|-----|--------|
| CERT-20260805-01 | | | CERT-01..06 | | | | |

---

## 10. Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-08-05 | Initial certification plan; aligned with Multi-UOM Phase 1 + Item Master rules |
