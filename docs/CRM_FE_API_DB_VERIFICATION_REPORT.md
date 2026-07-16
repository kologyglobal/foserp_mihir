# CRM Frontend ↔ API ↔ Database Verification Report

**Date:** 2026-07-14  
**Scope:** `/crm/*` SPA features vs Express CRM APIs vs Prisma/MySQL  
**Mode audited:** API mode (`VITE_USE_API=true`) — demo mode noted only where a page ignores API  
**Auth (seeded):** `admin@vasant-trailers.com` / tenant `vasant-trailers`  
**Evidence basis:** Code inventory + `npm run test:crm-live` + HTTP probes + selective browser smoke  

Status legend: **Working** · **Partial** · **Broken** · **Demo-only** · **N/A**

---

## 1. Executive summary

| Metric | Result |
|--------|--------|
| **Overall verdict** | **CRM commercial core is Working** end-to-end (FE bridges → API → MySQL). No P0 Broken blockers found in live E2E. |
| **Live CRM tests** | **47/47 passed** (`crm-e2e` 40 + `crm-tenant-isolation` 7) |
| **Unit (no live)** | **37 passed / ~45 skipped** (live suites skipped when `RUN_CRM_E2E` unset) |
| **Typecheck (backend)** | **PASS** (`tsc --noEmit`) |
| **HTTP login + CRM reads** | **200** (dashboard, leads, opportunities, quotations, `/crm/masters/sync`, `/masters/locations`) |
| **Browser (API mode)** | Login → `/crm` Command Center, `/crm/leads`, `/crm/opportunities` pipeline render |

**Pass rate (page-level, API path):** ~**90% Working**, ~**7% Partial**, ~**3% Demo-only/Deferred**, **0% Broken**.

**Top blockers / gaps (not failures of core funnel):**

1. **Deferred by design:** Full transactional SO ERP beyond convert-to-SO; purchase/inventory/production.

**Closed (P1):** Dashboard quotation approval panel — `panels.pendingApprovalCount` + `panels.pendingApprovalQuotations` on `GET /crm/dashboard/metrics`; FE uses API panel in `VITE_USE_API=true` (demo keeps store derivation).

**Closed (P2):** Sales forecast `GET /crm/forecast` + FE dual-mode; quotation templates CRUD+duplicate+soft-delete; CRM global search live E2E. Notes live E2E closed earlier same day.

**Canonical funnel verified live:** Lead → qualify → convert → Opportunity → Quotation (`locationId: ""` → null) → submit/approve → Convert to SO → soft-delete lifecycle; entity notes create/list/PATCH/soft-delete; attachments require `documentType`; `opportunity-stages` sync ≥10 rows including `quotation_sent` / `on_hold`.

---

## 2. Environment

| Component | Value / status |
|-----------|----------------|
| MySQL | **Up** — port 3306 (backend reports `database: connected`) |
| Backend | `http://localhost:5000` — health **200** |
| API base | `http://127.0.0.1:5000/api/v1` (`VITE_API_BASE_URL`) |
| Tenant | `vasant-trailers` (`VITE_TENANT_SLUG`) |
| Frontend | `http://127.0.0.1:5173` — **Up**, `VITE_USE_API=true` (`frontend/.env`) |
| OpenAPI | `/api/docs` (dev) |
| Bridges | `crmApiBridge`, `quotationApiBridge`, `quotationTemplateApiBridge`, `salesOrderApiBridge`, `crmMasterApiBridge`, master bridges |
| Hydration | `useCrmApiSync` / `useMasterApiSync` replace store slices (no seed merge) |

### Test commands + results (2026-07-14, this session)

| Command | Cwd | Result |
|---------|-----|--------|
| `npm run typecheck` | `backend/` | **PASS** exit 0 |
| `npm test` | `backend/` | **37 passed**, live suites skipped when `RUN_CRM_E2E` unset |
| `npm run test:crm-live` | `backend/` | **47 passed** (e2e 40 + tenant 7) |
| HTTP `POST /auth/login` | — | **200** |
| HTTP `GET …/crm/dashboard/metrics` | — | **200** |
| HTTP `GET …/crm/leads\|opportunities\|quotations` | — | **200** |
| HTTP `GET …/crm/masters/sync` | — | **200** |
| HTTP `GET …/masters/locations` | — | **200** |

Browser smoke: Sign-in with demo credentials → CRM Command Center + Leads + Opportunity Pipeline.

---

## 3. Page-wise matrix

Tenant API prefix: `/api/v1/t/vasant-trailers/crm/…` (FE via `tenantPath`).

