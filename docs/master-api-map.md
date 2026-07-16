# Master API Map

**Project:** FOS ERP  
**Date:** 2026-07-13 (products + geography seed + CRM masters sync)  
**Base URL pattern:** `/api/v1/t/:tenantSlug/...` (existing CRM convention)  
**Alternate (same handlers):** `/api/v1/tenants/:tenantId/...`  
**Live OpenAPI:** `http://localhost:5000/api/docs` (development)

---

## API conventions

### Authentication
- Bearer JWT from login
- Tenant resolved from URL slug + membership check
- **Never** accept `tenantId` in request body

### Standard master CRUD

```text
GET    /api/v1/t/:tenantSlug/masters/:resource
GET    /api/v1/t/:tenantSlug/masters/:resource/:id
POST   /api/v1/t/:tenantSlug/masters/:resource
PATCH  /api/v1/t/:tenantSlug/masters/:resource/:id
DELETE /api/v1/t/:tenantSlug/masters/:resource/:id
POST   /api/v1/t/:tenantSlug/masters/:resource/:id/activate
POST   /api/v1/t/:tenantSlug/masters/:resource/:id/deactivate
```

### Query parameters (list endpoints)

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |
| `search` | string | Code, name, description |
| `status` | enum | ACTIVE, INACTIVE, ARCHIVED |
| `sortBy` | string | Field name |
| `sortOrder` | asc/desc | |
| `filters` | JSON | Resource-specific |

### Lookup endpoints (dropdowns)

```text
GET /api/v1/t/:tenantSlug/lookups/:resource
GET /api/v1/t/:tenantSlug/lookups/:resource?status=ACTIVE
GET /api/v1/t/:tenantSlug/lookups/:resource?parentId=uuid
```

Response shape:

```json
[
  { "id": "uuid", "code": "DEPT-001", "name": "Fabrication" }
]
```

Optional extra fields per resource (e.g. `probability` for stages).

### Bulk & import/export

```text
POST   /api/v1/t/:tenantSlug/masters/:resource/bulk-status
POST   /api/v1/t/:tenantSlug/masters/:resource/import
GET    /api/v1/t/:tenantSlug/masters/:resource/export
GET    /api/v1/t/:tenantSlug/masters/:resource/import-template
GET    /api/v1/t/:tenantSlug/masters/:resource/:id/usage
```

### Error responses

| Code | When |
|------|------|
| 409 | Duplicate code/name within tenant |
| 409 | Delete blocked — record in use (include `usage` array) |
| 422 | Zod validation failure |
| 403 | Missing permission |
| 404 | Not found or wrong tenant |

---

## Existing APIs (baseline)

| Resource | Base path | Status |
|----------|-----------|--------|
| Auth | `/api/v1/auth/*` | ✅ |
| Users | `/api/v1/t/:slug/users` | Partial (list/get) |
| Roles | `/api/v1/t/:slug/roles` | List only |
| CRM Companies | `/api/v1/t/:slug/crm/companies` | ✅ Full CRUD |
| CRM Contacts | `/api/v1/t/:slug/crm/contacts` | ✅ Full CRUD |
| CRM Leads | `/api/v1/t/:slug/crm/leads` | ✅ |
| CRM Opportunities | `/api/v1/t/:slug/crm/opportunities` | ✅ |
| CRM Activities | `/api/v1/t/:slug/crm/activities` | ✅ |
| CRM Pipelines | `/api/v1/t/:slug/crm/pipelines` | ✅ |
| CRM Quotations | `/api/v1/t/:slug/crm/quotations` | ✅ CRUD + lifecycle + convert-to-SO |
| CRM Quotation templates | `/api/v1/t/:slug/crm/quotation-templates` | ✅ |
| CRM Sales orders | `/api/v1/t/:slug/crm/sales-orders` | ✅ List/get (create via convert) |
| CRM Masters | `/api/v1/t/:slug/crm/masters/:kind` | ✅ incl. designations, departments |
| **Generic masters** | `/api/v1/t/:slug/masters/:resource` | ✅ geography, UOM, GST, **products** |
| **Items module** | `/api/v1/t/:slug/masters/items` | ✅ Phase 4 |
| **Vendors module** | `/api/v1/t/:slug/masters/vendors` | ✅ Phase 4 |
| **Master imports** | `/api/v1/t/:slug/masters/imports/*` | ✅ items, vendors, hsn-sac |
| **Master exports** | `/api/v1/t/:slug/masters/exports/*` | ✅ items, vendors, hsn-sac |
| **Lookups** | `/api/v1/t/:slug/lookups/:resource` | ✅ Phase 1 registry + items + vendors + products |

