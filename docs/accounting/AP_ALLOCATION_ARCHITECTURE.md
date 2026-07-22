# Accounts Payable — Allocation Architecture (Phase 4B4)

**Status:** Allocation **execution** shipped (subledger only, **no GL**). Posted vendor payments and
advances (DEBIT open items) can be allocated against posted vendor invoices (CREDIT open items) with
atomic AP open-item balance updates, idempotency, and audit. Phase 4B1 provided the DB/repository
foundation; 4B2/4B3 produced and posted the DEBIT source open items this phase settles.

> Allocation reversal, payment reversal, payment frontend, AP ageing and AP reconciliation remain pending.

---

## Model (reused from 4B1 — no new model)

```text
PayableAllocationBatch  — one DEBIT source open item, one allocation event
PayableAllocationLine   — many CREDIT targets (unique per batch + target credit item)
```

Direction, always:

```text
DEBIT source  (VENDOR_PAYMENT | VENDOR_ADVANCE open item)
        → allocate to →
CREDIT target(s)  (VENDOR_INVOICE open item)
```

One debit → many credits per batch. Allocation is **subledger only**:

- **Creates:** `PayableAllocationBatch` + `PayableAllocationLine[]` + `PayableOpenItem` balance
  updates + one `PAYABLE_ALLOCATION_CREATED` audit log.
- **Never creates:** `PostingEvent`, `AccountingVoucher`, `AccountingVoucherLine`,
  `GeneralLedgerEntry`, nor consumes `FinanceNumberSeries`.

Net AP subledger (Σ CREDIT outstanding − Σ DEBIT outstanding, base currency) is **invariant** under
allocation — it only moves outstanding between the two sides.

---

## HTTP surface

Base: `/api/v1/t/:tenantSlug/accounting/payables`

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/vendor-payments/:id/allocatable-invoices` | `finance.ap.allocation.view` | Candidate CREDIT invoices + walking `suggestedAllocationAmount` |
| POST | `/vendor-payments/:id/allocations` | `finance.ap.allocation.create` | Create allocation batch (subledger only) |
| GET | `/vendor-payments/:id/allocations` | `finance.ap.allocation.view` | History for a payment (paginated) |
| GET | `/vendor-invoices/:id/allocations` | `finance.ap.allocation.view` | History for an invoice (paginated) |
| GET | `/allocations/:allocationId` | `finance.ap.allocation.view` | Batch + lines detail |

`finance.ap.payment.post` alone does **not** grant allocate. All decimals are strings.

### Create body

```jsonc
{
  "expectedPaymentUpdatedAt": "2026-07-18T...Z",       // optional optimistic guard on the payment row
  "expectedSourceOpenItemUpdatedAt": "2026-07-18T...Z", // required optimistic guard on DEBIT open item
  "allocationDate": "2026-07-18",
  "idempotencyKey": "…",                                // @unique per tenant
  "lines": [
    { "targetCreditOpenItemId": "…", "expectedTargetUpdatedAt": "…Z", "amount": "4000" }
  ]
}
```

The client **never** supplies the source open-item id — it is resolved server-side from the payment
(`VendorPayment.payableOpenItemId`), preventing source spoofing.

### Create result (`CreatePayableAllocationResult`)

`idempotentReplay`, `batch` (`id`, `allocationReference` = `APALLOC/YY-YY/######`,
`totalAllocatedAmount`, `baseTotalAllocatedAmount`, …), `sourceBefore`/`sourceAfter` open-item
balances, `targets[]` (before/after per line), `lines[]` (`amount`, `baseAmount`), and
`vendorAdvanceRemaining` (source outstanding after).

---

## Open-item balance helpers

`payable-open-item.repository.ts` → `applyDebitAllocation` / `applyCreditAllocation`:

- Increase `allocatedAmount` (+ base), decrease `outstandingAmount` (+ base).
- Status equation: `Outstanding = Original − Allocated − Adjusted − WrittenOff`.
- Resolve status → `OPEN` | `PARTIALLY_SETTLED` | `SETTLED`; stamp `settledAt` when `SETTLED`.
- **Conditional update** guarded on `expectedUpdatedAt` **and** `outstandingAmount >= amount` **and**
  `status IN (OPEN, PARTIALLY_SETTLED)`. Zero rows updated ⇒ concurrency/exceed conflict (`409`/`422`).

Deterministic lock order: all participating open-item ids are sorted ascending and locked with
`SELECT … FOR UPDATE` inside a `ReadCommitted` transaction before any mutation — preventing deadlocks
and lost updates between concurrent allocations.

---

## Validation (`payable-allocation-validation.service.ts`)

- **Payment:** must be `POSTED`; source open item resolved from it.
- **Source:** `DEBIT`, `VENDOR_PAYMENT|VENDOR_ADVANCE`, `OPEN|PARTIALLY_SETTLED`, outstanding > 0, not
  disputed / on hold.
