/**
 * Purchase Module — API-ready domain models (demo / future Node+MySQL).
 *
 * Intentionally separate from `types/purchase.ts` (Zustand operational documents)
 * so existing PR/RFQ/PO/GRN pages and stores keep compiling unchanged.
 *
 * Import from `@/types/purchaseDomain` (or `services/purchase`) when wiring
 * Promise-based `purchaseService`. Map to store shapes only via an adapter.
 */

import type { EngineeringProductType } from './taxMaster'

/** ISO calendar date `YYYY-MM-DD` or full ISO timestamp where noted. */
export type IsoDate = string
export type IsoDateTime = string

export type IndianCurrencyCode = 'INR'

export type PurchaseItemCategory =
  | 'raw_material'
  | 'component'
  | 'consumable'
  | 'packing_material'
  | 'maintenance'
  | 'job_work'

export type PurchaseGstScheme = 'cgst_sgst' | 'igst'

export type PurchaseDocumentKind =
  | 'purchase_requisition'
  | 'request_for_quotation'
  | 'vendor_quotation'
  | 'purchase_order'
  | 'goods_receipt_note'
  | 'quality_inspection'
  | 'purchase_invoice'
  | 'purchase_return'

/* -------------------------------------------------------------------------- */
/* Status vocabularies (API slugs + display labels)                           */
/* -------------------------------------------------------------------------- */

export type PurchaseRequisitionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'converted_to_rfq'
  | 'converted_to_po'
  | 'closed'
  | 'cancelled'

export const PURCHASE_REQUISITION_STATUSES: readonly PurchaseRequisitionStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'converted_to_rfq',
  'converted_to_po',
  'closed',
  'cancelled',
] as const

export const PURCHASE_REQUISITION_STATUS_LABELS: Record<PurchaseRequisitionStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  converted_to_rfq: 'Converted to RFQ',
  converted_to_po: 'Converted to PO',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export type RfqDomainStatus =
  | 'draft'
  | 'sent'
  | 'partially_quoted'
  | 'quotation_received'
  | 'under_evaluation'
  | 'closed'
  | 'cancelled'

export const RFQ_DOMAIN_STATUSES: readonly RfqDomainStatus[] = [
  'draft',
  'sent',
  'partially_quoted',
  'quotation_received',
  'under_evaluation',
  'closed',
  'cancelled',
] as const

export const RFQ_DOMAIN_STATUS_LABELS: Record<RfqDomainStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partially_quoted: 'Partially Quoted',
  quotation_received: 'Quotation Received',
  under_evaluation: 'Under Evaluation',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export type PurchaseOrderDomainStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'released'
  | 'partially_received'
  | 'fully_received'
  | 'invoiced'
  | 'closed'
  | 'cancelled'

export const PURCHASE_ORDER_DOMAIN_STATUSES: readonly PurchaseOrderDomainStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'sent_back',
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
  'closed',
  'cancelled',
] as const

export const PURCHASE_ORDER_DOMAIN_STATUS_LABELS: Record<PurchaseOrderDomainStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  sent_back: 'Sent Back',
  released: 'Released',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  invoiced: 'Invoiced',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

/** Backend-provided lifecycle eligibility — the frontend never derives these. */
export interface PurchaseOrderAllowedActions {
  canEdit: boolean
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canSendBack: boolean
  canSendToVendor: boolean
  canCancel: boolean
  canClose: boolean
  canReopen: boolean
  canReceive: boolean
}

export type PurchaseOrderOrigin =
  | 'manual'
  | 'purchase_requisition'
  | 'quotation_comparison'
  | 'vendor_quotation'
  | 'blanket_order'

export const PURCHASE_ORDER_ORIGIN_LABELS: Record<PurchaseOrderOrigin, string> = {
  manual: 'Manual Entry',
  purchase_requisition: 'Approved PR',
  quotation_comparison: 'Quotation Comparison',
  vendor_quotation: 'Approved Vendor Quotation',
  blanket_order: 'Blanket Order',
}

export type PurchaseOrderType =
  | 'standard'
  | 'blanket'
  | 'call_off'
  | 'service'
  | 'job_work'
  | 'capital'

export const PURCHASE_ORDER_TYPE_LABELS: Record<PurchaseOrderType, string> = {
  standard: 'Standard',
  blanket: 'Blanket',
  call_off: 'Call-off',
  service: 'Service',
  job_work: 'Job Work',
  capital: 'Capital / Asset',
}

export type PurchaseOrderApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected'

export const PURCHASE_ORDER_APPROVAL_STATUS_LABELS: Record<PurchaseOrderApprovalStatus, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export type PurchaseOrderInvoiceStatus = 'not_invoiced' | 'partially_invoiced' | 'fully_invoiced'

export const PURCHASE_ORDER_INVOICE_STATUS_LABELS: Record<PurchaseOrderInvoiceStatus, string> = {
  not_invoiced: 'Not Invoiced',
  partially_invoiced: 'Partially Invoiced',
  fully_invoiced: 'Fully Invoiced',
}

export type PurchaseOrderLineStatus = 'open' | 'partial' | 'received' | 'invoiced' | 'cancelled'

export const PURCHASE_ORDER_LINE_STATUS_LABELS: Record<PurchaseOrderLineStatus, string> = {
  open: 'Open',
  partial: 'Partial',
  received: 'Received',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
}

export type PurchaseOrderLineItemType =
  | 'raw_material'
  | 'component'
  | 'consumable'
  | 'packing_material'
  | 'maintenance'
  | 'job_work'
  | 'service'
  | 'asset'

export const PURCHASE_ORDER_LINE_ITEM_TYPE_LABELS: Record<PurchaseOrderLineItemType, string> = {
  raw_material: 'Raw Material',
  component: 'Component',
  consumable: 'Consumable',
  packing_material: 'Packing',
  maintenance: 'Maintenance',
  job_work: 'Job Work',
  service: 'Service',
  asset: 'Asset',
}

export type GrnDomainStatus =
  | 'draft'
  | 'pending_inspection'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'posted'
  | 'cancelled'

export const GRN_DOMAIN_STATUSES: readonly GrnDomainStatus[] = [
  'draft',
  'pending_inspection',
  'accepted',
  'partially_accepted',
  'rejected',
  'posted',
  'cancelled',
] as const

export const GRN_DOMAIN_STATUS_LABELS: Record<GrnDomainStatus, string> = {
  draft: 'Draft',
  pending_inspection: 'Pending Inspection',
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  rejected: 'Rejected',
  posted: 'Posted',
  cancelled: 'Cancelled',
}

export type PurchaseInvoiceStatus =
  | 'draft'
  | 'pending_verification'
  | 'matched'
  | 'mismatch'
  | 'pending_approval'
  | 'approved'
  | 'on_hold'
  | 'posted'
  | 'paid'
  | 'cancelled'

export const PURCHASE_INVOICE_STATUSES: readonly PurchaseInvoiceStatus[] = [
  'draft',
  'pending_verification',
  'matched',
  'mismatch',
  'pending_approval',
  'approved',
  'on_hold',
  'posted',
  'paid',
  'cancelled',
] as const

export const PURCHASE_INVOICE_STATUS_LABELS: Record<PurchaseInvoiceStatus, string> = {
  draft: 'Draft',
  pending_verification: 'Pending Verification',
  matched: 'Matched',
  mismatch: 'Mismatch',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  on_hold: 'On Hold',
  posted: 'Posted',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

/** How the purchase invoice was originated. */
export type PurchaseInvoiceOrigin =
  | 'purchase_order'
  | 'goods_receipt'
  | 'vendor_invoice'
  | 'service_po'
  | 'direct'

export const PURCHASE_INVOICE_ORIGIN_LABELS: Record<PurchaseInvoiceOrigin, string> = {
  purchase_order: 'Purchase Order',
  goods_receipt: 'Posted GRN',
  vendor_invoice: 'Vendor Invoice',
  service_po: 'Service Purchase Order',
  direct: 'Direct Invoice',
}

/** Three-way matching outcome (header / line flags). */
export type InvoiceMatchingResultStatus =
  | 'fully_matched'
  | 'quantity_mismatch'
  | 'rate_mismatch'
  | 'tax_mismatch'
  | 'amount_mismatch'
  | 'missing_grn'
  | 'duplicate_invoice'
  | 'within_tolerance'

export const INVOICE_MATCHING_RESULT_STATUS_LABELS: Record<InvoiceMatchingResultStatus, string> = {
  fully_matched: 'Fully Matched',
  quantity_mismatch: 'Quantity Mismatch',
  rate_mismatch: 'Rate Mismatch',
  tax_mismatch: 'Tax Mismatch',
  amount_mismatch: 'Amount Mismatch',
  missing_grn: 'Missing GRN',
  duplicate_invoice: 'Duplicate Invoice',
  within_tolerance: 'Within Tolerance',
}

export type PurchaseReturnDomainStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'closed'
  | 'cancelled'

export const PURCHASE_RETURN_DOMAIN_STATUSES: readonly PurchaseReturnDomainStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'posted',
  'closed',
  'cancelled',
] as const

export const PURCHASE_RETURN_DOMAIN_STATUS_LABELS: Record<PurchaseReturnDomainStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  posted: 'Posted',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

/** How / why a purchase return was initiated. */
export type PurchaseReturnOrigin =
  | 'grn_rejected_quantity'
  | 'quality_rejection'
  | 'damaged_material'
  | 'excess_receipt'
  | 'wrong_material'
  | 'post_receipt_inspection'
  | 'vendor_replacement'

