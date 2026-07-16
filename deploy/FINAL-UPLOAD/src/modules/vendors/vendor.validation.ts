import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'
import { phoneFieldSchema } from '../../utils/phoneValidation.js'

export const listVendorsQuerySchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  vendorType: z.enum(['manufacturer', 'trader', 'service']).optional(),
})

export const vendorLookupQuerySchema = paginationSchema.extend({
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return true
      if (typeof value === 'boolean') return value
      return value === 'true' || value === '1'
    }),
  vendorType: z.enum(['manufacturer', 'trader', 'service']).optional(),
})

const vendorBaseSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(300),
  searchName: z.string().trim().max(50).optional(),
  isBlocked: z.boolean().optional(),
  address: z.string().trim().max(2000).optional(),
  address2: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).default(''),
  state: z.string().trim().max(100).default(''),
  pincode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  countryId: z.string().uuid().nullable().optional(),
  stateId: z.string().uuid().nullable().optional(),
  cityId: z.string().uuid().nullable().optional(),
  email: z.string().trim().email('Invalid email').or(z.literal('')).optional(),
  gstin: z.string().trim().max(20).default(''),
  gstVendorType: z.enum(['registered', 'composite', 'unregistered', 'import', 'exempted', 'sez']).optional(),
  pan: z.string().trim().max(10).optional(),
  panStatus: z.enum(['pan_applied', 'pan_not_available']).optional(),
  paymentMethod: z.string().trim().max(64).optional(),
  bankDetails: z.string().trim().max(2000).optional(),
  vendorType: z.enum(['manufacturer', 'trader', 'service']).default('manufacturer'),
  contactPerson: z.string().trim().max(200).default(''),
  contactPhone: phoneFieldSchema.default(''),
  paymentTermsDays: z.coerce.number().int().min(0).default(30),
  defaultLeadTimeDays: z.coerce.number().int().min(0).default(7),
  suppliedCategories: z.array(z.string().trim().max(100)).default([]),
  rating: z.coerce.number().min(0).max(5).default(4),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export const createVendorSchema = vendorBaseSchema
export const updateVendorSchema = vendorBaseSchema.partial()

export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>
export type VendorLookupQuery = z.infer<typeof vendorLookupQuerySchema>
export type CreateVendorInput = z.infer<typeof createVendorSchema>
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>
