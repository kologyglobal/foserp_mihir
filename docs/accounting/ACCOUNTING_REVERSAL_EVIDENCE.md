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

| Item | Status |
|------|--------|
| Route / service / permission | **Absent** |
| Gate treatment | Accepted deferred — not a Phase 3D coded deliverable |

## Ordering rules (verified)

```text
Reverse receipt/CN document
  requires: no POSTED allocation batches (else 422 …_ALLOCATIONS_MUST_BE_REVERSED)

Reverse allocations first → then document reverse
```

Invoice reverse ordering N/A (not implemented).

## Idempotency / concurrency

- Document reverse: replay when already REVERSED returns existing reversal (journal/receipt/CN tests).
- Concurrent *post* races log unique-constraint noise but tests assert single voucher outcome.
- Dedicated concurrent *reverse* hammer not added (accepted P2).
