# Master Data Setup Report — Inventory / Tax Setup

**Date:** 2026-07-07  
**Scope:** Engineering & Inventory masters (Item, HSN, GST Group, GST Rate, UOM)  
**Status:** Ready for frontend demo and backend contract handoff

---

## 1. Masters Created

| Master | List | New | Detail | Edit |
|--------|------|-----|--------|------|
| Item Master | `/masters/items` | `/masters/items/new` | `/masters/items/:id` | `/masters/items/:id/edit` |
| HSN Master | `/masters/hsn` | `/masters/hsn/new` | `/masters/hsn/:id` | `/masters/hsn/:id/edit` |
| GST Group Code | `/masters/gst-groups` | `/masters/gst-groups/new` | `/masters/gst-groups/:id` | `/masters/gst-groups/:id/edit` |
| GST Rate | `/masters/gst-rates` | `/masters/gst-rates/new` | `/masters/gst-rates/:id` | `/masters/gst-rates/:id/edit` |
| Unit of Measure | `/masters/uom` | `/masters/uom/new` | `/masters/uom/:id` | `/masters/uom/:id/edit` |

### Navigation

All five masters appear under **Master Data → Inventory / Tax Setup** in:

- Sidebar (`src/config/navigation.ts`)
- Masters hub catalog (`src/config/mastersSetupCatalog.ts`)
- Masters home counts (`src/modules/masters/MastersHomePage.tsx`)

---

## 2. Fields Added

### Item Master (`src/modules/masters/item/ItemPages.tsx`)

| Section | Fields |
|---------|--------|
| **General** | Product Type, Code Series (Auto/Manual), Item Code, Item Name, Item Name 2, Category, Inventory Type, Blocked, Base UOM, Qty per UOM, Purchase UOM, Purchase Qty, Material Grade, Standard Rate, Description, Sub-assembly Rule |
| **Tax** | HSN (SmartSelect), GST Group Code (SmartSelect), legacy HSN text |
| **Inventory** | Inventory Qty, Qty on PO, Qty on Production Order, Qty on Sales Order, Reorder Level/Qty (read-only where specified) |
| **Quality** | QC Required (toggle), Quality Test Group Code |
| **Manufacturing** | Production BOM, Routing No, Drawing No |

**Product Type values:** BOI, Raw Material, Sub Assembly, Assembly Product, Finish Product, Scrap, Service  
**Inventory Type values:** Inventory, Non-Inventory, Service

### HSN Master (`src/modules/masters/hsn/HsnPages.tsx`)

Code, GST Group Code (SmartSelect), HSN Description, Status

**List columns:** Code, GST Group Code, HSN Description, Status, Actions

### GST Group Code Master (`src/modules/masters/gst-group/GstGroupPages.tsx`)

Code, GST Goods Type (Goods / Service), Description, Status

**List columns:** Code, GST Goods Type, Description, Status, Actions

### GST Rate Master (`src/modules/masters/gst-rate/GstRatePages.tsx`)

GST Group Code, From State, Location State Code, Date From, Date To, SGST, CGST, IGST, Status

**Validation:**
- Date From required
- Date To cannot be before Date From
- SGST + CGST = IGST for intra-state slabs
- Inter-state rows use IGST only (SGST/CGST = 0)
- GST Group Code required

**List columns:** GST Group Code, From State, Location State Code, Date From, Date To, SGST, CGST, IGST, Status, Actions

### Unit of Measure Master (`src/modules/masters/uom/UomPages.tsx`)

Code, Description, Decimal Precision, Base Unit (toggle), Status

---

## 3. Dropdown Relationships

```
GST Group Code Master
    ├── HSN Master (gstGroupId)
    ├── Item Master (gstGroupId)
    └── GST Rate Master (gstGroupId)

HSN Master
    └── Item Master (hsnId)

UOM Master
    └── Item Master (baseUomId, purchaseUomId)

Item Category Master
    └── Item Master (categoryId)

Quality Test Group (enum)
    └── Item Master (qualityTestGroupCode)

Production BOM / Routing Master
    └── Item Master (productionBomId, routingNo)

State / Location Master
    └── GST Rate Master (fromState, locationStateCode)
```

Shared select components: `src/components/masters/TaxMasterSelects.tsx`  
(`HsnMasterSelect`, `GstGroupSelect`, `UomMasterSelect`, `GeoStateSelect`)

---

## 4. Sample Data

### GST Groups (`src/data/masters/taxMasterSeed.ts`)

| Code | Type | Description |
|------|------|-------------|
| GST18-GOODS | Goods | 18% standard goods |
| GST12-GOODS | Goods | 12% steel / structural |
| GST5-GOODS | Goods | 5% concessional inputs |
| GST18-SERVICE | Service | 18% fabrication & services |

### HSN Codes

