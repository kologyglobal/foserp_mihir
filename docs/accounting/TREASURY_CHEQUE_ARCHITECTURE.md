# Treasury Cheque Architecture (Phase 5B2)

> Last verified: **2026-07-20** against `backend/src/modules/accounting/treasury/cheques/`.

Related: [`TREASURY_CHEQUE_WORKFLOW.md`](TREASURY_CHEQUE_WORKFLOW.md) · [`TREASURY_CHEQUE_ACCOUNTING.md`](TREASURY_CHEQUE_ACCOUNTING.md) · [`TREASURY_TRANSFER_ARCHITECTURE.md`](TREASURY_TRANSFER_ARCHITECTURE.md) · [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md)

## Principle

`TreasuryCheque` registers the **physical instrument lifecycle** of a cheque — issued to a vendor/party or received from a customer — drawn on or deposited to a `BANK`-type `TreasuryAccount`:

```text
ISSUED   (company writes a cheque to a payee): DRAFT → READY → ISSUED → CLEARED | BOUNCED | STOPPED | REVERSED
RECEIVED (company receives a cheque from a drawer): DRAFT → READY → DEPOSITED → CLEARED | BOUNCED | REVERSED
```

Only `BANK` treasury accounts are valid — cheques cannot be drawn on/deposited to CASH or CLEARING accounts.

## Accounting modes

| Mode | Behavior |
|------|----------|
| `POST_ON_LIFECYCLE` (default) | Issue/deposit posts one balanced voucher (Dr/Cr bank vs. counterpart). Bounce/stop/reverse reverse that voucher. |
| `TRACK_ONLY` | No GL postings at all — status-only lifecycle. Forced automatically when `customerReceiptId` (RECEIVED) or `vendorPaymentId` (ISSUED) is set, since the accounting already happened via the linked receipt/payment. |

## Scope rules

- Same legal entity only, `BANK` treasury account only
- No MT940/CAMT import, bank APIs, FX/multi-currency conversion beyond a flat `exchangeRate`, or intercompany
- No print/cheque-stub files
- Counterpart is a GL account (not a `TreasuryAccount`) — resolved explicitly or via a default mapping

## Numbers

| Field | When assigned |
|-------|----------------|
| Draft reference `CHQ-DRAFT-…` | Create draft (no series) |
| Register number `CHQ/…` | First lifecycle posting action (issue for ISSUED, deposit for RECEIVED) — via the `TREASURY_CHEQUE` `FinanceNumberSeries`, even for `TRACK_ONLY` cheques (reserved directly, bypassing the posting engine) |
| Voucher numbers | Central posting (`SYSTEM` → JOURNAL series), `POST_ON_LIFECYCLE` only |

## Counterpart resolution

1. Explicit `counterpartGlAccountId` on the request (validated against the legal entity, must be a non-group active account)
2. Else `DefaultAccountMapping` key `CHEQUE_RECEIPT_CLEARING` (RECEIVED) / `CHEQUE_PAYMENT_CLEARING` (ISSUED)
3. Else unresolved — blocks issue/deposit if `FinanceSettings.treasuryChequeRequireCounterpartAccount` is true (default), otherwise only a warning (draft can still be saved, but issue/deposit remain blocked until resolved)

## Uniqueness

A soft uniqueness key (`tenantId:legalEntityId:direction:chequeNumber:chequeDate`, normalized/uppercased) blocks creating a second *active* draft/cheque with the same combination (`TREASURY_CHEQUE_DUPLICATE`, HTTP 409). The key is freed (set to `null`) on `CANCELLED` and `REVERSED` so the same physical cheque number can be re-registered later. It is **not** freed on `REJECTED` (the same draft can be revised and resubmitted) or `STOPPED` (the physical number is consumed).

## Explicitly out of scope

Bank MT940/CAMT import · bank APIs · cheque print/stub files · FX revaluation · intercompany · multi-leg/dispatch-receive flows (single voucher only, unlike Phase 5B1 in-transit transfers).
