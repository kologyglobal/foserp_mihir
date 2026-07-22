/**
 * Seeds five reference Manufacturing Phase 1 configurations (work centre, machine,
 * item, BOM + version + lines, routing + version + stage + operations, profile) for
 * an existing tenant. Safe to re-run — every record is looked up/created by its
 * unique `code` within the tenant, so re-running only fills in missing pieces.
 *
 * Usage:
 *   npx tsx scripts/seed-manufacturing-fixtures.ts <tenantSlug>
 *   TENANT_SLUG=vasant-trailers npx tsx scripts/seed-manufacturing-fixtures.ts
 */
import { prisma } from '../src/config/database.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG
if (!tenantSlug) {
  console.error('Usage: npx tsx scripts/seed-manufacturing-fixtures.ts <tenantSlug>')
  process.exit(1)
}

interface FixtureConfig {
  itemCode: string
  itemName: string
  componentCode: string
  componentName: string
  rawCode: string
  rawName: string
  bomCode: string
  bomName: string
  routingCode: string
  routingName: string
  profileCode: string
  profileName: string
  productionType:
    | 'ASSEMBLY'
    | 'FABRICATION'
    | 'MACHINING'
    | 'JOB_SHOP'
    | 'REPETITIVE'
    | 'PROJECT'
    | 'ENGINEER_TO_ORDER'
    | 'SUBCONTRACT'
}

const FIXTURES: FixtureConfig[] = [
  {
    itemCode: 'MFG-FIX-BRACKET',
    itemName: 'Fabricated Bracket',
    componentCode: 'MFG-FIX-BRACKET-BLANK',
    componentName: 'Bracket Steel Blank',
    rawCode: 'MFG-FIX-BRACKET-RAW',
    rawName: 'MS Sheet 3mm',
    bomCode: 'BOM-FIX-BRACKET',
    bomName: 'Fabricated Bracket BOM',
    routingCode: 'RT-FIX-BRACKET',
    routingName: 'Fabricated Bracket Routing',
    profileCode: 'PROF-FIX-BRACKET',
    profileName: 'Fabricated Bracket Profile',
    productionType: 'FABRICATION',
  },
  {
    itemCode: 'MFG-FIX-PUMP',
    itemName: 'Industrial Pump',
    componentCode: 'MFG-FIX-PUMP-HOUSING',
    componentName: 'Pump Housing Assembly',
    rawCode: 'MFG-FIX-PUMP-CASTING',
    rawName: 'Cast Iron Casting',
    bomCode: 'BOM-FIX-PUMP',
    bomName: 'Industrial Pump BOM',
    routingCode: 'RT-FIX-PUMP',
    routingName: 'Industrial Pump Routing',
    profileCode: 'PROF-FIX-PUMP',
    profileName: 'Industrial Pump Profile',
    productionType: 'ASSEMBLY',
  },
  {
    itemCode: 'MFG-FIX-PANEL',
    itemName: 'Electrical Panel',
    componentCode: 'MFG-FIX-PANEL-ENCLOSURE',
    componentName: 'Panel Enclosure',
    rawCode: 'MFG-FIX-PANEL-SHEET',
    rawName: 'Powder Coated Sheet',
    bomCode: 'BOM-FIX-PANEL',
    bomName: 'Electrical Panel BOM',
    routingCode: 'RT-FIX-PANEL',
    routingName: 'Electrical Panel Routing',
    profileCode: 'PROF-FIX-PANEL',
    profileName: 'Electrical Panel Profile',
    productionType: 'ASSEMBLY',
  },
  {
    itemCode: 'MFG-FIX-MACHINED',
    itemName: 'Machined Component',
    componentCode: 'MFG-FIX-MACHINED-BLANK',
    componentName: 'Turned Blank',
    rawCode: 'MFG-FIX-MACHINED-BAR',
    rawName: 'EN8 Round Bar',
    bomCode: 'BOM-FIX-MACHINED',
    bomName: 'Machined Component BOM',
    routingCode: 'RT-FIX-MACHINED',
    routingName: 'Machined Component Routing',
    profileCode: 'PROF-FIX-MACHINED',
    profileName: 'Machined Component Profile',
    productionType: 'MACHINING',
  },
  {
    itemCode: 'MFG-FIX-TRAILER',
    itemName: 'Trailer',
    componentCode: 'MFG-FIX-TRAILER-CHASSIS',
    componentName: 'Trailer Chassis',
    rawCode: 'MFG-FIX-TRAILER-AXLE',
    rawName: 'Axle Assembly',
    bomCode: 'BOM-FIX-TRAILER',
    bomName: 'Trailer BOM',
    routingCode: 'RT-FIX-TRAILER',
    routingName: 'Trailer Routing',
    profileCode: 'PROF-FIX-TRAILER',
    profileName: 'Trailer Profile',
    productionType: 'ENGINEER_TO_ORDER',
  },
]

