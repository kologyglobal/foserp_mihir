import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import { assertCompanyInTenant, assertContactInTenant, assertUserInTenant } from '../crm.tenant-refs.js'
import * as repo from './lead.repository.js'
import {
  assertLeadAssignable,
  assertLeadConvertible,
  assertLeadDisqualifiable,
  assertLeadMutable,
  assertLeadQualifiable,
  sanitizeLeadUpdateInput,
} from './lead.workflow.js'
import { mapLeadToDto } from './lead.types.js'
import type {
  AssignLeadInput,
  ChangeLeadStageInput,
  ConvertLeadInput,
  CreateLeadInput,
  DisqualifyLeadInput,
  ListLeadsQuery,
  QualifyLeadInput,
  UpdateLeadInput,
} from './lead.validation.js'

function lifecycleFromStage(stage: string): string {
  if (stage === 'qualified') return 'qualified'
  if (stage === 'converted_to_opportunity') return 'converted'
  if (stage === 'closed' || stage === 'not_qualified') return 'closed'
  return 'open'
}

function qualificationFromStage(stage: string): string | null {
  if (stage === 'qualified') return 'qualified'
  if (stage === 'not_qualified') return 'not_qualified'
  if (stage === 'converted_to_opportunity') return 'qualified'
  return null
}

async function mapLeadWithNames(tenantId: string, lead: Awaited<ReturnType<typeof repo.findLeadById>>) {
  if (!lead) return null
  const nameMap = await resolveUserNames(
    [lead.createdBy, lead.updatedBy, lead.assignedTo, lead.ownerId],
    tenantId,
    prisma,
  )
  const ownerId = lead.assignedTo ?? lead.ownerId
  return mapLeadToDto(lead, {
    createdByName: lead.createdBy ? nameMap.get(lead.createdBy) : undefined,
    modifiedByName: lead.updatedBy ? nameMap.get(lead.updatedBy) : undefined,
    leadOwnerName: ownerId ? nameMap.get(ownerId) : undefined,
  })
}

export async function listLeads(tenantId: string, query: ListLeadsQuery) {
  const result = await repo.findLeads(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((l) => [l.createdBy, l.updatedBy, l.assignedTo, l.ownerId]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((lead) => {
      const ownerId = lead.assignedTo ?? lead.ownerId
      return mapLeadToDto(lead, {
        createdByName: lead.createdBy ? nameMap.get(lead.createdBy) : undefined,
        modifiedByName: lead.updatedBy ? nameMap.get(lead.updatedBy) : undefined,
        leadOwnerName: ownerId ? nameMap.get(ownerId) : undefined,
      })
    }),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getLead(tenantId: string, id: string) {
  const lead = await repo.findLeadById(tenantId, id)
  if (!lead) throw new NotFoundError('Lead not found')
  const mapped = await mapLeadWithNames(tenantId, lead)
  return mapped!
}

export async function createLead(tenantId: string, userId: string, input: CreateLeadInput) {
  if (input.customerId) await assertCompanyInTenant(tenantId, input.customerId)
  if (input.contactId) await assertContactInTenant(tenantId, input.contactId)
  const leadOwnerId = input.leadOwnerId ?? userId
  if (leadOwnerId) await assertUserInTenant(tenantId, leadOwnerId, 'Lead owner')
  const leadCode = input.leadNo ?? (await nextCode(tenantId, 'LEAD'))
  const lead = await repo.createLead(tenantId, userId, { ...input, leadOwnerId, leadCode })
  return (await mapLeadWithNames(tenantId, lead))!
}

export async function updateLead(tenantId: string, id: string, userId: string, input: UpdateLeadInput) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  const safeInput = sanitizeLeadUpdateInput(existing, input)
  if (safeInput.customerId) await assertCompanyInTenant(tenantId, safeInput.customerId)
  if (safeInput.contactId) await assertContactInTenant(tenantId, safeInput.contactId)
  if (safeInput.leadOwnerId) await assertUserInTenant(tenantId, safeInput.leadOwnerId, 'Lead owner')
  const lead = await repo.updateLead(tenantId, id, userId, safeInput)
  return (await mapLeadWithNames(tenantId, lead))!
}

export async function deleteLead(tenantId: string, id: string, userId: string) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  await repo.softDeleteLead(tenantId, id, userId)
}

export async function assignLead(tenantId: string, id: string, userId: string, input: AssignLeadInput) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  assertLeadAssignable(existing)
  await assertUserInTenant(tenantId, input.leadOwnerId, 'Lead owner')
  const lead = await repo.assignLead(tenantId, id, userId, input)
  return (await mapLeadWithNames(tenantId, lead))!
}

