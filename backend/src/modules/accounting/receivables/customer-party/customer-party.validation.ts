import { z } from 'zod'

export const customerPartyIdSchema = z.string().uuid('customerId must be a valid UUID')

export const findCustomerPartiesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type FindCustomerPartiesQueryInput = z.infer<typeof findCustomerPartiesQuerySchema>
