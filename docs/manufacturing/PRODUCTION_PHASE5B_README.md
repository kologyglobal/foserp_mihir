# Manufacturing Phase 5B — Material / WIP / WO Transfers

**Status:** Shipped (2026-07-20)  
**Depends on:** Inventory 3A, Manufacturing materials 3C, Runtime Changes 5A

## Scope

Manufacturing-owned transfer **intent** documents with Inventory as physical stock SoT (paired `ISSUE` + `INWARD`, `referenceType: WIP_TRANSFER`). No second stock ledger in Production. No GL, split, or stock reversal.

Base paths:

- `/api/v1/t/:tenantSlug/manufacturing/work-orders/:id/wip-movements`
- `/api/v1/t/:tenantSlug/manufacturing/work-orders/:id/transfer-to/:targetId`

| Capability | Endpoint | Permission |
|------------|----------|------------|
| List / get | `GET /wip-movements`, `GET /wip-movements/:movementId` | `manufacturing.wip.move` |
| Post transfer | `POST /wip-movements` | `manufacturing.wip.move` |
| WO → WO | `POST /transfer-to/:targetId` | `manufacturing.materials.transfer` |

## Movement types

| Type | Behaviour |
|------|-----------|
| `LOCATION_WIP` | Same WO warehouse move. `LOGICAL_WIP` profile → activity-only (`physicalPosted=false`). Stocked / BOTH → inventory pair. |
| `MATERIAL_RELOCATE` | Relocate issued material line warehouse; updates `ProductionOrderMaterial.warehouseId`. |
| `WO_TO_WO` | Physical move attributed to target WO (`sourceWorkOrderId` = source); activity on both orders; optional material issued/returned adjustment. |

## Lifecycle

Create-and-post in one step → `POSTED` (number series `WM-`). Idempotency key supported. Cancel/reverse deferred.

## Database

- Migration: `20260720230000_manufacturing_phase5b_wip_transfers`
- Model: `ProductionWipMovement`
- Code series: `PRODUCTION_WIP_MOVEMENT` → `WM-`
- Activity types: `WIP_MOVED`, `MATERIAL_TRANSFERRED`, `WO_TO_WO_TRANSFERRED`

## Frontend (API mode)

- `WipTransferDrawer` + **Transfer** action + Transfers list on `ApiWorkOrderDetailPage`
- Demo WO / scan WIP pages unchanged (`VITE_USE_API=false`)

## Tests

```bash
cd backend && npx vitest run tests/manufacturing-phase5b.test.ts
cd frontend && npm run test:manufacturing-phase5b
```

## Out of scope (deferred)

WO split, stock reversals, inventory transfer document module, costing/GL, OEE, bins/batch-serial.
