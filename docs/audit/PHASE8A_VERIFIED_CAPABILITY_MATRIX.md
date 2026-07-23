# Phase 8A — Verified Capability Matrix

**Date:** 2026-07-21  
**Method:** Evidence from routes, bridges/services, Prisma schema, permissions, and test filenames. Prefer code over chat.  
**Related:** [`PHASE8A_REPOSITORY_MAP.md`](PHASE8A_REPOSITORY_MAP.md), [`PHASE8A_BASELINE_RESULTS.md`](PHASE8A_BASELINE_RESULTS.md), [`PHASE8A_MOCK_DEMO_AUDIT.md`](PHASE8A_MOCK_DEMO_AUDIT.md), [`PHASE8A_FEATURE_FLAG_MATRIX.md`](PHASE8A_FEATURE_FLAG_MATRIX.md).

## Classification legend

| Class | Meaning |
|-------|---------|
| **VERIFIED_SHIPPED** | UI + API + DB + permissions + tests (or strong dual-mode path) usable in API mode |
| **VERIFIED_FLAG_GATED** | Backend real; hard-gated by feature flag / env (safe when off) |
| **PARTIAL** | Meaningful subset shipped; gaps block full capability |
| **UI_ONLY** | Frontend screens without matching production backend |
| **API_ONLY** | Backend exists; FE missing, demo-only, or not dual-routed |
| **DB_ONLY** | Schema/migration without usable API/UI path |
| **DEMO_ONLY** | Zustand/seed path; not production API capability |
| **MOCK_DATA_DEPENDENT** | API mode still shows seed/demo operational data (see mock audit) |
| **BROKEN** | Present but fails validate/typecheck/runtime in known way |
| **NOT_FOUND** | No meaningful implementation located |
| **BLOCKED_BY_DEPENDENCY** | Explicitly waits on another module |
| **DEFERRED_BY_DESIGN** | Documented out of scope for current phases |

**Pilot readiness:** YES = safe for narrow controlled pilot · CONDITIONAL = usable with constraints · NO = do not rely on for pilot.

---

