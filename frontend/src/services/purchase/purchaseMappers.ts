import { formatApiError, ApiError } from '../api/apiErrors'
import { mapPurchaseErrorMessage, isTechnicalPurchaseMessage } from '../../utils/purchase/purchaseErrorMessages'
import { getStoredSession } from '../api/client'
import { useMasterStore } from '../../store/masterStore'
import type {
  ApiPurchaseOrder,
  ApiPurchasePlanningRow,
  ApiPurchaseRequisition,
  ApiPurchaseRequisitionLine,
  ApiPurchaseRequisitionLineInput,
  ApiCreatePurchaseRequisitionPayload,
  ApiRequestForQuotation,
  ApiVendorQuotation,
  ApiGoodsReceipt,
  ApiPurchaseInvoice,
  ApiQualityInspection,
  ApiPurchaseReturn,
} from './purchaseApiTypes'
import type { ApiVendorComparison } from './comparisonApi'
import type {
  PurchaseOrder,
  PurchaseOrderDomainStatus,
  PurchaseOrderInput,
  PurchaseOrderLine,
  PurchaseOrderListRow,
  PurchaseOrderOrigin,
  PurchasePlanningPriority,
  PurchasePlanningPurchaseType,
  PurchasePlanningSheetRow,
  PurchasePlanningStatus,
  PurchaseRequisition,
  PurchaseRequisitionInput,
  PurchaseRequisitionLine,
  PurchaseRequisitionListRow,
  PurchaseRequisitionPriority,
  PurchaseRequisitionStatus,
  QuotationComparison,
  QuotationComparisonQuoteCell,
  QuotationComparisonRow,
  RequestForQuotation,
  RFQVendor,
  RfqDomainStatus,
  RfqLine,
  RfqListRow,
  RfqVendorInviteStatus,
  VendorQuotation,
  VendorQuotationDomainStatus,
  VendorQuotationLine,
  VendorQuotationListRow,
  GoodsReceiptNote,
  GrnDomainStatus,
  GrnInput,
  GrnListRow,
  PurchaseInvoice,
  PurchaseInvoiceInput,
  PurchaseInvoiceListRow,
  PurchaseInvoiceOrigin,
  PurchaseInvoiceStatus,
  PurchaseGstScheme,
  InvoiceMatchingResultStatus,
  QualityInspection,
  QualityInspectionInput,
  QualityInspectionListRow,
  QualityInspectionResult,
  QualityInspectionStatus,
  PurchaseReturn,
  PurchaseReturnDomainStatus,
  PurchaseReturnInput,
  PurchaseReturnLineInput,
  PurchaseReturnListRow,
  PurchaseReturnOrigin,
  PurchaseReturnReason,
} from '../../types/purchaseDomain'
import {
  PURCHASE_ORDER_APPROVAL_STATUS_LABELS,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_ORDER_INVOICE_STATUS_LABELS,
  PURCHASE_REQUISITION_APPROVAL_STATUS_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  RFQ_DOMAIN_STATUS_LABELS,
  VENDOR_QUOTATION_DOMAIN_STATUS_LABELS,
  PURCHASE_INVOICE_STATUS_LABELS,
  PURCHASE_INVOICE_ORIGIN_LABELS,
  INVOICE_MATCHING_RESULT_STATUS_LABELS,
  QUALITY_INSPECTION_STATUS_LABELS,
  QUALITY_INSPECTION_RESULT_LABELS,
  PURCHASE_RETURN_DOMAIN_STATUS_LABELS,
  PURCHASE_RETURN_ORIGIN_LABELS,
  PURCHASE_RETURN_REASON_LABELS,
  type PurchaseRequisitionApprovalStatus,
} from '../../types/purchaseDomain'

const EMPTY_PARTY = { id: '', code: '', name: '' }
const EMPTY_LOCATION = { id: '', code: '', name: '', state: '', city: '' }

export function formatPurchaseApiError(err: unknown): { code: string; message: string } {
  if (err instanceof ApiError) {
    const code = err.code ?? `HTTP_${err.statusCode}`
    const raw =
      err.fieldErrors?.length && !isTechnicalPurchaseMessage(err.message)
        ? formatApiError(err)
        : err.message || formatApiError(err)
    return { code, message: mapPurchaseErrorMessage(code, raw) }
  }
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const code = String((err as { code: string }).code)
    const raw = String((err as { message: string }).message)
    return { code, message: mapPurchaseErrorMessage(code, raw) }
  }
  return {
    code: 'PURCHASE_API_ERROR',
    message: mapPurchaseErrorMessage(undefined, formatApiError(err)),
  }
}

export function isBackendMissingError(err: unknown): boolean {
  const { code, message } = formatPurchaseApiError(err)
  const lower = message.toLowerCase()
  return (
    code === 'HTTP_404' ||
    code === 'NOT_FOUND' ||
    lower.includes('cannot post') ||
    lower.includes('cannot get') ||
    (lower.includes('not found') && lower.includes('route'))
  )
}

function mapPrStatus(status: string): PurchaseRequisitionStatus {
  const s = status.toLowerCase()
  if (s === 'submitted') return 'pending_approval'
  if (s === 'partially_converted') return 'converted_to_po'
  if (
    s === 'draft' ||
    s === 'pending_approval' ||
    s === 'approved' ||
    s === 'rejected' ||
    s === 'converted_to_rfq' ||
    s === 'converted_to_po' ||
    s === 'closed' ||
    s === 'cancelled'
  ) {
    return s
  }
  return 'draft'
}

function mapPrPriority(priority: string): PurchaseRequisitionPriority {
  const p = priority.toLowerCase()
  if (p === 'critical') return 'urgent'
  if (p === 'low' || p === 'normal' || p === 'high' || p === 'urgent') return p
  return 'normal'
}

function toApiPriority(priority?: PurchaseRequisitionPriority | string | null): string {
  const p = (priority ?? 'normal').toLowerCase()
  if (p === 'medium') return 'NORMAL'
  return p.toUpperCase()
}

function mapPlanningStatus(status: string): PurchasePlanningStatus {
  const s = status.toLowerCase()
  switch (s) {
    case 'pending_planning':
      return 'draft'
    case 'under_review':
      return 'pending_review'
    case 'on_hold':
      return 'pending_review'
    case 'vendor_selected':
    case 'approved':
    case 'po_pending':
    case 'po_created':
    case 'partially_ordered':
    case 'completed':
    case 'cancelled':
    case 'draft':
    case 'pending_review':
      return s as PurchasePlanningStatus
    default:
      return 'draft'
  }
}

function mapPlanningPriority(priority: string): PurchasePlanningPriority {
  const p = priority.toLowerCase()
  if (p === 'normal' || p === 'medium') return 'medium'
  if (p === 'urgent') return 'high'
  if (p === 'low' || p === 'high' || p === 'critical') return p as PurchasePlanningPriority
  return 'medium'
}

function toApiPlanningPriority(priority?: PurchasePlanningPriority | string | null): string {
  const p = (priority ?? 'medium').toLowerCase()
  if (p === 'medium') return 'NORMAL'
  if (p === 'critical') return 'CRITICAL'
  return p.toUpperCase()
}

function mapPurchaseType(type: string): PurchasePlanningPurchaseType {
  const t = type.toLowerCase()
  if (t === 'rate_contract') return 'rate_contract'
  if (t === 'rfq_based') return 'direct_purchase'
  if (
    t === 'direct_purchase' ||
    t === 'repeat_purchase' ||
    t === 'emergency_purchase' ||
    t === 'local_purchase' ||
    t === 'import_purchase'
  ) {
    return t
  }
  return 'direct_purchase'
}

function toApiPurchaseType(type?: PurchasePlanningPurchaseType | string | null): string {
  const t = (type ?? 'direct_purchase').toLowerCase()
  if (t === 'rate_contract') return 'RATE_CONTRACT'
  return 'DIRECT_PURCHASE'
}

function emptyMoney() {
  return {
    currency: 'INR' as const,
    subtotal: 0,
    discount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    freight: 0,
    otherCharges: 0,
    roundOff: 0,
    totalAmount: 0,
  }
}

function resolveRequesterDisplayName(requestedById: string | null | undefined): string {
  const id = (requestedById ?? '').trim()
  if (!id) return ''
  const session = getStoredSession()
  if (session?.user?.id === id) {
    const name = `${session.user.firstName ?? ''} ${session.user.lastName ?? ''}`.trim()
    return name || session.user.email || id
  }
  return id
}

/** Resolve vendor display name/code from master store (API mode planning/PR maps). */
function resolveVendorFromMaster(vendorId: string | null | undefined): {
  name: string | null
  code: string | null
} {
  const id = (vendorId ?? '').trim()
  if (!id) return { name: null, code: null }
  const vendor = useMasterStore.getState().vendors.find((v) => v.id === id)
  if (!vendor) return { name: null, code: null }
  return {
    name: vendor.vendorName?.trim() || null,
    code: vendor.vendorCode?.trim() || null,
  }
}

/** Resolve warehouse display from master store (API PRs store warehouseId only). */
function resolveWarehouseFromMaster(warehouseId: string | null | undefined): {
  id: string
  code: string
  name: string
  state: string
  city: string
} {
  const id = (warehouseId ?? '').trim()
  if (!id) return { ...EMPTY_LOCATION }
  const warehouse = useMasterStore.getState().warehouses.find((w) => w.id === id)
  return {
    id,
    code: warehouse?.warehouseCode?.trim() || '',
    name: warehouse?.warehouseName?.trim() || warehouse?.warehouseCode?.trim() || '—',
    state: '',
    city: '',
  }
}

