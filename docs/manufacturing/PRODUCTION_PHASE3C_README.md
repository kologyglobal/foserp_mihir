# Manufacturing Phase 3C — Production Materials Integration

**Status:** Shipped (2026-07-20)  
**Depends on:** Inventory Phase 3A, Purchase PR Phase 3B, Manufacturing Phase 2A/2B

## Scope

Production material **intent** on work orders — physical stock remains Inventory SoT.

| Capability | Endpoint | Permission |
|------------|----------|------------|
| List materials | `GET /work-orders/:id/materials` | `manufacturing.materials.view` |
| Sync from BOM snapshot | `POST /work-orders/:id/materials/sync-requirements` | `manufacturing.materials.create_requirement` |
| Reserve stock | `POST /work-orders/:id/materials/reserve` | `manufacturing.materials.reserve` |
| Issue to WO | `POST /work-orders/:id/materials/issue` | `manufacturing.materials.issue` |
| Return from WO | `POST /work-orders/:id/materials/return` | `manufacturing.materials.return` |
| Shortage → PR | `POST /work-orders/:id/materials/shortage-requisition` | `manufacturing.materials.create_requirement` |
| Readiness (free qty) | `GET /work-orders/:id/materials/readiness` | `manufacturing.materials.view` |

## Behaviour

### Sync requirements

- Runs after WO **release** when profile has `productionWarehouseId` (auto-sync).
- Creates `ProductionOrderMaterial` rows for BOM snapshot lines where `makeOrBuy=BUY` or item is stockable.
- Skips pure MAKE non-stockable phantoms.
- Idempotent on `bomLineId`.
- Sets order `materialControlStatus` → `ACTIVE`.

### Reserve / issue / return

- **Reserve:** calls Inventory `createReservation` (`demandType=WO`). Partial reserve + shortage flag when free stock insufficient — never invents stock.
- **Issue:** calls `postIssueToWorkOrder`; consumes linked reservation when present.
- **Return:** calls `postReturnFromWorkOrder`.

### Shortage requisition

- Lines with `shortageQty > 0` or uncovered requirement vs free stock.
- Calls Purchase `createFromProductionShortage`; links `purchaseRequisitionId` on material rows.

### Complete WO — FG receipt gate

- When profile `finishedGoodsWarehouseId` is set, product is stockable, and `completedGoodQuantity > 0`:
  - Posts `postFgReceipt` **before** marking WO `COMPLETED` (idempotency `fg:{orderId}`).
  - Omits `FINISHED_GOODS_RECEIPT_PENDING` warning on success.
- Missing FG warehouse: warning retained; complete does not fail.

## Database

- Migration: `20260720190000_manufacturing_phase3c_materials`
- Model: `ProductionOrderMaterial`
- Enum extensions: `ProductionOrderMaterialControlStatus.ACTIVE`, `ProductionOrderMaterialLineStatus`

## Tests

```bash
cd backend && npx tsx scripts/prisma-cli.ts migrate deploy && npx prisma generate
cd backend && npx vitest run tests/manufacturing-phase3c.test.ts
cd frontend && npm run test:manufacturing-phase3c
```

## Frontend

- API client: `frontend/src/services/api/manufacturingApi.ts`
- WO detail Materials tab: `ApiWorkOrderDetailPage.tsx` (list, reserve, issue, shortage PR — permission-gated)

## Out of scope (Phase 3C)

- WIP physical warehouse beyond issue/return/FG
- RFQ / PO / GRN
- Fake stock on inventory failure
- OEE / costing / GL
