import type { AuditTrail } from './audit'

export type LeadSource = 'website' | 'referral' | 'trade_show' | 'cold_call' | 'existing_customer' | 'other' | 'indiamart' | 'justdial' | 'field_visit' | 'other_channel'
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'requirement_collected'
  | 'qualified'
  | 'not_qualified'
  | 'converted_to_opportunity'
  | 'closed'
export type LeadPriority = 'low' | 'medium' | 'high' | 'critical'
export type LeadActivityStatus = 'active' | 'inactive'
export type LeadLifecycleStatus = 'open' | 'qualified' | 'converted' | 'closed'
export type LeadNotQualifiedReason =
  | 'no_budget'
  | 'wrong_requirement'
  | 'not_decision_maker'
  | 'invalid_contact'
  | 'not_our_product_fit'
  | 'future_requirement'
  | 'duplicate'
  | 'other'
export type LeadInactiveReason =
  | 'duplicate'
  | 'not_interested'
  | 'wrong_contact'
  | 'invalid_requirement'
  | 'future_prospect'
  | 'other'
export type LeadClosedReason =
  | 'not_interested'
  | 'invalid_lead'
  | 'duplicate'
  | 'budget_issue'
  | 'no_response'
  | 'requirement_cancelled'
  | 'other'

export type InquiryStatus = 'draft' | 'submitted' | 'quoting' | 'closed' | 'cancelled'

export type {
  QuotationStatus,
  CustomerApprovalStatus,
  QuotationChangeRecord,
  QuotationPricing,
  Quotation,
} from './quotation'

export { QUOTATION_STATUS_FLOW } from './quotation'

export const LEAD_STAGE_FLOW: Record<LeadStage, LeadStage[]> = {
  new: ['contacted', 'requirement_collected', 'not_qualified', 'closed'],
  contacted: ['requirement_collected', 'qualified', 'not_qualified', 'closed'],
  requirement_collected: ['qualified', 'not_qualified', 'closed'],
  qualified: ['converted_to_opportunity', 'not_qualified', 'closed'],
  not_qualified: ['closed'],
  converted_to_opportunity: [],
  closed: [],
}

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  requirement_collected: 'Requirement Collected',
  qualified: 'Qualified',
  not_qualified: 'Not Qualified',
  converted_to_opportunity: 'Converted to Opportunity',
  closed: 'Closed',
}

export const INQUIRY_STATUS_FLOW: Record<InquiryStatus, InquiryStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['quoting', 'cancelled'],
  quoting: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
}

export interface InquiryAttachment {
  id: string
  name: string
  uploadedAt: string
}

export interface Lead extends AuditTrail {
  id: string
  leadNo: string
  source: LeadSource
  industry: string
  customerId: string | null
  prospectName: string
  /** @deprecated use leadOwnerName */
  salesOwner: string
  leadOwnerId: string
  leadOwnerName: string
  expectedValue: number
  probability: number
  stage: LeadStage
  remarks: string
  priority: LeadPriority
  createdDate: string
  activityStatus: LeadActivityStatus
  inactiveReason: string | null
  lifecycleStatus: LeadLifecycleStatus
  closedDate: string | null
  closedReason: string | null
  notQualifiedReason: string | null
  opportunityId: string | null
  isArchived?: boolean
  productRequirement: string
  expectedQty: number | null
  expectedCloseDate: string | null
  contactPerson: string | null
  mobile: string | null
  email: string | null
  nextFollowUpDate: string | null
  followUpType: string | null
  followUpNotes: string | null
  /** BC-style fulfilment / stock location */
  locationId: string | null
}

export interface Inquiry extends AuditTrail {
  id: string
  inquiryNo: string
  leadId: string | null
  customerId: string
  productId: string
  qty: number
  deliveryExpectation: string
  notes: string
  attachments: InquiryAttachment[]
  status: InquiryStatus
}