function resolveUomId(line: { uomId?: string | null; uom?: string | null }): string | null {
  const direct = (line.uomId ?? '').trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(direct)) {
    return direct
  }
  const code = (line.uom ?? '').trim()
  if (!code) return null
  const uoms = useMasterStore.getState().uoms
  const match = uoms.find(
    (u) =>
      u.uomCode?.toLowerCase() === code.toLowerCase() ||
      u.uomName?.toLowerCase() === code.toLowerCase(),
  )
  return match?.id ?? null
}

export function mapApiLineToDomain(line: ApiPurchaseRequisitionLine): PurchaseRequisitionLine {
  return {
    id: line.id,
    lineNo: line.lineNumber,
    itemType: 'inventory',
    itemId: line.itemId ?? '',
    itemCode: line.itemCode ?? '',
    itemName: line.itemName ?? '',
    specification: line.description ?? '',
    category: 'consumable',
    uomId: line.uomId ?? null,
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: Number(line.requiredQuantity ?? 0),
    estimatedRate: Number(line.estimatedRate ?? 0),
    amount: Number(line.estimatedAmount ?? 0),
    currentStock: 0,
    openPoQty: 0,
    preferredVendorId: line.preferredVendorId,
    preferredVendorName: resolveVendorFromMaster(line.preferredVendorId).name,
    vendorNumber: '',
    requiredDate: line.requiredDate ?? '',
    orderDate: '',
    customerName: '',
    locationId: line.warehouseId ?? '',
    locationName: resolveWarehouseFromMaster(line.warehouseId).name,
    binCode: line.binId ?? '',
    purchaseOrderId: line.purchaseOrderId ?? null,
    purchaseOrderNumber: line.purchaseOrderNumber ?? '',
    purchaseQuoteNumber: '',
    purpose: '',
    remarks: line.remarks ?? '',
    attachmentNote: '',
  }
}

export function mapApiRequisitionToDomain(dto: ApiPurchaseRequisition): PurchaseRequisition {
  const lines = (dto.lines ?? []).map(mapApiLineToDomain)
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const money = emptyMoney()
  money.subtotal = Number(subtotal.toFixed(2))
  money.taxableAmount = money.subtotal
  money.totalAmount = money.subtotal

  return {
    id: dto.id,
    documentNumber: dto.requisitionNumber,
    documentDate: dto.requisitionDate,
    status: mapPrStatus(dto.status),
    location: resolveWarehouseFromMaster(dto.warehouseId),
    department: dto.departmentId ?? '',
    requester: {
      id: dto.requestedById ?? '',
      code: '',
      name: resolveRequesterDisplayName(dto.requestedById),
    },
    approver: null,
    expectedDeliveryDate: dto.requiredDate,
    paymentTerms: '',
    deliveryTerms: '',
    vendor: null,
    source: 'manual',
    priority: mapPrPriority(dto.priority),
    requisitionType: 'material',
    costCentre: '',
    project: '',
    productionOrderNo: '',
    maintenanceOrderNo: '',
    referenceNumber: '',
    purpose: dto.purchasePurpose,
    lines,
    attachmentPlaceholders: [],
    approvalIds: [],
    rfqRequired: dto.rfqRequired,
    convertedRfqId: null,
    convertedPoId: null,
    estimatedTaxPct: 0,
    estimatedTaxAmount: 0,
    ...money,
    createdBy: dto.createdById ?? '',
    createdAt: dto.createdAt ?? new Date().toISOString(),
    updatedBy: dto.updatedById,
    updatedAt: dto.updatedAt,
    remarks: dto.remarks ?? '',
    attachmentIds: [],
  }
}

