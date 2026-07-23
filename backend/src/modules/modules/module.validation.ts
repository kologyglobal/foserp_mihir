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

export type SetModuleFlagInput = z.infer<typeof setModuleFlagSchema>
