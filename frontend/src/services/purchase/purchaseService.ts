/**
 * Purchase Module mock service — Promise API ready for future Node/MySQL swap.
 *
 * Pages should depend on these functions (not Zustand) when migrating to the
 * domain models in `types/purchaseDomain`. Existing store-backed screens are
 * unchanged until explicitly wired.
 */
import type {
  GoodsReceiptLine,
  GoodsReceiptNote,
  GrnInput,
  GrnListRow,
  PurchaseApproval,
  PurchaseApprovalDocumentType,
  PurchaseApprovalQueueFilters,
  PurchaseApprovalQueueRow,
  PurchaseApprovalQueueTab,
  PurchaseApprovalReviewDetail,
  PurchaseApprovalRole,
  PurchaseDashboardActivityRow,
  PurchaseDashboardCategorySlice,
  PurchaseDashboardData,
  PurchaseDashboardDeliveryRow,
  PurchaseDashboardFilters,
  PurchaseDashboardLocationOption,
  PurchaseDashboardPendingAction,
  PurchaseDashboardStatusBucket,
  PurchaseDashboardTrendPoint,
  PurchaseDashboardVendorRow,
  InvoiceMatchingResult,
  InvoiceMatchingResultStatus,
  PurchaseInvoice,
  PurchaseInvoiceInput,
  PurchaseInvoiceListRow,
  PurchaseInvoiceLine,
  PurchaseInvoiceOrigin,
  PurchaseInvoiceMatchTolerances,
  PurchaseItem,
  PurchaseItemCategory,
  PurchaseOrder,
  PurchaseOrderChangeEntry,
  PurchaseOrderInput,
  PurchaseOrderLine,
  PurchaseOrderLineItemType,
  PurchaseOrderLineStatus,
  PurchaseOrderLinkedDocuments,
  PurchaseOrderListRow,
  PurchaseOrderOrigin,
  PurchaseOrderReviseInput,
  PurchaseOrderType,
  PurchasePlanningPriority,
  PurchasePlanningPurchaseType,
  PurchasePlanningSheetInput,
  PurchasePlanningSheetRow,
  PurchasePlanningStatus,
  PurchaseRequisition,
  PurchaseRequisitionApprovalStatus,
  PurchaseRequisitionInput,
  PurchaseRequisitionLine,
  PurchaseRequisitionListRow,
  PurchaseReturn,
  PurchaseReturnInput,
  PurchaseReturnListRow,
  PurchaseReturnOrigin,
  PurchaseReturnReason,
  PurchaseSetup,
  QualityInspection,
  QualityInspectionInput,
  QualityInspectionListRow,
  QualityInspectionParameter,
  QualityInspectionResult,
  QuotationComparison,
  QuotationComparisonCriterion,
  QuotationComparisonInput,
  QuotationComparisonMethod,
  QuotationComparisonQuoteCell,
  QuotationComparisonRow,
  QuotationSelectionMode,
  RequestForQuotation,
  RfqInput,
  RfqLine,
  RfqListRow,
  Vendor,
  VendorQuotation,
  VendorQuotationInput,
  VendorQuotationLine,
  VendorQuotationListRow,
  BlanketPurchaseOrder,
} from '../../types/purchaseDomain'
import {
  GRN_DOMAIN_STATUS_LABELS,
  PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS,
  PURCHASE_APPROVAL_ROLE_LABELS,
  PURCHASE_APPROVAL_STATUS_LABELS,
  PURCHASE_ORDER_APPROVAL_STATUS_LABELS,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_ORDER_INVOICE_STATUS_LABELS,
  PURCHASE_INVOICE_ORIGIN_LABELS,
  PURCHASE_INVOICE_STATUS_LABELS,
  INVOICE_MATCHING_RESULT_STATUS_LABELS,
  PURCHASE_PLANNING_PRIORITY_LABELS,
  PURCHASE_PLANNING_STATUS_LABELS,
  PURCHASE_REQUISITION_APPROVAL_STATUS_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  QUALITY_INSPECTION_RESULT_LABELS,
  QUALITY_INSPECTION_STATUS_LABELS,
  PURCHASE_RETURN_DOMAIN_STATUS_LABELS,
  PURCHASE_RETURN_ORIGIN_LABELS,
  PURCHASE_RETURN_REASON_LABELS,
  RFQ_DOMAIN_STATUS_LABELS,
  VENDOR_QUOTATION_DOMAIN_STATUS_LABELS,
} from '../../types/purchaseDomain'
import {
  PURCHASE_DEMO_LOCATION,
  PURCHASE_DOMAIN_ACTORS,
  PURCHASE_DOMAIN_APPROVAL_HISTORY,
  PURCHASE_DOMAIN_APPROVALS,
  PURCHASE_DOMAIN_ATTACHMENTS,
  PURCHASE_DOMAIN_BLANKET_ORDERS,
  PURCHASE_DOMAIN_COMPARISONS,
  PURCHASE_DOMAIN_GRNS,
  PURCHASE_DOMAIN_INVOICES,
  PURCHASE_DOMAIN_ITEMS,
  PURCHASE_DOMAIN_ORDERS,
  PURCHASE_DOMAIN_QUALITY,
  PURCHASE_DOMAIN_REQUISITIONS,
  PURCHASE_DOMAIN_RETURNS,
  PURCHASE_DOMAIN_RFQS,
  PURCHASE_DOMAIN_VENDOR_QUOTATIONS,
  PURCHASE_DOMAIN_VENDORS,
} from '../../data/purchase/purchaseDomainSeed'
import { DEFAULT_PURCHASE_SETUP } from '../../data/purchase/purchaseSetupSeed'
import {
  actorForApprovalRole,
  resolveApprovalRolesForAmount,
  sessionApprovalRoles,
  sessionCanActAsApprover,
} from '../../utils/purchaseApprovalMatrix'
import { getSessionUser } from '../../utils/permissions'

const LATENCY_MS = 35

export class PurchaseServiceError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PurchaseServiceError'
    this.code = code
  }
}

interface PurchaseMockState {
  vendors: Vendor[]
  items: PurchaseItem[]
  requisitions: PurchaseRequisition[]
  planningSheet: PurchasePlanningSheetRow[]
  approvals: PurchaseApproval[]
  approvalHistory: typeof PURCHASE_DOMAIN_APPROVAL_HISTORY
  attachments: typeof PURCHASE_DOMAIN_ATTACHMENTS
  rfqs: RequestForQuotation[]
  vendorQuotations: VendorQuotation[]
  comparisons: QuotationComparison[]
  blanketOrders: BlanketPurchaseOrder[]
  orders: PurchaseOrder[]
  grns: GoodsReceiptNote[]
  qualityInspections: QualityInspection[]
  invoices: PurchaseInvoice[]
  returns: PurchaseReturn[]
  setup: PurchaseSetup
  seq: {
    pr: number
    rfq: number
    vq: number
    cmp: number
    po: number
    grn: number
    qi: number
    inv: number
    ret: number
    appr: number
    dn: number
    pps: number
  }
}

function cloneSeed(): PurchaseMockState {
  return {
    vendors: structuredClone(PURCHASE_DOMAIN_VENDORS),
    items: structuredClone(PURCHASE_DOMAIN_ITEMS),
    requisitions: structuredClone(PURCHASE_DOMAIN_REQUISITIONS),
    planningSheet: [],
    approvals: structuredClone(PURCHASE_DOMAIN_APPROVALS),
    approvalHistory: structuredClone(PURCHASE_DOMAIN_APPROVAL_HISTORY),
    attachments: structuredClone(PURCHASE_DOMAIN_ATTACHMENTS),
    rfqs: structuredClone(PURCHASE_DOMAIN_RFQS),
    vendorQuotations: structuredClone(PURCHASE_DOMAIN_VENDOR_QUOTATIONS),
    comparisons: structuredClone(PURCHASE_DOMAIN_COMPARISONS),
    blanketOrders: structuredClone(PURCHASE_DOMAIN_BLANKET_ORDERS),
    orders: structuredClone(PURCHASE_DOMAIN_ORDERS),
    grns: structuredClone(PURCHASE_DOMAIN_GRNS),
    qualityInspections: structuredClone(PURCHASE_DOMAIN_QUALITY),
    invoices: structuredClone(PURCHASE_DOMAIN_INVOICES),
    returns: structuredClone(PURCHASE_DOMAIN_RETURNS),
    setup: structuredClone(DEFAULT_PURCHASE_SETUP),
    seq: {
      pr: 1004,
      rfq: 2003,
      vq: 4003,
      cmp: 3002,
      po: 5004,
      grn: 6003,
      qi: 6103,
      inv: 7003,
      ret: 8003,
      appr: 20,
      dn: 9002,
      pps: 100,
    },
  }
}

let state = cloneSeed()
seedPlanningSheetFromApprovedDirectPrs()

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mapPrPriorityToPlanning(
  priority: PurchaseRequisition['priority'],
): PurchasePlanningPriority {
  if (priority === 'urgent') return 'critical'
  if (priority === 'high') return 'high'
  if (priority === 'low') return 'low'
  return 'medium'
}

function recomputePlanningAmounts(row: PurchasePlanningSheetRow): PurchasePlanningSheetRow {
  const net = Math.max(
    0,
    Number(row.requiredQuantity || 0) - Number(row.currentStock || 0) - Number(row.openPoQuantity || 0),
  )
  const expectedRate = Number(row.expectedRate || 0)
  return {
    ...row,
    netPurchaseQuantity: net,
    estimatedAmount: Number((net * expectedRate).toFixed(2)),
  }
}

function buildPlanningRowFromPrLine(
  pr: PurchaseRequisition,
  line: PurchaseRequisitionLine,
): PurchasePlanningSheetRow {
  const item = line.itemId ? state.items.find((i) => i.id === line.itemId) : undefined
  const preferred =
    line.preferredVendorId
      ? state.vendors.find((v) => v.id === line.preferredVendorId)
      : item?.preferredVendorId
        ? state.vendors.find((v) => v.id === item.preferredVendorId)
        : undefined
  const lastVendor = preferred
  const expectedRate = Number(line.estimatedRate || item?.standardRate || 0)
  const currentStock = Number(line.currentStock || 0)
  const openPoQuantity = Number(line.openPoQty || 0)
  const requiredQuantity = Number(line.quantity || 0)
  const net = Math.max(0, requiredQuantity - currentStock - openPoQuantity)
  state.seq.pps += 1
  return {
    id: genId('pps'),
    planningNumber: docNo('PPS', state.seq.pps),
    planningDate: todayDate(),
    purchaseRequisitionId: pr.id,
    purchaseRequisitionNumber: pr.documentNumber,
    purchaseRequisitionLineId: line.id,
    department: pr.department,
    requestedById: pr.requester.id,
    requestedByName: pr.requester.name,
    itemId: line.itemId || item?.id || '',
    itemCode: line.itemCode || item?.itemCode || '',
    itemName: line.itemName || item?.itemName || '',
    specification: line.specification || '',
    itemCategory: line.category || item?.category || 'consumable',
    requiredQuantity,
    uom: line.uom || item?.uom || 'NOS',
    requiredByDate: line.requiredDate || pr.expectedDeliveryDate || todayDate(),
    currentStock,
    openPoQuantity,
    netPurchaseQuantity: net,
    preferredVendorId: preferred?.id ?? null,
    preferredVendorName: preferred?.vendorName ?? line.preferredVendorName ?? null,
    preferredVendorCode: preferred?.vendorCode ?? (line.vendorNumber || null),
    lastPurchaseVendorId: lastVendor?.id ?? null,
    lastPurchaseVendorName: lastVendor?.vendorName ?? null,
    lastPurchaseRate: expectedRate || null,
    expectedRate,
    estimatedAmount: Number((net * expectedRate).toFixed(2)),
    purchaseType: 'direct_purchase',
    priority: mapPrPriorityToPlanning(pr.priority),
    buyerId: PURCHASE_DOMAIN_ACTORS.buyer.id,
    buyerName: PURCHASE_DOMAIN_ACTORS.buyer.name,
    status: preferred ? 'vendor_selected' : 'draft',
    purchaseOrderId: null,
    purchaseOrderNumber: null,
    orderDate: line.orderDate || '',
    actionMessage: false,
    remarks: line.remarks || '',
    createdBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
  }
}

/** Create one planning row per PR line when RFQ is not required. Idempotent. */
function syncPlanningSheetFromPr(pr: PurchaseRequisition): void {
  if (pr.rfqRequired) return
  if (pr.status !== 'approved' && pr.status !== 'converted_to_po') return
  for (const line of pr.lines) {
    const exists = state.planningSheet.some(
      (r) =>
        r.purchaseRequisitionId === pr.id && r.purchaseRequisitionLineId === line.id,
    )
    if (exists) continue
    if (!line.itemId && !line.itemCode.trim() && !line.itemName.trim()) continue
    state.planningSheet.unshift(buildPlanningRowFromPrLine(pr, line))
  }
}

