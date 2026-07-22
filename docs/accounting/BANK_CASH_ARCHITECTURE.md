# Bank & Cash — Architecture (Phase 5A1)

> Last verified: **2026-07-19** against `backend/prisma/schema.prisma`, `backend/src/modules/accounting/treasury/`, and `backend/tests/finance/finance-treasury-foundation.test.ts`.
> Phase **5A1** is the treasury **database + master-data foundation** only: account master, GL mapping, payment-account routing, reconciliation settings, and a bank-statement DB foundation with internal-only validation/identity helpers.
> Still deferred: statement import (file parsing), matching, reconciliation execution/posting, cheque lifecycle, inter-account transfers, and any operational frontend (Phase 5A2+).

Account master: [`TREASURY_ACCOUNT_MASTER.md`](TREASURY_ACCOUNT_MASTER.md). Payment routing: [`PAYMENT_ACCOUNT_MAPPING.md`](PAYMENT_ACCOUNT_MAPPING.md). Reconciliation settings: [`BANK_RECONCILIATION_FOUNDATION.md`](BANK_RECONCILIATION_FOUNDATION.md). Statement schema: [`BANK_STATEMENT_SCHEMA.md`](BANK_STATEMENT_SCHEMA.md). Status: [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md).

---

## Scope and design intent

Bank & Cash (Treasury) is the master-data layer that AP/AR payment posting will eventually route through. Phase 5A1 intentionally ships **setup APIs only** — nothing here mutates `AccountingVoucher`, `GeneralLedgerEntry`, `PostingEvent`, `VendorPayment`, or `CustomerReceipt`. Those integrations (payment posting reading a resolved treasury/mapping account, statement import/match/reconcile) are deferred to later phases.

```text
Account (GL, existing)  ◄──── glAccountId ──── TreasuryAccount (BANK | CASH | CLEARING)
                                                     ├── TreasuryBankProfile   (BANK only, 1:1)
                                                     ├── TreasuryCashProfile   (CASH only, 1:1)
                                                     ├── BankReconciliationProfile (BANK only, 1:1)
                                                     ├── PaymentAccountMapping[]   (routes payment method + use case → account)
                                                     └── BankStatementImportBatch[] → BankStatement[] → BankStatementLine[]
```

## Why a separate `TreasuryAccount` master (not just `Account`)

`Account` (chart of accounts) already has `accountType = BANK | CASH`. `TreasuryAccount` is a **thin operational master** layered on top of one GL account, carrying data that does not belong on the ledger account itself:

- Bank-specific identity (IFSC/SWIFT/MICR, masked account number, overdraft limit, UPI VPA) or cash-specific custodian/imprest data.
- Lifecycle independent of the GL account's own active/inactive flag (`ACTIVE → INACTIVE → CLOSED`, one-way once closed).
- A single place payment routing (`PaymentAccountMapping`) and reconciliation settings (`BankReconciliationProfile`) attach to, regardless of GL chart-of-accounts restructuring.

One GL account maps to **at most one `ACTIVE` `TreasuryAccount`** at a time — enforced in the service layer (`treasury-account.service.ts`), not a DB constraint, because `INACTIVE`/`CLOSED` rows are allowed to keep referencing the same GL account for history.

## Never store plaintext bank account numbers

`TreasuryBankProfile.accountNumber` does not exist as a column. Instead:

| Field | Contents | Returned by API? |
|-------|----------|-------------------|
| `accountNumberLast4` | Last 4 digits | Yes |
| `accountNumberMasked` | Display mask, e.g. `XXXXXXXX6789` | Yes |
| `accountNumberHash` | HMAC-SHA256 (duplicate detection) | **Never** |
| `accountNumberEncrypted` | AES-256-GCM ciphertext (optional, only if `FIELD_ENCRYPTION_KEY` set) | **Never** |

See [`TREASURY_ACCOUNT_MASTER.md`](TREASURY_ACCOUNT_MASTER.md) for the full security model (`treasury-account-security.service.ts`).

## Module layout

```text
backend/src/modules/accounting/treasury/
├── treasury.errors.ts                       # all treasury/mapping/recon/statement errors
├── treasury.routes.ts                       # mounts /treasury/accounts, /treasury/payment-account-mappings
├── treasury-account-security.service.ts     # HMAC hash + AES-256-GCM + masking + redaction
├── accounts/                                # TreasuryAccount CRUD + lifecycle
├── payment-mappings/                        # PaymentAccountMapping CRUD + resolve service
├── reconciliation/                          # BankReconciliationProfile GET/PUT (bank-only)
└── statements/                              # internal-only: validation + identity + repository (NO routes)
```

Mounted under `accounting.routes.ts` as `/treasury` → full path `/api/v1/t/:tenantSlug/accounting/treasury/...`.

## What is explicitly NOT in Phase 5A1

- No statement import (file upload/parsing), matching, or reconciliation-execution HTTP routes. `backend/src/modules/accounting/treasury/statements/` has no controller or routes file — it is exercised only by tests and will grow a public surface in a later phase.
- No write path from AP/AR payment posting to `TreasuryAccount` or `PaymentAccountMapping`. `CustomerReceipt.treasuryAccountId` and `VendorPayment.treasuryAccountId` exist as nullable, FK-less columns (added in this migration) purely so a future phase can start populating them without another migration; nothing sets them yet.
- No cheque lifecycle, inter-account transfer documents, or bank charge/interest automation.
- No operational frontend pages. This is backend-only.

## Tests

`backend/tests/finance/finance-treasury-foundation.test.ts` (live MySQL) — see [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md) for current pass count and coverage list.
