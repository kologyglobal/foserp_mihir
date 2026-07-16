# Control Tower Completion Report

**Date:** 23 Jun 2026  
**Scope:** Production Control Tower, MRP Planner Workbench, Executive Dashboard, Unified Inbox  
**Constraint:** No new stores; no business logic changes; existing SO, MRP, WO, Job Card, QC, Inventory, Dispatch, and Invoice data only.

---

## Routes

| Workspace | Route | Legacy redirect |
|-----------|--------|-----------------|
| **Executive Dashboard** | `/executive` | `/` → `/executive` |
| **Production Control Tower** | `/production/control-tower` | `/production` → `/production/control-tower` |
| **MRP Planner Workbench** | `/mrp/planner` | `/mrp/workbench` → `/mrp/planner` |
| **Unified Inbox** | `/inbox` | — |

Route helpers: `src/config/controlTowerRoutes.ts` (`CONTROL_TOWER_ROUTES`, `wo360Path`, `item360Path`, `vendor360Path`)

---

## 1. Production Control Tower

**Page:** `src/modules/control-towers/ProductionControlTowerPage.tsx`  
**Metrics:** `getProductionControlTowerData` / `useProductionControlTower`

| KPI / Queue | Source |
|-------------|--------|
| Running Work Orders | `workOrderStore` — status `in_production` |
| Late Work Orders | WOs past `plannedFinishDate` (excludes closed/cancelled/completed) |
| QC Holds | Job cards on `qc_hold` + pending inspections |
| Rework Jobs | `qualityStore.getOpenReworks()` |
| Material Shortages | Latest MRP run + WO material lines with balance |
| WIP by Work Center | Active job cards grouped by `workCenterCode` |
| Capacity Utilization | Running WOs / active WOs |
| Today's Job Cards | In progress, assigned, or started today |
| Blocked Operations | Active WO operations on `qc_hold` or `pending` |

**Actions:** Open WO 360 · Job Cards · QC Queue · Material Shortage · Dispatch Ready

---

## 2. MRP Planner Workbench

**Page:** `src/modules/control-towers/MrpPlannerWorkbenchPage.tsx`  
**Metrics:** `getMrpPlannerWorkbenchData` / `useMrpPlannerWorkbench`

| Tab | Content |
|-----|---------|
| Material Shortages | Latest MRP run lines with `shortageQty > 0` |
| Late Supply | Delayed MRP materials + delayed PO report |
| Purchase Required | Lines with suggested PR/PO qty |
| Expedite Required | Purchase-required lines with shortages |
| Reschedule Suggestions | Critical/delayed at-risk materials |
| SO Readiness | Open SO material coverage and shortage counts |
| WO Shortages | Active WOs with material balance gaps |
| Demand vs Supply | Total required qty vs free stock + suggested PO |

**Actions:** Run MRP · Create PR · Reserve Stock · Open Item 360 · Open Vendor 360

---

## 3. Executive Dashboard

**Page:** `src/modules/control-towers/ExecutiveDashboardPage.tsx`  
**Metrics:** `getExecutiveDashboardData` / `useExecutiveDashboard`

| KPI | Calculation |
|-----|-------------|
| Order Book Value | Open SO `grandTotal` sum |
| Production Value | Active WO qty × product standard cost |
| WIP Value | Issued material qty × item standard rate |
| FG Value | FG warehouse stock × standard rate |
| Dispatch Value | Pending dispatch product standard price |
| Invoice Value | Posted invoice grand total |
| Payment Received | Posted invoice `amountPaid` |
| Outstanding | Receivable `balanceDue` |
| Delayed Orders | Late open SO + delayed PO count |
| Open NCR | Quality metrics |
| Cost Variance | Abs variance from costing report |
| Capacity Utilization | Running WOs / active WOs |

Includes value snapshot bar chart, late WO grid, open SO grid, and attention list from workspace notifications.

---

## 4. Unified Inbox

**Page:** `src/modules/control-towers/UnifiedInboxPage.tsx`  
**Metrics:** `getUnifiedInboxData` / `useUnifiedInbox`

| Stream | Source |
|--------|--------|
| My Approvals | Submitted PRs, POs, customer quotation approvals |
| My Tasks | Active job cards, pending QC inspections |
| My Alerts | Workspace notifications, dispatch pending, payment pending, delayed WOs |
| QC Pending | `getPendingInspections()` count |
| PO Approval Pending | Submitted PO count |
| Dispatch Pending | Non-delivered dispatches |
| Payment Pending | Invoices with `balanceDue > 0` |
| Delayed Work Orders | Late WO count |

Tabs: My Work (merged, severity-sorted) · Approvals · Tasks · Alerts. Row click navigates to linked detail page.

---

## UX

- `OperationalPageShell` on all four towers
- KPI insight cards with semantic accent tokens (`red`, `amber`, `green`, `blue`)
- `DataGrid` for all tabular data — no raw `<table>` elements
- `EmptyState` via DataGrid empty messages
- `StatusBadge` and semantic severity dots (`bg-erp-danger-solid`, etc.)
- Command bars for quick actions
- No hardcoded slate/emerald/red Tailwind colors

---

## Navigation

Sidebar (`src/config/navigation.ts` — Executive category):

| Label | Path |
|-------|------|
| Executive | `/executive` |
| Inbox | `/inbox` |
| Production Control Tower | `/production/control-tower` |
| MRP Planner | `/mrp/planner` |

Breadcrumbs updated in `src/utils/pageNavigation.ts` for canonical paths.

---

## Tests

```bash
npm run test:control-towers
```

**Script:** `scripts/test-control-towers.ts`

| # | Test | Status |
|---|------|--------|
| 1 | All control tower routes resolve | ✓ |
| 2 | Production tower shows WO/QC/WIP/job card data | ✓ |
| 3 | MRP planner shows shortage and supply data | ✓ |
| 4 | Executive dashboard calculations match existing data | ✓ |
| 5 | Inbox aggregates approvals/tasks/alerts | ✓ |
| 6 | Links open correct 360/detail pages | ✓ |

**Result:** 6/6 passed

---

## Build

```bash
npm run build
```

TypeScript + Vite production build: **passing**

---

## Key Files

| File | Purpose |
|------|---------|
| `src/utils/controlTowerMetrics.ts` | Read-only aggregation getters + React hooks |
| `src/config/controlTowerRoutes.ts` | Route constants and path builders |
| `src/modules/control-towers/ControlTowerRedirects.tsx` | Legacy path redirects |
| `src/modules/control-towers/*.tsx` | Four tower pages |
| `scripts/test-control-towers.ts` | Integration test suite |

---

## Notes

- All metrics read from existing Zustand stores (`mrpStore`, `workOrderStore`, `qualityStore`, `purchaseStore`, `dispatchStore`, `invoiceStore`, `inventoryStore`, `costingStore`, `masterStore`, `salesStore`).
- MRP Planner demand/supply uses `requiredQty` vs `freeStock + suggestedPoQty` from latest MRP run material lines.
- Production tower capacity and executive capacity share the same running/active WO ratio formula.
- Legacy links to `/production` and `/mrp/workbench` redirect to canonical control tower routes.
