# Current → Target Folder Map

**Date:** 2026-07-11  
**Scope:** `trailer-erp/src/` (~995 files)

Legend: **KEEP** = already correct | **MOVE** = relocate | **SPLIT** = extract from monolith | **CREATE** = new folder/file | **MERGE** = consolidate duplicates later

---

## Top-level map

| Current | Target | Action | Notes |
|---------|--------|--------|-------|
| `assets/` | `assets/` | KEEP | Minimal static assets |
| `bootstrap/erpStartup.ts` | `bootstrap/appBootstrap.ts`, `demoBootstrap.ts`, `apiHydration.ts`, `index.ts` | SPLIT | Manufacturing integrity today; CRM/API hydration elsewhere |
| _(missing)_ | `bootstrap/index.ts` | CREATE | Single startup entry |
| `components/` (307 files) | `components/{domain}/` | REORGANIZE | Already domain-split for crm/masters; add quotations/, forms/, tables/ |
| `components/design-system/` | `design-system/components/` or deprecate | MERGE (later) | 15 files overlap root design-system |
| `config/` _(missing)_ | `config/` | CREATE | Extract from `services/api/config.ts` |
| `context/AuthProvider.tsx` | `modules/auth/` or keep + `store/authStore.ts` | MOVE (phase 10) | Auth context is cross-cutting |
| `data/` (51 files) | `data/{domain}/` | REORGANIZE | Partially done; move root `data/*.ts` legacy |
| `data/demo/` | `demo/seeds/` + `data/demo/` fixtures | SPLIT | Factories not yet separated |
| `design-system/` | `design-system/` | KEEP | Canonical enterprise UI |
| `hooks/` | `hooks/` | KEEP | Add `useApiMode.ts` wrapper |
| `main.tsx`, `App.tsx` | same | KEEP | Wire to `bootstrap/index.ts` |
| `modules/` | `modules/` | KEEP + SPLIT | Add `quotations/`, `auth/`; pages mostly correct |
| `pages/auth/` | `modules/auth/` | MOVE | Single file: LoginPage |
| `routes/index.tsx` (611 lines) | `routes/*.tsx` split | SPLIT | ~282 route paths |
| `services/api/` | `services/api/` + `services/bridges/` | SPLIT | 4 bridge files move to bridges/ |
| `services/*.ts` (non-api) | `services/analytics/`, etc. | REORGANIZE | 3 root service files |
| `store/` | `store/` + `store/selectors/` + `store/bootstrap/` | REORGANIZE | selectors/ exists; extract persistConfig already there |
| `styles/` | `styles/` | KEEP | |
| `types/` | `types/` by domain | SPLIT | Monolithic sales.ts, crm.ts, master.ts |
| `utils/` (100+ files) | `utils/{formatters,permissions,dates,...}/` | REORGANIZE | Flat namespace today |

---

## Routes (`routes/`)

| Current | Target | Action |
|---------|--------|--------|
| `routes/index.tsx` (all routes) | `routes/index.tsx` (composer only) | SPLIT |
| — | `routes/authRoutes.tsx` | CREATE |
| — | `routes/crmRoutes.tsx` | CREATE |
| — | `routes/quotationRoutes.tsx` | CREATE |
| — | `routes/masterRoutes.tsx` | CREATE |
| — | `routes/purchaseRoutes.tsx` | CREATE |
| — | `routes/inventoryRoutes.tsx` | CREATE |
| — | `routes/productionRoutes.tsx` | CREATE |
| — | `routes/qualityRoutes.tsx` | CREATE |
| — | `routes/mobileRoutes.tsx` | CREATE |
| — | `routes/entity360Routes.tsx` | CREATE (optional) |
| — | `routes/workspaceRoutes.tsx` | CREATE (optional) |

**Route count:** ~282 `path:` entries — integrity test must snapshot all paths.

---

## Auth

| Current | Target | Risk |
|---------|--------|------|
| `pages/auth/LoginPage.tsx` | `modules/auth/LoginPage.tsx` | Low |
| `context/AuthProvider.tsx` | `context/AuthProvider.tsx` or `modules/auth/AuthProvider.tsx` | Medium — many imports |
| `services/api/crmApiAuth.ts` | `services/api/authApi.ts` | Low — re-export compat |
| `services/api/config.ts` | `config/apiConfig.ts` + `config/environment.ts` | Medium |

---

## CRM module

