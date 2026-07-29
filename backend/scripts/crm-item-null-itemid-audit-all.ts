/**
 * Global null itemId audit across all tenants (Phase 9 gate).
 * Usage: npx tsx scripts/crm-item-null-itemid-audit-all.ts
 */
import { prisma } from '../src/config/prisma.js'

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
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  })

  let totalBlockers = 0
  for (const tenant of tenants) {
    const [quotesNull, soNull, oppNull] = await Promise.all([
      prisma.crmQuotation.count({
        where: { tenantId: tenant.id, deletedAt: null, OR: [{ itemId: null }, { itemId: '' }] },
      }),
      prisma.crmSalesOrder.count({
        where: { tenantId: tenant.id, deletedAt: null, OR: [{ itemId: null }, { itemId: '' }] },
      }),
      prisma.crmOpportunityLine.count({
        where: { tenantId: tenant.id, OR: [{ itemId: null }, { itemId: '' }] },
      }),
    ])

    const docs = await prisma.crmQuotationDocument.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { priceLines: true },
    })
    let quoteLinesMissing = 0
    for (const doc of docs) {
      for (const line of parseJsonArray(doc.priceLines) as Array<{ isOptional?: boolean; itemId?: string | null }>) {
        if (line?.isOptional) continue
        if (!line?.itemId) quoteLinesMissing++
      }
    }

    const sos = await prisma.crmSalesOrder.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { lines: true },
    })
    let soLinesMissing = 0
    for (const so of sos) {
      for (const line of parseJsonArray(so.lines) as Array<{ itemId?: string | null }>) {
        if (!line?.itemId) soLinesMissing++
      }
    }

    const blockers = oppNull + quoteLinesMissing + soLinesMissing + quotesNull + soNull
    totalBlockers += blockers
    console.log(
      `${tenant.slug}: blockers=${blockers} (quoteH=${quotesNull} soH=${soNull} oppL=${oppNull} quoteL=${quoteLinesMissing} soL=${soLinesMissing})`,
    )
  }
  console.log(`\nTOTAL blockers: ${totalBlockers}`)
  if (totalBlockers > 0) process.exitCode = 2
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