function seedPlanningSheetFromApprovedDirectPrs(): void {
  for (const pr of state.requisitions) {
    syncPlanningSheetFromPr(pr)
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function docNo(kind: string, n: number): string {
  return `${kind}-2526-${n}`
}

function requireVendor(vendorId: string): Vendor {
  const vendor = state.vendors.find((v) => v.id === vendorId)
  if (!vendor) throw new PurchaseServiceError('VENDOR_NOT_FOUND', `Vendor not found: ${vendorId}`)
  return vendor
}

function requireItem(itemId: string): PurchaseItem {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) throw new PurchaseServiceError('ITEM_NOT_FOUND', `Purchase item not found: ${itemId}`)
  return item
}

function partyFromActor(actor: { id: string; code: string; name: string }) {
  return { id: actor.id, code: actor.code, name: actor.name }
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

function computeIntraTotals(taxable: number, freight = 0, other = 0, discount = 0, gstPct = 18) {
  const taxableAmount = Math.max(0, taxable - discount)
  const half = Number(((taxableAmount * gstPct) / 200).toFixed(2))
  return {
    currency: 'INR' as const,
    subtotal: taxable,
    discount,
    taxableAmount,
    cgst: half,
    sgst: half,
    igst: 0,
    freight,
    otherCharges: other,
    roundOff: 0,
    totalAmount: Number((taxableAmount + half * 2 + freight + other).toFixed(2)),
  }
}

function computeInterTotals(taxable: number, freight = 0, other = 0, discount = 0, gstPct = 18) {
  const taxableAmount = Math.max(0, taxable - discount)
  const igst = Number(((taxableAmount * gstPct) / 100).toFixed(2))
  return {
    currency: 'INR' as const,
    subtotal: taxable,
    discount,
    taxableAmount,
    cgst: 0,
    sgst: 0,
    igst,
    freight,
    otherCharges: other,
    roundOff: 0,
    totalAmount: Number((taxableAmount + igst + freight + other).toFixed(2)),
  }
}

function pushHistory(
  documentType: (typeof state.approvalHistory)[number]['documentType'],
  documentId: string,
  documentNumber: string,
  action: (typeof state.approvalHistory)[number]['action'],
  fromStatus: string,
  toStatus: string,
  remarks: string,
  actor = PURCHASE_DOMAIN_ACTORS.buyer,
) {
  state.approvalHistory.unshift({
    id: genId('prd-ah'),
    documentType,
    documentId,
    documentNumber,
    action,
    actorId: actor.id,
    actorName: actor.name,
    fromStatus,
    toStatus,
    remarks,
    actedAt: nowIso(),
  })
}

function createPendingApprovalLevel(input: {
  documentType: PurchaseApprovalDocumentType
  documentId: string
  documentNumber: string
  amount: number
  levelIndex: number
  requesterId: string
  requesterName: string
}): PurchaseApproval {
  const roles = resolveApprovalRolesForAmount(input.amount, state.setup)
  const role = roles[input.levelIndex] ?? 'purchase_head'
  const actor = actorForApprovalRole(role)
  return {
    id: genId('prd-appr'),
    documentType: input.documentType,
    documentId: input.documentId,
    documentNumber: input.documentNumber,
    level: input.levelIndex + 1,
    status: 'pending',
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    approverId: actor.id,
    approverName: actor.name,
    approverRole: role,
    delegatedFromId: null,
    delegatedFromName: null,
    requestedAt: nowIso(),
    respondedAt: null,
    remarks: '',
  }
}

function findDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
): PurchaseRequisition | PurchaseOrder {
  if (documentType === 'purchase_requisition') {
    const pr = state.requisitions.find((r) => r.id === documentId)
    if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${documentId}`)
    return pr
  }
  const po = state.orders.find((r) => r.id === documentId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${documentId}`)
  return po
}

function currentPendingApproval(documentId: string): PurchaseApproval | undefined {
  return state.approvals
    .filter((a) => a.documentId === documentId && a.status === 'pending')
    .sort((a, b) => a.level - b.level)[0]
}

function actingActorFromPending(pending: PurchaseApproval) {
  const session = getSessionUser()
  if (!sessionCanActAsApprover(pending.approverRole, pending.approverId, session)) {
    throw new PurchaseServiceError('NOT_APPROVER', 'You are not the assigned approver for this step')
  }
  return actorForApprovalRole(pending.approverRole)
}

async function advanceDocumentApproval(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  action: 'approve' | 'reject' | 'send_back',
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder> {
  const doc = findDocument(documentType, documentId)
  if (doc.status !== 'pending_approval') {
    throw new PurchaseServiceError('INVALID_STATUS', `Cannot ${action} from ${doc.status}`)
  }
  const pending = currentPendingApproval(documentId)
  if (!pending) {
    throw new PurchaseServiceError('NO_PENDING_APPROVAL', 'No pending approval step found')
  }
  const actor = actingActorFromPending(pending)
  const from = doc.status

  if (action === 'reject') {
    pending.status = 'rejected'
    pending.respondedAt = nowIso()
    pending.remarks = remarks
    pending.approverId = actor.id
    pending.approverName = actor.name
    doc.status = 'rejected'
    doc.updatedBy = actor.name
    doc.updatedAt = nowIso()
    pushHistory(documentType, doc.id, doc.documentNumber, 'rejected', from, doc.status, remarks, actor)
    return structuredClone(doc)
  }

  if (action === 'send_back') {
    pending.status = 'cancelled'
    pending.respondedAt = nowIso()
    pending.remarks = remarks
    pending.approverId = actor.id
    pending.approverName = actor.name
    for (const a of state.approvals) {
      if (a.documentId === documentId && a.status === 'pending') {
        a.status = 'cancelled'
        a.respondedAt = nowIso()
        a.remarks = remarks
      }
    }
    doc.status = 'draft'
    doc.updatedBy = actor.name
    doc.updatedAt = nowIso()
    pushHistory(documentType, doc.id, doc.documentNumber, 'returned', from, doc.status, remarks, actor)
    return structuredClone(doc)
  }

  // approve
  pending.status = 'approved'
  pending.respondedAt = nowIso()
  pending.remarks = remarks
  pending.approverId = actor.id
  pending.approverName = actor.name

  const chain = resolveApprovalRolesForAmount(doc.totalAmount, state.setup)
  const nextIndex = pending.level // 1-based level → next zero-based index
  if (nextIndex < chain.length) {
    pushHistory(documentType, doc.id, doc.documentNumber, 'approved', from, 'pending_approval', remarks, actor)
    const next = createPendingApprovalLevel({
      documentType,
      documentId: doc.id,
      documentNumber: doc.documentNumber,
      amount: doc.totalAmount,
      levelIndex: nextIndex,
      requesterId: doc.requester.id,
      requesterName: doc.requester.name,
    })
    state.approvals.unshift(next)
    doc.approvalIds = [...doc.approvalIds, next.id]
    doc.updatedBy = actor.name
    doc.updatedAt = nowIso()
    return structuredClone(doc)
  }

  doc.status = 'approved'
  doc.approver = partyFromActor(actor)
  doc.updatedBy = actor.name
  doc.updatedAt = nowIso()
  pushHistory(documentType, doc.id, doc.documentNumber, 'approved', from, 'approved', remarks, actor)
  if (documentType === 'purchase_requisition') {
    syncPlanningSheetFromPr(doc as PurchaseRequisition)
  }
  return structuredClone(doc)
}

function buildRequisitionLines(
  rows: NonNullable<PurchaseRequisitionInput['lines']>,
): PurchaseRequisitionLine[] {
  return rows.map((row, index) => {
    const item = row.itemId ? state.items.find((i) => i.id === row.itemId) : undefined
    const quantity = Number(row.quantity ?? 0)
    const estimatedRate = Number(row.estimatedRate ?? item?.standardRate ?? 0)
    const preferredVendor =
      row.preferredVendorId
        ? state.vendors.find((v) => v.id === row.preferredVendorId)
        : item?.preferredVendorId
          ? state.vendors.find((v) => v.id === item.preferredVendorId)
          : undefined
    return {
      id: row.id ?? genId('prd-prl'),
      lineNo: row.lineNo ?? index + 1,
      itemType: row.itemType ?? (item?.category === 'job_work' ? 'service' : 'inventory'),
      itemId: item?.id ?? row.itemId ?? '',
      itemCode: row.itemCode ?? item?.itemCode ?? '',
      itemName: row.itemName ?? item?.itemName ?? '',
      specification: row.specification ?? '',
      category: row.category ?? item?.category ?? 'consumable',
      uom: row.uom ?? item?.uom ?? 'NOS',
      hsnCode: row.hsnCode ?? item?.hsnCode ?? '',
      sacCode: row.sacCode ?? item?.sacCode ?? null,
      quantity,
      estimatedRate,
      amount: Number((quantity * estimatedRate).toFixed(2)),
      currentStock: Number(row.currentStock ?? 0),
      openPoQty: Number(row.openPoQty ?? 0),
      preferredVendorId: preferredVendor?.id ?? row.preferredVendorId ?? null,
      preferredVendorName: preferredVendor?.vendorName ?? row.preferredVendorName ?? null,
      vendorNumber: row.vendorNumber ?? preferredVendor?.vendorCode ?? '',
      requiredDate: row.requiredDate ?? todayDate(),
      orderDate: row.orderDate ?? '',
      customerName: row.customerName ?? '',
      locationId: row.locationId ?? PURCHASE_DEMO_LOCATION.id,
      locationName: row.locationName ?? PURCHASE_DEMO_LOCATION.name,
      binCode: row.binCode ?? '',
      purchaseOrderNumber: row.purchaseOrderNumber ?? '',
      purchaseQuoteNumber: row.purchaseQuoteNumber ?? '',
      purpose: row.purpose ?? '',
      remarks: row.remarks ?? '',
      attachmentNote: row.attachmentNote ?? '',
    }
  })
}

function recomputePrMoney(lines: PurchaseRequisitionLine[], taxPct = 18) {
  const subtotal = Number(lines.reduce((s, l) => s + l.amount, 0).toFixed(2))
  const estimatedTaxAmount = Number(((subtotal * taxPct) / 100).toFixed(2))
  const half = Number((estimatedTaxAmount / 2).toFixed(2))
  return {
    currency: 'INR' as const,
    subtotal,
    discount: 0,
    taxableAmount: subtotal,
    cgst: half,
    sgst: half,
    igst: 0,
    freight: 0,
    otherCharges: 0,
    roundOff: 0,
    totalAmount: Number((subtotal + estimatedTaxAmount).toFixed(2)),
    estimatedTaxPct: taxPct,
    estimatedTaxAmount,
  }
}

function itemTypeFromCategory(category: PurchaseItemCategory): PurchaseOrderLineItemType {
  if (category === 'job_work') return 'job_work'
  return category as PurchaseOrderLineItemType
}

function computeLineStatus(
  receivedQty: number,
  quantity: number,
  invoicedQty: number,
): PurchaseOrderLineStatus {
  if (invoicedQty >= quantity && quantity > 0) return 'invoiced'
  if (receivedQty <= 0) return 'open'
  if (receivedQty >= quantity) return 'received'
  return 'partial'
}

function buildOrderLines(
  rows: PurchaseOrderInput['lines'],
  isInterstate: boolean,
): PurchaseOrderLine[] {
  return rows.map((row, index) => {
    const item = requireItem(row.itemId)
    const quantity = row.quantity
    const rate = row.rate
    const discountPct = row.discountPct ?? 0
    const gross = quantity * rate
    const discountAmount =
      row.discountAmount != null && row.discountAmount > 0
        ? Number(row.discountAmount)
        : Number(((gross * discountPct) / 100).toFixed(2))
    const taxableAmount = Number((gross - discountAmount).toFixed(2))
    const gstRatePct = row.gstRatePct ?? item.gstRatePct
    const tax = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
    const half = Number((tax / 2).toFixed(2))
    const cgst = isInterstate ? 0 : half
    const sgst = isInterstate ? 0 : half
    const igst = isInterstate ? tax : 0
    const receivedQty = row.receivedQty ?? 0
    const invoicedQty = row.invoicedQty ?? 0
    const warehouseId = row.warehouseId ?? row.locationId ?? PURCHASE_DEMO_LOCATION.id
    const warehouseName = row.warehouseName ?? row.locationName ?? PURCHASE_DEMO_LOCATION.name
    const requiredDate = row.requiredDate ?? row.expectedDeliveryDate ?? todayDate()
    return {
      id: row.id ?? genId('prd-pol'),
      lineNo: row.lineNo ?? index + 1,
      itemType: row.itemType ?? itemTypeFromCategory(item.category),
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: row.description ?? item.description ?? item.itemName,
      specification: row.specification ?? '',
      category: item.category,
      uom: row.uom ?? item.uom,
      hsnCode: row.hsnCode ?? item.hsnCode,
      sacCode: row.sacCode !== undefined ? row.sacCode : item.sacCode,
      quantity,
      rate,
      discountPct,
      discountAmount,
      gstRatePct,
      taxAmount: tax,
      taxableAmount,
      cgst,
      sgst,
      igst,
      lineTotal: Number((taxableAmount + tax).toFixed(2)),
      requiredDate,
      deliverySchedule: row.deliverySchedule ?? 'Single lot',
      warehouseId,
      warehouseName,
      costCentre: row.costCentre ?? '',
      project: row.project ?? '',
      productionOrder: row.productionOrder ?? '',
      receivedQty,
      pendingQty: Math.max(0, quantity - receivedQty),
      invoicedQty,
      lineStatus: computeLineStatus(receivedQty, quantity, invoicedQty),
      locationId: warehouseId,
      locationName: warehouseName,
      expectedDeliveryDate: requiredDate,
      prLineId: row.prLineId ?? null,
      rfqLineId: row.rfqLineId ?? null,
      vendorQuotationLineId: row.vendorQuotationLineId ?? null,
      remarks: row.remarks ?? '',
    }
  })
}

function applyPoMoney(
  lines: PurchaseOrderLine[],
  extras: {
    freight?: number
    otherCharges?: number
    packingCharges?: number
    insuranceCharges?: number
    tradeDiscount?: number
    tcsAmount?: number
    discount?: number
  },
) {
  const basic = Number(lines.reduce((s, l) => s + l.quantity * l.rate, 0).toFixed(2))
  const lineDiscount = Number(lines.reduce((s, l) => s + l.discountAmount, 0).toFixed(2))
  const tradeDiscount = extras.tradeDiscount ?? 0
  const discount = extras.discount ?? lineDiscount + tradeDiscount
  const freight = extras.freight ?? 0
  const packing = extras.packingCharges ?? 0
  const insurance = extras.insuranceCharges ?? 0
  const other = extras.otherCharges ?? 0
  const tcs = extras.tcsAmount ?? 0
  const taxable = Number(
    (lines.reduce((s, l) => s + l.taxableAmount, 0) - tradeDiscount).toFixed(2),
  )
  const cgst = Number(lines.reduce((s, l) => s + l.cgst, 0).toFixed(2))
  const sgst = Number(lines.reduce((s, l) => s + l.sgst, 0).toFixed(2))
  const igst = Number(lines.reduce((s, l) => s + l.igst, 0).toFixed(2))
  const roundOff = 0
  const totalAmount = Number(
    (taxable + cgst + sgst + igst + freight + packing + insurance + other + tcs + roundOff).toFixed(
      2,
    ),
  )
  return {
    currency: 'INR' as const,
    subtotal: basic,
    discount,
    lineDiscount,
    tradeDiscount,
    taxableAmount: Math.max(0, taxable),
    cgst,
    sgst,
    igst,
    freight,
    packingCharges: packing,
    insuranceCharges: insurance,
    otherCharges: other,
    tcsAmount: tcs,
    roundOff,
    totalAmount,
  }
}

function toPurchaseOrderListRow(po: PurchaseOrder): PurchaseOrderListRow {
  const ordered = po.lines.reduce((s, l) => s + l.quantity, 0)
  const received = po.lines.reduce((s, l) => s + l.receivedQty, 0)
  const taxAmount = Number((po.cgst + po.sgst + po.igst).toFixed(2))
  return {
    id: po.id,
    documentNumber: po.documentNumber,
    documentDate: po.documentDate,
    vendorName: po.vendor.name,
    vendorGstin: po.vendor.gstin,
    locationName: po.purchaseLocation?.name ?? po.location.name,
    buyerName: po.buyer?.name ?? po.requester.name,
    currency: po.currency,
    expectedDeliveryDate: po.expectedDeliveryDate,
    basicAmount: po.subtotal,
    taxAmount,
    totalAmount: po.totalAmount,
    receivedPercentage: ordered > 0 ? Math.round((received / ordered) * 100) : 0,
    invoiceStatus: po.invoiceStatus,
    invoiceStatusLabel: PURCHASE_ORDER_INVOICE_STATUS_LABELS[po.invoiceStatus],
    approvalStatus: po.approvalStatus,
    approvalStatusLabel: PURCHASE_ORDER_APPROVAL_STATUS_LABELS[po.approvalStatus],
    status: po.status,
    statusLabel: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
    revisionNo: po.revisionNo,
    origin: po.origin,
    orderType: po.orderType,
  }
}

function assertPoEditable(po: PurchaseOrder) {
  if (!['draft', 'pending_approval'].includes(po.status)) {
    throw new PurchaseServiceError(
      'PO_NOT_EDITABLE',
      'Released purchase orders cannot be edited directly — use Revise Order',
    )
  }
}

function assertPoRevisable(po: PurchaseOrder) {
  if (['draft', 'pending_approval', 'cancelled', 'closed'].includes(po.status)) {
    throw new PurchaseServiceError(
      'PO_NOT_REVISABLE',
      'Only released (or later open) purchase orders can be revised',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** Reset mock DB to seed (tests / story demos). */
export async function resetPurchaseMockData(): Promise<void> {
  await delay(0)
  state = cloneSeed()
  seedPlanningSheetFromApprovedDirectPrs()
}

/* -------------------------------------------------------------------------- */
/* Purchase Planning Sheet                                                    */
/* -------------------------------------------------------------------------- */

export async function getPurchasePlanningSheet(): Promise<PurchasePlanningSheetRow[]> {
  await delay()
  // Keep in sync with any newly approved direct-PO PRs
  for (const pr of state.requisitions) syncPlanningSheetFromPr(pr)
  state.planningSheet = state.planningSheet.map((row) => ({
    ...row,
    itemCategory: row.itemCategory ?? 'consumable',
    orderDate: row.orderDate ?? '',
    actionMessage: row.actionMessage ?? false,
  }))
  return structuredClone(
    [...state.planningSheet].sort((a, b) => b.planningDate.localeCompare(a.planningDate)),
  )
}

export async function getPurchasePlanningSheetById(
  id: string,
): Promise<PurchasePlanningSheetRow | null> {
  await delay()
  return structuredClone(state.planningSheet.find((r) => r.id === id) ?? null)
}

function assertPlanningEditable(row: PurchasePlanningSheetRow) {
  if (row.status === 'completed' || row.status === 'cancelled') {
    throw new PurchaseServiceError(
      'PPS_READ_ONLY',
      'Completed or cancelled planning rows are read-only',
    )
  }
}

export async function updatePurchasePlanningSheetRow(
  id: string,
  patch: PurchasePlanningSheetInput,
): Promise<PurchasePlanningSheetRow> {
  await delay()
  const idx = state.planningSheet.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PPS_NOT_FOUND', `Planning row not found: ${id}`)
  const current = state.planningSheet[idx]
  assertPlanningEditable(current)

  if (patch.requiredByDate && patch.requiredByDate < current.planningDate) {
    throw new PurchaseServiceError(
      'PPS_INVALID_DATE',
      'Required By Date cannot be earlier than Planning Date',
    )
  }

  let preferredVendorId = current.preferredVendorId
  let preferredVendorName = current.preferredVendorName
  let preferredVendorCode = current.preferredVendorCode
  if (patch.preferredVendorId !== undefined) {
    if (!patch.preferredVendorId) {
      preferredVendorId = null
      preferredVendorName = null
      preferredVendorCode = null
    } else {
      const vendor = requireVendor(patch.preferredVendorId)
      preferredVendorId = vendor.id
      preferredVendorName = vendor.vendorName
      preferredVendorCode = vendor.vendorCode
    }
  }

  let next: PurchasePlanningSheetRow = {
    ...current,
    ...patch,
    preferredVendorId,
    preferredVendorName,
    preferredVendorCode,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  next = recomputePlanningAmounts(next)
  if (preferredVendorId && next.status === 'draft') {
    next.status = 'vendor_selected'
  }
  state.planningSheet[idx] = next
  return structuredClone(next)
}

export async function assignPurchasePlanningBuyer(
  id: string,
  buyerId: string,
  buyerName: string,
): Promise<PurchasePlanningSheetRow> {
  return updatePurchasePlanningSheetRow(id, { buyerId, buyerName })
}

export async function selectPurchasePlanningVendor(
  id: string,
  vendorId: string,
): Promise<PurchasePlanningSheetRow> {
  const row = await updatePurchasePlanningSheetRow(id, { preferredVendorId: vendorId })
  if (row.status !== 'cancelled' && row.status !== 'completed' && row.status !== 'po_created') {
    return updatePurchasePlanningSheetRow(id, { status: 'vendor_selected' })
  }
  return row
}

export async function approvePurchasePlanningRow(id: string): Promise<PurchasePlanningSheetRow> {
  await delay()
  const idx = state.planningSheet.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PPS_NOT_FOUND', `Planning row not found: ${id}`)
  const current = state.planningSheet[idx]
  assertPlanningEditable(current)
  if (!['draft', 'pending_review', 'vendor_selected'].includes(current.status)) {
    throw new PurchaseServiceError('PPS_INVALID_STATUS', `Cannot approve from ${current.status}`)
  }
  const next = {
    ...current,
    status: 'approved' as PurchasePlanningStatus,
    updatedBy: PURCHASE_DOMAIN_ACTORS.purchaseHead.name,
    updatedAt: nowIso(),
  }
  state.planningSheet[idx] = next
  return structuredClone(next)
}

export async function holdPurchasePlanningRow(
  id: string,
  remarks?: string,
): Promise<PurchasePlanningSheetRow> {
  await delay()
  const idx = state.planningSheet.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PPS_NOT_FOUND', `Planning row not found: ${id}`)
  const current = state.planningSheet[idx]
  assertPlanningEditable(current)
  const next = {
    ...current,
    status: 'pending_review' as PurchasePlanningStatus,
    remarks: remarks?.trim()
      ? `${current.remarks ? `${current.remarks} · ` : ''}Hold: ${remarks.trim()}`
      : current.remarks,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  state.planningSheet[idx] = next
  return structuredClone(next)
}

export async function cancelPurchasePlanningRow(
  id: string,
  remarks = 'Cancelled',
): Promise<PurchasePlanningSheetRow> {
  await delay()
  const idx = state.planningSheet.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PPS_NOT_FOUND', `Planning row not found: ${id}`)
  const current = state.planningSheet[idx]
  assertPlanningEditable(current)
  const next = {
    ...current,
    status: 'cancelled' as PurchasePlanningStatus,
    remarks: remarks
      ? `${current.remarks ? `${current.remarks} · ` : ''}${remarks}`
      : current.remarks,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  state.planningSheet[idx] = next
  return structuredClone(next)
}

export function canCreatePoFromPlanningRow(row: PurchasePlanningSheetRow): boolean {
  return (
    row.status === 'approved' &&
    Boolean(row.preferredVendorId) &&
    row.netPurchaseQuantity > 0 &&
    row.expectedRate > 0 &&
    Boolean(row.requiredByDate)
  )
}

/** Selected planning rows ready for header Create PO (Action Message). */
export function canSelectPlanningRowForPo(row: PurchasePlanningSheetRow): boolean {
  if (['completed', 'cancelled', 'po_created'].includes(row.status)) return false
  if (!row.preferredVendorId) return false
  const qty = row.netPurchaseQuantity > 0 ? row.netPurchaseQuantity : row.requiredQuantity
  return qty > 0 && row.expectedRate > 0
}

export type PurchaseOrderSeriesOption = {
  id: string
  code: string
  label: string
  prefix: string
}

/** PO number series from Purchase Setup (master) — single configured series only. */
export async function getPurchaseOrderSeriesOptions(): Promise<PurchaseOrderSeriesOption[]> {
  await delay()
  const series = state.setup.numberSeries.purchaseOrder
  const prefix = series.prefix || 'PO'
  return [
    {
      id: 'po-master',
      code: prefix,
      label: `Purchase Order (${prefix})`,
      prefix,
    },
  ]
}

/**
 * Create one PO per vendor from Action Message–selected planning rows.
 * Uses Purchase Setup PO number series (master) for document numbers.
 */
export async function createPurchaseOrdersFromPlanningSelection(
  planningRowIds: string[],
  options?: { seriesPrefix?: string },
): Promise<PurchaseOrder[]> {
  await delay()
  if (!planningRowIds.length) {
    throw new PurchaseServiceError('PPS_NO_SELECTION', 'Select at least one planning row (Action Message)')
  }
  const prefix =
    options?.seriesPrefix?.trim() || state.setup.numberSeries.purchaseOrder.prefix || 'PO'
  const selected = planningRowIds.map((id) => {
    const row = state.planningSheet.find((r) => r.id === id)
    if (!row) throw new PurchaseServiceError('PPS_NOT_FOUND', `Planning row not found: ${id}`)
    return row
  })

  for (const row of selected) {
    if (!row.actionMessage) {
      throw new PurchaseServiceError(
        'PPS_NOT_SELECTED',
        `${row.planningNumber}: tick Action Message before creating PO`,
      )
    }
    if (!canSelectPlanningRowForPo(row)) {
      throw new PurchaseServiceError(
        'PPS_PO_NOT_READY',
        `${row.planningNumber}: needs vendor, quantity > 0, and rate`,
      )
    }
  }

  const byVendor = new Map<string, PurchasePlanningSheetRow[]>()
  for (const row of selected) {
    const key = row.preferredVendorId!
    const list = byVendor.get(key) ?? []
    list.push(row)
    byVendor.set(key, list)
  }

  const createdOrders: PurchaseOrder[] = []
  for (const [, vendorRows] of byVendor) {
    const first = vendorRows[0]
    const pr = state.requisitions.find((r) => r.id === first.purchaseRequisitionId)
    if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', 'Linked purchase requisition not found')

    const series = state.setup.numberSeries.purchaseOrder
    const nextNum = Math.max(series.nextNumber, state.seq.po)
    const documentNumber = `${prefix}-2526-${nextNum}`

    const order = await createPurchaseOrder({
      vendorId: first.preferredVendorId!,
      documentNumber,
      origin: 'purchase_requisition',
      purchaseRequisitionId: pr.id,
      purchaseRequisitionNumber: pr.documentNumber,
      expectedDeliveryDate: first.requiredByDate || todayDate(),
      documentDate: first.orderDate || todayDate(),
      paymentTerms: pr.paymentTerms,
      deliveryTerms: pr.deliveryTerms,
      location: pr.location,
      purchaseLocation: pr.location,
      deliveryLocation: pr.location,
      department: pr.department,
      remarks: `Created from planning (${vendorRows.map((r) => r.planningNumber).join(', ')})`,
      lines: vendorRows.map((row) => {
        const qty = row.netPurchaseQuantity > 0 ? row.netPurchaseQuantity : row.requiredQuantity
        return {
          itemId: row.itemId,
          itemCode: row.itemCode,
          itemName: row.itemName,
          description: row.itemName,
          specification: row.specification,
          uom: row.uom,
          quantity: qty,
          rate: row.expectedRate,
          requiredDate: row.requiredByDate,
        }
      }),
    })

    state.setup.numberSeries.purchaseOrder = {
      ...series,
      nextNumber: nextNum + 1,
    }

    for (const row of vendorRows) {
      const idx = state.planningSheet.findIndex((r) => r.id === row.id)
      if (idx < 0) continue
      state.planningSheet[idx] = {
        ...state.planningSheet[idx],
        status: 'po_created',
        actionMessage: false,
        purchaseOrderId: order.id,
        purchaseOrderNumber: order.documentNumber,
        updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
        updatedAt: nowIso(),
      }
    }
    createdOrders.push(structuredClone(order))
  }

  return createdOrders
}

export async function createPurchaseOrderFromPlanningRow(id: string): Promise<PurchaseOrder> {
  await delay()
  const idx = state.planningSheet.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PPS_NOT_FOUND', `Planning row not found: ${id}`)
  const row = state.planningSheet[idx]
  if (!canCreatePoFromPlanningRow(row)) {
    throw new PurchaseServiceError(
      'PPS_PO_NOT_READY',
      'Create PO requires Approved status, vendor, net qty > 0, expected rate, and required-by date',
    )
  }
  const pr = state.requisitions.find((r) => r.id === row.purchaseRequisitionId)
  if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', 'Linked purchase requisition not found')
  if (pr.rfqRequired) {
    throw new PurchaseServiceError(
      'PPS_RFQ_REQUIRED',
      'RFQ-required requisitions must not create planning POs',
    )
  }

  const order = await createPurchaseOrder({
    vendorId: row.preferredVendorId!,
    origin: 'purchase_requisition',
    purchaseRequisitionId: pr.id,
    purchaseRequisitionNumber: pr.documentNumber,
    expectedDeliveryDate: row.requiredByDate,
    paymentTerms: pr.paymentTerms,
    deliveryTerms: pr.deliveryTerms,
    location: pr.location,
    purchaseLocation: pr.location,
    deliveryLocation: pr.location,
    department: pr.department,
    remarks: `Created from planning ${row.planningNumber}`,
    lines: [
      {
        itemId: row.itemId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        description: row.itemName,
        specification: row.specification,
        uom: row.uom,
        quantity: row.netPurchaseQuantity,
        rate: row.expectedRate,
        requiredDate: row.requiredByDate,
      },
    ],
  })

  state.planningSheet[idx] = {
    ...row,
    status: 'po_created',
    purchaseOrderId: order.id,
    purchaseOrderNumber: order.documentNumber,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  return structuredClone(order)
}

export async function getVendors(): Promise<Vendor[]> {
  await delay()
  return state.vendors.filter((v) => v.isActive)
}

export async function getPurchaseItems(): Promise<PurchaseItem[]> {
  await delay()
  return state.items.filter((i) => i.isActive)
}

export async function getPurchaseDashboard(
  filters: PurchaseDashboardFilters = {},
): Promise<PurchaseDashboardData> {
  await delay()

  const today = todayDate()
  const monthPrefix = today.slice(0, 7)
  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo
  const locationId = filters.locationId

  const inDateRange = (isoDate: string) => {
    if (dateFrom && isoDate < dateFrom) return false
    if (dateTo && isoDate > dateTo) return false
    return true
  }

  const matchLocation = (locId: string) => !locationId || locId === locationId

  const requisitions = state.requisitions.filter(
    (r) => inDateRange(r.documentDate) && matchLocation(r.location.id),
  )
  const rfqs = state.rfqs.filter((r) => inDateRange(r.documentDate) && matchLocation(r.location.id))
  const orders = state.orders.filter((o) => inDateRange(o.documentDate) && matchLocation(o.location.id))
  const grns = state.grns.filter((g) => inDateRange(g.documentDate) && matchLocation(g.location.id))
  const invoices = state.invoices.filter(
    (i) => inDateRange(i.documentDate) && matchLocation(i.location.id),
  )
  const approvals = state.approvals.filter((a) => a.status === 'pending')

  const openRequisitions = requisitions.filter((r) =>
    ['draft', 'pending_approval', 'approved'].includes(r.status),
  ).length
  const pendingPrApprovals = requisitions.filter((r) => r.status === 'pending_approval').length
  const openRfqs = rfqs.filter((r) => !['closed', 'cancelled'].includes(r.status)).length
  const ordersThisMonth = orders.filter((o) => o.documentDate.startsWith(monthPrefix))
  const purchaseOrdersThisMonth = ordersThisMonth.length
  const monthlyPurchaseValue = Number(
    ordersThisMonth.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2),
  )

  const openDeliveryOrders = orders.filter((o) =>
    ['released', 'partially_received', 'approved'].includes(o.status),
  )
  const pendingDeliveries = openDeliveryOrders.filter((o) =>
    o.lines.some((l) => l.pendingQty > 0),
  ).length
  const overdueOrders = openDeliveryOrders.filter(
    (o) => o.expectedDeliveryDate < today && o.lines.some((l) => l.pendingQty > 0),
  )
  const pendingGrns = grns.filter((g) =>
    ['draft', 'pending_inspection', 'partially_accepted'].includes(g.status),
  ).length
  const pendingPurchaseInvoices = invoices.filter((i) =>
    [
      'draft',
      'pending_verification',
      'matched',
      'mismatch',
      'pending_approval',
      'approved',
    ].includes(i.status),
  ).length

  const prStatus: PurchaseDashboardStatusBucket[] = [
    {
      key: 'draft',
      label: 'Draft',
      count: requisitions.filter((r) => r.status === 'draft').length,
      href: '/purchase/requisitions?status=draft',
    },
    {
      key: 'pending_approval',
      label: 'Pending Approval',
      count: requisitions.filter((r) => r.status === 'pending_approval').length,
      href: '/purchase/requisitions?status=pending_approval',
    },
    {
      key: 'approved',
      label: 'Approved',
      count: requisitions.filter((r) => r.status === 'approved').length,
      href: '/purchase/requisitions?status=approved',
    },
    {
      key: 'converted',
      label: 'Converted',
      count: requisitions.filter((r) =>
        ['converted_to_rfq', 'converted_to_po'].includes(r.status),
      ).length,
      href: '/purchase/requisitions?status=converted',
    },
  ]

  const poStatus: PurchaseDashboardStatusBucket[] = [
    {
      key: 'released',
      label: 'Released',
      count: orders.filter((o) => o.status === 'released').length,
      href: '/purchase/orders?status=released',
    },
    {
      key: 'partially_received',
      label: 'Partially Received',
      count: orders.filter((o) => o.status === 'partially_received').length,
      href: '/purchase/orders?status=partially_received',
    },
    {
      key: 'fully_received',
      label: 'Fully Received',
      count: orders.filter((o) => o.status === 'fully_received').length,
      href: '/purchase/orders?status=fully_received',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      count: overdueOrders.length,
      href: '/purchase/orders?status=overdue',
    },
  ]

  const upcomingDeliveries: PurchaseDashboardDeliveryRow[] = [...openDeliveryOrders]
    .filter((o) => o.lines.some((l) => l.pendingQty > 0))
    .sort((a, b) => a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate))
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      poNumber: o.documentNumber,
      vendorName: o.vendor.name,
      expectedDate: o.expectedDeliveryDate,
      itemCount: o.lines.length,
      poValue: o.totalAmount,
      status: o.status,
      statusLabel: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[o.status],
      href: `/purchase/orders/${o.id}`,
      isOverdue: o.expectedDeliveryDate < today,
    }))

  const poPendingApproval = orders.filter((o) => o.status === 'pending_approval').length
  const grnInspections = grns.filter((g) => g.status === 'pending_inspection').length
  const invoiceMismatches = invoices.filter((i) => i.status === 'mismatch' || i.matchStatus === 'mismatch')
    .length

  const pendingActions: PurchaseDashboardPendingAction[] = [
    {
      id: 'pr-approval',
      type: 'pr_approval' as const,
      label: 'PR approvals',
      count: pendingPrApprovals,
      href: '/purchase/requisitions?status=pending_approval',
      severity: 'primary' as const,
    },
    {
      id: 'po-approval',
      type: 'po_approval' as const,
      label: 'PO approvals',
      count: poPendingApproval,
      href: '/purchase/orders?status=pending_approval',
      severity: 'primary' as const,
    },
    {
      id: 'grn-inspection',
      type: 'grn_inspection' as const,
      label: 'GRN inspections',
      count: grnInspections,
      href: '/purchase/grn?status=pending_inspection',
      severity: 'warning' as const,
    },
    {
      id: 'invoice-mismatch',
      type: 'invoice_mismatch' as const,
      label: 'Invoice mismatches',
      count: invoiceMismatches,
      href: '/purchase/reports?focus=invoice-mismatch',
      severity: 'critical' as const,
    },
    {
      id: 'overdue-delivery',
      type: 'overdue_delivery' as const,
      label: 'Overdue deliveries',
      count: overdueOrders.length,
      href: '/purchase/orders?status=overdue',
      severity: 'critical' as const,
    },
  ].filter((a) => a.count > 0)

  const monthlyTrend: PurchaseDashboardTrendPoint[] = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(`${today}T00:00:00`)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const value = state.orders
      .filter((o) => o.documentDate.startsWith(key) && matchLocation(o.location.id))
      .reduce((sum, o) => sum + o.totalAmount, 0)
    monthlyTrend.push({
      month: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      value: Number(value.toFixed(2)),
    })
  }

  const categoryTotals = new Map<
    PurchaseItemCategory,
    { value: number; count: number }
  >()
  for (const order of orders) {
    for (const line of order.lines) {
      const prev = categoryTotals.get(line.category) ?? { value: 0, count: 0 }
      categoryTotals.set(line.category, {
        value: prev.value + line.lineTotal,
        count: prev.count + 1,
      })
    }
  }
  const categoryLabels: Record<PurchaseItemCategory, string> = {
    raw_material: 'Raw Materials',
    component: 'Components',
    consumable: 'Consumables',
    packing_material: 'Packing Materials',
    maintenance: 'Maintenance',
    job_work: 'Job Work',
  }
  const byCategory: PurchaseDashboardCategorySlice[] = [...categoryTotals.entries()]
    .map(([category, agg]) => ({
      category,
      label: categoryLabels[category],
      value: Number(agg.value.toFixed(2)),
      count: agg.count,
      href: `/purchase/orders?category=${category}`,
    }))
    .sort((a, b) => b.value - a.value)

  const vendorAgg = new Map<string, { name: string; poCount: number; totalValue: number }>()
  for (const order of orders) {
    const prev = vendorAgg.get(order.vendor.id) ?? {
      name: order.vendor.name,
      poCount: 0,
      totalValue: 0,
    }
    vendorAgg.set(order.vendor.id, {
      name: order.vendor.name,
      poCount: prev.poCount + 1,
      totalValue: prev.totalValue + order.totalAmount,
    })
  }
  const topVendors: PurchaseDashboardVendorRow[] = [...vendorAgg.entries()]
    .map(([vendorId, agg]) => ({
      vendorId,
      vendorName: agg.name,
      poCount: agg.poCount,
      totalValue: Number(agg.totalValue.toFixed(2)),
      href: `/purchase/orders?vendorId=${vendorId}`,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5)

  const recentActivity: PurchaseDashboardActivityRow[] = [
    ...state.approvalHistory.slice(0, 6).map((h) => ({
      id: h.id,
      at: h.actedAt,
      summary: `${h.action.replace(/_/g, ' ')} · ${h.documentNumber}`,
      href:
        h.documentType === 'purchase_requisition'
          ? `/purchase/requisitions/${h.documentId}`
          : h.documentType === 'purchase_order'
            ? `/purchase/orders/${h.documentId}`
            : '/purchase',
      kind: h.documentType,
    })),
    ...orders.slice(0, 3).map((o) => ({
      id: `act-po-${o.id}`,
      at: o.updatedAt ?? o.createdAt,
      summary: `PO ${o.documentNumber} · ${PURCHASE_ORDER_DOMAIN_STATUS_LABELS[o.status]}`,
      href: `/purchase/orders/${o.id}`,
      kind: 'purchase_order',
    })),
    ...grns.slice(0, 2).map((g) => ({
      id: `act-grn-${g.id}`,
      at: g.updatedAt ?? g.createdAt,
      summary: `GRN ${g.documentNumber} · ${g.status.replace(/_/g, ' ')}`,
      href: `/purchase/grn/${g.id}`,
      kind: 'goods_receipt_note',
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10)

  const locationMap = new Map<string, PurchaseDashboardLocationOption>()
  for (const row of [...state.requisitions, ...state.orders, ...state.grns]) {
    locationMap.set(row.location.id, {
      id: row.location.id,
      code: row.location.code,
      name: row.location.name,
    })
  }

  return {
    kpis: {
      openRequisitions,
      pendingPrApprovals,
      openRfqs,
      purchaseOrdersThisMonth,
      pendingDeliveries,
      pendingGrns,
      pendingPurchaseInvoices,
      monthlyPurchaseValue,
    },
    kpiHrefs: {
      openRequisitions: '/purchase/requisitions?status=open',
      pendingPrApprovals: '/purchase/requisitions?status=pending_approval',
      openRfqs: '/purchase/rfqs',
      purchaseOrdersThisMonth: '/purchase/orders?period=this_month',
      pendingDeliveries: '/purchase/orders?status=pending_delivery',
      pendingGrns: '/purchase/grn?status=pending',
      pendingPurchaseInvoices: '/purchase/invoices',
      monthlyPurchaseValue: '/purchase/orders?period=this_month',
    },
    prStatus,
    poStatus,
    upcomingDeliveries,
    pendingActions,
    monthlyTrend,
    byCategory,
    topVendors,
    recentActivity,
    locations: [...locationMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    pendingApprovals: approvals.filter(
      (a) =>
        a.documentType !== 'purchase_requisition' ||
        requisitions.some((r) => r.id === a.documentId),
    ),
    currency: 'INR',
    asOf: nowIso(),
    filtersApplied: { ...filters },
  }
}

export async function getPurchaseRequisitions(): Promise<PurchaseRequisitionListRow[]> {
  await delay()
  return [...state.requisitions]
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate) || b.documentNumber.localeCompare(a.documentNumber))
    .map(toListRow)
}

export async function getPurchaseRequisitionById(id: string): Promise<PurchaseRequisition | null> {
  await delay()
  return state.requisitions.find((r) => r.id === id) ?? null
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
    case 'cancelled':
      return 'n_a'
    default:
      return 'n_a'
  }
}

function toListRow(pr: PurchaseRequisition): PurchaseRequisitionListRow {
  const requiredBy =
    pr.expectedDeliveryDate ??
    (pr.lines.length
      ? [...pr.lines].map((l) => l.requiredDate).sort()[0] ?? null
      : null)
  const approvalStatus = approvalStatusFor(pr)
  const rfq = pr.convertedRfqId ? state.rfqs.find((r) => r.id === pr.convertedRfqId) : null
  const po = pr.convertedPoId ? state.orders.find((o) => o.id === pr.convertedPoId) : null
  return {
    ...pr,
    requiredBy,
    itemCount: pr.lines.length,
    estimatedValue: pr.totalAmount,
    approvalStatus,
    approvalStatusLabel: PURCHASE_REQUISITION_APPROVAL_STATUS_LABELS[approvalStatus],
    sourceLabel: PURCHASE_REQUISITION_SOURCE_LABELS[pr.source],
    priorityLabel: PURCHASE_REQUISITION_PRIORITY_LABELS[pr.priority],
    statusLabel: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
    convertedRfqNumber: rfq?.documentNumber ?? null,
    convertedPoNumber: po?.documentNumber ?? null,
  }
}

export async function getPurchaseRequisitionListSummary(): Promise<{
  total: number
  draft: number
  pendingApproval: number
  approved: number
  converted: number
}> {
  await delay()
  const rows = state.requisitions
  return {
    total: rows.length,
    draft: rows.filter((r) => r.status === 'draft').length,
    pendingApproval: rows.filter((r) => r.status === 'pending_approval').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    converted: rows.filter((r) =>
      ['converted_to_rfq', 'converted_to_po'].includes(r.status),
    ).length,
  }
}

export async function createPurchaseRequisition(
  input: PurchaseRequisitionInput,
): Promise<PurchaseRequisition> {
  await delay()
  const lines = buildRequisitionLines(input.lines ?? [])
  const taxPct = input.estimatedTaxPct ?? 18
  const money = recomputePrMoney(lines, taxPct)
  const n = state.seq.pr++
  const doc = docNo('PR', n)
  const created: PurchaseRequisition = {
    id: genId('prd-pr'),
    documentNumber: doc,
    documentDate: input.documentDate ?? todayDate(),
    status: 'draft',
    location: input.location ?? { ...PURCHASE_DEMO_LOCATION },
    department: input.department ?? '',
    requester: input.requester ?? partyFromActor(PURCHASE_DOMAIN_ACTORS.buyer),
    approver: input.approver ?? null,
    expectedDeliveryDate: input.expectedDeliveryDate ?? null,
    paymentTerms: input.paymentTerms ?? 'Net 30',
    deliveryTerms: input.deliveryTerms ?? 'FOR Chakan',
    vendor: input.vendor ?? null,
    source: input.source ?? 'manual',
    priority: input.priority ?? 'normal',
    requisitionType: input.requisitionType ?? 'material',
    costCentre: input.costCentre ?? '',
    project: input.project ?? '',
    productionOrderNo: input.productionOrderNo ?? '',
    maintenanceOrderNo: input.maintenanceOrderNo ?? '',
    referenceNumber: input.referenceNumber ?? '',
    purpose: input.purpose ?? null,
    rfqRequired: input.rfqRequired ?? true,
    ...money,
    lines,
    attachmentPlaceholders: input.attachmentPlaceholders ?? [],
    approvalIds: [],
    convertedRfqId: null,
    convertedPoId: null,
    createdBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: input.attachmentIds ?? [],
  }
  state.requisitions.unshift(created)
  return structuredClone(created)
}

export async function updatePurchaseRequisition(
  id: string,
  input: PurchaseRequisitionInput,
): Promise<PurchaseRequisition> {
  await delay()
  const idx = state.requisitions.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  const current = state.requisitions[idx]
  if (!['draft', 'rejected'].includes(current.status)) {
    throw new PurchaseServiceError('PR_NOT_EDITABLE', `Cannot update PR in status ${current.status}`)
  }
  const lines = input.lines ? buildRequisitionLines(input.lines) : current.lines
  const taxPct = input.estimatedTaxPct ?? current.estimatedTaxPct ?? 18
  const money = recomputePrMoney(lines, taxPct)
  const updated: PurchaseRequisition = {
    ...current,
    ...input,
    id: current.id,
    documentNumber: current.documentNumber,
    status: current.status,
    lines,
    ...money,
    attachmentPlaceholders: input.attachmentPlaceholders ?? current.attachmentPlaceholders,
    approvalIds: current.approvalIds,
    convertedRfqId: current.convertedRfqId,
    convertedPoId: current.convertedPoId,
    createdBy: current.createdBy,
    createdAt: current.createdAt,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
    remarks: input.remarks ?? current.remarks,
    attachmentIds: input.attachmentIds ?? current.attachmentIds,
  }
  state.requisitions[idx] = updated
  return structuredClone(updated)
}

export async function deletePurchaseRequisition(id: string): Promise<void> {
  await delay()
  const idx = state.requisitions.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  const current = state.requisitions[idx]
  if (current.status !== 'draft' && current.status !== 'rejected') {
    throw new PurchaseServiceError('PR_NOT_DELETABLE', `Only draft/rejected PRs can be deleted`)
  }
  state.requisitions.splice(idx, 1)
}

export async function submitPurchaseRequisition(id: string): Promise<PurchaseRequisition> {
  await delay()
  const pr = state.requisitions.find((r) => r.id === id)
  if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  if (pr.status !== 'draft' && pr.status !== 'rejected') {
    throw new PurchaseServiceError('PR_INVALID_STATUS', `Cannot submit from ${pr.status}`)
  }
  if (pr.lines.length === 0) {
    throw new PurchaseServiceError('PR_NO_LINES', 'Add at least one line before submit')
  }
  const from = pr.status
  pr.status = 'pending_approval'
  pr.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pr.updatedAt = nowIso()
  const approval = createPendingApprovalLevel({
    documentType: 'purchase_requisition',
    documentId: pr.id,
    documentNumber: pr.documentNumber,
    amount: pr.totalAmount,
    levelIndex: 0,
    requesterId: pr.requester.id,
    requesterName: pr.requester.name,
  })
  state.approvals.unshift(approval)
  pr.approvalIds = [...pr.approvalIds, approval.id]
  pushHistory('purchase_requisition', pr.id, pr.documentNumber, 'submitted', from, pr.status, 'Submitted for approval')
  return structuredClone(pr)
}

export async function approvePurchaseRequisition(
  id: string,
  remarks = 'Approved',
): Promise<PurchaseRequisition> {
  await delay()
  return advanceDocumentApproval('purchase_requisition', id, 'approve', remarks) as Promise<PurchaseRequisition>
}

export async function rejectPurchaseRequisition(
  id: string,
  remarks = 'Rejected',
): Promise<PurchaseRequisition> {
  await delay()
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Rejection comments are mandatory')
  }
  return advanceDocumentApproval('purchase_requisition', id, 'reject', remarks) as Promise<PurchaseRequisition>
}

export async function cancelPurchaseRequisition(
  id: string,
  remarks = 'Cancelled',
): Promise<PurchaseRequisition> {
  await delay()
  const pr = state.requisitions.find((r) => r.id === id)
  if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  if (['converted_to_rfq', 'converted_to_po', 'closed', 'cancelled'].includes(pr.status)) {
    throw new PurchaseServiceError('PR_INVALID_STATUS', `Cannot cancel from ${pr.status}`)
  }
  const from = pr.status
  pr.status = 'cancelled'
  pr.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pr.updatedAt = nowIso()
  pr.remarks = remarks ? `${pr.remarks ? `${pr.remarks} · ` : ''}${remarks}` : pr.remarks
  for (const a of state.approvals) {
    if (a.documentId === id && a.status === 'pending') {
      a.status = 'cancelled'
      a.respondedAt = nowIso()
      a.remarks = remarks
    }
  }
  pushHistory('purchase_requisition', pr.id, pr.documentNumber, 'cancelled', from, pr.status, remarks)
  return structuredClone(pr)
}

export async function duplicatePurchaseRequisition(id: string): Promise<PurchaseRequisition> {
  await delay()
  const source = state.requisitions.find((r) => r.id === id)
  if (!source) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  return createPurchaseRequisition({
    documentDate: todayDate(),
    location: source.location,
    department: source.department,
    requester: source.requester,
    expectedDeliveryDate: source.expectedDeliveryDate,
    paymentTerms: source.paymentTerms,
    deliveryTerms: source.deliveryTerms,
    vendor: source.vendor,
    source: source.source,
    priority: source.priority,
    purpose: source.purpose ? `Copy of ${source.documentNumber}` : `Copy of ${source.documentNumber}`,
    remarks: `Duplicated from ${source.documentNumber}`,
    rfqRequired: source.rfqRequired,
    lines: source.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      estimatedRate: l.estimatedRate,
      requiredDate: l.requiredDate,
      locationId: l.locationId,
      locationName: l.locationName,
      remarks: l.remarks,
    })),
  })
}

export async function convertPurchaseRequisitionToRfq(id: string): Promise<RequestForQuotation> {
  const pr = state.requisitions.find((r) => r.id === id)
  if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  if (pr.status !== 'approved') {
    throw new PurchaseServiceError('PR_NOT_APPROVED', 'Only approved requisitions can convert to RFQ')
  }
  if (!pr.rfqRequired) {
    throw new PurchaseServiceError(
      'PR_DIRECT_PO',
      'This requisition is marked for direct Purchase Order — convert to PO instead of RFQ',
    )
  }
  const preferredVendorIds = [
    ...new Set(
      pr.lines
        .map((l) => state.items.find((i) => i.id === l.itemId)?.preferredVendorId)
        .filter((v): v is string => Boolean(v)),
    ),
  ]
  const vendorIds =
    preferredVendorIds.length > 0
      ? preferredVendorIds
      : state.vendors.filter((v) => v.isActive).slice(0, 2).map((v) => v.id)
  return createRFQ({
    purchaseRequisitionIds: [pr.id],
    purchaseRequisitionId: pr.id,
    vendorIds,
    lines: pr.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      itemCode: l.itemCode,
      itemName: l.itemName,
      specification: l.specification,
      hsnCode: l.hsnCode,
      sacCode: l.sacCode,
      uom: l.uom,
      requiredDate: l.requiredDate,
      targetPrice: l.estimatedRate,
      purchaseRequisitionId: pr.id,
      purchaseRequisitionNumber: pr.documentNumber,
      prLineId: l.id,
      remarks: l.remarks,
    })),
    expectedDeliveryDate: pr.expectedDeliveryDate,
    paymentTerms: pr.paymentTerms,
    deliveryTerms: pr.deliveryTerms,
    location: pr.location,
    purchaseLocation: pr.location,
    deliveryLocation: pr.location,
    department: pr.department,
    remarks: `Created from ${pr.documentNumber}`,
  })
}

