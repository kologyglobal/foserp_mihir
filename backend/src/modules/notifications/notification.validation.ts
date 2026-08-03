import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'

export const listNotificationsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['UNREAD', 'READ', 'RESOLVED', 'SNOOZED', 'DISMISSED', 'OPEN'])
    .optional(),
  category: z
    .enum([
      'ASSIGNMENT',
      'FOLLOW_UP',
      'ACTIVITY',
      'MEETING',
      'OPPORTUNITY',
      'QUOTATION',
      'SALES_ORDER',
      'APPROVAL',
      'PROSPECT_REPLY',
      'DATA_QUALITY',
      'RISK',
      'INTEGRATION',
    ])
    .optional(),
  type: z.string().trim().max(64).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'POSITIVE']).optional(),
  entityType: z.string().trim().max(64).optional(),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

export const snoozeNotificationSchema = z
  .object({
    until: z.string().datetime().optional(),
    minutes: z.coerce.number().int().min(5).max(60 * 24 * 14).optional(),
  })
  .refine((v) => Boolean(v.until || v.minutes), { message: 'until or minutes is required' })

export const preferenceItemSchema = z.object({
  notificationType: z.string().trim().min(1).max(64),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  mobilePushEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  dailyDigestEnabled: z.boolean().optional(),
  reminderMinutesBefore: z.coerce.number().int().min(0).max(60 * 24 * 7).nullable().optional(),
  escalationEnabled: z.boolean().optional(),
  muteUntil: z.string().datetime().nullable().optional(),
})

export const putPreferencesSchema = z.object({
  items: z.array(preferenceItemSchema).min(1).max(100),
})

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>
export type SnoozeNotificationInput = z.infer<typeof snoozeNotificationSchema>
export type PutPreferencesInput = z.infer<typeof putPreferencesSchema>
