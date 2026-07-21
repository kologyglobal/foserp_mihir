import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
export const PURCHASE_RETURN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'CLOSED'] as const
export const listPurchaseReturnsQuerySchema = paginationSchema.extend({
  status: z.enum(PURCHASE_RETURN_STATUSES).optional(),
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  goodsReceiptId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
})
export const purchaseReturnLineSchema = z.object({
  goodsReceiptLineId: z.string().uuid().optional().nullable(),
  purchaseOrderLineId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().trim().max(64).optional(),
  itemName: z.string().trim().max(300).optional(),
  returnQuantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
})
export const createPurchaseReturnSchema = z.object({
  returnDate: z.string().trim().optional(),
  vendorId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
  goodsReceiptId: z.string().uuid().optional().nullable(),
  qualityInspectionId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  plantId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(5000).optional().nullable(),
  remarks: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(purchaseReturnLineSchema).min(1),
})
export const updatePurchaseReturnSchema = createPurchaseReturnSchema.partial().extend({ lines: z.array(purchaseReturnLineSchema).min(1).optional() })
export const purchaseReturnRemarksSchema = z.object({ remarks: z.string().trim().max(2000).optional() }).default({})
export type ListPurchaseReturnsQuery = z.infer<typeof listPurchaseReturnsQuerySchema>
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>
export type UpdatePurchaseReturnInput = z.infer<typeof updatePurchaseReturnSchema>
export type PurchaseReturnLineInput = z.infer<typeof purchaseReturnLineSchema>
