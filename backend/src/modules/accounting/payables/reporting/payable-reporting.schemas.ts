import { z } from 'zod'
import { PayableInvalidAmountRangeError } from './payable-reporting.errors.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const dateOnlySchema = z
  .string()
  .regex(DATE_RE, 'Must be YYYY-MM-DD')
  .refine((value) => {
    const [y, mo, d] = value.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  }, 'Invalid calendar date')

export const ageingBasisSchema = z.enum(['due_date', 'document_age'])

export const dueDateBucketSchema = z.enum([
  'CURRENT',
  'OVERDUE_1_30',
  'OVERDUE_31_60',
  'OVERDUE_61_90',
  'OVERDUE_91_120',
  'OVERDUE_ABOVE_120',
  'NO_DUE_DATE',
])

export const documentAgeBucketSchema = z.enum(['AGE_0_30', 'AGE_31_60', 'AGE_61_90', 'AGE_91_120', 'AGE_ABOVE_120'])

export const ageingBucketSchema = z.union([dueDateBucketSchema, documentAgeBucketSchema])

export const payableOpenItemStatusSchema = z.enum([
  'OPEN',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'DISPUTED',
  'ON_HOLD',
  'REVERSED',
  'CANCELLED',
])

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
    vendorId: z.string().uuid().optional(),
    status: payableOpenItemStatusSchema.optional(),
    vendorPayableAccountId: z.string().uuid().optional(),
    currencyCode: z.string().max(8).optional(),
    amountFrom: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    amountTo: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    dueDateFrom: dateOnlySchema.optional(),
    dueDateTo: dateOnlySchema.optional(),
    ageingBucket: ageingBucketSchema.optional(),
    ageingBasis: ageingBasisSchema.default('due_date'),
    search: z.string().trim().max(100).optional(),
    sortBy: z
      .enum(['dueDate', 'postingDate', 'documentDate', 'outstandingAmount', 'vendorName', 'documentNumber'])
      .default('dueDate'),
  })
  .superRefine(assertAmountRange)

export const vendorSummaryQuerySchema = z.object({
  ...sharedReportFields,
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['vendorName', 'outstandingAmount', 'openItemCount', 'oldestDueDate']).default('outstandingAmount'),
})

export const ageingQuerySchema = z.object({
  ...sharedReportFields,
  ageingBasis: ageingBasisSchema.default('due_date'),
  vendorId: z.string().uuid().optional(),
  vendorPayableAccountId: z.string().uuid().optional(),
})

export const overviewQuerySchema = z.object({
  ...sharedReportFields,
})

export const paymentPlanningQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  asOfDate: dateOnlySchema.optional(),
  horizonDays: z.coerce.number().int().refine((v) => v === 7 || v === 14 || v === 30, 'Must be 7, 14, or 30').default(7),
  vendorId: z.string().uuid().optional(),
  includeSettled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
})

export const vendorIdParamSchema = z.object({
  vendorId: z.string().uuid(),
})

export type ListOutstandingQueryInput = z.infer<typeof listOutstandingQuerySchema>
export type VendorSummaryQueryInput = z.infer<typeof vendorSummaryQuerySchema>
export type AgeingQueryInput = z.infer<typeof ageingQuerySchema>
export type OverviewQueryInput = z.infer<typeof overviewQuerySchema>
export type PaymentPlanningQueryInput = z.infer<typeof paymentPlanningQuerySchema>

export function parseAmountRangeOrThrow(amountFrom?: string, amountTo?: string): void {
  if (amountFrom && amountTo && Number(amountFrom) > Number(amountTo)) {
    throw new PayableInvalidAmountRangeError()
  }
}
