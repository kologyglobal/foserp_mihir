/**
 * Purchase API DTOs / payloads — aligned with backend purchase modules.
 * Domain UI models remain in `purchaseDomain.ts`; map via `purchaseMappers.ts`.
 */

export type PurchaseApiPaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PurchaseApiListResponse<T> = {
  items: T[]
  meta: PurchaseApiPaginationMeta
}

/* ─── Status / enum values (API wire format = lowercase snake) ─── */

export type ApiPurchaseRequisitionStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'partially_converted'
  | 'converted_to_po'
  | 'cancelled'
  | 'closed'

export type ApiPurchasePriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

export type ApiPurchasePlanningStatus =
  | 'pending_planning'
  | 'under_review'
  | 'vendor_selected'
  | 'approved'
  | 'po_pending'
  | 'po_created'
  | 'partially_ordered'
  | 'on_hold'
  | 'cancelled'
  | 'completed'

export type ApiPurchasePlanningPurchaseType =
  | 'direct_purchase'
  | 'rfq_based'
  | 'rate_contract'
  | 'other'

export type ApiRfqStatus =
  | 'draft'
  | 'sent'
  | 'quotation_received'
  | 'under_comparison'
  | 'vendor_selected'
  | 'converted_to_po'
  | 'cancelled'
  | 'closed'

export type ApiVendorQuotationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'selected'
  | 'rejected'
  | 'expired'
  | 'cancelled'

export type ApiPurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent_to_vendor'
  | 'partially_received'
  | 'fully_received'
  | 'cancelled'
  | 'closed'

/* ─── Requisition ─── */

