import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { assertFollowUpInFuture } from '../../../utils/crmDatePolicy.js'
import { resolveUserNames } from '../../../shared/index.js'
import * as repo from './follow-up.repository.js'
import { deriveFollowUpStatus, mapFollowUpToDto } from './follow-up.types.js'
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  ListFollowUpsQuery,
  RescheduleFollowUpInput,
  SnoozeFollowUpInput,
  UpdateFollowUpInput,
} from './follow-up.validation.js'

async function mapWithNames(tenantId: string, followUp: NonNullable<Awaited<ReturnType<typeof repo.findFollowUpById>>>) {
  const nameMap = await resolveUserNames(
    [followUp.createdBy, followUp.updatedBy, followUp.assignedTo],
    tenantId,
    prisma,
  )
  const status = deriveFollowUpStatus(followUp.dueDate, followUp.status)
  return mapFollowUpToDto(
    { ...followUp, status },
    {
      createdByName: followUp.createdBy ? nameMap.get(followUp.createdBy) : undefined,
      modifiedByName: followUp.updatedBy ? nameMap.get(followUp.updatedBy) : undefined,
      assignedToName: followUp.assignedTo ? nameMap.get(followUp.assignedTo) : undefined,
    },
  )
}

export async function listFollowUps(tenantId: string, query: ListFollowUpsQuery, currentUserId?: string) {
  const result = await repo.findFollowUps(tenantId, query, currentUserId)
  const nameMap = await resolveUserNames(
    result.items.flatMap((f) => [f.createdBy, f.updatedBy, f.assignedTo]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((followUp) =>
      mapFollowUpToDto(followUp, {
        createdByName: followUp.createdBy ? nameMap.get(followUp.createdBy) : undefined,
        modifiedByName: followUp.updatedBy ? nameMap.get(followUp.updatedBy) : undefined,
        assignedToName: followUp.assignedTo ? nameMap.get(followUp.assignedTo) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getFollowUp(tenantId: string, id: string) {
  const followUp = await repo.findFollowUpById(tenantId, id)
  if (!followUp) throw new NotFoundError('Follow-up not found')
  return mapWithNames(tenantId, followUp)
}

export async function createFollowUp(tenantId: string, userId: string, input: CreateFollowUpInput) {
  assertFollowUpInFuture(input.dueDate, input.dueTime)
  const followUp = await repo.createFollowUp(tenantId, userId, input)
  return mapFollowUpToDto({ ...followUp, status: deriveFollowUpStatus(followUp.dueDate, followUp.status) })
}

export async function updateFollowUp(tenantId: string, id: string, userId: string, input: UpdateFollowUpInput) {
  const existing = await repo.findFollowUpById(tenantId, id)
  if (!existing) throw new NotFoundError('Follow-up not found')
  if (input.dueDate !== undefined || input.dueTime !== undefined) {
    const dueDate = input.dueDate ?? existing.dueDate.toISOString().slice(0, 10)
    const dueTime = input.dueTime ?? existing.dueTime ?? '10:00'
    assertFollowUpInFuture(dueDate, dueTime)
  }
  const followUp = await repo.updateFollowUp(tenantId, id, userId, input)
  return mapWithNames(tenantId, { ...followUp, status: deriveFollowUpStatus(followUp.dueDate, followUp.status) })
}

export async function completeFollowUp(tenantId: string, id: string, userId: string, input: CompleteFollowUpInput) {
  const existing = await repo.findFollowUpById(tenantId, id)
  if (!existing) throw new NotFoundError('Follow-up not found')
  const followUp = await repo.completeFollowUp(tenantId, id, userId, input)
  return mapWithNames(tenantId, { ...followUp, status: 'completed' })
}

export async function rescheduleFollowUp(tenantId: string, id: string, userId: string, input: RescheduleFollowUpInput) {
  const existing = await repo.findFollowUpById(tenantId, id)
  if (!existing) throw new NotFoundError('Follow-up not found')
  assertFollowUpInFuture(input.dueDate, input.dueTime)
  const followUp = await repo.rescheduleFollowUp(tenantId, id, userId, input)
  return mapWithNames(tenantId, { ...followUp, status: deriveFollowUpStatus(followUp.dueDate, followUp.status) })
}

export async function snoozeFollowUp(tenantId: string, id: string, userId: string, input: SnoozeFollowUpInput) {
  const existing = await repo.findFollowUpById(tenantId, id)
  if (!existing) throw new NotFoundError('Follow-up not found')
  // Date-only snooze: require a future calendar day at end-of-day UTC (keeps existing dueTime semantics elsewhere).
  assertFollowUpInFuture(input.dueDate, existing.dueTime ?? '23:59')
  const followUp = await repo.snoozeFollowUp(tenantId, id, userId, input)
  return mapWithNames(tenantId, { ...followUp, status: 'snoozed' })
}

export async function cancelFollowUp(tenantId: string, id: string, userId: string) {
  const existing = await repo.findFollowUpById(tenantId, id)
  if (!existing) throw new NotFoundError('Follow-up not found')
  const followUp = await repo.cancelFollowUp(tenantId, id, userId)
  return mapWithNames(tenantId, { ...followUp, status: 'cancelled' })
}

export async function deleteFollowUp(tenantId: string, id: string, userId: string) {
  const existing = await repo.findFollowUpById(tenantId, id)
  if (!existing) throw new NotFoundError('Follow-up not found')
  await repo.softDeleteFollowUp(tenantId, id, userId)
}
