# Accounting Reversal Evidence

## Phase 2C3 — Journal reverse

| Case | Evidence |
|------|----------|
| Happy path REVERSAL voucher, original REVERSED, number kept, GL nets | `finance-journal-reversal.test.ts` ✓ |
| Idempotent replay | ✓ |
| Reject DRAFT/APPROVED | ✓ |
| 403 without `finance.voucher.reverse` | ✓ |
| `allowedActions.reverse` gating | ✓ |

**Result: 5/5 pass** (2026-07-18 gate)

## Phase 3D — Receipt

| Case | Evidence |
|------|----------|
| Alloc reverse restores balances, no GL | `finance-ar-receipt-reversal.test.ts` ✓ |
| Alloc reverse idempotent + 409 mismatch | ✓ |
| Alloc reverse 403 | ✓ |
| Doc reverse blocked while POSTED allocs | ✓ |
| Full alloc→reverse-alloc→doc-reverse; GL nets; number kept | ✓ |
| Doc reverse idempotent | ✓ |
| Doc reverse 403 | ✓ |

**Result: 7/7 pass**

## Phase 3D — Credit note

| Case | Evidence |
|------|----------|
| Same matrix as receipt | `finance-ar-credit-note-reversal.test.ts` ✓ |

**Result: 7/7 pass**

## Sales invoice document reverse

| Case | Evidence |
|------|----------|
| Route / service / permission | `POST …/receivables/invoices/:id/reverse` · `finance.ar.invoice.reverse` · `sales-invoice-reverse.service.ts` |
| Blocked while POSTED allocs | `SALES_INVOICE_ALLOCATIONS_MUST_BE_REVERSED` |
| Full alloc→reverse-alloc→invoice-reverse; GL nets; number kept | `finance-ar-invoice-reversal.test.ts` |
| Idempotent replay | ✓ |
| 403 without permission | ✓ |
| Source links released on reverse | N/A in current schema (source-link release deferred if/when SI source links ship) |
| Gate treatment | **Shipped** (catalog permission `finance.ar.invoice.reverse` added 2026-07-22) |

## Ordering rules (verified)

```text
Reverse sales invoice document
  requires: no POSTED receipt/CN allocations (else 422 SALES_INVOICE_ALLOCATIONS_MUST_BE_REVERSED)
  requires: debit open item allocatedAmount = 0

Reverse receipt/CN document
  requires: no POSTED allocation batches (else 422 …_ALLOCATIONS_MUST_BE_REVERSED)

Reverse allocations first → then document reverse → then invoice reverse
```
## Idempotency / concurrency

- Document reverse: replay when already REVERSED returns existing reversal (journal/receipt/CN tests).
- Concurrent *post* races log unique-constraint noise but tests assert single voucher outcome.
- Dedicated concurrent *reverse* hammer not added (accepted P2).
