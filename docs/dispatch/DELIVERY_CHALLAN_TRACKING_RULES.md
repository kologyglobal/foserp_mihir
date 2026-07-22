# Delivery Challan Tracking Rules

## Model

`DeliveryChallanTrackingAllocation` stores soft tracking snapshots:

- `lotRef` / `serialRef` / `heatNumber`
- `quantity`
- optional `packageId`

Phase 7C4 does **not** require InventoryLot / InventorySerial masters (same soft tracking as 7C2/7C3).

## Rules

- Only packed tracking may be included
- Active packed tracking quantity must reconcile to challan lines
- One serial appears once on an active Challan version
- Duplicate serial across packages / lines blocks issue
- Lot/batch quantity cannot exceed packed quantity
- Issued Challan retains immutable tracking snapshot

## Forbidden

- Inferring tracking from item + quantity alone
- Claiming government-validated serial registries
