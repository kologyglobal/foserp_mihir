# Purchase Transaction UAT Fix Plan

**Created:** 2026-08-06  
**Scope:** Item Master + PR → PO → GRN → Return + list UX  
**Goal:** Close the 16 UAT items with UI + API + DB parity in API mode (`VITE_USE_API=true`).

---

## How to read this plan

| Column | Meaning |
|--------|---------|
| **Status** | `Done` (shipped in branch) · `Partial` · `Open` |
| **DB** | Schema/migration/seed work required |
| **Layer** | FE = frontend · BE = backend · DATA = master seed |

**Completion rule:** Each item needs live test evidence — not demo-only behavior.

---

## Executive summary

Most issues cluster into **five root themes**:

1. **Smart-select / RHF wiring** — Tab/blur does not commit dropdown values; `watch`+`setValue` fields miss `shouldDirty`; form `reset()` on master hydrate wipes in-progress edits.
2. **Master data → transaction defaults** — Default bin, preferred vendor, UOM conversion, and bin cache must flow PR → PO → GRN consistently.
3. **Tax snapshot timing** — PO created from PR/planning saves with `taxAmount: 0` until manual save; PR intentionally has no GST.
4. **GRN receipt model** — Received qty starts at 0 by design; tolerance exists on backend but may be bypassed on draft save or wrong UOM axis; partial lines and reverse need UI parity with stored lines.
5. **List persistence** — Column layout persists in `localStorage`; sort/active view do not auto-restore on refresh.

**DB migrations likely needed on live:** confirm deployed — not new design work for most items.

| Migration | Purpose |
|-----------|---------|
| `20260805140000_purchase_tax_snapshots` | PO line GST snapshots |
| `20260806110000_grn_line_partial_reverse` | Partial GRN reverse quantities |
| `20260728140000_grn_receiving_tolerance` | GRN over-receipt tolerance |
| `20260805120000_grn_receiving_condition_weight_tolerance` | Weight tolerance |

**Master DATA (not schema):** seed **Bin Master** rows linked to default warehouse; set item `defaultBinId` and PR line `preferredVendorId` in UAT data.

---

## Issue matrix (16 items)

### A. Item Master

| # | Issue | Status | Root cause | Fix | DB |
|---|-------|--------|------------|-----|-----|
| **1** | UOM dropdown (e.g. NOS) not updating on Tab | **Open** | `ErpSmartSelect` only commits Tab when list is open **and** a row is highlighted; closing without Enter/click leaves value unchanged. Form `reset()` when `uoms` hydrates can revert selection. | **FE:** On blur, commit highlighted or single filtered match; add `shouldDirty: true` on all master `setValue` calls; debounce or guard `reset()` while form is dirty; optional Enter-to-commit. Apply pattern to **all** master smart-selects (`UomMasterSelect`, category, HSN, vendor-like fields). | No |
| **2** | General Quantity not syncing to Purchase UOM section | **Partial** | `applyQuantityPerUomToPurchaseRows` is a **no-op** when purchase UOM = base UOM (no alternate row). `baseUomId` change does not rebuild conversion rows. | **FE:** When only base row exists, still update visible factor / show message; on `baseUomId` change rebuild rows via `itemToUomConversionRows`; unify on `applyGeneralQuantityToPurchaseUoms` OR document that sync requires alternate purchase UOM. | No |
| **4** | Default Bin Code on Item Master + auto-flow to transactions | **Partial** | Field **already exists** (`defaultBinId` in DB, form in Purchase section). Gap: transactions don't always resolve bin because bin cache empty or `binId` not written on PR/PO lines. | **FE:** Ensure `useBinOptions` cache populated before PR/PO/GRN save; PR line patch sets `binId`+`binCode` (recent fix). **DATA:** Seed bins; set item defaults. **FE:** PO/GRN line add uses `resolveItemDefaultBin()`. | No (field exists) |
| **15** | Multi-UOM not working properly | **Partial** | Backend UOM columns exist; FE sync between General qty, conversion grid, and PO/GRN dual qty is fragile. PO-from-PR skips tax/UOM enrichment at create. | **FE+BE:** Phase 3 below — end-to-end test script `test-purchase-multi-unit-uom-flow.ts` as acceptance gate. | No |

