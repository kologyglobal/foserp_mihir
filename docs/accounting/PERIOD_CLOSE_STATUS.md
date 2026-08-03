# Period Close — Status

Last verified: **2026-07-30** (Year-end P&L → retained earnings slice).

## Phase 1 — shipped

Dual-mode workspace at `/accounting/period-close` that **actually** closes/reopens `AccountingPeriod` records when `VITE_USE_API=true`.

| Surface | Demo (`VITE_USE_API=false`) | API (`VITE_USE_API=true`) |
|---------|----------------------------|---------------------------|
| Close Dashboard | Mock KPIs / blockers from seed | Composed readiness from backend aggregator |
| Close Checklist | Editable mock tasks | Computed readiness + persisted Ack / N/A notes |
| Period Locking | Module soft/hard lock simulation | Close / Under Review / Reopen via `finance.period.*` + blocker panel |
| **Inventory Close** | Seed KPIs | Live inventory accounting event counts + gate status |
| **Manufacturing Close** | Seed KPIs | Live mfg workspace summary (unposted/failed/WIP/close-ready) |
| **Bank Reconciliation Status** | Seed KPIs | Live open recon session count from close-readiness |
| **Year-End Closing** | Seed preview only | **Live** P&L → `RETAINED_EARNINGS` via `POST …/financial-years/:id/year-end-close`; FY lock hardened |
| **Accruals / Prepaid** | Seed scaffolding | **Live** period-end adjustments via `/accounting/period-adjustments` — see [`PERIOD_END_ADJUSTMENTS.md`](PERIOD_END_ADJUSTMENTS.md) |
| **Close Calendar / Templates / Reopen Requests** | Seed scaffolding | **Live** via `/accounting/period-close` — see [`PERIOD_CLOSE_CALENDAR_REOPEN.md`](PERIOD_CLOSE_CALENDAR_REOPEN.md) |
| **FX Revaluation** | Seed scaffolding | **Live** rates + preview/post/reverse — see [`PERIOD_CLOSE_FX_REVALUATION.md`](PERIOD_CLOSE_FX_REVALUATION.md) |
| Other screens | Demo scaffolding | Still demo — later phases |

### Permissions

Reuse existing backend keys — **no** parallel `accounting.period_close.*` API permissions:

- `finance.period.view`
- `finance.period.manage` (under review, checklist acks)
- `finance.period.close`
- `finance.period.reopen`
- Year-end preview/execute: `finance.financial_year.view` / `finance.financial_year.manage`

FE demo role packs still use `accounting.period_close.*` for mock gating only.

### API paths used

| Action | Method | Path |
|--------|--------|------|
| List periods | `GET` | `/api/v1/t/:slug/accounting/periods?legalEntityId=&financialYearId=&limit=100` |
| List FY | `GET` | `/api/v1/t/:slug/accounting/financial-years?legalEntityId=` |
| **Close readiness** | `GET` | `/api/v1/t/:slug/accounting/periods/:id/close-readiness` |
| **Checklist acks** | `GET` / `PUT` | `/api/v1/t/:slug/accounting/periods/:id/checklist-acks` |
| Mark under review | `POST` | `/api/v1/t/:slug/accounting/periods/:id/mark-under-review` |
| Close | `POST` | `/api/v1/t/:slug/accounting/periods/:id/close` |
| Reopen | `POST` | `/api/v1/t/:slug/accounting/periods/:id/reopen` `{ reason }` |
| **Year-end preview** | `GET` | `/api/v1/t/:slug/accounting/financial-years/:id/year-end-preview` |
| **Year-end close** | `POST` | `/api/v1/t/:slug/accounting/financial-years/:id/year-end-close` |
| **Lock FY** | `POST` | `/api/v1/t/:slug/accounting/financial-years/:id/close` (requires all periods CLOSED + year-end run) |

Readiness is **backend-authoritative** (`period-close-readiness.service.ts`). FE maps `PASS | WARN | BLOCK` into the Period Close UI.

### Hard-block close (optional)