871639, 730890, 732690, 848180, 721070, 8708, 3208, 8311, 4016

### GST Rates

| Group | SGST | CGST | IGST | States |
|-------|------|------|------|--------|
| GST18-GOODS | 9 | 9 | 18 | MH → MH (intra) |
| GST12-GOODS | 6 | 6 | 12 | MH → MH |
| GST5-GOODS | 2.5 | 2.5 | 5 | MH → MH |
| GST18-GOODS | 0 | 0 | 18 | MH → GJ (inter) |
| GST18-SERVICE | 9 | 9 | 18 | MH → MH |

### UOM (`src/data/masters/seed.ts`)

NOS, KG, MTR, LTR, SET, PCS, TON, SQM, BOX, ROLL

### Item Master extensions

| Item | Product Type | HSN | GST Group |
|------|--------------|-----|-----------|
| 26 KL ISO Tank Container | Finish Product | 871639 | GST18-GOODS |
| 45 M3 Bulker Trailer | Finish Product | 871639 | GST18-GOODS |
| MS Plate 8mm | Raw Material | 721070 | GST12-GOODS |
| Axle Assembly | BOI | 8708 | GST18-GOODS |
| Landing Gear | BOI | 8708 | GST18-GOODS |
| Brake Assembly | Sub Assembly | 8708 | GST18-GOODS |
| Hydraulic Cylinder | BOI | 848180 | GST18-GOODS |
| Paint Primer | Raw Material | 3208 | GST18-GOODS |
| Welding Wire ER70S-6 | Raw Material | 8311 | GST12-GOODS |
| Rubber Seal / Gasket 3" | Raw Material | 4016 | GST18-GOODS |

---

## 5. Design System Mapping

| Spec component | Implementation |
|----------------|----------------|
| ObjectPage | `EnterpriseWorkspace` via `EnterpriseMasterWorkspace` |
| SmartForm | React Hook Form + `ErpCardSection` / `FormField` |
| SmartSelect | `ErpSmartSelect` + `TaxMasterSelects` |
| SmartTable | `DataTable` + `MasterListShell` |
| CommandBar | `ErpCardCommandBar` / `CommandBar` |
| StickyFooter | `ErpStickySaveBar` via `MasterStickyFooter` |
| InsightSidebar | `EnterpriseBusinessFactBox` + `EnterpriseFormContextPanel` |

Shared shell: `src/modules/masters/shared/EnterpriseMasterShell.tsx`

Every list page supports: search, filters, saved views, column chooser, import/export placeholders, pagination, row actions, status filter, bulk actions.

---

## 6. Data Layer

| File | Purpose |
|------|---------|
| `src/types/taxMaster.ts` | HSN, GST Group, GST Rate types & enums |
| `src/types/master.ts` | Extended `Item` and `Uom` fields |
| `src/data/masters/taxMasterSeed.ts` | Seed GST/HSN/rates + item extensions |
| `src/store/masterStore.ts` | CRUD for all tax masters |
| `src/utils/persistMigration.ts` | Persists new slices to localStorage |
| `src/utils/itemMasterDefaults.ts` | Default enrichment & code suggestion |
| `src/utils/globalSearchIndex.ts` | HSN, GST Group, GST Rate search indexing |

---

## 7. Tests

| Script | Result |
|--------|--------|
| `npm run build` | Pass |
| `npm run test:masters` | **26/26 pass** |
| `npm run test:design-system` | 34/35 pass (pre-existing CSS import check) |
| `npm run test:entity-360` | Pass (global search locations fix) |

Test file: `scripts/test-masters.ts`

Verified:
- All routes and navigation entries
- Seed data counts
- SmartSelect usage on Item/HSN/GST forms
- GST Rate validation message
- Save / Save & Close / Save & New / sticky footer
- Import / Export command bar actions

---

## 8. Remaining Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| Import/Export wizards | Medium | UI buttons present; backend CSV/API needed |
| Documents & Audit sections | Low | Placeholder sections on detail views; wire to DMS when backend ready |
| Auto item code series | Medium | `codeSeriesMode: auto` UI exists; needs server-side number series |
| GST calculation engine | High | Rates stored; purchase/sales tax posting logic not yet wired |
| Related Records deep links | Low | Fact box shows summary; full cross-module drill-down pending |
| Design system CSS import | Low | Pre-existing `test:design-system` failure unrelated to masters |

---

## 9. Readiness

Inventory and GST-related master setup is **frontend-ready** for:

- Item Master maintenance
- Purchase / Sales line item HSN & GST group selection
- Inventory posting type configuration
- Production BOM & routing linkage on items
- QC requirement flags
- State-wise GST rate lookup (demo data)

**Next backend phase:** REST endpoints mirroring `masterStore` CRUD, number series for item codes, and GST rate resolution service for transactional documents.
