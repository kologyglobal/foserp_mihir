# ERP Execution Layer Audit

**Date:** 23 June 2026  
**Scope:** Production execution, shop floor, subcontract (vendor job work), and related 360 views  
**Method:** Codebase-only review — routes (`src/routes/index.tsx`), components, stores, navigation (`src/config/navigation.ts`). No inference beyond files that exist.

**Legend**

| Status | Meaning |
|--------|---------|
| **Implemented** | Dedicated route + screen (or 360 shell) with working UI wired to store |
| **Partially Implemented** | Logic or UI exists but split, embedded, unnamed, or incomplete vs intended capability |
| **Missing** | No matching route, page, or component name in codebase |

---

## Summary

| # | Capability | Status |
|---|------------|--------|
| 1 | Work Order 360 | **Missing** |
| 2 | Job Card Workbench | **Partially Implemented** |
| 3 | Shop Floor Queue | **Implemented** |
| 4 | Job Work Order | **Partially Implemented** |
| 5 | Material Send to Vendor | **Partially Implemented** |
| 6 | Material Receive from Vendor | **Partially Implemented** |
| 7 | Vendor Job Work Costing | **Partially Implemented** |
| 8 | Vendor Job Work QC | **Partially Implemented** |
| 9 | Vendor 360 | **Implemented** |
| 10 | Item 360 | **Implemented** |

---

## 1. Work Order 360

**Status: Missing**

There is no `WorkOrder360Page`, no `useWorkOrder360` hook, and no route using `Entity360Shell` for work orders.

### What exists instead (not WO 360)

| Route | Component | File |
|-------|-----------|------|
| `/work-orders` | `WorkOrderListPage` | `src/modules/workorder/WorkOrderPages.tsx` |
| `/work-orders/:id` | `WorkOrderDetailPage` | `src/modules/workorder/WorkOrderPages.tsx` |
| `/work-orders/create-from-mrp` | `CreateWorkOrderFromMrpPage` | `src/modules/workorder/WorkOrderPages.tsx` |

`WorkOrderDetailPage` is a **document-style detail page** (`DocumentHeader`, `DocumentLayout`, tab strip). It is **not** an Entity 360 workspace.

**Tabs on `WorkOrderDetailPage`:** materials, reservation, issue, operations, cost, subcontract, sa_receipt, fg_receipt, timeline (`detailTabs` in `WorkOrderPages.tsx`).

**Navigation:** Sidebar → Shop Floor → Work Orders (`/work-orders`). Breadcrumb label: `Work Order Detail` (`src/utils/pageNavigation.ts`).

**Metrics hook:** None named `useWorkOrder360`. WO data read via `useWorkOrderStore` inside `WorkOrderDetailPage`.

---

## 2. Job Card Workbench

**Status: Partially Implemented**

No file, route, or navigation label named **"Job Card Workbench"** exists in the codebase (grep: zero matches).

Job card execution is split across:

### A. Shop Floor Job Queue (primary queue UI)

| Route | Component | File |
|-------|-----------|------|
| `/shop-floor` | `ShopFloorJobQueuePage` | `src/modules/control-towers/ShopFloorJobQueuePage.tsx` |

**Nav:** `src/config/navigation.ts` → Shop Floor → **Shop Floor Job Queue**  
**Page label:** `Shop Floor Job Queue` (`src/utils/pageNavigation.ts`)

**Capabilities:** Team filter (`SHOP_FLOOR_TEAMS`), job list, start / pause / complete, inline `QcChecklistPanel`, link to WO detail.

**Store actions:** `startJobCard`, `pauseJobCard`, `completeJobCard` (`src/store/workOrderStore.ts`)

**Metrics hook:** `useShopFloorQueue` (`src/utils/controlTowerMetrics.ts`)

### B. Work Order Detail → Operations tab (per-operation job cards)

| Route | Component | File |
|-------|-----------|------|
| `/work-orders/:id` (tab: operations) | `JobCardPanel` (embedded) | `src/components/production/JobCardPanel.tsx` |

