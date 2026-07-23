/**
 * CRM Product → Item migration metrics (Phase 2 DoR).
 *
 * Usage:
 *   npx tsx scripts/crm-item-migration-metrics.ts
 *   npx tsx scripts/crm-item-migration-metrics.ts --tenant=vasant-trailers
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../src/config/database.js'

type Counts = Record<string, number>

async function countProductsMissingFg(tenantId?: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c
    FROM master_products
    WHERE deletedAt IS NULL
      AND (fgItemId IS NULL OR fgItemId = '')
      ${tenantId ? Prisma.sql`AND tenantId = ${tenantId}` : Prisma.empty}
  `
  return Number(rows[0]?.c ?? 0)
}

async function countOppLinesProductWithoutItem(tenantId?: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c
    FROM crm_opportunity_lines
    WHERE productId IS NOT NULL
      AND productId <> ''
      AND (itemId IS NULL OR itemId = '')
      ${tenantId ? Prisma.sql`AND tenantId = ${tenantId}` : Prisma.empty}
  `
  return Number(rows[0]?.c ?? 0)
}

async function countOppLinesWithItem(tenantId?: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c
    FROM crm_opportunity_lines
    WHERE itemId IS NOT NULL AND itemId <> ''
      ${tenantId ? Prisma.sql`AND tenantId = ${tenantId}` : Prisma.empty}
  `
  return Number(rows[0]?.c ?? 0)
}

async function countSalesOrdersWithProductJson(tenantId?: string): Promise<number> {
  // Heuristic: SO lines JSON containing "productId" (Phase 4 backfill scope).
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c
    FROM crm_sales_orders
    WHERE deletedAt IS NULL
      AND \`lines\` IS NOT NULL
      AND CAST(\`lines\` AS CHAR) LIKE '%"productId"%'
      ${tenantId ? Prisma.sql`AND tenantId = ${tenantId}` : Prisma.empty}
  `
  return Number(rows[0]?.c ?? 0)
}

async function countQuotationsWithProduct(tenantId?: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c
    FROM crm_quotations
    WHERE deletedAt IS NULL
      AND productId IS NOT NULL
      AND productId <> ''
      ${tenantId ? Prisma.sql`AND tenantId = ${tenantId}` : Prisma.empty}
  `
  return Number(rows[0]?.c ?? 0)
}

async function countItemsSalesAllowed(tenantId?: string): Promise<{ allowed: number; total: number }> {
  const base = { deletedAt: null as null, ...(tenantId ? { tenantId } : {}) }
  const [total, allowed] = await Promise.all([
    prisma.masterItem.count({ where: base }),
    prisma.masterItem.count({ where: { ...base, salesAllowed: true } }),
  ])
  return { total, allowed }
}

async function resolveTenantId(slugOrId?: string): Promise<string | undefined> {
  if (!slugOrId) return undefined
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    select: { id: true, slug: true },
  })
  if (!tenant) {
    throw new Error(`Tenant not found: ${slugOrId}`)
  }
  console.log(`Scoped to tenant ${tenant.slug} (${tenant.id})`)
  return tenant.id
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--tenant='))
  const tenantId = await resolveTenantId(arg?.slice('--tenant='.length))

  const productsMissingFg = await countProductsMissingFg(tenantId)
  const oppProductNoItem = await countOppLinesProductWithoutItem(tenantId)
  const oppWithItem = await countOppLinesWithItem(tenantId)
  const soWithProductJson = await countSalesOrdersWithProductJson(tenantId)
  const quotesWithProduct = await countQuotationsWithProduct(tenantId)
  const items = await countItemsSalesAllowed(tenantId)

  const report: Counts & { itemsTotal: number; itemsSalesAllowed: number } = {
    productsMissingFgItemId: productsMissingFg,
    opportunityLines_productWithoutItemId: oppProductNoItem,
    opportunityLines_withItemId: oppWithItem,
    salesOrders_jsonContainsProductId: soWithProductJson,
    quotations_headerProductId: quotesWithProduct,
    itemsTotal: items.total,
    itemsSalesAllowed: items.allowed,
  }

  console.log('\nCRM Item migration metrics (Phase 2)\n')
  console.table(report)
  console.log(
    '\nAgreements:\n' +
      '- Interim sales pricing: MasterItem.defaultSalesRate (price-list tables deferred)\n' +
      '- Lead storage: keep encoded JSON through Phase 5; optional crm_lead_interest_lines deferred\n',
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