async function ensureBaseMasters(tenantId: string) {
  const category = await prisma.masterItemCategory.upsert({
    where: { tenantId_code: { tenantId, code: 'MFG-FIXTURE-CAT' } },
    create: { tenantId, code: 'MFG-FIXTURE-CAT', name: 'Manufacturing Fixtures' },
    update: {},
  })
  const uom = await prisma.masterUom.upsert({
    where: { tenantId_code: { tenantId, code: 'MFG-EA' } },
    create: { tenantId, code: 'MFG-EA', name: 'Each', uomType: 'integer', isBaseUnit: true },
    update: {},
  })
  const warehouse = await prisma.masterWarehouse.upsert({
    where: { tenantId_code: { tenantId, code: 'MFG-FIXTURE-WH' } },
    create: { tenantId, code: 'MFG-FIXTURE-WH', name: 'Manufacturing Fixtures Warehouse' },
    update: {},
  })
  return { category, uom, warehouse }
}

async function ensureItem(
  tenantId: string,
  categoryId: string,
  uomId: string,
  code: string,
  name: string,
  itemType: string,
) {
  return prisma.masterItem.upsert({
    where: { tenantId_code: { tenantId, code } },
    create: { tenantId, code, name, categoryId, baseUomId: uomId, itemType },
    update: { name },
  })
}

