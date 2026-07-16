/**
 * Data cleanup: remove all opportunities + quotations; keep sales orders;
 * keep exactly one quotation template (STANDARD-TRAILER, or most complete fallback).
 *
 * Does NOT delete companies, contacts, leads, products, users, or sales orders.
 * Soft-deletes notes/attachments on OPPORTUNITY/QUOTATION entities.
 * Hard-deletes opportunities, quotations, documents, history, and extra templates
 * (sales_orders.quotationId / opportunityId are plain strings — null them for safety).
 *
 * Run (from backend/):
 *   npx tsx scripts/cleanup-opp-quotations.ts
 * Optional:
 *   TENANT_SLUG=vasant-trailers          (default)
 *   DRY_RUN=1                            (counts only, no writes)
 *   KEEP_TEMPLATE_CODE=STANDARD-TRAILER  (preferred keep code)
 */
import { CrmEntityType } from '@prisma/client'
import { prisma } from '../src/config/database.js'
const slug = process.env.TENANT_SLUG ?? 'vasant-trailers'
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
const preferredTemplateCode = process.env.KEEP_TEMPLATE_CODE ?? 'STANDARD-TRAILER'

type Counts = {
  opportunities: number
  opportunitiesActive: number
  quotations: number
  quotationsActive: number
  quotationDocuments: number
  quotationTemplates: number
  quotationTemplatesActive: number
  salesOrders: number
  salesOrdersActive: number
}

async function collectCounts(tenantId: string): Promise<Counts> {
  return {
    opportunities: await prisma.crmOpportunity.count({ where: { tenantId } }),
    opportunitiesActive: await prisma.crmOpportunity.count({
      where: { tenantId, deletedAt: null },
    }),
    quotations: await prisma.crmQuotation.count({ where: { tenantId } }),
    quotationsActive: await prisma.crmQuotation.count({
      where: { tenantId, deletedAt: null },
    }),
    quotationDocuments: await prisma.crmQuotationDocument.count({ where: { tenantId } }),
    quotationTemplates: await prisma.crmQuotationTemplate.count({ where: { tenantId } }),
    quotationTemplatesActive: await prisma.crmQuotationTemplate.count({
      where: { tenantId, deletedAt: null },
    }),
    salesOrders: await prisma.crmSalesOrder.count({ where: { tenantId } }),
    salesOrdersActive: await prisma.crmSalesOrder.count({
      where: { tenantId, deletedAt: null },
    }),
  }
}

function sectionCount(sections: unknown): number {
  return Array.isArray(sections) ? sections.length : 0
}

