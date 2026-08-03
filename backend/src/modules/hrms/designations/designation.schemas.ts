import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const createDesignationSchema = z.object({
  legalEntityId: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric with optional _ or -'),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  level: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateDesignationSchema = z
  .object({
    legalEntityId: z.string().uuid().nullable().optional(),
    code: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric with optional _ or -')
      .optional(),
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    level: z.coerce.number().int().min(0).max(999).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

export const listDesignationsQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  legalEntityId: z.string().uuid().optional(),
})

export const designationIdParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  designationId: z.string().uuid(),
})

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>
export type ListDesignationsQuery = z.infer<typeof listDesignationsQuerySchema>
