import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Must be a valid positive decimal string')

export const statementIdParamSchema = z.object({
  statementId: z.string().uuid(),
})

export const statementLineParamSchema = z.object({
  statementId: z.string().uuid(),
  lineId: z.string().uuid(),
})

export const matchIdParamSchema = z.object({
  matchId: z.string().uuid(),
})

export const suggestionIdParamSchema = z.object({
  suggestionId: z.string().uuid(),
})

export const exceptionIdParamSchema = z.object({
  exceptionId: z.string().uuid(),
})

export const listSessionsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  treasuryAccountId: z.string().uuid().optional(),
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'READY_TO_FINALIZE', 'FINALIZED', 'REOPENED', 'CANCELLED'])
    .optional(),
})

export const listHistoryQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  treasuryAccountId: z.string().uuid().optional(),
})

export const listExceptionsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  treasuryAccountId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
})

export const runAutoMatchBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

export const acceptSuggestionBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
})

export const rejectSuggestionBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

const statementAllocationSchema = z.object({
  bankStatementLineId: z.string().uuid(),
  amount: decimalString,
})

const ledgerAllocationSchema = z.object({
  generalLedgerEntryId: z.string().uuid(),
  amount: decimalString,
})

export const previewMatchBodySchema = z.object({
  statementId: z.string().uuid(),
  statementAllocations: z.array(statementAllocationSchema).min(1),
  ledgerAllocations: z.array(ledgerAllocationSchema).min(1),
  note: z.string().trim().max(1000).optional().nullable(),
})

export const createMatchBodySchema = previewMatchBodySchema.extend({
  idempotencyKey: z.string().trim().min(1).max(128),
})

export const unmatchBodySchema = z.object({
  reason: z.string().trim().min(1, 'Unmatch reason is required').max(500),
  idempotencyKey: z.string().trim().min(1).max(128),
})

export const finalizeSessionBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
  force: z.boolean().optional(),
})

export const reopenSessionBodySchema = z.object({
  reason: z.string().trim().min(1, 'Reopen reason is required').max(500),
})

const journalLineSchemaForDraft = z.object({
  lineNumber: z.coerce.number().int().min(1).optional(),
  accountId: z.string().uuid(),
  partyType: z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER']).optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  partyNameSnapshot: z.string().trim().max(200).optional().nullable(),
  debitAmount: decimalString.or(z.literal('0')).default('0'),
  creditAmount: decimalString.or(z.literal('0')).default('0'),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  exchangeRate: z.string().trim().optional(),
  lineNarration: z.string().trim().max(500).optional().nullable(),
})

export const createAdjustmentDraftBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  narration: z.string().trim().max(2000).optional().nullable(),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  lines: z.array(journalLineSchemaForDraft).min(2, 'At least two journal lines are required'),
})

export const createExceptionBodySchema = z.object({
  statementId: z.string().uuid(),
  bankStatementLineId: z.string().uuid(),
  reason: z.enum([
    'UNKNOWN_TRANSACTION',
    'REFERENCE_MISSING',
    'AMOUNT_MISMATCH',
    'DATE_MISMATCH',
    'POSSIBLE_DUPLICATE',
    'BANK_CHARGE_REQUIRES_JOURNAL',
    'INTEREST_REQUIRES_JOURNAL',
    'CURRENCY_MISMATCH',
    'SOURCE_DOCUMENT_NOT_POSTED',
    'OTHER',
  ]),
  comment: z.string().trim().max(1000).optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
})

export const resolveExceptionBodySchema = z.object({
  resolutionReference: z.string().trim().max(128).optional().nullable(),
  comment: z.string().trim().max(1000).optional().nullable(),
})

export type ListSessionsQueryInput = z.infer<typeof listSessionsQuerySchema>
export type ListHistoryQueryInput = z.infer<typeof listHistoryQuerySchema>
export type ListExceptionsQueryInput = z.infer<typeof listExceptionsQuerySchema>
export type RunAutoMatchBodyInput = z.infer<typeof runAutoMatchBodySchema>
export type AcceptSuggestionBodyInput = z.infer<typeof acceptSuggestionBodySchema>
export type RejectSuggestionBodyInput = z.infer<typeof rejectSuggestionBodySchema>
export type PreviewMatchBodyInput = z.infer<typeof previewMatchBodySchema>
export type CreateMatchBodyInput = z.infer<typeof createMatchBodySchema>
export type UnmatchBodyInput = z.infer<typeof unmatchBodySchema>
export type FinalizeSessionBodyInput = z.infer<typeof finalizeSessionBodySchema>
export type ReopenSessionBodyInput = z.infer<typeof reopenSessionBodySchema>
export type CreateAdjustmentDraftBodyInput = z.infer<typeof createAdjustmentDraftBodySchema>
export type CreateExceptionBodyInput = z.infer<typeof createExceptionBodySchema>
export type ResolveExceptionBodyInput = z.infer<typeof resolveExceptionBodySchema>