- **Targets:** `CREDIT`, `VENDOR_INVOICE`, same tenant / legal entity / vendor / currency /
  `vendorPayableAccountId` (control account), `OPEN|PARTIALLY_SETTLED`, outstanding > 0, not
  disputed / on hold.
- **Branch:** if `FinanceSettings.requireSameBranchForPayableAllocation` is set, enforce same branch;
  otherwise allow cross-branch within the same legal entity (default when the setting is absent).
- **FX:** same currency required. For non-base currency the effective rate
  (`baseOutstanding/outstanding` or `exchangeRate`) of source and each target must match within a
  Decimal tolerance; otherwise `PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING` (FX gain/loss must
  go through the posting path, not the subledger).
- **Date/period:** `allocationDate >= max(source postingDate, all target postingDates)`; period must
  not be `CLOSED`/`UNDER_REVIEW`.
- **Amounts:** each line > 0; each line ≤ target outstanding; Σ lines ≤ source outstanding; no
  duplicate targets. Base amount is computed server-side (base = amount when base currency;
  amount × matching rate for same-rate foreign currency).

---

## Reference + idempotency

- `payable-allocation-reference.service.ts` generates `APALLOC/YY-YY/######`, unique per tenant, using
  a max+1 scan over the fiscal-year prefix with a retry loop on `P2002` (`pay_alloc_batch_ref_key`).
  Gaps are acceptable; it does **not** touch `FinanceNumberSeries`.
- Canonical payload hash (SHA-256 hex) over tenant, legal entity, `vendorPaymentId`, source DEBIT
  open-item id, `allocationDate`, currency, control account, and lines sorted by
  `targetCreditOpenItemId` with amounts — excluding tokens/timestamps/names.
- Idempotency: lookup by `idempotencyKey`; same hash ⇒ **replay** the stored result
  (`idempotentReplay = true`, no new audit); different hash ⇒
  `PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH`.

---

## Allocate transaction (`payable-allocation.service.ts`)

1. Idempotency check (replay / mismatch).
2. Validate request.
3. `$transaction` (ReadCommitted): lock open items in sorted id order → revalidate balances &
   `updatedAt` versions → create batch + lines → apply debit + credit balance updates → write one
   `PAYABLE_ALLOCATION_CREATED` audit (never on replay).
4. Return `CreatePayableAllocationResult` (source before/after + per-line targets).

---

## Derived read state

- **Payment detail** (`vendor-payment-read.service.ts`) exposes `allocationState`
  (`UNALLOCATED|PARTIALLY_ALLOCATED|FULLY_ALLOCATED`) from the DEBIT open item and
  `allowedActions.allocate`.
- **Invoice detail** (`vendor-invoice-read.service.ts`) exposes `payableSettlementState`
  (`UNPAID|PARTIALLY_PAID|PAID`) derived from the CREDIT open item. `VendorInvoice.status` stays
  `POSTED` — settlement is **not** written back to the document status.

---

## Allowed actions

```text
allocate = payment POSTED
         && has finance.ap.allocation.create
         && source open item status ∈ {OPEN, PARTIALLY_SETTLED}
         && source outstanding > 0
         && !onHold && !disputed
reverse  = false   (no allocation reversal in 4B4)
```

---

## Tests

Live-MySQL suites (`skipIf(!dbAvailable)`), 30 cases:

| File | Coverage |
|------|----------|
| `finance-ap-payment-allocation.test.ts` (18) | partial/full/one→many/many→one/advance/mixed, over-alloc source & target, duplicate target, vendor/control-account/currency mismatch, FX block, same-rate foreign base amount, no GL/voucher/series side effects, status transitions + `settledAt`, utilisation/settlement state, allocatable listing, history, date guard |
| `finance-ap-payment-allocation-idempotency.test.ts` (2) | replay + payload mismatch |
| `finance-ap-payment-allocation-concurrency.test.ts` (2) | one payment two allocs; one invoice two payments |
| `finance-ap-payment-allocation-permissions.test.ts` (3) | 403 without create; `payment.post` alone insufficient; allocatable requires view |
| `finance-ap-payment-allocation-tenant-isolation.test.ts` (2) | cross-tenant allocate blocked; cross-tenant read blocked |
| `finance-ap-payment-allocation-reconciliation.test.ts` (3) | net AP + GL + number series invariant; batch/line ↔ open-item deltas reconcile; FX mismatch kept out of subledger |

Shared fixture: `tests/finance/helpers/ap-allocation-fixture.ts`.

See [`AP_PAYMENT_ARCHITECTURE.md`](AP_PAYMENT_ARCHITECTURE.md) and [`AP_STATUS.md`](AP_STATUS.md).
