# Purchase GRN receiving tolerance

## Contract

- **Source of truth:** Item Master `receivingTolerancePercentage` (±% vs **open/pending** qty on this GRN).
- **Fallback:** Purchase Setup `allowOverReceipt` + `overReceiptTolerancePct` when item % is 0.
- **Variance:** `((received - open) / open) * 100` in primary UOM.
- Zero received: line status `NOT_RECEIVED` — no stock / no PO received delta; line stays open for next GRN.
- **Multi-line:** each line evaluated independently. Receiving **1 of 3** items (others qty 0) is valid; header approval only if any line is outside band.
- **Partial under band:** `PARTIAL` — inventory for received qty; remainder stays open (no approval).
- **Outside band:** `SHORT_OUTSIDE` (only when `closeOpenQuantity`) or `EXCESS_OUTSIDE` → GRN status `PENDING_TOLERANCE_APPROVAL` + `PurchaseApproval` (`GOODS_RECEIPT`). Approve continues submit/QC/post; Reject returns to `DRAFT`.

## Line statuses

| Status | Meaning |
|--------|---------|
| OK | Within ±tol of open |
| PARTIAL | Under lower band, leave open |
| NOT_RECEIVED | Received = 0 |
| EXCESS_WITHIN | Over open but ≤ upper band |
| EXCESS_OUTSIDE | Over upper band → approval |
| SHORT_OUTSIDE | Under lower band + close flag → approval |

## API

- `POST /purchase/grns/:id/submit` — may return `PENDING_TOLERANCE_APPROVAL`
- `POST /purchase/grns/:id/approve-tolerance`
- `POST /purchase/grns/:id/reject-tolerance`
- Approvals queue lists `GOODS_RECEIPT` rows; approve/reject/send-back route to the same tolerance endpoints (`purchase.grn.post`).
- Unit: `backend/tests/purchase/grn-tolerance.test.ts` (`npm run test:grn-tolerance`)
- Live E2E + seed items 0%/2%/10%: `npm run test:grn-tolerance-live` (`--seed-only` for UI)
- Frontend calculator parity: `cd frontend && npm run test:grn-tolerance`
- Scenario matrix: `docs/PURCHASE_GRN_TOLERANCE_TEST_PLAN.md`
- Live lifecycle: outside band → pending approval (not hard 400).

## PDF

GRN print shows **Ordered** and **Received / inward** as stacked dual qty (not separate vendor/stock columns):

```text
8 MTR
2.33 NOS
```

Top line = purchase / vendor unit; bottom = stock inward unit (factory count). Same UOM collapses to one line.
