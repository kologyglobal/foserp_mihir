# Master Usage Map

**Project:** FOS ERP  
**Date:** 2026-07-11 (Phase 4 batch update)  
**Purpose:** Where each master appears across the frontend — dropdowns, filters, forms, tables, and hardcoded replacements

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 📋 | List/table column |
| 🔽 | Dropdown / select |
| 🔍 | Search / filter |
| ✏️ | Form field |
| 🔗 | FK / relationship |
| ⚠️ | Hardcoded — must replace |
| ✅ | Already wired to store |

---

## Core masters (`masterStore`)

### Customer / Company (`customers`)

| Module | File / component | Usage |
|--------|------------------|-------|
| Masters | `CustomerPages.tsx` | Full CRUD |
| CRM | `CrmLeadListPage`, `Lead360Workspace` | 🔍 Filter by company |
| CRM | `OpportunityNewPage`, `OpportunityEditPage`, `Opportunity360Page` | 🔽 Customer select |
| CRM | `CrmContactFormPage`, `CrmQuickCreateDrawers` | 🔽 Company link |
| CRM | `CompanyImportDialog`, `ContactImportDialog` | Import target |
| Sales | `salesStore.ts` | 🔗 Quotation, SO customerId |
| Quick create | `quickCreateService.ts` | Inline create |
| API mode | `crmApiBridge.ts` | Sync from `/crm/companies` |

**Hardcoded:** ⚠️ `TERRITORIES` in `CustomerFormSections.tsx` (4 regions) — replace with territory lookup

---

### Vendor (`vendors`) — ✅ Phase 4 API-backed

| Module | File | Usage |
|--------|------|-------|
| Masters | `VendorPages.tsx` | Full CRUD; import/export in API mode |
| Purchase | `PoFormPages.tsx`, `GrnPages.tsx`, `PrFormPages.tsx`, `PurchaseFormPages.tsx`, `PurchaseDocumentPages.tsx` | 🔽 Vendor via `VendorLookupSelect` |
| Purchase lines | `PrLineItemsGrid.tsx` | 🔽 Suggested vendor per line |
| Purchase hub | `PurchaseMastersHubPage.tsx` | Count + link |
| Barcode | `BarcodePages.tsx` | 🔽 Vendor filter (store) |
| Job work | `JobWorkOrderDetailPage.tsx` | 🔽 Subcontractor (store) |
| Quick create | `quickCreateService.ts` | Inline create |
| Lookup hook | `useVendorLookup.ts` → `GET /lookups/vendors` | API mode search; demo filters `masterStore.vendors` |
| API bridge | `masterBatchApiBridge.ts` | CRUD sync to `masterStore.vendors` on save |

---

### Item (`items`) — ✅ Phase 4 API-backed

| Module | File | Usage |
|--------|------|-------|
| Masters | `ItemPages.tsx` | Full CRUD; import/export in API mode |
| Purchase | `PoFormPages`, `GrnPages`, `PrFormPages`, `PrLineItemsGrid`, `PurchaseDocumentPages` | 🔽 Line item via `ItemLookupSelect` |
| CRM | `OpportunityNew/Edit/360` | 🔽 Product lines (store today) |
| Manufacturing | `BomPages.tsx`, `BomModals.tsx` | 🔗 BOM components via `ItemLookupSelect` |
| Inventory | `InventoryTxnPages.tsx`, `ReservationsPage.tsx` | 🔽 Item via `ItemLookupSelect` |
| Barcode | `BarcodePages.tsx` | 🔽 Item lookup (store) |
| Hooks | `useMasterLists.ts` | `usePurchasableItems`, `useStockableItems`, `useFgItems` |
| Lookup hook | `useItemLookup.ts` → `GET /lookups/items` | API mode paginated search; demo filters `masterStore.items` |
| API bridge | `masterBatchApiBridge.ts` | CRUD sync to `masterStore.items` on save |

---

### Item Category (`categories`) — ✅ Phase 4 API-backed

