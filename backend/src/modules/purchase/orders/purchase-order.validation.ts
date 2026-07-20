import { z } from 'zod'

export const PO_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'CANCELLED',
  'CLOSED',
] as const

export const listPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  status: z.enum(PO_STATUSES).optional(),
  vendorId: z.string().uuid().optional(),
})

export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>
