import { z } from 'zod'
import {
  decimalAmountSchema,
  vendorAdjustmentItcTreatmentSchema,
  vendorAdjustmentTdsTreatmentSchema,
  vendorAdjustmentCalculationConfigurationSchema,
  vendorAdjustmentCalculationLineInputSchema,
  vendorAdjustmentHeaderDiscountTypeSchema,
  vendorAdjustmentPurchaseSupplyTypeSchema,
  vendorAdjustmentSourceLinkTypeSchema,
  vendorAdjustmentTaxEffectSchema,
  vendorAdjustmentTypeSchema,
  vendorAdjustmentReasonSchema,
  purchaseTaxTreatmentSchema,
} from './calculation/vendor-adjustment-calculation.schemas.js'

export const vendorAdjustmentStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'CANCELLED',
  'REVERSED',
])

const sourceLinkSchema = z.object({
  sourceType: vendorAdjustmentSourceLinkTypeSchema,
  sourceDocumentId: z.string().uuid(),
  sourceDocumentNumberSnapshot: z.string().max(64).nullable().optional(),
  sourceDocumentDateSnapshot: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const draftFields = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid(),
  adjustmentType: vendorAdjustmentTypeSchema,
  reason: vendorAdjustmentReasonSchema.default('OTHER'),
  supplierReferenceNumber: z.string().min(1).max(128),
  supplierReferenceDate: z.string(),
  documentDate: z.string(),
  dueDate: z.string().nullable().optional(),
  postingDate: z.string().optional(),
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: decimalAmountSchema.default('1'),
  taxEffect: vendorAdjustmentTaxEffectSchema.default('NONE'),
  itcTreatment: vendorAdjustmentItcTreatmentSchema.default('NO_ITC_CHANGE'),
  itcEligiblePercent: decimalAmountSchema.optional(),
  tdsTreatment: vendorAdjustmentTdsTreatmentSchema.default('NO_TDS_CHANGE'),
  purchaseTaxTreatment: purchaseTaxTreatmentSchema.default('REGULAR'),
  tdsSectionCode: z.string().max(32).nullable().optional(),
  tdsSectionDescription: z.string().max(200).nullable().optional(),
  tdsRate: decimalAmountSchema.optional(),
  tdsBaseOverride: decimalAmountSchema.optional(),
  supplyType: vendorAdjustmentPurchaseSupplyTypeSchema.optional(),
  placeOfSupply: z.string().max(8).nullable().optional(),
  companyStateCode: z.string().max(8).nullable().optional(),
  vendorStateCode: z.string().max(8).nullable().optional(),
  invoiceDiscountType: vendorAdjustmentHeaderDiscountTypeSchema.optional(),
  invoiceDiscountValue: decimalAmountSchema.optional(),
  freightAmount: decimalAmountSchema.optional(),
  freightGstRate: decimalAmountSchema.nullable().optional(),
  otherChargeAmount: decimalAmountSchema.optional(),
  otherChargeGstRate: decimalAmountSchema.nullable().optional(),
  configuration: vendorAdjustmentCalculationConfigurationSchema.optional(),
  approvalRequiredOverride: z.boolean().optional(),
  lines: z.array(vendorAdjustmentCalculationLineInputSchema).min(1),
  sourceLinks: z.array(sourceLinkSchema).optional().default([]),
})

export const createVendorAdjustmentSchema = draftFields
export type CreateVendorAdjustmentInput = z.infer<typeof createVendorAdjustmentSchema>

export const updateVendorAdjustmentSchema = draftFields
  .omit({ legalEntityId: true })
  .extend({ expectedUpdatedAt: z.string().datetime({ offset: true }) })
export type UpdateVendorAdjustmentInput = z.infer<typeof updateVendorAdjustmentSchema>

export const listVendorAdjustmentsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  adjustmentType: vendorAdjustmentTypeSchema.optional(),
  status: vendorAdjustmentStatusSchema.optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type ListVendorAdjustmentsQuery = z.infer<typeof listVendorAdjustmentsQuerySchema>

const expectedUpdatedAtSchema = z.string().datetime({ offset: true }).optional()

export const submitVendorAdjustmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  comments: z.string().max(1000).optional(),
})
export type SubmitVendorAdjustmentInput = z.infer<typeof submitVendorAdjustmentSchema>

export const markVendorAdjustmentReadySchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
})
export type MarkVendorAdjustmentReadyInput = z.infer<typeof markVendorAdjustmentReadySchema>

export const approveVendorAdjustmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  comments: z.string().max(1000).optional(),
})
export type ApproveVendorAdjustmentInput = z.infer<typeof approveVendorAdjustmentSchema>

export const rejectVendorAdjustmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type RejectVendorAdjustmentInput = z.infer<typeof rejectVendorAdjustmentSchema>

export const reviseVendorAdjustmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type ReviseVendorAdjustmentInput = z.infer<typeof reviseVendorAdjustmentSchema>

export const cancelVendorAdjustmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type CancelVendorAdjustmentInput = z.infer<typeof cancelVendorAdjustmentSchema>