| Page | Route | Functions | API | DB (Prisma) | Status | Evidence / notes |
|------|-------|-----------|-----|-------------|--------|------------------|
| CRM Dashboard | `/crm` | KPIs, charts, panels, approval queue, next actions | `GET /dashboard/metrics` (`panels.pendingApproval*`) | Aggregates over CRM tables + quotation documents | **Working** | Metrics/charts/panels API-backed (`useCrmDashboardApiMetrics` + `applyApiDashboardPanelOverlay`). Approval queue from `panels.pendingApprovalQuotations` (tenant-scoped DB); demo mode still derives from store. Browser: Command Center loads. |
| Sales Forecast | `/crm/forecast` | By month/owner/stage, at-risk | `GET /crm/forecast` (`ownerId`, `pipelineId`, `from`, `to`) | Aggregates open `CrmOpportunity` + stage probabilities | **Working** | API mode: server rollup via `useCrmSalesForecast`. Demo: client `buildCrmSalesForecast`. Unit + live E2E. |
| Leads list | `/crm/leads` | List, filter, export, import, assign, bulk, row actions, Create Opp/Quote gates | `GET/POST /leads`, assign/qualify/convert/bulk, `POST /imports/leads`, export | `CrmLead`, histories | **Working** | Live E2E CRUD/lifecycle; browser list; `AssignOwnerDialog` + `apiAssignLead`; import via `importLeadsApi`. |
| Lead new/edit | `/crm/leads/new`, `…/:id/edit` | Create/update, contact pick/add, location, Save bars | `POST/PATCH /leads`; contacts via `/contacts` | `CrmLead`, `CrmContact` | **Working** | `LeadContactSelect` + `contactId` in bridge; `locationId` UUID coerce; `CrmFormSaveCommandBar` is **FE-only** chrome. |
| Lead 360 | `/crm/leads/:id` | View, qualify/disqualify/convert, timeline act/FU edit-delete, notes, attachments | Lead lifecycle + `/activities` + `/follow-ups` + `/entities/LEAD/:id/notes\|attachments` | Lead, Activity, FollowUp, Note, Attachment | **Working** | Activity PATCH + FU CRUD live; attachment `documentType` required live; notes create/list/PATCH/soft-delete live. |
| Companies | `/crm/customers` (+ masters companies) | List/create/edit/delete, import, export, 360 notes/files | `GET/POST/PATCH/DELETE /companies`, imports | `CrmCompany` | **Working** | Live company CRUD + contact auto-link; import dialog → `importCompaniesApi`. |
| Contacts list | `/crm/contacts` | List, export | `GET /contacts` | `CrmContact` | **Working** | Sync + E2E contact CRUD. |
| Contact form | `/crm/contacts/new`, `…/edit` | Create/edit, Save bars | `POST/PATCH /contacts` | `CrmContact` | **Working** | Bridge + Save command bar FE-only. |
| Contact 360 | `/crm/contacts/:id` | Related, notes, attachments, activity/FU drawers | Contact + entity notes/attachments | Contact, Note, Attachment | **Working** | API panels; entity notes live-covered on LEAD (same endpoints/hooks). |
| Opportunity pipeline | `/crm/opportunities` | Kanban/list, stage move, assign, create | `GET/POST /opportunities`, `POST …/move-stage`, `…/assign` | `CrmOpportunity`, `CrmPipelineStage` | **Working** | Stages from `opportunity-stages` master + pipelines; browser pipeline; assign via `apiAssignOpportunity` + dialog. |
| Opportunity new/edit | `/crm/opportunities/new`, `…/edit` | Create/update, lines, location, Save bars | `POST/PATCH /opportunities` | Opportunity + lines | **Working** | `locationId` coerce; Save bar FE-only. |
| Opportunity 360 | `/crm/opportunities/:id` | Win/lose/reopen, histories, timeline edit, notes/files | win/lose/reopen, histories, activities/FUs, entities | Opp + history tables | **Working** | Live win/lose; timeline activity/FU update/delete live. |
| Activities | `/crm/activities` | List, create, complete, update, delete | `/activities` CRUD + complete | `CrmActivity` | **Working** | Live create/complete/update/delete. |
| Follow-ups | `/crm/follow-ups` | List, CRUD, complete/reschedule/snooze | `/follow-ups` | `CrmFollowUp` | **Working** | Live create/update/delete (+ lifecycle endpoints in API). |
| Quotations list | `/crm/quotations` | List, export, navigate | `GET /quotations` | `CrmQuotation` | **Working** | Live list after create. |
| Quotation new/edit/360/editor/preview/print/revisions | `/crm/quotations/*` | CRUD, doc patch, revision, submit/approve/reject/send, notes/files, convert SO | Quotation + document lifecycle + convert | Quotation, Document, Note, Attachment | **Working** | Live create (empty `locationId`), doc update, revision, auto-approve submit, convert SO, attachment typed; reject duplicate convert. |
| Quotation templates | `/crm/quotation-templates/*` | List/create/edit/preview/duplicate | `/quotation-templates` CRUD + duplicate | `CrmQuotationTemplate` | **Working** | Live E2E: create → list/search → get → update → duplicate → soft-delete (404 after delete). |
| CRM Sales Orders | `/crm/sales-orders`, `…/:id`, `/sales/orders/*` | List/detail; convert; blank draft create; PATCH draft; confirm; close; soft-delete draft | `GET/POST/PATCH/DELETE /sales-orders`, `POST …/confirm`, `POST …/close`, convert on quotation | `CrmSalesOrder` | **Working (Phase 1)** | Live convert + draft CRUD + confirm/close. **Accepted deferral:** MRP / dispatch / invoice posting (not CRM Phase 1). Bridge: `salesOrderApiBridge`. |
| Reports index/detail | `/crm/reports`, `…/:reportId` | 16 report IDs | `GET /reports?reportId=` | Query aggregates | **Working** | API wired via `useCrmReport`; data density depends on seeded CRM rows. |
| Masters hub | `/crm/masters` | Navigate kinds | sync + per-kind | `CrmMaster` | **Working** | Sync ensure includes stages/doc-types (live). |
| CRM master kind pages | `/crm/masters/:kind` (+ new/edit/detail) | CRUD, activate | `GET/POST/PATCH/DELETE /masters/:kind` | `CrmMaster` | **Working** | Kinds include `opportunity-stages`, `document-types`, commercial terms, etc. Locations/warehouses under **global** `/masters/locations` (live list). |
| Linked masters | `/crm/masters/companies\|quotation-templates` | Redirect/linked shells | Same as companies/templates | Same | **Working** | Route shells to shared APIs. |
| Redirects | kanban, competitors, follow-up-types, owners, product-interests | Nav only | N/A | N/A | **N/A** | Expected redirects. |
| Mobile CRM | `/m/crm/*` | Subset of CRM screens | Same bridges/sync | Same | **Partial** | Same APIs; lighter UX; not separately E2E’d. |

