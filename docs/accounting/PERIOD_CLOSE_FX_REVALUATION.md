# Period Close — FX Revaluation

Last verified: **2026-07-30**

Unrealized FX revaluation for foreign-currency AR/AP open items at period end.

## Scope

| In | Out |
|----|-----|
| Manual closing rates (`FxExchangeRate`) | Live bank / TPP FX feeds |
| Preview AR debit + AP credit foreign open items | Treasury cross-currency transfers |
| SYSTEM `JOURNAL` for unrealized gain/loss | Realized FX on receipt/payment allocation |
| Update open-item base amounts + rates on post | Intercompany FX |
| Reverse into next open period | Multi-currency bank cash |

Requires **`MULTI_CURRENCY`** feature enabled for the legal entity.

## Default mappings

| Key | Category |
|-----|----------|
| `UNREALIZED_FX_GAIN` | INCOME |
| `UNREALIZED_FX_LOSS` | EXPENSE |
| `CUSTOMER_RECEIVABLE` / `VENDOR_PAYABLE` | Used as control when open item has no dedicated account |

## Permissions

- `finance.fx_revaluation.view`
- `finance.fx_revaluation.manage` (upsert rates)
- `finance.fx_revaluation.preview`
- `finance.fx_revaluation.post`
- `finance.fx_revaluation.reverse`

## API

Base: `/api/v1/t/:slug/accounting/period-close/fx-revaluation`

| Action | Method | Path |
|--------|--------|------|
| List rates | `GET` | `/rates?legalEntityId=` |
| Upsert rate | `PUT` | `/rates` `{ legalEntityId, currencyCode, asOfDate, rate }` |
| Get run | `GET` | `/periods/:periodId/run` |
| Preview | `POST` | `/periods/:periodId/preview` |
| Post | `POST` | `/runs/:id/post` |
| Reverse | `POST` | `/runs/:id/reverse` `{ reason, reversalDate? }` |

## Economics

- Closing rate = latest `FxExchangeRate` with `asOfDate <= period.endDate` for that currency.
- **AR (asset):** `gainLoss = foreignOpen × closingRate − baseOpen` (positive = gain).
- **AP (liability):** `gainLoss = baseOutstanding − foreignOutstanding × closingRate` (positive = gain).
- Journal: monetary AR/AP line (with customer/vendor party) paired with unrealized gain or loss.
- Post updates `exchangeRate` + `baseOpenAmount` / `baseOutstandingAmount` on the open item.
- One run per `(legalEntityId, periodId)`; idempotent post/reverse via `eventKey`.

## Frontend

`/accounting/period-close/fx-revaluation` — dual-mode:

- Demo: seed lines + preview toast.
- API: load run for selected period; Preview / Post / Reverse via `finance.fx_revaluation.*`.

## Ops

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy   # 20260730220000_finance_fx_revaluation
npm run db:sync-permissions
npx vitest run tests/finance/finance-fx-revaluation.test.ts
```
