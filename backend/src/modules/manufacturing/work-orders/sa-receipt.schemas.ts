import { z } from 'zod'

export const postSaReceiptSchema = z.object({
  quantity: z.coerce.number().positive().optional(),
  warehouseId: z.string().uuid().optional(),
  receiptDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  remarks: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  rate: z.coerce.number().min(0).optional(),
  /** Allow SA receipt on FG / standalone WOs (default requires parentProductionOrderId). */
  allowWithoutParent: z.boolean().optional(),
})

export type PostSaReceiptInput = z.infer<typeof postSaReceiptSchema>

export const generateChildOrdersSchema = z.object({
  /** Bypass manufacturingProfile.childProductionOrdersEnabled gate. */
  force: z.boolean().optional(),
})

export type GenerateChildOrdersInput = z.infer<typeof generateChildOrdersSchema>
