/**
 * Seed Product Master catalog (MasterProduct + FG items) for vasant-trailers.
 * Idempotent by product/item code. Uses the same rows as prisma/seed.ts.
 * Usage: npx tsx scripts/seed-products.ts
 */
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PRODUCT_SEED_ROWS, VASANT_FG_ITEM_SEED } from '../prisma/productSeedData.js'

config()

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

process.env.DATABASE_URL = buildDatabaseUrl()

const prisma = new PrismaClient()
const TENANT_SLUG = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, email: 'admin@vasant-trailers.com' },
  })
  const actorId = admin?.id ?? (await prisma.user.findFirst({ where: { tenantId: tenant.id, deletedAt: null } }))?.id
  if (!actorId) throw new Error('No tenant user found for createdBy')

  const nosUom = await prisma.masterUom.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'Nos' } },
    create: {
      tenantId: tenant.id,
      code: 'Nos',
      name: 'Numbers',
      description: 'Each / unit count',
      uomType: 'integer',
      decimalPlaces: 0,
      isBaseUnit: true,
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Numbers' },
  })

  // Prefer NOS if seed-uoms already created it
  const nosAlt = await prisma.masterUom.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, code: { in: ['NOS', 'Nos'] } },
    orderBy: { code: 'asc' },
  })
  const baseUomId = nosAlt?.id ?? nosUom.id

  const fgCategory = await prisma.masterItemCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CAT-FG' } },
    create: {
      tenantId: tenant.id,
      code: 'CAT-FG',
      name: 'Finished Goods',
      level: 1,
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Finished Goods' },
  })

  const fgItemIdByCode = new Map<string, string>()
  const fgItemSeed = [
    ...VASANT_FG_ITEM_SEED,
    { code: 'FG-45M3-BULKER', name: '45 M3 Bulker Trailer', standardRate: 2850000 },
    { code: 'FG-ISO-TANK-26K', name: '26 KL ISO Tank', standardRate: 4200000 },
    { code: 'FG-SIDEWALL-32FT', name: '32 FT Side Wall Trailer', standardRate: 1950000 },
  ]
  const fgSeen = new Set<string>()
  let fgCreated = 0
  let fgUpdated = 0
  for (const fg of fgItemSeed) {
    if (fgSeen.has(fg.code)) continue
    fgSeen.add(fg.code)
    const existing = await prisma.masterItem.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: fg.code } },
    })
    const item = await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: fg.code } },
      create: {
        tenantId: tenant.id,
        code: fg.code,
        name: fg.name,
        itemDescription: fg.name,
        categoryId: fgCategory.id,
        baseUomId,
        itemType: 'finished_good',
        productType: 'finish_product',
        inventoryType: 'inventory',
        hsnCode: '8716',
        standardRate: fg.standardRate,
        isPurchasable: false,
        isStockable: true,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: fg.name,
        itemDescription: fg.name,
        categoryId: fgCategory.id,
        baseUomId,
        itemType: 'finished_good',
        productType: 'finish_product',
        standardRate: fg.standardRate,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    fgItemIdByCode.set(fg.code, item.id)
    if (existing) fgUpdated += 1
    else fgCreated += 1
  }

  let productCreated = 0
  let productUpdated = 0
  for (const row of PRODUCT_SEED_ROWS) {
    const fgItemId = row.fgItemCode ? fgItemIdByCode.get(row.fgItemCode) ?? null : null
    const existing = await prisma.masterProduct.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
    })
    await prisma.masterProduct.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        productFamily: row.productFamily,
        productType: row.productType,
        fgItemId,
        capacity: row.capacity,
        axleConfig: row.axleConfig,
        tareWeightKg: row.tareWeightKg,
        gvwKg: row.gvwKg,
        standardPrice: row.standardPrice,
        standardLeadDays: row.standardLeadDays,
        baseUomId,
        hsnCode: row.hsnCode,
        specifications: row.specifications,
        productStatus: row.productStatus,
        details: row.details,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: row.name,
        productFamily: row.productFamily,
        productType: row.productType,
        fgItemId,
        capacity: row.capacity,
        axleConfig: row.axleConfig,
        tareWeightKg: row.tareWeightKg,
        gvwKg: row.gvwKg,
        standardPrice: row.standardPrice,
        standardLeadDays: row.standardLeadDays,
        baseUomId,
        hsnCode: row.hsnCode,
        specifications: row.specifications,
        productStatus: row.productStatus,
        details: row.details,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    if (existing) {
      productUpdated += 1
      console.log(`  ~ product ${row.code}`)
    } else {
      productCreated += 1
      console.log(`  ✓ product ${row.code}`)
    }
  }

  const total = await prisma.masterProduct.count({ where: { tenantId: tenant.id, deletedAt: null } })
  console.log(`\nDone. FG items: +${fgCreated} / ~${fgUpdated}. Products: +${productCreated} / ~${productUpdated}. Total products: ${total}`)
  console.log('Refresh /masters/products to see the catalog.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
