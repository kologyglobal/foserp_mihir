# Screen Discovery Audit — Phase 2A

**Date:** 23 Jun 2026  
**Scope:** Routing, sidebar, workspace tiles, breadcrumbs, favorites, recent pages, global search  
**Goal:** Every implemented workspace discoverable without knowing URLs

---

## Phase 2A Changes (This Release)

| Screen | Route | Discovery |
|--------|-------|-----------|
| `ProductionWorkspacePage` | `/production` | Sidebar · Executive KPI · Global search |
| `DispatchDashboardPage` | `/dispatch/register` | Sidebar · Dispatch workspace tiles · Global search |
| `InvoiceDashboardPage` | `/invoices/register` | Sidebar · Finance workspace tiles · Global search |

**Also fixed:** Dead links that pointed "Dispatch Register" and "Invoice Register" at workspace landing pages (`/dispatch`, `/invoices`) instead of register routes.

---

## Routed Screens (103 routes)

### Executive
| Path | Component |
|------|-----------|
| `/` | ExecutiveWorkspacePage |

### Master Data (28)
| Path | Component |
|------|-----------|
| `/masters` | MastersHomePage |
| `/masters/uom` (+ new, :id, :id/edit) | UomList/Form/Detail |
| `/masters/item-categories` (+ CRUD) | ItemCategoryList/Form/Detail |
| `/masters/items` (+ CRUD) | ItemList/Form/Detail |
| `/masters/customers` (+ CRUD) | CustomerList/Form/Detail |
| `/masters/vendors` (+ CRUD) | VendorList/Form/Detail |
| `/masters/warehouses` (+ CRUD) | WarehouseList/Form/Detail |
| `/masters/products` (+ CRUD) | ProductList/Form/Detail |
| `/masters/bom` (+ CRUD) | BomList/Form/Detail |
| `/masters/work-centers` (+ CRUD) | WorkCenterList/Form/Detail |
| `/masters/routing` (+ new, :id) | RoutingList/Form/Detail |

### Inventory (8)
| Path | Component |
|------|-----------|
| `/inventory` | InventoryWorkspacePage |
| `/inventory/opening-stock` | OpeningStockPage |
| `/inventory/ledger` | StockLedgerPage |
| `/inventory/inward` | MaterialInwardPage |
| `/inventory/issue` | MaterialIssuePage |
| `/inventory/adjustment` | StockAdjustmentPage |
| `/inventory/reservations` | ReservationsPage |
| `/inventory/stock/:itemId` | ItemStockDetailPage |

### Planning (3)
| Path | Component |
|------|-----------|
| `/mrp` | MRPDashboardPage |
| `/mrp/run` | RunMRPPage |
| `/mrp/runs/:id` | MRPRunDetailPage |

### Sales (12)
| Path | Component |
|------|-----------|
| `/sales` | SalesWorkspacePage |
| `/sales/leads` (+ new, :id, :id/edit) | LeadList/Form/Detail |
| `/sales/inquiries` (+ new, :id, :id/edit) | InquiryList/Form/Detail |
| `/sales/quotations` (+ :id) | QuotationList/Detail |
| `/sales/approvals` | ApprovalQueuePage |
| `/sales/orders` (+ :id) | SalesOrderList/Detail |

### Procurement (11)
| Path | Component |
|------|-----------|
| `/purchase` | PurchaseWorkspacePage |
| `/purchase/requisitions` (+ new, :id) | PurchaseRequisitionList/Detail, ManualPrForm |
| `/purchase/rfqs` (+ :id) | RfqList/Detail |
| `/purchase/orders` (+ :id, amend, print) | PurchaseOrderList/Detail, PoAmend, PoPrint |
| `/purchase/grns` (+ :id) | GrnRegister/Detail |
| `/purchase/reports` | PurchaseReportsPage |

### Shop Floor (5)
| Path | Component |
|------|-----------|
| `/production` | **ProductionWorkspacePage** ✓ Phase 2A |
| `/work-orders` | WorkOrderListPage |
| `/work-orders/create-from-mrp` | CreateWorkOrderFromMrpPage |
| `/work-orders/:id` | WorkOrderDetailPage |
| `/costing` | CostingDashboardPage |

