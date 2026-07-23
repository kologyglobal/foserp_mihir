/**
 * ISO tank Manufacturing setup (correct order):
 *   Work Centre → Machine → BOM → Route → Manufacturing Profile
 *   + per MAKE SA: minimal BOM → Route → Profile (so child WOs generate on release)
 *
 * Uses pilot items from seed-iso-tank-pilot-items.ts (FG-ISO-TANK-26K + SA/RM/BO).
 * Idempotent by tenant+code. BOM + routing v1 activated (Certified = ACTIVE).
 *
 * Note: `stockedSemiFinished` on FG BOM lines does NOT skip child WOs — only
 * `childProductionOrderRequired=false` (or missing SA profile/BOM/route) does.
 * Pilot keeps both flags true: SAs may be stocked OR made via child WO.
 *
 * Usage:
 *   npx tsx scripts/seed-iso-tank-pilot-items.ts   # if items missing
 *   npx tsx scripts/seed-iso-tank-mfg-setup.ts
 *   npx tsx scripts/seed-iso-tank-mfg-setup.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

const FG_CODE = 'FG-ISO-TANK-26K'
const FG_NAME = '26 KL ISO Tank Container'
const BOM_CODE = 'BOM-ISO-TANK-26K'
const ROUTING_CODE = 'RT-ISO-TANK-26K'
const PROFILE_CODE = 'PROF-ISO-TANK-26K'

type LineType = 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'CONSUMABLE' | 'SUBASSEMBLY'
type MakeOrBuy = 'MAKE' | 'BUY'

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
  childProductionOrderRequired?: boolean
  stockedSemiFinished?: boolean
}

const WORK_CENTRES = [
  { code: 'WC-ISO-CUT', name: 'Cutting Shop', departmentRef: 'FABRICATION' },
  { code: 'WC-ISO-FORM', name: 'Forming Shop', departmentRef: 'FABRICATION' },
  { code: 'WC-ISO-WELD', name: 'Welding Shop', departmentRef: 'WELDING' },
  { code: 'WC-ISO-ASSY', name: 'Assembly Shop', departmentRef: 'ASSEMBLY' },
  { code: 'WC-ISO-PAINT', name: 'Paint Shop', departmentRef: 'SURFACE' },
  { code: 'WC-ISO-QC', name: 'Quality Bay', departmentRef: 'QUALITY' },
] as const

const MACHINES: Array<{ code: string; name: string; workCentreCode: string }> = [
  { code: 'MC-ISO-CNC-PLASMA', name: 'CNC Plasma Cutter', workCentreCode: 'WC-ISO-CUT' },
  { code: 'MC-ISO-SHELL-ROLL', name: 'Shell Rolling Machine', workCentreCode: 'WC-ISO-FORM' },
  { code: 'MC-ISO-SAW', name: 'SAW Machine', workCentreCode: 'WC-ISO-WELD' },
  { code: 'MC-ISO-MIG', name: 'MIG Welding Station', workCentreCode: 'WC-ISO-WELD' },
  { code: 'MC-ISO-ASSY-BAY', name: 'Final Assembly Bay Crane', workCentreCode: 'WC-ISO-ASSY' },
  { code: 'MC-ISO-SPRAY', name: 'Paint Spray Booth', workCentreCode: 'WC-ISO-PAINT' },
]

const WAREHOUSES = [
  { code: 'RM-MAIN', name: 'Raw Material Main Store', warehouseType: 'raw_material' },
  { code: 'BO-MAIN', name: 'Bought Out Main Store', warehouseType: 'bought_out' },
  { code: 'WIP_FABRICATION', name: 'WIP Fabrication', warehouseType: 'wip' },
  { code: 'FG_YARD', name: 'FG Yard', warehouseType: 'finished_goods' },
  { code: 'QC_HOLD', name: 'QC Hold', warehouseType: 'quarantine' },
  { code: 'SCRAP', name: 'Scrap Yard', warehouseType: 'scrap' },
] as const

/**
 * Multilevel BOM:
 * FG
 * ├── SA (MAKE) → RM + BO children
 * └── Consumables (L1)
 */