| Module | File | Usage |
|--------|------|-------|
| Masters | `ItemCategoryPages.tsx` | Tree CRUD via generic master API |
| Item form | `ItemPages.tsx` | 🔽 categoryId |
| Warehouse | `WarehousePages.tsx` | Reference |
| Purchase QC | `purchaseMasterStore` qc-rules | 🔗 scope by category |
| Hooks | `useLeafCategories()` | Leaf-only dropdown |
| Lookup | `GET /lookups/item-categories` | Returns `id`, `code`, `name`, `parentId`, `level` |
| API bridge | `masterBatchApiBridge.ts` | Sync to `masterStore.categories` |

---

### UOM (`uoms`)

| Module | File | Usage |
|--------|------|-------|
| Masters | `UomPages.tsx` | Full CRUD |
| Item | `ItemPages.tsx` | 🔽 baseUomId, purchaseUomId |
| Product | `ProductPages.tsx` | 🔽 UOM |
| Purchase | `PoFormPages`, `GrnPages` | 🔽 Line UOM |
| CRM | Opportunity line forms | 🔽 uom (string today) |
| Hooks | `useMasterLists` | Active UOM lists |

---

### Warehouse (`warehouses`)

| Module | File | Usage |
|--------|------|-------|
| Masters | `WarehousePages.tsx` | Full CRUD |
| Item category | `ItemCategoryPages.tsx` | 🔽 defaultWarehouseId |
| Purchase | PO, GRN | 🔽 Receipt warehouse |
| Job work | `JobWorkOrderDetailPage.tsx` | 🔽 Issue warehouse |
| Hooks | `useActiveWarehouses()` | |

**Hardcoded:** ⚠️ `warehouseType` enum in types; `plantCode: PUNE` default in seed

---

### Location (`locations`)

| Module | File | Usage |
|--------|------|-------|
| Masters | `LocationPages.tsx` | Full CRUD |
| Purchase | PR, PO, GRN lines | 🔽 Location code |
| Barcode | `BarcodePages.tsx` | 🔽 Location |
| Sales | SO forms | 🔽 Ship-from location |
| Hooks | `useActiveLocations()` | |

---

### HSN / GST Group / GST Rate — ✅ Phase 4 API-backed

| Module | File | Usage |
|--------|------|-------|
| Masters | `HsnPages`, `GstGroupPages`, `GstRatePages` | Full CRUD via generic master API |
| Item | `ItemPages.tsx` | 🔽 hsnId, gstGroupId |
| Sales / Purchase | Tax calculation utils | 🔗 Rate lookup (store; transactional not wired) |
| Lookups | `GET /lookups/hsn-sac`, `/lookups/gst-groups`, `/lookups/gst-rates` | Dropdown hydration |
| Import/export | `HsnPages.tsx` only | CSV import/export in API mode (`hsn-sac`) |
| API bridge | `masterBatchApiBridge.ts` | Sync to `masterStore.hsnMasters`, `gstGroups`, `gstRates` |

**Hardcoded:** ⚠️ Sales forms use `[0, 5, 12, 18, 28]` instead of GST rate master

---

### Geography — Country / State / City

| Module | File | Usage |
|--------|------|-------|
| Masters | `GeographyPages.tsx` | Full CRUD |
| Customer / Vendor forms | Address sections | 🔽 Cascading geo |
| Quick create | `QuickCreateDrawerForm.tsx` | ⚠️ Uses `INDUSTRY_OPTIONS` from same seed file |

**Hardcoded:** ⚠️ `INDUSTRY_OPTIONS`, `VEHICLE_TYPE_OPTIONS` in `geographySeed.ts`

---

### Payment Method / Bank / Bank Account

| Module | File | Usage |
|--------|------|-------|
| Masters | Respective pages | Full CRUD |
| Vendor | `VendorPages.tsx` | 🔽 payment method |
| Treasury | Payment posting (future) | 🔗 bankAccountId |
| Hooks | `useActiveBanks()`, `useActiveBankAccounts()` | |

**Hardcoded:** ⚠️ `VENDOR_PAYMENT_METHODS` const array in `master.ts`

---

### Product (`products`)

