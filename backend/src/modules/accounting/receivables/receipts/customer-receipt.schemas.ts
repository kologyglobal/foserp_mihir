import { z } from 'zod'
import { decimalAmountSchema } from '../shared/receivables.schemas.js'
import {
  customerReceiptPaymentMethodSchema,
  customerTdsInputSchema,
  isoDateSchema,
  nonNegativeDecimalStringSchema,
  proposedReceiptAllocationInputSchema,
  receiptBankChargeInputSchema,
  receiptOtherDeductionInputSchema,
} from './calculation/customer-receipt-calculation.schemas.js'

/** Foundation Zod only — ids, enums, positive decimal strings (Phase 3B1). */

export const customerReceiptIdSchema = z.string().uuid('receiptId must be a valid UUID')
export const customerReceiptAllocationIdSchema = z.string().uuid('allocationId must be a valid UUID')

export const customerReceiptStatusSchema = z.enum(['DRAFT', 'READY_TO_POST', 'POSTED', 'CANCELLED'])
export { customerReceiptPaymentMethodSchema }
export const customerReceiptSourceTypeSchema = z.enum(['DIRECT', 'BANK_IMPORT'])
export const customerReceiptAllocationStatusSchema = z.enum(['DRAFT', 'POSTED', 'REVERSED'])

export const positiveDecimalAmountSchema = decimalAmountSchema.refine(
  (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0
  },
  { message: 'Amount must be zero or positive' },
)

export const receivableOpenItemSideSchema = z.enum(['DEBIT', 'CREDIT'])

/* ─── Phase 3B3 — draft workflow request/response schemas ─────────────────── */

const customerReceiptDraftFieldsSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),

  sourceType: customerReceiptSourceTypeSchema.default('DIRECT'),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  sourceDocumentNumber: z.string().max(64).nullable().optional(),

  receiptDate: z.string(),
  postingDate: z.string(),
  valueDate: z.string().nullable().optional(),

  paymentMethod: customerReceiptPaymentMethodSchema,

  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: nonNegativeDecimalStringSchema.nullable().optional(),

  bankCashAmount: nonNegativeDecimalStringSchema,
  bankCashAccountId: z.string().uuid(),
  customerReceivableAccountId: z.string().uuid().nullable().optional(),

  customerTds: customerTdsInputSchema.nullable().optional(),
  bankCharges: z.array(receiptBankChargeInputSchema).nullable().optional(),
  otherDeductions: z.array(receiptOtherDeductionInputSchema).nullable().optional(),

  instrumentNumber: z.string().max(64).nullable().optional(),
  instrumentDate: z.string().nullable().optional(),
  bankReference: z.string().max(100).nullable().optional(),
  transactionReference: z.string().max(100).nullable().optional(),
  narration: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type CustomerReceiptDraftFields = z.infer<typeof customerReceiptDraftFieldsSchema>

export interface NormalizedCustomerReceiptBody {
  legalEntityId?: string
  branchId?: string | null
  customerId: string
  sourceType: 'DIRECT' | 'BANK_IMPORT'
  sourceDocumentId?: string | null
  sourceDocumentNumber?: string | null
  receiptDate: string
  postingDate: string
  valueDate?: string | null
  paymentMethod: z.infer<typeof customerReceiptPaymentMethodSchema>
  currencyCode: string
  exchangeRate: string
  bankCashAmount: string
  bankCashAccountId: string
  customerReceivableAccountId?: string | null
  customerTds?: z.infer<typeof customerTdsInputSchema> | null
  bankCharges?: z.infer<typeof receiptBankChargeInputSchema>[] | null
  otherDeductions?: z.infer<typeof receiptOtherDeductionInputSchema>[] | null
  instrumentNumber?: string | null
  instrumentDate?: string | null
  bankReference?: string | null
  transactionReference?: string | null
  narration?: string | null
  notes?: string | null
}

function normalizeDraftBody(
  body: CustomerReceiptDraftFields | Omit<CustomerReceiptDraftFields, 'legalEntityId'>,
): NormalizedCustomerReceiptBody {
  return {
    ...body,
    exchangeRate: body.exchangeRate ?? '1',
  }
}

export type CreateCustomerReceiptInput = NormalizedCustomerReceiptBody & { legalEntityId: string }

export const createCustomerReceiptSchema = customerReceiptDraftFieldsSchema.transform(
  (body) => normalizeDraftBody(body) as CreateCustomerReceiptInput,
)

export type UpdateCustomerReceiptInput = NormalizedCustomerReceiptBody & { updatedAt: string }

const updateFieldsSchema = customerReceiptDraftFieldsSchema.omit({ legalEntityId: true }).extend({
  updatedAt: z.string().datetime({ offset: true }),
})

export const updateCustomerReceiptSchema = updateFieldsSchema.transform(
  (body): UpdateCustomerReceiptInput => ({
    ...normalizeDraftBody(body),
    updatedAt: body.updatedAt,
  }),
)

export const cancelCustomerReceiptSchema = z.object({
  cancellationReason: z.string().min(1).max(500),
})

export type CancelCustomerReceiptInput = z.infer<typeof cancelCustomerReceiptSchema>

export const reverseCustomerReceiptSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export type ReverseCustomerReceiptInput = z.infer<typeof reverseCustomerReceiptSchema>

export const validateCustomerReceiptSchema = z
  .object({
    proposedAllocations: z.array(proposedReceiptAllocationInputSchema).optional(),
  })
  .default({})

export type ValidateCustomerReceiptInput = z.infer<typeof validateCustomerReceiptSchema>

export const listCustomerReceiptsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: customerReceiptStatusSchema.optional(),
  paymentMethod: customerReceiptPaymentMethodSchema.optional(),
  sourceType: customerReceiptSourceTypeSchema.optional(),
  currencyCode: z.string().max(8).optional(),
  createdBy: z.string().uuid().optional(),
  receiptDateFrom: z.string().optional(),
  receiptDateTo: z.string().optional(),
  postingDateFrom: z.string().optional(),
  postingDateTo: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['receiptDate', 'postingDate', 'createdAt', 'updatedAt', 'grossReceiptAmount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type ListCustomerReceiptsQueryInput = z.infer<typeof listCustomerReceiptsQuerySchema>

export const customerReceiptIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const customerReceiptDraftInputSchema = customerReceiptDraftFieldsSchema
export type CustomerReceiptDraftInput = z.infer<typeof customerReceiptDraftInputSchema>

export { isoDateSchema }
