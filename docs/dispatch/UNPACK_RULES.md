# Unpack Rules (Phase 7C3)

## Purpose

Return packed quantity to **picked-but-unpacked** before Delivery Challan (7C4) or posting (7C5).

## Requirements

- Reason required
- Package / session must allow mutation (not verified unless reopened)
- Quantity ≤ net packed on the line / serial

## Effects

| Action | Result |
|--------|--------|
| Create `UNPACK` event | Append-only; original `PACK` remains |
| Net packed ↓ | Session / package totals updated |
| Reservation | Remains ACTIVE |
| Pick events | Unchanged |
| Inventory on-hand | Unchanged |
| SO fulfilment | Unchanged |

## Explicit non-cascade

To return goods to the Store reservation pool:

```
Unpack → Unpick → Release reservation
```

Do not combine these silently.
