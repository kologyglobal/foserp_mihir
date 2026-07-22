# Inventory Phase 3A — Stock Ledger Foundation

**Status:** Backend full stack + FE API client (2026-07-20). Demo inventory UI remains for `VITE_USE_API=false`. Dual-mode page hydration is deferred to a later inventory FE pass.

## Goal

Establish **Inventory as the physical stock source of truth** so Production Phase 3C can reserve / issue / return / FG-receive without a second ledger.

## Included

| Capability | API |
|------------|-----|
| Stock balances (on-hand, reserved, free) | `GET /inventory/balances`, `GET /inventory/balances/position` |
| Item ledger | `GET /inventory/ledger` |
| Opening / inward / issue / adjustment | `POST /inventory/movements/*` |
| Issue to Work Order | `POST /inventory/movements/issue-to-work-order` |
| Return from Work Order | `POST /inventory/movements/return-from-work-order` |
| Finished Goods receipt | `POST /inventory/movements/fg-receipt` |
| Reservations | `GET/POST /inventory/reservations`, `POST …/cancel` |

Base path: `/api/v1/t/:tenantSlug/inventory`.

## Data model

Migration: `backend/prisma/migrations/20260720170000_inventory_phase3a_foundation`

| Model | Role |
|-------|------|
| `InventoryStockMovement` | **SoT** — signed quantity ledger |
| `InventoryStockBalance` | Cached `(tenant, item, warehouse)` onHand + reserved; updated in same TX as movements |
| `InventoryStockReservation` | Soft demand peg (`SO` / `WO`); ACTIVE / FULFILLED / CANCELLED |

Code series: `STOCK_MOVEMENT` → `STM-`, `STOCK_RESERVATION` → `RES-`.

Reuses: `MasterItem` (`isStockable`), `MasterWarehouse`, `MasterLocation` (no bin).

## Rules

- `freeQty = onHandQty − reservedQty`
- Cannot reserve more than free qty
- Issues cannot drive free stock negative unless `inventory.issues.override_negative_stock`
- Idempotency keys on movements and reservations
- Soft `workOrderId` on movements (Production FK wiring in Phase 3C)
- **No** GL / valuation posting in 3A

## Explicitly deferred

- Bin / heat / batch / serial document models
- Stock count documents
- Transfer documents (can use paired issue+inward later)
- Purchase GRN posting (needs Purchase backend — Phase 3B)
- MRP / planning
- Full dual-mode Inventory SPA hydration
- Manufacturing `/materials/*` integration (Phase 3C)

## Permissions

Existing catalog `inventory.*` enforced on routes. **Inventory Manager** role already grants the module set.

## Frontend

- API client: `frontend/src/services/api/inventoryApi.ts`
- Smoke: `npm run test:inventory-phase3a`
- Demo `inventoryStore` unchanged for demo mode

## Tests

| Suite | Result |
|-------|--------|
| `backend/tests/inventory-phase3a.test.ts` | 10/10 |
| FE smoke `test:inventory-phase3a` | file/export wiring |

## Next

1. **Phase 3B — Purchase PR foundation** (minimal PR create/list with production refs)  
2. **Phase 3C — Production materials integration** (requirements, reserve/issue/return/shortage→PR, FG gate via this ledger)

Do not claim Production material control is live until 3C ships.
