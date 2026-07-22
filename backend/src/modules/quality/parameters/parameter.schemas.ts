import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listParametersQuerySchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  parameterType: z.enum(['BOOLEAN', 'NUMERIC', 'TEXT', 'DROPDOWN', 'PHOTO_REQUIRED']).optional(),
})

export const createParameterSchema = z.object({
  parameterCode: z.string().min(1).max(64),
  parameterName: z.string().min(1).max(200),
  parameterType: z.enum(['BOOLEAN', 'NUMERIC', 'TEXT', 'DROPDOWN', 'PHOTO_REQUIRED']),
  uomCode: z.string().max(32).nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  mandatory: z.boolean().optional(),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).optional(),
  passFailRule: z.enum(['BOOLEAN_TRUE', 'BOOLEAN_FALSE', 'NUMERIC_TOLERANCE', 'MANUAL']).optional(),
  dropdownOptions: z.array(z.string().min(1).max(100)).nullable().optional(),
  active: z.boolean().optional(),
})

export const updateParameterSchema = createParameterSchema.partial().extend({
  parameterCode: z.string().min(1).max(64).optional(),
})

export type ListParametersQuery = z.infer<typeof listParametersQuerySchema>
export type CreateParameterInput = z.infer<typeof createParameterSchema>
export type UpdateParameterInput = z.infer<typeof updateParameterSchema>
