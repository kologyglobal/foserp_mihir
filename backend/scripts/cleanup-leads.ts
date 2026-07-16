/**
 * Data cleanup: remove all CRM leads (+ safe related child data).
 *
 * Does NOT delete companies, contacts, opportunities, quotations, sales orders,
 * users, masters, or quotation templates.
 *
 * Order (FK-safe):
 *  1. Hard-delete notes/attachments on LEAD entities
 *  2. Hard-delete activities / follow-ups linked only to a lead
 *  3. Detach activities / follow-ups that also link company/contact/opp
 *  4. Clear opportunity.leadId source pointers (plain string, no FK)
 *  5. Hard-delete lead status history + assignments
 *  6. Hard-delete leads
 *
 * Run (from backend/):
 *   npx tsx scripts/cleanup-leads.ts
 * Optional:
 *   TENANT_SLUG=vasant-trailers   (default; use ALL to wipe every tenant)
 *   DRY_RUN=1                     (counts only, no writes)
 */
import { CrmEntityType, Prisma } from '@prisma/client'
import { prisma } from '../src/config/database.js'
const slugArg = process.env.TENANT_SLUG ?? 'vasant-trailers'
const allTenants = slugArg.toUpperCase() === 'ALL'
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

type Counts = {
  leads: number
  leadsActive: number
  leadStatusHistory: number
  leadAssignments: number
  activitiesWithLead: number
  followUpsWithLead: number
  notesLead: number
  notesLeadActive: number
  attachmentsLead: number
  attachmentsLeadActive: number
  opportunitiesWithLeadId: number
  companies: number
  contacts: number
  opportunities: number
  quotations: number
  salesOrders: number
}

async function collectCounts(tenantId: string): Promise<Counts> {
  return {
    leads: await prisma.crmLead.count({ where: { tenantId } }),
    leadsActive: await prisma.crmLead.count({ where: { tenantId, deletedAt: null } }),
    leadStatusHistory: await prisma.crmLeadStatusHistory.count({ where: { tenantId } }),
    leadAssignments: await prisma.crmLeadAssignment.count({ where: { tenantId } }),
    activitiesWithLead: await prisma.crmActivity.count({
      where: { tenantId, leadId: { not: null } },
    }),
    followUpsWithLead: await prisma.crmFollowUp.count({
      where: { tenantId, leadId: { not: null } },
    }),
    notesLead: await prisma.crmNote.count({
      where: { tenantId, entityType: CrmEntityType.LEAD },
    }),
    notesLeadActive: await prisma.crmNote.count({
      where: { tenantId, entityType: CrmEntityType.LEAD, deletedAt: null },
    }),
    attachmentsLead: await prisma.crmAttachment.count({
      where: { tenantId, entityType: CrmEntityType.LEAD },
    }),
    attachmentsLeadActive: await prisma.crmAttachment.count({
      where: { tenantId, entityType: CrmEntityType.LEAD, deletedAt: null },
    }),
    opportunitiesWithLeadId: await prisma.crmOpportunity.count({
      where: { tenantId, leadId: { not: null } },
    }),
    companies: await prisma.crmCompany.count({ where: { tenantId } }),
    contacts: await prisma.crmContact.count({ where: { tenantId } }),
    opportunities: await prisma.crmOpportunity.count({ where: { tenantId } }),
    quotations: await prisma.crmQuotation.count({ where: { tenantId } }),
    salesOrders: await prisma.crmSalesOrder.count({ where: { tenantId } }),
  }
}

