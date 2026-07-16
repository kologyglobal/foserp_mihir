# Vasant Trailer ERP — Master Data Structure

**Document Version:** 2.0 — Foundation  
**Status:** Pre-development (no UI)  
**Principle:** Master data is created once, governed centrally, and referenced by all transactional modules.

---

## 1. Master Data Build Sequence

> **Mandatory development order. Each step depends on all prior steps.**

```
Step 1  →  UOM Master
Step 2  →  Item Category Master
Step 3  →  Item Master                    ← Axle, MS Plate, Primer, etc.
Step 4  →  Customer Master
Step 5  →  Vendor Master
Step 6  →  Warehouse Master
Step 7  →  Product Master                 ← 45 M3 Bulker, ISO Tank, Side Wall
Step 8  →  BOM Master                       ← ONLY after Steps 3 and 7 are complete
```

### 1.1 Dependency Gate — BOM Creation

BOM creation is **blocked** until:

| Prerequisite | Validation |
|--------------|------------|
| Product exists | `products.code` found in Product Master |
| All BOM items exist | Every `bom_lines.item_id` resolves to active Item Master |
| UOM valid | BOM line UOM matches item base UOM or approved conversion |
| Category assigned | Every item has valid Item Category |
| Warehouse defined | Default issue warehouse exists for item category |

```
❌ WRONG: Create BOM → add item codes manually → create items later
✅ RIGHT:  Create all Item Master records → Create Product Master → Create BOM referencing existing items
```

---

## 2. Master Data Hierarchy

```
Organization (Vasant Trailers)
└── Plant: Pune
    ├── Warehouse Master
    │   ├── WH-RM-MAIN      (Raw Material Store)
    │   ├── WH-BO-MAIN      (Bought Out Store)
    │   ├── WH-CONS         (Consumable Store)
    │   ├── WH-WIP-BAY1     (WIP Bay-1)
    │   └── WH-FG-YARD      (Finished Goods Yard)
    │
    ├── UOM Master
    ├── Item Category Master
    │   └── Item Master (materials & bought-out parts)
    ├── Vendor Master
    ├── Customer Master
    ├── Product Master (finished goods)
    │   └── BOM Master (per product revision)
    │       └── BOM Lines → Item Master (FK)
    └── Product Routing (standard operations — Phase 4)
```

---

## 3. UOM Master (`uom_master`)

**Build Step:** 1  
**Owner:** System Admin  
**Table:** `uom_master`

### 3.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| uom_code | VARCHAR(10) | UK, NOT NULL | Business key |
| uom_name | VARCHAR(50) | NOT NULL | Display name |
| uom_type | ENUM | NOT NULL | integer / weight / length / volume |
| decimal_places | SMALLINT | NOT NULL | 0–3 |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | | |

### 3.2 Seed Data

| Code | Name | Type | Decimals | Used By |
|------|------|------|----------|---------|
| NOS | Numbers | integer | 0 | Axle, King Pin, Tyre, Air Tank |
| KG | Kilogram | weight | 3 | MS Plate |
| SET | Set | integer | 0 | Axle Set, Suspension Set |
| LTR | Litre | volume | 2 | Primer |
| MTR | Metre | length | 3 | Pipe, Angle |
| MT | Metric Ton | weight | 3 | Bulk plate orders (PO) |

### 3.3 Rules

- UOM code immutable after creation
- Cannot delete UOM referenced by Item Master
- All inventory transactions stored in item base UOM

---

## 4. Item Category Master (`item_categories`)

**Build Step:** 2  
**Owner:** Master Data Admin  
**Table:** `item_categories`

### 4.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| category_code | VARCHAR(20) | UK | |
| category_name | VARCHAR(100) | NOT NULL | |
| parent_id | UUID | FK → self | NULL for root |
| level | SMALLINT | | 1=root, 2=sub, 3=leaf |
| default_warehouse_id | UUID | FK → warehouses | Set in Step 6 |
| is_active | BOOLEAN | DEFAULT true | |

### 4.2 Category Tree

