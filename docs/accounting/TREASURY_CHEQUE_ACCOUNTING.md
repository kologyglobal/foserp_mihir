# Treasury Cheque Accounting (Phase 5B2)

All posting uses the central `post()` engine. Voucher type = `SYSTEM` (`REVERSAL` for reversals). Source document = `TREASURY_CHEQUE`. `TRACK_ONLY` cheques never call `post()`.

## Issue (ISSUED direction)

```text
Dr Counterpart GL account (vendor/payable clearing)
    Cr Bank Treasury GL
```

Event: `TREASURY_CHEQUE_ISSUE:{chequeId}:V1` → status `ISSUED`, reserves `CHQ/…` register number.

## Deposit (RECEIVED direction)

```text
Dr Bank Treasury GL
    Cr Counterpart GL account (customer/receivable clearing)
```

Event: `TREASURY_CHEQUE_DEPOSIT:{chequeId}:V1` → status `DEPOSITED`, reserves `CHQ/…` register number.

## Clear

Status-only (`ISSUED`/`DEPOSITED` → `CLEARED`) — no GL impact. The GL entry was already posted at issue/deposit time; clearing is bank confirmation, not a new accounting event.

## Bounce / Stop / Reverse — reversal accounting

Exact inverse of the original issue/deposit voucher's lines (debit ⇄ credit swapped from the *original* lines, not recalculated from current mappings):

| Action | From status | Event key |
|--------|-------------|-----------|
| Bounce | `ISSUED` / `DEPOSITED` | `TREASURY_CHEQUE_BOUNCE_REVERSE:{chequeId}:V1` |
| Stop (already issued) | `ISSUED` | `TREASURY_CHEQUE_STOP_REVERSE:{chequeId}:V1` |
| Reverse | `ISSUED` / `DEPOSITED` / `CLEARED` | `TREASURY_CHEQUE_REVERSE:{chequeId}:V1` |

`TRACK_ONLY` cheques skip the reversal voucher entirely (status-only bounce/stop; `reverse` is disallowed — the linked receipt/payment must be reversed instead).

## Counterpart GL account

Not a `TreasuryAccount` — a plain GL `Account`, resolved explicitly or via `DefaultAccountMapping` (`CHEQUE_RECEIPT_CLEARING` / `CHEQUE_PAYMENT_CLEARING`). See [`TREASURY_CHEQUE_ARCHITECTURE.md`](TREASURY_CHEQUE_ARCHITECTURE.md#counterpart-resolution).

## No P&L

Only the bank treasury GL account and the resolved counterpart GL account move — cheque posting itself never touches revenue/expense accounts.
