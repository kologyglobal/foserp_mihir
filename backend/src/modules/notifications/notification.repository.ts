import type { Notification, NotificationPriority, NotificationStatus, Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import type { CreateNotificationInput } from './notification.constants.js'
import type { ListNotificationsQuery } from './notification.validation.js'

const OPEN: NotificationStatus[] = ['UNREAD', 'READ', 'SNOOZED']

export async function findByDedup(
  tenantId: string,
  deduplicationKey: string,
): Promise<Notification | null> {
  return prisma.notification.findFirst({
    where: {
      tenantId,
      deduplicationKey,
      deletedAt: null,
      status: { in: OPEN },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function insertNotification(
  input: CreateNotificationInput,
  data: {
    priority: NotificationPriority
    escalationLevel: number
  },
): Promise<Notification> {
  return prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientUserId: input.recipientUserId,
      category: input.category,
      type: input.type,
      priority: data.priority,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      entityCode: input.entityCode ?? null,
      entityName: input.entityName ?? null,
      actionUrl: input.actionUrl ?? null,
      primaryAction: input.primaryAction ?? null,
      secondaryAction: input.secondaryAction ?? null,
      sourceEventId: input.sourceEventId ?? null,
      deduplicationKey: input.deduplicationKey ?? null,
      escalationLevel: data.escalationLevel,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      createdByUserId: input.createdByUserId ?? input.actorUserId ?? null,
    },
  })
}

export async function updateOpenNotification(
  id: string,
  tenantId: string,
  data: Prisma.NotificationUpdateInput,
): Promise<Notification> {
  // Composite uniqueness isn't on id alone for defence-in-depth tenant scope.
  await prisma.notification.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: data as Prisma.NotificationUpdateManyMutationInput,
  })
  const row = await prisma.notification.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!row) throw new Error('Notification not found after update')
  return row
}

export async function findNotificationForUser(
  tenantId: string,
  recipientUserId: string,
  id: string,
): Promise<Notification | null> {
  return prisma.notification.findFirst({
    where: { id, tenantId, recipientUserId, deletedAt: null },
  })
}

export async function listNotifications(
  tenantId: string,
  recipientUserId: string,
  query: ListNotificationsQuery,
) {
  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 20, 100)
  const skip = (page - 1) * limit
  const now = new Date()

  const where: Prisma.NotificationWhereInput = {
    tenantId,
    recipientUserId,
    deletedAt: null,
  }

  if (query.unreadOnly) {
    where.status = 'UNREAD'
  } else if (query.status === 'OPEN') {
    where.OR = [
      { status: { in: ['UNREAD', 'READ'] } },
      { status: 'SNOOZED', snoozedUntil: { lte: now } },
    ]
  } else if (query.status) {
    where.status = query.status
  }

  if (query.category) where.category = query.category
  if (query.type) where.type = query.type
  if (query.priority) where.priority = query.priority
  if (query.entityType) where.entityType = query.entityType
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    }
  }

  const [items, total, unread, critical, high, snoozed] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { tenantId, recipientUserId, deletedAt: null, status: 'UNREAD' },
    }),
    prisma.notification.count({
      where: {
        tenantId,
        recipientUserId,
        deletedAt: null,
        status: 'UNREAD',
        priority: 'CRITICAL',
      },
    }),
    prisma.notification.count({
      where: {
        tenantId,
        recipientUserId,
        deletedAt: null,
        status: 'UNREAD',
        priority: 'HIGH',
      },
    }),
    prisma.notification.count({
      where: {
        tenantId,
        recipientUserId,
        deletedAt: null,
        status: 'SNOOZED',
        snoozedUntil: { gt: now },
      },
    }),
  ])

  return {
    items,
    total,
    page,
    limit,
    counts: { unread, critical, high, snoozed },
  }
}

export async function countUnread(tenantId: string, recipientUserId: string): Promise<number> {
  return prisma.notification.count({
    where: { tenantId, recipientUserId, deletedAt: null, status: 'UNREAD' },
  })
}

export async function markRead(
  tenantId: string,
  recipientUserId: string,
  id: string,
): Promise<Notification | null> {
  const row = await findNotificationForUser(tenantId, recipientUserId, id)
  if (!row) return null
  if (row.status === 'RESOLVED' || row.status === 'DISMISSED') return row
  return prisma.notification.update({
    where: { id },
    data: {
      status: 'READ',
      readAt: row.readAt ?? new Date(),
    },
  })
}

export async function markAllRead(tenantId: string, recipientUserId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      tenantId,
      recipientUserId,
      deletedAt: null,
      status: { in: ['UNREAD', 'SNOOZED'] },
    },
    data: { status: 'READ', readAt: new Date(), snoozedUntil: null },
  })
  return result.count
}

