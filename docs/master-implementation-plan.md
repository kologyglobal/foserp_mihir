# Master Implementation Plan

**Project:** FOS ERP  
**Date:** 2026-07-10  
**Prerequisite:** Audit docs complete (`master-module-audit.md`, `master-database-map.md`, `master-api-map.md`, `master-usage-map.md`). Canonical routes and aliases: [`MASTER_REGISTRY.md`](MASTER_REGISTRY.md).

---

## Executive summary

| Metric | Value |
|--------|-------|
| Designed master pages | ~56 |
| Fully implemented UI | ~51 |
| Placeholder UI only | 3 (departments, price lists, quality test groups) |
| Backend master APIs today | 1 (customer via CRM companies) |
| Estimated new DB tables | ~45–50 |
| Estimated API resources | ~45 |
| Lookup endpoints | ~35 |

**Completion criteria:** Every designed master page connected to tenant-scoped APIs; all hardcoded master arrays replaced in API mode; demo mode unchanged.

---

## Architecture decisions

### 1. Route convention
Use existing tenant slug pattern: `/api/v1/t/:tenantSlug/masters/:resource` (matches CRM).

### 2. Customer master
Extend `CrmCompany` API — do not duplicate. Alias `/masters/companies` to same handlers.

### 3. CRM catalog masters
Dedicated tables per kind (not single JSON blob) for indexing and FK migration.

### 4. CRM owners
Map to `users` table; deprecate `owners` catalog entries in API mode.

### 5. Opportunity stages
Bi-directional sync between `opportunity-stages` master and `CrmPipelineStage` — single write path through master API.

### 6. Shared master factory
Generic CRUD service + resource-specific Zod schemas + usage-check hooks.

### 7. Frontend bridge
Mirror CRM pattern: dynamic `import('./masterApiBridge')` from stores to avoid circular deps.

### 8. Lookup cache
Central `lookupCache` with TTL + explicit invalidation on master mutations.

---

## Phase 0 — Audit ✅

- [x] `docs/master-module-audit.md`
- [x] `docs/master-database-map.md`
- [x] `docs/master-api-map.md`
- [x] `docs/master-usage-map.md`
- [x] `docs/master-implementation-plan.md`

**Gate:** Review audit before Phase 1 coding.

---

## Phase 1 — Backend foundation (Week 1)

### 1.1 Shared master module
- [ ] `MasterStatus` enum: ACTIVE, INACTIVE, ARCHIVED
- [ ] Base Prisma mixin / code generator for standard columns
- [ ] `master.service.factory.ts` — list, get, create, update, softDelete, activate, deactivate
- [ ] `master.validation.ts` — shared Zod helpers (code, name, tenant FK check)
- [ ] `usage-check.service.ts` — pluggable usage queries
- [ ] Audit log integration for all master mutations
- [ ] `masters.routes.ts` + `lookups.routes.ts` mounted under tenant router

### 1.2 Permissions
- [ ] Seed `master.*` permissions for all resources (see api-map)
- [ ] Create **Master Data Manager** role
- [ ] Assign permissions to Tenant Admin, domain managers, Viewer

### 1.3 Code series expansion
- [ ] Extend `CodeSeries` model for configurable entity types OR new `code_series_definitions` table
- [ ] REST API for code series master page
- [ ] Transaction-safe `nextCode(tenantId, entityType)`

### 1.4 Frontend foundation
- [ ] `masterApi.ts`, `lookupApi.ts`, `lookupCache.ts`
- [ ] `useLookup(resource)` hook
- [ ] `isApiMode()` guards in master stores (like CRM)
- [ ] `masterApiBridge.ts` skeleton

### Verification
```bash
cd backend && npm run typecheck && npm run build && npm test
cd trailer-erp && npm run typecheck
```

---

## Phase 2 — Organisation & geography (Week 1–2)

### Database + API
| Resource | Priority | Notes |
|----------|----------|-------|
| `countries` | P0 | FK root for states |
| `states` | P0 | countryId FK |
| `cities` | P0 | stateId FK |
| `warehouses` | P0 | Used everywhere |
| `locations` | P0 | warehouseId FK |
| `departments` | P1 | Placeholder UI — minimal API + build page OR keep placeholder |

