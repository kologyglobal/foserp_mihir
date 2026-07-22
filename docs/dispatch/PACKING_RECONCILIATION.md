# Packing Reconciliation (Phase 7C3)

Server-derived via `DispatchPackingReconciliationService`. Do not trust frontend maths.

## Per Dispatch line

| Field | Source |
|-------|--------|
| Requested | OutboundDispatchLine qty |
| Reserved | Active InventoryStockReservation |
| Net picked | Σ PICK − Σ UNPICK |
| Packed | Σ PACK − Σ UNPACK (± MOVE net) |
| Unpacked (picked but not packed) | Net picked − packed − shortage under investigation − excluded |
| Shortage | Open packing shortage qty |
| Excluded | Authorised excluded qty |
| Difference | Any imbalance |
| Tracking | Lot/serial/heat packed vs picked |

## Required identity

```
Net Picked = Net Packed + Picked-but-Unpacked + Packing Shortage (open) + Authorised Excluded
```

For completed session (pilot): Net Packed = Current Dispatch quantity (per line).

## Statuses

`NOT_STARTED` | `IN_PROGRESS` | `RECONCILED` | `SHORT` | `DIFFERENCE` | `BLOCKED`

## 7C0 confirm gate

`assertPackingAllowsConfirm`: if any non-cancelled packing session exists, each must be `PACKED`/`VERIFIED` and net packed must equal each dispatch line qty.
