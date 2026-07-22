# Dispatch Phase 7C2 — Reservation, Pick List & Picking

> Status: **shipped** — migration `20260721194500_dispatch_phase7c2_reservation_picking` deployed; live `dispatch-phase7c2.test.ts` **7/7**; FE smoke **30/30**.  
> Picking policy: **ALLOCATION_ONLY_PICKING** — see `PHASE7C2_PICKING_SEMANTICS.md`.  
> Scope lock: **no** packing, packages, Delivery Challan, FG_DISPATCH redesign, fulfilment posting, invoice/COGS, barcode/WMS, staging WH transfer.

## Why 7C2

Phase 7C1 delivers Draft Dispatches from requirements. 7C2 locks eligible unrestricted FG via existing `InventoryStockReservation` (`demandType=DISPATCH`) and proves Store collection with Pick Lists / pick events — **without** reducing on-hand or updating Sales Order dispatched qty.

## SHIPPED AFTER 7C2

- FG dispatch reservation (full / partial / reserve-available)
- Reservation preview, release (incl. partial), reallocation
- Soft lot/serial/heat allocation refs (`DispatchTrackingAllocation`)
- Pick List create (per warehouse), release, assign, start
- Full / partial pick, shortage report, unpick, complete
- Picking reconciliation
- Workbench reservation/picking tabs + tablet pick UI
- 7C0 confirm gate when incompatible active pick lists exist
- Permissions, exceptions (`DISPATCH_PICK_SHORTAGE`), traceability (`PICK_LIST`)

## STILL PENDING (7C4–7C5)

- Delivery Challan / transporter / e-Way
- Hardened dispatch posting + stock-out + fulfilment redesign
- Confirmed dispatch reversal
- Invoice / COGS / revenue
- Relational InventoryLot / InventorySerial masters (soft refs until then)

## Availability formula

```
Available to Reserve =
  Unrestricted FG on-hand (warehouse mapping excludes quality-hold / rework / scrap)
  − active Inventory reservedQty on those balances
```

Active 7C2 reservations use the same balance `reservedQty` ledger via `applyReservationDeltaInTx`. On-hand is never changed by 7C2.

## API (base `/api/v1/t/:tenantSlug/dispatch`)

| Area | Routes |
|------|--------|
| Reserve | `POST/GET …/orders/:id/reservations*`, release, reallocate, position |
| Tracking | `GET …/orders/:id/lines/:lineId/tracking-availability` |
| Pick lists | `POST …/orders/:id/pick-lists`, `GET/POST …/pick-lists/:id/*` |
| Positions | picking-position, picking-reconciliation |
| Workbench | `/workbench/reservations|pick-lists|picking|picked|shortages` |

## Code series

`DISPATCH_PICK_LIST` → `PKL-######`

## Permissions

`dispatch.reservation.*`, `dispatch.pick_list.*`, `dispatch.tracking.*` (see `PHASE7C2_PERMISSION_MATRIX.md`)

## Tests

```bash
cd backend
npx vitest run tests/dispatch-phase7c0.test.ts tests/dispatch-phase7c1.test.ts tests/dispatch-phase7c2.test.ts

cd ../frontend
npm run test:dispatch-phase7c0
npm run test:dispatch-phase7c1
npm run test:dispatch-phase7c2
```

## Phase 7C3 readiness

**SHIPPED** — see `PHASE7C3_README.md`. Soft tracking conditions carried forward for 7C4.

Recommended next: **PHASE 7C3 — PACKING AND PACKAGE RECONCILIATION** (do not auto-start).