export const PURCHASE_RETURN_ORIGIN_LABELS: Record<PurchaseReturnOrigin, string> = {
  grn_rejected_quantity: 'GRN Rejected Quantity',
  quality_rejection: 'Quality Rejection',
  damaged_material: 'Damaged Material',
  excess_receipt: 'Excess Receipt',
  wrong_material: 'Wrong Material',
  post_receipt_inspection: 'Post-Receipt Inspection',
  vendor_replacement: 'Vendor Replacement',
}

export type PurchaseReturnReason =
  | 'quality_rejection'
  | 'damaged'
  | 'wrong_item'
  | 'excess_quantity'
  | 'specification_mismatch'
  | 'expired_material'
  | 'short_shelf_life'
  | 'other'

export const PURCHASE_RETURN_REASON_LABELS: Record<PurchaseReturnReason, string> = {
  quality_rejection: 'Quality Rejection',
  damaged: 'Damaged',
  wrong_item: 'Wrong Item',
  excess_quantity: 'Excess Quantity',
  specification_mismatch: 'Specification Mismatch',
  expired_material: 'Expired Material',
  short_shelf_life: 'Short Shelf Life',
  other: 'Other',
}

export type QualityInspectionStatus =
  | 'pending'
  | 'in_progress'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'accepted_under_deviation'
  | 'hold'
  | 'cancelled'

export const QUALITY_INSPECTION_STATUSES: readonly QualityInspectionStatus[] = [
  'pending',
  'in_progress',
  'accepted',
  'partially_accepted',
  'rejected',
  'accepted_under_deviation',
  'hold',
  'cancelled',
] as const

export const QUALITY_INSPECTION_STATUS_LABELS: Record<QualityInspectionStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  rejected: 'Rejected',
  accepted_under_deviation: 'Accepted Under Deviation',
  hold: 'Hold',
  cancelled: 'Cancelled',
}

/** Final inspection disposition shown on QI header / GRN post gate. */
export type QualityInspectionResult =
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'accepted_under_deviation'
  | 'hold'

export const QUALITY_INSPECTION_RESULT_LABELS: Record<QualityInspectionResult, string> = {
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  rejected: 'Rejected',
  accepted_under_deviation: 'Accepted Under Deviation',
  hold: 'Hold',
}

export type QualityInspectionParameterResult = 'pass' | 'fail' | 'na'

export type GrnLineInspectionStatus =
  | 'not_required'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'accepted'
  | 'rejected'
  | 'hold'

export const GRN_LINE_INSPECTION_STATUS_LABELS: Record<GrnLineInspectionStatus, string> = {
  not_required: 'Not Required',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  hold: 'Hold',
}

export type VendorQuotationDomainStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'selected'
  | 'rejected'
  | 'expired'

export const VENDOR_QUOTATION_DOMAIN_STATUS_LABELS: Record<VendorQuotationDomainStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  selected: 'Selected',
  rejected: 'Rejected',
  expired: 'Expired',
}

export type QuotationComplianceStatus =
  | 'compliant'
  | 'partial'
  | 'non_compliant'
  | 'not_assessed'

export const QUOTATION_COMPLIANCE_STATUS_LABELS: Record<QuotationComplianceStatus, string> = {
  compliant: 'Compliant',
  partial: 'Partial',
  non_compliant: 'Non-compliant',
  not_assessed: 'Not assessed',
}

export type PurchaseApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'sent_back'

export const PURCHASE_APPROVAL_STATUS_LABELS: Record<PurchaseApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  sent_back: 'Sent Back',
}

export type RfqVendorInviteStatus =
  | 'invited'
  | 'sent'
  | 'quoted'
  | 'declined'
  | 'no_response'

export const RFQ_VENDOR_INVITE_STATUS_LABELS: Record<RfqVendorInviteStatus, string> = {
  invited: 'Not Sent',
  sent: 'Sent',
  quoted: 'Responded',
  declined: 'Declined',
  no_response: 'No Response',
}

export type ApprovalHistoryAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled'
  | 'released'
  | 'posted'
  | 'sent'
  | 'revised'
  | 'closed'
  | 'reopened'

/* -------------------------------------------------------------------------- */
/* Shared commercial / audit fragments                                        */
/* -------------------------------------------------------------------------- */

export interface PurchaseMoneyTotals {
  currency: IndianCurrencyCode
  subtotal: number
  discount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  freight: number
  otherCharges: number
  roundOff: number
  totalAmount: number
}

export interface PurchaseAuditFields {
  createdBy: string
  createdAt: IsoDateTime
  updatedBy: string | null
  updatedAt: IsoDateTime | null
  remarks: string
  attachmentIds: string[]
}

export interface PurchasePartyRef {
  id: string
  code: string
  name: string
}

export interface PurchaseLocationRef {
  id: string
  code: string
  name: string
  state: string
  city: string
}

/* -------------------------------------------------------------------------- */
/* 17–20 Masters & supporting entities                                        */
/* -------------------------------------------------------------------------- */

/** Purchase-scoped vendor snapshot (service layer). Distinct from masters `Vendor`. */
export interface Vendor {
  id: string
  vendorCode: string
  vendorName: string
  vendorType: 'manufacturer' | 'trader' | 'job_work' | 'service'
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  city: string
  state: string
  stateCode: string
  pincode: string
  gstin: string
  pan: string
  /** true = supply from outside company GST state (IGST). */
  isInterstate: boolean
  paymentTerms: string
  deliveryTerms: string
  currency: IndianCurrencyCode
  leadTimeDays: number
  rating: number
  /** Historical quality score 0–100 (comparison). */
  qualityScore: number
  /** Historical on-time delivery score 0–100 (comparison). */
  deliveryScore: number
  isActive: boolean
  remarks: string
  createdBy: string
  createdAt: IsoDateTime
  updatedBy: string | null
  updatedAt: IsoDateTime | null
}

export interface PurchaseItem {
  id: string
  itemCode: string
  itemName: string
  category: PurchaseItemCategory
  /** Item Master engineering product type (source of truth for PR Product Type UI). */
  productType?: EngineeringProductType | null
  description: string
  /** Master UOM UUID — required by purchase APIs. */
  uomId?: string | null
  uom: string
  hsnCode: string
  /** Service Accounting Code — used for job work / services. */
  sacCode: string | null
  gstRatePct: number
  standardRate: number
  reorderLevel: number
  preferredVendorId: string | null
  isStockable: boolean
  qcRequired: boolean
  /** Batch / lot tracking required on GRN. */
  batchControlled: boolean
  /** Serial number required on GRN. */
  serialControlled: boolean
  /** Expiry date required on GRN. */
  expiryControlled: boolean
  isActive: boolean
  remarks: string
  createdBy: string
  createdAt: IsoDateTime
  updatedBy: string | null
  updatedAt: IsoDateTime | null
}

export interface Attachment {
  id: string
  entityType: PurchaseDocumentKind | 'vendor' | 'purchase_item' | 'quality_inspection'
  entityId: string
  fileName: string
  fileSize: number
  mimeType: string
  /** Demo / relative path — replace with storage URL in API mode. */
  url: string
  uploadedBy: string
  uploadedAt: IsoDateTime
  remarks: string
}

export interface ApprovalHistory {
  id: string
  documentType: PurchaseDocumentKind
  documentId: string
  documentNumber: string
  action: ApprovalHistoryAction
  actorId: string
  actorName: string
  fromStatus: string
  toStatus: string
  remarks: string
  actedAt: IsoDateTime
}

export type PurchaseApprovalRole =
  | 'department_head'
  | 'purchase_head'
  | 'finance_head'
  | 'management'

export const PURCHASE_APPROVAL_ROLE_LABELS: Record<PurchaseApprovalRole, string> = {
  department_head: 'Department Head',
  purchase_head: 'Purchase Head',
  finance_head: 'Finance Head',
  management: 'Management',
}

export const PURCHASE_APPROVAL_ROLES: readonly PurchaseApprovalRole[] = [
  'department_head',
  'purchase_head',
  'finance_head',
  'management',
] as const

/** Amount-band rule in Purchase Setup — amounts in INR (document total). */
export interface PurchaseApprovalMatrixTier {
  id: string
  /** Inclusive lower bound (INR). */
  minAmount: number
  /** Inclusive upper bound; `null` = no upper limit. */
  maxAmount: number | null
  requiredRoles: PurchaseApprovalRole[]
  sortOrder: number
  isActive: boolean
  label: string
  /**
   * Documents this tier applies to (setup UI / future API).
   * Amount resolver currently matches any active amount band.
   */
  documentType?: 'all' | PurchaseApprovalDocumentType
}

export interface PurchaseNumberSeriesConfig {
  prefix: string
  nextNumber: number
  /** Zero-pad width for the numeric part (e.g. 4 → PR-0001). */
  padLength: number
}

export interface PurchaseSetupGeneral {
  defaultPlantId: string
  defaultWarehouseId: string
  defaultBuyerId: string
  defaultCurrency: IndianCurrencyCode
  /** Display label / name from CRM payment-terms master. */
  defaultPaymentTerms: string
  /** CRM payment-terms master code (API mode). */
  defaultPaymentTermCode: string
  defaultDeliveryTerms: string
  allowDirectPo: boolean
  requirePrBeforePo: boolean
  /** When > 0, RFQ is required at or above this INR amount. `0` = off. */
  requireRfqAboveAmountInr: number
  minimumRfqVendorCount: number
  requireQuotationComparison: boolean
  allowOverReceipt: boolean
  /** Percent over ordered qty allowed on GRN when over-receipt is enabled. */
  overReceiptTolerancePct: number
  allowShortClose: boolean
  requirePoWarehouse: boolean
  requireExpectedDeliveryDate: boolean
  requirePaymentTerms: boolean
}

