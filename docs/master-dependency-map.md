# Master Dependency Map

**Project:** FOS ERP  
**Date:** 2026-07-11 (Phase 4 batch update)  
**Companion docs:** `MASTER_REGISTRY.md` (canonical routes), `master-module-audit.md`, `master-database-map.md`, `master-implementation-plan.md`

---

## Dependency tiers (implement in order)

### Tier 0 — Platform (exists)
- Tenant, User, Role, Permission, AuditLog, CodeSeries (partial)

### Tier 1 — Geography & organisation
```
Country → State → City
Warehouse → Location
Department (placeholder UI)
```

### Tier 2 — Tax & units ✅ **Partial (Phase 1 UOM + Phase 4 tax)**
```
UOM ✅ → Item uses UOM ✅
GST Group ✅ → HSN ✅ → GST Rate ✅
GST Group ✅ → Item (optional gstGroupId)
HSN ✅ → Item (optional hsnId)
```

### Tier 3 — Item foundation ✅ **Implemented (Phase 4)**
```
Item Category (tree) ✅ → Item ✅
Brand — no page, skip
```

### Tier 4 — Parties ✅ **Partial (vendor only)**
```
Customer/Company (CRM API exists) ✅
Contact (CRM API exists) ✅
Vendor ✅ → Vendor Order Address (frontend store only, no DB yet)
```

### Tier 5 — CRM reference masters
```
Industry, Territory, Lead Source
Lead Stage/Priority/Reason
Opportunity Stage/Priority, Lost Reason
Activity Type, Payment/Delivery/Warranty Terms
Product Interest, Document Type
Owners → User API (not separate table)
```

### Tier 6 — Manufacturing
```
Work Centre → Routing → BOM
Product (FG) → Item link
Serial Numbers
```

### Tier 7 — Purchase & quality refs
```
Freight Terms, Buyers, QC Rules, GRN Tolerance, Return Reasons
QC Parameter → Inspection Plan
```

### Tier 8 — Configuration
```
Bank → Bank Account
Payment Method
Code Series (expand backend)
Approval Workflows
```

---

## Cross-master FK matrix

| Consumer | Depends on |
|----------|------------|
| Item ✅ | category ✅, uom ✅, hsn ✅, gst group ✅, warehouse (via category), bom/routing (string refs) |
| Item Category ✅ | warehouse ✅ (optional default), parent category (self) |
| HSN ✅ | gst group ✅ |
| GST Rate ✅ | gst group ✅ |
| Vendor ✅ | country/state/city ✅ (optional FKs; text fields also stored) |
| Customer | territory, industry, payment terms |
| Contact | customer, designation, department |
| Lead | lead source, industry, stage, priority, owner (user) |
| Opportunity | customer, contact, stage, priority, lines→item/uom |
| PO/GRN | vendor ✅, item ✅, uom ✅, warehouse, location, payment/delivery terms |
| Work order | item, work centre, routing, bom |
| User (CRM owner) | user record, territory |

---

## CRM vs ERP master overlap

| Master | CRM catalog | ERP master store | Backend today |
|--------|-------------|------------------|---------------|
| Company/Customer | linked | masterStore.customers | CrmCompany ✅ |
| Contact | linked | crmStore.contacts | CrmContact ✅ |
| Vendor | — | masterStore.vendors | MasterVendor ✅ |
| Item | — | masterStore.items | MasterItem ✅ |
| Item Category | — | masterStore.categories | MasterItemCategory ✅ |
| HSN/GST | — | masterStore tax slices | MasterHsnCode/GstGroup/GstRate ✅ |
| Payment terms | crmMasterStore | masterStore.commercialTerms | ❌ unify |
| Territory | crmMasterStore | hardcoded in customer form | ❌ |
| Industry | crmMasterStore | geographySeed | ❌ |

---

## Blockers by tier

| Tier | Blocker |
|------|---------|
| 1 | Department page is placeholder only |
| 2 | None for tax chain — all Phase 4 tax masters live |
| 3 | Item transactional usage (PO/GRN/BOM) still frontend-store; delete not blocked by open docs |
| 4 | Vendor order addresses not in DB; vendor delete not blocked by PO |
| 5 | Opportunity stages overlap CrmPipelineStage — sync required |
| 8 | Code series backend only has 5 CRM types |

---

## Phase 4 delete dependency matrix ✅

| Master | Must delete / deactivate children first | Enforced | HTTP |
|--------|----------------------------------------|----------|------|
| `item-categories` | Child categories, then items | ✅ | 409 |
| `hsn-sac` | Items referencing hsnId | ✅ | 409 |
| `gst-groups` | HSN codes, GST rates, items | ✅ | 409 |
| `gst-rates` | — | — | 200 soft delete |
| `items` | — (future: BOM lines, PO lines, stock) | Partial | 200 soft delete |
| `vendors` | — (future: PO, GRN, order addresses) | Partial | 200 soft delete |

**Implementation:** `backend/src/modules/masters/master.repository.ts` → `assertNotReferenced()`

---

## Phase 4 prerequisite chain (create order)

```text
1. UOM (Phase 1) ─────────────────────────────┐
2. Warehouse (Phase 1, optional for category) │
3. GST Group                                    │
4. HSN/SAC (requires gstGroupId)                ├──► Item
5. GST Rate (requires gstGroupId)               │
6. Item Category (optional parentId, warehouse) │
7. Item (requires categoryId, baseUomId) ◄──────┘
8. Vendor (optional countryId/stateId/cityId FKs)
```

---

## Recommended first vertical slice (post-CRM)

1. ~~Country → State → City~~ ✅
2. ~~UOM~~ ✅
3. ~~Item Category → Item (minimal fields)~~ ✅
4. Wire purchase/CRM dropdowns to lookup APIs — **partial** (`ItemLookupSelect`, `VendorLookupSelect` on PR/PO/RFQ/inventory/BOM; CRM opportunity lines still store-based)

See `master-implementation-plan.md` for sprint breakdown.
