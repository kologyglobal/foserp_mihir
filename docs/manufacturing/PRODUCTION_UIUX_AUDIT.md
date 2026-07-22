# Production UI/UX Audit — Reusable Patterns Inventory

> **Read-only audit** (2026-07-20). Do **not** redesign CRM/Accounting. Prefer **Accounting** patterns first, then **CRM**, then shared ERP design system.  
> When docs and code disagree, **code wins**. Related: [`PURCHASE_UI_CONSISTENCY.md`](../PURCHASE_UI_CONSISTENCY.md) · [`UI_VIEW_PAGE_STANDARD.md`](../UI_VIEW_PAGE_STANDARD.md) · [`PURCHASE_LIST_PAGE_STANDARD.md`](../PURCHASE_LIST_PAGE_STANDARD.md)  
> Companion skeletons: [`PRODUCTION_UIUX_COMPONENT_MAP.md`](PRODUCTION_UIUX_COMPONENT_MAP.md) · [`PRODUCTION_UIUX_GUIDELINES.md`](PRODUCTION_UIUX_GUIDELINES.md)

---

## 1. Goal & preference order

| Priority | Source | Why |
|----------|--------|-----|
| 1 | **Accounting** workspaces (Money In/Out, Journals, Bank & Cash, Treasury) | Newest operational ERP chrome: `OperationalPageShell` + `DynamicsTabs` + lifecycle command bars + posting badges + drawers |
| 2 | **CRM** registers & 360 | Mature list/filter/KPI/saved-views + entity detail tabs + activity timeline + quick-create |
| 3 | **Shared ERP / Dynamics** | Tokens, shells, grids, confirms, toasts — reuse; do not invent Ant Design / MUI / Bootstrap |

**Forbidden for Production modernisation:** new third-party UI kits; purple/glow “AI demo” chrome; one-off page shells; mixing demo seed with API data on the same screen.

---

## 2. Production / Manufacturing entry points

### 2.1 Canonical routes (live nav)

Defined in `frontend/src/routes/manufacturingRoutes.tsx` and `frontend/src/config/navigation.ts` (Manufacturing group).

| Route | Main page file | Mode notes |
|-------|----------------|------------|
| `/manufacturing` | → redirect `/manufacturing/control-room` | Hub |
| `/manufacturing/control-room` | `frontend/src/modules/manufacturing/ProductionControlRoomPage.tsx` (+ `ApiProductionControlRoomView.tsx`) | Dual: `isApiMode()` branches |
| `/manufacturing/dashboard` | `frontend/src/modules/manufacturing/ManufacturingDashboardPage.tsx` | Demo-heavy |
| `/manufacturing/today` | `frontend/src/modules/manufacturing/today/TodayPage.tsx` | Phase 2B |
| `/manufacturing/daily-update` | `frontend/src/modules/manufacturing/daily-update/DailyUpdatePage.tsx` | Phase 2B |
| `/manufacturing/my-work` | `frontend/src/modules/manufacturing/operator/MyWorkPage.tsx` | Operator UX |
| `/manufacturing/issues` | `frontend/src/modules/manufacturing/issues/IssuesQueuePage.tsx` | Phase 2B |
| `/manufacturing/shopfloor` | `frontend/src/modules/manufacturing/shopfloor/ShopfloorViewPage.tsx` | Demo board |
| `/manufacturing/bom` (+ new/edit/detail/traveler) | `frontend/src/modules/manufacturing/bom/*` | Demo register |
| `/manufacturing/routes` (+ new/edit/detail) | `frontend/src/modules/manufacturing/routes/*` | Demo routes |
| `/manufacturing/production-plan` (+ new/detail) | `frontend/src/modules/manufacturing/production-plan/*` | Demo plan |
| `/manufacturing/work-orders` | `ApiWorkOrderRegisterPage.tsx` **or** `WorkOrderRegisterPage.tsx` | **Route-level dual-mode** |
| `/manufacturing/work-orders/new` | `ApiWorkOrderCreatePage.tsx` **or** `WorkOrderFormPage.tsx` | Dual-mode |
| `/manufacturing/work-orders/:id` | `ApiWorkOrderDetailPage.tsx` **or** `WorkOrderDetailPage.tsx` | Dual-mode (+ Phase 5A runtime changes) |
| `/manufacturing/job-work` (+ new/edit/detail) | `frontend/src/modules/manufacturing/job-work/*` | Phase 4B dual-mode service |
| `/manufacturing/reports` | `frontend/src/modules/manufacturing/reports/ManufacturingReportsPage.tsx` | Placeholder-ish |
| `/manufacturing/settings` | `frontend/src/modules/manufacturing/settings/ManufacturingSettingsPage.tsx` | Settings |
| `/manufacturing/setup` (+ profiles, WC, machines, BOMs, routings) | `frontend/src/modules/manufacturing/setup/*` | Phase 1 masters (API) |

