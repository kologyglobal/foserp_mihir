import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { CRM_MASTER_KINDS } from './crm-master.constants.js'

export const kindParamSchema = z.object({
  kind: z.enum(CRM_MASTER_KINDS),
})

export const kindIdParamSchema = kindParamSchema.extend({
  id: z.string().uuid(),
})

export const listCrmMastersQuerySchema = paginationSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().trim().optional(),
})

export const createCrmMasterSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  sortOrder: z.coerce.number().int().min(0).default(0),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})

export const updateCrmMasterSchema = createCrmMasterSchema.partial()

export type ListCrmMastersQuery = z.infer<typeof listCrmMastersQuerySchema>
export type CreateCrmMasterInput = z.infer<typeof createCrmMasterSchema>
export type UpdateCrmMasterInput = z.infer<typeof updateCrmMasterSchema>
