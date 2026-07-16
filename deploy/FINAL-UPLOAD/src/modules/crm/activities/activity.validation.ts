import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { ACTIVITY_STATUSES, ACTIVITY_TYPES } from './activity.constants.js'

const activityTypeSchema = z.union([
  z.enum(ACTIVITY_TYPES),
  z.enum(['call', 'email', 'meeting', 'whatsapp', 'note', 'site_visit', 'stage_change', 'follow_up_completed', 'demo', 'task']),
])

export const listActivitiesQuerySchema = paginationSchema.extend({
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  type: activityTypeSchema.optional(),
})

export const createActivitySchema = z.object({
  type: activityTypeSchema,
  subject: z.string().trim().min(1).max(500),
  description: z.string().trim().optional(),
  customerId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  activityDate: z.string().datetime().optional().nullable(),
  priority: z.string().trim().max(32).optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  outcome: z.string().trim().optional(),
  nextAction: z.string().trim().optional(),
})

export const updateActivitySchema = createActivitySchema.partial()

export const completeActivitySchema = z.object({
  outcome: z.string().trim().optional(),
  nextAction: z.string().trim().optional(),
  completedAt: z.string().datetime().optional(),
})

export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>
export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>
export type CompleteActivityInput = z.infer<typeof completeActivitySchema>