async function cleanupTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<Record<string, number>> {
  const stats: Record<string, number> = {}

  // 1) Hard-delete notes / attachments on LEAD (no FK to crm_leads)
  const notesHard = await tx.crmNote.deleteMany({
    where: { tenantId, entityType: CrmEntityType.LEAD },
  })
  stats.notesDeleted = notesHard.count

  const attsHard = await tx.crmAttachment.deleteMany({
    where: { tenantId, entityType: CrmEntityType.LEAD },
  })
  stats.attachmentsDeleted = attsHard.count

  // 2) Activities: hard-delete those linked only to a lead; else detach leadId
  const leadOnlyActs = await tx.crmActivity.deleteMany({
    where: {
      tenantId,
      leadId: { not: null },
      companyId: null,
      contactId: null,
      opportunityId: null,
    },
  })
  stats.activitiesLeadOnlyDeleted = leadOnlyActs.count

  const actsDetached = await tx.crmActivity.updateMany({
    where: { tenantId, leadId: { not: null } },
    data: { leadId: null },
  })
  stats.activitiesDetached = actsDetached.count

  // 3) Follow-ups: same pattern (leadId is plain string, no FK — still clean for UI)
  const leadOnlyFus = await tx.crmFollowUp.deleteMany({
    where: {
      tenantId,
      leadId: { not: null },
      companyId: null,
      contactId: null,
      opportunityId: null,
    },
  })
  stats.followUpsLeadOnlyDeleted = leadOnlyFus.count

  const fusDetached = await tx.crmFollowUp.updateMany({
    where: { tenantId, leadId: { not: null } },
    data: { leadId: null },
  })
  stats.followUpsDetached = fusDetached.count

  // 4) Clear opportunity source leadId (plain string field — no FK)
  const oppsCleared = await tx.crmOpportunity.updateMany({
    where: { tenantId, leadId: { not: null } },
    data: { leadId: null },
  })
  stats.opportunitiesLeadIdCleared = oppsCleared.count

  // 5) Explicit child history (also Cascade on lead delete)
  const hist = await tx.crmLeadStatusHistory.deleteMany({ where: { tenantId } })
  stats.leadStatusHistoryDeleted = hist.count

  const assign = await tx.crmLeadAssignment.deleteMany({ where: { tenantId } })
  stats.leadAssignmentsDeleted = assign.count

  // 6) Hard-delete all leads (active + soft-deleted)
  const leads = await tx.crmLead.deleteMany({ where: { tenantId } })
  stats.leadsDeleted = leads.count

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

  // Global peek: any leads outside selected tenants?
  if (!allTenants) {
    const byTenant = await prisma.crmLead.groupBy({
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
      console.log('Lead counts by tenant (all DB):')
      for (const row of byTenant) {
        console.log(`  ${tenantMap[row.tenantId] ?? row.tenantId}: ${row._count._all}`)
      }
      console.log('')
    } else {
      console.log('Lead counts by tenant (all DB): none\n')
    }
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Cleaning leads for ${allTenants ? 'ALL tenants' : slugArg} (${tenants.length} tenant(s))`,
  )

  const grandBefore: Record<string, Counts> = {}
  const grandAfter: Record<string, Counts> = {}
  const grandStats: Record<string, Record<string, number>> = {}

  for (const t of tenants) {
    const before = await collectCounts(t.id)
    grandBefore[t.slug] = before
    console.log(`\n=== ${t.slug} (${t.id}) ===`)
    console.log('BEFORE:', JSON.stringify(before, null, 2))

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
    if (after.opportunities < before.opportunities) shrinks.push('opportunities')
    if (after.quotations < before.quotations) shrinks.push('quotations')
    if (after.salesOrders < before.salesOrders) shrinks.push('salesOrders')
    if (shrinks.length) {
      console.error(`WARNING: protected entity counts dropped: ${shrinks.join(', ')}`)
      process.exit(2)
    }
    if (after.leads !== 0 || after.leadsActive !== 0) {
      console.error('WARNING: leads remain after cleanup')
      process.exit(2)
    }
  }

  if (!dryRun) {
    console.log('\n--- Summary ---')
    for (const t of tenants) {
      const b = grandBefore[t.slug]!
      const a = grandAfter[t.slug]!
      console.log(
        `${t.slug}: leads ${b.leads} (${b.leadsActive} active) → ${a.leads} (${a.leadsActive} active)`,
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
