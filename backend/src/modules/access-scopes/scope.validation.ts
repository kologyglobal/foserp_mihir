import { z } from 'zod'

const accessLevelSchema = z.enum(['VIEW', 'TRANSACT', 'ADMIN']).default('TRANSACT')

export const replaceUserScopesSchema = z.object({
  legalEntities: z
    .array(
      z.object({
        legalEntityId: z.string().uuid(),
        accessLevel: accessLevelSchema.optional(),
        isDefault: z.boolean().optional().default(false),
      }),
    )
    .default([]),
  branchIds: z.array(z.string().uuid()).default([]),
  warehouseIds: z.array(z.string().uuid()).default([]),
})

export const userScopeParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  userId: z.string().uuid(),
})

export type ReplaceUserScopesInput = z.infer<typeof replaceUserScopesSchema>
