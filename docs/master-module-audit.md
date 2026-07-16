# Master Module Audit

**Project:** FOS ERP (Vasant Trailers)  
**Date:** 2026-07-11 (Phase 4 batch update) · **Canonical routes:** see [`MASTER_REGISTRY.md`](MASTER_REGISTRY.md) (2026-07-13 consolidation)  
**Source of truth:** Existing React frontend under `trailer-erp/src/modules/masters/` and related catalogs  
**Backend state:** CRM + core geography/warehouse/UOM masters + Phase 4 batch (item category, HSN, GST, item, vendor) API-backed when `VITE_USE_API=true`

---

## Phase 4 batch (2026-07-11)

| Master | Designed page | Backend API | Frontend API read/write | Notes |
|--------|---------------|-------------|-------------------------|-------|
| Item Category | ✅ | ✅ `item-categories` | ✅ | Hierarchical; FK to warehouse |
| Item Group | ❌ No page | — | — | **Skipped** — not in UI |
| UOM Conversion | ❌ No page | — | — | **Skipped** — not in UI |
| HSN/SAC | ✅ (HSN only) | ✅ `hsn-sac` | ✅ | No SAC type field in UI |
| GST Group | ✅ | ✅ `gst-groups` | ✅ | |
| GST Rate | ✅ | ✅ `gst-rates` | ✅ | Effective-date validation |
| Item | ✅ | ✅ `/masters/items` | ✅ | Lookup: `GET /lookups/items` |
| Vendor Group | ❌ No page | — | — | **Skipped** — not in UI |
| Vendor | ✅ | ✅ `/masters/vendors` | ✅ | Geography as text fields (matches UI) |

**Core six masters (Phase 1):** Countries, states, cities, UOM, warehouses, locations — full CRUD + activate/deactivate + soft delete with confirmation modals.

---

## Summary

| Category | Designed pages | Fully implemented UI | Placeholder UI | Backend API |
|----------|---------------|---------------------|----------------|-------------|
| Core `/masters/*` | 24 entities + hub | 21 | 3 | 13 (Phase 1 + Phase 4 batch + CRM company) |
| CRM catalog `/crm/masters/*` | 13 + 3 linked | 13 | 0 | 0 |
| CRM on `/masters/*` | 6 | 6 | 0 | 0 |
| Purchase catalog `/purchase/masters/*` | 5 + 11 linked | 5 | 0 | 0 |
| Quality | 2 | 2 | 0 | 0 |
| Admin/governance | 4 | 4 | 0 | Partial (users/roles list) |
| **Total distinct masters** | **~56** | **~51** | **3** | **13** |

---

## Cross-cutting findings

### Stores
| Store | File | Persistence |
|-------|------|-------------|
| `useMasterStore` | `src/store/masterStore.ts` | localStorage (`ERP_STORAGE_KEYS.masters`) |
| `useCrmMasterStore` | `src/store/crmMasterStore.ts` | localStorage |
| `usePurchaseMasterStore` | `src/store/purchaseMasterStore.ts` | localStorage |
| `useCodeSeriesStore` | `src/store/codeSeriesStore.ts` | localStorage |
| `useBomStore` | `src/store/bomStore.ts` | localStorage |
| `useRoutingStore` | `src/store/routingStore.ts` | localStorage |
| `useWorkCenterStore` | `src/store/workCenterStore.ts` | localStorage |
| `useQualityStore` | `src/store/qualityStore.ts` | localStorage |
| `useSerialStore` | `src/store/serialStore.ts` | localStorage |

### Import / export reality
| Pattern | Where | Status |
|---------|-------|--------|
| Alert stub | `MasterListCommandBar`, `EnterpriseMasterShell` | UI buttons only (most masters) |
| API CSV import/export | `ItemPages`, `VendorPages`, `HsnPages` + `MasterBatchImportDialog` | ✅ API mode only |
| Full CSV import/export | `CrmMasterPages.tsx` (catalog items with `importExport: true`) | Working (local store) |
| Full CSV import/export | `PurchaseMasterPages.tsx` (where flagged) | Working (local store) |
| Company/contact import | `/crm/customers`, `/crm/contacts` | Working |
| BOM export | BOM detail page | Working |
| Core master lists | UOM, category, GST group/rate, warehouse, location, etc. | **Stub only** |

