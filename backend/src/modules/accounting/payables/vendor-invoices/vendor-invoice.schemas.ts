import { z } from 'zod'
import {
  decimalAmountSchema,
  inputTaxCreditEligibilitySchema,
  tdsRecognitionModeSchema,
  vendorInvoiceCalculationConfigurationSchema,
  vendorInvoiceCalculationLineInputSchema,
  vendorInvoiceHeaderDiscountTypeSchema,
  vendorInvoicePurchaseSupplyTypeSchema,
  vendorInvoiceSourceLinkTypeSchema,
  vendorInvoiceTaxTreatmentSchema,
} from './calculation/vendor-invoice-calculation.schemas.js'

export const vendorInvoiceTypeSchema = z.enum(['GOODS', 'SERVICE', 'EXPENSE', 'ASSET', 'MIXED'])
export const vendorInvoiceStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'CANCELLED',
  'REVERSED',
])

const sourceLinkSchema = z.object({
  sourceType: vendorInvoiceSourceLinkTypeSchema,
  sourceDocumentId: z.string().uuid(),
  sourceDocumentNumberSnapshot: z.string().max(64).nullable().optional(),
  sourceDocumentDateSnapshot: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

/** Application-level source mode — not a Prisma column; validated against sourceLinks. */
export const vendorInvoiceSourceModeSchema = z.enum([
  'DIRECT',
  'PURCHASE_ORDER',
  'GRN',
  'PURCHASE_ORDER_AND_GRN',
])

/** Shared draft header + line fields — reuses the Phase 4A2 calculation schemas for lines/config. */
const draftFields = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid(),
  sourceMode: vendorInvoiceSourceModeSchema.optional(),
  invoiceType: vendorInvoiceTypeSchema,
  supplierInvoiceNumber: z.string().min(1).max(128),
  supplierInvoiceDate: z.string(),
  documentDate: z.string(),
  dueDate: z.string().nullable().optional(),
  postingDate: z.string().optional(),
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: decimalAmountSchema.default('1'),
  taxTreatment: vendorInvoiceTaxTreatmentSchema.default('REGULAR'),
  itcEligibility: inputTaxCreditEligibilitySchema.optional(),
  itcEligiblePercent: decimalAmountSchema.optional(),
  tdsRecognitionMode: tdsRecognitionModeSchema.optional(),
  tdsSectionCode: z.string().max(32).nullable().optional(),
  tdsSectionDescription: z.string().max(200).nullable().optional(),
  tdsRate: decimalAmountSchema.optional(),
  tdsBaseOverride: decimalAmountSchema.optional(),
  supplyType: vendorInvoicePurchaseSupplyTypeSchema.optional(),
  placeOfSupply: z.string().max(8).nullable().optional(),
  companyStateCode: z.string().max(8).nullable().optional(),
  vendorStateCode: z.string().max(8).nullable().optional(),
  invoiceDiscountType: vendorInvoiceHeaderDiscountTypeSchema.optional(),
  invoiceDiscountValue: decimalAmountSchema.optional(),
  freightAmount: decimalAmountSchema.optional(),
  freightGstRate: decimalAmountSchema.nullable().optional(),
  otherChargeAmount: decimalAmountSchema.optional(),
  otherChargeGstRate: decimalAmountSchema.nullable().optional(),
  configuration: vendorInvoiceCalculationConfigurationSchema.optional(),
  /** Phase 4A3 simple override — real FinanceApprovalRule matching is deferred. */
  approvalRequiredOverride: z.boolean().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  lines: z.array(vendorInvoiceCalculationLineInputSchema).min(1),
  sourceLinks: z.array(sourceLinkSchema).optional().default([]),
})

export const createVendorInvoiceSchema = draftFields
export type CreateVendorInvoiceInput = z.infer<typeof createVendorInvoiceSchema>

export const updateVendorInvoiceSchema = draftFields
  .omit({ legalEntityId: true })
  .extend({ expectedUpdatedAt: z.string().datetime({ offset: true }) })
export type UpdateVendorInvoiceInput = z.infer<typeof updateVendorInvoiceSchema>

export const listVendorInvoicesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  invoiceType: vendorInvoiceTypeSchema.optional(),
  status: vendorInvoiceStatusSchema.optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type ListVendorInvoicesQuery = z.infer<typeof listVendorInvoicesQuerySchema>

const expectedUpdatedAtSchema = z.string().datetime({ offset: true }).optional()

export const submitVendorInvoiceSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  comments: z.string().max(1000).optional(),
})
export type SubmitVendorInvoiceInput = z.infer<typeof submitVendorInvoiceSchema>

export const markVendorInvoiceReadySchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
})
export type MarkVendorInvoiceReadyInput = z.infer<typeof markVendorInvoiceReadySchema>

export const approveVendorInvoiceSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  comments: z.string().max(1000).optional(),
})
export type ApproveVendorInvoiceInput = z.infer<typeof approveVendorInvoiceSchema>

export const rejectVendorInvoiceSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type RejectVendorInvoiceInput = z.infer<typeof rejectVendorInvoiceSchema>

export const reviseVendorInvoiceSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type ReviseVendorInvoiceInput = z.infer<typeof reviseVendorInvoiceSchema>

export const cancelVendorInvoiceSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type CancelVendorInvoiceInput = z.infer<typeof cancelVendorInvoiceSchema>
