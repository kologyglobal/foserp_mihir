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

export const listGstDocumentQuerySchema = z
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

export type ListGstDocumentQueryInput = z.infer<typeof listGstDocumentQuerySchema>

export const generateEInvoiceSchema = z.object({
  salesInvoiceId: z.string().uuid(),
})

export type GenerateEInvoiceInput = z.infer<typeof generateEInvoiceSchema>

export const generateEWayBillSchema = z
  .object({
    sourceType: z.enum(['SALES_INVOICE', 'DELIVERY_CHALLAN']),
    salesInvoiceId: z.string().uuid().optional(),
    deliveryChallanId: z.string().uuid().optional(),
    fromPlace: z.string().trim().min(1).max(200),
    toPlace: z.string().trim().min(1).max(200),
    distanceKm: z.coerce.number().int().min(0).max(20000),
    vehicleNumber: z.string().trim().max(64).optional().nullable(),
    transporterName: z.string().trim().max(200).optional().nullable(),
    /** Bypass ₹50k threshold (SI only) — still uses simulated NIC. */
    force: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === 'SALES_INVOICE' && !data.salesInvoiceId) {
      ctx.addIssue({ code: 'custom', message: 'salesInvoiceId is required', path: ['salesInvoiceId'] })
    }
    if (data.sourceType === 'DELIVERY_CHALLAN' && !data.deliveryChallanId) {
      ctx.addIssue({
        code: 'custom',
        message: 'deliveryChallanId is required',
        path: ['deliveryChallanId'],
      })
    }
  })

export type GenerateEWayBillInput = z.infer<typeof generateEWayBillSchema>

export const cancelGstDocumentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type CancelGstDocumentInput = z.infer<typeof cancelGstDocumentSchema>
