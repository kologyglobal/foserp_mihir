import { z } from 'zod'
import { vendorPaymentAdjustmentInputSchema } from './calculation/vendor-payment-calculation.schemas.js'

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')
const positiveDecimal = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a non-negative decimal string')

export const vendorPaymentPurposeSchema = z.enum(['INVOICE_SETTLEMENT', 'ADVANCE', 'MIXED'])
export const vendorPaymentMethodSchema = z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER'])
export const vendorPaymentStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'CANCELLED',
  'REVERSED',
])

/** Shared draft header + adjustments — reuses the Phase 4B2 calculation adjustment schema. */
const draftFields = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  vendorId: z.string().uuid(),
  paymentPurpose: vendorPaymentPurposeSchema,
  paymentMethod: vendorPaymentMethodSchema,
  documentDate: z.string(),
  paymentDate: z.string(),
  proposedPostingDate: z.string().nullable().optional(),
  valueDate: z.string().nullable().optional(),
  dueReferenceDate: z.string().nullable().optional(),
  currencyCode: z.string().max(8).default('INR'),
  exchangeRate: decimalString.default('1'),
  paymentAmount: positiveDecimal,
  paymentAccountId: z.string().uuid().nullable().optional(),
  vendorPayableAccountId: z.string().uuid().nullable().optional(),
  paymentReference: z.string().max(100).nullable().optional(),
  bankReference: z.string().max(100).nullable().optional(),
  chequeNumber: z.string().max(64).nullable().optional(),
  chequeDate: z.string().nullable().optional(),
  instrumentReference: z.string().max(100).nullable().optional(),
  narration: z.string().max(2000).nullable().optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  /** Phase 4B3 simple override — real FinanceApprovalRule matching is deferred. */
  approvalRequiredOverride: z.boolean().optional(),
  adjustments: z.array(vendorPaymentAdjustmentInputSchema).optional().default([]),
})

export const createVendorPaymentSchema = draftFields
export type CreateVendorPaymentInput = z.infer<typeof createVendorPaymentSchema>

export const updateVendorPaymentSchema = draftFields
  .omit({ legalEntityId: true })
  .extend({ expectedUpdatedAt: z.string().datetime({ offset: true }) })
export type UpdateVendorPaymentInput = z.infer<typeof updateVendorPaymentSchema>

export const listVendorPaymentsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  paymentPurpose: vendorPaymentPurposeSchema.optional(),
  paymentMethod: vendorPaymentMethodSchema.optional(),
  status: vendorPaymentStatusSchema.optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type ListVendorPaymentsQuery = z.infer<typeof listVendorPaymentsQuerySchema>

const expectedUpdatedAtSchema = z.string().datetime({ offset: true }).optional()

export const submitVendorPaymentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  comments: z.string().max(1000).optional(),
})
export type SubmitVendorPaymentInput = z.infer<typeof submitVendorPaymentSchema>

export const markVendorPaymentReadySchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
})
export type MarkVendorPaymentReadyInput = z.infer<typeof markVendorPaymentReadySchema>

export const approveVendorPaymentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  comments: z.string().max(1000).optional(),
})
export type ApproveVendorPaymentInput = z.infer<typeof approveVendorPaymentSchema>

export const rejectVendorPaymentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type RejectVendorPaymentInput = z.infer<typeof rejectVendorPaymentSchema>

export const reviseVendorPaymentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type ReviseVendorPaymentInput = z.infer<typeof reviseVendorPaymentSchema>

export const cancelVendorPaymentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: z.string().trim().min(1).max(500),
})
export type CancelVendorPaymentInput = z.infer<typeof cancelVendorPaymentSchema>
