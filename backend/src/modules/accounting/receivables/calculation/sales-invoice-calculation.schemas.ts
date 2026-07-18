import { z } from 'zod'
import {
  salesInvoiceSupplyTypeSchema,
  salesInvoiceTaxTreatmentSchema,
  decimalAmountSchema,
  decimalQuantitySchema,
} from '../shared/receivables.schemas.js'

export const SUPPORTED_GST_RATES = [
  '0',
  '0.1',
  '0.25',
  '1.5',
  '3',
  '5',
  '6',
  '7.5',
  '12',
  '18',
  '28',
] as const

export const lineDiscountTypeSchema = z.enum(['PERCENTAGE', 'AMOUNT'])
export const invoiceDiscountTypeSchema = z.enum(['PERCENTAGE', 'AMOUNT'])
export const taxPricingModeSchema = z.enum(['EXCLUSIVE', 'INCLUSIVE'])
export const roundingModeSchema = z.enum(['NONE', 'NEAREST_UNIT', 'NEAREST_0_05', 'MANUAL'])
export const freightModeSchema = z.enum(['NON_TAXABLE', 'TAXABLE'])

export const otherChargeInputSchema = z.object({
  code: z.string().min(1).max(32),
  description: z.string().min(1).max(200),
  amount: decimalAmountSchema,
  taxRate: decimalAmountSchema.nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  includeInTaxableValue: z.boolean(),
})

export const salesInvoiceLineCalculationInputSchema = z.object({
  lineNumber: z.number().int().min(1),
  quantity: decimalQuantitySchema,
  unitPrice: decimalAmountSchema,
  lineDiscountType: lineDiscountTypeSchema.optional(),
  lineDiscountValue: decimalAmountSchema.optional(),
  gstRate: decimalAmountSchema.optional(),
  cessRate: decimalAmountSchema.optional(),
  hsnCode: z.string().max(16).nullable().optional(),
  isTaxInclusive: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  itemCodeSnapshot: z.string().max(64).nullable().optional(),
  itemNameSnapshot: z.string().max(300).nullable().optional(),
  uomSnapshot: z.string().max(32).nullable().optional(),
  revenueAccountId: z.string().uuid().nullable().optional(),
  costCentreId: z.string().uuid().nullable().optional(),
})

export const salesInvoiceCalculationInputSchema = z.object({
  legalEntityId: z.string().uuid(),
  legalEntityStateCode: z.string().max(8).nullable().optional(),
  customerId: z.string().uuid().optional(),
  placeOfSupply: z.string().max(8).nullable().optional(),
  supplyType: salesInvoiceSupplyTypeSchema.optional(),
  taxTreatment: salesInvoiceTaxTreatmentSchema,
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: decimalAmountSchema.default('1'),
  taxPricingMode: taxPricingModeSchema.default('EXCLUSIVE'),
  invoiceDiscountType: invoiceDiscountTypeSchema.optional(),
  invoiceDiscountValue: decimalAmountSchema.optional(),
  freightMode: freightModeSchema.default('NON_TAXABLE'),
  freightAmount: decimalAmountSchema.optional(),
  freightTaxRate: decimalAmountSchema.nullable().optional(),
  freightRevenueAccountId: z.string().uuid().nullable().optional(),
  otherChargesAmount: decimalAmountSchema.optional(),
  otherCharges: z.array(otherChargeInputSchema).optional(),
  roundingMode: roundingModeSchema.default('NONE'),
  manualRoundOff: decimalAmountSchema.optional(),
  roundingTolerance: decimalAmountSchema.optional(),
  invoiceDate: z.string().optional(),
  postingDate: z.string().optional(),
  lines: z.array(salesInvoiceLineCalculationInputSchema).min(1),
})

export type SalesInvoiceCalculationInputParsed = z.infer<typeof salesInvoiceCalculationInputSchema>
