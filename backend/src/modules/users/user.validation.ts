import { z } from 'zod'
import { UserStatus } from '@prisma/client'
import { paginationSchema } from '../../utils/pagination.js'
import { optionalNullablePhoneSchema, optionalPhoneSchema } from '../../utils/phoneValidation.js'

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  mobile: optionalPhoneSchema,
  designation: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  status: z.nativeEnum(UserStatus).default('INVITED'),
  roleIds: z.array(z.string().uuid()).optional(),
})

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().max(255).optional(),
    mobile: optionalNullablePhoneSchema,
    designation: z.string().trim().max(100).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
    status: z.nativeEnum(UserStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
})

export const listUsersQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
})

// tenantId/tenantSlug are both optional here because these schemas validate the
// merged params of routes mounted under either `/tenants/:tenantId/...` or
// `/t/:tenantSlug/...` (the frontend always uses the slug-based mount via
// `tenantPath()`). The actual tenant scoping is enforced upstream by
// `resolveTenant`/`requireTenantAccess`, not by this param shape.
export const userIdParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  userId: z.string().uuid(),
})

export const userRoleParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type AssignRoleInput = z.infer<typeof assignRoleSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
