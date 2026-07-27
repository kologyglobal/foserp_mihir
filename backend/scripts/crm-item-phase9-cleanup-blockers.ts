/**
 * Inspect / soft-delete leftover CRM rows blocking Phase 9 NOT NULL.
 * Usage: npx tsx scripts/crm-item-phase9-cleanup-blockers.ts [--apply]
 */
import { prisma } from '../src/config/database.js'

const APPLY = process.argv.includes('--apply')

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

  for (const tenant of tenants) {
    const sos = await prisma.crmSalesOrder.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [{ itemId: null }, { itemId: '' }],
      },
      select: { id: true, salesOrderNo: true, productId: true, itemId: true, lines: true, status: true },
    })
    for (const so of sos) {
      const linesMissing = parseJsonArray(so.lines).filter(
        (l) => !(l as { itemId?: string | null })?.itemId,
      ).length
      console.log(
        `${tenant.slug} SO ${so.salesOrderNo} (${so.id}) status=${so.status} productId=${so.productId} linesMissingItem=${linesMissing}`,
      )
      if (APPLY) {
        await prisma.crmSalesOrder.update({
          where: { id: so.id },
          data: { deletedAt: new Date() },
        })
        console.log('  → soft-deleted')
      }
    }

    const quotes = await prisma.crmQuotation.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [{ itemId: null }, { itemId: '' }],
      },
      select: { id: true, quotationCode: true },
    })
    for (const q of quotes) {
      console.log(`${tenant.slug} QUOTE ${q.quotationCode} (${q.id}) null itemId`)
      if (APPLY) {
        await prisma.crmQuotation.update({
          where: { id: q.id },
          data: { deletedAt: new Date(), status: 'cancelled' },
        })
        console.log('  → soft-deleted')
      }
    }

    const oppLines = await prisma.crmOpportunityLine.findMany({
      where: { tenantId: tenant.id, OR: [{ itemId: null }, { itemId: '' }] },
      select: { id: true, opportunityId: true, productId: true },
    })
    for (const line of oppLines) {
      console.log(`${tenant.slug} OPP LINE ${line.id} opp=${line.opportunityId} productId=${line.productId}`)
      if (APPLY) {
        await prisma.crmOpportunityLine.delete({ where: { id: line.id } })
        console.log('  → deleted')
      }
    }
  }

  if (!APPLY) console.log('\nDry run only. Pass --apply to soft-delete/delete blockers.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
