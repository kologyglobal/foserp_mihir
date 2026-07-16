# Vasant Trailer ERP — Functional Blueprint

**Industry:** Bulker / Trailer / ISO Tank Manufacturing  
**Plant:** Pune Facility (Phase 1)  
**Document Version:** 2.0 — Foundation  
**Status:** Pre-development architecture (no UI)  

---

## 1. Executive Summary

Vasant Trailer ERP is a make-to-order (MTO) manufacturing system for bulk trailer and tank production. It manages the complete commercial and operational lifecycle from customer inquiry through dispatch, with strict master-data governance and module sequencing.

**Core product families:**
- 45 M3 Bulker Trailer
- ISO Tank
- Side Wall Trailer

**Manufacturing model:** Engineer-to-order with standard BOM templates, MRP-driven procurement, shop floor job cards, in-process and final QC, and dispatch against sales orders.

---

## 2. End-to-End Business Flow

```
┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌─────┐   ┌─────┐   ┌──────────┐
│ Inquiry  │──►│ Quotation  │──►│ Sales Order │──►│ BOM │──►│ MRP │──►│ Purchase │
└──────────┘   └────────────┘   └─────────────┘   └─────┘   └─────┘   └──────────┘
                                                                              │
    ┌─────────────────────────────────────────────────────────────────────────┘
    ▼
┌─────┐   ┌───────────┐   ┌────────────────┐   ┌─────────────────┐   ┌──────────┐
│ GRN │──►│ Inventory │──►│ Material Issue │──►│ Production Order│──►│ Job Card │
└─────┘   └───────────┘   └────────────────┘   └─────────────────┘   └──────────┘
                                                                              │
    ┌─────────────────────────────────────────────────────────────────────────┘
    ▼
┌──────────┐   ┌────┐   ┌──────────┐
│ Job Work │──►│ QC │──►│ Dispatch │
└──────────┘   └────┘   └──────────┘
```

### 2.1 Stage Definitions

| # | Stage | Module | Input | Output | Owner |
|---|-------|--------|-------|--------|-------|
| 1 | **Inquiry** | CRM / Sales | Customer requirement | Inquiry record | Sales |
| 2 | **Quotation** | Sales | Inquiry + Product Master | Priced quotation | Sales |
| 3 | **Sales Order** | Sales | Accepted quotation | Confirmed SO | Sales |
| 4 | **BOM** | Engineering | Product + Item Master | Released BOM | Engineering |
| 5 | **MRP** | Planning | SO + BOM + Stock | Planned orders | Planner |
| 6 | **Purchase** | Procurement | MRP planned orders | Purchase Order | Procurement |
| 7 | **GRN** | Inventory | PO + physical receipt | Stock increase | Stores |
| 8 | **Inventory** | Inventory | GRN, issues, adjustments | Available stock | Stores |
| 9 | **Material Issue** | Inventory | Production Order + BOM | Stock decrease, WIP feed | Stores |
| 10 | **Production Order** | Production | Sales Order | Released PO/WO | Production |
| 11 | **Job Card** | Production | Production Order + Routing | Stage-wise work instruction | Production |
| 12 | **Job Work** | Production | Job Card | Stage completion, labour/machine time | Shop Floor |
| 13 | **QC** | Quality | Job Work (final / in-process) | Pass / Fail / NCR | QC |
| 14 | **Dispatch** | Logistics | Passed QC + SO balance | Delivery Challan | Dispatch |

---

## 3. Master Data Foundation (Build Order)

> **Critical Rule:** Development and data entry MUST follow this sequence. BOM cannot be created until Item Master exists. Product Master cannot reference BOM until both Product and Item Master are complete.

```
Phase 0 — Foundation Masters (build first, in order)
  1. UOM Master
  2. Item Category Master
  3. Item Master          ← all materials (Axle, MS Plate, Primer, etc.)
  4. Customer Master
  5. Vendor Master
  6. Warehouse Master
  7. Product Master       ← finished goods (45 M3 Bulker, ISO Tank, etc.)
  8. BOM                  ← references Item Master + Product Master ONLY after both exist

Phase 1 — Transactional Modules (after masters)
  Inquiry → Quotation → Sales Order → MRP → Purchase → GRN →
  Inventory → Material Issue → Production Order → Job Card →
  Job Work → QC → Dispatch
```

