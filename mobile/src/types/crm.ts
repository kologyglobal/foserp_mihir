/** Loose CRM DTOs aligned with FOS CRM API responses (mobile). */

export type CrmEntityType =
  | 'COMPANY'
  | 'CONTACT'
  | 'LEAD'
  | 'OPPORTUNITY'
  | 'ACTIVITY'
  | 'FOLLOW_UP'
  | 'QUOTATION'

export interface CrmLead {
  id: string
  leadNo?: string
  leadCode?: string
  prospectName: string
  companyName?: string | null
  customerId?: string | null
  customerName?: string | null
  contactPerson?: string | null
  mobile?: string | null
  email?: string | null
  stage?: string
  priority?: string
  expectedValue?: number
  leadOwnerId?: string | null
  leadOwnerName?: string | null
  nextFollowUpDate?: string | null
  city?: string | null
  industry?: string | null
  source?: string
  remarks?: string | null
  productRequirement?: string | null
  lifecycleStatus?: string
  [key: string]: unknown
}

export interface CrmCompany {
  id: string
  customerCode?: string
  companyCode?: string
  customerName?: string
  name?: string
  industry?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  gstin?: string | null
  addressLine1?: string | null
  pincode?: string | null
  ownerId?: string | null
  notes?: string | null
  lastActivityAt?: string | null
  outstandingAmount?: number | null
  creditLimit?: number | null
  [key: string]: unknown
}

export interface CrmContact {
  id: string
  contactCode?: string
  firstName?: string
  lastName?: string
  fullName?: string
  designation?: string | null
  mobile?: string | null
  phone?: string | null
  email?: string | null
  companyId?: string | null
  companyName?: string | null
  isDecisionMaker?: boolean | null
  isPrimary?: boolean | null
  [key: string]: unknown
}

export interface CrmOpportunityLine {
  id?: string
  lineNo?: number
  itemId?: string
  itemCode?: string
  productOrItem?: string
  description?: string
  productFamily?: string
  qty?: number
  unitPrice?: number
  lineTotal?: number
  [key: string]: unknown
}

export interface CrmOpportunity {
  id: string
  /** API field (mapOpportunityToDto) */
  opportunityNo?: string
  opportunityCode?: string
  /** API field for deal title */
  opportunityName?: string
  /** Legacy / alternate key some clients use */
  name?: string
  /** API: CRM company id */
  customerId?: string | null
  companyId?: string | null
  /** API: resolved company display name */
  companyName?: string | null
  customerName?: string | null
  contactId?: string | null
  contactName?: string | null
  contactPerson?: string | null
  primaryContactName?: string | null
  productRequirement?: string | null
  lines?: CrmOpportunityLine[]
  amount?: number | null
  value?: number | null
  probability?: number | null
  stageId?: string | null
  stageName?: string | null
  stage?: string | null
  status?: string | null
  expectedCloseDate?: string | null
  ownerId?: string | null
  ownerName?: string | null
  [key: string]: unknown
}

export interface CrmFollowUp {
  id: string
  followUpType: string
  customerId?: string | null
  customerName?: string | null
  leadId?: string | null
  leadName?: string | null
  opportunityId?: string | null
  contactId?: string | null
  assignedTo?: string | null
  assignedToName?: string | null
  dueDate: string
  dueTime?: string | null
  priority?: string
  status?: string
  notes?: string | null
  outcome?: string | null
  [key: string]: unknown
}

export interface CrmActivity {
  id: string
  type: string
  subject: string
  description?: string | null
  status?: string
  customerId?: string | null
  customerName?: string | null
  leadId?: string | null
  opportunityId?: string | null
  contactId?: string | null
  activityDate?: string | null
  outcome?: string | null
  nextAction?: string | null
  priority?: string | null
  ownerId?: string | null
  [key: string]: unknown
}

export interface CrmQuotationPricing {
  unitPrice?: number
  discountPct?: number
  subtotal?: number
  gstPct?: number
  gstAmount?: number
  grandTotal?: number
}