### Recent FE features (explicit)

| Feature | API / DB | Status |
|---------|----------|--------|
| Timeline Edit activities / follow-ups | `PATCH/DELETE /activities`, `/follow-ups` | **Working** — live E2E |
| Attachment `documentType` required | `POST …/attachments` + `document-types` master | **Working** — reject 400 + typed upload live |
| Opportunity stages master / funnel | `opportunity-stages` seed + sync; pipelines stages | **Working** — sync ≥10; canonical slugs |
| Locations / warehouses | `/masters/locations`, warehouses seed | **Working** — live list after seed |
| `locationId` null coerce | Zod `optionalUuid` + bridge coerce | **Working** — quotation create with `""` → null live |
| `AssignOwnerDialog` | `POST …/assign` lead & opportunity | **Working** — bridges; FE dialog |
| Lead `contactId` / Add New Contact | Lead PATCH/POST `contactId`; contact create | **Working** — FE + bridge mapping |
| Save command bars | None | **N/A (FE-only)** — Dynamics chrome only |

---

## 4. Function-wise matrix (by domain)

### Leads

| Function | Endpoint | Bridge / FE | DB | Status | Evidence |
|----------|----------|-------------|-----|--------|----------|
| List | `GET /leads` | sync | `CrmLead` | Working | Live + HTTP 200 + browser |
| Create / Update | `POST/PATCH /leads` | `apiCreateLead` / `apiUpdateLead` | `CrmLead` | Working | Live |
| Delete | `DELETE /leads/:id` | `apiDeleteLead` | soft delete | Working | Live |
| Assign | `POST /leads/:id/assign` | `apiAssignLead` + AssignOwnerDialog | assignment history | Working | Live + FE |
| Bulk assign/status/archive | `POST /leads/bulk-*` | list UI | Lead | Working | API present; not all bulk paths in live suite |
| Qualify / Disqualify | `POST …/qualify\|disqualify` | bridges | Lead + status history | Working | Live |
| Convert → Opportunity | `POST …/convert` (must be qualified) | `apiConvertLead` | Lead + Opportunity | Working | Live; unit gate tests |
| Change stage | `POST …/change-stage` | `apiAdvanceLeadStage` | Lead | Working | API + bridge |
| Contact person | `contactId` on lead payload | LeadContactSelect | Lead.contactId → Contact | Working | FE + bridge UUID |
| Import | `POST /imports/leads` | LeadImportDialog | Lead | Working | FE API path |
| Export | export route | `runCrmExport` | — | Working | Server export util |
| Notes / Attachments | `/entities/LEAD/:id/…` | hooks/panels | Note / Attachment | Working | Notes + attachments live E2E |