### Frontend integration
- [ ] Wire `GeographyPages.tsx` to API
- [ ] Wire `WarehousePages.tsx`, `LocationPages.tsx`
- [ ] Update `useActiveWarehouses()`, `useActiveLocations()` for API mode
- [ ] Replace geo cascades in customer/vendor forms

### Tests
- [ ] Tenant isolation on all geo entities
- [ ] Cannot delete country with states
- [ ] Lookup returns active only

---

## Phase 3 — Inventory & tax foundations (Week 2)

### Database + API
| Resource | Priority |
|----------|----------|
| `uom` | P0 |
| `item-categories` | P0 |
| `hsn-codes` | P0 |
| `gst-groups` | P0 |
| `gst-rates` | P0 |
| `items` | P0 — largest master |
| `vendors` | P0 |
| `vendor-order-addresses` | P1 |

### Frontend integration
- [ ] Wire all inventory master pages
- [ ] Update `useMasterLists.ts` hooks for API mode
- [ ] Wire item form FK dropdowns (category, UOM, HSN, GST)
- [ ] Wire vendor pages + order address pages
- [ ] Purchase PR/PO/GRN: vendor, item, uom, warehouse, location lookups

### Hardcoded replacements
- [ ] Remove `VENDOR_PAYMENT_METHODS` usage → payment-methods lookup (Phase 9 or early stub)

### Tests
- [ ] Item FK validation (category, uom, hsn within tenant)
- [ ] Category tree parent-child
- [ ] GST rate date range validation
- [ ] Item delete blocked when in BOM

---

## Phase 4 — CRM reference masters (Week 2–3)

### Database + API (13 catalog kinds)
- [ ] `lead-sources`, `industries`, `territories`
- [ ] `lead-stages`, `lead-priorities`, `lead-reasons`
- [ ] `opportunity-stages`, `opportunity-priorities`
- [ ] `activity-types`, `lost-reasons`
- [ ] `payment-terms`, `delivery-terms`, `warranty-terms`, `commercial-terms`
- [ ] `product-interests`, `approval-rules`, `document-types`

### Import/export
- [ ] Backend CSV import/export for kinds flagged `importExport: true`
- [ ] `CrmMasterPages.tsx`: API mode → backend import; demo → local CSV

### CRM FK migration
- [ ] Add nullable FK columns on CrmCompany, CrmLead, CrmOpportunity
- [ ] Backfill from seed codes
- [ ] Update CRM APIs to accept/return IDs

### Frontend integration
- [ ] Migrate `useCrmMasters.ts` to lookup API in API mode
- [ ] Replace `TERRITORIES` hardcode in `CustomerFormSections.tsx`
- [ ] Replace `INDUSTRY_OPTIONS` in quick create + lead forms
- [ ] Replace `getActiveLeadUsers()` with users lookup
- [ ] Wire lead/opportunity stage/priority/reason dropdowns

### Opportunity stage sync
- [ ] Master write updates `CrmPipelineStage`
- [ ] Pipeline API reads from same source

### Tests
- [ ] CRM catalog CRUD + import
- [ ] Inactive stage excluded from lead form dropdown
- [ ] Territory tenant isolation

---

## Phase 5 — Purchase masters (Week 3)

### Database + API
- [ ] `freight-terms`, `buyers`, `qc-rules`, `grn-tolerance`, `return-reasons`

### Frontend integration
- [ ] Wire `PurchaseMasterPages.tsx` to API
- [ ] Update `usePurchaseMasters.ts` for API mode
- [ ] PO form: freight terms, buyers, payment/delivery terms lookups
- [ ] GRN: QC rules, tolerance validation

### Tests
- [ ] QC rule scope (item vs category)
- [ ] GRN tolerance calculation

---

## Phase 6 — Manufacturing masters (Week 3–4)

### Database + API
- [ ] `products`, `work-centres`, `boms` (+ lines), `routings` (+ operations), `serial-numbers`

### Frontend integration
- [ ] Wire BOM, routing, work centre, product, serial pages
- [ ] Item form: BOM/routing FK lookups
- [ ] Replace work centre department hardcode → departments lookup

### Tests
- [ ] BOM circular reference prevention
- [ ] Work centre delete blocked if in routing

---

