import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { DEFAULT_LEAD_PRIORITY, DEFAULT_LEAD_STAGE } from './lead.constants.js'
import type {
  AssignLeadInput,
  ConvertLeadInput,
  CreateLeadInput,
  DisqualifyLeadInput,
  ListLeadsQuery,
  QualifyLeadInput,
  UpdateLeadInput,
} from './lead.validation.js'

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

function buildLeadData(input: CreateLeadInput | UpdateLeadInput) {
  return {
    ...(input.prospectName !== undefined ? { prospectName: input.prospectName } : {}),
    ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
    ...(input.customerId !== undefined ? { companyId: input.customerId } : {}),
    ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
    ...(input.designation !== undefined ? { designation: input.designation } : {}),
    ...(input.email !== undefined ? { email: input.email || null } : {}),
    ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
    ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.industry !== undefined ? { industry: input.industry } : {}),
    ...(input.turnoverRange !== undefined ? { turnoverRange: input.turnoverRange } : {}),
    ...(input.productRequirement !== undefined ? { productRequirement: input.productRequirement } : {}),
    ...(input.expectedQty !== undefined ? { expectedQty: input.expectedQty } : {}),
    ...(input.expectedValue !== undefined ? { expectedValue: input.expectedValue } : {}),
    ...(input.probability !== undefined ? { probability: input.probability } : {}),
    ...(input.stage !== undefined ? { stage: input.stage } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.lifecycleStatus !== undefined ? { lifecycleStatus: input.lifecycleStatus } : {}),
    ...(input.activityStatus !== undefined ? { activityStatus: input.activityStatus } : {}),
    ...(input.leadOwnerId !== undefined ? { assignedTo: input.leadOwnerId, ownerId: input.leadOwnerId } : {}),
    ...(input.nextFollowUpDate !== undefined ? { nextFollowUpAt: parseDate(input.nextFollowUpDate) } : {}),
    ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: parseDate(input.expectedCloseDate) } : {}),
    ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
    ...(input.followUpType !== undefined ? { followUpType: input.followUpType } : {}),
    ...(input.followUpNotes !== undefined ? { followUpNotes: input.followUpNotes } : {}),
    ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
  }
}

export async function findLeads(tenantId: string, query: ListLeadsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmLeadWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
    ...(query.activityStatus ? { activityStatus: query.activityStatus } : {}),
    ...(query.leadOwnerId ? { assignedTo: query.leadOwnerId } : {}),
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.isArchived !== undefined ? { isArchived: query.isArchived } : {}),
    ...(query.search
      ? {
          OR: [
            { prospectName: { contains: query.search } },
            { leadCode: { contains: query.search } },
            { companyName: { contains: query.search } },
            { email: { contains: query.search } },
            { mobile: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmLead.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.crmLead.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findLeadById(tenantId: string, id: string) {
  return prisma.crmLead.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
}

export async function createLead(
  tenantId: string,
  userId: string,
  data: CreateLeadInput & { leadCode: string },
) {
  return prisma.crmLead.create({
    data: {
      tenantId,
      leadCode: data.leadCode,
      prospectName: data.prospectName,
      stage: data.stage ?? DEFAULT_LEAD_STAGE,
      priority: data.priority ?? DEFAULT_LEAD_PRIORITY,
      lifecycleStatus: data.lifecycleStatus ?? 'open',
      activityStatus: data.activityStatus ?? 'active',
      ...buildLeadData(data),
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateLead(tenantId: string, id: string, userId: string, data: UpdateLeadInput) {
  return prisma.crmLead.update({
    where: { id, tenantId },
    data: { ...buildLeadData(data), updatedBy: userId },
  })
}

export async function softDeleteLead(tenantId: string, id: string, userId: string) {
  return prisma.crmLead.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId, isArchived: true },
  })
}

export async function assignLead(
  tenantId: string,
  id: string,
  userId: string,
  input: AssignLeadInput,
) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.crmLead.update({
      where: { id, tenantId },
      data: { assignedTo: input.leadOwnerId, ownerId: input.leadOwnerId, updatedBy: userId },
    })
    await tx.crmLeadAssignment.create({
      data: {
        tenantId,
        leadId: id,
        assignedTo: input.leadOwnerId,
        assignedBy: userId,
        notes: input.notes,
      },
    })
    return lead
  })
}

export async function changeLeadStage(
  tenantId: string,
  id: string,
  userId: string,
  input: {
    stage: string
    lifecycleStatus: string
    qualificationStatus?: string | null
    remarks?: string
    notQualifiedReason?: string | null
    closedReason?: string | null
    closedDate?: Date | null
  },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmLead.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
    const lead = await tx.crmLead.update({
      where: { id, tenantId },
      data: {
        stage: input.stage,
        lifecycleStatus: input.lifecycleStatus,
        qualificationStatus: input.qualificationStatus === undefined ? undefined : input.qualificationStatus,
        remarks: input.remarks ?? undefined,
        notQualifiedReason: input.notQualifiedReason === undefined ? undefined : input.notQualifiedReason,
        closedReason: input.closedReason === undefined ? undefined : input.closedReason,
        closedDate: input.closedDate === undefined ? undefined : input.closedDate,
        updatedBy: userId,
      },
    })
    await tx.crmLeadStatusHistory.create({
      data: {
        tenantId,
        leadId: id,
        fromStage: existing?.stage,
        toStage: input.stage,
        changedBy: userId,
        reason: input.remarks ?? input.notQualifiedReason ?? input.closedReason ?? undefined,
      },
    })
    return lead
  })
}

