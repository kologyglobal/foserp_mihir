import type { Notification } from '@prisma/client'
import { logger } from '../../config/logger.js'
import { NotFoundError, ValidationError } from '../../utils/errors.js'
import {
  MANDATORY_NOTIFICATION_TYPES,
  OPTIONAL_NOTIFICATION_TYPES,
  priorityRank,
  type CreateNotificationInput,
} from './notification.constants.js'
import * as repo from './notification.repository.js'
import {
  mapNotificationToDto,
  mapPreferenceToDto,
  mapTenantSettingsToDto,
  type NotificationDto,
  type NotificationListResult,
} from './notification.types.js'
import type {
  ListNotificationsQuery,
  PutPreferencesInput,
  SnoozeNotificationInput,
} from './notification.validation.js'

/**
 * Core notification write path: preference check, anti-noise (skip actor for
 * optional types), dedupe, escalate severity.
 */
export async function create(input: CreateNotificationInput): Promise<Notification | null> {
  try {
    if (!input.recipientUserId?.trim()) return null
    const ok = await repo.assertUserInTenant(input.tenantId, input.recipientUserId)
    // Invalid recipient (stale/removed user) — skip silently, no log noise.
    if (!ok) return null

    // Anti-noise: skip optional self-alerts for the actor
    if (
      input.actorUserId
      && input.actorUserId === input.recipientUserId
      && OPTIONAL_NOTIFICATION_TYPES.has(input.type)
    ) {
      return null
    }

    const pref = await repo.getPreference(input.tenantId, input.recipientUserId, input.type)
    const mandatory = MANDATORY_NOTIFICATION_TYPES.has(input.type)
    if (pref) {
      if (pref.muteUntil && pref.muteUntil > new Date() && !mandatory) return null
      if (!mandatory && pref.inAppEnabled === false) return null
    }

    if (input.deduplicationKey) {
      const existing = await repo.findByDedup(input.tenantId, input.deduplicationKey)
      if (existing) {
        const higher = priorityRank(input.priority) > priorityRank(existing.priority)
        if (higher || input.escalateIfExists) {
          return repo.updateOpenNotification(existing.id, input.tenantId, {
            priority: higher ? input.priority : existing.priority,
            title: input.title,
            message: input.message,
            entityType: input.entityType ?? existing.entityType,
            entityId: input.entityId ?? existing.entityId,
            entityCode: input.entityCode ?? existing.entityCode,
            entityName: input.entityName ?? existing.entityName,
            escalationLevel: Math.max(
              existing.escalationLevel,
              input.escalationLevel ?? existing.escalationLevel + (higher ? 1 : 0),
            ),
            status: existing.status === 'SNOOZED' ? 'UNREAD' : existing.status,
            snoozedUntil: null,
            actionUrl: input.actionUrl ?? existing.actionUrl,
            primaryAction: input.primaryAction ?? existing.primaryAction,
            secondaryAction: input.secondaryAction ?? existing.secondaryAction,
            metadata: (input.metadata ?? existing.metadata) as object | undefined,
          })
        }
        return existing
      }
    }

    return repo.insertNotification(input, {
      priority: input.priority,
      escalationLevel: input.escalationLevel ?? 0,
    })
  } catch (err) {
    logger.error('notification create failed', {
      type: input.type,
      tenantId: input.tenantId,
      message: (err as Error).message,
    })
    return null
  }
}

export async function createMany(inputs: CreateNotificationInput[]): Promise<Notification[]> {
  const out: Notification[] = []
  for (const input of inputs) {
    const row = await create(input)
    if (row) out.push(row)
  }
  return out
}

export async function listForUser(
  tenantId: string,
  userId: string,
  query: ListNotificationsQuery,
): Promise<NotificationListResult> {
  const result = await repo.listNotifications(tenantId, userId, query)
  return {
    items: result.items.map(mapNotificationToDto),
    counts: result.counts,
    page: result.page,
    limit: result.limit,
    total: result.total,
  }
}

export async function unreadCount(tenantId: string, userId: string): Promise<{ unread: number }> {
  const unread = await repo.countUnread(tenantId, userId)
  return { unread }
}

export async function summary(tenantId: string, userId: string) {
  const result = await repo.listNotifications(tenantId, userId, {
    page: 1,
    limit: 10,
    status: 'OPEN',
  } as ListNotificationsQuery)
  return {
    counts: result.counts,
    recent: result.items.map(mapNotificationToDto),
  }
}

export async function markRead(
  tenantId: string,
  userId: string,
  id: string,
): Promise<NotificationDto> {
  const row = await repo.markRead(tenantId, userId, id)
  if (!row) throw new NotFoundError('Notification not found')
  return mapNotificationToDto(row)
}

export async function markAllRead(tenantId: string, userId: string) {
  const count = await repo.markAllRead(tenantId, userId)
  return { count }
}

export async function resolve(tenantId: string, userId: string, id: string): Promise<NotificationDto> {
  const row = await repo.resolveNotification(tenantId, userId, id)
  if (!row) throw new NotFoundError('Notification not found')
  return mapNotificationToDto(row)
}

export async function dismiss(tenantId: string, userId: string, id: string): Promise<NotificationDto> {
  const row = await repo.dismissNotification(tenantId, userId, id)
  if (!row) throw new NotFoundError('Notification not found')
  return mapNotificationToDto(row)
}

export async function snooze(
  tenantId: string,
  userId: string,
  id: string,
  input: SnoozeNotificationInput,
): Promise<NotificationDto> {
  let until: Date
  if (input.until) {
    until = new Date(input.until)
  } else if (input.minutes) {
    until = new Date(Date.now() + input.minutes * 60_000)
  } else {
    throw new ValidationError('until or minutes is required')
  }
  if (until.getTime() <= Date.now()) {
    throw new ValidationError('Snooze time must be in the future')
  }
  const row = await repo.snoozeNotification(tenantId, userId, id, until)
  if (!row) throw new NotFoundError('Notification not found')
  return mapNotificationToDto(row)
}

export async function resolveRelated(
  tenantId: string,
  entityType: string,
  entityId: string,
  types?: string[],
) {
  return repo.resolveByEntity(tenantId, { entityType, entityId, types })
}

export async function listPreferences(tenantId: string, userId: string) {
  const rows = await repo.listPreferences(tenantId, userId)
  return rows.map((r) => mapPreferenceToDto(r, MANDATORY_NOTIFICATION_TYPES.has(r.notificationType)))
}

export async function putPreferences(tenantId: string, userId: string, input: PutPreferencesInput) {
  const saved = []
  for (const item of input.items) {
    const mandatory = MANDATORY_NOTIFICATION_TYPES.has(item.notificationType)
    const row = await repo.upsertPreference(tenantId, userId, item.notificationType, {
      inAppEnabled: mandatory ? true : item.inAppEnabled,
      emailEnabled: item.emailEnabled,
      mobilePushEnabled: item.mobilePushEnabled,
      whatsappEnabled: item.whatsappEnabled,
      dailyDigestEnabled: item.dailyDigestEnabled,
      reminderMinutesBefore: item.reminderMinutesBefore,
      escalationEnabled: item.escalationEnabled,
      muteUntil: item.muteUntil === undefined
        ? undefined
        : item.muteUntil
          ? new Date(item.muteUntil)
          : null,
    })
    saved.push(mapPreferenceToDto(row, mandatory))
  }
  return saved
}

export async function getTenantSettings(tenantId: string) {
  const row = await repo.getOrCreateTenantSettings(tenantId)
  return mapTenantSettingsToDto(row)
}
