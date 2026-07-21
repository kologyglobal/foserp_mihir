import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const APPROVAL_QUEUE_TABS = [
  'pending_mine',
  'approved_by_me',
  'rejected_by_me',
  'all_history',
] as const

export const APPROVAL_DOCUMENT_TYPES = ['PURCHASE_REQUISITION', 'PURCHASE_ORDER'] as const

export const listPurchaseApprovalsQuerySchema = paginationSchema.extend({
  tab: z.enum(APPROVAL_QUEUE_TABS).optional().default('pending_mine'),
  documentType: z.enum(APPROVAL_DOCUMENT_TYPES).optional(),
  documentNumber: z.string().trim().optional(),
  requester: z.string().trim().optional(),
  department: z.string().trim().optional(),
  locationId: z.string().uuid().optional(),
})

export const delegatePurchaseApprovalSchema = z.object({
  toUserId: z.string().uuid(),
  remarks: z.string().trim().max(2000).optional().nullable(),
})

export type ListPurchaseApprovalsQuery = z.infer<typeof listPurchaseApprovalsQuerySchema>
export type DelegatePurchaseApprovalInput = z.infer<typeof delegatePurchaseApprovalSchema>
