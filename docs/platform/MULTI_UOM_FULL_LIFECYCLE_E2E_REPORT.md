# Multi-UOM Full Lifecycle E2E Review — PR → RFQ → VQ → Comparison → PO → GRN → QC → Return → Invoice

**Date:** 2026-08-10
**Trigger:** User request to review the Multi-UOM flow end-to-end with a mix of Multi-UOM and
Single-UOM items in one PO, flowed through the complete purchase lifecycle including a Purchase
Return and Purchase Invoices.
**Method:** Live API-level E2E script against the `vasant-trailers` tenant (real DB, real service
layer, no mocks) — `backend/scripts/test-full-purchase-lifecycle-muom-e2e.ts`. Re-runnable any time.

```bash
cd backend
npx tsx scripts/test-full-purchase-lifecycle-muom-e2e.ts
```

---

## 1. Scope of the test run

One PO, one vendor (`VEND-0001`), **16 lines**:

| # | Item | Kind | Purchase UOM | Base UOM | Factor | Ordered (base) |
|---|------|------|--------------|----------|--------|-----------------|
| 1 | CASTING-KG-MUOM | MUOM | KG | NOS | 25 | 40 |
| 2 | MS-PIPE-DN25-KG | MUOM | KG | NOS | 50 | 20 |
| 3 | MS-PIPE-LEN-MTR | MUOM | MTR | NOS | 6 | 30 |
| 4 | PIPE-MUOM-MTR | MUOM | MTR | NOS | 3 | 50 |
| 5 | RM-ELECTRODE-MULTI-KG | MUOM | KG | NOS | 5 | 60 |
| 6 | RM-FASTENER-MULTI-KG | MUOM | KG | NOS | 2.5 (fractional) | 40 |
| 7 | RM-PIPE-MULTI-MTR | MUOM | MTR | NOS | 3 | 45 (partial receive 80%) |
| 8 | RM-ROD-MULTI-MTR | MUOM | MTR | NOS | 6 | 25 |
| 9 | RM-BRACKET-TEST | SINGLE | NOS | NOS | 1 | 100 (10 returned post-accept) |
| 10 | BO-DRAIN-VALVE-DN25 | SINGLE, **QC required** | NOS | NOS | 1 | 50 (70/30 accept/reject) |
| 11 | BO-AIRTANK-40L | SINGLE | NOS | NOS | 1 | 20 |
| 12 | BO-GASKET-MANHOLE-450 | SINGLE | NOS | NOS | 1 | 80 |
| 13 | BO-KPIN-2-JOST | SINGLE | NOS | NOS | 1 | 30 |
| 14 | BO-LJ-24T | SINGLE | NOS | NOS | 1 | 15 |
| 15 | BO-RIM-925 | SINGLE | NOS | NOS | 1 | 40 (partial receive 70%) |
| 16 | BO-VALVE-3 | SINGLE | NOS | NOS | 1 | 25 |

8 Multi-UOM + 8 Single-UOM, including one fractional conversion factor (2.5) and two partial
receipts, to stress-test rounding and "still on PO" tracking.

Document chain exercised:

```
PR-000014 (16 lines, rfqRequired)
  → RFQ-000006 (sent to VEND-0001)
    → VQ-000006 (commercial qty in purchase UOM, submitted)
      → Comparison (awarded) → PO-000093 (16 lines, one vendor)
        → GRN-000066 (15 non-QC lines, full + 2 partial receipts) → INVENTORY_POSTED
        → GRN-000067 (1 QC line, BO-DRAIN-VALVE-DN25) → QC_PENDING
          → QI-000005 (70% accept / 30% reject) → COMPLETED → GRN-000067 INVENTORY_POSTED
        → PRT-000014 (non-QC return, 10 NOS found-damaged) → COMPLETED
        → PRT-000015 (QC-rejected qty, 15 NOS) → COMPLETED
        → PI-000010 (invoice for the 15 non-QC lines) → POSTED
        → PI-000011 (invoice for the QC line, billed at accepted qty only) → POSTED
```

## 2. Result

**79/79 automated assertions passed** across every stage after one real defect (§3.1) was worked
around with the platform's existing override mechanism (not patched — see restrictions below).

