import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
export const PURCHASE_RETURN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'CLOSED'] as const
export const PURCHASE_RETURN_TYPES = ['CREDIT', 'REPLACEMENT', 'REPAIR', 'INSPECTION', 'SCRAP_VENDOR'] as const
export const listPurchaseReturnsQuerySchema = paginationSchema.extend({
  status: z.enum(PURCHASE_RETURN_STATUSES).optional(),
  returnType: z.enum(PURCHASE_RETURN_TYPES).optional(),
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  goodsReceiptId: z.string().uuid().optional(),
  qualityInspectionId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
})
export const purchaseReturnLineSchema = z.object({
  goodsReceiptLineId: z
    .string({
      required_error: 'Goods receipt line is required — only items received on a GRN can be returned.',
    })
    .uuid('Goods receipt line is required — only items received on a GRN can be returned.'),
  purchaseOrderLineId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().trim().max(64).optional(),
  itemName: z.string().trim().max(300).optional(),
  returnQuantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
})
const createPurchaseReturnBodySchema = z.object({
  returnDate: z.string().trim().optional(),
  vendorId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
  goodsReceiptId: z.string().uuid().optional().nullable(),
  qualityInspectionId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  plantId: z.string().uuid().optional().nullable(),
  returnType: z.enum(PURCHASE_RETURN_TYPES).default('CREDIT'),
  decisionCode: z.string().trim().max(40).optional().nullable(),
  ncrId: z.string().uuid().optional().nullable(),
  replacedReturnId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().min(1).max(5000),
  remarks: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(purchaseReturnLineSchema).min(1),
})
export const createPurchaseReturnSchema = createPurchaseReturnBodySchema.superRefine((data, ctx) => {
  if (!data.goodsReceiptId && !data.qualityInspectionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Goods receipt or quality inspection is required. Purchase returns only use received GRN / QI quantities.',
      path: ['goodsReceiptId'],
    })
  }
})
export const updatePurchaseReturnSchema = createPurchaseReturnBodySchema.partial().extend({
  lines: z.array(purchaseReturnLineSchema).min(1).optional(),
  reason: z.string().trim().min(1).max(5000).optional(),
})
export const purchaseReturnRemarksSchema = z.object({ remarks: z.string().trim().max(2000).optional() }).default({})
export const linkReplacementGrnSchema = z.object({
  goodsReceiptId: z.string().uuid(),
})
export type ListPurchaseReturnsQuery = z.infer<typeof listPurchaseReturnsQuerySchema>
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>
export type UpdatePurchaseReturnInput = z.infer<typeof updatePurchaseReturnSchema>
export type PurchaseReturnLineInput = z.infer<typeof purchaseReturnLineSchema>
