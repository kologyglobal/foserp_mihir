# Store Operations

**Status:** FE operational hub over existing Inventory / Purchase / Manufacturing engines  
**Last updated:** 2026-08-04  

## Principle

| Layer | Role |
|-------|------|
| **Inventory Ledger** | Source of truth (audit) |
| **Inventory Balance** | Operational view (item × warehouse) |
| **GRN / Issue / Transfer / Count documents** | Immutable transaction documents — never merged |

Store UI **does not** create parallel stock tables. Daily actions deep-link into already-shipped post paths.

## Entry points

| Screen | Route |
|--------|--------|
| Store Dashboard | `/inventory` or `/inventory/store` |
| Item Stock 360 | `/inventory/stock/:itemId` |
| Consolidated stock | `/inventory/stock` |
| Material Receipt hub | `/inventory/store/receive` |
| Material Issue hub | `/inventory/store/issue` |
| Transfer hub | `/inventory/store/transfer` |
| Put away hub | `/inventory/store/put-away` |
| Picking hub | `/inventory/store/picking` |
| Count hub | `/inventory/store/count` |
| Reservations (cards) | `/inventory/store/reservations` |
| Timeline | `/inventory/store/timeline` |
| Barcode hub | `/inventory/store/scan` |
| Production store workbench | `/inventory/store-workbench` or `/manufacturing/store-workbench` |
| Classic overview | `/inventory/overview` |

## Dashboard KPIs

Composed from:

- `GET /inventory/store-workbench/summary` + `needs-action` (existing BE queue aggregates)
- Consolidated balances (low / negative stock)
- Ledger first page for “today’s movements” (API mode)

Quick actions: Receive · Issue · Transfer · Count · Scan · Search · Stock · Warehouse.

## Engines reused

- Movements: opening, inward, issue (`/inventory/movements/*`, `/inventory/issue`, …)
- Documents: transfers, adjustments, stock counts, returns
- Purchase GRN (`/purchase/grn`)
- Manufacturing store workbench queues
- Dispatch workbench (sales pick readiness)
- Maintenance ticket spare issue
- Costing / ledger / FIFO layers UI (finance side)

## Put away & picking

**Put-away workbench** at `/inventory/store/put-away`:

1. **Awaiting stock post** — GRNs not yet inventory-posted; open GRN to complete receive/post.  
2. **Ready for put-away** — posted GRNs; **Transfer to storage** pre-fills the inventory transfer engine (`from/to warehouse`, first line item/qty, remark `Put-away after GRN-…`) or **Scan put-away**.

There is **no second put-away table**. Storage movement is always transfer/scan → inventory ledger.

**Serials / bins on Item 360** come from tracking masters + GRN line snapshots (document audit). They are **not** a fake consolidated balance.

## Conditions

- Dense ERP registers remain available under Movements / Stock Count for power users.
- Put-away “suggested bin” AI does not invent a bin master — uses transfer flow.
- Demo mode shows sample needs-action row; full queues require API mode.

See also: `ITEM_360.md`, `INVENTORY_OPERATIONS.md`.
