# Accounts Payable — Close Gate (Phase 4D2)

**Status:** AP close-readiness assessment shipped (backend + Money Out frontend).

Last verified: **2026-07-19**

---

## Advisory only — does NOT close a period

The AP close gate **evaluates readiness evidence** for one accounting period. It:

- Runs (or reuses) an AP-to-GL reconciliation as of the period **end date**
- Executes a fixed checklist derived from reconciliation exceptions and period-scoped document queries
- Persists a `PayableCloseGateRun` + `PayableCloseGateCheck` rows

It **never** updates `AccountingPeriod.status`. Closing or locking a period remains a deliberate, separate Finance action outside this module.

---

## Outcome statuses

| Status | Meaning |
|--------|---------|
| `PASS` | All checks `PASSED` |
| `PASS_WITH_WARNINGS` | No blocked/failed checks; at least one `WARNING` |
| `BLOCKED` | One or more checks `BLOCKED` — AP evidence not ready |
| `FAILED` | Computation error (`CLOSE_GATE_COMPUTATION_ERROR`) |

Frontend must not expose a "Close Period" action from this screen (verified in static tests).

---

## Mandatory checks

Each run produces these checks (plus reconciliation-derived category checks):

| Check code | Name | PASS | WARNING | BLOCKED |
|------------|------|------|---------|---------|
| `RECONCILIATION_RUN_REQUIRED` | AP reconciliation run available | — | — | No run supplied/generated |
| `RECONCILIATION_COMPLETED` | AP reconciliation completed and matched | `MATCHED` | `MATCHED_WITH_WARNINGS` | `MISMATCHED` / incomplete run |
| `CONTROL_ACCOUNTS_VALID` | Control accounts correctly configured | No `CONTROL_ACCOUNT_CONFIGURATION` exceptions | INFO/WARNING in category | ERROR/BLOCKER in category |
| `OPEN_ITEM_BALANCES_VALID` | Open item balances internally consistent | No `OPEN_ITEM` / `SUBLEDGER_BALANCE` issues | WARN/INFO | ERROR/BLOCKER |
| `ALLOCATION_INTEGRITY` | Allocation integrity | No `ALLOCATION` / `ALLOCATION_REVERSAL` blockers | WARN/INFO | ERROR/BLOCKER |
| `REVERSAL_INTEGRITY` | Document reversal links intact | No `DOCUMENT_REVERSAL` blockers | WARN/INFO | ERROR/BLOCKER |
| `GL_POSTING_INTEGRITY` | GL postings on control accounts recognised | No `GENERAL_LEDGER_ENTRY` / `GENERAL_LEDGER_BALANCE` blockers | WARN/INFO | ERROR/BLOCKER |
| `SOURCE_DOCUMENT_INTEGRITY` | Source documents and vouchers linked | No `SOURCE_DOCUMENT` / `ACCOUNTING_VOUCHER` blockers | WARN/INFO | ERROR/BLOCKER |
| `POSTING_EVENTS_HEALTHY` | No failed/stuck posting events | No `POSTING_EVENT` blockers | WARN/INFO | ERROR/BLOCKER |
| `VENDOR_PARTY_RECONCILED` | Vendor-level GL matches subledger | No `VENDOR_PARTY` blockers | WARN/INFO | ERROR/BLOCKER |
| `READY_TO_POST_DOCS_IN_PERIOD` | No unposted docs dated ≤ period end | Zero `READY_TO_POST` invoices/payments/adjustments | — | Any such document exists |
| `OPEN_ITEMS_ATTENTION_NEEDED` | No drafts/pending/holds/advances needing attention | All clear | Drafts, pending approval, holds/disputes, or unallocated advances | — |

Category checks map reconciliation exception severities: **BLOCKER/ERROR → BLOCKED**; **WARNING/INFO → WARNING**; none → **PASSED**.

---

## Freshness

Create body options:

```json
{
  "legalEntityId": "<uuid>",
  "periodId": "<uuid>",
  "runFreshReconciliation": true,
  "reconciliationRunId": "<uuid optional when runFresh=false>",
  "includeVendorLevel": true
}
```

- Default `runFreshReconciliation: true` — triggers a new reconciliation run with `asOfDate = period.endDate`.
- When reusing `reconciliationRunId`, verify `isStale` on that run; stale evidence should trigger a fresh run before relying on close gate for month-end sign-off.
- Close gate tests use an **elapsed** period (`endDate < today`) because future `asOfDate` reconciliation is rejected.

`FinanceSettings.apPostingEventStuckMinutes` (default 30) feeds stuck posting-event detection inside the underlying reconciliation integrity checks.

---

## Permissions

| Action | Permission |
|--------|------------|
| Run close gate | `finance.ap.close_gate.run` |
| View runs / latest | `finance.ap.close_gate.view` |
| Export CSV | `finance.ap.close_gate.export` |

Underlying reconciliation permissions apply when `runFreshReconciliation: true` (`finance.ap.reconciliation.run`).

---

## HTTP surface

Base: `/api/v1/t/:tenantSlug/accounting/payables/close-gate`

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| POST | `/runs` | `finance.ap.close_gate.run` | Execute close gate for a period |
| GET | `/runs` | `finance.ap.close_gate.view` | Paginated history |
| GET | `/latest` | `finance.ap.close_gate.view` | Latest run for `legalEntityId` + `periodId` |
| GET | `/runs/:id` | `finance.ap.close_gate.view` | Run detail + checks |
| GET | `/runs/:id/export` | `finance.ap.close_gate.export` | CSV export |

---

## Frontend

Money Out tab: `/accounting/money-out/close-gate` — period picker, run assessment, check list, export. Uses `listPeriods` for period selection; no period-close mutation.

Static verify: `npm run test:money-out-reconciliation`.

---

## Tests

`finance-ap-close-gate.test.ts` — **4/4** (live MySQL): PASS on matched recon; BLOCKED when READY_TO_POST invoice in period; `AccountingPeriod.status` unchanged; 403 without `finance.ap.close_gate.run`.

---

## Related docs

- [`AP_RECONCILIATION_ARCHITECTURE.md`](AP_RECONCILIATION_ARCHITECTURE.md) — reconciliation engine
- [`AP_RECONCILIATION_EXCEPTIONS.md`](AP_RECONCILIATION_EXCEPTIONS.md) — exception severities feeding checks
