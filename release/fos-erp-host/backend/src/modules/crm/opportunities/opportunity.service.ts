import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import * as repo from './opportunity.repository.js'
import { mapOpportunityToDto } from './opportunity.types.js'
import type {
  AssignOpportunityInput,
  CreateOpportunityInput,
  ListOpportunitiesQuery,
  LoseOpportunityInput,
  MoveStageOpportunityInput,
  ReopenOpportunityInput,
  UpdateOpportunityInput,
  WinOpportunityInput,
} from './opportunity.validation.js'
import {
  assertOpportunityClosable,
  assertOpportunityOpen,
  assertOpportunityReopenable,
} from './opportunity.workflow.js'

async function mapOpportunityWithNames(
  tenantId: string,
  opportunity: NonNullable<Awaited<ReturnType<typeof repo.findOpportunityById>>>,
) {
  const nameMap = await resolveUserNames(
    [opportunity.createdBy, opportunity.updatedBy, opportunity.ownerId],
    tenantId,
    prisma,
  )
  return mapOpportunityToDto(opportunity, {
    createdByName: opportunity.createdBy ? nameMap.get(opportunity.createdBy) : undefined,
    modifiedByName: opportunity.updatedBy ? nameMap.get(opportunity.updatedBy) : undefined,
    ownerName: opportunity.ownerId ? nameMap.get(opportunity.ownerId) : undefined,
  })
}

