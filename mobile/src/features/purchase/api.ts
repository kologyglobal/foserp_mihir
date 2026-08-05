/**
 * Purchase API — live REST only (tenant-scoped).
 * Approvals act via document lifecycle endpoints, not /approvals/:id/approve.
 * GRN: create DRAFT → submit → post-inventory (no invent lifecycle).
 */
import { apiClient, tenantPath } from '@/api/client'
import { ApiError, getUserFriendlyMessage } from '@/api/errors'
import { can, canAny } from '@/auth/permissions'
import type { PaginationMeta } from '@/types/api'

export type PurchaseDocType = 'purchase_requisition' | 'purchase_order' | 'goods_receipt_note'

export type PoListFilter = 'all' | 'open' | 'pending_receipt' | 'partially_received' | 'closed'

export type GrnListFilter = 'all' | 'DRAFT' | 'SUBMITTED' | 'QC_PENDING' | 'INVENTORY_POSTED' | 'PENDING_TOLERANCE_APPROVAL'

export interface PurchaseApprovalQueueRow {
  approvalId: string
  documentType: PurchaseDocType
  documentTypeLabel: string
  documentId: string
  documentNumber: string
  documentDate?: string
  requestedBy: string
  department?: string
  locationName?: string
  amount: number
  priority?: string
  priorityLabel?: string
  submittedDate?: string
  pendingSinceDays?: number
  approvalLevelLabel?: string
  status?: string
  statusLabel?: string
  canAct?: boolean
  purpose?: string | null
  remarks?: string | null
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
  purpose?: string
  requesterRemarks?: string
  expectedDeliveryDate?: string | null
  lines?: PurchaseApprovalReviewLine[]
  previousApprovals?: Array<{
    id: string
    action: string
    actorName?: string
    remarks?: string
    actedAt?: string | null
    fromStatus?: string
    toStatus?: string
  }>
  chainRoles?: string[]
  eligibleApprovers?: Array<{ id: string; name: string; email: string; role: string }>
}

export interface PurchaseOrderLine {
  id: string
  lineNumber?: number
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  quantity?: number
  uomQuantity?: number
  uomCode?: string | null
  rate?: number
  amount?: number
  receivedQuantity?: number
  acceptedQuantity?: number
  rejectedQuantity?: number
  openQuantity?: number
  outstandingQty?: number
  outstandingQtyBase?: number
  receivedUomQty?: number
  qcRequired?: boolean
  requiredDate?: string | null
  remarks?: string | null
  [key: string]: unknown
}