### 2.2 Legacy / parallel production URLs

| Route | File / behaviour |
|-------|------------------|
| `/production`, `/production/control-tower` | Redirect → `/manufacturing/control-room` (`frontend/src/routes/productionRoutes.tsx`) |
| `/production/job-cards`, scan routes | Legacy execution / barcode modules under `modules/execution-layer`, `modules/barcode` |
| `frontend/src/modules/production/ProductionPage.tsx` | **Legacy demo** — `PageHeader` + `Card` + seed; not the manufacturing nav hub |

### 2.3 Shared manufacturing chrome (today)

| File | Role |
|------|------|
| `frontend/src/components/manufacturing/ManufacturingUx.tsx` | Demo banner, AI assist boxes, status chips |
| `frontend/src/components/manufacturing/ManufacturingRoleBar.tsx` | Role switcher (demo UX) |
| `frontend/src/components/manufacturing/ManufacturingCommandCenter.tsx` | Command map |
| `frontend/src/components/manufacturing/ManufacturingActionDrawer.tsx` | Action drawers |
| `frontend/src/modules/manufacturing/setup/ManufacturingSetupShell.tsx` | Setup workspace shell |
| `frontend/src/utils/permissions/manufacturing.ts` | Permission hooks |

---

## 3. Reference CRM surfaces (copy patterns from)

| Surface | Route(s) | Primary file(s) |
|---------|----------|-----------------|
| Dashboard | `/crm` | `frontend/src/modules/crm/CrmDashboardPage.tsx` |
| Leads list | `/crm/leads` | `CrmLeadListPage.tsx` / sales `LeadListPage`; table `components/crm/CrmLeadsTable.tsx` |
| Lead detail / 360 | `/crm/leads/:id` | Lead 360 workspace: `Lead360Workspace.tsx`, `Lead360RecordHeader.tsx` |
| Opportunities | `/crm/opportunities`, `…/:id` | `OpportunityPages.tsx`, `Opportunity360Page.tsx` |
| Quotations | `/crm/quotations/*` | `modules/quotations/*`, `Quotation360Page.tsx` |
| Sales orders | `/crm/sales-orders`, `…/:id` | `CrmSalesOrderListPage.tsx`, `SalesOrder360Page.tsx` |
| Guided deal | `/crm/guided-deal` | `GuidedDealFlowPage.tsx` |
| Masters hub | `/crm/masters` | `masters/CrmMastersHubPage.tsx`, `CrmMasterPages.tsx` |
| Quick-create | global menu | `components/crm/quick-create/*`, `CrmQuickCreateDrawers.tsx` |
| Activity timeline | 360 pages | `ActivityTimeline.tsx`, `GroupedActivityTimeline.tsx`, `CrmUnifiedActivityFeed.tsx` |

Routes: `frontend/src/routes/crmRoutes.tsx`, `quotationRoutes.tsx`.

---

## 4. Reference Accounting surfaces (preferred)