**Files:** `ItemPages.tsx`, `ItemUomConversionEditor.tsx`, `ErpSmartSelect.tsx`, `itemDefaultBin.ts`, `useBinOptions.ts`

---

### B. Purchase Requisition

| # | Issue | Status | Root cause | Fix | DB |
|---|-------|--------|------------|-----|-----|
| **3** | New PR UI not proper; GST not showing / should be removed | **Open** | PR is **pre-commercial by design** — `taxPct: 0`, no GST panel. UI regressions from line grid CSS migration (sticky columns). | **Product decision:** (A) Remove all GST hints on PR — label as "Demand only, no tax"; clean totals block. (B) If estimate GST wanted, add optional read-only Est. GST column using item `gstRatePct` — not persisted. **FE:** Verify `purchase-doc-lines-grid-scroll` layout on PR create/edit. | No |
| **5** | Partial PR → PO with line selection | **Partial** | Implemented via `PoCreateFromPrPanel` + `/purchase/orders/new?mode=pr&prId=…`. Requires planning sheet rows (sync on approve) + vendor + rate. | **Doc + UX:** Add in-app guide on PR detail: select lines → Create PO panel → vendor → qty per line. **FE:** Ensure list/detail "Create PO" navigates to panel (recent branch changes). **BE:** Support `partially_converted` PR status (recent). | No |
| **12** | List columns reset on refresh; doc number sort | **Partial** | Columns persist in `localStorage` (`vasant-erp-grid-column-layouts`); **sort/active view do not** auto-restore. Saved views don't include column layout. | **FE:** Persist last `sortBy` per route; auto-apply default saved view on mount; sync header doc# sort ↔ Sort dropdown; numeric sort fn; add saved views to GRN list. | No |

**Files:** `PurchaseRequisitionEditorPage.tsx`, `PurchaseRequisitionLinesTable.tsx`, `PoCreateFromPrPanel.tsx`, `PurchaseRequisitionListPage.tsx`, `useSavedViews.ts`, `DataGrid.tsx`

---

### C. Purchase Order

| # | Issue | Status | Root cause | Fix | DB |
|---|-------|--------|------------|-----|-----|
| **6** | PO from PR — vendor not selected | **Open** | Planning row `selectedVendorId` empty when PR lines lack `preferredVendorId`; silent convert path; vendor master hydrate lag. | **FE:** Block Create PO until vendor chosen in `PoCreateFromPrPanel`; pre-fill from single preferred vendor across selected lines. **BE:** On PR approve sync, copy preferred vendor → planning `selectedVendorId`. **DATA:** Set preferred vendor on PR lines in UAT. | No |
| **7** | PO Bin code dropdown empty | **Open** | No bins in master / API returns empty; `useBinOptions` filtered by warehouse with no matches; line stores `binId` but dropdown options not loaded. | **DATA:** Seed `MasterBin` for default warehouse. **FE:** Load bins when delivery warehouse set; show empty-state hint; map saved `binId` to label via cache (`getCachedPurchaseBins`). | No |
| **16** | PO GST calculation wrong | **Partial** | PO from planning creates lines with `taxAmount: 0` — **no** `fillLineMasterSnapshots` at create. Place of supply / interstate fixes recent but snapshots missing until save. | **BE:** Call `fillLineMasterSnapshots` + header tax recompute in `purchase-planning-create-po.service.ts` after line insert. **FE:** Map API line tax from snapshots (`computePurchasePoLineTax` — recent). **Deploy:** tax snapshot migration. | Deploy migration |

**Files:** `purchase-planning-create-po.service.ts`, `purchase-tax-snapshot.ts`, `PurchaseOrderEditorPage.tsx`, `purchaseMappers.ts`, `purchasePlaceOfSupply.ts`

---

### D. GRN

