import type { CrmLead } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { decimalToNumber } from '../../../shared/index.js'
import { ensureLeadCompany } from './lead.repository.js'

/**
 * Mirrors Leads UI open sections into the Opportunity pipeline:
 * - Leads "New" (new / contacted) → Opportunity "New Lead"
 * - Leads "Qualified" (qualified / requirement_collected KPI) → Opportunity "Qualified"
 *
 * Does not require Convert. Convert still owns locking via lead.opportunityId.
 */
export const LEAD_STAGE_TO_PIPELINE_SLUG: Record<string, string> = {
  new: 'new_lead',
  contacted: 'new_lead',
  requirement_collected: 'qualified',
  qualified: 'qualified',
}

const OPEN_MIRROR_STAGES = Object.keys(LEAD_STAGE_TO_PIPELINE_SLUG)

function resolveTargetStage<T extends { id: string; slug: string; name: string; probability: number }>(
  stages: T[],
  targetSlug: string,
): T | undefined {
  const bySlug = stages.find((s) => s.slug === targetSlug)
  if (bySlug) return bySlug
  const label = targetSlug === 'new_lead' ? 'new lead' : targetSlug.replace(/_/g, ' ')
  return (
    stages.find((s) => s.name.trim().toLowerCase() === label) ??
    stages.find((s) => s.name.trim().toLowerCase().includes(label)) ??
    stages[0]
  )
}

export async function syncLeadOpportunityStage(
  tenantId: string,
  userId: string,
  lead: CrmLead,
): Promise<string | null> {
  // Fully converted — Convert flow owns the deal from here on.
  if (lead.opportunityId) return lead.opportunityId

  const targetSlug = LEAD_STAGE_TO_PIPELINE_SLUG[lead.stage]
  if (!targetSlug) return null

  const { ensureDefaultPipeline } = await import('../pipelines/pipeline.repository.js')
  const pipeline = await ensureDefaultPipeline(tenantId, userId)
  const targetStage = resolveTargetStage(pipeline.stages, targetSlug)
  if (!targetStage) return null

  const existing = await prisma.crmOpportunity.findFirst({
    where: { tenantId, leadId: lead.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  if (existing) {
    if (existing.stageId === targetStage.id) return existing.id
    await prisma.crmOpportunity.update({
      where: { id: existing.id },
      data: {
        stageId: targetStage.id,
        probability: targetStage.probability,
        updatedBy: userId,
        lastActivityAt: new Date(),
      },
    })
    const { recordStageHistory } = await import('../opportunities/opportunity.repository.js')
    await recordStageHistory(
      tenantId,
      existing.id,
      existing.stageId,
      targetStage.id,
      userId,
      `Lead stage: ${lead.stage}`,
    )
    return existing.id
  }

  let companyId = lead.companyId
  if (!companyId) {
    companyId = await ensureLeadCompany(prisma, tenantId, lead, userId)
    await prisma.crmLead.update({
      where: { id: lead.id },
      data: { companyId, updatedBy: userId },
    })
  }

  const { nextCode } = await import('../../../services/codeSeries.service.js')
  const { createOpportunity } = await import('../opportunities/opportunity.repository.js')
  const opportunityCode = await nextCode(tenantId, 'OPPORTUNITY')

  const created = await createOpportunity(tenantId, userId, {
    opportunityCode,
    opportunityName: lead.companyName ?? lead.prospectName,
    customerId: companyId,
    contactId: lead.contactId ?? null,
    leadId: lead.id,
    pipelineId: pipeline.id,
    stageId: targetStage.id,
    ownerId: lead.assignedTo ?? lead.ownerId ?? null,
    value: decimalToNumber(lead.expectedValue),
    probability: targetStage.probability,
    expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.toISOString() : null,
    productRequirement: lead.productRequirement ?? undefined,
    status: 'open',
  })
  return created.id
}

/** Best-effort wrapper — a mirror failure must never block the lead write itself. */
export async function syncLeadOpportunityStageSafely(
  tenantId: string,
  userId: string,
  lead: CrmLead,
): Promise<string | null> {
  try {
    return await syncLeadOpportunityStage(tenantId, userId, lead)
  } catch (err) {
    console.error('[crm] Failed to sync lead → opportunity mirror', {
      tenantId,
      leadId: lead.id,
      stage: lead.stage,
      err,
    })
    return null
  }
}

/**
 * Creates/updates opportunity mirrors for open leads that are missing one.
 * Safe to call from Opportunities list (page 1) so historical leads appear under New/Qualified.
 */
export async function backfillMissingLeadOpportunityMirrors(
  tenantId: string,
  userId: string,
  limit = 50,
): Promise<number> {
  const alreadyLinked = await prisma.crmOpportunity.findMany({
    where: { tenantId, deletedAt: null, leadId: { not: null } },
    select: { leadId: true },
    distinct: ['leadId'],
  })
  const linkedIds = alreadyLinked.map((r) => r.leadId!).filter(Boolean)

  const leads = await prisma.crmLead.findMany({
    where: {
      tenantId,
      deletedAt: null,
      opportunityId: null,
      stage: { in: OPEN_MIRROR_STAGES },
      ...(linkedIds.length ? { id: { notIn: linkedIds } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  let synced = 0
  for (const lead of leads) {
    const id = await syncLeadOpportunityStageSafely(tenantId, userId, lead)
    if (id) synced += 1
  }
  return synced
}
