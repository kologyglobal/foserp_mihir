# Accounts Payable — AP-to-GL Reconciliation Architecture (Phase 4D2)

**Status:** AP subledger-to-GL reconciliation + persisted runs + Money Out frontend shipped.

Last verified: **2026-07-19**

---

## Purpose

Compare **vendor payable control-account GL balances** against the **AP open-item subledger** for one legal entity as of a date. Produce a persisted, read-only evidence run with account-level results, optional vendor-level (party) results, and structured exceptions. **Never mutates** GL entries, open items, vouchers, posting events, or accounting periods.

Close-readiness assessment (advisory only) is a separate surface — see [`AP_CLOSE_GATE.md`](AP_CLOSE_GATE.md).

---

## Module layout

```text
backend/src/modules/accounting/payables/reconciliation/
  payable-reconciliation.routes.ts           — HTTP surface (/payables/reconciliation)
  payable-reconciliation.controller.ts
  payable-reconciliation.schemas.ts
  payable-reconciliation.service.ts          — create run (compute + persist)
  payable-reconciliation-read.service.ts     — list/get/export/acknowledge
  payable-reconciliation-balances.service.ts — GL + subledger aggregation
  payable-reconciliation-control-accounts.service.ts
  payable-reconciliation-integrity.service.ts — data-quality checks → exceptions
  payable-reconciliation-vendor.service.ts   — optional party-level recon
  payable-reconciliation-export.service.ts   — CSV export
  payable-close-gate.*                       — close gate (separate doc)
```

Mounted at: `/api/v1/t/:tenantSlug/accounting/payables/reconciliation/*` via `payables.routes.ts`.

Migration: `20260719210000_finance_phase4d2_ap_reconciliation`.

---

## Sign convention (GL vs AP subledger)

Both sides use **liability normal balance** in **base currency**:

| Layer | Formula | Notes |
|-------|---------|-------|
| **GL** | `baseCredit − baseDebit` | `GeneralLedgerEntry` rows on control accounts with `postingDate ≤ asOfDate` |
| **AP subledger** | `CREDIT outstanding − DEBIT outstanding` | Sum of `PayableOpenItem.baseOutstandingAmount` by side |

- **CREDIT open items:** vendor invoices, credit adjustments (amounts owed *to* vendors).
- **DEBIT open items:** vendor payments, advances, debit notes (amounts paid / recoverable).

**Variance** = `GL balance − subledger balance`. A control account **matches** when `|variance| ≤ tolerance`.

This mirrors AR reconciliation (Phase 3A5) but with AP polarity: AR uses debit-side receivables; AP uses credit-side payables with the same `Cr−Dr` GL formula.

---

## Base currency

All comparison amounts are in the legal entity's **base currency** (`FinanceSettings.baseCurrency`, default `INR`):

- GL: `baseCreditAmount` / `baseDebitAmount`
- Subledger: `baseOutstandingAmount` (and historical reconstruction uses base fields)

Transaction currency is not compared at the control-account level in this phase.

---

## CURRENT vs HISTORICAL source modes

| Mode | When | Subledger source |
|------|------|------------------|
| `CURRENT_BALANCE` | `asOfDate` = today (tenant timezone) | Live `PayableOpenItem.baseOutstandingAmount` grouped by control account |
| `HISTORICAL_RECONSTRUCTION` | `asOfDate` in the past | Reconstruct open items as of date from posting/allocation/reversal facts, then aggregate |

**Historical limitations** (returned in run `limitations[]`):

1. `HISTORICAL_RECONSTRUCTION_EXCLUDES_DATED_ADJUSTMENTS_AND_WRITE_OFFS` — `adjustedAmount` / `writtenOffAmount` are not date-tracked; historical balances use original minus allocations that existed as of `asOfDate` only.
2. `HISTORICAL_RECONSTRUCTION_USES_DOCUMENT_REVERSAL_DATE` — an open item is excluded once its source document's `reversalDate ≤ asOfDate`.

Future `asOfDate` values are rejected (`422`).

---

## Control accounts

Resolved from three sources (union, deduplicated) — see [`AP_CONTROL_ACCOUNT_RULES.md`](AP_CONTROL_ACCOUNT_RULES.md):

1. Leaf accounts with `accountType = VENDOR_PAYABLE`
2. `DefaultAccountMapping(VENDOR_PAYABLE)` target
3. Any account referenced by `PayableOpenItem.vendorPayableAccountId`

Misconfiguration (missing mapping, group account, inactive mapping, untyped account in use) becomes **exceptions**, not silent omission.

---

## Persisted runs (no mutations)

Each `POST /reconciliation/runs` creates immutable evidence in dedicated tables only:

