/**
 * Purchase Phase C — PR write, RFQ, invoices, returns, QI lifecycle acts.
 * Offline GRN queue is in offlineGrnQueue.ts.
 */
import { apiClient, tenantPath } from '@/api/client'
import { can, canAny } from '@/auth/permissions'
import type { PaginationMeta } from '@/types/api'
import type {
  CreateGrnInput,
  GrnSummary,
  QualityInspectionSummary,
} from '@/features/purchase/api'

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

// ─── Permissions ───────────────────────────────────────────────────────────

export function canCreatePurchaseRequisition(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.pr.create', 'tenant.manage'], permissions)
}

export function canEditPurchaseRequisition(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.pr.edit', 'tenant.manage'], permissions)
}

export function canViewRfq(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.rfq.view', 'tenant.manage'], permissions)
}

export function canCreateRfq(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.rfq.create', 'tenant.manage'], permissions)
}

export function canSendRfq(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.rfq.send', 'tenant.manage'], permissions)
}

export function canViewInvoice(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.invoice.view', 'tenant.manage'], permissions)
}

export function canSubmitInvoice(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.invoice.submit', 'tenant.manage'], permissions)
}

export function canApproveInvoice(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.invoice.approve', 'tenant.manage'], permissions)
}

export function canViewReturn(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.return.view', 'tenant.manage'], permissions)
}

export function canCreateReturn(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.return.create', 'tenant.manage'], permissions)
}

export function canSubmitReturn(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.return.submit', 'tenant.manage'], permissions)
}

export function canCompleteReturn(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.return.complete', 'tenant.manage'], permissions)
}

export function canCompletePurchaseQi(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.qi.complete', 'tenant.manage'], permissions)
}

export function canEditPurchaseQi(permissions?: string[] | null): boolean {
  if (permissions == null) return false
  return canAny(['purchase.qi.edit', 'tenant.manage'], permissions)
}

// ─── PR write ──────────────────────────────────────────────────────────────

export type PrEditorLine = {
  id?: string
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  requiredQuantity: number
  estimatedRate?: number
  remarks?: string | null
}

export type CreatePrInput = {
  requisitionDate?: string | null
  requiredDate?: string | null
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL'
  purchasePurpose?: string | null
  rfqRequired?: boolean
  remarks?: string | null
  warehouseId?: string | null
  lines: PrEditorLine[]
}

export async function createPurchaseRequisition(body: CreatePrInput) {
  const res = await apiClient.post(tenantPath('/purchase/requisitions'), body, { retries: 0 })
  return res.data as Record<string, unknown> & { id: string; requisitionNumber?: string }
}

export async function updatePurchaseRequisition(id: string, body: Partial<CreatePrInput>) {
  const res = await apiClient.patch(tenantPath(`/purchase/requisitions/${id}`), body, {
    retries: 0,
  })
  return res.data as Record<string, unknown> & { id: string }
}

export function canEditPrDocument(status?: string | null): boolean {
  const st = String(status || '').toUpperCase()
  return st === 'DRAFT' || st === ''
}

// ─── RFQ ───────────────────────────────────────────────────────────────────

export interface RfqVendor {
  id?: string
  vendorId?: string
  vendorCode?: string
  vendorName?: string
  inviteStatus?: string
  [key: string]: unknown
}

export interface RfqLine {
  id?: string
  itemCode?: string
  itemName?: string
  requiredQuantity?: number
  quantity?: number
  targetRate?: number | null
  [key: string]: unknown
}

export interface RfqSummary {
  id: string
  rfqNumber?: string
  rfqDate?: string | null
  status?: string
  title?: string | null
  responseDueDate?: string | null
  purchaseRequisitionId?: string | null
  purchaseRequisitionNumber?: string | null
  remarks?: string | null
  vendors?: RfqVendor[]
  lines?: RfqLine[]
  [key: string]: unknown
}