| Module | File | Usage |
|--------|------|-------|
| Masters | `ProductPages.tsx` | FG variants |
| CRM | Opportunity forms | 🔽 productId |
| Sales | `salesStore.ts` | 🔗 Quotation lines |
| Quick create | `quickCreateService.ts` | |

---

### BOM / Routing / Work Centre

| Module | Store | Usage |
|--------|-------|-------|
| Masters | `bomStore`, `routingStore`, `workCenterStore` | Full CRUD |
| Item | `ItemPages.tsx` | 🔽 productionBomId, routingNo |
| Production | WO, planning modules | 🔗 Manufacturing |

**Hardcoded:** ⚠️ Department select in work centre form (Fabrication, Assembly, Finishing, Quality)

---

### Code Series

| Module | File | Usage |
|--------|------|-------|
| Masters | `CodeSeriesPages.tsx` | Configure all document numbering |
| All modules | Document create | Auto-number on save |

**Gap:** Backend only supports 5 CRM series; frontend has 60+

---

### Commercial Terms (`commercialTerms` in masterStore)

| Module | File | Usage |
|--------|------|-------|
| Quick create | `quickCreateService.ts` | Payment terms shortcut |
| Sales | Quotation templates | Terms text |

**Overlap:** CRM catalog has separate `payment-terms`, `delivery-terms`, `commercial-terms` — **consolidate**

---

## CRM catalog masters (`crmMasterStore`)

Hook entry point: `useCrmMasters.ts` — all option hooks

| Master kind | Primary consumers | Usage type |
|-------------|-------------------|------------|
| `lead-sources` | `CrmLeadFormPage`, lead reports | 🔽 ✏️ |
| `industries` | Should be company/lead forms | ⚠️ Partially hardcoded |
| `territories` | Owner form, should be customer | ⚠️ Customer uses hardcoded regions |
| `lead-stages` | `CrmLeadListPage`, pipeline | 🔍 🔽 |
| `lead-priorities` | Lead form, dashboard | 🔽 |
| `lead-reasons` | Lead close/disqualify | 🔽 |
| `opportunity-stages` | Pipeline board, opp forms | 🔽 — overlaps `CrmPipelineStage` backend |
| `opportunity-priorities` | `OpportunityNew/Edit`, drawers | 🔽 |
| `activity-types` | Activity timeline, follow-ups | 🔽 |
| `lost-reasons` | Opportunity lost dialog | 🔽 |
| `payment-terms` | Quotation, SO | 🔽 |
| `delivery-terms` | Quotation, PO | 🔽 |
| `warranty-terms` | Quotation | 🔽 |
| `commercial-terms` | Quotation clauses | 🔽 |
| `product-interests` | Lead/opportunity context | 🔽 |
| `approval-rules` | CRM approval flows | Config |
| `document-types` | CRM attachments | 🔽 |
| `owners` | Lead/opp owner assignment | 🔽 — should map to `User` API |

**Hardcoded conflicts:**

| Location | Issue |
|----------|-------|
| `CrmLeadFormPage.tsx` | `getActiveLeadUsers()` demo array |
| `CustomerFormSections.tsx` | 4-region territory tiles |
| `QuickCreateDrawerForm.tsx` | `INDUSTRY_OPTIONS` not CRM master |
| `leadUtils.ts` / `opportunityUtils.ts` | Enum fallbacks parallel to CRM master |

---

## Purchase catalog masters (`purchaseMasterStore`)

Hook: `usePurchaseMasters.ts`

| Master kind | Consumers | Usage |
|-------------|-----------|-------|
| `freight-terms` | PO form, vendor quotation | 🔽 |
| `buyers` | PR, RFQ assignment | 🔽 ✏️ |
| `qc-rules` | GRN incoming QC flag | 🔗 item/category scope |
| `grn-tolerance` | GRN over-receipt validation | Config |
| `return-reasons` | Purchase returns | 🔽 |

**Linked masters (from global):** vendors, items, categories, warehouses, locations, uom, payment-terms, delivery-terms — see `PURCHASE_LINKED_MASTERS`

---

