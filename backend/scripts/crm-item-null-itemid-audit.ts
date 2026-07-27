/**
 * Phase 9 readiness: count null/missing itemId on CRM commercial rows.
 * Usage: npx tsx scripts/crm-item-null-itemid-audit.ts --tenant=vasant-trailers
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../src/config/database.js'

async function resolveTenantId(slugOrId?: string): Promise<{ id: string; slug: string }> {
  if (!slugOrId) throw new Error('Pass --tenant=slug')
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    select: { id: true, slug: true },
  })
  if (!tenant) throw new Error(`Tenant not found: ${slugOrId}`)
  return tenant
}

function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--tenant='))
  const tenant = await resolveTenantId(arg?.slice('--tenant='.length))
  console.log(`Scoped to tenant ${tenant.slug} (${tenant.id})`)

  const [quotesNull, quotesOk, soNull, soOk, oppNull, oppTotal] = await Promise.all([
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM crm_quotations
      WHERE deletedAt IS NULL AND tenantId = ${tenant.id}
        AND (itemId IS NULL OR itemId = '')`,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM crm_quotations
      WHERE deletedAt IS NULL AND tenantId = ${tenant.id}
        AND itemId IS NOT NULL AND itemId <> ''`,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM crm_sales_orders
      WHERE deletedAt IS NULL AND tenantId = ${tenant.id}
        AND (itemId IS NULL OR itemId = '')`,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM crm_sales_orders
      WHERE deletedAt IS NULL AND tenantId = ${tenant.id}
        AND itemId IS NOT NULL AND itemId <> ''`,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM crm_opportunity_lines
      WHERE tenantId = ${tenant.id} AND (itemId IS NULL OR itemId = '')`,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM crm_opportunity_lines WHERE tenantId = ${tenant.id}`,
  ])

  const docs = await prisma.crmQuotationDocument.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, priceLines: true },
  })
  let quoteLinesMissing = 0
  let quoteLinesTotal = 0
  for (const doc of docs) {
    for (const line of parseJsonArray(doc.priceLines) as Array<{ isOptional?: boolean; itemId?: string | null }>) {
      if (line?.isOptional) continue
      quoteLinesTotal++
      if (!line?.itemId) quoteLinesMissing++
    }
  }

  const sos = await prisma.crmSalesOrder.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, lines: true },
  })
  let soLinesMissing = 0
  let soLinesTotal = 0
  for (const so of sos) {
    for (const line of parseJsonArray(so.lines) as Array<{ itemId?: string | null }>) {
      soLinesTotal++
      if (!line?.itemId) soLinesMissing++
    }
  }

  const report = {
    quotations_null_itemId: Number(quotesNull[0]?.c ?? 0),
    quotations_with_itemId: Number(quotesOk[0]?.c ?? 0),
    salesOrders_null_itemId: Number(soNull[0]?.c ?? 0),
    salesOrders_with_itemId: Number(soOk[0]?.c ?? 0),
    opportunityLines_null_itemId: Number(oppNull[0]?.c ?? 0),
    opportunityLines_total: Number(oppTotal[0]?.c ?? 0),
    quote_price_lines_total: quoteLinesTotal,
    quote_price_lines_missing_itemId: quoteLinesMissing,
    so_lines_total: soLinesTotal,
    so_lines_missing_itemId: soLinesMissing,
  }
  console.log('\nNull itemId audit (Phase 9 gate)\n')
  console.table(report)

  const blockers =
    report.opportunityLines_null_itemId
    + report.quote_price_lines_missing_itemId
    + report.so_lines_missing_itemId
  // Header nulls may remain until dual-write period ends if lines carry itemId —
  // Phase 9 line enforcement requires line blockers = 0.
  console.log(`\nLine-level blockers: ${blockers}`)
  console.log(`Header quote null itemId: ${report.quotations_null_itemId}`)
  console.log(`Header SO null itemId: ${report.salesOrders_null_itemId}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
