import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

const isoDateString = z.string().trim().min(8).max(32)

export const treasuryChequeDirectionSchema = z.enum(['ISSUED', 'RECEIVED'])
export const treasuryChequeAccountingModeSchema = z.enum(['TRACK_ONLY', 'POST_ON_LIFECYCLE'])
export const treasuryChequeStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY',
  'ISSUED',
  'DEPOSITED',
  'CLEARED',
  'BOUNCED',
  'STOPPED',
  'CANCELLED',
  'REVERSED',
])

const baseTreasuryChequeSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  treasuryAccountId: z.string().uuid(),
  direction: treasuryChequeDirectionSchema,
  accountingMode: treasuryChequeAccountingModeSchema.default('POST_ON_LIFECYCLE'),
  chequeNumber: z.string().trim().min(1).max(32),
  chequeDate: isoDateString,
  bankName: z.string().trim().max(200).nullable().optional(),
  branchName: z.string().trim().max(200).nullable().optional(),
  ifsc: z.string().trim().max(20).nullable().optional(),
  payeeOrDrawerName: z.string().trim().min(1).max(200),
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
  exchangeRate: z.union([z.string(), z.number()]).default('1'),
  amount: z.union([z.string(), z.number()]),
  isPdc: z.boolean().default(false),
  pdcMaturityDate: isoDateString.nullable().optional(),
  counterpartGlAccountId: z.string().uuid().nullable().optional(),
  customerReceiptId: z.string().trim().max(191).nullable().optional(),
  vendorPaymentId: z.string().trim().max(191).nullable().optional(),
  narration: z.string().trim().max(2000).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  approvalRequiredOverride: z.boolean().optional(),
})

export const createTreasuryChequeSchema = baseTreasuryChequeSchema.superRefine((data, ctx) => {
  if (data.isPdc && !data.pdcMaturityDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pdcMaturityDate'], message: 'PDC maturity date is required for post-dated cheques' })
  }
  if (data.customerReceiptId && data.direction !== 'RECEIVED') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerReceiptId'], message: 'customerReceiptId only applies to RECEIVED cheques' })
  }
  if (data.vendorPaymentId && data.direction !== 'ISSUED') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vendorPaymentId'], message: 'vendorPaymentId only applies to ISSUED cheques' })
  }
})

export const updateTreasuryChequeSchema = baseTreasuryChequeSchema
  .extend({ expectedUpdatedAt: z.string().datetime() })
  .superRefine((data, ctx) => {
    if (data.isPdc && !data.pdcMaturityDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pdcMaturityDate'], message: 'PDC maturity date is required for post-dated cheques' })
    }
  })

export const listTreasuryChequesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  status: treasuryChequeStatusSchema.optional(),
  direction: treasuryChequeDirectionSchema.optional(),
  treasuryAccountId: z.string().uuid().optional(),
  chequeNumber: z.string().trim().optional(),
  isPdc: z.coerce.boolean().optional(),
  dateFrom: isoDateString.optional(),
  dateTo: isoDateString.optional(),
})

export const expectedUpdatedAtSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const submitTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const approveTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const rejectTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const reviseTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().max(500).optional(),
})

export const markReadyTreasuryChequeSchema = expectedUpdatedAtSchema

export const cancelTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const issueTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  issueDate: isoDateString.optional(),
})

export const depositTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  depositDate: isoDateString,
})

export const clearTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  clearanceDate: isoDateString,
})

export const bounceTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  bounceDate: isoDateString,
  bounceReason: z.string().trim().min(1).max(500),
})

export const stopTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  stopReason: z.string().trim().min(1).max(500),
})

export const reverseTreasuryChequeSchema = expectedUpdatedAtSchema.extend({
  reversalDate: isoDateString,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(1).max(128),
})

export type CreateTreasuryChequeInput = z.infer<typeof createTreasuryChequeSchema>
export type UpdateTreasuryChequeInput = z.infer<typeof updateTreasuryChequeSchema>
export type ListTreasuryChequesQuery = z.infer<typeof listTreasuryChequesQuerySchema>
export type SubmitTreasuryChequeInput = z.infer<typeof submitTreasuryChequeSchema>
export type ApproveTreasuryChequeInput = z.infer<typeof approveTreasuryChequeSchema>
export type RejectTreasuryChequeInput = z.infer<typeof rejectTreasuryChequeSchema>
export type ReviseTreasuryChequeInput = z.infer<typeof reviseTreasuryChequeSchema>
export type MarkReadyTreasuryChequeInput = z.infer<typeof markReadyTreasuryChequeSchema>
export type CancelTreasuryChequeInput = z.infer<typeof cancelTreasuryChequeSchema>
export type IssueTreasuryChequeInput = z.infer<typeof issueTreasuryChequeSchema>
export type DepositTreasuryChequeInput = z.infer<typeof depositTreasuryChequeSchema>
export type ClearTreasuryChequeInput = z.infer<typeof clearTreasuryChequeSchema>
export type BounceTreasuryChequeInput = z.infer<typeof bounceTreasuryChequeSchema>
export type StopTreasuryChequeInput = z.infer<typeof stopTreasuryChequeSchema>
export type ReverseTreasuryChequeInput = z.infer<typeof reverseTreasuryChequeSchema>
