import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const positiveQuantity = z.coerce.number().positive().finite()

export const createTransferSchema = z.object({
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  transferDate: z.coerce.date().optional(),
  remarks: z.string().trim().max(2000).optional(),
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    batchId: z.string().uuid().optional(),
    batchNumber: z.string().trim().max(64).optional(),
    serialId: z.string().uuid().optional(),
    serialNumber: z.string().trim().max(100).optional(),
    quantity: positiveQuantity,
    rate: z.coerce.number().min(0).finite().optional(),
    remarks: z.string().trim().max(1000).optional(),
  })).min(1),
}).superRefine((value, context) => {
  if (value.fromWarehouseId === value.toWarehouseId) {
    context.addIssue({ code: 'custom', path: ['toWarehouseId'], message: 'Destination warehouse must differ from source' })
  }
  if (new Set(value.lines.map((line) => line.itemId)).size !== value.lines.length) {
    context.addIssue({ code: 'custom', path: ['lines'], message: 'Duplicate items are not allowed' })
  }
})

export const listTransfersSchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'REVERSED']).optional(),
  warehouseId: z.string().uuid().optional(),
})

export const receiveTransferSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  lines: z.array(z.object({
    lineId: z.string().uuid(),
    quantity: positiveQuantity,
  })).min(1),
})

export const postingActionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  remarks: z.string().trim().max(2000).optional(),
})

export const workflowActionSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export type CreateTransferInput = z.infer<typeof createTransferSchema>
export type ListTransfersInput = z.infer<typeof listTransfersSchema>
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>
export type PostingActionInput = z.infer<typeof postingActionSchema>