export interface PurchaseOrderSummary {
  id: string
  orderNumber?: string
  orderDate?: string | null
  vendorId?: string
  vendorCode?: string
  vendorName?: string
  status?: string
  currencyCode?: string
  expectedDeliveryDate?: string | null
  paymentTerms?: string | null
  deliveryTerms?: string | null
  deliveryWarehouseId?: string | null
  deliveryWarehouseCode?: string
  deliveryWarehouseName?: string
  deliveryWarehousePlantId?: string | null
  subtotalAmount?: number
  taxAmount?: number
  freightAmount?: number
  totalAmount?: number
  remarks?: string | null
  allowedActions?: Record<string, boolean>
  lines?: PurchaseOrderLine[]
  changeHistory?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface GrnLine {
  id?: string
  lineNumber?: number
  purchaseOrderLineId?: string
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  uom?: string | null
  orderedQuantity?: number
  previouslyReceivedQuantity?: number
  openQuantity?: number
  receivedQuantity?: number
  acceptedQuantity?: number
  rejectedQuantity?: number
  damagedQuantity?: number
  rate?: number
  amount?: number
  warehouseId?: string | null
  storageLocationId?: string | null
  batchNumber?: string | null
  lotNumber?: string | null
  serialNumber?: string | null
  qcRequired?: boolean
  toleranceStatus?: string
  variancePercentage?: number | null
  tolerancePercentage?: number
  maximumAllowedUnitQuantity?: number
  remarks?: string | null
  [key: string]: unknown
}

export interface GrnAllowedActions {
  canEdit?: boolean
  canSubmit?: boolean
  canCancel?: boolean
  canReverse?: boolean
  canPostInventory?: boolean
  canApproveTolerance?: boolean
  canRejectTolerance?: boolean
}

export interface GrnSummary {
  id: string
  grnNumber?: string
  documentNumber?: string
  receiptDate?: string | null
  status?: string
  purchaseOrderId?: string
  purchaseOrderNumber?: string
  vendorId?: string
  vendorCode?: string
  vendorName?: string
  plantId?: string | null
  warehouseId?: string | null
  warehouseCode?: string
  warehouseName?: string
  vendorChallanNumber?: string | null
  vendorChallanDate?: string | null
  vehicleNumber?: string | null
  transporterName?: string | null
  receivedByName?: string | null
  inspectionRequired?: boolean
  remarks?: string | null
  lineCount?: number
  totalReceivedQty?: number
  totalAcceptedQty?: number
  totalRejectedQty?: number
  totalAmount?: number
  currencyCode?: string
  allowedActions?: GrnAllowedActions
  lines?: GrnLine[]
  submittedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  [key: string]: unknown
}

export interface QualityInspectionSummary {
  id: string
  inspectionNumber?: string
  status?: string
  goodsReceiptId?: string | null
  goodsReceiptNumber?: string | null
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
  vendorName?: string | null
  itemCode?: string | null
  itemName?: string | null
  inspectedAt?: string | null
  createdAt?: string | null
  [key: string]: unknown
}

export type CreateGrnLineInput = {
  purchaseOrderLineId: string
  receivedQuantity?: number
  receivedUomQuantity?: number
  damagedQuantity?: number
  warehouseId?: string
  batchNumber?: string | null
  lotNumber?: string | null
  serialNumber?: string | null
  remarks?: string | null
}

export type CreateGrnInput = {
  purchaseOrderId: string
  receiptDate?: string
  warehouseId?: string
  vendorChallanNumber?: string | null
  vendorChallanDate?: string | null
  vehicleNumber?: string | null
  transporterName?: string | null
  remarks?: string | null
  lines: CreateGrnLineInput[]
}

function qs(params: Record<string, string | number | boolean | undefined> = {}) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false) continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