| Surface | Route(s) | Primary file(s) |
|---------|----------|-----------------|
| Overview / dashboard | `/accounting` | `AccountingDashboardPage.tsx` |
| Journals list / detail | `/accounting/entries/journals`, `…/:id` | `journals/JournalListPage.tsx` (etc.), `JournalDetailPage.tsx`, `JournalsWorkspaceShell.tsx` |
| Approvals | `/accounting/entries/approvals` | Journals workspace approvals tab + `approvalApiBridge` |
| Money In | `/accounting/money-in/*` | `MoneyInWorkspaceShell.tsx`, `MoneyInOverviewPage.tsx`, invoices/receipts/credit-notes |
| Receipts | `/accounting/money-in/receipts/*` | `money-in/receipts/*` |
| Credit notes | `/accounting/money-in/credit-notes/*` | `money-in/credit-notes/*` |
| Money Out / AP | `/accounting/money-out/*` | `MoneyOutWorkspaceShell.tsx` + vendor invoices/payments |
| Bank & Cash / Treasury | `/accounting/bank-cash/*` | `BankCashOverviewPage.tsx`, treasury shells (statements, recon, transfers, cheques) |
| Settings | `/accounting/settings` | `settings/FinanceSettingsShell.tsx`, `FinanceSettingsOverviewPage.tsx` |
| Summary cards | various | e.g. `components/accounting/bankCash/BankCashSummaryCards.tsx`, `receivables/ReceivablesSummaryCards.tsx`, `payables/PayablesSummaryCards.tsx` |
| Drawers / posting | various | `PostingPreviewDrawer.tsx`, `BankCashDrawerShell.tsx`, `PayableDrawerShell.tsx`, money-in `ValidationDrawer.tsx` |
| Status / posting badges | various | `DynamicsStatusChip`, `BankCashStatusBadge`, `PayableStatusBadge`, ledger `LedgerStatusBadge`, vouchers `VoucherBadges` |

Routes: `frontend/src/routes/accountingRoutes.tsx`.

---

## 5. Pattern catalogue (by category)

For each category: **exact paths**, brief usage, **preferred source** (Accounting > CRM > Shared).

### 5.1 Page shell

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/design-system/OperationalPageShell.tsx` | Standard list/ops shell; `variant="dynamics"` + `layout="enterprise"` | **Shared** (Accounting gold path) |
| `frontend/src/modules/accounting/money-in/MoneyInWorkspaceShell.tsx` | Workspace = shell + tabs + LE switcher | **Accounting** |
| `frontend/src/modules/accounting/money-out/MoneyOutWorkspaceShell.tsx` | Same for AP | **Accounting** |
| `frontend/src/modules/accounting/journals/JournalsWorkspaceShell.tsx` | Journals / approvals workspace | **Accounting** |
| `frontend/src/modules/manufacturing/setup/ManufacturingSetupShell.tsx` | Setup hub shell (already closer to Dynamics) | Manufacturing (keep aligned) |
| `frontend/src/components/crm/CrmPageShell.tsx` | Older SaaS shell — **avoid for new Production** | Legacy CRM |
| `frontend/src/components/premium/PremiumPageShell.tsx` | Premium variant — use only if already on sibling screens | Shared (secondary) |

### 5.2 Page header / record header

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `OperationalPageShell` title/actions/`mergeHeaderWithWorkspace` | List & workspace titles into Dynamics chrome | **Accounting** |
| `frontend/src/components/dynamics/DynamicsRecordHeader.tsx` | Sticky document header | **Accounting** / Dynamics |
| `frontend/src/components/crm/Lead360RecordHeader.tsx` | Entity 360 header | **CRM** (detail) |
| `frontend/src/components/crm/Opportunity360RecordHeader.tsx` | Opportunity 360 header | **CRM** |
| `frontend/src/components/erp/card-form/ErpCardCommandBar.tsx` | Card-form sticky commands | Shared |
| `frontend/src/components/ui/PageHeader.tsx` | Legacy — **do not use on new Production** | Avoid |

### 5.3 Breadcrumbs

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `OperationalPageShell` `breadcrumbs` / `autoBreadcrumbs` | Built via `utils/pageNavigation` | **Shared** |
| `frontend/src/components/ui/Breadcrumbs.tsx` | Breadcrumb control | Shared |
| `frontend/src/design-system/components/Breadcrumb.tsx` | Alternate DS breadcrumb | Shared (secondary) |

### 5.4 Primary / secondary actions (command bar)

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/erp/ErpCommandBar.tsx` | Primary list/detail actions | **Shared** (Accounting + CRM registers) |
| `frontend/src/components/dynamics/DynamicsCommandBar.tsx` | Dynamics-styled commands | **Accounting** |
| `frontend/src/components/erp/ErpButton.tsx` | Button variants | Shared |
| `frontend/src/components/erp/FormActionBar.tsx` | Form save/cancel sticky bar | Shared |
| `frontend/src/components/design-system/StickyCommandBar.tsx` | Sticky bar used by shell | Shared |
| `frontend/src/components/crm/CrmFormSaveCommandBar.tsx` | CRM form save pattern | CRM |

