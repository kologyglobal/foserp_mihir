# Packing Session Rules (Phase 7C3)

## Creation gates

Create only when:

- Outbound Dispatch exists and is not cancelled / not confirmed
- Pick List exists and is `PICKED` (or authorised partial policy)
- Net picked quantity > 0
- Same tenant for Dispatch, Pick Lists, Warehouse
- No incompatible active Packing Session for the same Dispatch + Warehouse
- Quality / source version still valid

One session per warehouse when multi-warehouse picking applies.

## Lifecycle

```
DRAFT → READY → IN_PROGRESS → PARTIALLY_PACKED → PACKED → VERIFIED
                                              ↘ BLOCKED / CANCELLED
```

| Status | Meaning |
|--------|---------|
| DRAFT / READY | Structure may exist; packing not started |
| IN_PROGRESS | Pack / unpack / move allowed |
| PARTIALLY_PACKED | Some picked qty still unpacked |
| PACKED | Required picked qty packed or authorised excluded |
| VERIFIED | Authorised verifier confirmed reconciliation |
| BLOCKED | Unresolved shortage or policy block |
| CANCELLED | Allocations unpacked/cancelled; history preserved |

## Completion

Requires: line reconciliation, no unresolved shortage, no negative package qty, tracking OK, Dispatch still active.

Pilot default: all net picked qty for the current Dispatch must be packed before completion.

## Cancellation

Allowed only when Dispatch not posted, no Delivery Challan (7C4+), allocations unpacked/cancelled, permission + reason.

Does **not** delete packages, lines, or events.