export interface PurchaseSetupNumberSeries {
  purchaseRequisition: PurchaseNumberSeriesConfig
  rfq: PurchaseNumberSeriesConfig
  vendorQuotation: PurchaseNumberSeriesConfig
  purchaseOrder: PurchaseNumberSeriesConfig
  grn: PurchaseNumberSeriesConfig
  qualityInspection: PurchaseNumberSeriesConfig
  purchaseInvoice: PurchaseNumberSeriesConfig
  purchaseReturn: PurchaseNumberSeriesConfig
}

export type PurchaseGstRoundOffRule = 'none' | 'nearest_rupee' | 'nearest_paisa'

export interface PurchaseSetupTax {
  /** Default GST split when vendor is intra-state. */
  defaultGstScheme: PurchaseGstScheme
  /** Company place-of-supply state name (demo). */
  placeOfSupplyState: string
  /** GST state code, e.g. 27 for Maharashtra. */
  placeOfSupplyStateCode: string
  /** Default reverse-charge application on eligible invoices. */
  reverseChargeDefault: boolean
  tcsEnabled: boolean
  tdsEnabled: boolean
  roundOffRule: PurchaseGstRoundOffRule
}

/** Three-way match tolerances + flags for purchase invoices (Purchase Setup). */
export interface PurchaseInvoiceMatchTolerances {
  requirePoMatch: boolean
  requireGrnMatch: boolean
  /** Allowed invoice qty vs PO/GRN qty variance as % of reference qty. */
  quantityTolerancePct: number
  /** Allowed invoice rate vs PO rate variance as %. */
  rateTolerancePct: number
  /** Absolute INR tolerance on line / document totals. */
  amountToleranceInr: number
  /** Percent amount tolerance (alongside absolute INR). */
  amountTolerancePct: number
  /** Tax amount absolute INR tolerance (used when taxTolerancePct is 0 or alongside %). */
  taxToleranceInr: number
  /** Tax rate / tax amount % tolerance vs PO. */
  taxTolerancePct: number
  allowAuthorizedOverride: boolean
}

export interface PurchaseSetupReceiving {
  requireGateEntry: boolean
  requireVendorChallan: boolean
  requireVehicleNumber: boolean
  requireBatch: boolean
  requireSerial: boolean
  requireExpiry: boolean
  autoCreateInspection: boolean
  /** MasterLocation under the default warehouse. */
  defaultReceivingLocationId: string
  duplicateChallanPolicy: 'BLOCK' | 'WARN' | 'ALLOW'
}

export interface PurchaseSetupQuality {
  /** Item categories that require quality inspection on receipt. */
  inspectionRequiredCategories: PurchaseItemCategory[]
  allowAcceptanceUnderDeviation: boolean
  deviationApproverRole: PurchaseApprovalRole
  allowRejectedStockInQuarantine: boolean
  /** MasterLocation under the default warehouse (quality hold). */
  defaultQualityHoldLocationId: string
  /** MasterLocation under the default warehouse (rejected). */
  defaultRejectedLocationId: string
  /** MasterLocation under the default warehouse (vendor return). */
  defaultVendorReturnLocationId: string
}

/** Defaults applied when creating a new Purchase Requisition. */
export interface PurchaseSetupRequisition {
  /**
   * When true, new PRs default to Direct Purchase Planning (`rfqRequired: false`).
   * When false, RFQ is required after approval.
   */
  skipRfq: boolean
  /** Warehouse pre-selected on new PRs; empty falls back to General → default warehouse. */
  defaultWarehouseId: string
  /**
   * Auto-complete Reference Number from linked source docs.
   * Reserved — not wired yet.
   */
  autoCompleteRef: boolean
}

export type PurchasePrintPaperSize = 'A4' | 'Letter'
export type PurchasePrintOrientation = 'portrait' | 'landscape'

export interface PurchaseSetupPrint {
  companyName: string
  /** Print logo URL (empty when unset). Persisted by the API as `print.logoUrl`. */
  logoUrl: string
  showTermsOnPo: boolean
  showTermsOnGrn: boolean
  showTermsOnInvoice: boolean
  defaultCopies: number
  paperSize: PurchasePrintPaperSize
  orientation: PurchasePrintOrientation
}

export interface PurchaseNotificationChannelFlags {
  inApp: boolean
  email: boolean
}

export interface PurchaseSetupNotifications {
  /** From API: ON_HOLD means notifications are read-only and never persisted. */
  status?: 'ON_HOLD'
  /** From API: explanation shown on the Notifications tab when on hold. */
  message?: string
  prPendingApproval: PurchaseNotificationChannelFlags
  rfqResponseDue: PurchaseNotificationChannelFlags
  poDeliveryApproaching: PurchaseNotificationChannelFlags
  poOverdue: PurchaseNotificationChannelFlags
  grnPendingInspection: PurchaseNotificationChannelFlags
  invoiceMismatch: PurchaseNotificationChannelFlags
  invoicePendingApproval: PurchaseNotificationChannelFlags
}

/** Event keys of `PurchaseSetupNotifications` (excludes API status/message metadata). */
export type PurchaseNotificationEventKey = Exclude<
  keyof PurchaseSetupNotifications,
  'status' | 'message'
>

export const PURCHASE_NOTIFICATION_EVENT_KEYS: readonly PurchaseNotificationEventKey[] = [
  'prPendingApproval',
  'rfqResponseDue',
  'poDeliveryApproaching',
  'poOverdue',
  'grnPendingInspection',
  'invoiceMismatch',
  'invoicePendingApproval',
]

/**
 * Maker-checker override for PR/PO approvals.
 * NEVER — nobody approves own documents; PERMISSION_ONLY — only users holding
 * purchase.approvals.self_approve; EVERYONE — no restriction (not recommended).
 */
export type PurchaseSelfApprovalPolicy = 'NEVER' | 'PERMISSION_ONLY' | 'EVERYONE'

export interface PurchaseSetup {
  /** Present when loaded from backend; null for server defaults / demo. */
  id: string | null
  isConfigured: boolean
  version: number
  /** Self-approval (maker-checker bypass) policy for PR/PO approvals. */
  selfApprovalPolicy: PurchaseSelfApprovalPolicy
  general: PurchaseSetupGeneral
  numberSeries: PurchaseSetupNumberSeries
  /** Amount-band matrix consumed by `purchaseApprovalMatrix` / approvals service. */
  approvalMatrix: PurchaseApprovalMatrixTier[]
  /** @deprecated Demo-only budget figure on approval review; not persisted via API. */
  availableBudgetPlaceholderInr?: number
  tax: PurchaseSetupTax
  /** Three-way matching tolerances for purchase invoices (read by invoice module). */
  invoiceMatchTolerances: PurchaseInvoiceMatchTolerances
  /**
   * When true, Direct Invoice create is allowed for all demo users.
   * When false, only demo admins (`role === 'admin'`) may create direct invoices.
   */
  allowDirectInvoice: boolean
  receiving: PurchaseSetupReceiving
  quality: PurchaseSetupQuality
  /** Defaults for Purchase Requisition create (`/purchase/requisitions/new`). */
  requisition: PurchaseSetupRequisition
  print: PurchaseSetupPrint
  notifications: PurchaseSetupNotifications
  updatedAt: IsoDateTime
  updatedBy: string
}

export type PurchaseSetupTabId =
  | 'general'
  | 'requisition'
  | 'number_series'
  | 'approval'
  | 'tax'
  | 'invoice_matching'
  | 'receiving'
  | 'quality'
  | 'print'
  | 'notifications'

export const PURCHASE_SETUP_TAB_LABELS: Record<PurchaseSetupTabId, string> = {
  general: 'General Setup',
  requisition: 'Requisition Setup',
  number_series: 'Number Series',
  approval: 'Approval Setup',
  tax: 'Tax Setup',
  invoice_matching: 'Invoice Matching',
  receiving: 'Receiving Setup',
  quality: 'Quality Setup',
  print: 'Print Setup',
  notifications: 'Notifications',
}

export const PURCHASE_ITEM_CATEGORY_LABELS: Record<PurchaseItemCategory, string> = {
  raw_material: 'Raw Material',
  component: 'Component',
  consumable: 'Consumable',
  packing_material: 'Packing Material',
  maintenance: 'Maintenance',
  job_work: 'Job Work',
}

export const PURCHASE_ITEM_CATEGORIES: readonly PurchaseItemCategory[] = [
  'raw_material',
  'component',
  'consumable',
  'packing_material',
  'maintenance',
  'job_work',
] as const

export interface PurchaseApproval {
  id: string
  documentType: Extract<
    PurchaseDocumentKind,
    'purchase_requisition' | 'purchase_order' | 'purchase_invoice' | 'purchase_return'
  >
  documentId: string
  documentNumber: string
  level: number
  status: PurchaseApprovalStatus
  requesterId: string
  requesterName: string
  approverId: string
  approverName: string
  approverRole: PurchaseApprovalRole
  delegatedFromId: string | null
  delegatedFromName: string | null
  requestedAt: IsoDateTime
  respondedAt: IsoDateTime | null
  remarks: string
}

