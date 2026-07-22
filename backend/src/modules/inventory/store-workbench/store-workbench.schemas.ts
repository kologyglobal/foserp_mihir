import { z } from 'zod'
import { NEEDS_ACTION_DOMAINS } from './store-workbench.mappers.js'

export const needsActionDomainSchema = z.enum(NEEDS_ACTION_DOMAINS)

export const needsActionDomainParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  domain: needsActionDomainSchema,
})

export const needsActionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type NeedsActionQuery = z.infer<typeof needsActionQuerySchema>
