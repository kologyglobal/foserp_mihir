# Fuel Tank — Manufacturing Profile

**Code:** `MP-FUEL-TANK-5000L`  
**Name:** 5000 Litre Fuel Tank Manufacturing Profile  
**Finished item:** `FG-FUEL-TANK-5000L`  
**Plant:** `MAIN-PLANT`

## Links

| Field | Value |
|-------|-------|
| Certified BOM | `BOM-FUEL-TANK-5000L` v1 ACTIVE |
| Certified Route | `RT-000001` v1 ACTIVE |
| Execution mode | `DETAILED` |
| Production type | `FABRICATION` |
| WIP tracking | `LOGICAL_WIP` |
| Output tracking | `SERIAL` |
| Serial required | Yes |
| Direct PO allowed | Yes |
| Partial production | Yes |
| Child WOs | **No** (`childProductionOrdersEnabled=false`) |
| Job work (subcontract) | Allowed |
| Overproduction tolerance | 0% |
| Material consumption | `ACTUAL` |

## Warehouses

| Role | Code |
|------|------|
| RM | RM-MAIN |
| BO | BO-MAIN |
| Consumables | RM-CONSUMABLES |
| Production / WIP | WIP |
| FG | FG-MAIN |
| QC Hold | QC-HOLD |
| Scrap | SCRAP |
| Job Work | JOB-WORK |

Also seeded: `ManufacturingWarehouseMapping` for `MAIN-PLANT`.

## Tenant settings (pilot)

- `requireReservation=false` (warning-only / flexible pilot)
- `allowCloseWithoutQc=false`
- `allowPartialProduction=true`
- `allowOverproduction=false`

## Readiness checklist (seed verification)

All hard checks PASSED at seed time: FG, certified BOM/Route, WCs, machines, QC plans, warehouses, serial tracking, LOGICAL SFG, profile active.