| Current | Target | Action |
|---------|--------|--------|
| `modules/crm/CrmLeadListPage.tsx` | `modules/crm/leads/CrmLeadListPage.tsx` | MOVE (optional subfolder) |
| `modules/crm/Lead360Workspace.tsx` | same or `modules/crm/leads/` | KEEP path URL |
| `modules/crm/Opportunity*.tsx` | `modules/crm/opportunities/` | MOVE (optional) |
| `modules/crm/Quotation*.tsx` | `modules/quotations/` | MOVE |
| `modules/crm/CrmDashboardPage.tsx` | `modules/crm/` | KEEP |
| `modules/crm/CrmCardFormShell.tsx` | `components/crm/CrmCardFormShell.tsx` | MOVE — reusable shell |
| `modules/crm/masters/crmMasterRowActions.ts` | `modules/crm/masters/` | KEEP |
| `components/crm/*` (80+ files) | `components/crm/` + `components/quotations/` | SPLIT quotation widgets |

---

## Quotation ownership (high priority split)

| Current | Target |
|---------|--------|
| `modules/crm/QuotationCrmPages.tsx` | `modules/quotations/QuotationListPage.tsx` |
| `modules/crm/Quotation360Page.tsx` | `modules/quotations/Quotation360Page.tsx` |
| `modules/crm/CrmQuotationNewPage.tsx` | `modules/quotations/QuotationNewPage.tsx` |
| `components/crm/QuotationBuilder.tsx` | `components/quotations/QuotationBuilder.tsx` |
| `components/crm/QuotationPrintDocument.tsx` | `components/quotations/` |
| `store/salesStore.ts` (quotations slice) | `store/quotationStore.ts` | **High risk** — many imports |
| `data/crm/quotationTemplates.ts` | `data/quotations/` |
| `utils/quotationEngine/` | KEEP |

---

## Services & API

| Current | Target |
|---------|--------|
| `services/api/client.ts` | `services/api/client.ts` |
| `services/api/crmApiAuth.ts` | `services/api/authApi.ts` |
| `services/api/crmApi.ts` (~665 lines) | `services/api/crmApi.ts` + `services/api/quotationApi.ts` |
| `services/api/crmApiBridge.ts` | `services/bridges/crmApiBridge.ts` |
| `services/api/crmMasterApiBridge.ts` | `services/bridges/crmMasterApiBridge.ts` |
| `services/api/masterApiBridge.ts` | `services/bridges/masterApiBridge.ts` |
| `services/api/masterBatchApiBridge.ts` | `services/bridges/masterBatchApiBridge.ts` |
| — | `services/bridges/quotationApiBridge.ts` (extract from crm bridge) |
| `services/erpAnalyticsService.ts` | `services/analytics/erpAnalyticsService.ts` |
| `services/nextActionEngine.ts` | `services/analytics/` or `utils/` |
| `services/codeSeriesService.ts` | `services/` or `utils/` (demo-only client) |

---

## Store

| Current | Target |
|---------|--------|
| `store/crmStore.ts` | `store/crmStore.ts` |
| `store/salesStore.ts` | `store/salesStore.ts` + extract quotations → `quotationStore.ts` |
| `store/crmMasterStore.ts` | KEEP |
| `store/masterStore.ts` | KEEP |
| `store/persistConfig.ts` | KEEP |
| `store/bootstrap/crmBootstrap.ts` | `bootstrap/demoBootstrap.ts` (partial) |
| `store/selectors/index.ts` | Expand per domain |
| 20+ other domain stores | KEEP names; add selectors gradually |

---

## Data / demo

| Current | Target |
|---------|--------|
| `data/crm/crmSampleSeed.ts` | `data/crm/` KEEP |
| `data/sales/seed.ts` | `data/crm/` or `data/sales/` |
| `data/demo/*` | `demo/seeds/` + keep fixtures in `data/demo/` |
| `data/dispatch.ts`, `data/orders.ts`, … (root) | `data/{domain}/` |

---

## Backend (separate app — alignment only)

| Current | Target | Action |
|---------|--------|--------|
| `backend/src/utils/` | `backend/src/shared/utils/` | OPTIONAL |
| `backend/src/modules/crm/quotations/` | KEEP under CRM | ADR: no top-level move |
| `backend/src/services/codeSeries.service.ts` | `backend/src/services/code-series/` | OPTIONAL |

---

## Path aliases (not yet present)

Target aliases to add in `tsconfig.app.json` + `vite.config.ts`:

```
@/modules/*  @/components/*  @/design-system/*  @/services/*
@/store/*    @/types/*       @/utils/*          @/config/*
@/bootstrap/* @/hooks/*      @/data/*           @/routes/*
```

---

## Files explicitly NOT moving (Phase 1)

- All backend route URLs and Prisma schema  
- `design-system/` visual components (organize subfolders only)  
- Working CRM/API bridge behaviour  
- localStorage keys (`fos-erp-auth`, `ERP_STORAGE_KEYS`)  
- Zustand store public method names (compat exports if renamed)
