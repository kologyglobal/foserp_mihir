import type { OpportunityStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { FRONTEND_STATUS_TO_DB } from './opportunity.constants.js'
import type {
  CreateOpportunityInput,
  LineInput,
  ListOpportunitiesQuery,
  LoseOpportunityInput,
  UpdateOpportunityInput,
  WinOpportunityInput,
} from './opportunity.validation.js'

const includeRelations = {
  stage: true,
  lines: { orderBy: { lineNo: 'asc' as const } },
}

function resolveStatus(status: string | undefined): OpportunityStatus | undefined {
  if (!status) return undefined
  const mapped = FRONTEND_STATUS_TO_DB[status.toLowerCase()]
  return (mapped ?? status.toUpperCase()) as OpportunityStatus
}

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

export async function findOpportunities(tenantId: string, query: ListOpportunitiesQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmOpportunityWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
    ...(query.status ? { status: resolveStatus(query.status) } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.stage ? { stage: { slug: query.stage, deletedAt: null } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { opportunityCode: { contains: query.search } },
            { requirement: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmOpportunity.findMany({ where, skip, take, include: includeRelations, orderBy: { createdAt: query.sortOrder } }),
    prisma.crmOpportunity.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findOpportunityById(tenantId: string, id: string) {
  return prisma.crmOpportunity.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: includeRelations,
  })
}

export async function resolveStageId(
  tenantId: string,
  pipelineId: string,
  stageId?: string,
  stageSlug?: string,
) {
  if (stageId) {
    const stage = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId, pipelineId, tenantId, deletedAt: null },
    })
    if (stage) return stage.id
  }
  if (stageSlug) {
    const stage = await prisma.crmPipelineStage.findFirst({
      where: { slug: stageSlug, pipelineId, tenantId, deletedAt: null },
    })
    if (stage) return stage.id
  }
  const first = await prisma.crmPipelineStage.findFirst({
    where: { pipelineId, tenantId, deletedAt: null },
    orderBy: { sequence: 'asc' },
  })
  return first?.id
}

export async function createOpportunity(
  tenantId: string,
  userId: string,
  data: CreateOpportunityInput & { opportunityCode: string; stageId: string },
) {
  return prisma.$transaction(async (tx) => {
    const opportunity = await tx.crmOpportunity.create({
      data: {
        tenantId,
        opportunityCode: data.opportunityCode,
        name: data.opportunityName,
        companyId: data.customerId,
        contactId: data.contactId,
        leadId: data.leadId,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        ownerId: data.ownerId,
        amount: data.value ?? 0,
        probability: data.probability ?? 0,
        expectedCloseDate: parseDate(data.expectedCloseDate),
        requirement: data.productRequirement,
        priority: data.priority ?? 'medium',
        status: resolveStatus(data.status) ?? 'OPEN',
        healthScore: data.healthScore ?? 60,
        locationId: data.locationId,
        competitor: data.competitor,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    if (data.lines?.length) {
      await createOpportunityLines(tx, tenantId, opportunity.id, data.lines)
    }

    return tx.crmOpportunity.findUniqueOrThrow({ where: { id: opportunity.id }, include: includeRelations })
  })
}

export async function updateOpportunity(
  tenantId: string,
  id: string,
  userId: string,
  data: UpdateOpportunityInput & { stageId?: string },
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmOpportunity.update({
      where: { id, tenantId },
      data: {
        ...(data.opportunityName !== undefined ? { name: data.opportunityName } : {}),
        ...(data.customerId !== undefined ? { companyId: data.customerId } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(data.leadId !== undefined ? { leadId: data.leadId } : {}),
        ...(data.pipelineId !== undefined ? { pipelineId: data.pipelineId } : {}),
        ...(data.stageId !== undefined ? { stageId: data.stageId } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.value !== undefined ? { amount: data.value } : {}),
        ...(data.probability !== undefined ? { probability: data.probability } : {}),
        ...(data.expectedCloseDate !== undefined ? { expectedCloseDate: parseDate(data.expectedCloseDate) } : {}),
        ...(data.productRequirement !== undefined ? { requirement: data.productRequirement } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: resolveStatus(data.status) } : {}),
        ...(data.healthScore !== undefined ? { healthScore: data.healthScore } : {}),
        ...(data.locationId !== undefined ? { locationId: data.locationId } : {}),
        ...(data.competitor !== undefined ? { competitor: data.competitor } : {}),
        updatedBy: userId,
      },
    })

    if (data.lines) {
      await tx.crmOpportunityLine.deleteMany({ where: { opportunityId: id, tenantId } })
      await createOpportunityLines(tx, tenantId, id, data.lines)
    }

    return tx.crmOpportunity.findUniqueOrThrow({ where: { id }, include: includeRelations })
  })
}

export async function createOpportunityLines(
  tx: Prisma.TransactionClient,
  tenantId: string,
  opportunityId: string,
  lines: LineInput[],
) {
  for (const [index, line] of lines.entries()) {
    await tx.crmOpportunityLine.create({
      data: {
        tenantId,
        opportunityId,
        lineNo: line.lineNo ?? index + 1,
        productId: line.productId,
        itemId: line.itemId,
        itemCode: line.itemCode ?? '',
        productOrItem: line.productOrItem,
        description: line.description,
        productFamily: line.productFamily,
        itemType: line.itemType,
        qty: line.qty ?? 1,
        uom: line.uom ?? 'NOS',
        unitPrice: line.unitPrice ?? 0,
        discountPct: line.discountPct ?? 0,
        discountAmount: line.discountAmount ?? 0,
        taxableValue: line.taxableValue ?? 0,
        taxPct: line.taxPct ?? 0,
        gstAmount: line.gstAmount ?? 0,
        lineTotal: line.lineTotal ?? 0,
        expectedDeliveryDate: parseDate(line.expectedDeliveryDate),
        remarks: line.remarks,
      },
    })
  }
}

export async function winOpportunity(
  tenantId: string,
  id: string,
  userId: string,
  input: WinOpportunityInput & { stageId: string },
) {
  return prisma.crmOpportunity.update({
    where: { id, tenantId },
    data: {
      status: 'WON',
      stageId: input.stageId,
      winReason: input.winReason,
      probability: 100,
      updatedBy: userId,
    },
    include: includeRelations,
  })
}

export async function loseOpportunity(
  tenantId: string,
  id: string,
  userId: string,
  input: LoseOpportunityInput & { stageId: string },
) {
  return prisma.crmOpportunity.update({
    where: { id, tenantId },
    data: {
      status: 'LOST',
      stageId: input.stageId,
      lostReason: input.lostReason,
      probability: 0,
      updatedBy: userId,
    },
    include: includeRelations,
  })
}

export async function softDeleteOpportunity(tenantId: string, id: string, userId: string) {
  return prisma.crmOpportunity.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId, status: 'ARCHIVED' },
  })
}