function unwrapList<T>(data: T[] | { items?: T[] } | null | undefined): T[] {
  if (data == null) return []
  if (Array.isArray(data)) return data
  return data.items ?? []
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export const PURCHASE_APPROVAL_VIEW_ANY_OF = [
  'purchase.pr.approve',
  'purchase.po.approve',
  'purchase.pr.view',
  'purchase.po.view',
] as const

export function canAccessPurchaseApprovals(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny([...PURCHASE_APPROVAL_VIEW_ANY_OF], permissions)
}

export function canViewPurchaseOrders(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.po.view', 'tenant.manage'], permissions)
}

export function canViewGrns(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.grn.view', 'tenant.manage'], permissions)
}

export function canCreateGrn(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.grn.create', 'tenant.manage'], permissions)
}

export function canPostGrn(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.grn.post', 'tenant.manage'], permissions)
}

export function canViewPurchaseQi(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.qi.view', 'quality.view', 'tenant.manage'], permissions)
}

export function canViewPurchaseRequisitions(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.pr.view', 'tenant.manage'], permissions)
}

export function canSubmitPurchaseRequisition(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.pr.submit', 'tenant.manage'], permissions)
}

export function canApprovePurchaseDocument(
  documentType: PurchaseDocType,
  permissions?: string[] | null,
): boolean {
  if (permissions == null) return false
  if (documentType === 'purchase_requisition') return can('purchase.pr.approve', permissions)
  if (documentType === 'purchase_order') return can('purchase.po.approve', permissions)
  if (documentType === 'goods_receipt_note') {
    return canAny(['purchase.grn.post', 'purchase.po.approve'], permissions)
  }
  return false
}

export function canRejectPurchaseDocument(
  documentType: PurchaseDocType,
  permissions?: string[] | null,
): boolean {
  if (permissions == null) return false
  if (documentType === 'purchase_requisition') return can('purchase.pr.reject', permissions)
  if (documentType === 'purchase_order') return can('purchase.po.approve', permissions)
  if (documentType === 'goods_receipt_note') {
    return canAny(['purchase.grn.post', 'purchase.po.approve'], permissions)
  }
  return false
}

export function shouldShowApproveAction(
  row: Pick<PurchaseApprovalQueueRow, 'canAct' | 'status' | 'documentType'>,
  permissions?: string[] | null,
): boolean {
  const pending = String(row.status || 'pending').toLowerCase() === 'pending'
  return Boolean(row.canAct) && pending && canApprovePurchaseDocument(row.documentType, permissions)
}

export function shouldShowRejectAction(
  row: Pick<PurchaseApprovalQueueRow, 'canAct' | 'status' | 'documentType'>,
  permissions?: string[] | null,
): boolean {
  const pending = String(row.status || 'pending').toLowerCase() === 'pending'
  return Boolean(row.canAct) && pending && canRejectPurchaseDocument(row.documentType, permissions)
}

/** Backend PO_RECEIVABLE_STATUSES + pending open qty. */
export function isPoReceivable(po: PurchaseOrderSummary): boolean {
  const st = String(po.status || '')
  if (!['SENT_TO_VENDOR', 'PARTIALLY_RECEIVED'].includes(st)) return false
  return poPendingQuantity(po) > 0
}

export function poPendingQuantity(po: Pick<PurchaseOrderSummary, 'lines'>): number {
  const lines = po.lines ?? []
  if (lines.length === 0) return 0
  return lines.reduce((sum, line) => {
    const open =
      Number(line.openQuantity ?? line.outstandingQtyBase ?? line.outstandingQty ?? 0) || 0
    return sum + Math.max(0, open)
  }, 0)
}

export function poReceiptStatusLabel(po: PurchaseOrderSummary): string {
  const st = String(po.status || '')
  if (st === 'FULLY_RECEIVED') return 'Fully received'
  if (st === 'PARTIALLY_RECEIVED') return 'Partially received'
  if (st === 'CLOSED') return 'Closed'
  if (st === 'CANCELLED') return 'Cancelled'
  if (st === 'SENT_TO_VENDOR' && poPendingQuantity(po) > 0) return 'Pending receipt'
  if (['SENT_TO_VENDOR', 'APPROVED', 'PARTIALLY_INVOICED'].includes(st)) return 'Open'
  return titleStatus(st) || '—'
}

function titleStatus(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function lineReceiptStatusLabel(line: PurchaseOrderLine): string {
  const ordered = Number(line.quantity ?? line.uomQuantity ?? 0)
  const received = Number(line.receivedQuantity ?? 0)
  const open = Number(line.openQuantity ?? Math.max(0, ordered - received))
  if (received <= 0) return 'Not received'
  if (open <= 0) return 'Fully received'
  return 'Partial'
}

export function grnQcStatusLabel(grn: GrnSummary): string {
  const st = String(grn.status || '')
  if (st === 'QC_PENDING') return 'QC Pending'
  if (st === 'FULLY_ACCEPTED') return 'QC Passed'
  if (st === 'PARTIALLY_ACCEPTED') return 'QC Partial'
  if (st === 'INVENTORY_POSTED' && grn.inspectionRequired) return 'QC Done'
  if (!grn.inspectionRequired) return 'Not required'
  return titleStatus(st) || '—'
}

export function grnPostingStatusLabel(grn: GrnSummary): string {
  const st = String(grn.status || '')
  if (st === 'INVENTORY_POSTED') return 'Posted'
  if (st === 'DRAFT') return 'Draft'
  if (st === 'PENDING_TOLERANCE_APPROVAL') return 'Tolerance pending'
  if (['SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED'].includes(st)) {
    return 'Awaiting post'
  }
  if (st === 'CANCELLED' || st === 'REVERSED') return titleStatus(st)
  return titleStatus(st) || '—'
}

export function canPostInventoryGrn(grn: GrnSummary, permissions?: string[] | null): boolean {
  return canPostGrn(permissions) && Boolean(grn.allowedActions?.canPostInventory)
}

export function canSubmitDraftGrn(grn: GrnSummary, permissions?: string[] | null): boolean {
  return (
    canCreateGrn(permissions) &&
    Boolean(grn.allowedActions?.canSubmit) &&
    String(grn.status) === 'DRAFT'
  )
}

// Bodies
export function buildApproveBody(remarks?: string): { remarks?: string } {
  const trimmed = (remarks ?? '').trim()
  return trimmed ? { remarks: trimmed } : { remarks: 'Approved from mobile' }
}

export function buildRejectBody(
  documentType: PurchaseDocType,
  remarks: string,
): { reason: string; remarks: string } | { remarks: string } {
  const text = remarks.trim()
  if (!text) throw new Error('Rejection comments are mandatory')
  if (documentType === 'goods_receipt_note') return { remarks: text }
  return { reason: text, remarks: text }
}

/** Client validation before create — open qty and non-negative. Tolerance enforced server-side. */
export function validateReceiveLines(
  po: PurchaseOrderSummary,
  qtyByLineId: Record<string, string>,
): string | null {
  let anyPositive = false
  for (const line of po.lines ?? []) {
    const raw = qtyByLineId[line.id]
    if (raw == null || String(raw).trim() === '') continue
    const q = Number(raw)
    if (!Number.isFinite(q) || q < 0) return `Invalid quantity on ${line.itemCode || 'line'}`
    if (q === 0) continue
    anyPositive = true
    const pending = Number(line.openQuantity ?? line.outstandingQtyBase ?? 0)
    if (q > pending + 1e-9) {
      // Allow over-receipt only if backend may tolerate — still warn when hard exceed without tolerance context
      // We allow submit and let backend decide when within tolerance; block only grossly over with no headroom.
      // Still block if open is 0
      if (pending <= 0) return `${line.itemCode || 'Line'} has no open quantity`
    }
  }
  if (!anyPositive) return 'Enter a positive receipt quantity on at least one line'
  return null
}

// ─── Approvals ───────────────────────────────────────────────────────────────

export async function listPurchaseApprovals(tab: string = 'pending_mine', limit = 100) {
  const res = await apiClient.get<PurchaseApprovalQueueRow[]>(
    tenantPath(`/purchase/approvals${qs({ tab, page: 1, limit })}`),
  )
  return res.data ?? []
}

export async function getPurchaseApproval(id: string) {
  const res = await apiClient.get<PurchaseApprovalReviewDetail>(
    tenantPath(`/purchase/approvals/${id}`),
  )
  return res.data
}

export async function approvePurchaseDocument(
  documentType: PurchaseDocType,
  documentId: string,
  remarks = 'Approved from mobile',
) {
  const body = buildApproveBody(remarks)
  if (documentType === 'purchase_requisition') {
    return (await apiClient.post(tenantPath(`/purchase/requisitions/${documentId}/approve`), body)).data
  }
  if (documentType === 'purchase_order') {
    return (await apiClient.post(tenantPath(`/purchase/orders/${documentId}/approve`), body)).data
  }
  if (documentType === 'goods_receipt_note') {
    return (
      await apiClient.post(tenantPath(`/purchase/grns/${documentId}/approve-tolerance`), body)
    ).data
  }
  throw new Error('Unsupported document type for approval')
}

export async function rejectPurchaseDocument(
  documentType: PurchaseDocType,
  documentId: string,
  remarks: string,
) {
  const body = buildRejectBody(documentType, remarks)
  if (documentType === 'purchase_requisition') {
    return (await apiClient.post(tenantPath(`/purchase/requisitions/${documentId}/reject`), body)).data
  }
  if (documentType === 'purchase_order') {
    return (await apiClient.post(tenantPath(`/purchase/orders/${documentId}/reject`), body)).data
  }
  if (documentType === 'goods_receipt_note') {
    return (
      await apiClient.post(tenantPath(`/purchase/grns/${documentId}/reject-tolerance`), body)
    ).data
  }
  throw new Error('Unsupported document type for rejection')
}

// ─── Purchase orders ─────────────────────────────────────────────────────────

export async function listPurchaseOrders(params: {
  search?: string
  page?: number
  limit?: number
  status?: string
} = {}): Promise<{ items: PurchaseOrderSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<PurchaseOrderSummary[]>(
    tenantPath(
      `/purchase/orders${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderSummary> {
  const res = await apiClient.get<PurchaseOrderSummary>(tenantPath(`/purchase/orders/${id}`))
  return res.data
}

export async function findPurchaseOrderByNumber(search: string): Promise<PurchaseOrderSummary | null> {
  const token = search.trim()
  if (!token) return null
  const { items } = await listPurchaseOrders({ search: token, limit: 20 })
  const exact = items.find(
    (o) => String(o.orderNumber || '').toUpperCase() === token.toUpperCase(),
  )
  return exact ?? items[0] ?? null
}

/** Map UI filter → API status(es). Client may refine after fetch. */
export function poFilterToStatusParam(filter: PoListFilter): string | undefined {
  if (filter === 'pending_receipt') return 'SENT_TO_VENDOR'
  if (filter === 'partially_received') return 'PARTIALLY_RECEIVED'
  if (filter === 'closed') return 'CLOSED'
  return undefined
}

export function matchPoFilter(po: PurchaseOrderSummary, filter: PoListFilter): boolean {
  if (filter === 'all') return true
  const st = String(po.status || '')
  if (filter === 'pending_receipt') return st === 'SENT_TO_VENDOR'
  if (filter === 'partially_received') return st === 'PARTIALLY_RECEIVED'
  if (filter === 'closed') return st === 'CLOSED' || st === 'FULLY_RECEIVED'
  if (filter === 'open') {
    return !['CLOSED', 'CANCELLED', 'REJECTED', 'FULLY_RECEIVED'].includes(st)
  }
  return true
}

// ─── GRN ─────────────────────────────────────────────────────────────────────

export async function listGrns(params: {
  search?: string
  page?: number
  limit?: number
  status?: string
  purchaseOrderId?: string
} = {}): Promise<{ items: GrnSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<GrnSummary[]>(
    tenantPath(
      `/purchase/grns${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
        purchaseOrderId: params.purchaseOrderId,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function getGrn(id: string): Promise<GrnSummary> {
  const res = await apiClient.get<GrnSummary>(tenantPath(`/purchase/grns/${id}`))
  return res.data
}

export async function createGoodsReceipt(payload: CreateGrnInput): Promise<GrnSummary> {
  const res = await apiClient.post<GrnSummary>(
    tenantPath('/purchase/grns'),
    payload,
    { retries: 0 },
  )
  return res.data
}

export async function submitGoodsReceipt(id: string, remarks?: string): Promise<GrnSummary> {
  const res = await apiClient.post<GrnSummary>(
    tenantPath(`/purchase/grns/${id}/submit`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function postInventoryGoodsReceipt(
  id: string,
  remarks?: string,
): Promise<GrnSummary> {
  const res = await apiClient.post<GrnSummary>(
    tenantPath(`/purchase/grns/${id}/post-inventory`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export type PrListFilter = 'all' | 'draft' | 'pending' | 'approved' | 'closed'

export interface PurchaseRequisitionLine {
  id: string
  lineNumber?: number
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  requiredQuantity?: number
  orderedQuantity?: number
  remainingQuantity?: number
  estimatedRate?: number
  estimatedAmount?: number
  uomId?: string | null
  requiredDate?: string | null
  status?: string
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
  remarks?: string | null
  [key: string]: unknown
}

export interface PurchaseRequisitionSummary {
  id: string
  requisitionNumber?: string
  requisitionDate?: string | null
  status?: string
  priority?: string
  requestedByName?: string | null
  warehouseId?: string | null
  requiredDate?: string | null
  purchasePurpose?: string | null
  remarks?: string | null
  rfqRequired?: boolean
  submittedAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  lines?: PurchaseRequisitionLine[]
  [key: string]: unknown
}

export interface ReceivablePoLine {
  purchaseOrderLineId: string
  lineNumber?: number
  itemId?: string | null
  itemCode?: string
  itemName?: string
  orderedQuantity?: number
  previouslyReceivedQuantity?: number
  openQuantity?: number
  uom?: string
  rate?: number
  receivingTolerancePercentage?: number
  [key: string]: unknown
}

/** Progress 0–1 for receipt fill from lines. */
export function poReceiptProgress(po: Pick<PurchaseOrderSummary, 'lines'>): number {
  const lines = po.lines ?? []
  let ordered = 0
  let received = 0
  for (const line of lines) {
    ordered += Number(line.quantity ?? line.uomQuantity ?? 0)
    received += Number(line.receivedQuantity ?? 0)
  }
  if (ordered <= 0) return 0
  return Math.min(1, Math.max(0, received / ordered))
}

export function prEstimatedTotal(pr: PurchaseRequisitionSummary): number {
  return (pr.lines ?? []).reduce((s, l) => s + Number(l.estimatedAmount ?? 0), 0)
}

export function isPrSubmittable(pr: PurchaseRequisitionSummary): boolean {
  const st = String(pr.status || '').toUpperCase()
  // API may return lower-case
  return st === 'DRAFT' || st === 'draft'
}

export function prFilterToStatus(filter: PrListFilter): string | undefined {
  if (filter === 'draft') return 'DRAFT'
  if (filter === 'pending') return 'PENDING_APPROVAL'
  if (filter === 'approved') return 'APPROVED'
  if (filter === 'closed') return 'CLOSED'
  return undefined
}

export function matchPrFilter(pr: PurchaseRequisitionSummary, filter: PrListFilter): boolean {
  if (filter === 'all') return true
  const st = String(pr.status || '').toUpperCase()
  if (filter === 'draft') return st === 'DRAFT'
  if (filter === 'pending') {
    return st === 'PENDING_APPROVAL' || st === 'SUBMITTED'
  }
  if (filter === 'approved') {
    return st === 'APPROVED' || st === 'PARTIALLY_CONVERTED' || st === 'CONVERTED_TO_PO'
  }
  if (filter === 'closed') return st === 'CLOSED' || st === 'CANCELLED' || st === 'REJECTED'
  return true
}

export function qiDisplayStatusLabel(status?: string | null): string {
  const st = String(status || '').toUpperCase()
  if (st === 'PENDING' || st === 'DRAFT') return 'QC Pending'
  if (st === 'IN_PROGRESS') return 'QC In progress'
  if (st === 'ACCEPTED' || st === 'CLOSED') return 'QC Passed'
  if (st === 'REJECTED') return 'QC Rejected'
  if (st === 'PARTIALLY_ACCEPTED') return 'QC Partial'
  if (st === 'DEVIATION_PENDING') return 'QC On Hold'
  return st ? st.replace(/_/g, ' ') : '—'
}

export async function listPurchaseRequisitions(params: {
  search?: string
  page?: number
  limit?: number
  status?: string
} = {}): Promise<{ items: PurchaseRequisitionSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<PurchaseRequisitionSummary[]>(
    tenantPath(
      `/purchase/requisitions${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function getPurchaseRequisition(id: string): Promise<PurchaseRequisitionSummary> {
  const res = await apiClient.get<PurchaseRequisitionSummary>(
    tenantPath(`/purchase/requisitions/${id}`),
  )
  return res.data
}

export async function submitPurchaseRequisition(
  id: string,
  remarks?: string,
): Promise<PurchaseRequisitionSummary> {
  const res = await apiClient.post<PurchaseRequisitionSummary>(
    tenantPath(`/purchase/requisitions/${id}/submit`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function listReceivableLines(purchaseOrderId: string): Promise<ReceivablePoLine[]> {
  const res = await apiClient.get<ReceivablePoLine[] | { lines?: ReceivablePoLine[]; items?: ReceivablePoLine[] }>(
    tenantPath(`/purchase/orders/${purchaseOrderId}/receivable-lines`),
  )
  const data = res.data
  if (Array.isArray(data)) return data
  return data?.lines ?? data?.items ?? []
}

export async function listQualityInspections(params: {
  search?: string
  page?: number
  limit?: number
  status?: string
  goodsReceiptId?: string
  purchaseOrderId?: string
} = {}): Promise<{ items: QualityInspectionSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<QualityInspectionSummary[]>(
    tenantPath(
      `/purchase/quality-inspections${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
        goodsReceiptId: params.goodsReceiptId,
        purchaseOrderId: params.purchaseOrderId,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function listQualityInspectionsForGrn(goodsReceiptId: string) {
  const { items } = await listQualityInspections({ goodsReceiptId, limit: 20 })
  return items
}

export function purchaseFriendlyError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.kind === 'forbidden' || error.status === 403) {
      return 'You are not authorised to perform this Purchase action.'
    }
    if (error.kind === 'not_found' || error.status === 404) {
      return 'This Purchase document could not be found.'
    }
    if (error.status === 409) {
      return error.message || 'This Purchase document was changed by another user. Refresh and try again.'
    }
  }
  return getUserFriendlyMessage(error) || fallback
}
