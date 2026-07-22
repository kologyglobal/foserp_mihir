import type { AuditTrail } from './audit'

/** Sales header / workflow status for quotation records */
export type QuotationStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'rejected'
  | 'superseded'
  | 'converted'
  | 'cancelled'

export type CustomerApprovalStatus = 'pending' | 'approved' | 'rejected'

export const QUOTATION_STATUS_FLOW: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['submitted', 'pending_approval', 'cancelled'],
  submitted: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected'],
  approved: ['sent'],
  sent: ['converted'],
  rejected: ['draft'],
  superseded: [],
  converted: [],
  cancelled: [],
}

export interface QuotationChangeRecord {
  revisionNo: number
  changedAt: string
  changedByName: string
  summary: string
}

export interface QuotationPricing {
  unitPrice: number
  discountPct: number
  subtotal: number
  gstPct: number
  gstAmount: number
  grandTotal: number
}

export interface Quotation extends AuditTrail {
  id: string
  quotationNo: string
  /** @deprecated Inquiries folded into opportunities — use opportunityId */
  inquiryId?: string
  /** @deprecated */
  inquiryNo?: string
  opportunityId?: string | null
  opportunityNo?: string | null
  customerId: string
  productId: string
  qty: number
  revisionNo: number
  rootQuotationId: string
  isLatestRevision: boolean
  locked: boolean
  status: QuotationStatus
  customerApproval: CustomerApprovalStatus
  customerApprovalAt: string | null
  customerApprovalBy: string | null
  customerRejectionReason: string | null
  terms: string
  paymentTerms: string
  deliveryTerms: string
  validityDate: string
  pricing: QuotationPricing
  changeHistory: QuotationChangeRecord[]
  salesOrderId: string | null
  salesOrderNo: string | null
  locationId?: string | null
}

export type QuotationSectionContentFormat = 'richtext' | 'spec_table' | 'key_value_list'

export interface QuotationSpecRow {
  id: string
  sectionNo?: string
  label: string
  value: string
  unit?: string
  required?: boolean
}

export type QuotationSectionType =
  | 'cover'
  | 'customer_details'
  | 'introduction'
  | 'scope'
  | 'specification'
  | 'technical'
  | 'commercial'
  | 'price_table'
  | 'taxes'
  | 'delivery'
  | 'payment'
  | 'warranty'
  | 'exclusions'
  | 'terms'
  | 'bank'
  | 'signature'
  | 'annexure'
  | 'custom'

export type QuotationDocumentStatus = 'draft' | 'sent' | 'pending_approval' | 'approved' | 'rejected' | 'superseded' | 'converted'

export interface QuotationApprovalEntry {
  id: string
  action: 'submitted' | 'approved' | 'rejected' | 'sent' | 'customer_approved' | 'customer_rejected'
  byId: string
  byName: string
  at: string
  remarks: string | null
}

export interface QuotationPriceLine {
  id: string
  productOrItem: string
  description: string
  /** Linked product master — set from opportunity lines or product picker */
  productId?: string | null
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  lineTotal: number
  isOptional: boolean
}

export interface QuotationSection {
  id: string
  sectionType: QuotationSectionType
  title: string
  content: string
  sequenceNo: number
  editable: boolean
  contentFormat?: QuotationSectionContentFormat
  specRows?: QuotationSpecRow[]
  /** CRM Master code when payment/delivery/warranty section uses a standard term */
  masterCode?: string | null
}

export interface QuotationDocument extends AuditTrail {
  id: string
  quotationId: string
  revisionNo: number
  templateId: string | null
  opportunityId: string | null
  sections: QuotationSection[]
  priceLines: QuotationPriceLine[]
  freightAmount: number
  installationAmount: number
  customCharges: number
  status: QuotationDocumentStatus
  totalAmount: number
  revisionReason: string | null
  locked: boolean
  approvalHistory: QuotationApprovalEntry[]
  contactId: string | null
  salesOwnerId: string | null
  salesOwnerName: string | null
  commercialNotes: string | null
  technicalNotes: string | null
  salesOrderId?: string | null
  salesOrderNo?: string | null
  locationId?: string | null
}

export interface QuotationTemplate extends AuditTrail {
  id: string
  /** Stable seed/API code (e.g. ISO-TANK-26KL); optional in demo mode */
  code?: string
  templateName: string
  productFamily: string
  version?: number
  sections: QuotationTemplateSection[]
  defaultTerms: string
  defaultWarranty: string
  defaultExclusions: string
  isActive: boolean
  /** Print/PDF layout configuration for documents created from this template */
  printLayout?: QuotationPrintLayout
}

export type QuotationPageSize = 'A4' | 'Letter'

export type QuotationHeaderStyle = 'standard' | 'minimal' | 'cover'

/** Visual print theme — `vf_word` is the Vasant Fabricators letter-style quotation layout (sans-serif). */
export type QuotationPrintSkin = 'default' | 'vf_word'

export interface QuotationPrintLayout {
  pageSize: QuotationPageSize
  marginMm: number
  fontScale: number
  headerStyle: QuotationHeaderStyle
  showLogo: boolean
  showCompanyHeader: boolean
  showCustomerBlock: boolean
  showPageFooter: boolean
  showSignatureBlock: boolean
  /** Section types that begin on a new printed page */
  pageBreakBefore: QuotationSectionType[]
  /** Optional print/PDF visual skin (CSS modifier) */
  printSkin?: QuotationPrintSkin
}

export type QuotationTemplateSection = Omit<QuotationSection, 'id' | 'specRows'> & {
  specRows?: Omit<QuotationSpecRow, 'id'>[]
}

export const APPROVAL_AMOUNT_THRESHOLD = 5000000
export const DISCOUNT_APPROVAL_THRESHOLD = 10