function lastPurchasePriceForVendorItem(vendorId: string, itemId: string): number | null {
  for (const po of state.orders) {
    if (po.vendor.id !== vendorId) continue
    const line = po.lines.find((l) => l.itemId === itemId)
    if (line) return line.rate
  }
  return state.items.find((i) => i.id === itemId)?.standardRate ?? null
}

function buildRfqVendors(rfqId: string, vendorIds: string[], lineItemIds: string[]): RequestForQuotation['vendors'] {
  return vendorIds.map((vendorId) => {
    const v = requireVendor(vendorId)
    const sampleItemId = lineItemIds[0]
    return {
      id: genId('prd-rfqv'),
      rfqId,
      vendorId: v.id,
      vendorCode: v.vendorCode,
      vendorName: v.vendorName,
      gstin: v.gstin,
      state: v.state,
      isInterstate: v.isInterstate,
      status: 'invited' as const,
      sentAt: null,
      respondedAt: null,
      contactPerson: v.contactPerson,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      vendorRating: v.rating,
      lastPurchasePrice: sampleItemId ? lastPurchasePriceForVendorItem(v.id, sampleItemId) : null,
      selected: true,
      remarks: '',
    }
  })
}

function buildRfqLines(input: RfqInput): RfqLine[] {
  const prIds = [
    ...new Set(
      [
        ...(input.purchaseRequisitionIds ?? []),
        ...(input.purchaseRequisitionId ? [input.purchaseRequisitionId] : []),
      ].filter(Boolean),
    ),
  ] as string[]
  const prs = prIds
    .map((id) => state.requisitions.find((r) => r.id === id))
    .filter((r): r is PurchaseRequisition => Boolean(r))

  if (input.lines?.length) {
    return input.lines.map((row, index) => {
      const item = requireItem(row.itemId)
      const quantity = Number(row.quantity ?? 1)
      const targetPrice = Number(row.targetPrice ?? item.standardRate)
      return {
        id: row.id ?? genId('prd-rfql'),
        lineNo: row.lineNo ?? index + 1,
        purchaseRequisitionId: row.purchaseRequisitionId ?? null,
        purchaseRequisitionNumber: row.purchaseRequisitionNumber ?? null,
        prLineId: row.prLineId ?? null,
        itemId: item.id,
        itemCode: row.itemCode ?? item.itemCode,
        itemName: row.itemName ?? item.itemName,
        specification: row.specification ?? item.description ?? '',
        hsnCode: row.hsnCode ?? item.hsnCode,
        sacCode: row.sacCode ?? item.sacCode,
        quantity,
        uom: row.uom ?? item.uom,
        requiredDate: row.requiredDate ?? todayDate(),
        targetPrice,
        amount: Number((quantity * targetPrice).toFixed(2)),
        remarks: row.remarks ?? '',
      }
    })
  }

  if (prs.length) {
    const lines: RfqLine[] = []
    let lineNo = 1
    for (const pr of prs) {
      for (const l of pr.lines) {
        lines.push({
          id: genId('prd-rfql'),
          lineNo: lineNo++,
          purchaseRequisitionId: pr.id,
          purchaseRequisitionNumber: pr.documentNumber,
          prLineId: l.id,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          specification: l.specification || '',
          hsnCode: l.hsnCode,
          sacCode: l.sacCode,
          quantity: l.quantity,
          uom: l.uom,
          requiredDate: l.requiredDate,
          targetPrice: l.estimatedRate,
          amount: l.amount,
          remarks: l.remarks,
        })
      }
    }
    return lines
  }

  const itemIds = input.itemIds ?? []
  return itemIds.map((itemId, index) => {
    const item = requireItem(itemId)
    return {
      id: genId('prd-rfql'),
      lineNo: index + 1,
      purchaseRequisitionId: null,
      purchaseRequisitionNumber: null,
      prLineId: null,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      specification: item.description ?? '',
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      quantity: 1,
      uom: item.uom,
      requiredDate: todayDate(),
      targetPrice: item.standardRate,
      amount: item.standardRate,
      remarks: '',
    }
  })
}

function syncRfqDerived(rfq: RequestForQuotation) {
  rfq.lineItemIds = rfq.lines.map((l) => l.itemId)
  rfq.itemSummaries = rfq.lines.map((l) => ({
    itemId: l.itemId,
    itemCode: l.itemCode,
    itemName: l.itemName,
    quantity: l.quantity,
    uom: l.uom,
  }))
  rfq.estimatedValue = Number(rfq.lines.reduce((s, l) => s + l.amount, 0).toFixed(2))
  rfq.purchaseRequisitionId = rfq.purchaseRequisitionIds[0] ?? null
  rfq.purchaseRequisitionNumber = rfq.purchaseRequisitionNumbers[0] ?? null
}

function toRfqListRow(rfq: RequestForQuotation): RfqListRow {
  const responsesReceived = rfq.vendors.filter((v) =>
    ['quoted', 'declined'].includes(v.status),
  ).length
  return {
    id: rfq.id,
    documentNumber: rfq.documentNumber,
    documentDate: rfq.documentDate,
    bidDueDate: rfq.bidDueDate,
    buyerName: rfq.buyer?.name ?? rfq.requester.name,
    locationName: rfq.purchaseLocation?.name ?? rfq.location.name,
    vendorCount: rfq.vendors.filter((v) => v.selected).length || rfq.vendors.length,
    itemCount: rfq.lines.length,
    estimatedValue: rfq.estimatedValue,
    responsesReceived,
    status: rfq.status,
    statusLabel: RFQ_DOMAIN_STATUS_LABELS[rfq.status],
    purchaseRequisitionNumbers: rfq.purchaseRequisitionNumbers ?? [],
  }
}

export async function convertPurchaseRequisitionToPo(id: string): Promise<PurchaseOrder> {
  await delay()
  const pr = state.requisitions.find((r) => r.id === id)
  if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  if (pr.status === 'approved' && pr.rfqRequired) {
    throw new PurchaseServiceError(
      'RFQ_REQUIRED',
      'This requisition requires an RFQ before a Purchase Order can be created',
    )
  }
  if (pr.status !== 'approved' && pr.status !== 'converted_to_rfq') {
    throw new PurchaseServiceError(
      'PR_NOT_READY_FOR_PO',
      'Only approved (direct PO) or RFQ-converted requisitions can create a PO',
    )
  }
  const preferred =
    pr.lines
      .map((l) => state.items.find((i) => i.id === l.itemId)?.preferredVendorId)
      .find((v): v is string => Boolean(v)) ?? state.vendors.find((v) => v.isActive)?.id
  if (!preferred) {
    throw new PurchaseServiceError('NO_VENDOR', 'No vendor available to create PO')
  }
  const order = await createPurchaseOrder({
    vendorId: preferred,
    origin: 'purchase_requisition',
    purchaseRequisitionId: pr.id,
    purchaseRequisitionNumber: pr.documentNumber,
    expectedDeliveryDate: pr.expectedDeliveryDate ?? todayDate(),
    paymentTerms: pr.paymentTerms,
    deliveryTerms: pr.deliveryTerms,
    location: pr.location,
    purchaseLocation: pr.location,
    deliveryLocation: pr.location,
    department: pr.department,
    remarks: `Created from ${pr.documentNumber}`,
    lines: pr.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      rate: l.estimatedRate,
      expectedDeliveryDate: l.requiredDate,
      requiredDate: l.requiredDate,
      locationId: l.locationId,
      locationName: l.locationName,
      warehouseId: l.locationId,
      warehouseName: l.locationName,
      prLineId: l.id,
      remarks: l.remarks,
    })),
  })
  return order
}

export async function getRFQs(): Promise<RequestForQuotation[]> {
  await delay()
  return [...state.rfqs].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getRfqList(): Promise<RfqListRow[]> {
  await delay()
  return [...state.rfqs]
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate))
    .map(toRfqListRow)
}

export async function getRFQById(id: string): Promise<RequestForQuotation | null> {
  await delay()
  return state.rfqs.find((r) => r.id === id) ?? null
}

export async function createRFQ(input: RfqInput): Promise<RequestForQuotation> {
  await delay()
  if (!input.vendorIds?.length) {
    throw new PurchaseServiceError('RFQ_NO_VENDORS', 'Select at least one vendor')
  }

  const prIds = [
    ...new Set(
      [
        ...(input.purchaseRequisitionIds ?? []),
        ...(input.purchaseRequisitionId ? [input.purchaseRequisitionId] : []),
      ].filter(Boolean),
    ),
  ] as string[]

  const prs: PurchaseRequisition[] = []
  for (const prId of prIds) {
    const pr = state.requisitions.find((r) => r.id === prId)
    if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `PR not found: ${prId}`)
    if (pr.status !== 'approved' && pr.status !== 'converted_to_rfq') {
      throw new PurchaseServiceError('PR_NOT_APPROVED', `${pr.documentNumber} must be approved before RFQ`)
    }
    prs.push(pr)
  }

  const lines = buildRfqLines(input)
  if (lines.length === 0) {
    throw new PurchaseServiceError('RFQ_NO_ITEMS', 'RFQ requires at least one item line')
  }

  const n = state.seq.rfq++
  const id = genId('prd-rfq')
  const location = input.location ?? input.purchaseLocation ?? prs[0]?.location ?? { ...PURCHASE_DEMO_LOCATION }
  const buyer = input.buyer ?? input.requester ?? partyFromActor(PURCHASE_DOMAIN_ACTORS.buyer)
  const vendors = buildRfqVendors(
    id,
    input.vendorIds,
    lines.map((l) => l.itemId),
  )

  const created: RequestForQuotation = {
    id,
    documentNumber: docNo('RFQ', n),
    documentDate: input.documentDate ?? todayDate(),
    status: 'draft',
    purchaseRequisitionId: prs[0]?.id ?? null,
    purchaseRequisitionNumber: prs[0]?.documentNumber ?? null,
    purchaseRequisitionIds: prs.map((p) => p.id),
    purchaseRequisitionNumbers: prs.map((p) => p.documentNumber),
    buyer,
    location,
    purchaseLocation: input.purchaseLocation ?? location,
    deliveryLocation: input.deliveryLocation ?? location,
    department: input.department ?? 'Purchase',
    requester: input.requester ?? buyer,
    currency: input.currency ?? 'INR',
    paymentTerms: input.paymentTerms ?? prs[0]?.paymentTerms ?? 'Net 30',
    deliveryTerms: input.deliveryTerms ?? prs[0]?.deliveryTerms ?? 'FOR Chakan',
    freightTerms: input.freightTerms ?? 'Vendor',
    inspectionRequirement: input.inspectionRequirement ?? '',
    technicalContact: input.technicalContact ?? '',
    commercialContact: input.commercialContact ?? buyer.name,
    expectedDeliveryDate: input.expectedDeliveryDate ?? prs[0]?.expectedDeliveryDate ?? null,
    bidDueDate: input.bidDueDate ?? todayDate(),
    vendors,
    lines,
    lineItemIds: [],
    itemSummaries: [],
    estimatedValue: 0,
    selectedVendorId: null,
    comparisonId: null,
    sentAt: null,
    createdBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: input.attachmentIds ?? [],
  }
  syncRfqDerived(created)

  state.rfqs.unshift(created)
  for (const pr of prs) {
    if (pr.status === 'approved') {
      pr.status = 'converted_to_rfq'
      pr.convertedRfqId = created.id
      pr.updatedAt = nowIso()
      pr.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
    }
  }
  return structuredClone(created)
}

export async function updateRFQ(id: string, input: RfqInput): Promise<RequestForQuotation> {
  await delay()
  const idx = state.rfqs.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('RFQ_NOT_FOUND', `RFQ not found: ${id}`)
  const current = state.rfqs[idx]
  if (current.status !== 'draft') {
    throw new PurchaseServiceError('RFQ_NOT_EDITABLE', `Cannot update RFQ in status ${current.status}`)
  }

  const lines =
    input.lines || input.itemIds || input.purchaseRequisitionIds
      ? buildRfqLines({
          ...input,
          vendorIds: input.vendorIds?.length
            ? input.vendorIds
            : current.vendors.map((v) => v.vendorId),
        })
      : current.lines

  const vendorIds = input.vendorIds?.length
    ? input.vendorIds
    : current.vendors.filter((v) => v.selected).map((v) => v.vendorId)
  if (!vendorIds.length) {
    throw new PurchaseServiceError('RFQ_NO_VENDORS', 'Select at least one vendor')
  }

  const prIds = [
    ...new Set(
      [
        ...(input.purchaseRequisitionIds ?? current.purchaseRequisitionIds ?? []),
        ...(input.purchaseRequisitionId ? [input.purchaseRequisitionId] : []),
      ].filter(Boolean),
    ),
  ] as string[]
  const prNumbers = prIds
    .map((pid) => state.requisitions.find((r) => r.id === pid)?.documentNumber)
    .filter((n): n is string => Boolean(n))

  const updated: RequestForQuotation = {
    ...current,
    documentDate: input.documentDate ?? current.documentDate,
    purchaseRequisitionIds: prIds,
    purchaseRequisitionNumbers: prNumbers,
    buyer: input.buyer ?? current.buyer,
    location: input.location ?? current.location,
    purchaseLocation: input.purchaseLocation ?? current.purchaseLocation,
    deliveryLocation: input.deliveryLocation ?? current.deliveryLocation,
    department: input.department ?? current.department,
    requester: input.requester ?? current.requester,
    currency: input.currency ?? current.currency,
    paymentTerms: input.paymentTerms ?? current.paymentTerms,
    deliveryTerms: input.deliveryTerms ?? current.deliveryTerms,
    freightTerms: input.freightTerms ?? current.freightTerms,
    inspectionRequirement: input.inspectionRequirement ?? current.inspectionRequirement,
    technicalContact: input.technicalContact ?? current.technicalContact,
    commercialContact: input.commercialContact ?? current.commercialContact,
    expectedDeliveryDate:
      input.expectedDeliveryDate !== undefined ? input.expectedDeliveryDate : current.expectedDeliveryDate,
    bidDueDate: input.bidDueDate ?? current.bidDueDate,
    vendors: buildRfqVendors(
      current.id,
      vendorIds,
      lines.map((l) => l.itemId),
    ),
    lines,
    remarks: input.remarks ?? current.remarks,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  syncRfqDerived(updated)
  state.rfqs[idx] = updated
  return structuredClone(updated)
}

export async function sendRFQ(id: string): Promise<RequestForQuotation> {
  await delay()
  const rfq = state.rfqs.find((r) => r.id === id)
  if (!rfq) throw new PurchaseServiceError('RFQ_NOT_FOUND', `RFQ not found: ${id}`)
  if (rfq.status !== 'draft') {
    throw new PurchaseServiceError('RFQ_INVALID_STATUS', `Cannot send RFQ from ${rfq.status}`)
  }
  const selected = rfq.vendors.filter((v) => v.selected)
  if (selected.length < 1) {
    throw new PurchaseServiceError('RFQ_NO_VENDORS', 'Select at least one vendor before send')
  }
  if (rfq.lines.length === 0) {
    throw new PurchaseServiceError('RFQ_NO_ITEMS', 'Add item lines before send')
  }
  const now = nowIso()
  rfq.status = 'sent'
  rfq.sentAt = now
  rfq.updatedAt = now
  rfq.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  for (const v of rfq.vendors) {
    if (v.selected) {
      v.status = 'sent'
      v.sentAt = now
    }
  }
  return structuredClone(rfq)
}

export async function cancelRFQ(id: string, remarks = 'Cancelled'): Promise<RequestForQuotation> {
  await delay()
  const rfq = state.rfqs.find((r) => r.id === id)
  if (!rfq) throw new PurchaseServiceError('RFQ_NOT_FOUND', `RFQ not found: ${id}`)
  if (['closed', 'cancelled'].includes(rfq.status)) {
    throw new PurchaseServiceError('RFQ_INVALID_STATUS', `Cannot cancel from ${rfq.status}`)
  }
  rfq.status = 'cancelled'
  rfq.remarks = remarks || rfq.remarks
  rfq.updatedAt = nowIso()
  rfq.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  return structuredClone(rfq)
}

export async function getRecommendedVendorsForItems(itemIds: string[]): Promise<Vendor[]> {
  await delay()
  const preferred = new Set(
    itemIds
      .map((id) => state.items.find((i) => i.id === id)?.preferredVendorId)
      .filter((v): v is string => Boolean(v)),
  )
  const fromPreferred = state.vendors.filter((v) => preferred.has(v.id) && v.isActive)
  if (fromPreferred.length >= 2) return structuredClone(fromPreferred)
  const extras = state.vendors.filter((v) => v.isActive && !preferred.has(v.id)).slice(0, 3)
  return structuredClone([...fromPreferred, ...extras])
}

function buildVendorQuotationLines(
  rows: VendorQuotationInput['lines'],
  isInterstate: boolean,
): VendorQuotationLine[] {
  return rows.map((row, index) => {
    const item = requireItem(row.itemId)
    const quantity = Number(row.quantity) || 0
    const rate = Number(row.rate) || 0
    const discountPct = Number(row.discountPct) || 0
    const gross = quantity * rate
    const discountAmount =
      row.discountAmount != null && row.discountAmount > 0
        ? Number(row.discountAmount)
        : Number(((gross * discountPct) / 100).toFixed(2))
    const taxableAmount = Number((gross - discountAmount).toFixed(2))
    const gstRatePct = row.gstRatePct ?? item.gstRatePct
    const tax = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
    const half = Number((tax / 2).toFixed(2))
    const cgst = isInterstate ? 0 : half
    const sgst = isInterstate ? 0 : half
    const igst = isInterstate ? tax : 0
    const freightAllocation = Number(row.freightAllocation) || 0
    const otherCharges = Number(row.otherCharges) || 0
    const lineTotal = Number((taxableAmount + tax).toFixed(2))
    const landedCost = Number((lineTotal + freightAllocation + otherCharges).toFixed(2))
    return {
      id: row.id ?? genId('prd-vql'),
      lineNo: row.lineNo ?? index + 1,
      rfqLineId: row.rfqLineId ?? null,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: row.description ?? item.description ?? item.itemName,
      uom: row.uom ?? item.uom,
      hsnCode: row.hsnCode ?? item.hsnCode,
      quantity,
      rate,
      discountPct,
      discountAmount,
      gstRatePct,
      taxAmount: tax,
      taxableAmount,
      cgst,
      sgst,
      igst,
      freightAllocation,
      otherCharges,
      landedCost,
      lineTotal,
      leadTimeDays: Number(row.leadTimeDays) || 0,
      promisedDeliveryDate: row.promisedDeliveryDate ?? null,
      technicalCompliance: row.technicalCompliance ?? 'not_assessed',
      commercialCompliance: row.commercialCompliance ?? 'not_assessed',
      makeBrand: row.makeBrand ?? '',
      remarks: row.remarks ?? '',
    }
  })
}

function moneyWithPacking(
  taxable: number,
  freight: number,
  other: number,
  discount: number,
  packing: number,
  isInterstate: boolean,
) {
  const base = isInterstate
    ? computeInterTotals(taxable, freight, other, discount)
    : computeIntraTotals(taxable, freight, other, discount)
  return {
    ...base,
    totalAmount: Number((base.totalAmount + packing).toFixed(2)),
  }
}

function toVendorQuotationListRow(q: VendorQuotation): VendorQuotationListRow {
  return {
    id: q.id,
    documentNumber: q.documentNumber,
    documentDate: q.documentDate,
    rfqId: q.rfqId,
    rfqNumber: q.rfqNumber,
    vendorName: q.vendor.name,
    vendorCode: q.vendor.code,
    vendorReferenceNumber: q.vendorReferenceNumber,
    validTill: q.validTill,
    totalAmount: q.totalAmount,
    status: q.status,
    statusLabel: VENDOR_QUOTATION_DOMAIN_STATUS_LABELS[q.status],
  }
}

function buildComparisonRows(
  rfq: RequestForQuotation,
  quotes: VendorQuotation[],
  method: QuotationComparisonMethod,
): QuotationComparisonRow[] {
  const itemIds = [...new Set(rfq.lines.map((l) => l.itemId))]
  return itemIds.map((itemId) => {
    const rfqLine = rfq.lines.find((l) => l.itemId === itemId)!
    const preferredVendorId =
      state.items.find((i) => i.id === itemId)?.preferredVendorId ?? null
    const cells: QuotationComparisonQuoteCell[] = []
    for (const vq of quotes) {
      const line = vq.lines.find((l) => l.itemId === itemId)
      const vendor = state.vendors.find((v) => v.id === vq.vendor.id)
      const quantity = line?.quantity ?? rfqLine.quantity
      const rate = line?.rate ?? 0
      const discountPct = line?.discountPct ?? 0
      const discountAmount = line?.discountAmount ?? 0
      const freight = (line?.freightAllocation ?? 0) + (quotes.length ? vq.freight / Math.max(vq.lines.length, 1) : 0)
      const taxAmount = line?.taxAmount ?? 0
      const landedAmount = line?.landedCost ?? 0
      const landedRate = quantity > 0 ? Number((landedAmount / quantity).toFixed(4)) : 0
      const tech = line?.technicalCompliance ?? 'not_assessed'
      const comm = line?.commercialCompliance ?? 'not_assessed'
      const hasMissingValues =
        !line ||
        rate <= 0 ||
        !vq.paymentTerms ||
        !vq.warranty ||
        line.leadTimeDays <= 0
      cells.push({
        vendorId: vq.vendor.id,
        vendorName: vq.vendor.name,
        vendorQuotationId: vq.id,
        vendorQuotationNumber: vq.documentNumber,
        rate,
        discountPct,
        discountAmount,
        freight: Number(freight.toFixed(2)),
        taxAmount,
        landedRate,
        landedAmount,
        leadTimeDays: line?.leadTimeDays ?? 999,
        lineTotal: line?.lineTotal ?? 0,
        paymentTerms: vq.paymentTerms,
        warranty: vq.warranty,
        vendorRating: vendor?.rating ?? 0,
        previousQualityScore: vendor?.qualityScore ?? 0,
        previousDeliveryScore: vendor?.deliveryScore ?? 0,
        technicalCompliance: tech,
        commercialCompliance: comm,
        isLowestBasic: false,
        isLowestLanded: false,
        isBestDelivery: false,
        isPreferred: preferredVendorId === vq.vendor.id,
        isNonCompliant: tech === 'non_compliant' || comm === 'non_compliant',
        hasMissingValues,
      })
    }

    const validRates = cells.filter((c) => !c.hasMissingValues && c.rate > 0)
    const minBasic = Math.min(...validRates.map((c) => c.rate), Number.POSITIVE_INFINITY)
    const minLanded = Math.min(
      ...validRates.map((c) => c.landedAmount),
      Number.POSITIVE_INFINITY,
    )
    const minLead = Math.min(
      ...validRates.map((c) => c.leadTimeDays),
      Number.POSITIVE_INFINITY,
    )
    for (const c of cells) {
      c.isLowestBasic = c.rate === minBasic && Number.isFinite(minBasic)
      c.isLowestLanded = c.landedAmount === minLanded && Number.isFinite(minLanded)
      c.isBestDelivery = c.leadTimeDays === minLead && Number.isFinite(minLead)
    }

    let recommendedVendorId: string | null = null
    if (method === 'basic_price') {
      recommendedVendorId = cells.find((c) => c.isLowestBasic)?.vendorId ?? null
    } else if (method === 'weighted_score') {
      let best: { id: string; score: number } | null = null
      for (const c of cells) {
        if (c.hasMissingValues) continue
        const score =
          (c.isLowestLanded ? 40 : 0) +
          (c.isLowestBasic ? 20 : 0) +
          (c.isBestDelivery ? 15 : 0) +
          c.vendorRating * 5 +
          c.previousQualityScore * 0.1 +
          c.previousDeliveryScore * 0.1 -
          (c.isNonCompliant ? 50 : 0)
        if (!best || score > best.score) best = { id: c.vendorId, score }
      }
      recommendedVendorId = best?.id ?? null
    } else {
      recommendedVendorId = cells.find((c) => c.isLowestLanded)?.vendorId ?? null
    }

    return {
      itemId,
      itemCode: rfqLine.itemCode,
      itemName: rfqLine.itemName,
      quantity: rfqLine.quantity,
      uom: rfqLine.uom,
      rfqLineId: rfqLine.id,
      quotes: cells,
      selectedVendorId: recommendedVendorId,
      recommendedVendorId,
    }
  })
}

function assertSelectionReasonIfNeeded(
  rows: QuotationComparisonRow[],
  selectionMode: QuotationSelectionMode,
  selectionReason: string,
  allVendorId: string | null,
) {
  const needs =
    selectionMode === 'all_lines'
      ? Boolean(
          allVendorId &&
            rows.some((row) => {
              const lowest = row.quotes.find((q) => q.isLowestLanded)
              return lowest && lowest.vendorId !== allVendorId
            }),
        )
      : rows.some((row) => {
          const selected = row.selectedVendorId
          if (!selected) return false
          const lowest = row.quotes.find((q) => q.isLowestLanded)
          return Boolean(lowest && lowest.vendorId !== selected)
        })
  if (needs && !selectionReason.trim()) {
    throw new PurchaseServiceError(
      'SELECTION_REASON_REQUIRED',
      'Selection reason is required when the selected vendor is not the lowest-cost vendor',
    )
  }
}

export async function getVendorQuotationList(): Promise<VendorQuotationListRow[]> {
  await delay()
  return [...state.vendorQuotations]
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate))
    .map(toVendorQuotationListRow)
}