### Quality (7)
| Path | Component |
|------|-----------|
| `/quality` | QualityWorkspacePage |
| `/quality/queue` | QcQueuePage |
| `/quality/inspections/:id` | QcInspectionDetailPage |
| `/quality/rework` | ReworkWorkbenchPage |
| `/quality/ncr` (+ :id) | NcrRegister/Detail |
| `/quality/incoming` | IncomingQcQueuePage |
| `/quality/reports` | QualityReportsPage |

### Logistics (6)
| Path | Component |
|------|-----------|
| `/dispatch` | DispatchWorkspacePage |
| `/dispatch/register` | **DispatchDashboardPage** ✓ Phase 2A |
| `/dispatch/plan` | DispatchPlanPage |
| `/dispatch/reports` | DispatchReportsPage |
| `/dispatch/:id` (+ gate-pass) | DispatchDetailPage, GatePassPrintPage |

### Finance (3)
| Path | Component |
|------|-----------|
| `/invoices` | FinanceWorkspacePage |
| `/invoices/register` | **InvoiceDashboardPage** ✓ Phase 2A |
| `/invoices/:id` | InvoiceDetailPage |

### Analytics (19)
| Path | Component |
|------|-----------|
| `/reports` | ReportsIndexPage |
| `/reports/inventory/*` (3) | Stock aging, negative stock, slow moving |
| `/reports/purchase/*` (2) | Open PO, delayed PO |
| `/reports/production/*` (2) | WO status, WIP aging |
| `/reports/quality/*` (2) | NCR aging, rework trend |
| `/reports/dispatch/*` (2) | Pending dispatch, POD pending |
| `/reports/sales/*` (2) | Open orders, delivery commitments |
| `/reports/products/*` (5) | Revision, obsolete, cost, usage, engineering change |

---

## Unrouted Screens (Built but No Route)

These components exist in the codebase but are **not registered** in `src/routes/index.tsx`. They are superseded by workspace pages or legacy stubs.

| Component | File | Status | Recommendation |
|-----------|------|--------|----------------|
| `SalesDashboardPage` | `SalesPages.tsx` | Superseded by `SalesWorkspacePage` | Deprecate or merge unique KPIs |
| `PurchaseDashboardPage` | `PurchasePages.tsx` | Superseded by `PurchaseWorkspacePage` | Deprecate |
| `QualityDashboardPage` | `QualityPages.tsx` | Superseded by `QualityWorkspacePage` | Deprecate |
| `InventoryDashboardPage` | `InventoryDashboard.tsx` | Superseded by `InventoryWorkspacePage` | Deprecate |
| `DashboardPage` | `dashboard/DashboardPage.tsx` | Superseded by `ExecutiveWorkspacePage` | Remove when confirmed unused |
| `SalesPage` | `sales/SalesPage.tsx` | Legacy placeholder | Remove |
| `DispatchPage` | `dispatch/DispatchPage.tsx` | Legacy placeholder | Remove |
| `QualityPage` | `quality/QualityPage.tsx` | Re-export alias only | Remove alias |
| `ProductionPage` | `production/ProductionPage.tsx` | Legacy placeholder | Remove |
| `MRPPage` | `mrp/MRPPage.tsx` | Legacy placeholder | Remove |
| `InventoryPage` | `inventory/InventoryPage.tsx` | Legacy placeholder | Remove |
| `EngineeringPage` | `engineering/EngineeringPage.tsx` | Not implemented | Phase 3 or remove |

**Phase 2A orphan count:** 0 (all three target screens now routed)

---

## Hidden Pages (Routed but Limited Discovery)

Routed and functional, but **not in sidebar** — reachable via Reports Hub, cross-links, or global search only.