---

## Resource registry

`:resource` slug → permission prefix → lookup slug

### Phase 1 — Organisation

| Resource slug | Permission prefix | Lookup | Import/export UI |
|---------------|-------------------|--------|------------------|
| `departments` | `master.department.*` | `departments` | No (placeholder) |
| `countries` | `master.country.*` | `countries` | Seeded ✅ (31) |
| `states` | `master.state.*` | `states` | Seeded ✅ (36 IN) |
| `cities` | `master.city.*` | `cities?stateId=` | Seeded ✅ (108) |
| `warehouses` | `master.warehouse.*` | `warehouses` | Stub |
| `locations` | `master.location.*` | `locations?warehouseId=` | Stub |

### Phase 2 — Common

| Resource slug | Permission prefix | Lookup | Import/export UI |
|---------------|-------------------|--------|------------------|
| `uom` | `master.uom.*` | `uom` | Stub |
| `uom-conversions` | `master.uom-conversion.*` | — | No |
| `industries` | `master.industry.*` | `industries` | CRM CSV ✅ |
| `territories` | `master.territory.*` | `territories` | CRM CSV ✅ |
| `lead-sources` | `master.lead-source.*` | `lead-sources` | CRM CSV ✅ |
| `hsn-sac` | `master.hsn.*` | `hsn-sac` | Stub → **API ✅** (HSN only) |
| `gst-groups` | `master.gst_group.*` | `gst-groups` | Stub → **CRUD ✅** |
| `gst-rates` | `master.gst_rate.*` | `gst-rates` | Stub → **CRUD ✅** |
| `payment-terms` | `master.payment-term.*` | `payment-terms` | CRM CSV ✅ |
| `delivery-terms` | `master.delivery-term.*` | `delivery-terms` | CRM CSV ✅ |
| `warranty-terms` | `master.warranty-term.*` | `warranty-terms` | CRM CSV ✅ |
| `commercial-terms` | `master.commercial-term.*` | `commercial-terms` | CRM CSV ✅ |
| `freight-terms` | `master.freight-term.*` | `freight-terms` | Purchase CSV ✅ |

### Phase 3 — Parties

| Resource slug | Permission prefix | Notes |
|---------------|-------------------|-------|
| `companies` | `master.customer.*` | Extend existing `/crm/companies` or alias |
| `contacts` | `master.contact.*` | Extend `/crm/contacts` |
| `vendor-order-addresses` | `master.vendor-order-address.*` | New — not yet in DB |

### Phase 4 — Items & vendors ✅ **Implemented (2026-07-11)**

| Resource slug | Permission prefix | Lookup | Import/export |
|---------------|-------------------|--------|---------------|
| `item-categories` | `master.item_category.*` | `GET /lookups/item-categories` | Stub UI |
| `hsn-sac` | `master.hsn.*` (+ `master.hsn.import`) | `GET /lookups/hsn-sac?gstGroupId=` | ✅ CSV |
| `gst-groups` | `master.gst_group.*` | `GET /lookups/gst-groups` | Stub UI |
| `gst-rates` | `master.gst_rate.*` | `GET /lookups/gst-rates?gstGroupId=` | Stub UI |
| `items` | `master.item.*` (+ `master.item.import`) | `GET /lookups/items` (dedicated) | ✅ CSV |
| `vendors` | `master.vendor.*` (+ `master.vendor.import`) | `GET /lookups/vendors` (dedicated) | ✅ CSV |

