# Inventory Costing UAT-1 — Implementation Audit

> Audited: **2026-07-28**. Code wins. Phase goal: move from **READY WITH CONDITIONS** toward production by validating the transaction chain — **not** by adding a second costing engine.

---

## 1. Executive audit verdict

| Area | Status | Notes |
|------|--------|-------|
| Canonical methods | ✅ | `FIFO`, `MOVING_WEIGHTED_AVERAGE`, `STANDARD_COST`, `SPECIFIC_IDENTIFICATION` |
| Stock posting cost entries | ✅ | 1:1 `InventoryCostEntry` per movement via `recordInventoryCostEntryInTx` |
| MA / FIFO / Standard / Specific engines | ✅ | Inside `stock-posting.service.ts` |
| WO material = Inventory cost entry | ✅ | IV-MFG-1 — `work-order-cost.service.ts` prefers `INVENTORY_COST_ENTRY` |
| Costing FE workspace | ✅ | Overview → Method Change under `/inventory/costing/*` |
| Inventory ↔ GL TB | ✅ Wired | Costing recon/overview call FIN-CLOSE-1 `buildInventoryGlTrialBalance` when `INVENTORY_ACCOUNTING` on; off → Not Available (not ₹0) |
| Method change preview / readiness | ✅ | Readiness PASS/WARNING/BLOCKED; soft mid-period gate |
| Transfer layer preservation | ✅ | Receive uses dispatch cost entry unit cost |
| Standard Cost create UX | ✅ | `ItemLookupSelect` |
| MA before/after history | ✅ | Derived from cost entries |
| Fine-grained costing permissions | 🔒 Deferred | `inventory.view_cost` / `inventory.setup.manage` (dedicated approve deferred) |
| Live UI golden-path UAT | ✅ API harness | `npm run test:inventory-costing-spa-uat`; residual human browser walk optional |

---

## 2. Backend SoT map

| Concern | Authority |
|---------|-----------|
| Valuation method | `InventorySettings.general.defaultCostingMethod` via `resolveValuationMethodInTx` / `getEffectiveValuationMethod` |
| Qty / value balance | `InventoryStockBalance` updated in posting tx |
| Cost evidence | `InventoryCostEntry` (immutable intent; upsert keyed by movement) |
| FIFO / Specific layers | `InventoryCostLayer` + `InventoryCostLayerConsumption` |
| Standard versions | `InventoryItemStandardCostVersion` |
| Variances | `InventoryCostVariance` (`STANDARD_RECEIPT` / `STANDARD_ISSUE`) |
| Method audit | `InventoryValuationMethodChange` |
| WO material | Consumes inventory cost entry — does **not** re-run FIFO/MA |

**Key files**

- `backend/src/modules/inventory/shared/stock-posting.service.ts`
- `backend/src/modules/inventory/costing/*`
- `backend/src/modules/manufacturing/costing/work-order-cost.service.ts`
- `backend/src/modules/purchase/shared/purchase-inventory-posting.ts`
- `backend/src/modules/inventory/transfers/transfer.service.ts`
- `backend/src/modules/dispatch/posting/dispatch-posting.service.ts`

---

## 3. Method behaviour (canonical)

### Moving Weighted Average

- Receipts update weighted avg (`avgRate` 4dp); `stockValue = qty × avgRate` (2dp) — can drift vs sum of receipt values (e.g. 1500 × 73.3333 = 109999.95).
- Issues **always** use current `avgRate` (caller rate ignored).
- `RETURN_FROM_WO`: no layer restore; receipt rate = caller rate if >0 else current avg.
- Correction: new movement + new cost entry (idempotency prevents duplicates on same key).

### FIFO

- Receipt → OPEN layer; issue → oldest-first consumption + consumption rows.
- `RETURN_FROM_WO`: restores original layers (`fifo-return-restore.service.ts`); wrong caller rate ignored when restore applies.
- Fail-closed if insufficient layer qty.

### Standard Cost

- Inventory valued at active standard (version → else `MasterItem.standardRate`).
- Actual ≠ standard → variance row; inventory still at standard.
- Fail-closed when no usable standard (>0).

### Specific Identification

- Serial or lot required on movement.
- Layers carry identity; issue prefers matching identity, then unidentified opening pool.
- UI/API flag `SPECIFIC_COST_NOT_IDENTIFIED` for null serial+lot OPEN layers.

---

## 4. Cross-module paths

