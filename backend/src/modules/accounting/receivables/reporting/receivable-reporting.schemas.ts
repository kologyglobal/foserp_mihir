import { z } from 'zod'
import { receivableOpenItemStatusSchema } from '../shared/receivables.schemas.js'
import { ReceivableInvalidAmountRangeError } from './receivable-reporting.errors.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const dateOnlySchema = z
  .string()
  .regex(DATE_RE, 'Must be YYYY-MM-DD')
  .refine((value) => {
    const [y, mo, d] = value.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  }, 'Invalid calendar date')

export const ageingBasisSchema = z.enum(['due_date', 'invoice_age'])

export const dueDateBucketSchema = z.enum([
  'CURRENT',
  'OVERDUE_1_30',
  'OVERDUE_31_60',
  'OVERDUE_61_90',
  'OVERDUE_91_120',
  'OVERDUE_ABOVE_120',
  'NO_DUE_DATE',
])

export const invoiceAgeBucketSchema = z.enum(['AGE_0_30', 'AGE_31_60', 'AGE_61_90', 'AGE_91_120', 'AGE_ABOVE_120'])

export const ageingBucketSchema = z.union([dueDateBucketSchema, invoiceAgeBucketSchema])

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}

const sharedReportFields = {
  legalEntityId: z.string().uuid(),
  reportDate: dateOnlySchema.optional(),
  includeSettled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
}

function assertAmountRange(data: { amountFrom?: string; amountTo?: string }, ctx: z.RefinementCtx) {
  if (data.amountFrom && data.amountTo) {
    const from = Number(data.amountFrom)
    const to = Number(data.amountTo)
    if (!Number.isNaN(from) && !Number.isNaN(to) && from > to) {
      ctx.addIssue({ code: 'custom', message: 'amountFrom must be <= amountTo', path: ['amountFrom'] })
    }
  }
}

export const listOutstandingQuerySchema = z
  .object({
    ...sharedReportFields,
    ...paginationFields,
    customerId: z.string().uuid().optional(),
    status: receivableOpenItemStatusSchema.optional(),
    receivableAccountId: z.string().uuid().optional(),
    currencyCode: z.string().max(8).optional(),
    amountFrom: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    amountTo: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    dueDateFrom: dateOnlySchema.optional(),
    dueDateTo: dateOnlySchema.optional(),
    ageingBucket: ageingBucketSchema.optional(),
    ageingBasis: ageingBasisSchema.default('due_date'),
    search: z.string().trim().max(100).optional(),
    sortBy: z
      .enum(['dueDate', 'postingDate', 'invoiceDate', 'outstandingAmount', 'customerName', 'invoiceNumber'])
      .default('dueDate'),
  })
  .superRefine(assertAmountRange)

export const customerSummaryQuerySchema = z.object({
  ...sharedReportFields,
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['customerName', 'outstandingAmount', 'openItemCount', 'oldestDueDate']).default('outstandingAmount'),
})

export const ageingQuerySchema = z.object({
  ...sharedReportFields,
  ageingBasis: ageingBasisSchema.default('due_date'),
  customerId: z.string().uuid().optional(),
  receivableAccountId: z.string().uuid().optional(),
})

export const overviewQuerySchema = z.object({
  ...sharedReportFields,
})

export const reconciliationQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  asOfDate: dateOnlySchema.optional(),
  includeSettled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
})

export const customerIdParamSchema = z.object({
  customerId: z.string().uuid(),
})

export type ListOutstandingQueryInput = z.infer<typeof listOutstandingQuerySchema>
export type CustomerSummaryQueryInput = z.infer<typeof customerSummaryQuerySchema>
export type AgeingQueryInput = z.infer<typeof ageingQuerySchema>
export type OverviewQueryInput = z.infer<typeof overviewQuerySchema>
export type ReconciliationQueryInput = z.infer<typeof reconciliationQuerySchema>

export function parseAmountRangeOrThrow(amountFrom?: string, amountTo?: string): void {
  if (amountFrom && amountTo && Number(amountFrom) > Number(amountTo)) {
    throw new ReceivableInvalidAmountRangeError()
  }
}
