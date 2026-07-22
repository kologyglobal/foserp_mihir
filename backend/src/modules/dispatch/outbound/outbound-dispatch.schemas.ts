import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const outboundDispatchLineInputSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  salesOrderId: z.string().uuid().optional(),
  salesOrderLineId: z.string().uuid().optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export const createOutboundDispatchSchema = z
  .object({
    salesOrderId: z.string().uuid().optional(),
    salesOrderNo: z.string().trim().max(64).optional(),
    remarks: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(150).optional(),
    lines: z.array(outboundDispatchLineInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    data.lines.forEach((line, idx) => {
      if ((line.salesOrderLineId && !line.salesOrderId && !data.salesOrderId) || (line.salesOrderId && !line.salesOrderLineId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'salesOrderId and salesOrderLineId must be provided together on a line (or header salesOrderId + line salesOrderLineId)',
          path: ['lines', idx],
        })
      }
    })
  })

export const updateOutboundDispatchSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
  lines: z.array(outboundDispatchLineInputSchema).min(1).optional(),
})

export const cancelOutboundDispatchSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export const reverseOutboundDispatchSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export const listOutboundDispatchesQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED', 'REVERSED']).optional(),
  salesOrderId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
})

export type CreateOutboundDispatchInput = z.infer<typeof createOutboundDispatchSchema>
export type UpdateOutboundDispatchInput = z.infer<typeof updateOutboundDispatchSchema>
export type CancelOutboundDispatchInput = z.infer<typeof cancelOutboundDispatchSchema>
export type ReverseOutboundDispatchInput = z.infer<typeof reverseOutboundDispatchSchema>
export type ListOutboundDispatchesQuery = z.infer<typeof listOutboundDispatchesQuerySchema>
