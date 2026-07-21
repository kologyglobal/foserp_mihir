import { z } from 'zod'

export const postVendorAdjustmentSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .strict()

export const reverseVendorAdjustmentSchema = z
  .object({
    reversalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().trim().min(1).max(128),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    cascadeAllocationReversals: z.boolean().optional(),
  })
  .strict()

export type PostVendorAdjustmentBody = z.infer<typeof postVendorAdjustmentSchema>
export type ReverseVendorAdjustmentBody = z.infer<typeof reverseVendorAdjustmentSchema>
