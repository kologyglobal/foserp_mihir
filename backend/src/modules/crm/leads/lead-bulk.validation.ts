import { z } from 'zod'

const MAX_BULK = 100

export const bulkLeadIdsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(MAX_BULK),
})

export const bulkAssignLeadsSchema = bulkLeadIdsSchema.extend({
  assignedTo: z.string().uuid(),
  notes: z.string().trim().optional(),
})

export const bulkStatusLeadsSchema = bulkLeadIdsSchema.extend({
  activityStatus: z.enum(['active', 'inactive']).optional(),
  stage: z.string().trim().optional(),
  lifecycleStatus: z.string().trim().optional(),
})

export const bulkArchiveLeadsSchema = bulkLeadIdsSchema

export const bulkRestoreLeadsSchema = bulkLeadIdsSchema

export type BulkAssignLeadsInput = z.infer<typeof bulkAssignLeadsSchema>
export type BulkStatusLeadsInput = z.infer<typeof bulkStatusLeadsSchema>
