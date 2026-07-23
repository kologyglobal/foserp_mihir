import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'

export const createResponsibilitySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_]+$/, 'Code must be alphanumeric with underscores'),
  name: z.string().trim().min(1).max(120),
  module: z.string().trim().min(1).max(64),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateResponsibilitySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    module: z.string().trim().min(1).max(64).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

export const listResponsibilitiesQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  module: z.string().trim().max(64).optional(),
})

export const responsibilityIdParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  responsibilityId: z.string().uuid(),
})

export const assignResponsibilitySchema = z.object({
  responsibilityId: z.string().uuid(),
  legalEntityId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  externalRefType: z.string().trim().max(64).nullable().optional(),
  externalRefId: z.string().trim().max(191).nullable().optional(),
})

export const userResponsibilityParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  userId: z.string().uuid(),
})

export const userResponsibilityIdParamSchema = userResponsibilityParamSchema.extend({
  assignmentId: z.string().uuid(),
})

export type CreateResponsibilityInput = z.infer<typeof createResponsibilitySchema>
export type UpdateResponsibilityInput = z.infer<typeof updateResponsibilitySchema>
export type ListResponsibilitiesQuery = z.infer<typeof listResponsibilitiesQuerySchema>
export type AssignResponsibilityInput = z.infer<typeof assignResponsibilitySchema>
