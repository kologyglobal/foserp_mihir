# API Requirement Matrix

Derived from frontend stores, forms, and routes.  
Last verified: **2026-07-13** against `backend/src/modules/**`.

Tenant-scoped paths shown as `/api/v1/t/:tenantSlug/...` (UUID form `/tenants/:tenantId/...` is equivalent).

## Auth

| Frontend need | Method | Endpoint | Permission |
|---------------|--------|----------|------------|
| Login | POST | `/api/v1/auth/login` | public |
| Refresh token | POST | `/api/v1/auth/refresh-token` | public |
| Logout | POST | `/api/v1/auth/logout` | authenticated |
| Current user | GET | `/api/v1/auth/me` | authenticated |
| Forgot/reset password | POST | `/api/v1/auth/forgot-password`, `reset-password` | public |
| Change password | POST | `/api/v1/auth/change-password` | authenticated |

## Tenants

| Action | Method | Endpoint |
|--------|--------|----------|
| Create tenant | POST | `/api/v1/tenants` |
| List tenants | GET | `/api/v1/tenants` |
| Get / update / delete | GET/PATCH/DELETE | `/api/v1/tenants/:tenantId` |

## Users & roles

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List/create users | GET/POST | `/api/v1/t/:slug/users` |
| User CRUD | GET/PATCH/DELETE | `/api/v1/t/:slug/users/:userId` |
| Assign / remove role | POST/DELETE | `/api/v1/t/:slug/users/:userId/roles…` |
| Roles CRUD | GET/POST/PATCH/DELETE | `/api/v1/t/:slug/roles` |

> Admin SPA for users/roles/tenants is still open (P1-1 / P1-2); APIs are complete.

## CRM Companies

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / create | GET/POST | `…/crm/companies` |
| Get / patch / delete | GET/PATCH/DELETE | `…/crm/companies/:id` |

**Side effect (2026-07-13):** `POST` / `PATCH` with non-empty `contactPerson` upserts a linked **primary** CRM contact (`crm_contacts`) from `contactPerson` / `contactPhone` / `contactEmail`. Clearing the name does not delete existing contacts. Empty contact-field patches that omit those keys do not sync.

## CRM Contacts

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / create | GET/POST | `…/crm/contacts` |
| Get / patch / delete | GET/PATCH/DELETE | `…/crm/contacts/:id` |

## CRM Leads

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / create | GET/POST | `…/crm/leads` |
| Get / patch / delete | GET/PATCH/DELETE | `…/crm/leads/:id` |
| Assign / qualify / disqualify / convert | POST | `…/crm/leads/:id/{assign\|qualify\|disqualify\|convert}` |
| Bulk assign | POST | `…/crm/leads/bulk-assign` |

## CRM Activities & follow-ups

| Frontend | Method | Endpoint |
|----------|--------|----------|
| Activities CRUD | GET/POST/PATCH/DELETE | `…/crm/activities` |
| Complete | POST | `…/crm/activities/:id/complete` |
| Follow-ups CRUD | GET/POST/PATCH/DELETE | `…/crm/follow-ups` |

## CRM Pipelines & opportunities

| Frontend | Method | Endpoint |
|----------|--------|----------|
| Pipelines | GET/POST/PATCH/DELETE | `…/crm/pipelines` |
| Opportunities CRUD | GET/POST/PATCH/DELETE | `…/crm/opportunities` |
| Win / lose | POST | `…/crm/opportunities/:id/{win\|lose}` |

## CRM Quotations ✅

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / create | GET/POST | `…/crm/quotations` |
| Get / patch / delete | GET/PATCH/DELETE | `…/crm/quotations/:id` |
| Revision | POST | `…/crm/quotations/:id/revisions` |
| Document update | PATCH | `…/crm/quotations/:id/documents/:docId` |
| Submit / approve / reject / send | POST | `…/documents/:docId/{submit-approval\|approve\|reject\|mark-sent}` |
| Convert → sales order | POST | `…/crm/quotations/:id/convert-to-sales-order` |

## CRM Quotation templates ✅

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / create | GET/POST | `…/crm/quotation-templates` |
| Get / patch / delete | GET/PATCH/DELETE | `…/crm/quotation-templates/:id` |
| Duplicate | POST | `…/crm/quotation-templates/:id/duplicate` |

## CRM Sales orders ✅ (read + conversion)

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / get | GET | `…/crm/sales-orders`, `…/crm/sales-orders/:id` |
| Create | — | Via quotation `convert-to-sales-order` only |

## CRM dashboard, reports, search, export

| Frontend | Method | Endpoint |
|----------|--------|----------|
| Dashboard | GET | `…/crm/dashboard/metrics` |
| Reports | GET | `…/crm/reports?reportId=` |
| Search | GET | `…/crm/search?q=` |
| CSV export | GET | `…/crm/exports/:resource` |

## CRM masters (dropdown kinds)

| Frontend | Method | Endpoint |
|----------|--------|----------|
| List / CRUD | GET/POST/PATCH/DELETE | `…/crm/masters/:kind` |
| Lookup | GET | `…/crm/masters/:kind/lookup` |

Kinds include **`designations`** and **`departments`** (2026-07-13), plus lead/opportunity stages, terms, etc.

## Notes & attachments

| Frontend | Method | Endpoint |
|----------|--------|----------|
| Notes | GET/POST | `…/crm/entities/:entityType/:entityId/notes` |
| Attachments | GET/POST | `…/crm/entities/:entityType/:entityId/attachments` |

`entityType`: `COMPANY`, `CONTACT`, `LEAD`, `OPPORTUNITY`, `ACTIVITY`, `FOLLOW_UP`, **`QUOTATION`**.

## Core masters (geography, products, GST, …)

| Frontend | Method | Endpoint |
|----------|--------|----------|
| Countries / states / cities | GET/POST/PATCH/DELETE + activate | `…/masters/{countries\|states\|cities}` |
| Products | GET/POST/PATCH/DELETE + activate | `…/masters/products` |
| UOM, warehouses, locations, item-categories, hsn-sac, gst-* | same pattern | `…/masters/:resource` |
| Items / vendors | dedicated modules | `…/masters/items`, `…/masters/vendors` |
| Lookups | GET | `…/lookups/:resource` |

Seed (dev): **31 countries**, **36 Indian states**, **108 cities**, **3 products**, **10 quotation templates**.

## Response DTO naming

API responses use **frontend field names** (`leadNo`, `customerName`, `opportunityNo`) via mappers in CRM services.

## Live docs

Swagger UI (development): `http://localhost:5000/api/docs`  
Conventions: [`docs/API_CONVENTIONS.md`](../docs/API_CONVENTIONS.md)  
Page map: [`docs/crm-page-api-map.md`](../docs/crm-page-api-map.md)
