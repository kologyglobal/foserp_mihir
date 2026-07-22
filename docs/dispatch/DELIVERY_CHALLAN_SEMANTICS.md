# Phase 7C4 — Delivery Challan Semantics

**Decision:** `DELIVERY_CHALLAN_AS_DOCUMENT_ONLY`  
**Date:** 2026-07-21  
**Status:** Binding for Phase 7C4

## Definition

| Step | Inventory on-hand | Reservation | SO fulfilment | Packed qty |
|------|-------------------|-------------|---------------|------------|
| Create Draft Challan | Unchanged | Unchanged | Unchanged | Unchanged |
| Edit / submit / approve | Unchanged | Unchanged | Unchanged | Unchanged |
| Issue / print / download PDF | Unchanged | Unchanged | Unchanged | Unchanged |
| Cancel / supersede (pre-post) | Unchanged | Unchanged | Unchanged | Unchanged |
| Phase 7C5 Dispatch Post | Decreases via FG_DISPATCH | Consumed | Dispatched ↑ | Unchanged |

## Authoritative challan quantity

```
Challan Quantity ≤ Net Reconciled Packed Quantity
(pilot: one active Challan per Dispatch → Challan Qty = Net Packed)
```

Do **not** use reserved qty, pick qty, or Sales Order remaining as challan SoT when packing exists.

## Invariants

1. On Hand Before Challan = On Hand After Challan
2. SO Fulfilled Before Challan = SO Fulfilled After Challan
3. Challan Quantity ≠ Dispatched Quantity ≠ Fulfilled Quantity
4. Issued document is immutable (snapshot + stored document)
5. Soft lot/serial/heat snapshots only (no InventoryLot/Serial masters yet)
6. Manual e-Way Bill reference only — never claim “Verified”
7. Terminal user-facing document state: **ISSUED** (not “Posted”)

## Number policy

**NUMBER_ON_ISSUE** — official `DC-######` allocated inside the issue transaction.

## 7C0 compatibility

Basic Confirm blocked when packing sessions exist unless packing is PACKED/VERIFIED **and** an active Delivery Challan is ISSUED with quantity matching the Dispatch (when any challan workflow was started). See `PHASE7C4_7C0_COMPATIBILITY.md`.
