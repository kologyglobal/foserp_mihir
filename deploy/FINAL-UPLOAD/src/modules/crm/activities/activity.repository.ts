import type { ActivityStatus, ActivityType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { FRONTEND_TYPE_TO_ACTIVITY } from './activity.constants.js'
import type {
  CompleteActivityInput,
  CreateActivityInput,
  ListActivitiesQuery,
  UpdateActivityInput,
} from './activity.validation.js'

function resolveActivityType(type: string): ActivityType {
  const mapped = FRONTEND_TYPE_TO_ACTIVITY[type]
  return (mapped ?? type.toUpperCase()) as ActivityType
}

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

export async function findActivities(tenantId: string, query: ListActivitiesQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmActivityWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
    ...(query.ownerId ? { assignedTo: query.ownerId } : {}),
    ...(query.status ? { status: query.status as ActivityStatus } : {}),
    ...(query.type ? { activityType: resolveActivityType(query.type) } : {}),
    ...(query.search
      ? {
          OR: [
            { subject: { contains: query.search } },
            { description: { contains: query.search } },
            { outcome: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmActivity.findMany({ where, skip, take, orderBy: { scheduledAt: query.sortOrder } }),
    prisma.crmActivity.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findActivityById(tenantId: string, id: string) {
  return prisma.crmActivity.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
}

export async function createActivity(tenantId: string, userId: string, data: CreateActivityInput) {
  return prisma.crmActivity.create({
    data: {
      tenantId,
      activityType: resolveActivityType(data.type),
      subject: data.subject,
      description: data.description,
      companyId: data.customerId,
      contactId: data.contactId,
      leadId: data.leadId,
      opportunityId: data.opportunityId,
      assignedTo: data.ownerId,
      scheduledAt: parseDate(data.activityDate) ?? new Date(),
      priority: data.priority,
      status: (data.status as ActivityStatus | undefined) ?? 'PLANNED',
      outcome: data.outcome,
      nextAction: data.nextAction,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateActivity(tenantId: string, id: string, userId: string, data: UpdateActivityInput) {
  return prisma.crmActivity.update({
    where: { id, tenantId },
    data: {
      ...(data.type !== undefined ? { activityType: resolveActivityType(data.type) } : {}),
      ...(data.subject !== undefined ? { subject: data.subject } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.customerId !== undefined ? { companyId: data.customerId } : {}),
      ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
      ...(data.leadId !== undefined ? { leadId: data.leadId } : {}),
      ...(data.opportunityId !== undefined ? { opportunityId: data.opportunityId } : {}),
      ...(data.ownerId !== undefined ? { assignedTo: data.ownerId } : {}),
      ...(data.activityDate !== undefined ? { scheduledAt: parseDate(data.activityDate) } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.status !== undefined ? { status: data.status as ActivityStatus } : {}),
      ...(data.outcome !== undefined ? { outcome: data.outcome } : {}),
      ...(data.nextAction !== undefined ? { nextAction: data.nextAction } : {}),
      updatedBy: userId,
    },
  })
}

export async function completeActivity(
  tenantId: string,
  id: string,
  userId: string,
  data: CompleteActivityInput,
) {
  return prisma.crmActivity.update({
    where: { id, tenantId },
    data: {
      status: 'COMPLETED',
      completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
      outcome: data.outcome,
      nextAction: data.nextAction,
      updatedBy: userId,
    },
  })
}

export async function softDeleteActivity(tenantId: string, id: string, userId: string) {
  return prisma.crmActivity.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId, status: 'CANCELLED' },
  })
}