## Phase 7 — Quality masters (Week 4)

### Database + API
- [ ] `qc-parameters`, `inspection-plans`
- [ ] `quality-test-groups` (when placeholder UI built)

### Frontend integration
- [ ] Wire `QcMasterPages.tsx`
- [ ] Replace `QUALITY_TEST_GROUP_OPTIONS` in item form
- [ ] GRN QC workflow uses inspection plan lookup

---

## Phase 8 — Configuration & admin (Week 4)

### Database + API
- [ ] `payment-methods`, `banks`, `bank-accounts`
- [ ] `code-series` full config API
- [ ] `approval-workflows`
- [ ] Extend `users` CRUD; `roles` CRUD

### Frontend integration
- [ ] Wire payment method, bank, bank account pages
- [ ] Wire code series page to backend
- [ ] User master page → users API (not demo owners)
- [ ] Role/permission matrix → roles API

---

## Phase 9 — Cross-module hardcoded sweep (Week 4–5)

Run after each phase group, final pass:

- [ ] Grep for static arrays: territories, industries, departments, gst rates, uom strings
- [ ] Replace all with `useLookup()` or domain hooks
- [x] Remove duplicate `commercialTerms` vs CRM payment-terms — done 2026-07-13 (P3-6); see [`MASTER_REGISTRY.md`](MASTER_REGISTRY.md)
- [ ] Align `leadUtils` / `opportunityUtils` with master lookups
- [ ] Sales tax: use GST rate master not `[0,5,12,18,28]`

---

## Phase 10 — Verification & completion report (Week 5)

### Per master group verification
```bash
cd backend && npm run typecheck && npm run build && npm test
cd trailer-erp && npm run typecheck && npm run build
npm run test:crm-integration   # demo mode regression
npx tsx backend/scripts/verify-masters-api.ts  # create
```

### Manual test matrix
- [ ] Create, edit, deactivate, search each master
- [ ] Tenant A cannot see Tenant B records
- [ ] Lookup dropdowns in CRM, purchase, sales forms
- [ ] Delete blocked with usage message
- [ ] Import/export on CRM catalog masters
- [ ] Demo mode (`VITE_USE_API=false`) unchanged
- [ ] API mode (`VITE_USE_API=true`) no seed data in dropdowns

### Completion report deliverables
1. All master pages found vs implemented
2. DB tables created (migration list)
3. APIs created (resource list)
4. Permissions seeded
5. Frontend pages connected
6. Hardcoded lists removed (file list)
7. Modules using each master
8. Import/export status
9. Test results
10. Build results
11. Remaining gaps (placeholders, field mismatches)
12. Migration/seed commands

---

## Migration & seed commands (target)

```bash
# Backend
cd backend
npx prisma migrate dev --name masters_phase_N
npx prisma db seed

# Verify
npx tsx scripts/verify-masters-api.ts

# Frontend
cd trailer-erp
VITE_USE_API=true npm run dev
```

**Seed tenant:** `vasant-trailers`  
**Login:** `admin@vasant-trailers.com` / `Admin@123`

---

## Risk register

| Risk | Mitigation |
|------|------------|
| CRM string fields → FK migration breaks existing data | Nullable FKs + backfill script + keep strings during transition |
| Opportunity stages dual source (pipeline vs master) | Single write path; migration script syncs |
| Frontend typecheck failures in unrelated modules | Fix only master-touched files; track pre-existing errors separately |
| 56 masters = large scope | Strict phase gates; ship lookup APIs before full CRUD where needed |
| Circular store imports | Dynamic import bridge (proven CRM pattern) |
| Code series 60+ types | Extend enum gradually; map frontend series to backend |

---

## Out of scope (confirmed no frontend page)

- Branch, plant, business unit masters
- Brand, item variant, item attribute
- Equipment / maintenance masters
- Full accounting (ledger, account group)
- Price list (placeholder only — implement when UI built)

---

## Immediate next action

**Begin Phase 1** after audit review:

1. Create shared master module scaffold in backend
2. Implement geography + warehouse + location as first vertical slice (proves factory + lookups + frontend wiring)
3. Expand resource by resource following dependency order in this plan

Do not batch-create all 50 tables before wiring first end-to-end master (UOM or Country recommended as smoke test).
