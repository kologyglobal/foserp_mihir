import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listApprovalRequestsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  view: z.enum(['my_pending', 'submitted_by_me', 'completed_by_me', 'all']).default('my_pending'),
  status: z.enum(['PENDING', 'APPROVED', 'SENT_BACK', 'REJECTED', 'CANCELLED']).optional(),
  documentType: z.enum(['JOURNAL', 'PAYMENT', 'RECEIPT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PERIOD_REOPEN']).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  amountFrom: z.coerce.number().optional(),
  amountTo: z.coerce.number().optional(),
  search: z.string().trim().max(200).optional(),
})

export const approvalDecisionSchema = z.object({
  comments: z.string().trim().max(1000).optional(),
})

export const sendBackSchema = z.object({
  comments: z.string().trim().min(1, 'Comments are required when sending back').max(1000),
})

export const rejectSchema = z.object({
  comments: z.string().trim().min(1, 'Comments are required when rejecting').max(1000),
})

export type ListApprovalRequestsQuery = z.infer<typeof listApprovalRequestsQuerySchema>
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>
export type SendBackInput = z.infer<typeof sendBackSchema>
export type RejectInput = z.infer<typeof rejectSchema>
