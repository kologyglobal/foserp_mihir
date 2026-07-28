import type { CrmLead } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { decimalToNumber } from '../../../shared/index.js'
import { ensureLeadCompany } from './lead.repository.js'

/**
 * Mirrors a lead's early-funnel stage into the CRM Opportunity pipeline so the
 * Opportunities list/pipeline always shows what Leads shows for open deals —
 * without requiring the explicit "Convert" action, which still fully converts
 * (and locks) the lead later on. Only the stages Leads exposes as open/working
 * ("New" and "Qualified") are mirrored; disqualified/closed/converted leads are
 * left to their own dedicated flows.
 */
const LEAD_STAGE_TO_PIPELINE_SLUG: Record<string, string> = {
  new: 'new_lead',
  contacted: 'new_lead',
  requirement_collected: 'new_lead',
  qualified: 'qualified',
}

export async function syncLeadOpportunityStage(
  tenantId: string,
  userId: string,
  lead: CrmLead,
): Promise<void> {
  if (lead.opportunityId) return // fully converted — owned by the Convert flow from here on
  const targetSlug = LEAD_STAGE_TO_PIPELINE_SLUG[lead.stage]
  if (!targetSlug) return

  const { ensureDefaultPipeline } = await import('../pipelines/pipeline.repository.js')
  const pipeline = await ensureDefaultPipeline(tenantId, userId)
  const targetStage = pipeline.stages.find((s) => s.slug === targetSlug) ?? pipeline.stages[0]
  if (!targetStage) return

  const existing = await prisma.crmOpportunity.findFirst({
    where: { tenantId, leadId: lead.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  if (existing) {
    if (existing.stageId === targetStage.id) return
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
    await recordStageHistory(tenantId, existing.id, existing.stageId, targetStage.id, userId, `Lead stage: ${lead.stage}`)
    return
  }

  const companyId = lead.companyId ?? (await ensureLeadCompany(prisma, tenantId, lead, userId))
  const { nextCode } = await import('../../../services/codeSeries.service.js')
  const { createOpportunity } = await import('../opportunities/opportunity.repository.js')
  const opportunityCode = await nextCode(tenantId, 'OPPORTUNITY')

  await createOpportunity(tenantId, userId, {
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
}

/** Best-effort wrapper — a mirror failure must never block the lead write itself. */
export async function syncLeadOpportunityStageSafely(
  tenantId: string,
  userId: string,
  lead: CrmLead,
): Promise<void> {
  try {
    await syncLeadOpportunityStage(tenantId, userId, lead)
  } catch (err) {
    console.error('[crm] Failed to sync lead → opportunity mirror', {
      tenantId,
      leadId: lead.id,
      stage: lead.stage,
      err,
    })
  }
}
