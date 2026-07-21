# Bankbook / Cashbook (Phase 5B3)

Read-only GL workspaces for treasury accounts.

| Book | Account type | Source of truth |
|------|--------------|-----------------|
| Bankbook | `BANK` | `GeneralLedgerEntry` on bank GL |
| Cashbook | `CASH` | `GeneralLedgerEntry` on cash GL |

## Rules

- Opening = net posted GL before `dateFrom`.
- Closing = opening + period debits − period credits.
- Running balance sorted by posting date → voucher sequence → GL sequence → GL id.
- Bankbook may show reconciliation status; cashbook does not use statement fields.
- Export uses the same filters as the on-screen report.

## API

`GET /accounting/treasury/books/bankbook` · `…/cashbook` · `…/export`

## Frontend

`/accounting/bank-cash/bankbook` · `/accounting/bank-cash/cashbook`
