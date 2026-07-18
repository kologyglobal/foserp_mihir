import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { CUSTOMER_TYPES } from './company.constants.js'
import { optionalPhoneSchema } from '../../../utils/phoneValidation.js'
import { optionalEmailSchema } from '../../../utils/emailValidation.js'

export const listCompaniesQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const createCompanySchema = z.object({
  customerCode: z.string().trim().max(32).optional(),
  customerName: z.string().trim().min(1).max(300),
  customerType: z.enum(CUSTOMER_TYPES).default('corporate'),
  industry: z.string().trim().max(100).optional(),
  website: z.string().trim().max(255).optional(),
  turnoverRange: z.string().trim().max(64).optional(),
  employeeRange: z.string().trim().max(64).optional(),
  email: optionalEmailSchema.optional().or(z.literal('')),
  phone: optionalPhoneSchema,
  addressLine1: z.string().trim().max(500).optional(),
  addressLine2: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  gstin: z.string().trim().max(20).optional(),
  pan: z.string().trim().max(20).optional(),
  contactPerson: z.string().trim().max(200).optional(),
  contactPhone: optionalPhoneSchema,
  contactEmail: optionalEmailSchema.optional().or(z.literal('')),
  creditDays: z.coerce.number().int().min(0).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  salesTerritory: z.string().trim().max(32).optional(),
  source: z.string().trim().max(64).optional(),
  status: z.string().trim().max(32).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().optional(),
  ownerId: z.string().uuid().optional(),
})

export const updateCompanySchema = createCompanySchema.partial()

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>
export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
