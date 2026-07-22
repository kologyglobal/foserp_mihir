import { z } from 'zod'

export const traceabilitySearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(150),
})

export const traceabilityEntityParamSchema = z.object({
  entityType: z.enum([
    'SALES_ORDER',
    'WORK_ORDER',
    'FG_RECEIPT',
    'DISPATCH',
    'DISPATCH_REQUIREMENT',
    'PICK_LIST',
    'PACKING_SESSION',
    'DELIVERY_CHALLAN',
    'INSPECTION',
    'NCR',
  ]),
  entityId: z.string().uuid(),
})

export type TraceabilitySearchQueryInput = z.infer<typeof traceabilitySearchQuerySchema>
