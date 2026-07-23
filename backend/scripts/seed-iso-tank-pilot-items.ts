/**
 * Controlled pilot item masters for 26 KL ISO Tank Container.
 *
 * Creates the minimal RM / BO / SFG / FG set with full item configuration:
 * code, name, category, base/purchase UOM, stockable, make/buy signals,
 * GST/HSN, tracking, default warehouse (via category), QC, active status.
 *
 * Safe to re-run (upsert by tenant+code).
 *
 * Usage:
 *   npx tsx scripts/seed-iso-tank-pilot-items.ts
 *   npx tsx scripts/seed-iso-tank-pilot-items.ts vasant-trailers
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

/** Prefer RM-MAIN / BO-MAIN so defaults match opening-stock checklist (Step 8). */
const WAREHOUSES = [
  { code: 'RM-MAIN', name: 'Raw Material Main Store', warehouseType: 'raw_material' },
  { code: 'BO-MAIN', name: 'Bought Out Main Store', warehouseType: 'bought_out' },
  { code: 'WIP_FABRICATION', name: 'WIP Fabrication', warehouseType: 'wip' },
  { code: 'FG_YARD', name: 'FG Yard', warehouseType: 'finished_goods' },
] as const

const UOMS = [
  { code: 'Nos', name: 'Numbers', uomType: 'integer', decimalPlaces: 0 },
  { code: 'KG', name: 'Kilogram', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'LTR', name: 'Litre', uomType: 'decimal', decimalPlaces: 3 },
  { code: 'SET', name: 'Set', uomType: 'integer', decimalPlaces: 0 },
] as const

/** Category → default warehouse for “default warehouse” on items in that category. */
const CATEGORIES = [
  { code: 'CAT-RM', name: 'Raw Material', warehouseCode: 'RM-MAIN' },
  { code: 'CAT-RM-PLATE', name: 'Plate', warehouseCode: 'RM-MAIN', parentCode: 'CAT-RM' },
  { code: 'CAT-RM-STRUCT', name: 'Structural Steel', warehouseCode: 'RM-MAIN', parentCode: 'CAT-RM' },
  { code: 'CAT-RM-CONS', name: 'Consumable', warehouseCode: 'RM-MAIN', parentCode: 'CAT-RM' },
  { code: 'CAT-BO', name: 'Bought Out', warehouseCode: 'BO-MAIN' },
  { code: 'CAT-SA', name: 'Sub Assembly', warehouseCode: 'WIP_FABRICATION' },
  { code: 'CAT-SA-TANK', name: 'Tank Assembly', warehouseCode: 'WIP_FABRICATION', parentCode: 'CAT-SA' },
  { code: 'CAT-FG', name: 'Finished Goods', warehouseCode: 'FG_YARD' },
  { code: 'CAT-FG-ISO', name: 'ISO Tank', warehouseCode: 'FG_YARD', parentCode: 'CAT-FG' },
] as const

const HSN_ROWS = [
  { code: '7208', description: 'Flat-rolled products of iron or non-alloy steel', gstGroupCode: 'GST18-GOODS' },
  { code: '7306', description: 'Other tubes, pipes and hollow profiles of iron or steel', gstGroupCode: 'GST18-GOODS' },
  { code: '8311', description: 'Wire, rods, tubes, plates, electrodes of base metal for welding', gstGroupCode: 'GST18-GOODS' },
  { code: '3208', description: 'Paints and varnishes based on synthetic polymers', gstGroupCode: 'GST18-GOODS' },
  { code: '7326', description: 'Other articles of iron or steel', gstGroupCode: 'GST18-GOODS' },
  { code: '8481', description: 'Taps, cocks, valves and similar appliances', gstGroupCode: 'GST18-GOODS' },
  { code: '4016', description: 'Other articles of vulcanised rubber', gstGroupCode: 'GST18-GOODS' },
  { code: '3926', description: 'Other articles of plastics', gstGroupCode: 'GST18-GOODS' },
  { code: '7318', description: 'Screws, bolts, nuts, coach screws, rivets, washers', gstGroupCode: 'GST18-GOODS' },
  { code: '8609', description: 'Containers specially designed for carriage by transport modes', gstGroupCode: 'GST18-GOODS' },
] as const