export async function getVendorQuotations(rfqId?: string): Promise<VendorQuotation[]> {
  await delay()
  const rows = rfqId
    ? state.vendorQuotations.filter((q) => q.rfqId === rfqId)
    : state.vendorQuotations
  return [...rows].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getVendorQuotationById(id: string): Promise<VendorQuotation | null> {
  await delay()
  return state.vendorQuotations.find((q) => q.id === id) ?? null
}

export async function createVendorQuotation(input: VendorQuotationInput): Promise<VendorQuotation> {
  await delay()
  const rfq = state.rfqs.find((r) => r.id === input.rfqId)
  if (!rfq) throw new PurchaseServiceError('RFQ_NOT_FOUND', `RFQ not found: ${input.rfqId}`)
  if (!input.lines?.length) {
    throw new PurchaseServiceError('VQ_NO_LINES', 'Vendor quotation requires at least one line')
  }
  const vendor = requireVendor(input.vendorId)
  const lines = buildVendorQuotationLines(input.lines, vendor.isInterstate)
  const taxable = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const lineDiscount = lines.reduce((s, l) => s + l.discountAmount, 0)
  const lineFreight = lines.reduce((s, l) => s + l.freightAllocation, 0)
  const lineOther = lines.reduce((s, l) => s + l.otherCharges, 0)
  const packing = input.packingCharges ?? 0
  const freight = input.freight ?? lineFreight
  const other = input.otherCharges ?? lineOther
  const discount = input.discount ?? lineDiscount
  const totals = moneyWithPacking(taxable + discount, freight, other, discount, packing, vendor.isInterstate)
  const n = state.seq.vq++
  const created: VendorQuotation = {
    id: genId('prd-vq'),
    documentNumber: docNo('VQ', n),
    documentDate: input.documentDate ?? todayDate(),
    status: 'draft',
    rfqId: rfq.id,
    rfqNumber: rfq.documentNumber,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: vendor.isInterstate,
    },
    vendorReferenceNumber: input.vendorReferenceNumber ?? '',
    paymentTerms: input.paymentTerms ?? vendor.paymentTerms,
    deliveryTerms: input.deliveryTerms ?? vendor.deliveryTerms,
    freightTerms: input.freightTerms ?? 'Vendor',
    warranty: input.warranty ?? '',
    packingCharges: packing,
    validTill: input.validTill ?? todayDate(),
    expectedDeliveryDate: input.expectedDeliveryDate ?? null,
    gstScheme: vendor.isInterstate ? 'igst' : 'cgst_sgst',
    ...totals,
    lines,
    createdBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: input.attachmentIds ?? [],
  }
  // Rebuild cgst/sgst/igst from lines for header accuracy
  created.cgst = Number(lines.reduce((s, l) => s + l.cgst, 0).toFixed(2))
  created.sgst = Number(lines.reduce((s, l) => s + l.sgst, 0).toFixed(2))
  created.igst = Number(lines.reduce((s, l) => s + l.igst, 0).toFixed(2))
  created.taxableAmount = taxable
  created.subtotal = Number(lines.reduce((s, l) => s + l.quantity * l.rate, 0).toFixed(2))
  created.discount = discount
  created.freight = freight
  created.otherCharges = other
  created.totalAmount = Number(
    (taxable + created.cgst + created.sgst + created.igst + freight + other + packing + created.roundOff).toFixed(2),
  )
  state.vendorQuotations.unshift(created)
  return structuredClone(created)
}

export async function updateVendorQuotation(
  id: string,
  input: VendorQuotationInput,
): Promise<VendorQuotation> {
  await delay()
  const idx = state.vendorQuotations.findIndex((q) => q.id === id)
  if (idx < 0) throw new PurchaseServiceError('VQ_NOT_FOUND', `Vendor quotation not found: ${id}`)
  const existing = state.vendorQuotations[idx]
  if (existing.status !== 'draft') {
    throw new PurchaseServiceError('VQ_NOT_EDITABLE', 'Only draft quotations can be edited')
  }
  const rfq = state.rfqs.find((r) => r.id === (input.rfqId ?? existing.rfqId))
  if (!rfq) throw new PurchaseServiceError('RFQ_NOT_FOUND', 'RFQ not found')
  const vendor = requireVendor(input.vendorId ?? existing.vendor.id)
  const lines = buildVendorQuotationLines(input.lines ?? existing.lines, vendor.isInterstate)
  const taxable = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const lineDiscount = lines.reduce((s, l) => s + l.discountAmount, 0)
  const lineFreight = lines.reduce((s, l) => s + l.freightAllocation, 0)
  const lineOther = lines.reduce((s, l) => s + l.otherCharges, 0)
  const packing = input.packingCharges ?? existing.packingCharges
  const freight = input.freight ?? lineFreight
  const other = input.otherCharges ?? lineOther
  const discount = input.discount ?? lineDiscount
  const cgst = Number(lines.reduce((s, l) => s + l.cgst, 0).toFixed(2))
  const sgst = Number(lines.reduce((s, l) => s + l.sgst, 0).toFixed(2))
  const igst = Number(lines.reduce((s, l) => s + l.igst, 0).toFixed(2))
  const updated: VendorQuotation = {
    ...existing,
    documentDate: input.documentDate ?? existing.documentDate,
    rfqId: rfq.id,
    rfqNumber: rfq.documentNumber,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: vendor.isInterstate,
    },
    vendorReferenceNumber: input.vendorReferenceNumber ?? existing.vendorReferenceNumber,
    paymentTerms: input.paymentTerms ?? existing.paymentTerms,
    deliveryTerms: input.deliveryTerms ?? existing.deliveryTerms,
    freightTerms: input.freightTerms ?? existing.freightTerms,
    warranty: input.warranty ?? existing.warranty,
    packingCharges: packing,
    validTill: input.validTill ?? existing.validTill,
    expectedDeliveryDate:
      input.expectedDeliveryDate !== undefined
        ? input.expectedDeliveryDate
        : existing.expectedDeliveryDate,
    gstScheme: vendor.isInterstate ? 'igst' : 'cgst_sgst',
    currency: 'INR',
    subtotal: Number(lines.reduce((s, l) => s + l.quantity * l.rate, 0).toFixed(2)),
    discount,
    taxableAmount: taxable,
    cgst,
    sgst,
    igst,
    freight,
    otherCharges: other,
    roundOff: 0,
    totalAmount: Number((taxable + cgst + sgst + igst + freight + other + packing).toFixed(2)),
    lines,
    remarks: input.remarks ?? existing.remarks,
    attachmentIds: input.attachmentIds ?? existing.attachmentIds,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  state.vendorQuotations[idx] = updated
  return structuredClone(updated)
}

export async function submitVendorQuotation(id: string): Promise<VendorQuotation> {
  await delay()
  const q = state.vendorQuotations.find((x) => x.id === id)
  if (!q) throw new PurchaseServiceError('VQ_NOT_FOUND', `Vendor quotation not found: ${id}`)
  if (q.status !== 'draft') {
    throw new PurchaseServiceError('VQ_NOT_DRAFT', 'Only draft quotations can be submitted')
  }
  if (!q.lines.length) {
    throw new PurchaseServiceError('VQ_NO_LINES', 'Cannot submit without lines')
  }
  q.status = 'submitted'
  q.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  q.updatedAt = nowIso()
  const rfq = state.rfqs.find((r) => r.id === q.rfqId)
  if (rfq) {
    const invite = rfq.vendors.find((v) => v.vendorId === q.vendor.id)
    if (invite) {
      invite.status = 'quoted'
      invite.respondedAt = nowIso()
    }
    const quoted = rfq.vendors.filter((v) => v.status === 'quoted').length
    if (quoted > 0 && quoted < rfq.vendors.length) rfq.status = 'partially_quoted'
    else if (quoted >= rfq.vendors.length) rfq.status = 'quotation_received'
  }
  return structuredClone(q)
}

export async function getQuotationComparison(
  rfqId: string,
): Promise<QuotationComparison | null> {
  await delay()
  return (
    state.comparisons.find((c) => c.rfqId === rfqId) ??
    state.comparisons.find((c) => c.id === rfqId) ??
    null
  )
}

export async function buildQuotationComparison(
  input: QuotationComparisonInput,
): Promise<QuotationComparison> {
  await delay()
  const rfq = state.rfqs.find((r) => r.id === input.rfqId)
  if (!rfq) throw new PurchaseServiceError('RFQ_NOT_FOUND', `RFQ not found: ${input.rfqId}`)
  if (!input.vendorIds?.length) {
    throw new PurchaseServiceError('CMP_NO_VENDORS', 'Select at least one vendor')
  }
  const quotes = state.vendorQuotations.filter(
    (q) =>
      q.rfqId === rfq.id &&
      input.vendorIds.includes(q.vendor.id) &&
      q.status !== 'draft' &&
      q.status !== 'rejected' &&
      q.status !== 'expired',
  )
  // Allow draft quotes in demo if submitted ones missing
  const effectiveQuotes =
    quotes.length > 0
      ? quotes
      : state.vendorQuotations.filter(
          (q) => q.rfqId === rfq.id && input.vendorIds.includes(q.vendor.id),
        )
  if (effectiveQuotes.length === 0) {
    throw new PurchaseServiceError('CMP_NO_QUOTES', 'No quotations found for selected vendors')
  }

  const method: QuotationComparisonMethod = input.method ?? 'landed_cost'
  const criteria: QuotationComparisonCriterion[] =
    input.criteria ??
    ([
      'basic_price',
      'discount',
      'freight',
      'taxes',
      'landed_cost',
      'payment_terms',
      'delivery_time',
      'warranty',
      'vendor_rating',
      'previous_quality_score',
      'previous_delivery_score',
      'technical_compliance',
      'commercial_compliance',
    ] as QuotationComparisonCriterion[])

  const selectionMode: QuotationSelectionMode = input.selectionMode ?? 'all_lines'
  let rows = buildComparisonRows(rfq, effectiveQuotes, method)

  if (input.lineSelections?.length) {
    rows = rows.map((row) => {
      const sel = input.lineSelections!.find((s) => s.itemId === row.itemId)
      return sel ? { ...row, selectedVendorId: sel.vendorId } : row
    })
  } else if (selectionMode === 'all_lines' && input.recommendedVendorId) {
    rows = rows.map((row) => ({ ...row, selectedVendorId: input.recommendedVendorId! }))
  }

  const recommendedVendorId =
    input.recommendedVendorId ??
    rows[0]?.recommendedVendorId ??
    effectiveQuotes[0]?.vendor.id ??
    null
  const recommendedVendorName =
    state.vendors.find((v) => v.id === recommendedVendorId)?.vendorName ??
    effectiveQuotes.find((q) => q.vendor.id === recommendedVendorId)?.vendor.name ??
    null

  const existingIdx = state.comparisons.findIndex((c) => c.rfqId === rfq.id)
  const base =
    existingIdx >= 0
      ? state.comparisons[existingIdx]
      : {
          id: genId('prd-cmp'),
          documentNumber: docNo('CMP', state.seq.cmp++),
          createdBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
          createdAt: nowIso(),
          remarks: '',
          attachmentIds: [] as string[],
        }

  const comparison: QuotationComparison = {
    id: base.id,
    documentNumber: base.documentNumber,
    documentDate: todayDate(),
    status: 'draft',
    rfqId: rfq.id,
    rfqNumber: rfq.documentNumber,
    comparedBy: partyFromActor(PURCHASE_DOMAIN_ACTORS.buyer),
    method,
    criteria,
    selectedVendorIds: [...input.vendorIds],
    selectionMode,
    selectionReason: input.selectionReason ?? '',
    recommendationStatus: 'none',
    recommendedVendorId,
    recommendedVendorName,
    approvedBy: null,
    approvedAt: null,
    currency: 'INR',
    rows,
    createdBy: base.createdBy,
    createdAt: base.createdAt,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
    remarks: base.remarks ?? '',
    attachmentIds: base.attachmentIds ?? [],
  }

  rfq.comparisonId = comparison.id
  rfq.status = 'under_evaluation'

  if (existingIdx >= 0) state.comparisons[existingIdx] = comparison
  else state.comparisons.unshift(comparison)
  return structuredClone(comparison)
}

export async function updateQuotationComparisonSelection(
  id: string,
  input: {
    selectionMode: QuotationSelectionMode
    recommendedVendorId?: string
    lineSelections?: Array<{ itemId: string; vendorId: string }>
    selectionReason: string
  },
): Promise<QuotationComparison> {
  await delay()
  const cmp = state.comparisons.find((c) => c.id === id)
  if (!cmp) throw new PurchaseServiceError('CMP_NOT_FOUND', `Comparison not found: ${id}`)

  cmp.selectionMode = input.selectionMode
  cmp.selectionReason = input.selectionReason ?? ''
  if (input.selectionMode === 'all_lines') {
    const vendorId = input.recommendedVendorId ?? ''
    assertSelectionReasonIfNeeded(cmp.rows, 'all_lines', cmp.selectionReason, vendorId || null)
    cmp.rows = cmp.rows.map((row) => ({
      ...row,
      selectedVendorId: vendorId || row.selectedVendorId,
    }))
    if (vendorId) {
      cmp.recommendedVendorId = vendorId
      cmp.recommendedVendorName =
        state.vendors.find((v) => v.id === vendorId)?.vendorName ?? cmp.recommendedVendorName
    }
  } else {
    if (input.lineSelections) {
      cmp.rows = cmp.rows.map((row) => {
        const sel = input.lineSelections!.find((s) => s.itemId === row.itemId)
        return sel ? { ...row, selectedVendorId: sel.vendorId } : row
      })
    }
    assertSelectionReasonIfNeeded(cmp.rows, 'per_line', cmp.selectionReason, null)
    const counts = new Map<string, number>()
    for (const row of cmp.rows) {
      if (!row.selectedVendorId) continue
      counts.set(row.selectedVendorId, (counts.get(row.selectedVendorId) ?? 0) + 1)
    }
    let top: string | null = null
    let topN = 0
    for (const [vid, n] of counts) {
      if (n > topN) {
        top = vid
        topN = n
      }
    }
    if (top) {
      cmp.recommendedVendorId = top
      cmp.recommendedVendorName = state.vendors.find((v) => v.id === top)?.vendorName ?? null
    }
  }
  cmp.updatedAt = nowIso()
  cmp.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  return structuredClone(cmp)
}

export async function recommendQuotationVendor(
  id: string,
  input: { vendorId?: string; selectionReason?: string } = {},
): Promise<QuotationComparison> {
  await delay()
  const cmp = state.comparisons.find((c) => c.id === id)
  if (!cmp) throw new PurchaseServiceError('CMP_NOT_FOUND', `Comparison not found: ${id}`)

  if (input.selectionReason != null) cmp.selectionReason = input.selectionReason
  const vendorId = input.vendorId ?? cmp.recommendedVendorId
  if (!vendorId) {
    throw new PurchaseServiceError('CMP_NO_VENDOR', 'Select a vendor to recommend')
  }

  if (cmp.selectionMode === 'all_lines') {
    assertSelectionReasonIfNeeded(cmp.rows, 'all_lines', cmp.selectionReason, vendorId)
    cmp.rows = cmp.rows.map((row) => ({ ...row, selectedVendorId: vendorId, recommendedVendorId: vendorId }))
  } else {
    assertSelectionReasonIfNeeded(cmp.rows, 'per_line', cmp.selectionReason, null)
  }

  cmp.recommendedVendorId = vendorId
  cmp.recommendedVendorName =
    state.vendors.find((v) => v.id === vendorId)?.vendorName ??
    cmp.rows[0]?.quotes.find((q) => q.vendorId === vendorId)?.vendorName ??
    null
  cmp.recommendationStatus = 'recommended'
  cmp.status = 'draft'
  cmp.updatedAt = nowIso()
  cmp.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  return structuredClone(cmp)
}

export async function approveQuotationRecommendation(id: string): Promise<QuotationComparison> {
  await delay()
  const cmp = state.comparisons.find((c) => c.id === id)
  if (!cmp) throw new PurchaseServiceError('CMP_NOT_FOUND', `Comparison not found: ${id}`)
  if (cmp.recommendationStatus !== 'recommended' && cmp.recommendationStatus !== 'approved') {
    throw new PurchaseServiceError('CMP_NOT_RECOMMENDED', 'Recommend a vendor before approval')
  }
  assertSelectionReasonIfNeeded(
    cmp.rows,
    cmp.selectionMode,
    cmp.selectionReason,
    cmp.selectionMode === 'all_lines' ? cmp.recommendedVendorId : null,
  )
  cmp.recommendationStatus = 'approved'
  cmp.status = 'completed'
  cmp.approvedBy = PURCHASE_DOMAIN_ACTORS.purchaseHead.name
  cmp.approvedAt = nowIso()
  cmp.updatedAt = nowIso()
  cmp.updatedBy = PURCHASE_DOMAIN_ACTORS.purchaseHead.name

  const rfq = state.rfqs.find((r) => r.id === cmp.rfqId)
  if (rfq && cmp.recommendedVendorId) {
    rfq.selectedVendorId = cmp.recommendedVendorId
    for (const v of rfq.vendors) {
      v.selected = v.vendorId === cmp.recommendedVendorId
    }
  }
  for (const vq of state.vendorQuotations.filter((q) => q.rfqId === cmp.rfqId)) {
    vq.status = vq.vendor.id === cmp.recommendedVendorId ? 'selected' : 'rejected'
  }
  return structuredClone(cmp)
}

export async function createPurchaseOrderFromComparison(
  comparisonId: string,
): Promise<PurchaseOrder> {
  await delay()
  const cmp = state.comparisons.find((c) => c.id === comparisonId)
  if (!cmp) throw new PurchaseServiceError('CMP_NOT_FOUND', `Comparison not found: ${comparisonId}`)
  if (cmp.recommendationStatus !== 'approved') {
    throw new PurchaseServiceError('CMP_NOT_APPROVED', 'Approve recommendation before creating PO')
  }

  assertSelectionReasonIfNeeded(
    cmp.rows,
    cmp.selectionMode,
    cmp.selectionReason,
    cmp.selectionMode === 'all_lines' ? cmp.recommendedVendorId : null,
  )

  // Single-vendor PO from header recommendation (per-line split deferred)
  const vendorId = cmp.recommendedVendorId
  if (!vendorId) {
    throw new PurchaseServiceError('CMP_NO_VENDOR', 'No recommended vendor on comparison')
  }
  const vq =
    state.vendorQuotations.find(
      (q) => q.rfqId === cmp.rfqId && q.vendor.id === vendorId && q.status === 'selected',
    ) ??
    state.vendorQuotations.find((q) => q.rfqId === cmp.rfqId && q.vendor.id === vendorId)
  if (!vq) {
    throw new PurchaseServiceError('VQ_NOT_FOUND', 'Selected vendor quotation not found')
  }

  const lineInputs = cmp.rows
    .filter((row) => (row.selectedVendorId ?? vendorId) === vendorId)
    .map((row) => {
      const q = row.quotes.find((c) => c.vendorId === vendorId)
      const vLine = vq.lines.find((l) => l.itemId === row.itemId)
      return {
        itemId: row.itemId,
        quantity: row.quantity,
        rate: q?.rate ?? vLine?.rate ?? 0,
        discountPct: q?.discountPct ?? vLine?.discountPct ?? 0,
        remarks: `From comparison ${cmp.documentNumber}`,
      }
    })

  if (!lineInputs.length) {
    throw new PurchaseServiceError('CMP_NO_LINES', 'No lines selected for purchase order')
  }

  const rfq = state.rfqs.find((r) => r.id === cmp.rfqId)
  return createPurchaseOrder({
    vendorId,
    origin: 'quotation_comparison',
    lines: lineInputs,
    paymentTerms: vq.paymentTerms,
    deliveryTerms: vq.deliveryTerms,
    freightTerms: vq.freightTerms,
    warranty: vq.warranty,
    expectedDeliveryDate: vq.expectedDeliveryDate ?? todayDate(),
    rfqId: cmp.rfqId,
    rfqNumber: cmp.rfqNumber,
    purchaseRequisitionId: rfq?.purchaseRequisitionId ?? null,
    purchaseRequisitionNumber: rfq?.purchaseRequisitionNumber ?? null,
    vendorQuotationId: vq.id,
    vendorQuotationNumber: vq.documentNumber,
    comparisonId: cmp.id,
    comparisonNumber: cmp.documentNumber,
    freight: vq.freight,
    otherCharges: vq.otherCharges,
    packingCharges: vq.packingCharges,
    discount: vq.discount,
    remarks: `Created from ${cmp.documentNumber}`,
  })
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  await delay()
  return [...state.orders].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  await delay()
  return state.orders.find((o) => o.id === id) ?? null
}

export async function getPurchaseOrderList(): Promise<PurchaseOrderListRow[]> {
  await delay()
  return [...state.orders]
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate))
    .map(toPurchaseOrderListRow)
}

export async function getPurchaseOrderLinkedDocuments(
  id: string,
): Promise<PurchaseOrderLinkedDocuments> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  return {
    purchaseRequisition: po.purchaseRequisitionId
      ? {
          id: po.purchaseRequisitionId,
          documentNumber: po.purchaseRequisitionNumber ?? po.purchaseRequisitionId,
        }
      : null,
    rfq: po.rfqId ? { id: po.rfqId, documentNumber: po.rfqNumber ?? po.rfqId } : null,
    vendorQuotation: po.vendorQuotationId
      ? {
          id: po.vendorQuotationId,
          documentNumber: po.vendorQuotationNumber ?? po.vendorQuotationId,
        }
      : null,
    comparison: po.comparisonId
      ? { id: po.comparisonId, documentNumber: po.comparisonNumber ?? po.comparisonId }
      : null,
    blanketOrder: po.blanketOrderId
      ? { id: po.blanketOrderId, documentNumber: po.blanketOrderNumber ?? po.blanketOrderId }
      : null,
    grns: state.grns
      .filter((g) => g.purchaseOrderId === id)
      .map((g) => ({
        id: g.id,
        documentNumber: g.documentNumber,
        status: g.status,
        documentDate: g.documentDate,
      })),
    invoices: state.invoices
      .filter((i) => i.purchaseOrderId === id)
      .map((i) => ({
        id: i.id,
        documentNumber: i.documentNumber,
        status: i.status,
        documentDate: i.documentDate,
      })),
    returns: state.returns
      .filter((r) => r.purchaseOrderId === id)
      .map((r) => ({
        id: r.id,
        documentNumber: r.documentNumber,
        status: r.status,
        documentDate: r.documentDate,
      })),
  }
}

export async function getBlanketOrders(): Promise<BlanketPurchaseOrder[]> {
  await delay()
  return [...state.blanketOrders].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getBlanketOrderById(id: string): Promise<BlanketPurchaseOrder | null> {
  await delay()
  return state.blanketOrders.find((b) => b.id === id) ?? null
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrder> {
  await delay()
  if (!input.lines?.length) {
    throw new PurchaseServiceError('PO_NO_LINES', 'Purchase order requires at least one line')
  }
  const vendor = requireVendor(input.vendorId)
  const lines = buildOrderLines(input.lines, vendor.isInterstate)
  const money = applyPoMoney(lines, {
    freight: input.freight,
    otherCharges: input.otherCharges,
    packingCharges: input.packingCharges,
    insuranceCharges: input.insuranceCharges,
    tradeDiscount: input.tradeDiscount,
    tcsAmount: input.tcsAmount,
    discount: input.discount,
  })
  const buyer = input.buyer ?? input.requester ?? partyFromActor(PURCHASE_DOMAIN_ACTORS.buyer)
  const location = input.location ?? input.purchaseLocation ?? { ...PURCHASE_DEMO_LOCATION }
  const n = state.seq.po++
  const origin: PurchaseOrderOrigin = input.origin ?? 'manual'
  const orderType: PurchaseOrderType = input.orderType ?? (origin === 'blanket_order' ? 'call_off' : 'standard')
  const created: PurchaseOrder = {
    id: genId('prd-po'),
    documentNumber: input.documentNumber?.trim() || docNo('PO', n),
    documentDate: input.documentDate ?? todayDate(),
    status: 'draft',
    orderType,
    origin,
    revisionNo: 0,
    buyer,
    location,
    purchaseLocation: input.purchaseLocation ?? location,
    deliveryLocation: input.deliveryLocation ?? location,
    department: input.department ?? 'Purchase',
    requester: input.requester ?? buyer,
    approver: input.approver ?? null,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: vendor.isInterstate,
      address: vendor.address,
    },
    placeOfSupply: input.placeOfSupply ?? 'Maharashtra (27)',
    paymentTerms: input.paymentTerms ?? vendor.paymentTerms,
    deliveryTerms: input.deliveryTerms ?? vendor.deliveryTerms,
    freightTerms: input.freightTerms ?? 'Vendor',
    packingTerms: input.packingTerms ?? 'Standard',
    insuranceTerms: input.insuranceTerms ?? 'As agreed',
    warranty: input.warranty ?? '',
    inspectionRequirement: input.inspectionRequirement ?? '',
    priceBasis: input.priceBasis ?? 'FOR',
    validityDate: input.validityDate ?? null,
    expectedDeliveryDate: input.expectedDeliveryDate ?? todayDate(),
    gstScheme: vendor.isInterstate ? 'igst' : 'cgst_sgst',
    purchaseRequisitionId: input.purchaseRequisitionId ?? null,
    purchaseRequisitionNumber: input.purchaseRequisitionNumber ?? null,
    rfqId: input.rfqId ?? null,
    rfqNumber: input.rfqNumber ?? null,
    vendorQuotationId: input.vendorQuotationId ?? null,
    vendorQuotationNumber: input.vendorQuotationNumber ?? null,
    comparisonId: input.comparisonId ?? null,
    comparisonNumber: input.comparisonNumber ?? null,
    blanketOrderId: input.blanketOrderId ?? null,
    blanketOrderNumber: input.blanketOrderNumber ?? null,
    ...money,
    lines,
    termsAndConditions: input.termsAndConditions ?? '',
    internalNotes: input.internalNotes ?? '',
    approvalStatus: 'not_required',
    invoiceStatus: 'not_invoiced',
    approvalIds: [],
    changeHistory: [],
    revisions: [],
    sentToVendorAt: null,
    releasedAt: null,
    closedAt: null,
    cancelledAt: null,
    createdBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: input.attachmentIds ?? [],
  }
  state.orders.unshift(created)

  if (created.purchaseRequisitionId) {
    const pr = state.requisitions.find((r) => r.id === created.purchaseRequisitionId)
    if (pr && ['approved', 'converted_to_rfq'].includes(pr.status)) {
      pr.status = 'converted_to_po'
      pr.convertedPoId = created.id
      pr.updatedAt = nowIso()
    }
  }
  return structuredClone(created)
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderInput,
): Promise<PurchaseOrder> {
  await delay()
  const idx = state.orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  const existing = state.orders[idx]
  assertPoEditable(existing)
  const vendor = requireVendor(input.vendorId ?? existing.vendor.id)
  const lines = buildOrderLines(input.lines ?? existing.lines, vendor.isInterstate)
  const money = applyPoMoney(lines, {
    freight: input.freight ?? existing.freight,
    otherCharges: input.otherCharges ?? existing.otherCharges,
    packingCharges: input.packingCharges ?? existing.packingCharges,
    insuranceCharges: input.insuranceCharges ?? existing.insuranceCharges,
    tradeDiscount: input.tradeDiscount ?? existing.tradeDiscount,
    tcsAmount: input.tcsAmount ?? existing.tcsAmount,
    discount: input.discount,
  })
  const buyer = input.buyer ?? existing.buyer
  const location = input.location ?? input.purchaseLocation ?? existing.location
  const updated: PurchaseOrder = {
    ...existing,
    ...money,
    documentDate: input.documentDate ?? existing.documentDate,
    orderType: input.orderType ?? existing.orderType,
    origin: input.origin ?? existing.origin,
    buyer,
    location,
    purchaseLocation: input.purchaseLocation ?? existing.purchaseLocation,
    deliveryLocation: input.deliveryLocation ?? existing.deliveryLocation,
    department: input.department ?? existing.department,
    requester: input.requester ?? existing.requester,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: vendor.isInterstate,
      address: vendor.address,
    },
    placeOfSupply: input.placeOfSupply ?? existing.placeOfSupply,
    paymentTerms: input.paymentTerms ?? existing.paymentTerms,
    deliveryTerms: input.deliveryTerms ?? existing.deliveryTerms,
    freightTerms: input.freightTerms ?? existing.freightTerms,
    packingTerms: input.packingTerms ?? existing.packingTerms,
    insuranceTerms: input.insuranceTerms ?? existing.insuranceTerms,
    warranty: input.warranty ?? existing.warranty,
    inspectionRequirement: input.inspectionRequirement ?? existing.inspectionRequirement,
    priceBasis: input.priceBasis ?? existing.priceBasis,
    validityDate:
      input.validityDate !== undefined ? input.validityDate : existing.validityDate,
    expectedDeliveryDate: input.expectedDeliveryDate ?? existing.expectedDeliveryDate,
    gstScheme: vendor.isInterstate ? 'igst' : 'cgst_sgst',
    purchaseRequisitionId:
      input.purchaseRequisitionId !== undefined
        ? input.purchaseRequisitionId
        : existing.purchaseRequisitionId,
    purchaseRequisitionNumber:
      input.purchaseRequisitionNumber !== undefined
        ? input.purchaseRequisitionNumber
        : existing.purchaseRequisitionNumber,
    rfqId: input.rfqId !== undefined ? input.rfqId : existing.rfqId,
    rfqNumber: input.rfqNumber !== undefined ? input.rfqNumber : existing.rfqNumber,
    vendorQuotationId:
      input.vendorQuotationId !== undefined
        ? input.vendorQuotationId
        : existing.vendorQuotationId,
    vendorQuotationNumber:
      input.vendorQuotationNumber !== undefined
        ? input.vendorQuotationNumber
        : existing.vendorQuotationNumber,
    comparisonId:
      input.comparisonId !== undefined ? input.comparisonId : existing.comparisonId,
    comparisonNumber:
      input.comparisonNumber !== undefined
        ? input.comparisonNumber
        : existing.comparisonNumber,
    blanketOrderId:
      input.blanketOrderId !== undefined ? input.blanketOrderId : existing.blanketOrderId,
    blanketOrderNumber:
      input.blanketOrderNumber !== undefined
        ? input.blanketOrderNumber
        : existing.blanketOrderNumber,
    lines,
    termsAndConditions: input.termsAndConditions ?? existing.termsAndConditions,
    internalNotes: input.internalNotes ?? existing.internalNotes,
    remarks: input.remarks ?? existing.remarks,
    attachmentIds: input.attachmentIds ?? existing.attachmentIds,
    updatedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    updatedAt: nowIso(),
  }
  state.orders[idx] = updated
  return structuredClone(updated)
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (po.status !== 'draft') {
    throw new PurchaseServiceError('PO_NOT_DRAFT', 'Only draft POs can be submitted')
  }
  if (!po.lines.length) {
    throw new PurchaseServiceError('PO_NO_LINES', 'Cannot submit without lines')
  }
  po.status = 'pending_approval'
  po.approvalStatus = 'pending'
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  const approval = createPendingApprovalLevel({
    documentType: 'purchase_order',
    documentId: po.id,
    documentNumber: po.documentNumber,
    amount: po.totalAmount,
    levelIndex: 0,
    requesterId: po.requester.id,
    requesterName: po.requester.name,
  })
  state.approvals.unshift(approval)
  po.approvalIds = [approval.id, ...po.approvalIds]
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'submitted',
    'draft',
    'pending_approval',
    'Submitted for approval',
  )
  return structuredClone(po)
}

