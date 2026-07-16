import { z } from 'zod'

// tenantId/tenantSlug are both optional: this schema validates the merged
// params of routes mounted under either `/tenants/:tenantId/...` or
// `/t/:tenantSlug/...`. Actual tenant scoping is enforced by
// `resolveTenant`/`requireTenantAccess`, not by this param shape.
export const roleIdParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  roleId: z.string().uuid(),
})

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  permissionNames: z.array(z.string()).default([]),
})

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    permissionNames: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
