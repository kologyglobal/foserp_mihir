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

## Back links

The **workspace header tab bar** (`WorkspaceUnifiedHeader` / `DynamicsTabs`) already provides navigation across all Store nav-rail destinations, so an in-page “Back to Store” link on those pages is redundant chrome.

- **Tab-bar-level pages** — dashboard (`StoreDashboardPage`), hubs/choosers (`StoreOpHub`: Receive/Issue/Transfer/Put Away/Picking/Count/Scan), workbenches (`PutAwayWorkbenchPage`), and registers reachable directly from the Store nav rail (`StoreReservationsPage`, `InventoryTimelinePage`, `ConsolidatedStockPage`, `InventoryItemsListPage`, …) — **never** pass `backLink` to `OperationalPageShell`. The tab bar is the only Back affordance here.
- **True drill-in views** — pages reached by clicking a row/record from a register, not from the nav rail (`ItemStock360Page`, `InventoryItemDetailPage`, `InventoryStockDetailPage`, and equivalents) — **do** get `backLink={{ to: <parent register>, label: '…' }}` pointing at the register they drilled in from.
- Don’t duplicate the shell’s `backLink` with a second “Back to …” button/link inside the page body (empty-state action buttons, section headers) — one Back affordance per page.

## Zoom layer

- CSS: `frontend/src/styles/inventory-zoho.css` (import in `index.css`)
- Auto-applied when path is `/inventory…` or badge is Store/Inventory via `OperationalPageShell` → classes `store-zoho-register` + `enterprise-workspace--store`
- Helper: `frontend/src/utils/isStorePath.ts`

## Design tokens (visual consistency pass)

Store re-declared its own radius/spacing/badge shapes in a few places instead of honoring the shared `--store-zoho-*` tokens (`--store-zoho-radius: 8px`, `--store-zoho-gap: 10px`). Fixed to a single value per token:

| Token | Value | Applies to |
|-------|-------|------------|
| Card radius | `8px` | `.store-kpi-card`, `.store-section`, `.store-action-card`, `.store-op-choice`, `.ops-summary-card` (was `10px`/`4px`) |
| Badge/chip radius | `6px` | `.inv-hub-badge` (was `3px`/`4px` scoped override), `.ops-status`, `.stock-360-identity__uom` (was a one-off `999px` pill) — one badge shape for status/severity everywhere in Store |
| Gap scale | `10px` | `.store-ops-page` (was `16px`), `.item-stock-360` (was `14px`) — matches `--store-zoho-gap` |
| KPI numeral size | `22px` | `.store-kpi-card__value` (was `28px`) — dense like Purchase's KPI strip |

Status/severity chips (`SeverityBadge`, Put Away card top-line, Reservations status) all render via `.inv-hub-badge` (+ `--info`/`--warning`/`--critical` tone) — don't introduce a new one-off badge class for a new status concept; add a tone variant to `.inv-hub-badge` instead.

## Command bars

Registers/hubs/workbenches render actions via `ErpCommandBar` (`commandBar` prop on `OperationalPageShell`/`InventoryCostingShell`) — Refresh as `primaryAction`, navigation links as `secondaryActions`. Don't render a raw `flex` row of `<button>`/`<Link>` for page-level actions (`StoreDashboardPage`, `PutAwayWorkbenchPage`, `StoreReservationsPage`, `InventoryTimelinePage` all follow this now, matching `ConsolidatedStockPage` / `WarehouseOpsDashboardPage`). Filter chips/selects (e.g. the timeline kind filter) are page content, not command-bar actions — leave those in the body.

## Known debt (intentionally out of scope for the visual pass)

- Most live registers (`api/ApiStockLedgerPage.tsx`, receipts/returns/documents/reservations, costing tables) still render plain `<table>`s rather than `CrmListFilterBar` / `CrmFilterDrawer` / `useSavedViews` / `ErpDataGrid`. They already inherit the dense Zoho table look via the blanket `.store-zoho-register table thead th / tbody td` rules, so this is a structural/architecture gap, not a visual one — full parity with Purchase's register shell is a separate, larger effort.
- No saved views / column show-reorder on Store registers (Purchase gold-path pattern) — same reason as above.

## Shells

| Screen | Pattern |
|--------|---------|
| Module home | `StoreDashboardPage` + totals row + KPI strip + shortcut rail |
| Hubs (Receive/Issue/Transfer/Put Away/Picking/Count/Scan) | `StoreOpHub` — grouped `store-op-choice-grid`, choosers only, no stock posting of their own |
| Registers | `OperationalPageShell` dynamics enterprise |
| Editors | `ErpCardFormPage` / operation hubs (receive, issue, …) |
| Costing | `InventoryCostingShell` (nav lives under Accounting → “Inventory Costing”) |

Paths stay under `/inventory/*` (API + routes); product name in nav is **Store**. Accounting / Costing / Reorder Planning keep their `/inventory/*` routes but are no longer listed in the Store rail — see `docs/STORE_OPERATIONS.md#relocated-out-of-the-store-rail-routes-unchanged`.
