# Bank Reconciliation Frontend (Phase 5A3)

> Last verified: **2026-07-20**.

## Routes (`VITE_USE_API=true`)

| Path | Page |
|------|------|
| `/accounting/bank-cash/reconciliation` | Session list |
| `/accounting/bank-cash/reconciliation/:statementId` | Workspace |
| `/accounting/bank-cash/reconciliation/matches/:matchId` | Match detail |
| `/accounting/bank-cash/reconciliation/history` | History |
| `/accounting/bank-cash/reconciliation/exceptions` | Exceptions |

Demo mode keeps the legacy demo list/workbench. API client methods live in `treasuryApi.ts` + `modules/accounting/treasury/bank-reconciliation/api/`.

## Workspace

Header (treasury, statement period, balances, difference) · command bar from `allowedActions` · tabs: Unmatched / Suggestions / Partially Matched / Matched / Exceptions / All · statement-line table (mobile cards) · candidate / manual-match drawer · clearing posting preview · finalization checklist.

## Confirmations

- **Direct match:** no new accounting will be created.
- **Clearing:** preview debit/credit lines from backend; explicit confirm posts settlement.
- **Unmatch clearing:** exact reversal voucher will be created.
- **Finalize:** locks matching; reopen needs extra permission and may be blocked by a later finalized statement.

## Decimal & date

Amounts as strings end-to-end. Dates as `YYYY-MM-DD` only.
