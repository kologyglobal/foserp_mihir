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

export const PO_LINE_TYPES = ['GOODS', 'SERVICE'] as const

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

export const purchaseOrderLineInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    lineNumber: z.number().int().positive().optional(),
    itemId: z.string().uuid().nullable().optional(),
    lineType: z.enum(PO_LINE_TYPES).optional(),
    itemCode: z.string().max(64).nullable().optional(),
    itemName: z.string().max(300).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    /** Primary/stock qty — computed server-side when uomQuantity provided. */
    quantity: z.coerce.number().positive('Quantity must be greater than zero').optional(),
    /** Vendor/purchase UOM qty (preferred input). */
    uomQuantity: z.coerce.number().positive().optional(),
    /** Vendor units per 1 primary unit (snapshot; defaults from item). */
    uomConversionFactor: z.coerce.number().positive().optional(),
    uomId: z.string().uuid().nullable().optional(),
    /** Vendor unit cost. */
    rate: z.coerce.number().min(0).optional().default(0),
    unitCostPrimary: z.coerce.number().min(0).optional(),
    requiredDate: dateString.nullable().optional(),
    remarks: z.string().max(2000).nullable().optional(),
    purchaseRequisitionLineId: z.string().uuid().nullable().optional(),
    purchasePlanningRowId: z.string().uuid().nullable().optional(),
    requisitionNumber: z.string().max(64).nullable().optional(),
    gstGroupId: z.string().uuid().nullable().optional(),
    hsnId: z.string().uuid().nullable().optional(),
    /** Free-text HSN/SAC code when master id is not sent (snapshot source of truth). */
    hsnCode: z.string().max(16).nullable().optional(),
    binId: z.string().uuid().nullable().optional(),
    qualityTestGroupCode: z.string().trim().max(64).nullable().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.uomQuantity == null && line.quantity == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either uomQuantity or quantity is required',
        path: ['uomQuantity'],
      })
    }

    const itemId = line.itemId?.trim() || null
    if (!itemId) {
      // Quick / free-text line: name + lineType + HSN/SAC required.
      if (!(line.itemName?.trim())) {
        ctx.addIssue({
          code: 'custom',
          message: 'Item name is required for free-text lines',
          path: ['itemName'],
        })
      }
      if (!line.lineType) {
        ctx.addIssue({
          code: 'custom',
          message: 'lineType GOODS or SERVICE is required when itemId is null',
          path: ['lineType'],
        })
      }
      const hasHsn = Boolean(line.hsnId?.trim() || line.hsnCode?.trim())
      if (!hasHsn) {
        ctx.addIssue({
          code: 'custom',
          message: 'HSN/SAC is required for free-text lines',
          path: ['hsnId'],
        })
      }
    }
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
  paymentTermId: z.string().uuid().nullable().optional(),
  deliveryTermId: z.string().uuid().nullable().optional(),
  deliveryWarehouseId: z.string().uuid().nullable().optional(),
  freightAmount: z.coerce.number().min(0).optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  termsAndConditions: z.string().max(20000).nullable().optional(),
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

export const revisePurchaseOrderSchema = z.object({
  reason: z.string().trim().min(1, 'Revision reason is required').max(2000),
  expectedDeliveryDate: dateString.nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  deliveryTerms: z.string().max(200).nullable().optional(),
  termsAndConditions: z.string().max(20000).nullable().optional(),
  freightAmount: z.coerce.number().min(0).optional(),
  remarks: z.string().max(4000).nullable().optional(),
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        /** Primary qty after revision. */
        quantity: z.coerce.number().positive().optional(),
        rate: z.coerce.number().min(0).optional(),
      }),
    )
    .optional(),
})

export type RevisePurchaseOrderInput = z.infer<typeof revisePurchaseOrderSchema>
