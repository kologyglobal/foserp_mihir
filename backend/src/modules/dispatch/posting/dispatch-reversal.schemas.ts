import { z } from 'zod'

export const reversalLineInputSchema = z
  .object({
    postingLineId: z.string().uuid().optional(),
    outboundDispatchLineId: z.string().uuid().optional(),
    quantity: z.coerce.number().positive(),
  })
  .superRefine((data, ctx) => {
    if (!data.postingLineId && !data.outboundDispatchLineId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'postingLineId or outboundDispatchLineId is required',
        path: ['postingLineId'],
      })
    }
  })

export const createDispatchReversalSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  reasonCode: z.string().trim().max(64).optional(),
  effectiveDate: z.string().trim().max(32).optional(),
  force: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  lines: z.array(reversalLineInputSchema).min(1).optional(),
})

export const rejectDispatchReversalSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export const applyDispatchReversalSchema = z.object({
  /** Supervisor override for hard invoice/COGS deps (requires dispatch.override). */
  force: z.boolean().optional(),
})

export const reverseOutboundCompatSchema = createDispatchReversalSchema.extend({
  force: z.boolean().optional(),
  skipApproval: z.boolean().optional(),
  applyImmediately: z.boolean().optional(),
})

export type CreateDispatchReversalInput = z.infer<typeof createDispatchReversalSchema>
export type RejectDispatchReversalInput = z.infer<typeof rejectDispatchReversalSchema>
export type ReverseOutboundCompatInput = z.infer<typeof reverseOutboundCompatSchema>
