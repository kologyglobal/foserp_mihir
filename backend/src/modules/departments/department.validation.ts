import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'

export const createDepartmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric with optional _ or -'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional().default(true),
})

export const updateDepartmentSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric with optional _ or -')
      .optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

export const listDepartmentsQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
})

export const departmentIdParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  departmentId: z.string().uuid(),
})

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>