export type PurchaseApprovalQueueTab =
  | 'pending_mine'
  | 'approved_by_me'
  | 'rejected_by_me'
  | 'all_history'

export const PURCHASE_APPROVAL_QUEUE_TAB_LABELS: Record<PurchaseApprovalQueueTab, string> = {
  pending_mine: 'Pending My Approval',
  approved_by_me: 'Approved by Me',
  rejected_by_me: 'Rejected by Me',
  all_history: 'All Approval History',
}

export type PurchaseApprovalDocumentType = Extract<
  PurchaseDocumentKind,
  'purchase_requisition' | 'purchase_order'
>

export const PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS: Record<PurchaseApprovalDocumentType, string> = {
  purchase_requisition: 'Purchase Requisition',
  purchase_order: 'Purchase Order',
}

export type PurchaseApprovalAgeingBucket = '' | '0_3' | '4_7' | '8_15' | '16_plus'

export const PURCHASE_APPROVAL_AGEING_LABELS: Record<Exclude<PurchaseApprovalAgeingBucket, ''>, string> = {
  '0_3': '0–3 days',
  '4_7': '4–7 days',
  '8_15': '8–15 days',
  '16_plus': '16+ days',
}

export interface PurchaseApprovalQueueFilters {
  documentType?: PurchaseApprovalDocumentType | ''
  documentNumber?: string
  requester?: string
  department?: string
  locationId?: string
  amountMin?: number | null
  amountMax?: number | null
  submittedFrom?: string
  submittedTo?: string
  priority?: PurchaseRequisitionPriority | ''
  ageing?: PurchaseApprovalAgeingBucket
}

export interface PurchaseApprovalQueueRow {
  approvalId: string
  documentType: PurchaseApprovalDocumentType
  documentTypeLabel: string
  documentId: string
  documentNumber: string
  documentDate: IsoDate
  requestedBy: string
  requesterId: string
  department: string
  locationId: string
  locationName: string
  amount: number
  priority: PurchaseRequisitionPriority
  priorityLabel: string
  submittedDate: IsoDateTime
  pendingSinceDays: number
  approvalLevel: number
  approvalLevelLabel: string
  chainLength: number
  status: PurchaseApprovalStatus
  statusLabel: string
  approverId: string
  approverName: string
  approverRole: PurchaseApprovalRole
  approverRoleLabel: string
  /** True when the current session user may act on this pending row. */
  canAct: boolean
}

export interface PurchaseApprovalReviewLine {
  lineNo: number
  itemCode: string
  itemName: string
  quantity: number
  uom: string
  rate: number
  amount: number
}

export interface PurchaseApprovalReviewDetail {
  row: PurchaseApprovalQueueRow
  purpose: string
  requesterRemarks: string
  expectedDeliveryDate: string | null
  lines: PurchaseApprovalReviewLine[]
  availableBudgetPlaceholderInr: number
  previousApprovals: ApprovalHistory[]
  attachments: Attachment[]
  chainRoles: PurchaseApprovalRole[]
  eligibleApprovers: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
}

/* -------------------------------------------------------------------------- */
/* 1–2 Purchase Requisition                                                   */
/* -------------------------------------------------------------------------- */

export type PurchaseRequisitionSource =
  | 'manual'
  | 'mrp'
  | 'work_order'
  | 'reorder'
  | 'maintenance'
  | 'project'
  | 'sales_order'

export const PURCHASE_REQUISITION_SOURCE_LABELS: Record<PurchaseRequisitionSource, string> = {
  manual: 'Manual',
  mrp: 'Material Planning',
  work_order: 'Production Order',
  reorder: 'Minimum Stock',
  maintenance: 'Maintenance',
  project: 'Project',
  sales_order: 'Sales Order',
}

export type PurchaseRequisitionPriority = 'low' | 'normal' | 'high' | 'urgent'

export const PURCHASE_REQUISITION_PRIORITY_LABELS: Record<PurchaseRequisitionPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export type PurchaseRequisitionType =
  | 'material'
  | 'service'
  | 'asset'
  | 'job_work'
  | 'subcontracting'
  | 'maintenance'

export const PURCHASE_REQUISITION_TYPE_LABELS: Record<PurchaseRequisitionType, string> = {
  material: 'Material',
  service: 'Service',
  asset: 'Asset',
  job_work: 'Job Work',
  subcontracting: 'Subcontracting',
  maintenance: 'Maintenance',
}

export type PurchaseLineItemType =
  | 'inventory'
  | 'non_inventory'
  | 'service'
  | 'fixed_asset'
  | 'charge'

export const PURCHASE_LINE_ITEM_TYPE_LABELS: Record<PurchaseLineItemType, string> = {
  inventory: 'Inventory Item',
  non_inventory: 'Non-Inventory Item',
  service: 'Service',
  fixed_asset: 'Fixed Asset',
  charge: 'Charge',
}

export type PurchaseRequisitionAttachmentKind =
  | 'technical_specification'
  | 'drawing'
  | 'vendor_reference'
  | 'requirement_document'
  | 'image'
  | 'other'

export const PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS: Record<
  PurchaseRequisitionAttachmentKind,
  string
> = {
  technical_specification: 'Technical specification',
  drawing: 'Drawing',
  vendor_reference: 'Vendor reference',
  requirement_document: 'Requirement document',
  image: 'Image',
  other: 'Other attachment',
}

export interface PurchaseRequisitionAttachmentPlaceholder {
  id: string
  kind: PurchaseRequisitionAttachmentKind
  fileName: string
  remarks: string
}

export type PurchaseRequisitionApprovalStatus =
  | 'not_submitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'n_a'

export const PURCHASE_REQUISITION_APPROVAL_STATUS_LABELS: Record<
  PurchaseRequisitionApprovalStatus,
  string
> = {
  not_submitted: 'Not Submitted',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  n_a: 'N/A',
}

/** List/detail “Status” column — approval-stage view derived from document lifecycle. */
export function purchaseRequisitionApprovalStatusFromDocument(
  status: PurchaseRequisitionStatus,
): PurchaseRequisitionApprovalStatus {
  switch (status) {
    case 'draft':
      return 'not_submitted'
    case 'pending_approval':
      return 'pending'
    case 'approved':
    case 'converted_to_rfq':
    case 'converted_to_po':
    case 'closed':
      return 'approved'
    case 'rejected':
      return 'rejected'
    default:
      return 'n_a'
  }
}

export function purchaseRequisitionApprovalStatusLabel(
  status: PurchaseRequisitionStatus,
): string {
  return PURCHASE_REQUISITION_APPROVAL_STATUS_LABELS[
    purchaseRequisitionApprovalStatusFromDocument(status)
  ]
}

export interface PurchaseRequisitionLine {
  id: string
  lineNo: number
  itemType: PurchaseLineItemType
  itemId: string
  itemCode: string
  itemName: string
  specification: string
  category: PurchaseItemCategory
  /** Master UOM UUID — required by purchase APIs when line has an item/qty. */
  uomId?: string | null
  uom: string
  hsnCode: string
  sacCode: string | null
  quantity: number
  estimatedRate: number
  amount: number
  currentStock: number
  openPoQty: number
  preferredVendorId: string | null
  preferredVendorName: string | null
  /** Vendor code / number shown on the Complete worksheet. */
  vendorNumber: string
  /** Line need-by date on the Complete worksheet. */
  requiredDate: IsoDate
  /** Planned / actual order date for this line (worksheet). */
  orderDate: IsoDate
  /** Requesting customer / project customer (worksheet). */
  customerName: string
  /**
   * Delivery / receiving location for this line.
   * Backend must persist `locationId` on every PR line (not header-only). Not shown on the grid.
   */
  locationId: string
  locationName: string
  /** Warehouse bin / storage location code. */
  binCode: string
  /**
   * Linked PO after Planning→PO or RFQ→PO (read-only track record on the PR line).
   */
  purchaseOrderId: string | null
  /**
   * PO document number snapshot — filled when a PO is created from this PR line (view-only).
   */
  purchaseOrderNumber: string
  /**
   * Linked vendor quotation / RFQ quote number after sourcing (future — view-only).
   */
  purchaseQuoteNumber: string
  purpose: string
  remarks: string
  attachmentNote: string
}

export interface PurchaseRequisition extends PurchaseMoneyTotals, PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: PurchaseRequisitionStatus
  location: PurchaseLocationRef
  department: string
  requester: PurchasePartyRef
  approver: PurchasePartyRef | null
  expectedDeliveryDate: IsoDate | null
  paymentTerms: string
  deliveryTerms: string
  vendor: PurchasePartyRef | null
  source: PurchaseRequisitionSource
  priority: PurchaseRequisitionPriority
  requisitionType: PurchaseRequisitionType
  costCentre: string
  project: string
  productionOrderNo: string
  maintenanceOrderNo: string
  referenceNumber: string
  purpose: string | null
  lines: PurchaseRequisitionLine[]
  attachmentPlaceholders: PurchaseRequisitionAttachmentPlaceholder[]
  approvalIds: string[]
  /**
   * When true, approved PR should go through RFQ / vendor quotation.
   * When false, approved PR is ready for direct Purchase Order creation.
   */
  rfqRequired: boolean
  convertedRfqId: string | null
  convertedPoId: string | null
  /** Soft-estimated tax on subtotal (demo GST %). */
  estimatedTaxPct: number
  estimatedTaxAmount: number
}

