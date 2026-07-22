import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

const isoDateString = z.string().trim().min(8).max(32)

export const treasuryAdjustmentTypeSchema = z.enum([
  'BANK_CHARGES',
  'BANK_INTEREST_INCOME',
  'BANK_INTEREST_EXPENSE',
  'COLLECTION_FEE',
  'MERCHANT_FEE',
  'DIRECT_DEBIT',
  'DIRECT_CREDIT',
  'STANDING_INSTRUCTION_DEBIT',
  'STANDING_INSTRUCTION_CREDIT',
  'GST_ADJUSTMENT',
  'OTHER_BANK_DEBIT',
  'OTHER_BANK_CREDIT',
])

export const treasuryAdjustmentDirectionSchema = z.enum(['BANK_DEBIT', 'BANK_CREDIT'])

export const treasuryAdjustmentStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'CANCELLED',
  'REVERSED',
])

export const treasuryAdjustmentLineTypeSchema = z.enum([
  'EXPENSE',
  'INCOME',
  'ASSET',
  'LIABILITY',
  'RECOVERABLE_TAX',
  'NON_RECOVERABLE_TAX',
  'TDS_RECEIVABLE',
  'ROUND_OFF',
  'OTHER',
])

export const gstTreatmentSchema = z.enum(['GST_APPLICABLE', 'GST_NOT_APPLICABLE', 'GST_NON_RECOVERABLE', 'GST_PENDING_REVIEW'])
export const tdsTreatmentSchema = z.enum(['TDS_NOT_APPLICABLE', 'TDS_DEDUCTED', 'TDS_PENDING_REVIEW'])

export const treasuryAdjustmentLineInputSchema = z
  .object({
    lineType: treasuryAdjustmentLineTypeSchema,
    accountId: z.string().uuid().nullable().optional(),
    mappingKey: z.string().trim().max(64).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    amount: z.union([z.string(), z.number()]),
    gstTreatment: gstTreatmentSchema.default('GST_NOT_APPLICABLE'),
    gstRate: z.union([z.string(), z.number()]).nullable().optional(),
    /// GL account for the auto-derived RECOVERABLE_TAX/NON_RECOVERABLE_TAX line (required when gstRate is set — no single generic GST input mapping key exists; CGST/SGST/IGST split is out of Phase 5B3 scope).
    gstAccountId: z.string().uuid().nullable().optional(),
    gstMappingKey: z.string().trim().max(64).nullable().optional(),
    tdsTreatment: tdsTreatmentSchema.default('TDS_NOT_APPLICABLE'),
    tdsRate: z.union([z.string(), z.number()]).nullable().optional(),
    /// GL account for the auto-derived TDS_RECEIVABLE line; defaults to the TDS_RECEIVABLE default mapping when omitted.
    tdsAccountId: z.string().uuid().nullable().optional(),
    tdsMappingKey: z.string().trim().max(64).nullable().optional(),
    narration: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.accountId && !data.mappingKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountId'], message: 'Either accountId or mappingKey is required for each line' })
    }
    if (data.gstTreatment === 'GST_APPLICABLE' || data.gstTreatment === 'GST_NON_RECOVERABLE') {
      if (data.gstRate == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstRate'], message: 'gstRate is required when gstTreatment is GST_APPLICABLE or GST_NON_RECOVERABLE' })
      }
      if (!data.gstAccountId && !data.gstMappingKey) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstAccountId'], message: 'gstAccountId or gstMappingKey is required to post the derived GST line' })
      }
    }
    if (data.tdsTreatment === 'TDS_DEDUCTED' && data.tdsRate == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tdsRate'], message: 'tdsRate is required when tdsTreatment is TDS_DEDUCTED' })
    }
  })

const baseTreasuryAdjustmentSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  treasuryAccountId: z.string().uuid(),
  adjustmentType: treasuryAdjustmentTypeSchema,
  direction: treasuryAdjustmentDirectionSchema.nullable().optional(),
  adjustmentDate: isoDateString,
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
  exchangeRate: z.union([z.string(), z.number()]).default('1'),
  narration: z.string().trim().max(2000).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  approvalRequiredOverride: z.boolean().optional(),
  lines: z.array(treasuryAdjustmentLineInputSchema).min(1, 'At least one offset line is required'),
})

