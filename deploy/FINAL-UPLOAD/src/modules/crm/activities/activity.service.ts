import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import * as repo from './activity.repository.js'
import { mapActivityToDto } from './activity.types.js'
import type {
  CompleteActivityInput,
  CreateActivityInput,
  ListActivitiesQuery,
  UpdateActivityInput,
} from './activity.validation.js'

async function mapActivityWithNames(tenantId: string, activity: NonNullable<Awaited<ReturnType<typeof repo.findActivityById>>>) {
  const nameMap = await resolveUserNames(
    [activity.createdBy, activity.updatedBy, activity.assignedTo],
    tenantId,
    prisma,
  )
  return mapActivityToDto(activity, {
    createdByName: activity.createdBy ? nameMap.get(activity.createdBy) : undefined,
    modifiedByName: activity.updatedBy ? nameMap.get(activity.updatedBy) : undefined,
    ownerName: activity.assignedTo ? nameMap.get(activity.assignedTo) : undefined,
  })
}

export async function listActivities(tenantId: string, query: ListActivitiesQuery) {
  const result = await repo.findActivities(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((a) => [a.createdBy, a.updatedBy, a.assignedTo]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((activity) =>
      mapActivityToDto(activity, {
        createdByName: activity.createdBy ? nameMap.get(activity.createdBy) : undefined,
        modifiedByName: activity.updatedBy ? nameMap.get(activity.updatedBy) : undefined,
        ownerName: activity.assignedTo ? nameMap.get(activity.assignedTo) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getActivity(tenantId: string, id: string) {
  const activity = await repo.findActivityById(tenantId, id)
  if (!activity) throw new NotFoundError('Activity not found')
  return mapActivityWithNames(tenantId, activity)
}

export async function createActivity(tenantId: string, userId: string, input: CreateActivityInput) {
  const activity = await repo.createActivity(tenantId, userId, input)
  return mapActivityToDto(activity)
}

export async function updateActivity(tenantId: string, id: string, userId: string, input: UpdateActivityInput) {
  const existing = await repo.findActivityById(tenantId, id)
  if (!existing) throw new NotFoundError('Activity not found')
  const activity = await repo.updateActivity(tenantId, id, userId, input)
  return mapActivityWithNames(tenantId, activity)
}

export async function completeActivity(tenantId: string, id: string, userId: string, input: CompleteActivityInput) {
  const existing = await repo.findActivityById(tenantId, id)
  if (!existing) throw new NotFoundError('Activity not found')
  const activity = await repo.completeActivity(tenantId, id, userId, input)
  return mapActivityWithNames(tenantId, activity)
}

export async function deleteActivity(tenantId: string, id: string, userId: string) {
  const existing = await repo.findActivityById(tenantId, id)
  if (!existing) throw new NotFoundError('Activity not found')
  await repo.softDeleteActivity(tenantId, id, userId)
}
