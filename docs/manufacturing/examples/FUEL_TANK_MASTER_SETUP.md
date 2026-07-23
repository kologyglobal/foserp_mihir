# Fuel Tank Manufacturing Master Setup

**Example:** 5000 Litre Mild Steel Fuel Storage Tank (`FG-FUEL-TANK-5000L`)  
**Tenant:** `vasant-trailers`  
**Mode:** Live API / Prisma (not demo frontend)  
**Status:** READY FOR INTERNAL UAT (2026-07-23)

## Purpose

Complete fabricated fuel-tank pilot covering multilevel BOM, PARALLEL routing, manufacturing profile, warehouses, QC test groups, FG Work Order release, and auto Job Cards (stage groups) for LOGICAL semi-finished assemblies.

## Seed commands

```bash
cd backend
npx tsx scripts/seed-fuel-tank-pilot-items.ts vasant-trailers
npx tsx scripts/seed-fuel-tank-mfg-setup.ts vasant-trailers
npx tsx scripts/test-fuel-tank-wo-execution.ts
```

## Key codes

| Object | Code |
|--------|------|
| FG | `FG-FUEL-TANK-5000L` |
| BOM | `BOM-FUEL-TANK-5000L` v1 ACTIVE |
| Route | Auto `RT-######` (seed produced `RT-000001`) |
| Profile | `MP-FUEL-TANK-5000L` |
| Plant | `MAIN-PLANT` |

## Architecture mapping (code reality)

| Spec term | FOS implementation |
|-----------|-------------------|
| Under Development / Certified | BOM/Route version `DRAFT` / `ACTIVE` |
| Job Card | `ManufacturingStageGroup` (+ ops) snapshotted onto `ProductionOrder` at release |
| QC Test Group | `QualityInspectionPlan` (`QC-*` plan codes) |
| Route Link Code | Op/BOM `drawingReference` + BOM `issueOperationId` |
| LOGICAL SFG | Profile `wipTrackingMethod=LOGICAL_WIP`, `childProductionOrdersEnabled=false` — **no child SFG WOs** |

## Spec sheets

- [FUEL_TANK_BOM.md](./FUEL_TANK_BOM.md)
- [FUEL_TANK_ROUTING.md](./FUEL_TANK_ROUTING.md)
- [FUEL_TANK_PROFILE.md](./FUEL_TANK_PROFILE.md)
- [FUEL_TANK_JOB_CARDS.md](./FUEL_TANK_JOB_CARDS.md)
- [FUEL_TANK_UAT.md](./FUEL_TANK_UAT.md)

## Related product docs

- [ROUTE_MASTER.md](../ROUTE_MASTER.md)
- [MANUFACTURING_WAREHOUSE_MAPPING.md](../MANUFACTURING_WAREHOUSE_MAPPING.md)
- [FINISHED_GOODS_RECEIPT_RULES.md](../FINISHED_GOODS_RECEIPT_RULES.md)