### 5.5 KPI / summary cards

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/design-system/enterprise/EnterpriseKpiStrip.tsx` + `EnterpriseKpiCard.tsx` | Register KPI strip (CRM leads, Purchase) | **CRM**/Shared |
| `frontend/src/components/dynamics/DynamicsKpiTile.tsx` | Dashboard KPI tiles | **Accounting** dashboard |
| `frontend/src/components/accounting/bankCash/BankCashSummaryCards.tsx` | Module summary cards | **Accounting** |
| `frontend/src/components/accounting/receivables/ReceivablesSummaryCards.tsx` | AR summary | **Accounting** |
| `frontend/src/components/accounting/payables/PayablesSummaryCards.tsx` | AP summary | **Accounting** |
| `frontend/src/components/design-system/KPIWidget.tsx` | Generic KPI widget | Shared |
| `frontend/src/components/ui/StatCard.tsx` | Used by old `CrmPageShell` | Avoid for new |

### 5.6 Search / filter bar

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/dynamics/DynamicsFilterRow.tsx` | Compact filter row | **Accounting** |
| `frontend/src/components/design-system/SmartFilterBar.tsx` | Smart filter bar | Shared |
| `frontend/src/components/crm/CrmFilterDrawer.tsx` | Advanced filter drawer + chips | **CRM** (registers) |
| `frontend/src/components/crm/CrmListFilterBar.tsx` | Sort/filter controls | **CRM** |
| `frontend/src/design-system/list-page/EnterpriseRegisterTableShell.tsx` | Register panel wrapping table + embedded filters | **CRM** |
| `frontend/src/components/ui/SearchInput.tsx` | Search field | Shared |
| `frontend/src/components/design-system/SaveViewDialog.tsx` + `hooks/useSavedViews.ts` | Saved views | **CRM** |

### 5.7 Table / data grid

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/tables/DataTable.tsx` | TanStack table host (WO register already uses) | Shared |
| `frontend/src/components/erp/ErpDataGrid.tsx` | ERP data grid | Shared |
| `frontend/src/components/dynamics/DynamicsDataGrid.tsx` | Dynamics-styled grid | **Accounting** |
| `frontend/src/components/design-system/DataGrid.tsx` | DS grid | Shared |
| `frontend/src/design-system/enterprise/EnterpriseTablePrimitives.tsx` | Row actions menu | **CRM**/Shared |
| `frontend/src/components/crm/CrmLeadsTable.tsx` | Gold CRM register table | **CRM** |
| `frontend/src/components/erp/ErpLineItemsGrid.tsx` | Document line grid | Shared (forms) |

### 5.8 Status badge / posting chip

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/dynamics/DynamicsStatusChip.tsx` | Generic Dynamics status | **Accounting** |
| `frontend/src/components/erp/ErpStatusChip.tsx` | ERP status chip | Shared |
| `frontend/src/design-system/enterprise/EnterpriseStatusChip.tsx` | Enterprise chip | Shared |
| `frontend/src/design-system/list-page/StatusBadge.tsx` | List status badge | Shared |
| `frontend/src/components/design-system/StatusDot.tsx` | Dot + tone (WO register) | Shared |
| `frontend/src/components/accounting/bankCash/BankCashStatusBadge.tsx` | Bank/cash statuses | **Accounting** |
| `frontend/src/components/accounting/payables/PayableStatusBadge.tsx` | AP statuses | **Accounting** |
| `frontend/src/components/accounting/vouchers/VoucherBadges.tsx` | Voucher/posting badges | **Accounting** |
| `frontend/src/components/crm/LeadStageChip.tsx` | Lead stage | CRM |
| `frontend/src/modules/manufacturing/issues/IssueStatusBadge.tsx` | Issue status (keep, align tones) | Manufacturing |

