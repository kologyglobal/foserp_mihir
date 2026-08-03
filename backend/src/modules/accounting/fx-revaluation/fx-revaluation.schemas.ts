import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
const rateSchema = z
  .union([z.number(), z.string()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,8})?$/.test(v) && Number(v) > 0, 'Rate must be a positive number')

export const listFxRatesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  currencyCode: z.string().trim().min(3).max(8).optional(),
  asOfDate: dateOnly.optional(),
})

export const upsertFxRateSchema = z.object({
  legalEntityId: z.string().uuid(),
  currencyCode: z.string().trim().min(3).max(8).transform((c) => c.toUpperCase()),
  asOfDate: dateOnly,
  rate: rateSchema,
  notes: z.string().trim().max(300).optional(),
})

export const reverseFxRunSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  reversalDate: dateOnly.optional(),
})

export type ListFxRatesQuery = z.infer<typeof listFxRatesQuerySchema>
export type UpsertFxRateInput = z.infer<typeof upsertFxRateSchema>
export type ReverseFxRunInput = z.infer<typeof reverseFxRunSchema>
