import { z } from 'zod'

const baseMovementFields = {
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  movementDate: z.coerce.date().optional(),
  referenceNo: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  rate: z.coerce.number().min(0).optional(),
  stockStatus: z.enum(['UNRESTRICTED', 'QC_HOLD', 'BLOCKED', 'REJECTED']).optional(),
  batchId: z.string().uuid().optional(),
  batchNumber: z.string().trim().max(64).optional(),
  lotNumber: z.string().trim().max(100).optional(),
  heatNumber: z.string().trim().max(100).optional(),
  manufacturingDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  serialId: z.string().uuid().optional(),
  serialNumber: z.string().trim().max(100).optional(),
}

export const positiveQtyMovementSchema = z.object({
  ...baseMovementFields,
  quantity: z.coerce.number().positive(),
})

export const adjustmentMovementSchema = z.object({
  ...baseMovementFields,
  quantity: z.coerce.number().refine((value) => value !== 0, 'quantity must be non-zero'),
})

export const issueToWorkOrderSchema = positiveQtyMovementSchema.extend({
  workOrderId: z.string().uuid(),
  consumeReservation: z.boolean().default(true),
})

export const returnFromWorkOrderSchema = positiveQtyMovementSchema.extend({
  workOrderId: z.string().uuid(),
})

export const fgReceiptSchema = positiveQtyMovementSchema.extend({
  workOrderId: z.string().uuid().optional(),
})

export const fgDispatchIssueSchema = positiveQtyMovementSchema.extend({
  salesOrderId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  consumeSoReservation: z.boolean().default(true),
})

export type PositiveQtyMovementInput = z.infer<typeof positiveQtyMovementSchema>
export type AdjustmentMovementInput = z.infer<typeof adjustmentMovementSchema>
export type IssueToWorkOrderInput = z.infer<typeof issueToWorkOrderSchema>
export type ReturnFromWorkOrderInput = z.infer<typeof returnFromWorkOrderSchema>
export type FgReceiptInput = z.infer<typeof fgReceiptSchema>
export type FgDispatchIssueInput = z.infer<typeof fgDispatchIssueSchema>
