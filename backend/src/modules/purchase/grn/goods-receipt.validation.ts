import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const GRN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'RECEIVING_COMPLETED',
  'QC_PENDING',
  'PARTIALLY_ACCEPTED',
  'FULLY_ACCEPTED',
  'INVENTORY_POSTED',
  'CANCELLED',
  'REVERSED',
  'CLOSED',
] as const

export const listGoodsReceiptsQuerySchema = paginationSchema.extend({
  status: z.enum(GRN_STATUSES).optional(),
  purchaseOrderId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
})

export const goodsReceiptLineInputSchema = z.object({
  purchaseOrderLineId: z.string().uuid(),
  challanQuantity: z.coerce.number().min(0).optional(),
  receivedQuantity: z.coerce.number().positive(),
  damagedQuantity: z.coerce.number().min(0).optional(),
  shortQuantity: z.coerce.number().min(0).optional(),
  excessQuantity: z.coerce.number().min(0).optional(),
  acceptedForQcQuantity: z.coerce.number().min(0).optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  storageLocationId: z.string().uuid().optional().nullable(),
  binId: z.string().uuid().optional().nullable(),
  batchNumber: z.string().trim().max(64).optional().nullable(),
  heatNumber: z.string().trim().max(64).optional().nullable(),
  lotNumber: z.string().trim().max(64).optional().nullable(),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  manufacturingDate: z.string().trim().optional().nullable(),
  expiryDate: z.string().trim().optional().nullable(),
  qcRequired: z.boolean().optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
})

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  receiptDate: z.string().trim().min(1).optional(),
  warehouseId: z.string().uuid().optional(),
  plantId: z.string().uuid().optional().nullable(),
  storageLocationId: z.string().uuid().optional().nullable(),
  vendorChallanNumber: z.string().trim().max(100).optional().nullable(),
  vendorChallanDate: z.string().trim().optional().nullable(),
  vendorInvoiceNumber: z.string().trim().max(100).optional().nullable(),
  vehicleNumber: z.string().trim().max(64).optional().nullable(),
  transporterName: z.string().trim().max(200).optional().nullable(),
  lrNumber: z.string().trim().max(64).optional().nullable(),
  gateEntryNumber: z.string().trim().max(64).optional().nullable(),
  receivedById: z.string().trim().max(36).optional().nullable(),
  receivedByName: z.string().trim().max(200).optional().nullable(),
  inspectionRequired: z.boolean().optional(),
  /** Ignored by server — over-receipt is derived from Purchase Setup. */
  allowExcess: z.boolean().optional(),
  remarks: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(goodsReceiptLineInputSchema).min(1),
})

export const updateGoodsReceiptSchema = createGoodsReceiptSchema
  .omit({ purchaseOrderId: true })
  .partial()
  .extend({
    lines: z.array(goodsReceiptLineInputSchema).min(1).optional(),
  })

export const grnLifecycleRemarksSchema = z
  .object({
    remarks: z.string().trim().max(2000).optional(),
  })
  .default({})

export type ListGoodsReceiptsQuery = z.infer<typeof listGoodsReceiptsQuerySchema>
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>
export type UpdateGoodsReceiptInput = z.infer<typeof updateGoodsReceiptSchema>
export type GoodsReceiptLineInput = z.infer<typeof goodsReceiptLineInputSchema>
