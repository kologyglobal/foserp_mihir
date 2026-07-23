/**
 * Seeds 26 KL ISO Tank multilevel masters from the Material Summary CSV:
 * warehouses (ensure) → work centres → categories/UOMs → items → BOM → routing → profile.
 *
 * Safe to re-run (upserts by tenant+code). BOM/routing v1 created only if missing.
 *
 * Usage:
 *   npx tsx scripts/seed-iso-tank-26kl-from-csv.ts
 *   npx tsx scripts/seed-iso-tank-26kl-from-csv.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

type ItemType = 'raw' | 'bought_out' | 'consumable' | 'sub_assembly' | 'finished_good'
type LineType = 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'CONSUMABLE' | 'SUBASSEMBLY' | 'MANUFACTURED_COMPONENT'
type MakeOrBuy = 'MAKE' | 'BUY'

interface UomDef {
  code: string
  name: string
  uomType?: string
  decimalPlaces?: number
}

interface CategoryDef {
  code: string
  name: string
}

interface WarehouseDef {
  code: string
  name: string
  warehouseType: string
  plantCode: string
}

interface WorkCentreDef {
  code: string
  name: string
  departmentRef: string
}

interface ItemDef {
  code: string
  name: string
  itemType: ItemType
  categoryCode: string
  uomCode: string
  materialGrade?: string
  description?: string
  subAssemblyRule?: 'phantom' | 'manufactured' | 'purchased' | 'subcontracted' | null
  isPurchasable?: boolean
  isStockable?: boolean
  standardRate?: number
}

interface BomNode {
  ref: string
  parentRef: string | null
  itemCode: string
  qty: number
  uomCode: string
  sequence: number
  makeOrBuy: MakeOrBuy
  lineType: LineType
  notes?: string
  phantomAssembly?: boolean
  stockedSemiFinished?: boolean
  childProductionOrderRequired?: boolean
}

const UOMS: UomDef[] = [
  { code: 'NOS', name: 'Numbers', uomType: 'integer', decimalPlaces: 0 },
  { code: 'KG', name: 'Kilogram', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'LTR', name: 'Litre', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'SET', name: 'Set', uomType: 'integer', decimalPlaces: 0 },
  { code: 'LOT', name: 'Lot', uomType: 'integer', decimalPlaces: 0 },
]

const CATEGORIES: CategoryDef[] = [
  { code: 'CAT-FG', name: 'Finished Goods' },
  { code: 'CAT-FG-ISO', name: 'ISO Tank' },
  { code: 'CAT-SA', name: 'Sub Assembly' },
  { code: 'CAT-SA-TANK', name: 'Tank Assembly' },
  { code: 'CAT-RM', name: 'Raw Material' },
  { code: 'CAT-RM-PLATE', name: 'Plate' },
  { code: 'CAT-RM-STRUCT', name: 'Structural Steel' },
  { code: 'CAT-RM-CONS', name: 'Consumable' },
  { code: 'CAT-BO', name: 'Bought Out' },
  { code: 'CAT-BO-PNEU', name: 'Pneumatic' },
  { code: 'CAT-BO-RUN', name: 'Running Gear' },
]

const WAREHOUSES: WarehouseDef[] = [
  { code: 'RM_STORE', name: 'RM Store', warehouseType: 'raw_material', plantCode: 'AHMD' },
  { code: 'BO_STORE', name: 'Bought Out Store', warehouseType: 'bought_out', plantCode: 'AHMD' },
  { code: 'PAINT_STORE', name: 'Paint Store', warehouseType: 'raw_material', plantCode: 'AHMD' },
  { code: 'WIP_CUTTING', name: 'WIP Cutting', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_WELDING', name: 'WIP Welding', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_FABRICATION', name: 'WIP Fabrication', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_TANK_ASM', name: 'WIP Tank Assembly', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_PAINT', name: 'WIP Paint', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_FINAL', name: 'WIP Final', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'FG_YARD', name: 'FG Yard', warehouseType: 'finished_goods', plantCode: 'AHMD' },
  { code: 'QUARANTINE', name: 'Quarantine', warehouseType: 'quarantine', plantCode: 'AHMD' },
]

const WORK_CENTRES: WorkCentreDef[] = [
  { code: 'WC-ISO-CUT', name: 'ISO Plate Cutting / Nesting', departmentRef: 'FABRICATION' },
  { code: 'WC-ISO-ROLL', name: 'ISO Plate Rolling', departmentRef: 'FABRICATION' },
  { code: 'WC-ISO-FORM', name: 'ISO Dish Forming / Press', departmentRef: 'FABRICATION' },
  { code: 'WC-ISO-WELD', name: 'ISO Vessel Welding (SAW/SMAW)', departmentRef: 'WELDING' },
  { code: 'WC-ISO-FRAME', name: 'ISO Frame Fabrication', departmentRef: 'FABRICATION' },
  { code: 'WC-ISO-BLAST', name: 'ISO Shot Blast', departmentRef: 'SURFACE' },
  { code: 'WC-ISO-PAINT', name: 'ISO Painting', departmentRef: 'SURFACE' },
  { code: 'WC-ISO-ASSY', name: 'ISO Final Assembly / Fittings', departmentRef: 'ASSEMBLY' },
  { code: 'WC-ISO-TEST', name: 'ISO Hydro Test & QC', departmentRef: 'QUALITY' },
]

/** Sub-assemblies + FG + materials from Material Summary CSV (mapped into multilevel tree). */
const ITEMS: ItemDef[] = [
  // Finished good (already seeded by prisma seed — upsert keeps name)
  {
    code: 'FG-ISO-TANK-26K',
    name: '26 KL ISO Tank',
    itemType: 'finished_good',
    categoryCode: 'CAT-FG-ISO',
    uomCode: 'NOS',
    materialGrade: 'FG Assembly',
    description: '26 KL ISO tank container — ASME VIII / CSC / ISO 1496-3 · nominal tare ≈ 4,200 kg',
    isPurchasable: false,
    isStockable: true,
    standardRate: 4200000,
  },

  // Multilevel sub-assemblies
  {
    code: 'ISO-PV-ASM',
    name: 'Pressure Vessel Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-TANK',
    uomCode: 'SET',
    materialGrade: 'SA 516 Gr 70',
    description: 'Shell, dished ends, pads — MAWP path for 26 KL ISO tank',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'ISO-FRAME-ASM',
    name: 'ISO Frame Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'YST 310 / IS 2062 E350',
    description: 'Full frame with corner castings — CSC / ISO 1496-3',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'ISO-WALK-ASM',
    name: 'Walkway / Ladder / Spillbox Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'HDG / SS 304',
    description: 'Spillboxes, bottom cabinet, walkways, ladder',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'ISO-FIT-ASM',
    name: 'Process Fittings & Statutory Kit',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'SS 316 / PTFE / Plastic',
    description: 'Valves, gaskets, remote closure, plates, decals, fasteners',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'ISO-PAINT-PKG',
    name: 'Surface Prep & Paint Package',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: '—',
    description: 'Blast media + primer / intermediate / PU topcoat (phantom package)',
    subAssemblyRule: 'phantom',
    isPurchasable: false,
    isStockable: false,
  },

  // CSV rows 1–8 — plate & structural RM
  {
    code: 'RM-SA516-6MM-SHELL',
    name: 'SA 516 Gr 70 Plate 6 mm — Shell',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'ASME SA 516 Gr 70',
    description: 'Shell cylindrical body · ~1180 kg · UT per SA 435 spot',
  },
  {
    code: 'RM-SA516-6MM-DISH',
    name: 'SA 516 Gr 70 Plate 6 mm — Dished Ends',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'ASME SA 516 Gr 70',
    description: '2 blanks · ~200 kg · press/spin form; min t=5.84 mm after forming',
  },
  {
    code: 'RM-SA516-PAD',
    name: 'SA 516 Gr 70 Plate 6–10 mm — Pads / Baffles',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'ASME SA 516 Gr 70',
    description: 'Nozzle pads, baffle plates, saddle pads · ~150 kg',
  },
  {
    code: 'RM-SHS-125x8',
    name: 'IS 2062 E350 / YST 310 SHS 125×125×8',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'KG',
    materialGrade: 'IS 2062 E350 / YST 310',
    description: 'Vertical corner posts (4 off) · ~120 kg',
  },
  {
    code: 'RM-RHS-200x100x8',
    name: 'YST 310 RHS 200×100×8',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'KG',
    materialGrade: 'YST 310 or Higher',
    description: 'Bottom longitudinal & cross-members · ~250 kg',
  },
  {
    code: 'RM-RHS-150x75x6',
    name: 'YST 310 RHS 150×75×6',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'KG',
    materialGrade: 'YST 310 or Higher',
    description: 'Top longitudinal members · ~140 kg',
  },
  {
    code: 'RM-RHS-200x100x6',
    name: 'YST 310 RHS 200×100×6',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'KG',
    materialGrade: 'YST 310 or Higher',
    description: 'Top & bottom cross-members (end frames) · ~85 kg',
  },
  {
    code: 'RM-IS2062-FLAT',
    name: 'IS 2062 E350 Flat / Plate — Rings & Gussets',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'KG',
    materialGrade: 'IS 2062 E350',
    description: 'Stiffening rings (3), saddle gussets, misc · ~90 kg · 10 mm plate for rings',
  },

  // CSV row 9 — BO corner castings
  {
    code: 'BO-ISO-CORNER',
    name: 'ISO Corner Castings (ISO 1161)',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'NOS',
    materialGrade: 'ISO 1161 / CSC',
    description: '8 off — all four corners top & bottom · ~144 kg',
    standardRate: 3500,
  },

  // CSV rows 10–12 — welding consumables
  {
    code: 'RM-WELD-SAW',
    name: 'SAW Welding Consumables (flux + wire)',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'KG',
    materialGrade: 'AWS A5.17',
    description: 'Shell long seam · ~10 kg · to qualified WPS',
  },
  {
    code: 'RM-WELD-SMAW',
    name: 'SMAW / FCAW Welding Consumables',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'KG',
    materialGrade: 'AWS A5.1 / A5.20',
    description: 'Circ seams, nozzles, frame · ~25 kg · BV approved electrodes',
  },
  {
    code: 'RM-WELD-MIG',
    name: 'MIG Welding Wire (ER 70S-6 / ER 308L SS)',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'KG',
    materialGrade: 'AWS A5.18 / A5.9',
    description: 'Frame + fittings · ~15 kg · SS wire for SS fittings',
  },

  // CSV rows 13–16 — surface / paint
  {
    code: 'RM-SHOT-BLAST',
    name: 'Shot Blast Media (Steel Shot / Grit)',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'KG',
    materialGrade: 'Steel Shot/Grit',
    description: 'Sa 2.5 blast exterior/interior · ~500 kg recirculated; replenish ~100 kg',
  },
  {
    code: 'RM-EPOXY-PRIMER',
    name: 'Epoxy Zinc-Rich Primer',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    materialGrade: 'MDS approved brand',
    description: 'Frame & vessel exterior primer · ~25 L · 50 µm DFT',
  },
  {
    code: 'RM-EPOXY-INTER',
    name: 'Epoxy Intermediate Coat',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    materialGrade: 'MDS approved brand',
    description: 'Frame & vessel · ~25 L · 50 µm DFT',
  },
  {
    code: 'RM-PU-TOPCOAT',
    name: 'Polyurethane Topcoat',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    materialGrade: 'MDS approved brand',
    description: 'Customer colour · ~20 L · 50 µm DFT',
  },

  // CSV rows 17–19 — walkway materials
  {
    code: 'RM-HDG-SHEET',
    name: 'HDG Steel Sheet 1.5–3 mm',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'IS 277 / IS 2062 + HDG ISO 1461',
    description: 'Spillboxes (2), bottom cabinet, walkways · ~180 kg pre-HDG · HDG ≥ 85 µm',
  },
  {
    code: 'RM-GMS-GRATING',
    name: 'GMS Grating / Chequered Plate 475 mm',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'IS 3502 / GMS',
    description: 'Walkway panels · ~55 kg · HDG after fabrication',
  },
  {
    code: 'RM-SS304-LADDER',
    name: 'Stainless Steel 304 — Ladder / Plates',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'SS 304 ASTM A240',
    description: 'Ladder bar, label plates, data plate stock · ~15 kg',
  },

  // CSV rows 20–28 — bought-out fittings kit
  {
    code: 'BO-PTFE-GASKET',
    name: 'PTFE Envelope Gaskets',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'NOS',
    materialGrade: 'PTFE envelope',
    description: 'All flanged nozzle joints · 5 Nos · chemical duty',
  },
  {
    code: 'BO-SS316-VALVES',
    name: 'SS 316 Valves & Fittings Set',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'SET',
    materialGrade: 'SS 316 / OEM',
    description: 'SRV, ball, butterfly, foot valve — full BO set per spec §4.0 · ~17 kg',
    standardRate: 28500,
  },
  {
    code: 'BO-PVC-DN25',
    name: 'PVC Pipe DN25 — Spill Box Drain',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'NOS',
    materialGrade: 'UV resistant PVC',
    description: '2 Nos × ~0.4 m drain tubes',
  },
  {
    code: 'BO-MS-CHAIN-CAPS',
    name: 'MS Chain + Dust Caps',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'SET',
    materialGrade: 'MS / SS',
    description: 'Captive chains for discharge caps · 2 sets',
  },
  {
    code: 'BO-CABLE-REMOTE',
    name: 'Cable Remote Closure Kit',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'SET',
    materialGrade: 'SS cable / CS housing',
    description: 'Bottom discharge remote actuation · functional test required',
  },
  {
    code: 'BO-DECALS',
    name: 'Statutory Decals / Owner Logos',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'SET',
    materialGrade: '—',
    description: 'UN, IMDG, RID, ADR, TIR, owner marks',
  },
  {
    code: 'BO-SS-DATA-PLATE',
    name: 'SS Data Plate + Calibration Plate',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'NOS',
    materialGrade: 'SS 304 engraved',
    description: 'Data (rear LHS) + Calibration (spill box neck) · 2 Nos',
  },
  {
    code: 'BO-DOC-HOLDER',
    name: 'Document Holder Plastic Ø75×325 mm',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'NOS',
    materialGrade: 'Plastic UV stable',
    description: 'Inside RHS longitudinal adj rear corner post',
  },
  {
    code: 'BO-FASTENERS',
    name: 'Miscellaneous Fasteners Lot',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'LOT',
    materialGrade: 'SS 304 / Class 8.8',
    description: 'Bolts, nuts, washers for flanges, walkways, ladder · ~5 kg',
  },
]