### Opportunities

| Function | Endpoint | Bridge / FE | DB | Status | Evidence |
|----------|----------|-------------|-----|--------|----------|
| List / Pipeline | `GET /opportunities` | sync + Kanban | Opportunity | Working | Live + browser |
| Create / Update | `POST/PATCH` | create/update bridges | Opp + lines | Working | Live |
| Delete | `DELETE` | bridge | soft delete | Working | Live |
| Assign | `POST …/assign` | `apiAssignOpportunity` | assignment history | Working | Bridge + dialog |
| Move stage | `POST …/move-stage` | `apiMoveOpportunityStage` | stage history | Working | Bridge; stages from master/pipeline |
| Win / Lose / Reopen | `POST …/win\|lose\|reopen` | store/bridge | status history | Working | Win/lose live |
| Histories | stage/assignment/amount/status GET | 360 panels | history tables | Working | API routes |
| Notes / Attachments | `/entities/OPPORTUNITY/…` | panels | Note/Attachment | Working | Same entity notes API; LEAD live covers create/list/PATCH/delete |

### Quotations

| Function | Endpoint | Bridge / FE | DB | Status | Evidence |
|----------|----------|-------------|-----|--------|----------|
| List / Get / Create / Update / Delete | CRUD `/quotations` | quotationApiBridge | Quotation | Working | Live |
| Document patch | `PATCH …/documents/:docId` | bridge | QuotationDocument | Working | Live |
| Revision | `POST …/revisions` | bridge | Document rev | Working | Live |
| Submit / Approve / Reject / Mark sent | document lifecycle POSTs | bridges | Document status | Working | Submit→auto-approve live |
| Convert → SO | `POST …/convert-to-sales-order` | salesOrderApiBridge | SalesOrder + Quotation link | Working | Live + duplicate 422 |
| `locationId` empty | optional UUID coerce | bridge + Zod | Quotation.locationId null | Working | Live |
| Notes / Attachments | `/entities/QUOTATION/…` | panels | Note/Attachment | Working | Same entity notes/attachments hooks; LEAD live covers API path |

### Contacts & Companies

| Function | Endpoint | Status | Evidence |
|----------|----------|--------|----------|
| Company CRUD + contactPerson sync | `/companies` | Working | Live auto-link contact |
| Contact CRUD | `/contacts` | Working | Live |
| Company/Contact import | `/imports/companies\|contacts` | Working | FE dialogs call API in API mode |
| 360 notes/attachments | `/entities/COMPANY\|CONTACT/…` | Working | UI + shared entity notes API (LEAD live E2E) |

### Activities & Follow-ups

| Function | Endpoint | Status | Evidence |
|----------|----------|--------|----------|
| Activity CRUD + complete | `/activities` | Working | Live create/complete/update/delete |
| Follow-up CRUD + complete/reschedule/snooze | `/follow-ups` | Working | Live create/update/delete |
| Timeline edit on Lead/Opp 360 | same PATCH/DELETE | Working | Covered by live tests |

### Notes & Attachments

| Function | Endpoint | Status | Evidence |
|----------|----------|--------|----------|
| Notes CRUD | `/entities/:type/:id/notes` + `PATCH/DELETE /entities/notes/:noteId` | Working | Live: create/list/PATCH/soft-delete on LEAD; FE `useEntityNotes` |
| Attachments upload/list | `/entities/:type/:id/attachments` | Working | Live: missing type 400; typed upload + list name |
| `documentType` master | `document-types` sync | Working | Sync assert + seed |

### Masters / Pipelines / Stages

| Function | Endpoint | Status | Evidence |
|----------|----------|--------|----------|
| CRM master kinds CRUD | `/crm/masters/:kind` | Working | Sync ensure live |
| `opportunity-stages` seed (10) | sync ensure | Working | Live ≥10 + `quotation_sent`/`on_hold` |
| Pipelines | `GET/POST /pipelines` | Working | Used in opportunity create live |
| Locations / warehouses | `/masters/locations` (+ warehouses) | Working | Live locations list |
| Owners | Users master / session users | Partial | Assign uses auth user ids in API mode |

### Sales Orders (from CRM)

