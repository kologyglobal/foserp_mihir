# Master Database Map

**Project:** FOS ERP  
**Date:** 2026-07-11 (Phase 4 batch update)  
**Database:** MySQL via Prisma (`backend/prisma/schema.prisma`)

---

## Conventions

### Standard master columns (all new tenant-owned tables)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `tenantId` | UUID | FK → `tenants.id`, required on every query |
| `code` | VARCHAR(32–64) | Business code; auto or manual per UI |
| `name` | VARCHAR(200–300) | Display name |
| `description` | TEXT | Optional |
| `status` | ENUM | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `createdBy` | UUID | Nullable FK to user |
| `updatedBy` | UUID | Nullable |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |
| `deletedAt` | DateTime | Soft delete |

### Standard indexes

```text
@@index([tenantId])
@@index([tenantId, code])
@@index([tenantId, name])
@@index([tenantId, status])
@@index([tenantId, deletedAt])
@@index([tenantId, parentId])   // where hierarchical
```

### Composite uniqueness (typical)

```text
@@unique([tenantId, code])
@@unique([tenantId, name])      // where name must be unique
```

---

## Existing backend tables (baseline)

| Table | Prisma model | Master? | Notes |
|-------|--------------|---------|-------|
| `tenants` | Tenant | Platform | Multi-tenant root |
| `users` | User | Partial | Auth user; not CRM owner catalog |
| `roles` | Role | Partial | List API only |
| `permissions` | Permission | Partial | Global seed; no CRUD |
| `user_roles` | UserRole | Junction | |
| `role_permissions` | RolePermission | Junction | |
| `audit_logs` | AuditLog | Platform | Reuse for master audit |
| `code_series` | CodeSeries | Partial | 5 CRM entity types only |
| `crm_companies` | CrmCompany | **Yes** | Customer/company master (API exists) |
| `crm_contacts` | CrmContact | **Yes** | Contact master (API exists) |
| `crm_leads` | CrmLead | Transactional | References masters as strings today |
| `crm_activities` | CrmActivity | Transactional | |
| `crm_pipelines` | CrmPipeline | Config | Opportunity pipeline |
| `crm_pipeline_stages` | CrmPipelineStage | Config | Overlaps opportunity-stages master |
| `crm_opportunities` | CrmOpportunity | Transactional | |
| `crm_opportunity_lines` | CrmOpportunityLine | Transactional | itemId/uom as strings |
| `master_countries` | MasterCountry | **Yes** | Phase 1 — geography |
| `master_states` | MasterState | **Yes** | Phase 1 |
| `master_cities` | MasterCity | **Yes** | Phase 1 |
| `master_uom` | MasterUom | **Yes** | Phase 1 |
| `master_warehouses` | MasterWarehouse | **Yes** | Phase 1 |
| `master_locations` | MasterLocation | **Yes** | Phase 1 |
| `master_item_categories` | MasterItemCategory | **Yes** | Phase 4 |
| `master_hsn_codes` | MasterHsnCode | **Yes** | Phase 4 (`hsn-sac` API slug) |
| `master_gst_groups` | MasterGstGroup | **Yes** | Phase 4 |
| `master_gst_rates` | MasterGstRate | **Yes** | Phase 4 |
| `master_items` | MasterItem | **Yes** | Phase 4 — dedicated module |
| `master_vendors` | MasterVendor | **Yes** | Phase 4 — dedicated module |

---

## Proposed master tables by phase

### Phase 1 — Organisation foundation

#### `departments`
| Extra fields | Relations |
|--------------|-----------|
| `parentId` (nullable self-FK), `costCentreCode` | → users.departmentId (migrate from string) |

#### `designations`
| Extra fields | Relations |
|--------------|-----------|
| `departmentId` (optional) | → users.designationId, contacts.designationId |

#### `plants`
| Extra fields | Relations |
|--------------|-----------|
| `branchId` (optional), address block | → warehouses.plantId |

#### `branches`
| Extra fields | Relations |
|--------------|-----------|
| address, GSTIN, PAN | → plants, locations |

#### `financial_years`
| Extra fields | Relations |
|--------------|-----------|
| `startDate`, `endDate`, `isCurrent` | Document date validation |

**Note:** Frontend has **placeholder** department page only; plant/branch/financial-year pages **do not exist** — defer unless added to UI.

#### `warehouses` (exists in frontend, not DB)
| Extra fields | Relations |
|--------------|-----------|
| `warehouseType` ENUM, `plantCode`/`plantId`, address | → locations.warehouseId, item default warehouse |

#### `locations` (exists in frontend, not DB)
| Extra fields | Relations |
|--------------|-----------|
| Full BC-style fields from `Location` type | → warehouseId FK |

#### Geography (exists in frontend)

| Table | Extra fields | Relations |
|-------|--------------|-----------|
| `countries` | `countryCode` (ISO), `countryName` | → states |
| `states` | `stateCode`, `stateName` | countryId FK → cities |
| `cities` | `cityName` | stateId FK |

---

### Phase 2 — Common business masters