export async function approvePurchaseOrder(id: string, remarks = ''): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (po.status !== 'pending_approval') {
    throw new PurchaseServiceError('PO_NOT_PENDING', 'PO is not pending approval')
  }
  po.status = 'approved'
  po.approvalStatus = 'approved'
  po.approver = partyFromActor(PURCHASE_DOMAIN_ACTORS.purchaseHead)
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.purchaseHead.name
  for (const appr of state.approvals.filter((a) => a.documentId === id && a.status === 'pending')) {
    appr.status = 'approved'
    appr.respondedAt = nowIso()
    appr.remarks = remarks
  }
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'approved',
    'pending_approval',
    'approved',
    remarks || 'Approved',
    PURCHASE_DOMAIN_ACTORS.purchaseHead,
  )
  return structuredClone(po)
}

export async function releasePurchaseOrder(id: string): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (!['approved', 'pending_approval'].includes(po.status) && po.status !== 'draft') {
    // allow approved primarily; also approve-on-release from pending if already approved status path
  }
  if (po.status === 'draft') {
    throw new PurchaseServiceError('PO_NOT_APPROVED', 'Submit and approve before release')
  }
  if (po.status === 'pending_approval') {
    throw new PurchaseServiceError('PO_NOT_APPROVED', 'Approve before release')
  }
  if (po.status !== 'approved' && po.releasedAt) {
    throw new PurchaseServiceError('PO_ALREADY_RELEASED', 'PO already released')
  }
  if (po.status !== 'approved') {
    throw new PurchaseServiceError('PO_NOT_APPROVED', 'Only approved POs can be released')
  }
  po.status = 'released'
  po.releasedAt = nowIso()
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'released',
    'approved',
    'released',
    'Released to vendor',
  )
  return structuredClone(po)
}

export async function reopenPurchaseOrder(id: string): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (po.status !== 'closed') {
    throw new PurchaseServiceError('PO_NOT_CLOSED', 'Only closed POs can be reopened')
  }
  const hasReceipt = po.lines.some((l) => l.receivedQty > 0)
  const fully = po.lines.every((l) => l.receivedQty >= l.quantity)
  po.status = fully ? 'fully_received' : hasReceipt ? 'partially_received' : 'released'
  po.closedAt = null
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'reopened',
    'closed',
    po.status,
    'Reopened',
  )
  return structuredClone(po)
}

export async function sendPurchaseOrderToVendor(id: string): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (!['released', 'partially_received', 'approved'].includes(po.status)) {
    throw new PurchaseServiceError('PO_NOT_SENDABLE', 'Release the PO before sending to vendor')
  }
  if (po.status === 'approved') {
    po.status = 'released'
    po.releasedAt = po.releasedAt ?? nowIso()
  }
  po.sentToVendorAt = nowIso()
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'sent',
    po.status,
    po.status,
    'Sent to vendor',
  )
  return structuredClone(po)
}

export async function closePurchaseOrder(id: string): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (['cancelled', 'closed', 'draft'].includes(po.status)) {
    throw new PurchaseServiceError('PO_NOT_CLOSABLE', 'PO cannot be closed in current status')
  }
  const from = po.status
  po.status = 'closed'
  po.closedAt = nowIso()
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pushHistory('purchase_order', po.id, po.documentNumber, 'closed', from, 'closed', 'Closed')
  return structuredClone(po)
}

export async function cancelPurchaseOrder(id: string, reason = ''): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  if (['fully_received', 'invoiced', 'closed', 'cancelled'].includes(po.status)) {
    throw new PurchaseServiceError('PO_NOT_CANCELLABLE', 'PO cannot be cancelled in current status')
  }
  if (po.lines.some((l) => l.receivedQty > 0)) {
    throw new PurchaseServiceError('PO_HAS_RECEIPTS', 'Cancel blocked — receipts exist; close instead')
  }
  const from = po.status
  po.status = 'cancelled'
  po.cancelledAt = nowIso()
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  po.remarks = reason ? `${po.remarks}\nCancel: ${reason}`.trim() : po.remarks
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'cancelled',
    from,
    'cancelled',
    reason || 'Cancelled',
  )
  return structuredClone(po)
}

export async function revisePurchaseOrder(
  id: string,
  input: PurchaseOrderReviseInput,
): Promise<PurchaseOrder> {
  await delay()
  const po = state.orders.find((o) => o.id === id)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  assertPoRevisable(po)
  if (!input.reason?.trim()) {
    throw new PurchaseServiceError('REVISION_REASON_REQUIRED', 'Revision reason is required')
  }

  const changes: PurchaseOrderChangeEntry[] = []
  const revNo = po.revisionNo + 1
  const snapshot = JSON.stringify({
    expectedDeliveryDate: po.expectedDeliveryDate,
    paymentTerms: po.paymentTerms,
    deliveryTerms: po.deliveryTerms,
    freight: po.freight,
    packingCharges: po.packingCharges,
    insuranceCharges: po.insuranceCharges,
    otherCharges: po.otherCharges,
    tradeDiscount: po.tradeDiscount,
    lines: po.lines.map((l) => ({ id: l.id, quantity: l.quantity, rate: l.rate })),
  })

  const track = (fieldPath: string, fieldLabel: string, previousValue: string, newValue: string) => {
    if (previousValue === newValue) return
    changes.push({
      id: genId('prd-poch'),
      revisionNo: revNo,
      changedAt: nowIso(),
      changedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
      reason: input.reason,
      fieldPath,
      fieldLabel,
      previousValue,
      newValue,
    })
  }

  if (input.paymentTerms != null) {
    track('paymentTerms', 'Payment Terms', po.paymentTerms, input.paymentTerms)
    po.paymentTerms = input.paymentTerms
  }
  if (input.deliveryTerms != null) {
    track('deliveryTerms', 'Delivery Terms', po.deliveryTerms, input.deliveryTerms)
    po.deliveryTerms = input.deliveryTerms
  }
  if (input.freightTerms != null) {
    track('freightTerms', 'Freight Terms', po.freightTerms, input.freightTerms)
    po.freightTerms = input.freightTerms
  }
  if (input.packingTerms != null) {
    track('packingTerms', 'Packing Terms', po.packingTerms, input.packingTerms)
    po.packingTerms = input.packingTerms
  }
  if (input.insuranceTerms != null) {
    track('insuranceTerms', 'Insurance Terms', po.insuranceTerms, input.insuranceTerms)
    po.insuranceTerms = input.insuranceTerms
  }
  if (input.warranty != null) {
    track('warranty', 'Warranty', po.warranty, input.warranty)
    po.warranty = input.warranty
  }
  if (input.inspectionRequirement != null) {
    track(
      'inspectionRequirement',
      'Inspection Requirement',
      po.inspectionRequirement,
      input.inspectionRequirement,
    )
    po.inspectionRequirement = input.inspectionRequirement
  }
  if (input.expectedDeliveryDate != null) {
    track(
      'expectedDeliveryDate',
      'Expected Delivery Date',
      po.expectedDeliveryDate,
      input.expectedDeliveryDate,
    )
    po.expectedDeliveryDate = input.expectedDeliveryDate
  }
  if (input.freight != null) {
    track('freight', 'Freight', String(po.freight), String(input.freight))
    po.freight = input.freight
  }
  if (input.packingCharges != null) {
    track('packingCharges', 'Packing', String(po.packingCharges), String(input.packingCharges))
    po.packingCharges = input.packingCharges
  }
  if (input.insuranceCharges != null) {
    track(
      'insuranceCharges',
      'Insurance',
      String(po.insuranceCharges),
      String(input.insuranceCharges),
    )
    po.insuranceCharges = input.insuranceCharges
  }
  if (input.otherCharges != null) {
    track('otherCharges', 'Other Charges', String(po.otherCharges), String(input.otherCharges))
    po.otherCharges = input.otherCharges
  }
  if (input.tradeDiscount != null) {
    track('tradeDiscount', 'Trade Discount', String(po.tradeDiscount), String(input.tradeDiscount))
    po.tradeDiscount = input.tradeDiscount
  }
  if (input.termsAndConditions != null) po.termsAndConditions = input.termsAndConditions
  if (input.internalNotes != null) po.internalNotes = input.internalNotes
  if (input.remarks != null) po.remarks = input.remarks

  if (input.lines?.length) {
    const nextLines = buildOrderLines(
      po.lines.map((l) => {
        const patch = input.lines!.find((p) => p.id === l.id)
        return {
          ...l,
          itemId: l.itemId,
          quantity: patch?.quantity ?? l.quantity,
          rate: patch?.rate ?? l.rate,
          discountPct: patch?.discountPct ?? l.discountPct,
          receivedQty: l.receivedQty,
          invoicedQty: l.invoicedQty,
        }
      }),
      po.vendor.isInterstate,
    )
    for (let i = 0; i < po.lines.length; i++) {
      const before = po.lines[i]
      const after = nextLines.find((l) => l.id === before.id) ?? nextLines[i]
      if (!after) continue
      track(`lines[${i}].quantity`, `Line ${before.lineNo} Quantity`, String(before.quantity), String(after.quantity))
      track(`lines[${i}].rate`, `Line ${before.lineNo} Unit Price`, String(before.rate), String(after.rate))
    }
    po.lines = nextLines.map((l) => {
      const prev = po.lines.find((p) => p.id === l.id)
      if (!prev) return l
      return {
        ...l,
        receivedQty: prev.receivedQty,
        pendingQty: Math.max(0, l.quantity - prev.receivedQty),
        invoicedQty: prev.invoicedQty,
        lineStatus: computeLineStatus(prev.receivedQty, l.quantity, prev.invoicedQty),
      }
    })
  }

  const money = applyPoMoney(po.lines, {
    freight: po.freight,
    otherCharges: po.otherCharges,
    packingCharges: po.packingCharges,
    insuranceCharges: po.insuranceCharges,
    tradeDiscount: po.tradeDiscount,
    tcsAmount: po.tcsAmount,
  })
  Object.assign(po, money)

  if (changes.length === 0) {
    throw new PurchaseServiceError('NO_CHANGES', 'No changes detected for revision')
  }

  po.revisionNo = revNo
  po.revisions.unshift({
    revisionNo: revNo,
    revisedAt: nowIso(),
    revisedBy: PURCHASE_DOMAIN_ACTORS.buyer.name,
    reason: input.reason,
    snapshot,
  })
  po.changeHistory = [...changes, ...po.changeHistory]
  po.updatedAt = nowIso()
  po.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  pushHistory(
    'purchase_order',
    po.id,
    po.documentNumber,
    'revised',
    po.status,
    po.status,
    `Revision ${revNo}: ${input.reason}`,
  )
  return structuredClone(po)
}

export async function createPurchaseOrderFromPr(
  prId: string,
  vendorId?: string,
): Promise<PurchaseOrder> {
  await delay()
  const pr = state.requisitions.find((r) => r.id === prId)
  if (!pr) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${prId}`)
  if (pr.status === 'approved' && pr.rfqRequired) {
    throw new PurchaseServiceError(
      'RFQ_REQUIRED',
      'This requisition requires an RFQ before a Purchase Order can be created',
    )
  }
  if (pr.status !== 'approved' && pr.status !== 'converted_to_rfq') {
    throw new PurchaseServiceError('PR_NOT_APPROVED', 'Only approved PRs can create a PO')
  }
  const preferred =
    vendorId ??
    pr.lines
      .map((l) => state.items.find((i) => i.id === l.itemId)?.preferredVendorId)
      .find((v): v is string => Boolean(v)) ??
    state.vendors.find((v) => v.isActive)?.id
  if (!preferred) throw new PurchaseServiceError('NO_VENDOR', 'No vendor available')
  return createPurchaseOrder({
    vendorId: preferred,
    origin: 'purchase_requisition',
    purchaseRequisitionId: pr.id,
    purchaseRequisitionNumber: pr.documentNumber,
    expectedDeliveryDate: pr.expectedDeliveryDate ?? todayDate(),
    paymentTerms: pr.paymentTerms,
    deliveryTerms: pr.deliveryTerms,
    location: pr.location,
    purchaseLocation: pr.location,
    deliveryLocation: pr.location,
    department: pr.department,
    remarks: `Created from ${pr.documentNumber}`,
    lines: pr.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      rate: l.estimatedRate,
      requiredDate: l.requiredDate,
      expectedDeliveryDate: l.requiredDate,
      warehouseId: l.locationId,
      warehouseName: l.locationName,
      prLineId: l.id,
      remarks: l.remarks,
      description: l.itemName,
      specification: l.specification ?? '',
    })),
  })
}

export async function createPurchaseOrderFromVendorQuotation(
  vqId: string,
): Promise<PurchaseOrder> {
  await delay()
  const vq = state.vendorQuotations.find((q) => q.id === vqId)
  if (!vq) throw new PurchaseServiceError('VQ_NOT_FOUND', `Vendor quotation not found: ${vqId}`)
  if (!['selected', 'under_review', 'submitted'].includes(vq.status)) {
    throw new PurchaseServiceError(
      'VQ_NOT_APPROVED',
      'Use a selected / submitted vendor quotation',
    )
  }
  const rfq = state.rfqs.find((r) => r.id === vq.rfqId)
  return createPurchaseOrder({
    vendorId: vq.vendor.id,
    origin: 'vendor_quotation',
    vendorQuotationId: vq.id,
    vendorQuotationNumber: vq.documentNumber,
    rfqId: vq.rfqId,
    rfqNumber: vq.rfqNumber,
    purchaseRequisitionId: rfq?.purchaseRequisitionId ?? null,
    purchaseRequisitionNumber: rfq?.purchaseRequisitionNumber ?? null,
    paymentTerms: vq.paymentTerms,
    deliveryTerms: vq.deliveryTerms,
    freightTerms: vq.freightTerms,
    warranty: vq.warranty,
    expectedDeliveryDate: vq.expectedDeliveryDate ?? todayDate(),
    freight: vq.freight,
    otherCharges: vq.otherCharges,
    packingCharges: vq.packingCharges,
    discount: vq.discount,
    remarks: `Created from ${vq.documentNumber}`,
    lines: vq.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      rate: l.rate,
      discountPct: l.discountPct,
      discountAmount: l.discountAmount,
      gstRatePct: l.gstRatePct,
      requiredDate: l.promisedDeliveryDate ?? todayDate(),
      expectedDeliveryDate: l.promisedDeliveryDate ?? todayDate(),
      description: l.description,
      rfqLineId: l.rfqLineId,
      vendorQuotationLineId: l.id,
      remarks: l.remarks,
    })),
  })
}

export async function createPurchaseOrderFromBlanket(
  blanketId: string,
  lines: Array<{ itemId: string; quantity: number }>,
): Promise<PurchaseOrder> {
  await delay()
  const blo = state.blanketOrders.find((b) => b.id === blanketId)
  if (!blo) throw new PurchaseServiceError('BLO_NOT_FOUND', `Blanket order not found: ${blanketId}`)
  if (blo.status !== 'active') {
    throw new PurchaseServiceError('BLO_NOT_ACTIVE', 'Blanket order is not active')
  }
  if (!lines.length) {
    throw new PurchaseServiceError('PO_NO_LINES', 'Select at least one call-off line')
  }
  const poLines = lines.map((row) => {
    const bloLine = blo.lines.find((l) => l.itemId === row.itemId)
    if (!bloLine) {
      throw new PurchaseServiceError('BLO_LINE_MISSING', `Item not on blanket: ${row.itemId}`)
    }
    if (bloLine.releasedQuantity + row.quantity > bloLine.maxQuantity) {
      throw new PurchaseServiceError(
        'BLO_QTY_EXCEEDED',
        `${bloLine.itemCode} exceeds remaining blanket quantity`,
      )
    }
    return {
      itemId: row.itemId,
      quantity: row.quantity,
      rate: bloLine.rate,
      remarks: `Call-off from ${blo.documentNumber}`,
    }
  })
  const po = await createPurchaseOrder({
    vendorId: blo.vendor.id,
    origin: 'blanket_order',
    orderType: 'call_off',
    blanketOrderId: blo.id,
    blanketOrderNumber: blo.documentNumber,
    paymentTerms: blo.paymentTerms,
    deliveryTerms: blo.deliveryTerms,
    remarks: `Call-off from ${blo.documentNumber}`,
    lines: poLines,
  })
  for (const row of lines) {
    const bloLine = blo.lines.find((l) => l.itemId === row.itemId)!
    bloLine.releasedQuantity += row.quantity
  }
  blo.releasedValue = Number(
    (
      blo.releasedValue + po.lines.reduce((s, l) => s + l.quantity * l.rate, 0)
    ).toFixed(2),
  )
  blo.updatedAt = nowIso()
  blo.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  return po
}

const RECEIVABLE_PO_STATUSES = new Set([
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
])

function assertPoReceivable(po: PurchaseOrder) {
  if (!RECEIVABLE_PO_STATUSES.has(po.status)) {
    throw new PurchaseServiceError(
      'PO_NOT_RECEIVABLE',
      `Cannot create GRN for PO status "${po.status}". Use a released (or partially/fully received) PO with open quantity.`,
    )
  }
  const openQty = po.lines.reduce((s, l) => s + Math.max(0, l.pendingQty), 0)
  if (openQty <= 0) {
    throw new PurchaseServiceError('PO_NO_OPEN_QTY', `PO ${po.documentNumber} has no pending quantity to receive.`)
  }
}

function defaultInspectionParameters(itemCode: string): QualityInspectionParameter[] {
  return [
    {
      id: genId('prd-qip'),
      parameter: 'Visual / dimensions',
      specification: `${itemCode} — as per PO / drawing`,
      minValue: null,
      maxValue: null,
      observedValue: null,
      unit: '',
      result: 'na',
      remarks: '',
    },
    {
      id: genId('prd-qip'),
      parameter: 'Documentation',
      specification: 'TC / COA present',
      minValue: null,
      maxValue: null,
      observedValue: null,
      unit: '',
      result: 'na',
      remarks: '',
    },
  ]
}

function buildGrnLineFromPo(
  po: PurchaseOrder,
  row: GrnInput['lines'][number],
  index: number,
  headerAllowExcess: boolean,
  headerWarehouseId: string,
  headerWarehouseName: string,
): GoodsReceiptLine {
  const poLine = po.lines.find((l) => l.id === row.purchaseOrderLineId)
  if (!poLine) {
    throw new PurchaseServiceError('PO_LINE_NOT_FOUND', `PO line not found: ${row.purchaseOrderLineId}`)
  }
  const item = requireItem(poLine.itemId)
  const previouslyReceivedQty = poLine.receivedQty
  const pendingQty = Math.max(0, poLine.pendingQty)
  const receivedQty = Number(row.receivedQty) || 0
  if (receivedQty <= 0) {
    throw new PurchaseServiceError('INVALID_RECEIVED_QTY', `Received qty must be > 0 for ${poLine.itemCode}`)
  }
  const allowExcess = row.allowExcess ?? headerAllowExcess
  if (receivedQty > pendingQty && !allowExcess) {
    throw new PurchaseServiceError(
      'EXCESS_QTY_REQUIRES_PERMISSION',
      `Received qty (${receivedQty}) exceeds pending qty (${pendingQty}) for ${poLine.itemCode}. Confirm allow excess to proceed.`,
    )
  }
  const excessQty =
    row.excessQty ?? Math.max(0, Number((receivedQty - pendingQty).toFixed(4)))
  const shortQty = row.shortQty ?? Math.max(0, Number((pendingQty - receivedQty).toFixed(4)))
  const warehouseId = row.warehouseId ?? (headerWarehouseId || poLine.locationId || '')
  const warehouseName = row.warehouseName ?? (headerWarehouseName || poLine.locationName || '')
  if (!warehouseId) {
    throw new PurchaseServiceError('WAREHOUSE_REQUIRED', `Warehouse is mandatory for line ${poLine.itemCode}`)
  }
  // note: || preferred over ?? for empty-string warehouse fallbacks above
  const batchNumber = row.batchNumber ?? ''
  const serialNumber = row.serialNumber ?? ''
  const expiryDate = row.expiryDate ?? null
  if (item.batchControlled && !batchNumber.trim()) {
    throw new PurchaseServiceError('BATCH_REQUIRED', `Batch number is mandatory for ${poLine.itemCode}`)
  }
  if (item.serialControlled && !serialNumber.trim()) {
    throw new PurchaseServiceError('SERIAL_REQUIRED', `Serial number is mandatory for ${poLine.itemCode}`)
  }
  if (item.expiryControlled && !expiryDate) {
    throw new PurchaseServiceError('EXPIRY_REQUIRED', `Expiry date is mandatory for ${poLine.itemCode}`)
  }

  const acceptedQty = row.acceptedQty ?? 0
  const rejectedQty = row.rejectedQty ?? 0
  const damagedQty = row.damagedQty ?? 0

  return {
    id: genId('prd-grnl'),
    lineNo: index + 1,
    purchaseOrderLineId: poLine.id,
    itemId: poLine.itemId,
    itemCode: poLine.itemCode,
    itemName: poLine.itemName,
    description: poLine.specification || poLine.itemName,
    uom: poLine.uom,
    hsnCode: poLine.hsnCode,
    orderedQty: poLine.quantity,
    previouslyReceivedQty,
    pendingQty,
    receivedQty,
    acceptedQty,
    rejectedQty,
    shortQty,
    excessQty,
    damagedQty,
    pendingInspectionQty: item.qcRequired ? receivedQty : 0,
    rate: poLine.rate,
    taxableAmount: Number((receivedQty * poLine.rate).toFixed(2)),
    batchNumber,
    lotNumber: row.lotNumber ?? '',
    serialNumber,
    manufacturingDate: row.manufacturingDate ?? null,
    expiryDate,
    warehouseId,
    warehouseName,
    bin: row.bin ?? '',
    locationId: warehouseId,
    locationName: warehouseName,
    inspectionStatus: item.qcRequired ? 'pending' : 'not_required',
    allowExcess,
    batchControlled: item.batchControlled,
    serialControlled: item.serialControlled,
    expiryControlled: item.expiryControlled,
    qcRequired: item.qcRequired,
    remarks: row.remarks ?? '',
  }
}

function validateGrnDocument(grn: GoodsReceiptNote, options?: { forPost?: boolean }) {
  if (!grn.warehouseId?.trim()) {
    throw new PurchaseServiceError('WAREHOUSE_REQUIRED', 'Warehouse is mandatory on GRN header.')
  }
  if (!grn.lines.length) {
    throw new PurchaseServiceError('GRN_LINES_REQUIRED', 'GRN must have at least one line.')
  }
  for (const line of grn.lines) {
    if (!line.warehouseId?.trim()) {
      throw new PurchaseServiceError('WAREHOUSE_REQUIRED', `Warehouse is mandatory for ${line.itemCode}`)
    }
    if (line.batchControlled && !line.batchNumber.trim()) {
      throw new PurchaseServiceError('BATCH_REQUIRED', `Batch number is mandatory for ${line.itemCode}`)
    }
    if (line.serialControlled && !line.serialNumber.trim()) {
      throw new PurchaseServiceError('SERIAL_REQUIRED', `Serial number is mandatory for ${line.itemCode}`)
    }
    if (line.expiryControlled && !line.expiryDate) {
      throw new PurchaseServiceError('EXPIRY_REQUIRED', `Expiry date is mandatory for ${line.itemCode}`)
    }
    if (line.receivedQty <= 0) {
      throw new PurchaseServiceError('INVALID_RECEIVED_QTY', `Received qty must be > 0 for ${line.itemCode}`)
    }
    if (line.receivedQty > line.pendingQty && !line.allowExcess && !grn.allowExcess) {
      throw new PurchaseServiceError(
        'EXCESS_QTY_REQUIRES_PERMISSION',
        `Received qty exceeds pending for ${line.itemCode}. Set allow excess to confirm.`,
      )
    }
  }
  if (options?.forPost) {
    if (grn.inspectionRequired) {
      const pendingLines = grn.lines.filter(
        (l) =>
          l.qcRequired &&
          !['completed', 'accepted', 'rejected', 'not_required'].includes(l.inspectionStatus),
      )
      if (pendingLines.length) {
        throw new PurchaseServiceError(
          'INSPECTION_INCOMPLETE',
          'Posting blocked until mandatory inspections are completed.',
        )
      }
      const qi = grn.qualityInspectionId
        ? state.qualityInspections.find((q) => q.id === grn.qualityInspectionId)
        : null
      if (!qi || ['pending', 'in_progress', 'hold', 'cancelled'].includes(qi.status)) {
        throw new PurchaseServiceError(
          'INSPECTION_INCOMPLETE',
          'Posting blocked until mandatory inspections are completed.',
        )
      }
      for (const line of grn.lines.filter((l) => l.qcRequired)) {
        const inspected = line.acceptedQty + line.rejectedQty
        if (Math.abs(inspected - line.receivedQty) > 0.0001 && qi.status !== 'hold') {
          // When inspection completed, accepted + rejected must equal inspected/received
          if (qi.status !== 'accepted_under_deviation') {
            throw new PurchaseServiceError(
              'QTY_BALANCE',
              `Accepted + Rejected must equal received qty for ${line.itemCode} (${line.acceptedQty} + ${line.rejectedQty} ≠ ${line.receivedQty}).`,
            )
          }
        }
      }
    }
  }
}

function applyPoReceipt(po: PurchaseOrder, lines: GoodsReceiptLine[], direction: 1 | -1) {
  for (const line of lines) {
    const poLine = po.lines.find((l) => l.id === line.purchaseOrderLineId)
    if (!poLine) continue
    poLine.receivedQty = Math.max(0, poLine.receivedQty + direction * line.receivedQty)
    poLine.pendingQty = Math.max(0, poLine.quantity - poLine.receivedQty)
    if (poLine.pendingQty <= 0 && poLine.receivedQty > 0) poLine.lineStatus = 'received'
    else if (poLine.receivedQty > 0) poLine.lineStatus = 'partial'
    else poLine.lineStatus = 'open'
  }
  const fully = po.lines.every((l) => l.receivedQty >= l.quantity)
  const any = po.lines.some((l) => l.receivedQty > 0)
  if (po.status !== 'cancelled' && po.status !== 'closed') {
    if (fully) po.status = 'fully_received'
    else if (any) po.status = 'partially_received'
    else if (po.releasedAt) po.status = 'released'
  }
  po.updatedAt = nowIso()
}

function toGrnListRow(g: GoodsReceiptNote): GrnListRow {
  return {
    id: g.id,
    documentNumber: g.documentNumber,
    documentDate: g.documentDate,
    purchaseOrderId: g.purchaseOrderId,
    purchaseOrderNumber: g.purchaseOrderNumber,
    vendorName: g.vendor.name,
    vendorCode: g.vendor.code,
    warehouseName: g.warehouseName,
    gateEntryNo: g.gateEntryNo,
    vehicleNo: g.vehicleNo,
    lineCount: g.lines.length,
    totalReceivedQty: g.lines.reduce((s, l) => s + l.receivedQty, 0),
    totalAcceptedQty: g.lines.reduce((s, l) => s + l.acceptedQty, 0),
    totalRejectedQty: g.lines.reduce((s, l) => s + l.rejectedQty, 0),
    totalAmount: g.totalAmount,
    status: g.status,
    statusLabel: GRN_DOMAIN_STATUS_LABELS[g.status],
    inspectionRequired: g.inspectionRequired,
    qualityInspectionId: g.qualityInspectionId,
  }
}

function toQiListRow(q: QualityInspection): QualityInspectionListRow {
  return {
    id: q.id,
    documentNumber: q.documentNumber,
    documentDate: q.documentDate,
    goodsReceiptId: q.goodsReceiptId,
    goodsReceiptNumber: q.goodsReceiptNumber,
    itemCode: q.itemCode,
    itemName: q.itemName,
    batchLotNo: q.batchLotNo,
    receivedQty: q.receivedQty,
    sampleQty: q.sampleQty,
    inspectorName: q.inspector.name,
    status: q.status,
    statusLabel: QUALITY_INSPECTION_STATUS_LABELS[q.status],
    result: q.result,
    resultLabel: q.result ? QUALITY_INSPECTION_RESULT_LABELS[q.result] : null,
  }
}

function syncGrnFromInspection(grn: GoodsReceiptNote, qi: QualityInspection) {
  const line = grn.lines.find((l) => l.id === qi.goodsReceiptLineId)
  if (!line) return
  line.acceptedQty = qi.acceptedQty
  line.rejectedQty = qi.rejectedQty
  line.pendingInspectionQty = Math.max(0, line.receivedQty - qi.acceptedQty - qi.rejectedQty)
  if (qi.status === 'hold') line.inspectionStatus = 'hold'
  else if (qi.status === 'pending' || qi.status === 'in_progress') line.inspectionStatus = qi.status
  else line.inspectionStatus = 'completed'

  grn.qualityInspectionId = qi.id
  if (qi.result === 'accepted') grn.status = 'accepted'
  else if (qi.result === 'rejected') grn.status = 'rejected'
  else if (qi.result === 'partially_accepted' || qi.result === 'accepted_under_deviation') {
    grn.status = 'partially_accepted'
  } else if (qi.result === 'hold' || qi.status === 'hold') {
    grn.status = 'pending_inspection'
  }
  grn.updatedAt = nowIso()
}

export async function getGRNs(): Promise<GoodsReceiptNote[]> {
  await delay()
  return [...state.grns].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getGrnList(): Promise<GrnListRow[]> {
  await delay()
  return state.grns
    .map(toGrnListRow)
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate) || b.documentNumber.localeCompare(a.documentNumber))
}

export async function getGRNById(id: string): Promise<GoodsReceiptNote | null> {
  await delay()
  return state.grns.find((g) => g.id === id) ?? null
}

export async function createGRN(input: GrnInput): Promise<GoodsReceiptNote> {
  return createGRNFromPo(input)
}

export async function createGRNFromPo(input: GrnInput): Promise<GoodsReceiptNote> {
  await delay()
  const po = state.orders.find((o) => o.id === input.purchaseOrderId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${input.purchaseOrderId}`)
  assertPoReceivable(po)

  const headerAllowExcess = input.allowExcess ?? false
  const warehouseId = input.warehouseId ?? po.deliveryLocation.id ?? po.location.id
  const warehouseName = input.warehouseName ?? po.deliveryLocation.name ?? po.location.name
  if (!warehouseId) {
    throw new PurchaseServiceError('WAREHOUSE_REQUIRED', 'Warehouse is mandatory.')
  }
  if (!input.lines?.length) {
    throw new PurchaseServiceError('GRN_LINES_REQUIRED', 'Select at least one PO line to receive.')
  }

  const lines = input.lines.map((row, index) =>
    buildGrnLineFromPo(po, row, index, headerAllowExcess, warehouseId, warehouseName),
  )
  const inspectionRequired =
    input.inspectionRequired ?? lines.some((l) => l.qcRequired)

  const taxable = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const totals = po.vendor.isInterstate
    ? computeInterTotals(taxable)
    : computeIntraTotals(taxable)
  const n = state.seq.grn++
  const created: GoodsReceiptNote = {
    id: genId('prd-grn'),
    documentNumber: docNo('GRN', n),
    documentDate: input.documentDate ?? todayDate(),
    status: 'draft',
    location: po.location,
    department: 'Stores',
    requester: partyFromActor(PURCHASE_DOMAIN_ACTORS.stores),
    receivedBy: {
      id: input.receivedById ?? PURCHASE_DOMAIN_ACTORS.stores.id,
      code: 'ST01',
      name: input.receivedByName ?? PURCHASE_DOMAIN_ACTORS.stores.name,
    },
    vendor: {
      id: po.vendor.id,
      code: po.vendor.code,
      name: po.vendor.name,
      gstin: po.vendor.gstin,
    },
    purchaseOrderId: po.id,
    purchaseOrderNumber: po.documentNumber,
    expectedDeliveryDate: po.expectedDeliveryDate,
    paymentTerms: po.paymentTerms,
    deliveryTerms: po.deliveryTerms,
    vendorChallanNumber: input.vendorChallanNumber ?? '',
    vendorChallanDate: input.vendorChallanDate ?? null,
    gateEntryNo: input.gateEntryNo ?? null,
    vehicleNo: input.vehicleNo ?? null,
    transporterName: input.transporterName ?? null,
    lrNumber: input.lrNumber ?? null,
    warehouseId,
    warehouseName,
    receivingLocation: input.receivingLocation ?? '',
    qcRequired: inspectionRequired,
    inspectionRequired,
    allowExcess: headerAllowExcess,
    qualityInspectionId: null,
    ...totals,
    lines,
    postedAt: null,
    inventoryPostDeferred: false,
    createdBy: PURCHASE_DOMAIN_ACTORS.stores.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: [],
  }

  validateGrnDocument(created)
  state.grns.unshift(created)
  return structuredClone(created)
}

