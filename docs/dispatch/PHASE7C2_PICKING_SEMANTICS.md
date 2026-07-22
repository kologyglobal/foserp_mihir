# Phase 7C2 — Picking Semantics

**Decision:** `ALLOCATION_ONLY_PICKING`  
**Date:** 2026-07-21  
**Status:** Binding for Phase 7C2

## Definition

| Step | Effect on Inventory `onHandQty` | Effect on `reservedQty` / availability | Effect on SO fulfilment |
|------|----------------------------------|----------------------------------------|-------------------------|
| Reserve FG for Draft Dispatch | **Unchanged** | Active reservation increases → available-to-reserve ↓ | **Unchanged** |
| Create / release Pick List | **Unchanged** | None beyond existing reservation | **Unchanged** |
| Confirm pick / partial pick | **Unchanged** | Reservation stays ACTIVE; picked qty blocked from other Dispatches via allocation/pick events | **Unchanged** |
| Unpick | **Unchanged** | Returns qty to reserved-not-picked | **Unchanged** |
| Release unpicked reservation | **Unchanged** | Releases reserved qty back to free | **Unchanged** |
| Phase 7C5 confirm/post | Decreases on-hand via `FG_DISPATCH` | Consumes reservation | Increases dispatched |

## Invariants

1. **On Hand Quantity remains unchanged** during reservation and picking.
2. **Available-to-Reserve** decreases because of active reservations (and active pick allocations that keep the reservation alive).
3. **Picked ≠ Dispatched.** Picked is an operational Store confirmation only.
4. **No staging warehouse transfer** in Phase 7C2.
5. **No InventoryStockMovement** from reservation, pick, unpick, or shortage.

## Why not staging transfer

Indian discrete FG for trailers often sits in a finished-goods bay until challan/gate-out. Moving to a “dispatch staging” warehouse in 7C2 would invent a second physical SoT before packing/challan exist, complicate 7C0 compatibility, and risk double-counting when 7C5 posts `FG_DISPATCH`. Allocation-only picking matches the existing soft `InventoryStockReservation` model.

## Tracking

Prisma has **no** `InventoryLot` / `InventorySerial` tables yet. Phase 7C2 stores soft allocation refs (`lotRef`, `serialRef`, `heatNumber`) on `DispatchTrackingAllocation`, gated by manufacturing profile tracking flags where present. When Inventory lot/serial masters ship, allocations can gain FKs without rewriting pick history.

## 7C0 compatibility

Basic confirm (`POST /dispatch/outbound/:id/confirm`) may proceed only when:

- no active Phase 7C2 Pick List exists for the Dispatch, **or**
- every active Pick List is `PICKED` and net picked qty equals the Draft line qty for each line

Otherwise confirm is blocked with a clear conflict. Confirm still posts stock once via `postFgDispatchIssueMovement` and must not create a second movement from pick events.
