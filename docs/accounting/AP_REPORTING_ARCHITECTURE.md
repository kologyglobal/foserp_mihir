# Accounts Payable — Reporting Architecture (Phase 4D1)

**Status:** AP reporting **read-only GET** APIs + Money Out reporting frontend shipped. Outstanding,
ageing, vendor summaries, overview, and payment planning derive from `PayableOpenItem` subledger rows
only — no GL writes, no allocation mutations, no audit logs on read.

- **Deferred:** AP subledger-to-GL reconciliation → **Phase 4D2** (shipped). Bank reconciliation → separate
> deferred scope (not part of 4D).

---

## Module layout

```text
backend/src/modules/accounting/payables/reporting/
  payable-reporting.routes.ts      — HTTP surface (mounted under /payables)
  payable-reporting.controller.ts
  payable-reporting.schemas.ts
  payable-reporting-context.service.ts  — reportDate, timezone, limitations
  payable-outstanding.repository.ts   — CREDIT-side queries + DTO mapping
  payable-outstanding.service.ts
  payable-ageing.service.ts           — bucket classification helpers
  vendor-payable-summary.service.ts   — per-vendor rollups + netPayableBase
  payable-overview.service.ts
  payable-payment-planning.service.ts — horizon due-date grouping
  payable-open-item-side.filters.ts   — CREDIT vs DEBIT side constants
```

Mounted at: `/api/v1/t/:tenantSlug/accounting/payables/*` via `payables.routes.ts`.

---

## HTTP surface (all GET, read-only)

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/overview` | `finance.ap.view` | Legal-entity AP snapshot (counts, totals, currency breakdown) |
| GET | `/outstanding` | `finance.ap.view` | Paginated open-item register (filters, sort, search) |
| GET | `/ageing` | `finance.ap.view` | Bucket summaries + currency breakdown |
| GET | `/vendors` | `finance.ap.view` | Vendor summary list with `netPayableBase` |
| GET | `/vendors/:vendorId` | `finance.ap.view` | Single-vendor summary |
| GET | `/vendors/:vendorId/open-items` | `finance.ap.view` | Vendor-scoped outstanding list |
| GET | `/payment-planning` | `finance.ap.view` | Due items grouped by vendor within horizon |

All routes: `authenticate` → tenant resolve → `requirePermission('finance.ap.view')`. No POST/PATCH/DELETE.

---

## CREDIT-side outstanding

Outstanding and ageing default to **vendor liability rows only**:

```text
side = CREDIT
documentType IN (VENDOR_INVOICE, VENDOR_CREDIT_ADJUSTMENT)
status IN (OPEN, PARTIALLY_SETTLED, DISPUTED, ON_HOLD)   // unless includeSettled
outstandingAmount > 0                                      // unless includeSettled
```

- Posted vendor invoices and credit adjustments appear in outstanding/ageing.
- Draft / unposted documents are excluded (no open item yet).
- DEBIT rows (payments, advances, debit notes) are **not** in the outstanding register; they feed
  vendor summary debit totals instead.

Each outstanding row exposes read-only `allowedActions` (all `false`) — reporting never implies
workflow affordances.

---

## Ageing bases

Query param `ageingBasis`:

| Value | Buckets | Classification |
|-------|---------|----------------|
| `due_date` (default) | `CURRENT`, `OVERDUE_1_30`, `OVERDUE_31_60`, `OVERDUE_61_90`, `OVERDUE_91_120`, `OVERDUE_ABOVE_120`, `NO_DUE_DATE` | Days from `dueDate` to `reportDate`; null due date → `NO_DUE_DATE` |
| `document_age` | `AGE_0_30`, `AGE_31_60`, `AGE_61_90`, `AGE_91_120`, `AGE_ABOVE_120` | Days from `postingDate` to `reportDate` |

Per-row DTOs also carry `dueDateBucket`, `documentAgeBucket`, `daysOverdue`, and `daysOutstanding`.

Validation: `reportDate` / `asOfDate` cannot be in the future (`PAYABLE_REPORT_DATE_IN_FUTURE` → 422).

---

## Vendor summary — `netPayableBase`

Vendor list/detail aggregates:

```text
creditOutstandingBase = Σ baseOutstandingAmount for CREDIT open items (invoices + credit adjustments)
debitOutstandingBase  = Σ baseOutstandingAmount for DEBIT open items (payments + advances + debit notes)
netPayableBase        = creditOutstandingBase − debitOutstandingBase
```

Multi-currency rows keep per-currency breakdown; net and bucket totals use base currency.

---

## Payment planning (read-only)

`GET /payment-planning?legalEntityId=&horizonDays=7|14|30&asOfDate=`

- Selects CREDIT open items with `dueDate` between `asOfDate` and `asOfDate + horizonDays`.
- Groups by vendor, then by due date (null due dates in a separate group).
- Returns horizon metadata, totals, and item rows with outstanding amounts — **no payment creation**,
  no allocation suggestions, no GL.

---

## Frontend (Money Out)

Routes under `/accounting/money-out/`:

| Page | API |
|------|-----|
| `OutstandingPage` | `/payables/outstanding` |
| `AgeingPage` | `/payables/ageing` |
| `VendorListPage` / `VendorDetailPage` | `/payables/vendors` |
| `PaymentPlanningPage` | `/payables/payment-planning` |
| `MoneyOutOverviewPage` / `PayablesPage` | `/payables/overview` (+ outstanding where needed) |

Workspace tabs: Outstanding, Vendors, Ageing, Payment Planning are **live**. Reconciliation tab remains
**preview-only** until 4D2.

Verify: `cd frontend && npm run test:money-out-reporting` (static wiring checks).

---

## Backend tests

| File | Cases | Notes |
|------|-------|-------|
| `tests/finance/finance-ap-reporting.test.ts` | 9 | Live MySQL; run with `--no-file-parallelism` |

Coverage: CREDIT outstanding vs draft exclusion; due-date + document-age buckets; future reportDate
rejection; multi-currency breakdown; vendor `netPayableBase`; payment-planning horizon; read-only
(no audit / no open-item mutation); 403 without `finance.ap.view`; tenant isolation.

---

## Explicitly deferred

| Phase | Scope |
|-------|-------|
| **4D2** | AP subledger ↔ GL reconciliation (`/payables/reconciliation` — mirror AR Phase 3A5) |
| **Bank recon** | Bank statement matching — separate deferred module |

No reconciliation endpoint exists in 4D1. Money Out reconciliation UI stays preview/stub.
