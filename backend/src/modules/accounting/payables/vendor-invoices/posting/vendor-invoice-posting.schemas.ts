import { z } from 'zod'

export const postVendorInvoiceSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .strict()

export const reverseVendorInvoiceSchema = z
  .object({
    reversalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    reason: z.string().trim().min(1).max(500),
    idempotencyKey: z.string().trim().min(1).max(128),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    cascadeAllocationReversals: z.boolean().optional(),
  })
  .strict()

export type PostVendorInvoiceBody = z.infer<typeof postVendorInvoiceSchema>
export type ReverseVendorInvoiceBody = z.infer<typeof reverseVendorInvoiceSchema>
