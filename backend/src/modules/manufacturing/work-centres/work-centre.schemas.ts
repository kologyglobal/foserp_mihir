import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listWorkCentresQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true'
    }),
})

const workCentreBaseSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  plantCode: z.string().trim().max(32).optional(),
  departmentRef: z.string().trim().max(100).optional(),
  locationId: z.string().uuid().nullable().optional(),
  capacityPerShift: z.coerce.number().min(0).optional(),
  capacityUomId: z.string().uuid().nullable().optional(),
  defaultShiftRef: z.string().trim().max(64).optional(),
  costRate: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const createWorkCentreSchema = workCentreBaseSchema
export const updateWorkCentreSchema = workCentreBaseSchema.partial()

export type ListWorkCentresQuery = z.infer<typeof listWorkCentresQuerySchema>
export type CreateWorkCentreInput = z.infer<typeof createWorkCentreSchema>
export type UpdateWorkCentreInput = z.infer<typeof updateWorkCentreSchema>