### API mode today (`VITE_USE_API=true`)
- CRM **transactional** data syncs: companies → `customers`, contacts, leads, opportunities, activities
- **Phase 1 masters** sync via `masterApiBridge`: countries, states, cities, UOM, warehouses, locations
- **Phase 4 batch** sync via `masterBatchApiBridge`: item-categories, hsn-sac, gst-groups, gst-rates, items, vendors
- **Transactional lookups:** `useItemLookup` / `useVendorLookup` call `/lookups/items` and `/lookups/vendors` directly
- Demo seed must not mix with API data (enforced for CRM + master slices on hydrate)

---

## Per-master audit

Legend: **UI** = page exists | **BE** = backend table+API | **IE** = import/export

### Administration

#### 1. Company / Customer Master
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/companies/*`, `/masters/customers/*` (alias) |
| Components | `modules/masters/customer/CustomerPages.tsx`, `entity360/Customer360Page.tsx` |
| Store | `masterStore.customers` (+ CRM `createActivity` on save) |
| Fields | `customerCode`, `customerName`, `customerType`, billing/shipping address, `city`, `state`, `pincode`, `country`, `gstin`, `pan`, `contactPerson`, `contactPhone`, `contactEmail`, `creditDays`, `creditLimit`, `salesTerritory`, `isActive` |
| Relations | → contacts (CRM), leads, opportunities, SO, invoices |
| Hardcoded | `CUSTOMER_TYPES`, `TERRITORIES` (West/North/South/East) — **conflicts with CRM territory master** |
| Validation | Zod: GSTIN 15-char, PAN, pincode 6-digit, credit limits |
| IE | List: stub; `/crm/customers`: real CSV |
| Delete | No UI delete; CRM API supports DELETE |
| BE | `CrmCompany` + `/crm/companies` ✅ — create/update with `contactPerson` upserts primary CRM contact |
| FE bridge | `crmApiBridge.apiCreateCompany` / `apiUpdateCompany` hydrates linked contacts after save |

#### 2. CRM User / Employee Master
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/users/*` |
| Components | `modules/admin/UserMasterPages.tsx` → `CrmMasterPages` (`fixedSlug=users`, kind `owners`) |
| Store | `crmMasterStore` (`owners`) |
| Fields | `code`, `name`, `employeeCode`, `role`, `department`, `email`, `mobile`, `territory`, `permissionGroup`, `status` |
| Hardcoded | Demo owners in `crmMastersSeed.ts`; `CRM_LEAD_USERS` fallback |
| IE | Full CSV |
| BE | `User` table exists; **no employee master API**; owners are demo catalog entries |

#### 3. Role Master
| Routes | `/masters/roles`, `/settings/roles` |
| Component | `modules/settings/RoleMasterPage.tsx` |
| BE | `Role` + `GET /roles` (list only) |

#### 4. Role Permission Matrix
| Routes | Canonical `/masters/role-permissions`; legacy aliases `/masters/permissions`, `/settings/permissions` (Navigate) |
| Component | `modules/settings/PermissionMatrixPage.tsx` |
| Hardcoded | `config/permissionMatrix.ts` |
| BE | `Permission` seeded; no CRUD API |

#### 5. Code / Number Series Master
| Routes | `/masters/code-series/*` |
| Component | `modules/masters/code-series/CodeSeriesPages.tsx` |
| Store | `codeSeriesStore` (60+ series in seed) |
| Fields | `seriesCode`, `seriesName`, `module`, `entityType`, format segments, reset rules, override flags |
| BE | `CodeSeries` — **5 CRM entities only**, no REST API |

#### 6. Approval Workflow / Matrix
| Routes | `/masters/approval-workflows` |
| Component | `modules/approval/ApprovalMatrixConfigPage.tsx` |
| Seed | `data/approval/seedApprovalMatrix.ts` |
| BE | None |

---

### Customer & Vendor

#### 7. Vendor Master — ✅ Phase 4
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/vendors/*` |
| Component | `modules/masters/vendor/VendorPages.tsx` |
| Store | `masterStore.vendors` |
| Fields | `vendorCode`, `vendorName`, `searchName`, `isBlocked`, address, `contactPhone`, `email`, `pincode`, `state`, `city`, `country`, `paymentMethod`, `bankDetails`, `pan`, `panStatus`, `gstin`, `gstVendorType`, `isActive` |
| Relations | → order addresses (store), item-vendor maps, PO, GRN |
| IE | ✅ API CSV in API mode; stub in demo |
| Delete | Soft delete; no PO/GRN FK check yet |
| BE | `MasterVendor` + `/masters/vendors` ✅; lookup `GET /lookups/vendors` ✅ |
| Permissions | `master.vendor.view/create/update/delete/import` |

#### 8. Contact Master
| Routes | `/masters/contacts/*`, `/crm/contacts/*` |
| Components | `CrmContactsPage`, `CrmContactFormPage`, `Contact360Page` |
| Store | `crmStore.contacts` |
| Fields | `contactCode`, `customerId`, `name`, `designation`, `department`, `email`, `phone`, `isPrimary`, `isActive` |
| Hardcoded | Designation/department free-text (no master) |
| IE | `/crm/contacts` real CSV |
| BE | `CrmContact` + API ✅ |

#### 9. Order Address (Vendor)
| Routes | `/masters/order-addresses/*` |
| Component | `modules/masters/order-address/OrderAddressPages.tsx` |
| Store | `masterStore.vendorOrderAddresses` |
| Fields | `vendorId`, `code`, `name`, address, `state`, `city`, `postCode`, `country`, `gstin`, `phone`, `email`, `isActive` |
| BE | None |

---

### Inventory

#### 10. UOM Master
| Routes | `/masters/uom/*` |
| Component | `modules/masters/uom/UomPages.tsx` |
| Store | `masterStore.uoms` |
| Fields | `uomCode`, `uomName`, `description`, `uomType`, `decimalPlaces`, `isBaseUnit`, `isActive` |
| Hardcoded | `uomType` enum: integer, weight, length, volume |
| Used in | Item, PO lines, GRN, opportunity lines, BOM |
| BE | None |

#### 11. Item Category Master — ✅ Phase 4
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/item-categories/*` |
| Component | `modules/masters/item-category/ItemCategoryPages.tsx` |
| Fields | `categoryCode`, `categoryName`, `parentId`, `level`, `defaultWarehouseId`, `isActive` |
| Relations | Self-referential parent; → items, purchase QC rules |
| IE | Stub UI |
| Delete | 409 if child categories or items exist |
| BE | `MasterItemCategory` + `/masters/item-categories` ✅; lookup ✅ |
| Permissions | `master.item_category.view/create/update/delete` |

#### 12. Item Master — ✅ Phase 4
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/items/*` |
| Component | `modules/masters/item/ItemPages.tsx` |
| Fields | `productType`, `itemCode`, `itemName`, `categoryId`, `inventoryType`, `itemType`, `baseUomId`, `purchaseUomId`, `hsnId`, `gstGroupId`, `reorderLevel`, `standardRate`, `isPurchasable`, `isStockable`, `qcRequired`, `qualityTestGroupCode`, `productionBomId`, `routingNo`, etc. |
| Hardcoded | `QUALITY_TEST_GROUP_OPTIONS`; engineering product type labels |
| Used in | PO, GRN, PR, RFQ, inventory, BOM, routing, WO, CRM opportunity lines |
| IE | ✅ API CSV in API mode |
| Delete | Soft delete; transactional usage check deferred |
| BE | `MasterItem` + `/masters/items` ✅; lookup `GET /lookups/items` ✅ |
| Permissions | `master.item.view/create/update/delete/import` |

#### 13. Warehouse Master
| Routes | `/masters/warehouses/*` |
| Fields | `warehouseCode`, `warehouseName`, `warehouseType`, `plantCode`, `address`, `isActive` |
| Hardcoded | `warehouseType`: main, sub, wip, fg, quarantine; default `plantCode: PUNE` |
| BE | None |

#### 14. Location Master
| Routes | `/masters/locations/*` |
| Fields | `locationCode`, `locationName`, `warehouseId`, address block, GST fields, document flags (`allowSales`, `allowPurchase`, etc.) |
| Used in | Sales SO, PO, GRN, production documents |
| BE | None (CRM `locationId` on leads/opps is UUID field without FK) |

---

### Tax — ✅ Phase 4

#### 15. HSN Master (`hsn-sac`)
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/hsn/*` |
| Fields | `code`, `gstGroupId`, `description`, `isActive` |
| IE | ✅ API CSV in API mode |
| Delete | 409 if items reference hsnId |
| BE | `MasterHsnCode` + `/masters/hsn-sac` ✅ |
| Permissions | `master.hsn.view/create/update/delete/import` |

#### 16. GST Group Code
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/gst-groups/*` |
| Fields | `code`, `goodsType`, `description`, `isActive` |
| IE | Stub UI |
| Delete | 409 if HSN codes, GST rates, or items reference group |
| BE | `MasterGstGroup` + `/masters/gst-groups` ✅ |
| Permissions | `master.gst_group.view/create/update/delete` |

#### 17. GST Rate Master
| Attribute | Value |
|-----------|-------|
| Routes | `/masters/gst-rates/*` |
| Fields | `code`, `gstGroupId`, `fromState`, `locationStateCode`, `dateFrom`, `dateTo`, sgst/cgst/igst, `isActive` |
| Validation | dateTo ≥ dateFrom; inter-state must have igst > 0 and sgst/cgst = 0 |
| IE | Stub UI |
| Delete | No inbound FKs |
| BE | `MasterGstRate` + `/masters/gst-rates` ✅ |
| Permissions | `master.gst_rate.view/create/update/delete` |

Sales forms also hardcode `[0,5,12,18,28]` — must use GST rate master.

---

### Manufacturing

#### 18. Product Master — FG variants; lifecycle in `productMasterStore`
#### 19. BOM Master — header + lines; approval workflow; export on detail
#### 20. Routing Master — header + operations
#### 21. Work Center Master — fields include hardcoded department select (Fabrication, Assembly, Finishing, Quality)
#### 22. Serial Numbers — inline register in `SerialPages.tsx`

#### 23–25. Placeholders (no CRUD)
- **Department** `/masters/departments`
- **Price List** `/masters/price-lists`
- **Quality Test Group** `/masters/quality-test-groups` (options hardcoded in item form)

---

### Organization / Geography

#### 26. Country Master — `countryCode`, `countryName`, `isActive`
#### 27. State Master — `stateCode`, `stateName`, `isActive`
#### 28. City Master — `stateId`, `cityName`, `isActive`

Also: `INDUSTRY_OPTIONS` and `VEHICLE_TYPE_OPTIONS` in `geographySeed.ts` (not separate pages).

---

### Configuration

#### 29. Payment Method — `code`, `description`, `balAccountType`, `balAccountNo`, `directDebit`, `isActive`
#### 30. Bank Master — `code`, `name`, `isActive`
#### 31. Bank Account — `code`, `bankId`, address, `currencyCode`, `bankAccountNo`, `ifscCode`, etc.
#### 32. Document Register — `/documents` (DMS module)
#### 33. Barcode Master — `/barcode/master`

---

### CRM catalog masters (`crmMastersCatalog.ts`)

All use `CrmMasterPages.tsx` + `crmMasterStore`. Standard fields: `code`, `name`, `status` (+ kind-specific attrs in `attributes` JSON).

| # | Kind | Route (primary) | Import/Export | Used in |
|---|------|-----------------|---------------|---------|
| 34 | lead-sources | `/crm/masters/lead-sources` | Yes | Lead form, reports |
| 35 | industries | `/masters/industries`, `/crm/masters/industries` | Yes | Company, lead (should) |
| 36 | territories | `/masters/territories` | Yes | Owners, company (should) |
| 37 | lead-stages | `/crm/masters/lead-stages` | Yes | Lead pipeline |
| 38 | lead-priorities | `/crm/masters/lead-priorities` | Yes | Lead form |
| 39 | lead-reasons | `/crm/masters/lead-reasons` | Yes | Lead close/disqualify |
| 40 | opportunity-stages | `/crm/masters/opportunity-stages` | Yes | Opportunity pipeline |
| 41 | opportunity-priorities | `/crm/masters/opportunity-priorities` | Yes | Opportunity forms |
| 42 | activity-types | `/crm/masters/activity-types` | Yes | Activity/follow-up |
| 43 | lost-reasons | `/crm/masters/lost-reasons` | Yes | Opportunity lost |
| 44 | commercial-terms | `/crm/masters/commercial-terms` | Yes | Quotation docs |
| 45 | payment-terms | `/masters/payment-terms` | Yes | Quotation, SO, PO |
| 46 | delivery-terms | `/crm/masters/delivery-terms` | Yes | Quotation, PO |
| 47 | warranty-terms | `/crm/masters/warranty-terms` | Yes | Quotation |
| 48 | approval-rules | `/crm/masters/approval-rules` | Yes | CRM approvals |
| 49 | document-types | `/crm/masters/document-types` | Yes | CRM attachments |
| 50 | product-interests | `/masters/product-interests` | Yes | Lead/opportunity product context |
| 51 | owners (users) | `/masters/users` | Yes | Lead/opportunity owner |

**Linked (no catalog CRUD):** quotation-templates → `/crm/quotation-templates`; companies → `/crm/customers`

---

### Purchase catalog masters

| # | Kind | Route | Import/Export |
|---|------|-------|---------------|
| 52 | freight-terms | `/purchase/masters/freight-terms` | Yes |
| 53 | buyers | `/purchase/masters/buyers` | No |
| 54 | qc-rules | `/purchase/masters/qc-rules` | No |
| 55 | grn-tolerance | `/purchase/masters/grn-tolerance` | No |
| 56 | return-reasons | `/purchase/masters/return-reasons` | Yes |

**Linked registers** point to global masters (vendors, items, warehouses, etc.) — see `purchaseMastersCatalog.ts` `PURCHASE_LINKED_MASTERS`.

---

### Quality masters (outside `/masters` hub)

| Master | Route | Store |
|--------|-------|-------|
| QC Parameter | `/quality/parameters/*` | `qualityStore.qcParameters` |
| Inspection Plan | `/quality/inspection-plans/*` | `qualityStore.inspectionPlans` |

Hardcoded: `PARAM_TYPES`, `SEVERITIES`, `PASS_RULES`, `QC_STAGES` in `QcMasterPages.tsx`.

---

## Hardcoded data requiring replacement (priority)

| Master | Hardcoded location | Target |
|--------|-------------------|--------|
| Territory | `CustomerFormSections.tsx` 4-region enum | CRM `territories` lookup |
| Industry | `geographySeed.INDUSTRY_OPTIONS`, lead free-text | CRM `industries` lookup |
| Department | Work center, PR, contact forms | New department master (placeholder exists) |
| Designation | Contact forms free-text | New designation master or CRM attrs |
| Payment terms | `masterStore.commercialTerms` vs CRM `payment-terms` | Unified payment terms master |
| GST rates | Sales `[0,5,12,18,28]` | `gstRates` master |
| Lead stages/priorities | `leadUtils` enums + CRM master overlap | Single source: backend lookup |
| Opportunity stages | `opportunityUtils` + backend pipeline | Align CRM master + `CrmPipelineStage` |
| Owners/buyers | Demo seed users | `User` API + employee master |
| QC test groups | `QUALITY_TEST_GROUP_OPTIONS` | Quality test group master (placeholder) |

---

## Delete restrictions (design intent)

| Master | Restriction | Backend today |
|--------|-------------|---------------|
| Customer/Vendor/Item | Block delete if referenced in open transactions; allow deactivate | Vendor/Item: soft delete only |
| UOM, Category, HSN, GST group | Block if used by items (or children for category) | ✅ enforced |
| GST rate | No inbound FKs | Delete allowed |
| Warehouse/Location | Block if stock balance or open documents | ✅ warehouse partial |
| CRM catalog entry | Block if referenced by active leads/opps; allow deactivate | — |
| Geography | Block delete of country/state/city if referenced | ✅ vendor FKs |
| Code series | Block delete if numbers issued; allow deactivate | — |

---

## Next step

See `docs/master-implementation-plan.md` for phased backend + frontend integration order. **Phase 4 batch complete; proceed to CRM reference masters (Phase 5) or wire transactional FK usage checks.**
