# Store / Inventory UI Consistency

Source of truth for **Store module** frontend look & feel (`/inventory/*` routes, nav label **Store**).

Related: Purchase Zoho layer in `purchase-zoho.css` · `docs/PURCHASE_UI_CONSISTENCY.md` · IA and KPI details in `docs/STORE_OPERATIONS.md`

## North star

| Do | Don’t |
|----|--------|
| Flat white surfaces, navy suite, `#0078d4` primary | Purple / glow / glassmarketing heroes |
| Dense 12–13px grids and register tables | Giant card marketing grids |
| `OperationalPageShell` + Zoho store CSS | One-off page chrome per store screen |
| Module badge / breadcrumbs **Store** | Mixed “Inventory & Warehouse” chrome |

## Full width — grid `auto-fit`, never `auto-fill`

Store surfaces (hub choice cards, ops summary cards) must stretch to fill the main content pane, not leave dead space when a group has only 1–3 cards.

- `grid-template-columns: repeat(auto-fit, minmax(…, 1fr))` — collapses empty tracks so existing cards stretch to fill the row.
- **Never** `auto-fill` for card grids with a variable, often-small item count — it reserves empty tracks at their minimum width even with no content, which is exactly what produced the “half the screen is blank” bug on the Receive / Issue / Transfer / Count hubs.
- Applies to: `.store-op-choice-grid` (`enterprise-workspace.css` + `inventory-zoho.css` override), `.ops-summary-grid` (Warehouse Ops Dashboard / Analytics / Search).
- Fixed-count grids (`.store-kpi-grid`, `.store-quick-actions` — `repeat(2|3|4, minmax(0,1fr))`) are unaffected and already fill width correctly.
- `.inv-hub`, `.store-ops-page`, `.store-op-choice-grid` all set `width: 100%; max-width: none` — do not reintroduce a `max-width` cap on these containers.

## Zoom layer

- CSS: `frontend/src/styles/inventory-zoho.css` (import in `index.css`)
- Auto-applied when path is `/inventory…` or badge is Store/Inventory via `OperationalPageShell` → classes `store-zoho-register` + `enterprise-workspace--store`
- Helper: `frontend/src/utils/isStorePath.ts`

## Shells

| Screen | Pattern |
|--------|---------|
| Module home | `StoreDashboardPage` + totals row + KPI strip + shortcut rail |
| Hubs (Receive/Issue/Transfer/Put Away/Picking/Count/Scan) | `StoreOpHub` — grouped `store-op-choice-grid`, choosers only, no stock posting of their own |
| Registers | `OperationalPageShell` dynamics enterprise |
| Editors | `ErpCardFormPage` / operation hubs (receive, issue, …) |
| Costing | `InventoryCostingShell` (nav lives under Accounting → “Inventory Costing”) |

Paths stay under `/inventory/*` (API + routes); product name in nav is **Store**. Accounting / Costing / Reorder Planning keep their `/inventory/*` routes but are no longer listed in the Store rail — see `docs/STORE_OPERATIONS.md#relocated-out-of-the-store-rail-routes-unchanged`.