### 5.9 Empty / error / loading

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/ui/EmptyState.tsx` | Empty registers | Shared |
| `frontend/src/design-system/components/EmptyState.tsx` | DS empty | Shared |
| `frontend/src/design-system/components/LoadingState.tsx` | Page/section loading | Shared (Accounting journals) |
| `frontend/src/components/design-system/SkeletonTable.tsx` | Table skeleton | Shared |
| `frontend/src/components/system/PageLoadingFallback.tsx` | Route suspense | Shared |
| `frontend/src/components/system/RouteErrorBoundary.tsx` | Route errors | Shared |
| `frontend/src/components/accounting/financialReports/FinancialReportEmptyState.tsx` | Domain empty | Accounting |

### 5.10 Drawer

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/design-system/RightDrawer.tsx` | Right drawer host | Shared |
| `frontend/src/design-system/components/Drawer.tsx` | DS drawer | Shared |
| `frontend/src/components/crm/CrmDrawerShell.tsx` | CRM drawer chrome | **CRM** |
| `frontend/src/components/crm/shared/CrmEntityDetailDrawer.tsx` | Notes/activity entity drawer | **CRM** |
| `frontend/src/components/accounting/bankCash/BankCashDrawerShell.tsx` | Bank drawer shell | **Accounting** |
| `frontend/src/components/accounting/payables/PayableDrawerShell.tsx` | AP drawer shell | **Accounting** |
| `frontend/src/components/accounting/PostingPreviewDrawer.tsx` | Posting preview | **Accounting** |
| `frontend/src/modules/accounting/money-in/components/ValidationDrawer.tsx` | Validation side panel | **Accounting** |
| Manufacturing drawers (`AssignmentDrawer`, `RecordProgressDrawer`, `RuntimeChangeDrawer`, `ManufacturingActionDrawer`) | Domain actions — **restyle to Accounting drawer shells**, keep logic | Align to Accounting |

### 5.11 Modal / confirmation

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/store/confirmDialogStore.ts` — `appConfirm`, `appPromptNote` | Preferred confirms (Purchase/Accounting) | **Shared** (Accounting usage) |
| `frontend/src/utils/systemConfirm.ts` — `systemConfirm`, `systemPrompt`, `systemAlert` | Alternate API over same store | Shared |
| `frontend/src/components/system/SystemConfirmDialogHost.tsx` | Dialog host | Shared |
| `frontend/src/design-system/components/Modal.tsx` | Generic modal | Shared |
| Domain modals e.g. money-in `PostConfirmModal.tsx`, CRM `DeleteLeadModal.tsx` | Pattern for destructive confirm | Accounting / CRM |

**Rule:** never `window.confirm` / `alert` / `prompt`.

### 5.12 Form section / card form

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/erp/card-form/*` (`ErpCardFormPage`, `ErpCardSection`, `ErpFieldRow`, …) | BC-style FastTabs form | Shared |
| `frontend/src/components/erp/ErpFormShell.tsx` / `ErpDrawerFormShell.tsx` | Form / drawer form shell | Shared |
| `frontend/src/components/crm/CrmCardFormShell.tsx` | CRM card form | CRM |
| `frontend/src/design-system/workspace/EnterpriseCardFormShell.tsx` | Enterprise card form | Shared |
| `frontend/src/components/forms/Inputs.tsx` | Shared inputs (`Select`, `Textarea`, …) | Shared |