| Code | Name | Parent | Default Warehouse |
|------|------|--------|-------------------|
| CAT-RM | Raw Material | — | WH-RM-MAIN |
| CAT-RM-STRUCT | Structural Steel | CAT-RM | WH-RM-MAIN |
| CAT-RM-PLATE | Plate | CAT-RM | WH-RM-MAIN |
| CAT-RM-CONS | Consumable | CAT-RM | WH-CONS |
| CAT-BO | Bought Out | — | WH-BO-MAIN |
| CAT-BO-RUN | Running Gear | CAT-BO | WH-BO-MAIN |
| CAT-BO-WHEEL | Wheel & Tyre | CAT-BO | WH-BO-MAIN |
| CAT-BO-PNEU | Pneumatic | CAT-BO | WH-BO-MAIN |
| CAT-SA | Sub Assembly | — | WH-WIP-BAY1 |
| CAT-FG | Finished Good | — | WH-FG-YARD |

### 4.3 Rules

- Item Master must reference a leaf-level category
- Category drives default warehouse on GRN
- Category hierarchy max 3 levels

---

## 5. Item Master (`items`)

**Build Step:** 3  
**Owner:** Stores + Engineering  
**Table:** `items`  
**Prerequisite:** UOM Master, Item Category Master

> **This is the foundation for BOM. No BOM work until this table is populated.**

### 5.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| item_code | VARCHAR(30) | UK, NOT NULL | Immutable business key |
| item_name | VARCHAR(200) | NOT NULL | |
| item_description | TEXT | | Detailed spec |
| category_id | UUID | FK → item_categories | NOT NULL |
| base_uom_id | UUID | FK → uom_master | NOT NULL |
| item_type | ENUM | NOT NULL | raw / bought_out / consumable / sub_assembly |
| material_grade | VARCHAR(50) | | IS 2062 E350, BPW OEM, etc. |
| hsn_code | VARCHAR(10) | | GST HSN |
| reorder_level | DECIMAL(12,3) | DEFAULT 0 | |
| reorder_qty | DECIMAL(12,3) | | Standard reorder batch |
| standard_rate | DECIMAL(12,2) | | Last/standard purchase rate (INR) |
| is_purchasable | BOOLEAN | DEFAULT true | |
| is_stockable | BOOLEAN | DEFAULT true | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | | |
| updated_at | TIMESTAMPTZ | | |

### 5.2 Item Code Convention

```
{TYPE}-{DESCRIPTION}-{SPEC}

TYPE prefix:
  RM-   Raw Material
  BO-   Bought Out
  SA-   Sub Assembly
  CON-  Consumable
```

### 5.3 Complete Seed Data — Trailer Manufacturing Items

#### Bought Out — Running Gear

| Item Code | Item Name | Category | UOM | Grade/Spec | Reorder | Std Rate (INR) |
|-----------|-----------|----------|-----|------------|---------|----------------|
| BO-AXL-3A-130 | Axle 3-Axle 130mm BBC | CAT-BO-RUN | SET | BPW HFB 130 | 2 SET | 4,85,000 |
| BO-SUSP-AIR | Air Suspension Set | CAT-BO-RUN | SET | BPW Air Ride | 2 SET | 1,25,000 |
| BO-KPIN-2-JOST | King Pin 2" JOST | CAT-BO-RUN | NOS | 42CrMo4 | 5 NOS | 18,500 |
| BO-LJ-24T | Landing Jack 24T | CAT-BO-RUN | NOS | JOST Modul L | 4 NOS | 12,800 |

#### Bought Out — Wheel & Tyre

| Item Code | Item Name | Category | UOM | Grade/Spec | Reorder | Std Rate (INR) |
|-----------|-----------|----------|-----|------------|---------|----------------|
| BO-RIM-925 | Wheel Rim 9.00×22.5 | CAT-BO-WHEEL | NOS | 22.5×9.00 JJ | 24 NOS | 8,200 |
| BO-TYRE-925 | Tyre 295/80R22.5 | CAT-BO-WHEEL | NOS | Apollo EnduTrax | 24 NOS | 22,500 |

#### Bought Out — Pneumatic

| Item Code | Item Name | Category | UOM | Grade/Spec | Reorder | Std Rate (INR) |
|-----------|-----------|----------|-----|------------|---------|----------------|
| BO-AIRTANK-40L | Air Tank 40 Litre | CAT-BO-PNEU | NOS | 10 Bar rated | 6 NOS | 6,500 |

#### Raw Material — Plate

| Item Code | Item Name | Category | UOM | Grade/Spec | Reorder | Std Rate (INR) |
|-----------|-----------|----------|-----|------------|---------|----------------|
| RM-MS-PLT-16 | MS Plate 16mm | CAT-RM-PLATE | KG | IS 2062 E350 | 5000 KG | 68.50/KG |

