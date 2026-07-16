import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const FOLLOW_UP_STATUSES = ['pending', 'completed', 'snoozed', 'overdue', 'cancelled'] as const
export const FOLLOW_UP_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export const FOLLOW_UP_VIEWS = ['today', 'overdue', 'upcoming', 'completed', 'mine', 'team'] as const

export const listFollowUpsQuerySchema = paginationSchema.extend({
  view: z.enum(FOLLOW_UP_VIEWS).optional(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
  assignedTo: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
})

export const createFollowUpSchema = z.object({
  followUpType: z.string().trim().min(1).max(64),
  customerId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueTime: z.string().trim().max(8).optional(),
  priority: z.enum(FOLLOW_UP_PRIORITIES).optional(),
  notes: z.string().trim().optional(),
  reminder: z.boolean().optional(),
})

export const updateFollowUpSchema = createFollowUpSchema.partial()

export const completeFollowUpSchema = z.object({
  outcome: z.string().trim().min(1).max(500),
})

export const rescheduleFollowUpSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueTime: z.string().trim().max(8).optional(),
})

export const snoozeFollowUpSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type ListFollowUpsQuery = z.infer<typeof listFollowUpsQuerySchema>
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>
export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>
export type SnoozeFollowUpInput = z.infer<typeof snoozeFollowUpSchema>
