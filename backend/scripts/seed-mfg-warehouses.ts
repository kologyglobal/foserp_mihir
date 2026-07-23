/**
 * Upsert canonical manufacturing warehouses + locations/bins + default warehouse mapping.
 * Usage: npx tsx scripts/seed-mfg-warehouses.ts [tenantSlug]
 */
import { prisma } from '../src/config/database.js'
import {
  LOCATION_SEED_ROWS,
  MFG_WAREHOUSE_CODES,
  WAREHOUSE_SEED_ROWS,
} from '../prisma/warehouseLocationSeedData.js'

const TENANT_SLUG = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'
const PLANT_CODE = 'AHMD'

async function ensureBin(
  tenantId: string,
  warehouseId: string,
  locationId: string,
  locCode: string,
  locName: string,
) {
  const existing = await prisma.masterBin.findFirst({
    where: { tenantId, storageLocationId: locationId, deletedAt: null },
  })
  if (existing) {
    await prisma.masterBin.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', deletedAt: null },
    })
    return existing
  }
  return prisma.masterBin.create({
    data: {
      tenantId,
      warehouseId,
      storageLocationId: locationId,
      code: `${locCode}-B01`.slice(0, 32),
      name: `${locName} — Bin 01`,
      binType: 'storage',
      status: 'ACTIVE',
    },
  })
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)
  const tenantId = tenant.id

  console.log(`Seeding manufacturing warehouses for ${tenant.slug}…`)

  const plant = await prisma.masterPlant.upsert({
    where: { tenantId_code: { tenantId, code: PLANT_CODE } },
    create: { tenantId, code: PLANT_CODE, name: 'Ahmedabad Plant', status: 'ACTIVE' },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Ahmedabad Plant' },
  })

  const mfgSet = new Set<string>(MFG_WAREHOUSE_CODES)
  const warehouseRows = WAREHOUSE_SEED_ROWS.filter((r) => mfgSet.has(r.code))
  const warehouseIdByCode = new Map<string, string>()

  for (const row of warehouseRows) {
    const wh = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId, code: row.code } },
      create: {
        tenantId,
        plantId: plant.id,
        code: row.code,
        name: row.name,
        warehouseType: row.warehouseType,
        plantCode: row.plantCode,
        address: row.address ?? null,
        status: 'ACTIVE',
      },
      update: {
        plantId: plant.id,
        name: row.name,
        warehouseType: row.warehouseType,
        plantCode: row.plantCode,
        address: row.address ?? null,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    warehouseIdByCode.set(row.code, wh.id)
    console.log(`  WH ${row.code} (${row.warehouseType}) ACTIVE`)
  }

  const locationRows = LOCATION_SEED_ROWS.filter((r) => mfgSet.has(r.warehouseCode))
  for (const row of locationRows) {
    const warehouseId = warehouseIdByCode.get(row.warehouseCode)
    if (!warehouseId) continue
    const loc = await prisma.masterLocation.upsert({
      where: { tenantId_code: { tenantId, code: row.code } },
      create: {
        tenantId,
        warehouseId,
        code: row.code,
        name: row.name,
        addressLine1: row.addressLine1 ?? null,
        addressLine2: row.addressLine2 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode ?? null,
        country: row.country ?? 'India',
        gstin: row.gstin ?? null,
        registeredType: row.registeredType ?? null,
        allowSales: row.allowSales ?? false,
        allowPurchase: row.allowPurchase ?? false,
        allowProduction: row.allowProduction ?? false,
        allowInventory: row.allowInventory ?? true,
        status: 'ACTIVE',
      },
      update: {
        warehouseId,
        name: row.name,
        addressLine1: row.addressLine1 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode ?? null,
        allowSales: row.allowSales ?? false,
        allowPurchase: row.allowPurchase ?? false,
        allowProduction: row.allowProduction ?? false,
        allowInventory: row.allowInventory ?? true,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    await ensureBin(tenantId, warehouseId, loc.id, loc.code, loc.name)
    console.log(`  LOC ${row.code} → ${row.warehouseCode} (+ bin)`)
  }

  // Any mfg warehouse still missing a location gets a default zone + bin
  for (const code of MFG_WAREHOUSE_CODES) {
    const warehouseId = warehouseIdByCode.get(code)
    if (!warehouseId) continue
    const locs = await prisma.masterLocation.findMany({
      where: { tenantId, warehouseId, deletedAt: null },
    })
    if (locs.length) {
      for (const loc of locs) await ensureBin(tenantId, warehouseId, loc.id, loc.code, loc.name)
      continue
    }
    const loc = await prisma.masterLocation.create({
      data: {
        tenantId,
        warehouseId,
        code: `${code}-L`.slice(0, 10),
        name: `${code} — Default Zone`,
        status: 'ACTIVE',
        allowInventory: true,
      },
    })
    await ensureBin(tenantId, warehouseId, loc.id, loc.code, loc.name)
    console.log(`  LOC ${loc.code} (default) → ${code}`)
  }

  const rmId = warehouseIdByCode.get('RM-MAIN')!
  const fgId = warehouseIdByCode.get('FG-MAIN')!
  const wipId = warehouseIdByCode.get('WIP')!
  const qcId = warehouseIdByCode.get('QC-HOLD')!
  const scrapId = warehouseIdByCode.get('SCRAP')!
  const jwId = warehouseIdByCode.get('JOB-WORK')!
  const boId = warehouseIdByCode.get('BO-MAIN')!

  // Category default warehouses (optional links)
  for (const [catCode, whId] of [
    ['RM', rmId],
    ['BO', boId],
    ['FG', fgId],
    ['SCRAP', scrapId],
    ['SFG', wipId],
  ] as const) {
    await prisma.masterItemCategory
      .updateMany({
        where: { tenantId, code: catCode, deletedAt: null },
        data: { defaultWarehouseId: whId },
      })
      .catch(() => undefined)
  }

  const mappingPayload = {
    rawMaterialWarehouseId: rmId,
    productionIssueWarehouseId: rmId,
    wipWarehouseId: wipId,
    finishedGoodsWarehouseId: fgId,
    qualityHoldWarehouseId: qcId,
    scrapWarehouseId: scrapId,
    jobWorkWarehouseId: jwId,
    defaultReturnWarehouseId: rmId,
    isDefault: true,
    isActive: true,
    deletedAt: null as Date | null,
  }

  const existingDefault = await prisma.manufacturingWarehouseMapping.findFirst({
    where: { tenantId, plantCode: null, deletedAt: null },
  })
  if (existingDefault) {
    await prisma.manufacturingWarehouseMapping.update({
      where: { id: existingDefault.id },
      data: mappingPayload,
    })
    console.log(`  Mapping tenant-default updated (${existingDefault.id})`)
  } else {
    const created = await prisma.manufacturingWarehouseMapping.create({
      data: { tenantId, plantCode: null, ...mappingPayload },
    })
    console.log(`  Mapping tenant-default created (${created.id})`)
  }

  const existingPlant = await prisma.manufacturingWarehouseMapping.findFirst({
    where: { tenantId, plantCode: PLANT_CODE, deletedAt: null },
  })
  if (existingPlant) {
    await prisma.manufacturingWarehouseMapping.update({
      where: { id: existingPlant.id },
      data: { ...mappingPayload, isDefault: false },
    })
    console.log(`  Mapping plant ${PLANT_CODE} updated`)
  } else {
    await prisma.manufacturingWarehouseMapping.create({
      data: { tenantId, plantCode: PLANT_CODE, ...mappingPayload, isDefault: false },
    })
    console.log(`  Mapping plant ${PLANT_CODE} created`)
  }

  // Verification
  const verify = await prisma.masterWarehouse.findMany({
    where: { tenantId, code: { in: [...MFG_WAREHOUSE_CODES] }, deletedAt: null },
    include: {
      locations: { where: { deletedAt: null }, include: { bins: { where: { deletedAt: null } } } },
    },
    orderBy: { code: 'asc' },
  })
  console.log('\nVerification:')
  for (const wh of verify) {
    const bins = wh.locations.reduce((n, l) => n + l.bins.length, 0)
    console.log(
      `  ${wh.code.padEnd(10)} status=${wh.status} type=${wh.warehouseType.padEnd(18)} locs=${wh.locations.length} bins=${bins}`,
    )
  }

  const lookupCount = await prisma.masterWarehouse.count({
    where: { tenantId, status: 'ACTIVE', deletedAt: null, code: { in: [...MFG_WAREHOUSE_CODES] } },
  })
  console.log(`\nACTIVE lookup-selectable: ${lookupCount}/${MFG_WAREHOUSE_CODES.length}`)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
