# AP Reversal — Frontend (Phase 4C1 + 4C2)

## Document reversals (GL)

Preview + reverse on posted:

- Vendor payment — `/reversals/payment/:id`
- Vendor invoice — `/reversals/invoice/:id`
- Vendor adjustment — `/reversals/adjustment/:id`

Preview APIs return eligibility, blocking issues, cascade hint (`reverseWithCascade`), proposed voucher summary.

Reverse body: `reversalDate`, `reason`, `idempotencyKey`, `expectedUpdatedAt`, optional `cascadeAllocationReversals`.

## Allocation reversal (subledger only)

- `/reversals/allocation/:allocationId`
- POST `/accounting/payables/allocations/:allocationId/reverse`
- No GL; restores open-item balances

## Entry points

- Detail pages: Reverse when `allowedActions.reverse === true` (payment/invoice/adjustment) or active allocation lines exist
- Corrections workspace: `/accounting/money-out/corrections`
- History: `/accounting/money-out/reversals` — empty until backend history list ships (`listApReversalHistory` stub)

## Permissions

`finance.ap.{vendor_invoice,payment,adjustment}.reverse`, `finance.ap.allocation.reverse`, `finance.ap.corrections.view`
