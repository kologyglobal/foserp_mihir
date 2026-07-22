# Delivery Challan Package Rules

## Linkage

`DeliveryChallanPackage` links a Challan to `DispatchPackage` rows.

## Eligibility

- Package belongs to the same Dispatch / packing session scope
- Package status COMPLETE or VERIFIED per packing policy
- Cancelled packages excluded
- Pilot: one **active** Challan per Dispatch — package cannot sit on two active Challans

## Reconciliation

- Package quantity must reconcile with challan lines
- Package tracking (soft lot/serial/heat) preserved via tracking allocations
- Do not replace structured package lines with free-text descriptions only

## Supersession / cancel

- Links remain on historical Challans for audit
- Replacement Draft re-links from current verified packages after revalidation