| Flow | Posting | Costing |
|------|---------|---------|
| GRN | `postGrnStockInward` → `INWARD`/`GRN` | Full method engine |
| Purchase return | `postPurchaseReturnStockIssue` → `ISSUE` (no rate) | Engine default |
| WO issue/return | Material handlers → `ISSUE_TO_WO` / `RETURN_FROM_WO` | Engine + WO cost consume entry |
| FG receipt | Manufacturing FG posting | Cost entry at capitalised rate |
| Dispatch | `postFgDispatchIssue` → `FG_DISPATCH` | Method-driven relief (COGS GL separate/deferred) |
| Transfer | `TRANSFER_DISPATCH` + `TRANSFER_RECEIPT` | **Risk:** receive may not preserve exact dispatch cost |

---

## 5. Reconciliation today

- Physical `onHandQty`/`stockValue` vs OPEN layer remaining (FIFO/Specific).
- MA/Standard: layer check skipped → typically `MATCHED`.
- Reason codes present: `COSTED_QTY_MISMATCH`, `FIFO_LAYER_MISMATCH`, `NEGATIVE_STOCK_COST_PENDING`.
- Overview attention also: `UNCOSTED_MOVEMENT`, `SPECIFIC_COST_NOT_IDENTIFIED`, `MISSING_STANDARD_COST`.
- GL: when Inventory Accounting is enabled, summary pulls RM+FG from FIN-CLOSE-1 Inventory↔GL trial balance; when off, **Not Available** (never ₹0). Force Balance never allowed.

---

## 6. Method change today

- `POST …/method-change` with `inventory.setup.manage`.
- Soft mid-period gate unless `force` / policy.
- Optional FIFO/Specific opening migration.
- **No** readiness checklist, valuation preview, or separate approve step.
- Historical cost entries retain posted `valuationMethod` (correct immutability).

---

## 7. Frontend gaps (UAT-relevant)

| Gap | Location |
|-----|----------|
| UUID item input | `InventoryStandardCostPage.tsx` |
| MA history without before/after | `InventoryAverageCostPage.tsx` |
| Thin method-change wizard | `InventoryMethodChangePage.tsx` |
| No cost evidence drawer | Full-page detail only |
| Specific serial display | Truncated UUIDs on some cells |

Reusable fix: `ItemLookupSelect` (`components/lookups/ItemLookupSelect.tsx`).

---

## 8. Existing automated coverage

| Test | Covers |
|------|--------|
| `inventory-moving-average.test.ts` | Weighted receipts; ignore issue rate |
| `inventory-fifo-layers.test.ts` | Layer create/consume |
| `inventory-fifo-return-restore.test.ts` | WO return restore |
| `inventory-fifo-opening-migration.test.ts` | Opening layers |
| `inventory-specific-identification.test.ts` | Serial/lot required; lot cost |
| `inventory-costing-phasec.test.ts` | Standard + variance; method→FIFO |
| `inventory-costing-golden-path-ma-fifo.test.ts` | MA/FIFO WO/FG/recon golden path |
| `inventory-mfg-valuation-adapter.test.ts` | Method mappers |

**Gaps for UAT-1:** Standard fail-closed + version dates; Specific issue/return/transfer; FIFO transfer cost preservation; method-change readiness; tenant isolation; purchase return per method; dispatch relief matrix.

---

## 9. Hard blockers (must clear for READY FOR PRODUCTION)

1. Transfer must not invent profit/loss (exact cost preservation).
2. WO material amount must equal linked Inventory cost entry.
3. FIFO open layers must reconcile to costed on-hand.
4. Specific serial cost must not average.
5. Standard must fail-closed (no silent MA/FIFO fallback).
6. Corrections must not mutate original history.
7. Idempotent re-post must not duplicate value.
8. Tenant isolation on costing data.
9. Controlled UAT evidence for all four methods + cross-module chain.

---

## 10. Non-goals (this phase)

- Second costing engine / LIFO / replacement cost
- COGS GL / Sales Invoice automation
- Force-balance reconciliation
- Purchase or Manufacturing redesign
- Fine-grained permission sprawl unless required for method-change gates

---

## 11. UAT-1 hardening plan (from this audit)

1. Fix transfer receive to use dispatch cost entry unit cost.
2. Method-change readiness + preview APIs + wizard steps.
3. Derived MA before/after history from cost entries (display-only).
4. Standard Cost `ItemLookupSelect`.
5. Expand recon reason codes where evidence exists.
6. Idempotent fixture + automated UAT suite for four methods + transfer + invariants.
7. Document controlled UAT, invariants, readiness — verdict from evidence only.