#### Raw Material — Structural Steel

| Item Code | Item Name | Category | UOM | Grade/Spec | Reorder | Std Rate (INR) |
|-----------|-----------|----------|-----|------------|---------|----------------|
| RM-PIPE-150-CHS | Pipe 150mm CHS | CAT-RM-STRUCT | MTR | IS 4923 YST 310 | 200 MTR | 1,850/MTR |
| RM-ANGLE-75X75 | Angle 75×75×8 | CAT-RM-STRUCT | MTR | IS 2062 E250 | 300 MTR | 620/MTR |

#### Raw Material — Consumable

| Item Code | Item Name | Category | UOM | Grade/Spec | Reorder | Std Rate (INR) |
|-----------|-----------|----------|-----|------------|---------|----------------|
| RM-PRIMER-EP | Primer Epoxy | CAT-RM-CONS | LTR | Asian Paints EP-10 | 200 LTR | 285/LTR |

### 5.4 Item Master Validation Rules

| Rule | Description |
|------|-------------|
| IM-001 | `item_code` unique, uppercase, no spaces |
| IM-002 | `base_uom_id` must exist in UOM Master |
| IM-003 | `category_id` must be leaf-level category |
| IM-004 | Bought-out items: `is_purchasable = true` |
| IM-005 | Consumables: `reorder_level` mandatory |
| IM-006 | Cannot deactivate item referenced in released BOM |
| IM-007 | Cannot deactivate item with open PO lines |
| IM-008 | `material_grade` mandatory for raw materials |

---

## 6. Customer Master (`customers`)

**Build Step:** 4  
**Owner:** Sales  
**Table:** `customers`

### 6.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| customer_code | VARCHAR(20) | UK | |
| customer_name | VARCHAR(200) | NOT NULL | |
| customer_type | ENUM | | corporate / dealer / government |
| address_line1 | VARCHAR(200) | | |
| city | VARCHAR(50) | NOT NULL | |
| state | VARCHAR(50) | | |
| pincode | VARCHAR(10) | | |
| gstin | VARCHAR(15) | UK | |
| contact_person | VARCHAR(100) | | |
| contact_phone | VARCHAR(20) | | |
| contact_email | VARCHAR(100) | | |
| credit_days | INTEGER | DEFAULT 30 | |
| sales_territory | VARCHAR(50) | | West / North / South / East |
| is_active | BOOLEAN | DEFAULT true | |

### 6.2 Seed Data

| Code | Name | City | GSTIN | Territory | Credit Days |
|------|------|------|-------|-----------|-------------|
| CUST-UTCL-001 | UltraTech Cement Ltd. | Mumbai | 27AAACU1234F1Z5 | West | 30 |
| CUST-AMBUJA-001 | Ambuja Cements | Ahmedabad | 24AAACA5678G1Z2 | West | 30 |
| CUST-IOC-001 | Indian Oil Corporation | Delhi | 07AAACI9012H1Z8 | North | 45 |
| CUST-DALMIA-001 | Dalmia Bharat Ltd. | Chennai | 33AAACD3456J1Z1 | South | 30 |
| CUST-JSW-001 | JSW Logistics | Pune | 27AAACJ7890K1Z4 | West | 15 |
| CUST-ACC-001 | ACC Limited | Kolkata | 19AAACA2345L1Z6 | East | 30 |

---

## 7. Vendor Master (`vendors`)

**Build Step:** 5  
**Owner:** Procurement  
**Table:** `vendors`

### 7.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| vendor_code | VARCHAR(20) | UK | |
| vendor_name | VARCHAR(200) | NOT NULL | |
| vendor_type | ENUM | | manufacturer / trader / service |
| city | VARCHAR(50) | | |
| state | VARCHAR(50) | | |
| gstin | VARCHAR(15) | UK | |
| contact_person | VARCHAR(100) | | |
| contact_phone | VARCHAR(20) | | |
| payment_terms_days | INTEGER | DEFAULT 30 | |
| default_lead_time_days | INTEGER | DEFAULT 7 | |
| supplied_categories | TEXT[] | | Array of category codes |
| rating | SMALLINT | | 1–5 |
| is_active | BOOLEAN | DEFAULT true | |

### 7.2 Seed Data

