# Period-End Adjustments — Accruals & Prepaid

**Phase:** Period Close adjustments (2026-07-30)  
**Status:** Live API + dual-mode FE. Demo seed retained when `VITE_USE_API=false`.

## Purpose

Month-end close wizards for:

| Kind | Journal | Lifecycle |
|------|---------|-----------|
| **ACCRUAL** | Dr expense / Cr accrued liability on the period end date | Draft → Ready → Post → Reverse into next period |
| **PREPAID** | Dr expense / Cr prepaid asset (amortisation) | Draft → Ready → Activate schedule → Recognise one period at a time |

## Accounting

- Accrual posts on the **period end date**.
- Auto-reversal posts on the **next period start date** (must already exist — generate the next FY periods first if needed).
- Prepaid schedule amounts are an even split; any rounding remainder lands on the **last** period.
- Balance-sheet accounts default from `DefaultAccountMapping`:
  - `ACCRUED_EXPENSE_LIABILITY`
  - `PREPAID_EXPENSE_ASSET`
- Callers may override with an explicit `balanceSheetAccountId`.

## APIs

Base: `/api/v1/t/:tenantSlug/accounting/period-adjustments`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `finance.period_adjustment.view` |
| POST | `/` | `finance.period_adjustment.manage` |
| GET | `/:id` | view |
| PUT | `/:id` | manage |
| POST | `/:id/mark-ready` | manage |
| POST | `/:id/revise` | manage |
| POST | `/:id/cancel` | manage |
| POST | `/:id/post` | `finance.period_adjustment.post` |
| POST | `/:id/reverse` | `finance.period_adjustment.reverse` |
| POST | `/:id/schedules/:scheduleId/recognise` | post |
| GET | `/periods/:periodId/summary` | view |
| POST | `/periods/:periodId/recognise-due-prepaid` | post |
| POST | `/periods/:periodId/reverse-due-accruals` | reverse |

GL idempotency keys:

- Accrual post: `PERIOD_ACCRUAL_POST:{id}:V1`
- Accrual reverse: `PERIOD_ACCRUAL_REVERSE:{id}:V1`
- Prepaid recognise: `PERIOD_PREPAID_RECOGNISE:{scheduleId}:V1`

## Migration

`20260730190000_finance_period_end_adjustments`

Deploy with:

```bash
npx tsx scripts/prisma-cli.ts migrate deploy
npm run db:sync-permissions
```

## Frontend

- Routes: `/accounting/period-close/accruals`, `/accounting/period-close/prepaid`
- Dual-mode via `periodCloseService` → `financeApiBridge` → `financeApi`
- Demo mode unchanged (seed + Suspend/Resume)
- API mode: Mark Ready / Post / Reverse (accruals); Recognise Period (prepaid)

## Still deferred (Bank & Cash / Period Close)

- Live TPP AIS (needs bank/TPP credentials)
- Treasury FX rate table + period-end revaluation journals
- Intercompany dual-LE transfers
- Close calendar templates + reopen-request approval workflow
- Cheque print
- Distributed cron lock / CAMT.052/.054

## Tests

```bash
npx vitest run tests/finance/finance-period-end-adjustments.test.ts --no-file-parallelism
```

Skips cleanly when MySQL is unreachable.
