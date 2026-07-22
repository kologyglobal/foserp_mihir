import { z } from 'zod'

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
const positiveDecimal = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a non-negative decimal string')

export const vendorPaymentAdjustmentInputSchema = z.object({
  id: z.string().nullable().optional(),
  lineNumber: z.number().int().min(1),
  adjustmentType: z.enum([
    'TDS',
    'DISCOUNT',
    'RETENTION',
    'WITHHOLDING',
    'BANK_CHARGE',
    'PROCESSING_CHARGE',
    'ROUND_OFF',
    'OTHER',
  ]),
  accountingRole: z.enum([
    'SETTLEMENT_CREDIT',
    'PAYMENT_EXPENSE_DEBIT',
    'ROUND_OFF_DEBIT',
    'ROUND_OFF_CREDIT',
    'INFORMATION_ONLY',
  ]),
  description: z.string().min(1).max(500),
  amount: decimalString.nullable().optional(),
  rate: decimalString.nullable().optional(),
  calculationBaseAmount: decimalString.nullable().optional(),
  sectionCode: z.string().max(32).nullable().optional(),
  statutoryReference: z.string().max(64).nullable().optional(),
  accountId: z.string().nullable().optional(),
  costCentreId: z.string().nullable().optional(),
  projectReference: z.string().max(64).nullable().optional(),
  departmentReference: z.string().max(64).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const vendorPaymentCalculationInputSchema = z.object({
  tenantId: z.string().optional(),
  legalEntityId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  vendorPaymentId: z.string().nullable().optional(),
  vendorId: z.string().min(1),
  financialYearId: z.string().nullable().optional(),
  paymentPurpose: z.enum(['INVOICE_SETTLEMENT', 'ADVANCE', 'MIXED']),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER']),
  documentDate: z.string().min(1),
  paymentDate: z.string().min(1),
  proposedPostingDate: z.string().nullable().optional(),
  valueDate: z.string().nullable().optional(),
  currencyCode: z.string().min(3).max(8),
  exchangeRate: positiveDecimal,
  paymentAmount: positiveDecimal,
  paymentAccountId: z.string().nullable().optional(),
  vendorPayableAccountId: z.string().nullable().optional(),
  paymentReference: z.string().max(100).nullable().optional(),
  bankReference: z.string().max(100).nullable().optional(),
  chequeNumber: z.string().max(64).nullable().optional(),
  chequeDate: z.string().nullable().optional(),
  instrumentReference: z.string().max(100).nullable().optional(),
  narration: z.string().nullable().optional(),
  adjustments: z.array(vendorPaymentAdjustmentInputSchema).default([]),
  configuration: z.record(z.string(), z.unknown()).optional(),
})

export type VendorPaymentCalculationInputParsed = z.infer<typeof vendorPaymentCalculationInputSchema>