const BOM_NODES: BomNode[] = [
  // L1 — semi-finished
  {
    ref: 'L1-SHELL',
    parentRef: null,
    itemCode: 'SA-TANK-SHELL',
    qty: 1,
    uomCode: 'SET',
    sequence: 10,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    childProductionOrderRequired: true,
    stockedSemiFinished: true,
    notes: 'Tank shell assembly',
  },
  {
    ref: 'L1-FRAME',
    parentRef: null,
    itemCode: 'SA-FRAME',
    qty: 1,
    uomCode: 'SET',
    sequence: 20,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    childProductionOrderRequired: true,
    stockedSemiFinished: true,
  },
  {
    ref: 'L1-VALVE',
    parentRef: null,
    itemCode: 'SA-VALVE-PIPING',
    qty: 1,
    uomCode: 'SET',
    sequence: 30,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    childProductionOrderRequired: true,
    stockedSemiFinished: true,
  },
  {
    ref: 'L1-WALK',
    parentRef: null,
    itemCode: 'SA-WALKWAY',
    qty: 1,
    uomCode: 'SET',
    sequence: 40,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    childProductionOrderRequired: true,
    stockedSemiFinished: true,
  },
  {
    ref: 'L1-LADDER',
    parentRef: null,
    itemCode: 'SA-LADDER',
    qty: 1,
    uomCode: 'SET',
    sequence: 50,
    makeOrBuy: 'MAKE',
    lineType: 'SUBASSEMBLY',
    childProductionOrderRequired: true,
    stockedSemiFinished: true,
  },
  // L1 — consumables
  {
    ref: 'L1-WIRE',
    parentRef: null,
    itemCode: 'RM-WELD-WIRE',
    qty: 25,
    uomCode: 'KG',
    sequence: 60,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
  {
    ref: 'L1-PRIMER',
    parentRef: null,
    itemCode: 'RM-PRIMER-PAINT',
    qty: 40,
    uomCode: 'LTR',
    sequence: 70,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
  {
    ref: 'L1-TOPCOAT',
    parentRef: null,
    itemCode: 'RM-TOPCOAT-PAINT',
    qty: 30,
    uomCode: 'LTR',
    sequence: 80,
    makeOrBuy: 'BUY',
    lineType: 'CONSUMABLE',
  },
  // L2 under shell
  {
    ref: 'L2-SHELL-PLATE',
    parentRef: 'L1-SHELL',
    itemCode: 'RM-SA516-GR70',
    qty: 1200,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L2-SHELL-FAST',
    parentRef: 'L1-SHELL',
    itemCode: 'BO-FASTENERS',
    qty: 40,
    uomCode: 'Nos',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // L2 under frame
  {
    ref: 'L2-FRAME-RHS',
    parentRef: 'L1-FRAME',
    itemCode: 'RM-RHS-SECTION',
    qty: 800,
    uomCode: 'KG',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L2-FRAME-SHS',
    parentRef: 'L1-FRAME',
    itemCode: 'RM-SHS-SECTION',
    qty: 600,
    uomCode: 'KG',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'RAW_MATERIAL',
  },
  {
    ref: 'L2-FRAME-CORNER',
    parentRef: 'L1-FRAME',
    itemCode: 'BO-CORNER-CASTING',
    qty: 8,
    uomCode: 'Nos',
    sequence: 30,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // L2 under valve piping
  {
    ref: 'L2-VALVE',
    parentRef: 'L1-VALVE',
    itemCode: 'BO-VALVE',
    qty: 4,
    uomCode: 'Nos',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L2-GASKET',
    parentRef: 'L1-VALVE',
    itemCode: 'BO-GASKET',
    qty: 8,
    uomCode: 'Nos',
    sequence: 20,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  // L2 under walkway / ladder
  {
    ref: 'L2-WALK-FAST',
    parentRef: 'L1-WALK',
    itemCode: 'BO-FASTENERS',
    qty: 20,
    uomCode: 'Nos',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
  {
    ref: 'L2-LADDER-DOC',
    parentRef: 'L1-LADDER',
    itemCode: 'BO-DOC-HOLDER',
    qty: 1,
    uomCode: 'Nos',
    sequence: 10,
    makeOrBuy: 'BUY',
    lineType: 'BOUGHT_OUT',
  },
]

/** MAKE SAs that need their own ACTIVE BOM + Route + Profile for child WOs. */
interface SaMfgSetup {
  itemCode: string
  name: string
  bomCode: string
  routingCode: string
  profileCode: string
  workCentreCode: string
  machineCode?: string
  opName: string
  /** Flat BOM lines (L2 materials under this SA in the FG multilevel BOM). */
  lines: Array<{
    itemCode: string
    qty: number
    uomCode: string
    sequence: number
    lineType: LineType
  }>
}

const SA_MFG_SETUPS: SaMfgSetup[] = [
  {
    itemCode: 'SA-TANK-SHELL',
    name: 'Tank Shell Assembly',
    bomCode: 'BOM-SA-TANK-SHELL',
    routingCode: 'RT-SA-TANK-SHELL',
    profileCode: 'PROF-SA-TANK-SHELL',
    workCentreCode: 'WC-ISO-FORM',
    machineCode: 'MC-ISO-SHELL-ROLL',
    opName: 'Form & weld tank shell',
    lines: [
      { itemCode: 'RM-SA516-GR70', qty: 1200, uomCode: 'KG', sequence: 10, lineType: 'RAW_MATERIAL' },
      { itemCode: 'BO-FASTENERS', qty: 40, uomCode: 'Nos', sequence: 20, lineType: 'BOUGHT_OUT' },
    ],
  },
  {
    itemCode: 'SA-FRAME',
    name: 'ISO Frame Assembly',
    bomCode: 'BOM-SA-FRAME',
    routingCode: 'RT-SA-FRAME',
    profileCode: 'PROF-SA-FRAME',
    workCentreCode: 'WC-ISO-WELD',
    machineCode: 'MC-ISO-MIG',
    opName: 'Fabricate & weld frame',
    lines: [
      { itemCode: 'RM-RHS-SECTION', qty: 800, uomCode: 'KG', sequence: 10, lineType: 'RAW_MATERIAL' },
      { itemCode: 'RM-SHS-SECTION', qty: 600, uomCode: 'KG', sequence: 20, lineType: 'RAW_MATERIAL' },
      { itemCode: 'BO-CORNER-CASTING', qty: 8, uomCode: 'Nos', sequence: 30, lineType: 'BOUGHT_OUT' },
    ],
  },
  {
    itemCode: 'SA-VALVE-PIPING',
    name: 'Valve & Piping Skid',
    bomCode: 'BOM-SA-VALVE-PIPING',
    routingCode: 'RT-SA-VALVE-PIPING',
    profileCode: 'PROF-SA-VALVE-PIPING',
    workCentreCode: 'WC-ISO-ASSY',
    machineCode: 'MC-ISO-ASSY-BAY',
    opName: 'Assemble valve piping',
    lines: [
      { itemCode: 'BO-VALVE', qty: 4, uomCode: 'Nos', sequence: 10, lineType: 'BOUGHT_OUT' },
      { itemCode: 'BO-GASKET', qty: 8, uomCode: 'Nos', sequence: 20, lineType: 'BOUGHT_OUT' },
    ],
  },
  {
    itemCode: 'SA-WALKWAY',
    name: 'Walkway Assembly',
    bomCode: 'BOM-SA-WALKWAY',
    routingCode: 'RT-SA-WALKWAY',
    profileCode: 'PROF-SA-WALKWAY',
    workCentreCode: 'WC-ISO-ASSY',
    machineCode: 'MC-ISO-ASSY-BAY',
    opName: 'Assemble walkway',
    lines: [
      { itemCode: 'BO-FASTENERS', qty: 20, uomCode: 'Nos', sequence: 10, lineType: 'BOUGHT_OUT' },
    ],
  },
  {
    itemCode: 'SA-LADDER',
    name: 'Ladder Assembly',
    bomCode: 'BOM-SA-LADDER',
    routingCode: 'RT-SA-LADDER',
    profileCode: 'PROF-SA-LADDER',
    workCentreCode: 'WC-ISO-ASSY',
    machineCode: 'MC-ISO-ASSY-BAY',
    opName: 'Assemble ladder + doc holder',
    lines: [
      { itemCode: 'BO-DOC-HOLDER', qty: 1, uomCode: 'Nos', sequence: 10, lineType: 'BOUGHT_OUT' },
    ],
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
  throw new Error(`UOM not found: ${code} — run seed-iso-tank-pilot-items.ts`)
}

async function requireItem(tenantId: string, code: string): Promise<{ id: string; code: string; baseUomId: string }> {
  const item = await prisma.masterItem.findFirst({
    where: { tenantId, code, deletedAt: null },
    select: { id: true, code: true, baseUomId: true },
  })
  if (!item) throw new Error(`Item ${code} missing — run: npx tsx scripts/seed-iso-tank-pilot-items.ts`)
  return item
}

/**
 * Minimal ACTIVE BOM + Route + Profile for one MAKE SA so
 * generate-child-orders / release can create child WOs with route snapshots.
 */
async function seedSaManufacturingSetup(params: {
  tenantId: string
  userId: string | null
  setup: SaMfgSetup
  workCentreIds: Map<string, string>
  machineIds: Map<string, string>
  warehouseIds: Map<string, string>
  uomCache: Map<string, string>
  itemIds: Map<string, string>
}): Promise<void> {
  const { tenantId, userId, setup, workCentreIds, machineIds, warehouseIds, uomCache, itemIds } = params
  const sa = await requireItem(tenantId, setup.itemCode)
  itemIds.set(sa.code, sa.id)

  for (const line of setup.lines) {
    if (!itemIds.has(line.itemCode)) {
      const item = await requireItem(tenantId, line.itemCode)
      itemIds.set(item.code, item.id)
    }
  }

  const bom = await prisma.manufacturingBom.upsert({
    where: { tenantId_code: { tenantId, code: setup.bomCode } },
    create: {
      tenantId,
      code: setup.bomCode,
      name: `${setup.name} BOM`,
      productItemId: sa.id,
      description: `Minimal BOM for child WO of ${setup.itemCode}`,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${setup.name} BOM`,
      productItemId: sa.id,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })

  let bomVersion = await prisma.manufacturingBomVersion.findFirst({
    where: { tenantId, bomId: bom.id, versionNumber: 1, deletedAt: null },
  })

  if (!bomVersion) {
    const baseUomId = await resolveUomId(tenantId, 'SET', uomCache).catch(() =>
      resolveUomId(tenantId, 'Nos', uomCache),
    )
    bomVersion = await prisma.manufacturingBomVersion.create({
      data: {
        tenantId,
        bomId: bom.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        baseQuantity: 1,
        baseUomId,
        expectedYieldPercent: 100,
        revisionNotes: `Initial ${setup.itemCode} child-WO BOM`,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    for (const line of setup.lines) {
      const itemId = itemIds.get(line.itemCode)
      if (!itemId) throw new Error(`Missing component ${line.itemCode} for ${setup.itemCode}`)
      const uomId = await resolveUomId(tenantId, line.uomCode, uomCache)
      await prisma.manufacturingBomLine.create({
        data: {
          tenantId,
          bomVersionId: bomVersion.id,
          parentLineId: null,
          sequence: line.sequence,
          level: 1,
          itemId,
          quantity: line.qty,
          uomId,
          quantityBasis: 'PER_UNIT',
          scrapPercent: 0,
          yieldPercent: 100,
          makeOrBuy: 'BUY',
          lineType: line.lineType,
          isOptional: false,
          substituteAllowed: false,
          qualityRequired: false,
          certificateRequired: line.lineType === 'BOUGHT_OUT',
          childProductionOrderRequired: false,
          stockedSemiFinished: false,
          phantomAssembly: false,
          createdBy: userId,
          updatedBy: userId,
        },
      })
    }
    console.log(`  ✓ SA BOM ${setup.bomCode} v1 DRAFT (${setup.lines.length} lines)`)
  } else {
    console.log(`    SA BOM ${setup.bomCode} v1 exists (status=${bomVersion.status})`)
  }

  if (bomVersion.status !== 'ACTIVE') {
    await prisma.manufacturingBomVersion.updateMany({
      where: { tenantId, bomId: bom.id, status: 'ACTIVE', id: { not: bomVersion.id } },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    bomVersion = await prisma.manufacturingBomVersion.update({
      where: { id: bomVersion.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`  ✓ SA BOM ${setup.bomCode} v1 ACTIVATED`)
  }

  const routing = await prisma.manufacturingRouting.upsert({
    where: { tenantId_code: { tenantId, code: setup.routingCode } },
    create: {
      tenantId,
      code: setup.routingCode,
      name: `${setup.name} Route`,
      productItemId: sa.id,
      description: `Minimal DETAILED route for ${setup.itemCode}`,
      productionFlowType: 'SERIAL',
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${setup.name} Route`,
      productItemId: sa.id,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })

  let routingVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { tenantId, routingId: routing.id, versionNumber: 1, deletedAt: null },
  })

  const wcId = workCentreIds.get(setup.workCentreCode)
  if (!wcId) throw new Error(`WC ${setup.workCentreCode} missing for ${setup.itemCode}`)
  const machineId = setup.machineCode ? machineIds.get(setup.machineCode) ?? null : null

  if (!routingVersion) {
    routingVersion = await prisma.manufacturingRoutingVersion.create({
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

    const stageGroup = await prisma.manufacturingStageGroup.create({
      data: {
        tenantId,
        routingVersionId: routingVersion.id,
        code: 'ST-FAB',
        name: 'Fabricate',
        displayOrder: 1,
        defaultWorkCentreId: wcId,
        qualityRequired: false,
        completionRule: 'ALL_OPERATIONS',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await prisma.manufacturingRoutingOperation.create({
      data: {
        tenantId,
        routingVersionId: routingVersion.id,
        stageGroupId: stageGroup.id,
        code: 'OP-10',
        name: setup.opName,
        sequence: 10,
        description: setup.opName,
        workCentreId: wcId,
        defaultMachineId: machineId,
        setupTimeMinutes: 15,
        setupTimeUnit: 'MINUTE',
        runTimeValue: 60,
        runTimeUnit: 'MINUTE',
        runTimeBasis: 'PER_UNIT',
        inputType: 'MATERIAL',
        outputType: 'SEMI_FINISHED',
        outputItemId: sa.id,
        qualityRequired: false,
        createdBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`  ✓ SA Route ${setup.routingCode} v1 DRAFT (1 stage / 1 op)`)
  } else {
    console.log(`    SA Route ${setup.routingCode} v1 exists (status=${routingVersion.status})`)
  }

  if (routingVersion.status !== 'ACTIVE') {
    await prisma.manufacturingRoutingVersion.updateMany({
      where: {
        tenantId,
        routingId: routing.id,
        status: 'ACTIVE',
        id: { not: routingVersion.id },
      },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    routingVersion = await prisma.manufacturingRoutingVersion.update({
      where: { id: routingVersion.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        approvedAt: new Date(),
        approvedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`  ✓ SA Route ${setup.routingCode} v1 CERTIFIED (ACTIVE)`)
  }

  const prodWh = warehouseIds.get('WIP_FABRICATION')
  const scrapWh = warehouseIds.get('SCRAP')
  const qcWh = warehouseIds.get('QC_HOLD')
  if (!prodWh) throw new Error('WIP_FABRICATION warehouse required for SA profiles')

  await prisma.manufacturingProfile.upsert({
    where: { tenantId_code: { tenantId, code: setup.profileCode } },
    create: {
      tenantId,
      code: setup.profileCode,
      name: `${setup.name} Profile`,
      productItemId: sa.id,
      productionType: 'FABRICATION',
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      productionWarehouseId: prodWh,
      wipWarehouseId: prodWh,
      // SFG output lands in WIP for parent FG WO consumption
      finishedGoodsWarehouseId: prodWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: qcWh ?? null,
      plantCode: 'AHMD',
      materialConsumptionMethod: 'ACTUAL',
      wipTrackingMethod: 'STOCKED_SEMI_FINISHED',
      outputTrackingMethod: 'QUANTITY',
      directProductionOrderAllowed: true,
      childProductionOrdersEnabled: false,
      subcontractingAllowed: false,
      serialTrackingRequired: false,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${setup.name} Profile`,
      productItemId: sa.id,
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      productionWarehouseId: prodWh,
      wipWarehouseId: prodWh,
      finishedGoodsWarehouseId: prodWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: qcWh ?? null,
      materialConsumptionMethod: 'ACTUAL',
      wipTrackingMethod: 'STOCKED_SEMI_FINISHED',
      directProductionOrderAllowed: true,
      childProductionOrdersEnabled: false,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })
  console.log(`  ✓ SA Profile ${setup.profileCode} → ${setup.itemCode}`)
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const userId = admin?.id ?? null

  console.log(`\n=== ISO tank Manufacturing setup (${tenant.slug}) ===\n`)

  const plant = await prisma.masterPlant.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'AHMD' } },
    create: {
      tenantId: tenant.id,
      code: 'AHMD',
      name: 'Ahmedabad Plant',
      status: 'ACTIVE',
      createdBy: userId,
      updatedBy: userId,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Ahmedabad Plant' },
  })

  // ── 10.1 Work Centres ─────────────────────────────────────────────────
  const workCentreIds = new Map<string, string>()
  for (const wc of WORK_CENTRES) {
    const row = await prisma.manufacturingWorkCentre.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: wc.code } },
      create: {
        tenantId: tenant.id,
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
        updatedBy: userId,
      },
    })
    workCentreIds.set(wc.code, row.id)
    console.log(`  WC  ${wc.code.padEnd(14)} ${wc.name}`)
  }
  console.log(`✓ Work centres: ${workCentreIds.size}`)

  // ── 10.2 Machines (WC mandatory, machine optional on ops) ─────────────
  const machineIds = new Map<string, string>()
  for (const m of MACHINES) {
    const workCentreId = workCentreIds.get(m.workCentreCode)
    if (!workCentreId) throw new Error(`WC missing for machine ${m.code}`)
    const row = await prisma.manufacturingMachine.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: m.code } },
      create: {
        tenantId: tenant.id,
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
        updatedBy: userId,
      },
    })
    machineIds.set(m.code, row.id)
    console.log(`  MC  ${m.code.padEnd(20)} → ${m.workCentreCode}`)
  }
  console.log(`✓ Machines: ${machineIds.size}`)

  // Warehouses for profile
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
        plantCode: 'AHMD',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        plantId: plant.id,
        name: w.name,
        warehouseType: w.warehouseType,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    warehouseIds.set(w.code, row.id)
  }
  console.log(`✓ Warehouses: ${[...warehouseIds.keys()].join(', ')}`)

  const fg = await requireItem(tenant.id, FG_CODE)
  const uomCache = new Map<string, string>()
  const itemIds = new Map<string, string>([[FG_CODE, fg.id]])
  for (const node of BOM_NODES) {
    if (itemIds.has(node.itemCode)) continue
    const item = await requireItem(tenant.id, node.itemCode)
    itemIds.set(item.code, item.id)
  }

  // ── 10.3 BOM multilevel → Validate → Certified (ACTIVE) ───────────────
  const bom = await prisma.manufacturingBom.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: BOM_CODE } },
    create: {
      tenantId: tenant.id,
      code: BOM_CODE,
      name: `${FG_NAME} Multilevel BOM`,
      productItemId: fg.id,
      description: 'Pilot multilevel: SA (MAKE) → RM/BO + L1 consumables',
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${FG_NAME} Multilevel BOM`,
      productItemId: fg.id,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })

  let bomVersion = await prisma.manufacturingBomVersion.findFirst({
    where: { tenantId: tenant.id, bomId: bom.id, versionNumber: 1, deletedAt: null },
  })

  if (!bomVersion) {
    const baseUomId = await resolveUomId(tenant.id, 'Nos', uomCache)
    bomVersion = await prisma.manufacturingBomVersion.create({
      data: {
        tenantId: tenant.id,
        bomId: bom.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        baseQuantity: 1,
        baseUomId,
        expectedYieldPercent: 100,
        revisionNotes: 'Initial ISO tank pilot multilevel BOM',
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
      const uomId = await resolveUomId(tenant.id, node.uomCode, uomCache)
      if (!itemId) throw new Error(`Missing item for BOM node ${node.ref}`)
      const parentLineId = node.parentRef ? lineIdByRef.get(node.parentRef) ?? null : null
      if (node.parentRef && !parentLineId) throw new Error(`Parent ${node.parentRef} missing for ${node.ref}`)

      const line = await prisma.manufacturingBomLine.create({
        data: {
          tenantId: tenant.id,
          bomVersionId: bomVersion.id,
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
          certificateRequired: node.lineType === 'BOUGHT_OUT',
          childProductionOrderRequired: node.childProductionOrderRequired ?? false,
          stockedSemiFinished: node.stockedSemiFinished ?? false,
          phantomAssembly: false,
          notes: node.notes ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      lineIdByRef.set(node.ref, line.id)
    }
    console.log(`✓ BOM ${BOM_CODE} v1 DRAFT created (${ordered.length} lines)`)
  } else {
    console.log(`  BOM ${BOM_CODE} v1 exists (status=${bomVersion.status})`)
  }

  if (bomVersion.status !== 'ACTIVE') {
    await prisma.manufacturingBomVersion.updateMany({
      where: { tenantId: tenant.id, bomId: bom.id, status: 'ACTIVE', id: { not: bomVersion.id } },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    bomVersion = await prisma.manufacturingBomVersion.update({
      where: { id: bomVersion.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ BOM ${BOM_CODE} v1 ACTIVATED (Certified)`)
  } else {
    console.log(`✓ BOM ${BOM_CODE} v1 already ACTIVE`)
  }

  // ── 10.4 Routing with ops → Validate → Certified (ACTIVE) ─────────────
  const routing = await prisma.manufacturingRouting.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: ROUTING_CODE } },
    create: {
      tenantId: tenant.id,
      code: ROUTING_CODE,
      name: `${FG_NAME} Route Card`,
      productItemId: fg.id,
      description: 'Cut → Form → Weld → Assemble → Paint → Final QC',
      productionFlowType: 'SERIAL',
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${FG_NAME} Route Card`,
      productItemId: fg.id,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })

  let routingVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { tenantId: tenant.id, routingId: routing.id, versionNumber: 1, deletedAt: null },
  })

  type OpDef = {
    code: string
    name: string
    seq: number
    setup: number
    run: number
    machine?: string
    qualityRequired?: boolean
    qualityPlanRef?: string
  }
  type StageDef = {
    code: string
    name: string
    order: number
    wc: string
    qualityRequired?: boolean
    ops: OpDef[]
  }

  const stages: StageDef[] = [
    {
      code: 'ST-CUT',
      name: 'Cutting',
      order: 1,
      wc: 'WC-ISO-CUT',
      ops: [
        {
          code: 'OP-10',
          name: 'Plate nest & CNC plasma cut',
          seq: 10,
          setup: 30,
          run: 240,
          machine: 'MC-ISO-CNC-PLASMA',
        },
      ],
    },
    {
      code: 'ST-FORM',
      name: 'Forming',
      order: 2,
      wc: 'WC-ISO-FORM',
      ops: [
        {
          code: 'OP-20',
          name: 'Shell rolling / dish form',
          seq: 20,
          setup: 45,
          run: 360,
          machine: 'MC-ISO-SHELL-ROLL',
        },
      ],
    },
    {
      code: 'ST-WELD',
      name: 'Welding',
      order: 3,
      wc: 'WC-ISO-WELD',
      ops: [
        {
          code: 'OP-30',
          name: 'Longitudinal / circumferential SAW',
          seq: 30,
          setup: 40,
          run: 480,
          machine: 'MC-ISO-SAW',
        },
        {
          code: 'OP-40',
          name: 'Frame / fitting MIG weld',
          seq: 40,
          setup: 30,
          run: 300,
          machine: 'MC-ISO-MIG',
        },
      ],
    },
    {
      code: 'ST-ASSY',
      name: 'Assembly',
      order: 4,
      wc: 'WC-ISO-ASSY',
      ops: [
        {
          code: 'OP-50',
          name: 'Mount shell to frame + fittings',
          seq: 50,
          setup: 30,
          run: 360,
          machine: 'MC-ISO-ASSY-BAY',
        },
        {
          code: 'OP-60',
          name: 'Walkway / ladder / document holder',
          seq: 60,
          setup: 20,
          run: 180,
          machine: 'MC-ISO-ASSY-BAY',
        },
      ],
    },
    {
      code: 'ST-PAINT',
      name: 'Paint',
      order: 5,
      wc: 'WC-ISO-PAINT',
      ops: [
        {
          code: 'OP-70',
          name: 'Primer + polyurethane topcoat',
          seq: 70,
          setup: 45,
          run: 420,
          machine: 'MC-ISO-SPRAY',
        },
      ],
    },
    {
      code: 'ST-QC',
      name: 'Final QC',
      order: 6,
      wc: 'WC-ISO-QC',
      qualityRequired: true,
      ops: [
        {
          code: 'OP-80',
          name: 'Dimensional / leak / documentation QC',
          seq: 80,
          setup: 20,
          run: 120,
          qualityRequired: true,
          qualityPlanRef: 'QTG-ISO-FINAL',
        },
      ],
    },
  ]

  if (!routingVersion) {
    routingVersion = await prisma.manufacturingRoutingVersion.create({
      data: {
        tenantId: tenant.id,
        routingId: routing.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    })

    for (const stage of stages) {
      const wcId = workCentreIds.get(stage.wc)
      if (!wcId) throw new Error(`WC ${stage.wc} missing`)
      const stageGroup = await prisma.manufacturingStageGroup.create({
        data: {
          tenantId: tenant.id,
          routingVersionId: routingVersion.id,
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
        const machineId = op.machine ? machineIds.get(op.machine) ?? null : null
        await prisma.manufacturingRoutingOperation.create({
          data: {
            tenantId: tenant.id,
            routingVersionId: routingVersion.id,
            stageGroupId: stageGroup.id,
            code: op.code,
            name: op.name,
            sequence: op.seq,
            description: op.name,
            workCentreId: wcId,
            defaultMachineId: machineId,
            setupTimeMinutes: op.setup,
            setupTimeUnit: 'MINUTE',
            runTimeValue: op.run,
            runTimeUnit: 'MINUTE',
            runTimeBasis: 'PER_UNIT',
            inputType: 'MATERIAL',
            outputType: op.code === 'OP-80' ? 'FINISHED_GOOD' : 'SEMI_FINISHED',
            outputItemId: op.code === 'OP-80' ? fg.id : null,
            qualityRequired: op.qualityRequired ?? stage.qualityRequired ?? false,
            qualityPlanRef: op.qualityPlanRef ?? null,
            createdBy: userId,
            updatedBy: userId,
          },
        })
        console.log(
          `  OP  ${op.code.padEnd(6)} ${op.name.slice(0, 40).padEnd(40)} WC=${stage.wc} setup=${op.setup}m run=${op.run}m QC=${op.qualityRequired || stage.qualityRequired ? 'Y' : 'N'}`,
        )
      }
    }
    console.log(`✓ Routing ${ROUTING_CODE} v1 DRAFT created (${stages.length} stages)`)
  } else {
    console.log(`  Routing ${ROUTING_CODE} v1 exists (status=${routingVersion.status})`)
  }

  if (routingVersion.status !== 'ACTIVE') {
    await prisma.manufacturingRoutingVersion.updateMany({
      where: {
        tenantId: tenant.id,
        routingId: routing.id,
        status: 'ACTIVE',
        id: { not: routingVersion.id },
      },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    routingVersion = await prisma.manufacturingRoutingVersion.update({
      where: { id: routingVersion.id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: userId,
        approvedAt: new Date(),
        approvedBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ Routing ${ROUTING_CODE} v1 CERTIFIED (ACTIVE, read-only)`)
  } else {
    console.log(`✓ Routing ${ROUTING_CODE} v1 already ACTIVE`)
  }

  // ── 10.5 Manufacturing Profile ────────────────────────────────────────
  const prodWh = warehouseIds.get('WIP_FABRICATION')
  const fgWh = warehouseIds.get('FG_YARD')
  const rmWh = warehouseIds.get('RM-MAIN')
  const qcWh = warehouseIds.get('QC_HOLD')
  const scrapWh = warehouseIds.get('SCRAP')
  if (!prodWh || !fgWh) throw new Error('WIP_FABRICATION / FG_YARD warehouses required')

  const profile = await prisma.manufacturingProfile.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: PROFILE_CODE } },
    create: {
      tenantId: tenant.id,
      code: PROFILE_CODE,
      name: `${FG_NAME} Profile`,
      productItemId: fg.id,
      productionType: 'ENGINEER_TO_ORDER',
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      productionWarehouseId: prodWh,
      wipWarehouseId: prodWh,
      finishedGoodsWarehouseId: fgWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: qcWh ?? null,
      plantCode: 'AHMD',
      materialConsumptionMethod: 'ACTUAL',
      wipTrackingMethod: 'STOCKED_SEMI_FINISHED',
      outputTrackingMethod: 'QUANTITY',
      directProductionOrderAllowed: true,
      childProductionOrdersEnabled: true,
      subcontractingAllowed: true,
      serialTrackingRequired: false,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: `${FG_NAME} Profile`,
      productItemId: fg.id,
      executionMode: 'DETAILED',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      productionWarehouseId: prodWh,
      wipWarehouseId: prodWh,
      finishedGoodsWarehouseId: fgWh,
      scrapWarehouseId: scrapWh ?? null,
      qualityHoldWarehouseId: qcWh ?? null,
      materialConsumptionMethod: 'ACTUAL',
      wipTrackingMethod: 'STOCKED_SEMI_FINISHED',
      directProductionOrderAllowed: true,
      childProductionOrdersEnabled: true,
      serialTrackingRequired: false,
      deletedAt: null,
      isActive: true,
      updatedBy: userId,
    },
  })
  void rmWh
  console.log(`✓ Profile ${PROFILE_CODE} → FG=${FG_CODE} BOM=${BOM_CODE} RT=${ROUTING_CODE}`)

  // Ensure FG BOM L1 MAKE SA lines keep child-WO flags (idempotent patch for existing DBs)
  const saItemCodes = SA_MFG_SETUPS.map((s) => s.itemCode)
  for (const code of saItemCodes) {
    const saItemId = itemIds.get(code)
    if (!saItemId) continue
    const updated = await prisma.manufacturingBomLine.updateMany({
      where: {
        tenantId: tenant.id,
        bomVersionId: bomVersion.id,
        itemId: saItemId,
        deletedAt: null,
        parentLineId: null,
      },
      data: {
        childProductionOrderRequired: true,
        stockedSemiFinished: true,
        makeOrBuy: 'MAKE',
        lineType: 'SUBASSEMBLY',
        updatedBy: userId,
      },
    })
    if (updated.count > 0) {
      console.log(
        `  · FG BOM line flags: ${code} childProductionOrderRequired=true stockedSemiFinished=true`,
      )
    }
  }

  // ── 10.6 MAKE SA readiness (child WO / route snapshot) ─────────────────
  console.log('\n── MAKE SA BOM + Route + Profile ──')
  for (const saSetup of SA_MFG_SETUPS) {
    await seedSaManufacturingSetup({
      tenantId: tenant.id,
      userId,
      setup: saSetup,
      workCentreIds,
      machineIds,
      warehouseIds,
      uomCache,
      itemIds,
    })
  }
  console.log(`✓ MAKE SA setups: ${SA_MFG_SETUPS.length}`)

  // Verify
  console.log('\n── Verification ──')
  const bomOk = bomVersion.status === 'ACTIVE'
  const rtOk = routingVersion.status === 'ACTIVE'
  const profOk = profile.isActive && profile.defaultBomVersionId === bomVersion.id
  console.log(`  ${bomOk ? '✓' : '✗'} BOM status=${bomVersion.status}`)
  console.log(`  ${rtOk ? '✓' : '✗'} Routing status=${routingVersion.status}`)
  console.log(`  ${profOk ? '✓' : '✗'} Profile active + linked versions`)

  let saOk = true
  for (const saSetup of SA_MFG_SETUPS) {
    const saItemId = itemIds.get(saSetup.itemCode)
    const saProfile = saItemId
      ? await prisma.manufacturingProfile.findFirst({
          where: {
            tenantId: tenant.id,
            productItemId: saItemId,
            isActive: true,
            deletedAt: null,
          },
          include: {
            defaultBomVersion: { select: { status: true } },
            defaultRoutingVersion: { select: { status: true } },
          },
        })
      : null
    const ok =
      !!saProfile &&
      saProfile.defaultBomVersion?.status === 'ACTIVE' &&
      saProfile.defaultRoutingVersion?.status === 'ACTIVE'
    if (!ok) saOk = false
    console.log(
      `  ${ok ? '✓' : '✗'} SA ${saSetup.itemCode} profile=${saProfile?.code ?? 'MISSING'} BOM=${saProfile?.defaultBomVersion?.status ?? '—'} RT=${saProfile?.defaultRoutingVersion?.status ?? '—'}`,
    )
  }

  console.log(`\nUI: /manufacturing/work-orders/new → ${FG_CODE}`)
  console.log(`Re-run: npx tsx scripts/seed-iso-tank-mfg-setup.ts ${tenantSlug}\n`)

  if (!bomOk || !rtOk || !profOk || !saOk) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
