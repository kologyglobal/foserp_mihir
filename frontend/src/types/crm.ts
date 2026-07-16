import type { AuditTrail } from './audit'

export type OpportunityStage =
  | 'new_lead'
  | 'qualified'
  | 'requirement_discussion'
  | 'technical_review'
  | 'quotation_prepared'
  | 'quotation_sent'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'on_hold'

export type OpportunityPriority = 'low' | 'medium' | 'high' | 'critical' | 'normal' | 'strategic'
export type OpportunityStatus = 'open' | 'won' | 'lost' | 'on_hold'

export type CrmActivityType =
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'meeting'
  | 'site_visit'
  | 'note'
  | 'stage_change'
  | 'quotation_created'
  | 'quotation_sent'
  | 'quotation_revised'
  | 'quotation_approved'
  | 'quotation_rejected'
  | 'follow_up_completed'
  | 'deal_won'
  | 'deal_lost'
  | 'sales_order_created'

export type FollowUpType =
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'meeting'
  | 'site_visit'
  | 'demo'
  | 'quotation_follow_up'
  | 'payment_follow_up'
  | 'technical_discussion'

export type FollowUpStatus = 'pending' | 'completed' | 'snoozed' | 'overdue' | 'cancelled'

export type {
  QuotationSectionContentFormat,
  QuotationSpecRow,
  QuotationSectionType,
  QuotationDocumentStatus,
  QuotationApprovalEntry,
  QuotationPriceLine,
  QuotationSection,
  QuotationDocument,
  QuotationTemplate,
  QuotationPageSize,
  QuotationHeaderStyle,
  QuotationPrintLayout,
  QuotationTemplateSection,
} from './quotation'

export {
  APPROVAL_AMOUNT_THRESHOLD,
  DISCOUNT_APPROVAL_THRESHOLD,
} from './quotation'

export interface CrmContact extends AuditTrail {
  id: string
  contactCode: string
  customerId: string
  name: string
  designation: string
  department?: string
  email: string
  phone: string
  isPrimary: boolean
  isActive?: boolean
  /** Linked row in masterStore.customerContacts */
  masterContactId?: string
}

export interface Opportunity extends AuditTrail {
  id: string
  opportunityNo: string
  customerId: string
  contactId: string | null
  productId: string | null
  opportunityName: string
  productRequirement: string
  lines: OpportunityLine[]
  stage: OpportunityStage
  value: number
  probability: number
  expectedCloseDate: string
  ownerId: string
  ownerName: string
  priority: OpportunityPriority
  status: OpportunityStatus
  lostReason: string | null
  healthScore: number
  inquiryId: string | null
  /** @deprecated Legacy link — inquiries are migrated into opportunities */
  quotationId: string | null
  salesOrderId: string | null
  leadId: string | null
  lastActivityAt: string | null
  nextFollowUpDate: string | null
  locationId?: string | null
}

/** Invoice-style opportunity item line — sourced from Product / Item master */
export interface OpportunityLine {
  id: string
  lineNo: number
  productId: string | null
  itemId: string | null
  itemCode: string
  productOrItem: string
  description: string
  productFamily: string
  itemType: string
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  discountAmount: number
  taxableValue: number
  taxPct: number
  gstAmount: number
  lineTotal: number
  expectedDeliveryDate: string | null
  remarks: string
}

export interface CrmActivity extends AuditTrail {
  id: string
  type: CrmActivityType
  subject: string
  description: string
  customerId: string | null
  contactId: string | null
  opportunityId: string | null
  quotationId: string | null
  leadId: string | null
  ownerId: string
  ownerName: string
  outcome: string | null
  activityDate: string
  attachmentNames: string[]
}

export interface FollowUp extends AuditTrail {
  id: string
  followUpType: FollowUpType
  customerId: string | null
  contactId: string | null
  opportunityId: string | null
  quotationId: string | null
  leadId: string | null
  assignedTo: string
  assignedToName: string
  dueDate: string
  dueTime: string
  priority: OpportunityPriority
  status: FollowUpStatus
  outcome: string | null
  notes: string
  reminder: boolean
}

export const OPPORTUNITY_STAGES: { id: OpportunityStage; label: string }[] = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'requirement_discussion', label: 'Requirement Discussion' },
  { id: 'technical_review', label: 'Technical Review' },
  { id: 'quotation_prepared', label: 'Quotation Prepared' },
  { id: 'quotation_sent', label: 'Quotation Sent' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'on_hold', label: 'On Hold' },
]

export const STAGE_LABEL: Record<OpportunityStage, string> = Object.fromEntries(
  OPPORTUNITY_STAGES.map((s) => [s.id, s.label]),
) as Record<OpportunityStage, string>
