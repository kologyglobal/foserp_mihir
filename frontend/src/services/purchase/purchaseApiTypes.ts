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
  | 'rejected'
  | 'sent_back'
  | 'sent_to_vendor'
  | 'partially_received'
  | 'fully_received'
  | 'partially_invoiced'
  | 'fully_invoiced'
  | 'cancelled'
  | 'closed'

export interface ApiPurchaseOrderAllowedActions {
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
  vendorCode?: string
  vendorName?: string
  gstin?: string
  state?: string
  contactPerson?: string
  contactEmail?: string
  contactPhone?: string
  vendorRating?: number | null
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
  purchaseRequisitionNumber?: string | null
  warehouseId?: string | null
  warehouseCode?: string
  warehouseName?: string
  title: string | null
  responseDueDate: string | null
  status: ApiRfqStatus | string
  remarks: string | null
  sentAt?: string | null
  closedAt?: string | null
  createdById?: string | null
  createdByName?: string | null
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
  requestForQuotationNumber?: string | null
  vendorId: string
  vendorCode?: string
  vendorName?: string
  vendorGstin?: string
  vendorState?: string
  vendorReferenceNumber?: string | null
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
  acceptedQuantity?: number
  rejectedQuantity?: number
  returnedQuantity?: number
  invoicedQuantity?: number
  openQuantity?: number
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
  deliveryWarehouseId?: string | null
  deliveryWarehouseCode?: string
  deliveryWarehouseName?: string
  deliveryWarehousePlantId?: string | null
  createdById?: string | null
  createdByName?: string | null
  subtotalAmount?: number
  taxAmount?: number
  freightAmount?: number
  totalAmount: number
  remarks?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  sentBackAt?: string | null
  sendBackReason?: string | null
  sentAt?: string | null
  closedAt?: string | null
  cancelledAt?: string | null
  allowedActions?: ApiPurchaseOrderAllowedActions
  lines?: ApiPurchaseOrderLine[]
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ApiPurchaseOrderLineInput {
  id?: string
  lineNumber?: number
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description?: string | null
  quantity: number
  uomId?: string | null
  rate?: number
  requiredDate?: string | null
  remarks?: string | null
  purchaseRequisitionLineId?: string | null
  purchasePlanningRowId?: string | null
}

export interface ApiPurchaseOrderInput {
  orderDate?: string
  vendorId: string
  purchaseRequisitionId?: string | null
  expectedDeliveryDate?: string | null
  currencyCode?: string
  paymentTerms?: string | null
  deliveryTerms?: string | null
  deliveryWarehouseId?: string | null
  freightAmount?: number
  taxAmount?: number
  remarks?: string | null
  lines: ApiPurchaseOrderLineInput[]
}

export interface ApiCreatePoFromPlanningPayload {
  rowIds: string[]
  seriesPrefix?: string
}

export type ApiGoodsReceiptStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RECEIVING_COMPLETED'
  | 'QC_PENDING'
  | 'PARTIALLY_ACCEPTED'
  | 'FULLY_ACCEPTED'
  | 'INVENTORY_POSTED'
  | 'CANCELLED'
  | 'REVERSED'
  | 'CLOSED'
  | string

export interface ApiGoodsReceiptAllowedActions {
  canEdit: boolean
  canSubmit: boolean
  canCancel: boolean
  canReverse: boolean
}

export interface ApiGoodsReceiptLine {
  id: string
  lineNumber: number
  purchaseOrderLineId: string
  itemId: string | null
  itemCode: string
  itemName: string
  description: string | null
  uomId: string | null
  uom: string
  orderedQuantity: number
  previouslyReceivedQuantity: number
  openQuantity: number
  challanQuantity: number
  receivedQuantity: number
  damagedQuantity: number
  shortQuantity: number
  excessQuantity: number
  acceptedForQcQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
  rate: number
  amount: number
  warehouseId: string | null
  storageLocationId: string | null
  binId: string | null
  binCode: string
  batchNumber: string | null
  heatNumber: string | null
  lotNumber: string | null
  serialNumber: string | null
  manufacturingDate: string | null
  expiryDate: string | null
  qcRequired: boolean
  remarks: string | null
}

export interface ApiGoodsReceipt {
  id: string
  grnNumber: string
  documentNumber: string
  receiptDate: string | null
  documentDate: string | null
  status: ApiGoodsReceiptStatus
  purchaseOrderId: string
  purchaseOrderNumber: string
  vendorId: string
  vendorCode: string
  vendorName: string
  vendorGstin: string
  plantId: string | null
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  storageLocationId: string | null
  storageLocationCode: string
  storageLocationName: string
  vendorChallanNumber: string | null
  vendorChallanDate: string | null
  vendorInvoiceNumber: string | null
  vehicleNumber: string | null
  transporterName: string | null
  lrNumber: string | null
  gateEntryNumber: string | null
  receivedById: string | null
  receivedByName: string | null
  inspectionRequired: boolean
  allowExcess: boolean
  remarks: string | null
  submittedAt: string | null
  cancelledAt: string | null
  reversedAt: string | null
  closedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  lineCount: number
  totalReceivedQty: number
  totalAcceptedQty: number
  totalRejectedQty: number
  totalAmount: number
  currencyCode: string
  expectedDeliveryDate: string | null
  paymentTerms: string
  deliveryTerms: string
  allowedActions: ApiGoodsReceiptAllowedActions
  lines: ApiGoodsReceiptLine[]
}

export interface ApiReceivableLine {
  purchaseOrderLineId: string
  lineNumber: number
  itemId: string | null
  itemCode: string
  itemName: string
  description: string | null
  uomId: string | null
  uom: string
  orderedQuantity: number
  previouslyReceivedQuantity: number
  openQuantity: number
  rate: number
}

export interface ApiReceivableLinesResponse {
  purchaseOrderId: string
  orderNumber: string
  status: string
  vendorId: string
  vendorCode: string
  vendorName: string
  lines: ApiReceivableLine[]
}

/* ─── Purchase Invoice (backend `/purchase/invoices`) ─── */

export type ApiPurchaseInvoiceStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'MISMATCH'
  | 'POSTED'
  | 'CANCELLED'
  | 'CLOSED'

export interface ApiPurchaseInvoiceAllowedActions {
  canEdit: boolean
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canPost: boolean
  canCancel: boolean
}

export interface ApiPurchaseInvoiceLine {
  id: string
  purchaseInvoiceId: string
  lineNumber: number
  purchaseOrderLineId: string | null
  goodsReceiptLineId: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  description: string | null
  quantity: number
  uomCodeSnapshot: string | null
  rate: number
  amount: number
  taxRatePct: number
  taxAmount: number
  lineTotal: number
  remarks: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiPurchaseInvoice {
  id: string
  invoiceNumber: string
  documentNumber: string
  invoiceDate: string | null
  documentDate: string | null
  vendorInvoiceNumber: string | null
  vendorInvoiceDate: string | null
  vendorId: string
  purchaseOrderId: string | null
  goodsReceiptId: string | null
  status: ApiPurchaseInvoiceStatus
  isDirectInvoice: boolean
  currencyCode: string
  gstScheme: 'CGST_SGST' | 'IGST' | null
  placeOfSupplyState: string | null
  placeOfSupplyStateCode: string | null
  reverseCharge: boolean
  subtotalAmount: number
  taxAmount: number
  roundOffAmount: number
  totalAmount: number
  matchingStatus: string | null
  matchingRemarks: string | null
  overrideAuthorized: boolean
  overrideRemarks: string | null
  remarks: string | null
  submittedAt: string | null
  approvedAt: string | null
  postedAt: string | null
  cancelledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  allowedActions: ApiPurchaseInvoiceAllowedActions
  lines: ApiPurchaseInvoiceLine[]
}

/* ─── Quality Inspection (backend `/purchase/quality-inspections`) ─── */

export type ApiQualityInspectionStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'ACCEPTED'
  | 'PARTIALLY_ACCEPTED'
  | 'REJECTED'
  | 'DEVIATION_PENDING'
  | 'CLOSED'
  | 'CANCELLED'

export interface ApiQualityInspectionLine {
  id: string
  qualityInspectionId: string
  lineNumber: number
  goodsReceiptLineId: string | null
  purchaseOrderLineId: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  inspectedQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
  deviationQuantity: number
  remarks: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiQualityInspection {
  id: string
  inspectionNumber: string
  documentNumber: string
  documentDate: string | null
  inspectionDate: string | null
  goodsReceiptId: string | null
  goodsReceiptNumber?: string | null
  purchaseOrderId: string | null
  purchaseOrderNumber?: string | null
  vendorId: string | null
  warehouseId: string | null
  status: ApiQualityInspectionStatus
  remarks: string | null
  deviationRemarks: string | null
  inspectedById: string | null
  inspectedByName: string | null
  batchLotNo?: string | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  allowedActions: { canEdit: boolean; canComplete: boolean; canCancel: boolean }
  totals: { inspected: number; accepted: number; rejected: number; deviation: number }
  lines: ApiQualityInspectionLine[]
}

/* ─── Purchase Return (backend `/purchase/returns`) ─── */

export type ApiPurchaseReturnStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLOSED'

export interface ApiPurchaseReturnLine {
  id: string
  purchaseReturnId: string
  lineNumber: number
  goodsReceiptLineId: string | null
  purchaseOrderLineId: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  returnQuantity: number
  rate: number
  amount: number
  remarks: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiPurchaseReturn {
  id: string
  returnNumber: string
  documentNumber: string
  documentDate: string | null
  returnDate: string | null
  vendorId: string
  purchaseOrderId: string | null
  goodsReceiptId: string | null
  qualityInspectionId: string | null
  warehouseId: string | null
  status: ApiPurchaseReturnStatus
  reason: string | null
  remarks: string | null
  submittedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  allowedActions: { canEdit: boolean; canSubmit: boolean; canComplete: boolean; canCancel: boolean }
  totalAmount: number
  totalQuantity: number
  lines: ApiPurchaseReturnLine[]
}

