import { z } from 'zod'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listNumberSeriesQuerySchema = legalEntityIdQuerySchema

const seriesItemSchema = z.object({
  documentType: z.enum([
    'JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'REVERSAL',
  ]),
  prefix: z.string().trim().min(1).max(20),
  financialYearId: z.string().uuid().nullable().optional(),
  padLength: z.coerce.number().int().min(3).max(12).optional(),
  resetEachYear: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const upsertNumberSeriesSchema = z.object({
  legalEntityId: z.string().uuid(),
  series: z.array(seriesItemSchema).min(1),
})

export type ListNumberSeriesQuery = z.infer<typeof listNumberSeriesQuerySchema>
export type UpsertNumberSeriesInput = z.infer<typeof upsertNumberSeriesSchema>
