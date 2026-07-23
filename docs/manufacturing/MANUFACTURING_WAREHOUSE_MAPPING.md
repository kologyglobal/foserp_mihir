# Manufacturing Warehouse Mapping (Phase 7A1)

**Model:** `ManufacturingWarehouseMapping`  
**API:** `/api/v1/t/:tenantSlug/manufacturing/warehouse-mappings`

## Purpose

Maps warehouse **roles** for production stores without duplicating the Warehouse master.

| Role | Required | Notes |
|------|----------|-------|
| Raw material | Yes | Reservation / issue source |
| Finished goods | Yes | Unrestricted FG receipt |
| Production issue | Optional | Soft default for issue WH |
| WIP | Optional | Required when stocked WIP is used |
| Quality hold | Optional | Quarantine / NEEDS_INSPECTION returns |
| Rework / Scrap / Job Work / Default return | Optional | Purpose-validated |

## Resolve rules

1. Active mapping for `plantCode` if present  
2. Else tenant default (`isDefault` / null plant)  
3. Warehouse must be tenant-owned and active  

## Readiness

Profile / plant readiness treats FG + (when configured) QC Hold / Scrap as hard gates for activation.

**Example:** Fuel Tank plant `MAIN-PLANT` — see [`examples/FUEL_TANK_PROFILE.md`](./examples/FUEL_TANK_PROFILE.md).

`GET .../readiness` and `GET .../:id/readiness` report missing FG/WIP warehouses and inactive FKs.

Plant-specific rows override tenant default. Scrap cannot be selected as usable return destination in issue/return validators.