- Finance Settings field: `periodCloseHardBlock` (default **false**)
- UI toggle: Accounting → Settings → Features & Controls
- When **on**, `POST …/close` runs the same readiness service and rejects with `PERIOD_CLOSE_BLOCKED` if any check is `BLOCK` (AP close gate blocked/failed, unposted journals, open bank recon overlapping the period, failed/unposted inv/mfg GL events when those feature flags are on)
- When **off**, close still succeeds with advisory blockers (backward compatible)

### Posting lock

Closing a period sets `AccountingPeriod.status = CLOSED`. The posting engine rejects journals into closed periods (`ACCOUNTING_PERIOD_CLOSED`) — covered by `finance-posting-engine.test.ts` and period close/reopen lifecycle in `finance-setup.test.ts` / `period-close-hardening.test.ts`.

### Year-end slice (2026-07-30)

1. Close all periods **except** the last (`OPEN`/`REOPENED` required for posting).
2. `POST …/year-end-close` posts a SYSTEM `JOURNAL` that zeros INCOME/EXPENSE into mapped `RETAINED_EARNINGS` (idempotent `YearEndCloseRun`).
3. Close the last period.
4. `POST …/financial-years/:id/close` locks the FY (blocked until year-end run exists + all periods CLOSED).

Continuous GL carries balance-sheet balances forward — **no** opening-balance voucher in this slice.

### FE verification

```bash
cd frontend && npx tsx scripts/verify-period-close.ts
# or:
npm run test:period-close
```

### BE verification

```bash
cd backend && npx vitest run tests/finance/period-close-hardening.test.ts tests/finance/finance-year-end-close.test.ts --no-file-parallelism
```

---

## Close Control Hardening — shipped (2026-07-23)

- Backend close-readiness aggregator
- Optional hard-block via `FinanceSettings.periodCloseHardBlock`
- `PeriodCloseChecklistAck` persistence (ACK / NA + note)
- Period Locking blocker panel; Bank scorecard live from readiness

## Still deferred

- FX revaluation posting wizard (period-close screen still demo)
- Module soft/hard locks beyond whole-period GL lock
- Opening-balance voucher for greenfield ledgers (not required for continuous GL)
- Auto-reclose of period when reopen temporary window expires

## Accruals / prepaid (2026-07-30)

Shipped — docs: [`PERIOD_END_ADJUSTMENTS.md`](PERIOD_END_ADJUSTMENTS.md). Migration `20260730190000_finance_period_end_adjustments`.

## Calendar / templates / reopen requests (2026-07-30)

Shipped — docs: [`PERIOD_CLOSE_CALENDAR_REOPEN.md`](PERIOD_CLOSE_CALENDAR_REOPEN.md). Migration `20260730200000_finance_period_close_calendar_reopen`.

---

## Related modules

| Module | Status |
|--------|--------|
| Fixed Assets | Phases 1–4 live — see `FIXED_ASSETS_STATUS.md` |
| GST extract | Phase 1 extract shipped; filing/portal demo |
| Budgeting | Demo FE / Phase 1 API where shipped |
| **Manufacturing accounting** | Phase 6B/7E backend + live FE workspace at `/accounting/manufacturing` (flag `MANUFACTURING_ACCOUNTING` OFF by default). SoT: `docs/manufacturing/PRODUCTION_PHASE7E_README.md` |
| **Inventory accounting** | Events backend + FE register at `/inventory/accounting` (flag `INVENTORY_ACCOUNTING` OFF by default) |

### Enable SOP (mfg / inventory GL)

1. Configure default mappings: `WIP_INVENTORY`, `RAW_MATERIAL_INVENTORY`, `FINISHED_GOODS_INVENTORY`, absorption / variance / `STOCK_ADJUSTMENT` / `PURCHASE` / `COST_OF_GOODS_SOLD` as needed.
2. Ensure an open accounting period.
3. Enable `MANUFACTURING_ACCOUNTING` and/or `INVENTORY_ACCOUNTING` per legal entity (Finance › Features or mfg workspace toggle).
4. `npm run db:sync-permissions` and re-login for `manufacturing.accounting.*` / `inventory.view_cost` as required.

See also: Finance Settings Periods page (`/accounting/settings/periods`), AP Close Gate (`/accounting/money-out/close-gate`).