/* -------------------------------------------------------------------------- */
/* Purchase Planning Sheet (direct PO path — RFQ not required)                */
/* -------------------------------------------------------------------------- */

export const PURCHASE_PLANNING_PURCHASE_TYPES = [
  'direct_purchase',
  'repeat_purchase',
  'rate_contract',
  'emergency_purchase',
  'local_purchase',
  'import_purchase',
] as const
export type PurchasePlanningPurchaseType = (typeof PURCHASE_PLANNING_PURCHASE_TYPES)[number]

export const PURCHASE_PLANNING_PURCHASE_TYPE_LABELS: Record<PurchasePlanningPurchaseType, string> = {
  direct_purchase: 'Direct Purchase',
  repeat_purchase: 'Repeat Purchase',
  rate_contract: 'Rate Contract',
  emergency_purchase: 'Emergency Purchase',
  local_purchase: 'Local Purchase',
  import_purchase: 'Import Purchase',
}

export const PURCHASE_PLANNING_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type PurchasePlanningPriority = (typeof PURCHASE_PLANNING_PRIORITIES)[number]

export const PURCHASE_PLANNING_PRIORITY_LABELS: Record<PurchasePlanningPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const PURCHASE_PLANNING_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'vendor_selected',
  'po_pending',
  'po_created',
  'partially_ordered',
  'completed',
  'cancelled',
] as const
export type PurchasePlanningStatus = (typeof PURCHASE_PLANNING_STATUSES)[number]

export const PURCHASE_PLANNING_STATUS_LABELS: Record<PurchasePlanningStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  vendor_selected: 'Vendor Selected',
  po_pending: 'PO Pending',
  po_created: 'PO Created',
  partially_ordered: 'Partially Ordered',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/**
 * One row per PR line when `rfqRequired = false`.
 * RFQ-required PR lines must never appear here.
 */
export interface PurchasePlanningSheetRow {
  id: string
  planningNumber: string
  planningDate: IsoDate
  purchaseRequisitionId: string
  purchaseRequisitionNumber: string
  purchaseRequisitionLineId: string
  department: string
  requestedById: string
  requestedByName: string
  itemId: string
  itemCode: string
  itemName: string
  specification: string
  /** Product / item type shown as Type column. */
  itemCategory: PurchaseItemCategory
  requiredQuantity: number
  uom: string
  requiredByDate: IsoDate
  currentStock: number
  openPoQuantity: number
  /** Required Qty − Current Stock − Open PO Qty (floored at 0). */
  netPurchaseQuantity: number
  preferredVendorId: string | null
  preferredVendorName: string | null
  preferredVendorCode: string | null
  lastPurchaseVendorId: string | null
  lastPurchaseVendorName: string | null
  lastPurchaseRate: number | null
  expectedRate: number
  /** Optional negotiated rate after vendor discussion (edit drawer). */
  negotiatedRate: number | null
  estimatedAmount: number
  purchaseType: PurchasePlanningPurchaseType
  priority: PurchasePlanningPriority
  buyerId: string
  buyerName: string
  status: PurchasePlanningStatus
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  /** Planned order date (worksheet). */
  orderDate: IsoDate
  /** Action Message accept checkbox. */
  actionMessage: boolean
  remarks: string
  createdBy: string
  createdAt: IsoDateTime
  updatedBy: string | null
  updatedAt: IsoDateTime | null
}

export type PurchasePlanningSheetInput = Partial<
  Pick<
    PurchasePlanningSheetRow,
    | 'specification'
    | 'requiredQuantity'
    | 'requiredByDate'
    | 'preferredVendorId'
    | 'expectedRate'
    | 'negotiatedRate'
    | 'purchaseType'
    | 'priority'
    | 'buyerId'
    | 'buyerName'
    | 'remarks'
    | 'status'
    | 'orderDate'
    | 'actionMessage'
    | 'itemCategory'
  >
>

/** Enriched list row for the PR register (includes linked doc numbers). */
export interface PurchaseRequisitionListRow extends PurchaseRequisition {
  requiredBy: IsoDate | null
  itemCount: number
  estimatedValue: number
  approvalStatus: PurchaseRequisitionApprovalStatus
  approvalStatusLabel: string
  sourceLabel: string
  priorityLabel: string
  statusLabel: string
  convertedRfqNumber: string | null
  convertedPoNumber: string | null
}

/* -------------------------------------------------------------------------- */
/* 4–8 RFQ / vendor quotes / comparison                                       */
/* -------------------------------------------------------------------------- */

export interface RFQVendor {
  id: string
  rfqId: string
  vendorId: string
  vendorCode: string
  vendorName: string
  gstin: string
  state: string
  isInterstate: boolean
  status: RfqVendorInviteStatus
  sentAt: IsoDateTime | null
  respondedAt: IsoDateTime | null
  contactPerson: string
  contactEmail: string
  contactPhone: string
  vendorRating: number
  lastPurchasePrice: number | null
  /** Included on the RFQ invite (editor checkbox). */
  selected: boolean
  remarks: string
}

export interface RfqLine {
  id: string
  lineNo: number
  purchaseRequisitionId: string | null
  purchaseRequisitionNumber: string | null
  prLineId: string | null
  itemId: string
  itemCode: string
  itemName: string
  specification: string
  hsnCode: string
  sacCode: string | null
  quantity: number
  uom: string
  requiredDate: IsoDate
  targetPrice: number
  amount: number
  remarks: string
}

export interface RequestForQuotation extends PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: RfqDomainStatus
  /** Primary / first linked PR (legacy convenience). */
  purchaseRequisitionId: string | null
  purchaseRequisitionNumber: string | null
  /** One or many approved PRs combined into this RFQ. */
  purchaseRequisitionIds: string[]
  purchaseRequisitionNumbers: string[]
  buyer: PurchasePartyRef
  location: PurchaseLocationRef
  purchaseLocation: PurchaseLocationRef
  deliveryLocation: PurchaseLocationRef
  department: string
  requester: PurchasePartyRef
  currency: IndianCurrencyCode
  paymentTerms: string
  deliveryTerms: string
  freightTerms: string
  inspectionRequirement: string
  technicalContact: string
  commercialContact: string
  expectedDeliveryDate: IsoDate | null
  /** Enquiry due date. */
  bidDueDate: IsoDate
  vendors: RFQVendor[]
  lines: RfqLine[]
  /** @deprecated Prefer `lines` — kept for older consumers. */
  lineItemIds: string[]
  /** @deprecated Prefer `lines`. */
  itemSummaries: Array<{
    itemId: string
    itemCode: string
    itemName: string
    quantity: number
    uom: string
  }>
  estimatedValue: number
  selectedVendorId: string | null
  comparisonId: string | null
  sentAt: IsoDateTime | null
}

export interface RfqListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  bidDueDate: IsoDate
  buyerName: string
  locationName: string
  vendorCount: number
  itemCount: number
  estimatedValue: number
  responsesReceived: number
  status: RfqDomainStatus
  statusLabel: string
  purchaseRequisitionNumbers: string[]
}

export interface VendorQuotationLine {
  id: string
  lineNo: number
  rfqLineId: string | null
  itemId: string
  itemCode: string
  itemName: string
  description: string
  uom: string
  hsnCode: string
  quantity: number
  rate: number
  discountPct: number
  discountAmount: number
  gstRatePct: number
  taxAmount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  freightAllocation: number
  otherCharges: number
  landedCost: number
  lineTotal: number
  leadTimeDays: number
  promisedDeliveryDate: IsoDate | null
  technicalCompliance: QuotationComplianceStatus
  commercialCompliance: QuotationComplianceStatus
  makeBrand: string
  remarks: string
}

export interface VendorQuotation extends PurchaseMoneyTotals, PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: VendorQuotationDomainStatus
  rfqId: string
  rfqNumber: string
  vendor: PurchasePartyRef & { gstin: string; state: string; isInterstate: boolean }
  vendorReferenceNumber: string
  currency: IndianCurrencyCode
  paymentTerms: string
  deliveryTerms: string
  freightTerms: string
  warranty: string
  packingCharges: number
  validTill: IsoDate
  expectedDeliveryDate: IsoDate | null
  gstScheme: PurchaseGstScheme
  lines: VendorQuotationLine[]
}

export type QuotationComparisonMethod = 'landed_cost' | 'basic_price' | 'weighted_score'

export const QUOTATION_COMPARISON_METHOD_LABELS: Record<QuotationComparisonMethod, string> = {
  landed_cost: 'Lowest landed cost',
  basic_price: 'Lowest basic price',
  weighted_score: 'Weighted score',
}

export type QuotationComparisonCriterion =
  | 'basic_price'
  | 'discount'
  | 'freight'
  | 'taxes'
  | 'landed_cost'
  | 'payment_terms'
  | 'delivery_time'
  | 'warranty'
  | 'vendor_rating'
  | 'previous_quality_score'
  | 'previous_delivery_score'
  | 'technical_compliance'
  | 'commercial_compliance'

export const QUOTATION_COMPARISON_CRITERION_LABELS: Record<QuotationComparisonCriterion, string> = {
  basic_price: 'Basic price',
  discount: 'Discount',
  freight: 'Freight',
  taxes: 'Taxes',
  landed_cost: 'Landed cost',
  payment_terms: 'Payment terms',
  delivery_time: 'Delivery time',
  warranty: 'Warranty',
  vendor_rating: 'Vendor rating',
  previous_quality_score: 'Previous quality score',
  previous_delivery_score: 'Previous delivery score',
  technical_compliance: 'Technical compliance',
  commercial_compliance: 'Commercial compliance',
}

