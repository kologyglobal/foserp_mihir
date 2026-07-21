# Bank Statement — Database Foundation (Phase 5A1)

> Last verified: **2026-07-19** against `backend/prisma/schema.prisma` and `backend/src/modules/accounting/treasury/statements/`.

Overview: [`BANK_CASH_ARCHITECTURE.md`](BANK_CASH_ARCHITECTURE.md).

## No public API in this phase

**There is no controller or route file under `treasury/statements/`.** This phase ships the DB schema plus two internal-only helper services and a repository, all consumed directly by tests (`finance-treasury-foundation.test.ts`) and intended for reuse by the future import/match/reconcile phase. Do not add a public route here without a separate approval — the parent task explicitly excludes statement import/match/reconcile APIs from 5A1.

## Schema

```text
BankStatementImportBatch  (one row per upload/manual-entry attempt)
        │ 1:N
        ▼
   BankStatement           (one bank statement document: period + opening/closing balance)
        │ 1:N
        ▼
   BankStatementLine        (one transaction line)
```

- `BankStatementImportBatch` tracks `status` (`UPLOADED → PROCESSING → IMPORTED/PARTIALLY_IMPORTED/FAILED/CANCELLED`), file metadata, and per-batch counters (`totalLineCount`, `importedLineCount`, `failedLineCount`, `duplicateLineCount`) — all zero/unset until the import-processing phase exists.
- `BankStatement.statementUniquenessKey` (`@unique`) is the dedupe key across re-imports of the same statement.
- `BankStatementLine.lineHash` is unique **within a statement** (`@@unique([bankStatementId, lineHash])`) for per-line duplicate detection across re-imports; `matchStatus` defaults to `UNMATCHED` and nothing in this phase advances it.

## Internal helper services

### `bank-statement-validation.service.ts`

- `validateStatementHeader(input)` — checks the balance equation (`opening + credits − debits = closing`, ±0.01 tolerance), that `periodStartDate ≤ periodEndDate`, that `statementDate` falls in a plausible range for the period, and that the statement currency matches the treasury account's currency. Returns `{ valid, errors[] }` rather than throwing, so callers can decide how to surface multiple issues at once.
- `computeLineTotals(lines)` / `validateLineTotalsMatchHeader(...)` — cross-checks the sum of line amounts (by direction) against the statement header totals.

### `bank-statement-identity.service.ts`

- `buildStatementUniquenessKey(...)` — SHA-256 of `tenantId|legalEntityId|treasuryAccountId|reference(upper,trim)|periodStart|periodEnd`. Case/whitespace-insensitive on the reference so `STMT-001` and `stmt-001` collide deliberately.
- `buildStatementLineHash(...)` — SHA-256 of `bankStatementId|lineNumber|date|direction|amount(2dp)|reference(upper)|description(upper)`.

Both return a 64-character hex digest suitable for the `@unique`/`@@unique` columns above.

### `bank-statement.repository.ts`

Thin CRUD (`createImportBatch`, `createStatement`, `createStatementLine`, `markStatementValidated`, `findStatementByUniquenessKey`) — used by tests to exercise the schema + identity helpers together without a real file-parsing pipeline.

## Test cleanup note

`backend/tests/finance/helpers/ap-allocation-fixture.ts#cleanupTenant` deletes treasury rows (lines → statements → batches → mappings → recon profile → bank/cash profile → `TreasuryAccount`) before `Account`/`LegalEntity`/`Tenant`, because `TreasuryAccount` FKs those tables. Any new test helper that creates treasury data for a tenant that is later cleaned up via `cleanupTenant` gets this for free.
