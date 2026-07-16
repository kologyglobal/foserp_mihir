# Entity 360 Completion Report

**Date:** 23 Jun 2026  
**Scope:** BOM 360 + Customer 360 intelligence workspaces  
**Constraint:** No new stores; existing BOM, Sales, Production, Inventory, Costing, Dispatch, and Invoice data only.

---

## Routes

| Workspace | Route |
|-----------|--------|
| **BOM 360** | `/engineering/boms/:id/360` |
| **Customer 360** | `/masters/customers/:id/360` |

Legacy paths redirect: `/masters/bom/:id` → BOM 360, `/masters/customers/:id` → Customer 360.

Route helpers: `src/config/entity360Routes.ts` (`bom360Path`, `customer360Path`)

---

## BOM 360

**Page:** `src/modules/entity360/Bom360Page.tsx`  
**Metrics:** `getBom360Data` / `useBom360`

| Tab | Content |
|-----|---------|
| Overview | BOM No, product, revision, status, effective date, released by, components, cost, risk KPIs |
| Structure | Multi-level tree + DataGrid (level, qty, UOM, source, warehouse, cost) |
| Cost Rollup | Material, bought out, subcontract, scrap, total standard cost |
| Revision History | All product BOM revisions |
| Usage | Product, open SO, open WO, recent MRP runs |
| Material Risk | Shortage, long lead, single vendor, inactive, no-cost items |
| Impact Analysis | Component change → affected product/SO/WO/PR/cost sheets |
| Documents | BOM exports and revision records |
| Timeline | BOM lifecycle events |

**Actions:** Revise BOM · Compare Revision · Export BOM · Print BOM · View Product · Run Impact Analysis

---

## Customer 360

**Page:** `src/modules/entity360/Customer360Page.tsx`  
**Metrics:** `getCustomer360Data` / `useCustomer360`

| Tab | Content |
|-----|---------|
| Overview | Name, industry, city, contact, credit limit, outstanding, order value, open orders |
| Sales Pipeline | Leads, inquiries, quotations, approved/lost quotes |
| Sales Orders | Open · In Production · Ready to Dispatch · Closed |
| Production | Linked WOs, delayed orders, QC holds |
| Dispatch | Plans, dispatched trailers, POD pending, delivery history |
| Invoices & Payments | Value, paid, outstanding, overdue, payment status |
| Quality / Complaints | Final QC issues, complaints, warranty, NCRs |
| Documents | Quotations, invoices, master record |
| Timeline | Customer lifecycle events |

**Actions:** Create Inquiry · Create Quotation · Create Sales Order · View Open Orders · View Dispatch History · View Outstanding

---

## UX

- `Entity360Shell` with KPI cards, command bar, fact boxes, activity feed
- `DataGrid` for all tabular data (no raw tables)
- `EmptyState` via DataGrid empty messages
- `StatusBadge` semantic tokens
- `Timeline` on dedicated tab

---

## Navigation & Global Search

| Source | 360 link |
|--------|----------|
| BOM list / manage | `bom360Path(id)` |
| Product 360 | Released BOM → BOM 360 |
| Customer list | `customer360Path(id)` |
| Sales Order detail | Customer name → Customer 360 |
| Global search (⌘K) | **BOM 360** and **Customer 360** result types |

---

## Test Suite

```bash
npm run test:entity-360
```

Script: `scripts/test-entity-360.ts`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | BOM 360 route opens | `/engineering/boms/:id/360` path resolves |
| 2 | BOM tree renders | `getBom360Data` returns tree + flat lines |
| 3 | BOM cost rollup matches BOM lines | Leaf sum = `materialCost` = `computeBomTotalCost` |
| 4 | BOM usage shows linked product/WO/SO | Product link + SO/WO arrays on snapshot |
| 5 | Customer 360 route opens | `/masters/customers/:id/360` path resolves |
| 6 | Customer SO list renders | Open + closed SO for seed customer |
| 7 | Customer dispatch and invoice tabs show linked records | Dispatch + invoice arrays scoped to customer |
| 8 | Customer outstanding calculation works | `outstanding` = sum of `balanceDue` |
| 9 | Global search can find BOM 360 and Customer 360 | Search index returns `/360` hrefs |

**Last run:** 9/9 passed

Also run before release:

```bash
npm run build
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/config/entity360Routes.ts` | Route builders |
| `src/utils/entity360Metrics.ts` | BOM + Customer snapshot functions |
| `src/modules/entity360/Bom360Page.tsx` | BOM 360 UI |
| `src/modules/entity360/Customer360Page.tsx` | Customer 360 UI |
| `src/modules/entity360/Entity360Redirects.tsx` | Legacy route redirects |
| `src/components/design-system/GlobalSearch.tsx` | BOM/Customer 360 search entries |
| `scripts/test-entity-360.ts` | 9-test integration suite |
| `package.json` | `"test:entity-360"` script |
