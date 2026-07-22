# Package Tracking Rules (Phase 7C3)

## Soft tracking (current)

Until InventoryLot / InventorySerial masters ship, packing preserves soft refs from pick:

- `lotRef`
- `serialRef`
- `heatNumber`

## Quantity rules

```
Packed Tracking Qty ≤ Picked Tracking Qty
Packed Qty ≤ Net Picked ≤ Net Reserved ≤ Requested Dispatch Qty
```

## Serials

- One serial actively packed in at most one package line
- Must have been picked; must match item / warehouse context
- Move between packages requires `MOVE_BETWEEN_PACKAGES` event
- Unpack releases active package assignment without deleting pack history

## Lots / batches / heat

- Same lot may split across packages
- Package line retains lot identity
- Heat preserved on pack / move / unpack events
- Cannot pack more of a lot than was picked for that lot

## Authoritative source

Packable quantity comes from Pick events, not reservation or frontend quantity.
