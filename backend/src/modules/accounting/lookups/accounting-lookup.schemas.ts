import { z } from 'zod'

export const accountingLookupListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return true
      if (typeof value === 'boolean') return value
      return value === 'true' || value === '1'
    }),
})

export const customerLookupQuerySchema = accountingLookupListQuerySchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      return value === 'true' || value === '1'
    }),
})

export const itemLookupQuerySchema = accountingLookupListQuerySchema.extend({
  itemType: z.string().max(32).optional(),
})

export const salesOrderLookupQuerySchema = accountingLookupListQuerySchema
  .omit({ activeOnly: true })
  .extend({
    customerId: z.string().uuid().optional(),
    eligibleOnly: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      .transform((value) => {
        if (value === undefined) return true
        if (typeof value === 'boolean') return value
        return value === 'true' || value === '1'
      }),
  })

export const purchaseOrderLookupQuerySchema = accountingLookupListQuerySchema
  .omit({ activeOnly: true })
  .extend({
    vendorId: z.string().uuid().optional(),
    eligibleOnly: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      .transform((value) => {
        if (value === undefined) return true
        if (typeof value === 'boolean') return value
        return value === 'true' || value === '1'
      }),
  })

export const grnLookupQuerySchema = purchaseOrderLookupQuerySchema.extend({
  purchaseOrderId: z.string().uuid().optional(),
})

export const dispatchLookupQuerySchema = accountingLookupListQuerySchema
  .omit({ activeOnly: true })
  .extend({
    customerId: z.string().uuid().optional(),
    salesOrderId: z.string().uuid().optional(),
    eligibleOnly: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      .transform((value) => {
        if (value === undefined) return true
        if (typeof value === 'boolean') return value
        return value === 'true' || value === '1'
      }),
  })

export const eligibilityQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
})
