import { createAuditLog, type AuditInput } from '../../../services/audit.service.js'

/** Canonical AuditLog.entity values for purchase documents. */
export const PURCHASE_AUDIT_ENTITY = {
  PR: 'PurchaseRequisition',
  PLANNING: 'PurchasePlanningRow',
  RFQ: 'RequestForQuotation',
  VQ: 'VendorQuotation',
  COMPARISON: 'VendorComparison',
  PO: 'PurchaseOrder',
  GRN: 'GoodsReceipt',
  SETUP: 'PurchaseSettings',
} as const

export type PurchaseAuditEntity = (typeof PURCHASE_AUDIT_ENTITY)[keyof typeof PURCHASE_AUDIT_ENTITY]

/** Canonical action codes — keep stable for timeline labels & filters. */
export const PURCHASE_AUDIT_ACTION = {
  // PR
  PR_CREATED: 'PR_CREATED',
  PR_UPDATED: 'PR_UPDATED',
  PR_LINE_ADDED: 'PR_LINE_ADDED',
  PR_LINE_UPDATED: 'PR_LINE_UPDATED',
  PR_LINE_REMOVED: 'PR_LINE_REMOVED',
  PR_SUBMITTED: 'PR_SUBMITTED',
  PR_APPROVED: 'PR_APPROVED',
  PR_REJECTED: 'PR_REJECTED',
  PR_SENT_BACK: 'PR_SENT_BACK',
  PR_REOPENED: 'PR_REOPENED',
  PR_CANCELLED: 'PR_CANCELLED',
  PR_RFQ_DECISION_CHANGED: 'PR_RFQ_DECISION_CHANGED',
  // Planning
  PPS_ROW_GENERATED: 'PPS_ROW_GENERATED',
  PPS_BUYER_ASSIGNED: 'PPS_BUYER_ASSIGNED',
  PPS_VENDOR_SELECTED: 'PPS_VENDOR_SELECTED',
  PPS_RATE_CHANGED: 'PPS_RATE_CHANGED',
  PPS_QTY_RECALCULATED: 'PPS_QTY_RECALCULATED',
  PPS_STATUS_CHANGED: 'PPS_STATUS_CHANGED',
  PPS_ON_HOLD: 'PPS_ON_HOLD',
  PPS_CANCELLED: 'PPS_CANCELLED',
  PPS_CONVERTED_TO_PO: 'PPS_CONVERTED_TO_PO',
  PPS_UPDATED: 'PPS_UPDATED',
  // RFQ
  RFQ_CREATED: 'RFQ_CREATED',
  RFQ_VENDOR_ADDED: 'RFQ_VENDOR_ADDED',
  RFQ_SENT: 'RFQ_SENT',
  RFQ_VENDOR_QUOTATION_ENTERED: 'RFQ_VENDOR_QUOTATION_ENTERED',
  RFQ_COMPARISON_COMPLETED: 'RFQ_COMPARISON_COMPLETED',
  RFQ_VENDOR_AWARDED: 'RFQ_VENDOR_AWARDED',
  RFQ_CONVERTED_TO_PO: 'RFQ_CONVERTED_TO_PO',
  RFQ_CANCELLED: 'RFQ_CANCELLED',
  RFQ_UPDATED: 'RFQ_UPDATED',
  // VQ (also mirrored onto RFQ where useful)
  VQ_CREATED: 'VQ_CREATED',
  VQ_UPDATED: 'VQ_UPDATED',
  VQ_SUBMITTED: 'VQ_SUBMITTED',
  // PO
  PO_CREATED: 'PO_CREATED',
  PO_UPDATED: 'PO_UPDATED',
  PO_SUBMITTED: 'PO_SUBMITTED',
  PO_APPROVED: 'PO_APPROVED',
  PO_REJECTED: 'PO_REJECTED',
  PO_SENT_BACK: 'PO_SENT_BACK',
  PO_SENT_TO_VENDOR: 'PO_SENT_TO_VENDOR',
  PO_PARTIALLY_RECEIVED: 'PO_PARTIALLY_RECEIVED',
  PO_FULLY_RECEIVED: 'PO_FULLY_RECEIVED',
  PO_CANCELLED: 'PO_CANCELLED',
  PO_CLOSED: 'PO_CLOSED',
  PO_REOPENED: 'PO_REOPENED',
  // GRN
  GRN_CREATED: 'GRN_CREATED',
  GRN_UPDATED: 'GRN_UPDATED',
  GRN_SUBMITTED: 'GRN_SUBMITTED',
  GRN_CANCELLED: 'GRN_CANCELLED',
  GRN_REVERSED: 'GRN_REVERSED',
  // Setup
  SETUP_CREATED: 'SETUP_CREATED',
  SETUP_UPDATED: 'SETUP_UPDATED',
  SETUP_PLANT_UPDATED: 'SETUP_PLANT_UPDATED',
} as const

export type PurchaseAuditAction = (typeof PURCHASE_AUDIT_ACTION)[keyof typeof PURCHASE_AUDIT_ACTION]

