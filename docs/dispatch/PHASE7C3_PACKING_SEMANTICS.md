# Phase 7C3 — Packing Semantics

**Decision:** `PACKING_AS_OPERATIONAL_ALLOCATION`  
**Date:** 2026-07-21  
**Status:** Binding for Phase 7C3

## Definition

| Step | Effect on Inventory `onHandQty` | Effect on reservation | Effect on SO fulfilment | Effect on Pick history |
|------|----------------------------------|----------------------|-------------------------|------------------------|
| Create Packing Session | **Unchanged** | Remains ACTIVE | **Unchanged** | Unchanged |
| Pack / unpack / move | **Unchanged** | Remains ACTIVE | **Unchanged** | Unchanged (pick events preserved) |
| Package verify / session complete | **Unchanged** | Remains ACTIVE | **Unchanged** | Unchanged |
| Phase 7C5 confirm/post | Decreases via `FG_DISPATCH` | Consumed | Dispatched ↑ | Unchanged |

## Authoritative packable quantity

```
Net Picked = Σ PICK − Σ UNPICK
Packable   = Net Picked − Net Packed (PACK − UNPACK ± MOVE)
```

Do **not** use reserved qty, requested Dispatch qty, or Sales Order remaining as packable SoT.

## Invariants

1. On Hand Before Packing = On Hand After Packing
2. Packed Quantity ≤ Net Picked Quantity
3. Packed ≠ Dispatched ≠ Fulfilled
4. Unpack restores picked-but-unpacked; does **not** unpick or release reservation
5. Soft `lotRef` / `serialRef` / `heatNumber` only (no InventoryLot/Serial masters yet)
6. No Delivery Challan, Sales Invoice, or GL from packing

## 7C0 compatibility

Basic Confirm blocked when an active Packing Session exists that is not `PACKED`/`VERIFIED`, or package qty/tracking does not match Dispatch qty. Complete reconciled packing follows the same single stock-out rule as 7C2.