async function pickKeepTemplate(tenantId: string) {
  const templates = await prisma.crmQuotationTemplate.findMany({
    where: { tenantId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  })

  if (templates.length === 0) return null

  const preferred =
    templates.find((t) => t.code === preferredTemplateCode && t.deletedAt == null) ??
    templates.find((t) => t.code === preferredTemplateCode)

  if (preferred) return preferred

  const active = templates.filter((t) => t.deletedAt == null)
  const pool = active.length > 0 ? active : templates
  return [...pool].sort((a, b) => sectionCount(b.sections) - sectionCount(a.sections))[0]!
}

async function ensureOneTemplate(tenantId: string, createdBy: string | null) {
  let keep = await pickKeepTemplate(tenantId)

  if (!keep) {
    keep = await prisma.crmQuotationTemplate.create({
      data: {
        tenantId,
        code: preferredTemplateCode,
        templateName: 'Standard Trailer Quotation',
        productFamily: 'Trailer',
        version: 1,
        sections: [
          {
            sectionType: 'cover',
            title: 'Cover Page',
            content: 'Standard Trailer — Quotation',
            sequenceNo: 1,
            editable: true,
          },
          {
            sectionType: 'commercial',
            title: 'Commercial Offer',
            content: 'Pricing as per attached price table. Validity 30 days from date of issue.',
            sequenceNo: 2,
            editable: true,
          },
          {
            sectionType: 'terms',
            title: 'Terms & Conditions',
            content: 'Standard terms of sale apply.',
            sequenceNo: 3,
            editable: true,
          },
        ],
        defaultTerms: 'Prices valid for 30 days. Subject to force majeure.',
        defaultWarranty: '12 months manufacturing warranty.',
        defaultExclusions: 'Registration and insurance excluded.',
        isActive: true,
        createdBy: createdBy ?? undefined,
        updatedBy: createdBy ?? undefined,
      },
    })
    console.log(`  Seeded missing template: ${keep.code} (${keep.id})`)
    return { keep, removed: 0 }
  }

  // Restore kept template if it was soft-deleted
  if (keep.deletedAt != null || !keep.isActive) {
    keep = await prisma.crmQuotationTemplate.update({
      where: { id: keep.id },
      data: { deletedAt: null, isActive: true, updatedBy: createdBy ?? undefined },
    })
  }

  const removed = await prisma.crmQuotationTemplate.deleteMany({
    where: { tenantId, id: { not: keep.id } },
  })

  return { keep, removed: removed.count }
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  if (!tenant) {
    console.error(`Tenant not found: ${slug}`)
    process.exit(1)
  }

  const tenantId = tenant.id
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Cleaning opportunities/quotations for ${slug} (${tenantId})`,
  )
  console.log(`Keep template code preference: ${preferredTemplateCode}`)

  const before = await collectCounts(tenantId)
  console.log('\nBEFORE:', JSON.stringify(before, null, 2))

  const soSnapshot = await prisma.crmSalesOrder.findMany({
    where: { tenantId },
    select: { id: true, salesOrderNo: true, quotationId: true, opportunityId: true, deletedAt: true },
    orderBy: { salesOrderNo: 'asc' },
  })
  console.log(`Sales orders before (${soSnapshot.length}):`)
  for (const so of soSnapshot) {
    console.log(
      `  ${so.salesOrderNo} id=${so.id} quote=${so.quotationId ?? '-'} opp=${so.opportunityId ?? '-'} deleted=${so.deletedAt ? 'yes' : 'no'}`,
    )
  }

  if (dryRun) {
    const keep = await pickKeepTemplate(tenantId)
    console.log(
      '\nWould keep template:',
      keep
        ? `${keep.code} | ${keep.templateName} | id=${keep.id}`
        : `(none — would seed ${preferredTemplateCode})`,
    )
    console.log('DRY_RUN=1 — no writes performed.')
    return
  }

  const now = new Date()
  const stats: Record<string, number> = {}

  await prisma.$transaction(async (tx) => {
    // 1) Protect sales orders: clear optional source FKs (plain string fields; no cascade risk)
    const soCleared = await tx.crmSalesOrder.updateMany({
      where: {
        tenantId,
        OR: [{ quotationId: { not: null } }, { opportunityId: { not: null } }, { quotationDocumentId: { not: null } }],
      },
      data: {
        quotationId: null,
        quotationDocumentId: null,
        opportunityId: null,
        // keep quotationNo / quotationRevisionNo / salesOrderNo history text for display
      },
    })
    stats.salesOrdersClearedLinks = soCleared.count

    // 2) Soft-delete notes/attachments on OPPORTUNITY + QUOTATION
    const notes = await tx.crmNote.updateMany({
      where: {
        tenantId,
        deletedAt: null,
        entityType: { in: [CrmEntityType.OPPORTUNITY, CrmEntityType.QUOTATION] },
      },
      data: { deletedAt: now },
    })
    stats.notesSoftDeleted = notes.count

    const attachments = await tx.crmAttachment.updateMany({
      where: {
        tenantId,
        deletedAt: null,
        entityType: { in: [CrmEntityType.OPPORTUNITY, CrmEntityType.QUOTATION] },
      },
      data: { deletedAt: now },
    })
    stats.attachmentsSoftDeleted = attachments.count

    // 3) Detach activities / follow-ups / leads from opportunities (avoid FK blocks)
    const acts = await tx.crmActivity.updateMany({
      where: { tenantId, opportunityId: { not: null } },
      data: { opportunityId: null },
    })
    stats.activitiesDetached = acts.count

    const fus = await tx.crmFollowUp.updateMany({
      where: { tenantId, opportunityId: { not: null } },
      data: { opportunityId: null },
    })
    stats.followUpsDetached = fus.count

    const leads = await tx.crmLead.updateMany({
      where: { tenantId, opportunityId: { not: null } },
      data: { opportunityId: null },
    })
    stats.leadsDetached = leads.count

    // 4) Quotation documents then quotations (documents cascade on quote delete, but delete many is explicit)
    const docs = await tx.crmQuotationDocument.deleteMany({ where: { tenantId } })
    stats.quotationDocumentsDeleted = docs.count

    const quotes = await tx.crmQuotation.deleteMany({ where: { tenantId } })
    stats.quotationsDeleted = quotes.count

    // 5) Opportunity children / history, then opportunities
    const lines = await tx.crmOpportunityLine.deleteMany({ where: { tenantId } })
    stats.opportunityLinesDeleted = lines.count

    const stageH = await tx.crmOpportunityStageHistory.deleteMany({ where: { tenantId } })
    stats.oppStageHistoryDeleted = stageH.count

    const assignH = await tx.crmOpportunityAssignmentHistory.deleteMany({ where: { tenantId } })
    stats.oppAssignmentHistoryDeleted = assignH.count

    const amountH = await tx.crmOpportunityAmountHistory.deleteMany({ where: { tenantId } })
    stats.oppAmountHistoryDeleted = amountH.count

    const statusH = await tx.crmOpportunityStatusHistory.deleteMany({ where: { tenantId } })
    stats.oppStatusHistoryDeleted = statusH.count

    const opps = await tx.crmOpportunity.deleteMany({ where: { tenantId } })
    stats.opportunitiesDeleted = opps.count
  })

  // Templates outside main wipe so keep/seed logic stays readable
  const admin = await prisma.user.findFirst({
    where: { tenantId, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  const { keep, removed } = await ensureOneTemplate(tenantId, admin?.id ?? null)
  stats.templatesRemoved = removed

  const after = await collectCounts(tenantId)
  console.log('\nCleanup actions:', JSON.stringify(stats, null, 2))
  console.log('\nAFTER:', JSON.stringify(after, null, 2))

  console.log(
    `\nKept quotation template: ${keep.code} | ${keep.templateName} | id=${keep.id} | family=${keep.productFamily}`,
  )

  const soAfter = await prisma.crmSalesOrder.findMany({
    where: { tenantId },
    select: { id: true, salesOrderNo: true, deletedAt: true },
    orderBy: { salesOrderNo: 'asc' },
  })
  const beforeIds = new Set(soSnapshot.map((s) => s.id))
  const afterIds = new Set(soAfter.map((s) => s.id))
  const missing = [...beforeIds].filter((id) => !afterIds.has(id))
  const extra = [...afterIds].filter((id) => !beforeIds.has(id))

  if (missing.length || extra.length || soAfter.length !== soSnapshot.length) {
    console.error('\nWARNING: sales order set changed!', { missing, extra })
    process.exit(2)
  }

  console.log(`\nSales orders untouched: ${soAfter.length} rows (same ids).`)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
