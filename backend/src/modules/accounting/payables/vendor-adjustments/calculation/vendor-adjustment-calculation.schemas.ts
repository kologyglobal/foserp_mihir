import { z } from 'zod'

export const vendorAdjustmentTypeSchema = z.enum(['VENDOR_DEBIT_NOTE', 'VENDOR_CREDIT_ADJUSTMENT'])

export const vendorAdjustmentReasonSchema = z.enum([
  'PURCHASE_RETURN',
  'RATE_DIFFERENCE',
  'SHORT_SUPPLY',
  'QUALITY_CLAIM',
  'DAMAGE_CLAIM',
  'COMMERCIAL_DISCOUNT',
  'FREIGHT_RECOVERY',
  'TAX_CORRECTION',
  'TDS_CORRECTION',
  'ROUND_OFF',
  'OPENING_CORRECTION',
  'OTHER',
])

/** Kept in sync with prisma enum VendorAdjustmentTaxEffect. */
export const vendorAdjustmentTaxEffectSchema = z.enum([
  'NONE',
  'ADD_RECOVERABLE_INPUT_TAX',
  'REVERSE_RECOVERABLE_INPUT_TAX',
  'NON_RECOVERABLE_TAX',
  'MIXED',
])

/** Kept in sync with prisma enum VendorAdjustmentItcTreatment. */
export const vendorAdjustmentItcTreatmentSchema = z.enum([
  'NO_ITC_CHANGE',
  'FULL_ITC_ADDITION',
  'PARTIAL_ITC_ADDITION',
  'FULL_ITC_REVERSAL',
  'PARTIAL_ITC_REVERSAL',
  'NON_RECOVERABLE',
  'PENDING_REVIEW',
])

/** Kept in sync with prisma enum VendorAdjustmentTdsTreatment. */
export const vendorAdjustmentTdsTreatmentSchema = z.enum([
  'NO_TDS_CHANGE',
  'ADD_TDS_LIABILITY',
  'REVERSE_TDS_LIABILITY',
])

/** GST purchase tax treatment for line tax math (reuse invoice semantics). */
export const purchaseTaxTreatmentSchema = z.enum([
  'REGULAR',
  'REVERSE_CHARGE',
  'IMPORT_GOODS',
  'IMPORT_SERVICE',
  'SEZ',
  'NON_GST',
  'EXEMPT',
  'NIL_RATED',
])

export const vendorAdjustmentLineTypeSchema = z.enum([
  'ITEM',
  'SERVICE',
  'EXPENSE',
  'ASSET',
  'FREIGHT',
  'OTHER_CHARGE',
  'TAX_CORRECTION',
  'OTHER',
])

export const vendorAdjustmentSourceLinkTypeSchema = z.enum([
  'VENDOR_INVOICE',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'PURCHASE_RECEIPT',
  'CONTRACT',
  'PROJECT',
  'OTHER',
])

export const vendorAdjustmentLineDiscountTypeSchema = z.enum(['PERCENTAGE', 'AMOUNT'])
export const vendorAdjustmentHeaderDiscountTypeSchema = z.enum(['PERCENTAGE', 'AMOUNT'])
export const vendorAdjustmentRoundingModeSchema = z.enum(['NONE', 'NEAREST_UNIT', 'NEAREST_0_05', 'MANUAL'])
export const vendorAdjustmentPurchaseSupplyTypeSchema = z.enum(['INTRA_STATE', 'INTER_STATE'])

export const decimalAmountSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
export const decimalQuantitySchema = decimalAmountSchema

const idSchema = z.string().min(1).max(64)

export const vendorAdjustmentAccountRefSchema = z.object({
  id: idSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(300),
})

export const vendorAdjustmentCalculationAccountsOverrideSchema = z.object({
  vendorPayable: vendorAdjustmentAccountRefSchema.nullable().optional(),
  offset: vendorAdjustmentAccountRefSchema.nullable().optional(),
  inputCgst: vendorAdjustmentAccountRefSchema.nullable().optional(),
  inputSgst: vendorAdjustmentAccountRefSchema.nullable().optional(),
  inputIgst: vendorAdjustmentAccountRefSchema.nullable().optional(),
  inputCess: vendorAdjustmentAccountRefSchema.nullable().optional(),
  tdsPayable: vendorAdjustmentAccountRefSchema.nullable().optional(),
  freight: vendorAdjustmentAccountRefSchema.nullable().optional(),
  otherCharge: vendorAdjustmentAccountRefSchema.nullable().optional(),
  roundOff: vendorAdjustmentAccountRefSchema.nullable().optional(),
})