export async function qualifyLead(tenantId: string, id: string, userId: string, input: QualifyLeadInput) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  assertLeadQualifiable(existing)
  if (existing.lifecycleStatus === 'converted') {
    throw new InvalidStateError('Lead already converted')
  }
  const lead = await repo.qualifyLead(tenantId, id, userId, input)
  return (await mapLeadWithNames(tenantId, lead))!
}

export async function changeLeadStage(tenantId: string, id: string, userId: string, input: ChangeLeadStageInput) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  assertLeadMutable(existing)

  if (input.stage === 'converted_to_opportunity') {
    throw new InvalidStateError('Use convert action to move a lead to opportunity')
  }
  if (input.stage === 'not_qualified' && !input.notQualifiedReason?.trim()) {
    throw new InvalidStateError('Not qualified reason is required')
  }
  if (input.stage === 'closed' && !input.closedReason?.trim()) {
    throw new InvalidStateError('Closed reason is required')
  }

  const lifecycleStatus = lifecycleFromStage(input.stage)
  const qualificationStatus = qualificationFromStage(input.stage)
  const lead = await repo.changeLeadStage(tenantId, id, userId, {
    stage: input.stage,
    lifecycleStatus,
    qualificationStatus,
    remarks: input.remarks,
    notQualifiedReason: input.stage === 'not_qualified' ? input.notQualifiedReason ?? null : null,
    closedReason: input.stage === 'closed' ? input.closedReason ?? null : null,
    closedDate:
      input.stage === 'closed'
        ? (input.closedDate ? new Date(input.closedDate) : new Date())
        : null,
  })
  return (await mapLeadWithNames(tenantId, lead))!
}

export async function disqualifyLead(tenantId: string, id: string, userId: string, input: DisqualifyLeadInput) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  assertLeadDisqualifiable(existing)
  if (existing.lifecycleStatus === 'converted') {
    throw new InvalidStateError('Lead already converted')
  }
  const lead = await repo.disqualifyLead(tenantId, id, userId, input)
  return (await mapLeadWithNames(tenantId, lead))!
}

export async function convertLead(tenantId: string, id: string, userId: string, input: ConvertLeadInput) {
  const existing = await repo.findLeadById(tenantId, id)
  if (!existing) throw new NotFoundError('Lead not found')
  assertLeadConvertible(existing)
  if (existing.lifecycleStatus === 'converted' || existing.opportunityId) {
    throw new InvalidStateError('Lead already converted')
  }

  let pipelineId = input.pipelineId
  let stageId = input.stageId

  if (!pipelineId || !stageId) {
    const pipeline = await repo.getDefaultPipeline(tenantId)
    if (!pipeline || pipeline.stages.length === 0) {
      throw new InvalidStateError('No default pipeline configured')
    }
    pipelineId = pipeline.id
    stageId = pipeline.stages[0].id
  } else {
    const stage = await repo.getPipelineStage(tenantId, pipelineId, stageId)
    if (!stage) throw new NotFoundError('Pipeline stage not found')
  }

  const opportunityCode = await nextCode(tenantId, 'OPPORTUNITY')
  const result = await repo.convertLead(tenantId, id, userId, {
    ...input,
    opportunityCode,
    pipelineId: pipelineId!,
    stageId: stageId!,
  })

  if (!result) throw new NotFoundError('Lead not found')

  const { mapOpportunityToDto } = await import('../opportunities/opportunity.types.js')
  const opportunity = await prisma.crmOpportunity.findUnique({
    where: { id: result.opportunity.id },
    include: { stage: true, lines: true },
  })

  return {
    lead: (await mapLeadWithNames(tenantId, result.lead))!,
    opportunity: opportunity ? mapOpportunityToDto(opportunity) : null,
  }
}

export async function getLeadStatusHistory(tenantId: string, leadId: string) {
  const lead = await repo.findLeadById(tenantId, leadId)
  if (!lead) throw new NotFoundError('Lead not found')
  return repo.findLeadStatusHistory(tenantId, leadId)
}

export async function getLeadAssignmentHistory(tenantId: string, leadId: string) {
  const lead = await repo.findLeadById(tenantId, leadId)
  if (!lead) throw new NotFoundError('Lead not found')
  const rows = await repo.findLeadAssignmentHistory(tenantId, leadId)
  const nameMap = await resolveUserNames(
    rows.flatMap((r) => [r.assignedTo, r.assignedBy]),
    tenantId,
    prisma,
  )
  return rows.map((row) => ({
    id: row.id,
    assignedTo: row.assignedTo,
    assignedToName: nameMap.get(row.assignedTo) ?? '',
    assignedBy: row.assignedBy,
    assignedByName: row.assignedBy ? nameMap.get(row.assignedBy) ?? '' : '',
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }))
}