export async function listRfqs(params: {
  search?: string
  status?: string
  page?: number
  limit?: number
  purchaseRequisitionId?: string
} = {}): Promise<{ items: RfqSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<RfqSummary[]>(
    tenantPath(
      `/purchase/rfqs${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
        purchaseRequisitionId: params.purchaseRequisitionId,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function getRfq(id: string): Promise<RfqSummary> {
  const res = await apiClient.get<RfqSummary>(tenantPath(`/purchase/rfqs/${id}`))
  return res.data
}

export async function sendRfq(id: string, remarks?: string): Promise<RfqSummary> {
  const res = await apiClient.post<RfqSummary>(
    tenantPath(`/purchase/rfqs/${id}/send`),
    { remarks },
    { retries: 0 },
  )
  return res.data
}

export async function convertPrToRfq(
  prId: string,
  body: { title?: string; remarks?: string; vendorIds?: string[] } = {},
): Promise<RfqSummary> {
  const res = await apiClient.post<RfqSummary>(
    tenantPath(`/purchase/requisitions/${prId}/convert-to-rfq`),
    body,
    { retries: 0 },
  )
  return res.data
}

// ─── Invoices ──────────────────────────────────────────────────────────────

export interface PurchaseInvoiceLine {
  id?: string
  itemCode?: string
  itemName?: string
  quantity?: number
  rate?: number
  amount?: number
  lineTotal?: number
  [key: string]: unknown
}

export interface PurchaseInvoiceSummary {
  id: string
  invoiceNumber?: string
  vendorInvoiceNumber?: string | null
  invoiceDate?: string | null
  status?: string
  vendorId?: string
  vendorName?: string | null
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
  goodsReceiptId?: string | null
  goodsReceiptNumber?: string | null
  totalAmount?: number
  subtotalAmount?: number
  taxAmount?: number
  currencyCode?: string
  remarks?: string | null
  lines?: PurchaseInvoiceLine[]
  allowedActions?: {
    canEdit?: boolean
    canSubmit?: boolean
    canApprove?: boolean
    canPost?: boolean
    canCancel?: boolean
  }
  [key: string]: unknown
}

export async function listPurchaseInvoices(params: {
  search?: string
  status?: string
  page?: number
  limit?: number
} = {}): Promise<{ items: PurchaseInvoiceSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<PurchaseInvoiceSummary[]>(
    tenantPath(
      `/purchase/invoices${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function getPurchaseInvoice(id: string): Promise<PurchaseInvoiceSummary> {
  const res = await apiClient.get<PurchaseInvoiceSummary>(
    tenantPath(`/purchase/invoices/${id}`),
  )
  return res.data
}

export async function submitPurchaseInvoice(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/invoices/${id}/submit`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseInvoiceSummary
}

export async function approvePurchaseInvoice(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/invoices/${id}/approve`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseInvoiceSummary
}

// ─── Returns ───────────────────────────────────────────────────────────────

export interface PurchaseReturnLine {
  id?: string
  goodsReceiptLineId?: string | null
  purchaseOrderLineId?: string | null
  itemId?: string | null
  itemCode?: string
  itemName?: string
  returnQuantity?: number
  rate?: number
  amount?: number
  [key: string]: unknown
}

export interface PurchaseReturnSummary {
  id: string
  returnNumber?: string
  returnDate?: string | null
  status?: string
  returnType?: string
  vendorId?: string
  vendorName?: string | null
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
  goodsReceiptId?: string | null
  goodsReceiptNumber?: string | null
  qualityInspectionId?: string | null
  reason?: string | null
  remarks?: string | null
  totalAmount?: number
  totalQuantity?: number
  lines?: PurchaseReturnLine[]
  allowedActions?: {
    canEdit?: boolean
    canSubmit?: boolean
    canComplete?: boolean
    canCancel?: boolean
  }
  [key: string]: unknown
}

export type CreateReturnInput = {
  vendorId: string
  purchaseOrderId?: string | null
  goodsReceiptId?: string | null
  qualityInspectionId?: string | null
  warehouseId?: string | null
  returnType?: 'CREDIT' | 'REPLACEMENT' | 'REPAIR' | 'INSPECTION' | 'SCRAP_VENDOR'
  reason: string
  remarks?: string | null
  lines: Array<{
    goodsReceiptLineId?: string | null
    purchaseOrderLineId?: string | null
    itemId?: string | null
    itemCode?: string
    itemName?: string
    returnQuantity: number
    rate?: number
    remarks?: string | null
  }>
}

export async function listPurchaseReturns(params: {
  search?: string
  status?: string
  page?: number
  limit?: number
  goodsReceiptId?: string
} = {}): Promise<{ items: PurchaseReturnSummary[]; meta: PaginationMeta | null }> {
  const res = await apiClient.get<PurchaseReturnSummary[]>(
    tenantPath(
      `/purchase/returns${qs({
        page: params.page ?? 1,
        limit: params.limit ?? 30,
        search: params.search,
        status: params.status,
        goodsReceiptId: params.goodsReceiptId,
      })}`,
    ),
  )
  return { items: unwrapList(res.data), meta: res.meta ?? null }
}

export async function getPurchaseReturn(id: string): Promise<PurchaseReturnSummary> {
  const res = await apiClient.get<PurchaseReturnSummary>(
    tenantPath(`/purchase/returns/${id}`),
  )
  return res.data
}

export async function getReturnPrefillFromQi(qualityInspectionId: string) {
  const res = await apiClient.get<Record<string, unknown>>(
    tenantPath(`/purchase/quality-inspections/${qualityInspectionId}/purchase-return-prefill`),
  )
  return res.data
}

export async function createPurchaseReturn(body: CreateReturnInput) {
  const res = await apiClient.post(tenantPath('/purchase/returns'), body, { retries: 0 })
  return res.data as PurchaseReturnSummary
}

export async function submitPurchaseReturn(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/returns/${id}/submit`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseReturnSummary
}

export async function approvePurchaseReturn(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/returns/${id}/approve`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseReturnSummary
}

export async function shipPurchaseReturn(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/returns/${id}/ship`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseReturnSummary
}

export async function completePurchaseReturn(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/returns/${id}/complete`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseReturnSummary
}

// ─── Purchase QI decisions ─────────────────────────────────────────────────

export interface PurchaseQiDetail extends QualityInspectionSummary {
  lines?: Array<{
    id?: string
    itemCodeSnapshot?: string
    itemNameSnapshot?: string
    itemCode?: string
    itemName?: string
    inspectedQuantity?: number
    acceptedQuantity?: number
    rejectedQuantity?: number
    [key: string]: unknown
  }>
  allowedActions?: {
    canEdit?: boolean
    canComplete?: boolean
    canCancel?: boolean
  }
  decisionCode?: string | null
  decisionReason?: string | null
  remarks?: string | null
}

export async function getPurchaseQualityInspection(id: string): Promise<PurchaseQiDetail> {
  const res = await apiClient.get<PurchaseQiDetail>(
    tenantPath(`/purchase/quality-inspections/${id}`),
  )
  return res.data
}

export async function startPurchaseQualityInspection(id: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/quality-inspections/${id}/start`),
    {},
    { retries: 0 },
  )
  return res.data as PurchaseQiDetail
}

export async function acceptPurchaseQualityInspection(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/quality-inspections/${id}/accept`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseQiDetail
}

export async function rejectPurchaseQualityInspection(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/quality-inspections/${id}/reject`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseQiDetail
}

export async function holdPurchaseQualityInspection(id: string, remarks?: string) {
  const res = await apiClient.post(
    tenantPath(`/purchase/quality-inspections/${id}/hold`),
    { remarks },
    { retries: 0 },
  )
  return res.data as PurchaseQiDetail
}

export function isQiActionable(status?: string | null): boolean {
  const st = String(status || '').toUpperCase()
  return ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(st)
}

// Re-export create payload type for offline queue typing
export type { CreateGrnInput, GrnSummary }
