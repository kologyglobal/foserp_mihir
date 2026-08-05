# Multi-UOM Phase 1 — Critical Stabilization (Pre-Implementation Plan)

**Status:** Awaiting go-ahead to implement (no feature code yet)  
**Prerequisite:** `docs/platform/MULTI_UOM_TRANSACTION_CONTRACT.md` (frozen)  
**Audit:** Multi-UOM Purchase Flow Audit (2026-08-05)  
**Schema changes:** **None** in Phase 1

---

## Approved scope (user-confirmed)

| # | Item | Scope |
|---|------|--------|
| 1 | Comparison → PO | Route through same UOM pipeline as normal PO create |
| 2 | Invoice amount + matching | Fix `buildLines` **and** `evaluateMatching` |
| 3 | GRN frontend | Editor + Detail + save payload (`purchaseMappers`) |
| 4 | Automated tests | Direct PO path **and** Comparison → PO path |
| 5 | Seed data | Test fixture **and** optional prisma/dev seed |
| 6 | Demo mode | **API mode only** (skip Zustand demo in Phase 1) |

**Deferred to Phase B:** PR / RFQ / VQ schema migrations, Item Master UX labels, PO column split, conversion preview panels.

---

## Decision log (do not assume otherwise)

### VendorQuotationLine.quantity (until Phase B schema)

**Treat as commercial/vendor quantity** (e.g. 5000 KG).  
On Comparison → PO: derive base qty via `resolveDualQuantities` + `enrichPoLinesWithItemUomMappings` + `normalizeLineInputs`.

### Invoice

Fix both:
- Line amount: `amount = vendorQty × vendorRate` (from snapshot or PO/GRN dual fields)
- Three-way matching: expected amount must use same vendor-qty basis, not `baseQty × vendorRate`

### Tests without PR/RFQ schema

- **Path A:** Create PO directly with dual fields → GRN → invoice → stock assertions
- **Path B:** Seed multi-UOM item → VQ with commercial qty → comparison → PO → assert dual fields on PO line

Full PR 100 NOS + RFQ 5000 KG chain waits for **Phase B**.

### GRN frontend

- `GrnEditorPage`: user edits **purchase qty only**; base qty = `purchaseQty / factor`
- `GrnDetailPage`: read-only dual display (PO vs received, vendor + stock)
- `mapDomainGrnInputToApiPayload`: always send `receivedUomQuantity`; never send base as purchase

---

## Files to change (implementation checklist)

### Priority 1 — Comparison → PO

| File | Change |
|------|--------|
| `backend/src/modules/purchase/comparisons/comparison.service.ts` | Replace inline `prisma.purchaseOrder.create` line mapping with shared PO line normalization (enrichment + dual qty) |
| `backend/src/modules/purchase/orders/purchase-order.service.ts` | Expose or reuse internal helper for “create PO lines from external line DTOs” if needed (minimal extract, no redesign) |
| `backend/tests/purchase/multi-uom-comparison-to-po.test.ts` | **New** — VQ 5000 KG → PO has `uomQuantity=5000`, `quantity=100`, `factor=50` |

**Implementation approach (preferred):** Map VQ lines to `CreatePurchaseOrderInput.lines` shape and call existing `createPurchaseOrder` service (or shared `normalizeLineInputs` + enrichment) instead of raw Prisma create.

### Priority 2 — Invoice

| File | Change |
|------|--------|
| `backend/src/modules/purchase/invoices/purchase-invoice.service.ts` | `buildLines`: use `lineAmountFromVendor(rate, uomQty)` or `unitCostPrimary × baseQty`; fix `evaluateMatching` expected amount |
| `frontend/src/services/purchase/purchaseApiFacade.ts` | Prefill invoice lines from GRN/PO using vendor qty for amount if touched |
| `backend/tests/purchase/multi-uom-invoice-amount.test.ts` | **New** — 5000 KG @ ₹80 = ₹4,00,000 |

### Priority 3 — GRN frontend (API mode)

| File | Change |
|------|--------|
| `frontend/src/modules/purchase/grnLineDraft.ts` | Seed `receivedUomQty` from PO open purchase qty; base from `/ factor` |
| `frontend/src/modules/purchase/GrnEditorPage.tsx` | onChange: set purchase qty only; derive base; dual display |
| `frontend/src/modules/purchase/GrnDetailPage.tsx` | Show PO/received vendor + stock qty columns |
| `frontend/src/services/purchase/purchaseMappers.ts` | Save: `receivedUomQuantity` from purchase entry; do not fallback base→purchase |
| `backend/tests/purchase/multi-uom-grn-frontend-contract.test.ts` | **Optional API-level** — POST GRN with `receivedUomQuantity=5100`, assert `receivedQuantity=102` |

---

## Seed data (Phase 1)

### Test fixture (vitest / `backend/scripts/seed-multi-uom-test-items.ts`)

| Item | Base | Purchase | Factor | Qty tol | Weight tol |
|------|------|----------|--------|---------|------------|
| MS-PIPE-DN25-KG | NOS | KG | 50 | 2% | — |
| MS-PIPE-LEN-MTR | NOS | MTR | 6 | 2% | — |
| CASTING-KG | NOS | KG | 25 | 0% | 5% |

Each item: `MasterItemUomConversion` rows + default purchase UOM.

### Optional dev seed

Same items in `backend/prisma/seed.ts` or tenant seed script for manual QA on `vasant-trailers`.

---

## Automated test matrix (Phase 1)

| Case | Flow | Assert |
|------|------|--------|
| T1 Normal receipt | PO 5000 KG (f=50) → GRN 5000 KG | Stock +100 NOS; invoice ₹4,00,000 |
| T2 Tolerance | PO 5000 KG → GRN 5100 KG (2%) | Accepted; 102 NOS |
| T3 Excess | GRN 5300 KG | Approval required / tolerance status |
| T4 Short | GRN 4500 KG | 90 NOS stock; PO open 10 NOS |
| T5 Comparison | VQ 5000 KG → create PO | PO dual fields correct |
| T6 KG→NOS + MTR→NOS | Unit conversion helpers | Existing + new tests |

Harness: extend `backend/scripts/test-purchase-multi-unit-uom-flow.ts` or vitest live tests with MySQL.

---

## Contract doc update (Step 1 completion)

Extend `MULTI_UOM_TRANSACTION_CONTRACT.md` with explicit **Rate UOM** rule:

> `rate` is always per **commercial/transaction UOM**. Display as `₹{rate} / {purchaseUomCode}`.

(No other contract changes.)

---

## Out of scope (Phase 1)

- Prisma migrations (PR/RFQ/VQ dual columns)
- Item Master label UX
- PO/GRN conversion preview panels
- Vendor comparison normalized cost UI (backend compare math may get unit test only if in comparison service touch)
- Production consumption
- Demo mode GRN
- Phase D vendor analytics

---

## Implementation order (when approved)

1. Extend contract (Rate UOM paragraph)
2. Comparison → PO fix + test T5
3. Invoice amount + matching + test T6/T1 invoice assert
4. GRN frontend (editor, detail, mapper) + API tests T1–T4
5. Seed script + test fixture
6. Implementation completion report + manual QA checklist

---

## Go / no-go

**Reply:** `Start Phase 1` to begin implementation in the order above.

**Do not start** if any decision in “Decision log” needs revision.