export type QuotationSelectionMode = 'all_lines' | 'per_line'

export type QuotationRecommendationStatus = 'none' | 'recommended' | 'approved'

export interface QuotationComparisonQuoteCell {
  vendorId: string
  vendorName: string
  vendorQuotationId: string
  vendorQuotationNumber: string
  rate: number
  discountPct: number
  discountAmount: number
  freight: number
  taxAmount: number
  landedRate: number
  landedAmount: number
  leadTimeDays: number
  lineTotal: number
  paymentTerms: string
  warranty: string
  vendorRating: number
  previousQualityScore: number
  previousDeliveryScore: number
  technicalCompliance: QuotationComplianceStatus
  commercialCompliance: QuotationComplianceStatus
  isLowestBasic: boolean
  isLowestLanded: boolean
  isBestDelivery: boolean
  isPreferred: boolean
  isNonCompliant: boolean
  hasMissingValues: boolean
}

export interface QuotationComparisonRow {
  itemId: string
  itemCode: string
  itemName: string
  quantity: number
  uom: string
  rfqLineId: string | null
  quotes: QuotationComparisonQuoteCell[]
  /** Selected vendor for this line (per-line mode). */
  selectedVendorId: string | null
  recommendedVendorId: string | null
}

export interface QuotationComparison extends PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: 'draft' | 'completed' | 'cancelled'
  rfqId: string
  rfqNumber: string
  comparedBy: PurchasePartyRef
  method: QuotationComparisonMethod
  criteria: QuotationComparisonCriterion[]
  selectedVendorIds: string[]
  selectionMode: QuotationSelectionMode
  /** Required when selection is not the lowest-cost vendor. */
  selectionReason: string
  recommendationStatus: QuotationRecommendationStatus
  recommendedVendorId: string | null
  recommendedVendorName: string | null
  approvedBy: string | null
  approvedAt: IsoDateTime | null
  currency: IndianCurrencyCode
  rows: QuotationComparisonRow[]
}

export interface VendorQuotationListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  rfqId: string
  rfqNumber: string
  vendorName: string
  vendorCode: string
  vendorReferenceNumber: string
  validTill: IsoDate
  totalAmount: number
  status: VendorQuotationDomainStatus
  statusLabel: string
}

/* -------------------------------------------------------------------------- */
/* 9–10 Purchase Order                                                        */
/* -------------------------------------------------------------------------- */

export interface PurchaseOrderLine {
  id: string
  lineNo: number
  itemType: PurchaseOrderLineItemType
  itemId: string
  itemCode: string
  itemName: string
  description: string
  specification: string
  category: PurchaseItemCategory
  uom: string
  hsnCode: string
  sacCode: string | null
  quantity: number
  rate: number
  discountPct: number
  discountAmount: number
  gstRatePct: number
  taxAmount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  lineTotal: number
  requiredDate: IsoDate
  deliverySchedule: string
  warehouseId: string
  warehouseName: string
  costCentre: string
  project: string
  productionOrder: string
  receivedQty: number
  pendingQty: number
  invoicedQty: number
  lineStatus: PurchaseOrderLineStatus
  /** @deprecated use warehouseId — kept for older callers */
  locationId: string
  locationName: string
  expectedDeliveryDate: IsoDate
  prLineId: string | null
  rfqLineId: string | null
  vendorQuotationLineId: string | null
  remarks: string
}

export interface PurchaseOrderChangeEntry {
  id: string
  revisionNo: number
  changedAt: IsoDateTime
  changedBy: string
  reason: string
  fieldPath: string
  fieldLabel: string
  previousValue: string
  newValue: string
}

export interface PurchaseOrderRevisionSnapshot {
  revisionNo: number
  revisedAt: IsoDateTime
  revisedBy: string
  reason: string
  /** Compact JSON snapshot of key totals + lines for audit. */
  snapshot: string
}

export interface BlanketPurchaseOrderLine {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  uom: string
  maxQuantity: number
  releasedQuantity: number
  rate: number
  remarks: string
}

export interface BlanketPurchaseOrder extends PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: 'draft' | 'active' | 'exhausted' | 'closed' | 'cancelled'
  vendor: PurchasePartyRef & { gstin: string; state: string; isInterstate: boolean }
  validFrom: IsoDate
  validTo: IsoDate
  currency: IndianCurrencyCode
  paymentTerms: string
  deliveryTerms: string
  maxValue: number
  releasedValue: number
  lines: BlanketPurchaseOrderLine[]
}

export interface PurchaseOrder extends PurchaseMoneyTotals, PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: PurchaseOrderDomainStatus
  orderType: PurchaseOrderType
  origin: PurchaseOrderOrigin
  revisionNo: number
  buyer: PurchasePartyRef
  location: PurchaseLocationRef
  purchaseLocation: PurchaseLocationRef
  deliveryLocation: PurchaseLocationRef
  department: string
  requester: PurchasePartyRef
  approver: PurchasePartyRef | null
  vendor: PurchasePartyRef & {
    gstin: string
    state: string
    isInterstate: boolean
    address: string
  }
  placeOfSupply: string
  currency: IndianCurrencyCode
  paymentTerms: string
  deliveryTerms: string
  freightTerms: string
  packingTerms: string
  insuranceTerms: string
  warranty: string
  inspectionRequirement: string
  priceBasis: string
  validityDate: IsoDate | null
  expectedDeliveryDate: IsoDate
  gstScheme: PurchaseGstScheme
  purchaseRequisitionId: string | null
  purchaseRequisitionNumber: string | null
  rfqId: string | null
  rfqNumber: string | null
  vendorQuotationId: string | null
  vendorQuotationNumber: string | null
  comparisonId: string | null
  comparisonNumber: string | null
  blanketOrderId: string | null
  blanketOrderNumber: string | null
  /** Line discount total (sum of line discounts). Maps conceptually to "Line Discount". */
  lineDiscount: number
  tradeDiscount: number
  packingCharges: number
  insuranceCharges: number
  tcsAmount: number
  lines: PurchaseOrderLine[]
  termsAndConditions: string
  internalNotes: string
  approvalStatus: PurchaseOrderApprovalStatus
  invoiceStatus: PurchaseOrderInvoiceStatus
  approvalIds: string[]
  changeHistory: PurchaseOrderChangeEntry[]
  revisions: PurchaseOrderRevisionSnapshot[]
  sentToVendorAt: IsoDateTime | null
  releasedAt: IsoDateTime | null
  closedAt: IsoDateTime | null
  cancelledAt: IsoDateTime | null
  /** Server-side rejection reason (API mode). */
  rejectionReason?: string | null
  /** Server-side send-back reason (API mode). */
  sendBackReason?: string | null
  /** Backend-provided action eligibility (API mode). */
  allowedActions?: PurchaseOrderAllowedActions
}

export interface PurchaseOrderListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  vendorName: string
  vendorGstin: string
  locationName: string
  buyerName: string
  currency: IndianCurrencyCode
  expectedDeliveryDate: IsoDate
  basicAmount: number
  taxAmount: number
  totalAmount: number
  receivedPercentage: number
  invoiceStatus: PurchaseOrderInvoiceStatus
  invoiceStatusLabel: string
  approvalStatus: PurchaseOrderApprovalStatus
  approvalStatusLabel: string
  status: PurchaseOrderDomainStatus
  statusLabel: string
  revisionNo: number
  origin: PurchaseOrderOrigin
  orderType: PurchaseOrderType
}

export interface PurchaseOrderLinkedDocuments {
  purchaseRequisition: { id: string; documentNumber: string } | null
  rfq: { id: string; documentNumber: string } | null
  vendorQuotation: { id: string; documentNumber: string } | null
  comparison: { id: string; documentNumber: string } | null
  blanketOrder: { id: string; documentNumber: string } | null
  grns: Array<{ id: string; documentNumber: string; status: string; documentDate: IsoDate }>
  invoices: Array<{ id: string; documentNumber: string; status: string; documentDate: IsoDate }>
  returns: Array<{ id: string; documentNumber: string; status: string; documentDate: IsoDate }>
}

/* -------------------------------------------------------------------------- */
/* 11–13 GRN + Quality                                                        */
/* -------------------------------------------------------------------------- */

export interface GoodsReceiptLine {
  id: string
  lineNo: number
  purchaseOrderLineId: string
  itemId: string
  itemCode: string
  itemName: string
  description: string
  uom: string
  hsnCode: string
  orderedQty: number
  previouslyReceivedQty: number
  pendingQty: number
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  shortQty: number
  excessQty: number
  damagedQty: number
  pendingInspectionQty: number
  rate: number
  taxableAmount: number
  batchNumber: string
  lotNumber: string
  serialNumber: string
  manufacturingDate: IsoDate | null
  expiryDate: IsoDate | null
  warehouseId: string
  warehouseName: string
  bin: string
  locationId: string
  locationName: string
  inspectionStatus: GrnLineInspectionStatus
  allowExcess: boolean
  batchControlled: boolean
  serialControlled: boolean
  expiryControlled: boolean
  qcRequired: boolean
  remarks: string
}

