import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'

export const GSTIN_ORG_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const addressSchema = z.object({
  line1: z.string().trim().min(1).max(500),
  line2: z.string().trim().max(500).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(16),
  country: z.string().trim().min(1).max(100),
})

export const listOrgLegalEntitiesQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
  search: z.string().trim().max(200).optional(),
})

export const createOrgLegalEntitySchema = z.object({
  code: z.string().trim().min(1).max(32).default('HO'),
  legalName: z.string().trim().min(1).max(300),
  tradeName: z.string().trim().min(1).max(300).optional(),
  businessType: z
    .enum(['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP', 'PROPRIETORSHIP', 'TRUST', 'OTHER'])
    .default('PRIVATE_LIMITED'),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_ORG_REGEX, 'GST number must be 15 characters in valid format'),
  pan: z.string().trim().max(10).optional(),
  country: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(16),
  addressLine: z.string().trim().min(1).max(1000),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  isDefault: z.boolean().optional(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(4),
})

export const updateOrgLegalEntitySchema = createOrgLegalEntitySchema.partial().extend({
  legalName: z.string().trim().min(1).max(300).optional(),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_ORG_REGEX, 'GST number must be 15 characters in valid format')
    .optional(),
})

export const listRegistrationsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export const createRegistrationSchema = z.object({
  legalEntityId: z.string().uuid(),
  registrationType: z.enum(['GST', 'PAN', 'CIN', 'OTHER']),
  registrationNumber: z.string().trim().min(1).max(64),
  country: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const updateRegistrationSchema = createRegistrationSchema.partial().extend({
  legalEntityId: z.string().uuid().optional(),
})

export const orgLegalEntityIdQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const createOrgFiscalYearSchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().trim().min(1).max(64),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).default('DRAFT'),
  isCurrent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.startDate >= data.endDate) {
    ctx.addIssue({ code: 'custom', message: 'Start date must be before end date', path: ['endDate'] })
  }
})

export const generateOrgPeriodsSchema = z.object({
  financialYearId: z.string().uuid(),
})

export const listOrgPeriodsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYearId: z.string().uuid().optional(),
})

export const upsertOrgMappingsSchema = z.object({
  legalEntityId: z.string().uuid(),
  mappings: z
    .array(
      z.object({
        transactionType: z.string().trim().min(1).max(64),
        accountId: z.string().uuid(),
      }),
    )
    .min(1),
})

export const createOrgAccountSchema = z.object({
  legalEntityId: z.string().uuid(),
  accountCode: z.string().trim().min(1).max(32),
  accountName: z.string().trim().min(1).max(200),
  accountGroup: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  accountType: z.string().trim().min(1).max(64).default('GENERAL'),
  parentAccountId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type CreateOrgLegalEntityInput = z.infer<typeof createOrgLegalEntitySchema>
export type UpdateOrgLegalEntityInput = z.infer<typeof updateOrgLegalEntitySchema>
export type ListOrgLegalEntitiesQuery = z.infer<typeof listOrgLegalEntitiesQuerySchema>
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuerySchema>
export type CreateOrgFiscalYearInput = z.infer<typeof createOrgFiscalYearSchema>
export type UpsertOrgMappingsInput = z.infer<typeof upsertOrgMappingsSchema>
export type CreateOrgAccountInput = z.infer<typeof createOrgAccountSchema>
export type ListOrgPeriodsQuery = z.infer<typeof listOrgPeriodsQuerySchema>

export { addressSchema }