**Generic CRUD** (registry resources):

```text
GET|POST   /api/v1/t/:slug/masters/:resource
GET|PATCH|DELETE /api/v1/t/:slug/masters/:resource/:id
POST       /api/v1/t/:slug/masters/:resource/:id/activate
POST       /api/v1/t/:slug/masters/:resource/:id/deactivate
```

Applies to: `item-categories`, `hsn-sac`, `gst-groups`, `gst-rates`, `products`, `countries`, `states`, `cities`, `uom`, `warehouses`, `locations` (+ other Phase 1 resources).

**Dedicated modules:**

```text
GET|POST   /api/v1/t/:slug/masters/items
GET|PATCH|DELETE /api/v1/t/:slug/masters/items/:id
POST       /api/v1/t/:slug/masters/items/:id/activate|deactivate

GET|POST   /api/v1/t/:slug/masters/vendors
GET|PATCH|DELETE /api/v1/t/:slug/masters/vendors/:id
POST       /api/v1/t/:slug/masters/vendors/:id/activate|deactivate
```

**Lookup endpoints:**

| Lookup slug | Path | Query params | Extra response fields |
|-------------|------|--------------|----------------------|
| `item-categories` | `/lookups/item-categories` | `status=ACTIVE` (default active-only) | `parentId`, `level` |
| `hsn-sac` | `/lookups/hsn-sac` | `gstGroupId`, `status` | `description`, `gstGroupId` |
| `gst-groups` | `/lookups/gst-groups` | `status` | `description`, `goodsType` |
| `gst-rates` | `/lookups/gst-rates` | `gstGroupId`, `status` | `fromState`, `locationStateCode`, `gstGroupId` |
| `items` | `/lookups/items` | `search`, `itemType`, `activeOnly` (default true), `page`, `limit` | `baseUomId`, `categoryId`, `hsnId`, `gstGroupId`, `standardRate` |
| `vendors` | `/lookups/vendors` | `search`, `activeOnly` (default true), `vendorType`, `page`, `limit` | `gstin`, `city`, `searchName` |

All lookups require `master.lookup.view`.

**Import/export endpoints:**

```text
GET  /api/v1/t/:slug/masters/imports/items/template      → master.item.view
POST /api/v1/t/:slug/masters/imports/items                 → master.item.import
GET  /api/v1/t/:slug/masters/exports/items                 → master.item.view

GET  /api/v1/t/:slug/masters/imports/vendors/template      → master.vendor.view
POST /api/v1/t/:slug/masters/imports/vendors                 → master.vendor.import
GET  /api/v1/t/:slug/masters/exports/vendors                 → master.vendor.view

GET  /api/v1/t/:slug/masters/imports/hsn-sac/template        → master.hsn.view
POST /api/v1/t/:slug/masters/imports/hsn-sac                 → master.hsn.import
GET  /api/v1/t/:slug/masters/exports/hsn-sac                 → master.hsn.view
```

Import body: `{ rows: Record<string,string>[], duplicateMode?: 'reject'|'skip'|'update' }`

**Delete restrictions (409 Conflict):**

| Resource | Blocked when |
|----------|--------------|
| `item-categories` | Child categories or items exist |
| `hsn-sac` | Items reference hsnId |
| `gst-groups` | HSN codes, GST rates, or items reference group |
| `gst-rates` | No inbound FKs — delete allowed |
| `items` / `vendors` | Soft delete always succeeds (transactional checks deferred) |

### Phase 5 — CRM pipeline refs

