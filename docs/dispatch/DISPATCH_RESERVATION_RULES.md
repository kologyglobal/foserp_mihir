# Dispatch Reservation Rules (Phase 7C2)

## Source of truth

Reuse `InventoryStockReservation`. Do **not** create a parallel reservation ledger.

| Field | 7C2 usage |
|-------|-----------|
| `demandType` | `DISPATCH` |
| `demandId` | `OutboundDispatchLine.id` |
| `outboundDispatchId` / `outboundDispatchLineId` | Explicit FKs (additive) |
| `dispatchRequirementId` | When line linked |
| `salesOrderId` / `salesOrderLineId` | Traceability |
| `releasedQty` | Partial release without deleting history |
| `quantity` / `fulfilledQty` | Net active = quantity − releasedQty − fulfilledQty |

## Quantity rules

```
Reserved (net active) ≤ Requested Dispatch line qty ≤ Remaining-to-dispatch (CONFIRMED only)
```

- Quality Hold warehouses excluded via mapping (not balance buckets)
- Over-reserve blocked against free qty after existing reservations
- Picked qty cannot be released until unpicked
- No InventoryStockMovement on reserve/release

## Statuses (derived)

NOT_RESERVED → PARTIALLY_RESERVED → RESERVED | RESERVATION_SHORT | RELEASED | CONSUMED | CANCELLED

Draft Dispatch `status` remains DRAFT|CONFIRMED|CANCELLED for 7C0; reservation summary is operational.