## Quality masters (`qualityStore`)

| Master | Route | Consumers |
|--------|-------|-----------|
| QC Parameter | `/quality/parameters` | Inspection plans, GRN QC |
| Inspection Plan | `/quality/inspection-plans` | GRN workflow |

**Hardcoded:** `PARAM_TYPES`, `SEVERITIES`, `PASS_RULES`, `QC_STAGES` in `QcMasterPages.tsx`

**Item form:** ⚠️ `QUALITY_TEST_GROUP_OPTIONS` in `taxMaster.ts` — placeholder master page exists

---

## Administration masters

| Master | Consumers |
|--------|-----------|
| Users | CRM owner (should), auth, assignment |
| Roles | Permission gating across app |
| Permissions | `PermissionMatrixPage`, route guards |
| Approval workflows | PR, PO, BOM approval |

---

## Module × master dependency matrix

| Master | CRM | Sales | Purchase | Inventory | Production | Quality | Settings |
|--------|-----|-------|----------|-----------|------------|---------|----------|
| Customer | ✅ | ✅ | — | — | — | — | — |
| Contact | ✅ | — | — | — | — | — | — |
| Vendor | — | — | ✅ | — | ✅ | — | — |
| Item | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| UOM | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Category | — | — | ✅ | ✅ | — | ✅ | — |
| Warehouse | — | — | ✅ | ✅ | ✅ | — | — |
| Location | — | ✅ | ✅ | ✅ | — | — | — |
| HSN/GST | — | ✅ | ✅ | — | — | — | — |
| Lead source | ✅ | — | — | — | — | — | — |
| Industry | ✅ | — | — | — | — | — | — |
| Territory | ✅ | ✅ | — | — | — | — | — |
| Lead stage/priority | ✅ | — | — | — | — | — | — |
| Opp stage/priority | ✅ | ✅ | — | — | — | — | — |
| Payment terms | ✅ | ✅ | ✅ | — | — | — | — |
| Delivery terms | ✅ | ✅ | ✅ | — | — | — | — |
| Freight terms | — | — | ✅ | — | — | — | — |
| Buyers | — | — | ✅ | — | — | — | — |
| Work centre | — | — | — | — | ✅ | — | — |
| BOM/Routing | — | — | — | — | ✅ | — | — |

---

## Phase 4 permissions (seeded in `backend/src/constants/permissions.ts`)

| Master | view | create | update | delete | import | export |
|--------|------|--------|--------|--------|--------|--------|
| Item Category | ✅ | ✅ | ✅ | ✅ | — | — |
| HSN/SAC | ✅ | ✅ | ✅ | ✅ | ✅ | via view |
| GST Group | ✅ | ✅ | ✅ | ✅ | — | — |
| GST Rate | ✅ | ✅ | ✅ | ✅ | — | — |
| Item | ✅ | ✅ | ✅ | ✅ | ✅ | via view |
| Vendor | ✅ | ✅ | ✅ | ✅ | ✅ | via view |
| All lookups | `master.lookup.view` | — | — | — | — | — |

Roles with write access: Super Admin, Tenant Admin, Master Data Manager (partial), Purchase Manager (vendor), Inventory Manager (item/category).

---

## Hardcoded data replacement checklist

| # | Current source | Replace with lookup | Files to update |
|---|----------------|---------------------|-----------------|
| 1 | `TERRITORIES` 4-region | `lookups/territories` | `CustomerFormSections.tsx` |
| 2 | `INDUSTRY_OPTIONS` | `lookups/industries` | `QuickCreateDrawerForm.tsx`, lead/company forms |
| 3 | `getActiveLeadUsers()` | `lookups/users` | `CrmLeadFormPage.tsx` |
| 4 | `QUALITY_TEST_GROUP_OPTIONS` | `lookups/quality-test-groups` | `ItemPages.tsx` |
| 5 | GST `[0,5,12,18,28]` | `lookups/gst-rates` | Sales quotation/invoice forms |
| 6 | Work centre departments | `lookups/departments` | `WorkCenterPages.tsx` |
| 7 | `VENDOR_PAYMENT_METHODS` | `lookups/payment-methods` | Vendor form |
| 8 | `useCrmOwnerOptions` demo owners | `lookups/users` | All owner dropdowns |
| 9 | `masterStore.commercialTerms` | `lookups/payment-terms` | `quickCreateService.ts` |
| 10 | Lead/opp utils enums | CRM master lookups | `leadUtils.ts`, `opportunityUtils.ts` |
| 11 | QC page constants | Dedicated enums or masters | `QcMasterPages.tsx` |
| 12 | Contact designation/dept free-text | designation/department lookups | `CrmContactFormPage.tsx` |