function approvalStatusFor(pr: PurchaseRequisition): PurchaseRequisitionApprovalStatus {
  switch (pr.status) {
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

export function mapApiRequisitionToListRow(dto: ApiPurchaseRequisition): PurchaseRequisitionListRow {
  const pr = mapApiRequisitionToDomain(dto)
  const approvalStatus = approvalStatusFor(pr)
  return {
    ...pr,
    requiredBy: pr.expectedDeliveryDate,
    itemCount: pr.lines.length,
    estimatedValue: pr.totalAmount,
    approvalStatus,
    approvalStatusLabel: PURCHASE_REQUISITION_APPROVAL_STATUS_LABELS[approvalStatus],
    sourceLabel: PURCHASE_REQUISITION_SOURCE_LABELS[pr.source],
    priorityLabel: PURCHASE_REQUISITION_PRIORITY_LABELS[pr.priority],
    statusLabel: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
    convertedRfqNumber: null,
    convertedPoNumber: null,
  }
}

export function mapDomainInputToApiPayload(
  input: PurchaseRequisitionInput,
): ApiCreatePurchaseRequisitionPayload {
  const asUuid = (value: string | null | undefined): string | null => {
    const v = (value ?? '').trim()
    if (!v) return null
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
      ? v
      : null
  }

  const session = getStoredSession()
  const requestedById =
    asUuid(input.requester?.id) ?? asUuid(session?.user?.id) ?? null

  const departmentId = (input.department ?? '').trim().slice(0, 36) || null

  const lines: ApiPurchaseRequisitionLineInput[] | undefined = input.lines
    ?.filter((line) => {
      const hasItem = Boolean(line.itemId || line.itemCode?.trim() || line.itemName?.trim())
      const qty = Number(line.quantity ?? 0)
      // Backend submit ignores incomplete lines; do not send empty/zero-qty drafts.
      return hasItem && qty > 0
    })
    .map((line, index) => ({
      id: asUuid(line.id) ?? undefined,
      lineNumber: line.lineNo ?? index + 1,
      itemId: asUuid(line.itemId),
      itemCode: line.itemCode ?? '',
      itemName: line.itemName ?? '',
      description: line.specification?.trim() ? line.specification : null,
      requiredQuantity: Number(line.quantity ?? 0),
      uomId: resolveUomId(line),
      estimatedRate: Number(line.estimatedRate ?? 0),
      warehouseId: asUuid(line.locationId) ?? asUuid(input.location?.id),
      binId: line.binCode?.trim() ? line.binCode.trim().slice(0, 36) : null,
      preferredVendorId: asUuid(line.preferredVendorId),
      requiredDate: line.requiredDate || null,
      remarks: line.remarks?.trim() ? line.remarks : null,
    }))

  return {
    requisitionDate: input.documentDate ?? undefined,
    departmentId,
    requestedById,
    warehouseId: asUuid(input.location?.id),
    requiredDate: input.expectedDeliveryDate ?? null,
    priority: toApiPriority(input.priority),
    purchasePurpose: input.purpose?.trim() ? input.purpose : null,
    rfqRequired: input.rfqRequired,
    remarks: input.remarks?.trim() ? input.remarks : null,
    lines,
  }
}

export function mapApiPlanningRowToDomain(row: ApiPurchasePlanningRow): PurchasePlanningSheetRow {
  const selectedVendorId = row.selectedVendorId ?? row.preferredVendorId
  const selectedVendor = resolveVendorFromMaster(selectedVendorId)
  const lastVendor = resolveVendorFromMaster(row.lastPurchaseVendorId)
  return {
    id: row.id,
    planningNumber: row.planningNumber,
    planningDate: row.planningDate ?? '',
    purchaseRequisitionId: row.purchaseRequisitionId,
    purchaseRequisitionNumber: row.purchaseRequisitionNumber,
    purchaseRequisitionLineId: row.purchaseRequisitionLineId,
    department: row.departmentId ?? '',
    requestedById: row.requestedById ?? '',
    requestedByName: resolveRequesterDisplayName(row.requestedById),
    itemId: row.itemId ?? '',
    itemCode: row.itemCode ?? '',
    itemName: row.itemName ?? '',
    specification: row.itemDescription ?? '',
    itemCategory: 'consumable',
    requiredQuantity: Number(row.requiredQuantity ?? 0),
    uom: 'NOS',
    requiredByDate: row.requiredDate ?? '',
    currentStock: Number(row.currentStockQuantity ?? 0),
    openPoQuantity: Number(row.openPurchaseOrderQuantity ?? 0),
    netPurchaseQuantity: Number(row.netPurchaseQuantity ?? 0),
    preferredVendorId: selectedVendorId,
    preferredVendorName: selectedVendor.name,
    preferredVendorCode: selectedVendor.code,
    lastPurchaseVendorId: row.lastPurchaseVendorId,
    lastPurchaseVendorName: lastVendor.name,
    lastPurchaseRate: row.lastPurchaseRate,
    expectedRate: Number(row.expectedRate ?? 0),
    negotiatedRate: row.negotiatedRate == null ? null : Number(row.negotiatedRate),
    estimatedAmount: Number(row.estimatedAmount ?? 0),
    purchaseType: mapPurchaseType(String(row.purchaseType ?? 'direct_purchase')),
    priority: mapPlanningPriority(String(row.priority ?? 'normal')),
    buyerId: row.buyerId ?? '',
    buyerName: row.buyerId ?? '',
    status: mapPlanningStatus(String(row.status)),
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderNumber: row.purchaseOrderNumber,
    orderDate: '',
    actionMessage: Boolean(row.actionMessage),
    remarks: row.remarks ?? '',
    createdBy: row.createdById ?? '',
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedBy: row.updatedById,
    updatedAt: row.updatedAt,
  }
}

export function mapPlanningPatchToApi(patch: {
  selectedVendorId?: string | null
  expectedRate?: number
  negotiatedRate?: number | null
  requiredByDate?: string
  purchaseType?: PurchasePlanningPurchaseType | string
  buyerId?: string | null
  priority?: PurchasePlanningPriority | string
  actionMessage?: boolean
  remarks?: string | null
  status?: PurchasePlanningStatus | string
}) {
  const statusMap: Record<string, string> = {
    draft: 'PENDING_PLANNING',
    pending_review: 'UNDER_REVIEW',
    vendor_selected: 'VENDOR_SELECTED',
    approved: 'APPROVED',
    po_pending: 'PO_PENDING',
    po_created: 'PO_CREATED',
    partially_ordered: 'PARTIALLY_ORDERED',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  }
  return {
    selectedVendorId: patch.selectedVendorId,
    expectedRate: patch.expectedRate,
    negotiatedRate: patch.negotiatedRate,
    requiredDate: patch.requiredByDate,
    purchaseType: patch.purchaseType ? toApiPurchaseType(patch.purchaseType) : undefined,
    buyerId: patch.buyerId,
    priority: patch.priority ? toApiPlanningPriority(patch.priority) : undefined,
    actionMessage: patch.actionMessage,
    remarks: patch.remarks,
    status: patch.status ? statusMap[String(patch.status)] ?? String(patch.status).toUpperCase() : undefined,
  }
}

/* ─── RFQ / VQ / Comparison mappers ─── */

function mapRfqStatus(status: string): RfqDomainStatus {
  const s = status.toLowerCase()
  if (s === 'under_comparison' || s === 'vendor_selected') return 'under_evaluation'
  if (s === 'converted_to_po') return 'closed'
  if (s === 'quotation_received') return 'quotation_received'
  if (
    s === 'draft' ||
    s === 'sent' ||
    s === 'partially_quoted' ||
    s === 'under_evaluation' ||
    s === 'closed' ||
    s === 'cancelled'
  ) {
    return s
  }
  return 'draft'
}

function mapRfqVendorInviteStatus(status: string): RfqVendorInviteStatus {
  const s = status.toLowerCase()
  if (s === 'responded') return 'quoted'
  if (s === 'expired') return 'no_response'
  if (s === 'invited' || s === 'sent' || s === 'quoted' || s === 'declined' || s === 'no_response') {
    return s
  }
  return 'invited'
}

function mapVqStatus(status: string): VendorQuotationDomainStatus {
  const s = status.toLowerCase()
  if (s === 'cancelled' || s === 'closed') return 'expired'
  if (
    s === 'draft' ||
    s === 'submitted' ||
    s === 'under_review' ||
    s === 'selected' ||
    s === 'rejected' ||
    s === 'expired'
  ) {
    return s
  }
  return 'draft'
}

function emptyMoneyTotals(currency: 'INR' = 'INR') {
  return {
    currency,
    subtotal: 0,
    discount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    freight: 0,
    otherCharges: 0,
    roundOff: 0,
    totalAmount: 0,
  }
}

export function mapApiRfqToDomain(api: ApiRequestForQuotation): RequestForQuotation {
  const status = mapRfqStatus(String(api.status))
  const lines: RfqLine[] = (api.lines ?? []).map((l, idx) => ({
    id: l.id,
    lineNo: l.lineNumber ?? idx + 1,
    purchaseRequisitionId: api.purchaseRequisitionId,
    purchaseRequisitionNumber: null,
    prLineId: l.purchaseRequisitionLineId ?? null,
    itemId: l.itemId ?? '',
    itemCode: l.itemCode ?? '',
    itemName: l.itemName ?? '',
    specification: l.description ?? '',
    hsnCode: '',
    sacCode: null,
    quantity: Number(l.requiredQuantity ?? l.quantity ?? 0),
    uom: '',
    requiredDate: l.requiredDate ?? api.rfqDate ?? new Date().toISOString().slice(0, 10),
    targetPrice: Number(l.targetRate ?? 0),
    amount: Number(l.targetRate ?? 0) * Number(l.requiredQuantity ?? l.quantity ?? 0),
    remarks: l.remarks ?? '',
  }))
  const vendors: RFQVendor[] = (api.vendors ?? []).map((v) => ({
    id: v.id,
    rfqId: api.id,
    vendorId: v.vendorId,
    vendorCode: v.vendorCode ?? '',
    vendorName: v.vendorName ?? '',
    gstin: v.gstin ?? '',
    state: v.state ?? '',
    isInterstate: false,
    status: mapRfqVendorInviteStatus(v.inviteStatus),
    sentAt: v.invitedAt,
    respondedAt: v.respondedAt,
    contactPerson: v.contactPerson ?? '',
    contactEmail: v.contactEmail ?? '',
    contactPhone: v.contactPhone ?? '',
    vendorRating: Number(v.vendorRating ?? 0),
    lastPurchasePrice: null,
    selected: true,
    remarks: v.remarks ?? '',
  }))
  const estimatedValue = lines.reduce((s, l) => s + l.amount, 0)
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: api.id,
    documentNumber: api.rfqNumber,
    documentDate: api.rfqDate ?? today,
    status,
    purchaseRequisitionId: api.purchaseRequisitionId,
    purchaseRequisitionNumber: api.purchaseRequisitionNumber ?? null,
    purchaseRequisitionIds: api.purchaseRequisitionId ? [api.purchaseRequisitionId] : [],
    purchaseRequisitionNumbers: api.purchaseRequisitionNumber ? [api.purchaseRequisitionNumber] : [],
    buyer: api.createdById
      ? { id: api.createdById, code: '', name: api.createdByName ?? '' }
      : { ...EMPTY_PARTY },
    location: api.warehouseId
      ? {
          id: api.warehouseId,
          code: api.warehouseCode ?? '',
          name: api.warehouseName ?? '',
          state: '',
          city: '',
        }
      : { ...EMPTY_LOCATION },
    purchaseLocation: { ...EMPTY_LOCATION },
    deliveryLocation: { ...EMPTY_LOCATION },
    department: '',
    requester: { ...EMPTY_PARTY },
    currency: 'INR',
    paymentTerms: '',
    deliveryTerms: '',
    freightTerms: '',
    inspectionRequirement: '',
    technicalContact: '',
    commercialContact: '',
    expectedDeliveryDate: null,
    bidDueDate: api.responseDueDate ?? today,
    vendors,
    lines,
    lineItemIds: lines.map((l) => l.itemId),
    itemSummaries: lines.map((l) => ({
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      quantity: l.quantity,
      uom: l.uom,
    })),
    estimatedValue,
    selectedVendorId: null,
    comparisonId: null,
    sentAt: api.sentAt ?? null,
    createdBy: api.createdById ?? '',
    createdAt: api.createdAt ?? '',
    updatedBy: api.updatedById ?? null,
    updatedAt: api.updatedAt ?? null,
    remarks: api.remarks ?? '',
    attachmentIds: [],
  }
}

export function mapApiRfqToListRow(api: ApiRequestForQuotation): RfqListRow {
  const domain = mapApiRfqToDomain(api)
  const responsesReceived = domain.vendors.filter((v) =>
    ['quoted', 'declined'].includes(v.status),
  ).length
  return {
    id: domain.id,
    documentNumber: domain.documentNumber,
    documentDate: domain.documentDate,
    bidDueDate: domain.bidDueDate,
    buyerName: domain.buyer.name || '—',
    locationName: domain.location.name || '—',
    vendorCount: domain.vendors.length,
    itemCount: domain.lines.length,
    estimatedValue: domain.estimatedValue,
    responsesReceived,
    status: domain.status,
    statusLabel: RFQ_DOMAIN_STATUS_LABELS[domain.status],
    purchaseRequisitionNumbers: domain.purchaseRequisitionNumbers,
  }
}

export function mapDomainRfqInputToApiPayload(input: {
  documentDate?: string | null
  purchaseRequisitionId?: string | null
  bidDueDate?: string | null
  remarks?: string | null
  vendorIds: string[]
  lines?: Array<{
    prLineId?: string | null
    itemId: string
    itemCode?: string
    itemName?: string
    specification?: string
    quantity: number
    uom?: string
    requiredDate?: string | null
    targetPrice?: number
    remarks?: string
  }>
}): Record<string, unknown> {
  return {
    rfqDate: input.documentDate ?? null,
    purchaseRequisitionId: input.purchaseRequisitionId ?? null,
    responseDueDate: input.bidDueDate ?? null,
    remarks: input.remarks ?? null,
    vendorIds: input.vendorIds,
    lines: (input.lines ?? []).map((l) => ({
      purchaseRequisitionLineId: l.prLineId ?? null,
      itemId: l.itemId,
      itemCodeSnapshot: l.itemCode ?? '',
      itemNameSnapshot: l.itemName ?? '',
      description: l.specification ?? null,
      requiredQuantity: l.quantity,
      targetRate: l.targetPrice ?? null,
      requiredDate: l.requiredDate ?? null,
      remarks: l.remarks ?? null,
    })),
  }
}

export function mapApiVendorQuotationToDomain(api: ApiVendorQuotation): VendorQuotation {
  const status = mapVqStatus(String(api.status))
  const lines: VendorQuotationLine[] = (api.lines ?? []).map((l, idx) => ({
    id: l.id,
    lineNo: l.lineNumber ?? idx + 1,
    rfqLineId: l.requestForQuotationLineId ?? null,
    itemId: l.itemId ?? '',
    itemCode: l.itemCode ?? '',
    itemName: l.itemName ?? '',
    description: l.description ?? '',
    uom: '',
    hsnCode: '',
    quantity: Number(l.quantity ?? 0),
    rate: Number(l.rate ?? 0),
    discountPct: 0,
    discountAmount: 0,
    gstRatePct: 0,
    taxAmount: 0,
    taxableAmount: Number(l.amount ?? 0),
    cgst: 0,
    sgst: 0,
    igst: 0,
    freightAllocation: 0,
    otherCharges: 0,
    landedCost: Number(l.amount ?? 0),
    lineTotal: Number(l.amount ?? 0),
    leadTimeDays: Number(l.leadTimeDays ?? 0),
    promisedDeliveryDate: null,
    technicalCompliance: 'not_assessed',
    commercialCompliance: 'not_assessed',
    makeBrand: '',
    remarks: l.remarks ?? '',
  }))
  const discount = Number(api.discountAmount ?? 0)
  const freight = Number(api.freightAmount ?? 0)
  const other = Number(api.otherCharges ?? 0)
  const tax = Number(api.taxAmount ?? 0)
  const basic = Number(api.basicRateTotal ?? lines.reduce((s, l) => s + l.lineTotal, 0))
  const landed = Number(api.landedCost ?? api.totalAmount ?? basic + tax + freight + other - discount)
  return {
    id: api.id,
    documentNumber: api.quotationNumber,
    documentDate: api.quotationDate ?? new Date().toISOString().slice(0, 10),
    status,
    rfqId: api.requestForQuotationId ?? '',
    rfqNumber: api.requestForQuotationNumber ?? '',
    vendor: {
      id: api.vendorId,
      code: api.vendorCode ?? '',
      name: api.vendorName ?? '',
      gstin: api.vendorGstin ?? '',
      state: api.vendorState ?? '',
      isInterstate: false,
    },
    vendorReferenceNumber: api.vendorReferenceNumber ?? '',
    paymentTerms: api.paymentTerms ?? '',
    deliveryTerms: api.deliveryTerms ?? '',
    freightTerms: '',
    warranty: api.warranty ?? '',
    packingCharges: 0,
    validTill: api.validUntil ?? new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: null,
    gstScheme: 'cgst_sgst',
    ...emptyMoneyTotals('INR'),
    subtotal: basic,
    discount,
    taxableAmount: basic - discount,
    freight,
    otherCharges: other,
    totalAmount: Number(api.totalAmount ?? landed),
    lines,
    createdBy: '',
    createdAt: api.createdAt ?? '',
    updatedBy: null,
    updatedAt: api.updatedAt ?? null,
    remarks: api.remarks ?? '',
    attachmentIds: [],
  }
}

export function mapApiVendorQuotationToListRow(api: ApiVendorQuotation): VendorQuotationListRow {
  const status = mapVqStatus(String(api.status))
  return {
    id: api.id,
    documentNumber: api.quotationNumber,
    documentDate: api.quotationDate ?? new Date().toISOString().slice(0, 10),
    rfqId: api.requestForQuotationId ?? '',
    rfqNumber: api.requestForQuotationNumber ?? '',
    vendorName: api.vendorName ?? '',
    vendorCode: api.vendorCode ?? '',
    vendorReferenceNumber: api.vendorReferenceNumber ?? '',
    validTill: api.validUntil ?? '',
    totalAmount: Number(api.totalAmount ?? 0),
    status,
    statusLabel: VENDOR_QUOTATION_DOMAIN_STATUS_LABELS[status],
  }
}

export function mapDomainVendorQuotationInputToApiPayload(input: {
  documentDate?: string | null
  rfqId: string
  vendorId: string
  vendorReferenceNumber?: string | null
  validTill?: string | null
  paymentTerms?: string | null
  deliveryTerms?: string | null
  warranty?: string | null
  freight?: number
  discount?: number
  otherCharges?: number
  remarks?: string | null
  lines: Array<{
    rfqLineId?: string | null
    itemId: string
    itemCode?: string
    itemName?: string
    description?: string
    quantity: number
    rate: number
    leadTimeDays?: number
    remarks?: string
  }>
}): Record<string, unknown> {
  return {
    quotationDate: input.documentDate ?? null,
    requestForQuotationId: input.rfqId,
    vendorId: input.vendorId,
    vendorReferenceNumber: input.vendorReferenceNumber ?? null,
    validUntil: input.validTill ?? null,
    paymentTerms: input.paymentTerms ?? null,
    deliveryTerms: input.deliveryTerms ?? null,
    warranty: input.warranty ?? null,
    freightAmount: input.freight ?? 0,
    discountAmount: input.discount ?? 0,
    otherCharges: input.otherCharges ?? 0,
    remarks: input.remarks ?? null,
    lines: input.lines.map((l) => ({
      requestForQuotationLineId: l.rfqLineId ?? null,
      itemId: l.itemId,
      itemCodeSnapshot: l.itemCode ?? '',
      itemNameSnapshot: l.itemName ?? '',
      description: l.description ?? null,
      quantity: l.quantity,
      rate: l.rate,
      leadTimeDays: l.leadTimeDays ?? null,
      remarks: l.remarks ?? null,
    })),
  }
}

export function mapApiComparisonToDomain(
  api: ApiVendorComparison,
  opts?: { rfqNumber?: string },
): QuotationComparison {
  const vendors = api.vendors ?? []
  const lines = api.lines ?? []
  const byItem = new Map<string, QuotationComparisonRow>()

  for (const line of lines) {
    const itemId = String(line.itemId ?? '')
    const key = itemId || String(line.requestForQuotationLineId ?? line.id)
    let row = byItem.get(key)
    if (!row) {
      row = {
        itemId: key,
        itemCode: '',
        itemName: '',
        quantity: Number(line.quantity ?? 0),
        uom: '',
        rfqLineId: (line.requestForQuotationLineId as string | null) ?? null,
        quotes: [],
        selectedVendorId: line.isSelected ? String(line.vendorQuotationId ?? '') : null,
        recommendedVendorId: null,
      }
      byItem.set(key, row)
    }
    const vendorMeta = vendors.find((v) => v.quotationId === line.vendorQuotationId)
    const quote: QuotationComparisonQuoteCell = {
      vendorId: vendorMeta?.vendorId ?? '',
      vendorName: '',
      vendorQuotationId: String(line.vendorQuotationId ?? ''),
      vendorQuotationNumber: vendorMeta?.quotationNumber ?? '',
      rate: Number(line.rate ?? 0),
      discountPct: 0,
      discountAmount: Number(vendorMeta?.discountAmount ?? 0),
      freight: Number(vendorMeta?.freightAmount ?? 0),
      taxAmount: Number(vendorMeta?.taxAmount ?? 0),
      landedRate: Number(line.rate ?? 0),
      landedAmount: Number(line.amount ?? 0),
      leadTimeDays: Number(vendorMeta?.deliveryLeadDays ?? 0),
      lineTotal: Number(line.amount ?? 0),
      paymentTerms: vendorMeta?.paymentTerms ?? '',
      warranty: vendorMeta?.warranty ?? '',
      vendorRating: 0,
      previousQualityScore: 0,
      previousDeliveryScore: 0,
      technicalCompliance: 'not_assessed',
      commercialCompliance: 'not_assessed',
      isLowestBasic: false,
      isLowestLanded: false,
      isBestDelivery: false,
      isPreferred: Boolean(line.isSelected),
      isNonCompliant: false,
      hasMissingValues: false,
    }
    row.quotes.push(quote)
    if (line.isSelected) {
      row.selectedVendorId = quote.vendorId
      row.recommendedVendorId = quote.vendorId
    }
  }

  if (byItem.size === 0 && vendors.length) {
    byItem.set('_summary', {
      itemId: '_summary',
      itemCode: '—',
      itemName: 'Vendor totals',
      quantity: 1,
      uom: '',
      rfqLineId: null,
      quotes: vendors.map((v) => ({
        vendorId: v.vendorId,
        vendorName: '',
        vendorQuotationId: v.quotationId,
        vendorQuotationNumber: v.quotationNumber,
        rate: v.basicRateTotal,
        discountPct: 0,
        discountAmount: v.discountAmount,
        freight: v.freightAmount,
        taxAmount: v.taxAmount,
        landedRate: v.landedCost,
        landedAmount: v.landedCost,
        leadTimeDays: v.deliveryLeadDays ?? 0,
        lineTotal: v.landedCost,
        paymentTerms: v.paymentTerms ?? '',
        warranty: v.warranty ?? '',
        vendorRating: 0,
        previousQualityScore: 0,
        previousDeliveryScore: 0,
        technicalCompliance: 'not_assessed' as const,
        commercialCompliance: 'not_assessed' as const,
        isLowestBasic: false,
        isLowestLanded: false,
        isBestDelivery: false,
        isPreferred: v.isAwarded,
        isNonCompliant: false,
        hasMissingValues: false,
      })),
      selectedVendorId: api.awardedVendorId,
      recommendedVendorId: api.awardedVendorId,
    })
  }

  const rows = [...byItem.values()]
  const statusLower = String(api.status).toLowerCase()
  const status: QuotationComparison['status'] =
    statusLower === 'cancelled'
      ? 'cancelled'
      : statusLower === 'vendor_selected' || statusLower === 'converted_to_po'
        ? 'completed'
        : 'draft'
  const awardedVendorId = api.awardedVendorId
  return {
    id: api.id,
    documentNumber: api.comparisonNumber,
    documentDate: api.comparisonDate ?? new Date().toISOString().slice(0, 10),
    status,
    rfqId: api.requestForQuotationId,
    rfqNumber: opts?.rfqNumber ?? '',
    comparedBy: { ...EMPTY_PARTY },
    method: 'landed_cost',
    criteria: [
      'basic_price',
      'discount',
      'freight',
      'taxes',
      'landed_cost',
      'payment_terms',
      'delivery_time',
      'warranty',
    ],
    selectedVendorIds: vendors.map((v) => v.vendorId),
    selectionMode: 'all_lines',
    selectionReason: api.selectionReason ?? '',
    recommendationStatus: awardedVendorId
      ? 'approved'
      : status === 'draft'
        ? 'none'
        : 'recommended',
    recommendedVendorId: awardedVendorId,
    recommendedVendorName: null,
    approvedBy: api.awardedByName?.trim() || api.awardedById,
    approvedAt: api.selectedAt,
    currency: 'INR',
    rows,
    createdBy: '',
    createdAt: api.createdAt ?? '',
    updatedBy: null,
    updatedAt: api.updatedAt ?? null,
    remarks: api.remarks ?? '',
    attachmentIds: [],
  }
}

function mapApiPoStatus(status: string): PurchaseOrderDomainStatus {
  const s = status.toLowerCase()
  if (s === 'sent_to_vendor') return 'released'
  if (s === 'pending_approval') return 'pending_approval'
  if (s === 'rejected') return 'rejected'
  if (s === 'sent_back') return 'sent_back'
  if (s === 'partially_received') return 'partially_received'
  if (s === 'fully_received') return 'fully_received'
  if (s === 'partially_invoiced' || s === 'fully_invoiced') return 'invoiced'
  if (s === 'cancelled') return 'cancelled'
  if (s === 'closed') return 'closed'
  if (s === 'approved') return 'approved'
  return 'draft'
}

function mapApiPoOrigin(origin: string, hasPr: boolean): PurchaseOrderOrigin {
  const o = origin.toLowerCase()
  if (o === 'rfq_comparison') return 'quotation_comparison'
  if (o === 'purchase_requisition') return 'purchase_requisition'
  if (o === 'planning_sheet') return hasPr ? 'purchase_requisition' : 'manual'
  return 'manual'
}

function mapApiPoLine(line: NonNullable<ApiPurchaseOrder['lines']>[number]): PurchaseOrderLine {
  const qty = Number(line.quantity) || 0
  const rate = Number(line.rate) || 0
  const amount = Number(line.amount) || qty * rate
  const received = Number(line.receivedQuantity) || 0
  const requiredDate = line.requiredDate ?? new Date().toISOString().slice(0, 10)
  return {
    id: line.id,
    lineNo: line.lineNumber,
    itemType: 'raw_material',
    itemId: line.itemId ?? '',
    itemCode: line.itemCode ?? '',
    itemName: line.itemName ?? '',
    description: line.description ?? '',
    specification: '',
    category: 'raw_material',
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: qty,
    rate,
    discountPct: 0,
    discountAmount: 0,
    gstRatePct: 0,
    taxAmount: 0,
    taxableAmount: amount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    lineTotal: amount,
    requiredDate,
    deliverySchedule: '',
    warehouseId: '',
    warehouseName: '',
    costCentre: '',
    project: '',
    productionOrder: '',
    receivedQty: received,
    pendingQty: line.openQuantity ?? Math.max(0, qty - received),
    invoicedQty: Number(line.invoicedQuantity) || 0,
    lineStatus: received >= qty && qty > 0 ? 'received' : received > 0 ? 'partial' : 'open',
    locationId: '',
    locationName: '',
    expectedDeliveryDate: requiredDate,
    prLineId: line.purchaseRequisitionLineId,
    rfqLineId: null,
    vendorQuotationLineId: null,
    remarks: line.remarks ?? '',
  }
}

export function mapApiPurchaseOrderToDomain(api: ApiPurchaseOrder): PurchaseOrder {
  const status = mapApiPoStatus(String(api.status))
  const documentDate = api.orderDate ?? new Date().toISOString().slice(0, 10)
  const expectedDeliveryDate =
    api.expectedDeliveryDate ?? documentDate
  const subtotal = Number(api.subtotalAmount ?? api.totalAmount) || 0
  const tax = Number(api.taxAmount) || 0
  const freight = Number(api.freightAmount) || 0
  const total = Number(api.totalAmount) || subtotal + tax + freight
  const vendorParty = {
    id: api.vendorId,
    code: api.vendorCode ?? '',
    name: api.vendorName ?? api.vendorId,
    gstin: api.vendorGstin ?? '',
    state: api.vendorState ?? '',
    isInterstate: false,
    address: api.vendorAddress ?? '',
  }
  const approvalStatus =
    status === 'draft' || status === 'sent_back'
      ? 'not_required'
      : status === 'pending_approval'
        ? 'pending'
        : status === 'cancelled' || status === 'rejected'
          ? 'rejected'
          : 'approved'

  const locationFromApi =
    api.deliveryWarehouseId || api.deliveryWarehouseName
      ? {
          id: api.deliveryWarehouseId ?? '',
          code: api.deliveryWarehouseCode ?? '',
          name:
            (api.deliveryWarehouseName ?? '').trim() ||
            resolveWarehouseFromMaster(api.deliveryWarehouseId).name,
          state: '',
          city: '',
        }
      : resolveWarehouseFromMaster(api.deliveryWarehouseId)

  const buyer =
    api.createdById || api.createdByName
      ? {
          id: api.createdById ?? '',
          code: '',
          name: (api.createdByName ?? '').trim() || '—',
        }
      : { ...EMPTY_PARTY }

  return {
    id: api.id,
    documentNumber: api.orderNumber,
    documentDate,
    status,
    orderType: 'standard',
    origin: mapApiPoOrigin(String(api.origin), Boolean(api.purchaseRequisitionId)),
    revisionNo: 0,
    buyer,
    location: locationFromApi,
    purchaseLocation: locationFromApi,
    deliveryLocation: locationFromApi,
    department: '',
    requester: { ...EMPTY_PARTY },
    approver: null,
    vendor: vendorParty,
    placeOfSupply: api.vendorState ?? '',
    currency: 'INR',
    paymentTerms: api.paymentTerms ?? '',
    deliveryTerms: api.deliveryTerms ?? '',
    freightTerms: '',
    packingTerms: '',
    insuranceTerms: '',
    warranty: '',
    inspectionRequirement: '',
    priceBasis: '',
    validityDate: null,
    expectedDeliveryDate,
    gstScheme: 'cgst_sgst',
    purchaseRequisitionId: api.purchaseRequisitionId,
    purchaseRequisitionNumber: api.purchaseRequisitionNumber ?? null,
    rfqId: api.requestForQuotationId ?? null,
    rfqNumber: api.requestForQuotationNumber ?? null,
    vendorQuotationId: api.vendorQuotationId ?? null,
    vendorQuotationNumber: null,
    comparisonId: api.vendorComparisonId ?? null,
    comparisonNumber: null,
    blanketOrderId: null,
    blanketOrderNumber: null,
    subtotal,
    discount: 0,
    taxableAmount: subtotal,
    cgst: 0,
    sgst: 0,
    igst: tax,
    freight,
    otherCharges: 0,
    roundOff: 0,
    totalAmount: total,
    lineDiscount: 0,
    tradeDiscount: 0,
    packingCharges: 0,
    insuranceCharges: 0,
    tcsAmount: 0,
    lines: (api.lines ?? []).map(mapApiPoLine),
    termsAndConditions: '',
    internalNotes: '',
    remarks: api.remarks ?? '',
    rejectionReason: api.rejectionReason ?? null,
    sendBackReason: api.sendBackReason ?? null,
    allowedActions: api.allowedActions,
    approvalStatus,
    invoiceStatus:
      String(api.status).toLowerCase() === 'partially_invoiced'
        ? 'partially_invoiced'
        : String(api.status).toLowerCase() === 'fully_invoiced'
          ? 'fully_invoiced'
          : 'not_invoiced',
    approvalIds: [],
    changeHistory: [],
    revisions: [],
    attachmentIds: [],
    sentToVendorAt: api.sentAt ?? null,
    releasedAt: api.sentAt ?? null,
    closedAt: api.closedAt ?? null,
    cancelledAt: api.cancelledAt ?? null,
    createdBy: api.createdByName ?? api.createdById ?? '',
    createdAt: api.createdAt ?? '',
    updatedBy: null,
    updatedAt: api.updatedAt ?? null,
  }
}

export function mapApiPurchaseOrderToListRow(api: ApiPurchaseOrder): PurchaseOrderListRow {
  const domain = mapApiPurchaseOrderToDomain(api)
  const ordered = domain.lines.reduce((s, l) => s + l.quantity, 0)
  const received = domain.lines.reduce((s, l) => s + l.receivedQty, 0)
  return {
    id: domain.id,
    documentNumber: domain.documentNumber,
    documentDate: domain.documentDate,
    vendorName: domain.vendor.name,
    vendorGstin: domain.vendor.gstin,
    locationName: domain.purchaseLocation.name || domain.deliveryLocation.name || '—',
    buyerName: domain.buyer.name || '—',
    currency: domain.currency,
    expectedDeliveryDate: domain.expectedDeliveryDate,
    basicAmount: domain.subtotal,
    taxAmount: Number(api.taxAmount) || 0,
    totalAmount: domain.totalAmount,
    receivedPercentage: ordered > 0 ? Math.round((received / ordered) * 100) : 0,
    invoiceStatus: domain.invoiceStatus,
    invoiceStatusLabel: PURCHASE_ORDER_INVOICE_STATUS_LABELS[domain.invoiceStatus],
    approvalStatus: domain.approvalStatus,
    approvalStatusLabel: PURCHASE_ORDER_APPROVAL_STATUS_LABELS[domain.approvalStatus],
    status: domain.status,
    statusLabel: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[domain.status],
    revisionNo: domain.revisionNo,
    origin: domain.origin,
    orderType: domain.orderType,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuidOrNull(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null
}

/** Domain PO editor input → backend create/update payload. Backend owns numbering and totals. */
export function mapDomainPoInputToApiPayload(
  input: PurchaseOrderInput,
): import('./purchaseApiTypes').ApiPurchaseOrderInput {
  return {
    vendorId: input.vendorId,
    orderDate: input.documentDate ?? undefined,
    purchaseRequisitionId: uuidOrNull(input.purchaseRequisitionId ?? null),
    expectedDeliveryDate: input.expectedDeliveryDate ?? null,
    paymentTerms: input.paymentTerms ?? null,
    deliveryTerms: input.deliveryTerms ?? null,
    deliveryWarehouseId: uuidOrNull(input.deliveryLocation?.id ?? null),
    freightAmount: input.freight ?? undefined,
    remarks: input.remarks ?? null,
    lines: (input.lines ?? []).map((line, index) => ({
      id: uuidOrNull(line.id ?? null) ?? undefined,
      lineNumber: line.lineNo ?? index + 1,
      itemId: uuidOrNull(line.itemId ?? null),
      itemCode: line.itemCode ?? null,
      itemName: line.itemName ?? null,
      description: line.description ?? null,
      quantity: Number(line.quantity) || 0,
      rate: Number(line.rate) || 0,
      requiredDate: line.requiredDate ?? null,
      remarks: line.remarks ?? null,
      purchaseRequisitionLineId: uuidOrNull(line.prLineId ?? null),
    })),
  }
}

export { EMPTY_PARTY, toApiPriority, toApiPlanningPriority, toApiPurchaseType }

function mapApiGrnStatus(status: string): GrnDomainStatus {
  const key = status.toUpperCase()
  switch (key) {
    case 'DRAFT':
      return 'draft'
    case 'QC_PENDING':
      return 'pending_inspection'
    case 'PARTIALLY_ACCEPTED':
      return 'partially_accepted'
    case 'FULLY_ACCEPTED':
    case 'SUBMITTED':
    case 'RECEIVING_COMPLETED':
      return 'accepted'
    case 'INVENTORY_POSTED':
    case 'CLOSED':
      return 'posted'
    case 'CANCELLED':
    case 'REVERSED':
      return 'cancelled'
    default:
      return 'draft'
  }
}

export function mapApiGoodsReceiptToDomain(api: ApiGoodsReceipt): GoodsReceiptNote {
  const status = mapApiGrnStatus(String(api.status))
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.grnNumber,
    documentDate: api.documentDate || api.receiptDate || '',
    status,
    location: {
      id: api.storageLocationId || api.warehouseId,
      code: api.storageLocationCode || api.warehouseCode || '',
      name: api.storageLocationName || api.warehouseName,
      state: '',
      city: '',
    },
    department: '',
    requester: { id: api.receivedById || '', code: '', name: api.receivedByName || '' },
    receivedBy: { id: api.receivedById || '', code: '', name: api.receivedByName || '' },
    vendor: {
      id: api.vendorId,
      code: api.vendorCode,
      name: api.vendorName,
      gstin: api.vendorGstin || '',
    },
    purchaseOrderId: api.purchaseOrderId,
    purchaseOrderNumber: api.purchaseOrderNumber,
    expectedDeliveryDate: api.expectedDeliveryDate,
    currency: (api.currencyCode as GoodsReceiptNote['currency']) || 'INR',
    paymentTerms: api.paymentTerms || '',
    deliveryTerms: api.deliveryTerms || '',
    vendorChallanNumber: api.vendorChallanNumber || '',
    vendorChallanDate: api.vendorChallanDate,
    vehicleNo: api.vehicleNumber,
    transporterName: api.transporterName,
    lrNumber: api.lrNumber,
    gateEntryNo: api.gateEntryNumber,
    warehouseId: api.warehouseId,
    warehouseName: api.warehouseName,
    receivingLocation: api.storageLocationName || '',
    qcRequired: api.inspectionRequired,
    inspectionRequired: api.inspectionRequired,
    allowExcess: api.allowExcess,
    qualityInspectionId: null,
    lines: (api.lines ?? []).map((l) => ({
      id: l.id,
      lineNo: l.lineNumber,
      purchaseOrderLineId: l.purchaseOrderLineId,
      itemId: l.itemId || '',
      itemCode: l.itemCode,
      itemName: l.itemName,
      description: l.description || l.itemName,
      uom: l.uom,
      hsnCode: '',
      orderedQty: Number(l.orderedQuantity) || 0,
      previouslyReceivedQty: Number(l.previouslyReceivedQuantity) || 0,
      pendingQty: Number(l.openQuantity) || 0,
      receivedQty: Number(l.receivedQuantity) || 0,
      acceptedQty: Number(l.acceptedQuantity) || 0,
      rejectedQty: Number(l.rejectedQuantity) || 0,
      shortQty: Number(l.shortQuantity) || 0,
      excessQty: Number(l.excessQuantity) || 0,
      damagedQty: Number(l.damagedQuantity) || 0,
      pendingInspectionQty: Number(l.acceptedForQcQuantity) || 0,
      rate: Number(l.rate) || 0,
      taxableAmount: Number(l.amount) || 0,
      batchNumber: l.batchNumber || '',
      lotNumber: l.lotNumber || '',
      serialNumber: l.serialNumber || '',
      manufacturingDate: l.manufacturingDate,
      expiryDate: l.expiryDate,
      warehouseId: l.warehouseId || api.warehouseId,
      warehouseName: api.warehouseName,
      bin: l.binCode || '',
      locationId: l.storageLocationId || api.storageLocationId || '',
      locationName: api.storageLocationName || '',
      inspectionStatus: l.qcRequired ? 'pending' : 'not_required',
      allowExcess: api.allowExcess,
      batchControlled: false,
      serialControlled: false,
      expiryControlled: false,
      qcRequired: l.qcRequired,
      remarks: l.remarks || '',
    })),
    postedAt: api.status === 'INVENTORY_POSTED' ? api.updatedAt : null,
    inventoryPostDeferred: api.status !== 'INVENTORY_POSTED',
    subtotal: api.totalAmount,
    discount: 0,
    taxableAmount: api.totalAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    freight: 0,
    otherCharges: 0,
    roundOff: 0,
    totalAmount: api.totalAmount,
    createdAt: api.createdAt || new Date().toISOString(),
    updatedAt: api.updatedAt || new Date().toISOString(),
    createdBy: api.receivedByName || '',
    updatedBy: api.receivedByName || '',
    remarks: api.remarks || '',
    attachmentIds: [],
  }
}

export function mapApiGoodsReceiptToListRow(api: ApiGoodsReceipt): GrnListRow {
  const status = mapApiGrnStatus(String(api.status))
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.grnNumber,
    documentDate: api.documentDate || api.receiptDate || '',
    purchaseOrderId: api.purchaseOrderId,
    purchaseOrderNumber: api.purchaseOrderNumber,
    vendorName: api.vendorName,
    vendorCode: api.vendorCode,
    warehouseName: api.warehouseName,
    gateEntryNo: api.gateEntryNumber,
    vehicleNo: api.vehicleNumber,
    lineCount: api.lineCount,
    totalReceivedQty: api.totalReceivedQty,
    totalAcceptedQty: api.totalAcceptedQty,
    totalRejectedQty: api.totalRejectedQty,
    totalAmount: api.totalAmount,
    status,
    statusLabel: status.replace(/_/g, ' '),
    inspectionRequired: api.inspectionRequired,
    qualityInspectionId: null,
  }
}

/* ─── Purchase Invoice / Quality Inspection / Purchase Return (API mode) ─── */

/** Resolve vendor snapshot from the hydrated master store (API mode). */
function resolveVendorParty(vendorId: string | null | undefined): {
  id: string
  code: string
  name: string
  gstin: string
  state: string
} {
  if (!vendorId) return { id: '', code: '', name: '', gstin: '', state: '' }
  const vendor = useMasterStore.getState().vendors.find((v) => v.id === vendorId)
  return {
    id: vendorId,
    code: vendor?.vendorCode ?? '',
    name: vendor?.vendorName ?? '',
    gstin: vendor?.gstin ?? '',
    state: vendor?.state ?? '',
  }
}

function resolveWarehouseLocation(warehouseId: string | null | undefined) {
  if (!warehouseId) return { ...EMPTY_LOCATION }
  const wh = useMasterStore.getState().warehouses.find((w) => w.id === warehouseId)
  return {
    id: warehouseId,
    code: wh?.warehouseCode ?? '',
    name: wh?.warehouseName ?? '',
    state: '',
    city: '',
  }
}

function mapApiInvoiceStatus(status: string): PurchaseInvoiceStatus {
  switch (status.toUpperCase()) {
    case 'PENDING_APPROVAL':
      return 'pending_approval'
    case 'APPROVED':
      return 'approved'
    case 'MATCHED':
    case 'PARTIALLY_MATCHED':
      return 'matched'
    case 'MISMATCH':
      return 'mismatch'
    case 'POSTED':
      return 'posted'
    case 'CLOSED':
      return 'paid'
    case 'CANCELLED':
      return 'cancelled'
    case 'DRAFT':
    case 'REJECTED':
    default:
      return 'draft'
  }
}

function deriveInvoiceOrigin(api: ApiPurchaseInvoice): PurchaseInvoiceOrigin {
  if (api.isDirectInvoice) return 'direct'
  if (api.goodsReceiptId) return 'goods_receipt'
  if (api.purchaseOrderId) return 'purchase_order'
  return 'direct'
}

function deriveInvoiceMatching(api: ApiPurchaseInvoice): {
  matchStatus: 'unmatched' | 'matched' | 'mismatch'
  matchingResultStatus: InvoiceMatchingResultStatus
} {
  const key = (api.matchingStatus ?? '').toUpperCase()
  if (key === 'MATCHED') return { matchStatus: 'matched', matchingResultStatus: 'fully_matched' }
  if (key === 'OVERRIDDEN') {
    return { matchStatus: 'matched', matchingResultStatus: 'within_tolerance' }
  }
  if (key === 'MISMATCH') {
    return { matchStatus: 'mismatch', matchingResultStatus: 'amount_mismatch' }
  }
  return { matchStatus: 'unmatched', matchingResultStatus: 'fully_matched' }
}

export function mapApiPurchaseInvoiceToDomain(api: ApiPurchaseInvoice): PurchaseInvoice {
  const status = mapApiInvoiceStatus(String(api.status))
  const vendor = resolveVendorParty(api.vendorId)
  const gstScheme: PurchaseGstScheme = api.gstScheme === 'IGST' ? 'igst' : 'cgst_sgst'
  const taxAmount = Number(api.taxAmount) || 0
  const { matchStatus, matchingResultStatus } = deriveInvoiceMatching(api)
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.invoiceNumber,
    documentDate: api.documentDate || api.invoiceDate || '',
    status,
    origin: deriveInvoiceOrigin(api),
    vendorInvoiceNumber: api.vendorInvoiceNumber || '',
    vendorInvoiceDate: api.vendorInvoiceDate || api.invoiceDate || '',
    postingDate: api.documentDate || api.invoiceDate || '',
    location: { ...EMPTY_LOCATION },
    department: '',
    requester: { ...EMPTY_PARTY },
    approver: null,
    vendor: {
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: gstScheme === 'igst',
    },
    currency: 'INR',
    paymentTerms: api.paymentTerms || '',
    deliveryTerms: '',
    expectedDeliveryDate: null,
    dueDate: api.dueDate || null,
    placeOfSupply: api.placeOfSupplyState || '',
    reverseCharge: api.reverseCharge,
    eInvoiceReference: null,
    gstScheme,
    purchaseOrderId: api.purchaseOrderId,
    purchaseOrderNumber: api.purchaseOrderNumber || null,
    goodsReceiptId: api.goodsReceiptId,
    goodsReceiptNumber: api.goodsReceiptNumber || null,
    matchStatus,
    matchingResultStatus,
    matchingExceptionApproved: api.overrideAuthorized,
    exceptionApprovedBy: null,
    exceptionApprovedAt: null,
    verifiedAt: api.submittedAt,
    verifiedBy: null,
    onHoldReason: null,
    holdAt: null,
    debitNoteId: null,
    debitNoteNumber: null,
    lines: (api.lines ?? []).map((l) => {
      const lineTax = Number(l.taxAmount) || 0
      return {
        id: l.id,
        lineNo: l.lineNumber,
        purchaseOrderLineId: l.purchaseOrderLineId,
        goodsReceiptLineId: l.goodsReceiptLineId,
        poLineNo: null,
        grnLineNo: null,
        itemId: l.itemId || '',
        itemCode: l.itemCodeSnapshot || '',
        itemName: l.itemNameSnapshot || '',
        description: l.description || l.itemNameSnapshot || '',
        uom: l.uomCodeSnapshot || '',
        hsnCode: '',
        sacCode: null,
        quantity: Number(l.quantity) || 0,
        rate: Number(l.rate) || 0,
        discountAmount: 0,
        taxableAmount: Number(l.amount) || 0,
        gstRatePct: Number(l.taxRatePct) || 0,
        cgst: gstScheme === 'cgst_sgst' ? lineTax / 2 : 0,
        sgst: gstScheme === 'cgst_sgst' ? lineTax / 2 : 0,
        igst: gstScheme === 'igst' ? lineTax : 0,
        tdsAmount: 0,
        tcsAmount: 0,
        lineTotal: Number(l.lineTotal) || 0,
        costCentre: '',
        project: '',
        account: '',
        remarks: l.remarks || '',
      }
    }),
    approvalIds: [],
    postedAt: api.postedAt,
    paidAt: null,
    subtotal: Number(api.subtotalAmount) || 0,
    discount: 0,
    taxableAmount: Number(api.subtotalAmount) || 0,
    cgst: gstScheme === 'cgst_sgst' ? taxAmount / 2 : 0,
    sgst: gstScheme === 'cgst_sgst' ? taxAmount / 2 : 0,
    igst: gstScheme === 'igst' ? taxAmount : 0,
    freight: 0,
    otherCharges: 0,
    roundOff: Number(api.roundOffAmount) || 0,
    totalAmount: Number(api.totalAmount) || 0,
    createdAt: api.createdAt || new Date().toISOString(),
    updatedAt: api.updatedAt,
    createdBy: '',
    updatedBy: null,
    remarks: api.remarks || '',
    attachmentIds: [],
  }
}