export async function findWonStage(tenantId: string, pipelineId: string) {
  return prisma.crmPipelineStage.findFirst({
    where: { tenantId, pipelineId, isClosedWon: true, deletedAt: null },
  })
}

export async function findLostStage(tenantId: string, pipelineId: string) {
  return prisma.crmPipelineStage.findFirst({
    where: { tenantId, pipelineId, isClosedLost: true, deletedAt: null },
  })
}

export async function recordStageHistory(
  tenantId: string,
  opportunityId: string,
  fromStageId: string | null,
  toStageId: string,
  changedBy: string,
  reason?: string,
) {
  return prisma.crmOpportunityStageHistory.create({
    data: { tenantId, opportunityId, fromStageId, toStageId, changedBy, reason },
  })
}

export async function recordAssignmentHistory(
  tenantId: string,
  opportunityId: string,
  fromOwnerId: string | null,
  toOwnerId: string | null,
  changedBy: string,
  notes?: string,
) {
  return prisma.crmOpportunityAssignmentHistory.create({
    data: { tenantId, opportunityId, fromOwnerId, toOwnerId, changedBy, notes },
  })
}

export async function recordAmountHistory(
  tenantId: string,
  opportunityId: string,
  oldAmount: number,
  newAmount: number,
  changedBy: string,
  reason?: string,
) {
  return prisma.crmOpportunityAmountHistory.create({
    data: { tenantId, opportunityId, oldAmount, newAmount, changedBy, reason },
  })
}

export async function recordStatusHistory(
  tenantId: string,
  opportunityId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string,
  reason?: string,
) {
  return prisma.crmOpportunityStatusHistory.create({
    data: { tenantId, opportunityId, fromStatus, toStatus, changedBy, reason },
  })
}

export async function findStageHistory(tenantId: string, opportunityId: string) {
  return prisma.crmOpportunityStageHistory.findMany({
    where: { tenantId, opportunityId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findAssignmentHistory(tenantId: string, opportunityId: string) {
  return prisma.crmOpportunityAssignmentHistory.findMany({
    where: { tenantId, opportunityId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findAmountHistory(tenantId: string, opportunityId: string) {
  return prisma.crmOpportunityAmountHistory.findMany({
    where: { tenantId, opportunityId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findStatusHistory(tenantId: string, opportunityId: string) {
  return prisma.crmOpportunityStatusHistory.findMany({
    where: { tenantId, opportunityId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function reopenOpportunity(
  tenantId: string,
  id: string,
  userId: string,
  stageId: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmOpportunity.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new Error('Not found')
    const opp = await tx.crmOpportunity.update({
      where: { id, tenantId },
      data: { status: 'OPEN', stageId, winReason: null, lostReason: null, updatedBy: userId },
      include: includeRelations,
    })
    await tx.crmOpportunityStatusHistory.create({
      data: {
        tenantId,
        opportunityId: id,
        fromStatus: existing.status,
        toStatus: 'OPEN',
        changedBy: userId,
        reason,
      },
    })
    await tx.crmOpportunityStageHistory.create({
      data: {
        tenantId,
        opportunityId: id,
        fromStageId: existing.stageId,
        toStageId: stageId,
        changedBy: userId,
        reason,
      },
    })
    return opp
  })
}

export async function assignOpportunity(
  tenantId: string,
  id: string,
  userId: string,
  ownerId: string,
  notes?: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmOpportunity.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new Error('Not found')
    const opp = await tx.crmOpportunity.update({
      where: { id, tenantId },
      data: { ownerId, updatedBy: userId },
      include: includeRelations,
    })
    await tx.crmOpportunityAssignmentHistory.create({
      data: {
        tenantId,
        opportunityId: id,
        fromOwnerId: existing.ownerId,
        toOwnerId: ownerId,
        changedBy: userId,
        notes,
      },
    })
    return opp
  })
}

export async function moveOpportunityStage(
  tenantId: string,
  id: string,
  userId: string,
  stageId: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmOpportunity.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new Error('Not found')
    const stage = await tx.crmPipelineStage.findFirst({
      where: { id: stageId, pipelineId: existing.pipelineId, tenantId, deletedAt: null },
    })
    if (!stage) throw new Error('Invalid stage')
    const opp = await tx.crmOpportunity.update({
      where: { id, tenantId },
      data: { stageId, probability: stage.probability, updatedBy: userId },
      include: includeRelations,
    })
    await tx.crmOpportunityStageHistory.create({
      data: {
        tenantId,
        opportunityId: id,
        fromStageId: existing.stageId,
        toStageId: stageId,
        changedBy: userId,
        reason,
      },
    })
    return opp
  })
}
