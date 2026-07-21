import { z } from 'zod'

const decimalAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Amount must be a non-negative decimal with up to 4 places')

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const allocationLineSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceOpenItemId: z.string().uuid(),
  /** Spec field `amount`; `allocationAmount` accepted as alias. */
  amount: decimalAmountSchema.optional(),
  allocationAmount: decimalAmountSchema.optional(),
}).transform((row, ctx) => {
  const allocationAmount = row.allocationAmount ?? row.amount
  if (!allocationAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount is required', path: ['amount'] })
    return z.NEVER
  }
  return {
    invoiceId: row.invoiceId,
    invoiceOpenItemId: row.invoiceOpenItemId,
    allocationAmount,
  }
})

export const allocateCustomerReceiptBodySchema = z.object({
  allocationDate: dateOnlySchema,
  allocations: z.array(allocationLineSchema).min(1).max(200),
})

export const allocateCustomerReceiptPreviewBodySchema = allocateCustomerReceiptBodySchema

export const listReceiptAllocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const listCustomerCreditsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  currencyCode: z.string().min(3).max(8).optional(),
  status: z.string().optional(),
  receiptDateFrom: dateOnlySchema.optional(),
  receiptDateTo: dateOnlySchema.optional(),
  search: z.string().trim().optional(),
  includeSettled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const receiptIdParamSchema = z.object({
  receiptId: z.string().uuid(),
})

export const receiptAllocationBatchParamSchema = z.object({
  receiptId: z.string().uuid(),
  batchId: z.string().uuid(),
})

export const reverseAllocationBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const invoiceIdParamSchema = z.object({
  invoiceId: z.string().uuid(),
})

export type AllocateCustomerReceiptBodyInput = z.infer<typeof allocateCustomerReceiptBodySchema>
export type ListReceiptAllocationsQueryInput = z.infer<typeof listReceiptAllocationsQuerySchema>
export type ListCustomerCreditsQueryInput = z.infer<typeof listCustomerCreditsQuerySchema>
export type ReverseAllocationBodyInput = z.infer<typeof reverseAllocationBodySchema>