---

## 4. Module Catalog

### 4.1 Master Data Modules

| Module | Code | Purpose |
|--------|------|---------|
| UOM Master | `MD-UOM` | Units of measure (NOS, KG, SET, LTR, MTR) |
| Item Category Master | `MD-CAT` | Hierarchical classification of items |
| Item Master | `MD-ITEM` | All raw materials, bought-out parts, consumables |
| Customer Master | `MD-CUST` | Buyers of trailers/tanks |
| Vendor Master | `MD-VEND` | Suppliers of materials and bought-out parts |
| Warehouse Master | `MD-WH` | Storage locations, bins, plant stores |
| Product Master | `MD-PROD` | Finished goods catalog (sellable trailers) |
| BOM Master | `MD-BOM` | Product structure linking items to products |

### 4.2 Transactional Modules

| Module | Code | Purpose |
|--------|------|---------|
| Inquiry | `TX-INQ` | Customer requirement capture |
| Quotation | `TX-QUO` | Commercial offer with pricing |
| Sales Order | `TX-SO` | Confirmed customer order |
| MRP | `TX-MRP` | Material requirements planning |
| Purchase Order | `TX-PO` | Vendor procurement |
| GRN | `TX-GRN` | Goods receipt against PO |
| Inventory | `TX-INV` | Stock balances and movements |
| Material Issue | `TX-MI` | Issue materials to production order |
| Production Order | `TX-PROD` | Manufacturing work order |
| Job Card | `TX-JC` | Operation-level shop floor document |
| Job Work | `TX-JW` | Actual labour/machine execution |
| Quality Control | `TX-QC` | Inspection and NCR |
| Dispatch | `TX-DSP` | Shipment and delivery challan |

---

## 5. Module Functional Specifications

### 5.1 UOM Master (`MD-UOM`)

**Purpose:** Define all units used across Item Master, BOM, PO, and inventory transactions.

| Code | Name | Type | Decimal Places |
|------|------|------|----------------|
| NOS | Numbers | Integer | 0 |
| KG | Kilogram | Weight | 3 |
| SET | Set | Integer | 0 |
| LTR | Litre | Volume | 2 |
| MTR | Metre | Length | 3 |
| MT | Metric Ton | Weight | 3 |

**Rules:**
- Every Item Master record must have exactly one base UOM
- BOM quantities stored in item base UOM
- UOM cannot be deleted if referenced by any item

---

### 5.2 Item Category Master (`MD-CAT`)

**Purpose:** Classify items for reporting, MRP grouping, and store layout.

```
Item Categories
├── Raw Material
│   ├── Structural Steel    (Angle, Pipe, CHS)
│   ├── Plate               (MS Plate)
│   └── Consumable          (Primer, Paint)
├── Bought Out
│   ├── Running Gear        (Axle, Suspension, King Pin, Landing Jack)
│   ├── Wheel & Tyre        (Wheel Rim, Tyre)
│   └── Pneumatic           (Air Tank)
└── Sub Assembly
    └── Fabricated          (Tank shell, chassis sub-asm)
```

**Rules:**
- Category is mandatory on Item Master
- Category drives default warehouse assignment (e.g., bought-out → Store-2)

---

### 5.3 Item Master (`MD-ITEM`)

**Purpose:** Single source of truth for all materials and bought-out parts. **Must exist before BOM.**

| Field | Required | Example |
|-------|----------|---------|
| item_code | ✅ | `RM-MS-PLT-16` |
| item_name | ✅ | MS Plate 16mm |
| category_id | ✅ | Raw Material → Plate |
| base_uom | ✅ | KG |
| item_type | ✅ | Raw / Bought Out / Consumable |
| reorder_level | | 5000 |
| standard_rate | | 68.50 per KG |
| hsn_code | | 7208 |
| is_purchasable | ✅ | true |
| is_stockable | ✅ | true |

**Seed Items (realistic trailer manufacturing):**