export interface ApiPurchaseRequisitionLine {
  id: string
  lineNumber: number
  itemId: string | null
  itemCode: string
  itemName: string
  description: string | null
  requiredQuantity: number
  uomId: string | null
  estimatedRate: number
  estimatedAmount: number
  warehouseId: string | null
  binId: string | null
  preferredVendorId: string | null
  requiredDate: string | null
  remarks: string | null
  status: string
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiPurchaseRequisition {
  id: string
  requisitionNumber: string
  requisitionDate: string
  departmentId: string | null
  requestedById: string | null
  warehouseId: string | null
  requiredDate: string | null
  priority: ApiPurchasePriority
  purchasePurpose: string | null
  rfqRequired: boolean
  status: ApiPurchaseRequisitionStatus
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  remarks: string | null
  createdById: string | null
  updatedById: string | null
  createdAt: string | null
  updatedAt: string | null
  lines: ApiPurchaseRequisitionLine[]
}

export interface ApiPurchaseRequisitionLineInput {
  id?: string
  lineNumber?: number
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  requiredQuantity: number
  uomId?: string | null
  estimatedRate?: number
  warehouseId?: string | null
  binId?: string | null
  preferredVendorId?: string | null
  requiredDate?: string | null
  remarks?: string | null
}

export interface ApiCreatePurchaseRequisitionPayload {
  requisitionDate?: string | null
  departmentId?: string | null
  requestedById?: string | null
  warehouseId?: string | null
  requiredDate?: string | null
  priority?: string
  purchasePurpose?: string | null
  rfqRequired?: boolean
  remarks?: string | null
  lines?: ApiPurchaseRequisitionLineInput[]
}

export type ApiUpdatePurchaseRequisitionPayload = Partial<ApiCreatePurchaseRequisitionPayload>

export interface ApiPurchaseRequisitionListFilters {
  page?: number
  limit?: number
  pageSize?: number
  search?: string
  status?: string
  rfqRequired?: boolean
  warehouseId?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ApiLifecycleRemarksPayload {
  remarks?: string | null
}

export interface ApiRejectPurchaseRequisitionPayload {
  reason: string
  remarks?: string | null
}

/* ─── Planning ─── */

export interface ApiPurchasePlanningRow {
  id: string
  planningNumber: string
  planningDate: string | null
  purchaseRequisitionId: string
  purchaseRequisitionLineId: string
  purchaseRequisitionNumber: string
  departmentId: string | null
  requestedById: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  itemDescription: string | null
  requiredQuantity: number
  uomId: string | null
  currentStockQuantity: number
  openPurchaseOrderQuantity: number
  netPurchaseQuantity: number
  preferredVendorId: string | null
  selectedVendorId: string | null
  lastPurchaseVendorId: string | null
  lastPurchaseRate: number | null
  expectedRate: number
  negotiatedRate: number | null
  estimatedAmount: number
  requiredDate: string | null
  purchaseType: ApiPurchasePlanningPurchaseType | string
  priority: ApiPurchasePriority | string
  buyerId: string | null
  status: ApiPurchasePlanningStatus | string
  actionMessage: boolean
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  convertedAt: string | null
  remarks: string | null
  createdById: string | null
  updatedById: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PlanningSheetSummary {
  totalPendingPlanning: number
  criticalItems: number
  overdueItems: number
  vendorSelectionPending: number
  poPending: number
  poCreated: number
  totalEstimatedPurchaseValue: number
}

export interface ApiPurchasePlanningListFilters {
  page?: number
  pageSize?: number
  limit?: number
  search?: string
  planningNumber?: string
  purchaseRequisitionNumber?: string
  status?: string
  departmentId?: string
  itemId?: string
  selectedVendorId?: string
  buyerId?: string
  priority?: string
  purchaseType?: string
  planningDateFrom?: string
  planningDateTo?: string
  requiredDateFrom?: string
  requiredDateTo?: string
  overdue?: boolean
  poPending?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ApiUpdatePlanningRowPayload {
  selectedVendorId?: string | null
  expectedRate?: number
  negotiatedRate?: number | null
  requiredDate?: string | null
  purchaseType?: string
  buyerId?: string | null
  priority?: string
  actionMessage?: boolean
  remarks?: string | null
  status?: string
}

export interface ApiBulkAssignBuyerPayload {
  rowIds: string[]
  buyerId: string
}

export interface ApiBulkSelectVendorPayload {
  rowIds: string[]
  vendorId: string
  expectedRate?: number | null
  negotiatedRate?: number | null
}

export interface ApiBulkStatusPayload {
  rowIds: string[]
  status: string
  reason?: string | null
}

export interface ApiRecalculatePlanningPayload {
  rowIds?: string[]
}

/* ─── RFQ / VQ / PO ─── */

export interface ApiRfqVendor {
  id: string
  vendorId: string
  inviteStatus: string
  invitedAt: string | null
  respondedAt: string | null
  remarks: string | null
}

export interface ApiRfqLine {
  id: string
  lineNumber: number
  purchaseRequisitionLineId?: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  description?: string | null
  quantity: number
  requiredQuantity?: number
  uomId: string | null
  targetRate?: number | null
  requiredDate?: string | null
  remarks: string | null
}

export interface ApiRequestForQuotation {
  id: string
  rfqNumber: string
  rfqDate: string | null
  purchaseRequisitionId: string | null
  title: string | null
  responseDueDate: string | null
  status: ApiRfqStatus | string
  remarks: string | null
  sentAt?: string | null
  closedAt?: string | null
  createdById?: string | null
  updatedById?: string | null
  vendors?: ApiRfqVendor[]
  lines?: ApiRfqLine[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiVendorQuotationLine {
  id: string
  lineNumber: number
  requestForQuotationLineId?: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  description?: string | null
  quantity: number
  uomId?: string | null
  rate: number
  amount: number
  leadTimeDays?: number | null
  remarks?: string | null
}

export interface ApiVendorQuotation {
  id: string
  quotationNumber: string
  quotationDate: string | null
  requestForQuotationId: string | null
  vendorId: string
  status: ApiVendorQuotationStatus | string
  currencyCode?: string
  validUntil?: string | null
  paymentTerms?: string | null
  deliveryTerms?: string | null
  warranty?: string | null
  basicRateTotal?: number
  totalAmount: number
  discountAmount?: number
  taxAmount?: number
  freightAmount?: number
  otherCharges?: number
  landedCost?: number
  leadTimeDays?: number | null
  remarks?: string | null
  submittedAt?: string | null
  lines?: ApiVendorQuotationLine[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiPurchaseOrderLine {
  id: string
  lineNumber: number
  itemId: string | null
  itemCode: string
  itemName: string
  description: string | null
  quantity: number
  uomId: string | null
  rate: number
  amount: number
  receivedQuantity?: number
  requiredDate: string | null
  purchaseRequisitionLineId: string | null
  purchasePlanningRowId: string | null
  remarks: string | null
}

export interface ApiPurchaseOrder {
  id: string
  orderNumber: string
  orderDate: string | null
  vendorId: string
  vendorCode?: string
  vendorName?: string
  vendorGstin?: string
  vendorState?: string
  vendorAddress?: string
  vendorCity?: string
  status: ApiPurchaseOrderStatus | string
  origin: string
  purchaseRequisitionId: string | null
  purchaseRequisitionNumber?: string | null
  requestForQuotationId?: string | null
  requestForQuotationNumber?: string | null
  vendorQuotationId?: string | null
  vendorComparisonId?: string | null
  currencyCode?: string
  expectedDeliveryDate?: string | null
  paymentTerms?: string | null
  deliveryTerms?: string | null
  subtotalAmount?: number
  taxAmount?: number
  freightAmount?: number
  totalAmount: number
  remarks?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
  sentAt?: string | null
  closedAt?: string | null
  cancelledAt?: string | null
  lines?: ApiPurchaseOrderLine[]
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ApiCreatePoFromPlanningPayload {
  rowIds: string[]
  seriesPrefix?: string
}
