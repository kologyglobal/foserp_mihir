# Inventory Costing UI

> Phase: Inventory Costing FE + Valuation Reconciliation · 2026-07-28

## Navigation

Inventory → Costing

Canonical routes (aliases redirect):

| Path | Screen |
|------|--------|
| `/inventory/costing` | Overview |
| `/inventory/costing/entries` | Cost Entries |
| `/inventory/costing/layers` | FIFO Layers (`/fifo-layers` →) |
| `/inventory/costing/average` | Moving Average (`/moving-average` →) |
| `/inventory/costing/standard` | Standard Costs (`/standard-costs` →) |
| `/inventory/costing/specific` | Specific Identification |
| `/inventory/costing/reconciliation` | Reconciliation |
| `/inventory/costing/method-change` | Method Change wizard |

## Rules

- Backend Inventory Costing is authoritative — React never recalculates FIFO/MA/Standard/Specific.
- API mode: live APIs only; no demo fallback on failure.
- Demo mode: seed/demo data only when `VITE_USE_API=false`.
- Permission: `inventory.view_cost` (writes: `inventory.setup.manage`).
- No Force Balance action.

## Key APIs

- `GET …/inventory/costing/overview`
- `GET …/inventory/costing/items`
- `GET …/inventory/costing/cost-entries` (+ enriched item/WH)
- `GET …/inventory/costing/cost-layers`
- `GET …/inventory/costing/moving-average`
- `GET …/inventory/costing/standard-costs`
- `GET …/inventory/costing/specific`
- `GET …/inventory/costing/valuation-reconciliation`
- `POST …/inventory/costing/reconciliation/run`
- `POST …/inventory/costing/method-change`

See also: [INVENTORY_COSTING_FE_AUDIT.md](./INVENTORY_COSTING_FE_AUDIT.md).