/**
 * Multilevel BOM tree under FG-ISO-TANK-26K.
 * Level 1 = SA under FG; Level 2 = materials under each SA.
 */
const BOM_NODES: BomNode[] = [
  // L1 under FG
  {
    ref: 'L10',
    parentRef: null,
    itemCode: 'ISO-PV-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 10,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
    childProductionOrderRequired: true,
    notes: 'Pressure vessel — shell / dish / pads',
  },
  {
    ref: 'L20',
    parentRef: null,
    itemCode: 'ISO-FRAME-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 20,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
    childProductionOrderRequired: true,
    notes: 'ISO frame + corner castings',
  },
  {
    ref: 'L30',
    parentRef: null,
    itemCode: 'ISO-WALK-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 30,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
    notes: 'Walkway / ladder / spillbox',
  },
  {
    ref: 'L40',
    parentRef: null,
    itemCode: 'ISO-FIT-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
    notes: 'Process fittings & statutory kit',
  },
  {
    ref: 'L50',
    parentRef: null,
    itemCode: 'ISO-PAINT-PKG',
    qty: 1,
    uomCode: 'SET',
    sequence: 50,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    phantomAssembly: true,
    notes: 'Surface prep & paint package (phantom)',
  },

  // L2 under PV
  {
    ref: 'L11',
    parentRef: 'L10',
    itemCode: 'RM-SA516-6MM-SHELL',
    qty: 1180,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #1 Shell plate',
  },
  {
    ref: 'L12',
    parentRef: 'L10',
    itemCode: 'RM-SA516-6MM-DISH',
    qty: 200,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #2 Dished end blanks',
  },
  {
    ref: 'L13',
    parentRef: 'L10',
    itemCode: 'RM-SA516-PAD',
    qty: 150,
    uomCode: 'KG',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #3 Pads / baffles',
  },
  {
    ref: 'L14',
    parentRef: 'L10',
    itemCode: 'RM-WELD-SAW',
    qty: 10,
    uomCode: 'KG',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #10 SAW consumables',
  },

  // L2 under Frame
  {
    ref: 'L21',
    parentRef: 'L20',
    itemCode: 'RM-SHS-125x8',
    qty: 120,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #4 Corner posts',
  },
  {
    ref: 'L22',
    parentRef: 'L20',
    itemCode: 'RM-RHS-200x100x8',
    qty: 250,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #5 Bottom long/cross',
  },
  {
    ref: 'L23',
    parentRef: 'L20',
    itemCode: 'RM-RHS-150x75x6',
    qty: 140,
    uomCode: 'KG',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #6 Top longitudinal',
  },
  {
    ref: 'L24',
    parentRef: 'L20',
    itemCode: 'RM-RHS-200x100x6',
    qty: 85,
    uomCode: 'KG',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #7 End frame cross',
  },
  {
    ref: 'L25',
    parentRef: 'L20',
    itemCode: 'RM-IS2062-FLAT',
    qty: 90,
    uomCode: 'KG',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #8 Rings / gussets',
  },
  {
    ref: 'L26',
    parentRef: 'L20',
    itemCode: 'BO-ISO-CORNER',
    qty: 8,
    uomCode: 'NOS',
    sequence: 60,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #9 Corner castings',
  },

  // L2 under Walk
  {
    ref: 'L31',
    parentRef: 'L30',
    itemCode: 'RM-HDG-SHEET',
    qty: 180,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #17 HDG sheet',
  },
  {
    ref: 'L32',
    parentRef: 'L30',
    itemCode: 'RM-GMS-GRATING',
    qty: 55,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #18 Grating',
  },
  {
    ref: 'L33',
    parentRef: 'L30',
    itemCode: 'RM-SS304-LADDER',
    qty: 15,
    uomCode: 'KG',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
    notes: 'CSV #19 SS 304 ladder/plates',
  },

  // L2 under Fit
  {
    ref: 'L41',
    parentRef: 'L40',
    itemCode: 'BO-PTFE-GASKET',
    qty: 5,
    uomCode: 'NOS',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #20',
  },
  {
    ref: 'L42',
    parentRef: 'L40',
    itemCode: 'BO-SS316-VALVES',
    qty: 1,
    uomCode: 'SET',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #21',
  },
  {
    ref: 'L43',
    parentRef: 'L40',
    itemCode: 'BO-PVC-DN25',
    qty: 2,
    uomCode: 'NOS',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #22',
  },
  {
    ref: 'L44',
    parentRef: 'L40',
    itemCode: 'BO-MS-CHAIN-CAPS',
    qty: 2,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #23',
  },
  {
    ref: 'L45',
    parentRef: 'L40',
    itemCode: 'BO-CABLE-REMOTE',
    qty: 1,
    uomCode: 'SET',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #24',
  },
  {
    ref: 'L46',
    parentRef: 'L40',
    itemCode: 'BO-DECALS',
    qty: 1,
    uomCode: 'SET',
    sequence: 60,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #25',
  },
  {
    ref: 'L47',
    parentRef: 'L40',
    itemCode: 'BO-SS-DATA-PLATE',
    qty: 2,
    uomCode: 'NOS',
    sequence: 70,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #26',
  },
  {
    ref: 'L48',
    parentRef: 'L40',
    itemCode: 'BO-DOC-HOLDER',
    qty: 1,
    uomCode: 'NOS',
    sequence: 80,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #27',
  },
  {
    ref: 'L49',
    parentRef: 'L40',
    itemCode: 'BO-FASTENERS',
    qty: 1,
    uomCode: 'LOT',
    sequence: 90,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
    notes: 'CSV #28',
  },

  // L2 under Paint package
  {
    ref: 'L51',
    parentRef: 'L50',
    itemCode: 'RM-SHOT-BLAST',
    qty: 100,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #13 replenish qty',
  },
  {
    ref: 'L52',
    parentRef: 'L50',
    itemCode: 'RM-EPOXY-PRIMER',
    qty: 25,
    uomCode: 'LTR',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #14',
  },
  {
    ref: 'L53',
    parentRef: 'L50',
    itemCode: 'RM-EPOXY-INTER',
    qty: 25,
    uomCode: 'LTR',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #15',
  },
  {
    ref: 'L54',
    parentRef: 'L50',
    itemCode: 'RM-PU-TOPCOAT',
    qty: 20,
    uomCode: 'LTR',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #16',
  },
  {
    ref: 'L55',
    parentRef: 'L50',
    itemCode: 'RM-WELD-SMAW',
    qty: 25,
    uomCode: 'KG',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #11 (issued with surface/assy stages)',
  },
  {
    ref: 'L56',
    parentRef: 'L50',
    itemCode: 'RM-WELD-MIG',
    qty: 15,
    uomCode: 'KG',
    sequence: 60,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    notes: 'CSV #12',
  },
]