export async function updateGRN(id: string, input: Partial<GrnInput>): Promise<GoodsReceiptNote> {
  await delay()
  const grn = state.grns.find((g) => g.id === id)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${id}`)
  if (!['draft', 'pending_inspection'].includes(grn.status)) {
    throw new PurchaseServiceError('GRN_NOT_EDITABLE', `Cannot edit GRN in status ${grn.status}`)
  }
  const po = state.orders.find((o) => o.id === grn.purchaseOrderId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${grn.purchaseOrderId}`)

  if (input.documentDate !== undefined) grn.documentDate = input.documentDate
  if (input.vendorChallanNumber !== undefined) grn.vendorChallanNumber = input.vendorChallanNumber
  if (input.vendorChallanDate !== undefined) grn.vendorChallanDate = input.vendorChallanDate
  if (input.gateEntryNo !== undefined) grn.gateEntryNo = input.gateEntryNo
  if (input.vehicleNo !== undefined) grn.vehicleNo = input.vehicleNo
  if (input.transporterName !== undefined) grn.transporterName = input.transporterName
  if (input.lrNumber !== undefined) grn.lrNumber = input.lrNumber
  if (input.receivingLocation !== undefined) grn.receivingLocation = input.receivingLocation
  if (input.remarks !== undefined) grn.remarks = input.remarks
  if (input.allowExcess !== undefined) grn.allowExcess = input.allowExcess
  if (input.inspectionRequired !== undefined) {
    grn.inspectionRequired = input.inspectionRequired
    grn.qcRequired = input.inspectionRequired
  }
  if (input.warehouseId !== undefined) {
    grn.warehouseId = input.warehouseId
    grn.warehouseName = input.warehouseName ?? grn.warehouseName
  } else if (input.warehouseName !== undefined) {
    grn.warehouseName = input.warehouseName
  }
  if (input.receivedById || input.receivedByName) {
    grn.receivedBy = {
      id: input.receivedById ?? grn.receivedBy.id,
      code: grn.receivedBy.code,
      name: input.receivedByName ?? grn.receivedBy.name,
    }
  }

  if (input.lines) {
    const headerAllowExcess = input.allowExcess ?? grn.allowExcess
    const warehouseId = input.warehouseId ?? grn.warehouseId
    const warehouseName = input.warehouseName ?? grn.warehouseName
    grn.lines = input.lines.map((row, index) =>
      buildGrnLineFromPo(po, row, index, headerAllowExcess, warehouseId, warehouseName),
    )
    const taxable = grn.lines.reduce((s, l) => s + l.taxableAmount, 0)
    const totals = po.vendor.isInterstate
      ? computeInterTotals(taxable)
      : computeIntraTotals(taxable)
    Object.assign(grn, totals)
  }

  validateGrnDocument(grn)
  grn.updatedAt = nowIso()
  grn.updatedBy = PURCHASE_DOMAIN_ACTORS.stores.name
  return structuredClone(grn)
}

/** Move draft → pending_inspection (or accepted when QC not required). Does not post stock. */
export async function submitGRN(id: string): Promise<GoodsReceiptNote> {
  await delay()
  const grn = state.grns.find((g) => g.id === id)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${id}`)
  if (grn.status !== 'draft') {
    throw new PurchaseServiceError('GRN_NOT_DRAFT', `Only draft GRNs can be submitted (current: ${grn.status})`)
  }
  validateGrnDocument(grn)
  if (grn.inspectionRequired) {
    grn.status = 'pending_inspection'
    // Auto-create pending QI for first QC line if none linked
    if (!grn.qualityInspectionId) {
      const qcLine = grn.lines.find((l) => l.qcRequired)
      if (qcLine) {
        const qi = await createQualityInspectionInternal({
          goodsReceiptId: grn.id,
          goodsReceiptLineId: qcLine.id,
          sampleQty: Math.min(5, qcLine.receivedQty),
        })
        grn.qualityInspectionId = qi.id
      }
    }
  } else {
    for (const line of grn.lines) {
      line.acceptedQty = line.receivedQty
      line.rejectedQty = 0
      line.pendingInspectionQty = 0
      line.inspectionStatus = 'not_required'
    }
    grn.status = 'accepted'
  }
  grn.updatedAt = nowIso()
  grn.updatedBy = PURCHASE_DOMAIN_ACTORS.stores.name
  return structuredClone(grn)
}

/**
 * Post GRN — updates PO received qty. Inventory write is deferred (demo mock).
 * Returns confirmation flag `inventoryPostDeferred: true`.
 */
export async function postGRN(id: string): Promise<GoodsReceiptNote> {
  await delay()
  const grn = state.grns.find((g) => g.id === id)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${id}`)
  if (grn.status === 'posted') {
    throw new PurchaseServiceError('GRN_ALREADY_POSTED', 'GRN is already posted.')
  }
  if (grn.status === 'cancelled') {
    throw new PurchaseServiceError('GRN_CANCELLED', 'Cannot post a cancelled GRN.')
  }
  if (grn.status === 'draft') {
    throw new PurchaseServiceError('GRN_NOT_SUBMITTED', 'Submit the GRN before posting.')
  }
  validateGrnDocument(grn, { forPost: true })

  const po = state.orders.find((o) => o.id === grn.purchaseOrderId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${grn.purchaseOrderId}`)

  applyPoReceipt(po, grn.lines, 1)
  grn.status = 'posted'
  grn.postedAt = nowIso()
  grn.inventoryPostDeferred = true
  grn.updatedAt = nowIso()
  grn.updatedBy = PURCHASE_DOMAIN_ACTORS.stores.name
  return structuredClone(grn)
}

function createQualityInspectionInternal(input: QualityInspectionInput): QualityInspection {
  const grn = state.grns.find((g) => g.id === input.goodsReceiptId)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${input.goodsReceiptId}`)
  const grnLine = grn.lines.find((l) => l.id === input.goodsReceiptLineId)
  if (!grnLine) {
    throw new PurchaseServiceError('GRN_LINE_NOT_FOUND', `GRN line not found: ${input.goodsReceiptLineId}`)
  }

  const parameters =
    input.parameters?.map((p) => ({
      id: genId('prd-qip'),
      parameter: p.parameter,
      specification: p.specification ?? '',
      minValue: p.minValue ?? null,
      maxValue: p.maxValue ?? null,
      observedValue: p.observedValue ?? null,
      unit: p.unit ?? '',
      result: p.result ?? ('na' as const),
      remarks: p.remarks ?? '',
    })) ?? defaultInspectionParameters(grnLine.itemCode)

  const n = state.seq.qi++
  const created: QualityInspection = {
    id: genId('prd-qi'),
    documentNumber: docNo('QI', n),
    documentDate: input.documentDate ?? todayDate(),
    status: 'pending',
    result: null,
    goodsReceiptId: grn.id,
    goodsReceiptNumber: grn.documentNumber,
    goodsReceiptLineId: grnLine.id,
    purchaseOrderId: grn.purchaseOrderId,
    purchaseOrderNumber: grn.purchaseOrderNumber,
    vendor: {
      id: grn.vendor.id,
      code: grn.vendor.code,
      name: grn.vendor.name,
    },
    location: grn.location,
    itemId: grnLine.itemId,
    itemCode: grnLine.itemCode,
    itemName: grnLine.itemName,
    batchLotNo: grnLine.batchNumber || grnLine.lotNumber,
    receivedQty: grnLine.receivedQty,
    sampleQty: input.sampleQty ?? Math.min(5, grnLine.receivedQty),
    acceptedQty: input.acceptedQty ?? 0,
    rejectedQty: input.rejectedQty ?? 0,
    inspectionPlan: input.inspectionPlan ?? `Incoming inspection — ${grnLine.itemCode}`,
    inspector: {
      id: input.inspectorId ?? PURCHASE_DOMAIN_ACTORS.qc.id,
      code: 'QC01',
      name: input.inspectorName ?? PURCHASE_DOMAIN_ACTORS.qc.name,
    },
    inspectedAt: null,
    deviationRequested: false,
    deviationRemarks: '',
    parameters,
    createdBy: PURCHASE_DOMAIN_ACTORS.qc.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: [],
  }

  grn.qualityInspectionId = created.id
  grnLine.inspectionStatus = 'pending'
  state.qualityInspections.unshift(created)
  return created
}

export async function getQualityInspections(goodsReceiptId?: string): Promise<QualityInspection[]> {
  await delay()
  const rows = goodsReceiptId
    ? state.qualityInspections.filter((q) => q.goodsReceiptId === goodsReceiptId)
    : [...state.qualityInspections]
  return rows.sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getQualityInspectionList(goodsReceiptId?: string): Promise<QualityInspectionListRow[]> {
  await delay()
  const rows = goodsReceiptId
    ? state.qualityInspections.filter((q) => q.goodsReceiptId === goodsReceiptId)
    : state.qualityInspections
  return rows.map(toQiListRow).sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getQualityInspectionById(id: string): Promise<QualityInspection | null> {
  await delay()
  return state.qualityInspections.find((q) => q.id === id) ?? null
}

export async function createQualityInspection(
  input: QualityInspectionInput,
): Promise<QualityInspection> {
  await delay()
  const created = createQualityInspectionInternal(input)
  return structuredClone(created)
}

export async function updateQualityInspection(
  id: string,
  input: Partial<QualityInspectionInput> & {
    parameters?: QualityInspectionParameter[]
    acceptedQty?: number
    rejectedQty?: number
    sampleQty?: number
    inspectionPlan?: string
    remarks?: string
  },
): Promise<QualityInspection> {
  await delay()
  const qi = state.qualityInspections.find((q) => q.id === id)
  if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', `Quality inspection not found: ${id}`)
  if (['cancelled', 'accepted', 'rejected', 'partially_accepted', 'accepted_under_deviation'].includes(qi.status)) {
    throw new PurchaseServiceError('QI_NOT_EDITABLE', `Cannot edit QI in status ${qi.status}`)
  }

  if (input.sampleQty !== undefined) qi.sampleQty = input.sampleQty
  if (input.acceptedQty !== undefined) qi.acceptedQty = input.acceptedQty
  if (input.rejectedQty !== undefined) qi.rejectedQty = input.rejectedQty
  if (input.inspectionPlan !== undefined) qi.inspectionPlan = input.inspectionPlan
  if (input.remarks !== undefined) qi.remarks = input.remarks
  if (input.inspectorId || input.inspectorName) {
    qi.inspector = {
      id: input.inspectorId ?? qi.inspector.id,
      code: qi.inspector.code,
      name: input.inspectorName ?? qi.inspector.name,
    }
  }
  if (input.parameters) {
    qi.parameters = input.parameters.map((p) => ({
      id: p.id || genId('prd-qip'),
      parameter: p.parameter,
      specification: p.specification ?? '',
      minValue: p.minValue ?? null,
      maxValue: p.maxValue ?? null,
      observedValue: p.observedValue ?? null,
      unit: p.unit ?? '',
      result: p.result ?? 'na',
      remarks: p.remarks ?? '',
    }))
  }
  if (qi.status === 'pending') qi.status = 'in_progress'
  qi.updatedAt = nowIso()
  qi.updatedBy = PURCHASE_DOMAIN_ACTORS.qc.name
  return structuredClone(qi)
}

function finalizeInspection(
  qi: QualityInspection,
  result: QualityInspectionResult,
  acceptedQty: number,
  rejectedQty: number,
) {
  const inspected = acceptedQty + rejectedQty
  if (Math.abs(inspected - qi.receivedQty) > 0.0001 && result !== 'hold') {
    throw new PurchaseServiceError(
      'QTY_BALANCE',
      `Accepted + Rejected must equal received qty (${acceptedQty} + ${rejectedQty} ≠ ${qi.receivedQty}).`,
    )
  }
  qi.acceptedQty = acceptedQty
  qi.rejectedQty = rejectedQty
  qi.result = result
  qi.status = result
  qi.inspectedAt = nowIso()
  qi.updatedAt = nowIso()
  qi.updatedBy = PURCHASE_DOMAIN_ACTORS.qc.name

  const grn = state.grns.find((g) => g.id === qi.goodsReceiptId)
  if (grn) syncGrnFromInspection(grn, qi)
}

export async function acceptQualityInspection(
  id: string,
  acceptedQty?: number,
  rejectedQty = 0,
): Promise<QualityInspection> {
  await delay()
  const qi = state.qualityInspections.find((q) => q.id === id)
  if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', `Quality inspection not found: ${id}`)
  const acc = acceptedQty ?? qi.receivedQty - rejectedQty
  const rej = rejectedQty
  const result: QualityInspectionResult =
    rej > 0 && acc > 0 ? 'partially_accepted' : rej > 0 ? 'rejected' : 'accepted'
  finalizeInspection(qi, result, acc, rej)
  return structuredClone(qi)
}

export async function rejectQualityInspection(
  id: string,
  rejectedQty?: number,
): Promise<QualityInspection> {
  await delay()
  const qi = state.qualityInspections.find((q) => q.id === id)
  if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', `Quality inspection not found: ${id}`)
  const rej = rejectedQty ?? qi.receivedQty
  finalizeInspection(qi, 'rejected', Math.max(0, qi.receivedQty - rej), rej)
  return structuredClone(qi)
}

export async function holdQualityInspection(id: string, remarks = ''): Promise<QualityInspection> {
  await delay()
  const qi = state.qualityInspections.find((q) => q.id === id)
  if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', `Quality inspection not found: ${id}`)
  qi.status = 'hold'
  qi.result = 'hold'
  if (remarks) qi.remarks = remarks
  qi.updatedAt = nowIso()
  const grn = state.grns.find((g) => g.id === qi.goodsReceiptId)
  if (grn) syncGrnFromInspection(grn, qi)
  return structuredClone(qi)
}

export async function requestDeviationApproval(
  id: string,
  remarks: string,
): Promise<QualityInspection> {
  await delay()
  const qi = state.qualityInspections.find((q) => q.id === id)
  if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', `Quality inspection not found: ${id}`)
  if (!remarks.trim()) {
    throw new PurchaseServiceError('DEVIATION_REMARKS_REQUIRED', 'Deviation remarks are required.')
  }
  qi.deviationRequested = true
  qi.deviationRemarks = remarks.trim()
  qi.status = 'accepted_under_deviation'
  qi.result = 'accepted_under_deviation'
  if (qi.acceptedQty <= 0) qi.acceptedQty = qi.receivedQty
  qi.rejectedQty = Math.max(0, qi.receivedQty - qi.acceptedQty)
  qi.inspectedAt = nowIso()
  qi.updatedAt = nowIso()
  const grn = state.grns.find((g) => g.id === qi.goodsReceiptId)
  if (grn) syncGrnFromInspection(grn, qi)
  return structuredClone(qi)
}

export async function getPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  await delay()
  return [...state.invoices].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getPurchaseInvoiceList(): Promise<PurchaseInvoiceListRow[]> {
  await delay()
  return [...state.invoices]
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate))
    .map(toInvoiceListRow)
}

export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice | null> {
  await delay()
  return state.invoices.find((i) => i.id === id) ?? null
}

function toInvoiceListRow(inv: PurchaseInvoice): PurchaseInvoiceListRow {
  return {
    id: inv.id,
    documentNumber: inv.documentNumber,
    documentDate: inv.documentDate,
    status: inv.status,
    statusLabel: PURCHASE_INVOICE_STATUS_LABELS[inv.status],
    origin: inv.origin,
    originLabel: PURCHASE_INVOICE_ORIGIN_LABELS[inv.origin],
    vendorName: inv.vendor.name,
    vendorGstin: inv.vendor.gstin,
    vendorInvoiceNumber: inv.vendorInvoiceNumber,
    purchaseOrderNumber: inv.purchaseOrderNumber,
    goodsReceiptNumber: inv.goodsReceiptNumber,
    matchingResultStatus: inv.matchingResultStatus,
    matchingResultStatusLabel: INVOICE_MATCHING_RESULT_STATUS_LABELS[inv.matchingResultStatus],
    matchStatus: inv.matchStatus,
    totalAmount: inv.totalAmount,
    currency: inv.currency,
    dueDate: inv.dueDate,
    postingDate: inv.postingDate,
  }
}

function parsePaymentTermsDays(terms: string): number {
  const m = terms.match(/(\d+)/)
  return m ? Number(m[1]) : 30
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function assertCanCreateDirectInvoice() {
  const setup = state.setup
  const session = getSessionUser()
  if (setup.allowDirectInvoice) return
  if (session.role === 'admin') return
  throw new PurchaseServiceError(
    'DIRECT_INVOICE_FORBIDDEN',
    'Direct invoice requires setup flag allowDirectInvoice or admin role',
  )
}

function isDuplicateVendorInvoice(
  vendorId: string,
  vendorInvoiceNumber: string,
  excludeId?: string,
): boolean {
  const key = vendorInvoiceNumber.trim().toLowerCase()
  if (!key) return false
  return state.invoices.some(
    (i) =>
      i.id !== excludeId &&
      i.vendor.id === vendorId &&
      i.status !== 'cancelled' &&
      i.vendorInvoiceNumber.trim().toLowerCase() === key,
  )
}

function buildInvoiceLines(
  inputLines: PurchaseInvoiceInput['lines'],
  vendor: Vendor,
  po: PurchaseOrder | null | undefined,
  grn: GoodsReceiptNote | null | undefined,
): PurchaseInvoiceLine[] {
  return inputLines.map((row, index) => {
    const item = requireItem(row.itemId)
    const poLine = row.purchaseOrderLineId
      ? po?.lines.find((l) => l.id === row.purchaseOrderLineId)
      : null
    const grnLine = row.goodsReceiptLineId
      ? grn?.lines.find((l) => l.id === row.goodsReceiptLineId)
      : null
    const discountAmount = row.discountAmount ?? 0
    const gstRatePct = row.gstRatePct ?? item.gstRatePct
    const gross = row.quantity * row.rate
    const taxableAmount = Number(Math.max(0, gross - discountAmount).toFixed(2))
    const tax = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
    const half = Number((tax / 2).toFixed(2))
    const tdsAmount = row.tdsAmount ?? 0
    const tcsAmount = row.tcsAmount ?? 0
    const lineTotal = Number((taxableAmount + tax + tcsAmount - tdsAmount).toFixed(2))
    return {
      id: genId('prd-invl'),
      lineNo: index + 1,
      purchaseOrderLineId: row.purchaseOrderLineId ?? null,
      goodsReceiptLineId: row.goodsReceiptLineId ?? null,
      poLineNo: poLine?.lineNo ?? null,
      grnLineNo: grnLine?.lineNo ?? null,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: row.description ?? item.itemName,
      uom: item.uom,
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      quantity: row.quantity,
      rate: row.rate,
      discountAmount,
      taxableAmount,
      gstRatePct,
      cgst: vendor.isInterstate ? 0 : half,
      sgst: vendor.isInterstate ? 0 : half,
      igst: vendor.isInterstate ? tax : 0,
      tdsAmount,
      tcsAmount,
      lineTotal,
      costCentre: row.costCentre ?? '',
      project: row.project ?? '',
      account: row.account ?? '5110-RM Purchases',
      remarks: row.remarks ?? '',
    }
  })
}

function applyInvoiceTotals(lines: PurchaseInvoiceLine[], vendor: Vendor, freight = 0, other = 0) {
  const taxable = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const discount = lines.reduce((s, l) => s + l.discountAmount, 0)
  const tds = lines.reduce((s, l) => s + l.tdsAmount, 0)
  const tcs = lines.reduce((s, l) => s + l.tcsAmount, 0)
  const base = vendor.isInterstate
    ? computeInterTotals(taxable, freight, other)
    : computeIntraTotals(taxable, freight, other)
  return {
    ...base,
    discount: Number((base.discount + discount).toFixed(2)),
    subtotal: Number((taxable + discount).toFixed(2)),
    totalAmount: Number((base.totalAmount + tcs - tds).toFixed(2)),
  }
}

function pctDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100
  return (Math.abs(a - b) / Math.abs(b)) * 100
}