async function seedFixture(
  tenantId: string,
  userId: string | null,
  categoryId: string,
  uomId: string,
  warehouseId: string,
  cfg: FixtureConfig,
): Promise<void> {
  const product = await ensureItem(tenantId, categoryId, uomId, cfg.itemCode, cfg.itemName, 'finished_good')
  const component = await ensureItem(tenantId, categoryId, uomId, cfg.componentCode, cfg.componentName, 'semi_finished')
  const raw = await ensureItem(tenantId, categoryId, uomId, cfg.rawCode, cfg.rawName, 'raw_material')

  const workCentre = await prisma.manufacturingWorkCentre.upsert({
    where: { tenantId_code: { tenantId, code: `WC-${cfg.itemCode}` } },
    create: {
      tenantId,
      code: `WC-${cfg.itemCode}`,
      name: `${cfg.itemName} Work Centre`,
      capacityPerShift: 8,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {},
  })

  await prisma.manufacturingMachine.upsert({
    where: { tenantId_code: { tenantId, code: `MC-${cfg.itemCode}` } },
    create: {
      tenantId,
      code: `MC-${cfg.itemCode}`,
      name: `${cfg.itemName} Machine`,
      workCentreId: workCentre.id,
      status: 'AVAILABLE',
      createdBy: userId,
      updatedBy: userId,
    },
    update: {},
  })

  // ─── BOM ───────────────────────────────────────────────────────────────
  const bom = await prisma.manufacturingBom.upsert({
    where: { tenantId_code: { tenantId, code: cfg.bomCode } },
    create: {
      tenantId,
      code: cfg.bomCode,
      name: cfg.bomName,
      productItemId: product.id,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {},
  })

  let bomVersion = await prisma.manufacturingBomVersion.findFirst({
    where: { tenantId, bomId: bom.id, versionNumber: 1 },
  })
  if (!bomVersion) {
    bomVersion = await prisma.manufacturingBomVersion.create({
      data: {
        tenantId,
        bomId: bom.id,
        versionNumber: 1,
        revisionCode: 'REV-A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        baseQuantity: 1,
        baseUomId: uomId,
        expectedYieldPercent: 100,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const parentLine = await prisma.manufacturingBomLine.create({
      data: {
        tenantId,
        bomVersionId: bomVersion.id,
        sequence: 10,
        level: 1,
        itemId: component.id,
        quantity: 1,
        uomId,
        quantityBasis: 'PER_UNIT',
        scrapPercent: 0,
        yieldPercent: 100,
        makeOrBuy: 'MAKE',
        lineType: 'SUBASSEMBLY',
        isOptional: false,
        substituteAllowed: false,
        qualityRequired: false,
        certificateRequired: false,
        childProductionOrderRequired: false,
        stockedSemiFinished: false,
        phantomAssembly: false,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await prisma.manufacturingBomLine.create({
      data: {
        tenantId,
        bomVersionId: bomVersion.id,
        parentLineId: parentLine.id,
        sequence: 10,
        level: 2,
        itemId: raw.id,
        quantity: 2,
        uomId,
        quantityBasis: 'PER_UNIT',
        scrapPercent: 5,
        yieldPercent: 100,
        makeOrBuy: 'BUY',
        lineType: 'RAW_MATERIAL',
        isOptional: false,
        substituteAllowed: false,
        qualityRequired: false,
        certificateRequired: false,
        childProductionOrderRequired: false,
        stockedSemiFinished: false,
        phantomAssembly: false,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  }

  // ─── Routing ───────────────────────────────────────────────────────────
  const routing = await prisma.manufacturingRouting.upsert({
    where: { tenantId_code: { tenantId, code: cfg.routingCode } },
    create: {
      tenantId,
      code: cfg.routingCode,
      name: cfg.routingName,
      productItemId: product.id,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {},
  })

  let routingVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { tenantId, routingId: routing.id, versionNumber: 1 },
  })
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
        code: 'ST-01',
        name: 'Primary Processing',
        displayOrder: 1,
        defaultWorkCentreId: workCentre.id,
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
        name: `Process ${cfg.itemName}`,
        sequence: 10,
        workCentreId: workCentre.id,
        setupTimeMinutes: 15,
        runTimeValue: 30,
        runTimeBasis: 'PER_UNIT',
        inputType: 'MATERIAL',
        outputType: 'FINISHED_GOOD',
        outputItemId: product.id,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  }

  // ─── Profile ───────────────────────────────────────────────────────────
  await prisma.manufacturingProfile.upsert({
    where: { tenantId_code: { tenantId, code: cfg.profileCode } },
    create: {
      tenantId,
      code: cfg.profileCode,
      name: cfg.profileName,
      productItemId: product.id,
      productionType: cfg.productionType,
      executionMode: 'SIMPLE',
      defaultBomVersionId: bomVersion.id,
      defaultRoutingVersionId: routingVersion.id,
      productionWarehouseId: warehouseId,
      finishedGoodsWarehouseId: warehouseId,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {},
  })

  console.log(`  Seeded fixture: ${cfg.itemName} (item=${cfg.itemCode}, bom=${cfg.bomCode}, routing=${cfg.routingCode})`)
}

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (!tenant) {
    console.error(`Tenant not found for slug: ${tenantSlug}`)
    process.exit(1)
  }

  console.log(`Seeding manufacturing fixtures for tenant "${tenant.name}" (${tenant.slug})...`)
  const { category, uom, warehouse } = await ensureBaseMasters(tenant.id)

  const adminUser = await prisma.user.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } })
  const userId = adminUser?.id ?? null

  for (const cfg of FIXTURES) {
    await seedFixture(tenant.id, userId, category.id, uom.id, warehouse.id, cfg)
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
