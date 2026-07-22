# Phase 8A — Frontend Route Matrix (spot audit)

**Date:** 2026-07-21  
**Sources:** `frontend/src/routes/{manufacturing,production,quality,dispatchFinance,accounting}Routes.tsx`, `ProtectedOutlet` / `canRoute` (`frontend/src/components/auth/ProtectedRoute.tsx`, `frontend/src/utils/permissions/index.ts`), `ROUTE_PERMISSION_MAP` (`frontend/src/config/permissionMatrix.ts`), manufacturing route map (`frontend/src/utils/permissions/manufacturing.ts`).  
**Scope:** Manufacturing + quality + dispatch + key accounting routes. Spot-check only.

---

## Out of scope (spot-check)

Full negative permission tests and cross-tenant live runs are **OUT OF SCOPE** for this matrix unless already evidenced in existing test files. Tenant-isolation evidence (finance / CRM / manufacturing / quality / inventory) is listed in [`PHASE8A_PERMISSION_MATRIX_VERIFIED.md`](./PHASE8A_PERMISSION_MATRIX_VERIFIED.md#tenant-isolation-evidence-existing-tests).

---

## Legend

| Column | Meaning |
|--------|---------|
| **Dual-mode** | How `isApiMode()` / `VITE_USE_API` affects the mounted component or data path |
| **Refresh risk** | Likelihood that a hard refresh loses ephemeral UI state or remounts onto demo/seed data unexpectedly |
| **Route perm (ProtectedOutlet)** | Permission checked by `canRoute` before render; `—` = no prefix match (open at shell) |
| **Demo-heavy** | Zustand/demo store or demo-only UX; not a full API dual-mode bridge |

**Refresh risk scale:** `none` (redirect) · `low` (API fetch-on-mount) · `med` (dual-mode / soft gates) · `high` (demo store / scan ephemeral / API-mode leakage candidate per mock audit)

---

## Gate behaviour (important)

| Path family | Shell gate |
|-------------|------------|
| `/manufacturing/*` | `canManufacturingRoute` → fine-grained `manufacturing.*` (overrides coarse `production.view` in matrix) |
| `/quality/*` | `ROUTE_PERMISSION_MAP` → `quality.view` |
| `/dispatch/*` | `ROUTE_PERMISSION_MAP` → `dispatch.view` |
| `/production/*`, `/work-orders/*`, `/job-work/*`, `/shop-floor`, `/mrp/*` | `production.view` (legacy matrix module) |
| `/costing`, `/invoices*` | Matrix has `/costing` → `accounts.view`; `/invoice` (singular) → `accounts.view` — **`/invoices` is not mapped** (open at shell) |
| `/accounting/*` | **Not in `ROUTE_PERMISSION_MAP`** — shell open; page-level `use*Permissions` hooks only |

---

## 1. Manufacturing (`manufacturingRoutes.tsx`)

| Path | Component | Dual-mode | Refresh risk | Route perm | Demo-heavy |
|------|-----------|-----------|--------------|------------|------------|
| `/manufacturing` | `Navigate` → `/manufacturing/today` | — | none | `manufacturing.view` (fallback prefix) | — |
| `/manufacturing/control-room` | `ProductionControlRoomPage` | No route-level `isApiMode`; page uses mfg hooks | med | `manufacturing.dashboard.view` | Partial (control UI) |
| `/manufacturing/dashboard` | `ManufacturingDashboardPage` | No route switch | med | `manufacturing.dashboard.view` | **Yes** |
| `/manufacturing/shopfloor` | `ShopfloorViewPage` | No route switch | med | `manufacturing.work_orders.view` | **Yes** (demo WO store unless page hydrates API) |
| `/manufacturing/bom` | `BomRegisterPage` | No route switch | med | `manufacturing.bom.view` | **Yes** (legacy BOM UI) |
| `/manufacturing/bom/traveler-preview` | `BomTravelerPreviewPage` | No | med | `manufacturing.bom.view` | **Yes** |
| `/manufacturing/bom/new` | `BomFormPage` | No | med | `manufacturing.bom.view` | **Yes** |
| `/manufacturing/bom/:bomId/edit` | `BomFormPage` | No | med | `manufacturing.bom.view` | **Yes** |
| `/manufacturing/bom/:bomId` | `BomDetailPage` | No | med | `manufacturing.bom.view` | **Yes** |
| `/manufacturing/routes` | `RouteRegisterPage` | No | med | `manufacturing.routes.view` | **Yes** (legacy) |
| `/manufacturing/routes/new` | `RouteFormPage` | No | med | `manufacturing.routes.view` | **Yes** |
| `/manufacturing/routes/:routeId/edit` | `RouteFormPage` | No | med | `manufacturing.routes.view` | **Yes** |
| `/manufacturing/routes/:routeId` | `RouteDetailPage` | No | med | `manufacturing.routes.view` | **Yes** |
| `/manufacturing/production-plan` | `ProductionPlanPage` | No route switch | med | `manufacturing.production_plan.view` | Mixed |
| `/manufacturing/production-plan/new` | `ProductionPlanFormPage` | No | med | `manufacturing.production_plan.view` | Mixed |
| `/manufacturing/production-plan/:planId` | `ProductionPlanDetailPage` | No | med | `manufacturing.production_plan.view` | Mixed |
| `/manufacturing/today` | `TodayPage` | No | med | `manufacturing.control_room.view` | Mixed |
| `/manufacturing/daily-update` | `DailyUpdatePage` | No | med | `manufacturing.daily_production.view` | Mixed |
| `/manufacturing/my-work` | `MyWorkPage` | No | med | `manufacturing.operator.my_work` | Mixed |
| `/manufacturing/issues` | `IssuesQueuePage` | No | med | `manufacturing.issue.view` | Mixed |
| `/manufacturing/corrections` | `CorrectionsRegisterPage` | No | med | `manufacturing.correction.view` | Mixed (FE correction keys) |
| `/manufacturing/work-orders` | `ApiWorkOrderRegisterPage` **or** `WorkOrderRegisterPage` | **`isApiMode()`** | low (API) / med (demo) | `manufacturing.work_orders.view` | Demo branch **Yes** |
| `/manufacturing/work-orders/new` | `ApiWorkOrderCreatePage` **or** `WorkOrderFormPage` | **`isApiMode()`** | low / med | `manufacturing.work_orders.view` | Demo branch **Yes** |
| `/manufacturing/work-orders/:workOrderId/edit` | `WorkOrderFormPage` | **Always demo form** (no Api* edit) | high in API mode | `manufacturing.work_orders.view` | **Yes** |
| `/manufacturing/work-orders/:workOrderId` | `ApiWorkOrderDetailPage` **or** `WorkOrderDetailPage` | **`isApiMode()`** | low / med | `manufacturing.work_orders.view` | Demo branch **Yes** |
| `/manufacturing/job-work` | `JobWorkRegisterPage` | No route switch | med | `manufacturing.job_work.view` | **Yes** / partial API |
| `/manufacturing/job-work/new` | `JobWorkFormPage` | No | med | `manufacturing.job_work.view` | **Yes** |
| `/manufacturing/job-work/:jobWorkId/edit` | `JobWorkFormPage` | No | med | `manufacturing.job_work.view` | **Yes** |
| `/manufacturing/job-work/:jobWorkId` | `JobWorkDetailPage` | No | med | `manufacturing.job_work.view` | **Yes** |
| `/manufacturing/reports` | `ManufacturingReportsPage` | No | med | `manufacturing.reports.view` | **Yes** |
| `/manufacturing/settings` | `ManufacturingSettingsPage` | No | med | `manufacturing.settings.view` | **Yes** |
| `/manufacturing/setup` | `SetupHubPage` | API-oriented setup hub | low–med | `manufacturing.setup.view` | No (Phase 1 API) |
| `/manufacturing/profiles` | `ProfilesSetupPage` | API setup | low | `manufacturing.profile.view` | No |
| `/manufacturing/work-centres` | `WorkCentresSetupPage` | API setup | low | `manufacturing.work_centre.view` | No |
| `/manufacturing/machines` | `MachinesSetupPage` | API setup | low | `manufacturing.machine.view` | No |
| `/manufacturing/setup/boms` | `BomsSetupPage` | API setup | low | `manufacturing.bom.view` | No |
| `/manufacturing/setup/boms/:bomId` | `BomVersionEditorPage` | API setup | low | `manufacturing.bom.view` | No |
| `/manufacturing/setup/bom-versions/:versionId` | `BomVersionEditorPage` | API setup | low | `manufacturing.bom.view` | No |
| `/manufacturing/setup/routings` | `RoutingsSetupPage` | API setup | low | `manufacturing.routes.view` | No |
| `/manufacturing/setup/routings/:routingId` | `RoutingVersionEditorPage` | API setup | low | `manufacturing.routes.view` | No |
| `/manufacturing/setup/routing-versions/:versionId` | `RoutingVersionEditorPage` | API setup | low | `manufacturing.routes.view` | No |

---

## 2. Legacy production / MRP / scans (`productionRoutes.tsx`)

| Path | Component | Dual-mode | Refresh risk | Route perm | Demo-heavy |
|------|-----------|-----------|--------------|------------|------------|
| `/mrp` | `MRPDashboardPage` | No `isApiMode` | high | `production.view` | **Yes** |
| `/mrp/planner` | `MrpPlannerWorkbenchPage` | No | high | `production.view` | **Yes** |
| `/mrp/workbench` | `MrpPlannerRedirect` | Redirect helper | none–low | `production.view` | — |
| `/mrp/run` | `RunMRPPage` | No | high | `production.view` | **Yes** |
| `/mrp/runs/:id` | `MRPRunDetailPage` | No | high | `production.view` | **Yes** |
| `/production/control-tower` | `Navigate` → mfg control-room | — | none | `production.view` | — |
| `/production` | `Navigate` → `/manufacturing/today` | — | none | `production.view` | — |
| `/production/job-cards` | `Navigate` → WO register | — | none | `production.view` | — |
| `/production/scan/start` | `ScanOperationStartPage` | No | **high** (scan session) | `production.view` | **Yes** |
| `/production/scan/complete` | `ScanOperationCompletePage` | No | **high** | `production.view` | **Yes** |
| `/production/scan/wip-move` | `ScanWipMovePage` | No | **high** | `production.view` | **Yes** |
| `/shop-floor` | `ShopFloorJobQueuePage` | No | high | `production.view` | **Yes** |
| `/work-orders` | `Navigate` → mfg WO | — | none | `production.view` | — |
| `/work-orders/create-from-mrp` | `CreateWorkOrderFromMrpPage` | No | high | `production.view` | **Yes** |
| `/work-orders/:id/360` | `WorkOrder360Page` | No | high | `production.view` | **Yes** |
| `/work-orders/:id` | `WorkOrderDetailPage` (legacy module) | No | high | `production.view` | **Yes** |
| `/job-work` | `Navigate` → mfg job-work | — | none | `production.view` | — |
| `/job-work/scan/send` | `ScanSubcontractSendPage` | No | **high** | `production.view` | **Yes** |
| `/job-work/scan/receive` | `ScanSubcontractReceivePage` | No | **high** | `production.view` | **Yes** |
| `/job-work/vendors/:vendorId` | `VendorJobWorkWorkspacePage` | No | high | `production.view` | **Yes** |
| `/job-work/:id/print` | `JobWorkChallanPrintPage` | No | med | `production.view` | **Yes** |
| `/job-work/:id` | `JobWorkOrderDetailPage` | No | high | `production.view` | **Yes** |

---

## 3. Quality (`qualityRoutes.tsx`)

| Path | Component | Dual-mode | Refresh risk | Route perm | Demo-heavy |
|------|-----------|-----------|--------------|------------|------------|
| `/quality` | `QualityWorkspacePage` | No | med | `quality.view` | **Yes** (workspace chrome) |
| `/quality/queue` | `ApiQcQueuePage` **or** `QcQueuePage` | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/inspections/:id` | `ApiQcInspectionDetailPage` **or** `QcInspectionDetailPage` | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/rework` | `ReworkWorkbenchPage` | No route switch | high | `quality.view` | **Yes** (`qualityStore`) |
| `/quality/ncr` | `NcrRegisterPage` | No | high | `quality.view` | **Yes** |
| `/quality/ncr/:id` | `NcrDetailPage` | No | high | `quality.view` | **Yes** |
| `/quality/incoming` | `IncomingQcQueuePage` | No | high | `quality.view` | **Yes** (demo incoming) |
| `/quality/reports` | `QualityReportsPage` | No | high | `quality.view` | **Yes** |
| `/quality/parameters` | `ApiQcParameterMasterPage` **or** `QcParameterMasterPage` | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/parameters/new` | `ApiQcParameterFormPage` **or** `QcParameterFormPage` | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/parameters/:id` | Api **or** demo form | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/inspection-plans` | Api **or** demo master | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/inspection-plans/new` | Api **or** demo detail | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |
| `/quality/inspection-plans/:id` | Api **or** demo detail | **`isApiMode()`** | low / med | `quality.view` | Demo **Yes** |

---

## 4. Dispatch + costing + invoices (`dispatchFinanceRoutes.tsx`)

| Path | Component | Dual-mode | Refresh risk | Route perm | Demo-heavy |
|------|-----------|-----------|--------------|------------|------------|
| `/costing` | `CostingDashboardPage` | No | high | `accounts.view` | **Yes** |
| `/dispatch` | `DispatchWorkspacePage` | No | med | `dispatch.view` | **Yes** |
| `/dispatch/register` | `ApiOutboundDispatchRegisterPage` **or** `DispatchDashboardPage` | **`isApiMode()`** | low / med | `dispatch.view` | Demo **Yes** |
| `/dispatch/plan` | `DispatchPlanPage` | No | high | `dispatch.view` | **Yes** (`dispatchStore`) |
| `/dispatch/scan/trailer` | `ScanTrailerPage` | No | **high** | `dispatch.view` | **Yes** |
| `/dispatch/scan/dispatch` | `ScanDispatchConfirmPage` | No | **high** | `dispatch.view` | **Yes** |
| `/dispatch/reports` | `DispatchReportsPage` | No | high | `dispatch.view` | **Yes** |
| `/dispatch/:id/gate-pass` | `GatePassPrintPage` | No | med | `dispatch.view` | **Yes** |
| `/dispatch/:id` | `ApiOutboundDispatchDetailPage` **or** `DispatchDetailPage` | **`isApiMode()`** | low / med | `dispatch.view` | Demo **Yes** |
| `/invoices` | `FinanceWorkspacePage` | No | high | **—** (unmapped; open) | **Yes** |
| `/invoices/register` | `InvoiceDashboardPage` | No | high | **—** | **Yes** |
| `/invoices/:id` | `InvoiceDetailPage` | No | high | **—** | **Yes** |

---

## 5. Accounting — key live / dual-mode workspaces (`accountingRoutes.tsx`)

Route file comment: mix of dual-mode live workspaces and demo/UI-only screens. Shell: **no** `/accounting` entry in `ROUTE_PERMISSION_MAP`.

### 5.1 Journals, Money In, Money Out (API-oriented)

| Path prefix / route | Component family | Dual-mode notes | Refresh risk | Page-level perm hooks (not shell) | Demo-heavy |
|---------------------|------------------|-----------------|--------------|-----------------------------------|------------|
| `/accounting` | `AccountingDashboardPage` | Demo metrics likely | med–high | soft | Partial |
| `/accounting/coa`, `/accounting/chart-of-accounts*`, `/accounting/vouchers*` | `Navigate` / legacy redirects | → settings CoA / journals / GL | none | — | — |
| `/accounting/entries/journals*` | `JournalList/New/Detail/EditPage` | Bridge dual-mode (API + demo) | low–med | `finance.voucher.*` via finance/journal hooks | Dual |
| `/accounting/entries/approvals*` | `ApprovalInbox/DetailPage` | Dual | low–med | finance approval | Dual |
| `/accounting/money-in/**` | Money In AR pages | Dual (receivables bridge) | low–med | `finance.ar.*` (`moneyIn.ts`) | Dual |
| `/accounting/money-out/**` | Money Out AP pages | **API-first** (`requireApiMode` / `isApiMode` gates on many screens) | low | `finance.ap.*` (`moneyOut.ts`) | No (API); blocked/empty off-API |
| `/accounting/money-out/reconciliation*`, `close-gate*` | AP recon / close gate | API mode | low | `finance.ap.reconciliation.*` / `close_gate.*` | No |
| `/accounting/settings/**` | Finance settings (LE, FY, CoA, periods, …) | Dual via finance bridge | low–med | `finance.*` (`finance.ts`) | Dual |

### 5.2 Legacy AR/AP UI (demo-heavy parallel to Money In/Out)

| Path prefix | Component family | Dual-mode | Refresh risk | Notes |
|-------------|------------------|-----------|--------------|-------|
| `/accounting/receivables/**` | Receivables dashboard, receipts, ageing, … | **Demo FE** (`accounting.receivables.*`) | high | Superseded operationally by Money In |
| `/accounting/payables/**` | Payables dashboard, payments, proposals, … | **Demo FE** (`accounting.payables.*`) | high | Superseded by Money Out |
| `/accounting/commercial-commitments` | `CommercialCommitmentsPage` | Demo | high | Demo |

### 5.3 Bank & Cash / Treasury

| Path prefix | Dual-mode | Refresh risk | Demo-heavy |
|-------------|-----------|--------------|------------|
| `/accounting/bank-cash/**` (liquidity, accounts, transfers, statements, reconciliation, cheques, SI, books, connectors, …) | Live treasury pages use `finance.treasury.*` / bank recon hooks; older deposits/cash-count/setup still demo-flavoured | low–med (live) / high (legacy cash-count) | **Mixed** — transfers/statements/recon = API; deposits/cash-counts/reports/setup often demo |
| `/accounting/bank`, `/accounting/bank/:id/reconcile` | Redirects into bank-cash | none | — |

### 5.4 Fixed Assets, Manufacturing Costing, Tax, Budgeting, Period Close, Reports, Ledger

| Path prefix | Dual-mode | Refresh risk | Demo-heavy | FE perm namespace |
|-------------|-----------|--------------|------------|-----------------|
| `/accounting/fixed-assets/**` | Partial API (`finance.fa.*`) + demo UI | med–high | **Mostly yes** | `accounting.fixed_assets.*` (+ API map `finance.fa.*`) |
| `/accounting/manufacturing/**` | Demo costing UI | high | **Yes** | `accounting.mfg_costing.*` |
| `/accounting/tax-compliance/**` | Demo / extract UI | high | **Yes** | `accounting.tax.*` |
| `/accounting/budgeting/**` | Demo | high | **Yes** | `accounting.budgeting.*` |
| `/accounting/period-close/**` | Demo UI; some map to `finance.period.*` | high | **Yes** | `accounting.period_close.*` |
| `/accounting/ledger-entries/**` | Dual / GL reads | med | Mixed | `accounting.ledger.*` / `finance.gl.view` |
| `/accounting/reports/**` | Demo financial reports | high | **Yes** | `accounting.reports.*` |

---

## Spot findings (routes)

1. **Explicit `isApiMode()` route swaps:** manufacturing work-orders (list/new/detail), quality queue/inspections/parameters/plans, dispatch register/detail.
2. **Always-demo edit path:** `/manufacturing/work-orders/:id/edit` mounts demo `WorkOrderFormPage` even when API mode.
3. **Accounting shell is ungated** at `ProtectedOutlet`; rely on page hooks — easy to deep-link without coarse deny.
4. **`/invoices*`** missing from `ROUTE_PERMISSION_MAP` (only `/invoice` singular exists).
5. **Largest demo-heavy surfaces:** legacy production/MRP/scans, quality NCR/rework/incoming, dispatch plan/scans, accounting receivables/payables/budgeting/tax/period-close/mfg costing/reports.

---

## Related Phase 8A docs

- [`PHASE8A_MOCK_DEMO_AUDIT.md`](./PHASE8A_MOCK_DEMO_AUDIT.md) — API-mode leakage candidates  
- [`PHASE8A_PERMISSION_MATRIX_VERIFIED.md`](./PHASE8A_PERMISSION_MATRIX_VERIFIED.md) — permission catalog vs FE hooks  