const BOM_CODE = 'BOM-ISO-TANK-26K'
const ROUTING_CODE = 'RT-ISO-TANK-26K'
const PROFILE_CODE = 'PROF-ISO-TANK-26K'

async function ensureUoms(tenantId: string, userId: string | null) {
  const map = new Map<string, string>()
  for (const u of UOMS) {
    const row = await prisma.masterUom.upsert({
      where: { tenantId_code: { tenantId, code: u.code } },
      create: {
        tenantId,
        code: u.code,
        name: u.name,
        uomType: u.uomType ?? 'integer',
        decimalPlaces: u.decimalPlaces ?? 0,
        isBaseUnit: u.code === 'NOS',
        createdBy: userId,
        updatedBy: userId,
      },
      update: { name: u.name, deletedAt: null, status: 'ACTIVE' },
    })
    map.set(u.code, row.id)
  }
  return map
}

async function ensureCategories(tenantId: string, userId: string | null) {
  const map = new Map<string, string>()
  for (const c of CATEGORIES) {
    const row = await prisma.masterItemCategory.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      create: {
        tenantId,
        code: c.code,
        name: c.name,
        createdBy: userId,
        updatedBy: userId,
      },
      update: { name: c.name, deletedAt: null, status: 'ACTIVE' },
    })
    map.set(c.code, row.id)
  }
  return map
}

