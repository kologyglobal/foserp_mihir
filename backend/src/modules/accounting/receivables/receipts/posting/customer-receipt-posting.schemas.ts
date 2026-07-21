import { z } from 'zod'

/** POST body is empty or optional acknowledgement — no client-supplied posting fields. */
export const postCustomerReceiptSchema = z.object({}).strict().optional().default({})

export type PostCustomerReceiptBody = z.infer<typeof postCustomerReceiptSchema>
