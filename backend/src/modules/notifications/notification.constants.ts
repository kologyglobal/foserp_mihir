import type {
  NotificationCategory,
  NotificationPriority,
} from '@prisma/client'

/** Stable event type codes — extend without redesign. */
export const NOTIFICATION_TYPES = [
  'LEAD_ASSIGNED',
  'LEAD_UNATTENDED',
  'LEAD_CONVERTED',
  'OPPORTUNITY_ASSIGNED',
  'OPPORTUNITY_STAGE_CHANGED',
  'OPPORTUNITY_INACTIVE',
  'OPPORTUNITY_STUCK',
  'OPPORTUNITY_CLOSE_DATE_MISSED',
  'OPPORTUNITY_WON',
  'OPPORTUNITY_LOST',
  'FOLLOW_UP_DUE',
  'FOLLOW_UP_OVERDUE',
  'ACTIVITY_ASSIGNED',
  'ACTIVITY_DUE',
  'ACTIVITY_OVERDUE',
  'MEETING_REMINDER',
  'QUOTATION_APPROVAL_REQUESTED',
  'QUOTATION_APPROVED',
  'QUOTATION_REJECTED',
  'QUOTATION_EXPIRING',
  'QUOTATION_ACCEPTED_AWAITING_SO',
  'SALES_ORDER_CREATED',
  'EMAIL_REPLY_RECEIVED',
  'WHATSAPP_REPLY_RECEIVED',
  'INTEGRATION_SYNC_FAILED',
  'NEXT_FOLLOW_UP_MISSING',
  'RECORD_MISSING_OWNER',
  'LOST_REASON_MISSING',
  // Purchase (in-app; respect Purchase Setup notificationPreferences)
  'PR_PENDING_APPROVAL',
  'PO_PENDING_APPROVAL',
  'RFQ_RESPONSE_DUE',
  'PO_DELIVERY_APPROACHING',
  'PO_OVERDUE',
  'GRN_PENDING_INSPECTION',
  'INVOICE_MISMATCH',
  'INVOICE_PENDING_APPROVAL',
] as const

export type NotificationTypeCode = (typeof NOTIFICATION_TYPES)[number]

/** Optional types that users can disable completely for in-app. */
export const OPTIONAL_NOTIFICATION_TYPES = new Set<string>([
  'OPPORTUNITY_STAGE_CHANGED',
  'MEETING_REMINDER',
  'LEAD_CONVERTED',
])

/** Critical types that standard users cannot mute (in-app always on). */
export const MANDATORY_NOTIFICATION_TYPES = new Set<string>([
  'FOLLOW_UP_OVERDUE',
  'QUOTATION_APPROVAL_REQUESTED',
  'QUOTATION_REJECTED',
  'INTEGRATION_SYNC_FAILED',
  'OPPORTUNITY_CLOSE_DATE_MISSED',
  'LEAD_UNATTENDED',
  'PR_PENDING_APPROVAL',
  'PO_PENDING_APPROVAL',
  'PO_OVERDUE',
  'INVOICE_MISMATCH',
  'INVOICE_PENDING_APPROVAL',
])

export type CreateNotificationInput = {
  tenantId: string
  recipientUserId: string
  category: NotificationCategory
  type: NotificationTypeCode | string
  priority: NotificationPriority
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  entityCode?: string | null
  entityName?: string | null
  actionUrl?: string | null
  primaryAction?: string | null
  secondaryAction?: string | null
  sourceEventId?: string | null
  deduplicationKey?: string | null
  metadata?: Record<string, unknown> | null
  createdByUserId?: string | null
  actorUserId?: string | null
  /** When true, escalate existing open notification if same key. */
  escalateIfExists?: boolean
  escalationLevel?: number
}

export function buildDedupKey(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(':')
    .slice(0, 255)
}

export function priorityRank(p: NotificationPriority): number {
  switch (p) {
    case 'CRITICAL':
      return 5
    case 'HIGH':
      return 4
    case 'NORMAL':
      return 3
    case 'LOW':
      return 2
    case 'POSITIVE':
      return 1
    default:
      return 0
  }
}
