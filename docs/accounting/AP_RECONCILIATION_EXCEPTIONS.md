# Accounts Payable — Reconciliation Exceptions (Phase 4D2)

**Status:** Structured exception model for AP-to-GL reconciliation runs.

Last verified: **2026-07-19**

---

## Overview

Each reconciliation run persists zero or more `PayableReconciliationException` rows. Exceptions are **evidence only** — they do not auto-correct data. Operators review, export, and (for low-severity items) acknowledge exceptions before period close.

Run-level `status` derives from exceptions + balance variance:

- **ERROR** or **BLOCKER** → run `MISMATCHED`
- **WARNING** or **INFO** only (balances matched) → run `MATCHED_WITH_WARNINGS`
- None (balances matched) → run `MATCHED`

---

## Severities

| Severity | Blocks close gate? | Acknowledgeable? | Typical use |
|----------|-------------------|------------------|-------------|
| `INFO` | No (WARNING-level check) | Yes | Informational diagnostics |
| `WARNING` | No (WARNING-level check) | Yes | Configuration gaps, orphan GL, party metadata gaps |
| `ERROR` | Yes (`BLOCKED` check) | **No** | Data inconsistency requiring correction |
| `BLOCKER` | Yes (`BLOCKED` check) | **No** | Critical integrity failure (missing open item, balance equation break) |

Acknowledgement sets `isAcknowledged`, `acknowledgedBy`, `acknowledgedAt`, optional `acknowledgementNote`. **ERROR/BLOCKER** acknowledgement returns `422` (`Only INFO or WARNING exceptions can be acknowledged`).

Acknowledgement does **not** change run `status` — it records operator sign-off on known low-risk findings.

---

## Categories

| Category | Source | Examples |
|----------|--------|----------|
| `CONTROL_ACCOUNT_CONFIGURATION` | Control account resolver | `VENDOR_PAYABLE_MAPPING_MISSING`, `NO_VENDOR_PAYABLE_CONTROL_ACCOUNT`, `OPEN_ITEM_ACCOUNT_NOT_TYPED_VENDOR_PAYABLE` |
| `GENERAL_LEDGER_BALANCE` | Account variance | `CONTROL_ACCOUNT_GL_SUBLEDGER_VARIANCE` |
| `SUBLEDGER_BALANCE` | Subledger aggregation | (reserved for subledger-specific checks) |
| `OPEN_ITEM` | Integrity checks | `OPEN_ITEM_WITHOUT_VOUCHER`, `OPEN_ITEM_BALANCE_EQUATION_MISMATCH` |
| `SOURCE_DOCUMENT` | Integrity checks | `POSTED_INVOICE_WITHOUT_OPEN_ITEM`, `POSTED_PAYMENT_WITHOUT_OPEN_ITEM` |
| `ACCOUNTING_VOUCHER` | Integrity checks | `OPEN_ITEM_ORIGINAL_VS_VOUCHER_GL_MISMATCH` |
| `GENERAL_LEDGER_ENTRY` | Integrity checks | `CONTROL_ACCOUNT_ORPHAN_GL_POSTING` |
| `ALLOCATION` | Integrity checks | `ALLOCATION_LINE_OVER_REVERSED` |
| `ALLOCATION_REVERSAL` | Integrity checks | `ALLOCATION_LINE_STATUS_INCONSISTENT` |
| `DOCUMENT_REVERSAL` | Integrity checks | `REVERSED_DOCUMENT_MISSING_REVERSAL_VOUCHER` |
| `POSTING_EVENT` | Integrity checks | Stuck/failed posting events |
| `VENDOR_PARTY` | Vendor-level recon | `VENDOR_GL_SUBLEDGER_VARIANCE`, `VENDOR_SUBLEDGER_WITHOUT_PARTY_GL` |
| `DATA_INTEGRITY` | Integrity checks | `OPEN_ITEM_NEGATIVE_AMOUNT`, `OPEN_ITEM_SIDE_DOCUMENT_TYPE_MISMATCH` |
| `WORKFLOW` | Integrity checks | `OPEN_ITEM_STATUS_OUTSTANDING_MISMATCH` |
| `CURRENCY` | Reserved | Future FX diagnostics |
| `BRANCH` | Reserved | Future branch-scoped diagnostics (unused in 4D2) |
| `PERIOD_READINESS` | Reserved | Future period-scoped checks |

Each exception carries: `code`, `message`, optional links (`accountId`, `vendorId`, `openItemId`, `voucherId`, `documentType`, `documentId`), and optional `details` JSON.

---

## Acknowledgement rules

| Rule | Detail |
|------|--------|
| **Eligible severities** | `INFO`, `WARNING` only |
| **Permission** | `finance.ap.reconciliation.exception.acknowledge` |
| **Endpoint** | `POST /payables/reconciliation/exceptions/:id/acknowledge` |
| **Body** | `{ note?: string }` (max 500 chars) |
| **Idempotent UX** | Re-acknowledging overwrites prior acknowledgement metadata |
| **Effect on run** | None — run counts and status unchanged |

Close gate category checks still see acknowledged WARNING/INFO exceptions (they contribute to `PASS_WITH_WARNINGS`, not `PASS`).

---

## Query / filter

`GET /runs/:id/exceptions` supports:

- `severity`, `category`, `isAcknowledged`
- Pagination (`page`, `pageSize`)

---

## Export

CSV export includes severity, category, code, message, entity links, and acknowledged flag per row.

---

## Related docs

- [`AP_RECONCILIATION_ARCHITECTURE.md`](AP_RECONCILIATION_ARCHITECTURE.md)
- [`AP_CLOSE_GATE.md`](AP_CLOSE_GATE.md)