interface AdjustmentTypeRefinementShape {
  adjustmentType: z.infer<typeof treasuryAdjustmentTypeSchema>
  direction?: z.infer<typeof treasuryAdjustmentDirectionSchema> | null
  narration?: string | null
  lines: unknown[]
}

function superRefineAdjustmentType(data: AdjustmentTypeRefinementShape, ctx: z.RefinementCtx) {
  if (data.adjustmentType === 'GST_ADJUSTMENT' && !data.direction) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['direction'], message: 'direction is required for GST_ADJUSTMENT' })
  }
  if (['OTHER_BANK_DEBIT', 'OTHER_BANK_CREDIT'].includes(data.adjustmentType)) {
    if (!data.narration || data.narration.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['narration'], message: 'narration is required for OTHER_BANK_* adjustment types' })
    }
    if (data.lines.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'At least one explicit offset line is required for OTHER_BANK_* adjustment types' })
    }
  }
}

export const createTreasuryAdjustmentSchema = baseTreasuryAdjustmentSchema.superRefine(superRefineAdjustmentType)

export const updateTreasuryAdjustmentSchema = baseTreasuryAdjustmentSchema
  .extend({ expectedUpdatedAt: z.string().datetime() })
  .superRefine(superRefineAdjustmentType)

export const listTreasuryAdjustmentsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  status: treasuryAdjustmentStatusSchema.optional(),
  adjustmentType: treasuryAdjustmentTypeSchema.optional(),
  direction: treasuryAdjustmentDirectionSchema.optional(),
  treasuryAccountId: z.string().uuid().optional(),
  dateFrom: isoDateString.optional(),
  dateTo: isoDateString.optional(),
})

export const expectedUpdatedAtSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const submitTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const approveTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const rejectTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const reviseTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().max(500).optional(),
})

export const markReadyTreasuryAdjustmentSchema = expectedUpdatedAtSchema

export const cancelTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const postTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  postingDate: isoDateString.optional(),
})

export const reverseTreasuryAdjustmentSchema = expectedUpdatedAtSchema.extend({
  reversalDate: isoDateString,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(1).max(128),
})

export const createTreasuryAdjustmentFromStatementLineSchema = baseTreasuryAdjustmentSchema
  .omit({ treasuryAccountId: true })
  .extend({ idempotencyKey: z.string().trim().min(1).max(128) })
  .superRefine(superRefineAdjustmentType)

export type TreasuryAdjustmentLineInputBody = z.infer<typeof treasuryAdjustmentLineInputSchema>
export type CreateTreasuryAdjustmentInput = z.infer<typeof createTreasuryAdjustmentSchema>
export type UpdateTreasuryAdjustmentInput = z.infer<typeof updateTreasuryAdjustmentSchema>
export type ListTreasuryAdjustmentsQuery = z.infer<typeof listTreasuryAdjustmentsQuerySchema>
export type SubmitTreasuryAdjustmentInput = z.infer<typeof submitTreasuryAdjustmentSchema>
export type ApproveTreasuryAdjustmentInput = z.infer<typeof approveTreasuryAdjustmentSchema>
export type RejectTreasuryAdjustmentInput = z.infer<typeof rejectTreasuryAdjustmentSchema>
export type ReviseTreasuryAdjustmentInput = z.infer<typeof reviseTreasuryAdjustmentSchema>
export type MarkReadyTreasuryAdjustmentInput = z.infer<typeof markReadyTreasuryAdjustmentSchema>
export type CancelTreasuryAdjustmentInput = z.infer<typeof cancelTreasuryAdjustmentSchema>
export type PostTreasuryAdjustmentInput = z.infer<typeof postTreasuryAdjustmentSchema>
export type ReverseTreasuryAdjustmentInput = z.infer<typeof reverseTreasuryAdjustmentSchema>
export type CreateTreasuryAdjustmentFromStatementLineInput = z.infer<typeof createTreasuryAdjustmentFromStatementLineSchema>
