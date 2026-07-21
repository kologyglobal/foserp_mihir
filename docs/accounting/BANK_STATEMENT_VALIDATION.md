# Bank Statement Validation

## Balance equation

```text
Expected Closing = Opening + Total Credits − Total Debits
Balance Difference = Actual Closing − Expected Closing
```

Outside tolerance → `BANK_STATEMENT_BALANCE_EQUATION_MISMATCH` → `VALIDATION_FAILED`.

## Running balance

When supplied, each ordered line is checked:

```text
Expected = Previous + CREDIT − DEBIT
```

Mismatch → `BANK_STATEMENT_RUNNING_BALANCE_MISMATCH` (severity per policy).

## Validate API

`POST /bank-statements/:id/validate` with `expectedUpdatedAt`.

Recalculates totals from lines, hashes, duplicates, balance equation; replaces validation issues; sets `VALIDATED` or `VALIDATION_FAILED`.

Does **not** start matching or create accounting.
