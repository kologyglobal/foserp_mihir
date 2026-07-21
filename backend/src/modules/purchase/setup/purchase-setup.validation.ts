import { z } from 'zod'

const optionalUuid = z.string().uuid().nullable().optional()
const optionalString = z.string().trim().nullable().optional()
const pct = z.coerce.number().min(0).max(100)
const nonNeg = z.coerce.number().min(0)

export const DUPLICATE_CHALLAN_POLICIES = ['BLOCK', 'WARN', 'ALLOW'] as const
export const SELF_APPROVAL_POLICIES = ['NEVER', 'PERMISSION_ONLY', 'EVERYONE'] as const
export const GST_SCHEMES = ['cgst_sgst', 'igst'] as const
export const ROUND_OFF_RULES = ['none', 'nearest_rupee', 'nearest_paisa'] as const
export const PRINT_PAPER_SIZES = ['A4', 'Letter'] as const
export const PRINT_ORIENTATIONS = ['portrait', 'landscape'] as const
export const APPROVAL_ROLES = [
  'department_head',
  'purchase_head',
  'finance_head',
  'management',
] as const
export const APPROVAL_DOCUMENT_TYPES = ['all', 'purchase_requisition', 'purchase_order'] as const
export const INSPECTION_CATEGORIES = [
  'raw_material',
  'component',
  'consumable',
  'packing_material',
  'maintenance',
  'job_work',
] as const

export const NUMBER_SERIES_KEYS = [
  'purchaseRequisition',
  'rfq',
  'vendorQuotation',
  'purchaseOrder',
  'grn',
  'qualityInspection',
  'purchaseInvoice',
  'purchaseReturn',
] as const

const numberSeriesConfigSchema = z.object({
  prefix: z.string().trim().min(1).max(20),
  padLength: z.coerce.number().int().min(1).max(12),
  /** Read-only on GET; ignored on save (next = currentValue + 1). */
  nextNumber: z.coerce.number().int().min(1).optional(),
})

const approvalTierSchema = z.object({
  id: z.string().uuid().optional(),
  minAmount: nonNeg,
  maxAmount: nonNeg.nullable(),
  requiredRoles: z.array(z.enum(APPROVAL_ROLES)).min(1),
  sortOrder: z.coerce.number().int().min(1),
  isActive: z.boolean(),
  label: z.string().trim().min(1).max(200),
  documentType: z.enum(APPROVAL_DOCUMENT_TYPES).optional().default('all'),
})

const generalSchema = z.object({
  defaultPlantId: z.string().uuid().nullable().optional().or(z.literal('')),
  defaultWarehouseId: z.string().uuid().nullable().optional().or(z.literal('')),
  defaultBuyerId: z.string().uuid().nullable().optional().or(z.literal('')),
  defaultCurrency: z.string().trim().min(3).max(8).optional(),
  defaultPaymentTerms: z.string().trim().max(200).optional(),
  defaultPaymentTermCode: z.string().trim().max(64).nullable().optional().or(z.literal('')),
  defaultDeliveryTerms: z.string().trim().max(200).optional(),
  allowDirectPo: z.boolean().optional(),
  requirePrBeforePo: z.boolean().optional(),
  requireRfqAboveAmountInr: nonNeg.optional(),
  minimumRfqVendorCount: z.coerce.number().int().min(1).max(50).optional(),
  requireQuotationComparison: z.boolean().optional(),
  allowOverReceipt: z.boolean().optional(),
  overReceiptTolerancePct: pct.optional(),
  allowShortClose: z.boolean().optional(),
  requirePoWarehouse: z.boolean().optional(),
  requireExpectedDeliveryDate: z.boolean().optional(),
  requirePaymentTerms: z.boolean().optional(),
})

const requisitionSchema = z.object({
  skipRfq: z.boolean().optional(),
  defaultWarehouseId: z.string().uuid().nullable().optional().or(z.literal('')),
  autoCompleteRef: z.boolean().optional(),
})

const taxSchema = z.object({
  defaultGstScheme: z.enum(GST_SCHEMES).optional(),
  placeOfSupplyState: z.string().trim().max(100).optional(),
  placeOfSupplyStateCode: z.string().trim().max(8).optional(),
  reverseChargeDefault: z.boolean().optional(),
  tcsEnabled: z.boolean().optional(),
  tdsEnabled: z.boolean().optional(),
  roundOffRule: z.enum(ROUND_OFF_RULES).optional(),
})

