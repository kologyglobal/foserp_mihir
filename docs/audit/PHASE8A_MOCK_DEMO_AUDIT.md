# Phase 8A — Mock / Demo Audit

**Date:** 2026-07-21  
**Scope:** Frontend (`frontend/src`) read-only audit of mock/demo/seed leakage vs `VITE_USE_API` / `isApiMode()`.  
**Policy:** Prefer document over fix. No P0 one-line guard applied (none found that is both P0 and a safe single-line change).

---

## Executive summary

| Metric | Count |
|--------|------:|
| **P1 API-mode mock-leakage candidates** | **16** |
| P0 (immediate production-risk, one-line fix) | **0** |
| Dual-mode bridges that correctly separate modes | **11** (listed below) |

**Verdict:** CRM/masters/finance money-in/money-out/journals and several manufacturing/quality dual routes are correctly gated. Large operational surfaces (legacy AR/AP, manufacturing costing UI, bank account cards, dispatch, quality NCR, live-activity chrome) still serve seed/demo quantities when `isApiMode() === true`.

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **test-only** | Used only in `__tests__` / scripts |
| **demo-mode-only** | Reached only when `VITE_USE_API=false` (route/service gated) |
| **safe-seed** | Backend Prisma seed or FE demo bootstrap that does not run in API mode |
| **production-risk** | Could mislead operators or mix demo + live in a deployed API-mode build |
| **API-mode-leakage** | Seed/demo quantities reachable on `isApiMode() === true` path (**→ P1**) |
| **dead-code** | Unused or superseded; still present |

---

## 1. Mode switch & bootstrap (correct)

| Evidence | Class | Notes |
|----------|-------|-------|
| `frontend/src/config/environment.ts` — `useApi: VITE_USE_API === 'true'` | — | Source of truth |
| `frontend/src/config/apiConfig.ts` — `isApiMode()` | — | Used across FE |
| `frontend/src/config/featureFlags.ts` — `apiMode` / `liveCrm` / `liveMasters` mirror `useApi` | — | Not independent toggles |
| `frontend/src/bootstrap/appBootstrap.ts` — API mode skips demo seeds | **safe-seed** | Comment: hydrate via API after auth |
| `frontend/src/demo/factories/crmEcosystemBootstrap.ts` — early `if (isApiMode()) return` | **demo-mode-only** | Correct |

---

## 2. Dual-mode bridges that correctly separate modes

These call API when `isApiMode()`, else demo store / throw:

| Bridge | Path | Pattern |
|--------|------|---------|
| Finance setup | `frontend/src/services/bridges/financeApiBridge.ts` | `if (isApiMode())` → API else Zustand |
| Journals | `frontend/src/services/bridges/journalApiBridge.ts` | same |
| Receivables (Money In) | `frontend/src/services/bridges/receivablesApiBridge.ts` | API else `receivablesDemoStore` |
| Payables (Money Out) | `frontend/src/services/bridges/payablesApiBridge.ts` | **`requireApiMode()`** — no demo AP |
| CRM | `frontend/src/services/bridges/crmApiBridge.ts` | API writes (hydrate via `useCrmApiSync`) |
| Quotations | `frontend/src/services/bridges/quotationApiBridge.ts` | API-backed |
| Quotation templates | `frontend/src/services/bridges/quotationTemplateApiBridge.ts` | API-backed |
| Sales orders | `frontend/src/services/bridges/salesOrderApiBridge.ts` | API-backed |
| Masters | `frontend/src/services/bridges/masterApiBridge.ts` | API-backed |
| Master batch | `frontend/src/services/bridges/masterBatchApiBridge.ts` | API-backed |
| CRM masters | `frontend/src/services/bridges/crmMasterApiBridge.ts` | API-backed |
| Approvals | `frontend/src/services/bridges/approvalApiBridge.ts` | dual |
| Admin | `frontend/src/services/bridges/adminApiBridge.ts` | dual |

**Route-level dual switches (good examples):**

- Manufacturing WO: `frontend/src/routes/manufacturingRoutes.tsx` — register/create/detail → `Api*` vs demo pages; `ProductionControlRoomPage` switches to `ApiProductionControlRoomView`.
- Quality queue / inspections / parameters / plans: `frontend/src/routes/qualityRoutes.tsx`.
- Treasury: `LiquidityDashboardPage`, `TransferListPage`, `BankStatementListPage`, `ReconciliationListPage`, `ChequeListPage`, `ConnectorListPage`, etc. under `frontend/src/modules/accounting/treasury/**`.
- Fixed assets / period close / tax compliance services: `isApiMode()` branches in respective `*Service.ts` files.

---

## 3. P1 — API-mode leakage candidates (16)

Each row is a distinct surface where `VITE_USE_API=true` can still show seed/demo operational data.

