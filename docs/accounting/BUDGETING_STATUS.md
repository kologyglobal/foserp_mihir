# Budgeting Status

**Phase:** Budgeting Phase 1 (2026-07-21)  
**Status:** Dual-mode for core planning loop — versions, annual lines, budget vs actual, overview KPIs.

## Shipped

| Layer | Detail |
|-------|--------|
| **Schema** | `BudgetVersion`, `BudgetLine` — migration `20260721130000_finance_budgeting_phase1` |
| **API** | `/accounting/budgeting` — overview, versions CRUD + submit/approve/lock, lines CRUD, budget-vs-actual |
| **Permissions** | `finance.budget.view` \| `create` \| `edit` \| `approve` |
| **Actuals** | Posted `AccountingVoucher` lines (base debit − credit) by account × FY month |
| **FE** | Dual-mode Overview / Versions / Annual / BVA; Capex / Rolling / Cash / Dimension show Phase 1 N/A banner in API mode |
| **Tests** | `finance-budgeting-phase1.test.ts`; FE `npm run test:budgeting` |

## Explicitly out of Phase 1

- Capex workflow, rolling forecast engine, 13-week cash flow
- Multi-dimension budgets, commitment control / GL reservation
- Approvals engine reuse beyond simple approve endpoint

## Next

Phase 2+ (separate approval): commitment control, rolling forecast, multi-dimension, Capex API.
