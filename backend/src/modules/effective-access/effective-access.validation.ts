import { z } from 'zod'

export const effectiveAccessUserParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  userId: z.string().uuid(),
})
