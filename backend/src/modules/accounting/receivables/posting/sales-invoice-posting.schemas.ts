import { z } from 'zod'

/** POST body is empty or optional acknowledgement — no client-supplied posting fields. */
export const postSalesInvoiceSchema = z.object({}).strict().optional().default({})

export type PostSalesInvoiceBody = z.infer<typeof postSalesInvoiceSchema>