| Stage | Multi-UOM contract check | Result |
|---|---|---|
| PR | `requiredQuantity` stored in base UOM | ✅ (PR has no dual-UOM fields yet — known Phase B gap, unchanged from Phase 3 audit) |
| RFQ | Lines carry `itemId` + PR linkage for VQ matching | ✅ |
| VQ | Commercial qty entered in purchase UOM (e.g. 1000 KG for 40 NOS casting) | ✅ |
| Comparison → PO | PO line `quantity` (stock) = commercial ÷ factor; `uomQuantity` (commercial) preserved; `uomConversionFactor` snapshot stored | ✅ all 16 lines, incl. fractional factor 2.5 |
| GRN | `receivedQuantity` (base) / `receivedUomQuantity` (vendor) both correct for full **and partial** receipts | ✅ |
| QC | Inspected/accepted/rejected tracked in base qty; GRN-level QC hold isolated to the QC line's own GRN, doesn't block the other 15 lines | ✅ |
| Return | `returnQuantity` in base qty against a specific GRN line; works for both a plain accepted-stock return and a QC-rejected-qty return | ✅ |
| Invoice | Line `quantity` (base) → service auto-derives `uomQuantitySnapshot` / `uomConversionFactorSnapshot` / `purchaseUomCodeSnapshot` from the linked PO/GRN line | ✅ all 16 lines |
| Invoice (QC line) | Billed at **QC-accepted qty (35)**, not gross receipt (50) | ✅ |
| PO rollup | `PurchaseOrderLine.invoicedQuantity` increments in **base** qty on invoice **post** (not approve) — verified for both a MUOM line (40 NOS, not 1000 KG) and the QC line (35 NOS) | ✅ |

This confirms the Multi-UOM Transaction Contract (`docs/platform/MULTI_UOM_TRANSACTION_CONTRACT.md`)
holds end-to-end for the PO → GRN → QC → Return → Invoice segment, for both integer and fractional
conversion factors, and for partial receipts.

## 3. Defects / gaps found

### 3.1 PO header tax does not roll up from line-level GST snapshot (real defect, not Multi-UOM)

Every PO line created via Comparison → PO carries a correct per-line `gstRatePctSnapshot` (18% on
14 of the 16 lines, from the item's HSN/GST mapping). But the **PO header** `taxAmount` came out as
**₹0** for the whole PO, because `createPurchaseOrderFromComparison` copies `quotation.taxAmount`
verbatim instead of summing the line-level GST snapshots:

```1:250:backend/src/modules/purchase/comparisons/comparison.service.ts
const totals = computePurchaseOrderTotals(
  normalizedLines,
  Number(quotation.taxAmount),      // ← VQ's flat header tax field, not derived from lines
  Number(quotation.freightAmount),
)
```

Net effect: when the Purchase Invoice is created with its own (correct, HSN-driven) 18% tax, the
three-way match's tax-tolerance check compares against the PO's ₹0 tax baseline and always fails
with `Invoice matching tolerances exceeded — Invoice tax tolerance exceeded`, even though quantity
and rate match exactly. The invoice can still be submitted via the existing
`overrideAuthorized` / `overrideRemarks` path (a legitimate finance override, which the test
exercised), but every VQ/Comparison-originated PO with taxable lines will hit this on first submit.

**Not fixed in this session** — this is GST/tax total logic on the Comparison→PO conversion path,
which is out of scope for the Multi-UOM work per the standing restriction ("do not touch GST
logic"). Flagging for a separate, explicitly-scoped fix: `computePurchaseOrderTotals` (or the
caller in `comparison.service.ts`) should sum line-level tax from `normalizedLines` instead of
trusting the VQ header field when GST snapshots are present.

### 3.2 Everything else matches the Phase 3 audit's documented gaps (no new Multi-UOM regressions)

No new PR/RFQ/VQ dual-UOM issues were found beyond what `MULTI_UOM_PHASE3_AUDIT_REPORT.md` already
documented: PR/RFQ/VQ still only carry a single quantity+UOM per line (no `purchaseUomQuantity`
Option-A field yet — Phase B work, not started). This didn't block the flow because RFQ/VQ/PO each
independently specify their own commercial quantity + UOM, so the conversion chain is unbroken; it
only means the PR itself can't yet show "required 40 NOS, buying 1000 KG" side by side — it shows
whichever single UOM was picked at PR entry (this test used base UOM for PR, matching the existing
`test-planning-multi-vendor-uom-e2e.ts` convention).

## 4. What this run does **not** cover (explicitly out of scope, per standing restrictions)

- BIN / warehouse tiering, FIFO costing detail, inventory valuation — untouched.
- PR/RFQ/VQ dual-UOM field additions (Phase B) — not implemented, not attempted.
- GST/tax logic fix for §3.1 — flagged only, not patched.

## 5. Artifacts

- Reusable script: `backend/scripts/test-full-purchase-lifecycle-muom-e2e.ts` — safe to re-run any
  time against `vasant-trailers`; creates fresh PR/RFQ/VQ/PO/GRN/Return/Invoice numbers each run and
  prints a UI link table for manual spot-checking in the browser.
- No production code was changed as part of this review — it is a read/verify exercise. The only
  new file is the E2E script itself.
