/**
 * Data cleanup: remove all CRM sales orders (+ clear reverse SO links).
 *
 * Does NOT delete companies, contacts, leads, opportunities, quotations,
 * quotation templates, users, masters, or purchase data.
 *
 * Notes:
 *  - SO line items are JSON on `crm_sales_orders.lines` (removed with the row).
 *  - There is no `crm_sales_order_*` status-history child table.
 *  - `CrmEntityType` has no SALES_ORDER — entity notes/attachments on SO are N/A.
 *  - Quotation / quotation-document `salesOrderId` / `salesOrderNo` are plain
 *    strings (no FK). Clear them so parents are not deleted.
 *
 * Order (FK-safe):
 *  1. Clear quotation + quotation-document salesOrderId / salesOrderNo
 *  2. Hard-delete all sales orders (active + soft-deleted)
 *
 * Run (from backend/):
 *   npx tsx scripts/cleanup-sales-orders.ts
 * Optional:
 *   TENANT_SLUG=vasant-trailers   (default; use ALL to wipe every tenant)
 *   DRY_RUN=1                     (counts only, no writes)
 */
import { config } from 'dotenv'
import { PrismaClient, Prisma } from '@prisma/client'

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
const slugArg = process.env.TENANT_SLUG ?? 'vasant-trailers'
const allTenants = slugArg.toUpperCase() === 'ALL'
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

type Counts = {
  salesOrders: number
  salesOrdersActive: number
  quotationsWithSoId: number
  quotationDocsWithSoId: number
  companies: number
  contacts: number
  leads: number
  opportunities: number
  quotations: number
  quotationTemplates: number
}

async function collectCounts(tenantId: string): Promise<Counts> {
  return {
    salesOrders: await prisma.crmSalesOrder.count({ where: { tenantId } }),
    salesOrdersActive: await prisma.crmSalesOrder.count({
      where: { tenantId, deletedAt: null },
    }),
    quotationsWithSoId: await prisma.crmQuotation.count({
      where: { tenantId, salesOrderId: { not: null } },
    }),
    quotationDocsWithSoId: await prisma.crmQuotationDocument.count({
      where: { tenantId, salesOrderId: { not: null } },
    }),
    companies: await prisma.crmCompany.count({ where: { tenantId } }),
    contacts: await prisma.crmContact.count({ where: { tenantId } }),
    leads: await prisma.crmLead.count({ where: { tenantId } }),
    opportunities: await prisma.crmOpportunity.count({ where: { tenantId } }),
    quotations: await prisma.crmQuotation.count({ where: { tenantId } }),
    quotationTemplates: await prisma.crmQuotationTemplate.count({ where: { tenantId } }),
  }
}

async function cleanupTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<Record<string, number>> {
  const stats: Record<string, number> = {}

  // 1) Clear reverse links on quotations / documents (plain string fields — no FK)
  const quotesCleared = await tx.crmQuotation.updateMany({
    where: {
      tenantId,
      OR: [{ salesOrderId: { not: null } }, { salesOrderNo: { not: null } }],
    },
    data: { salesOrderId: null, salesOrderNo: null },
  })
  stats.quotationsClearedSoLinks = quotesCleared.count

  const docsCleared = await tx.crmQuotationDocument.updateMany({
    where: {
      tenantId,
      OR: [{ salesOrderId: { not: null } }, { salesOrderNo: { not: null } }],
    },
    data: { salesOrderId: null, salesOrderNo: null },
  })
  stats.quotationDocsClearedSoLinks = docsCleared.count

  // 2) Hard-delete all sales orders (lines JSON + soft-deleted rows included)
  const sos = await tx.crmSalesOrder.deleteMany({ where: { tenantId } })
  stats.salesOrdersDeleted = sos.count

  return stats
}

async function resolveTenants(): Promise<{ id: string; slug: string }[]> {
  if (allTenants) {
    return prisma.tenant.findMany({ select: { id: true, slug: true }, orderBy: { slug: 'asc' } })
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug: slugArg } })
  if (!tenant) {
    console.error(`Tenant not found: ${slugArg}`)
    process.exit(1)
  }
  return [{ id: tenant.id, slug: tenant.slug }]
}