export async function listOpportunities(tenantId: string, query: ListOpportunitiesQuery) {
  const result = await repo.findOpportunities(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((o) => [o.createdBy, o.updatedBy, o.ownerId]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((o) =>
      mapOpportunityToDto(o, {
        createdByName: o.createdBy ? nameMap.get(o.createdBy) : undefined,
        modifiedByName: o.updatedBy ? nameMap.get(o.updatedBy) : undefined,
        ownerName: o.ownerId ? nameMap.get(o.ownerId) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getOpportunity(tenantId: string, id: string) {
  const opportunity = await repo.findOpportunityById(tenantId, id)
  if (!opportunity) throw new NotFoundError('Opportunity not found')
  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function createOpportunity(tenantId: string, userId: string, input: CreateOpportunityInput) {
  const stageId = await repo.resolveStageId(tenantId, input.pipelineId, input.stageId, input.stage)
  if (!stageId) {
    throw new ValidationError('Pipeline stage not found', [{ field: 'stageId', message: 'Invalid stage' }])
  }

  const { nextCode } = await import('../../../services/codeSeries.service.js')
  const opportunityCode = input.opportunityNo ?? (await nextCode(tenantId, 'OPPORTUNITY'))
  const opportunity = await repo.createOpportunity(tenantId, userId, {
    ...input,
    opportunityCode,
    stageId,
  })
  return mapOpportunityToDto(opportunity)
}

export async function updateOpportunity(tenantId: string, id: string, userId: string, input: UpdateOpportunityInput) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')

  const { sanitizeOpportunityUpdateInput } = await import('./opportunity.workflow.js')
  const safeInput = sanitizeOpportunityUpdateInput(existing, input)

  if (safeInput.contactId) {
    const { assertContactInTenant } = await import('../crm.tenant-refs.js')
    await assertContactInTenant(tenantId, safeInput.contactId)
    const contact = await prisma.crmContact.findFirst({
      where: { id: safeInput.contactId, tenantId, deletedAt: null },
      select: { companyId: true },
    })
    const companyId = safeInput.customerId ?? existing.companyId
    if (contact && contact.companyId !== companyId) {
      throw new ValidationError('Contact does not belong to the selected company')
    }
  }

  if (safeInput.ownerId) {
    const { assertUserInTenant } = await import('../crm.tenant-refs.js')
    await assertUserInTenant(tenantId, safeInput.ownerId)
  }

  let stageId: string | undefined
  if (safeInput.stageId || safeInput.stage) {
    const pipelineId = safeInput.pipelineId ?? existing.pipelineId
    stageId = (await repo.resolveStageId(tenantId, pipelineId, safeInput.stageId, safeInput.stage)) ?? undefined
    if (!stageId) {
      throw new ValidationError('Pipeline stage not found', [{ field: 'stageId', message: 'Invalid stage' }])
    }
  }

  const oldAmount = Number(existing.amount)
  const opportunity = await repo.updateOpportunity(tenantId, id, userId, { ...safeInput, stageId })

  if (safeInput.value !== undefined && safeInput.value !== oldAmount) {
    await repo.recordAmountHistory(tenantId, id, oldAmount, safeInput.value, userId)
  }

  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function deleteOpportunity(tenantId: string, id: string, userId: string) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  await repo.softDeleteOpportunity(tenantId, id, userId)
}

export async function winOpportunity(tenantId: string, id: string, userId: string, input: WinOpportunityInput) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  assertOpportunityClosable(existing)

  let stageId = input.stageId
  if (!stageId) {
    const wonStage = await repo.findWonStage(tenantId, existing.pipelineId)
    if (!wonStage) throw new InvalidStateError('No won stage configured in pipeline')
    stageId = wonStage.id
  }

  const opportunity = await repo.winOpportunity(tenantId, id, userId, { ...input, stageId })
  await repo.recordStatusHistory(tenantId, id, existing.status, 'WON', userId, input.winReason)
  await repo.recordStageHistory(tenantId, id, existing.stageId, stageId, userId, input.winReason)
  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function loseOpportunity(tenantId: string, id: string, userId: string, input: LoseOpportunityInput) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  assertOpportunityClosable(existing)

  let stageId = input.stageId
  if (!stageId) {
    const lostStage = await repo.findLostStage(tenantId, existing.pipelineId)
    if (!lostStage) throw new InvalidStateError('No lost stage configured in pipeline')
    stageId = lostStage.id
  }

  const opportunity = await repo.loseOpportunity(tenantId, id, userId, { ...input, stageId })
  await repo.recordStatusHistory(tenantId, id, existing.status, 'LOST', userId, input.lostReason)
  await repo.recordStageHistory(tenantId, id, existing.stageId, stageId, userId, input.lostReason)
  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function reopenOpportunity(tenantId: string, id: string, userId: string, input: ReopenOpportunityInput) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  assertOpportunityReopenable(existing)

  let stageId = input.stageId
  if (!stageId) {
    const first = await repo.resolveStageId(tenantId, existing.pipelineId)
    if (!first) throw new InvalidStateError('No open stage configured')
    stageId = first
  }

  const opportunity = await repo.reopenOpportunity(tenantId, id, userId, stageId, input.reason)
  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function assignOpportunity(tenantId: string, id: string, userId: string, input: AssignOpportunityInput) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  const { assertUserInTenant } = await import('../crm.tenant-refs.js')
  await assertUserInTenant(tenantId, input.ownerId)
  const opportunity = await repo.assignOpportunity(tenantId, id, userId, input.ownerId, input.notes)
  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function moveOpportunityStage(
  tenantId: string,
  id: string,
  userId: string,
  input: MoveStageOpportunityInput,
) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  assertOpportunityOpen(existing)
  const opportunity = await repo.moveOpportunityStage(tenantId, id, userId, input.stageId, input.reason)
  return mapOpportunityWithNames(tenantId, opportunity)
}

export async function getOpportunityStageHistory(tenantId: string, id: string) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  return repo.findStageHistory(tenantId, id)
}

export async function getOpportunityAssignmentHistory(tenantId: string, id: string) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  return repo.findAssignmentHistory(tenantId, id)
}

export async function getOpportunityAmountHistory(tenantId: string, id: string) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  return repo.findAmountHistory(tenantId, id)
}

export async function getOpportunityStatusHistory(tenantId: string, id: string) {
  const existing = await repo.findOpportunityById(tenantId, id)
  if (!existing) throw new NotFoundError('Opportunity not found')
  return repo.findStatusHistory(tenantId, id)
}
