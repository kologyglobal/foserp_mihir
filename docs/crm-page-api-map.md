# CRM Page → API Map

Tenant prefix: `GET|POST|PATCH|DELETE /api/v1/t/{tenantSlug}/crm/...`  
Last verified: **2026-07-13**

## Dashboard

| Route | Read | Write | Permission |
|-------|------|-------|------------|
| `/crm` | `GET /dashboard/metrics?period=&from=&to=&ownerId=` | — | `crm.dashboard.view` |

Response includes KPIs, `panels`, and `charts`. Quotation **approval panel** in API mode uses `panels.pendingApprovalQuotations` (P1-3 done); demo mode still derives from store.

## Companies

| Route | Read | Write | Permission |
|-------|------|-------|------------|
| `/crm/customers` | `GET /companies` | `POST /companies` | view / create |
| Edit | `GET /companies/:id` | `PATCH /companies/:id` | view / update |
| Delete | — | `DELETE /companies/:id` | delete |
| Masters form | `/masters/companies/*` | same company APIs via `crmApiBridge` | |

**Company → contact sync:** When `contactPerson` is set on create/update, the API upserts a primary `POST/PATCH`-equivalent CRM contact. FE also hydrates `/contacts?customerId=` into `crmStore` after save. Company 360 lists linked contacts.

## Contacts

| Route | Read | Write |
|-------|------|-------|
| `/crm/contacts` | `GET /contacts` | `POST /contacts` |
| 360 / edit | `GET /contacts/:id` | `PATCH /contacts/:id`, `DELETE` |

## Leads

| Route | Read | Write |
|-------|------|-------|
| List | `GET /leads?stage=&source=&ownerId=` | `POST /leads` |
| Detail | `GET /leads/:id` | `PATCH /leads/:id` |
| Assign | — | `POST /leads/:id/assign` |
| Qualify | — | `POST /leads/:id/qualify` |
| Disqualify | — | `POST /leads/:id/disqualify` |
| Convert | — | `POST /leads/:id/convert` (requires qualified; 422 otherwise) |
| Bulk assign | — | `POST /leads/bulk-assign` |
| Status history | `GET /leads/:id/status-history` | — |
| Assignment history | `GET /leads/:id/assignment-history` | — |
| Delete | — | `DELETE /leads/:id` |
| Import | — | `POST /imports/leads` |

## Opportunities

| Route | Read | Write |
|-------|------|-------|
| Pipeline | `GET /opportunities` | `POST /opportunities` |
| 360 | `GET /opportunities/:id` | `PATCH`, `DELETE` |
| Win / Lose | — | `POST /:id/win`, `POST /:id/lose` |

## Activities

| Route | Read | Write |
|-------|------|-------|
| `/crm/activities` | `GET /activities` | `POST`, `PATCH`, `DELETE` |
| Complete | — | `POST /activities/:id/complete` |

## Follow-ups

| Route | Read | Write |
|-------|------|-------|
| `/crm/follow-ups` | `GET /follow-ups?status=&assignedTo=` | CRUD + complete/reschedule/snooze |

## Quotations

| Route | Read | Write | Permission |
|-------|------|-------|------------|
| `/crm/quotations` | `GET /quotations` | `POST /quotations` | view / create |
| 360 / edit | `GET /quotations/:id` | `PATCH`, `DELETE` | update / delete |
| Revision | — | `POST /quotations/:id/revisions` | update |
| Document | — | `PATCH /quotations/:id/documents/:docId` | update |
| Submit / approve / reject / send | — | `POST …/documents/:docId/{submit-approval\|approve\|reject\|mark-sent}` | update / approve |
| Approve note | — | `approve` also sets `customerApproval=approved` (single commercial step; no Accept API) | approve |
| Convert → SO | — | `POST /quotations/:id/convert-to-sales-order` | update |
| Notes / attachments | `GET /entities/QUOTATION/:id/notes\|attachments` | POST / PATCH / DELETE | note.* / attachment.* |

## Quotation templates

| Route | Read | Write |
|-------|------|-------|
| `/crm/quotation-templates` | `GET /quotation-templates` | `POST` |
| Detail | `GET /quotation-templates/:id` | `PATCH`, `DELETE` |
| Duplicate | — | `POST /quotation-templates/:id/duplicate` |

## Sales orders (CRM Phase 1)

| Route | Read | Write |
|-------|------|-------|
| `/crm/sales-orders` | `GET /sales-orders` | Quotation convert; blank draft `POST /sales-orders` |
| Detail | `GET /sales-orders/:id` | `PATCH` draft; `DELETE` draft; `POST …/confirm`; `POST …/close` |
| SPA | `/crm/sales-orders` list; create `/sales/orders/new?fromCrm=1`; edit/360 under `/sales/orders/*` | Bridge: `salesOrderApiBridge` |

**Deferred (accepted):** MRP run, dispatch, invoice posting — not CRM Phase 1.

**FE routes:** Leads live at `/crm/leads` (`/sales/leads*` → redirect). Company/Contact/Lead/Opportunity/Quotation/Follow-up/RFQ support direct create; Sales Order supports quotation convert + blank draft when customer and lines exist.

## Reports

| Route | Read |
|-------|------|
| `/crm/reports/:reportId` | `GET /reports?reportId=&page=&limit=&from=&to=&ownerId=&stage=&status=&source=` |

Report IDs: `pipeline`, `stage-wise`, `follow-up-due`, `sales-activity`, `won-lost`, `customer-pipeline`, `conversion-funnel`, `lead-register`, `lead-owner`, `lead-priority`, `lead-stage`, `lead-conversion`, `closed-leads`, `lead-active-inactive`, `quotation-revision`, `quotation-approval`.

## Search

| Route | Read |
|-------|------|
| Global search | `GET /search?q=&limit=` |

## Pipelines

| Route | Read |
|-------|------|
| Opportunity forms | `GET /pipelines` |

## CRM masters (dropdowns)

| Route | Read | Write |
|-------|------|-------|
| `/masters/designations`, `/masters/departments`, etc. | `GET /crm/masters/:kind` (+ `/lookup`) | CRUD + activate/deactivate |

Kinds include: `designations`, `departments`, `lead-sources`, `industries`, `territories`, stages, priorities, commercial terms, etc.

## Sales Forecast

| Route | Read | Write | Permission |
|-------|------|-------|------------|
| `/crm/forecast` | `GET /crm/forecast?ownerId=&pipelineId=&from=&to=` | — | `crm.dashboard.view` |

Response: `openCount`, `pipelineValue`, `weightedForecast` (= Σ amount × stage.probability / 100), `byMonth` / `byOwner` / `byStage`, `atRisk`. Demo mode uses client `buildCrmSalesForecast` instead.

## Demo-only / deferred pages (no dedicated transactional API)

- Purchase, inventory, production, quality, finance **backends** (demo FE may exist; APIs deferred by design — **Accepted deferral**, not CRM bugs)
- Sales-order **fulfilment** beyond Phase 1 (MRP / dispatch / invoice) — Phase 1 convert + draft CRUD + confirm/close is **shipped**

## Mobile (`/m/crm/*`)

Uses same APIs via `useCrmApiSync` → stores → mobile pages. No separate mobile API.

## Frontend API client

`trailer-erp/src/services/api/crmApi.ts` + bridges (`crmApiBridge`, `quotationApiBridge`, `quotationTemplateApiBridge`, `salesOrderApiBridge`)

Live OpenAPI: `http://localhost:5000/api/docs` (development)
