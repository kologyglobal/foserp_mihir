import type {
  PurchaseApproval,
  PurchaseApprovalDocumentType,
  PurchaseApprovalStatus,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchasePriority,
  PurchaseRequisition,
  PurchaseRequisitionLine,
  PurchaseStatusHistory,
} from '@prisma/client'
import { decimalToNumber, toIso } from '../../../shared/index.js'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE_REQUISITION: 'Purchase Requisition',
  PURCHASE_ORDER: 'Purchase Order',
}

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Sent Back',
  CANCELLED: 'Cancelled',
  SKIPPED: 'Skipped',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
  CRITICAL: 'Critical',
}

function daysSince(isoOrDate: string | Date | null | undefined): number {
  if (!isoOrDate) return 0
  const t = typeof isoOrDate === 'string' ? Date.parse(isoOrDate) : isoOrDate.getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function toDateOnly(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

function mapApprovalStatus(status: PurchaseApprovalStatus): string {
  if (status === 'PENDING') return 'pending'
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'RETURNED') return 'sent_back'
  if (status === 'CANCELLED') return 'cancelled'
  return status.toLowerCase()
}

function mapDocumentType(type: PurchaseApprovalDocumentType): 'purchase_requisition' | 'purchase_order' {
  return type === 'PURCHASE_ORDER' ? 'purchase_order' : 'purchase_requisition'
}

function mapPriority(priority: PurchasePriority | string | null | undefined): string {
  if (!priority) return 'normal'
  const p = String(priority).toLowerCase()
  if (p === 'critical') return 'urgent'
  return p
}

export type ApprovalQueueContext = {
  canAct: boolean
  requestedByName?: string | null
  approverName?: string | null
  departmentName?: string | null
  locationName?: string | null
  locationId?: string | null
  documentDate?: Date | null
  priority?: PurchasePriority | string | null
  purpose?: string | null
  remarks?: string | null
  requiredDate?: Date | null
}

export function mapApprovalQueueRow(
  approval: PurchaseApproval,
  ctx: ApprovalQueueContext,
) {
  const status = mapApprovalStatus(approval.status)
  const documentType = mapDocumentType(approval.documentType)
  const submittedDate = approval.requestedAt
  const priority = mapPriority(ctx.priority)
  const priorityKey = (ctx.priority ?? 'NORMAL').toString().toUpperCase()

  return {
    approvalId: approval.id,
    documentType,
    documentTypeLabel: DOCUMENT_TYPE_LABELS[approval.documentType] ?? approval.documentType,
    documentId: approval.documentId,
    documentNumber: approval.documentNumber ?? '',
    documentDate: toDateOnly(ctx.documentDate ?? approval.requestedAt),
    requestedBy: ctx.requestedByName?.trim() || '—',
    requesterId: approval.requesterId ?? '',
    department: ctx.departmentName?.trim() || '',
    locationId: ctx.locationId ?? '',
    locationName: ctx.locationName?.trim() || '—',
    amount: decimalToNumber(approval.amount),
    priority,
    priorityLabel: PRIORITY_LABELS[priorityKey] ?? priority,
    submittedDate: toIso(submittedDate) ?? new Date(0).toISOString(),
    pendingSinceDays: daysSince(submittedDate),
    approvalLevel: approval.level,
    approvalLevelLabel: `${approval.level} of 1 · Approver`,
    chainLength: 1,
    status,
    statusLabel: APPROVAL_STATUS_LABELS[approval.status] ?? status,
    approverId: approval.approverId ?? '',
    approverName: ctx.approverName?.trim() || '',
    approverRole: approval.approverRole ?? 'purchase_head',
    approverRoleLabel: approval.approverRole ?? 'Approver',
    canAct: ctx.canAct && approval.status === 'PENDING',
  }
}

export function mapStatusHistoryToPreviousApproval(
  h: PurchaseStatusHistory,
  resolvedActorName?: string | null,
) {
  const documentType =
    h.documentType === 'PURCHASE_ORDER' ? 'purchase_order' : 'purchase_requisition'
  return {
    id: h.id,
    documentType,
    documentId: h.documentId,
    documentNumber: h.documentNumber ?? '',
    action: h.action.toLowerCase(),
    actorId: h.actorId ?? '',
    actorName: h.actorName ?? resolvedActorName ?? '—',
    fromStatus: h.fromStatus ?? '',
    toStatus: h.toStatus ?? '',
    remarks: h.remarks ?? '',
    actedAt: toIso(h.actedAt),
  }
}

export function mapPrLinesForReview(lines: PurchaseRequisitionLine[]) {
  return lines.map((l) => ({
    lineNo: l.lineNumber,
    itemCode: l.itemCodeSnapshot,
    itemName: l.itemNameSnapshot,
    quantity: decimalToNumber(l.requiredQuantity),
    uom: l.uomId ?? '',
    rate: decimalToNumber(l.estimatedRate),
    amount: decimalToNumber(l.estimatedAmount),
  }))
}

export function mapPoLinesForReview(lines: PurchaseOrderLine[]) {
  return lines.map((l) => ({
    lineNo: l.lineNumber,
    itemCode: l.itemCodeSnapshot,
    itemName: l.itemNameSnapshot,
    quantity: decimalToNumber(l.quantity),
    uom: l.uomId ?? '',
    rate: decimalToNumber(l.rate),
    amount: decimalToNumber(l.amount),
  }))
}

export function mapApprovalReviewDetail(input: {
  row: ReturnType<typeof mapApprovalQueueRow>
  purpose: string
  requesterRemarks: string
  expectedDeliveryDate: string | null
  lines: Array<{
    lineNo: number
    itemCode: string
    itemName: string
    quantity: number
    uom: string
    rate: number
    amount: number
  }>
  previousApprovals: ReturnType<typeof mapStatusHistoryToPreviousApproval>[]
  eligibleApprovers: Array<{ id: string; name: string; email: string; role: string }>
  chainRoles?: string[]
}) {
  return {
    row: input.row,
    purpose: input.purpose,
    requesterRemarks: input.requesterRemarks,
    expectedDeliveryDate: input.expectedDeliveryDate,
    lines: input.lines,
    availableBudgetPlaceholderInr: 0,
    previousApprovals: input.previousApprovals,
    attachments: [] as unknown[],
    chainRoles: input.chainRoles ?? [],
    eligibleApprovers: input.eligibleApprovers,
  }
}

export type PrDoc = PurchaseRequisition & { lines: PurchaseRequisitionLine[] }
export type PoDoc = PurchaseOrder & { lines: PurchaseOrderLine[] }
