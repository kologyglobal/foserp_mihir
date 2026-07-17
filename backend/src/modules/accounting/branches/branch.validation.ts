import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const legalEntityIdParamSchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const listBranchesQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
})

export const createBranchSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  branchType: z
    .enum(['HEAD_OFFICE', 'FACTORY', 'WAREHOUSE', 'SALES_OFFICE', 'SERVICE_CENTRE', 'OTHER'])
    .default('OTHER'),
  gstin: z.string().trim().max(15).optional(),
  stateCode: z.string().trim().max(8).optional(),
  addressJson: z.record(z.unknown()).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().or(z.literal('')).optional(),
  isHeadOffice: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export const updateBranchSchema = createBranchSchema.partial()

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>
export type CreateBranchInput = z.infer<typeof createBranchSchema>
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