export interface GoodsReceiptNote extends PurchaseMoneyTotals, PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: GrnDomainStatus
  location: PurchaseLocationRef
  department: string
  requester: PurchasePartyRef
  receivedBy: PurchasePartyRef
  vendor: PurchasePartyRef & { gstin: string }
  purchaseOrderId: string
  purchaseOrderNumber: string
  expectedDeliveryDate: IsoDate | null
  currency: IndianCurrencyCode
  paymentTerms: string
  deliveryTerms: string
  vendorChallanNumber: string
  vendorChallanDate: IsoDate | null
  vehicleNo: string | null
  transporterName: string | null
  lrNumber: string | null
  gateEntryNo: string | null
  warehouseId: string
  warehouseName: string
  receivingLocation: string
  /** Alias kept for dashboard / legacy reads — mirrors inspectionRequired. */
  qcRequired: boolean
  inspectionRequired: boolean
  /** Header-level permission to receive above pending qty. */
  allowExcess: boolean
  qualityInspectionId: string | null
  lines: GoodsReceiptLine[]
  postedAt: IsoDateTime | null
  /** Set after mock post — UI confirms inventory updates when backend is connected. */
  inventoryPostDeferred: boolean
}

export interface GrnListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  purchaseOrderId: string
  purchaseOrderNumber: string
  vendorName: string
  vendorCode: string
  warehouseName: string
  gateEntryNo: string | null
  vehicleNo: string | null
  lineCount: number
  totalReceivedQty: number
  totalAcceptedQty: number
  totalRejectedQty: number
  totalAmount: number
  status: GrnDomainStatus
  statusLabel: string
  inspectionRequired: boolean
  qualityInspectionId: string | null
}

export interface QualityInspectionParameter {
  id: string
  parameter: string
  specification: string
  minValue: number | null
  maxValue: number | null
  observedValue: number | null
  unit: string
  result: QualityInspectionParameterResult
  remarks: string
}

export interface QualityInspection extends PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: QualityInspectionStatus
  /** Disposition — null while pending / in progress. */
  result: QualityInspectionResult | null
  goodsReceiptId: string
  goodsReceiptNumber: string
  goodsReceiptLineId: string
  purchaseOrderId: string
  purchaseOrderNumber: string
  vendor: PurchasePartyRef
  location: PurchaseLocationRef
  itemId: string
  itemCode: string
  itemName: string
  batchLotNo: string
  receivedQty: number
  sampleQty: number
  acceptedQty: number
  rejectedQty: number
  inspectionPlan: string
  inspector: PurchasePartyRef
  inspectedAt: IsoDateTime | null
  deviationRequested: boolean
  deviationRemarks: string
  parameters: QualityInspectionParameter[]
}

export interface QualityInspectionListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  goodsReceiptId: string
  goodsReceiptNumber: string
  itemCode: string
  itemName: string
  batchLotNo: string
  receivedQty: number
  sampleQty: number
  inspectorName: string
  status: QualityInspectionStatus
  statusLabel: string
  result: QualityInspectionResult | null
  resultLabel: string | null
}

/* -------------------------------------------------------------------------- */
/* 14–16 Invoice + Return                                                     */
/* -------------------------------------------------------------------------- */

export interface PurchaseInvoiceLine {
  id: string
  lineNo: number
  purchaseOrderLineId: string | null
  goodsReceiptLineId: string | null
  /** Display helpers from linked PO/GRN lines. */
  poLineNo: number | null
  grnLineNo: number | null
  itemId: string
  itemCode: string
  itemName: string
  description: string
  uom: string
  hsnCode: string
  sacCode: string | null
  quantity: number
  rate: number
  discountAmount: number
  taxableAmount: number
  gstRatePct: number
  cgst: number
  sgst: number
  igst: number
  tdsAmount: number
  tcsAmount: number
  lineTotal: number
  costCentre: string
  project: string
  account: string
  remarks: string
}

export interface InvoiceMatchingLineResult {
  lineNo: number
  itemCode: string
  itemName: string
  poQty: number | null
  grnReceivedQty: number | null
  invoiceQty: number
  poRate: number | null
  invoiceRate: number
  poTaxPct: number | null
  invoiceTaxPct: number
  poLineTotal: number | null
  invoiceLineTotal: number
  flags: InvoiceMatchingResultStatus[]
  withinTolerance: boolean
}

export interface InvoiceMatchingResult {
  overallStatus: InvoiceMatchingResultStatus
  overallStatusLabel: string
  exceedsTolerance: boolean
  isDuplicateVendorInvoice: boolean
  missingGrn: boolean
  lines: InvoiceMatchingLineResult[]
  summary: {
    poQty: number
    grnQty: number
    invoiceQty: number
    poTotal: number
    invoiceTotal: number
    poTax: number
    invoiceTax: number
  }
  tolerancesApplied: PurchaseInvoiceMatchTolerances
}

export interface PurchaseInvoiceListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: PurchaseInvoiceStatus
  statusLabel: string
  origin: PurchaseInvoiceOrigin
  originLabel: string
  vendorName: string
  vendorGstin: string
  vendorInvoiceNumber: string
  purchaseOrderNumber: string | null
  goodsReceiptNumber: string | null
  matchingResultStatus: InvoiceMatchingResultStatus
  matchingResultStatusLabel: string
  matchStatus: 'unmatched' | 'matched' | 'mismatch'
  totalAmount: number
  currency: IndianCurrencyCode
  dueDate: IsoDate | null
  postingDate: IsoDate
}

export interface PurchaseInvoice extends PurchaseMoneyTotals, PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: PurchaseInvoiceStatus
  origin: PurchaseInvoiceOrigin
  vendorInvoiceNumber: string
  vendorInvoiceDate: IsoDate
  postingDate: IsoDate
  location: PurchaseLocationRef
  department: string
  requester: PurchasePartyRef
  approver: PurchasePartyRef | null
  vendor: PurchasePartyRef & { gstin: string; state: string; isInterstate: boolean }
  currency: IndianCurrencyCode
  paymentTerms: string
  deliveryTerms: string
  expectedDeliveryDate: IsoDate | null
  dueDate: IsoDate | null
  placeOfSupply: string
  reverseCharge: boolean
  eInvoiceReference: string | null
  gstScheme: PurchaseGstScheme
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  goodsReceiptId: string | null
  goodsReceiptNumber: string | null
  /** Coarse match flag used by dashboard KPIs. */
  matchStatus: 'unmatched' | 'matched' | 'mismatch'
  /** Detailed three-way matching outcome. */
  matchingResultStatus: InvoiceMatchingResultStatus
  matchingExceptionApproved: boolean
  exceptionApprovedBy: string | null
  exceptionApprovedAt: IsoDateTime | null
  verifiedAt: IsoDateTime | null
  verifiedBy: string | null
  onHoldReason: string | null
  holdAt: IsoDateTime | null
  debitNoteId: string | null
  debitNoteNumber: string | null
  lines: PurchaseInvoiceLine[]
  approvalIds: string[]
  postedAt: IsoDateTime | null
  paidAt: IsoDateTime | null
}

export interface PurchaseReturnLine {
  id: string
  lineNo: number
  goodsReceiptLineId: string | null
  itemId: string
  itemCode: string
  itemName: string
  description: string
  uom: string
  hsnCode: string
  batchLotNo: string
  serialNumber: string
  receivedQty: number
  availableReturnQty: number
  returnQty: number
  /** Unit cost / rate before tax. */
  unitCost: number
  gstRatePct: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  /** Alias for line total (taxable + tax). */
  returnAmount: number
  lineTotal: number
  reason: PurchaseReturnReason
  replacementQty: number
  remarks: string
}

export interface PurchaseReturn extends PurchaseMoneyTotals, PurchaseAuditFields {
  id: string
  documentNumber: string
  documentDate: IsoDate
  status: PurchaseReturnDomainStatus
  origin: PurchaseReturnOrigin
  location: PurchaseLocationRef
  warehouseId: string
  warehouseName: string
  department: string
  requester: PurchasePartyRef
  approver: PurchasePartyRef | null
  vendor: PurchasePartyRef & { gstin: string }
  paymentTerms: string
  deliveryTerms: string
  expectedDeliveryDate: IsoDate | null
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  goodsReceiptId: string | null
  goodsReceiptNumber: string | null
  purchaseInvoiceId: string | null
  purchaseInvoiceNumber: string | null
  qualityInspectionId: string | null
  qualityInspectionNumber: string | null
  /** Header-level return reason. */
  returnReason: PurchaseReturnReason
  transportDetails: string
  debitNoteRequired: boolean
  replacementRequired: boolean
  linkedReplacementPoId: string | null
  linkedReplacementPoNumber: string | null
  linkedDebitNoteId: string | null
  linkedDebitNoteNumber: string | null
  postedAt: IsoDateTime | null
  lines: PurchaseReturnLine[]
}

export interface PurchaseReturnListRow {
  id: string
  documentNumber: string
  documentDate: IsoDate
  vendorName: string
  vendorCode: string
  purchaseOrderNumber: string | null
  goodsReceiptNumber: string | null
  purchaseInvoiceNumber: string | null
  warehouseName: string
  origin: PurchaseReturnOrigin
  originLabel: string
  returnReason: PurchaseReturnReason
  returnReasonLabel: string
  lineCount: number
  totalReturnQty: number
  totalAmount: number
  status: PurchaseReturnDomainStatus
  statusLabel: string
  debitNoteRequired: boolean
  replacementRequired: boolean
  linkedReplacementPoNumber: string | null
  linkedDebitNoteNumber: string | null
}

/* -------------------------------------------------------------------------- */
/* Dashboard DTO                                                              */
/* -------------------------------------------------------------------------- */