Rendered inside `WorkOrderDetailPage` when `tab === 'operations'`. One `JobCardPanel` per production operation.

### C. Supporting utilities (not screens)

| File | Role |
|------|------|
| `src/utils/jobCard.ts` | `buildJobCardsFromOperations`, `nextJobCardNo` |
| `src/components/production/QcChecklistPanel.tsx` | QC checklist UI used by job card flows |

**Gap vs "Job Card Workbench":** No single workbench route aggregating all open job cards across WOs with planner/foreman views (only shop-floor queue + WO-embedded panels).

---

## 3. Shop Floor Queue

**Status: Implemented**

| Item | Value |
|------|-------|
| **Route** | `/shop-floor` |
| **Component** | `ShopFloorJobQueuePage` |
| **File** | `src/modules/control-towers/ShopFloorJobQueuePage.tsx` |
| **Export** | `src/modules/control-towers/index.ts` |
| **Navigation** | Shop Floor → Shop Floor Job Queue |
| **Hook** | `useShopFloorQueue(teamFilter?)` in `src/utils/controlTowerMetrics.ts` |
| **Linked from** | `ProductionControlTowerPage` → navigate `/shop-floor` |

**Screen elements:** PageHeader, team Select, queue list, active job panel, Start/Pause/Complete buttons, QC checklist when `requiresQc`.

---

## 4. Job Work Order

**Status: Partially Implemented**

No route or component named **"Job Work Order"** (grep: zero matches).

Subcontract / vendor job-work orders are modeled as work orders with `woType: 'subcontract'`.

| Item | Value |
|------|-------|
| **Type** | `WorkOrderType` includes `'subcontract'` (`src/types/workorder.ts`) |
| **Route** | `/work-orders/:id` (same as all WOs) |
| **Component** | `WorkOrderDetailPage` |
| **Creation** | MRP → `CreateWorkOrderFromMrpPage` with `createSubcontractWo` config; engine in `src/utils/workOrderEngine.ts` |
| **Example seed WO** | Subcontract paint (`SA-PAINT-SYS`) — validated in `scripts/test-wo-flow.ts` |

**Subcontract-specific UI:** `WorkOrderDetailPage` tab `subcontract` (visible when `wo.woType === 'subcontract'`).

**Gap:** No dedicated "Job Work Order" register, 360, or nav label distinct from generic Work Orders.

---

## 5. Material Send to Vendor

**Status: Partially Implemented**

Implemented **inside** `WorkOrderDetailPage` subcontract tab — not a standalone screen or route.

| Item | Value |
|------|-------|
| **Route** | `/work-orders/:id` → tab **Subcontract** |
| **UI** | Section **"Send Material to Vendor"** — line, vendor, challan, qty, expected return date, **Send to Vendor** button |
| **File (UI)** | `src/modules/workorder/WorkOrderPages.tsx` (~lines 863–890) |
| **Store** | `sendSubcontractMaterial` in `src/store/workOrderStore.ts` |
| **Inventory** | `postSubcontractOut` → movement type `SUBCON_OUT` (`src/store/inventoryStore.ts`) |
| **Entity** | `SubcontractShipment` (`src/types/workorder.ts`) |

**Constraints (store):** Only `wo.woType === 'subcontract'` (`workOrderStore.ts`).

**Gap:** No top-level Procurement/Shop Floor route for send challan; must open subcontract WO detail.

---

## 6. Material Receive from Vendor

**Status: Partially Implemented**

Same embedding as send — subcontract tab on WO detail.

| Item | Value |
|------|-------|
| **Route** | `/work-orders/:id` → tab **Subcontract** |
| **UI** | Section **"Receive Processed Material"** — shipment select, received qty, rejected qty, **Record Receipt** |
| **File (UI)** | `src/modules/workorder/WorkOrderPages.tsx` (~lines 892–915) |
| **Store** | `receiveSubcontractMaterial` in `src/store/workOrderStore.ts` |
| **Inventory** | `postSubcontractIn` → movement type `SUBCON_IN` (`src/store/inventoryStore.ts`) |
| **Table** | Shipment list via `DataTable` + `shipmentColumns` on same tab |

