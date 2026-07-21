# AP Vendor Payment — Draft Workflow, Approval & Atomic Posting (Phase 4B3)

Phase 4B3 turns the Phase 4B2 vendor-payment calculation engine into a full document:
draft → validate → (approval) → ready-to-post → **atomic GL posting** with a **DEBIT** vendor
payable open item. It reuses the shared posting engine and mirrors the Vendor Invoice
(4A3/4A4) architecture.

> Vendor payments and advances can be drafted, approved and posted to immutable GL with DEBIT
> payable open items. As of Phase **4B5**, the full lifecycle (draft → post → allocate) is also
> driven from the Money Out frontend — see [`AP_PAYMENT_FRONTEND.md`](AP_PAYMENT_FRONTEND.md) and
> [`AP_ALLOCATION_FRONTEND.md`](AP_ALLOCATION_FRONTEND.md). Payment reversal, allocation reversal,
> AP ageing and AP reconciliation remain pending.

---

## HTTP surface

Base: `/api/v1/t/:tenantSlug/accounting/payables/vendor-payments`

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/` | `finance.ap.payment.view` | List; `legalEntityId` required |
| POST | `/` | `finance.ap.payment.create` | Create draft (server-calculated) |
| GET | `/:id` | `finance.ap.payment.view` | Detail + `allowedActions` |
| PATCH | `/:id` | `finance.ap.payment.edit` | Replace DRAFT header + adjustments |
| POST | `/:id/validate` | `finance.ap.payment.view` | Fresh recalculation, persists snapshots |
| POST | `/:id/submit` | `finance.ap.payment.submit` | DRAFT (approval-required) → PENDING_APPROVAL |
| POST | `/:id/approve` | `finance.ap.payment.approve` | PENDING_APPROVAL → READY_TO_POST |
| POST | `/:id/reject` | `finance.ap.payment.approve` | PENDING_APPROVAL → REJECTED |
| POST | `/:id/revise` | `finance.ap.payment.edit` | REJECTED/READY_TO_POST → DRAFT |
| POST | `/:id/mark-ready` | `finance.ap.payment.mark_ready` | DRAFT (no approval) → READY_TO_POST |
| POST | `/:id/cancel` | `finance.ap.payment.cancel` | DRAFT/REJECTED/READY_TO_POST/PENDING_APPROVAL → CANCELLED |
| POST | `/:id/post` | `finance.ap.payment.post` | READY_TO_POST → POSTED (atomic) |
| GET | `/:id/approval` | `finance.ap.payment.view` | Approval request + steps |

All decimals are returned as strings. `allocate` and `reverse` are always `false` in
`allowedActions` (deferred to later phases).

---

## Lifecycle

```
DRAFT ──mark-ready(no approval)──────────────► READY_TO_POST ──post──► POSTED
  │                                               ▲
  └─submit(approval required)─► PENDING_APPROVAL ──approve──┘
                                     │
                                     └─reject─► REJECTED ─revise─► DRAFT