export interface PurchaseDashboardFilters {
  dateFrom?: IsoDate
  dateTo?: IsoDate
  locationId?: string
}

export interface PurchaseDashboardStatusBucket {
  key: string
  label: string
  count: number
  href: string
}

export interface PurchaseDashboardDeliveryRow {
  id: string
  poNumber: string
  vendorName: string
  expectedDate: IsoDate
  itemCount: number
  poValue: number
  status: PurchaseOrderDomainStatus
  statusLabel: string
  href: string
  isOverdue: boolean
}

export type PurchasePendingActionType =
  | 'pr_approval'
  | 'po_approval'
  | 'grn_inspection'
  | 'invoice_mismatch'
  | 'overdue_delivery'

export interface PurchaseDashboardPendingAction {
  id: string
  type: PurchasePendingActionType
  label: string
  count: number
  href: string
  severity: 'primary' | 'warning' | 'critical'
}

export interface PurchaseDashboardTrendPoint {
  month: string
  label: string
  value: number
}

export interface PurchaseDashboardCategorySlice {
  category: PurchaseItemCategory
  label: string
  value: number
  count: number
  href: string
}

export interface PurchaseDashboardVendorRow {
  vendorId: string
  vendorName: string
  poCount: number
  totalValue: number
  href: string
}

export interface PurchaseDashboardActivityRow {
  id: string
  at: IsoDateTime
  summary: string
  href: string
  kind: string
}

export interface PurchaseDashboardLocationOption {
  id: string
  code: string
  name: string
}

export interface PurchaseDashboardData {
  kpis: {
    openRequisitions: number
    pendingPrApprovals: number
    openRfqs: number
    purchaseOrdersThisMonth: number
    pendingDeliveries: number
    pendingGrns: number
    pendingPurchaseInvoices: number
    monthlyPurchaseValue: number
  }
  kpiHrefs: {
    openRequisitions: string
    pendingPrApprovals: string
    openRfqs: string
    purchaseOrdersThisMonth: string
    pendingDeliveries: string
    pendingGrns: string
    pendingPurchaseInvoices: string
    monthlyPurchaseValue: string
  }
  prStatus: PurchaseDashboardStatusBucket[]
  poStatus: PurchaseDashboardStatusBucket[]
  upcomingDeliveries: PurchaseDashboardDeliveryRow[]
  pendingActions: PurchaseDashboardPendingAction[]
  monthlyTrend: PurchaseDashboardTrendPoint[]
  byCategory: PurchaseDashboardCategorySlice[]
  topVendors: PurchaseDashboardVendorRow[]
  recentActivity: PurchaseDashboardActivityRow[]
  locations: PurchaseDashboardLocationOption[]
  pendingApprovals: PurchaseApproval[]
  currency: IndianCurrencyCode
  asOf: IsoDateTime
  filtersApplied: PurchaseDashboardFilters
}

/** Inputs accepted by create/update service methods (partial headers + lines). */
export type PurchaseRequisitionInput = Partial<
  Omit<PurchaseRequisition, 'id' | 'documentNumber' | 'createdAt' | 'createdBy' | 'lines' | 'approvalIds'>
> & {
  lines?: Array<Partial<PurchaseRequisitionLine>>
}

export type PurchaseOrderInput = Partial<
  Omit<
    PurchaseOrder,
    | 'id'
    | 'documentNumber'
    | 'createdAt'
    | 'createdBy'
    | 'lines'
    | 'approvalIds'
    | 'changeHistory'
    | 'revisions'
    | 'vendor'
    | keyof PurchaseMoneyTotals
  >
> & {
  vendorId: string
  /** Optional explicit document number (e.g. from series selection). */
  documentNumber?: string
  freight?: number
  otherCharges?: number
  discount?: number
  packingCharges?: number
  insuranceCharges?: number
  tradeDiscount?: number
  tcsAmount?: number
  lines: Array<Partial<PurchaseOrderLine> & Pick<PurchaseOrderLine, 'itemId' | 'quantity' | 'rate'>>
}

export type PurchaseOrderReviseInput = {
  reason: string
  lines?: Array<Partial<PurchaseOrderLine> & Pick<PurchaseOrderLine, 'id' | 'itemId' | 'quantity' | 'rate'>>
  paymentTerms?: string
  deliveryTerms?: string
  freightTerms?: string
  packingTerms?: string
  insuranceTerms?: string
  warranty?: string
  inspectionRequirement?: string
  expectedDeliveryDate?: IsoDate
  freight?: number
  packingCharges?: number
  insuranceCharges?: number
  otherCharges?: number
  tradeDiscount?: number
  internalNotes?: string
  termsAndConditions?: string
  remarks?: string
}

export type RfqInput = Partial<
  Omit<
    RequestForQuotation,
    'id' | 'documentNumber' | 'createdAt' | 'createdBy' | 'vendors' | 'lines' | 'lineItemIds' | 'itemSummaries' | 'estimatedValue' | 'sentAt'
  >
> & {
  purchaseRequisitionId?: string | null
  purchaseRequisitionIds?: string[]
  vendorIds: string[]
  itemIds?: string[]
  lines?: Array<Partial<RfqLine> & Pick<RfqLine, 'itemId' | 'quantity'>>
}

export type VendorQuotationInput = Partial<
  Omit<
    VendorQuotation,
    'id' | 'documentNumber' | 'createdAt' | 'createdBy' | 'lines' | 'vendor' | keyof PurchaseMoneyTotals
  >
> & {
  rfqId: string
  vendorId: string
  packingCharges?: number
  freight?: number
  otherCharges?: number
  discount?: number
  lines: Array<
    Partial<VendorQuotationLine> &
      Pick<VendorQuotationLine, 'itemId' | 'quantity' | 'rate'> & {
        rfqLineId?: string | null
      }
  >
}

export type QuotationComparisonInput = {
  rfqId: string
  vendorIds: string[]
  method?: QuotationComparisonMethod
  criteria?: QuotationComparisonCriterion[]
  selectionMode?: QuotationSelectionMode
  selectionReason?: string
  lineSelections?: Array<{ itemId: string; vendorId: string }>
  recommendedVendorId?: string | null
}

export type GrnInput = {
  purchaseOrderId: string
  documentDate?: IsoDate
  vendorChallanNumber?: string
  vendorChallanDate?: IsoDate | null
  gateEntryNo?: string | null
  vehicleNo?: string | null
  transporterName?: string | null
  lrNumber?: string | null
  warehouseId?: string
  warehouseName?: string
  receivingLocation?: string
  receivedById?: string
  receivedByName?: string
  inspectionRequired?: boolean
  allowExcess?: boolean
  remarks?: string
  lines: Array<{
    purchaseOrderLineId: string
    receivedQty: number
    acceptedQty?: number
    rejectedQty?: number
    shortQty?: number
    excessQty?: number
    damagedQty?: number
    batchNumber?: string
    lotNumber?: string
    serialNumber?: string
    manufacturingDate?: IsoDate | null
    expiryDate?: IsoDate | null
    warehouseId?: string
    warehouseName?: string
    bin?: string
    allowExcess?: boolean
    remarks?: string
  }>
}

export type QualityInspectionInput = {
  goodsReceiptId: string
  goodsReceiptLineId: string
  inspectorId?: string
  inspectorName?: string
  inspectionPlan?: string
  sampleQty?: number
  acceptedQty?: number
  rejectedQty?: number
  documentDate?: IsoDate
  remarks?: string
  parameters?: Array<
    Partial<QualityInspectionParameter> & Pick<QualityInspectionParameter, 'parameter'>
  >
}

export type PurchaseInvoiceInput = {
  vendorId: string
  vendorInvoiceNumber: string
  vendorInvoiceDate: IsoDate
  origin?: PurchaseInvoiceOrigin
  purchaseOrderId?: string | null
  goodsReceiptId?: string | null
  documentDate?: IsoDate
  postingDate?: IsoDate
  dueDate?: IsoDate | null
  placeOfSupply?: string
  paymentTerms?: string
  reverseCharge?: boolean
  eInvoiceReference?: string | null
  remarks?: string
  lines: Array<{
    itemId: string
    quantity: number
    rate: number
    discountAmount?: number
    gstRatePct?: number
    tdsAmount?: number
    tcsAmount?: number
    description?: string
    purchaseOrderLineId?: string | null
    goodsReceiptLineId?: string | null
    costCentre?: string
    project?: string
    account?: string
    remarks?: string
  }>
}

export type PurchaseReturnLineInput = {
  itemId: string
  returnQty: number
  unitCost?: number
  /** @deprecated use unitCost */
  rate?: number
  goodsReceiptLineId?: string | null
  purchaseOrderLineId?: string | null
  itemCode?: string
  itemName?: string
  description?: string
  batchLotNo?: string
  serialNumber?: string
  receivedQty?: number
  availableReturnQty?: number
  reason?: PurchaseReturnReason
  replacementQty?: number
  remarks?: string
}

export type PurchaseReturnInput = {
  vendorId: string
  origin?: PurchaseReturnOrigin
  goodsReceiptId?: string | null
  purchaseOrderId?: string | null
  purchaseInvoiceId?: string | null
  qualityInspectionId?: string | null
  documentDate?: IsoDate
  returnReason: PurchaseReturnReason
  warehouseId?: string
  warehouseName?: string
  transportDetails?: string
  debitNoteRequired?: boolean
  replacementRequired?: boolean
  remarks?: string
  lines: PurchaseReturnLineInput[]
}