export const vendorAdjustmentCalculationConfigurationSchema = z.object({
  roundingMode: vendorAdjustmentRoundingModeSchema.optional(),
  manualRoundOff: decimalAmountSchema.optional(),
  roundingTolerance: decimalAmountSchema.optional(),
  baseCurrencyCode: z.string().min(3).max(8).optional(),
  accounts: vendorAdjustmentCalculationAccountsOverrideSchema.optional(),
})

export const vendorAdjustmentCalculationLineInputSchema = z.object({
  lineNumber: z.number().int().min(1),
  lineType: vendorAdjustmentLineTypeSchema,
  description: z.string().min(1).max(500),
  itemId: z.string().uuid().nullable().optional(),
  itemCodeSnapshot: z.string().max(64).nullable().optional(),
  itemNameSnapshot: z.string().max(300).nullable().optional(),
  hsnSacCode: z.string().max(16).nullable().optional(),
  quantity: decimalQuantitySchema.default('1'),
  uomId: z.string().uuid().nullable().optional(),
  uomCodeSnapshot: z.string().max(32).nullable().optional(),
  unitPrice: decimalAmountSchema,
  lineDiscountType: vendorAdjustmentLineDiscountTypeSchema.optional(),
  lineDiscountValue: decimalAmountSchema.optional(),
  gstRate: decimalAmountSchema.optional(),
  cgstRate: decimalAmountSchema.optional(),
  sgstRate: decimalAmountSchema.optional(),
  igstRate: decimalAmountSchema.optional(),
  cessRate: decimalAmountSchema.optional(),
  isTaxInclusive: z.boolean().optional(),
  offsetAccountId: z.string().uuid().nullable().optional(),
  costCentreId: z.string().uuid().nullable().optional(),
  projectReference: z.string().max(64).nullable().optional(),
  departmentReference: z.string().max(64).nullable().optional(),
  purchaseTaxTreatment: purchaseTaxTreatmentSchema.nullable().optional(),
  itcEligiblePercent: decimalAmountSchema.nullable().optional(),
  sourceLinkType: vendorAdjustmentSourceLinkTypeSchema.nullable().optional(),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  sourceDocumentNumber: z.string().max(64).nullable().optional(),
  sourceDocumentLineId: z.string().uuid().nullable().optional(),
})

export const vendorAdjustmentCalculationInputSchema = z.object({
  legalEntityId: z.string().uuid(),
  companyStateCode: z.string().max(8).nullable().optional(),
  vendorId: z.string().uuid().optional(),
  vendorStateCode: z.string().max(8).nullable().optional(),
  placeOfSupply: z.string().max(8).nullable().optional(),
  supplyType: vendorAdjustmentPurchaseSupplyTypeSchema.optional(),
  adjustmentType: vendorAdjustmentTypeSchema,
  taxEffect: vendorAdjustmentTaxEffectSchema.default('NONE'),
  itcTreatment: vendorAdjustmentItcTreatmentSchema.default('NO_ITC_CHANGE'),
  itcEligiblePercent: decimalAmountSchema.optional(),
  tdsTreatment: vendorAdjustmentTdsTreatmentSchema.default('NO_TDS_CHANGE'),
  purchaseTaxTreatment: purchaseTaxTreatmentSchema.default('REGULAR'),
  tdsSectionCode: z.string().max(32).nullable().optional(),
  tdsRate: decimalAmountSchema.optional(),
  tdsBaseOverride: decimalAmountSchema.optional(),
  currencyCode: z.string().max(8).optional(),
  exchangeRate: decimalAmountSchema.optional(),
  invoiceDiscountType: vendorAdjustmentHeaderDiscountTypeSchema.optional(),
  invoiceDiscountValue: decimalAmountSchema.optional(),
  freightAmount: decimalAmountSchema.optional(),
  freightGstRate: decimalAmountSchema.nullable().optional(),
  otherChargeAmount: decimalAmountSchema.optional(),
  otherChargeGstRate: decimalAmountSchema.nullable().optional(),
  supplierReferenceNumber: z.string().optional(),
  documentDate: z.string().optional(),
  postingDate: z.string().optional(),
  configuration: vendorAdjustmentCalculationConfigurationSchema.optional(),
  lines: z.array(vendorAdjustmentCalculationLineInputSchema).min(1),
})