export interface CrmQuotation {
  id: string
  /** Alias of quotationNo used on some clients */
  quotationCode?: string
  /** API field (mapQuotationToDto) */
  quotationNo?: string
  /** API field — CRM company id */
  customerId?: string | null
  companyId?: string | null
  /** From API (`customerName`) via company join on quotation DTO */
  customerName?: string | null
  companyName?: string | null
  /** Normalized total (from pricing / documents); not always on raw API header */
  totalAmount?: number | null
  amount?: number | null
  pricing?: CrmQuotationPricing | null
  status?: string
  /** API field */
  validityDate?: string | null
  validUntil?: string | null
  expiryDate?: string | null
  opportunityId?: string | null
  salesOwnerId?: string | null
  salesOwnerName?: string | null
  salesOrderId?: string | null
  salesOrderNo?: string | null
  documents?: Array<{
    id: string
    status?: string
    revisionNo?: number
    totalAmount?: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface CrmSalesOrder {
  id: string
  salesOrderNo?: string
  soNumber?: string
  /** API field — CRM company id */
  customerId?: string | null
  companyId?: string | null
  /** Snapshot code on SO header when present */
  customerCode?: string | null
  /** From API (`customerName`) via company join on sales-order DTO */
  customerName?: string | null
  companyName?: string | null
  /** API monetary field */
  grandTotal?: number | null
  basicAmount?: number | null
  gstAmount?: number | null
  /** Normalized aliases of grandTotal for UI convenience */
  totalAmount?: number | null
  amount?: number | null
  status?: string
  orderDate?: string | null
  expectedDeliveryDate?: string | null
  quotationId?: string | null
  quotationNo?: string | null
  salesOwnerId?: string | null
  salesOwnerName?: string | null
  /** Not always on list DTO; shown when present / enriched */
  invoiceStatus?: string | null
  dispatchStatus?: string | null
  fulfilmentStatus?: string | null
  lines?: Array<{
    id?: string
    lineTotal?: number
    amount?: number
    productOrItem?: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface CrmSearchResults {
  leads: Array<Record<string, unknown>>
  companies: Array<Record<string, unknown>>
  contacts: Array<Record<string, unknown>>
  opportunities: Array<Record<string, unknown>>
  quotations?: Array<Record<string, unknown>>
  salesOrders?: Array<Record<string, unknown>>
}

export interface CrmDashboardMetrics {
  followUps?: { dueToday?: number; overdue?: number; upcoming?: number }
  opportunities?: {
    open?: number
    pipelineValue?: number
    weightedForecast?: number
  }
  activities?: { today?: number }
  panels?: {
    pendingApprovalCount?: number
    pendingApprovalQuotations?: Array<Record<string, unknown>>
    todaysFollowUps?: Array<Record<string, unknown>>
    overdueFollowUps?: Array<Record<string, unknown>>
  }
  [key: string]: unknown
}

export interface CrmEntityNote {
  id: string
  content: string
  noteType?: string | null
  stageCode?: string | null
  createdByName?: string | null
  createdAt?: string
}

export interface CrmAttachment {
  id: string
  originalFilename: string
  mimeType: string
  fileSize: number
  documentType?: string
  documentTypeName?: string
  uploadedByName?: string
  createdAt?: string
}

export interface PipelineStage {
  id: string
  slug: string
  name: string
  probability: number
  isClosedWon?: boolean
  isClosedLost?: boolean
}

export interface PipelineDto {
  id: string
  name: string
  isDefault: boolean
  stages: PipelineStage[]
}

export type OfflineDraftKind =
  | 'follow_up'
  | 'meeting'
  | 'note'
  | 'photo'
  | 'audio'
  | 'business_card'

export type OfflineDraftStatus =
  | 'pending'
  | 'syncing'
  | 'partially_synced'
  | 'failed'
  | 'synced'

export type OfflineAttachmentStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface OfflineDraftAttachment {
  id: string
  localUri?: string
  contentBase64?: string
  originalFilename: string
  mimeType: string
  documentType: string
  status: OfflineAttachmentStatus
  serverAttachmentId?: string
  error?: string
  /** Idempotency for upload dedupe after partial sync. */
  clientKey: string
}

export interface OfflineDraft {
  id: string
  kind: OfflineDraftKind
  /** Stable client-side key for entity create dedupe. */
  clientKey: string
  payload: Record<string, unknown>
  createdAt: string
  /** @deprecated use status — kept for migration of M3 drafts */
  synced: boolean
  status: OfflineDraftStatus
  serverEntityId?: string
  serverEntityType?: string
  attachments?: OfflineDraftAttachment[]
  error?: string
  attempts?: number
}