### 5.13 Tabs

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/dynamics/DynamicsTabs.tsx` | Workspace tabs (Money In gold) | **Accounting** |
| `frontend/src/components/erp/card-form/ErpCardTabs.tsx` | Form FastTabs | Shared |
| `frontend/src/components/accounting/bankCash/BankCashWorkspaceTabs.tsx` | Bank workspace tabs | **Accounting** |
| `frontend/src/components/accounting/receivables/ReceivablesWorkspaceTabs.tsx` | AR tabs | **Accounting** |

### 5.14 Timeline / activity

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/crm/ActivityTimeline.tsx` | Activity feed | **CRM** |
| `frontend/src/components/crm/GroupedActivityTimeline.tsx` | Grouped timeline | **CRM** |
| `frontend/src/components/design-system/Timeline.tsx` | Generic timeline | Shared |
| `frontend/src/design-system/workspace/EnterpriseTimeline.tsx` | Enterprise timeline | Shared |
| `frontend/src/modules/accounting/treasury/transfers/components/TransferTimeline.tsx` | Accounting audit timeline | **Accounting** |
| Journal approval timeline in `JournalDetailPage.tsx` | Approval history | **Accounting** |

### 5.15 Summary / smart context / fact box

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/erp/card-form/ErpFactBoxPanel.tsx` / `ErpFactBoxPane.tsx` | Right smart context | Shared (label **Smart context**, not “FactBox” in UI copy) |
| `frontend/src/components/crm/CrmSmartOverviewPanel.tsx` (+ Lead/Opp variants) | CRM smart overview | **CRM** |
| `frontend/src/modules/accounting/money-in/components/TotalsPanel.tsx` | Document totals | **Accounting** |
| `frontend/src/modules/accounting/money-in/components/AttentionPanel.tsx` | Attention strip | **Accounting** |
| `frontend/src/design-system/workspace/EnterpriseBusinessFactBox.tsx` | Enterprise fact box | Shared |

### 5.16 Detail header / 360 shell

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/design-system/Entity360Shell.tsx` | 360 shell | **CRM** |
| `frontend/src/design-system/workspace360/Enterprise360Shell.tsx` | Enterprise 360 | Shared / CRM |
| `frontend/src/modules/quotations/Quotation360Page.tsx` | Quotation 360 gold | **CRM** |
| Journal detail header pattern in `JournalDetailPage.tsx` | Document detail + lifecycle | **Accounting** |
| `docs/UI_VIEW_PAGE_STANDARD.md` | View-page chrome rules | Docs |

### 5.17 Permission guard

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/auth/ProtectedRoute.tsx` — `PermissionGate`, `ProtectedOutlet` | Hide/deny by permission | Shared |
| `frontend/src/utils/permissions/finance.ts` — `useFinancePermissions` | Finance capability hooks | **Accounting** |
| `frontend/src/utils/permissions/manufacturing.ts` | Manufacturing hooks (already in use) | Manufacturing |
| `frontend/src/utils/permissions.ts` / `canCrmPermission` | CRM checks | CRM |
| `frontend/src/components/system/PermissionDeniedPage.tsx` | Denial UI | Shared |

### 5.18 Responsive / workspace chrome

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/layout/DynamicsWorkspaceChrome.tsx` | Workspace tabs chrome | **Shared**/Dynamics |
| `frontend/src/components/layout/WorkspaceChromeToolbar.tsx` | Toolbar | Shared |
| `frontend/src/components/layout/ModuleSubNavRail.tsx` | Module left rail | Shared |
| `frontend/src/components/layout/DynamicsSuiteBar.tsx` | Top suite bar | Shared |
| `frontend/src/components/layout/AppShell.tsx` | App shell | Shared |
| `frontend/src/context/WorkspaceUnifiedHeader.tsx` | Unified header merge | Shared |
| `frontend/src/styles/dynamics-theme.css`, `dynamics-tokens.css`, `dynamics-components.css`, `dynamics-mobile.css`, `dynamics-typography.css`, `dynamics-fonts.css` | Visual system | **Shared** |

