# Delivery Challan Cancellation

## When allowed (Phase 7C4)

| Status | Cancel? |
|--------|---------|
| Draft / Ready / Approved | Yes (permission + reason) |
| Issued | Yes **only before** final Dispatch posting |
| After Dispatch CONFIRMED | Blocked — Phase 7C5 correction/reversal |

## Effects

- Status → `CANCELLED`
- Number and document retained for history
- Activity recorded (who / when / reason)

## Non-effects (must not happen)

- Unpack goods
- Unpick goods
- Release reservations
- Cancel the Dispatch
- Inventory movement
- SO fulfilment change

Those remain separate controlled actions in packing / picking / 7C5.