| Item Code | Item Name | Category | UOM | Type |
|-----------|-----------|----------|-----|------|
| BO-AXL-3A-130 | Axle 3-Axle 130mm BBC | Bought Out → Running Gear | SET | Bought Out |
| BO-SUSP-AIR | Air Suspension Set | Bought Out → Running Gear | SET | Bought Out |
| BO-KPIN-2-JOST | King Pin 2" JOST | Bought Out → Running Gear | NOS | Bought Out |
| BO-LJ-24T | Landing Jack 24T | Bought Out → Running Gear | NOS | Bought Out |
| BO-RIM-925 | Wheel Rim 9.00×22.5 | Bought Out → Wheel & Tyre | NOS | Bought Out |
| BO-TYRE-925 | Tyre 295/80R22.5 | Bought Out → Wheel & Tyre | NOS | Bought Out |
| BO-AIRTANK-40L | Air Tank 40 Litre | Bought Out → Pneumatic | NOS | Bought Out |
| RM-PRIMER-EP | Primer Epoxy | Raw Material → Consumable | LTR | Consumable |
| RM-MS-PLT-16 | MS Plate 16mm | Raw Material → Plate | KG | Raw |
| RM-PIPE-150-CHS | Pipe 150mm CHS | Raw Material → Structural Steel | MTR | Raw |
| RM-ANGLE-75X75 | Angle 75×75×8 | Raw Material → Structural Steel | MTR | Raw |

**Rules:**
- Item code is immutable once created
- Item must be active before use in BOM or PO
- Duplicate item names allowed; item_code must be unique
- **No BOM line can reference a non-existent item**

---

### 5.4 Customer Master (`MD-CUST`)

| Field | Example |
|-------|---------|
| customer_code | CUST-UTCL-001 |
| customer_name | UltraTech Cement Ltd. |
| city | Mumbai |
| gstin | 27AAACU1234F1Z5 |
| credit_days | 30 |
| sales_territory | West |

---

### 5.5 Vendor Master (`MD-VEND`)

| Field | Example |
|-------|---------|
| vendor_code | VEND-BPW-001 |
| vendor_name | BPW India Pvt Ltd |
| city | Pune |
| gstin | 27AABCB1234F1Z9 |
| payment_terms | 45 days |
| lead_time_days | 21 |
| supplied_categories | Running Gear, Wheel & Tyre |

**Seed Vendors:**

| Code | Name | Supplies |
|------|------|----------|
| VEND-BPW-001 | BPW India Pvt Ltd | Axle, Suspension, King Pin |
| VEND-JOST-001 | JOST India | Landing Jack, King Pin |
| VEND-APOLLO-001 | Apollo Tyres Ltd | Tyre, Wheel Rim |
| VEND-SAIL-001 | SAIL Bokaro | MS Plate, Angle, Pipe |
| VEND-ASIAN-001 | Asian Paints Industrial | Primer |
| VEND-LUNAR-001 | Lunar Pneumatics | Air Tank |

---

### 5.6 Warehouse Master (`MD-WH`)

| Code | Name | Type | Purpose |
|------|------|------|---------|
| WH-RM-MAIN | Raw Material Store | Main Store | Plates, angles, pipes |
| WH-BO-MAIN | Bought Out Store | Main Store | Axle, suspension, tyres |
| WH-CONS | Consumable Store | Sub-store | Primer, paint, welding consumables |
| WH-WIP-BAY1 | WIP Bay-1 | WIP | Bulker tank fabrication |
| WH-WIP-BAY4 | WIP Bay-4 | WIP | Side wall fabrication |
| WH-FG-YARD | Finished Goods Yard | FG | Completed trailers awaiting dispatch |

**Rules:**
- GRN must specify target warehouse
- Material issue deducts from designated warehouse
- WIP warehouses track issued-but-not-consumed material

---

### 5.7 Product Master (`MD-PROD`)

**Purpose:** Finished goods catalog. Created AFTER Item Master. Does NOT contain BOM — BOM is separate.

| Code | Name | Type | Capacity | Axle Config | Std Lead Days |
|------|------|------|----------|-------------|---------------|
| FG-45M3-BULKER | 45 M3 Bulker Trailer | Bulker | 45 m³ | 3-Axle Air Suspension | 45 |
| FG-ISO-TANK-24K | ISO Tank 24KL | ISO Tank | 24,000 L | 2-Axle BPW | 60 |
| FG-SIDEWALL-32T | Side Wall Trailer 32T | Side Wall | 32 MT payload | 3-Axle Semi | 35 |

