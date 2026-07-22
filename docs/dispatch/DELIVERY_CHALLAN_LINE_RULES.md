# Delivery Challan Line Rules

## Source of quantity

When packing exists:

```
challanQuantity ≤ reconciled net packed quantity for the Dispatch line
default: challanQuantity = selected packed quantity
```

Do **not** derive challan quantity from reservation or pick quantity alone.

## Line identity

Each line retains:

- `outboundDispatchLineId`
- `salesOrderId` / `salesOrderLineId` (traceability; multi-SO allowed only if the Dispatch already combined them)
- `itemId` + item/UOM/HSN snapshots
- `packedQuantity` (source) and `challanQuantity` (document)

## Editing

| Field | Draft editable? |
|-------|-----------------|
| Transport / remarks / dates / movement reason | Yes |
| Challan quantity (partial policy) | Only if tenant allows partial + reconciliation holds |
| Packed quantity / tracking / SO ordered qty | No |

## Multi Sales Order

List every SO reference; do not merge lines so SO line identity is lost.