const invoiceMatchSchema = z.object({
  requirePoMatch: z.boolean().optional(),
  requireGrnMatch: z.boolean().optional(),
  quantityTolerancePct: pct.optional(),
  rateTolerancePct: pct.optional(),
  amountToleranceInr: nonNeg.optional(),
  amountTolerancePct: pct.optional(),
  taxToleranceInr: nonNeg.optional(),
  taxTolerancePct: pct.optional(),
  allowAuthorizedOverride: z.boolean().optional(),
})

const receivingSchema = z.object({
  requireGateEntry: z.boolean().optional(),
  requireVendorChallan: z.boolean().optional(),
  requireVehicleNumber: z.boolean().optional(),
  requireBatch: z.boolean().optional(),
  requireSerial: z.boolean().optional(),
  requireExpiry: z.boolean().optional(),
  autoCreateInspection: z.boolean().optional(),
  defaultReceivingLocationId: z.string().uuid().nullable().optional().or(z.literal('')),
  duplicateChallanPolicy: z.enum(DUPLICATE_CHALLAN_POLICIES).optional(),
})

const qualitySchema = z.object({
  inspectionRequiredCategories: z.array(z.enum(INSPECTION_CATEGORIES)).optional(),
  allowAcceptanceUnderDeviation: z.boolean().optional(),
  deviationApproverRole: z.enum(APPROVAL_ROLES).optional(),
  allowRejectedStockInQuarantine: z.boolean().optional(),
  defaultQualityHoldLocationId: z.string().uuid().nullable().optional().or(z.literal('')),
  defaultRejectedLocationId: z.string().uuid().nullable().optional().or(z.literal('')),
  defaultVendorReturnLocationId: z.string().uuid().nullable().optional().or(z.literal('')),
})

const printSchema = z.object({
  companyName: z.string().trim().max(300).optional(),
  logoUrl: z.string().trim().max(500).nullable().optional().or(z.literal('')),
  /** @deprecated use logoUrl */
  logoPlaceholderUrl: z.string().trim().max(500).nullable().optional().or(z.literal('')),
  showTermsOnPo: z.boolean().optional(),
  showTermsOnGrn: z.boolean().optional(),
  showTermsOnInvoice: z.boolean().optional(),
  defaultCopies: z.coerce.number().int().min(1).max(10).optional(),
  paperSize: z.enum(PRINT_PAPER_SIZES).optional(),
  orientation: z.enum(PRINT_ORIENTATIONS).optional(),
})

const numberSeriesSchema = z.object({
  purchaseRequisition: numberSeriesConfigSchema.optional(),
  rfq: numberSeriesConfigSchema.optional(),
  vendorQuotation: numberSeriesConfigSchema.optional(),
  purchaseOrder: numberSeriesConfigSchema.optional(),
  grn: numberSeriesConfigSchema.optional(),
  qualityInspection: numberSeriesConfigSchema.optional(),
  purchaseInvoice: numberSeriesConfigSchema.optional(),
  purchaseReturn: numberSeriesConfigSchema.optional(),
})

/** Nested PUT body — notifications intentionally excluded from persistence. */
export const upsertPurchaseSetupSchema = z.object({
  version: z.coerce.number().int().min(0).optional(),
  selfApprovalPolicy: z.enum(SELF_APPROVAL_POLICIES).optional(),
  general: generalSchema.optional(),
  requisition: requisitionSchema.optional(),
  numberSeries: numberSeriesSchema.optional(),
  approvalMatrix: z.array(approvalTierSchema).optional(),
  tax: taxSchema.optional(),
  invoiceMatchTolerances: invoiceMatchSchema.optional(),
  allowDirectInvoice: z.boolean().optional(),
  receiving: receivingSchema.optional(),
  quality: qualitySchema.optional(),
  print: printSchema.optional(),
})

export type UpsertPurchaseSetupInput = z.infer<typeof upsertPurchaseSetupSchema>
export const patchPurchaseSetupSchema = upsertPurchaseSetupSchema
export type PatchPurchaseSetupInput = z.infer<typeof patchPurchaseSetupSchema>

export const upsertPurchasePlantSetupSchema = z.object({
  defaultWarehouseId: optionalUuid,
  defaultReceivingLocationId: optionalUuid,
  defaultQualityHoldLocationId: optionalUuid,
  defaultRejectedLocationId: optionalUuid,
  defaultVendorReturnLocationId: optionalUuid,
})

export type UpsertPurchasePlantSetupInput = z.infer<typeof upsertPurchasePlantSetupSchema>

export const plantIdParamSchema = z.object({
  plantId: z.string().uuid(),
})

/** Empty UUID / blank → null for FK fields. */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return value
}

export { optionalUuid, optionalString }