**Rules:**
- Product Master defines WHAT is sold/manufactured
- Product links to BOM via separate BOM Master (not embedded)
- Quotation and Sales Order reference Product Master only

---

### 5.8 BOM Master (`MD-BOM`)

**Purpose:** Defines material structure of a product. **Created ONLY after Item Master and Product Master are complete.**

**Prerequisite check before BOM creation:**
```
✓ Product exists in Product Master
✓ All BOM line items exist in Item Master
✓ All UOMs on BOM lines match item base UOM (or valid conversion exists)
✓ BOM revision number assigned
```

**Example BOM — 45 M3 Bulker Trailer (Rev-A):**

| Line | Item Code | Item Name | Qty | UOM |
|------|-----------|-----------|-----|-----|
| 10 | RM-MS-PLT-16 | MS Plate 16mm | 4200 | KG |
| 20 | RM-PIPE-150-CHS | Pipe 150mm CHS | 48 | MTR |
| 30 | RM-ANGLE-75X75 | Angle 75×75×8 | 120 | MTR |
| 40 | BO-AXL-3A-130 | Axle 3-Axle 130mm BBC | 1 | SET |
| 50 | BO-SUSP-AIR | Air Suspension Set | 1 | SET |
| 60 | BO-KPIN-2-JOST | King Pin 2" JOST | 1 | NOS |
| 70 | BO-LJ-24T | Landing Jack 24T | 2 | NOS |
| 80 | BO-RIM-925 | Wheel Rim 9.00×22.5 | 12 | NOS |
| 90 | BO-TYRE-925 | Tyre 295/80R22.5 | 12 | NOS |
| 100 | BO-AIRTANK-40L | Air Tank 40 Litre | 2 | NOS |
| 110 | RM-PRIMER-EP | Primer Epoxy | 40 | LTR |

**BOM Status Flow:** `draft` → `under-review` → `approved` → `released` → `obsolete`

**Rules:**
- Only `released` BOM can drive MRP and Production Order
- Production Order snapshots BOM revision at release time
- ECO (Engineering Change Order) required to modify released BOM

---

## 6. Transactional Module Specifications

### 6.1 Inquiry (`TX-INQ`)

**Trigger:** Customer contact (phone, email, visit, RFQ)

| Field | Example |
|-------|---------|
| inquiry_no | INQ-2026-0089 |
| customer | UltraTech Cement Ltd. |
| product_interest | 45 M3 Bulker Trailer |
| quantity | 4 |
| required_delivery | Aug 2026 |
| status | open / quoted / converted / lost |

**Output:** Qualified inquiry ready for quotation

---

### 6.2 Quotation (`TX-QUO`)

**Input:** Inquiry + Product Master pricing

| Field | Example |
|-------|---------|
| quotation_no | QUO-2026-0156 |
| inquiry_no | INQ-2026-0089 |
| product | FG-45M3-BULKER |
| quantity | 4 |
| unit_price | 28,50,000 |
| validity_days | 30 |
| status | draft / sent / accepted / rejected / expired |

**Business Rules:**
- Unit price defaults from Product Master standard price list
- Margin approval required if discount > 5%
- Accepted quotation auto-creates Sales Order

---

### 6.3 Sales Order (`TX-SO`)

**Input:** Accepted quotation

| Field | Example |
|-------|---------|
| so_no | SO-2026-0142 |
| customer | CUST-UTCL-001 |
| product | FG-45M3-BULKER |
| quantity | 4 |
| delivery_date | 2026-08-15 |
| status | See status flow below |

**Status Flow:**
```
draft → confirmed → bom-validated → mrp-run → material-ready →
in-production → qc-hold ⇄ in-production → qc-passed →
ready-dispatch → dispatched → closed
```

---

### 6.4 MRP (`TX-MRP`)

**Input:** Open sales orders + released BOM + current inventory

