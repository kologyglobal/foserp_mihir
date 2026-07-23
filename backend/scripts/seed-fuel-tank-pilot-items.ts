/**
 * Fuel Tank (5000 L) pilot item masters — live API / DB seed (not demo FE).
 *
 * Creates FG / SFG / RM / BO / Consumable items with UOM, tracking, QC flags.
 * Safe to re-run (upsert by tenant+code).
 *
 * Usage:
 *   npx tsx scripts/seed-fuel-tank-pilot-items.ts
 *   npx tsx scripts/seed-fuel-tank-pilot-items.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

type ItemType = 'raw' | 'bought_out' | 'consumable' | 'sub_assembly' | 'finished_good'
type MakeBuy = 'MAKE' | 'BUY'
type Tracking = 'NONE' | 'BATCH' | 'SERIAL'

interface PilotItem {
  code: string
  name: string
  itemType: ItemType
  categoryCode: string
  baseUomCode: string
  purchaseUomCode: string
  stockable: boolean
  makeBuy: MakeBuy
  hsnCode: string
  tracking: Tracking
  defaultWarehouseCode: string
  qcRequired: boolean
  materialGrade?: string
  description?: string
  productType?: string
  subAssemblyRule?: 'manufactured' | 'purchased' | 'phantom' | 'subcontracted'
  standardRate?: number
}

const WAREHOUSES = [
  { code: 'RM-MAIN', name: 'Raw Material Main Store', warehouseType: 'raw_material' },
  { code: 'BO-MAIN', name: 'Bought Out Main Store', warehouseType: 'bought_out' },
  { code: 'RM-CONSUMABLES', name: 'Consumables Store', warehouseType: 'raw_material' },
  { code: 'WIP', name: 'WIP Warehouse', warehouseType: 'wip' },
  { code: 'FG-MAIN', name: 'Finished Goods Main', warehouseType: 'finished_goods' },
  { code: 'QC-HOLD', name: 'QC Hold', warehouseType: 'quarantine' },
  { code: 'SCRAP', name: 'Scrap Yard', warehouseType: 'scrap' },
  { code: 'JOB-WORK', name: 'Job Work Warehouse', warehouseType: 'wip' },
] as const

const UOMS = [
  { code: 'Nos', name: 'Numbers', uomType: 'integer', decimalPlaces: 0 },
  { code: 'KG', name: 'Kilogram', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'LTR', name: 'Litre', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'SET', name: 'Set', uomType: 'integer', decimalPlaces: 0 },
  { code: 'MTR', name: 'Metre', uomType: 'decimal', decimalPlaces: 3 },
] as const

const CATEGORIES = [
  { code: 'CAT-RM', name: 'Raw Material', warehouseCode: 'RM-MAIN' },
  { code: 'CAT-RM-PLATE', name: 'Plate', warehouseCode: 'RM-MAIN', parentCode: 'CAT-RM' },
  { code: 'CAT-RM-STRUCT', name: 'Structural Steel', warehouseCode: 'RM-MAIN', parentCode: 'CAT-RM' },
  { code: 'CAT-RM-PIPE', name: 'Pipe', warehouseCode: 'RM-MAIN', parentCode: 'CAT-RM' },
  { code: 'CAT-RM-CONS', name: 'Consumable', warehouseCode: 'RM-CONSUMABLES', parentCode: 'CAT-RM' },
  { code: 'CAT-BO', name: 'Bought Out', warehouseCode: 'BO-MAIN' },
  { code: 'CAT-SA', name: 'Sub Assembly', warehouseCode: 'WIP' },
  { code: 'CAT-SA-FUEL', name: 'Fuel Tank Assembly', warehouseCode: 'WIP', parentCode: 'CAT-SA' },
  { code: 'CAT-FG', name: 'Finished Goods', warehouseCode: 'FG-MAIN' },
  { code: 'CAT-FG-FUEL', name: 'Fuel Tank FG', warehouseCode: 'FG-MAIN', parentCode: 'CAT-FG' },
] as const

const HSN_ROWS = [
  { code: '7208', description: 'Flat-rolled products of iron or non-alloy steel' },
  { code: '7216', description: 'Angles, shapes and sections of iron or non-alloy steel' },
  { code: '7306', description: 'Other tubes, pipes and hollow profiles of iron or steel' },
  { code: '8311', description: 'Welding electrodes / wire' },
  { code: '3208', description: 'Paints and varnishes' },
  { code: '2811', description: 'Other inorganic compounds (CO2 / industrial gases)' },
  { code: '7326', description: 'Other articles of iron or steel' },
  { code: '8481', description: 'Taps, cocks, valves' },
  { code: '4016', description: 'Articles of vulcanised rubber' },
  { code: '9026', description: 'Instruments for measuring flow/level' },
  { code: '7318', description: 'Screws, bolts, nuts, washers' },
  { code: '7309', description: 'Reservoirs, tanks of iron or steel' },
] as const

const PILOT_ITEMS: PilotItem[] = [
  // ── Finished good ─────────────────────────────────────────────────────
  {
    code: 'FG-FUEL-TANK-5000L',
    name: '5000 Litre Mild Steel Fuel Storage Tank',
    itemType: 'finished_good',
    categoryCode: 'CAT-FG-FUEL',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '7309',
    tracking: 'SERIAL',
    defaultWarehouseCode: 'FG-MAIN',
    qcRequired: true,
    materialGrade: 'IS 2062 E250/E350',
    productType: 'finish_product',
    description:
      'Horizontal cylindrical 5000 L MS fuel tank — shell 6 mm, ends 8 mm, hydro/leak + final inspection',
    standardRate: 450000,
  },

  // ── Semi-finished (LOGICAL WIP under FG WO — no independent SFG WO) ───
  {
    code: 'SFG-TANK-SHELL-5000L',
    name: 'Tank Shell Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-FUEL',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: false,
    makeBuy: 'MAKE',
    hsnCode: '7309',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP',
    qcRequired: true,
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: '5000 L shell — cut, roll, longitudinal weld',
    standardRate: 85000,
  },
  {
    code: 'SFG-DISHED-END-5000L',
    name: 'Dished End Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-FUEL',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: false,
    makeBuy: 'MAKE',
    hsnCode: '7309',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP',
    qcRequired: true,
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Dished end — cut + hydraulic form (2 per tank)',
    standardRate: 28000,
  },
  {
    code: 'SFG-SADDLE-SUPPORT-5000L',
    name: 'Saddle Support Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-FUEL',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: false,
    makeBuy: 'MAKE',
    hsnCode: '7326',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP',
    qcRequired: true,
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Pair of saddle supports for horizontal tank',
    standardRate: 18000,
  },
  {
    code: 'SFG-NOZZLE-MANHOLE-5000L',
    name: 'Nozzle and Manhole Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-FUEL',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: false,
    makeBuy: 'MAKE',
    hsnCode: '7306',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP',
    qcRequired: true,
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Manhole, nozzles, valves, vent, level gauge set',
    standardRate: 42000,
  },
  {
    code: 'SFG-FINAL-TANK-ASSY-5000L',
    name: 'Final Tank Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-FUEL',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: false,
    makeBuy: 'MAKE',
    hsnCode: '7309',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP',
    qcRequired: true,
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Shell + ends + saddle + nozzle fitment before test/paint',
    standardRate: 220000,
  },

  // ── Raw materials ─────────────────────────────────────────────────────
  {
    code: 'RM-MS-PLATE-006',
    name: 'MS Plate 6 mm IS 2062',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    materialGrade: 'IS 2062 E250/E350',
    productType: 'raw_material',
    description: 'Shell plate 6 mm — heat/lot tracked',
    standardRate: 68,
  },
  {
    code: 'RM-MS-PLATE-008',
    name: 'MS Plate 8 mm IS 2062',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    materialGrade: 'IS 2062 E250/E350',
    productType: 'raw_material',
    description: 'End plate 8 mm — heat/lot tracked',
    standardRate: 70,
  },
  {
    code: 'RM-MS-PLATE-010',
    name: 'MS Plate 10 mm IS 2062',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PLATE',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    materialGrade: 'IS 2062 E250/E350',
    productType: 'raw_material',
    description: 'Saddle plate 10 mm',
    standardRate: 72,
  },
  {
    code: 'RM-MS-ANGLE-50X50X6',
    name: 'MS Angle 50×50×6',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7216',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: false,
    materialGrade: 'IS 2062',
    productType: 'raw_material',
    standardRate: 65,
  },
  {
    code: 'RM-MS-PIPE-DN50',
    name: 'MS Pipe DN50',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PIPE',
    baseUomCode: 'MTR',
    purchaseUomCode: 'MTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7306',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: false,
    productType: 'raw_material',
    standardRate: 420,
  },
  {
    code: 'RM-MS-PIPE-DN25',
    name: 'MS Pipe DN25',
    itemType: 'raw',
    categoryCode: 'CAT-RM-PIPE',
    baseUomCode: 'MTR',
    purchaseUomCode: 'MTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7306',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: false,
    productType: 'raw_material',
    standardRate: 210,
  },

  // ── Bought-out ────────────────────────────────────────────────────────
  {
    code: 'BO-MANHOLE-COVER-450',
    name: '450 mm Manhole Cover',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7326',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: true,
    productType: 'bought_out',
    standardRate: 8500,
  },
  {
    code: 'BO-BALL-VALVE-DN50',
    name: 'DN50 Ball Valve',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '8481',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: true,
    productType: 'bought_out',
    standardRate: 3200,
  },
  {
    code: 'BO-DRAIN-VALVE-DN25',
    name: 'DN25 Drain Valve',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '8481',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: true,
    productType: 'bought_out',
    standardRate: 1800,
  },
  {
    code: 'BO-VENT-CAP',
    name: 'Fuel Tank Vent Cap',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7326',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: false,
    productType: 'bought_out',
    standardRate: 650,
  },
  {
    code: 'BO-GASKET-MANHOLE-450',
    name: '450 mm Manhole Gasket',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '4016',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: false,
    productType: 'bought_out',
    standardRate: 420,
  },
  {
    code: 'BO-LEVEL-GAUGE',
    name: 'Mechanical Level Gauge',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '9026',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: true,
    productType: 'bought_out',
    standardRate: 5500,
  },

  // ── Consumables ───────────────────────────────────────────────────────
  {
    code: 'CON-WELD-E7018',
    name: 'E7018 Welding Electrode',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '8311',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: false,
    materialGrade: 'E7018',
    productType: 'raw_material',
    standardRate: 145,
  },
  {
    code: 'CON-WELD-ER70S6',
    name: 'ER70S-6 Welding Wire',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '8311',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: false,
    materialGrade: 'ER70S-6',
    productType: 'raw_material',
    standardRate: 180,
  },
  {
    code: 'CON-GAS-CO2',
    name: 'CO2/Shielding Gas',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '2811',
    tracking: 'NONE',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: false,
    productType: 'raw_material',
    standardRate: 45,
  },
  {
    code: 'CON-PAINT-EPOXY-PRIMER',
    name: 'Epoxy Primer',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'LTR',
    purchaseUomCode: 'LTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '3208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: true,
    productType: 'raw_material',
    standardRate: 420,
  },
  {
    code: 'CON-PAINT-PU-TOPCOAT',
    name: 'PU Topcoat',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'LTR',
    purchaseUomCode: 'LTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '3208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: true,
    productType: 'raw_material',
    standardRate: 560,
  },
  {
    code: 'CON-THINNER',
    name: 'Paint Thinner',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'LTR',
    purchaseUomCode: 'LTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '3208',
    tracking: 'NONE',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: false,
    productType: 'raw_material',
    standardRate: 95,
  },
  {
    code: 'CON-FASTENER-MISC',
    name: 'Tank Fastener Set',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7318',
    tracking: 'NONE',
    defaultWarehouseCode: 'RM-CONSUMABLES',
    qcRequired: false,
    productType: 'raw_material',
    standardRate: 1200,
  },
]

async function resolveUomId(tenantId: string, code: string, cache: Map<string, string>): Promise<string> {
  const aliases =
    code === 'Nos' || code.toUpperCase() === 'NOS'
      ? ['Nos', 'NOS', 'nos']
      : [code, code.toUpperCase()]
  for (const alias of aliases) {
    const hit = cache.get(alias)
    if (hit) return hit
  }
  for (const alias of aliases) {
    const row = await prisma.masterUom.findFirst({
      where: { tenantId, code: alias, deletedAt: null },
    })
    if (row) {
      for (const a of aliases) cache.set(a, row.id)
      return row.id
    }
  }
  throw new Error(`UOM not found: ${code}`)
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  })
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const userId = admin?.id ?? null

  console.log(`\n=== Fuel Tank pilot items (${tenant.slug}) ===\n`)

  const plant = await prisma.masterPlant.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN-PLANT' } },
    create: {
      tenantId: tenant.id,
      code: 'MAIN-PLANT',
      name: 'Main Plant',
      status: 'ACTIVE',
      createdBy: userId,
      updatedBy: userId,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Main Plant', updatedBy: userId },
  })

  const warehouseIds = new Map<string, string>()
  for (const w of WAREHOUSES) {
    const row = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: w.code } },
      create: {
        tenantId: tenant.id,
        plantId: plant.id,
        code: w.code,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: 'MAIN-PLANT',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        plantId: plant.id,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: 'MAIN-PLANT',
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    warehouseIds.set(w.code, row.id)
  }
  console.log(`✓ Warehouses: ${[...warehouseIds.keys()].join(', ')}`)

  const uomCache = new Map<string, string>()
  for (const u of UOMS) {
    const row = await prisma.masterUom.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: u.code } },
      create: {
        tenantId: tenant.id,
        code: u.code,
        name: u.name,
        uomType: u.uomType,
        decimalPlaces: u.decimalPlaces,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: u.name,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    uomCache.set(u.code, row.id)
    uomCache.set(u.code.toUpperCase(), row.id)
  }
  console.log(`✓ UOMs: ${UOMS.map((u) => u.code).join(', ')}`)

  const categoryIds = new Map<string, string>()
  for (const c of CATEGORIES) {
    const parentId = 'parentCode' in c && c.parentCode ? categoryIds.get(c.parentCode) ?? null : null
    const defaultWarehouseId = warehouseIds.get(c.warehouseCode) ?? null
    const row = await prisma.masterItemCategory.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: c.code } },
      create: {
        tenantId: tenant.id,
        code: c.code,
        name: c.name,
        parentId,
        level: parentId ? 2 : 1,
        defaultWarehouseId,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: c.name,
        parentId,
        defaultWarehouseId,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    categoryIds.set(c.code, row.id)
  }
  console.log(`✓ Categories: ${categoryIds.size}`)

  let gstGroup = await prisma.masterGstGroup.findFirst({
    where: { tenantId: tenant.id, code: 'GST18-GOODS', deletedAt: null },
  })
  if (!gstGroup) {
    gstGroup = await prisma.masterGstGroup.create({
      data: {
        tenantId: tenant.id,
        code: 'GST18-GOODS',
        goodsType: 'goods',
        description: 'GST 18% Goods',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
    })
  }

  const hsnIds = new Map<string, string>()
  for (const h of HSN_ROWS) {
    const row = await prisma.masterHsnCode.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: h.code } },
      create: {
        tenantId: tenant.id,
        code: h.code,
        gstGroupId: gstGroup.id,
        description: h.description,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        description: h.description,
        gstGroupId: gstGroup.id,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    hsnIds.set(h.code, row.id)
  }

  let created = 0
  for (const item of PILOT_ITEMS) {
    const categoryId = categoryIds.get(item.categoryCode)
    if (!categoryId) throw new Error(`Category missing: ${item.categoryCode}`)
    const baseUomId = await resolveUomId(tenant.id, item.baseUomCode, uomCache)
    const purchaseUomId = await resolveUomId(tenant.id, item.purchaseUomCode, uomCache)
    const hsnId = hsnIds.get(item.hsnCode) ?? null
    const defaultWh = warehouseIds.get(item.defaultWarehouseCode)
    if (!defaultWh) throw new Error(`Warehouse missing: ${item.defaultWarehouseCode}`)

    await prisma.masterItemCategory.update({
      where: { id: categoryId },
      data: { defaultWarehouseId: defaultWh },
    })

    await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: item.code } },
      create: {
        tenantId: tenant.id,
        code: item.code,
        name: item.name,
        itemDescription: item.description ?? item.name,
        categoryId,
        baseUomId,
        purchaseUomId,
        purchaseQtyPerUom: 1,
        quantityPerUom: 1,
        itemType: item.itemType,
        productType: item.productType ?? null,
        inventoryType: 'inventory',
        materialGrade: item.materialGrade ?? '',
        hsnCode: item.hsnCode,
        hsnId,
        gstGroupId: gstGroup.id,
        isPurchasable: item.makeBuy === 'BUY',
        isStockable: item.stockable,
        batchTracked: item.tracking === 'BATCH',
        serialTracked: item.tracking === 'SERIAL',
        qcRequired: item.qcRequired,
        subAssemblyRule: item.subAssemblyRule ?? null,
        standardRate: item.standardRate ?? 0,
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: item.name,
        itemDescription: item.description ?? item.name,
        categoryId,
        baseUomId,
        purchaseUomId,
        itemType: item.itemType,
        productType: item.productType ?? null,
        materialGrade: item.materialGrade ?? '',
        hsnCode: item.hsnCode,
        hsnId,
        gstGroupId: gstGroup.id,
        isPurchasable: item.makeBuy === 'BUY',
        isStockable: item.stockable,
        batchTracked: item.tracking === 'BATCH',
        serialTracked: item.tracking === 'SERIAL',
        qcRequired: item.qcRequired,
        subAssemblyRule: item.subAssemblyRule ?? null,
        standardRate: item.standardRate ?? 0,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    created += 1
    console.log(
      `  · ${item.code.padEnd(28)} ${item.makeBuy.padEnd(4)} ${item.itemType.padEnd(14)} ${item.baseUomCode.padEnd(4)} track=${item.tracking}`,
    )
  }

  console.log(`\n✓ Fuel tank items upserted: ${created}`)
  console.log(`FG: FG-FUEL-TANK-5000L  ·  Next: npx tsx scripts/seed-fuel-tank-mfg-setup.ts ${tenantSlug}\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
