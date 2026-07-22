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
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
}

export const gstExtractQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
    search: z.string().trim().max(100).optional(),
    ...paginationFields,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type GstExtractQueryInput = z.infer<typeof gstExtractQuerySchema>

export const gstSummaryQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type GstSummaryQueryInput = z.infer<typeof gstSummaryQuerySchema>