export function mapApiPurchaseInvoiceToListRow(api: ApiPurchaseInvoice): PurchaseInvoiceListRow {
  const status = mapApiInvoiceStatus(String(api.status))
  const origin = deriveInvoiceOrigin(api)
  const vendor = resolveVendorParty(api.vendorId)
  const { matchStatus, matchingResultStatus } = deriveInvoiceMatching(api)
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.invoiceNumber,
    documentDate: api.documentDate || api.invoiceDate || '',
    status,
    statusLabel: PURCHASE_INVOICE_STATUS_LABELS[status],
    origin,
    originLabel: PURCHASE_INVOICE_ORIGIN_LABELS[origin],
    vendorName: vendor.name,
    vendorGstin: vendor.gstin,
    vendorInvoiceNumber: api.vendorInvoiceNumber || '',
    purchaseOrderNumber: api.purchaseOrderNumber || null,
    goodsReceiptNumber: api.goodsReceiptNumber || null,
    matchingResultStatus,
    matchingResultStatusLabel: INVOICE_MATCHING_RESULT_STATUS_LABELS[matchingResultStatus],
    matchStatus,
    totalAmount: Number(api.totalAmount) || 0,
    currency: 'INR',
    dueDate: api.dueDate || null,
    postingDate: api.documentDate || api.invoiceDate || '',
  }
}

