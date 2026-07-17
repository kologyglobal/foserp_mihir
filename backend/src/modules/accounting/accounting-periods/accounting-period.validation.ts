import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listPeriodsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  financialYearId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'CLOSED', 'REOPENED']).optional(),
})

export const generatePeriodsSchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYearId: z.string().uuid(),
})

export const updatePeriodSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

export const reopenPeriodSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export type ListPeriodsQuery = z.infer<typeof listPeriodsQuerySchema>
export type GeneratePeriodsInput = z.infer<typeof generatePeriodsSchema>
export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>
export type ReopenPeriodInput = z.infer<typeof reopenPeriodSchema>