### 5.19 Toast / notify

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/store/toastStore.ts` — `notify.success/error/warning/info` | Transient feedback | Shared |

### 5.20 Date / number formatting

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/utils/dates/format.ts` — `formatDate` | Dates | Shared |
| `frontend/src/utils/formatters/currency.ts` — `formatCurrency` | Money | Shared (Accounting) |
| `frontend/src/utils/crmMetrics.ts` — `formatCrmCurrency` | CRM currency helper | CRM |

### 5.21 Entity selector / smart select

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/erp/ErpSmartSelect.tsx` | Async/smart select | Shared |
| `frontend/src/components/crm/LeadContactSelect.tsx`, `CompanyProspectSelect.tsx`, `OpportunitySelectPicker.tsx` | CRM entity pickers | CRM |
| Manufacturing `useSetupLookups.ts` | Setup lookup options | Manufacturing (keep; wrap in ErpSmartSelect where possible) |

### 5.22 Command / quick-create

| Path(s) | Usage | Preferred |
|---------|--------|-----------|
| `frontend/src/components/crm/quick-create/CrmQuickCreateMenu.tsx` + `CrmQuickCreateHost.tsx` | Global quick-create | **CRM** |
| `frontend/src/components/crm/QuickFollowUpDrawer.tsx`, `CrmQuickCreateDrawers.tsx` | Quick drawers | **CRM** |
| Accounting “New journal / New invoice” via `ErpCommandBar` primary CTA | Workspace primary create | **Accounting** |

---

## 6. What looks legacy / inconsistent in Production today (high level)

1. **Dual chrome generations** — API WO pages use `OperationalPageShell` + `ErpCommandBar` (good); older demo pages + `ManufacturingDemoBanner` / role bar / “AI Insights” boxes still feel demo-kit (`ManufacturingUx.tsx`).
2. **Route-split dual-mode** — WO list/create/detail swap entire page components (`manufacturingRoutes.tsx`) instead of a single shell with service bridges (CRM/Accounting style). Harder to keep one visual language.
3. **Legacy `/production` tree** — `ProductionPage.tsx` uses `PageHeader` + `Card` + seed; still present as conceptual debt even if hubs redirect.
4. **Shopfloor / BOM / Routes / Plan** — mostly demo registers; filter/KPI/saved-view patterns lag CRM leads and Accounting Money In.
5. **Operator My Work** — mobile-first sheets (`operatorCss.ts`, task cards) may intentionally differ; still should share status chips, confirms (`appConfirm`), and `notify`.
6. **Inconsistent status vocabulary** — demo WO labels vs API `WORK_ORDER_STATUS_LABELS` vs issue badges; need one chip system (`DynamicsStatusChip` / `StatusDot` tones).
7. **KPI strips** — Control Room invents panel headers; Accounting/CRM use `EnterpriseKpiStrip` / summary cards — Production should converge.
8. **Drawers** — manufacturing action drawers exist but are not aligned to `BankCashDrawerShell` / `CrmDrawerShell` density and headers.
9. **Demo banners** on API-capable screens** — messaging still says “demo only” in places where Phase 1–5A API exists; modernisation should gate banners by `isApiMode()`.

---

## 7. Demo vs API mode — patterns to preserve

| Concern | Pattern | Paths |
|---------|---------|-------|
| Mode flag | `VITE_USE_API` via `isApiMode()` / `useApiMode()` | `frontend/src/config/apiConfig.ts`, `hooks/useApiMode.ts` |
| Never mix | Demo seed **or** API hydrate — not merged | Project rule; CRM `useCrmApiSync` pattern |
| Bridges | Domain API bridges map DTOs ↔ store/UI | `services/bridges/crmApiBridge.ts`, `journalApiBridge.ts`, `approvalApiBridge.ts`; manufacturing `services/api/manufacturingApi.ts`, `services/manufacturing/*`, `jobWorkService.ts` |
| Route branching | Manufacturing WO routes choose API vs demo page | `manufacturingRoutes.tsx` — prefer eventually **one page + bridge** like CRM |
| Permissions | Hooks no-op / permissive in demo; strict in API | `utils/permissions/manufacturing.ts`, finance hooks |
| Confirms / toasts | Same UX both modes | `appConfirm` / `notify` |
| Control room | Explicit branch to `ApiProductionControlRoomView` | `ProductionControlRoomPage.tsx` |

**Do not** hydrate API lists and then append demo seed rows. **Do** keep demo pages working when `VITE_USE_API=false`.

---

## 8. Top 15 components Production should reuse first

1. `OperationalPageShell` (`variant="dynamics"`, `layout="enterprise"`)
2. `ErpCommandBar` + `ErpButton`
3. `DynamicsTabs` (workspace sections: Today / WO / Issues / Setup)
4. `EnterpriseKpiStrip` / `EnterpriseKpiCard`
5. `EnterpriseRegisterTableShell` + `DataTable` / `DynamicsDataGrid`
6. `DynamicsStatusChip` or `ErpStatusChip` (+ shared tone maps)
7. `CrmFilterDrawer` pattern **or** `DynamicsFilterRow` (pick one per register type)
8. `SaveViewDialog` + `useSavedViews` (WO / Job Work registers)
9. `RightDrawer` / Accounting `*DrawerShell` for actions (assign, progress, runtime change)
10. `appConfirm` / `appPromptNote` (`confirmDialogStore`)
11. `notify` (`toastStore`)
12. `LoadingState` + `EmptyState` + `SkeletonTable`
13. `PageBackLink` / shell `backLink` (detail views — per `UI_VIEW_PAGE_STANDARD`)
14. `ErpSmartSelect` (item / WC / machine / vendor pickers)
15. `PermissionGate` + existing `useManufacturing*Permissions`

Honourable mentions: `DynamicsRecordHeader`, `FormActionBar`, `ErpCardFormPage` (create/edit WO), `DynamicsModuleDashboard` (control room KPIs).

---

## 9. Top Production pages that need redesign (priority)

| Priority | Page | Why |
|----------|------|-----|
| P0 | Work Order register (unify demo + API chrome) | Highest traffic; already half-modern |
| P0 | Work Order detail (API + demo) | Lifecycle, tabs, runtime changes, quality strip |
| P0 | Production Control Room | Hub; mixed demo panels vs Dynamics dashboard |
| P1 | Job Work register / detail | New Phase 4B — set gold path now |
| P1 | Today + Daily Update | Supervisor daily loop |
| P1 | Issues queue | Already uses `appConfirm`; finish register chrome |
| P2 | My Work (operator) | Keep mobile density; align chips/confirm/notify |
| P2 | Manufacturing Setup hub + WC/Machines/BOM/Routing lists | Masters should match CRM masters / Accounting settings |
| P2 | BOM / Routes / Production Plan registers | Demo-era lists |
| P3 | Shopfloor board | Visual board; still share tokens/status |
| P3 | Manufacturing Dashboard / Reports / Settings | Lower traffic; follow Control Room once modernised |
| P3 | Legacy `modules/production/*` | Delete or permanently redirect-only |

---

## 10. Explicit non-goals

- Do not redesign CRM or Accounting screens while modernising Production.
- Do not introduce Ant Design, MUI, Bootstrap, or a fourth page shell.
- Prefer documenting and **reusing** existing components over inventing Production-only primitives.
- Purchase consistency docs remain the written “voice” companion for Dynamics density.

---

## 11. Next docs

| Doc | Purpose |
|-----|---------|
| [`PRODUCTION_UIUX_COMPONENT_MAP.md`](PRODUCTION_UIUX_COMPONENT_MAP.md) | Page → target component mapping (skeleton) |
| [`PRODUCTION_UIUX_GUIDELINES.md`](PRODUCTION_UIUX_GUIDELINES.md) | Do/don’t rules for implementers (skeleton) |
