import { z } from 'zod'

export const setModuleFlagSchema = z.object({
  isEnabled: z.boolean(),
})

export const moduleKeyParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  moduleKey: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
})

export const replaceModuleAdministratorsSchema = z.object({
  userIds: z.array(z.string().uuid()).max(50),
})

export type SetModuleFlagInput = z.infer<typeof setModuleFlagSchema>
export type ReplaceModuleAdministratorsInput = z.infer<typeof replaceModuleAdministratorsSchema>
