# Multi-UOM Phase 3 — Transaction Chain Completion: Audit Report

**Date:** 2026-08-07
**Status:** AUDIT ONLY — no migrations, no backend code, no frontend code changed in this pass.
**Method:** Read-only verification against `backend/prisma/schema.prisma` (current, post Phase 1 + Phase 2 of this session), backend services/validation/mappers, and frontend editor/mapper code. Every finding below was re-checked in code today, not copied blind from prior docs.
**Builds on:** [`MULTI_UOM_PROJECT_AUDIT_REPORT.md`](./MULTI_UOM_PROJECT_AUDIT_REPORT.md) (2026-08-06 full-repo audit), [`MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md`](./MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md) (Phase B field plan — this Phase 3 request **is** that plan's "Phase B"), [`MULTI_UOM_TRANSACTION_CONTRACT.md`](./MULTI_UOM_TRANSACTION_CONTRACT.md) (locked formulas — reused unchanged below).
**Do not rebuild:** the contract, formulas, and `MasterItemUomConversion` architecture are already correct and are reused as-is.

**No code was written for this deliverable.** Per the requested execution order, this is Step 1 (audit) + Step 2 (gap report). Step 3 (approval) is required before any migration or implementation work starts.

---

## 0. Executive Summary

The purchase chain has a hard split, confirmed again today:

```
PR ❌  →  RFQ ❌  →  VQ ❌  →  Comparison ❌  →  PO ✅  →  GRN ✅  →  QC ⚠️  →  Invoice ✅  →  Inventory ⚠️
```

- **PO → GRN → Invoice is the reference implementation.** Full dual quantity (`quantity` base + `uomQuantity` commercial), `uomConversionFactor` snapshot, and rate-per-commercial-UOM already exist and are schema-complete.
- **PR, RFQ, Vendor Quotation, Comparison are single-quantity, no factor snapshot, no dual UOM.** This is the entire scope of "Phase 3" as the user has framed it — it maps 1:1 onto the already-approved but not-yet-built "Phase B" in `MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md`.
- **QC (`PurchaseQualityInspectionLine`) stores base quantity only** — no UOM columns on the line itself. Phase 2 (this session) added a **computed, non-persisted** dual-UOM view on the QI detail page/mapper by joining the GRN line's `uomConversionFactor` snapshot. That is display-only; it satisfies "show in both UOMs" but does not give QC its own persisted commercial-qty audit trail. Flagged below as a decision point for Phase 3 scope.
- **Inventory ledger is correctly base-only** (by design) with optional, partially-populated UOM audit columns on `InventoryStockMovement`. No change needed for stock correctness; only a snapshot-freshness bug exists in the balance **display** mapper (uses live item factor, not historical), listed under Module 9.

### Status at a glance (re-verified 2026-08-07)

| Module | Dual qty in DB | Factor snapshot | UI dual display | Risk |
|---|---|---|---|---|
| PR (`PurchaseRequisitionLine`) | ❌ | ❌ | ⚠️ client-only estimate, not persisted | **High** |
| RFQ (`RequestForQuotationLine`) | ❌ | ❌ | ❌ (mapper drops UOM: `uom: ''`) | **High** |
| Vendor Quotation (`VendorQuotationLine`) | ❌ | ❌ | ❌ free-text UOM input | **High** |
| Comparison (`VendorComparisonLine`) | ❌ | ❌ | ❌ no normalized rate column | **High** |
| PO (`PurchaseOrderLine`) | ✅ | ✅ | ✅ | Low |
| GRN (`GoodsReceiptLine`) | ✅ | ✅ | ✅ | Low |
| QC (`PurchaseQualityInspectionLine`) | ❌ (computed only) | N/A (borrows GRN snapshot) | ✅ (Phase 2, computed) | Medium |
| Invoice (`PurchaseInvoiceLine`) | ✅ (snapshot) | ✅ | ✅ | Low |
| Inventory (`InventoryStockMovement`) | ⚠️ optional audit only | ⚠️ partial | N/A (base-only by design) | Low–Medium |

---

## 1. Current State — Module by Module

### Module 1 — Purchase Requisition (PR)

**Existing:**
- `PurchaseRequisitionLine.requiredQuantity` (Decimal 18,4) + `uomId` (nullable FK to `MasterUom`) — single quantity/UOM pair.
- `orderedQuantity` tracks cumulative qty converted to PO(s) — same scalar, ambiguous units.
- Frontend editor (`PurchaseRequisitionEditorPage.tsx`) resolves a conversion factor **client-side only** (`resolveLineUomConversionFactor`, line 294) from live item-master conversion rows, purely for display; nothing is sent to the API beyond `requiredQuantity` + `uomId`.
- Validation (`purchase-requisition.validation.ts`): `requiredQuantity: z.number(...)`, `uomId: optionalUuid` — no purchase-estimate fields accepted.

**Missing:**
- No `purchaseUomQuantity`, `purchaseUomId`, or `uomConversionFactor` columns on `PurchaseRequisitionLine`.
- No server-side snapshot of the factor at PR submit time — if approved today at factor 50 and the item master changes next month, there is nothing to freeze the historical estimate.
- Print page (`PurchaseRequisitionPrintPage.tsx`) uses `resolveDualQtyForPrint` with the wrong inputs and renders an incorrect base sub-line (pre-existing bug, confirmed still present).
- PR→RFQ and PR→PO carry only `requiredQuantity` forward; there's no field to say "buyer expects to purchase in KG."

### Module 2 — RFQ

**Existing:**
- `RequestForQuotationLine.requiredQuantity` + `uomId`, mirrors PR line shape 1:1.
- Editor (`RfqEditorPage.tsx`) resolves `uomId`/`uomConversionFactor` client-side from item defaults (`resolveDefaultPurchaseUom`) when composing a line, same as PR.

**Missing:**
- `frontend/src/services/purchase/purchaseMappers.ts` line 786 hardcodes `uom: ''` when mapping the API RFQ line back to the domain model — **confirmed today**: the UOM the buyer picked is silently dropped on reload/refresh, even though `uomId` is persisted server-side. This is a live bug, not just a gap.
- No `uomQuantity` (commercial) / `quantity` (base) split — single number is ambiguous.
- No factor snapshot column.
- RFQ PDF (`RfqPrintPage.tsx`) shows a single quantity/UOM; no "Required: 5000 KG / Equivalent: 100 NOS" line.

### Module 3 — Vendor Quotation (VQ)

**Existing:**
- `VendorQuotationLine.quantity` + `uomId` + `rate` + `amount`. Intended to be the **commercial** quantity (this is what flows into `preparePurchaseOrderLinesForCreate` as `uomQuantity` on award).
- Server persists `uomId`, but…

**Missing:**
- Frontend editor (`VendorQuotationEditorPage.tsx`, confirmed lines 238–244) uses a **plain free-text `<input>`** for UOM, not an item-linked UOM picker — vendor could type "kg", "KG", "Kgs" inconsistently, and nothing validates it against the item's allowed purchase UOMs.
- Frontend mapper (`purchaseMappers.ts` line 942) hardcodes `uom: ''` on load — same drop-on-reload bug as RFQ.
- No `baseQuantity`, `uomConversionFactor`, or normalized rate stored anywhere on the line — the base-quantity equivalence used later (PO creation) is recomputed from the *current* item master at award time, not frozen at quotation time.

### Module 4 — Vendor Comparison

**Existing:**
- `VendorComparisonLine` stores only `quantity`, `rate`, `amount`, `rank`, `isSelected` — confirmed today via `comparison.mapper.ts` (lines 58–71) and `comparison.service.ts` (`createComparison`, lines 59–68): lines are copied straight from the VQ line's `quantity`/`rate`/`amount` with **no `uomId` field at all** on the model.
- Award → PO path (`createPurchaseOrderFromComparison`, `comparison.service.ts` lines 195–210) passes VQ `quantity` as PO `uomQuantity` and calls `preparePurchaseOrderLinesForCreate()`, which resolves the base quantity from the **live** item-UOM mapping. This works correctly **only if every vendor quoted in the same UOM as the item's default purchase UOM**; it silently miscompares if Vendor A quotes KG and Vendor B quotes NOS.

**Missing:**
- No normalized "cost per base UOM" computation anywhere in `comparison.service.ts` or `comparison.mapper.ts`.
- Frontend comparison grid (`QuotationComparisonPage.tsx` — confirmed via search, zero matches for "normalized"/"cost per"/"base rate") shows a single quantity/rate column per vendor; ranking logic (wherever it lives) has no unit-normalization step.
- This is the single highest silent-risk item in the whole audit: **a cheaper-looking quote in a different UOM can currently win when it is actually more expensive per stock unit**, and nothing in code or UI would catch it.

### Module 5 — Purchase Order (reference implementation — verify only)

**Existing (verified, unchanged since Phase 1/2):**
- `PurchaseOrderLine`: `quantity` (base), `uomQuantity` (commercial), `uomId`, `uomConversionFactor` (snapshot), `unitCostPrimary` (= rate × factor), `rate` (per commercial UOM), plus received/accepted/rejected/returned/invoiced tracking columns.
- `preparePurchaseOrderLinesForCreate()` (`purchase-order.service.ts`) normalizes and snapshots the factor on every line at create/edit time; snapshot is **not** recalculated on subsequent reads.
- Editor, detail, revise, and print pages all show stacked commercial/base quantities.

**Audit answers to the user's specific questions:**
- *Is rate always per purchase UOM?* Yes — `rate` is per `uomId` (commercial), `unitCostPrimary = rate × uomConversionFactor` is the derived per-base-unit cost. Confirmed in schema comments and `uom-conversion.ts`.
- *Is base quantity calculated correctly?* Yes — `quantity = uomQuantity / uomConversionFactor`, applied in `preparePurchaseOrderLinesForCreate`.
- *Is factor snapshot immutable?* Yes for PO lines once created — no code path recalculates `uomConversionFactor` from a live item master after line creation. (PR/RFQ/VQ have no snapshot to be immutable *about*, which is exactly the gap above.)

**Missing (minor, non-blocking):**
- Planning "Create PO" modal shows a single quantity (no dual display) — cosmetic only, PO record itself is correct regardless.
- PO PDF: confirmed dual quantity present today; a dedicated "Purchase | Stock" two-column table (as requested) is a formatting change, not a data gap.

### Module 6 — GRN (verify only — Phase 2 already improved this)

**Existing (verified against schema + this session's Phase 2 work):**
- `GoodsReceiptLine` carries a full parallel set: `orderedQuantity/receivedQuantity/acceptedQuantity/rejectedQuantity` (base) alongside `orderedUomQuantity/receivedUomQuantity/acceptedUomQuantity/rejectedUomQuantity` (commercial), `uomConversionFactor` snapshot, `uomCodeSnapshot`.
- Phase 2 (this session) locked `acceptedQuantity`/`rejectedQuantity` to 0 server-side (`resolveGrnLineAcceptReject` in `goods-receipt.workflow.ts`) whenever `qcRequired` is true, and made those fields read-only in the GRN editor UI — received quantity remains the only editable field pre-QC.
- QI-complete → GRN sync (`syncGrnAcceptedRejectedUomFromBase`, existing since prior "Sprint 1") already converts base accept/reject quantities back into `acceptedUomQuantity`/`rejectedUomQuantity` using the GRN line's own factor snapshot — **not** the live item master.

**Missing:** none material for Phase 3 scope. Two small items carried over from the prior audit, unrelated to PR/RFQ/VQ:
- Partial-reverse lines don't mirror `reversedUomQuantity` (base-only today).
- GRN detail page dual-column display is inconsistent across Ordered/Accepted/Rejected (Received is dual, others sometimes base-only).

### Module 7 — Quality Inspection

**Existing (verified against schema + Phase 2 changes):**
- `PurchaseQualityInspectionLine` columns: `inspectedQuantity`, `acceptedQuantity`, `rejectedQuantity`, `deviationQuantity` — **base UOM only, no UOM columns on the model.**
- Phase 2 (this session) added `uomCode` + `uomConversionFactor` to the **mapper output** (`quality-inspection.mapper.ts`), sourced by joining back to the originating `GoodsReceiptLine`'s snapshot (via `enrichmentForQi` in `quality-inspection.service.ts`), and derives `inspectedUomQuantity`/`acceptedUomQuantity`/`rejectedUomQuantity` on the fly using `toUomQuantity()`. This is surfaced on `QualityInspectionDetailPage.tsx`.

**Missing / decision point for Phase 3:**
- Because the dual-UOM values are **computed at read time from the GRN snapshot**, not stored on the QI line, this is correct for "current" reads but means the QI record itself carries no direct audit trail of "we rejected 500 KG" — it always has to be re-derived via its parent GRN line. If the GRN line were ever deleted/orphaned (shouldn't happen, but no FK cascade guarantees it can't), the QI's commercial-qty history would be unrecoverable.
- **Recommendation for Phase 3 (needs your decision, not decided here):** persist `uomCode`/`uomConversionFactor`/`inspectedUomQuantity`/`acceptedUomQuantity`/`rejectedUomQuantity` directly on `PurchaseQualityInspectionLine` at QC-complete time, in addition to (not instead of) the current base columns, so QC becomes self-sufficient like PO/GRN/Invoice. This is a small, additive, low-risk migration — flagged as **P2, optional** in the plan below since the computed version already satisfies "show in both UOMs."

### Module 8 — Purchase Invoice (verify only)

**Existing (verified against schema):**
- `PurchaseInvoiceLine`: `quantity` (base), `uomCodeSnapshot`, `uomQuantitySnapshot`, `uomConversionFactorSnapshot`, `purchaseUomCodeSnapshot` — full snapshot set already present.
- `amount = rate × uomQuantitySnapshot`-equivalent math lives in `purchase-invoice.service.ts`, sourced from GRN/PO snapshots (never recalculated from the live item master).
- Invoice print shows dual quantity today.

**Missing:** none material. Prior audit's suggestion of a three-way-match reconciliation report (invoice KG vs GRN KG vs PO KG) is a reporting nicety, not a data-integrity gap — out of scope unless you want it added.

### Module 9 — Inventory Ledger

**Existing (verified against schema):**
- `InventoryStockMovement.quantity` — signed, **always base UOM**, is the ledger source of truth. Correct by design; do not change.
- `uomQuantity` / `uomId` / `uomConversionFactor` exist as **optional audit columns**, populated by GRN inward posting; issues/consumption/transfers largely leave them null.

**Missing:**
- No `baseUomCodeSnapshot` on the movement row (Phase 0/Phase C item, not Phase 3/B scope per the user's own restriction — "do not modify inventory valuation / warehouse logic").
- Balance **display** mapper (`inventory.mappers.ts`, not modified this session) recomputes an "equivalent commercial qty" using the **current** item master factor rather than a historical/weighted one — a display-only accuracy issue, not a ledger-correctness issue (ledger itself is base-qty and unaffected).

**Per the user's explicit restriction ("do not touch inventory valuation / FIFO / warehouse logic"), Module 9 is verify-only in this audit — no changes proposed here.**

---

## 2. Database Gap Report

| Model | Current Fields (quantity/UOM-related) | Missing Fields | Migration Required |
|---|---|---|---|
| `PurchaseRequisitionLine` | `requiredQuantity`, `uomId`, `orderedQuantity` | `purchaseUomQuantity`, `purchaseUomId`, `uomConversionFactor` (snapshot) | **Yes — additive, nullable/defaulted** |
| `RequestForQuotationLine` | `requiredQuantity`, `uomId` | `uomQuantity` (commercial), `uomConversionFactor` (snapshot); clarify `requiredQuantity` semantics as base | **Yes — additive** |
| `VendorQuotationLine` | `quantity`, `uomId`, `rate`, `amount` | `uomQuantity` (rename/clarify existing `quantity` as commercial), `baseQuantity`, `uomConversionFactor` (snapshot) | **Yes — additive** |
| `VendorComparisonLine` | `quantity`, `rate`, `amount`, `rank`, `isSelected` | `uomId`, `uomConversionFactor` (snapshot), `baseQuantity`, computed `unitCostPrimary` (persist or compute-on-read — see API impact) | **Yes — additive** (or compute-only, no migration, see options below) |
| `PurchaseOrderLine` | `quantity`, `uomQuantity`, `uomId`, `uomConversionFactor`, `unitCostPrimary`, `rate` | None — complete | **No** |
| `GoodsReceiptLine` | Full dual set + tolerance/condition snapshots | None material for Phase 3 | **No** |
| `PurchaseQualityInspectionLine` | `inspectedQuantity`, `acceptedQuantity`, `rejectedQuantity`, `deviationQuantity` | `uomCode`, `uomConversionFactor`, `inspectedUomQuantity`, `acceptedUomQuantity`, `rejectedUomQuantity` (**optional, P2 — see Module 7 decision**) | **Optional — additive, only if you approve persisting instead of computing** |
| `PurchaseInvoiceLine` | `quantity`, `uomCodeSnapshot`, `uomQuantitySnapshot`, `uomConversionFactorSnapshot`, `purchaseUomCodeSnapshot` | None — complete | **No** |
| `InventoryStockMovement` | `quantity` (base), `uomQuantity`/`uomId`/`uomConversionFactor` (optional audit) | `baseUomCodeSnapshot` (out of Phase 3 scope per restriction) | **No — deferred, explicitly out of scope** |
| `MasterItem` / `MasterItemUomConversion` | `baseUomId`, conversion rows with `conversionFactor`/`isPurchaseAllowed`/`isDefaultPurchase` | None required to unblock Phase 3 (item conversion table structure is explicitly frozen per your restriction) | **No** |

**Non-destructive migration rules (carried over from Phase 0, still applicable):**
- All new columns nullable or defaulted; no column drops.
- Backfill existing rows by deriving from linked PR/RFQ/item defaults where possible; leave `null`/factor `1` where no clean derivation exists (do not fabricate historical data).
- Each migration additive and independently rollback-safe (old app version ignores new columns).

---

## 3. API Impact

| Layer | Files | Change Needed |
|---|---|---|
| **PR Controller/Routes** | `backend/src/modules/purchase/requisitions/purchase-requisition.controller.ts`, `purchase-requisition.routes.ts` | Accept new line fields on create/update line endpoints |
| **PR Service** | `purchase-requisition.service.ts`, `requisition.service.ts` | Compute/validate `purchaseUomQuantity ≈ requiredQuantity × factor`; snapshot factor at submit |
| **PR Validation** | `purchase-requisition.validation.ts` | Add `purchaseUomQuantity`, `purchaseUomId` to line schema (create + revise) |
| **PR Mapper** | `purchase-requisition.mapper.ts` | Emit new fields in DTO |
| **RFQ Controller/Routes** | `backend/src/modules/purchase/rfq/rfq.controller.ts`, `rfq.routes.ts` | Accept `uomQuantity`/factor on line create/update |
| **RFQ Service/Workflow** | `rfq.service.ts`, `rfq.workflow.ts` | Snapshot factor at RFQ send; carry forward from linked PR line when present |
| **RFQ Validation** | `rfq.validation.ts` | Add `uomQuantity`, `uomConversionFactor` to line schema |
| **RFQ Mapper** | `rfq.mapper.ts` | **Fix + extend** — must stop losing `uomId`/`uom` on the API→domain path (root cause is actually in the frontend mapper, see below, but backend DTO shape needs the new fields to fix it properly) |
| **VQ Controller/Routes** | `backend/src/modules/purchase/vendor-quotations/vendor-quotation.controller.ts`, `.routes.ts` | Accept structured `uomId` + factor (reject free-text) |
| **VQ Service** | `vendor-quotation.service.ts` | Validate UOM against item's allowed purchase UOMs (via existing `item-uom-resolution.ts` helper); compute `baseQuantity` at submit |
| **VQ Validation** | `vendor-quotation.validation.ts` | Change `uomId` from optional to resolved/validated against item; add `uomConversionFactor` |
| **VQ Mapper** | `vendor-quotation.mapper.ts` | Emit `uomCode`, `uomConversionFactor`, `baseQuantity` |
| **Comparison Service** | `comparison.service.ts` | In `createComparison`, copy `uomId`/factor from VQ line onto comparison line; compute `unitCostPrimary` (cost per base unit) for ranking — **decide whether persisted or computed in mapper** (see options below) |
| **Comparison Mapper** | `comparison.mapper.ts` | Add `uomCode`, `uomConversionFactor`, `unitCostPrimary`/`normalizedRate` to line DTO |
| **Comparison Validation** | `comparison.validation.ts` | No structural change expected (comparison lines are server-derived, not user-input) |
| **PO Service (reference, no change)** | `purchase-order.service.ts` | Verify `preparePurchaseOrderLinesForCreate` still receives correct commercial qty from the now-richer comparison/VQ line — likely no change since it already reads `uomQuantity`/`uomId` off the input shape |
| **Shared UOM helpers (reference, reused not rebuilt)** | `backend/src/modules/purchase/shared/uom-conversion.ts`, `item-uom-resolution.ts` | Reuse existing `toUomQuantity`, factor-resolution helpers — no change to formulas |

**Design decision needed before coding (flag for your approval, not decided here):**
- **Comparison normalization** — persist `unitCostPrimary`/`uomConversionFactor` on `VendorComparisonLine` (auditable, survives item-master changes) **vs.** compute it on read in `comparison.mapper.ts` from the linked VQ line's snapshot (simpler, no migration, but relies on VQ line snapshot existing). Recommendation: persist on the comparison line at creation time — comparisons are point-in-time documents and should not silently change if a VQ line is edited later, consistent with the snapshot rule already used everywhere else in the chain.

---

## 4. Frontend Impact

| Page / Component | Path | Required Changes |
|---|---|---|
| PR Editor | `frontend/src/modules/purchase/PurchaseRequisitionEditorPage.tsx` | Replace client-only `resolveLineUomConversionFactor` display hack with real persisted `purchaseUomQuantity`/`purchaseUomId`/factor fields sent to API; add "Purchase Estimate" column next to "Requirement" |
| PR Detail | `PurchaseRequisitionDomainDetailPage.tsx` | Show Requirement vs Purchase Estimate as two columns (per user's requested table) |
| PR Print | `PurchaseRequisitionPrintPage.tsx` | Fix `resolveDualQtyForPrint` call — currently broken (wrong inputs, confirmed still present) |
| RFQ Editor | `frontend/src/modules/purchase/RfqEditorPage.tsx` | Send `uomQuantity`/factor to API; keep existing item-linked UOM resolution logic (already correct client-side, just not persisted) |
| RFQ→domain Mapper | `frontend/src/services/purchase/purchaseMappers.ts` (line ~786) | **Fix the `uom: ''` hardcode** — this is a live bug independent of any migration; once backend RFQ line DTO returns `uomCode`, map it through instead of blanking it |
| RFQ Detail/Print | `RfqDetailPage.tsx`, `RfqPrintPage.tsx` | Add dual-qty display: "Required: 5000 KG / Equivalent: 100 NOS" |
| VQ Editor | `frontend/src/modules/purchase/VendorQuotationEditorPage.tsx` | **Replace free-text UOM `<input>` (confirmed at lines 238–244) with an item-linked `Select`/`ErpSmartSelect`** populated from the item's allowed purchase UOMs (reuse the pattern from `PurchaseLineQtyCell.tsx`) |
| VQ→domain Mapper | `purchaseMappers.ts` (line ~942) | Fix the same `uom: ''` hardcode as RFQ |
| VQ Detail | `VendorQuotationDetailPage.tsx` | Show vendor qty + base-equivalent qty |
| Comparison Page | `frontend/src/modules/purchase/QuotationComparisonPage.tsx` | Add a normalized "Cost / {baseUomCode}" column so vendors quoting in different UOMs rank correctly; show both raw vendor rate and normalized rate side by side |
| Comparison Index | `QuotationComparisonIndexPage.tsx` | No structural change expected; verify list summary doesn't assume single UOM |
| PO Planning "Create PO" modal | (wherever the planning→PO quick-create modal lives, confirm exact file during implementation) | Minor: show dual qty (cosmetic, PO record already correct) |
| QI Detail (optional, if Module 7 decision is "persist") | `QualityInspectionDetailPage.tsx` | If QC UOM becomes persisted rather than computed, swap the computed `dualUomLine()` helper to read directly from API fields (no visual change, just data source) |
| Shared UOM UI patterns to reuse (no new component needed) | `frontend/src/components/purchase/PurchaseLineQtyCell.tsx`, `frontend/src/utils/purchaseLineUom.ts` | These already implement the dual-qty entry/display pattern used on PO; reuse for PR/RFQ/VQ instead of inventing new UI |

Per the always-applied form/select rule, any new UOM picker (VQ editor) must use the shared `Select` component with `— Select —` placeholder and options-on-open — not a free-text input and not a custom dropdown.

---

## 5. Risk Assessment

| Area | Risk | Why |
|---|---|---|
| PR | **High** | Upstream demand document; ambiguous quantity propagates to every downstream document. Print is already visibly broken. |
| RFQ | **High** | Live bug: UOM is dropped on reload today (`uom: ''`). Vendor-facing document can show wrong/blank units. |
| VQ | **High** | Free-text UOM entry + no validation against item master; comparison correctness depends entirely on this being right. |
| Comparison | **High** | Silent mis-ranking risk if vendors quote in different UOMs — no normalization exists at all today. This is the most consequential single gap since it can directly cause the wrong vendor to be awarded. |
| PO | **Low** | Reference implementation; verified correct, no changes needed. |
| GRN | **Low** | Already hardened in Phase 2 this session; two minor cosmetic items only. |
| QC | **Medium** | Functionally correct today (computed dual display), but has no independent persisted audit trail — acceptable short-term, worth a decision for Phase 3. |
| Invoice | **Low** | Snapshot fields already complete and correct. |
| Inventory | **Low–Medium** | Ledger correctness unaffected; only a display-layer historical-accuracy nit, explicitly out of scope per your restriction. |

---

## 6. Explicit Confirmation of Restrictions

Per your instructions, this audit — and the implementation plan it leads to — **excludes**:
- BIN / warehouse logic
- FIFO costing (`InventoryCostLayer`, confirmed base-only and correct, not touched)
- Inventory valuation
- GST logic
- `MasterItemUomConversion` table structure (reused as-is)

And is scoped **only** to: PR, RFQ, Vendor Quotation, Comparison, PO validation (verify-only), Invoice display (verify-only, already complete).

---

## 7. Recommended Execution Order (for your approval)

```
Step 3 (this step): Await your explicit approval of this report
       ↓
Step 4: Migrations — additive columns per §2, one migration per model,
        each independently reviewable and rollback-safe
       ↓
Step 5: Backend — validation + service + mapper changes per §3,
        PR → RFQ → VQ → Comparison in that order (each depends on the previous
        being correct, since RFQ can inherit from PR, VQ can inherit from RFQ)
       ↓
Step 6: Frontend — fix the two confirmed `uom: ''` mapper bugs first
        (independent, zero-risk, no migration needed, can ship immediately
        even before Step 4 if you want a quick win), then editors/detail/print
        per §4
       ↓
Step 7: MUOM certification tests — one golden-flow integration test
        (PR 100 NOS → RFQ 5000 KG → VQ A/B compare → PO → GRN → QC → Invoice,
        per the existing golden-flow spec in MULTI_UOM_TRANSACTION_CONTRACT.md §13)
        plus unit tests for the comparison normalization formula specifically,
        since that's the highest-risk item.
```

**Two items can be fixed immediately, independent of any migration, if you want quick wins before the full Phase 3 migration:**
1. `frontend/src/services/purchase/purchaseMappers.ts` — remove the hardcoded `uom: ''` on RFQ line (line ~786) and VQ line (line ~942) mapping; both already have `uomId` available from the API today, just not read.
2. `PurchaseRequisitionPrintPage.tsx` — fix the broken `resolveDualQtyForPrint` call.

Neither requires a schema change and both are pure bug fixes, not new functionality — flagging separately in case you want them decoupled from the bigger Phase 3 decision.

---

## 8. Open Decisions Requiring Your Sign-off Before Step 4

1. **Comparison normalization** — persist `unitCostPrimary`/factor on `VendorComparisonLine` (recommended) vs. compute on read.
2. **QC UOM persistence** — keep current computed-only display (Module 7, no action) vs. add persisted `uomCode`/`uomConversionFactor`/dual quantities to `PurchaseQualityInspectionLine` (P2, optional, additive).
3. **PR requirement/estimate semantics** — confirm Option A from `MULTI_UOM_PHASE0_GAP_AND_MIGRATION_REPORT.md` §2.3 still holds: `requiredQuantity`/`uomId` = production need (base), new `purchaseUomQuantity`/`purchaseUomId`/`uomConversionFactor` = buyer's commercial estimate.
4. **VQ UOM validation strictness** — hard-block a vendor quote in a UOM not on the item's allowed purchase list, or warn-and-allow with an override.

No code will be written until you respond to this report.
