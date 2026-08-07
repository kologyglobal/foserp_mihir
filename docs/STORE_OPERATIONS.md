# Store Operations

**Status:** FE operational hub over existing Inventory / Purchase / Manufacturing engines
**Last updated:** 2026-08-07 — Store module redesign (nav IA + full-width + hub regroup)

## Principle

**Inventory** owns quantity/value. **Store** owns physical location and how material moves.

| Layer | Role |
|-------|------|
| **Inventory Ledger** | Source of truth (audit) |
| **Inventory Balance** | Operational view (item × warehouse) |
| **GRN / Issue / Transfer / Count documents** | Immutable transaction documents — never merged |

Store UI **does not** create parallel stock tables. Daily actions deep-link into already-shipped post paths. Store is deliberately **not** a full WMS (no wave picking, no slotting) unless a client explicitly needs it — see `docs/inventory/INVENTORY_BIN_WISE_STOCK_GAP_REPORT.md` for why BIN is not yet a stock dimension.

```
Purchase → GRN → QC Hold/Accepted → Store Receipt → Warehouse Stock → Issue/Transfer/Count → Production/Sales
```

## Store menu (rail order)

| # | Screen | Route |
|---|--------|-------|
| 1 | Store Dashboard | `/inventory` (= `/inventory/store`) |
| 2 | Item Stock 360 | `/inventory/stock` → `/inventory/stock/:itemId` |
| 3 | Receive hub | `/inventory/store/receive` |
| 4 | Put Away | `/inventory/store/put-away` |
| 5 | Reservations (cards) | `/inventory/store/reservations` |
| 6 | Material Picking hub | `/inventory/store/picking` |
| 7 | Issue hub | `/inventory/store/issue` |
| 8 | Transfer hub | `/inventory/store/transfer` |
| 9 | Stock Count hub | `/inventory/store/count` |
| 10 | Scan hub | `/inventory/store/scan` |
| 11 | Timeline | `/inventory/store/timeline` |
| 12 | Reports | `/inventory/reports` |
| 13 | Setup | `/inventory/setup` |

Operator flow encoded in this order: `Demand → Reservation → Material Picking → Issue`.

### Relocated out of the Store rail (routes unchanged)

Accounting/Costing/Planning are inventory-valuation and MRP concerns, not "where is the material" concerns — moved to where they conceptually belong. Routes are unchanged; only the nav category housing them changed (finding `findActiveCategoryId` resolves these paths to their new category, so the correct module rail highlights):

| Item | Old (Store rail) | New home |
|------|-------------------|----------|
| Reorder Planning | `/inventory/planning` | Manufacturing nav |
| Inventory Accounting | `/inventory/accounting` | Accounting nav ("Inventory Events") |
| Inventory Costing | `/inventory/costing` | Accounting nav ("Inventory Costing") |

### Single Reservations UI

`/inventory/store/reservations` (operator card view) is the default. The dense register at `/inventory/reservations` is reachable via the **Full register** link on the cards page — not duplicated in the nav rail.

## Dashboard KPIs

Operator daily-view order (see `frontend/src/services/inventory/storeOperationsService.ts`):

1. **QC Pending** — `GRN_QC_PENDING` + `PURCHASE_QI_OPEN` → `/quality/incoming`
2. **Pending Put Away** — posted-but-not-put-away GRNs → `/inventory/store/put-away`
3. **Today's Receipt** / **Today's Issue** — from today's ledger movements, split by kind
4. **Low Stock** → `/inventory/stock?lowStock=1`
5. Secondary: Pending GRN, Pending Issue, Pending Transfer, Pending Count, Reservations, Negative Stock

**Total Items** / **Total Stock Qty** render as a totals row above the KPI strip. They aggregate the full item × warehouse register (`listWarehouseOpsSummaries`) and load **independently** of the main KPI/queue fetch so a heavy aggregate never blocks the primary dashboard render.

Composed from:

- `GET /inventory/store-workbench/summary` + `needs-action` (existing BE queue aggregates)
- Consolidated balances (low / negative stock, totals)
- Ledger first page for "today's movements" (API mode)

Quick actions: Receive · Issue · Transfer · Stock Count · Scan · Search · Stock · Warehouse.

## Engines reused

- Movements: opening, inward, issue (`/inventory/movements/*`, `/inventory/issue`, …)
- Documents: transfers, adjustments, stock counts, returns
- Purchase GRN (`/purchase/grn`)
- Manufacturing store workbench queues
- Dispatch workbench (sales pick readiness)
- Maintenance ticket spare issue
- Costing / ledger / FIFO layers UI (finance side, now under Accounting nav)

## Receive hub groups

`MaterialReceiptHubPage` (`/inventory/store/receive`) groups choices as:

1. **Purchase Receipt** — New GRN, Open GRN register
2. **Opening Stock** — opening balance via inventory movement engine
3. **Other Receipts** — production FG receipt, transfer-in, general inward/adjustment+, returns, scan-to-receive

## Issue hub types

`MaterialIssueHubPage` (`/inventory/store/issue`) leads with named issue types (Production, Sales, Department, Scrap, Adjustment) mapped onto existing engines, then a secondary "Other" group (general/sample/internal, job work, quick API issue).

## Put away & picking

**Put-away workbench** at `/inventory/store/put-away`:

1. **Awaiting stock post** — GRNs not yet inventory-posted; open GRN to complete receive/post.
2. **Ready for put-away** — posted GRNs; **Transfer to storage** pre-fills the inventory transfer engine (`from/to warehouse`, first line item/qty, remark `Put-away after GRN-…`) or **Scan put-away**.

There is **no second put-away table**. Storage movement is always transfer/scan → inventory ledger. Put Away is a **Phase 2 workflow feature** — required for larger multi-bin plants, optional for small single-location stores.

**Serials / bins on Item 360** come from tracking masters + GRN line snapshots (document audit). They are **not** a fake consolidated balance — BIN is not yet a posted stock dimension (see gap report).

## Multi-UOM display contract

One base quantity + conversion factor — never two independent balances:

```
Primary:   100 NOS
Equivalent: 5000 KG
```

Item Stock 360 always shows primary qty first, equivalent qty second, sourced from the item's UOM conversion — not a second stored quantity.

## Conditions

- Dense ERP registers remain available under Movements / Stock Count for power users.
- Put-away "suggested bin" AI does not invent a bin master — uses transfer flow.
- Demo mode shows sample needs-action row; full queues require API mode.
- BIN is master + GRN-line metadata only; it does **not** drive balances/movements/costing until the Phase 1b epic in `docs/inventory/INVENTORY_BIN_WISE_STOCK_GAP_REPORT.md` ships. Do not build BIN-level UI ahead of that ledger work.

See also: `ITEM_360.md`, `INVENTORY_OPERATIONS.md`, `STORE_UI_CONSISTENCY.md`.
