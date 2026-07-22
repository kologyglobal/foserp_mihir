# Bank Reconciliation Architecture (Phase 5A3)

> Last verified: **2026-07-20** against `backend/src/modules/accounting/treasury/bank-reconciliation/` and `frontend/src/modules/accounting/treasury/bank-reconciliation/`.

Related: [`BANK_MATCHING_RULES.md`](BANK_MATCHING_RULES.md) · [`BANK_CLEARING_SETTLEMENT.md`](BANK_CLEARING_SETTLEMENT.md) · [`BANK_RECONCILIATION_FRONTEND.md`](BANK_RECONCILIATION_FRONTEND.md) · [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md)

## Principle

Bank reconciliation compares **bank-statement movements** (external evidence) against **posted bank or clearing General Ledger movements**. Accounting truth remains:

```text
AccountingVoucher → AccountingVoucherLine → GeneralLedgerEntry ← PostingEvent
```

A match normally creates **no accounting**. Accounting is created only when:

1. A posted business transaction sits in a **CLEARING** account and the statement confirms the bank movement (clearing settlement via the central posting engine), or
2. A statement-only item requires a **draft journal** (bank charge, interest, etc.) that later posts through the normal journal workflow.

Imported statement line amounts, directions, dates, references and descriptions are **immutable** after review. Reconciliation state is stored separately (session, matches, allocations).

## Statement direction

| Statement | Meaning | Matching bank GL |
|-----------|---------|------------------|
| `CREDIT` | Money into the bank | Bank GL **DEBIT** |
| `DEBIT` | Money out of the bank | Bank GL **CREDIT** |

Do not confuse statement debit/credit with GL debit/credit.

## Session model

One `BankReconciliationSession` per reviewed statement (`@@unique` on tenant + statement).

Statuses: `OPEN` → `IN_PROGRESS` → `READY_TO_FINALIZE` → `FINALIZED` (or `REOPENED` / `CANCELLED`).

Do **not** use `POSTED` as a reconciliation status.

## Match architecture (many-to-many)

```text
BankReconciliationMatch
  ├── BankReconciliationStatementAllocation[]  (partial / grouped)
  └── BankReconciliationLedgerAllocation[]     (partial / grouped)
```

Optional read model: `BankLedgerReconciliationPosition` (original / reconciled / unreconciled amounts + version). Updated transactionally with matches. GL entry amounts themselves are never mutated.

## Posting modes

| Mode | When | Accounting |
|------|------|------------|
| `NONE` | Direct bank GL, or journal-created-from-statement after journal posts | No voucher from match |
| `CLEARING_SETTLEMENT` | Clearing GL candidates | One settlement voucher via `post()` |

Mixed direct-bank + clearing candidates in one match → `BANK_RECONCILIATION_MIXED_POSTING_MODE_NOT_ALLOWED`.

## Match sources

- `DIRECT_BANK_GL`
- `CLEARING_GL`
- `JOURNAL_CREATED_FROM_STATEMENT`

## Currency

Same-currency only. Mismatch → `BANK_RECONCILIATION_CURRENCY_MISMATCH`. No realised FX.

## APIs

Mounted under `/api/v1/t/:tenantSlug/accounting/treasury/`:

| Area | Paths |
|------|-------|
| List / history / exceptions | `GET /bank-reconciliation`, `/history`, `/exceptions` |
| Workspace | `GET /bank-statements/:id/reconciliation`, `/summary` |
| Auto-match | `POST .../run-auto-match`, suggestions accept/reject |
| Candidates / preview / match | candidates, `POST /bank-reconciliation/preview`, `POST .../matches` |
| Unmatch / finalize / reopen | unmatch, finalize, reopen |
| Adjustment draft | `POST .../lines/:lineId/create-journal-draft` |

## Permissions

Fine-grained `finance.bank.reconciliation.*` (view, run_auto_match, match, group_match, partial_match, unmatch, finalize, finalize_with_exceptions, reopen, exception_manage, clearing_post, adjustment_draft_create). Journal drafts also require `finance.journal.create`.

`allowedActions` are server-authoritative.

## Idempotency & concurrency

Required on match, suggestion accept, unmatch, finalize, reopen. Same key + payload → replay; mismatch → `BANK_RECONCILIATION_IDEMPOTENCY_PAYLOAD_MISMATCH`.

Lock order: session → statement line IDs ascending → GL entry IDs ascending.

## Explicitly out of scope (Phase 5A3)

Cheques, own-bank transfers, MT940/CAMT, bank APIs, payment execution, automatic vendor payment / customer receipt creation, cross-currency / FX, uncontrolled bank journals.
