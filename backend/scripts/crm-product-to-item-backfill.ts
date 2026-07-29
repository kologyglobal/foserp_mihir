/**
 * Phase 4: Backfill CRM productId → itemId via MasterProduct.fgItemId.
 *
 * Usage:
 *   npx tsx scripts/crm-product-to-item-backfill.ts --dry-run
 *   npx tsx scripts/crm-product-to-item-backfill.ts --tenant=vasant-trailers
 *   npx tsx scripts/crm-product-to-item-backfill.ts
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../src/config/prisma.js'

type ExceptionRow = {
  module: string
  documentType: string
  documentId: string
  lineId?: string
  productId: string
  reason: string
}

async function resolveTenantId(slugOrId?: string): Promise<string | undefined> {
  if (!slugOrId) return undefined
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
    select: { id: true, slug: true },
  })
  if (!tenant) throw new Error(`Tenant not found: ${slugOrId}`)
  console.log(`Scoped to tenant ${tenant.slug} (${tenant.id})`)
  return tenant.id
}

async function loadProductFgMap(tenantId?: string): Promise<Map<string, string>> {
  const rows = await prisma.masterProduct.findMany({
    where: {
      deletedAt: null,
      ...(tenantId ? { tenantId } : {}),
      fgItemId: { not: null },
    },
    select: { id: true, fgItemId: true },
  })
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.fgItemId?.trim()) map.set(row.id, row.fgItemId.trim())
  }
  return map
}

function resolveProductToItem(
  productId: string | null | undefined,
  fgMap: Map<string, string>,
  exceptions: ExceptionRow[],
  ctx: Omit<ExceptionRow, 'productId' | 'reason'>,
): string | null {
  if (!productId?.trim()) return null
  const itemId = fgMap.get(productId)
  if (!itemId) {
    exceptions.push({
      ...ctx,
      productId,
      reason: 'Missing fgItemId on MasterProduct',
    })
    return null
  }
  return itemId
}

async function backfillOpportunityLines(
  fgMap: Map<string, string>,
  tenantId: string | undefined,
  dryRun: boolean,
  exceptions: ExceptionRow[],
): Promise<number> {
  const rows = await prisma.crmOpportunityLine.findMany({
    where: {
      productId: { not: null },
      OR: [{ itemId: null }, { itemId: '' }],
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, tenantId: true, opportunityId: true, productId: true },
  })
  let updated = 0
  for (const row of rows) {
    const itemId = resolveProductToItem(row.productId, fgMap, exceptions, {
      module: 'crm',
      documentType: 'opportunity_line',
      documentId: row.opportunityId,
      lineId: row.id,
    })
    if (!itemId) continue
    if (!dryRun) {
      await prisma.crmOpportunityLine.update({
        where: { id: row.id },
        data: { itemId },
      })
    }
    updated += 1
  }
  return updated
}

async function backfillQuotationHeaders(
  fgMap: Map<string, string>,
  tenantId: string | undefined,
  dryRun: boolean,
  exceptions: ExceptionRow[],
): Promise<number> {
  const rows = await prisma.crmQuotation.findMany({
    where: {
      deletedAt: null,
      productId: { not: null },
      OR: [{ itemId: null }, { itemId: '' }],
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, productId: true },
  })
  let updated = 0
  for (const row of rows) {
    const itemId = resolveProductToItem(row.productId, fgMap, exceptions, {
      module: 'crm',
      documentType: 'quotation',
      documentId: row.id,
    })
    if (!itemId) continue
    if (!dryRun) {
      await prisma.crmQuotation.update({ where: { id: row.id }, data: { itemId } })
    }
    updated += 1
  }
  return updated
}

async function backfillQuotationPriceLines(
  fgMap: Map<string, string>,
  tenantId: string | undefined,
  dryRun: boolean,
  exceptions: ExceptionRow[],
): Promise<number> {
  const docs = await prisma.crmQuotationDocument.findMany({
    where: {
      deletedAt: null,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, quotationId: true, priceLines: true },
  })
  let updated = 0
  for (const doc of docs) {
    const lines = Array.isArray(doc.priceLines) ? (doc.priceLines as Array<Record<string, unknown>>) : []
    let changed = false
    const next = lines.map((line) => {
      if (line.itemId || !line.productId) return line
      const itemId = resolveProductToItem(String(line.productId), fgMap, exceptions, {
        module: 'crm',
        documentType: 'quotation_price_line',
        documentId: doc.quotationId,
        lineId: String(line.id ?? ''),
      })
      if (!itemId) return line
      changed = true
      return { ...line, itemId }
    })
    if (changed) {
      if (!dryRun) {
        await prisma.crmQuotationDocument.update({
          where: { id: doc.id },
          data: { priceLines: next as Prisma.InputJsonValue },
        })
      }
      updated += 1
    }
  }
  return updated
}

async function backfillSalesOrderHeaders(
  fgMap: Map<string, string>,
  tenantId: string | undefined,
  dryRun: boolean,
  exceptions: ExceptionRow[],
): Promise<number> {
  const rows = await prisma.crmSalesOrder.findMany({
    where: {
      deletedAt: null,
      productId: { not: null },
      OR: [{ itemId: null }, { itemId: '' }],
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, productId: true },
  })
  let updated = 0
  for (const row of rows) {
    const itemId = resolveProductToItem(row.productId, fgMap, exceptions, {
      module: 'crm',
      documentType: 'sales_order',
      documentId: row.id,
    })
    if (!itemId) continue
    if (!dryRun) {
      await prisma.crmSalesOrder.update({ where: { id: row.id }, data: { itemId } })
    }
    updated += 1
  }
  return updated
}

async function backfillSalesOrderLines(
  fgMap: Map<string, string>,
  tenantId: string | undefined,
  dryRun: boolean,
  exceptions: ExceptionRow[],
): Promise<number> {
  const orders = await prisma.crmSalesOrder.findMany({
    where: {
      deletedAt: null,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, lines: true },
  })
  let updated = 0
  for (const order of orders) {
    const lines = Array.isArray(order.lines) ? (order.lines as Array<Record<string, unknown>>) : []
    let changed = false
    const next = lines.map((line) => {
      if (line.itemId || !line.productId) return line
      const itemId = resolveProductToItem(String(line.productId), fgMap, exceptions, {
        module: 'crm',
        documentType: 'sales_order_line',
        documentId: order.id,
        lineId: String(line.id ?? ''),
      })
      if (!itemId) return line
      changed = true
      return { ...line, itemId }
    })
    if (changed) {
      if (!dryRun) {
        await prisma.crmSalesOrder.update({
          where: { id: order.id },
          data: { lines: next as Prisma.InputJsonValue },
        })
      }
      updated += 1
    }
  }
  return updated
}

async function backfillDispatchRequirements(
  fgMap: Map<string, string>,
  tenantId: string | undefined,
  dryRun: boolean,
  exceptions: ExceptionRow[],
): Promise<number> {
  const rows = await prisma.dispatchRequirement.findMany({
    where: {
      deletedAt: null,
      productId: { not: null },
      OR: [{ itemId: null }, { itemId: '' }],
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, productId: true, salesOrderId: true },
  })
  let updated = 0
  for (const row of rows) {
    const itemId = resolveProductToItem(row.productId, fgMap, exceptions, {
      module: 'dispatch',
      documentType: 'dispatch_requirement',
      documentId: row.id,
    })
    if (!itemId) continue
    if (!dryRun) {
      await prisma.dispatchRequirement.update({ where: { id: row.id }, data: { itemId } })
    }
    updated += 1
  }
  return updated
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const tenantArg = process.argv.find((a) => a.startsWith('--tenant='))
  const tenantId = await resolveTenantId(tenantArg?.slice('--tenant='.length))
  const fgMap = await loadProductFgMap(tenantId)
  const exceptions: ExceptionRow[] = []

  console.log(`\nCRM Product → Item backfill${dryRun ? ' (DRY RUN)' : ''}\n`)
  console.log(`Products with fgItemId: ${fgMap.size}`)

  const counts = {
    opportunityLines: await backfillOpportunityLines(fgMap, tenantId, dryRun, exceptions),
    quotationHeaders: await backfillQuotationHeaders(fgMap, tenantId, dryRun, exceptions),
    quotationPriceLines: await backfillQuotationPriceLines(fgMap, tenantId, dryRun, exceptions),
    salesOrderHeaders: await backfillSalesOrderHeaders(fgMap, tenantId, dryRun, exceptions),
    salesOrderLines: await backfillSalesOrderLines(fgMap, tenantId, dryRun, exceptions),
    dispatchRequirements: await backfillDispatchRequirements(fgMap, tenantId, dryRun, exceptions),
  }

  console.table(counts)
  console.log(`\nExceptions: ${exceptions.length}`)
  if (exceptions.length > 0) {
    console.table(exceptions.slice(0, 20))
    if (exceptions.length > 20) console.log(`… and ${exceptions.length - 20} more`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
