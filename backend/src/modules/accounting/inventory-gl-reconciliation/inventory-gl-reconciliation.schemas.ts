import { z } from 'zod'

export const inventoryGlTrialBalanceQuerySchema = z
  .object({
    legalEntityId: z.string().uuid().optional(),
    asOfDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'asOfDate must be YYYY-MM-DD')
      .optional(),
    tolerance: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, 'tolerance must be a positive decimal')
      .optional(),
  })
  .strict()

export const unifiedFailedEventsQuerySchema = z
  .object({
    legalEntityId: z.string().uuid().optional(),
    source: z.enum(['INVENTORY', 'MANUFACTURING', 'ALL']).optional(),
    includeUnposted: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict()

export const retryFailedEventBodySchema = z
  .object({
    source: z.enum(['INVENTORY', 'MANUFACTURING']),
  })
  .strict()

export type InventoryGlTrialBalanceQuery = z.infer<typeof inventoryGlTrialBalanceQuerySchema>
export type UnifiedFailedEventsQuery = z.infer<typeof unifiedFailedEventsQuerySchema>
export type RetryFailedEventBody = z.infer<typeof retryFailedEventBodySchema>