/** Domain invoice editor input → backend create/update payload. */
export function mapDomainPurchaseInvoiceInputToApiPayload(
  input: PurchaseInvoiceInput,
): Record<string, unknown> {
  return {
    vendorId: input.vendorId,
    invoiceDate: input.documentDate ?? undefined,
    vendorInvoiceNumber: input.vendorInvoiceNumber || null,
    vendorInvoiceDate: input.vendorInvoiceDate || null,
    purchaseOrderId: uuidOrNull(input.purchaseOrderId ?? null),
    goodsReceiptId: uuidOrNull(input.goodsReceiptId ?? null),
    placeOfSupplyState: input.placeOfSupply || null,
    reverseCharge: input.reverseCharge ?? false,
    remarks: input.remarks || null,
    lines: input.lines.map((line) => ({
      purchaseOrderLineId: uuidOrNull(line.purchaseOrderLineId ?? null),
      goodsReceiptLineId: uuidOrNull(line.goodsReceiptLineId ?? null),
      itemId: uuidOrNull(line.itemId),
      description: line.description || null,
      quantity: Number(line.quantity) || 0,
      rate: Number(line.rate) || 0,
      taxRatePct: Number(line.gstRatePct) || 0,
      remarks: line.remarks || null,
    })),
  }
}

function mapApiQiStatus(status: string): QualityInspectionStatus {
  switch (status.toUpperCase()) {
    case 'IN_PROGRESS':
      return 'in_progress'
    case 'ACCEPTED':
    case 'CLOSED':
      return 'accepted'
    case 'PARTIALLY_ACCEPTED':
      return 'partially_accepted'
    case 'REJECTED':
      return 'rejected'
    case 'DEVIATION_PENDING':
      return 'hold'
    case 'CANCELLED':
      return 'cancelled'
    case 'DRAFT':
    case 'PENDING':
    default:
      return 'pending'
  }
}

