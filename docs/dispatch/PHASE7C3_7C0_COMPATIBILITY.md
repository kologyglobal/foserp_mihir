# Phase 7C3 ↔ 7C0 Compatibility

## Rule

Phase 7C0 Basic Confirm (`dispatch.post` / basic confirm path) must not ignore packing.

`assertPackingAllowsConfirm` (after pick-list gate):

1. If **no** packing sessions → confirm may proceed (subject to 7C2 pick gate).
2. If sessions exist (non-cancelled):
   - Each must be `PACKED` or `VERIFIED`
   - Net packed qty per line must equal Dispatch line qty
3. Incomplete / mismatched packing → **409 Conflict**

## When packing is complete

7C0 may still post the **single** legacy stock-out + fulfilment update once — provided:

- Package reconciliation complete
- Quantity matches
- No Delivery Challan dependency yet (7C4+)
- Confirm remains idempotent

## Explicit non-goals of packing

Packing never posts `FG_DISPATCH`, never updates SO dispatched qty, never creates challan/invoice/GL.

## Labelling

UI keeps **Basic Confirm** separate from packing actions. Packing UI may show informational “Ready for Delivery Challan” — **not** a create-challan action.