DRAFT / REJECTED / READY_TO_POST / PENDING_APPROVAL ─cancel─► CANCELLED
```

`approvalRequired` comes from the request `approvalRequiredOverride` (default `false`; real
`FinanceApprovalRule` matching is deferred). Approval-required drafts must go through
submit + approve; non-approval drafts use `mark-ready`.

---

## Calculation context & persistence

The create/update request body is stored on `VendorPayment.calculationContext`.
`recalculateVendorPayment` rebuilds the Phase 4B2 calculation input from that context and
re-runs `calculateVendorPayment`, so validate/mark-ready/approve/post always reflect current
engine semantics.

Persisted from the calculation result: `paymentAmount`, `settlementAdjustmentAmount`,
`paymentExpenseAmount`, net `roundOffAmount`, `vendorSettlementAmount`, `cashOutflowAmount`,
`tdsAmount`, `tdsBaseAmount` (+ `base*`), resolved GL account ids, `calculationSnapshot`,
`accountingPreviewSnapshot`, and adjustment lines with calculated amounts.

---

## Uniqueness key (duplicate-payment guard)

`VendorPayment.paymentUniquenessKey String? @unique @db.VarChar(512)`.

`vendor-payment-reference-normalization.ts`:

- `normalizePaymentReference(raw)` — trim, collapse whitespace, uppercase.
- `resolveExternalReference(payment)`:
  - `BANK_TRANSFER` → `bankReference || paymentReference`
  - `CHEQUE` → `chequeNumber + chequeDate + paymentAccountId`
  - `UPI` / `CARD` → `instrumentReference || paymentReference`
  - `OTHER` → `paymentReference`
  - `CASH` → `null` (no key — multiple cash payments are legal)
- `buildPaymentUniquenessKey({ tenantId, legalEntityId, paymentMethod, paymentAccountId, normalizedExternalRef })` — join with `|`.

The key is **claimed** at submit / mark-ready (DB `@unique` enforces conflicts →
`VENDOR_PAYMENT_DUPLICATE_UNIQUENESS_KEY`), **released** on cancel, and **preserved** on
reject / ready / posted.

---

## Posting (atomic)

`POST /:id/post` reuses `post()` from the shared posting engine.

1. Re-validates: READY_TO_POST only, stale-version guard, no existing accounting links, no
   existing open item, vendor active, uniqueness key present when required, approval state,
   calculation version, fresh recalculation with **no amount drift**
   (→ `VENDOR_PAYMENT_CHANGED_AFTER_READY`), balanced transaction + base preview, resolved
   accounts, and open posting period.
2. `beforeTransaction`: reserve FOS `VENDOR_PAYMENT` number via
   `reserveSourceDocumentNumber(..., 'VENDOR_PAYMENT', ...)`.
3. Accounting builder emits balanced GL lines directly from the 4B2 accounting preview
   (debit/credit as previewed).
4. `afterAccounting` (same transaction):
   - Enforces the **GL invariant**: vendor payable DEBIT total = `vendorSettlementAmount`
     (and base equivalent).
   - Creates exactly one **DEBIT** `PayableOpenItem`: documentType `VENDOR_ADVANCE` when
     purpose = ADVANCE else `VENDOR_PAYMENT`; `originalAmount = vendorSettlementAmount`;
     `allocatedAmount = 0`; `outstandingAmount = original`; `sourceVendorPaymentId` set.
   - Finalises the payment (conditional READY_TO_POST → POSTED with number/voucher/event/open-item links).

Deterministic event key `VENDOR_PAYMENT_POST:{id}:V1` makes replays idempotent. A failure
after number reservation leaves the payment READY_TO_POST with a FAILED posting event; retry
reuses the reserved numbers.

**Posting a vendor payment does not allocate against invoices and does not reverse.**

---

## Example GL

Simple ₹10,000 bank payment (INVOICE_SETTLEMENT):

| Account | Debit | Credit |
|---------|------:|-------:|
| Vendor Payable | 10,000 | |
| Bank | | 10,000 |

Open item: DEBIT `VENDOR_PAYMENT`, original 10,000.

₹10,000 payment with ₹1,000 TDS (settlement credit) + ₹200 bank charge (expense debit):

| Account | Debit | Credit |
|---------|------:|-------:|
| Vendor Payable | 11,000 | |
| TDS Payable | | 1,000 |
| Bank | | 10,200 |
| Bank Charges | 200 | |

Open item original = `vendorSettlementAmount` (11,000), **not** cash outflow (10,200).

---

## Allocation (Phase 4B4)

Once POSTED, a payment's DEBIT open item can be **allocated** against posted vendor invoices' CREDIT
open items — subledger only, **no GL**. `allowedActions.allocate` becomes true while the source is
`OPEN|PARTIALLY_SETTLED` with outstanding > 0 (and the caller holds `finance.ap.allocation.create`).
Payment detail exposes `allocationState` (`UNALLOCATED|PARTIALLY_ALLOCATED|FULLY_ALLOCATED`). Full
design in [`AP_ALLOCATION_ARCHITECTURE.md`](AP_ALLOCATION_ARCHITECTURE.md).

---

## Tests

- `tests/finance/finance-ap-vendor-payment-workflow.test.ts`
- `tests/finance/finance-ap-vendor-payment-posting.test.ts`
- `tests/finance/finance-ap-payment-allocation*.test.ts` (Phase 4B4)

Live MySQL tests (`describe.skipIf(!dbAvailable)`).
