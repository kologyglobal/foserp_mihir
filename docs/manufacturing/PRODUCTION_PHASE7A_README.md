# Manufacturing Phase 7A — Warehouse, Material Reconciliation, Physical WIP & FG

**Status:** Shipped (core) 2026-07-21 — **NEXT PHASE READINESS: READY WITH CONDITIONS**  
**Depends on:** Inventory 3A, Materials 3C, Quality 4A, WIP 5B, Corrections 5C, Planning 6A, Costing events 6B

## Gate

| Check | Result |
|-------|--------|
| InventoryStockMovement SoT | YES |
| Balance derived | YES |
| Reservations API | YES |
| Issue/return via Inventory | YES — **custody semantics (ADR-037)** |
| Stage Ledger | PARTIAL (ledger + cached qty) |
| WIP append-only | YES |
| FG document | YES — `ProductionFinishedGoodsReceipt` |
| 5C FG reverse syncs document | YES (`reversedQuantity` + status) |
| Quality blockers | YES |
| WO split lineage | NO — deferred (accepted 5C) |
| API inventory SPA | Demo — store workbench is manufacturing API |

## Semantics

See `MATERIAL_ISSUE_SEMANTICS.md` — `ISSUE_TO_WO` decreases warehouse on-hand once; no second consumption stock-out.

## Delivered

| Area | Capability |
|------|------------|
| 7A1 | `ManufacturingWarehouseMapping` + resolve/readiness |
| 7A2 | Material position, release/reallocate reservation, reconciliation, close policy |
| 7A3 | WIP position (logical vs stocked labels) |
| 7A4 | FG eligibility/partial post, close readiness, 5C reverse sync |
| 7A5 | Store workbench summary + queue APIs + FE `/manufacturing/store-workbench` |

## Migrations

- `20260721010000_manufacturing_phase7a1_warehouse_mapping`
- `20260721020000_manufacturing_phase7a4_fg_receipts`
- `20260721150000_manufacturing_phase7a_fg_reversed_qty`
- `20260721160000_fix_code_series_production_fg_receipt` (repair after dispatch enum rewrite)

## Tests (recorded)

- Backend `manufacturing-phase7a.test.ts`: **5/5**
- Backend `manufacturing-phase3c.test.ts` (FG on complete regression): **6/6** after code-series fix
- Frontend `npm run test:manufacturing-phase7a`: **38/38**

## Deferred

Incoming GRN QC, supplier rejection, dispatch/pick/pack, SO delivery/invoice, OEE, finite scheduling, full WMS/bins/barcode, auto Manufacturing GL, InventoryLot/Serial masters, WO split feature, denser WO material/FG drawers, warehouse-mapping settings SPA.

## Next

**PHASE 7B — INCOMING, IN-PROCESS AND FINAL QUALITY COMPLETION** (separate approval — do not start here).
