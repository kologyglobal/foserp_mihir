# Bank Statement Import Architecture (Phase 5A2 + MT940/CAMT.053)

**Status:** Phase 5A2 complete. Matching / reconciliation = Phase 5A3 (shipped). Structured file ingest (MT940 / CAMT.053) shipped on the same import pipeline.

## Principle

```text
Statement import records external bank activity.
It does not record accounting activity.
```

Import/validation may create: `BankStatementImportBatch`, `BankStatement`, `BankStatementLine`, `BankStatementImportIssue`, mapping templates, `AuditLog`, file metadata.

Must **not** create/modify: vouchers, GL entries, `PostingEvent`, receipts, payments, open items, number series, periods.

## Supported formats

| Format | Operational | Column mapping |
|--------|-------------|----------------|
| CSV | Yes | Required |
| XLSX | Yes | Required |
| MT940 | Yes | Native normaliser (skip mapping UI) |
| CAMT_053 | Yes | Native normaliser (skip mapping UI) |
| AUTO_DETECT | Yes | Resolves on upload to CSV / XLSX / MT940 / CAMT_053 |
| MANUAL | Yes | N/A (manual entry) |
| BANK_API / PDF | Enum reserved — **not implemented** |

### AUTO_DETECT

1. Extension hints: `.xlsx` → XLSX; `.xml` → CAMT_053; `.sta` / `.mt940` → MT940; `.csv` → CSV; `.txt` → sniff.
2. Content sniff: MT940 (`:20:` + `:61:` / `:60F:`); CAMT (`camt.053` / `BkToCstmrStmt`); CSV delimiters; XLSX ZIP magic.
3. Batch stores the **resolved** format (never leaves `AUTO_DETECT` on the row).

### Structured path

```text
Upload MT940/CAMT → Inspect (sample lines, no headers) → Preview (native lines) → Import
```

Parsers emit `NormalisedStatementHeader` + `NormalisedStatementLine[]` into the existing preview / import / validate / recon pipeline.

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
| **Bank APIs / PSD2 / H2H connectors** | No live bank connectivity; file ingest only | Bank & Cash **5D1 — Bank connectors** |
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
