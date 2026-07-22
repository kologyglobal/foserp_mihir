# Packing → Delivery Challan Reconciliation

**Service:** `DeliveryChallanReconciliationService`

## Per Dispatch line outputs

- Requested Dispatch qty
- Net reserved qty
- Net picked qty
- Net packed qty
- Challan Draft qty
- Previously issued active Challan qty
- Qty pending Challan
- Package qty / tracked qty
- Difference, status, blockers, warnings

## Statuses

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | No challan work yet |
| `IN_PROGRESS` | Draft in progress |
| `RECONCILED` | Safe to submit/issue |
| `QUANTITY_DIFFERENCE` | Challan vs packed mismatch |
| `PACKAGE_DIFFERENCE` | Package set mismatch |
| `TRACKING_DIFFERENCE` | Lot/serial/heat mismatch |
| `BLOCKED` | Hard blocker (stale packing, unverified package, shortage, etc.) |

## Issue gate

Issue requires status **`RECONCILED`**.

```
Active Challan Quantity ≤ Net Reconciled Packed Quantity
Pilot (one active challan / dispatch): Challan Quantity = Net Packed Quantity
```

## Example blockers

- Packed quantity changed after Challan preparation
- Package reopened / unverified
- Serial in more than one package
- Challan quantity exceeds packed quantity
- Unresolved packing shortage
- Another active Challan already exists for this Dispatch
