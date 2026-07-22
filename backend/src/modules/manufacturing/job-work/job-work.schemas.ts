import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const id = z.string().uuid()
const qty = z.number().positive()
const optionalText = z.string().max(5000).optional()

export const listJobWorkQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'MATERIAL_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RECONCILIATION_PENDING', 'CLOSED', 'CANCELLED']).optional(),
  vendorId: id.optional(),
  productionOrderId: id.optional(),
  search: z.string().max(200).optional(),
})

export const materialLineSchema = z.object({
  itemId: id, uomId: id.optional(), requiredQty: z.number().min(0), remarks: optionalText,
})

export const createJobWorkSchema = z.object({
  vendorId: id, productionOrderId: id.optional(), processName: z.string().min(1).max(200), itemId: id,
  uomId: id.optional(), orderedQty: qty, rate: z.number().min(0).default(0),
  rateBasis: z.enum(['PER_PIECE', 'PER_KG', 'PER_HOUR', 'PER_BATCH', 'FIXED']).default('PER_PIECE'),
  expectedReturnDate: z.coerce.date().optional(), materialWarehouseId: id, receiptWarehouseId: id,
  plantId: z.string().max(191).optional(), qualityRequired: z.boolean().optional(), materialToSend: optionalText,
  deliveryAddress: optionalText, drawingRevision: z.string().max(100).optional(), qualityInstructions: optionalText,
  remarks: optionalText, idempotencyKey: z.string().max(150).optional(), materialLines: z.array(materialLineSchema).min(1),
})
export const updateJobWorkSchema = createJobWorkSchema.omit({ idempotencyKey: true }).partial()

export const dispatchJobWorkSchema = z.object({
  dispatchedAt: z.coerce.date().optional(), vendorChallan: z.string().max(100).optional(), vehicle: z.string().max(100).optional(),
  transporter: z.string().max(200).optional(), remarks: optionalText,
  lines: z.array(z.object({ materialLineId: id, quantity: qty, batchOrSerial: z.string().max(200).optional() })).min(1),
})
export const receiveJobWorkSchema = z.object({
  receivedAt: z.coerce.date().optional(), receivedQty: qty, acceptedQty: z.number().min(0), rejectedQty: z.number().min(0).default(0),
  reworkQty: z.number().min(0).default(0), scrapReturned: z.number().min(0).default(0), unusedReturned: z.number().min(0).default(0),
  vendorChallan: z.string().max(100).optional(), batchOrSerial: z.string().max(200).optional(), remarks: optionalText,
}).refine((v) => v.acceptedQty + v.rejectedQty + v.reworkQty <= v.receivedQty, 'Disposition cannot exceed received quantity')
export const returnMaterialSchema = z.object({
  remarks: optionalText, lines: z.array(z.object({ materialLineId: id, quantity: qty, scrap: z.boolean().optional() })).min(1),
})
export const reconcileSchema = z.object({
  lines: z.array(z.object({ materialLineId: id, consumedQty: z.number().min(0), returnedQty: z.number().min(0), scrapReturnedQty: z.number().min(0) })).min(1),
})
export const reasonSchema = z.object({ reason: z.string().min(1).max(5000) })
export const invoiceSchema = z.object({ invoiceId: z.string().max(191).optional(), invoiceNo: z.string().min(1).max(100), invoiceAmount: z.number().min(0) })

export type CreateJobWorkInput = z.infer<typeof createJobWorkSchema>
export type UpdateJobWorkInput = z.infer<typeof updateJobWorkSchema>
export type DispatchJobWorkInput = z.infer<typeof dispatchJobWorkSchema>
export type ReceiveJobWorkInput = z.infer<typeof receiveJobWorkSchema>
export type ReturnMaterialInput = z.infer<typeof returnMaterialSchema>
export type ReconcileInput = z.infer<typeof reconcileSchema>