function qiResultFromStatus(status: QualityInspectionStatus): QualityInspectionResult | null {
  if (
    status === 'accepted'
    || status === 'partially_accepted'
    || status === 'rejected'
    || status === 'accepted_under_deviation'
    || status === 'hold'
  ) {
    return status
  }
  return null
}

export function mapApiQualityInspectionToDomain(api: ApiQualityInspection): QualityInspection {
  const status = mapApiQiStatus(String(api.status))
  const vendor = resolveVendorParty(api.vendorId)
  const first = api.lines?.[0]
  const itemName = first?.itemNameSnapshot || ''
  const extraLines = (api.lines?.length ?? 0) - 1
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.inspectionNumber,
    documentDate: api.documentDate || api.inspectionDate || '',
    status,
    result: qiResultFromStatus(status),
    goodsReceiptId: api.goodsReceiptId || '',
    goodsReceiptNumber: api.goodsReceiptNumber || '',
    goodsReceiptLineId: first?.goodsReceiptLineId || '',
    purchaseOrderId: api.purchaseOrderId || '',
    purchaseOrderNumber: api.purchaseOrderNumber || '',
    vendor: { id: vendor.id, code: vendor.code, name: vendor.name },
    location: resolveWarehouseLocation(api.warehouseId),
    itemId: first?.itemId || '',
    itemCode: first?.itemCodeSnapshot || '',
    itemName: extraLines > 0 ? `${itemName} (+${extraLines} more)` : itemName,
    batchLotNo: api.batchLotNo || '',
    receivedQty: Number(api.totals?.inspected) || 0,
    sampleQty: Number(api.totals?.inspected) || 0,
    acceptedQty: Number(api.totals?.accepted) || 0,
    rejectedQty: Number(api.totals?.rejected) || 0,
    inspectionPlan: '',
    inspector: { id: api.inspectedById || '', code: '', name: api.inspectedByName || '' },
    inspectedAt: api.completedAt,
    deviationRequested: Boolean(api.deviationRemarks),
    deviationRemarks: api.deviationRemarks || '',
    parameters: [],
    createdAt: api.createdAt || new Date().toISOString(),
    updatedAt: api.updatedAt,
    createdBy: '',
    updatedBy: null,
    remarks: api.remarks || '',
    attachmentIds: [],
  }
}

