# Bank Statement Import Architecture (Phase 5A2 + MT940/CAMT family)

**Status:** Phase 5A2 complete. Matching / reconciliation = Phase 5A3 (shipped). Structured file ingest (MT940 / CAMT.052 / CAMT.053 / CAMT.054) shipped on the same import pipeline.

## Principle

```text
Statement import records external bank activity.
It does not record accounting activity.
```

Import/validation may create: `BankStatementImportBatch`, `BankStatement`, `BankStatementLine`, `BankStatementImportIssue`, mapping templates, `AuditLog`, file metadata.

Must **not** create/modify: vouchers, GL entries, `PostingEvent`, receipts, payments, open items, number series, periods.

## Supported formats

| Format | Operational | Column mapping | Document type |
|--------|-------------|----------------|---------------|
| CSV | Yes | Required | End-of-day |
| XLSX | Yes | Required | End-of-day |
| MT940 | Yes | Native normaliser | End-of-day |
| CAMT_053 | Yes | Native normaliser | End-of-day (canonical) |
| CAMT_052 | Yes | Native normaliser | Intraday report (**provisional**) |
| CAMT_054 | Yes | Native normaliser | Debit/credit notification (**provisional**) |
| AUTO_DETECT | Yes | Resolves on upload | — |
| MANUAL | Yes | N/A | End-of-day |
| BANK_API / PDF | Enum reserved — connector uses BANK_API source | — |

### AUTO_DETECT

1. Extension hints: `.xlsx` → XLSX; `.xml` → sniff CAMT family (052/053/054); `.sta` / `.mt940` → MT940; `.csv` → CSV; `.txt` → sniff.
2. Content sniff: MT940 (`:20:` + `:61:` / `:60F:`); CAMT namespace/root (`BkToCstmrStmt` / `BkToCstmrAcctRpt` / `BkToCstmrDbtCdtNtfctn`). Unknown CAMT families are rejected.
3. Explicit CAMT format must match the detected root.
4. Batch stores the **resolved** format (never leaves `AUTO_DETECT` on the row).

### Provisional CAMT.052 / .054

- Stored in the same `BankStatement` / `BankStatementLine` tables (`documentType`, `isProvisional`, `hasOpeningBalance` / `hasClosingBalance`).
- Missing balances store `0` with `has*Balance=false`; UI shows **N/A**; validation skips balance continuity.
- Later CAMT.053 lines with the same line hash **supersede** unmatched provisional lines (`EXCLUDED` + `supersededByLineId`).
- If the provisional line already has an active reconciliation match, import raises a blocker requiring unmatch/manual resolution.
- Excluded/superseded lines are omitted from reconciliation candidates and readiness totals.

### Structured path

```text
Upload MT940/CAMT → Inspect (sample lines, no headers) → Preview (native lines) → Import
```

Parsers emit `NormalisedStatementHeader` + `NormalisedStatementLine[]` into the existing preview / import / validate / recon pipeline. Shared helpers live in `bank-statement-camt-common.ts`.

## Flow (CSV/XLSX)

```text
Select BANK TreasuryAccount
  → Upload CSV/XLSX (or create manual)
  → Inspect (sheet/header/delimiter)
  → Map columns
  → Preview (backend parse)
  → Confirm import (reparse stored file)
  → Review / edit
  → Validate → VALIDATED
```

## File security

- Extension + MIME + signature checks (incl. `.sta`, `.mt940`, `.txt`, `.xml`)
- Size / row / column limits (sync processing; no workers)
- Reject XLSM, macros, password-protected, zip-bomb heuristics
- **CAMT:** reject `<!DOCTYPE` / `<!ENTITY` / custom entities; nesting depth cap (XXE / entity-expansion protection)
- Formula cells: cached value only + warning — never evaluate
- SHA-256 checksum for duplicate-file detection
- Storage via `saveTreasuryStatementFile` — paths never returned by API

## Explicitly deferred (next phase names)

| Deferred | Why | Suggested next phase |
|----------|-----|----------------------|
| **Live TPP AIS download** | Needs production Open Banking TPP registration | Treasury **Live AIS** |
| Async import workers / huge files | Sync processing only today | Import scale-out |
| PDF statements | Not in scope for structured parsers | Later |

| **FX / cross-currency treasury transfers** | No FX rate table posting on statement import or transfers | Treasury **FX Phase** (post-5C) |
| **Intercompany dual-LE transfers** | Cross-entity cash moves need dual posting | Treasury **Intercompany Phase** |
| CAMT.052 / CAMT.054 | Intraday / debit-credit notification — not statement | With 5D1 if needed |
| Payment file generation (pain.001) | Outbound payment initiation | Payment execution phase |

## APIs

Mounted under `/api/v1/t/:tenantSlug/accounting/treasury`:

- `/bank-statements/import-batches` (+ inspect, preview, import, retry, cancel, file)
- `/bank-statement-mapping-templates` (CSV/XLSX only)
- `/bank-statements` (+ manual, validate, reopen-draft, cancel, lines)

## Permissions

`finance.treasury.statement.view|import|manual_entry|edit|validate|cancel|mapping.view|mapping.manage|file.download`
