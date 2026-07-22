# Period Close — Status

Last verified: **2026-07-20** (Phase 1 MVP).

## Phase 1 — shipped (this release)

Dual-mode workspace at `/accounting/period-close` that **actually** closes/reopens `AccountingPeriod` records when `VITE_USE_API=true`.

| Surface | Demo (`VITE_USE_API=false`) | API (`VITE_USE_API=true`) |
|---------|----------------------------|---------------------------|
| Close Dashboard | Mock KPIs / blockers from seed | Composed readiness from real periods + finance |
| Close Checklist | Editable mock tasks | Computed readiness checks (read-only) |
| Period Locking | Module soft/hard lock simulation | Close / Under Review / Reopen via `finance.period.*` |
| Other screens (calendar, accruals, year-end, FA/GST/inventory close, …) | Demo scaffolding | Still demo / empty — Phase 2+ |

### Permissions

Reuse existing backend keys — **no** parallel `accounting.period_close.*` API permissions:

- `finance.period.view`
- `finance.period.manage` (under review)
- `finance.period.close`
- `finance.period.reopen`

FE demo role packs still use `accounting.period_close.*` for mock gating only.

### API paths used

| Action | Method | Path |
|--------|--------|------|
| List periods | `GET` | `/api/v1/t/:slug/accounting/periods?legalEntityId=&financialYearId=&limit=100` |
| List FY | `GET` | `/api/v1/t/:slug/accounting/financial-years?legalEntityId=` |
| Mark under review | `POST` | `/api/v1/t/:slug/accounting/periods/:id/mark-under-review` |
| Close | `POST` | `/api/v1/t/:slug/accounting/periods/:id/close` |
| Reopen | `POST` | `/api/v1/t/:slug/accounting/periods/:id/reopen` `{ reason }` |
| AP close gate (readiness) | `GET` | `/api/v1/t/:slug/accounting/payables/close-gate/latest?legalEntityId=&periodId=` |
| Unposted journals | `GET` | `/api/v1/t/:slug/accounting/journals?legalEntityId=&postingDateFrom=&postingDateTo=` |
| Bank recon sessions | `GET` | `/api/v1/t/:slug/accounting/treasury/bank-reconciliation?legalEntityId=` |

Readiness is **FE-composed** (no dedicated aggregator endpoint). Soft warnings only — backend close is not hard-blocked by AP gate / journals / bank recon (product already closes without those gates).

### Posting lock

Closing a period sets `AccountingPeriod.status = CLOSED`. The posting engine rejects journals into closed periods (`ACCOUNTING_PERIOD_CLOSED`) — covered by `finance-posting-engine.test.ts` and period close/reopen lifecycle in `finance-setup.test.ts`.

### FE verification

```bash
cd frontend && npm run test:period-close
```

---

## Phase 2+ — deferred (period close)

- Accruals / prepaid / FX revaluation posting wizards
- Year-end close wizard (P&amp;L transfer, opening balances)
- Configurable close checklist templates + calendar (persisted)
- Module soft/hard locks beyond whole-period GL lock
- Reopen **request** approval workflow (today: direct reopen with reason)
- Hard-block close on AP close-gate BLOCKED (optional product decision)
- Auto evidence from FA / manufacturing / inventory / GST close modules

---

## Related deferred modules (not started as backends)

Recommended build order after Period Close Phase 1:

1. **GST extract foundation** — **shipped Phase 1** (read-only outward/inward); portal/e-invoice/challans/GSTR filing still deferred. See `TAX_COMPLIANCE_STATUS.md`.
2. **Fixed Assets** — register + depreciation close feed into period close Phase 2 (**recommended next**).
3. **Budgeting** — planning; less blocking for month-end.
4. **Manufacturing costing / inventory close** — depends on production/inventory backends maturing.

| Module | Status |
|--------|--------|
| Fixed Assets | Demo FE only — **recommended next** |
| GST extract | Phase 1 extract shipped; filing/portal demo |
| Budgeting | Demo FE only |
| Manufacturing costing | Demo FE only |

See also: Finance Settings Periods page (`/accounting/settings/periods`), AP Close Gate (`/accounting/money-out/close-gate`).
