import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const legalEntityIdQuerySchema = z.object({
  legalEntityId: z.string().uuid().optional(),
})

export const listLegalEntitiesQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
})

const addressJsonSchema = z.record(z.unknown()).optional()

const initialBranchSchema = z
  .object({
    code: z.string().trim().min(1).max(32).optional(),
    name: z.string().trim().min(1).max(200).default('Head Office'),
    branchType: z
      .enum(['HEAD_OFFICE', 'FACTORY', 'WAREHOUSE', 'SALES_OFFICE', 'SERVICE_CENTRE', 'OTHER'])
      .default('HEAD_OFFICE'),
    gstin: z.string().trim().max(15).optional(),
    stateCode: z.string().trim().max(8).optional(),
    addressJson: addressJsonSchema,
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().email().or(z.literal('')).optional(),
  })
  .optional()

export const createLegalEntitySchema = z.object({
  code: z.string().trim().min(1).max(32),
  legalName: z.string().trim().min(1).max(300),
  displayName: z.string().trim().min(1).max(300),
  entityType: z
    .enum(['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP', 'PROPRIETORSHIP', 'TRUST', 'OTHER'])
    .default('PRIVATE_LIMITED'),
  pan: z.string().trim().max(10).optional(),
  cin: z.string().trim().max(21).optional(),
  gstin: z.string().trim().max(15).optional(),
  baseCurrency: z.string().trim().min(3).max(8).default('INR'),
  countryCode: z.string().trim().length(2).default('IN'),
  stateCode: z.string().trim().max(8).optional(),
  registeredAddressJson: addressJsonSchema,
  billingAddressJson: addressJsonSchema,
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(4),
  isDefault: z.boolean().optional(),
  initialBranch: initialBranchSchema,
})

export const updateLegalEntitySchema = createLegalEntitySchema
  .omit({ initialBranch: true })
  .partial()
  .extend({
    code: z.string().trim().min(1).max(32).optional(),
    legalName: z.string().trim().min(1).max(300).optional(),
    displayName: z.string().trim().min(1).max(300).optional(),
  })

export type ListLegalEntitiesQuery = z.infer<typeof listLegalEntitiesQuerySchema>
export type CreateLegalEntityInput = z.infer<typeof createLegalEntitySchema>
export type UpdateLegalEntityInput = z.infer<typeof updateLegalEntitySchema>