async function main() {
  const tenants = await resolveTenants()

  // Global peek: any SOs outside selected tenants?
  if (!allTenants) {
    const byTenant = await prisma.crmSalesOrder.groupBy({
      by: ['tenantId'],
      _count: { _all: true },
    })
    if (byTenant.length > 0) {
      const tenantMap = Object.fromEntries(
        (await prisma.tenant.findMany({ select: { id: true, slug: true } })).map((t) => [
          t.id,
          t.slug,
        ]),
      )
      console.log('Sales order counts by tenant (all DB):')
      for (const row of byTenant) {
        console.log(`  ${tenantMap[row.tenantId] ?? row.tenantId}: ${row._count._all}`)
      }
      console.log('')
    } else {
      console.log('Sales order counts by tenant (all DB): none\n')
    }
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Cleaning sales orders for ${allTenants ? 'ALL tenants' : slugArg} (${tenants.length} tenant(s))`,
  )

  const grandBefore: Record<string, Counts> = {}
  const grandAfter: Record<string, Counts> = {}
  const grandStats: Record<string, Record<string, number>> = {}

  for (const t of tenants) {
    const before = await collectCounts(t.id)
    grandBefore[t.slug] = before
    console.log(`\n=== ${t.slug} (${t.id}) ===`)
    console.log('BEFORE:', JSON.stringify(before, null, 2))

    const soSnapshot = await prisma.crmSalesOrder.findMany({
      where: { tenantId: t.id },
      select: {
        id: true,
        salesOrderNo: true,
        quotationId: true,
        opportunityId: true,
        deletedAt: true,
        status: true,
      },
      orderBy: { salesOrderNo: 'asc' },
    })
    console.log(`Sales orders (${soSnapshot.length}):`)
    for (const so of soSnapshot) {
      console.log(
        `  ${so.salesOrderNo} id=${so.id} status=${so.status} quote=${so.quotationId ?? '-'} opp=${so.opportunityId ?? '-'} deleted=${so.deletedAt ? 'yes' : 'no'}`,
      )
    }

    if (dryRun) {
      console.log('DRY_RUN=1 — no writes for this tenant.')
      continue
    }

    const stats = await prisma.$transaction((tx) => cleanupTenant(tx, t.id))
    grandStats[t.slug] = stats

    const after = await collectCounts(t.id)
    grandAfter[t.slug] = after

    console.log('Cleanup actions:', JSON.stringify(stats, null, 2))
    console.log('AFTER:', JSON.stringify(after, null, 2))

    // Guardrails: protected entities must not shrink
    const shrinks: string[] = []
    if (after.companies < before.companies) shrinks.push('companies')
    if (after.contacts < before.contacts) shrinks.push('contacts')
    if (after.leads < before.leads) shrinks.push('leads')
    if (after.opportunities < before.opportunities) shrinks.push('opportunities')
    if (after.quotations < before.quotations) shrinks.push('quotations')
    if (after.quotationTemplates < before.quotationTemplates) shrinks.push('quotationTemplates')
    if (shrinks.length) {
      console.error(`WARNING: protected entity counts dropped: ${shrinks.join(', ')}`)
      process.exit(2)
    }
    if (after.salesOrders !== 0 || after.salesOrdersActive !== 0) {
      console.error('WARNING: sales orders remain after cleanup')
      process.exit(2)
    }
    if (after.quotationsWithSoId !== 0 || after.quotationDocsWithSoId !== 0) {
      console.error('WARNING: quotation SO links remain after cleanup')
      process.exit(2)
    }
  }

  if (!dryRun) {
    console.log('\n--- Summary ---')
    for (const t of tenants) {
      const b = grandBefore[t.slug]!
      const a = grandAfter[t.slug]!
      const s = grandStats[t.slug]!
      console.log(
        `${t.slug}: salesOrders ${b.salesOrders} (${b.salesOrdersActive} active) → ${a.salesOrders} (${a.salesOrdersActive} active); ` +
          `cleared quote links=${s.quotationsClearedSoLinks ?? 0}, doc links=${s.quotationDocsClearedSoLinks ?? 0}`,
      )
    }
  }

  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
