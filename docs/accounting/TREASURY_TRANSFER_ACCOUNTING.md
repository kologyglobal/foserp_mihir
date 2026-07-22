# Treasury Transfer Accounting (Phase 5B1)

All posting uses the central `post()` engine. Voucher type = `SYSTEM`. Source document = `TREASURY_TRANSFER`.

## Direct

```text
Dr Destination Treasury GL
    Cr Source Treasury GL
```

Event: `TREASURY_TRANSFER_DIRECT_POST:{transferId}:V1`

## In-transit dispatch

```text
Dr Internal Transfer Clearing
    Cr Source Treasury GL
```

Event: `TREASURY_TRANSFER_DISPATCH:{transferId}:V1` → status `IN_TRANSIT`

## In-transit receipt

```text
Dr Destination Treasury GL
    Cr Internal Transfer Clearing
```

Event: `TREASURY_TRANSFER_RECEIVE:{transferId}:V1` → status `COMPLETED`

Invariant: clearing debit = clearing credit (transaction + base). Mismatch rolls back (`TREASURY_TRANSFER_CLEARING_BALANCE_MISMATCH`).

## Reversal

Exact inverse of original voucher lines (do not recalculate from current mappings).

| Case | Order |
|------|--------|
| Direct COMPLETED | Reverse single voucher |
| IN_TRANSIT (not received) | Reverse dispatch only |
| COMPLETED IN_TRANSIT | Reverse receipt, then dispatch |

Events: `…_DIRECT_REVERSE` / `…_DISPATCH_REVERSE` / `…_RECEIVE_REVERSE` with `:V1` keys.

## No P&L

Only treasury GL accounts and internal transfer clearing may move.
