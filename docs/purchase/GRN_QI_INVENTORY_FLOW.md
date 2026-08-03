# GRN → QI → Inventory flow

## No QI required

```text
GRN submit → INWARD UNRESTRICTED → InventoryCostEntry (method from Inventory Settings)
```

## QI required

```text
GRN submit → INWARD QC_HOLD
QI complete:
  accepted (+deviation) → QC_HOLD → UNRESTRICTED (QUALITY_RELEASE)
  rejected → QC_HOLD → REJECTED (QUALITY_REJECT)
GRN → INVENTORY_POSTED
```

Accepted qty becomes freely available stock. Rejected stays blocked / return-eligible. Hold remains unavailable until released.

## Costing

Purchase never computes FIFO/MA/Standard/Specific. Cost entries are created by Inventory posting. GRN deep-links to `/inventory/costing/entries?search={GRN}`.

## Invoiceable policy

Invoice from accepted / posted GRN quantity (PO line `invoicedQuantity` enforced on submit). Do not invoice rejected qty unless a separate commercial adjustment path exists (not in this phase).