const PILOT_ITEMS: PilotItem[] = [
  // ── Raw materials ─────────────────────────────────────────────────────
  {
    code: 'RM-SA516-GR70',
    name: 'SA516 Gr70 Plate',
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
    materialGrade: 'SA 516 Gr 70',
    productType: 'raw_material',
    description: 'Pilot RM — pressure vessel plate for 26 KL ISO tank shell / dish',
    standardRate: 85,
  },
  {
    code: 'RM-RHS-SECTION',
    name: 'RHS Section',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7306',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    materialGrade: 'YST 310 / IS 2062 E350',
    productType: 'raw_material',
    description: 'Pilot RM — rectangular hollow section for ISO frame',
    standardRate: 72,
  },
  {
    code: 'RM-SHS-SECTION',
    name: 'SHS Section',
    itemType: 'raw',
    categoryCode: 'CAT-RM-STRUCT',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7306',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    materialGrade: 'YST 310 / IS 2062 E350',
    productType: 'raw_material',
    description: 'Pilot RM — square hollow section for ISO frame posts',
    standardRate: 72,
  },
  {
    code: 'RM-WELD-WIRE',
    name: 'Welding Wire',
    itemType: 'consumable',
    categoryCode: 'CAT-RM',
    baseUomCode: 'KG',
    purchaseUomCode: 'KG',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '8311',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: false,
    materialGrade: 'ER 70S-6',
    productType: 'raw_material',
    description: 'Pilot consumable — MIG / SAW welding wire',
    standardRate: 180,
  },
  {
    code: 'RM-PRIMER-PAINT',
    name: 'Primer Paint',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'LTR',
    purchaseUomCode: 'LTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '3208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    productType: 'raw_material',
    description: 'Pilot consumable — epoxy zinc-rich primer',
    standardRate: 420,
  },
  {
    code: 'RM-TOPCOAT-PAINT',
    name: 'Topcoat Paint',
    itemType: 'consumable',
    categoryCode: 'CAT-RM-CONS',
    baseUomCode: 'LTR',
    purchaseUomCode: 'LTR',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '3208',
    tracking: 'BATCH',
    defaultWarehouseCode: 'RM-MAIN',
    qcRequired: true,
    productType: 'raw_material',
    description: 'Pilot consumable — polyurethane topcoat',
    standardRate: 560,
  },

  // ── Bought-out ────────────────────────────────────────────────────────
  {
    code: 'BO-CORNER-CASTING',
    name: 'Corner Casting',
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
    description: 'Pilot BO — ISO 1161 corner casting',
    standardRate: 3500,
  },
  {
    code: 'BO-VALVE',
    name: 'Valve',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '8481',
    tracking: 'SERIAL',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: true,
    materialGrade: 'SS 316',
    productType: 'bought_out',
    description: 'Pilot BO — process valve for ISO tank fittings',
    standardRate: 18500,
  },
  {
    code: 'BO-GASKET',
    name: 'Gasket',
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
    materialGrade: 'PTFE',
    productType: 'bought_out',
    description: 'Pilot BO — PTFE envelope gasket',
    standardRate: 450,
  },
  {
    code: 'BO-DOC-HOLDER',
    name: 'Document Holder',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '3926',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: false,
    productType: 'bought_out',
    description: 'Pilot BO — plastic document holder',
    standardRate: 280,
  },
  {
    code: 'BO-FASTENERS',
    name: 'Fasteners',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'BUY',
    hsnCode: '7318',
    tracking: 'NONE',
    defaultWarehouseCode: 'BO-MAIN',
    qcRequired: false,
    productType: 'bought_out',
    description: 'Pilot BO — miscellaneous fastener lot (counted in Nos)',
    standardRate: 15,
  },

  // ── Semi-finished (MAKE) ──────────────────────────────────────────────
  {
    code: 'SA-TANK-SHELL',
    name: 'Tank Shell Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA-TANK',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '8609',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP_FABRICATION',
    qcRequired: true,
    materialGrade: 'SA 516 Gr 70',
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Pilot SFG — tank shell / pressure vessel assembly',
    standardRate: 850000,
  },
  {
    code: 'SA-FRAME',
    name: 'Frame Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '8609',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP_FABRICATION',
    qcRequired: true,
    materialGrade: 'YST 310',
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Pilot SFG — ISO frame with corner castings',
    standardRate: 420000,
  },
  {
    code: 'SA-VALVE-PIPING',
    name: 'Valve and Piping Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '8481',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP_FABRICATION',
    qcRequired: true,
    materialGrade: 'SS 316',
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Pilot SFG — valve and piping kit assembly',
    standardRate: 95000,
  },
  {
    code: 'SA-WALKWAY',
    name: 'Walkway Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '7326',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP_FABRICATION',
    qcRequired: true,
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Pilot SFG — walkway / grating assembly',
    standardRate: 65000,
  },
  {
    code: 'SA-LADDER',
    name: 'Ladder Assembly',
    itemType: 'sub_assembly',
    categoryCode: 'CAT-SA',
    baseUomCode: 'SET',
    purchaseUomCode: 'SET',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '7326',
    tracking: 'NONE',
    defaultWarehouseCode: 'WIP_FABRICATION',
    qcRequired: true,
    materialGrade: 'SS 304',
    productType: 'semi_finished',
    subAssemblyRule: 'manufactured',
    description: 'Pilot SFG — ladder assembly',
    standardRate: 28000,
  },

  // ── Finished good ─────────────────────────────────────────────────────
  {
    code: 'FG-ISO-TANK-26K',
    name: '26 KL ISO Tank Container',
    itemType: 'finished_good',
    categoryCode: 'CAT-FG-ISO',
    baseUomCode: 'Nos',
    purchaseUomCode: 'Nos',
    stockable: true,
    makeBuy: 'MAKE',
    hsnCode: '8609',
    tracking: 'SERIAL',
    defaultWarehouseCode: 'FG_YARD',
    qcRequired: true,
    productType: 'finish_product',
    description: 'Pilot FG — 26 KL ISO tank container (ASME VIII / CSC / ISO 1496-3)',
    standardRate: 4200000,
  },
]