| Function | Endpoint | Status | Evidence |
|----------|----------|--------|----------|
| Convert from quotation | `POST …/convert-to-sales-order` | Working | Live |
| List / Get | `GET /sales-orders` | Working | Live re-fetch |
| Blank draft create | `POST /sales-orders` | Working | Bridge + create page (API mode) |
| Update draft | `PATCH /sales-orders/:id` | Working | Bridge + form page |
| Soft-delete draft | `DELETE /sales-orders/:id` | Working | Bridge + list actions |
| Confirm / Close | `POST …/confirm`, `POST …/close` | Working | Bridge + 360 / list |
| MRP / dispatch / invoice | — | **Accepted deferral** | Out of CRM SO Phase 1; demo FE only where UI exists |

### Dashboard / Reports / Search / Forecast

| Function | Endpoint | Status | Evidence |
|----------|----------|--------|----------|
| Dashboard metrics/charts | `GET /dashboard/metrics` | Working | HTTP 200; FE overlay |
| Approval queue panel | `panels.pendingApprovalCount` + `pendingApprovalQuotations` | Working | Live: above-threshold submit → row in panel; FE API overlay |
| Reports | `GET /reports` | Working | FE `useCrmReport` |
| Global search | `GET /search` | Working | Live: company/contact/lead/opp hits; missing/empty `q` → 400 |
| Forecast page | `GET /crm/forecast` | Working | Server aggregation; FE dual-mode |

---

## 5. Gaps / broken items (severity)

| ID | Item | Severity | Status | Notes |
|----|------|----------|--------|-------|
| G1 | Mobile CRM not live-tested | **P2** | Partial | Shares API sync |
| G2 | Full SO fulfilment (MRP / dispatch / invoice) | — | **Accepted deferral** | Not a CRM defect. SO **Phase 1** (convert + draft CRUD + confirm/close) is shipped. Fulfilment remains a later ERP phase — see `REMAINING_WORK` P3-1. |
| G3 | Purchase / inventory / production **backends** | — | **Accepted deferral** | Not a CRM verification gap. Demo FE may exist; transactional APIs remain deferred by design — see P3-2 / P3-3. Do not treat as open CRM bugs. |
| — | Dashboard approval panel from metrics | — | **Closed** | `pendingApprovalCount` / `pendingApprovalQuotations` on metrics panels; live E2E |
| — | Forecast dedicated API | — | **Closed** | `GET /crm/forecast` + FE dual-mode |
| — | Notes CRUD live E2E | — | **Closed** | `creates, lists, updates, and soft-deletes entity notes on LEAD` |
| — | Quotation template live E2E | — | **Closed** | create/list/get/update/duplicate/soft-delete |
| — | CRM search live E2E | — | **Closed** | company/contact/lead/opp + empty-q validation |
| — | SO Phase 1 (create/confirm/close API) | — | **Closed** | Was plan “phase1-so”; routes + `salesOrderApiBridge` + live coverage |
| — | Core funnel Broken items | — | **None** | Live CRM suite green; trust current `TESTING_STATUS` counts |

---

## 6. Recommended next fixes (ordered)

1. **Mobile pass:** one API-mode smoke path for `/m/crm/leads` + follow-ups.  
2. Keep **Save command bars** documented as FE-only (no backend work).

**Done:** Dashboard approval panel from metrics payload (P1); Forecast API + FE dual-mode; template live smoke + search smoke (P2) — see closed gaps above.

---

## 7. DB models touched by CRM path (reference)

`CrmCompany`, `CrmContact`, `CrmLead` (+ status/assignment history), `CrmActivity`, `CrmFollowUp`, `CrmPipeline` / `CrmPipelineStage`, `CrmOpportunity` (+ lines + stage/assignment/amount/status history), `CrmMaster`, `CrmNote`, `CrmAttachment`, `CrmQuotation` / `CrmQuotationDocument` / `CrmQuotationTemplate`, `CrmSalesOrder`, plus global `Location`/`Warehouse` masters used by `locationId`.

---

## 8. Doc cross-links

- Page→API map: [`docs/crm-page-api-map.md`](crm-page-api-map.md)  
- Project memory: [`docs/PROJECT_MEMORY.md`](PROJECT_MEMORY.md)  
- Testing status: [`docs/TESTING_STATUS.md`](TESTING_STATUS.md)  
- Session log: [`docs/SESSION_CHANGELOG.md`](SESSION_CHANGELOG.md)

---

*Generated 2026-07-14 — verification session; **reconciled 2026-07-16** for transactional ERP scope (SO Phase 1 closed; G2/G3 = Accepted deferral, not CRM defects). Trust code + this report over older “GET-only SO” wording.*