async function ensureWarehouses(tenantId: string, userId: string | null) {
  const map = new Map<string, string>()
  for (const w of WAREHOUSES) {
    const row = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId, code: w.code } },
      create: {
        tenantId,
        code: w.code,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: w.plantCode,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: w.name,
        warehouseType: w.warehouseType,
        deletedAt: null,
        status: 'ACTIVE',
      },
    })
    map.set(w.code, row.id)
  }
  return map
}

async function ensureWorkCentres(tenantId: string, userId: string | null) {
  const map = new Map<string, string>()
  for (const wc of WORK_CENTRES) {
    const row = await prisma.manufacturingWorkCentre.upsert({
      where: { tenantId_code: { tenantId, code: wc.code } },
      create: {
        tenantId,
        code: wc.code,
        name: wc.name,
        plantCode: 'AHMD',
        departmentRef: wc.departmentRef,
        capacityPerShift: 8,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: wc.name,
        departmentRef: wc.departmentRef,
        deletedAt: null,
        isActive: true,
      },
    })
    map.set(wc.code, row.id)
  }
  return map
}

async function ensureItems(
  tenantId: string,
  userId: string | null,
  categoryIds: Map<string, string>,
  uomIds: Map<string, string>,
) {
  const map = new Map<string, string>()
  for (const item of ITEMS) {
    const categoryId = categoryIds.get(item.categoryCode)
    const baseUomId = uomIds.get(item.uomCode)
    if (!categoryId || !baseUomId) {
      throw new Error(`Missing category/UOM for item ${item.code}`)
    }
    const row = await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId, code: item.code } },
      create: {
        tenantId,
        code: item.code,
        name: item.name,
        itemDescription: item.description ?? '',
        categoryId,
        baseUomId,
        itemType: item.itemType,
        materialGrade: item.materialGrade ?? '',
        subAssemblyRule: item.subAssemblyRule ?? null,
        isPurchasable: item.isPurchasable ?? (item.itemType !== 'finished_good' && item.itemType !== 'sub_assembly'),
        isStockable: item.isStockable ?? true,
        standardRate: item.standardRate ?? 0,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: item.name,
        itemDescription: item.description ?? '',
        categoryId,
        baseUomId,
        itemType: item.itemType,
        materialGrade: item.materialGrade ?? '',
        subAssemblyRule: item.subAssemblyRule ?? null,
        isPurchasable: item.isPurchasable ?? (item.itemType !== 'finished_good' && item.itemType !== 'sub_assembly'),
        isStockable: item.isStockable ?? true,
        standardRate: item.standardRate ?? 0,
        deletedAt: null,
        status: 'ACTIVE',
      },
    })
    map.set(item.code, row.id)
  }
  return map
}

