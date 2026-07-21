import { z } from 'zod'

export const PO_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT_BACK',
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'PARTIALLY_INVOICED',
  'FULLY_INVOICED',
  'CANCELLED',
  'CLOSED',
] as const

export const listPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  status: z.enum(PO_STATUSES).optional(),
  vendorId: z.string().uuid().optional(),
})

export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Expected YYYY-MM-DD date')

export const purchaseOrderLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  lineNumber: z.number().int().positive().optional(),
  itemId: z.string().uuid().nullable().optional(),
  itemCode: z.string().max(64).nullable().optional(),
  itemName: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  uomId: z.string().uuid().nullable().optional(),
  rate: z.coerce.number().min(0).optional().default(0),
  requiredDate: dateString.nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
  purchaseRequisitionLineId: z.string().uuid().nullable().optional(),
  purchasePlanningRowId: z.string().uuid().nullable().optional(),
})

export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineInputSchema>

export const createPurchaseOrderSchema = z.object({
  orderDate: dateString.optional(),
  vendorId: z.string().uuid('Vendor is required'),
  purchaseRequisitionId: z.string().uuid().nullable().optional(),
  expectedDeliveryDate: dateString.nullable().optional(),
  currencyCode: z.string().max(8).optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  deliveryTerms: z.string().max(200).nullable().optional(),
  deliveryWarehouseId: z.string().uuid().nullable().optional(),
  freightAmount: z.coerce.number().min(0).optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  remarks: z.string().max(4000).nullable().optional(),
  lines: z.array(purchaseOrderLineInputSchema).min(1, 'Add at least one line'),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
  .partial()
  .extend({
    lines: z.array(purchaseOrderLineInputSchema).min(1).optional(),
  })

export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>

export const poLifecycleRemarksSchema = z.object({
  remarks: z.string().max(2000).optional(),
})

export type PoLifecycleRemarksInput = z.infer<typeof poLifecycleRemarksSchema>

export const poReasonSchema = z.object({
  reason: z.string().max(2000).optional(),
  remarks: z.string().max(2000).optional(),
})

export type PoReasonInput = z.infer<typeof poReasonSchema>