export async function resolveNotification(
  tenantId: string,
  recipientUserId: string,
  id: string,
): Promise<Notification | null> {
  const row = await findNotificationForUser(tenantId, recipientUserId, id)
  if (!row) return null
  return prisma.notification.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      readAt: row.readAt ?? new Date(),
    },
  })
}

export async function dismissNotification(
  tenantId: string,
  recipientUserId: string,
  id: string,
): Promise<Notification | null> {
  const row = await findNotificationForUser(tenantId, recipientUserId, id)
  if (!row) return null
  return prisma.notification.update({
    where: { id },
    data: {
      status: 'DISMISSED',
      resolvedAt: new Date(),
      readAt: row.readAt ?? new Date(),
    },
  })
}

export async function snoozeNotification(
  tenantId: string,
  recipientUserId: string,
  id: string,
  until: Date,
): Promise<Notification | null> {
  const row = await findNotificationForUser(tenantId, recipientUserId, id)
  if (!row) return null
  return prisma.notification.update({
    where: { id },
    data: {
      status: 'SNOOZED',
      snoozedUntil: until,
      readAt: row.readAt ?? new Date(),
    },
  })
}

/** Resolve open notifications by entity + type(s) for all recipients (post-action). */
export async function resolveByEntity(
  tenantId: string,
  opts: {
    entityType: string
    entityId: string
    types?: string[]
  },
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      tenantId,
      deletedAt: null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      status: { in: OPEN },
      ...(opts.types?.length ? { type: { in: opts.types } } : {}),
    },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  })
  return result.count
}

export async function getPreference(
  tenantId: string,
  userId: string,
  notificationType: string,
) {
  return prisma.notificationPreference.findUnique({
    where: {
      tenantId_userId_notificationType: { tenantId, userId, notificationType },
    },
  })
}

export async function listPreferences(tenantId: string, userId: string) {
  return prisma.notificationPreference.findMany({
    where: { tenantId, userId },
    orderBy: { notificationType: 'asc' },
  })
}

export async function upsertPreference(
  tenantId: string,
  userId: string,
  notificationType: string,
  data: {
    inAppEnabled?: boolean
    emailEnabled?: boolean
    mobilePushEnabled?: boolean
    whatsappEnabled?: boolean
    dailyDigestEnabled?: boolean
    reminderMinutesBefore?: number | null
    escalationEnabled?: boolean
    muteUntil?: Date | null
  },
) {
  return prisma.notificationPreference.upsert({
    where: {
      tenantId_userId_notificationType: { tenantId, userId, notificationType },
    },
    create: {
      tenantId,
      userId,
      notificationType,
      inAppEnabled: data.inAppEnabled ?? true,
      emailEnabled: data.emailEnabled ?? false,
      mobilePushEnabled: data.mobilePushEnabled ?? false,
      whatsappEnabled: data.whatsappEnabled ?? false,
      dailyDigestEnabled: data.dailyDigestEnabled ?? false,
      reminderMinutesBefore: data.reminderMinutesBefore ?? null,
      escalationEnabled: data.escalationEnabled ?? true,
      muteUntil: data.muteUntil ?? null,
    },
    update: {
      ...(data.inAppEnabled !== undefined ? { inAppEnabled: data.inAppEnabled } : {}),
      ...(data.emailEnabled !== undefined ? { emailEnabled: data.emailEnabled } : {}),
      ...(data.mobilePushEnabled !== undefined ? { mobilePushEnabled: data.mobilePushEnabled } : {}),
      ...(data.whatsappEnabled !== undefined ? { whatsappEnabled: data.whatsappEnabled } : {}),
      ...(data.dailyDigestEnabled !== undefined ? { dailyDigestEnabled: data.dailyDigestEnabled } : {}),
      ...(data.reminderMinutesBefore !== undefined
        ? { reminderMinutesBefore: data.reminderMinutesBefore }
        : {}),
      ...(data.escalationEnabled !== undefined ? { escalationEnabled: data.escalationEnabled } : {}),
      ...(data.muteUntil !== undefined ? { muteUntil: data.muteUntil } : {}),
    },
  })
}

export async function getOrCreateTenantSettings(tenantId: string) {
  const existing = await prisma.notificationTenantSettings.findUnique({ where: { tenantId } })
  if (existing) return existing
  return prisma.notificationTenantSettings.create({ data: { tenantId } })
}

export async function assertUserInTenant(tenantId: string, userId: string): Promise<boolean> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null, status: { not: 'BLOCKED' } },
    select: { id: true },
  })
  return Boolean(u)
}
