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
} from './purchaseApiTypes'
import type { ApiVendorComparison } from './comparisonApi'
import type {
  PurchaseOrder,
  PurchaseOrderDomainStatus,
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
    locationName: '',
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
    location: dto.warehouseId
      ? { id: dto.warehouseId, code: '', name: '', state: '', city: '' }
      : { ...EMPTY_LOCATION },
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
    vendorCode: '',
    vendorName: '',
    gstin: '',
    state: '',
    isInterstate: false,
    status: mapRfqVendorInviteStatus(v.inviteStatus),
    sentAt: v.invitedAt,
    respondedAt: v.respondedAt,
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    vendorRating: 0,
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
    purchaseRequisitionNumber: null,
    purchaseRequisitionIds: api.purchaseRequisitionId ? [api.purchaseRequisitionId] : [],
    purchaseRequisitionNumbers: [],
    buyer: { ...EMPTY_PARTY },
    location: { ...EMPTY_LOCATION },
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
    rfqNumber: '',
    vendor: {
      id: api.vendorId,
      code: '',
      name: '',
      gstin: '',
      state: '',
      isInterstate: false,
    },
    vendorReferenceNumber: '',
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
    rfqNumber: '',
    vendorName: '',
    vendorCode: '',
    vendorReferenceNumber: '',
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
    approvedBy: api.awardedById,
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
  if (s === 'partially_received') return 'partially_received'
  if (s === 'fully_received') return 'fully_received'
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
    pendingQty: Math.max(0, qty - received),
    invoicedQty: 0,
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
    status === 'draft'
      ? 'not_required'
      : status === 'pending_approval'
        ? 'pending'
        : status === 'cancelled'
          ? 'rejected'
          : 'approved'

  return {
    id: api.id,
    documentNumber: api.orderNumber,
    documentDate,
    status,
    orderType: 'standard',
    origin: mapApiPoOrigin(String(api.origin), Boolean(api.purchaseRequisitionId)),
    revisionNo: 0,
    buyer: { ...EMPTY_PARTY },
    location: { ...EMPTY_LOCATION },
    purchaseLocation: { ...EMPTY_LOCATION },
    deliveryLocation: { ...EMPTY_LOCATION },
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
    approvalStatus,
    invoiceStatus: 'not_invoiced',
    approvalIds: [],
    changeHistory: [],
    revisions: [],
    attachmentIds: [],
    sentToVendorAt: api.sentAt ?? null,
    releasedAt: api.sentAt ?? null,
    closedAt: api.closedAt ?? null,
    cancelledAt: api.cancelledAt ?? null,
    createdBy: '',
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
    locationName: domain.purchaseLocation.name || '—',
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

export { EMPTY_PARTY, toApiPriority, toApiPlanningPriority, toApiPurchaseType }
