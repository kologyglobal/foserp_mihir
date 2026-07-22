# Dispatch Phase 7C0 — SO fulfilment + FG_DISPATCH thin slice

> Status: **shipped (code)** — apply migration `20260721030000_dispatch_phase7c0_fulfilment` before live use.  
> Scope lock: **no** pick/pack/challan, invoice, e-Way, POD, wave picking, or CRM `ready_dispatch`/`dispatched` status machine as SoT.

## Why 7C0

Full Phase 7C was gated **NOT READY**: SO lines are JSON (stable DTO `id`, no `CrmSalesOrderLine` table), no delivered/cancelled qty, and `FG_DISPATCH` existed on the inventory enum with no poster. 7C0 lands the minimum honest foundation.

## What shipped

| Piece | Detail |
|-------|--------|
| Fulfilment ledger | `SalesOrderLineFulfilment` — optional `cancelledQty` per JSON line id |
| Projection | `GET /crm/sales-orders/:id/fulfilment` → ordered / cancelled / net / dispatched / remaining |
| Cancel qty | `POST .../fulfilment/lines/:lineId/cancelled-qty` `{ cancelledQty }` (≤ ordered − dispatched) |
| OutboundDispatch | `DRAFT` → `CONFIRMED` / `CANCELLED` (pre-confirm only) |
| Stock-out | Confirm posts `ISSUE` + `FG_DISPATCH` via `postFgDispatchIssueMovement` (idempotent per line) |
| Reservations | Demand type `DISPATCH` added; confirm can consume active `SO` reservations |
| Inventory route | `POST /inventory/movements/fg-dispatch` (also used internally by dispatch confirm) |
| FE dual-mode | API: register + detail confirm; demo store untouched when `VITE_USE_API=false` |

## API

Base: `/api/v1/t/:tenantSlug`

### Fulfilment

- `GET /crm/sales-orders/:id/fulfilment` — `crm.sales_order.view`
- `POST /crm/sales-orders/:id/fulfilment/lines/:lineId/cancelled-qty` — `crm.sales_order.update`

Dispatched qty is **derived** from `OutboundDispatch` lines with status `CONFIRMED` (not a cached column).

### Outbound dispatch

- `GET /dispatch/outbound` — list (`dispatch.view`)
- `POST /dispatch/outbound` — create DRAFT (`dispatch.create`)
- `GET /dispatch/outbound/:id`
- `PATCH /dispatch/outbound/:id` — DRAFT only (`dispatch.edit`)
- `POST /dispatch/outbound/:id/confirm` — stock-out (`dispatch.post`)
- `POST /dispatch/outbound/:id/cancel` — DRAFT only (`dispatch.cancel`)

Confirm validates remaining SO line qty when `salesOrderLineId` is set. Confirmed cancel / stock reverse is **out of scope** for 7C0.

## Code series

`OUTBOUND_DISPATCH` → `DSP-######`

## Explicit non-goals (next phases)

- Pick / pack / delivery challan / gate-pass lifecycle
- Ready-candidates workbench from FG + QC
- SO status transitions as API source of truth
- Invoice / e-Way / POD / RMA
- Lot/serial allocation on dispatch lines
- Quality hold qty on balances

## Tests

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx vitest run tests/dispatch-phase7c0.test.ts
```

## Related

- Inventory 3A — balances + `postStockMovement`
- CRM sales orders — JSON `lines[].id`
- Full 7C — after 7C0 green, reassess readiness for 7C1–7C5