#### `units_of_measure`
| Extra fields | Relations |
|--------------|-----------|
| `uomType`, `decimalPlaces`, `isBaseUnit` | → items.baseUomId, purchaseUomId |

#### `unit_conversions`
| Extra fields | Relations |
|--------------|-----------|
| `fromUomId`, `toUomId`, `factor` | Both → units_of_measure |

#### `industries`
| Extra fields | Relations |
|--------------|-----------|
| Standard CRM catalog attrs | → crm_companies.industryId (migrate from string) |

#### `territories`
| Extra fields | Relations |
|--------------|-----------|
| `region`, `state`, `country` | → crm_companies.territoryId, users |

#### `lead_sources`
| Extra fields | Relations |
|--------------|-----------|
| `sourceType` | → crm_leads.sourceId |

#### Tax tables — **Implemented (Phase 4)**

| Table | Prisma model | Extra fields | Relations |
|-------|--------------|--------------|-----------|
| `master_gst_groups` | MasterGstGroup | `goodsType`, `description` | → hsn codes, gst rates, items |
| `master_hsn_codes` | MasterHsnCode | `code`, `description`, `gstGroupId` | → gst group; ← items |
| `master_gst_rates` | MasterGstRate | `fromState`, `locationStateCode`, `dateFrom`, `dateTo`, sgst/cgst/igst | → gst group only (no inbound FKs) |

#### Terms (CRM catalog → dedicated tables)

| Table | Extra fields |
|-------|--------------|
| `payment_terms` | `days`, `advancePct`, terms text |
| `delivery_terms` | `incoterm`, `leadTimeDays` |
| `warranty_terms` | warranty period fields |
| `commercial_terms` | quotation clause text |
| `freight_terms` | `freightIncluded` boolean |

---

### Phase 3 — Party masters

#### `vendor_order_addresses`
| Extra fields | Relations |
|--------------|-----------|
| address block, GSTIN | vendorId FK |

#### Extend `crm_companies` (already exists)
| Migration | Change |
|-----------|--------|
| Add FKs | `industryId`, `territoryId`, `paymentTermsId` |
| Deprecate | `industry`, `salesTerritory` string columns (keep for migration period) |

#### Extend `crm_contacts` (already exists)
| Migration | Change |
|-----------|--------|
| Add FKs | `designationId`, `departmentId` |
| Deprecate | free-text designation/department |

---

### Phase 4 — Item & vendor masters ✅ **Implemented (2026-07-11)**

#### `master_item_categories` (`MasterItemCategory`)
| Extra fields | Relations | Indexes |
|--------------|-----------|---------|
| `parentId`, `level`, `defaultWarehouseId` | Self-ref hierarchy; → `master_warehouses`; ← `master_items` | `[tenantId, parentId]`, unique `[tenantId, code]` |

#### `master_hsn_codes` (`MasterHsnCode`) — API slug `hsn-sac`
| Extra fields | Relations | Indexes |
|--------------|-----------|---------|
| `code` (HSN), `description`, `gstGroupId` | → `master_gst_groups`; ← `master_items` | unique `[tenantId, code]`, `[tenantId, gstGroupId]` |

#### `master_gst_groups` (`MasterGstGroup`)
| Extra fields | Relations | Indexes |
|--------------|-----------|---------|
| `goodsType`, `description` | ← hsn codes, gst rates, items | unique `[tenantId, code]` |

#### `master_gst_rates` (`MasterGstRate`)
| Extra fields | Relations | Indexes |
|--------------|-----------|---------|
| `gstGroupId`, `fromState`, `locationStateCode`, `dateFrom`, `dateTo`, sgst/cgst/igst | → `master_gst_groups` only | unique `[tenantId, code]`, `[tenantId, gstGroupId]` |

#### `master_items` (`MasterItem`) — dedicated `/masters/items` module
| Extra fields | Relations |
|--------------|-----------|
| Full item profile: `itemType`, `productType`, `inventoryType`, `materialGrade`, `hsnCode` (denormalized), `hsnId`, `gstGroupId`, `reorderLevel`, `standardRate`, `isPurchasable`, `isStockable`, `isBlocked`, `purchaseUomId`, `qcRequired`, `productionBomId`, `routingNo`, etc. | → `master_item_categories`, `master_uom` (base + purchase), `master_hsn_codes`, `master_gst_groups` |

#### `master_vendors` (`MasterVendor`) — dedicated `/masters/vendors` module
| Extra fields | Relations |
|--------------|-----------|
| Address block (text + optional `countryId`/`stateId`/`cityId` FKs), `gstin`, `gstVendorType`, `pan`, `paymentMethod`, `bankDetails`, `vendorType`, `contactPerson`, `contactPhone`, `paymentTermsDays`, `defaultLeadTimeDays`, `suppliedCategories` (JSON), `rating`, `isBlocked` | → geography masters (optional FKs); used by PO/GRN/RFQ (frontend store today) |