| Table | Content |
|-------|---------|
| `payable_reconciliation_runs` | Run header: status, totals, counts, tolerance, limitations |
| `payable_reconciliation_account_results` | Per control account: GL, subledger, variance, matched |
| `payable_reconciliation_exceptions` | Structured issues (see [`AP_RECONCILIATION_EXCEPTIONS.md`](AP_RECONCILIATION_EXCEPTIONS.md)) |

**Never written by this module:** `general_ledger_entries`, `payable_open_items`, `accounting_vouchers`, `posting_events`, `accounting_periods`.

Run outcome `status`:

| Value | Meaning |
|-------|---------|
| `MATCHED` | All control accounts within tolerance; no ERROR/BLOCKER exceptions |
| `MATCHED_WITH_WARNINGS` | Matched balances but INFO/WARNING exceptions present |
| `MISMATCHED` | Account variance beyond tolerance and/or ERROR/BLOCKER exceptions |
| `FAILED` | Run computation error (`runStatus = FAILED`) |

---

## Tolerance

Default: `FinanceSettings.apReconciliationTolerance` → fallback `roundingTolerance` → `0.0100`.

Optional per-run override: `toleranceOverride` on create body.

---

## Freshness (`isStale`)

When reading a completed run, `isStale: true` if any of the following occurred **after** `completedAt`:

- `PayableOpenItem.updatedAt` change (posting, settlement, hold/dispute, reversal)
- New `PayableAllocationBatch`
- New `PayableAllocationReversalBatch`

Fresh runs return `isStale: false`. Close gate should prefer a fresh reconciliation for the period end date.

---

## Branch diagnostic note

Reconciliation operates at **legal-entity scope**, not per branch:

- Open items and source documents carry optional `branchId` for operational/ allocation rules.
- GL and subledger aggregation **do not filter by branch** — all control-account activity for the legal entity is included.
- The `BRANCH` exception category is reserved in the schema for future branch-scoped diagnostics; **no branch exceptions are raised in 4D2**.
- Cross-branch allocation within a legal entity is allowed by default (`FinanceSettings` has no same-branch flag); branch mismatches are enforced only at allocation time, not during reconciliation.

For branch-level AP evidence, use operational reporting (4D1) filtered by branch until a future phase adds branch recon.

---

## HTTP surface

Base: `/api/v1/t/:tenantSlug/accounting/payables/reconciliation`

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST | `/runs` | `finance.ap.reconciliation.run` | Compute + persist a reconciliation run |
| GET | `/runs` | `finance.ap.reconciliation.view` | Paginated run history (`legalEntityId` required) |
| GET | `/runs/:id` | `finance.ap.reconciliation.view` | Run detail + `isStale` |
| GET | `/runs/:id/accounts` | `finance.ap.reconciliation.view` | Account-level results |
| GET | `/runs/:id/vendors` | `finance.ap.reconciliation.view` | Vendor-level results (when `includeVendorLevel`) |
| GET | `/runs/:id/exceptions` | `finance.ap.reconciliation.exception.view` | Paginated exceptions |
| GET | `/runs/:id/export` | `finance.ap.reconciliation.export` | CSV download |
| GET | `/exceptions/:id` | `finance.ap.reconciliation.exception.view` | Exception detail |
| POST | `/exceptions/:id/acknowledge` | `finance.ap.reconciliation.exception.acknowledge` | Acknowledge INFO/WARNING only |

Create body: `{ legalEntityId, asOfDate?, includeVendorLevel?, toleranceOverride? }`.

All routes: `authenticate` → tenant resolve → permission gate. Tenant isolation on every query.

---

## Frontend (Money Out)

Routes under `/accounting/money-out/reconciliation/*` and overview cards on Money Out dashboard. Reconciliation tab is **live** (not preview). Static verify: `npm run test:money-out-reconciliation`.

---

## Tests

| File | Cases | Scope |
|------|-------|-------|
| `finance-ap-gl-reconciliation.test.ts` | 9 | MATCHED after invoice+payment; allocation neutrality; no mutation invariant; orphan BLOCKER; tolerance; permissions; tenant isolation |
| `finance-ap-close-gate.test.ts` | 4 | PASS/BLOCKED; never mutates period; permissions |

Backend: `npx tsc --noEmit`. Live MySQL vitest with `--no-file-parallelism` recommended.

---

## Related docs

- [`AP_CLOSE_GATE.md`](AP_CLOSE_GATE.md) — period close-readiness (advisory)
- [`AP_RECONCILIATION_EXCEPTIONS.md`](AP_RECONCILIATION_EXCEPTIONS.md) — severities, categories, acknowledgement
- [`AP_CONTROL_ACCOUNT_RULES.md`](AP_CONTROL_ACCOUNT_RULES.md) — control account resolution
- [`AP_REPORTING_ARCHITECTURE.md`](AP_REPORTING_ARCHITECTURE.md) — operational AP reporting (4D1)