async function ensureBom(
  tenantId: string,
  userId: string | null,
  productItemId: string,
  itemIds: Map<string, string>,
  uomIds: Map<string, string>,
) {
  const bom = await prisma.manufacturingBom.upsert({
    where: { tenantId_code: { tenantId, code: BOM_CODE } },
    create: {
      tenantId,
      code: BOM_CODE,
      name: '26 KL ISO Tank Multilevel BOM',
      productItemId,
      description: 'From Material Summary CSV — consolidated tare ≈ 4,200 kg',
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: '26 KL ISO Tank Multilevel BOM',
      productItemId,
      deletedAt: null,
    },
  })

  let version = await prisma.manufacturingBomVersion.findFirst({
    where: { tenantId, bomId: bom.id, versionNumber: 1, deletedAt: null },
  })

  if (!version) {
    const nosId = uomIds.get('NOS')
    if (!nosId) throw new Error('NOS UOM missing')
    version = await prisma.manufacturingBomVersion.create({
      data: {
        tenantId,
        bomId: bom.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        baseQuantity: 1,
        baseUomId: nosId,
        expectedYieldPercent: 100,
        revisionNotes: 'Seeded from 26KL_ISO_Tank_Multilevel_BOM Material Summary CSV',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const lineIdByRef = new Map<string, string>()
    // Parents first (null parent), then children
    const ordered = [
      ...BOM_NODES.filter((n) => n.parentRef == null),
      ...BOM_NODES.filter((n) => n.parentRef != null),
    ]

    for (const node of ordered) {
      const itemId = itemIds.get(node.itemCode)
      const uomId = uomIds.get(node.uomCode)
      if (!itemId || !uomId) {
        throw new Error(`Missing item/UOM for BOM node ${node.ref} (${node.itemCode})`)
      }
      const parentLineId = node.parentRef ? lineIdByRef.get(node.parentRef) ?? null : null
      if (node.parentRef && !parentLineId) {
        throw new Error(`Parent ref ${node.parentRef} not found for ${node.ref}`)
      }
      const level = node.parentRef ? 2 : 1
      const line = await prisma.manufacturingBomLine.create({
        data: {
          tenantId,
          bomVersionId: version.id,
          parentLineId,
          sequence: node.sequence,
          level,
          itemId,
          quantity: node.qty,
          uomId,
          quantityBasis: 'PER_UNIT',
          scrapPercent: 0,
          yieldPercent: 100,
          makeOrBuy: node.makeOrBuy,
          lineType: node.lineType,
          isOptional: false,
          substituteAllowed: false,
          qualityRequired: node.lineType === 'SUBASSEMBLY',
          certificateRequired: node.itemCode.startsWith('BO-'),
          childProductionOrderRequired: node.childProductionOrderRequired ?? false,
          stockedSemiFinished: node.stockedSemiFinished ?? false,
          phantomAssembly: node.phantomAssembly ?? false,
          notes: node.notes ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      lineIdByRef.set(node.ref, line.id)
    }
    console.log(`  BOM ${BOM_CODE} v1 DRAFT created with ${ordered.length} lines`)
  } else {
    const count = await prisma.manufacturingBomLine.count({
      where: { tenantId, bomVersionId: version.id, deletedAt: null },
    })
    console.log(`  BOM ${BOM_CODE} v1 already exists (${count} lines, status=${version.status}) — skipped line create`)
  }

  return { bom, version }
}

async function ensureRouting(
  tenantId: string,
  userId: string | null,
  productItemId: string,
  workCentreIds: Map<string, string>,
) {
  const routing = await prisma.manufacturingRouting.upsert({
    where: { tenantId_code: { tenantId, code: ROUTING_CODE } },
    create: {
      tenantId,
      code: ROUTING_CODE,
      name: '26 KL ISO Tank Routing',
      productItemId,
      description: 'Cut → Roll/Form → Weld → Frame → Blast → Paint → Assemble → Test',
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: '26 KL ISO Tank Routing',
      productItemId,
      deletedAt: null,
      isActive: true,
    },
  })

  let version = await prisma.manufacturingRoutingVersion.findFirst({
    where: { tenantId, routingId: routing.id, versionNumber: 1, deletedAt: null },
  })

  if (!version) {
    version = await prisma.manufacturingRoutingVersion.create({
      data: {
        tenantId,
        routingId: routing.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const stages: Array<{
      code: string
      name: string
      order: number
      wc: string
      ops: Array<{ code: string; name: string; seq: number; setup: number; run: number }>
    }> = [
      {
        code: 'ST-CUT',
        name: 'Plate Cutting',
        order: 1,
        wc: 'WC-ISO-CUT',
        ops: [
          { code: 'OP-10', name: 'Incoming plate MTC / UT sample', seq: 10, setup: 15, run: 30 },
          { code: 'OP-20', name: 'Nesting & CNC plate cut', seq: 20, setup: 30, run: 180 },
        ],
      },
      {
        code: 'ST-FORM',
        name: 'Shell Rolling & Dish Forming',
        order: 2,
        wc: 'WC-ISO-ROLL',
        ops: [
          { code: 'OP-30', name: 'Plate rolling — cylindrical shell', seq: 30, setup: 45, run: 240 },
          { code: 'OP-40', name: 'Dish blank form (press/spin)', seq: 40, setup: 60, run: 180 },
        ],
      },
      {
        code: 'ST-WELD',
        name: 'Vessel Welding',
        order: 3,
        wc: 'WC-ISO-WELD',
        ops: [
          { code: 'OP-50', name: 'Long seam SAW weld', seq: 50, setup: 60, run: 360 },
          { code: 'OP-60', name: 'Circ seam / nozzle weld', seq: 60, setup: 45, run: 480 },
        ],
      },
      {
        code: 'ST-FRAME',
        name: 'Frame Fabrication',
        order: 4,
        wc: 'WC-ISO-FRAME',
        ops: [
          { code: 'OP-70', name: 'Cut & fit SHS/RHS members', seq: 70, setup: 30, run: 300 },
          { code: 'OP-80', name: 'Weld frame + fit corner castings', seq: 80, setup: 45, run: 360 },
        ],
      },
      {
        code: 'ST-SURF',
        name: 'Surface Prep & Paint',
        order: 5,
        wc: 'WC-ISO-BLAST',
        ops: [
          { code: 'OP-90', name: 'Shot blast Sa 2.5', seq: 90, setup: 30, run: 180 },
          { code: 'OP-100', name: 'Primer / intermediate / PU topcoat', seq: 100, setup: 45, run: 420 },
        ],
      },
      {
        code: 'ST-ASSY',
        name: 'Final Assembly',
        order: 6,
        wc: 'WC-ISO-ASSY',
        ops: [
          { code: 'OP-110', name: 'Fit walkway / ladder / spillboxes', seq: 110, setup: 30, run: 240 },
          { code: 'OP-120', name: 'Install valves, plates, decals', seq: 120, setup: 30, run: 180 },
        ],
      },
      {
        code: 'ST-TEST',
        name: 'Hydro Test & Release',
        order: 7,
        wc: 'WC-ISO-TEST',
        ops: [
          { code: 'OP-130', name: 'Hydro / pneumatic test', seq: 130, setup: 60, run: 240 },
          { code: 'OP-140', name: 'Final QC & documentation pack', seq: 140, setup: 30, run: 120 },
        ],
      },
    ]

    for (const stage of stages) {
      const wcId = workCentreIds.get(stage.wc)
      if (!wcId) throw new Error(`Work centre ${stage.wc} missing`)
      // OP-100 uses paint WC even though stage default is blast
      const stageGroup = await prisma.manufacturingStageGroup.create({
        data: {
          tenantId,
          routingVersionId: version.id,
          code: stage.code,
          name: stage.name,
          displayOrder: stage.order,
          defaultWorkCentreId: wcId,
          completionRule: 'ALL_OPERATIONS',
          createdBy: userId,
          updatedBy: userId,
        },
      })

      for (const op of stage.ops) {
        let opWc = wcId
        if (op.code === 'OP-40') opWc = workCentreIds.get('WC-ISO-FORM') ?? wcId
        if (op.code === 'OP-100') opWc = workCentreIds.get('WC-ISO-PAINT') ?? wcId
        await prisma.manufacturingRoutingOperation.create({
          data: {
            tenantId,
            routingVersionId: version.id,
            stageGroupId: stageGroup.id,
            code: op.code,
            name: op.name,
            sequence: op.seq,
            workCentreId: opWc,
            setupTimeMinutes: op.setup,
            runTimeValue: op.run,
            runTimeBasis: 'PER_UNIT',
            inputType: 'MATERIAL',
            outputType: op.code === 'OP-140' ? 'FINISHED_GOOD' : 'SEMI_FINISHED',
            outputItemId: op.code === 'OP-140' ? productItemId : null,
            createdBy: userId,
            updatedBy: userId,
          },
        })
      }
    }
    console.log(`  Routing ${ROUTING_CODE} v1 DRAFT created with ${stages.length} stages`)
  } else {
    console.log(`  Routing ${ROUTING_CODE} v1 already exists (status=${version.status}) — skipped`)
  }

  return { routing, version }
}

async function ensureProfile(
  tenantId: string,
  userId: string | null,
  productItemId: string,
  bomVersionId: string,
  routingVersionId: string,
  warehouseIds: Map<string, string>,
) {
  const prodWh = warehouseIds.get('WIP_TANK_ASM')
  const wipWh = warehouseIds.get('WIP_FABRICATION')
  const fgWh = warehouseIds.get('FG_YARD')
  const scrapWh = warehouseIds.get('QUARANTINE')
  if (!prodWh || !fgWh) throw new Error('Required warehouses missing for profile')

  const profile = await prisma.manufacturingProfile.upsert({
    where: { tenantId_code: { tenantId, code: PROFILE_CODE } },
    create: {
      tenantId,
      code: PROFILE_CODE,
      name: '26 KL ISO Tank Profile',
      productItemId,
      productionType: 'ENGINEER_TO_ORDER',
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersionId,
      defaultRoutingVersionId: routingVersionId,
      productionWarehouseId: prodWh,
      wipWarehouseId: wipWh ?? prodWh,
      finishedGoodsWarehouseId: fgWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: scrapWh ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: '26 KL ISO Tank Profile',
      productItemId,
      defaultBomVersionId: bomVersionId,
      defaultRoutingVersionId: routingVersionId,
      productionWarehouseId: prodWh,
      wipWarehouseId: wipWh ?? prodWh,
      finishedGoodsWarehouseId: fgWh,
      deletedAt: null,
      isActive: true,
    },
  })
  console.log(`  Profile ${PROFILE_CODE} upserted`)
  return profile
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (!tenant) {
    console.error(`Tenant not found: ${tenantSlug}`)
    process.exit(1)
  }

  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  const userId = adminUser?.id ?? null

  console.log(`Seeding 26 KL ISO Tank masters for "${tenant.name}" (${tenant.slug})...`)

  console.log('1) Warehouses')
  const warehouseIds = await ensureWarehouses(tenant.id, userId)
  console.log(`   ${warehouseIds.size} warehouses ensured`)

  console.log('2) Work centres')
  const workCentreIds = await ensureWorkCentres(tenant.id, userId)
  console.log(`   ${workCentreIds.size} work centres ensured`)

  console.log('3) UOMs + categories')
  const uomIds = await ensureUoms(tenant.id, userId)
  const categoryIds = await ensureCategories(tenant.id, userId)
  console.log(`   ${uomIds.size} UOMs, ${categoryIds.size} categories`)

  console.log('4) Items (CSV materials + multilevel SAs + FG)')
  const itemIds = await ensureItems(tenant.id, userId, categoryIds, uomIds)
  console.log(`   ${itemIds.size} items upserted`)

  const fgId = itemIds.get('FG-ISO-TANK-26K')
  if (!fgId) throw new Error('FG-ISO-TANK-26K missing')

  console.log('5) Multilevel BOM')
  const { version: bomVersion } = await ensureBom(tenant.id, userId, fgId, itemIds, uomIds)

  console.log('6) Routing ops')
  const { version: routingVersion } = await ensureRouting(tenant.id, userId, fgId, workCentreIds)

  console.log('7) Manufacturing profile')
  await ensureProfile(tenant.id, userId, fgId, bomVersion.id, routingVersion.id, warehouseIds)

  console.log('Done.')
  console.log('')
  console.log('Next in UI (API mode):')
  console.log('  /masters/items — filter ISO / RM- / BO-')
  console.log(`  /manufacturing/setup/boms — open ${BOM_CODE} → validate → activate`)
  console.log(`  /manufacturing/setup/routings — open ${ROUTING_CODE} → validate → activate`)
  console.log(`  /manufacturing/setup/profiles — ${PROFILE_CODE}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
