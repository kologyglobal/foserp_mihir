import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listFinancialYearsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
})

export const createFinancialYearSchema = z.object({
  legalEntityId: z.string().uuid(),
  name: z.string().trim().min(1).max(64),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
})

export const updateFinancialYearSchema = createFinancialYearSchema.partial().omit({ legalEntityId: true })

export type ListFinancialYearsQuery = z.infer<typeof listFinancialYearsQuerySchema>
export type CreateFinancialYearInput = z.infer<typeof createFinancialYearSchema>
export type UpdateFinancialYearInput = z.infer<typeof updateFinancialYearSchema>
