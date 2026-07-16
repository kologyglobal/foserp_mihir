import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { optionalUuid } from '../../../utils/zodHelpers.js'
import {
  CUSTOMER_APPROVAL_STATUSES,
  QUOTATION_DOCUMENT_STATUSES,
  QUOTATION_STATUSES,
} from './quotation.constants.js'

const specRowSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  value: z.string(),
  uom: z.string().optional(),
  remarks: z.string().optional(),
})

const sectionSchema = z.object({
  id: z.string().optional(),
  sectionType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  content: z.string().optional(),
  sequenceNo: z.coerce.number().int().min(0),
  editable: z.boolean().optional(),
  contentFormat: z.enum(['richtext', 'spec_table', 'key_value_list']).optional(),
  specRows: z.array(specRowSchema).optional(),
  masterCode: z.string().nullable().optional(),
})

const priceLineSchema = z.object({
  id: z.string().optional(),
  productOrItem: z.string().trim().min(1),
  description: z.string().trim().optional(),
  productId: z.string().uuid().optional().nullable(),
  qty: z.coerce.number().min(0),
  uom: z.string().trim().max(16).optional(),
  unitPrice: z.coerce.number().min(0),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  taxPct: z.coerce.number().min(0).max(100).optional(),
  lineTotal: z.coerce.number().min(0).optional(),
  isOptional: z.boolean().optional(),
})

export const listQuotationsQuerySchema = paginationSchema.extend({
  customerId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.enum(QUOTATION_STATUSES).optional(),
  search: z.string().trim().optional(),
})

export const createQuotationSchema = z.object({
  quotationNo: z.string().trim().max(32).optional(),
  customerId: z.string().uuid(),
  opportunityId: optionalUuid,
  productId: optionalUuid,
  qty: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  gstPct: z.coerce.number().min(0).max(100).optional(),
  terms: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  deliveryTerms: z.string().trim().optional(),
  validityDate: z.string().datetime().optional().nullable(),
  locationId: optionalUuid,
  salesOwnerId: optionalUuid,
  salesOwnerName: z.string().trim().max(200).optional(),
  contactId: optionalUuid,
  templateId: optionalUuid,
  opportunityNo: z.string().trim().optional(),
  sections: z.array(sectionSchema).optional(),
  priceLines: z.array(priceLineSchema).optional(),
  freightAmount: z.coerce.number().min(0).optional(),
  installationAmount: z.coerce.number().min(0).optional(),
  customCharges: z.coerce.number().min(0).optional(),
  commercialNotes: z.string().trim().optional().nullable(),
  technicalNotes: z.string().trim().optional().nullable(),
  summary: z.string().trim().optional(),
})

export const updateQuotationSchema = createQuotationSchema.partial().extend({
  customerId: z.string().uuid().optional(),
  status: z.enum(QUOTATION_STATUSES).optional(),
  customerApproval: z.enum(CUSTOMER_APPROVAL_STATUSES).optional(),
})

export const updateQuotationDocumentSchema = z.object({
  sections: z.array(sectionSchema).optional(),
  priceLines: z.array(priceLineSchema).optional(),
  freightAmount: z.coerce.number().min(0).optional(),
  installationAmount: z.coerce.number().min(0).optional(),
  customCharges: z.coerce.number().min(0).optional(),
  commercialNotes: z.string().trim().optional().nullable(),
  technicalNotes: z.string().trim().optional().nullable(),
  contactId: optionalUuid,
  salesOwnerId: optionalUuid,
  salesOwnerName: z.string().trim().max(200).optional(),
  locationId: optionalUuid,
  status: z.enum(QUOTATION_DOCUMENT_STATUSES).optional(),
  totalAmount: z.coerce.number().min(0).optional(),
})

export const revisionReasonSchema = z.object({
  reason: z.string().trim().min(1),
})

export const approvalRemarksSchema = z.object({
  remarks: z.string().trim().optional(),
})

export const quotationDocumentParamsSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
})

export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>
export type UpdateQuotationDocumentInput = z.infer<typeof updateQuotationDocumentSchema>
export type RevisionReasonInput = z.infer<typeof revisionReasonSchema>
export type ApprovalRemarksInput = z.infer<typeof approvalRemarksSchema>
