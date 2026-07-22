# Treasury Liquidity — Phase 5C1

**Status:** Shipped (backend + dual-mode FE dashboard).

## Scope

| Capability | Description |
|------------|-------------|
| Cash position | As-of GL balances for ACTIVE/INACTIVE BANK + CASH treasury accounts |
| Daily liquidity | Book balances + funds in transit, uncleared cheques, unmatched statement amounts |
| Short-term forecast | 7/14/30-day horizons from standing instructions, AP/AR open items, uncleared cheques |
| Closing controls | Read-only checklist; soft `TreasuryDayClose` (OPEN → REVIEWED → CLOSED) — does **not** lock GL periods |
| Dashboard | Composed API + Bank & Cash overview in API mode |

## Non-goals

FX conversion · MT940/CAMT · bank API balances · payment-file forecasting · period-close engine replacement.

## API

Prefix: `/api/v1/t/:tenantSlug/accounting/treasury/liquidity`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/cash-position` | `finance.treasury.liquidity.view` |
| GET | `/daily` | `.liquidity.view` |
| GET | `/forecast` | `.liquidity.view` |
| GET | `/closing-controls` | `finance.treasury.closing.view` |
| GET | `/dashboard` | `.liquidity.view` |
| GET/POST | `/day-closes*` | `.closing.view` / `.closing.manage` (review / close / reopen) |

Soft day-close does **not** lock GL periods or block posting.

## Frontend

- `/accounting/bank-cash` and `/accounting/bank-cash/liquidity` → API liquidity dashboard when `VITE_USE_API=true`, else demo overview.
- Close Day / Reopen Day gated by `finance.treasury.closing.manage`.

## Migration

`20260720270000_finance_phase5c1_treasury_liquidity` — `treasury_day_closes`.

## Smoke

- Backend: `npx vitest run tests/finance/finance-treasury-liquidity.test.ts`
- Frontend: `npm run test:treasury-liquidity`
