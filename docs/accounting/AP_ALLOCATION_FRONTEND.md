# Accounts Payable — Payment Allocation Frontend

**Phase:** 4B5  
**Mode:** `VITE_USE_API=true`  
**Pages:** `VendorPaymentAllocatePage`, `PayableAllocationDetailPage`, shared `PayableAllocationHistoryTable`

Allocation settles vendor **invoice open items (CREDIT)** against a posted vendor **payment/advance open item (DEBIT)**. It is a **subledger-only** operation.

> **No GL is created by allocation.** It only reduces open-item balances. This is stated explicitly in the allocate page banner and every allocation summary.

---

## Routes

| Path | Page |
|------|------|
| `/accounting/money-out/vendor-payments/:id/allocate` | `VendorPaymentAllocatePage` |
| `/accounting/money-out/allocations/:allocationId` | `PayableAllocationDetailPage` (read-only) |

Allocation history is also embedded on the payment detail and vendor invoice detail via `PayableAllocationHistoryTable`.

---

## Allocate flow

1. Load the payment; only `POSTED` payments/advances are allocatable.
2. Fetch allocatable invoices (`getAllocatableVendorInvoices`) → items with `outstandingAmount`, `updatedAt`, and a server `suggestedAllocationAmount` (FIFO by due date, pre-filled).
3. User edits per-invoice amounts; the page shows **total to allocate** and **remaining after** (client display only — never re-derives balances).
4. Submit builds a `CreateVendorPaymentAllocationInput` and calls `createVendorPaymentAllocation`.
5. On success/`idempotentReplay`: navigate back to the payment; balances come only from the reloaded server state.

---

## Idempotency & concurrency

- **Idempotency key:** a UUID (`crypto.randomUUID`) generated per confirmation payload. It is stored with a `keySignature` (allocation date + sorted selected lines) and **reused on retry**; a **new key** is generated when the selection, amounts, or date change.
- **Source concurrency:** `expectedSourceOpenItemUpdatedAt` (the payment open item's `updatedAt`, surfaced via `AllocatableVendorInvoicesResult.sourceUpdatedAt`) plus `expectedPaymentUpdatedAt`.
- **Target concurrency:** each line sends `expectedTargetUpdatedAt` (the invoice open item's `updatedAt`).
- **Stale handling:** any "changed / reload" error clears the idempotency key and reloads allocatable invoices so the user retries against fresh balances — local balances are never double-applied.

---

## Allocation detail (`PayableAllocationDetailPage`)

Read-only: batch reference/date, source payment link, and target invoice lines with allocated amounts. Links back to the source payment and each target invoice. **No reverse / delete allocation** affordances — allocation reversal is a later AP phase.

---

## Verification

```bash
cd frontend && npm run test:money-out-payments
```

Static checks assert: allocate uses `idempotencyKey` + stable signature, sends source/target concurrency timestamps, explains "no journal entry", handles `idempotentReplay`, and exposes no reversal/delete UI.