export function mapApiQualityInspectionToListRow(
  api: ApiQualityInspection,
): QualityInspectionListRow {
  const status = mapApiQiStatus(String(api.status))
  const result = qiResultFromStatus(status)
  const first = api.lines?.[0]
  const itemName = first?.itemNameSnapshot || ''
  const extraLines = (api.lines?.length ?? 0) - 1
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.inspectionNumber,
    documentDate: api.documentDate || api.inspectionDate || '',
    goodsReceiptId: api.goodsReceiptId || '',
    goodsReceiptNumber: api.goodsReceiptNumber || '',
    itemCode: first?.itemCodeSnapshot || '',
    itemName: extraLines > 0 ? `${itemName} (+${extraLines} more)` : itemName,
    batchLotNo: api.batchLotNo || '',
    receivedQty: Number(api.totals?.inspected) || 0,
    sampleQty: Number(api.totals?.inspected) || 0,
    inspectorName: api.inspectedByName || '',
    status,
    statusLabel: QUALITY_INSPECTION_STATUS_LABELS[status],
    result,
    resultLabel: result ? QUALITY_INSPECTION_RESULT_LABELS[result] : '—',
  }
}

/** Domain QI create input → backend create payload. Lines only when a sample qty is known. */
export function mapDomainQualityInspectionInputToApiPayload(
  input: QualityInspectionInput,
): Record<string, unknown> {
  const sampleQty = Number(input.sampleQty) || 0
  const lines =
    sampleQty > 0
      ? [
          {
            goodsReceiptLineId: uuidOrNull(input.goodsReceiptLineId),
            inspectedQuantity: sampleQty,
            acceptedQuantity: Number(input.acceptedQty) || 0,
            rejectedQuantity: Number(input.rejectedQty) || 0,
            remarks: input.remarks || null,
          },
        ]
      : undefined
  return {
    goodsReceiptId: uuidOrNull(input.goodsReceiptId),
    inspectionDate: input.documentDate ?? undefined,
    inspectedById: input.inspectorId || null,
    inspectedByName: input.inspectorName || null,
    remarks: input.remarks || null,
    lines,
  }
}

