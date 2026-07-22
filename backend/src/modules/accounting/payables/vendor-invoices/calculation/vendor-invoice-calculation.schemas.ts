import { z } from 'zod'

/** Kept in sync with prisma enum VendorInvoiceTaxTreatment. */
export const vendorInvoiceTaxTreatmentSchema = z.enum([
  'REGULAR',
  'REVERSE_CHARGE',
  'IMPORT_GOODS',
  'IMPORT_SERVICE',
  'SEZ',
  'NON_GST',
  'EXEMPT',
  'NIL_RATED',
])

/** Kept in sync with prisma enum InputTaxCreditEligibility. */
export const inputTaxCreditEligibilitySchema = z.enum([
  'PENDING_REVIEW',
  'ELIGIBLE',
  'PARTIALLY_ELIGIBLE',
  'INELIGIBLE',
])

/** Kept in sync with prisma enum TdsRecognitionMode. */
export const tdsRecognitionModeSchema = z.enum(['NOT_APPLICABLE', 'AT_INVOICE', 'AT_PAYMENT'])

/** Kept in sync with prisma enum VendorInvoiceLineType. */
export const vendorInvoiceLineTypeSchema = z.enum(['ITEM', 'SERVICE', 'EXPENSE', 'ASSET', 'FREIGHT', 'OTHER_CHARGE'])

/** Kept in sync with prisma enum VendorInvoiceSourceLinkType. */
export const vendorInvoiceSourceLinkTypeSchema = z.enum([
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'PURCHASE_RECEIPT',
  'CONTRACT',
  'PROJECT',
  'OTHER',
])

export const vendorInvoiceLineDiscountTypeSchema = z.enum(['PERCENTAGE', 'AMOUNT'])
export const vendorInvoiceHeaderDiscountTypeSchema = z.enum(['PERCENTAGE', 'AMOUNT'])
export const vendorInvoiceRoundingModeSchema = z.enum(['NONE', 'NEAREST_UNIT', 'NEAREST_0_05', 'MANUAL'])
export const vendorInvoicePurchaseSupplyTypeSchema = z.enum(['INTRA_STATE', 'INTER_STATE'])

export const decimalAmountSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
export const decimalQuantitySchema = decimalAmountSchema

const idSchema = z.string().min(1).max(64)

export const vendorInvoiceAccountRefSchema = z.object({
  id: idSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(300),
})

export const vendorInvoiceCalculationAccountsOverrideSchema = z.object({
  vendorPayable: vendorInvoiceAccountRefSchema.nullable().optional(),
  purchaseOrDebit: vendorInvoiceAccountRefSchema.nullable().optional(),
  inputCgst: vendorInvoiceAccountRefSchema.nullable().optional(),
  inputSgst: vendorInvoiceAccountRefSchema.nullable().optional(),
  inputIgst: vendorInvoiceAccountRefSchema.nullable().optional(),
  inputCess: vendorInvoiceAccountRefSchema.nullable().optional(),
  tdsPayable: vendorInvoiceAccountRefSchema.nullable().optional(),
  freight: vendorInvoiceAccountRefSchema.nullable().optional(),
  otherCharge: vendorInvoiceAccountRefSchema.nullable().optional(),
  roundOff: vendorInvoiceAccountRefSchema.nullable().optional(),
  rcmCgstPayable: vendorInvoiceAccountRefSchema.nullable().optional(),
  rcmSgstPayable: vendorInvoiceAccountRefSchema.nullable().optional(),
  rcmIgstPayable: vendorInvoiceAccountRefSchema.nullable().optional(),
})

export const vendorInvoiceCalculationConfigurationSchema = z.object({
  roundingMode: vendorInvoiceRoundingModeSchema.optional(),
  manualRoundOff: decimalAmountSchema.optional(),
  roundingTolerance: decimalAmountSchema.optional(),
  baseCurrencyCode: z.string().min(3).max(8).optional(),
  accounts: vendorInvoiceCalculationAccountsOverrideSchema.optional(),
})

export const vendorInvoiceCalculationLineInputSchema = z.object({
  lineNumber: z.number().int().min(1),
  lineType: vendorInvoiceLineTypeSchema,
  description: z.string().min(1).max(500),
  itemId: idSchema.nullable().optional(),
  itemCodeSnapshot: z.string().max(64).nullable().optional(),
  itemNameSnapshot: z.string().max(300).nullable().optional(),
  hsnSacCode: z.string().max(16).nullable().optional(),
  quantity: decimalQuantitySchema,
  uomId: idSchema.nullable().optional(),
  uomCodeSnapshot: z.string().max(32).nullable().optional(),
  unitPrice: decimalAmountSchema,
  lineDiscountType: vendorInvoiceLineDiscountTypeSchema.optional(),
  lineDiscountValue: decimalAmountSchema.optional(),
  gstRate: decimalAmountSchema.optional(),
  cgstRate: decimalAmountSchema.optional(),
  sgstRate: decimalAmountSchema.optional(),
  igstRate: decimalAmountSchema.optional(),
  cessRate: decimalAmountSchema.optional(),
  isTaxInclusive: z.boolean().optional(),
  debitAccountId: idSchema.nullable().optional(),
  costCentreId: idSchema.nullable().optional(),
  projectReference: z.string().max(64).nullable().optional(),
  departmentReference: z.string().max(64).nullable().optional(),
  taxTreatment: vendorInvoiceTaxTreatmentSchema.nullable().optional(),
  itcEligibility: inputTaxCreditEligibilitySchema.nullable().optional(),
  itcEligiblePercent: decimalAmountSchema.nullable().optional(),
  sourceLinkType: vendorInvoiceSourceLinkTypeSchema.nullable().optional(),
  sourceDocumentId: idSchema.nullable().optional(),
  sourceDocumentNumber: z.string().max(64).nullable().optional(),
  sourceDocumentLineId: idSchema.nullable().optional(),
})

export const vendorInvoiceCalculationInputSchema = z.object({
  legalEntityId: idSchema,
  companyStateCode: z.string().max(8).nullable().optional(),
  vendorId: idSchema.optional(),
  vendorStateCode: z.string().max(8).nullable().optional(),
  placeOfSupply: z.string().max(8).nullable().optional(),
  supplyType: vendorInvoicePurchaseSupplyTypeSchema.optional(),
  taxTreatment: vendorInvoiceTaxTreatmentSchema,
  itcEligibility: inputTaxCreditEligibilitySchema.optional(),
  itcEligiblePercent: decimalAmountSchema.optional(),
  tdsRecognitionMode: tdsRecognitionModeSchema.optional(),
  tdsSectionCode: z.string().max(32).nullable().optional(),
  tdsRate: decimalAmountSchema.optional(),
  tdsBaseOverride: decimalAmountSchema.optional(),
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: decimalAmountSchema.default('1'),
  invoiceDiscountType: vendorInvoiceHeaderDiscountTypeSchema.optional(),
  invoiceDiscountValue: decimalAmountSchema.optional(),
  freightAmount: decimalAmountSchema.optional(),
  freightGstRate: decimalAmountSchema.nullable().optional(),
  otherChargeAmount: decimalAmountSchema.optional(),
  otherChargeGstRate: decimalAmountSchema.nullable().optional(),
  supplierInvoiceNumber: z.string().max(128).optional(),
  invoiceDate: z.string().optional(),
  postingDate: z.string().optional(),
  configuration: vendorInvoiceCalculationConfigurationSchema.optional(),
  lines: z.array(vendorInvoiceCalculationLineInputSchema).min(1),
})

export type VendorInvoiceCalculationInputParsed = z.infer<typeof vendorInvoiceCalculationInputSchema>