| # | Surface | Evidence | Severity notes |
|---|---------|----------|----------------|
| 1 | **Manufacturing Accounting workspace** | `manufacturingAccountingService.ts` always mutates in-memory seed from `manufacturingAccountingSeed.ts`; pages under `/accounting/manufacturing` call it with **no** `isApiMode` check (`ManufacturingAccountingOverviewPage.tsx`, WIP, FG, variances, setup, …) | Fake WIP/FG/cost KPIs in API mode. Demo banner may exist in components, but quantities look operational. |
| 2 | **Legacy AR** `/accounting/receivables/*` | Routes in `accountingRoutes.tsx` (~406–422); pages import `receivablesService.ts` (seed stores, no `isApiMode`) | Parallel to live Money In (`/accounting/money-in/*` via bridge). Deep links still live. |
| 3 | **Legacy AP** `/accounting/payables/*` | Same routes file; `payablesService.ts` seed | Parallel to Money Out (API-only). |
| 4 | **Financial reports UI** | `financialReportsService.ts` + pages under `modules/accounting/financialReports/*` | Seed P&L / BS / TB / MIS with no mode gate. |
| 5 | **Bank accounts / cash accounts / transactions** | `BankAccountsPage.tsx`, `CashAccountsPage.tsx`, `BankCashTransactionsPage.tsx` → `bankCashService.ts` seed; still routed at `/accounting/bank-cash/bank-accounts` etc. while overview correctly dual-modes via `LiquidityDashboardPage.tsx` | Partial treasury dual-mode; sub-registers leak demo balances. |
| 6 | **Live activity mock chrome** | `hooks/useLiveActivityMock.ts`; used by `QualityWorkspace`, `DispatchWorkspace`, `FinanceWorkspace`, `PurchaseWorkspace`, `ProductionControlTowerPage`, `LiveActivityTicker`, `useLiveFactoryPulse` | Fake ticker events in API-mode shells. |
| 7 | **Live factory pulse store linkage** | `hooks/useLiveFactoryPulse.ts` reads `workOrderStore` / `purchaseStore` / `qualityStore` / `dispatchStore` / `invoiceStore` | In API mode those Zustand slices may be empty **or** still hold persisted demo if localStorage not cleared → misleading pulse. |
| 8 | **Quality NCR / rework / incoming / reports** | `qualityRoutes.tsx` — only queue/inspections/parameters/plans dual-routed; `NcrRegisterPage`, `ReworkWorkbenchPage`, `IncomingQcQueuePage`, `QualityReportsPage` stay demo | Demo QC docs beside live queue. |
| 9 | **Dispatch module** | `modules/dispatch/*` + `store/dispatchStore.ts` (`persist`) | No API dual route; full operational UI from localStorage/seed. |
| 10 | **Manufacturing BOM register (legacy path)** | `BomRegisterPage.tsx` → `getBoms()` demo service + `ManufacturingDemoBanner`; route `/manufacturing/bom` not switched (API setup is `/manufacturing/setup/boms`) | Two BOM UIs; legacy path leaks demo. |
| 11 | **Manufacturing routes / production plan** | `RouteRegisterPage`, `ProductionPlanPage` + `manufacturingService` / seed; demo banners | Same pattern as BOM. |
| 12 | **Job work register/detail/form** | `modules/manufacturing/job-work/*` + `jobWorkSeed.ts` / services | Demo documents in API mode (unless separately API-gated inside — register page has no `isApiMode`). |
| 13 | **Manufacturing settings** | `manufacturingSettingsService.ts` in-memory `DEFAULT_MANUFACTURING_SETTINGS`; page saves via demo updater | FE-only toggles (OEE, backflush, etc.) not BE-enforced. |
| 14 | **Manufacturing reports page** | `ManufacturingReportsPage.tsx` + settings service report defs | Demo report catalog/KPIs. |
| 15 | **WO edit path** | `manufacturingRoutes.tsx`: `work-orders/:workOrderId/edit` → always `WorkOrderFormPage` (demo), while list/detail/create dual-route | API-mode edit can hit demo form. |
| 16 | **Chart of accounts / vouchers / ledger demo services** | `chartOfAccountsService.ts`, `vouchersService.ts`, `ledgerEntriesService.ts` — seed/demo posting language; pages still imported in `accountingRoutes.tsx` (legacy CoA/voucher paths may redirect, but service+pages remain callable) | Prefer treat as leakage until redirects proven for every deep link. |

### Not counted as P1 (intentionally demo-mode-only or API-gated)

- Money Out pages: hard-stop UI when `!isApiMode()` (`VendorInvoiceListPage`, etc.).
- `payablesApiBridge.requireApiMode()`.
- Treasury transfer/statement/recon/cheque/SI/adjustment route shells that return demo page **or** API-required notice based on `isApiMode()`.
- `ProductionControlRoomPage` / quality queue dual components.
- CRM hydrate: `useCrmApiSync` / `useMasterApiSync` replace store in API mode.

---

## 4. Grep inventory (selected)

