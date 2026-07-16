import { z } from 'zod'
import { TenantStatus } from '@prisma/client'
import { paginationSchema } from '../../utils/pagination.js'
import { optionalNullablePhoneSchema, optionalPhoneSchema } from '../../utils/phoneValidation.js'

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with optional hyphens')

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugSchema,
  legalName: z.string().trim().max(300).optional(),
  email: z.string().trim().email().max(255),
  phone: optionalPhoneSchema,
  country: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(64).default('Asia/Kolkata'),
  currency: z.string().trim().max(8).default('INR'),
  status: z.nativeEnum(TenantStatus).default('TRIAL'),
  subscriptionPlan: z.string().trim().max(64).optional(),
  subscriptionStatus: z.string().trim().max(64).optional(),
  trialEndsAt: z.coerce.date().optional(),
  adminUser: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
    mobile: optionalPhoneSchema,
  }),
})

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    legalName: z.string().trim().max(300).nullable().optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: optionalNullablePhoneSchema,
    country: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    timezone: z.string().trim().max(64).optional(),
    currency: z.string().trim().max(8).optional(),
    status: z.nativeEnum(TenantStatus).optional(),
    subscriptionPlan: z.string().trim().max(64).nullable().optional(),
    subscriptionStatus: z.string().trim().max(64).nullable().optional(),
    trialEndsAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

export const listTenantsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(TenantStatus).optional(),
})

export type CreateTenantInput = z.infer<typeof createTenantSchema>
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>
export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>
