import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const PURCHASE_INVOICE_STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'MATCHED',
  'PARTIALLY_MATCHED', 'MISMATCH', 'POSTED', 'CANCELLED', 'CLOSED',
] as const

export const listPurchaseInvoicesQuerySchema = paginationSchema.extend({
  status: z.enum(PURCHASE_INVOICE_STATUSES).optional(),
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  goodsReceiptId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
})

export const purchaseInvoiceLineSchema = z.object({
  purchaseOrderLineId: z.string().uuid().optional().nullable(),
  goodsReceiptLineId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().trim().max(64).optional(),
  itemName: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  quantity: z.coerce.number().positive(),
  uomCode: z.string().trim().max(32).optional(),
  rate: z.coerce.number().min(0),
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
  remarks: z.string().trim().max(2000).optional().nullable(),
})

export const createPurchaseInvoiceSchema = z.object({
  invoiceDate: z.string().trim().optional(),
  vendorInvoiceNumber: z.string().trim().max(100).optional().nullable(),
  vendorInvoiceDate: z.string().trim().optional().nullable(),
  vendorId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
  goodsReceiptId: z.string().uuid().optional().nullable(),
  plantId: z.string().uuid().optional().nullable(),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  gstScheme: z.enum(['CGST_SGST', 'IGST']).optional(),
  placeOfSupplyState: z.string().trim().max(100).optional().nullable(),
  placeOfSupplyStateCode: z.string().trim().max(8).optional().nullable(),
  reverseCharge: z.boolean().optional(),
  roundOffAmount: z.coerce.number().optional(),
  overrideAuthorized: z.boolean().optional(),
  overrideRemarks: z.string().trim().max(2000).optional().nullable(),
  remarks: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(purchaseInvoiceLineSchema).min(1),
})

export const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema.partial().extend({
  lines: z.array(purchaseInvoiceLineSchema).min(1).optional(),
})

export const invoiceLifecycleSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
  overrideAuthorized: z.boolean().optional(),
  overrideRemarks: z.string().trim().max(2000).optional(),
}).default({})

export type ListPurchaseInvoicesQuery = z.infer<typeof listPurchaseInvoicesQuerySchema>
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>
export type UpdatePurchaseInvoiceInput = z.infer<typeof updatePurchaseInvoiceSchema>
export type PurchaseInvoiceLineInput = z.infer<typeof purchaseInvoiceLineSchema>