| # | Issue | Status | Root cause | Fix | DB |
|---|-------|--------|------------|-----|-----|
| **8** | GRN Bin code not selected / not showing | **Open** | Same as PO #7; PO line bin not mapped to GRN draft; cache empty. | **FE:** `linesFromPo` copy `binId`/`binCode` from PO; pre-select in dropdown when options load. User can override on GRN. | No |
| **10** | Received field blank — user wants manual entry | **By design** | Received defaults to **0** intentionally (`grnLineDraft.ts`). PO qty shown in separate column. | **UX:** Rename columns (PO Qty / Pending / **Received this time**); placeholder "Enter qty"; optional "Fill pending" row action — **do not** auto-fill without user action unless product asks. | No |
| **11** | GRN saves qty 110 when PO is 10 (no tolerance error) | **Open** | Backend has `GRN_QTY_EXCEEDS`; likely failure on: draft save path skipping validation, UOM axis mismatch (purchase UOM vs base), or `maximumAllowedUnitQuantity` not computed on line. | **BE:** Assert tolerance on submit/post, not only draft; audit `evaluateGrnLineTolerance` input units. **FE:** Block save with inline error from `evaluateGrnLineTolerance`. **Test:** Extend `grn-tolerance.test.ts` with 10→110 scenario. | No |
| **13** | Posted GRN shows all PO lines, not only received | **Partial** | Web filters via `isIncludedGrnLine`; legacy DB rows may have zero-qty lines stored; mobile shows all lines. | **BE:** On post, persist only received/short-closed lines (or mark excluded). **FE:** Verify `GrnDetailPage` filter. **Mobile:** Apply same filter. **DATA:** Run cleanup script if legacy rows exist. | Optional data fix |
| **14** | Reverse GRN — reverse entry not visible; want single-line reverse | **Partial** | Partial reverse migration + checkbox modal exist (`GrnDetailPage`). Reverse history may not render on posted view; reverses full **remaining** qty per line, not arbitrary partial qty. | **FE:** Show reverse audit block on posted GRN (lines reversed, qty, date, user). **BE:** Ensure `reversedQuantity` exposed in mapper DTO. **Product:** Confirm line-level full reverse is acceptable vs qty-partial reverse. | Deploy `20260806110000` |

**Files:** `GrnEditorPage.tsx`, `grnLineDraft.ts`, `grnTolerance.ts`, `goods-receipt.service.ts`, `GrnDetailPage.tsx`, `goods-receipt.mapper.ts`

---

### E. Purchase Return

| # | Issue | Status | Root cause | Fix | DB |
|---|-------|--------|------------|-----|-----|
| **9** | Return not working; items show without GRN | **Partial** | Returns are **GRN-line-bound by design** — unreceived PO items must not appear. Empty rows / vendor-first UX confuses users. | **FE:** Audit `PurchaseReturnEditorPage` — disable item add until GRN selected; clear empty lines; improve copy. **BE:** `returnable-quantity.service.ts` only lists posted GRN lines with remaining qty. **Test:** `purchase-return` live tests. Document workflow: Posted GRN → Return → pick GRN line. | No |

**Files:** `PurchaseReturnEditorPage.tsx`, `purchase-return.service.ts`, `returnable-quantity.service.ts`

---

## Phased delivery

### Phase 1 — Master form reliability (1–2 days)

**Issues:** #1, #2, #4 (verify)

| Task | Layer |
|------|-------|
| Fix `ErpSmartSelect` blur/Tab commit + master `setValue` dirty flags | FE |
| Guard item form `reset()` when dirty | FE |
| Rebuild UOM rows on `baseUomId` change; clarify sync when purchase UOM = base | FE |
| Verify default bin save/load; seed demo bins | FE + DATA |
| Tests: item form UOM select, qty sync | FE vitest |

**Exit:** Select NOS → Tab → save → reload shows NOS; qty sync visible when alternate purchase UOM configured.

---

### Phase 2 — PR UX + list persistence (1–2 days)

**Issues:** #3, #5, #12

| Task | Layer |
|------|-------|
| PR create layout QA; remove or relabel GST (product choice) | FE |
| Document partial PR→PO in PR detail guide / tooltip | FE + docs |
| Persist sort + auto-restore saved view; GRN saved views | FE |
| Sync doc# header sort with Sort dropdown | FE |

**Exit:** PR create layout matches PO standard; Create PO from selected lines works; sort survives refresh.

---

### Phase 3 — PO from PR + bin + GST (2–3 days)

**Issues:** #6, #7, #16, #15 (PO leg)

| Task | Layer |
|------|-------|
| `fillLineMasterSnapshots` on planning PO create | BE |
| Vendor required in `PoCreateFromPrPanel`; planning vendor sync | BE + FE |
| Bin cache + warehouse-scoped options on PO lines | FE |
| `resolveItemDefaultBin` on add-line | FE |
| Deploy tax snapshot migration on UAT DB | OPS |
| Run `test-purchase-multi-unit-uom-flow.ts` | BE script |

