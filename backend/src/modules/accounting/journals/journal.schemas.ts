import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')

const partyTypeSchema = z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER']).optional().nullable()

export const journalLineSchema = z.object({
  lineNumber: z.coerce.number().int().min(1).optional(),
  accountId: z.string().uuid(),
  partyType: partyTypeSchema,
  partyId: z.string().uuid().optional().nullable(),
  partyNameSnapshot: z.string().trim().max(200).optional().nullable(),
  debitAmount: decimalString.default('0'),
  creditAmount: decimalString.default('0'),
  baseDebitAmount: decimalString.optional(),
  baseCreditAmount: decimalString.optional(),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  exchangeRate: decimalString.optional(),
  costCentreId: z.string().uuid().optional().nullable(),
  projectReference: z.string().trim().max(100).optional().nullable(),
  departmentReference: z.string().trim().max(100).optional().nullable(),
  referenceDocumentType: z.string().trim().max(64).optional().nullable(),
  referenceDocumentId: z.string().uuid().optional().nullable(),
  referenceDocumentLineId: z.string().uuid().optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lineNarration: z.string().trim().max(500).optional().nullable(),
})

export const createJournalSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  externalReference: z.string().trim().max(100).optional().nullable(),
  narration: z.string().trim().max(2000).optional().nullable(),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  exchangeRate: decimalString.optional(),
  lines: z.array(journalLineSchema).min(2, 'At least two journal lines are required'),
})

export const updateJournalSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  externalReference: z.string().trim().max(100).optional().nullable(),
  narration: z.string().trim().max(2000).optional().nullable(),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  exchangeRate: decimalString.optional(),
  lines: z.array(journalLineSchema).min(2, 'At least two journal lines are required'),
  updatedAt: z.string().datetime().optional(),
})

export const cancelJournalSchema = z.object({
  cancellationReason: z.string().trim().min(1, 'Cancellation reason is required').max(500),
})

export const reverseJournalSchema = z.object({
  reason: z.string().trim().min(1, 'Reversal reason is required').max(500),
})

export const listJournalsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  status: z
    .enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'SENT_BACK', 'REJECTED', 'REVERSED', 'CANCELLED'])
    .optional(),
  postingDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  postingDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  approvalRequired: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
  createdBy: z.string().uuid().optional(),
})

export type CreateJournalInput = z.infer<typeof createJournalSchema>
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>
export type CancelJournalInput = z.infer<typeof cancelJournalSchema>
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>
export type ListJournalsQuery = z.infer<typeof listJournalsQuerySchema>