export async function qualifyLead(
  tenantId: string,
  id: string,
  userId: string,
  input: QualifyLeadInput,
) {
  const toStage = input.stage ?? 'qualified'
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmLead.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
    const lead = await tx.crmLead.update({
      where: { id, tenantId },
      data: {
        stage: toStage,
        lifecycleStatus: 'qualified',
        qualificationStatus: 'qualified',
        remarks: input.remarks ?? undefined,
        updatedBy: userId,
      },
    })
    await tx.crmLeadStatusHistory.create({
      data: {
        tenantId,
        leadId: id,
        fromStage: existing?.stage,
        toStage,
        changedBy: userId,
        reason: input.remarks,
      },
    })
    return lead
  })
}

export async function disqualifyLead(
  tenantId: string,
  id: string,
  userId: string,
  input: DisqualifyLeadInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmLead.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
    const lead = await tx.crmLead.update({
      where: { id, tenantId },
      data: {
        stage: 'not_qualified',
        lifecycleStatus: 'closed',
        qualificationStatus: 'not_qualified',
        notQualifiedReason: input.notQualifiedReason,
        remarks: input.remarks ?? undefined,
        updatedBy: userId,
      },
    })
    await tx.crmLeadStatusHistory.create({
      data: {
        tenantId,
        leadId: id,
        fromStage: existing?.stage,
        toStage: 'not_qualified',
        changedBy: userId,
        reason: input.notQualifiedReason,
      },
    })
    return lead
  })
}

export async function convertLead(
  tenantId: string,
  id: string,
  userId: string,
  input: ConvertLeadInput & { opportunityCode: string; pipelineId: string; stageId: string },
) {
  const { createOpportunityLines } = await import('../opportunities/opportunity.repository.js')
  return prisma.$transaction(async (tx) => {
    const lead = await tx.crmLead.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
    if (!lead) return null

    const companyId = lead.companyId ?? (await ensureLeadCompany(tx, tenantId, lead, userId))
    let contactId = input.contactId ?? lead.contactId ?? null

    if (!contactId && lead.contactPerson?.trim()) {
      contactId = await ensureLeadContact(tx, tenantId, userId, companyId, lead)
    }

    const opportunity = await tx.crmOpportunity.create({
      data: {
        tenantId,
        opportunityCode: input.opportunityCode,
        name: input.opportunityName ?? lead.prospectName,
        companyId,
        contactId,
        leadId: lead.id,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        ownerId: lead.assignedTo ?? lead.ownerId,
        amount: input.value ?? lead.expectedValue,
        expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : lead.expectedCloseDate,
        probability: lead.probability,
        requirement: lead.productRequirement,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    if (input.lines?.length) {
      await createOpportunityLines(tx, tenantId, opportunity.id, input.lines)
    }

    const updatedLead = await tx.crmLead.update({
      where: { id, tenantId },
      data: {
        stage: 'converted_to_opportunity',
        lifecycleStatus: 'converted',
        opportunityId: opportunity.id,
        companyId: lead.companyId ? undefined : companyId,
        contactId: lead.contactId ? undefined : (contactId ?? undefined),
        convertedAt: new Date(),
        updatedBy: userId,
      },
    })

    await tx.crmLeadStatusHistory.create({
      data: {
        tenantId,
        leadId: id,
        fromStage: lead.stage,
        toStage: 'converted_to_opportunity',
        changedBy: userId,
        reason: 'Converted to opportunity',
      },
    })

    return { lead: updatedLead, opportunity }
  })
}

async function ensureLeadContact(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  companyId: string,
  lead: {
    contactPerson: string | null
    mobile: string | null
    email: string | null
    designation: string | null
  },
): Promise<string> {
  const { nextCode } = await import('../../../services/codeSeries.service.js')
  const { splitContactName } = await import('../contacts/contact.types.js')
  const personName = lead.contactPerson!.trim()
  const existing = await tx.crmContact.findMany({
    where: { tenantId, companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  const byName = existing.find(
    (c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === personName.toLowerCase(),
  )
  if (byName) return byName.id

  const contactCode = await nextCode(tenantId, 'CONTACT', tx)
  const { firstName, lastName } = splitContactName(personName)
  const created = await tx.crmContact.create({
    data: {
      tenantId,
      contactCode,
      companyId,
      firstName,
      lastName,
      designation: lead.designation ?? 'Primary Contact',
      email: lead.email || null,
      mobile: lead.mobile || null,
      isPrimary: existing.length === 0,
      isActive: true,
      status: 'active',
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return created.id
}

async function ensureLeadCompany(
  tx: Prisma.TransactionClient,
  tenantId: string,
  lead: { companyName: string | null; prospectName: string },
  userId: string,
): Promise<string> {
  const { nextCode } = await import('../../../services/codeSeries.service.js')
  const companyCode = await nextCode(tenantId, 'CRM_COMPANY', tx)
  const company = await tx.crmCompany.create({
    data: {
      tenantId,
      companyCode,
      name: lead.companyName ?? lead.prospectName,
      createdBy: userId,
      updatedBy: userId,
    },
  })
  return company.id
}

export async function getDefaultPipeline(tenantId: string) {
  return prisma.crmPipeline.findFirst({
    where: { ...tenantActiveFilter(tenantId), isDefault: true },
    include: { stages: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } } },
  })
}

export async function getPipelineStage(tenantId: string, pipelineId: string, stageId: string) {
  return prisma.crmPipelineStage.findFirst({
    where: { id: stageId, pipelineId, tenantId, deletedAt: null },
  })
}

export async function findLeadStatusHistory(tenantId: string, leadId: string) {
  return prisma.crmLeadStatusHistory.findMany({
    where: { tenantId, leadId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findLeadAssignmentHistory(tenantId: string, leadId: string) {
  return prisma.crmLeadAssignment.findMany({
    where: { tenantId, leadId },
    orderBy: { createdAt: 'desc' },
  })
}
