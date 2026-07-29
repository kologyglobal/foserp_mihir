# Inventory Costing Frontend Audit

> Audited: **2026-07-28**. Code wins. **No duplicate pages** — complete existing Phase 1 workspace.

## Cross-cutting

| Area | Status |
|------|--------|
| Routes | `/inventory/costing`, `/entries`, `/entries/:id`, `/layers`, `/layers/:id`, `/average`, `/standard`, `/specific`, `/reconciliation`, `/method-change` |
| Nav | Inventory → Costing |
| Permission | `inventory.view_cost` (writes: `inventory.setup.manage`) |
| Shell | `InventoryCostingShell` + `COSTING_SUBNAV` |
| Demo | `costingDemoData.ts` when `VITE_USE_API=false`; API mode must not fall back |

Canonical short paths (`/layers`, `/average`, …) are kept; aliases `/fifo-layers` etc. may redirect.

---

## Screen completeness

| Screen | Route | Component | APIs | Completeness | Missing | Reuse plan |
|--------|-------|-----------|------|--------------|---------|------------|
| Overview | `/inventory/costing` | `InventoryCostingSummaryPage` | setup, entries count, layers, recon | Partial | Total stock value, uncosted, policy panel, by-item table, health, mfg link | Enrich page + new `GET …/overview` |
| Cost Entries | `/entries` | `InventoryCostEntriesPage` | `cost-entries` | Partial | Item/WH names, drawer evidence, views | Enrich list API + drawer on detail |
| Entry detail | `/entries/:id` | `InventoryCostEntryDetailPage` | `cost-entries/:id` | Partial | MA/Std/Specific evidence panels | Enrich `getCostEntry` |
| FIFO Layers | `/layers` | `InventoryFifoLayersPage` | `cost-layers` | Partial | Item/WH names, summary KPIs | Enrich list API |
| Layer detail | `/layers/:id` | `InventoryFifoLayerDetailPage` | `cost-layers/:id` | OK-ish | Item names | Enrich get |
| Moving Average | `/average` | `InventoryAverageCostPage` | filtered entries | Thin | Per-item MA from balances | New `GET …/moving-average` |
| Standard | `/standard` | `InventoryStandardCostPage` | variances + POST | Thin | Version list | New `GET …/standard-costs` |
| Specific | `/specific` | `InventorySpecificIdPage` | layers by serial/lot | Thin | Open identity register | New `GET …/specific` |
| Reconciliation | `/reconciliation` | `InventoryValuationReconPage` | `valuation-reconciliation` | Partial | Reason codes, Run action, GL when available | Extend recon + POST run |
| Method Change | `/method-change` | `InventoryMethodChangePage` | POST method-change | Partial | Current method, readiness preview | Load effective method + result |

## Existing APIs (reuse)

- `GET …/cost-entries`, `…/cost-entries/:id`
- `GET …/cost-layers`, `…/cost-layers/:id`
- `GET …/valuation-reconciliation`
- `GET …/cost-variances`
- `POST …/standard-costs`, `POST …/method-change`
- `GET …/effective-method`, `GET …/items/:itemId/summary` (unused by FE until this phase)

## New read APIs (this phase)

- `GET …/overview`
- `GET …/items` (valuation-by-item)
- `GET …/moving-average`
- `GET …/standard-costs` (list versions)
- `GET …/specific` (open identity layers)
- `POST …/reconciliation/run` (refresh/recompute read model — no force balance)

## Non-goals

No new valuation engines, COGS posting, force-balance, or Purchase costing redesign.
