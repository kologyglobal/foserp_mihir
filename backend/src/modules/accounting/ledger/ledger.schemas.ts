import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal string')

export const ledgerValidationErrorSchema = z.object({
  code: z.string(),
  field: z.string().optional(),
  message: z.string(),
})

export const draftVoucherLineSchema = z.object({
  lineNumber: z.coerce.number().int().min(1),
  accountId: z.string().uuid(),
  partyType: z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER']).nullable().optional(),
  partyId: z.string().uuid().nullable().optional(),
  partyNameSnapshot: z.string().trim().max(300).nullable().optional(),
  debitAmount: decimalString.default('0'),
  creditAmount: decimalString.default('0'),
  baseDebitAmount: decimalString.optional(),
  baseCreditAmount: decimalString.optional(),
  currencyCode: z.string().trim().min(1).max(8).default('INR'),
  exchangeRate: decimalString.default('1'),
  costCentreId: z.string().uuid().nullable().optional(),
  projectReference: z.string().trim().max(64).nullable().optional(),
  departmentReference: z.string().trim().max(64).nullable().optional(),
  referenceDocumentType: z.string().trim().max(64).nullable().optional(),
  referenceDocumentId: z.string().uuid().nullable().optional(),
  referenceDocumentLineId: z.string().uuid().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lineNarration: z.string().trim().max(500).nullable().optional(),
})

export const draftVoucherSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  financialYearId: z.string().uuid(),
  accountingPeriodId: z.string().uuid(),
  voucherType: z.enum([
    'JOURNAL',
    'RECEIPT',
    'PAYMENT',
    'CONTRA',
    'DEBIT_NOTE',
    'CREDIT_NOTE',
    'OPENING_BALANCE',
    'REVERSAL',
    'SYSTEM',
  ]),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  externalReference: z.string().trim().max(100).nullable().optional(),
  narration: z.string().trim().max(5000).nullable().optional(),
  currencyCode: z.string().trim().min(1).max(8).default('INR'),
  exchangeRate: decimalString.default('1'),
  sourceModule: z.string().trim().max(64).nullable().optional(),
  sourceDocumentType: z.string().trim().max(64).nullable().optional(),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  sourceDocumentLineId: z.string().uuid().nullable().optional(),
  lines: z.array(draftVoucherLineSchema).optional(),
})

export const postingEventInputSchema = z.object({
  legalEntityId: z.string().uuid(),
  eventKey: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(100),
  eventVersion: z.coerce.number().int().min(1).default(1),
  sourceModule: z.string().trim().max(64).nullable().optional(),
  sourceDocumentType: z.string().trim().max(64).nullable().optional(),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  sourceDocumentLineId: z.string().uuid().nullable().optional(),
  payload: z.record(z.unknown()),
})

export const postingRuleConditionSchema = z.object({
  field: z.string().trim().min(1).max(64),
  operator: z.enum(['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
})

export const postingRuleLineDefinitionSchema = z.object({
  side: z.enum(['DEBIT', 'CREDIT']),
  accountMappingKey: z.string().trim().min(1).max(64),
  amountSource: z.string().trim().min(1).max(64),
  optional: z.boolean().optional(),
})

export const postingRuleConfigSchema = z.object({
  ruleCode: z.string().trim().min(1).max(64),
  ruleName: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(100),
  version: z.coerce.number().int().min(1).default(1),
  priority: z.coerce.number().int().min(0).default(100),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  conditions: z.array(postingRuleConditionSchema).optional(),
  lineDefinitions: z.array(postingRuleLineDefinitionSchema).min(1),
  isSystemRule: z.boolean().default(false),
})

export const createPostingRuleSchema = postingRuleConfigSchema.extend({
  legalEntityId: z.string().uuid(),
})

export const updatePostingRuleSchema = createPostingRuleSchema.partial().omit({ legalEntityId: true })

export const listPostingRulesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  eventType: z.string().trim().max(100).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
})

export const ledgerQueryFiltersSchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  financialYearId: z.string().uuid().optional(),
  accountingPeriodId: z.string().uuid().optional(),
  voucherType: draftVoucherSchema.shape.voucherType.optional(),
  status: z.enum([
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'POSTED',
    'SENT_BACK',
    'REJECTED',
    'REVERSED',
    'CANCELLED',
  ]).optional(),
  accountId: z.string().uuid().optional(),
  partyType: z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER']).optional(),
  partyId: z.string().uuid().optional(),
  sourceModule: z.string().trim().max(64).optional(),
  sourceDocumentType: z.string().trim().max(64).optional(),
  sourceDocumentId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type DraftVoucherLineSchema = z.infer<typeof draftVoucherLineSchema>
export type DraftVoucherSchema = z.infer<typeof draftVoucherSchema>
export type PostingEventInputSchema = z.infer<typeof postingEventInputSchema>
export type CreatePostingRuleInput = z.infer<typeof createPostingRuleSchema>
export type UpdatePostingRuleInput = z.infer<typeof updatePostingRuleSchema>
export type ListPostingRulesQuery = z.infer<typeof listPostingRulesQuerySchema>
export type LedgerQueryFiltersInput = z.infer<typeof ledgerQueryFiltersSchema>