**Exit:** PO from PR shows vendor, bins, correct IGST/CGST on first open; multi-UOM PO line qty/rate correct.

---

### Phase 4 — GRN receipt, tolerance, partial display (2–3 days)

**Issues:** #8, #10, #11, #13, #14

| Task | Layer |
|------|-------|
| Flow bin PO → GRN with override | FE |
| Received column UX (labels, validation messages) | FE |
| Enforce tolerance on submit; FE inline errors | FE + BE |
| Posted GRN line filter; reverse history panel | FE |
| Deploy partial-reverse migration | OPS |
| Mobile GRN line filter | FE mobile |

**Exit:** Cannot post GRN 110 vs PO 10 without tolerance; posted GRN shows only received lines; partial reverse visible.

---

### Phase 5 — Purchase Return + regression (1–2 days)

**Issues:** #9 + full regression

| Task | Layer |
|------|-------|
| Return wizard GRN-first UX | FE |
| Live return tests | BE |
| End-to-end UAT script: Item → PR → PO → GRN → Return | BE + manual |

**Exit:** Return only from posted GRN; quantities respect returnable balance.

---

## DB & master data checklist (UAT tenant)

Run on target environment before UAT:

```text
[ ] npx tsx scripts/prisma-cli.ts migrate deploy
[ ] Seed or verify MasterBin rows for default warehouse
[ ] Seed UOM master (include NOS)
[ ] Items: defaultBinId, purchase UOM conversion where needed
[ ] PR lines: preferredVendorId before approve
[ ] Purchase Setup: place of supply state, GRN tolerance defaults
[ ] Optional: backend/scripts/live-fix-grn-reversed-accepted-qty.sql (legacy GRN cleanup)
[ ] Optional: backend/scripts/live-fix-purchase-upstream-tax-snapshots.sql (PO tax snapshots)
```

**No new schema required** for items #1–14 unless partial-reverse or tax snapshot migrations are missing on live.

---

## Partial PR → PO — user workflow (#5)

```text
1. Approve PR (planning sheet rows auto-created)
2. Open PR → Create PO (or /purchase/orders/new?mode=pr&prId={id})
3. In PoCreateFromPrPanel:
   - Tick lines to include
   - Set order qty ≤ remaining per line
   - Select vendor (required if multiple / none on PR)
4. Create → opens draft PO with selected lines only
```

**Prerequisites:** Planning row vendor + rate (auto from PR estimate rate — recent facade fix).

---

## Purchase Return — intended workflow (#9)

```text
Posted GRN (accepted qty > 0)
  → Purchase Return → select GRN
  → lines = returnable GRN lines only (not open PO)
  → qty ≤ accepted − already returned
  → post return
```

Unreceived PO-only items **must not** appear — if they do, that is a bug in prefill API or demo store mixing.

---

## Test evidence required

| Phase | Command / check |
|-------|-----------------|
| 1 | FE typecheck + item master manual UAT |
| 3 | `backend/scripts/test-purchase-multi-unit-uom-flow.ts` |
| 4 | `backend/tests/purchase/grn-tolerance.test.ts`, `grn-partial-reverse.test.ts` |
| 5 | Purchase return live tests + manual GRN→Return |
| All | `VITE_USE_API=true` — no demo store mixing |

---

## Priority order (recommended)

| P | Items | Why |
|---|-------|-----|
| P0 | #11, #16, #6, #7, #8 | Blocks correct procurement + tax |
| P1 | #1, #2, #4, #13, #14 | Master data + GRN trust |
| P2 | #5, #9, #10, #15 | Workflow clarity + multi-UOM |
| P3 | #3, #12 | UX polish |

---

## Related docs

- `docs/PURCHASE_UI_CONSISTENCY.md`
- `docs/PURCHASE_LIST_PAGE_STANDARD.md`
- `docs/PURCHASE_GRN_TOLERANCE.md`
- `docs/purchase/HSN_GST_TRANSACTION_SNAPSHOT_GAP_REPORT.md`
- `backend/scripts/test-purchase-multi-unit-uom-flow.ts`

---

## Change log

| Date | Note |
|------|------|
| 2026-08-06 | Initial plan from UAT item list #1–16 |
