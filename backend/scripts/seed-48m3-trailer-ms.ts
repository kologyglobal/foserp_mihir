/**
 * Seeds finished good "48M3 TRAILER MS" with multilevel BOM, work centres,
 * machines, routing (route card), and manufacturing profile — ready for direct WO.
 *
 * Idempotent upserts by tenant+code. BOM/routing v1 created only if missing,
 * then activated so New Work Order → Item Master path works immediately.
 *
 * Usage:
 *   npx tsx scripts/seed-48m3-trailer-ms.ts
 *   npx tsx scripts/seed-48m3-trailer-ms.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

const FG_CODE = 'FG-TRL-48M3-MS'
const FG_NAME = '48M3 TRAILER MS'
const BOM_CODE = 'BOM-TRL-48M3-MS'
const ROUTING_CODE = 'RT-TRL-48M3-MS'
const PROFILE_CODE = 'PROF-TRL-48M3-MS'

type ItemType = 'raw' | 'bought_out' | 'consumable' | 'sub_assembly' | 'finished_good'
type LineType = 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'CONSUMABLE' | 'SUBASSEMBLY' | 'MANUFACTURED_COMPONENT'
type MakeOrBuy = 'MAKE' | 'BUY'

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

const UOMS = [
  { code: 'NOS', name: 'Numbers', uomType: 'integer', decimalPlaces: 0 },
  { code: 'KG', name: 'Kilogram', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'MTR', name: 'Metre', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'LTR', name: 'Litre', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'SET', name: 'Set', uomType: 'integer', decimalPlaces: 0 },
]

const CATEGORIES = [
  { code: 'CAT-FG', name: 'Finished Goods' },
  { code: 'CAT-FG-TRL', name: 'Trailer Finished Goods' },
  { code: 'CAT-SA', name: 'Sub Assembly' },
  { code: 'CAT-RM', name: 'Raw Material' },
  { code: 'CAT-RM-PLATE', name: 'Plate' },
  { code: 'CAT-RM-STRUCT', name: 'Structural Steel' },
  { code: 'CAT-RM-CONS', name: 'Consumable' },
  { code: 'CAT-BO', name: 'Bought Out' },
  { code: 'CAT-BO-RUN', name: 'Running Gear' },
  { code: 'CAT-BO-PNEU', name: 'Pneumatic' },
]

const WAREHOUSES = [
  { code: 'RM_STORE', name: 'RM Store', warehouseType: 'raw_material', plantCode: 'AHMD' },
  { code: 'BO_STORE', name: 'Bought Out Store', warehouseType: 'bought_out', plantCode: 'AHMD' },
  { code: 'WIP_CUTTING', name: 'WIP Cutting', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_FABRICATION', name: 'WIP Fabrication', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_WELDING', name: 'WIP Welding', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_ASSEMBLY', name: 'WIP Assembly', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'WIP_PAINT', name: 'WIP Paint', warehouseType: 'wip', plantCode: 'AHMD' },
  { code: 'FG_YARD', name: 'FG Yard', warehouseType: 'finished_goods', plantCode: 'AHMD' },
  { code: 'QUARANTINE', name: 'Quarantine', warehouseType: 'quarantine', plantCode: 'AHMD' },
]

const WORK_CENTRES = [
  { code: 'WC-TRL-CUT', name: 'Trailer Plate / Profile Cutting', departmentRef: 'FABRICATION' },
  { code: 'WC-TRL-FAB', name: 'Trailer Chassis Fabrication', departmentRef: 'FABRICATION' },
  { code: 'WC-TRL-WELD', name: 'Trailer Welding Bay', departmentRef: 'WELDING' },
  { code: 'WC-TRL-ASSY', name: 'Trailer Final Assembly', departmentRef: 'ASSEMBLY' },
  { code: 'WC-TRL-PAINT', name: 'Trailer Paint Booth', departmentRef: 'SURFACE' },
  { code: 'WC-TRL-QC', name: 'Trailer Final QC / Road Test', departmentRef: 'QUALITY' },
]

const MACHINES: Array<{ code: string; name: string; workCentreCode: string }> = [
  { code: 'MC-TRL-CNC-CUT', name: 'CNC Plasma / Oxy Cut Bed', workCentreCode: 'WC-TRL-CUT' },
  { code: 'MC-TRL-SAW', name: 'Band Saw / Cold Saw', workCentreCode: 'WC-TRL-CUT' },
  { code: 'MC-TRL-PRESS', name: 'Hydraulic Press Brake', workCentreCode: 'WC-TRL-FAB' },
  { code: 'MC-TRL-JIG', name: 'Chassis Assembly Jig', workCentreCode: 'WC-TRL-FAB' },
  { code: 'MC-TRL-MIG-1', name: 'MIG Welding Station 1', workCentreCode: 'WC-TRL-WELD' },
  { code: 'MC-TRL-MIG-2', name: 'MIG Welding Station 2', workCentreCode: 'WC-TRL-WELD' },
  { code: 'MC-TRL-ASSY-BAY', name: 'Final Fitment Bay Crane', workCentreCode: 'WC-TRL-ASSY' },
  { code: 'MC-TRL-BLAST', name: 'Shot Blast Booth', workCentreCode: 'WC-TRL-PAINT' },
  { code: 'MC-TRL-SPRAY', name: 'Paint Spray Booth', workCentreCode: 'WC-TRL-PAINT' },
  { code: 'MC-TRL-ROAD', name: 'Road Test Lane', workCentreCode: 'WC-TRL-QC' },
]

const ITEMS: ItemDef[] = [
  {
    code: FG_CODE,
    name: FG_NAME,
    itemType: 'finished_good',
    categoryCode: 'CAT-FG-TRL',
    uomCode: 'NOS',
    materialGrade: 'MS IS 2062',
    description:
      '48 m³ mild-steel bulk / tanker trailer — chassis, tank shell, running gear, pneumatics, paint & final QC',
    isPurchasable: false,
    isStockable: true,
    standardRate: 3200000,
  },
  {
    code: 'TRL48-CHASSIS-ASM',
    name: '48M3 Chassis Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'IS 4923 YST 310',
    description: 'Main longitudinals, cross members, kingpin plate, landing-leg mounts',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'TRL48-TANK-ASM',
    name: '48M3 Tank Shell Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'MS IS 2062 E350',
    description: 'Mild-steel tank barrel, rings, manhole pad, discharge nozzle mounts',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'TRL48-RUNGEAR-ASM',
    name: '48M3 Running Gear Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'Fabricated',
    description: 'Axle, suspension, rims, tyres — fitted to chassis',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'TRL48-PNEU-ASM',
    name: '48M3 Pneumatic & Brake Kit',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    materialGrade: 'WABCO / OEM',
    description: 'Air tanks, valves, brake lines, ABS harness',
    subAssemblyRule: 'manufactured',
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'TRL48-PAINT-PKG',
    name: '48M3 Surface Prep & Paint Package',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    description: 'Blast + primer + topcoat consumables (phantom)',
    subAssemblyRule: 'phantom',
    isPurchasable: false,
    isStockable: false,
  },
  // Chassis RM
  {
    code: 'RM-TRL48-PLT-12',
    name: 'MS Plate 12mm (Chassis)',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'IS 2062 E350',
    isPurchasable: true,
    standardRate: 72,
  },
  {
    code: 'RM-TRL48-CHS-150',
    name: 'CHS 150mm Pipe (Longitudinal)',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'MTR',
    materialGrade: 'IS 4923 YST 310',
    isPurchasable: true,
    standardRate: 1850,
  },
  {
    code: 'RM-TRL48-ANGLE',
    name: 'Angle 75×75×8',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'MTR',
    materialGrade: 'IS 2062 E250',
    isPurchasable: true,
    standardRate: 620,
  },
  {
    code: 'BO-TRL48-KPIN',
    name: 'King Pin 2" SAE',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'NOS',
    materialGrade: 'JOST / SAE',
    isPurchasable: true,
    standardRate: 18500,
  },
  {
    code: 'BO-TRL48-LLEG',
    name: 'Landing Legs Pair',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'SET',
    materialGrade: 'JOST',
    isPurchasable: true,
    standardRate: 28000,
  },
  // Tank RM
  {
    code: 'RM-TRL48-PLT-5',
    name: 'MS Plate 5mm (Tank Shell)',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'IS 2062 E350',
    isPurchasable: true,
    standardRate: 70,
  },
  {
    code: 'RM-TRL48-PLT-8',
    name: 'MS Plate 8mm (Tank Rings / Pads)',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    materialGrade: 'IS 2062 E350',
    isPurchasable: true,
    standardRate: 71,
  },
  {
    code: 'RM-TRL48-WELD-WIRE',
    name: 'MIG Welding Wire ER70S-6',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'KG',
    isPurchasable: true,
    standardRate: 145,
  },
  {
    code: 'BO-TRL48-MANLID',
    name: 'Manhole Cover DN500',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'SET',
    isPurchasable: true,
    standardRate: 12500,
  },
  {
    code: 'BO-TRL48-VALVE',
    name: 'Bottom Discharge Valve 4"',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'NOS',
    materialGrade: 'CS / SS trim',
    isPurchasable: true,
    standardRate: 32000,
  },
  // Running gear BO
  {
    code: 'BO-TRL48-AXLE',
    name: 'Axle ABS Tri-Axle Set',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'SET',
    materialGrade: 'BPW ABS-6620',
    isPurchasable: true,
    standardRate: 485000,
  },
  {
    code: 'BO-TRL48-SUSP',
    name: 'Air Suspension Kit',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'SET',
    isPurchasable: true,
    standardRate: 125000,
  },
  {
    code: 'BO-TRL48-RIM',
    name: 'Wheel Rim 22.5"',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'NOS',
    isPurchasable: true,
    standardRate: 8200,
  },
  {
    code: 'BO-TRL48-TYRE',
    name: 'Tyre 295/80R22.5',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'NOS',
    isPurchasable: true,
    standardRate: 22500,
  },
  // Pneumatics
  {
    code: 'BO-TRL48-AIRTANK',
    name: 'Air Tank 40L',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'NOS',
    isPurchasable: true,
    standardRate: 6500,
  },
  {
    code: 'BO-TRL48-ABS',
    name: 'ABS / EBS Module',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'SET',
    isPurchasable: true,
    standardRate: 85000,
  },
  // Paint
  {
    code: 'RM-TRL48-PRIMER',
    name: 'Epoxy Primer Red Oxide',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    isPurchasable: true,
    standardRate: 285,
  },
  {
    code: 'RM-TRL48-TOPCOAT',
    name: 'PU Topcoat',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    isPurchasable: true,
    standardRate: 420,
  },
  {
    code: 'RM-TRL48-THINNER',
    name: 'Epoxy Thinner',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    isPurchasable: true,
    standardRate: 145,
  },
]

const BOM_NODES: BomNode[] = [
  // Level 1 — under FG
  {
    ref: 'L10',
    parentRef: null,
    itemCode: 'TRL48-CHASSIS-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 10,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
    childProductionOrderRequired: true,
    notes: 'Chassis SA — child WO eligible',
  },
  {
    ref: 'L20',
    parentRef: null,
    itemCode: 'TRL48-TANK-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 20,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
    childProductionOrderRequired: true,
    notes: 'Tank shell SA',
  },
  {
    ref: 'L30',
    parentRef: null,
    itemCode: 'TRL48-RUNGEAR-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 30,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    stockedSemiFinished: true,
  },
  {
    ref: 'L40',
    parentRef: null,
    itemCode: 'TRL48-PNEU-ASM',
    qty: 1,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
  },
  {
    ref: 'L50',
    parentRef: null,
    itemCode: 'TRL48-PAINT-PKG',
    qty: 1,
    uomCode: 'SET',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
    phantomAssembly: true,
  },
  // Chassis children
  {
    ref: 'L11',
    parentRef: 'L10',
    itemCode: 'RM-TRL48-CHS-150',
    qty: 48,
    uomCode: 'MTR',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L12',
    parentRef: 'L10',
    itemCode: 'RM-TRL48-PLT-12',
    qty: 1850,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L13',
    parentRef: 'L10',
    itemCode: 'RM-TRL48-ANGLE',
    qty: 120,
    uomCode: 'MTR',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L14',
    parentRef: 'L10',
    itemCode: 'BO-TRL48-KPIN',
    qty: 1,
    uomCode: 'NOS',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L15',
    parentRef: 'L10',
    itemCode: 'BO-TRL48-LLEG',
    qty: 1,
    uomCode: 'SET',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // Tank children
  {
    ref: 'L21',
    parentRef: 'L20',
    itemCode: 'RM-TRL48-PLT-5',
    qty: 4200,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L22',
    parentRef: 'L20',
    itemCode: 'RM-TRL48-PLT-8',
    qty: 680,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L23',
    parentRef: 'L20',
    itemCode: 'RM-TRL48-WELD-WIRE',
    qty: 85,
    uomCode: 'KG',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
  {
    ref: 'L24',
    parentRef: 'L20',
    itemCode: 'BO-TRL48-MANLID',
    qty: 1,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L25',
    parentRef: 'L20',
    itemCode: 'BO-TRL48-VALVE',
    qty: 1,
    uomCode: 'NOS',
    sequence: 50,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // Running gear
  {
    ref: 'L31',
    parentRef: 'L30',
    itemCode: 'BO-TRL48-AXLE',
    qty: 1,
    uomCode: 'SET',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L32',
    parentRef: 'L30',
    itemCode: 'BO-TRL48-SUSP',
    qty: 1,
    uomCode: 'SET',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L33',
    parentRef: 'L30',
    itemCode: 'BO-TRL48-RIM',
    qty: 12,
    uomCode: 'NOS',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L34',
    parentRef: 'L30',
    itemCode: 'BO-TRL48-TYRE',
    qty: 12,
    uomCode: 'NOS',
    sequence: 40,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // Pneumatics
  {
    ref: 'L41',
    parentRef: 'L40',
    itemCode: 'BO-TRL48-AIRTANK',
    qty: 3,
    uomCode: 'NOS',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L42',
    parentRef: 'L40',
    itemCode: 'BO-TRL48-ABS',
    qty: 1,
    uomCode: 'SET',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // Paint phantom children
  {
    ref: 'L51',
    parentRef: 'L50',
    itemCode: 'RM-TRL48-PRIMER',
    qty: 45,
    uomCode: 'LTR',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
  {
    ref: 'L52',
    parentRef: 'L50',
    itemCode: 'RM-TRL48-TOPCOAT',
    qty: 60,
    uomCode: 'LTR',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
  {
    ref: 'L53',
    parentRef: 'L50',
    itemCode: 'RM-TRL48-THINNER',
    qty: 25,
    uomCode: 'LTR',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
]

async function ensureUoms(tenantId: string) {
  const map = new Map<string, string>()
  for (const u of UOMS) {
    const row = await prisma.masterUom.upsert({
      where: { tenantId_code: { tenantId, code: u.code } },
      create: {
        tenantId,
        code: u.code,
        name: u.name,
        uomType: u.uomType,
        decimalPlaces: u.decimalPlaces,
        isBaseUnit: true,
      },
      update: { name: u.name, deletedAt: null, status: 'ACTIVE' },
    })
    map.set(u.code, row.id)
  }
  return map
}

async function ensureCategories(tenantId: string) {
  const map = new Map<string, string>()
  for (const c of CATEGORIES) {
    const row = await prisma.masterItemCategory.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      create: { tenantId, code: c.code, name: c.name },
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

async function ensureMachines(
  tenantId: string,
  userId: string | null,
  workCentreIds: Map<string, string>,
) {
  const map = new Map<string, string>()
  for (const m of MACHINES) {
    const workCentreId = workCentreIds.get(m.workCentreCode)
    if (!workCentreId) throw new Error(`WC missing for machine ${m.code}`)
    const row = await prisma.manufacturingMachine.upsert({
      where: { tenantId_code: { tenantId, code: m.code } },
      create: {
        tenantId,
        code: m.code,
        name: m.name,
        workCentreId,
        status: 'AVAILABLE',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: m.name,
        workCentreId,
        deletedAt: null,
        isActive: true,
        status: 'AVAILABLE',
      },
    })
    map.set(m.code, row.id)
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
    if (!categoryId || !baseUomId) throw new Error(`Missing category/UOM for ${item.code}`)
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
        hsnCode: item.itemType === 'finished_good' ? '8716' : '',
        subAssemblyRule: item.subAssemblyRule ?? null,
        isPurchasable:
          item.isPurchasable ?? (item.itemType !== 'finished_good' && item.itemType !== 'sub_assembly'),
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
        isPurchasable:
          item.isPurchasable ?? (item.itemType !== 'finished_good' && item.itemType !== 'sub_assembly'),
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
      name: `${FG_NAME} Multilevel BOM`,
      productItemId,
      description: 'Chassis + Tank + Running Gear + Pneumatics + Paint — multilevel',
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${FG_NAME} Multilevel BOM`,
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
        revisionNotes: 'Initial seed — 48M3 TRAILER MS multilevel',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const lineIdByRef = new Map<string, string>()
    const ordered = [
      ...BOM_NODES.filter((n) => n.parentRef == null),
      ...BOM_NODES.filter((n) => n.parentRef != null),
    ]
    for (const node of ordered) {
      const itemId = itemIds.get(node.itemCode)
      const uomId = uomIds.get(node.uomCode)
      if (!itemId || !uomId) throw new Error(`Missing item/UOM for ${node.ref} (${node.itemCode})`)
      const parentLineId = node.parentRef ? lineIdByRef.get(node.parentRef) ?? null : null
      if (node.parentRef && !parentLineId) throw new Error(`Parent ${node.parentRef} missing for ${node.ref}`)
      const line = await prisma.manufacturingBomLine.create({
        data: {
          tenantId,
          bomVersionId: version.id,
          parentLineId,
          sequence: node.sequence,
          level: node.parentRef ? 2 : 1,
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
    console.log(`  BOM ${BOM_CODE} v1 DRAFT created (${ordered.length} lines)`)
  } else {
    console.log(`  BOM ${BOM_CODE} v1 exists (status=${version.status}) — skipped lines`)
  }

  if (version.status !== 'ACTIVE') {
    version = await prisma.manufacturingBomVersion.update({
      where: { id: version.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`  BOM ${BOM_CODE} v1 ACTIVATED`)
  }

  return { bom, version }
}

async function ensureRouting(
  tenantId: string,
  userId: string | null,
  productItemId: string,
  workCentreIds: Map<string, string>,
  machineIds: Map<string, string>,
) {
  const routing = await prisma.manufacturingRouting.upsert({
    where: { tenantId_code: { tenantId, code: ROUTING_CODE } },
    create: {
      tenantId,
      code: ROUTING_CODE,
      name: `${FG_NAME} Route Card`,
      productItemId,
      description: 'Cut → Fabricate chassis → Weld tank → Assemble → Paint → QC',
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${FG_NAME} Route Card`,
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
      qualityRequired?: boolean
      ops: Array<{
        code: string
        name: string
        seq: number
        setup: number
        run: number
        machine?: string
        wcOverride?: string
      }>
    }> = [
      {
        code: 'ST-CUT',
        name: 'Cutting & Nesting',
        order: 1,
        wc: 'WC-TRL-CUT',
        ops: [
          { code: 'OP-10', name: 'Plate / profile nest & CNC cut', seq: 10, setup: 20, run: 180, machine: 'MC-TRL-CNC-CUT' },
          { code: 'OP-20', name: 'Structural member cut to length', seq: 20, setup: 15, run: 90, machine: 'MC-TRL-SAW' },
        ],
      },
      {
        code: 'ST-FAB',
        name: 'Chassis Fabrication',
        order: 2,
        wc: 'WC-TRL-FAB',
        ops: [
          { code: 'OP-30', name: 'Press / form chassis plates', seq: 30, setup: 30, run: 120, machine: 'MC-TRL-PRESS' },
          { code: 'OP-40', name: 'Fit-up on chassis jig', seq: 40, setup: 45, run: 240, machine: 'MC-TRL-JIG' },
        ],
      },
      {
        code: 'ST-WELD',
        name: 'Tank & Frame Welding',
        order: 3,
        wc: 'WC-TRL-WELD',
        ops: [
          { code: 'OP-50', name: 'Chassis long / cross weld', seq: 50, setup: 30, run: 360, machine: 'MC-TRL-MIG-1' },
          { code: 'OP-60', name: 'Tank shell / ring / pad weld', seq: 60, setup: 45, run: 480, machine: 'MC-TRL-MIG-2' },
        ],
      },
      {
        code: 'ST-ASSY',
        name: 'Final Assembly',
        order: 4,
        wc: 'WC-TRL-ASSY',
        ops: [
          {
            code: 'OP-70',
            name: 'Mount running gear, kingpin, landing legs',
            seq: 70,
            setup: 30,
            run: 300,
            machine: 'MC-TRL-ASSY-BAY',
          },
          {
            code: 'OP-80',
            name: 'Fit pneumatics, valves, manlid',
            seq: 80,
            setup: 20,
            run: 180,
            machine: 'MC-TRL-ASSY-BAY',
          },
        ],
      },
      {
        code: 'ST-PAINT',
        name: 'Surface Prep & Paint',
        order: 5,
        wc: 'WC-TRL-PAINT',
        ops: [
          { code: 'OP-90', name: 'Shot blast Sa 2.5', seq: 90, setup: 30, run: 180, machine: 'MC-TRL-BLAST' },
          { code: 'OP-100', name: 'Primer + PU topcoat', seq: 100, setup: 45, run: 360, machine: 'MC-TRL-SPRAY' },
        ],
      },
      {
        code: 'ST-QC',
        name: 'Final QC & Road Test',
        order: 6,
        wc: 'WC-TRL-QC',
        qualityRequired: true,
        ops: [
          { code: 'OP-110', name: 'Dimensional / dimensional / brake check', seq: 110, setup: 20, run: 90 },
          {
            code: 'OP-120',
            name: 'Road test & release documentation',
            seq: 120,
            setup: 15,
            run: 60,
            machine: 'MC-TRL-ROAD',
          },
        ],
      },
    ]

    for (const stage of stages) {
      const wcId = workCentreIds.get(stage.wc)
      if (!wcId) throw new Error(`WC ${stage.wc} missing`)
      const stageGroup = await prisma.manufacturingStageGroup.create({
        data: {
          tenantId,
          routingVersionId: version.id,
          code: stage.code,
          name: stage.name,
          displayOrder: stage.order,
          defaultWorkCentreId: wcId,
          qualityRequired: stage.qualityRequired ?? false,
          completionRule: 'ALL_OPERATIONS',
          createdBy: userId,
          updatedBy: userId,
        },
      })

      for (const op of stage.ops) {
        const opWc = op.wcOverride ? workCentreIds.get(op.wcOverride) ?? wcId : wcId
        const machineId = op.machine ? machineIds.get(op.machine) ?? null : null
        await prisma.manufacturingRoutingOperation.create({
          data: {
            tenantId,
            routingVersionId: version.id,
            stageGroupId: stageGroup.id,
            code: op.code,
            name: op.name,
            sequence: op.seq,
            workCentreId: opWc,
            defaultMachineId: machineId,
            setupTimeMinutes: op.setup,
            runTimeValue: op.run,
            runTimeBasis: 'PER_UNIT',
            inputType: 'MATERIAL',
            outputType: op.code === 'OP-120' ? 'FINISHED_GOOD' : 'SEMI_FINISHED',
            outputItemId: op.code === 'OP-120' ? productItemId : null,
            qualityRequired: stage.qualityRequired ?? false,
            createdBy: userId,
            updatedBy: userId,
          },
        })
      }
    }
    console.log(`  Routing ${ROUTING_CODE} v1 DRAFT created (${stages.length} stages)`)
  } else {
    console.log(`  Routing ${ROUTING_CODE} v1 exists (status=${version.status}) — skipped`)
  }

  if (version.status !== 'ACTIVE') {
    version = await prisma.manufacturingRoutingVersion.update({
      where: { id: version.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`  Routing ${ROUTING_CODE} v1 ACTIVATED`)
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
  const prodWh = warehouseIds.get('WIP_ASSEMBLY')
  const wipWh = warehouseIds.get('WIP_FABRICATION')
  const fgWh = warehouseIds.get('FG_YARD')
  const scrapWh = warehouseIds.get('QUARANTINE')
  const rmWh = warehouseIds.get('RM_STORE')
  if (!prodWh || !fgWh) throw new Error('Required warehouses missing for profile')

  const profile = await prisma.manufacturingProfile.upsert({
    where: { tenantId_code: { tenantId, code: PROFILE_CODE } },
    create: {
      tenantId,
      code: PROFILE_CODE,
      name: `${FG_NAME} Profile`,
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
      plantCode: 'AHMD',
      directProductionOrderAllowed: true,
      childProductionOrdersEnabled: true,
      subcontractingAllowed: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${FG_NAME} Profile`,
      productItemId,
      defaultBomVersionId: bomVersionId,
      defaultRoutingVersionId: routingVersionId,
      productionWarehouseId: prodWh,
      wipWarehouseId: wipWh ?? prodWh,
      finishedGoodsWarehouseId: fgWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: scrapWh ?? null,
      directProductionOrderAllowed: true,
      childProductionOrdersEnabled: true,
      deletedAt: null,
      isActive: true,
    },
  })

  // Prefer RM store as production issue warehouse when mapping exists later
  void rmWh
  console.log(`  Profile ${PROFILE_CODE} upserted (direct WO allowed)`)
  return profile
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (!tenant) {
    console.error(`Tenant not found: ${tenantSlug}`)
    process.exit(1)
  }
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  const userId = user?.id ?? null

  console.log(`Seeding ${FG_NAME} for tenant ${tenantSlug} (${tenant.id})`)
  const uomIds = await ensureUoms(tenant.id)
  console.log(`  UOMs: ${uomIds.size}`)
  const categoryIds = await ensureCategories(tenant.id)
  console.log(`  Categories: ${categoryIds.size}`)
  const warehouseIds = await ensureWarehouses(tenant.id, userId)
  console.log(`  Warehouses: ${warehouseIds.size}`)
  const workCentreIds = await ensureWorkCentres(tenant.id, userId)
  console.log(`  Work centres: ${workCentreIds.size}`)
  const machineIds = await ensureMachines(tenant.id, userId, workCentreIds)
  console.log(`  Machines: ${machineIds.size}`)
  const itemIds = await ensureItems(tenant.id, userId, categoryIds, uomIds)
  console.log(`  Items: ${itemIds.size}`)
  const fgId = itemIds.get(FG_CODE)
  if (!fgId) throw new Error('FG item missing after seed')

  const { version: bomVersion } = await ensureBom(tenant.id, userId, fgId, itemIds, uomIds)
  const { version: routingVersion } = await ensureRouting(
    tenant.id,
    userId,
    fgId,
    workCentreIds,
    machineIds,
  )
  await ensureProfile(tenant.id, userId, fgId, bomVersion.id, routingVersion.id, warehouseIds)

  console.log('\nDone. Direct WO path:')
  console.log(`  Item Master code: ${FG_CODE}`)
  console.log(`  Name:             ${FG_NAME}`)
  console.log(`  BOM:              ${BOM_CODE} (ACTIVE)`)
  console.log(`  Route:            ${ROUTING_CODE} (ACTIVE)`)
  console.log(`  Profile:          ${PROFILE_CODE}`)
  console.log(`  UI: /manufacturing/work-orders/new → search "${FG_NAME}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