**Gap:** No GRN-style incoming screen for subcontract returns; no standalone receive queue.

---

## 7. Vendor Job Work Costing

**Status: Partially Implemented**

Subcontract cost is computed at **work order** level, not exposed as a **vendor job work** costing workspace or on Vendor 360.

### WO-level costing (subcontract line present)

| Route | Component | File |
|-------|-----------|------|
| `/work-orders/:id` → tab **Cost** | `WorkOrderCostPanel` | `src/components/costing/WorkOrderCostPanel.tsx` |

**Cost row:** `Subcontract` planned vs actual (`WorkOrderCostPanel.tsx` lines 115–119).

| Store / engine | File |
|----------------|------|
| `getCostSheet` | `src/store/costingStore.ts` |
| `computePlannedSubcontract`, `computeActualSubcontract` | `src/utils/costEngine.ts` |

### Module costing dashboard (all WOs, not vendor-job-specific)

| Route | Component | File |
|-------|-----------|------|
| `/costing` | `CostingDashboardPage` | `src/modules/costing/CostingPages.tsx` |

**Nav:** Shop Floor → WO Costing (`src/config/navigation.ts`)

**Tabs:** dashboard, wo-sheets, product, variance, profitability.

### Vendor 360

`Vendor360Page` spend/performance tabs use **purchase order** spend only (`useVendor360` in `src/utils/entity360Metrics.ts`). **No** `subcontractShipments` or subcontract WO cost aggregation.

**Gap:** No vendor-centric job-work cost register (open/completed subcontract WOs, challan value, processing cost by vendor).

---

## 8. Vendor Job Work QC

**Status: Partially Implemented**

| Capability | Exists? | Evidence |
|------------|---------|----------|
| Rejected qty on subcontract receive | Yes | `receiveSubcontractMaterial(..., rejectedQty)` updates `SubcontractShipment.rejectedQty` (`workOrderStore.ts`) |
| QC inspection on subcontract receive | **No** | `receiveSubcontractMaterial` does not call `qualityStore` or create `QcInspection` |
| NCR on subcontract reject | **No** | No NCR creation in receive flow |
| Vendor 360 → Quality tab | Partial | Shows NCRs filtered by **vendor-supplied item IDs** (purchase/incoming path), not subcontract job work (`Vendor360Page.tsx`, `useVendor360`) |
| Incoming QC queue | Separate | `/quality/incoming` → `IncomingQcQueuePage` — **GRN** inspections only (`QualityProductionPages.tsx`) |

**Routes related to quality (not subcontract-job-QC-specific):**

| Route | Component |
|-------|-----------|
| `/quality/queue` | `QcQueuePage` |
| `/quality/incoming` | `IncomingQcQueuePage` |
| `/quality/inspections/:id` | `QcInspectionDetailPage` |

In-house job QC **is** implemented via job card complete → inspection queue (`completeJobCard` → `qualityStore`).

**Gap:** No vendor job work QC plan, inspection record, or NCR workflow tied to subcontract shipment receive (beyond a numeric rejected qty field).

---

## 9. Vendor 360

**Status: Implemented**

| Item | Value |
|------|-------|
| **Route** | `/masters/vendors/:id` |
| **Component** | `Vendor360Page` |
| **Route alias** | `VendorDetailPage` export from `src/modules/entity360/index.ts` |
| **File** | `src/modules/entity360/Vendor360Page.tsx` |
| **Shell** | `Entity360Shell` (`src/components/design-system/Entity360Shell.tsx`) |
| **Metrics hook** | `useVendor360(vendorId)` — `src/utils/entity360Metrics.ts` |
| **List route** | `/masters/vendors` → `VendorListPage` |
| **Edit route** | `/masters/vendors/:id/edit` → `VendorFormPage` |
| **Navigation** | Master Data → Vendor Master |

