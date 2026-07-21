import { z } from 'zod'

const decimalAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Amount must be a non-negative decimal with up to 4 places')

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const creditNoteAllocationLineSchema = z.object({
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

export const allocateCustomerCreditNoteBodySchema = z.object({
  allocationDate: dateOnlySchema,
  allocations: z.array(creditNoteAllocationLineSchema).min(1).max(200),
})

export const allocateCustomerCreditNotePreviewBodySchema = allocateCustomerCreditNoteBodySchema

export const listCreditNoteAllocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const creditNoteIdParamSchema = z.object({
  creditNoteId: z.string().uuid(),
})

export const creditNoteAllocationBatchParamSchema = z.object({
  creditNoteId: z.string().uuid(),
  batchId: z.string().uuid(),
})

export const reverseCreditNoteAllocationBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export type AllocateCustomerCreditNoteBodyInput = z.infer<typeof allocateCustomerCreditNoteBodySchema>
export type ListCreditNoteAllocationsQueryInput = z.infer<typeof listCreditNoteAllocationsQuerySchema>
export type ReverseCreditNoteAllocationBodyInput = z.infer<typeof reverseCreditNoteAllocationBodySchema>
