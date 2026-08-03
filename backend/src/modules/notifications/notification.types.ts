import type { Notification, NotificationPreference, NotificationTenantSettings } from '@prisma/client'
import { toIso } from '../../shared/index.js'

export type NotificationDto = {
  id: string
  category: string
  type: string
  priority: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  entityCode: string | null
  entityName: string | null
  actionUrl: string | null
  primaryAction: string | null
  secondaryAction: string | null
  status: string
  readAt: string | null
  resolvedAt: string | null
  snoozedUntil: string | null
  sourceEventId: string | null
  deduplicationKey: string | null
  escalationLevel: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type NotificationCountsDto = {
  unread: number
  critical: number
  high: number
  snoozed: number
}

export type NotificationListResult = {
  items: NotificationDto[]
  counts: NotificationCountsDto
  page: number
  limit: number
  total: number
}

export type NotificationPreferenceDto = {
  notificationType: string
  inAppEnabled: boolean
  emailEnabled: boolean
  mobilePushEnabled: boolean
  whatsappEnabled: boolean
  dailyDigestEnabled: boolean
  reminderMinutesBefore: number | null
  escalationEnabled: boolean
  muteUntil: string | null
  isMandatory: boolean
}

export type NotificationTenantSettingsDto = {
  leadContactSlaHours: number
  leadContactEscalateHours: number
  leadContactCriticalHours: number
  opportunityInactiveDays: number
  opportunityInactiveHighValueDays: number
  opportunityStuckDays: number
  highValueDealThreshold: number
  followUpEscalateHours: number
  followUpCriticalHours: number
  quotationExpiringDays: number
  acceptedQuoteAwaitingSoHours: number
  businessDayStartHour: number
  businessDayEndHour: number
  timezoneOverride: string | null
  dailyDigestHourLocal: number
}

export function mapNotificationToDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    priority: row.priority,
    title: row.title,
    message: row.message,
    entityType: row.entityType,
    entityId: row.entityId,
    entityCode: row.entityCode,
    entityName: row.entityName,
    actionUrl: row.actionUrl,
    primaryAction: row.primaryAction,
    secondaryAction: row.secondaryAction,
    status: row.status,
    readAt: toIso(row.readAt),
    resolvedAt: toIso(row.resolvedAt),
    snoozedUntil: toIso(row.snoozedUntil),
    sourceEventId: row.sourceEventId,
    deduplicationKey: row.deduplicationKey,
    escalationLevel: row.escalationLevel,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  }
}

export function mapPreferenceToDto(
  row: NotificationPreference,
  isMandatory: boolean,
): NotificationPreferenceDto {
  return {
    notificationType: row.notificationType,
    inAppEnabled: isMandatory ? true : row.inAppEnabled,
    emailEnabled: row.emailEnabled,
    mobilePushEnabled: row.mobilePushEnabled,
    whatsappEnabled: row.whatsappEnabled,
    dailyDigestEnabled: row.dailyDigestEnabled,
    reminderMinutesBefore: row.reminderMinutesBefore,
    escalationEnabled: row.escalationEnabled,
    muteUntil: toIso(row.muteUntil),
    isMandatory,
  }
}

export function mapTenantSettingsToDto(row: NotificationTenantSettings): NotificationTenantSettingsDto {
  return {
    leadContactSlaHours: row.leadContactSlaHours,
    leadContactEscalateHours: row.leadContactEscalateHours,
    leadContactCriticalHours: row.leadContactCriticalHours,
    opportunityInactiveDays: row.opportunityInactiveDays,
    opportunityInactiveHighValueDays: row.opportunityInactiveHighValueDays,
    opportunityStuckDays: row.opportunityStuckDays,
    highValueDealThreshold: Number(row.highValueDealThreshold),
    followUpEscalateHours: row.followUpEscalateHours,
    followUpCriticalHours: row.followUpCriticalHours,
    quotationExpiringDays: row.quotationExpiringDays,
    acceptedQuoteAwaitingSoHours: row.acceptedQuoteAwaitingSoHours,
    businessDayStartHour: row.businessDayStartHour,
    businessDayEndHour: row.businessDayEndHour,
    timezoneOverride: row.timezoneOverride,
    dailyDigestHourLocal: row.dailyDigestHourLocal,
  }
}
