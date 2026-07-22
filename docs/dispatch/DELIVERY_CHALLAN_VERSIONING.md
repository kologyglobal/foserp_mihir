# Delivery Challan Versioning

## Draft

- One mutable Draft record with activity history
- Refresh-from-packing updates snapshots when status allows

## Issued

- Immutable: number, snapshots, document body
- Master data changes must not alter issued document

## Correction before Dispatch posting

1. Cancel **or** supersede with mandatory reason
2. Preserve original number + document
3. Create linked replacement Draft (`supersedesChallanId` / `supersededBy`)
4. Revalidate packing
5. Issue replacement (new number under NUMBER_ON_ISSUE)
6. Only one active issued version for Dispatch posting readiness

## Forbidden

- Overwriting an issued Challan in place
- Silently reactivating a superseded Challan
- Soft-deleting issued history
