# Bank Clearing Settlement (Phase 5A3)

> Last verified: **2026-07-20**.

Clearing settlement is the only reconciliation path that creates accounting. It always uses the **central posting engine** (`post()`). Direct bank GL matches create no voucher, GL, or PostingEvent.

## Incoming (statement CREDIT)

Original receipt (example):

```text
Dr Receipt Clearing
    Cr Customer Receivable
```

Settlement when bank confirms:

```text
Dr Bank
    Cr Receipt Clearing
```

## Outgoing (statement DEBIT)

Original payment (example):

```text
Dr Vendor Payable
    Cr Payment Clearing
```

Settlement:

```text
Dr Payment Clearing
    Cr Bank
```

Grouped clearing matches produce **one** settlement voucher with multiple clearing lines and one bank line.

## PostingEvent

```text
eventKey  = BANK_RECON_CLEARING_SETTLEMENT:{reconciliationMatchId}:V1
eventType = BANK_RECONCILIATION_CLEARING_SETTLED
```

Voucher: `voucherType = SYSTEM`, `sourceDocumentType = BANK_RECONCILIATION_MATCH`, `sourceDocumentId = matchId`. Match reference (`BREC/...`) is separate from the voucher number (`FinanceNumberSeries` / JOURNAL series for SYSTEM).

## Unmatch

| Match type | Unmatch behaviour |
|------------|-------------------|
| Direct (`NONE`) | Reverse allocations only; no GL |
| Clearing | Exact reversal voucher via `BANK_RECON_CLEARING_UNMATCH:{matchId}:V1`; original settlement voucher unchanged |
| Journal-from-statement | Unmatch reconciliation only; journal remains posted |

## Invariants

- Settlement moves amount between clearing and bank only (payables/receivables/tax unchanged).
- Settlement + reversal = zero net GL effect.
- Failed posting after number reservation: no active match/allocations; PostingEvent may be `FAILED`; retry reuses reserved voucher number.