function mapApiReturnStatus(status: string): PurchaseReturnDomainStatus {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
    case 'APPROVED':
    case 'SHIPPED':
      return 'approved'
    case 'COMPLETED':
      return 'posted'
    case 'CLOSED':
      return 'closed'
    case 'CANCELLED':
      return 'cancelled'
    case 'DRAFT':
    default:
      return 'draft'
  }
}

const RETURN_REASON_VALUES: readonly PurchaseReturnReason[] = [
  'quality_rejection',
  'damaged',
  'wrong_item',
  'excess_quantity',
  'specification_mismatch',
  'expired_material',
  'short_shelf_life',
  'other',
]

function parseReturnReason(reason: string | null | undefined): PurchaseReturnReason {
  return RETURN_REASON_VALUES.includes(reason as PurchaseReturnReason)
    ? (reason as PurchaseReturnReason)
    : 'other'
}

function returnOriginFromReason(reason: PurchaseReturnReason): PurchaseReturnOrigin {
  switch (reason) {
    case 'quality_rejection':
      return 'quality_rejection'
    case 'damaged':
      return 'damaged_material'
    case 'excess_quantity':
      return 'excess_receipt'
    case 'wrong_item':
      return 'wrong_material'
    default:
      return 'grn_rejected_quantity'
  }
}

export function mapApiPurchaseReturnToDomain(api: ApiPurchaseReturn): PurchaseReturn {
  const status = mapApiReturnStatus(String(api.status))
  const vendor = resolveVendorParty(api.vendorId)
  const returnReason = parseReturnReason(api.reason)
  const location = resolveWarehouseLocation(api.warehouseId)
  const totalAmount = Number(api.totalAmount) || 0
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.returnNumber,
    documentDate: api.documentDate || api.returnDate || '',
    status,
    origin: returnOriginFromReason(returnReason),
    location,
    warehouseId: api.warehouseId || '',
    warehouseName: location.name,
    department: '',
    requester: { ...EMPTY_PARTY },
    approver: null,
    vendor: { id: vendor.id, code: vendor.code, name: vendor.name, gstin: vendor.gstin },
    paymentTerms: '',
    deliveryTerms: '',
    expectedDeliveryDate: null,
    purchaseOrderId: api.purchaseOrderId,
    purchaseOrderNumber: api.purchaseOrderNumber || null,
    goodsReceiptId: api.goodsReceiptId,
    goodsReceiptNumber: api.goodsReceiptNumber || null,
    purchaseInvoiceId: null,
    purchaseInvoiceNumber: null,
    qualityInspectionId: api.qualityInspectionId,
    qualityInspectionNumber: api.qualityInspectionNumber || null,
    returnReason,
    transportDetails: '',
    debitNoteRequired: false,
    replacementRequired: false,
    linkedReplacementPoId: null,
    linkedReplacementPoNumber: null,
    linkedDebitNoteId: null,
    linkedDebitNoteNumber: null,
    postedAt: api.completedAt,
    lines: (api.lines ?? []).map((l) => {
      const qty = Number(l.returnQuantity) || 0
      const amount = Number(l.amount) || 0
      return {
        id: l.id,
        lineNo: l.lineNumber,
        goodsReceiptLineId: l.goodsReceiptLineId,
        itemId: l.itemId || '',
        itemCode: l.itemCodeSnapshot || '',
        itemName: l.itemNameSnapshot || '',
        description: l.itemNameSnapshot || '',
        uom: '',
        hsnCode: '',
        batchLotNo: '',
        serialNumber: '',
        receivedQty: qty,
        availableReturnQty: qty,
        returnQty: qty,
        unitCost: Number(l.rate) || 0,
        gstRatePct: 0,
        taxableAmount: amount,
        cgst: 0,
        sgst: 0,
        igst: 0,
        returnAmount: amount,
        lineTotal: amount,
        reason: returnReason,
        replacementQty: 0,
        remarks: l.remarks || '',
      }
    }),
    currency: 'INR',
    subtotal: totalAmount,
    discount: 0,
    taxableAmount: totalAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    freight: 0,
    otherCharges: 0,
    roundOff: 0,
    totalAmount,
    createdAt: api.createdAt || new Date().toISOString(),
    updatedAt: api.updatedAt,
    createdBy: '',
    updatedBy: null,
    remarks: api.remarks || '',
    attachmentIds: [],
  }
}

export function mapApiPurchaseReturnToListRow(api: ApiPurchaseReturn): PurchaseReturnListRow {
  const status = mapApiReturnStatus(String(api.status))
  const vendor = resolveVendorParty(api.vendorId)
  const returnReason = parseReturnReason(api.reason)
  const origin = returnOriginFromReason(returnReason)
  return {
    id: api.id,
    documentNumber: api.documentNumber || api.returnNumber,
    documentDate: api.documentDate || api.returnDate || '',
    vendorName: vendor.name,
    vendorCode: vendor.code,
    purchaseOrderNumber: api.purchaseOrderNumber || null,
    goodsReceiptNumber: api.goodsReceiptNumber || null,
    purchaseInvoiceNumber: null,
    warehouseName: resolveWarehouseLocation(api.warehouseId).name,
    origin,
    originLabel: PURCHASE_RETURN_ORIGIN_LABELS[origin],
    returnReason,
    returnReasonLabel: PURCHASE_RETURN_REASON_LABELS[returnReason],
    lineCount: api.lines?.length ?? 0,
    totalReturnQty: Number(api.totalQuantity) || 0,
    totalAmount: Number(api.totalAmount) || 0,
    status,
    statusLabel: PURCHASE_RETURN_DOMAIN_STATUS_LABELS[status],
    debitNoteRequired: false,
    replacementRequired: false,
    linkedReplacementPoNumber: null,
    linkedDebitNoteNumber: null,
  }
}

/** Domain return editor input → backend create/update payload. */
export function mapDomainPurchaseReturnInputToApiPayload(
  input: PurchaseReturnInput,
): Record<string, unknown> {
  return {
    vendorId: input.vendorId,
    returnDate: input.documentDate ?? undefined,
    purchaseOrderId: uuidOrNull(input.purchaseOrderId ?? null),
    goodsReceiptId: uuidOrNull(input.goodsReceiptId ?? null),
    qualityInspectionId: uuidOrNull(input.qualityInspectionId ?? null),
    warehouseId: uuidOrNull(input.warehouseId ?? null),
    reason: input.returnReason,
    remarks: input.remarks || null,
    lines: input.lines.map((line: PurchaseReturnLineInput) => ({
      goodsReceiptLineId: uuidOrNull(line.goodsReceiptLineId ?? null),
      purchaseOrderLineId: uuidOrNull(line.purchaseOrderLineId ?? null),
      itemId: uuidOrNull(line.itemId),
      itemCode: line.itemCode || undefined,
      itemName: line.itemName || line.description || undefined,
      returnQuantity: Number(line.returnQty) || 0,
      rate: Number(line.unitCost ?? line.rate) || 0,
      remarks: line.remarks || null,
    })),
  }
}

export function mapDomainGrnInputToApiPayload(input: GrnInput): Record<string, unknown> {
  const loc = useMasterStore
    .getState()
    .locations.find((l) => l.id === input.receivingLocation || l.locationName === input.receivingLocation)
  return {
    purchaseOrderId: input.purchaseOrderId,
    receiptDate: input.documentDate,
    warehouseId: input.warehouseId,
    storageLocationId: loc?.id ?? null,
    vendorChallanNumber: input.vendorChallanNumber ?? null,
    vendorChallanDate: input.vendorChallanDate ?? null,
    vehicleNumber: input.vehicleNo ?? null,
    transporterName: input.transporterName ?? null,
    lrNumber: input.lrNumber ?? null,
    gateEntryNumber: input.gateEntryNo ?? null,
    receivedByName: input.receivedByName ?? null,
    inspectionRequired: input.inspectionRequired ?? false,
    allowExcess: input.allowExcess ?? false,
    remarks: input.remarks ?? null,
    lines: input.lines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      receivedQuantity: Number(line.receivedQty) || 0,
      damagedQuantity: Number(line.damagedQty) || 0,
      shortQuantity: Number(line.shortQty) || 0,
      excessQuantity: Number(line.excessQty) || 0,
      warehouseId: line.warehouseId || input.warehouseId,
      batchNumber: line.batchNumber || null,
      lotNumber: line.lotNumber || null,
      serialNumber: line.serialNumber || null,
      manufacturingDate: line.manufacturingDate ?? null,
      expiryDate: line.expiryDate ?? null,
      remarks: line.remarks || null,
    })),
  }
}

