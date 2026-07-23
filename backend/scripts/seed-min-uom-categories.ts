/**
 * Upsert minimum UOM set + core item categories with stock policies.
 * Usage: npx tsx scripts/seed-min-uom-categories.ts
 */
import { prisma } from '../src/config/database.js'
import { ITEM_CATEGORY_SEED_ROWS, UOM_SEED_ROWS } from '../prisma/uomCategorySeedData.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found`)

  console.log(`Seeding min UOM + categories for ${tenant.slug}…`)

  for (const row of UOM_SEED_ROWS) {
    await prisma.masterUom.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        description: row.description,
        uomType: row.uomType,
        decimalPlaces: row.decimalPlaces,
        isBaseUnit: row.isBaseUnit,
        status: 'ACTIVE',
      },
      update: {
        name: row.name,
        description: row.description,
        uomType: row.uomType,
        decimalPlaces: row.decimalPlaces,
        isBaseUnit: row.isBaseUnit,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    console.log(`  UOM ${row.code}`)
  }

  // Legacy Nos alias (case-insensitive DB may already map to NOS)
  await prisma.masterUom
    .upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: 'Nos' } },
      create: {
        tenantId: tenant.id,
        code: 'Nos',
        name: 'Numbers',
        description: 'Legacy alias for NOS',
        uomType: 'integer',
        decimalPlaces: 0,
        isBaseUnit: true,
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', deletedAt: null, name: 'Numbers' },
    })
    .catch(() => {
      /* CI unique: NOS already covers Nos */
    })

  for (const row of ITEM_CATEGORY_SEED_ROWS) {
    await prisma.masterItemCategory.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        level: row.level,
        stockPolicy: row.stockPolicy,
        defaultIsStockable: row.defaultIsStockable,
        defaultInventoryType: row.defaultInventoryType,
        status: 'ACTIVE',
      },
      update: {
        name: row.name,
        level: row.level,
        stockPolicy: row.stockPolicy,
        defaultIsStockable: row.defaultIsStockable,
        defaultInventoryType: row.defaultInventoryType,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    console.log(`  CAT ${row.code} — stock ${row.stockPolicy}`)
  }

  const fg = ITEM_CATEGORY_SEED_ROWS.find((r) => r.code === 'FG')!
  await prisma.masterItemCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CAT-FG' } },
    create: {
      tenantId: tenant.id,
      code: 'CAT-FG',
      name: 'Finished Goods',
      level: 1,
      stockPolicy: fg.stockPolicy,
      defaultIsStockable: fg.defaultIsStockable,
      defaultInventoryType: fg.defaultInventoryType,
      status: 'ACTIVE',
    },
    update: {
      stockPolicy: fg.stockPolicy,
      defaultIsStockable: fg.defaultIsStockable,
      defaultInventoryType: fg.defaultInventoryType,
      status: 'ACTIVE',
      deletedAt: null,
    },
  })
  console.log('  CAT CAT-FG (legacy alias)')

  // Point seeded FG items at FG category + NOS when present
  const fgCat = await prisma.masterItemCategory.findFirst({
    where: { tenantId: tenant.id, code: 'FG', deletedAt: null },
  })
  const nos = await prisma.masterUom.findFirst({
    where: { tenantId: tenant.id, code: { in: ['NOS', 'Nos'] }, deletedAt: null },
  })
  if (fgCat) {
    const updated = await prisma.masterItem.updateMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        itemType: 'finished_good',
      },
      data: {
        categoryId: fgCat.id,
        ...(nos ? { baseUomId: nos.id } : {}),
        isStockable: true,
        inventoryType: 'inventory',
      },
    })
    console.log(`  Linked ${updated.count} finished-good item(s) → FG / NOS`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
