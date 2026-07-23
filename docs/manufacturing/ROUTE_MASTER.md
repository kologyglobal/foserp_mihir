# Route Master (Business Central style)

FOS Route Master follows Dynamics 365 Business Central routing patterns while staying simple for Indian discrete manufacturing SMEs.

## Canonical location

- UI: `/manufacturing/setup/routings`
- API: `/api/v1/t/:tenantSlug/manufacturing/routings` and `/routing-versions/...`
- Demo `/manufacturing/routes` redirects to setup when `VITE_USE_API=true`

## Structure

```
Route Header
  + Version (DRAFT / ACTIVE / ARCHIVED …)
  + Operation lines (Work Centre mandatory, Machine optional)
  + Optional Advanced: stage groups, dependencies, BOM generate
```

### Status mapping (UI ↔ DB)

| User-facing (BC)   | DB `ManufacturingVersionStatus` | Notes |
|--------------------|----------------------------------|-------|
| Under Development  | `DRAFT`                          | Editable |
| Certified          | `ACTIVE`                         | Read-only; WO release uses this |
| Closed             | `ARCHIVED`                       | Read-only; not for new profiles/WOs |
| Superseded         | `SUPERSEDED`                     | Prior certified when a new version is certified |

API responses include `lifecycleLabel` (`UNDER_DEVELOPMENT` / `CERTIFIED` / `CLOSED` / …).

## Worked example

**5000 L Fuel Tank** PARALLEL route (`RT-000001`) with Job Card stage groups — see [`examples/FUEL_TANK_ROUTING.md`](./examples/FUEL_TANK_ROUTING.md).

### Header fields

| Field | Behaviour |
|-------|-----------|
| Route Code | Auto `RT-######` via `MANUFACTURING_ROUTING` number series; read-only after create |
| Route Name | Required, manual |
| Production Type | `SERIAL` \| `PARALLEL` (`productionFlowType`) |
| Version | System-managed integer |
| Effective From / To | On version |
| Revision Reason | Required on Create New Version / Close |

Routes are **not** linked to an Item on the route card (Business Central style). Assign the certified route on the **Manufacturing Profile** for the finished item.

### Operation line rule (fixed)

```
Operation → Work Centre (mandatory) → Machine (optional)
```

No Workstation layer.

### Lifecycle

1. Create Route → Version 1 Under Development  
2. Add operations → Validate  
3. Certify → Certified (locks version; supersedes prior ACTIVE)  
4. Create New Version → copy structure → new DRAFT with revision reason  
5. Close → ARCHIVED when no profile still points at the version  

### Work Order release

Still snapshots the **ACTIVE** (Certified) routing version: stages, operations, work centres, machines, times, `qualityRequired`. Master edits after release do not rewrite WO snapshots.

## Related docs

- [ROUTE_LIFECYCLE.md](./ROUTE_LIFECYCLE.md)
- [ROUTE_OPERATION_LINES.md](./ROUTE_OPERATION_LINES.md)
- [ROUTE_VERSIONING.md](./ROUTE_VERSIONING.md)
- [ROUTE_VALIDATION_RULES.md](./ROUTE_VALIDATION_RULES.md)
- [ROUTE_PERMISSION_MATRIX.md](./ROUTE_PERMISSION_MATRIX.md)
- [ROUTE_TEST_RESULTS.md](./ROUTE_TEST_RESULTS.md)
