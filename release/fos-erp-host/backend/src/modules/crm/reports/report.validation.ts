import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const CRM_REPORT_IDS = [
  'pipeline',
  'stage-wise',
  'follow-up-due',
  'sales-activity',
  'quotation-revision',
  'quotation-approval',
  'won-lost',
  'customer-pipeline',
  'conversion-funnel',
  'lead-register',
  'lead-owner',
  'lead-priority',
  'lead-stage',
  'lead-conversion',
  'closed-leads',
  'lead-active-inactive',
] as const

export const reportQuerySchema = paginationSchema.extend({
  reportId: z.enum(CRM_REPORT_IDS),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  ownerId: z.string().uuid().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
})

export type ReportQuery = z.infer<typeof reportQuerySchema>