| Code | Name | City | Lead Days | Supplies | Payment |
|------|------|------|-----------|----------|---------|
| VEND-BPW-001 | BPW India Pvt Ltd | Pune | 21 | Axle, Suspension | 45 days |
| VEND-JOST-001 | JOST India | Chennai | 14 | King Pin, Landing Jack | 30 days |
| VEND-APOLLO-001 | Apollo Tyres Ltd | Chennai | 7 | Tyre, Wheel Rim | 30 days |
| VEND-SAIL-001 | SAIL Bokaro | Bokaro | 10 | MS Plate, Angle, Pipe | 30 days |
| VEND-ASIAN-001 | Asian Paints Industrial | Mumbai | 5 | Primer | 15 days |
| VEND-LUNAR-001 | Lunar Pneumatics | Pune | 7 | Air Tank | 30 days |

### 7.3 Item–Vendor Mapping (`item_vendor_map`)

| Item Code | Preferred Vendor | Lead Days | Last Rate |
|-----------|-----------------|-----------|-----------|
| BO-AXL-3A-130 | VEND-BPW-001 | 21 | 4,85,000 |
| BO-SUSP-AIR | VEND-BPW-001 | 21 | 1,25,000 |
| BO-KPIN-2-JOST | VEND-JOST-001 | 14 | 18,500 |
| BO-LJ-24T | VEND-JOST-001 | 14 | 12,800 |
| BO-RIM-925 | VEND-APOLLO-001 | 7 | 8,200 |
| BO-TYRE-925 | VEND-APOLLO-001 | 7 | 22,500 |
| BO-AIRTANK-40L | VEND-LUNAR-001 | 7 | 6,500 |
| RM-MS-PLT-16 | VEND-SAIL-001 | 10 | 68.50/KG |
| RM-PIPE-150-CHS | VEND-SAIL-001 | 10 | 1,850/MTR |
| RM-ANGLE-75X75 | VEND-SAIL-001 | 10 | 620/MTR |
| RM-PRIMER-EP | VEND-ASIAN-001 | 5 | 285/LTR |

---

## 8. Warehouse Master (`warehouses`)

**Build Step:** 6  
**Owner:** Stores  
**Table:** `warehouses`

### 8.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| warehouse_code | VARCHAR(20) | UK | |
| warehouse_name | VARCHAR(100) | NOT NULL | |
| warehouse_type | ENUM | NOT NULL | main / sub / wip / fg / quarantine |
| plant_code | VARCHAR(10) | | PUNE |
| address | VARCHAR(200) | | |
| is_active | BOOLEAN | DEFAULT true | |

### 8.2 Seed Data

| Code | Name | Type | Purpose |
|------|------|------|---------|
| WH-RM-MAIN | Raw Material Store | main | MS Plate, Pipe, Angle |
| WH-BO-MAIN | Bought Out Store | main | Axle, Suspension, Tyres, Air Tank |
| WH-CONS | Consumable Store | sub | Primer, welding rods |
| WH-WIP-BAY1 | WIP Bay-1 | wip | Bulker tank fabrication WIP |
| WH-WIP-BAY4 | WIP Bay-4 | wip | Side wall fabrication WIP |
| WH-FG-YARD | Finished Goods Yard | fg | Completed trailers |
| WH-QC-HOLD | QC Hold Area | quarantine | Failed / pending QC items |

### 8.3 Warehouse Bins (optional Phase 2)

| Warehouse | Bin Code | Description |
|-----------|----------|-------------|
| WH-RM-MAIN | RM-BAY-3 | Plate storage bay 3 |
| WH-BO-MAIN | BO-A-04 | Axle rack A-04 |
| WH-BO-MAIN | BO-C-07 | Pneumatic shelf C-07 |

---

## 9. Product Master (`products`)

**Build Step:** 7  
**Owner:** Engineering + Sales  
**Table:** `products`  
**Prerequisite:** UOM Master (NOS for FG), Item Category (CAT-FG)

> Product Master defines sellable finished goods. It does NOT contain BOM lines.

### 9.1 Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| product_code | VARCHAR(30) | UK | FG- prefix |
| product_name | VARCHAR(200) | NOT NULL | |
| product_type | ENUM | NOT NULL | bulker / iso_tank / side_wall |
| capacity | VARCHAR(30) | | 45 m³, 24,000 L, 32 MT |
| axle_config | VARCHAR(50) | | |
| tare_weight_kg | DECIMAL(8,2) | | |
| gvw_kg | DECIMAL(8,2) | | Gross vehicle weight |
| standard_price | DECIMAL(12,2) | NOT NULL | INR ex-works |
| standard_lead_days | INTEGER | NOT NULL | |
| base_uom_id | UUID | FK → uom_master | NOS |
| hsn_code | VARCHAR(10) | | 8716 |
| is_active | BOOLEAN | DEFAULT true | |

