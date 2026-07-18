import { z } from 'zod'
import { customerReceiptPaymentMethodSchema } from '../customer-receipt.schemas.js'

/** Reject exponent notation and blank strings; allow optional leading minus for later reject. */
const strictDecimalString = z
  .string()
  .regex(/^-?\d+(\.\d{1,8})?$/, 'Must be a valid decimal string without exponent notation')

export const nonNegativeDecimalStringSchema = strictDecimalString.refine(
  (v) => {
    try {
      return !v.startsWith('-') || /^-0+(\.0+)?$/.test(v)
    } catch {
      return false
    }
  },
  { message: 'Amount must be zero or positive' },
)

export const positiveDecimalStringSchema = strictDecimalString.refine(
  (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0
  },
  { message: 'Amount must be greater than zero' },
)

export const percentageStringSchema = nonNegativeDecimalStringSchema

export const currencyCodeSchema = z
  .string()
  .min(3)
  .max(8)
  .regex(/^[A-Z]{3,8}$/, 'Currency code must be uppercase letters')

export const exchangeRateSchema = positiveDecimalStringSchema

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const customerTdsInputSchema = z.object({
  mode: z.enum(['NONE', 'AMOUNT', 'PERCENTAGE']),
  value: nonNegativeDecimalStringSchema.nullable().optional(),
  calculationBase: nonNegativeDecimalStringSchema.nullable().optional(),
  sectionCode: z.string().max(32).nullable().optional(),
  certificateReference: z.string().max(64).nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
})

export const receiptBankChargeInputSchema = z.object({
  description: z.string().min(1).max(200),
  amount: nonNegativeDecimalStringSchema,
  accountId: z.string().uuid().nullable().optional(),
})

export const receiptOtherDeductionInputSchema = z.object({
  code: z.string().min(1).max(32),
  description: z.string().min(1).max(200),
  amount: nonNegativeDecimalStringSchema,
  accountId: z.string().uuid().nullable().optional(),
})

export const proposedReceiptAllocationInputSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceOpenItemId: z.string().uuid(),
  allocationAmount: nonNegativeDecimalStringSchema,
})

export const customerReceiptCalculationInputSchema = z.object({
  tenantId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),
  receiptDate: isoDateSchema,
  postingDate: isoDateSchema,
  valueDate: isoDateSchema.nullable().optional(),
  paymentMethod: customerReceiptPaymentMethodSchema,
  currencyCode: currencyCodeSchema.default('INR'),
  exchangeRate: nonNegativeDecimalStringSchema.nullable().optional(),
  bankCashAmount: nonNegativeDecimalStringSchema,
  customerTds: customerTdsInputSchema.nullable().optional(),
  bankCharges: z.array(receiptBankChargeInputSchema).nullable().optional(),
  otherDeductions: z.array(receiptOtherDeductionInputSchema).nullable().optional(),
  bankCashAccountId: z.string().uuid().nullable().optional(),
  customerReceivableAccountId: z.string().uuid().nullable().optional(),
  instrumentNumber: z.string().max(64).nullable().optional(),
  instrumentDate: isoDateSchema.nullable().optional(),
  bankReference: z.string().max(100).nullable().optional(),
  transactionReference: z.string().max(100).nullable().optional(),
  narration: z.string().max(2000).nullable().optional(),
  proposedAllocations: z.array(proposedReceiptAllocationInputSchema).nullable().optional(),
})

export type CustomerReceiptCalculationInputParsed = z.infer<typeof customerReceiptCalculationInputSchema>