function computeMatchingForInvoice(inv: PurchaseInvoice): InvoiceMatchingResult {
  const tolerances: PurchaseInvoiceMatchTolerances = {
    ...state.setup.invoiceMatchTolerances,
  }
  const po = inv.purchaseOrderId
    ? state.orders.find((o) => o.id === inv.purchaseOrderId)
    : null
  const grn = inv.goodsReceiptId
    ? state.grns.find((g) => g.id === inv.goodsReceiptId)
    : null

  const missingGrn =
    Boolean(inv.purchaseOrderId) &&
    inv.origin !== 'service_po' &&
    inv.origin !== 'direct' &&
    inv.origin !== 'vendor_invoice' &&
    !grn

  const isDuplicate = isDuplicateVendorInvoice(inv.vendor.id, inv.vendorInvoiceNumber, inv.id)

  const lineResults = inv.lines.map((line) => {
    const poLine = line.purchaseOrderLineId
      ? po?.lines.find((l) => l.id === line.purchaseOrderLineId)
      : po?.lines.find((l) => l.itemId === line.itemId)
    const grnLine = line.goodsReceiptLineId
      ? grn?.lines.find((l) => l.id === line.goodsReceiptLineId)
      : grn?.lines.find((l) => l.itemId === line.itemId)

    const poQty = poLine?.quantity ?? null
    const grnQty = grnLine?.receivedQty ?? null
    const poRate = poLine?.rate ?? null
    const poTaxPct = poLine?.gstRatePct ?? null
    const poLineTotal = poLine?.lineTotal ?? null

    const flags: InvoiceMatchingResultStatus[] = []
    let withinTolerance = true

    const refQty = grnQty ?? poQty
    if (refQty != null) {
      const qtyDeltaPct = pctDiff(line.quantity, refQty)
      if (qtyDeltaPct > tolerances.quantityTolerancePct) {
        flags.push('quantity_mismatch')
        withinTolerance = false
      } else if (qtyDeltaPct > 0) {
        flags.push('within_tolerance')
      }
    }

    if (poRate != null) {
      const rateDeltaPct = pctDiff(line.rate, poRate)
      if (rateDeltaPct > tolerances.rateTolerancePct) {
        flags.push('rate_mismatch')
        withinTolerance = false
      } else if (rateDeltaPct > 0 && !flags.includes('within_tolerance')) {
        flags.push('within_tolerance')
      }
    }

    if (poTaxPct != null) {
      const taxDeltaPct = Math.abs(line.gstRatePct - poTaxPct)
      const lineTax = line.cgst + line.sgst + line.igst
      const poTaxBase = poLine != null ? poLine.taxableAmount ?? poLine.quantity * poLine.rate : 0
      const poTaxAmt = poLine != null ? Number(((poTaxBase * poTaxPct) / 100).toFixed(2)) : null
      const taxAmtDelta = poTaxAmt != null ? Math.abs(lineTax - poTaxAmt) : 0
      if (taxDeltaPct > tolerances.taxTolerancePct && taxAmtDelta > tolerances.taxToleranceInr) {
        flags.push('tax_mismatch')
        withinTolerance = false
      }
    }

    if (poLineTotal != null) {
      const amtDelta = Math.abs(line.lineTotal - poLineTotal)
      const amtDeltaPct = pctDiff(line.lineTotal, poLineTotal)
      if (amtDelta > tolerances.amountToleranceInr && amtDeltaPct > tolerances.rateTolerancePct) {
        flags.push('amount_mismatch')
        withinTolerance = false
      }
    }

    if (flags.length === 0) flags.push('fully_matched')

    return {
      lineNo: line.lineNo,
      itemCode: line.itemCode,
      itemName: line.itemName,
      poQty,
      grnReceivedQty: grnQty,
      invoiceQty: line.quantity,
      poRate,
      invoiceRate: line.rate,
      poTaxPct,
      invoiceTaxPct: line.gstRatePct,
      poLineTotal,
      invoiceLineTotal: line.lineTotal,
      flags,
      withinTolerance,
    }
  })

  const summary = {
    poQty: lineResults.reduce((s, l) => s + (l.poQty ?? 0), 0),
    grnQty: lineResults.reduce((s, l) => s + (l.grnReceivedQty ?? 0), 0),
    invoiceQty: lineResults.reduce((s, l) => s + l.invoiceQty, 0),
    poTotal: po?.totalAmount ?? 0,
    invoiceTotal: inv.totalAmount,
    poTax: po ? po.cgst + po.sgst + po.igst : 0,
    invoiceTax: inv.cgst + inv.sgst + inv.igst,
  }

  let overallStatus: InvoiceMatchingResultStatus = 'fully_matched'
  if (isDuplicate) overallStatus = 'duplicate_invoice'
  else if (missingGrn) overallStatus = 'missing_grn'
  else {
    const priority: InvoiceMatchingResultStatus[] = [
      'quantity_mismatch',
      'rate_mismatch',
      'tax_mismatch',
      'amount_mismatch',
      'within_tolerance',
      'fully_matched',
    ]
    for (const p of priority) {
      if (lineResults.some((l) => l.flags.includes(p))) {
        overallStatus = p
        break
      }
    }
  }

  const exceedsTolerance =
    isDuplicate || missingGrn || lineResults.some((l) => !l.withinTolerance)

  return {
    overallStatus,
    overallStatusLabel: INVOICE_MATCHING_RESULT_STATUS_LABELS[overallStatus],
    exceedsTolerance,
    isDuplicateVendorInvoice: isDuplicate,
    missingGrn,
    lines: lineResults,
    summary,
    tolerancesApplied: tolerances,
  }
}

function syncInvoiceMatchFields(inv: PurchaseInvoice, matching: InvoiceMatchingResult) {
  inv.matchingResultStatus = matching.overallStatus
  if (matching.isDuplicateVendorInvoice || matching.exceedsTolerance) {
    inv.matchStatus = 'mismatch'
  } else if (
    matching.overallStatus === 'fully_matched' ||
    matching.overallStatus === 'within_tolerance'
  ) {
    inv.matchStatus = 'matched'
  } else {
    inv.matchStatus = 'unmatched'
  }
}

function requireInvoice(id: string): PurchaseInvoice {
  const inv = state.invoices.find((i) => i.id === id)
  if (!inv) throw new PurchaseServiceError('INV_NOT_FOUND', `Purchase invoice not found: ${id}`)
  return inv
}

function assertInvoiceEditable(inv: PurchaseInvoice) {
  if (!['draft', 'pending_verification', 'matched', 'mismatch', 'on_hold'].includes(inv.status)) {
    throw new PurchaseServiceError('INV_NOT_EDITABLE', `Cannot edit invoice in status ${inv.status}`)
  }
}

export async function computeInvoiceMatching(id: string): Promise<InvoiceMatchingResult> {
  await delay()
  const inv = requireInvoice(id)
  return computeMatchingForInvoice(inv)
}

export async function createPurchaseInvoice(
  input: PurchaseInvoiceInput,
): Promise<PurchaseInvoice> {
  await delay()
  const origin: PurchaseInvoiceOrigin =
    input.origin ??
    (input.goodsReceiptId
      ? 'goods_receipt'
      : input.purchaseOrderId
        ? 'purchase_order'
        : 'vendor_invoice')

  if (origin === 'direct') assertCanCreateDirectInvoice()

  const vendor = requireVendor(input.vendorId)
  const po = input.purchaseOrderId
    ? state.orders.find((o) => o.id === input.purchaseOrderId)
    : null
  const grn = input.goodsReceiptId
    ? state.grns.find((g) => g.id === input.goodsReceiptId)
    : null

  if (input.goodsReceiptId && !grn) {
    throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${input.goodsReceiptId}`)
  }
  if (grn && grn.status !== 'posted' && origin === 'goods_receipt') {
    throw new PurchaseServiceError('GRN_NOT_POSTED', 'Invoice from GRN requires a posted GRN')
  }
  if (input.purchaseOrderId && !po) {
    throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${input.purchaseOrderId}`)
  }
  if (!input.lines.length) {
    throw new PurchaseServiceError('INV_NO_LINES', 'Invoice requires at least one line')
  }

  const lines = buildInvoiceLines(input.lines, vendor, po, grn)
  const totals = applyInvoiceTotals(lines, vendor, po?.freight ?? 0, po?.otherCharges ?? 0)
  const documentDate = input.documentDate ?? todayDate()
  const postingDate = input.postingDate ?? documentDate
  const paymentTerms = input.paymentTerms ?? po?.paymentTerms ?? vendor.paymentTerms
  const dueDate =
    input.dueDate ?? addDaysIso(input.vendorInvoiceDate, parsePaymentTermsDays(paymentTerms))

  const n = state.seq.inv++
  const created: PurchaseInvoice = {
    id: genId('prd-inv'),
    documentNumber: docNo('PINV', n),
    documentDate,
    status: 'draft',
    origin,
    vendorInvoiceNumber: input.vendorInvoiceNumber,
    vendorInvoiceDate: input.vendorInvoiceDate,
    postingDate,
    location: po?.location ?? grn?.location ?? { ...PURCHASE_DEMO_LOCATION },
    department: 'Accounts',
    requester: partyFromActor(PURCHASE_DOMAIN_ACTORS.accounts),
    approver: null,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: vendor.isInterstate,
    },
    paymentTerms,
    deliveryTerms: po?.deliveryTerms ?? vendor.deliveryTerms,
    expectedDeliveryDate: null,
    dueDate,
    placeOfSupply: input.placeOfSupply ?? `${vendor.state}`,
    reverseCharge: input.reverseCharge ?? false,
    eInvoiceReference: input.eInvoiceReference ?? null,
    gstScheme: vendor.isInterstate ? 'igst' : 'cgst_sgst',
    purchaseOrderId: po?.id ?? null,
    purchaseOrderNumber: po?.documentNumber ?? null,
    goodsReceiptId: grn?.id ?? null,
    goodsReceiptNumber: grn?.documentNumber ?? null,
    matchStatus: 'unmatched',
    matchingResultStatus: 'fully_matched',
    matchingExceptionApproved: false,
    exceptionApprovedBy: null,
    exceptionApprovedAt: null,
    verifiedAt: null,
    verifiedBy: null,
    onHoldReason: null,
    holdAt: null,
    debitNoteId: null,
    debitNoteNumber: null,
    ...totals,
    lines,
    approvalIds: [],
    postedAt: null,
    paidAt: null,
    createdBy: PURCHASE_DOMAIN_ACTORS.accounts.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: [],
  }

  const matching = computeMatchingForInvoice(created)
  syncInvoiceMatchFields(created, matching)
  if (matching.isDuplicateVendorInvoice) {
    created.matchingResultStatus = 'duplicate_invoice'
    created.matchStatus = 'mismatch'
  }

  state.invoices.unshift(created)
  return structuredClone(created)
}

export async function updatePurchaseInvoice(
  id: string,
  input: PurchaseInvoiceInput,
): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  assertInvoiceEditable(inv)

  const vendor = requireVendor(input.vendorId)
  const po = input.purchaseOrderId
    ? state.orders.find((o) => o.id === input.purchaseOrderId)
    : null
  const grn = input.goodsReceiptId
    ? state.grns.find((g) => g.id === input.goodsReceiptId)
    : null

  if (!input.lines.length) {
    throw new PurchaseServiceError('INV_NO_LINES', 'Invoice requires at least one line')
  }

  const lines = buildInvoiceLines(input.lines, vendor, po, grn)
  const totals = applyInvoiceTotals(lines, vendor, po?.freight ?? 0, po?.otherCharges ?? 0)
  const paymentTerms = input.paymentTerms ?? inv.paymentTerms
  const documentDate = input.documentDate ?? inv.documentDate

  Object.assign(inv, {
    ...totals,
    vendorInvoiceNumber: input.vendorInvoiceNumber,
    vendorInvoiceDate: input.vendorInvoiceDate,
    documentDate,
    postingDate: input.postingDate ?? inv.postingDate,
    dueDate: input.dueDate ?? inv.dueDate,
    placeOfSupply: input.placeOfSupply ?? inv.placeOfSupply,
    paymentTerms,
    reverseCharge: input.reverseCharge ?? inv.reverseCharge,
    eInvoiceReference:
      input.eInvoiceReference !== undefined ? input.eInvoiceReference : inv.eInvoiceReference,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
      state: vendor.state,
      isInterstate: vendor.isInterstate,
    },
    gstScheme: vendor.isInterstate ? 'igst' : 'cgst_sgst',
    purchaseOrderId: po?.id ?? inv.purchaseOrderId,
    purchaseOrderNumber: po?.documentNumber ?? inv.purchaseOrderNumber,
    goodsReceiptId: grn?.id ?? inv.goodsReceiptId,
    goodsReceiptNumber: grn?.documentNumber ?? inv.goodsReceiptNumber,
    lines,
    remarks: input.remarks ?? inv.remarks,
    matchingExceptionApproved: false,
    exceptionApprovedBy: null,
    exceptionApprovedAt: null,
    updatedBy: getSessionUser().name,
    updatedAt: nowIso(),
  })

  if (input.origin) inv.origin = input.origin

  const matching = computeMatchingForInvoice(inv)
  syncInvoiceMatchFields(inv, matching)
  if (inv.status === 'matched' || inv.status === 'mismatch') {
    inv.status = matching.exceedsTolerance ? 'mismatch' : 'matched'
  }

  return structuredClone(inv)
}

export async function createPurchaseInvoiceFromPo(purchaseOrderId: string): Promise<PurchaseInvoice> {
  await delay()
  const po = state.orders.find((o) => o.id === purchaseOrderId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${purchaseOrderId}`)
  const postedGrn = state.grns.find((g) => g.purchaseOrderId === po.id && g.status === 'posted')
  return createPurchaseInvoice({
    vendorId: po.vendor.id,
    vendorInvoiceNumber: '',
    vendorInvoiceDate: todayDate(),
    origin: po.orderType === 'service' ? 'service_po' : 'purchase_order',
    purchaseOrderId: po.id,
    goodsReceiptId: postedGrn?.id ?? null,
    paymentTerms: po.paymentTerms,
    placeOfSupply: po.placeOfSupply || po.vendor.state,
    lines: po.lines
      .filter((l) => l.lineStatus !== 'cancelled')
      .map((l) => ({
        itemId: l.itemId,
        quantity: Math.max(0, l.quantity - (l.invoicedQty ?? 0)) || l.quantity,
        rate: l.rate,
        purchaseOrderLineId: l.id,
        goodsReceiptLineId:
          postedGrn?.lines.find((gl) => gl.purchaseOrderLineId === l.id)?.id ?? null,
        description: l.description || l.itemName,
        gstRatePct: l.gstRatePct,
      })),
  })
}

export async function createPurchaseInvoiceFromGrn(goodsReceiptId: string): Promise<PurchaseInvoice> {
  await delay()
  const grn = state.grns.find((g) => g.id === goodsReceiptId)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${goodsReceiptId}`)
  if (grn.status !== 'posted') {
    throw new PurchaseServiceError('GRN_NOT_POSTED', 'Only posted GRNs can create invoices')
  }
  const po = state.orders.find((o) => o.id === grn.purchaseOrderId)
  return createPurchaseInvoice({
    vendorId: grn.vendor.id,
    vendorInvoiceNumber: '',
    vendorInvoiceDate: todayDate(),
    origin: 'goods_receipt',
    purchaseOrderId: grn.purchaseOrderId,
    goodsReceiptId: grn.id,
    paymentTerms: grn.paymentTerms,
    placeOfSupply: po?.placeOfSupply ?? '',
    lines: grn.lines.map((l) => {
      const poLine = po?.lines.find((pl) => pl.id === l.purchaseOrderLineId)
      return {
        itemId: l.itemId,
        quantity: l.acceptedQty || l.receivedQty,
        rate: l.rate ?? poLine?.rate ?? 0,
        purchaseOrderLineId: l.purchaseOrderLineId,
        goodsReceiptLineId: l.id,
        description: l.description || l.itemName,
        gstRatePct: poLine?.gstRatePct,
      }
    }),
  })
}

export async function createPurchaseInvoiceFromServicePo(
  purchaseOrderId: string,
): Promise<PurchaseInvoice> {
  await delay()
  const po = state.orders.find((o) => o.id === purchaseOrderId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${purchaseOrderId}`)
  if (po.orderType !== 'service' && !po.lines.every((l) => l.itemType === 'service')) {
    throw new PurchaseServiceError('PO_NOT_SERVICE', 'Selected PO is not a service purchase order')
  }
  return createPurchaseInvoice({
    vendorId: po.vendor.id,
    vendorInvoiceNumber: '',
    vendorInvoiceDate: todayDate(),
    origin: 'service_po',
    purchaseOrderId: po.id,
    paymentTerms: po.paymentTerms,
    placeOfSupply: po.placeOfSupply || po.vendor.state,
    lines: po.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      rate: l.rate,
      purchaseOrderLineId: l.id,
      description: l.description || l.itemName,
      gstRatePct: l.gstRatePct,
      account: '5200-Services',
    })),
  })
}

export async function createDirectPurchaseInvoice(
  input: PurchaseInvoiceInput,
): Promise<PurchaseInvoice> {
  return createPurchaseInvoice({ ...input, origin: 'direct' })
}

export async function verifyPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  if (!['draft', 'pending_verification', 'on_hold', 'matched', 'mismatch'].includes(inv.status)) {
    throw new PurchaseServiceError('INV_INVALID_STATUS', `Cannot verify from ${inv.status}`)
  }
  if (!inv.vendorInvoiceNumber.trim()) {
    throw new PurchaseServiceError('INV_VENDOR_NUMBER_REQUIRED', 'Vendor invoice number is required')
  }
  if (!inv.lines.length) {
    throw new PurchaseServiceError('INV_NO_LINES', 'Add lines before verify')
  }

  const matching = computeMatchingForInvoice(inv)
  syncInvoiceMatchFields(inv, matching)
  inv.verifiedAt = nowIso()
  inv.verifiedBy = getSessionUser().name
  inv.status = matching.exceedsTolerance || matching.isDuplicateVendorInvoice ? 'mismatch' : 'matched'
  inv.updatedAt = nowIso()
  inv.updatedBy = getSessionUser().name
  return structuredClone(inv)
}

export async function submitPurchaseInvoiceForApproval(id: string): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  if (!['matched', 'mismatch', 'draft', 'pending_verification'].includes(inv.status)) {
    throw new PurchaseServiceError('INV_INVALID_STATUS', `Cannot submit from ${inv.status}`)
  }
  if (!inv.verifiedAt) {
    const verified = await verifyPurchaseInvoice(id)
    const current = requireInvoice(id)
    Object.assign(current, verified)
  }
  const current = requireInvoice(id)
  current.status = 'pending_approval'
  current.updatedAt = nowIso()
  current.updatedBy = getSessionUser().name
  return structuredClone(current)
}

export async function approvePurchaseInvoice(
  id: string,
  remarks?: string,
): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  if (inv.status !== 'pending_approval' && inv.status !== 'mismatch') {
    throw new PurchaseServiceError('INV_INVALID_STATUS', `Cannot approve from ${inv.status}`)
  }
  inv.status = 'approved'
  inv.approver = partyFromActor(PURCHASE_DOMAIN_ACTORS.purchaseHead)
  if (remarks) inv.remarks = remarks
  inv.updatedAt = nowIso()
  inv.updatedBy = getSessionUser().name
  return structuredClone(inv)
}

export async function rejectPurchaseInvoice(
  id: string,
  remarks: string,
): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Rejection remarks are mandatory')
  }
  if (!['pending_approval', 'matched', 'mismatch', 'approved'].includes(inv.status)) {
    throw new PurchaseServiceError('INV_INVALID_STATUS', `Cannot reject from ${inv.status}`)
  }
  inv.status = 'draft'
  inv.remarks = remarks
  inv.verifiedAt = null
  inv.verifiedBy = null
  inv.updatedAt = nowIso()
  inv.updatedBy = getSessionUser().name
  return structuredClone(inv)
}

export async function holdPurchaseInvoice(id: string, reason: string): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  if (!reason.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Hold reason is required')
  }
  if (['posted', 'paid', 'cancelled'].includes(inv.status)) {
    throw new PurchaseServiceError('INV_INVALID_STATUS', `Cannot hold from ${inv.status}`)
  }
  inv.status = 'on_hold'
  inv.onHoldReason = reason
  inv.holdAt = nowIso()
  inv.updatedAt = nowIso()
  inv.updatedBy = getSessionUser().name
  return structuredClone(inv)
}

export async function approveInvoiceMatchingException(
  id: string,
  remarks?: string,
): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  const session = getSessionUser()
  if (
    session.role !== 'admin' &&
    session.role !== 'accounts_head' &&
    session.role !== 'purchase_head'
  ) {
    throw new PurchaseServiceError(
      'EXCEPTION_FORBIDDEN',
      'Only admin / accounts head / purchase head can approve matching exceptions',
    )
  }
  inv.matchingExceptionApproved = true
  inv.exceptionApprovedBy = session.name
  inv.exceptionApprovedAt = nowIso()
  if (remarks) inv.remarks = `${inv.remarks ? `${inv.remarks}\n` : ''}Exception: ${remarks}`
  inv.updatedAt = nowIso()
  inv.updatedBy = session.name
  return structuredClone(inv)
}

export async function postPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  await delay()
  const inv = requireInvoice(id)
  if (!['approved', 'matched', 'mismatch'].includes(inv.status)) {
    throw new PurchaseServiceError(
      'INV_INVALID_STATUS',
      'Invoice must be approved (or matched) before posting',
    )
  }

  const matching = computeMatchingForInvoice(inv)
  syncInvoiceMatchFields(inv, matching)

  if (matching.exceedsTolerance && !inv.matchingExceptionApproved) {
    throw new PurchaseServiceError(
      'MATCH_EXCEPTION_REQUIRED',
      `Posting blocked — ${matching.overallStatusLabel}. Approve matching exception first.`,
    )
  }
  if (matching.isDuplicateVendorInvoice && !inv.matchingExceptionApproved) {
    throw new PurchaseServiceError(
      'DUPLICATE_INVOICE',
      'Duplicate vendor invoice number detected — approve exception before posting',
    )
  }

  inv.status = 'posted'
  inv.postedAt = nowIso()
  inv.updatedAt = nowIso()
  inv.updatedBy = getSessionUser().name

  // Demo only — no GL / inventory / AP posting yet (same deferral pattern as GRN).
  return structuredClone(inv)
}

export async function createDebitNoteFromInvoice(
  id: string,
  reason?: string,
): Promise<{ invoice: PurchaseInvoice; debitNoteNumber: string; debitNoteId: string }> {
  await delay()
  const inv = requireInvoice(id)
  if (!['posted', 'approved', 'matched', 'mismatch', 'paid'].includes(inv.status)) {
    throw new PurchaseServiceError(
      'INV_INVALID_STATUS',
      'Debit note can be created from verified/posted invoices',
    )
  }
  if (inv.debitNoteId && inv.debitNoteNumber) {
    return {
      invoice: structuredClone(inv),
      debitNoteId: inv.debitNoteId,
      debitNoteNumber: inv.debitNoteNumber,
    }
  }

  const n = state.seq.dn++
  const debitNoteId = genId('prd-dn')
  const debitNoteNumber = docNo('DN', n)
  inv.debitNoteId = debitNoteId
  inv.debitNoteNumber = debitNoteNumber
  inv.remarks = `${inv.remarks ? `${inv.remarks}\n` : ''}Debit note ${debitNoteNumber}: ${reason ?? 'Price/qty variance'}`
  inv.updatedAt = nowIso()
  inv.updatedBy = getSessionUser().name

  return {
    invoice: structuredClone(inv),
    debitNoteId,
    debitNoteNumber,
  }
}


function defaultReturnReasonForOrigin(origin: PurchaseReturnOrigin): PurchaseReturnReason {
  switch (origin) {
    case 'grn_rejected_quantity':
    case 'quality_rejection':
    case 'post_receipt_inspection':
      return 'quality_rejection'
    case 'damaged_material':
      return 'damaged'
    case 'excess_receipt':
      return 'excess_quantity'
    case 'wrong_material':
      return 'wrong_item'
    case 'vendor_replacement':
      return 'other'
    default:
      return 'other'
  }
}

function grnLineBatch(line: GoodsReceiptNote['lines'][number]): string {
  return line.batchNumber || line.lotNumber || ''
}

function availableReturnQtyForGrnLine(
  grnId: string,
  grnLineId: string,
  excludeReturnId?: string,
): number {
  const grn = state.grns.find((g) => g.id === grnId)
  const line = grn?.lines.find((l) => l.id === grnLineId)
  if (!line) return 0
  const base = Math.max(line.rejectedQty, line.damagedQty, line.excessQty, 0)
  const alreadyReturned = state.returns
    .filter((r) => r.id !== excludeReturnId && r.goodsReceiptId === grnId && r.status !== 'cancelled')
    .flatMap((r) => r.lines)
    .filter((l) => l.goodsReceiptLineId === grnLineId)
    .reduce((s, l) => s + l.returnQty, 0)
  return Math.max(0, base - alreadyReturned)
}

function buildReturnLines(
  input: PurchaseReturnInput,
  vendor: Vendor,
  excludeReturnId?: string,
): PurchaseReturn['lines'] {
  return input.lines.map((row, index) => {
    const item = requireItem(row.itemId)
    const unitCost = Number(row.unitCost ?? row.rate ?? 0)
    const returnQty = Number(row.returnQty || 0)
    const gstRatePct = item.gstRatePct
    const taxableAmount = Number((returnQty * unitCost).toFixed(2))
    const tax = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
    const half = Number((tax / 2).toFixed(2))
    const lineTotal = Number((taxableAmount + tax).toFixed(2))
    const availableReturnQty =
      row.availableReturnQty ??
      (row.goodsReceiptLineId && input.goodsReceiptId
        ? availableReturnQtyForGrnLine(input.goodsReceiptId, row.goodsReceiptLineId, excludeReturnId)
        : returnQty)
    return {
      id: genId('prd-retl'),
      lineNo: index + 1,
      goodsReceiptLineId: row.goodsReceiptLineId ?? null,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: row.description || item.itemName,
      uom: item.uom,
      hsnCode: item.hsnCode,
      batchLotNo: row.batchLotNo ?? '',
      serialNumber: row.serialNumber ?? '',
      receivedQty: row.receivedQty ?? returnQty,
      availableReturnQty,
      returnQty,
      unitCost,
      gstRatePct,
      taxableAmount,
      cgst: vendor.isInterstate ? 0 : half,
      sgst: vendor.isInterstate ? 0 : half,
      igst: vendor.isInterstate ? tax : 0,
      returnAmount: lineTotal,
      lineTotal,
      reason: row.reason ?? input.returnReason,
      replacementQty: row.replacementQty ?? 0,
      remarks: row.remarks ?? '',
    }
  })
}

function toReturnListRow(doc: PurchaseReturn): PurchaseReturnListRow {
  return {
    id: doc.id,
    documentNumber: doc.documentNumber,
    documentDate: doc.documentDate,
    vendorName: doc.vendor.name,
    vendorCode: doc.vendor.code,
    purchaseOrderNumber: doc.purchaseOrderNumber,
    goodsReceiptNumber: doc.goodsReceiptNumber,
    purchaseInvoiceNumber: doc.purchaseInvoiceNumber,
    warehouseName: doc.warehouseName,
    origin: doc.origin,
    originLabel: PURCHASE_RETURN_ORIGIN_LABELS[doc.origin],
    returnReason: doc.returnReason,
    returnReasonLabel: PURCHASE_RETURN_REASON_LABELS[doc.returnReason],
    lineCount: doc.lines.length,
    totalReturnQty: doc.lines.reduce((s, l) => s + l.returnQty, 0),
    totalAmount: doc.totalAmount,
    status: doc.status,
    statusLabel: PURCHASE_RETURN_DOMAIN_STATUS_LABELS[doc.status],
    debitNoteRequired: doc.debitNoteRequired,
    replacementRequired: doc.replacementRequired,
    linkedReplacementPoNumber: doc.linkedReplacementPoNumber,
    linkedDebitNoteNumber: doc.linkedDebitNoteNumber,
  }
}

function requireReturn(id: string): PurchaseReturn {
  const doc = state.returns.find((r) => r.id === id)
  if (!doc) throw new PurchaseServiceError('RETURN_NOT_FOUND', `Purchase return not found: ${id}`)
  return doc
}

export async function createPurchaseReturn(
  input: PurchaseReturnInput,
): Promise<PurchaseReturn> {
  await delay()
  if (!input.lines?.length) {
    throw new PurchaseServiceError('RETURN_NO_LINES', 'Add at least one return line')
  }
  const vendor = requireVendor(input.vendorId)
  const origin = input.origin ?? 'grn_rejected_quantity'
  const lines = buildReturnLines(input, vendor)
  const taxable = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const totals = vendor.isInterstate ? computeInterTotals(taxable) : computeIntraTotals(taxable)
  const grn = input.goodsReceiptId
    ? state.grns.find((g) => g.id === input.goodsReceiptId)
    : null
  const po = input.purchaseOrderId
    ? state.orders.find((o) => o.id === input.purchaseOrderId)
    : grn
      ? state.orders.find((o) => o.id === grn.purchaseOrderId)
      : null
  const inv = input.purchaseInvoiceId
    ? state.invoices.find((i) => i.id === input.purchaseInvoiceId)
    : null
  const qi = input.qualityInspectionId
    ? state.qualityInspections.find((q) => q.id === input.qualityInspectionId)
    : null
  const warehouseId =
    input.warehouseId ??
    grn?.warehouseId ??
    (grn?.location.id ?? PURCHASE_DEMO_LOCATION.id)
  const warehouseName =
    input.warehouseName ??
    grn?.warehouseName ??
    (grn?.location.name ?? PURCHASE_DEMO_LOCATION.name)
  const n = state.seq.ret++
  const created: PurchaseReturn = {
    id: genId('prd-ret'),
    documentNumber: docNo('PRTN', n),
    documentDate: input.documentDate ?? todayDate(),
    status: 'draft',
    origin,
    location: grn?.location ?? po?.location ?? { ...PURCHASE_DEMO_LOCATION },
    warehouseId,
    warehouseName,
    department: origin === 'quality_rejection' || origin === 'post_receipt_inspection' ? 'Quality' : 'Stores',
    requester: partyFromActor(
      origin === 'quality_rejection' || origin === 'post_receipt_inspection'
        ? PURCHASE_DOMAIN_ACTORS.qc
        : PURCHASE_DOMAIN_ACTORS.stores,
    ),
    approver: null,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
    },
    paymentTerms: vendor.paymentTerms,
    deliveryTerms: vendor.deliveryTerms,
    expectedDeliveryDate: null,
    purchaseOrderId: po?.id ?? null,
    purchaseOrderNumber: po?.documentNumber ?? null,
    goodsReceiptId: grn?.id ?? null,
    goodsReceiptNumber: grn?.documentNumber ?? null,
    purchaseInvoiceId: inv?.id ?? null,
    purchaseInvoiceNumber: inv?.documentNumber ?? null,
    qualityInspectionId: qi?.id ?? null,
    qualityInspectionNumber: qi?.documentNumber ?? null,
    returnReason: input.returnReason,
    transportDetails: input.transportDetails ?? '',
    debitNoteRequired: input.debitNoteRequired ?? true,
    replacementRequired: input.replacementRequired ?? false,
    linkedReplacementPoId: null,
    linkedReplacementPoNumber: null,
    linkedDebitNoteId: null,
    linkedDebitNoteNumber: null,
    postedAt: null,
    ...totals,
    lines,
    createdBy: PURCHASE_DOMAIN_ACTORS.stores.name,
    createdAt: nowIso(),
    updatedBy: null,
    updatedAt: null,
    remarks: input.remarks ?? '',
    attachmentIds: [],
  }
  state.returns.unshift(created)
  return structuredClone(created)
}

export async function updatePurchaseReturn(
  id: string,
  input: PurchaseReturnInput,
): Promise<PurchaseReturn> {
  await delay()
  const idx = state.returns.findIndex((r) => r.id === id)
  if (idx < 0) throw new PurchaseServiceError('RETURN_NOT_FOUND', `Purchase return not found: ${id}`)
  const current = state.returns[idx]
  if (current.status !== 'draft' && current.status !== 'pending_approval') {
    throw new PurchaseServiceError(
      'RETURN_NOT_EDITABLE',
      `Cannot update return in status ${current.status}`,
    )
  }
  if (!input.lines?.length) {
    throw new PurchaseServiceError('RETURN_NO_LINES', 'Add at least one return line')
  }
  const vendor = requireVendor(input.vendorId)
  const lines = buildReturnLines(input, vendor, id)
  const taxable = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const totals = vendor.isInterstate ? computeInterTotals(taxable) : computeIntraTotals(taxable)
  const grn = input.goodsReceiptId
    ? state.grns.find((g) => g.id === input.goodsReceiptId)
    : current.goodsReceiptId
      ? state.grns.find((g) => g.id === current.goodsReceiptId)
      : null
  const po = input.purchaseOrderId
    ? state.orders.find((o) => o.id === input.purchaseOrderId)
    : current.purchaseOrderId
      ? state.orders.find((o) => o.id === current.purchaseOrderId)
      : grn
        ? state.orders.find((o) => o.id === grn.purchaseOrderId)
        : null
  const inv = input.purchaseInvoiceId
    ? state.invoices.find((i) => i.id === input.purchaseInvoiceId)
    : current.purchaseInvoiceId
      ? state.invoices.find((i) => i.id === current.purchaseInvoiceId)
      : null
  const qi = input.qualityInspectionId
    ? state.qualityInspections.find((q) => q.id === input.qualityInspectionId)
    : current.qualityInspectionId
      ? state.qualityInspections.find((q) => q.id === current.qualityInspectionId)
      : null
  const updated: PurchaseReturn = {
    ...current,
    origin: input.origin ?? current.origin,
    documentDate: input.documentDate ?? current.documentDate,
    location: grn?.location ?? po?.location ?? current.location,
    warehouseId:
      input.warehouseId ??
      grn?.warehouseId ??
      current.warehouseId,
    warehouseName:
      input.warehouseName ??
      grn?.warehouseName ??
      current.warehouseName,
    vendor: {
      id: vendor.id,
      code: vendor.vendorCode,
      name: vendor.vendorName,
      gstin: vendor.gstin,
    },
    paymentTerms: vendor.paymentTerms,
    deliveryTerms: vendor.deliveryTerms,
    purchaseOrderId: po?.id ?? null,
    purchaseOrderNumber: po?.documentNumber ?? null,
    goodsReceiptId: grn?.id ?? current.goodsReceiptId,
    goodsReceiptNumber: grn?.documentNumber ?? current.goodsReceiptNumber,
    purchaseInvoiceId: inv?.id ?? null,
    purchaseInvoiceNumber: inv?.documentNumber ?? null,
    qualityInspectionId: qi?.id ?? null,
    qualityInspectionNumber: qi?.documentNumber ?? null,
    returnReason: input.returnReason,
    transportDetails: input.transportDetails ?? current.transportDetails,
    debitNoteRequired: input.debitNoteRequired ?? current.debitNoteRequired,
    replacementRequired: input.replacementRequired ?? current.replacementRequired,
    ...totals,
    lines,
    updatedBy: PURCHASE_DOMAIN_ACTORS.stores.name,
    updatedAt: nowIso(),
    remarks: input.remarks ?? current.remarks,
  }
  state.returns[idx] = updated
  return structuredClone(updated)
}

export async function getPurchaseReturns(): Promise<PurchaseReturn[]> {
  await delay()
  return [...state.returns].sort((a, b) => b.documentDate.localeCompare(a.documentDate))
}

export async function getPurchaseReturnList(): Promise<PurchaseReturnListRow[]> {
  await delay()
  return [...state.returns]
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate))
    .map(toReturnListRow)
}

export async function getPurchaseReturnById(id: string): Promise<PurchaseReturn | null> {
  await delay()
  const doc = state.returns.find((r) => r.id === id)
  return doc ? structuredClone(doc) : null
}

export async function createPurchaseReturnFromGrn(
  grnId: string,
  options?: { origin?: PurchaseReturnOrigin; returnReason?: PurchaseReturnReason },
): Promise<PurchaseReturn> {
  await delay()
  const grn = state.grns.find((g) => g.id === grnId)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${grnId}`)
  const origin = options?.origin ?? 'grn_rejected_quantity'
  const returnReason = options?.returnReason ?? defaultReturnReasonForOrigin(origin)
  const candidateLines = grn.lines.filter(
    (l) => l.rejectedQty > 0 || l.damagedQty > 0 || l.excessQty > 0,
  )
  const lines = (candidateLines.length ? candidateLines : grn.lines).map((l) => {
    const available = availableReturnQtyForGrnLine(grn.id, l.id)
    const desired =
      origin === 'excess_receipt'
        ? l.excessQty
        : origin === 'damaged_material'
          ? l.damagedQty || l.rejectedQty
          : l.rejectedQty
    const qty = Math.min(Math.max(desired, 0), available)
    return {
      itemId: l.itemId,
      returnQty: qty,
      unitCost: l.rate,
      goodsReceiptLineId: l.id,
      description: l.description || l.itemName,
      batchLotNo: grnLineBatch(l),
      serialNumber: l.serialNumber || '',
      receivedQty: l.receivedQty,
      availableReturnQty: available,
      reason: returnReason,
      replacementQty: 0,
      remarks: l.remarks || '',
    }
  }).filter((l) => l.availableReturnQty > 0)
  if (!lines.length) {
    throw new PurchaseServiceError('RETURN_NO_QTY', 'No returnable quantity on this GRN')
  }
  const inv = state.invoices.find((i) => i.goodsReceiptId === grn.id)
  return createPurchaseReturn({
    vendorId: grn.vendor.id,
    origin,
    goodsReceiptId: grn.id,
    purchaseOrderId: grn.purchaseOrderId,
    purchaseInvoiceId: inv?.id ?? null,
    returnReason,
    warehouseId: grn.warehouseId || grn.location.id,
    warehouseName: grn.warehouseName || grn.location.name,
    transportDetails: [grn.transporterName, grn.vehicleNo].filter(Boolean).join(' · '),
    debitNoteRequired: true,
    replacementRequired: origin === 'vendor_replacement',
    remarks: `Created from ${grn.documentNumber}`,
    lines,
  })
}