### 9.2 Seed Data

| Code | Name | Type | Capacity | Axle Config | Std Price (INR) | Lead Days |
|------|------|------|----------|-------------|-----------------|-----------|
| FG-45M3-BULKER | 45 M3 Bulker Trailer | bulker | 45 m³ | 3-Axle Air Suspension | 28,50,000 | 45 |
| FG-ISO-TANK-24K | ISO Tank 24KL | iso_tank | 24,000 L | 2-Axle BPW | 42,00,000 | 60 |
| FG-SIDEWALL-32T | Side Wall Trailer 32T | side_wall | 32 MT payload | 3-Axle Semi | 19,50,000 | 35 |

### 9.3 Product Specifications (extended attributes)

**FG-45M3-BULKER:**
- Tank material: MS IS 2062 E350, 16mm shell
- Discharge: 4" pneumatic butterfly valve
- Compartments: Single
- Landing gear: 2× 24T JOST

**FG-ISO-TANK-24K:**
- Shell material: SS 316L (separate items in Item Master — Phase 2)
- Design code: ADR / UN portable tank
- Insulation: Optional

**FG-SIDEWALL-32T:**
- Floor: 5mm chequered plate
- Side panels: 2.5mm MS sheet
- Payload: 32 MT

---

## 10. BOM Master (`bom_headers` + `bom_lines`)

**Build Step:** 8 — **LAST master data step**  
**Owner:** Engineering  
**Prerequisite:** Item Master (Step 3) + Product Master (Step 7)

### 10.1 BOM Header Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| product_id | UUID | FK → products | NOT NULL |
| bom_revision | VARCHAR(10) | NOT NULL | Rev-A, Rev-B |
| bom_description | VARCHAR(200) | | |
| status | ENUM | NOT NULL | draft/under-review/approved/released/obsolete |
| effective_from | DATE | | |
| approved_by | UUID | FK → users | |
| created_at | TIMESTAMPTZ | | |

**UNIQUE:** (product_id, bom_revision)

### 10.2 BOM Line Schema

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | UUID | PK | |
| bom_header_id | UUID | FK → bom_headers | |
| line_no | INTEGER | NOT NULL | 10, 20, 30... |
| item_id | UUID | FK → items | NOT NULL — must exist in Item Master |
| quantity | DECIMAL(12,3) | NOT NULL | Per 1 unit of product |
| uom_id | UUID | FK → uom_master | Must match item base UOM |
| scrap_pct | DECIMAL(5,2) | DEFAULT 0 | Plate cutting waste |
| issue_warehouse_id | UUID | FK → warehouses | Override default |
| remarks | VARCHAR(200) | | |

### 10.3 BOM — FG-45M3-BULKER Rev-A

| Line | Item Code | Item Name | Qty | UOM | Scrap% |
|------|-----------|-----------|-----|-----|--------|
| 10 | RM-MS-PLT-16 | MS Plate 16mm | 4200 | KG | 5% |
| 20 | RM-PIPE-150-CHS | Pipe 150mm CHS | 48 | MTR | 3% |
| 30 | RM-ANGLE-75X75 | Angle 75×75×8 | 120 | MTR | 3% |
| 40 | BO-AXL-3A-130 | Axle 3-Axle 130mm BBC | 1 | SET | 0% |
| 50 | BO-SUSP-AIR | Air Suspension Set | 1 | SET | 0% |
| 60 | BO-KPIN-2-JOST | King Pin 2" JOST | 1 | NOS | 0% |
| 70 | BO-LJ-24T | Landing Jack 24T | 2 | NOS | 0% |
| 80 | BO-RIM-925 | Wheel Rim 9.00×22.5 | 12 | NOS | 0% |
| 90 | BO-TYRE-925 | Tyre 295/80R22.5 | 12 | NOS | 0% |
| 100 | BO-AIRTANK-40L | Air Tank 40 Litre | 2 | NOS | 0% |
| 110 | RM-PRIMER-EP | Primer Epoxy | 40 | LTR | 10% |

### 10.4 BOM — FG-ISO-TANK-24K Rev-A

