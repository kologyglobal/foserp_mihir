import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listCostCentresQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema)
export const costCentreTreeQuerySchema = legalEntityIdQuerySchema

export const createCostCentreSchema = z.object({
  legalEntityId: z.string().uuid(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  isGroup: z.boolean().default(false),
  managerUserId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(5000).optional(),
})

export const updateCostCentreSchema = createCostCentreSchema.partial().omit({ legalEntityId: true })

export type ListCostCentresQuery = z.infer<typeof listCostCentresQuerySchema>
export type CostCentreTreeQuery = z.infer<typeof costCentreTreeQuerySchema>
export type CreateCostCentreInput = z.infer<typeof createCostCentreSchema>
export type UpdateCostCentreInput = z.infer<typeof updateCostCentreSchema>