export async function createPurchaseReturnFromQualityInspection(
  qualityInspectionId: string,
): Promise<PurchaseReturn> {
  await delay()
  const qi = state.qualityInspections.find((q) => q.id === qualityInspectionId)
  if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', `Quality inspection not found: ${qualityInspectionId}`)
  if (qi.rejectedQty <= 0) {
    throw new PurchaseServiceError('RETURN_NO_QTY', 'Quality inspection has no rejected quantity')
  }
  const grn = state.grns.find((g) => g.id === qi.goodsReceiptId)
  const grnLine = grn?.lines.find((l) => l.id === qi.goodsReceiptLineId)
  const available = grn
    ? availableReturnQtyForGrnLine(grn.id, qi.goodsReceiptLineId)
    : qi.rejectedQty
  if (available <= 0) {
    throw new PurchaseServiceError('RETURN_NO_QTY', 'No remaining returnable quantity for this QI')
  }
  const inv = grn ? state.invoices.find((i) => i.goodsReceiptId === grn.id) : null
  const returnQty = Math.min(qi.rejectedQty, available)
  return createPurchaseReturn({
    vendorId: qi.vendor.id,
    origin: 'quality_rejection',
    goodsReceiptId: qi.goodsReceiptId,
    purchaseOrderId: qi.purchaseOrderId,
    purchaseInvoiceId: inv?.id ?? null,
    qualityInspectionId: qi.id,
    returnReason: 'quality_rejection',
    warehouseId: grn?.warehouseId ?? qi.location.id,
    warehouseName: grn?.warehouseName ?? qi.location.name,
    debitNoteRequired: true,
    replacementRequired: false,
    remarks: `Created from ${qi.documentNumber}`,
    lines: [
      {
        itemId: qi.itemId,
        returnQty,
        unitCost: grnLine?.rate ?? 0,
        goodsReceiptLineId: qi.goodsReceiptLineId,
        description: qi.itemName,
        batchLotNo: qi.batchLotNo || (grnLine ? grnLineBatch(grnLine) : ''),
        serialNumber: grnLine?.serialNumber ?? '',
        receivedQty: qi.receivedQty,
        availableReturnQty: available,
        reason: 'quality_rejection',
        replacementQty: 0,
        remarks: qi.remarks || 'QC rejection',
      },
    ],
  })
}

export async function createPurchaseReturnFromReason(
  origin: PurchaseReturnOrigin,
  options: {
    vendorId: string
    goodsReceiptId?: string | null
    purchaseOrderId?: string | null
    returnReason?: PurchaseReturnReason
    lines?: PurchaseReturnInput['lines']
  },
): Promise<PurchaseReturn> {
  if (options.goodsReceiptId) {
    return createPurchaseReturnFromGrn(options.goodsReceiptId, {
      origin,
      returnReason: options.returnReason ?? defaultReturnReasonForOrigin(origin),
    })
  }
  if (!options.lines?.length) {
    throw new PurchaseServiceError(
      'RETURN_NO_LINES',
      'Provide GRN or lines when creating from reason preset',
    )
  }
  return createPurchaseReturn({
    vendorId: options.vendorId,
    origin,
    purchaseOrderId: options.purchaseOrderId ?? null,
    returnReason: options.returnReason ?? defaultReturnReasonForOrigin(origin),
    debitNoteRequired: true,
    replacementRequired: origin === 'vendor_replacement',
    lines: options.lines,
  })
}

export async function submitPurchaseReturn(id: string): Promise<PurchaseReturn> {
  await delay()
  const doc = requireReturn(id)
  if (doc.status !== 'draft') {
    throw new PurchaseServiceError('RETURN_INVALID_STATUS', `Cannot submit from ${doc.status}`)
  }
  if (!doc.lines.length || doc.lines.every((l) => l.returnQty <= 0)) {
    throw new PurchaseServiceError('RETURN_NO_QTY', 'Add return quantity before submit')
  }
  doc.status = 'pending_approval'
  doc.updatedAt = nowIso()
  doc.updatedBy = PURCHASE_DOMAIN_ACTORS.stores.name
  pushHistory('purchase_return', doc.id, doc.documentNumber, 'submitted', 'draft', doc.status, 'Submitted for approval', partyFromActor(PURCHASE_DOMAIN_ACTORS.stores))
  return structuredClone(doc)
}

export async function approvePurchaseReturn(
  id: string,
  remarks = '',
): Promise<PurchaseReturn> {
  await delay()
  const doc = requireReturn(id)
  if (doc.status !== 'pending_approval' && doc.status !== 'draft') {
    throw new PurchaseServiceError('RETURN_INVALID_STATUS', `Cannot approve from ${doc.status}`)
  }
  const from = doc.status
  doc.status = 'approved'
  doc.approver = partyFromActor(PURCHASE_DOMAIN_ACTORS.purchaseHead)
  doc.updatedAt = nowIso()
  doc.updatedBy = PURCHASE_DOMAIN_ACTORS.purchaseHead.name
  if (remarks) doc.remarks = remarks
  pushHistory(
    'purchase_return',
    doc.id,
    doc.documentNumber,
    'approved',
    from,
    doc.status,
    remarks || 'Approved',
    partyFromActor(PURCHASE_DOMAIN_ACTORS.purchaseHead),
  )
  return structuredClone(doc)
}

export async function postPurchaseReturn(id: string): Promise<PurchaseReturn> {
  await delay()
  const doc = requireReturn(id)
  if (doc.status !== 'approved') {
    throw new PurchaseServiceError('RETURN_INVALID_STATUS', `Cannot post from ${doc.status}`)
  }
  doc.status = 'posted'
  doc.postedAt = nowIso()
  doc.updatedAt = nowIso()
  doc.updatedBy = PURCHASE_DOMAIN_ACTORS.stores.name
  pushHistory(
    'purchase_return',
    doc.id,
    doc.documentNumber,
    'posted',
    'approved',
    'posted',
    'Return posted / challan ready',
    partyFromActor(PURCHASE_DOMAIN_ACTORS.stores),
  )
  return structuredClone(doc)
}

export async function cancelPurchaseReturn(
  id: string,
  remarks = 'Cancelled',
): Promise<PurchaseReturn> {
  await delay()
  const doc = requireReturn(id)
  if (doc.status === 'posted' || doc.status === 'closed' || doc.status === 'cancelled') {
    throw new PurchaseServiceError('RETURN_INVALID_STATUS', `Cannot cancel from ${doc.status}`)
  }
  const from = doc.status
  doc.status = 'cancelled'
  doc.updatedAt = nowIso()
  doc.updatedBy = PURCHASE_DOMAIN_ACTORS.stores.name
  doc.remarks = remarks
  pushHistory(
    'purchase_return',
    doc.id,
    doc.documentNumber,
    'cancelled',
    from,
    'cancelled',
    remarks,
    partyFromActor(PURCHASE_DOMAIN_ACTORS.stores),
  )
  return structuredClone(doc)
}

export async function createDebitNoteFromReturn(id: string): Promise<PurchaseReturn> {
  await delay()
  const doc = requireReturn(id)
  if (doc.status !== 'approved' && doc.status !== 'posted') {
    throw new PurchaseServiceError(
      'RETURN_INVALID_STATUS',
      'Approve or post the return before creating a debit note',
    )
  }
  if (doc.linkedDebitNoteId) {
    throw new PurchaseServiceError('DEBIT_NOTE_EXISTS', 'Debit note already linked to this return')
  }
  const n = state.seq.dn++
  doc.linkedDebitNoteId = genId('prd-dn')
  doc.linkedDebitNoteNumber = docNo('DN', n)
  doc.debitNoteRequired = true
  doc.updatedAt = nowIso()
  doc.updatedBy = PURCHASE_DOMAIN_ACTORS.accounts.name
  return structuredClone(doc)
}

export async function createReplacementPoFromReturn(id: string): Promise<PurchaseReturn> {
  await delay()
  const doc = requireReturn(id)
  if (doc.status !== 'approved' && doc.status !== 'posted') {
    throw new PurchaseServiceError(
      'RETURN_INVALID_STATUS',
      'Approve or post the return before creating a replacement PO',
    )
  }
  if (doc.linkedReplacementPoId) {
    throw new PurchaseServiceError('REPLACEMENT_PO_EXISTS', 'Replacement PO already linked')
  }
  const lines = doc.lines
    .filter((l) => (l.replacementQty || l.returnQty) > 0)
    .map((l) => ({
      itemId: l.itemId,
      quantity: l.replacementQty > 0 ? l.replacementQty : l.returnQty,
      rate: l.unitCost,
      remarks: `Replacement for ${doc.documentNumber}`,
    }))
  if (!lines.length) {
    throw new PurchaseServiceError('RETURN_NO_QTY', 'No replacement quantity on return lines')
  }
  const po = await createPurchaseOrder({
    vendorId: doc.vendor.id,
    origin: 'manual',
    paymentTerms: doc.paymentTerms,
    deliveryTerms: doc.deliveryTerms,
    remarks: `Replacement PO for return ${doc.documentNumber}`,
    lines,
  })
  doc.linkedReplacementPoId = po.id
  doc.linkedReplacementPoNumber = po.documentNumber
  doc.replacementRequired = true
  doc.updatedAt = nowIso()
  doc.updatedBy = PURCHASE_DOMAIN_ACTORS.buyer.name
  return structuredClone(doc)
}

export async function getApprovals(status?: PurchaseApproval['status']): Promise<PurchaseApproval[]> {
  await delay()
  return status ? state.approvals.filter((a) => a.status === status) : [...state.approvals]
}

export async function getApprovalHistory(documentId?: string) {
  await delay()
  return documentId
    ? state.approvalHistory.filter((h) => h.documentId === documentId)
    : [...state.approvalHistory]
}

export async function getAttachments(entityId?: string) {
  await delay()
  return entityId
    ? state.attachments.filter((a) => a.entityId === entityId)
    : [...state.attachments]
}

export async function getPurchaseSetup(): Promise<PurchaseSetup> {
  await delay()
  if (!state.setup.requisition) {
    state.setup.requisition = structuredClone(DEFAULT_PURCHASE_SETUP.requisition)
  }
  return structuredClone(state.setup)
}

export async function updatePurchaseSetup(
  patch: Partial<Omit<PurchaseSetup, 'updatedAt' | 'updatedBy'>>,
): Promise<PurchaseSetup> {
  await delay()
  if (patch.approvalMatrix) {
    const sorted = [...patch.approvalMatrix].sort((a, b) => a.sortOrder - b.sortOrder)
    for (const tier of sorted) {
      if (!tier.requiredRoles.length) {
        throw new PurchaseServiceError('SETUP_INVALID', 'Each matrix tier needs at least one role')
      }
      if (tier.minAmount < 0) {
        throw new PurchaseServiceError('SETUP_INVALID', 'Min amount cannot be negative')
      }
      if (tier.maxAmount != null && tier.maxAmount < tier.minAmount) {
        throw new PurchaseServiceError('SETUP_INVALID', 'Max amount must be ≥ min amount')
      }
    }
    state.setup.approvalMatrix = structuredClone(sorted)
  }
  if (patch.availableBudgetPlaceholderInr != null) {
    state.setup.availableBudgetPlaceholderInr = Math.max(0, patch.availableBudgetPlaceholderInr)
  }
  if (patch.allowDirectInvoice != null) {
    state.setup.allowDirectInvoice = Boolean(patch.allowDirectInvoice)
  }
  if (patch.general) {
    state.setup.general = { ...state.setup.general, ...structuredClone(patch.general) }
  }
  if (patch.numberSeries) {
    const next = { ...state.setup.numberSeries }
    for (const key of Object.keys(patch.numberSeries) as (keyof typeof next)[]) {
      const entry = patch.numberSeries[key]
      if (entry) next[key] = { ...state.setup.numberSeries[key], ...entry }
    }
    state.setup.numberSeries = next
  }
  if (patch.tax) {
    state.setup.tax = { ...state.setup.tax, ...structuredClone(patch.tax) }
  }
  if (patch.invoiceMatchTolerances) {
    state.setup.invoiceMatchTolerances = {
      ...state.setup.invoiceMatchTolerances,
      ...structuredClone(patch.invoiceMatchTolerances),
    }
  }
  if (patch.receiving) {
    state.setup.receiving = { ...state.setup.receiving, ...structuredClone(patch.receiving) }
  }
  if (patch.quality) {
    state.setup.quality = { ...state.setup.quality, ...structuredClone(patch.quality) }
  }
  if (patch.requisition) {
    state.setup.requisition = {
      ...(state.setup.requisition ?? DEFAULT_PURCHASE_SETUP.requisition),
      ...structuredClone(patch.requisition),
    }
  }
  if (patch.print) {
    state.setup.print = { ...state.setup.print, ...structuredClone(patch.print) }
  }
  if (patch.notifications) {
    const next = { ...state.setup.notifications }
    for (const key of Object.keys(patch.notifications) as (keyof typeof next)[]) {
      const flags = patch.notifications[key]
      if (flags) next[key] = { ...state.setup.notifications[key], ...flags }
    }
    state.setup.notifications = next
  }
  state.setup.updatedAt = nowIso()
  state.setup.updatedBy = getSessionUser().name
  return structuredClone(state.setup)
}

function daysBetween(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso)
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

function approvalMatchesAgeing(days: number, ageing: PurchaseApprovalQueueFilters['ageing']): boolean {
  if (!ageing) return true
  if (ageing === '0_3') return days <= 3
  if (ageing === '4_7') return days >= 4 && days <= 7
  if (ageing === '8_15') return days >= 8 && days <= 15
  if (ageing === '16_plus') return days >= 16
  return true
}

function toQueueRow(approval: PurchaseApproval, sessionRoles: PurchaseApprovalRole[]): PurchaseApprovalQueueRow | null {
  const docType = approval.documentType
  if (docType !== 'purchase_requisition' && docType !== 'purchase_order') return null

  let documentDate = ''
  let department = ''
  let locationId = ''
  let locationName = ''
  let amount = 0
  let priority: PurchaseRequisition['priority'] = 'normal'
  let requesterId = approval.requesterId
  let requestedBy = approval.requesterName

  if (docType === 'purchase_requisition') {
    const pr = state.requisitions.find((r) => r.id === approval.documentId)
    if (!pr) return null
    documentDate = pr.documentDate
    department = pr.department
    locationId = pr.location.id
    locationName = pr.location.name
    amount = pr.totalAmount
    priority = pr.priority
    requesterId = pr.requester.id
    requestedBy = pr.requester.name
  } else {
    const po = state.orders.find((r) => r.id === approval.documentId)
    if (!po) return null
    documentDate = po.documentDate
    department = po.department
    locationId = po.location.id
    locationName = po.location.name
    amount = po.totalAmount
    requesterId = po.requester.id
    requestedBy = po.requester.name
  }

  const chain = resolveApprovalRolesForAmount(amount, state.setup)
  const pendingSinceDays = daysBetween(approval.requestedAt)
  const canAct =
    approval.status === 'pending' &&
    sessionCanActAsApprover(approval.approverRole, approval.approverId)

  return {
    approvalId: approval.id,
    documentType: docType,
    documentTypeLabel: PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS[docType],
    documentId: approval.documentId,
    documentNumber: approval.documentNumber,
    documentDate,
    requestedBy,
    requesterId,
    department,
    locationId,
    locationName,
    amount,
    priority,
    priorityLabel: PURCHASE_REQUISITION_PRIORITY_LABELS[priority],
    submittedDate: approval.requestedAt,
    pendingSinceDays,
    approvalLevel: approval.level,
    approvalLevelLabel: `${approval.level} of ${Math.max(chain.length, approval.level)} · ${PURCHASE_APPROVAL_ROLE_LABELS[approval.approverRole]}`,
    chainLength: Math.max(chain.length, approval.level),
    status: approval.status,
    statusLabel: PURCHASE_APPROVAL_STATUS_LABELS[approval.status],
    approverId: approval.approverId,
    approverName: approval.approverName,
    approverRole: approval.approverRole,
    approverRoleLabel: PURCHASE_APPROVAL_ROLE_LABELS[approval.approverRole],
    canAct: canAct && sessionRoles.includes(approval.approverRole),
  }
}

function applyQueueFilters(
  rows: PurchaseApprovalQueueRow[],
  filters: PurchaseApprovalQueueFilters = {},
): PurchaseApprovalQueueRow[] {
  return rows.filter((r) => {
    if (filters.documentType && r.documentType !== filters.documentType) return false
    if (
      filters.documentNumber &&
      !r.documentNumber.toLowerCase().includes(filters.documentNumber.trim().toLowerCase())
    ) {
      return false
    }
    if (
      filters.requester &&
      !r.requestedBy.toLowerCase().includes(filters.requester.trim().toLowerCase())
    ) {
      return false
    }
    if (
      filters.department &&
      !r.department.toLowerCase().includes(filters.department.trim().toLowerCase())
    ) {
      return false
    }
    if (filters.locationId && r.locationId !== filters.locationId) return false
    if (filters.amountMin != null && r.amount < filters.amountMin) return false
    if (filters.amountMax != null && r.amount > filters.amountMax) return false
    if (filters.submittedFrom && r.submittedDate.slice(0, 10) < filters.submittedFrom) return false
    if (filters.submittedTo && r.submittedDate.slice(0, 10) > filters.submittedTo) return false
    if (filters.priority && r.priority !== filters.priority) return false
    if (!approvalMatchesAgeing(r.pendingSinceDays, filters.ageing)) return false
    return true
  })
}

export async function getPurchaseApprovalQueue(
  tab: PurchaseApprovalQueueTab = 'pending_mine',
  filters: PurchaseApprovalQueueFilters = {},
): Promise<PurchaseApprovalQueueRow[]> {
  await delay()
  const session = getSessionUser()
  const roles = sessionApprovalRoles(session)
  const actorIds = roles.map((r) => actorForApprovalRole(r).id)

  let source = state.approvals
  if (tab === 'pending_mine') {
    source = state.approvals.filter(
      (a) =>
        a.status === 'pending' &&
        (roles.includes(a.approverRole) ||
          session.role === 'admin' ||
          session.role === 'ceo' ||
          session.role === 'director' ||
          session.role === 'management'),
    )
  } else if (tab === 'approved_by_me') {
    source = state.approvals.filter(
      (a) => a.status === 'approved' && actorIds.includes(a.approverId),
    )
  } else if (tab === 'rejected_by_me') {
    source = state.approvals.filter(
      (a) => a.status === 'rejected' && actorIds.includes(a.approverId),
    )
  }

  const rows = source
    .map((a) => toQueueRow(a, roles))
    .filter((r): r is PurchaseApprovalQueueRow => Boolean(r))
    .sort((a, b) => b.submittedDate.localeCompare(a.submittedDate))

  return applyQueueFilters(rows, filters)
}

export async function getPurchaseApprovalReview(
  approvalId: string,
): Promise<PurchaseApprovalReviewDetail> {
  await delay()
  const approval = state.approvals.find((a) => a.id === approvalId)
  if (!approval) throw new PurchaseServiceError('APPROVAL_NOT_FOUND', `Approval not found: ${approvalId}`)
  const row = toQueueRow(approval, sessionApprovalRoles())
  if (!row) throw new PurchaseServiceError('APPROVAL_NOT_FOUND', `Approval document missing for ${approvalId}`)

  const previousApprovals = state.approvalHistory
    .filter((h) => h.documentId === approval.documentId)
    .sort((a, b) => a.actedAt.localeCompare(b.actedAt))

  const attachments = state.attachments.filter((a) => a.entityId === approval.documentId)
  const chainRoles = resolveApprovalRolesForAmount(row.amount, state.setup)

  if (approval.documentType === 'purchase_requisition') {
    const pr = state.requisitions.find((r) => r.id === approval.documentId)!
    return {
      row,
      purpose: pr.purpose ?? '',
      requesterRemarks: pr.remarks,
      expectedDeliveryDate: pr.expectedDeliveryDate,
      lines: pr.lines.map((l) => ({
        lineNo: l.lineNo,
        itemCode: l.itemCode,
        itemName: l.itemName,
        quantity: l.quantity,
        uom: l.uom,
        rate: l.estimatedRate,
        amount: l.amount,
      })),
      availableBudgetPlaceholderInr: state.setup.availableBudgetPlaceholderInr,
      previousApprovals: structuredClone(previousApprovals),
      attachments: structuredClone(attachments),
      chainRoles,
    }
  }

  const po = state.orders.find((r) => r.id === approval.documentId)!
  return {
    row,
    purpose: '',
    requesterRemarks: po.remarks,
    expectedDeliveryDate: po.expectedDeliveryDate,
    lines: po.lines.map((l) => ({
      lineNo: l.lineNo,
      itemCode: l.itemCode,
      itemName: l.itemName,
      quantity: l.quantity,
      uom: l.uom,
      rate: l.rate,
      amount: l.lineTotal,
    })),
    availableBudgetPlaceholderInr: state.setup.availableBudgetPlaceholderInr,
    previousApprovals: structuredClone(previousApprovals),
    attachments: structuredClone(attachments),
    chainRoles,
  }
}

export async function approvePurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks = 'Approved',
): Promise<PurchaseRequisition | PurchaseOrder> {
  await delay()
  return advanceDocumentApproval(documentType, documentId, 'approve', remarks)
}

export async function rejectPurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder> {
  await delay()
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Rejection comments are mandatory')
  }
  return advanceDocumentApproval(documentType, documentId, 'reject', remarks)
}

export async function sendBackPurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder> {
  await delay()
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Send-back comments are mandatory')
  }
  return advanceDocumentApproval(documentType, documentId, 'send_back', remarks)
}

export async function delegatePurchaseApproval(
  approvalId: string,
  toRole: PurchaseApprovalRole,
  remarks = '',
): Promise<PurchaseApproval> {
  await delay()
  const approval = state.approvals.find((a) => a.id === approvalId)
  if (!approval) throw new PurchaseServiceError('APPROVAL_NOT_FOUND', `Approval not found: ${approvalId}`)
  if (approval.status !== 'pending') {
    throw new PurchaseServiceError('NOT_PENDING', 'Only pending approvals can be delegated')
  }
  if (!sessionCanActAsApprover(approval.approverRole, approval.approverId)) {
    throw new PurchaseServiceError('NOT_APPROVER', 'You cannot delegate this approval')
  }
  const fromActor = actorForApprovalRole(approval.approverRole)
  const toActor = actorForApprovalRole(toRole)
  approval.delegatedFromId = fromActor.id
  approval.delegatedFromName = fromActor.name
  approval.approverRole = toRole
  approval.approverId = toActor.id
  approval.approverName = toActor.name
  approval.remarks = remarks || approval.remarks
  pushHistory(
    approval.documentType,
    approval.documentId,
    approval.documentNumber,
    'submitted',
    'pending_approval',
    'pending_approval',
    remarks || `Delegated to ${PURCHASE_APPROVAL_ROLE_LABELS[toRole]}`,
    fromActor,
  )
  return structuredClone(approval)
}

/** Empty money helper for new draft UI forms. */
export { emptyMoney }
