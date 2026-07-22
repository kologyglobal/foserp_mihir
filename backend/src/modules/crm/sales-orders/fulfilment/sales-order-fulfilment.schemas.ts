import { z } from 'zod'

export const setCancelledQtySchema = z.object({
  cancelledQty: z.coerce.number().min(0),
})

export const salesOrderLineIdParamSchema = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
})

export type SetCancelledQtyInput = z.infer<typeof setCancelledQtySchema>