---

## Lookup service integration plan

### New shared infrastructure

```text
lookupApi.ts       → fetch /lookups/:resource
lookupCache.ts     → Map<resource, { data, fetchedAt }>
useLookup(resource) → returns options, loading, refresh()
```

### Store bridge pattern (API mode)

```text
masterApiBridge.ts  → sync masterStore slices after CRUD
crmMasterApiBridge  → sync crmMasterStore OR deprecate store for lookups
```

### Refresh triggers
- After master save on list/form page
- After CSV import
- On tenant switch / login
- Manual `refreshLookups('uom')` from master pages

### Demo mode preservation
- `VITE_USE_API=false` → existing Zustand + seed (no change)
- `VITE_USE_API=true` → Phase 1 geography/UOM/warehouse/location + Phase 4 batch masters hydrate via `useMasterApiSync()` (`masterApiBridge` + `masterBatchApiBridge`); transactional lookups (`useItemLookup`, `useVendorLookup`) call API directly; empty arrays if API fails (no seed merge)

---

## Phase 4 import/export status

| Master | List UI | API import | API export | Template endpoint |
|--------|---------|------------|------------|-------------------|
| Item Category | Stub buttons | — | — | — |
| HSN/SAC | ✅ `MasterBatchImportDialog` | `POST /masters/imports/hsn-sac` | `GET /masters/exports/hsn-sac` | `GET /masters/imports/hsn-sac/template` |
| GST Group | Stub buttons | — | — | — |
| GST Rate | Stub buttons | — | — | — |
| Item | ✅ `MasterBatchImportDialog` | `POST /masters/imports/items` | `GET /masters/exports/items` | `GET /masters/imports/items/template` |
| Vendor | ✅ `MasterBatchImportDialog` | `POST /masters/imports/vendors` | `GET /masters/exports/vendors` | `GET /masters/imports/vendors/template` |

Import dialog is API-only (`MasterBatchImportDialog` shows alert in demo mode).

---

## Pages with stub import/export (not yet API-wired)

Core master list pages still using alert stub for import/export:
- UOM, GST Group, GST Rate, Item Category, Warehouse, Location
- Payment Method, Bank, Bank Account, Order Address, Geography
- Product, Work Centre, Routing, BOM (partial — BOM detail has export)

CRM/Purchase catalog pages with working import/export should call backend import endpoints instead of local CSV parse in API mode.

---

## Usage check requirements (delete protection)

| Master | Block delete if used in | Backend enforced |
|--------|-------------------------|------------------|
| Customer | Open leads, opps, SO, invoices | — |
| Vendor | Open PO, GRN, item-vendor map | Soft delete only (no transactional FK yet) |
| Item | BOM lines, open PO/GRN, stock balance | Soft delete only (no transactional FK yet) |
| UOM | Any item or open transaction line | ✅ items reference |
| Category | Child categories, items, QC rules | ✅ children + items |
| Warehouse | Locations, stock balances, category default | ✅ locations + categories |
| Location | Open documents with locationId | — |
| HSN | Items | ✅ items.hsnId |
| GST group | HSN codes, GST rates, items | ✅ all three |
| GST rate | — | No inbound FKs |
| Territory | Companies, users | — |
| Lead stage | Active leads in stage | — |
| Opp stage | Open opportunities in stage | — |
| Country/State/City | Vendors (optional FK) | ✅ vendor geography FKs |

Return `409` with descriptive message where enforced (usage array planned for transactional modules).
