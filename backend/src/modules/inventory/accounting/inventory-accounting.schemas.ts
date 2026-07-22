import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const inventoryAccountingEventTypeSchema = z.enum([
  'GRN_INWARD',
  'GRN_REVERSAL',
  'PURCHASE_RETURN',
  'STOCK_ADJUSTMENT',
  'STOCK_ADJUSTMENT_REVERSAL',
  'STOCK_COUNT_ADJUSTMENT',
  'STOCK_COUNT_REVERSAL',
  'FG_DISPATCH',
  'FG_DISPATCH_REVERSAL',
])

export const listInventoryAccountingEventsQuerySchema = paginationSchema.extend({
  eventType: inventoryAccountingEventTypeSchema.optional(),
  status: z
    .enum([
      'RECORDED',
      'POSTED',
      'SKIPPED_ZERO',
      'SKIPPED_FLAG_OFF',
      'SKIPPED_NO_LEGAL_ENTITY',
      'FAILED',
      'REVERSED',
    ])
    .optional(),
  sourceDocumentId: z.string().uuid().optional(),
})

export type ListInventoryAccountingEventsQuery = z.infer<
  typeof listInventoryAccountingEventsQuerySchema
>
