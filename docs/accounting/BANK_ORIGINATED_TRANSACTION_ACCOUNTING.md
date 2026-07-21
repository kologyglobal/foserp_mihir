# Bank-Originated Transaction Accounting (Phase 5B3)

Bank statement or manual treasury adjustments post through `TreasuryAdjustment` into the central posting engine.

## Typical treatments (backend-built)

| Type | Pattern |
|------|---------|
| Bank charges (+ GST recoverable) | Dr Expense, Dr Input GST / Cr Bank |
| Interest income (+ TDS) | Dr Bank, Dr TDS Receivable / Cr Interest Income |
| Interest expense | Dr Interest Expense / Cr Bank |
| Collection / merchant fee | Dr Fee Expense (± GST) / Cr Bank |
| Direct debit / credit | Dr/Cr selected offset / opposite Bank |

Gross vs bank (net) amounts are supported: bank GL amount equals statement remaining amount for statement-led docs.

See also: [`TREASURY_ADJUSTMENT_ARCHITECTURE.md`](TREASURY_ADJUSTMENT_ARCHITECTURE.md), [`STANDING_INSTRUCTIONS.md`](STANDING_INSTRUCTIONS.md), [`BANKBOOK_CASHBOOK.md`](BANKBOOK_CASHBOOK.md).
