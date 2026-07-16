import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  ListFollowUpsQuery,
  RescheduleFollowUpInput,
  SnoozeFollowUpInput,
  UpdateFollowUpInput,
} from './follow-up.validation.js'
import { deriveFollowUpStatus } from './follow-up.types.js'

function parseDueDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function todayDate(): Date {
  const d = new Date()
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

function buildViewFilter(view: ListFollowUpsQuery['view'], userId?: string): Prisma.CrmFollowUpWhereInput {
  const today = todayDate()
  switch (view) {
    case 'today':
      return { dueDate: today, status: { in: ['pending', 'overdue'] } }
    case 'overdue':
      return { dueDate: { lt: today }, status: { in: ['pending', 'overdue'] } }
    case 'upcoming':
      return { dueDate: { gt: today }, status: { in: ['pending', 'snoozed'] } }
    case 'completed':
      return { status: 'completed' }
    case 'mine':
      return userId ? { assignedTo: userId } : {}
    default:
      return {}
  }
}

export async function findFollowUps(tenantId: string, query: ListFollowUpsQuery, currentUserId?: string) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmFollowUpWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.view ? buildViewFilter(query.view, currentUserId) : {}),
    ...(query.search
      ? {
          OR: [
            { followUpType: { contains: query.search } },
            { notes: { contains: query.search } },
            { outcome: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmFollowUp.findMany({ where, skip, take, orderBy: [{ dueDate: 'asc' }, { dueTime: 'asc' }] }),
    prisma.crmFollowUp.count({ where }),
  ])

  return {
    items: items.map((item) => ({
      ...item,
      status: deriveFollowUpStatus(item.dueDate, item.status),
    })),
    total,
    page: query.page,
    limit: query.limit,
  }
}

export async function findFollowUpById(tenantId: string, id: string) {
  const item = await prisma.crmFollowUp.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
  if (!item) return null
  return { ...item, status: deriveFollowUpStatus(item.dueDate, item.status) }
}

async function assertTenantRefs(tenantId: string, input: CreateFollowUpInput | UpdateFollowUpInput) {
  const checks: Array<Promise<unknown>> = []
  if (input.customerId) {
    checks.push(prisma.crmCompany.findFirst({ where: { id: input.customerId, tenantId, deletedAt: null } }))
  }
  if (input.contactId) {
    checks.push(prisma.crmContact.findFirst({ where: { id: input.contactId, tenantId, deletedAt: null } }))
  }
  if (input.opportunityId) {
    checks.push(prisma.crmOpportunity.findFirst({ where: { id: input.opportunityId, tenantId, deletedAt: null } }))
  }
  if (input.leadId) {
    checks.push(prisma.crmLead.findFirst({ where: { id: input.leadId, tenantId, deletedAt: null } }))
  }
  if (input.assignedTo) {
    checks.push(prisma.user.findFirst({ where: { id: input.assignedTo, tenantId, deletedAt: null } }))
  }
  const results = await Promise.all(checks)
  if (results.some((r) => r === null)) {
    const { ValidationError } = await import('../../../utils/errors.js')
    throw new ValidationError('Referenced record not found in tenant')
  }
}

export async function createFollowUp(tenantId: string, userId: string, input: CreateFollowUpInput) {
  await assertTenantRefs(tenantId, input)
  return prisma.crmFollowUp.create({
    data: {
      tenantId,
      followUpType: input.followUpType,
      companyId: input.customerId,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      leadId: input.leadId,
      assignedTo: input.assignedTo ?? userId,
      dueDate: parseDueDate(input.dueDate),
      dueTime: input.dueTime ?? '10:00',
      priority: input.priority ?? 'medium',
      status: 'pending',
      notes: input.notes,
      reminder: input.reminder ?? false,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateFollowUp(tenantId: string, id: string, userId: string, input: UpdateFollowUpInput) {
  await assertTenantRefs(tenantId, input)
  return prisma.crmFollowUp.update({
    where: { id, tenantId },
    data: {
      ...(input.followUpType !== undefined ? { followUpType: input.followUpType } : {}),
      ...(input.customerId !== undefined ? { companyId: input.customerId } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.opportunityId !== undefined ? { opportunityId: input.opportunityId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
      ...(input.dueDate !== undefined ? { dueDate: parseDueDate(input.dueDate) } : {}),
      ...(input.dueTime !== undefined ? { dueTime: input.dueTime } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.reminder !== undefined ? { reminder: input.reminder } : {}),
      updatedBy: userId,
    },
  })
}

export async function completeFollowUp(tenantId: string, id: string, userId: string, input: CompleteFollowUpInput) {
  return prisma.crmFollowUp.update({
    where: { id, tenantId },
    data: { status: 'completed', outcome: input.outcome, updatedBy: userId },
  })
}

export async function rescheduleFollowUp(tenantId: string, id: string, userId: string, input: RescheduleFollowUpInput) {
  return prisma.crmFollowUp.update({
    where: { id, tenantId },
    data: {
      dueDate: parseDueDate(input.dueDate),
      dueTime: input.dueTime ?? '10:00',
      status: 'pending',
      updatedBy: userId,
    },
  })
}

export async function snoozeFollowUp(tenantId: string, id: string, userId: string, input: SnoozeFollowUpInput) {
  return prisma.crmFollowUp.update({
    where: { id, tenantId },
    data: {
      dueDate: parseDueDate(input.dueDate),
      status: 'snoozed',
      updatedBy: userId,
    },
  })
}

export async function cancelFollowUp(tenantId: string, id: string, userId: string) {
  return prisma.crmFollowUp.update({
    where: { id, tenantId },
    data: { status: 'cancelled', updatedBy: userId },
  })
}

export async function softDeleteFollowUp(tenantId: string, id: string, userId: string) {
  return prisma.crmFollowUp.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), status: 'cancelled', updatedBy: userId },
  })
}