**Calculation (per item, per period):**
```
Gross Requirement  = Σ (SO qty × BOM qty) + safety stock
Scheduled Receipts = Open PO qty (by date)
Projected On Hand  = Current stock + scheduled receipts − gross requirement
Net Requirement    = MAX(0, gross − scheduled − on hand)
Planned Order      = Net requirement rounded to vendor MOQ
```

**Output:** Planned purchase requisitions / PO suggestions

**Example MRP output for SO-2026-0142 (4× 45 M3 Bulker):**

| Item | Gross Req | On Hand | Net Req | Action |
|------|-----------|---------|---------|--------|
| BO-AXL-3A-130 | 4 SET | 1 SET | 3 SET | Create PO |
| RM-MS-PLT-16 | 16,800 KG | 12,500 KG | 4,300 KG | Create PO |
| BO-TYRE-925 | 48 NOS | 36 NOS | 12 NOS | Create PO |

---

### 6.5 Purchase Order (`TX-PO`)

**Input:** MRP planned orders or manual requisition

| Field | Example |
|-------|---------|
| po_no | PO-2026-0445 |
| vendor | VEND-BPW-001 |
| item | BO-AXL-3A-130 |
| quantity | 3 |
| rate | 4,85,000 |
| delivery_date | 2026-07-01 |
| status | draft / approved / sent / partial-received / closed |

---

### 6.6 GRN — Goods Receipt Note (`TX-GRN`)

**Input:** PO + physical material arrival

| Field | Example |
|-------|---------|
| grn_no | GRN-2026-0312 |
| po_no | PO-2026-0445 |
| item | BO-AXL-3A-130 |
| received_qty | 3 SET |
| warehouse | WH-BO-MAIN |
| mtc_ref | MTC-BPW-2026-8891 |
| status | draft / posted |

**Effect on posting:**
- Inventory on-hand increases
- PO received quantity updates
- MRP scheduled receipts update

---

### 6.7 Inventory (`TX-INV`)

**Tracks:** Stock balances by item × warehouse

```
Available = On Hand − Reserved − WIP Issued
```

**Movement types:** GRN, Material Issue, Return, Adjustment, Transfer

---

### 6.8 Material Issue (`TX-MI`)

**Input:** Production Order + BOM (exploded by PO quantity)

| Field | Example |
|-------|---------|
| issue_no | MI-2026-0189 |
| production_order | PROD-2026-0089 |
| item | RM-MS-PLT-16 |
| issued_qty | 4200 KG |
| warehouse | WH-RM-MAIN |
| issued_to | WIP Bay-1 |

**Rules:**
- Cannot issue more than available stock
- Issue creates WIP cost accumulation on production order
- Backflushing option for consumables (Primer) at stage completion (Phase 2)

---

### 6.9 Production Order (`TX-PROD`)

**Input:** Sales Order (confirmed) + Released BOM

| Field | Example |
|-------|---------|
| prod_order_no | PROD-2026-0089 |
| so_no | SO-2026-0142 |
| product | FG-45M3-BULKER |
| quantity | 1 |
| bom_revision | Rev-A |
| planned_start | 2026-07-05 |
| planned_end | 2026-08-01 |
| status | planned / released / in-progress / qc-pending / completed |

**Release prerequisites:**
1. Sales Order confirmed
2. BOM released for product
3. Critical materials available or PO scheduled before start date

---

### 6.10 Job Card (`TX-JC`)

**Input:** Production Order + Product Routing

Operation-level document issued to shop floor.

**45 M3 Bulker — Standard Job Cards:**

| Seq | Operation | Work Center | Std Hours |
|-----|-----------|-------------|-----------|
| 10 | Chassis Cutting & Fit-up | Bay-1 | 16 |
| 20 | Tank Shell Rolling | Bay-1 | 24 |
| 30 | Tank Fabrication & Welding | Bay-1 | 40 |
| 40 | Running Gear Fitment | Bay-2 | 8 |
| 50 | Axle & Suspension Mounting | Bay-2 | 12 |
| 60 | Wheel Rim & Tyre Fitment | Bay-2 | 4 |
| 70 | Primer & Paint | Paint Shop | 12 |
| 80 | Final Assembly & Pneumatic Test | Bay-2 | 8 |

---

### 6.11 Job Work (`TX-JW`)