| Resource slug | Permission prefix | Lookup |
|---------------|-------------------|--------|
| `lead-stages` | `master.lead-stage.*` | `lead-stages` |
| `lead-priorities` | `master.lead-priority.*` | `lead-priorities` |
| `lead-reasons` | `master.lead-reason.*` | `lead-reasons` |
| `opportunity-stages` | `master.opportunity-stage.*` | `opportunity-stages` |
| `opportunity-priorities` | `master.opportunity-priority.*` | `opportunity-priorities` |
| `activity-types` | `master.activity-type.*` | `activity-types` |
| `lost-reasons` | `master.lost-reason.*` | `lost-reasons` |
| `product-interests` | `master.product-interest.*` | `product-interests` |
| `approval-rules` | `master.approval-rule.*` | — |
| `document-types` | `master.document-type.*` | `document-types` |

### Phase 6 — Purchase

| Resource slug | Permission prefix | Import/export |
|---------------|-------------------|---------------|
| `buyers` | `master.buyer.*` | No |
| `qc-rules` | `master.qc-rule.*` | No |
| `grn-tolerance` | `master.grn-tolerance.*` | No |
| `return-reasons` | `master.return-reason.*` | CSV ✅ |

### Phase 7 — Manufacturing

| Resource slug | Permission prefix | Status |
|---------------|-------------------|--------|
| `products` | `master.product.*` | ✅ Registry CRUD + seed (2026-07-13) |
| `boms` | `master.bom.*` | Not started |
| `routings` | `master.routing.*` | Not started |
| `work-centres` | `master.work-centre.*` | Not started |
| `serial-numbers` | `master.serial-number.*` | Not started |

### Phase 8 — Quality

| Resource slug | Permission prefix |
|---------------|-------------------|
| `qc-parameters` | `master.qc-parameter.*` |
| `inspection-plans` | `master.inspection-plan.*` |
| `quality-test-groups` | `master.quality-test-group.*` |

### Phase 9 — Configuration

| Resource slug | Permission prefix |
|---------------|-------------------|
| `payment-methods` | `master.payment-method.*` |
| `banks` | `master.bank.*` |
| `bank-accounts` | `master.bank-account.*` |
| `code-series` | `master.code-series.*` |
| `approval-workflows` | `master.approval-workflow.*` |

### Administration (existing partial)

| Resource slug | Permission prefix | Status |
|---------------|-------------------|--------|
| `users` | `master.user.*` / `admin.user.*` | Extend CRUD |
| `roles` | `master.role.*` | Add CRUD |
| `permissions` | `master.permission.*` | Read-only matrix |

---

## Shared backend module structure

```text
backend/src/modules/masters/
├── shared/
│   ├── master.controller.factory.ts
│   ├── master.service.factory.ts
│   ├── master.validation.ts
│   ├── master.types.ts
│   └── usage-check.service.ts
├── organisation/
├── inventory/
├── tax/
├── parties/
├── crm-refs/
├── purchase/
├── manufacturing/
├── quality/
├── configuration/
├── masters.routes.ts
└── lookups.routes.ts
```

### Factory pattern
- Generic list/create/update/soft-delete/activate/deactivate
- Resource-specific Zod schemas and `include` relations
- Usage check hooks per resource

---

## Frontend service layer (to create)

```text
trailer-erp/src/services/api/
├── masterApi.ts          # CRUD per resource
├── masterApiBridge.ts    # Store delegation (like crmApiBridge)
├── lookupApi.ts          # Cached lookups
├── lookupCache.ts        # In-memory + Zustand refresh
└── masterTypes.ts        # API DTOs
```

### Hooks

```text
trailer-erp/src/hooks/
├── useMasterLookups.ts   # Generic lookup hook
├── useCrmMasters.ts      # Migrate from crmMasterStore in API mode
└── usePurchaseMasters.ts # Migrate from purchaseMasterStore
```

---

## Permission seed pattern

```text
master.{resource}.view
master.{resource}.create
master.{resource}.update
master.{resource}.delete
master.{resource}.import
master.{resource}.export
```

