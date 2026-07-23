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

export const postOutboundDispatchSchema = z.preprocess(
  (value) => (value == null || typeof value !== 'object' ? {} : value),
  z
    .object({
      idempotencyKey: z.string().trim().min(1).max(150).optional(),
      /** Supervisor emergency post — skips reserve/pick/pack/challan gates (requires dispatch.override). */
      emergency: z.boolean().optional(),
      /** @deprecated Prefer emergencyOverride.businessReason */
      overrideReason: z.string().trim().max(2000).optional(),
      emergencyOverride: z
        .object({
          businessReason: z.string().trim().min(8).max(2000),
          urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
          riskAcknowledged: z.boolean(),
          approvedByName: z.string().trim().min(1).max(200).optional(),
          approvalReference: z.string().trim().max(64).optional(),
          expiresAt: z.string().trim().min(1).max(40).optional(),
          scope: z.string().trim().max(500).optional(),
          remarks: z.string().trim().max(2000).optional(),
          /** When set, consume this pre-granted override instead of creating a new one. */
          overrideId: z.string().uuid().optional(),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.emergency === true) {
        const reason = data.emergencyOverride?.businessReason ?? data.overrideReason
        if (!reason || reason.trim().length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Emergency post requires businessReason (min 8 characters)',
            path: ['emergencyOverride', 'businessReason'],
          })
        }
        if (data.emergencyOverride && data.emergencyOverride.riskAcknowledged !== true) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Risk acknowledgement is required',
            path: ['emergencyOverride', 'riskAcknowledged'],
          })
        }
      }
    }),
)

export const reverseOutboundDispatchSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  reasonCode: z.string().trim().max(64).optional(),
  effectiveDate: z.string().trim().max(32).optional(),
  /** Supervisor override when hard downstream deps exist (7C5). */
  force: z.boolean().optional(),
  /** When true, create SUBMITTED request only (no stock move). Alias of applyImmediately=false. */
  requestOnly: z.boolean().optional(),
  /** Skip approval workflow (requires dispatch.override). */
  skipApproval: z.boolean().optional(),
  /** When false and approval required, returns SUBMITTED reversal without stock move. */
  applyImmediately: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  lines: z
    .array(
      z
        .object({
          outboundDispatchLineId: z.string().uuid().optional(),
          postingLineId: z.string().uuid().optional(),
          quantity: z.coerce.number().positive(),
        })
        .superRefine((data, ctx) => {
          if (!data.postingLineId && !data.outboundDispatchLineId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'postingLineId or outboundDispatchLineId is required',
            })
          }
        }),
    )
    .min(1)
    .optional(),
})

export const listOutboundDispatchesQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED', 'REVERSED']).optional(),
  salesOrderId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
})

export type CreateOutboundDispatchInput = z.infer<typeof createOutboundDispatchSchema>
export type UpdateOutboundDispatchInput = z.infer<typeof updateOutboundDispatchSchema>
export type CancelOutboundDispatchInput = z.infer<typeof cancelOutboundDispatchSchema>
export type PostOutboundDispatchInput = z.infer<typeof postOutboundDispatchSchema>
export type ReverseOutboundDispatchInput = z.infer<typeof reverseOutboundDispatchSchema>
export type ListOutboundDispatchesQuery = z.infer<typeof listOutboundDispatchesQuerySchema>
