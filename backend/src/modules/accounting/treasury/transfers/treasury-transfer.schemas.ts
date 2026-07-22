import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

const isoDateString = z.string().trim().min(8).max(32)

export const treasuryTransferPurposeSchema = z.enum([
  'FUND_MOVEMENT',
  'CASH_REPLENISHMENT',
  'CASH_DEPOSIT',
  'BANK_ACCOUNT_BALANCING',
  'INTER_BRANCH_FUNDING',
  'PETTY_CASH_REPLENISHMENT',
  'OTHER',
])

export const treasuryTransferPostingModeSchema = z.enum(['DIRECT', 'IN_TRANSIT'])

const baseTreasuryTransferSchema = z.object({
  legalEntityId: z.string().uuid(),
  sourceBranchId: z.string().uuid().nullable().optional(),
  destinationBranchId: z.string().uuid().nullable().optional(),
  sourceTreasuryAccountId: z.string().uuid(),
  destinationTreasuryAccountId: z.string().uuid(),
  transferPurpose: treasuryTransferPurposeSchema,
  transferDate: isoDateString,
  sourcePostingDate: isoDateString,
  expectedReceiptDate: isoDateString.nullable().optional(),
  destinationPostingDate: isoDateString.nullable().optional(),
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
  exchangeRate: z.union([z.string(), z.number()]).default('1'),
  transferAmount: z.union([z.string(), z.number()]),
  externalReference: z.string().trim().max(128).nullable().optional(),
  narration: z.string().trim().max(2000).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  postingModeOverride: treasuryTransferPostingModeSchema.optional(),
  approvalRequiredOverride: z.boolean().optional(),
})

export const createTreasuryTransferSchema = baseTreasuryTransferSchema.superRefine((data, ctx) => {
  if (data.sourceTreasuryAccountId === data.destinationTreasuryAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['destinationTreasuryAccountId'],
      message: 'Source and destination treasury accounts must be different',
    })
  }
})

export const updateTreasuryTransferSchema = baseTreasuryTransferSchema
  .extend({ expectedUpdatedAt: z.string().datetime() })
  .superRefine((data, ctx) => {
    if (data.sourceTreasuryAccountId === data.destinationTreasuryAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationTreasuryAccountId'],
        message: 'Source and destination treasury accounts must be different',
      })
    }
  })

export const listTreasuryTransfersQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  status: z
    .enum(['DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'READY_TO_POST', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'REVERSED'])
    .optional(),
  transferType: z.enum(['BANK_TO_BANK', 'BANK_TO_CASH', 'CASH_TO_BANK', 'CASH_TO_CASH']).optional(),
  postingMode: treasuryTransferPostingModeSchema.optional(),
  sourceTreasuryAccountId: z.string().uuid().optional(),
  destinationTreasuryAccountId: z.string().uuid().optional(),
  dateFrom: isoDateString.optional(),
  dateTo: isoDateString.optional(),
})

export const expectedUpdatedAtSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const submitTreasuryTransferSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const approveTreasuryTransferSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const rejectTreasuryTransferSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const reviseTreasuryTransferSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().max(500).optional(),
})

export const markReadyTreasuryTransferSchema = expectedUpdatedAtSchema

export const cancelTreasuryTransferSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const postTreasuryTransferSchema = expectedUpdatedAtSchema
export const dispatchTreasuryTransferSchema = expectedUpdatedAtSchema
export const receiveTreasuryTransferSchema = expectedUpdatedAtSchema

export const reverseTreasuryTransferSchema = expectedUpdatedAtSchema.extend({
  reversalDate: isoDateString,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(1).max(128),
})

export type CreateTreasuryTransferInput = z.infer<typeof createTreasuryTransferSchema>
export type UpdateTreasuryTransferInput = z.infer<typeof updateTreasuryTransferSchema>
export type ListTreasuryTransfersQuery = z.infer<typeof listTreasuryTransfersQuerySchema>
export type SubmitTreasuryTransferInput = z.infer<typeof submitTreasuryTransferSchema>
export type ApproveTreasuryTransferInput = z.infer<typeof approveTreasuryTransferSchema>
export type RejectTreasuryTransferInput = z.infer<typeof rejectTreasuryTransferSchema>
export type ReviseTreasuryTransferInput = z.infer<typeof reviseTreasuryTransferSchema>
export type MarkReadyTreasuryTransferInput = z.infer<typeof markReadyTreasuryTransferSchema>
export type CancelTreasuryTransferInput = z.infer<typeof cancelTreasuryTransferSchema>
export type PostTreasuryTransferInput = z.infer<typeof postTreasuryTransferSchema>
export type DispatchTreasuryTransferInput = z.infer<typeof dispatchTreasuryTransferSchema>
export type ReceiveTreasuryTransferInput = z.infer<typeof receiveTreasuryTransferSchema>
export type ReverseTreasuryTransferInput = z.infer<typeof reverseTreasuryTransferSchema>