**Tabs:** overview, purchase, quality, spend, performance.

**Insights strip:** Rating, Open PO, On-Time %, Quality Score, Spend (YTD).

**Note:** Quality tab reflects PO/GRN-linked NCRs via supplied items — **not** subcontract job-work QC (see §8).

---

## 10. Item 360

**Status: Implemented**

| Item | Value |
|------|-------|
| **Route** | `/masters/items/:id` |
| **Component** | `Item360Page` |
| **Route alias** | `ItemDetailPage` export from `src/modules/entity360/index.ts` |
| **File** | `src/modules/entity360/Item360Page.tsx` |
| **Shell** | `Entity360Shell` |
| **Metrics hook** | `useItem360(itemId)` — `src/utils/entity360Metrics.ts` |
| **List route** | `/masters/items` → `ItemListPage` |
| **Edit route** | `/masters/items/:id/edit` → `ItemFormPage` |
| **Stock detail** | `/inventory/stock/:itemId` → `ItemStockDetailPage` (separate from 360) |
| **Navigation** | Master Data → Item Master |

**Tabs:** overview, inventory, purchase, consumption, mrp, transactions, timeline.

**Insights strip:** On Hand, Available, Stock Value, MRP Shortage, Open PO.

**Command bar:** Material Inward, Stock Ledger, Create PR, MRP Workbench.

---

## Route Map (Execution Layer)

```
/shop-floor                          ShopFloorJobQueuePage          ✅ Shop Floor Queue
/work-orders                         WorkOrderListPage
/work-orders/:id                     WorkOrderDetailPage            ⚠️ WO detail (not 360)
/work-orders/:id?tab=operations       → JobCardPanel embedded
/work-orders/:id?tab=subcontract      → Send/Receive to Vendor
/work-orders/:id?tab=cost            → WorkOrderCostPanel
/costing                             CostingDashboardPage           ⚠️ WO costing module
/production                          ProductionControlTowerPage     (links to /shop-floor)
/masters/vendors/:id                 Vendor360Page                  ✅ Vendor 360
/masters/items/:id                   Item360Page                    ✅ Item 360
```

**Not routed:** Work Order 360, Job Card Workbench, standalone Material Send/Receive, Vendor Job Work Costing screen, Vendor Job Work QC screen.

---

## Store & Type References (Subcontract / Job Cards)

| Symbol | File |
|--------|------|
| `JobCard`, `SubcontractShipment` | `src/types/workorder.ts` |
| `jobCards`, `subcontractShipments` state | `src/store/workOrderStore.ts` |
| `sendSubcontractMaterial`, `receiveSubcontractMaterial` | `src/store/workOrderStore.ts` |
| `startJobCard`, `pauseJobCard`, `completeJobCard` | `src/store/workOrderStore.ts` |
| `SUBCON_OUT`, `SUBCON_IN` movement types | `src/types/inventory.ts` |

---

## Recommended Next Builds (execution layer only)

Based on gaps found in code (not product roadmap):

| Priority | Item | Why |
|----------|------|-----|
| 1 | **Work Order 360** (`Entity360Shell` + `useWorkOrder360`) | WO detail exists but is not an intelligence workspace |
| 2 | **Job Card Workbench** route (or rename `/shop-floor` in nav) | No named workbench; split UX |
| 3 | **Vendor Job Work QC** on subcontract receive | `rejectedQty` only; no inspection/NCR |
| 4 | **Vendor Job Work Costing** on Vendor 360 or subcontract register | Cost exists on WO tab only |
| 5 | Standalone **Subcontract Send/Receive** register | Currently buried in WO detail tab |

---

*Audit performed against `trailer-erp` source tree. All route and component names verified via `src/routes/index.tsx`, `src/config/navigation.ts`, and file search.*
