import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { optionalPhoneSchema } from '../../../utils/phoneValidation.js'
import { optionalEmailSchema } from '../../../utils/emailValidation.js'

export const listContactsQuerySchema = paginationSchema.extend({
  customerId: z.string().uuid().optional(),
  isPrimary: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  status: z.string().optional(),
})

export const createContactSchema = z.object({
  contactCode: z.string().trim().max(32).optional(),
  customerId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  designation: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  email: optionalEmailSchema.optional().or(z.literal('')),
  phone: optionalPhoneSchema,
  alternatePhone: optionalPhoneSchema,
  linkedInUrl: z.string().trim().url().max(255).optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  masterContactId: z.string().uuid().optional(),
  status: z.string().trim().max(32).optional(),
  notes: z.string().trim().optional(),
  ownerId: z.string().uuid().optional(),
})

export const updateContactSchema = createContactSchema.partial().extend({
  customerId: z.string().uuid().optional(),
})

export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>
export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