**Delete restrictions (DB-enforced via service):**
- Category — blocked if child categories or items exist
- HSN — blocked if referenced by items
- GST group — blocked if referenced by HSN codes, GST rates, or items
- GST rate — no inbound master FKs; soft delete allowed
- Item / Vendor — soft delete allowed (no transactional FK tables yet)

**Skipped (no designed UI):** item groups, UOM conversions, vendor groups, brands, item_warehouse_mappings

---

### Phase 5 — CRM / sales reference masters

Generic pattern: **`crm_reference_masters`** table with JSON `attributes` OR dedicated tables per kind.

**Recommendation:** Dedicated tables for query/index performance; shared service layer.

| Table | Maps to frontend kind | Key extra columns |
|-------|----------------------|-------------------|
| `lead_stages` | lead-stages | stageType, color, nextAction, sortOrder |
| `lead_priorities` | lead-priorities | slaHours, color |
| `lead_reasons` | lead-reasons | category ENUM |
| `opportunity_stages` | opportunity-stages | probability, stageType, color — **sync with CrmPipelineStage** |
| `opportunity_priorities` | opportunity-priorities | valueThreshold, color |
| `activity_types` | activity-types | useInActivity, useInFollowUp, icon, color |
| `lost_reasons` | lost-reasons | category |
| `product_interests` | product-interests | standard |
| `approval_rules` | approval-rules | rule JSON / thresholds |
| `document_types` | document-types | standard |

#### `salespersons` / CRM owners
**Decision:** Link `ownerId` on CRM entities to `users.id` (not separate owners table). Extend User with territoryId, employeeCode for CRM assignment UI.

---

### Phase 6 — Purchase masters

| Table | Frontend kind |
|-------|---------------|
| `purchase_buyers` | buyers |
| `purchase_qc_rules` | qc-rules — scopeType, itemId FK, categoryId FK |
| `grn_tolerance_rules` | grn-tolerance |
| `purchase_return_reasons` | return-reasons |

---

### Phase 7 — Manufacturing masters

| Table | Store today | Key relations |
|-------|-------------|---------------|
| `products` | productMasterStore | FG variants |
| `boms` + `bom_lines` | bomStore | itemId FKs |
| `routings` + `routing_operations` | routingStore | workCentreId |
| `work_centres` | workCenterStore | departmentId (when master exists) |
| `serial_numbers` | serialStore | itemId |

---

### Phase 8 — Quality masters

| Table | Route |
|-------|-------|
| `qc_parameters` | `/quality/parameters` |
| `inspection_plans` + lines | `/quality/inspection-plans` |
| `quality_test_groups` | Placeholder page — create when UI implemented |

---

### Phase 9 — Configuration masters

| Table | Frontend |
|-------|----------|
| `payment_methods` | `/masters/payment-methods` |
| `banks` | `/masters/banks` |
| `bank_accounts` | `/masters/bank-accounts` |
| `code_series_config` | Extend CodeSeries — full frontend series registry |
| `approval_workflows` | `/masters/approval-workflows` |

---

## CRM transactional FK migration plan

Current CRM models store master values as **strings**. After master tables exist:

| Entity | Current field | Target FK |
|--------|---------------|-----------|
| CrmCompany | `industry` | `industryId` |
| CrmCompany | `salesTerritory` | `territoryId` |
| CrmCompany | `source` | `leadSourceId` |
| CrmCompany | `ownerId` | `users.id` (validate tenant) |
| CrmLead | `source`, `stage`, `priority` | FK to respective masters |
| CrmLead | `industry` | `industryId` |
| CrmOpportunity | `priority` | `opportunityPriorityId` |
| CrmOpportunity | `lostReason` | `lostReasonId` |
| CrmOpportunityLine | `uom` | `uomId` |
| CrmOpportunityLine | `itemId` | `items.id` |

Migration strategy: add nullable FK columns → backfill from seed/code match → switch API → deprecate strings.

---

## Code series expansion

Extend `CodeSeriesEntity` enum or replace with flexible `code_series_definitions`:

| Frontend series | Suggested prefix |
|-----------------|------------------|
| Department | DEPT |
| Warehouse | WH |
| UOM | UOM |
| Item | ITEM |
| Vendor | VEND |
| Customer | CUST |
| Work centre | WC |
| BOM | BOM |

Transaction-safe increment per `(tenantId, entityType)`.

---

## Tables explicitly OUT OF SCOPE (no frontend page)

| Suggested in brief | Reason |
|--------------------|--------|
| Branch, Plant, Business unit | No designed page |
| Supplier (separate from Vendor) | Vendor master used |
| Brand, Item variant, Item attribute | No page |
| Sales team, Price list (placeholder only) | Placeholder |
| Bin/location (separate from Location) | Location master covers |
| Equipment/maintenance masters | No pages in `/masters` |
| Ledger, account group, currency | No finance master pages |

---

## Entity count summary

| Status | Count |
|--------|-------|
| Existing DB tables (all) | 32 |
| Implemented master tables | 13 (+ partial User/Role/CodeSeries) |
| New tables still required | ~35–40 |
| Placeholder UI (needs table when UI built) | 3 |

See `docs/master-implementation-plan.md` for build order.
