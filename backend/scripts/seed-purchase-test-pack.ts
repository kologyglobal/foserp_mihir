/**
 * Purchase / tax manual-test pack — GST groups, HSN (linked), purchasable items,
 * warehouses, storage locations, and bins.
 *
 * Idempotent. Safe to re-run after DB restore.
 *
 * Run: npx tsx scripts/seed-purchase-test-pack.ts [tenantSlug]
 */
import { prisma } from '../src/config/prisma.js'
import {
  GST_GROUP_SEED_ROWS,
  GST_RATE_SEED_ROWS,
  HSN_SEED_ROWS,
} from '../prisma/gstTaxSeedData.js'
import { WAREHOUSE_SEED_ROWS, LOCATION_SEED_ROWS } from '../prisma/warehouseLocationSeedData.js'

const TENANT_SLUG = process.argv[2] ?? 'vasant-trailers'

const PURCHASE_TEST_ITEMS = [
  {
    code: 'RM-STEEL-PLT',
    name: 'MS Plate 8mm — Purchase Test',
    hsnCode: '721070',
    gstGroupCode: 'GST12-GOODS',
    standardRate: 85000,
    qcRequired: true,
    qualityTestGroupCode: 'QT-RM-IN',
  },
  {
    code: 'RM-VALVE-TEST',
    name: 'Discharge Valve — Purchase Test',
    hsnCode: '848180',
    gstGroupCode: 'GST18-GOODS',
    standardRate: 12500,
    qcRequired: true,
    qualityTestGroupCode: 'QT-RM-IN',
  },
  {
    code: 'RM-BRACKET-TEST',
    name: 'Steel Bracket — Purchase Test',
    hsnCode: '732690',
    gstGroupCode: 'GST18-GOODS',
    standardRate: 450,
    qcRequired: false,
    qualityTestGroupCode: null,
  },
] as const

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  const actor =
    (await prisma.user.findFirst({
      where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    })) ?? null
  const actorId = actor?.id ?? null

  const nosUom = await prisma.masterUom.findFirst({
    where: { tenantId: tenant.id, code: { in: ['NOS', 'Nos', 'nos'] }, deletedAt: null },
  })
  if (!nosUom) throw new Error('NOS UOM not found — run main seed first (npm run db:seed)')

  let category = await prisma.masterItemCategory.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, code: { in: ['RM', 'CAT-RM', 'RAW'] } },
  })
  if (!category) {
    category = await prisma.masterItemCategory.create({
      data: {
        tenantId: tenant.id,
        code: 'RM-TEST',
        name: 'Raw Material (Test)',
        level: 1,
        stockPolicy: 'REQUIRED',
        defaultIsStockable: true,
        defaultInventoryType: 'inventory',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
    })
  }

  const gstGroupIdByCode = new Map<string, string>()
  for (const row of GST_GROUP_SEED_ROWS) {
    const group = await prisma.masterGstGroup.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        goodsType: row.goodsType,
        description: row.description,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        goodsType: row.goodsType,
        description: row.description,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    gstGroupIdByCode.set(row.code, group.id)
  }

  let gstRateCount = 0
  for (const row of GST_RATE_SEED_ROWS) {
    const gstGroupId = gstGroupIdByCode.get(row.gstGroupCode)
    if (!gstGroupId) continue
    await prisma.masterGstRate.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        gstGroupId,
        fromState: row.fromState,
        locationStateCode: row.locationStateCode,
        dateFrom: new Date(row.dateFrom),
        sgst: row.sgst,
        cgst: row.cgst,
        igst: row.igst,
        applicableFor: row.applicableFor ?? 'BOTH',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        gstGroupId,
        fromState: row.fromState,
        locationStateCode: row.locationStateCode,
        sgst: row.sgst,
        cgst: row.cgst,
        igst: row.igst,
        applicableFor: row.applicableFor ?? 'BOTH',
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    gstRateCount += 1
  }

  const hsnIdByCode = new Map<string, string>()
  for (const row of HSN_SEED_ROWS) {
    const gstGroupId = gstGroupIdByCode.get(row.gstGroupCode)
    if (!gstGroupId) continue
    const hsn = await prisma.masterHsnCode.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        gstGroupId,
        description: row.description,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        gstGroupId,
        description: row.description,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    hsnIdByCode.set(row.code, hsn.id)
  }

  const warehouseIdByCode = new Map<string, string>()
  for (const row of WAREHOUSE_SEED_ROWS) {
    const wh = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        warehouseType: row.warehouseType,
        plantCode: row.plantCode,
        address: row.address ?? null,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: row.name,
        warehouseType: row.warehouseType,
        plantCode: row.plantCode,
        address: row.address ?? null,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    warehouseIdByCode.set(row.code, wh.id)
  }

  let locationCount = 0
  for (const row of LOCATION_SEED_ROWS) {
    const warehouseId = warehouseIdByCode.get(row.warehouseCode)
    if (!warehouseId) continue
    await prisma.masterLocation.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        warehouseId,
        code: row.code,
        name: row.name,
        addressLine1: row.addressLine1 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode ?? null,
        country: row.country ?? 'India',
        allowPurchase: row.allowPurchase ?? true,
        allowInventory: row.allowInventory ?? true,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        warehouseId,
        name: row.name,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    locationCount += 1
  }

  let binCount = 0
  const warehouses = await prisma.masterWarehouse.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
  })
  for (const wh of warehouses) {
    const locations = await prisma.masterLocation.findMany({
      where: { tenantId: tenant.id, warehouseId: wh.id, deletedAt: null },
    })
    for (const loc of locations) {
      const code = `${loc.code}-B01`.slice(0, 32)
      const existing = await prisma.masterBin.findFirst({
        where: { tenantId: tenant.id, warehouseId: wh.id, code, deletedAt: null },
      })
      if (existing) continue
      await prisma.masterBin.create({
        data: {
          tenantId: tenant.id,
          warehouseId: wh.id,
          storageLocationId: loc.id,
          code,
          name: `${loc.name} — Bin 01`,
          binType: 'STORAGE',
          status: 'ACTIVE',
          createdBy: actorId,
          updatedBy: actorId,
        },
      })
      binCount += 1
    }
  }

  let itemCount = 0
  for (const row of PURCHASE_TEST_ITEMS) {
    const hsnId = hsnIdByCode.get(row.hsnCode) ?? null
    const gstGroupId = gstGroupIdByCode.get(row.gstGroupCode) ?? null
    await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        itemDescription: row.name,
        categoryId: category.id,
        baseUomId: nosUom.id,
        purchaseUomId: nosUom.id,
        itemType: 'raw_material',
        productType: 'raw_material',
        inventoryType: 'inventory',
        hsnCode: row.hsnCode,
        hsnId,
        gstGroupId,
        standardRate: row.standardRate,
        isPurchasable: true,
        isStockable: true,
        qcRequired: row.qcRequired,
        qualityTestGroupCode: row.qualityTestGroupCode,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: row.name,
        hsnCode: row.hsnCode,
        hsnId,
        gstGroupId,
        standardRate: row.standardRate,
        isPurchasable: true,
        qcRequired: row.qcRequired,
        qualityTestGroupCode: row.qualityTestGroupCode,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    itemCount += 1
  }

  const hsns = await prisma.masterHsnCode.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true, gstGroupId: true },
  })
  let relinked = 0
  for (const hsn of hsns) {
    const result = await prisma.masterItem.updateMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        hsnCode: hsn.code,
        OR: [{ hsnId: null }, { gstGroupId: null }],
      },
      data: { hsnId: hsn.id, gstGroupId: hsn.gstGroupId },
    })
    relinked += result.count
  }

  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`GST groups: ${gstGroupIdByCode.size}`)
  console.log(`GST rates: ${gstRateCount}`)
  console.log(`HSN codes: ${hsnIdByCode.size} (each linked to a GST group)`)
  console.log(`Warehouses: ${warehouseIdByCode.size}`)
  console.log(`Locations: ${locationCount}`)
  console.log(`Bins created: ${binCount}`)
  console.log(`Purchase test items: ${itemCount}`)
  console.log(`Existing items re-linked to HSN/GST: ${relinked}`)
  console.log('')
  console.log('Test items for PO: RM-STEEL-PLT, RM-VALVE-TEST, RM-BRACKET-TEST')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
