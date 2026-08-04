# Store / Inventory UI Consistency

Source of truth for **Store module** frontend look & feel (`/inventory/*` routes, nav label **Store**).

Related: Purchase Zoho layer in `purchase-zoho.css` · `docs/PURCHASE_UI_CONSISTENCY.md`

## North star

| Do | Don’t |
|----|--------|
| Flat white surfaces, navy suite, `#0078d4` primary | Purple / glow / glassmarketing heroes |
| Dense 12–13px grids and register tables | Giant card marketing grids |
| `OperationalPageShell` + Zoho store CSS | One-off page chrome per store screen |
| Module badge / breadcrumbs **Store** | Mixed “Inventory & Warehouse” chrome |

## Zoom layer

- CSS: `frontend/src/styles/inventory-zoho.css` (import in `index.css`)
- Auto-applied when path is `/inventory…` or badge is Store/Inventory via `OperationalPageShell` → classes `store-zoho-register` + `enterprise-workspace--store`
- Helper: `frontend/src/utils/isStorePath.ts`

## Shells

| Screen | Pattern |
|--------|---------|
| Module home | `StoreDashboardPage` + KPI strip + shortcut rail |
| Registers | `OperationalPageShell` dynamics enterprise |
| Editors | `ErpCardFormPage` / operation hubs (receive, issue, …) |
| Costing | `InventoryCostingShell` |

Paths stay under `/inventory/*` (API + routes); product name in nav is **Store**.
