# Phase 8B — Data Templates README

**Location:** `docs/implementation/templates/`  
**Purpose:** Stub CSV headers for pilot master/data load. Prefer real Prisma field names for mapping; loaders may map codes → UUIDs.

## Files

| File | Maps toward | Notes |
|------|-------------|-------|
| `items.csv` | `MasterItem` | Category/UOM by **code** (resolve to ids on import) |
| `warehouses.csv` | `MasterWarehouse` | One plant for pilot |
| `bom_lines.csv` | `ManufacturingBomLine` (+ version context columns) | Parent BOM by code/version |
| `routing_ops.csv` | `ManufacturingRoutingOperation` | Stage group + WC by code |
| `manufacturing_profiles.csv` | `ManufacturingProfile` | Product item by code |
| `opening_stock.csv` | `InventoryStockBalance` / opening movement | Qty on hand seed |
| `users_roles.csv` | `User` + `Role` assignment | No password hashes in CSV — invite flow |
| `work_centres.csv` | `ManufacturingWorkCentre` | Plant-scoped |

## Conventions

- UTF-8, comma-separated, header row required.  
- Soft-delete: omit deleted rows; do not send `deletedAt`.  
- IDs: leave blank for create; system assigns UUID.  
- Booleans: `true` / `false`.  
- Decimals: plain numbers (no currency symbols).

## Load order (suggested)

1. warehouses, work_centres  
2. items (after categories/UOMs exist in tenant)  
3. bom_lines (BOM header/version must exist or be created in same load job)  
4. routing_ops  
5. manufacturing_profiles  
6. opening_stock  
7. users_roles  

## Out of scope for stubs

- Full BOM header / routing header CSVs (create via UI/API if needed).  
- Machines, quality plans, SO lines — add later if pilot expands.  
- Do not commit real client passwords or account numbers.
