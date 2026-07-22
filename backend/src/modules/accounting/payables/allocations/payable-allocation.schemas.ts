import { z } from 'zod'

const decimalAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Amount must be a non-negative decimal with up to 4 places')

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const isoDateTimeSchema = z.string().min(1, 'expected version timestamp is required')

export const payableAllocationLineSchema = z.object({
  targetCreditOpenItemId: z.string().uuid(),
  expectedTargetUpdatedAt: isoDateTimeSchema,
  amount: decimalAmountSchema,
})

export const createPayableAllocationBodySchema = z.object({
  expectedPaymentUpdatedAt: isoDateTimeSchema.optional(),
  expectedAdjustmentUpdatedAt: isoDateTimeSchema.optional(),
  expectedSourceOpenItemUpdatedAt: isoDateTimeSchema,
  allocationDate: dateOnlySchema,
  idempotencyKey: z.string().trim().min(1).max(128),
  lines: z.array(payableAllocationLineSchema).min(1).max(200),
})

export const listPayableAllocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const allocatableInvoicesQuerySchema = z.object({
  targetAmount: decimalAmountSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export const vendorPaymentIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const vendorInvoiceIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const allocationIdParamSchema = z.object({
  allocationId: z.string().uuid(),
})

export const reversePayableAllocationBodySchema = z.object({
  reversalDate: dateOnlySchema,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().trim().min(1).max(128),
  lineIds: z.array(z.string().uuid()).min(1).max(200).optional(),
  expectedAllocationUpdatedAt: isoDateTimeSchema,
  expectedLines: z
    .array(
      z.object({
        allocationLineId: z.string().uuid(),
        expectedUpdatedAt: isoDateTimeSchema,
      }),
    )
    .optional(),
  expectedOpenItems: z
    .array(
      z.object({
        openItemId: z.string().uuid(),
        expectedUpdatedAt: isoDateTimeSchema,
      }),
    )
    .optional(),
})

export type CreatePayableAllocationBodyInput = z.infer<typeof createPayableAllocationBodySchema>
export type PayableAllocationLineInput = z.infer<typeof payableAllocationLineSchema>
export type ListPayableAllocationsQueryInput = z.infer<typeof listPayableAllocationsQuerySchema>
export type AllocatableInvoicesQueryInput = z.infer<typeof allocatableInvoicesQuerySchema>
export type ReversePayableAllocationBodyInput = z.infer<typeof reversePayableAllocationBodySchema>
