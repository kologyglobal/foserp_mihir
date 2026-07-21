# AP Reversal Architecture (Phase 4C1)

Accounts Payable — Phases 4A1–4A5, 4B1–4B5 and 4C1 complete. Vendor-invoice and vendor-payment allocations can be reversed, and posted vendor payments or vendor invoices can be reversed through controlled allocation-first ordering with exact reversing vouchers and AP balance restoration. Vendor debit notes and reversal frontend remain pending.

## Ordering

```text
Allocation reversal (subledger only, no GL)
        ↓
Open-item balances restored
        ↓
Document reversal (exact inverse voucher + GL)
        ↓
Source document + open item → REVERSED
```

A posted payment or invoice **cannot** be reversed while active allocations remain, unless `cascadeAllocationReversals=true` (same transaction).

## Allocation reversal

- `POST /accounting/payables/allocations/:allocationId/reverse`
- Permission: `finance.ap.allocation.reverse`
- Creates `PayableAllocationReversalBatch` / `PayableAllocationReversalLine` history
- Restores DEBIT (payment/advance) and CREDIT (invoice) outstanding/allocated
- Creates **no** PostingEvent, AccountingVoucher, or GeneralLedgerEntry
- Reference series: `APALLOCREV/YY-YY/######`
- Full batch or selected lines (full active amount only — no partial ₹ amounts)

## Document reversal

- `GET/POST .../vendor-payments/:id/reversal-preview|reverse`
- `GET/POST .../vendor-invoices/:id/reversal-preview|reverse`
- Permissions: `finance.ap.payment.reverse`, `finance.ap.vendor_invoice.reverse`
- Inverts **original** voucher lines (debit↔credit); does not recalculate from current mappings
- Event keys: `VENDOR_PAYMENT_REVERSE:{id}:V1`, `VENDOR_INVOICE_REVERSE:{id}:V1`
- Marks open item `REVERSED` with zero outstanding
- Cascade uses posting `beforeAccounting` hook so allocation + voucher commit atomically

## Out of scope (Phase 4C2+)

- Reversal frontend / Money Out correction workspace
- Vendor debit notes / AP adjustments
- Partial monetary line reversal
- Bank reconciliation / cheque-clearing reversal
- AP ageing / AP-to-GL dashboard
