import { z } from 'zod'

export const comparisonListQuerySchema = z.object({
  requestForQuotationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
})

export const createComparisonSchema = z.object({
  requestForQuotationId: z.string().uuid(),
})

export const awardComparisonSchema = z.object({
  awardedVendorQuotationId: z.string().uuid(),
  selectionReason: z.string().trim().min(1),
})

export type ComparisonListQuery = z.infer<typeof comparisonListQuerySchema>
export type CreateComparisonInput = z.infer<typeof createComparisonSchema>
export type AwardComparisonInput = z.infer<typeof awardComparisonSchema>