| Path | Component | Discovery Path |
|------|-----------|----------------|
| `/reports/dispatch/pod-pending` | PodPendingReportPage | Reports Hub · Global search |
| `/reports/sales/delivery-commitments` | DeliveryCommitmentsReportPage | Reports Hub · Global search |
| `/reports/products/revision` | ProductRevisionReportPage | Reports Hub · Global search |
| `/reports/products/obsolete` | ObsoleteProductReportPage | Reports Hub · Global search |
| `/reports/products/cost` | ProductCostReportPage | Reports Hub · Global search |
| `/reports/products/usage` | ProductUsageReportPage | Reports Hub · Global search |
| `/reports/products/engineering-change` | EngineeringChangeReportPage | Reports Hub · Global search |
| `/masters/routing/:id/edit` | RoutingFormPage | Direct URL only (no edit route registered) |

**Note:** 7 analytics reports and routing edit are candidates for Phase 2B sidebar expansion.

---

## Dead Links (Fixed in Phase 2A)

| Location | Was | Now | Impact |
|----------|-----|-----|--------|
| Dispatch workspace "Dispatch Register" tile | `/dispatch` (workspace) | `/dispatch/register` | Users landed on KPI dashboard, not register |
| Finance workspace "Invoice Register" tile | `/invoices` (workspace) | `/invoices/register` | Users never saw invoice list |
| Dispatch plan "Back to Register" | `/dispatch` | `/dispatch/register` | Wrong back target |
| Dispatch detail back / cancel | `/dispatch` | `/dispatch/register` | Wrong back target |
| Invoice detail back | `/invoices` | `/invoices/register` | Wrong back target |
| Executive "Dispatch Pipeline" KPI | `/dispatch` | `/dispatch/register` | Better default for ops users |
| Nav "Production Workspace" | `/work-orders` (WO list) | `/production` | Workspace conflated with register |

### Remaining Intentional `/dispatch` Links (Not Dead)

| Location | Target | Reason |
|----------|--------|--------|
| `DispatchReportsPage` breadcrumb | `/dispatch` | Returns to workspace hub |
| `DashboardPage.tsx` (legacy) | `/dispatch` | Legacy file, unrouted |

---

## Discovery Mechanisms — Coverage

| Mechanism | Phase 2A Status | Notes |
|-----------|-----------------|-------|
| **Router** | ✅ All 3 orphans wired | `routes/index.tsx` |
| **Sidebar** | ✅ Register + workspace entries | `config/navigation.ts` |
| **Workspace tiles** | ✅ Dispatch, Finance, Production updated | Quick actions + KPI onClick |
| **Breadcrumbs** | ✅ Auto on register + workspaces | `buildRouteBreadcrumbs()` |
| **Favorites** | ✅ Register pages support star | `favoritePath` on OperationalPageShell / PageHeader |
| **Recent pages** | ✅ Auto via PageTracker | `getPageLabel()` updated for new paths |
| **Global search (⌘K)** | ✅ All nav pages indexed | `searchablePages` + Pages section in GlobalSearch |

### Global Search Index (52 pages)

All non-disabled items from `moduleCategories` are searchable by label, category, or path. Examples:

- "dispatch register" → `/dispatch/register`
- "production" → `/production`
- "invoice register" → `/invoices/register`
- "work orders" → `/work-orders`

Transaction documents (SO, PO, WO, items, parties, invoices) continue to search as before.

---

## Acceptance Checklist

- [x] User can open Production Command Center from sidebar without URL
- [x] User can open Dispatch Register from sidebar / Dispatch workspace
- [x] User can open Invoice Register from sidebar / Finance workspace
- [x] ⌘K finds all three screens by name
- [x] Favorites work on register pages (star icon)
- [x] Recent pages track visits to new routes
- [x] Breadcrumbs show Home → Module → Page on new screens
- [x] No orphan screens from Phase 2A target list remain

---

## Recommended Phase 2B

1. Add 7 hidden analytics reports to sidebar Reports category
2. Route `/masters/routing/:id/edit` or remove edit buttons
3. Delete legacy placeholder pages (`SalesPage`, `DispatchPage`, etc.)
4. Consolidate or remove superseded module dashboards (`SalesDashboardPage`, etc.)
5. Add workspace favorites star to `WorkspaceHeader` (currently list/register pages only)

---

*Generated as part of ERP Phase 2A — Routing & Discovery Fix*
