import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listDispatchDomainEventsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'PUBLISHED', 'FAILED']).optional(),
  eventType: z
    .enum([
      'DISPATCH_POSTED',
      'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED',
      'SALES_ORDER_INVOICE_READY',
      'DISPATCH_REVERSED',
    ])
    .optional(),
  aggregateId: z.string().uuid().optional(),
})

export const processDispatchDomainEventsBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  includeFailed: z.boolean().optional(),
})

export type ListDispatchDomainEventsQuery = z.infer<typeof listDispatchDomainEventsQuerySchema>
export type ProcessDispatchDomainEventsBody = z.infer<typeof processDispatchDomainEventsBodySchema>
