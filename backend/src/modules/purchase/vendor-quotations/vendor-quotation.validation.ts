import { z } from 'zod'

export const VQ_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SELECTED',
  'REJECTED',
  'CANCELLED',
  'CLOSED',
] as const

const optionalUuid = z.string().uuid().optional().nullable()
const dateInput = z.string().min(1).optional().nullable()

export const listVendorQuotationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  status: z.enum(VQ_STATUSES).optional(),
  requestForQuotationId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
})

export const vendorQuotationLineSchema = z.object({
  requestForQuotationLineId: optionalUuid,
  itemId: optionalUuid,
  itemCodeSnapshot: z.string().max(64).optional().default(''),
  itemNameSnapshot: z.string().max(300).optional().default(''),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().positive(),
  uomId: optionalUuid,
  rate: z.coerce.number().min(0),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
})

export const createVendorQuotationSchema = z.object({
  quotationDate: dateInput,
  requestForQuotationId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currencyCode: z.string().max(8).optional().default('INR'),
  validUntil: dateInput,
  paymentTerms: z.string().max(200).optional().nullable(),
  deliveryTerms: z.string().max(200).optional().nullable(),
  freightAmount: z.coerce.number().min(0).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  otherCharges: z.coerce.number().min(0).optional().default(0),
  taxAmount: z.coerce.number().min(0).optional().default(0),
  warranty: z.string().max(300).optional().nullable(),
  remarks: z.string().optional().nullable(),
  lines: z.array(vendorQuotationLineSchema).min(1),
})

export const updateVendorQuotationSchema = createVendorQuotationSchema
  .omit({ requestForQuotationId: true, vendorId: true })
  .partial()
  .extend({
    lines: z.array(vendorQuotationLineSchema).min(1).optional(),
  })

export const lifecycleRemarksSchema = z
  .object({ remarks: z.string().optional().nullable() })
  .default({})

export type ListVendorQuotationsQuery = z.infer<typeof listVendorQuotationsQuerySchema>
export type CreateVendorQuotationInput = z.infer<typeof createVendorQuotationSchema>
export type UpdateVendorQuotationInput = z.infer<typeof updateVendorQuotationSchema>
export type LifecycleRemarksInput = z.infer<typeof lifecycleRemarksSchema>