## Accounting / Finance

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| Accounting | Phase 1 | Finance setup (LE/FY/periods/CoA/settings) | `/accounting/settings/*` | `frontend/src/modules/accounting/settings/*`, `services/bridges/financeApiBridge.ts` | `backend/src/modules/accounting/` legal-entities, financial-years, accounting-periods, accounts, finance-settings | `LegalEntity`, `FinancialYear`, `AccountingPeriod`, `Account`, `FinanceSettings` | `finance.settings.*`, `finance.legal_entity.*`, `finance.coa.*`, `finance.period.*` | `backend/tests/finance/finance-setup.test.ts` | **VERIFIED_SHIPPED** | YES | — |
| Accounting | 2C | Journals + approvals + reverse | `/accounting/entries/journals*`, `/accounting/entries/approvals*` | `modules/accounting/journals/*`, `journalApiBridge.ts`, `approvalApiBridge.ts` | `journals/journal.routes.ts`, `journal-reverse.service.ts`, `approvals/` | `AccountingVoucher`, `AccountingVoucherLine` | `finance.voucher.*` incl. `reverse` | `finance-approvals.test.ts`, `finance-journal-reversal.test.ts` | **VERIFIED_SHIPPED** | YES | — |
| Accounting | 3A–3C | Money In AR (invoice/receipt/CN/alloc/reverse) | `/accounting/money-in/**` | `modules/accounting/money-in/*`, `receivablesApiBridge.ts` | `receivables/sales-invoices/`, `receipts/`, `credit-notes/`, `allocations/` | `SalesInvoice`, `CustomerReceipt`, `CustomerReceiptAllocation*`, credit-note models | `finance.ar.*` | `backend/tests/finance/finance-ar-*.test.ts` | **VERIFIED_SHIPPED** | YES | Prefer Money In over legacy `/accounting/receivables/*` (mock leakage) |
| Accounting | 4A–4D | Money Out AP (VI/payment/alloc/adjust/recon/close-gate) | `/accounting/money-out/**` | `modules/accounting/money-out/*`, `payablesApiBridge.ts` (`requireApiMode`) | `payables/vendor-invoices/`, `vendor-payments/`, `allocations/`, `vendor-adjustments/`, `reconciliation/` | `VendorInvoice`, `VendorPayment`, AP open-item / adjustment / recon | `finance.ap.*` | `backend/tests/finance/finance-ap-*.test.ts` | **VERIFIED_SHIPPED** | YES | API-only (no demo AP) — pilot must use `VITE_USE_API=true` |
| Accounting | 5A–5C1 | Bank & Cash — statements / MT940-CAMT / recon / transfers / cheques / liquidity | `/accounting/bank-cash/**` (liquidity, statements, reconciliation, transfers, cheques, …) | `modules/accounting/treasury/**` | `treasury/` statement import, MT940/CAMT parsers, reconciliation, transfers, cheques, liquidity | `BankStatement*`, `TreasuryTransfer`, cheque/liquidity models | `finance.treasury.*`, `finance.bank.reconciliation.*` | `finance-bank-*.test.ts`, `finance-treasury-*.test.ts` | **VERIFIED_SHIPPED** | CONDITIONAL | Sub-registers `/bank-accounts`, `/cash-accounts`, `/transactions` still seed (`PHASE8A_MOCK_DEMO_AUDIT` #5) |
| Accounting | 5D1–5D2 | Bank connector scaffold + sandbox/REST pull | `/accounting/bank-cash/connectors` | `modules/accounting/treasury/**/Connector*` | `treasury/bank-connectors/` | `BankConnector`, `BankConnectorConsent` | `finance.bank_connector.view\|manage\|sync` | `finance-bank-connector-*.test.ts` | **VERIFIED_SHIPPED** (scaffold/sandbox); live SFTP/PSD2 **DEFERRED_BY_DESIGN** | CONDITIONAL | Consent model present (`schema.prisma` ~10993); SFTP/OAuth not live |
| Accounting | Period Close P1 + Hardening | Soft/hard period close / reopen / readiness + checklist acks | `/accounting/period-close/**` | `modules/accounting/period-close/*`, `periodCloseService.ts`, BE `period-close-readiness.service.ts` | Reuses `accounting-periods` close/reopen + close-readiness | `AccountingPeriod`, `PeriodCloseChecklistAck`, `FinanceSettings.periodCloseHardBlock` | `finance.period.view\|manage\|close\|reopen` | FE `test:period-close`; BE `period-close-hardening.test.ts`; docs `PERIOD_CLOSE_STATUS.md` | **VERIFIED_SHIPPED** (P1 + hardening); year-end/accruals **DEMO_ONLY** | CONDITIONAL | Calendar / year-end / accruals still mock |
| Accounting | Tax P1 | GST extract (posted AR/AP) | `/accounting/tax-compliance/**` | `taxComplianceService.ts` (`isApiMode` extract branches) | `tax-compliance/gst-extract.service.ts`, `tax-compliance.routes.ts` | None new (reads posted docs) | Routes use `finance.tax.view` — **not in** `permissions.ts` catalog | `finance-gst-extract.test.ts` | **PARTIAL** | CONDITIONAL | Filing/GSTR/e-invoice UI **DEMO_ONLY**; permission catalog gap |
| Accounting | FA 1–3 | Fixed assets capitalize/dep/dispose/transfer | `/accounting/fixed-assets/**` | FA pages with `isApiMode` on key flows | `fixed-assets/fixed-assets.routes.ts` | `FixedAsset*`, transfer/disposal/dep | `finance.fa.*` | `finance-fixed-assets.test.ts` | **VERIFIED_SHIPPED** | CONDITIONAL | BE/FE typecheck noise on FA (baseline); Phase 4+ deferred |
| Accounting | Budgeting | Budgets / vs actual | `/accounting/budgeting/**` | `budgetingService.ts` + seed | **NOT_FOUND** | **NOT_FOUND** | FE demo `accounting.budgeting.*` only | — | **DEMO_ONLY** | NO | No BE budget module |
| Accounting | Mfg costing | Manufacturing Accounting workspace | `/accounting/manufacturing/**` | `manufacturingAccountingService.ts` + seed | `manufacturing/accounting/*` gated by `MANUFACTURING_ACCOUNTING` | Accounting event models (phase 6b mig) | `manufacturing.cost.view` (+ finance feature key) | `manufacturing-phase6b.test.ts` | FE **MOCK_DATA_DEPENDENT**; BE **VERIFIED_FLAG_GATED** | NO | Default flag **off**; FE ignores flag (`PHASE8A_FEATURE_FLAG_MATRIX` D2) |
| Accounting | Legacy | CoA / vouchers redirects | `/accounting/coa*`, `/accounting/vouchers*` → settings/journals | `accountingRoutes.tsx` Navigate redirects | Live CoA/journals | `Account`, `AccountingVoucher` | setup/voucher perms | — | **VERIFIED_SHIPPED** (redirect) | YES | Residual demo services still on disk (`MOCK` #16) |

---

## Manufacturing

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| Manufacturing | 1 | Profiles / WC / Machines / BOM / Routing setup | `/manufacturing/setup*`, `/profiles`, `/work-centres`, `/machines`, `/setup/boms*`, `/setup/routings*` | `modules/manufacturing/setup/*` | `profiles/`, `work-centres/`, `machines/`, `boms/`, `routings/` | `ManufacturingProfile`, work-centre/machine/BOM/routing models | `manufacturing.bom.*`, setup-related | `manufacturing-phase1.test.ts` | **VERIFIED_SHIPPED** | YES | Legacy `/manufacturing/bom`, `/routes` remain **DEMO_ONLY** (`MOCK` #10–11) |
| Manufacturing | 2A–2B | WO create / release / progress | `/manufacturing/work-orders*` | `ApiWorkOrder*` vs demo via `manufacturingRoutes.tsx` `isApiMode()` | `work-orders/work-order.routes.ts` | `ProductionOrder` (+ stages/ops) | `manufacturing.work_orders.*`, `progress.*` | `manufacturing-phase2a.test.ts`, `phase2b.test.ts` | **VERIFIED_SHIPPED** | YES | Edit path always demo form (`MOCK` #15) |
| Manufacturing | 2B | Today / Control Room / Daily Update / My Work | `/manufacturing/today`, `/control-room`, `/daily-update`, `/my-work` | `today/TodayPage.tsx` (API client), `ProductionControlRoomPage.tsx`, `daily-update/DailyUpdatePage.tsx`, `operator/MyWorkPage.tsx` | `dashboard.routes.ts`, `daily-production/`, `assignments/` | Daily production / assignment models | `manufacturing.control_room.view`, `daily_production.*`, `operator.my_work` | `manufacturing-phase2b.test.ts` | **VERIFIED_SHIPPED** | YES | Live-activity chrome may still mock (`MOCK` #6–7) |
| Manufacturing | 3C | Materials issue / reserve / return | WO detail materials tab (API) | `ApiWorkOrderDetailPage.tsx`, `manufacturingApi` issue helpers | `materials/material.routes.ts` → inventory movements | Inventory + WO material lines | `manufacturing.materials.*` | `manufacturing-phase3c.test.ts`, `inventory-phase3a.test.ts` | **VERIFIED_SHIPPED** | CONDITIONAL | Needs real stock balances; FE inventory SPA mostly demo — issue via WO API path |
| Manufacturing | 4B | Job Work | `/manufacturing/job-work*` | `job-work/*`, `jobWorkService.ts` (`isApiMode` → API) | `job-work/job-work.routes.ts` | `JobWorkOrder`, dispatch/receipt lines | `manufacturing.job_work.*` | `manufacturing-phase4b.test.ts` | **VERIFIED_SHIPPED** | CONDITIONAL | Register not route-switched but service dual-modes; treat as CONDITIONAL until smoke |
| Manufacturing | 5A | Runtime changes | WO detail drawers/tabs | `RuntimeChangeDrawer.tsx`, `ApiWorkOrderDetailPage` | `runtime-changes/runtime-change.routes.ts` | Runtime change entities | `manufacturing.runtime_change.*` | `manufacturing-phase5a.test.ts` | **VERIFIED_SHIPPED** | YES | — |
| Manufacturing | 5B | WIP transfers | WO WIP tab / drawer | `WipTransferDrawer.tsx` | `wip-movements/wip-movement.routes.ts` | `ProductionWipMovement` | `manufacturing.wip.move` | `manufacturing-phase5b.test.ts` | **VERIFIED_SHIPPED** | YES | — |
| Manufacturing | 5C | Corrections | `/manufacturing/corrections` | `CorrectionsRegisterPage`, `CorrectionDrawer` | `corrections/correction.routes.ts` | `ManufacturingTransactionCorrection*` | `manufacturing.progress.correct` (+ related) | `manufacturing-phase5c.test.ts` | **VERIFIED_SHIPPED** | YES | — |
| Manufacturing | 6A | Planning / production plans | `/manufacturing/production-plan*` (+ planning API client) | `modules/manufacturing/planning/*` / plan pages | `plans/plan.routes.ts` | Production plan models | `manufacturing.production_plan.*` | `manufacturing-phase6a.test.ts` | **PARTIAL** | CONDITIONAL | Plan workbench real; classic MRP not full engine |
| Manufacturing | MRP | Classic MRP run / planner | `/mrp`, `/mrp/planner`, `/mrp/run`, `/mrp/runs/:id` | `modules/mrp/*`, `productionRoutes.tsx` | **NOT_FOUND** (no BE MRP engine) | — | FE-only | — | **DEMO_ONLY** / **DEFERRED_BY_DESIGN** | NO | Full MRP deferred |
| Manufacturing | 3A/7 | FG receipt | Inventory movement + demo WO store | `inventoryApi.postFgReceipt`; demo `workOrderStore.postFgReceipt` | `inventory/.../movements` `POST /fg-receipt` | `InventoryStockMovement` | `manufacturing.fg_receipt.*` / inventory post | `inventory-phase3a.test.ts` | **PARTIAL** | CONDITIONAL | BE exists; API WO UX for FG less complete than materials/WIP |
| Manufacturing | 7A | Store workbench | **No FE route** in `manufacturingRoutes.tsx` | — | Warehouse mapping BE (`warehouse-mappings/`, mig `…phase7a1_warehouse_mapping`) | Warehouse mapping models | `manufacturing.store_workbench.view` | — | **PARTIAL** / FE **NOT_FOUND** | NO | Perm + mapping only |

---

## Quality

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| Quality | 4B | Inspection plans / parameters | `/quality/inspection-plans*`, `/quality/parameters*` | `ApiQcMasterPages.tsx` dual via `qualityRoutes.tsx` | `quality/` plans + parameters | `QualityInspectionPlan*`, parameter models | quality plan/parameter perms | `quality-phase4b.test.ts` | **VERIFIED_SHIPPED** | YES | — |
| Quality | 4A / 7B | In-process / final inspections (queue) | `/quality/queue`, `/quality/inspections/:id` | `ApiQcQueuePage`, `ApiQcInspectionDetailPage` | `quality/` inspections | `QualityInspection*` | `manufacturing.quality.*` / quality perms | `quality-phase4a.test.ts`, `7b` | **VERIFIED_SHIPPED** | CONDITIONAL | Typecheck noise on quality clients (baseline) |
| Quality | — | NCR / rework / reports | `/quality/ncr*`, `/rework`, `/reports` | `NcrRegisterPage`, `ReworkWorkbenchPage`, `QualityReportsPage` | NCR API exists under quality module | NCR models (where migrated) | quality NCR perms | quality suites | **PARTIAL** / FE often **MOCK_DATA_DEPENDENT** | NO | Dual-route missing (`MOCK` #8) |
| Quality | — | Incoming QC / GRN QC | `/quality/incoming` | `IncomingQcQueuePage` | `workspace.service.ts` `incomingNotReady()` | — | — | — | **BLOCKED_BY_DEPENDENCY** | NO | Explicit: needs Purchase Receipt/GRN foundation |
| Quality | — | FG release | Certificates / WO quality gates | quality certificate paths + WO | `quality/` certificates | certificate models | `inventory.quality.release` / mfg quality | quality suites | **PARTIAL** | CONDITIONAL | Not a full outbound release suite |

---

## Dispatch

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| Dispatch | 7C0 | Outbound fulfilment confirm | `/dispatch/register`, `/dispatch/:id` (dual) | `ApiOutboundDispatchPages` | `dispatch/outbound/` | `OutboundDispatch*` | dispatch fulfilment perms | `dispatch-phase7c0.test.ts` | **PARTIAL** | CONDITIONAL | Confirm only |
| Dispatch | — | DO / pick / pack / challan | Demo dispatch plan/scan/reports | `modules/dispatch/*`, `dispatchStore` | **NOT_FOUND** for pick/pack/challan | — | — | — | **DEMO_ONLY** / **NOT_FOUND** | NO | `MOCK` #9; FE comments: no pick/pack/challan yet |

---

## Inventory

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| Inventory | 3A | Stock balance | `/inventory/stock*` | inventory pages (SPA mostly ungated) | `inventory/balances` | `InventoryStockBalance` (`Decimal(18,4)`, `tenantId`) | `inventory.stock.view` | `inventory-phase3a.test.ts` | BE **VERIFIED_SHIPPED**; FE **PARTIAL** / demo-leaning | CONDITIONAL | Use API/clients or WO materials path for pilot |
| Inventory | 3A | Reservations | `/inventory/reservations` | same | `inventory/reservations` | `InventoryStockReservation` | `inventory.reservations.*` | `inventory-phase3a.test.ts` | BE **VERIFIED_SHIPPED**; FE **PARTIAL** | CONDITIONAL | — |
| Inventory | 3A | Movements (receipt/issue/transfer/FG) | `/inventory/movements/**` | same + `inventoryApi` | `inventory/movements` | `InventoryStockMovement` | `inventory.issues.*`, receipts, etc. | `inventory-phase3a.test.ts` | BE **VERIFIED_SHIPPED**; FE **PARTIAL** | CONDITIONAL | Materials issue uses live movement API |

---

## CRM / Sales Order

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| CRM | SO Phase 1 | Sales Order commercial path | `/crm/sales-orders*` | `crmRoutes.tsx`, `salesOrderApiBridge.ts` | CRM SO module | `CrmSalesOrder` | CRM SO perms | `crm-e2e` / SO live suites | **VERIFIED_SHIPPED** | YES | — |
| CRM → Mfg | Demand | Convert SO → production demand | SO360 / demand convert UI + API | `manufacturingApi.convertSalesOrderLine` | `demands/so-conversion.service.ts` | `ProductionDemand`, `ProductionOrder.salesOrderId` | `manufacturing.demand.convert` | manufacturing demand tests | **PARTIAL** | CONDITIONAL | Convert API real; some SO360 production chrome still demo WO store |

---

## Purchase (dependency note)

| Module | Phase | Capability | Frontend route(s) | Key FE file | BE route/service | Prisma model | Permission | Tests | Classification | Pilot | Blocker note |
|--------|-------|------------|-------------------|-------------|------------------|--------------|------------|-------|----------------|-------|--------------|
| Purchase | 3B | PR only | `/purchase/requisitions*` (API) | purchase PR dual clients | `purchase/requisitions/` | `PurchaseRequisition*` | `purchase.requisition.*` | purchase PR tests | **PARTIAL** | CONDITIONAL | RFQ/PO/GRN deferred |
| Purchase | — | GRN | `/purchase/grn*` | demo purchase SPA | **NOT_FOUND** | — | `purchase.grn.*` (catalog only) | — | **DEMO_ONLY** / BE **NOT_FOUND** | NO | Blocks Quality incoming |

---

## Summary counts (approximate)

| Classification | Approx rows |
|----------------|------------:|
| VERIFIED_SHIPPED | Majority of finance money path + mfg ops core |
| VERIFIED_FLAG_GATED | Manufacturing Accounting BE |
| PARTIAL | Plans/MRP split, FG, inventory FE, dispatch, quality NCR, GST filing UI, SO→demand UI |
| DEMO_ONLY / MOCK_DATA_DEPENDENT | Budgeting, classic MRP, legacy AR/AP, mfg costing UI, dispatch pick/pack, GRN |
| BLOCKED_BY_DEPENDENCY | Quality incoming |
| DEFERRED_BY_DESIGN | Full MRP engine, PSD2/SFTP live, FA Phase 4+, purchase RFQ/PO/GRN |

---

## Evidence index (primary)

```
frontend/src/routes/accountingRoutes.tsx
frontend/src/routes/manufacturingRoutes.tsx
frontend/src/routes/qualityRoutes.tsx
frontend/src/routes/productionRoutes.tsx
frontend/src/routes/inventoryRoutes.tsx
frontend/src/routes/dispatchFinanceRoutes.tsx
backend/src/modules/accounting/accounting.routes.ts
backend/src/modules/manufacturing/manufacturing.routes.ts
backend/src/modules/inventory/inventory.routes.ts
backend/src/modules/quality/workspace.service.ts
backend/prisma/schema.prisma
backend/src/constants/permissions.ts
docs/audit/PHASE8A_MOCK_DEMO_AUDIT.md
docs/audit/PHASE8A_FEATURE_FLAG_MATRIX.md
docs/audit/PHASE8A_BASELINE_RESULTS.md
```

*End of capability matrix.*