### `Math.random`

| Location | Class |
|----------|-------|
| ID generators (`toastStore`, `confirmDialogStore`, inventory services, …) | **safe** (IDs only) |
| Artificial delay in accounting demo services (`receivablesService`, `payablesService`, `bankCashService`, `manufacturingAccountingService`, …) | **demo-mode-only** if callers gated; **API-mode-leakage** when pages call them in API mode (see §3) |
| `demo/seeds/demoPurchaseSeed.ts` quote rates | **demo-mode-only** |
| `hooks/useLiveActivityMock.ts` shuffle | **API-mode-leakage** (§3 #6) |
| `__tests__` keys | **test-only** |

### `MOCK_` / mock user

| Location | Class |
|----------|-------|
| `utils/permissions/index.ts` — `MOCK_USER` default session | **demo-mode-only** when API syncs via `syncSessionUserFromAuth`; **production-risk** if API mode loads before auth sync (brief admin demo identity) — document only |
| `useLiveActivityMock` `MOCK_EVENTS` | **API-mode-leakage** |

### Seeds / `demoStore` / fallback

| Location | Class |
|----------|-------|
| `data/accounting/*Seed.ts`, `data/manufacturing/seed.ts`, `data/quality/*` | **safe-seed** for demo; **API-mode-leakage** when services lack gates |
| `store/receivablesDemoStore.ts` | Used by `receivablesApiBridge` demo branch only — **demo-mode-only** for Money In |
| `store/*` with `persist(` + `persistConfig` localStorage | **production-risk** if API mode still reads operational slices (dispatch, quality, purchase, inventory, workOrder, …) without replace-hydrate |

### Hardcoded / demo KPIs (operational modules)

| Area | Evidence | Class |
|------|----------|-------|
| Mfg accounting dashboard | `seedManufacturingCostDashboard()` | **API-mode-leakage** |
| Control room | Dual-mode — API view vs demo aggregates in `workOrderService` | **demo-mode-only** for demo branch |
| Dispatch | Store-derived KPIs + live-erp helpers | **API-mode-leakage** |
| Quality reports/workspace | Store + mock activity | **API-mode-leakage** |
| Bank cash overview | Dual via `LiquidityDashboardPage` | OK overview; subpages leak (§3 #5) |

---

## 5. localStorage operational data

`frontend/src/store/persistConfig.ts` wraps `localStorage`. Persisted operational stores include (non-exhaustive):

`crmStore`, `masterStore`, `salesStore`, `purchaseStore`, `inventoryStore`, `qualityStore`, `dispatchStore`, `workOrderStore`, `bomStore`, `routingStore`, `accountingStore`, `journalDemoStore`, `invoiceStore`, …

| Concern | Class |
|---------|-------|
| Demo mode: intentional persistence | **demo-mode-only** |
| API mode: CRM/masters replaced by hydrate; many ERP stores **not** cleared | **production-risk** / **API-mode-leakage** when UI still binds them |

---

## 6. Dead / superseded code (note)

| Item | Notes |
|------|-------|
| `ManufacturingDashboardPage` | Redirects to control-room |
| Legacy `/accounting/receivables` & `/accounting/payables` | Superseded by money-in/out but **still routed** |
| Legacy `/manufacturing/bom` vs `/manufacturing/setup/boms` | Parallel UIs |
| `AccountingPlaceholderPage` | Scaffold messaging |

---

## 7. Recommended next actions (docs only — not done)

1. Hide or redirect legacy AR/AP/bank-account/mfg-costing routes when `isApiMode()`.
2. Gate `useLiveActivityMock` / pulse with `!isApiMode()`.
3. Dual-route remaining quality/dispatch/job-work/BOM paths or show API-required notice.
4. Clear or namespace-prefix persisted demo stores when entering API mode.
5. Align FE Manufacturing Accounting with BE `FinanceFeatureKey.MANUFACTURING_ACCOUNTING` gate (see feature-flag matrix).

---

## Evidence index (key paths)

```
frontend/src/config/environment.ts
frontend/src/config/apiConfig.ts
frontend/src/bootstrap/appBootstrap.ts
frontend/src/services/accounting/manufacturingAccountingService.ts
frontend/src/data/accounting/manufacturingAccountingSeed.ts
frontend/src/services/accounting/receivablesService.ts
frontend/src/services/accounting/payablesService.ts
frontend/src/services/accounting/bankCashService.ts
frontend/src/services/accounting/financialReportsService.ts
frontend/src/hooks/useLiveActivityMock.ts
frontend/src/hooks/useLiveFactoryPulse.ts
frontend/src/routes/accountingRoutes.tsx
frontend/src/routes/manufacturingRoutes.tsx
frontend/src/routes/qualityRoutes.tsx
frontend/src/services/bridges/{finance,journal,receivables,payables}ApiBridge.ts
frontend/src/store/persistConfig.ts
```
