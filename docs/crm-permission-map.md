# CRM Permission Map

## Backend permissions (`backend/src/constants/permissions.ts`)

| Permission | Purpose |
|------------|---------|
| `crm.company.view/create/update/delete` | Companies |
| `crm.contact.view/create/update/delete` | Contacts |
| `crm.lead.view/create/update/delete/assign/qualify/convert` | Leads |
| `crm.opportunity.view/create/update/close/delete` | Opportunities |
| `crm.activity.view/create/update/complete/delete` | Activities |
| `crm.follow_up.view/create/update/delete` | Follow-ups |
| `crm.quotation.view/create/update/delete/approve/convert` | Quotations |
| `crm.sales_order.view/create/update/delete/confirm` | Sales orders (CRM Phase 1) |
| `crm.pipeline.view/manage` | Pipelines |
| `crm.import.view/execute` | CSV import |
| `crm.dashboard.view` | Dashboard metrics API |
| `crm.report.view` | Report APIs |
| `crm.search.view` | Global CRM search |
| `crm.export.view/execute` | Export |
| `crm.note.view/create/update/delete` | Notes |
| `crm.attachment.view/create/delete` | Attachments |

## Role assignments

| Role | CRM access |
|------|------------|
| Admin / Super Admin | All CRM permissions |
| Sales Manager | Full CRM + dashboard + reports + search + import + notes/attachments |
| Sales Executive | CRUD except delete on most; dashboard + reports + search |
| Viewer | View-only + dashboard + reports + search |

## Frontend

### API mode

Use `canCrmPermission('crm.lead.create')` — reads `user.permissions` from JWT session (`getStoredSession()`).

Helper: `frontend/src/utils/permissions/crm.ts`

### Demo mode

`canCrmPermission` falls back to the legacy demo matrix (`sales.view` / `sales.edit` / `sales.override`). **UI call sites must not call `canPermission('sales', …)` directly.**

### Legacy → modern mapping (UI)

| Old soft-gate | Modern code |
|---------------|-------------|
| `sales.view` (CRM shell / mobile) | `crm.dashboard.view` or any `crm.*.view` via `canAccessCrmShell()` |
| `sales.edit` (leads) | `crm.lead.update` |
| `sales.override` (lead delete) | `crm.lead.delete` |
| `sales.edit` (opportunities) | `crm.opportunity.update` |
| `sales.override` (opp delete) | `crm.opportunity.delete` |
| `sales.edit` (activities) | `crm.activity.create` / `update` / `complete` |
| `sales.override` (activity delete) | `crm.activity.delete` |
| `sales.edit` (follow-ups) | `crm.follow_up.create` / `update` |
| `sales.override` (follow-up delete) | `crm.follow_up.delete` |
| `sales.override` (company/contact delete) | `crm.company.delete` / `crm.contact.delete` |
| `sales.create` (quick-create customer/contact) | `crm.company.create` / `crm.contact.create` |

### Migration status

| Area | Backend | Frontend |
|------|---------|------------|
| Route guards | crm.* on API routes | CRM shell uses JWT / `canAccessCrmShell` |
| Lead / opportunity list & 360 | ✅ | ✅ `canCrmPermission` |
| Engagement panels | ✅ | ✅ |
| Import / notes / attachments / search / export | ✅ | ✅ |
| Demo transactional `salesStore` | N/A (deferred ERP) | Still `assertPermission('sales')` for demo SO/quote lifecycle |

## UI enforcement pattern

1. Hide buttons when `!canCrmPermission(...)`
2. Backend `requirePermission()` on every route — **never rely on hidden buttons alone**

## Tenant access

Separate from CRM permissions:

- `resolveTenant` middleware
- `requireTenantAccess`
- All repository queries include `tenantId`

Cross-tenant ID in URL → 403/404 even with valid CRM permission.