| Line | Item Code | Item Name | Qty | UOM |
|------|-----------|-----------|-----|-----|
| 10 | RM-MS-PLT-16 | MS Plate 16mm (shell) | 6800 | KG |
| 20 | BO-AXL-3A-130 | Axle 2-Axle set (modified) | 1 | SET |
| 30 | BO-SUSP-AIR | Air Suspension Set | 1 | SET |
| 40 | BO-KPIN-2-JOST | King Pin 2" JOST | 1 | NOS |
| 50 | BO-LJ-24T | Landing Jack 24T | 2 | NOS |
| 60 | BO-RIM-925 | Wheel Rim 9.00×22.5 | 8 | NOS |
| 70 | BO-TYRE-925 | Tyre 295/80R22.5 | 8 | NOS |
| 80 | BO-AIRTANK-40L | Air Tank 40 Litre | 2 | NOS |
| 90 | RM-PRIMER-EP | Primer Epoxy | 60 | LTR |

### 10.5 BOM — FG-SIDEWALL-32T Rev-A

| Line | Item Code | Item Name | Qty | UOM |
|------|-----------|-----------|-----|-----|
| 10 | RM-MS-PLT-16 | MS Plate 16mm (floor) | 2800 | KG |
| 20 | RM-ANGLE-75X75 | Angle 75×75×8 (side posts) | 80 | MTR |
| 30 | BO-AXL-3A-130 | Axle 3-Axle 130mm BBC | 1 | SET |
| 40 | BO-SUSP-AIR | Air Suspension Set | 1 | SET |
| 50 | BO-KPIN-2-JOST | King Pin 2" JOST | 1 | NOS |
| 60 | BO-LJ-24T | Landing Jack 24T | 2 | NOS |
| 70 | BO-RIM-925 | Wheel Rim 9.00×22.5 | 12 | NOS |
| 80 | BO-TYRE-925 | Tyre 295/80R22.5 | 12 | NOS |
| 90 | BO-AIRTANK-40L | Air Tank 40 Litre | 2 | NOS |
| 100 | RM-PRIMER-EP | Primer Epoxy | 35 | LTR |

### 10.6 BOM Governance Rules

| Rule | Description |
|------|-------------|
| BOM-001 | Cannot add BOM line for non-existent item |
| BOM-002 | Cannot release BOM without engineering approval |
| BOM-003 | Only one `released` BOM revision per product at a time |
| BOM-004 | Obsoleting a BOM revision requires ECO reference |
| BOM-005 | MRP uses only `released` BOM |
| BOM-006 | Production Order snapshots BOM revision at release |
| BOM-007 | Scrap % applied in MRP gross requirement calculation |

---

## 11. Master vs Transactional Data

| Master (this document) | Transactional (separate modules) |
|------------------------|----------------------------------|
| UOM | Stock movements |
| Item Category | GRN, Material Issue |
| Item | Purchase Order lines |
| Customer | Inquiry, Quotation, Sales Order |
| Vendor | Purchase Order |
| Warehouse | Stock balances |
| Product | Production Order |
| BOM | Job Card, MRP run |

---

## 12. Data Load Script Order

```sql
-- Step 1
INSERT INTO uom_master ...

-- Step 2
INSERT INTO item_categories ...

-- Step 3 (all 11 items before any BOM work)
INSERT INTO items ...

-- Step 4
INSERT INTO customers ...

-- Step 5
INSERT INTO vendors ...
INSERT INTO item_vendor_map ...

-- Step 6
INSERT INTO warehouses ...

-- Step 7
INSERT INTO products ...

-- Step 8 (only after steps 3 and 7)
INSERT INTO bom_headers ...
INSERT INTO bom_lines ...  -- FK to items.id, products.id
```

---

## 13. Master Data Quality Checklist

Before proceeding to transactional module development:

- [ ] All 6 UOMs created
- [ ] Item category tree complete (10 categories)
- [ ] All 11 item master records active with correct UOM and category
- [ ] 6 customers loaded with valid GSTIN
- [ ] 6 vendors loaded with item-vendor mapping
- [ ] 7 warehouses defined
- [ ] 3 products in Product Master
- [ ] 3 BOM headers created (one per product, Rev-A)
- [ ] All BOM lines reference existing item_id (zero orphan lines)
- [ ] All BOM lines validated: item exists, UOM matches, qty > 0
- [ ] BOM status set to `released` for MRP testing
