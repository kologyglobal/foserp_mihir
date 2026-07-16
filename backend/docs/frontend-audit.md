# Frontend Audit — Trailer ERP

**Date:** 2026-07-10  
**Scope:** CRM, auth, user management (Phase 1 foundation)

## Architecture

- **Stack:** React 19 + Vite + Zustand + React Router
- **Data:** Client-only; all CRM data in Zustand stores persisted to `localStorage`
- **API layer:** None — no `fetch`/`axios` in `src/`
- **Auth:** Mock RBAC via `src/utils/permissions.ts` (no login screen)

## React Modules Found

| Module | Routes prefix | Primary stores |
|--------|---------------|----------------|
| CRM | `/crm/*` | `crmStore`, `salesStore`, `crmMasterStore` |
| Sales (aliases) | `/sales/leads/*` | `salesStore` |
| Masters | `/masters/*` | `masterStore` |
| Settings | `/settings/*` | — |
| Mobile CRM | `/m/crm/*` | same CRM stores |

## CRM Pages

| Route | Component |
|-------|-----------|
| `/crm` | CrmDashboardPage |
| `/crm/leads` | CrmLeadListPage |
| `/crm/leads/new`, `/:id/edit` | CrmLeadFormPage |
| `/crm/leads/:id` | Lead360Workspace |
| `/crm/customers` | CrmCustomersPage |
| `/crm/contacts` | CrmContactsPage |
| `/crm/contacts/new`, `/:id/edit` | CrmContactFormPage |
| `/crm/contacts/:id` | Contact360Page |
| `/crm/opportunities` | OpportunityPipelinePage |
| `/crm/opportunities/new` | OpportunityNewPage |
| `/crm/opportunities/:id` | Opportunity360Page |
| `/crm/activities` | CrmActivitiesPage |
| `/crm/follow-ups` | CrmFollowUpsPage |
| `/crm/masters/*` | CrmMasterPages |

## Auth & User Management

- **No login UI** — session hardcoded as `{ id: 'user-demo', role: 'admin' }`
- **RBAC:** `src/config/permissionMatrix.ts` — CRM uses `sales.view/create/edit/...`
- **User master:** `/masters/users` — CRM owners as `CrmMasterEntry` (`kind: owners`)
- **Roles UI:** `/masters/roles`, `/masters/permissions` (read-only)

## Mock Data Locations

- `src/data/crm/crmSampleSeed.ts`
- `src/data/crm/crmMastersSeed.ts`
- `src/data/sales/seed.ts`
- `src/data/demo/salesPipelineSeed.ts`
- `src/utils/crmHydration.ts` (auto-hydration on first load)

## localStorage Keys (CRM-relevant)

| Key | Store |
|-----|-------|
| `vasant-erp-crm-v1` | contacts, opportunities, activities, followUps |
| `vasant-erp-sales-v1` | leads, quotations |
| `vasant-erp-masters-v1` | customers (companies), customerContacts |
| `vasant-crm-masters` | CRM reference masters |
| `vasant-erp-code-series-v1` | document numbering |

## Frontend Entity Field Summary

See `docs/database-entity-map.md` for full field mapping.

**Key naming:** Frontend uses `leadNo`, `opportunityNo`, `customerCode`, `customerName` — API DTOs must preserve these names.

**Company = Customer** in frontend (`src/types/master.ts`).

**Pipeline:** No separate entity — opportunities filtered by `stage`.