**Input:** Job Card assignment to operator

| Field | Example |
|-------|---------|
| job_work_no | JW-2026-0456 |
| job_card | JC-2026-0089-030 |
| operator | Sunil Kumar |
| start_time | 2026-07-10 08:00 |
| end_time | 2026-07-12 17:00 |
| qty_completed | 1 |
| status | in-progress / completed |

**Effect:** Updates Production Order progress; triggers QC checkpoint if operation requires inspection

---

### 6.12 Quality Control (`TX-QC`)

**Inspection types:**

| Type | Trigger | Example |
|------|---------|---------|
| Incoming | GRN posting | MTC verification for MS Plate |
| In-Process | Job Work completion | Weld visual after tank fabrication |
| Final | All job cards complete | Dimensional + pneumatic test |

**QC Status:** `pending` → `in-progress` → `passed` | `failed` → `rework`

**NCR on failure:** Non-Conformance Report with disposition (rework / scrap / concession)

---

### 6.13 Dispatch (`TX-DSP`)

**Input:** QC passed production + SO delivery balance

| Field | Example |
|-------|---------|
| dispatch_no | DC-2026-0285 |
| so_no | SO-2026-0142 |
| product | FG-45M3-BULKER |
| quantity | 1 |
| vehicle_no | MH-12-AB-4521 |
| driver | Mohan Lal |
| destination | Mumbai |
| status | ready / loaded / in-transit / delivered |

**Effect:** SO delivered qty updates; SO closes when fully dispatched

---

## 7. Cross-Module Business Rules

| Rule ID | Rule |
|---------|------|
| BR-001 | BOM lines must reference valid Item Master records only |
| BR-002 | Product Master must exist before BOM creation |
| BR-003 | MRP cannot run without released BOM for the product |
| BR-004 | PO requires approved vendor from Vendor Master |
| BR-005 | GRN must reference open PO line |
| BR-006 | Material Issue blocked if available stock insufficient |
| BR-007 | Production Order release blocked if BOM not released |
| BR-008 | Job Card generated from Production Order routing |
| BR-009 | Final QC required before dispatch |
| BR-010 | Dispatch qty cannot exceed SO open qty |
| BR-011 | Item cannot be deactivated if open PO or BOM reference exists |
| BR-012 | Warehouse mandatory on all GRN and Material Issue transactions |

---

## 8. User Roles

| Role | Modules |
|------|---------|
| Sales Executive | Inquiry, Quotation, Sales Order |
| Design Engineer | BOM, Product Master (specs) |
| Planner | MRP, Production scheduling |
| Procurement | Purchase Order |
| Store Keeper | GRN, Inventory, Material Issue |
| Production Supervisor | Production Order, Job Card, Job Work |
| QC Inspector | QC, NCR |
| Dispatch Coordinator | Dispatch |
| Plant Manager | All (read + approve) |
| Master Data Admin | All master data modules |

---

## 9. Development Phases

| Phase | Scope | Dependency |
|-------|-------|------------|
| **Phase 0** | UOM → Item Category → Item → Customer → Vendor → Warehouse → Product → BOM masters | None |
| **Phase 1** | Inquiry, Quotation, Sales Order | Phase 0 complete |
| **Phase 2** | MRP, Purchase Order | Phase 0 + SO |
| **Phase 3** | GRN, Inventory, Material Issue | Phase 0 + PO |
| **Phase 4** | Production Order, Job Card, Job Work | Phase 0 + SO + MI |
| **Phase 5** | QC, Dispatch | Phase 4 complete |
| **Phase 6** | Dashboard, reports, audit trail | All phases |

---

## 10. Out of Scope (Initial Release)

- Finance / GL / invoicing / Tally integration
- HR / payroll
- Subcontractor / job work outside (vendor processing)
- Multi-plant
- Mobile shop floor app
- CAD / PLM integration

---

## 11. Document References

| Document | Purpose |
|----------|---------|
| `MASTER_DATA_STRUCTURE.md` | Detailed master data fields, seed data, governance |
| `DATABASE_SCHEMA.md` | PostgreSQL table definitions |
| `MODULE_DEPENDENCY_MAP.md` | Module coupling, build order, event flows |