async function resolveUomId(tenantId: string, code: string, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(code) ?? cache.get(code.toUpperCase()) ?? cache.get(code === 'Nos' ? 'NOS' : code)
  if (hit) return hit
  const aliases = code === 'Nos' ? ['Nos', 'NOS', 'nos'] : [code, code.toUpperCase()]
  for (const alias of aliases) {
    const row = await prisma.masterUom.findFirst({
      where: { tenantId, code: alias, deletedAt: null },
    })
    if (row) {
      cache.set(code, row.id)
      cache.set(alias, row.id)
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

  console.log(`Seeding ISO tank pilot items for "${tenant.name}" (${tenant.slug})…`)

  // Warehouses
  const warehouseIds = new Map<string, string>()
  for (const w of WAREHOUSES) {
    const row = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: w.code } },
      create: {
        tenantId: tenant.id,
        code: w.code,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: 'AHMD',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        name: w.name,
        warehouseType: w.warehouseType,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    warehouseIds.set(w.code, row.id)
  }
  console.log(`✓ Warehouses: ${warehouseIds.size}`)

  // UOMs
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
  console.log(`✓ UOMs: ${UOMS.length}`)

  // Categories (+ default warehouse)
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

  // GST group + HSN
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
  console.log(`✓ HSN codes: ${hsnIds.size}`)

  // Items
  let created = 0
  for (const item of PILOT_ITEMS) {
    const categoryId = categoryIds.get(item.categoryCode)
    if (!categoryId) throw new Error(`Category missing: ${item.categoryCode}`)
    const baseUomId = await resolveUomId(tenant.id, item.baseUomCode, uomCache)
    const purchaseUomId = await resolveUomId(tenant.id, item.purchaseUomCode, uomCache)
    const hsnId = hsnIds.get(item.hsnCode) ?? null
    const defaultWh = warehouseIds.get(item.defaultWarehouseCode)
    if (!defaultWh) throw new Error(`Warehouse missing: ${item.defaultWarehouseCode}`)

    // Keep category default warehouse aligned with item expectation
    await prisma.masterItemCategory.update({
      where: { id: categoryId },
      data: { defaultWarehouseId: defaultWh },
    })

    const isPurchasable = item.makeBuy === 'BUY'
    const batchTracked = item.tracking === 'BATCH'
    const serialTracked = item.tracking === 'SERIAL'

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
        isPurchasable,
        isStockable: item.stockable,
        batchTracked,
        serialTracked,
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
        purchaseQtyPerUom: 1,
        itemType: item.itemType,
        productType: item.productType ?? null,
        materialGrade: item.materialGrade ?? '',
        hsnCode: item.hsnCode,
        hsnId,
        gstGroupId: gstGroup.id,
        isPurchasable,
        isStockable: item.stockable,
        batchTracked,
        serialTracked,
        qcRequired: item.qcRequired,
        subAssemblyRule: item.subAssemblyRule ?? null,
        standardRate: item.standardRate ?? 0,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    created += 1
    const track =
      item.tracking === 'NONE' ? 'none' : item.tracking === 'BATCH' ? 'batch' : 'serial'
    console.log(
      `  · ${item.code.padEnd(22)} ${item.makeBuy.padEnd(4)} ${item.itemType.padEnd(14)} wh=${item.defaultWarehouseCode.padEnd(16)} track=${track.padEnd(6)} qc=${item.qcRequired ? 'Y' : 'N'}`,
    )
  }

  console.log(`\n✓ Pilot items upserted: ${created}`)
  console.log(`UI: /masters/items  ·  FG: FG-ISO-TANK-26K`)
  console.log(`Note: make/buy is stored as isPurchasable + itemType/subAssemblyRule (no separate item column).`)
  console.log(`Note: default warehouse is on item category (defaultWarehouseId).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
