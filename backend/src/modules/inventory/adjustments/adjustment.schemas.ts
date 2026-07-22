import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const createAdjustmentSchema = z.object({
  warehouseId: z.string().uuid(),
  adjustmentDate: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(500),
  remarks: z.string().trim().max(2000).optional(),
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.coerce.number().finite().refine((value) => value !== 0, 'Quantity must be non-zero'),
    rate: z.coerce.number().min(0).finite().optional(),
    reason: z.string().trim().max(500).optional(),
  })).min(1),
}).superRefine((value, context) => {
  if (new Set(value.lines.map((line) => line.itemId)).size !== value.lines.length) {
    context.addIssue({ code: 'custom', path: ['lines'], message: 'Duplicate items are not allowed' })
  }
})

export const listAdjustmentsSchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED']).optional(),
  warehouseId: z.string().uuid().optional(),
})

export const adjustmentPostingSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  remarks: z.string().trim().max(2000).optional(),
})

export const adjustmentActionSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>
export type ListAdjustmentsInput = z.infer<typeof listAdjustmentsSchema>
export type AdjustmentPostingInput = z.infer<typeof adjustmentPostingSchema>
