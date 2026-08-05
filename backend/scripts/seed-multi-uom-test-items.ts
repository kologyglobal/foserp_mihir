/**
 * Seed multi-UOM test items for Phase 1 QA (MS Pipe KG, MS Pipe MTR, Casting).
 *
 * Usage (from backend/):
 *   npx tsx scripts/seed-multi-uom-test-items.ts
 *   TENANT_SLUG=vasant-trailers npx tsx scripts/seed-multi-uom-test-items.ts
 */
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

const ITEMS = [
  {
    code: 'MS-PIPE-DN25-KG',
    name: 'MS Pipe DN25 (Purchase KG)',
    purchaseUomCode: 'KG',
    baseUomCode: 'NOS',
    factor: 50,
    qtyTolerancePct: 2,
    weightTolerancePct: 0,
  },
  {
    code: 'MS-PIPE-LEN-MTR',
    name: 'MS Pipe Length (Purchase MTR)',
    purchaseUomCode: 'MTR',
    baseUomCode: 'NOS',
    factor: 6,
    qtyTolerancePct: 2,
    weightTolerancePct: 0,
  },
  {
    code: 'CASTING-KG-MUOM',
    name: 'Casting (Purchase KG)',
    purchaseUomCode: 'KG',
    baseUomCode: 'NOS',
    factor: 25,
    qtyTolerancePct: 0,
    weightTolerancePct: 5,
  },
] as const

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  const uoms = await prisma.masterUom.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true },
  })
  const uomByCode = new Map(uoms.map((u) => [u.code.toUpperCase(), u.id]))
  const nosId = uomByCode.get('NOS')
  const kgId = uomByCode.get('KG')
  const mtrId = uomByCode.get('MTR')
  if (!nosId || !kgId || !mtrId) {
    throw new Error('Required UOMs NOS, KG, MTR must exist in tenant master')
  }

  const category = await prisma.masterItemCategory.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { code: 'asc' },
  })
  if (!category) throw new Error('No item category found')

  let qtyTolerance = await prisma.masterReceivingTolerance.findFirst({
    where: { tenantId: tenant.id, code: 'MUOM-QTY-2', deletedAt: null },
  })
  if (!qtyTolerance) {
    qtyTolerance = await prisma.masterReceivingTolerance.create({
      data: {
        tenantId: tenant.id,
        code: 'MUOM-QTY-2',
        name: 'MUOM Qty 2%',
        percentage: 2,
        status: 'ACTIVE',
      },
    })
  }

  let weightTolerance = await prisma.masterReceivingTolerance.findFirst({
    where: { tenantId: tenant.id, code: 'MUOM-WGT-5', deletedAt: null },
  })
  if (!weightTolerance) {
    weightTolerance = await prisma.masterReceivingTolerance.create({
      data: {
        tenantId: tenant.id,
        code: 'MUOM-WGT-5',
        name: 'MUOM Weight 5%',
        percentage: 5,
        status: 'ACTIVE',
      },
    })
  }

  for (const spec of ITEMS) {
    const purchaseUomId = spec.purchaseUomCode === 'KG' ? kgId : mtrId
    const receivingToleranceId = spec.qtyTolerancePct > 0 ? qtyTolerance.id : null
    const weightReceivingToleranceId = spec.weightTolerancePct > 0 ? weightTolerance.id : null

    const item = await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: spec.code } },
      create: {
        tenantId: tenant.id,
        code: spec.code,
        name: spec.name,
        itemDescription: spec.name,
        categoryId: category.id,
        baseUomId: nosId,
        purchaseUomId,
        uomConversionFactor: spec.factor,
        purchaseQtyPerUom: spec.factor,
        itemType: 'raw_material',
        isPurchasable: true,
        isStockable: true,
        receivingToleranceId,
        weightReceivingToleranceId,
        receiptEntryMode: spec.weightTolerancePct > 0 ? 'UNIT_AND_WEIGHT' : 'UNIT_ONLY',
        status: 'ACTIVE',
      },
      update: {
        name: spec.name,
        purchaseUomId,
        uomConversionFactor: spec.factor,
        purchaseQtyPerUom: spec.factor,
        receivingToleranceId,
        weightReceivingToleranceId,
        receiptEntryMode: spec.weightTolerancePct > 0 ? 'UNIT_AND_WEIGHT' : 'UNIT_ONLY',
      },
    })

    await prisma.masterItemUomConversion.deleteMany({ where: { tenantId: tenant.id, itemId: item.id } })
    await prisma.masterItemUomConversion.createMany({
      data: [
        {
          tenantId: tenant.id,
          itemId: item.id,
          uomId: nosId,
          conversionFactor: 1,
          isPurchaseAllowed: true,
          isDefaultPurchase: false,
        },
        {
          tenantId: tenant.id,
          itemId: item.id,
          uomId: purchaseUomId,
          conversionFactor: spec.factor,
          isPurchaseAllowed: true,
          isDefaultPurchase: true,
        },
      ],
    })

    console.log(`✓ ${spec.code} — 1 ${spec.baseUomCode} = ${spec.factor} ${spec.purchaseUomCode}`)
  }

  console.log(`Done. Tenant: ${TENANT_SLUG}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
