import { z } from 'zod'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const dateOnlySchema = z
  .string()
  .regex(DATE_RE, 'Must be YYYY-MM-DD')
  .refine((value) => {
    const [y, mo, d] = value.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  }, 'Invalid calendar date')

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}

const decimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a decimal amount')

export const createReconciliationRunBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  asOfDate: dateOnlySchema.optional(),
  includeVendorLevel: z.boolean().default(true),
  toleranceOverride: decimalStringSchema.optional(),
})

export const listReconciliationRunsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  ...paginationFields,
})

export const reconciliationRunIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const reconciliationExceptionIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const listReconciliationAccountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export const listReconciliationExceptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'BLOCKER']).optional(),
  category: z
    .enum([
      'CONTROL_ACCOUNT_CONFIGURATION',
      'SUBLEDGER_BALANCE',
      'GENERAL_LEDGER_BALANCE',
      'SOURCE_DOCUMENT',
      'ACCOUNTING_VOUCHER',
      'GENERAL_LEDGER_ENTRY',
      'OPEN_ITEM',
      'ALLOCATION',
      'ALLOCATION_REVERSAL',
      'DOCUMENT_REVERSAL',
      'POSTING_EVENT',
      'VENDOR_PARTY',
      'CURRENCY',
      'BRANCH',
      'PERIOD_READINESS',
      'WORKFLOW',
      'DATA_INTEGRITY',
    ])
    .optional(),
  isAcknowledged: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
})

export const acknowledgeExceptionBodySchema = z.object({
  note: z.string().trim().max(500).optional(),
})

export type CreateReconciliationRunBodyInput = z.infer<typeof createReconciliationRunBodySchema>
export type ListReconciliationRunsQueryInput = z.infer<typeof listReconciliationRunsQuerySchema>
export type ListReconciliationAccountsQueryInput = z.infer<typeof listReconciliationAccountsQuerySchema>
export type ListReconciliationExceptionsQueryInput = z.infer<typeof listReconciliationExceptionsQuerySchema>
export type AcknowledgeExceptionBodyInput = z.infer<typeof acknowledgeExceptionBodySchema>

// ─── Close gate ───────────────────────────────────────────────────────────────

export const createCloseGateRunBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  periodId: z.string().uuid(),
  runFreshReconciliation: z.boolean().default(true),
  reconciliationRunId: z.string().uuid().optional(),
  includeVendorLevel: z.boolean().default(true),
})

export const listCloseGateRunsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  ...paginationFields,
})

export const closeGateRunIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const latestCloseGateQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  periodId: z.string().uuid(),
})

export type CreateCloseGateRunBodyInput = z.infer<typeof createCloseGateRunBodySchema>
export type ListCloseGateRunsQueryInput = z.infer<typeof listCloseGateRunsQuerySchema>
export type LatestCloseGateQueryInput = z.infer<typeof latestCloseGateQuerySchema>