export const PURCHASE_AUDIT_ACTION_LABELS: Record<string, string> = {
  PR_CREATED: 'Created',
  PR_UPDATED: 'Updated',
  PR_LINE_ADDED: 'Line added',
  PR_LINE_UPDATED: 'Line updated',
  PR_LINE_REMOVED: 'Line removed',
  PR_SUBMITTED: 'Submitted',
  PR_APPROVED: 'Approved',
  PR_REJECTED: 'Rejected',
  PR_SENT_BACK: 'Sent back',
  PR_REOPENED: 'Reopened',
  PR_CANCELLED: 'Cancelled',
  PR_RFQ_DECISION_CHANGED: 'RFQ decision changed',
  PPS_ROW_GENERATED: 'Planning row generated',
  PPS_BUYER_ASSIGNED: 'Buyer assigned',
  PPS_VENDOR_SELECTED: 'Vendor selected',
  PPS_RATE_CHANGED: 'Rate changed',
  PPS_QTY_RECALCULATED: 'Quantity recalculated',
  PPS_STATUS_CHANGED: 'Status changed',
  PPS_ON_HOLD: 'Put on hold',
  PPS_CANCELLED: 'Cancelled',
  PPS_CONVERTED_TO_PO: 'Converted to PO',
  PPS_UPDATED: 'Planning row updated',
  RFQ_CREATED: 'Created',
  RFQ_VENDOR_ADDED: 'Vendor added',
  RFQ_SENT: 'Sent',
  RFQ_VENDOR_QUOTATION_ENTERED: 'Vendor quotation entered',
  RFQ_COMPARISON_COMPLETED: 'Comparison completed',
  RFQ_VENDOR_AWARDED: 'Vendor awarded',
  RFQ_CONVERTED_TO_PO: 'Converted to PO',
  RFQ_CANCELLED: 'Cancelled',
  RFQ_UPDATED: 'Updated',
  VQ_CREATED: 'Vendor quotation created',
  VQ_UPDATED: 'Vendor quotation updated',
  VQ_SUBMITTED: 'Vendor quotation submitted',
  PO_CREATED: 'Created',
  PO_UPDATED: 'Updated',
  PO_SUBMITTED: 'Submitted',
  PO_APPROVED: 'Approved',
  PO_REJECTED: 'Rejected',
  PO_SENT_BACK: 'Sent back',
  PO_REOPENED: 'Reopened',
  PO_SENT_TO_VENDOR: 'Sent to vendor',
  PO_PARTIALLY_RECEIVED: 'Partially received',
  PO_FULLY_RECEIVED: 'Fully received',
  PO_CANCELLED: 'Cancelled',
  PO_CLOSED: 'Closed',
  GRN_CREATED: 'GRN created',
  GRN_UPDATED: 'GRN updated',
  GRN_SUBMITTED: 'GRN submitted',
  GRN_CANCELLED: 'GRN cancelled',
  GRN_REVERSED: 'GRN reversed',
  SETUP_CREATED: 'Setup created',
  SETUP_UPDATED: 'Setup updated',
  SETUP_PLANT_UPDATED: 'Plant setup updated',
  // Legacy verbs still present in older rows
  CREATE: 'Created',
  UPDATE: 'Updated',
  SUBMIT: 'Submitted',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  CANCEL: 'Cancelled',
  REOPEN: 'Reopened',
  CREATED: 'Created',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  REOPENED: 'Reopened',
  STATUS_CHANGED: 'Status changed',
  BUYER_ASSIGNED: 'Buyer assigned',
  VENDOR_SELECTED: 'Vendor selected',
}

export type PurchaseAuditMeta = {
  ipAddress?: string | null
  userAgent?: string | null
}

export async function writePurchaseAudit(input: {
  tenantId: string
  actorId: string
  entity: PurchaseAuditEntity
  entityId: string
  action: string
  previousValue?: unknown
  newValue?: unknown
  meta?: PurchaseAuditMeta
}): Promise<void> {
  const payload: AuditInput = {
    tenantId: input.tenantId,
    userId: input.actorId,
    module: 'purchase',
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    oldValues: input.previousValue,
    newValues: input.newValue,
    ipAddress: input.meta?.ipAddress ?? null,
    userAgent: input.meta?.userAgent ?? null,
  }
  await createAuditLog(payload)
}

/** URL entityType → AuditLog.entity + PurchaseStatusHistory documentType */
export const TIMELINE_ENTITY_MAP = {
  'purchase-requisition': {
    auditEntity: PURCHASE_AUDIT_ENTITY.PR,
    statusDocumentType: 'PURCHASE_REQUISITION' as const,
    viewPermission: 'purchase.pr.view',
  },
  'planning-row': {
    auditEntity: PURCHASE_AUDIT_ENTITY.PLANNING,
    statusDocumentType: 'PURCHASE_PLANNING_ROW' as const,
    viewPermission: 'purchase.planning.view',
  },
  rfq: {
    auditEntity: PURCHASE_AUDIT_ENTITY.RFQ,
    statusDocumentType: 'REQUEST_FOR_QUOTATION' as const,
    viewPermission: 'purchase.rfq.view',
  },
  'purchase-order': {
    auditEntity: PURCHASE_AUDIT_ENTITY.PO,
    statusDocumentType: 'PURCHASE_ORDER' as const,
    viewPermission: 'purchase.po.view',
  },
} as const

export type TimelineEntityType = keyof typeof TIMELINE_ENTITY_MAP

export function isTimelineEntityType(value: string): value is TimelineEntityType {
  return value in TIMELINE_ENTITY_MAP
}

export function purchaseAuditActionLabel(action: string): string {
  return PURCHASE_AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase()
}
