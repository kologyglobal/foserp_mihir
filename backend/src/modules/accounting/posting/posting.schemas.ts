import { z } from 'zod'

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal string')

export const postingRequestLineSchema = z
  .object({
    lineNumber: z.coerce.number().int().min(1),
    accountId: z.string().uuid().optional(),
    accountMappingKey: z.string().trim().min(1).max(64).optional(),
    partyType: z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE', 'OTHER']).nullable().optional(),
    partyId: z.string().uuid().nullable().optional(),
    partyNameSnapshot: z.string().trim().max(300).nullable().optional(),
    debitAmount: decimalString,
    creditAmount: decimalString,
    baseDebitAmount: decimalString.optional(),
    baseCreditAmount: decimalString.optional(),
    currencyCode: z.string().trim().min(1).max(8).optional(),
    exchangeRate: decimalString.optional(),
    costCentreId: z.string().uuid().nullable().optional(),
    projectReference: z.string().trim().max(64).nullable().optional(),
    departmentReference: z.string().trim().max(64).nullable().optional(),
    referenceDocumentType: z.string().trim().max(64).nullable().optional(),
    referenceDocumentId: z.string().uuid().nullable().optional(),
    referenceDocumentLineId: z.string().uuid().nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    lineNarration: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((line, ctx) => {
    const hasAccount = Boolean(line.accountId)
    const hasMapping = Boolean(line.accountMappingKey)
    if (hasAccount === hasMapping) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one of accountId or accountMappingKey is required',
        path: ['accountId'],
      })
    }
  })

export const postingRequestSchema = z.object({
  legalEntityId: z.string().uuid(),
  eventKey: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(100),
  eventVersion: z.coerce.number().int().min(1).default(1),
  postingPurpose: z.enum(['SYSTEM_DOCUMENT', 'MANUAL_JOURNAL', 'OPENING_BALANCE', 'REVERSAL']),
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
  branchId: z.string().uuid().nullable().optional(),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  externalReference: z.string().trim().max(100).nullable().optional(),
  narration: z.string().trim().max(5000).nullable().optional(),
  currencyCode: z.string().trim().min(1).max(8).optional(),
  exchangeRate: decimalString.optional(),
  sourceModule: z.string().trim().max(64).nullable().optional(),
  sourceDocumentType: z.string().trim().max(64).nullable().optional(),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  sourceDocumentLineId: z.string().uuid().nullable().optional(),
  lines: z.array(postingRequestLineSchema).min(2),
})

export type PostingRequestInput = z.infer<typeof postingRequestSchema>