Roles to update:
- Super Admin — all
- Tenant Admin — all tenant masters
- **Master Data Manager** — all `master.*` (create role if missing)
- CRM Admin — CRM ref masters + companies/contacts
- Sales/Purchase/Inventory/Production Manager — view + limited create on domain masters
- Viewer — `*.view` only

---

## CRM company API alignment

Existing `/crm/companies` already serves customer master. Options:

1. **Alias:** `GET /masters/companies` → same handler (recommended)
2. **Dual sync:** masterStore.customers ↔ CrmCompany (current API mode pattern)

Fields to add to company API when masters exist:
- `industryId`, `territoryId`, `paymentTermsId`
- Validate FK ownership within tenant

---

## Lookup API catalogue (complete list)

| Lookup slug | Used by |
|-------------|---------|
| `countries` | Customer, vendor, location forms |
| `states` | Address forms |
| `cities` | Address forms |
| `departments` | User, contact, work centre, PR |
| `designations` | User, contact |
| `uom` | Item, PO, GRN, opportunity lines |
| `item-categories` | Item, QC rules |
| `items` | PO, GRN, PR, RFQ, BOM, opportunity, inventory |
| `warehouses` | Item category, GRN, stock |
| `locations` | SO, PO, GRN |
| `hsn-sac` | Item |
| `gst-groups` | Item, HSN |
| `gst-rates` | Sales, purchase tax |
| `industries` | Company, lead |
| `territories` | Company, owner |
| `lead-sources` | Lead, company |
| `lead-stages` | Lead list/filter |
| `lead-priorities` | Lead form |
| `lead-reasons` | Lead close |
| `opportunity-stages` | Opportunity pipeline |
| `opportunity-priorities` | Opportunity form |
| `activity-types` | Activity timeline |
| `lost-reasons` | Opportunity lost |
| `payment-terms` | Customer, quotation, SO, PO |
| `delivery-terms` | Quotation, PO |
| `warranty-terms` | Quotation |
| `freight-terms` | PO, vendor quotation |
| `vendors` | PO, GRN |
| `customers` | Quotation, SO |
| `contacts` | Lead, opportunity |
| `users` | Owner, buyer assignment |
| `buyers` | PR, RFQ |
| `work-centres` | Routing, WO |
| `payment-methods` | Vendor |
| `banks` | Bank account |

---

## Tests per API group

| Test file | Coverage |
|-----------|----------|
| `masters-organisation.test.ts` | Tenant isolation, geo hierarchy |
| `masters-inventory.test.ts` | UOM, category tree, item FKs |
| `masters-tax.test.ts` | GST rate date ranges |
| `masters-crm-refs.test.ts` | Catalog CRUD, import |
| `masters-parties.test.ts` | Vendor, company FK migration |
| `masters-lookups.test.ts` | Active-only, cache invalidation |
| `masters-usage.test.ts` | Delete blocked when referenced |

Run: `cd backend && npm test`

---

## Phase 4 frontend integration

| Concern | Demo mode (`VITE_USE_API=false`) | API mode (`VITE_USE_API=true`) |
|---------|----------------------------------|--------------------------------|
| Master CRUD | `masterStore` + localStorage seed | `masterBatchApiBridge` → API → store upsert |
| Initial hydrate | Seed on load | `useMasterApiSync()` pulls all batch masters |
| Item/vendor dropdowns | Filter local store | `useItemLookup` / `useVendorLookup` → lookup APIs |
| Import/export | Alert stub (except CRM catalogs) | `MasterBatchImportDialog` + `downloadMasterExport` for items/vendors/hsn-sac |
| Lookup cache | `lookupCache.ts` bump on store write | Same; refreshed after import sync |

**Frontend services:** `trailer-erp/src/services/api/masterBatchApi.ts`, `masterBatchApiBridge.ts`  
**Lookup components:** `ItemLookupSelect`, `VendorLookupSelect`  
**Tests:** `backend/tests/master-batch.test.ts`, `master-import.test.ts`, `master-tenant-isolation.test.ts`

**Skipped (no designed UI):** item groups, UOM conversions, vendor groups
