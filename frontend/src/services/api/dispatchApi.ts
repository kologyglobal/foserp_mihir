/**
 * Dispatch Phase 7C0–7C5 API client — outbound FG dispatch, requirements workbench,
 * reservations, pick lists, packing, delivery challans, hardened post/reverse.
 * Base: /api/v1/t/:tenantSlug/dispatch/... and CRM sales-order fulfilment routes.
 */
import { API_CONFIG } from '../../config/apiConfig'
import { apiDownloadBlob, apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const DISPATCH = '/dispatch'
const OUTBOUND = `${DISPATCH}/outbound`
const CRM_SO = '/crm/sales-orders'

export interface PaginatedList<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

async function fetchData<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, init)
  return res.data
}

async function fetchPaginated<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<PaginatedList<T>> {
  const res = await apiRequest<T[]>(`${path}${buildQuery(params)}`)
  const meta = res.meta ?? {
    page: Number(params?.page ?? 1),
    limit: Number(params?.limit ?? 20),
    total: res.data.length,
    totalPages: 1,
  }
  return {
    items: res.data,
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages,
  }
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export type OutboundDispatchStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED'

export type DispatchPodStatus =
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERY_EXCEPTION'
  | 'REJECTED_BY_CUSTOMER'
  | 'RETURN_INITIATED'

export type DispatchReadinessStatus =
  | 'NOT_READY'
  | 'WAITING_FOR_PRODUCTION'
  | 'WAITING_FOR_QUALITY'
  | 'WAITING_FOR_STOCK'
  | 'PARTIALLY_READY'
  | 'READY_TO_DISPATCH'
  | 'ALREADY_IN_DRAFT_DISPATCH'
  | 'ON_HOLD'
  | 'BLOCKED'
  | 'FULLY_FULFILLED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED'

export type DispatchRequirementStatus =
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED'

export interface DispatchRequirementListItem {
  id: string
  requirementNumber: string
  salesOrderId: string
  salesOrderNo: string
  salesOrderLineId: string
  lineNo: number
  customerId: string
  customerName: string | null
  shipToKey: string | null
  shipToAddress: string | null
  itemId: string | null
  itemCode: string | null
  itemName: string | null
  productOrItem: string
  orderedQty: number
  cancelledQty: number
  netDispatchedQty: number
  remainingQty: number
  unrestrictedFgOnHand: number
  qualityHoldQty: number
  readyQty: number
  shortageQty: number
  requestedDeliveryDate: string | null
  overdueDays: number | null
  readinessStatus: DispatchReadinessStatus
  status: DispatchRequirementStatus
  primaryBlockerCode: string | null
  currentDraftDispatchQuantity: number
  priority: string
  allowedActions: string[]
  sourceFingerprint: string
  lastCalculatedAt: string | null
}

export interface DispatchWorkbenchSummary {
  readyToDispatch: number
  waitingForProduction: number
  waitingForQuality: number
  waitingForStock: number
  overdue: number
  blocked: number
  draftDispatches: number
  allActiveRequirements: number
  activeReservations?: number
  openPickLists?: number
  inProgressPickLists?: number
  openShortages?: number
  readyToPack?: number
  packingInProgress?: number
  packedSessions?: number
  packingShortages?: number
  readyForChallan?: number
  challanDrafts?: number
  challanInReview?: number
  challansIssued?: number
  readyForDispatch?: number
  challanBlocked?: number
}

export interface OutboundDispatchLine {
  id: string
  lineNo: number
  itemId: string
  warehouseId: string
  quantity: number
  salesOrderId: string | null
  salesOrderLineId: string | null
  dispatchRequirementId: string | null
  readyQuantitySnapshot: number | null
  inventoryMovementId: string | null
  inventoryMovementNo: string | null
  remarks: string | null
}

export interface OutboundDispatch {
  id: string
  dispatchNo: string
  status: OutboundDispatchStatus
  deliveryStatus?: DispatchPodStatus | null
  salesOrderId: string | null
  salesOrderNo: string | null
  customerId: string | null
  shipToKey: string | null
  shipToAddress: string | null
  plannedDispatchDate: string | null
  preferredWarehouseId: string | null
  planningSource: string
  planBeforeStockAllowed: boolean
  remarks: string | null
  confirmedAt: string | null
  confirmedBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  idempotencyKey: string | null
  createdAt: string
  updatedAt: string
  lines: OutboundDispatchLine[]
}

export interface SalesOrderLineFulfilment {
  salesOrderLineId: string
  lineNo: number
  productId: string | null
  productOrItem: string
  orderedQty: number
  cancelledQty: number
  netOrderedQty: number
  dispatchedQty: number
  remainingQty: number
  uom: string
}

export interface SalesOrderFulfilment {
  salesOrderId: string
  salesOrderNo: string
  status: string
  lines: SalesOrderLineFulfilment[]
  totals: {
    orderedQty: number
    cancelledQty: number
    netOrderedQty: number
    dispatchedQty: number
    remainingQty: number
  }
}

export interface SalesOrderDispatchHistoryItem {
  id: string
  dispatchNo: string
  status: OutboundDispatchStatus
  planningSource: string | null
  plannedDispatchDate: string | null
  confirmedAt: string | null
  createdAt: string
  lineCount: number
  totalQty: number
}

export interface SalesOrderDispatchHistory {
  salesOrderId: string
  items: SalesOrderDispatchHistoryItem[]
}

export interface SalesOrderFulfilmentSummary {
  salesOrderId: string
  lines: unknown[]
  totals: Record<string, number>
  deliveryChallans?: Array<{
    id: string
    challanNumber: string | null
    status: string
    versionNumber: number
    totalQuantity: number
    documentDate: string
  }>
  notes?: { challanVsDispatch?: string }
  invoiceReadiness?: { ready: boolean; note: string } | null
}

export interface WorkbenchReservationRow {
  id: string
  reservationNumber: string
  outboundDispatchId: string
  itemCode: string
  warehouseCode: string
  netReservedQty: number
}

export interface WorkbenchPickListRow {
  id: string
  pickListNumber: string
  outboundDispatchId: string
  status: string
  lineCount: number
}

export interface WorkbenchShortageRow {
  pickLineId: string
  pickListNumber: string
  outboundDispatchId: string
  itemCode: string
  shortageQty: number
  reason: string | null
}

export interface WorkbenchPackingSessionRow {
  id: string
  packingSessionNumber: string
  outboundDispatchId: string
  status?: string
  totalPickedQuantity?: number
  totalPackedQuantity?: number
  totalShortageQuantity?: number
}

export interface ReservationPreviewLine {
  outboundDispatchLineId: string
  itemId?: string
  warehouseId?: string
  requestedQty: number
  alreadyReservedQty?: number
  remainingLineQty?: number
  warehouseFreeQty?: number
  fgAvailableQty?: number
  allowedQty: number
  ok: boolean
  message?: string
}

export interface DispatchReservationLine {
  outboundDispatchLineId: string
  lineNo: number
  itemId: string
  warehouseId: string
  dispatchQty: number
  netReservedQty: number
  unreservedQty: number
  reservations?: unknown[]
}

export interface DispatchReservationPosition {
  outboundDispatchId: string
  dispatchNo: string
  status: OutboundDispatchStatus
  lines: DispatchReservationLine[]
}

export type DispatchPickLineStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_PICKED'
  | 'PICKED'
  | 'SHORT'

export interface DispatchPickLine {
  id: string
  outboundDispatchLineId: string
  itemId: string
  warehouseId: string
  requestedQuantity: number
  reservedQuantity: number
  pickedQuantity: number
  shortageQuantity: number
  status: DispatchPickLineStatus
}

export interface DispatchPickList {
  id: string
  pickListNumber: string
  outboundDispatchId: string
  warehouseId: string
  assignedTo: string | null
  plannedPickDate: string | null
  priority: string
  status: string
  releasedAt: string | null
  startedAt: string | null
  completedAt: string | null
  remarks: string | null
  lines?: DispatchPickLine[]
  lineCount?: number
}

export interface DispatchPackingSession {
  id: string
  packingSessionNumber: string
  outboundDispatchId: string
  warehouseId: string
  status: string
  assignedTo: string | null
  packingStation: string | null
  plannedPackingDate: string | null
  startedAt: string | null
  completedAt: string | null
  verifiedAt: string | null
  totalPickedQuantity: number
  totalPackedQuantity: number
  totalUnpackedQuantity: number
  totalShortageQuantity: number
  totalPackages: number
  remarks: string | null
  packages?: Array<{ id: string; packageNumber: string; status: string; packageSequence: number }>
}

export interface DispatchPackageLine {
  id: string
  pickLineId: string
  packedQuantity: number
  status: string
}

export interface DispatchPackage {
  id: string
  packageNumber: string
  packingSessionId: string
  status: string
  packageReference: string | null
  packageSequence: number
  lines?: DispatchPackageLine[]
}

export interface DispatchSessionReconciliation {
  packingSessionId: string
  packingSessionNumber: string
  status: string
  totalPickedQuantity: number
  totalPackedQuantity: number
  totalUnpackedQuantity: number
  totalShortageQuantity: number
  packages: Array<{ id: string; packageNumber: string; status: string; lineCount: number }>
  eventCount: number
}

export interface DispatchPackingReconciliation {
  outboundDispatchId: string
  dispatchNo: string
  status: OutboundDispatchStatus
  lines: Array<{
    outboundDispatchLineId: string
    lineNo: number
    dispatchQty: number
    netPickedQty: number
    netPackedQty: number
    packableQty: number
    fgDispatchMovementCount: number
    reconciled: boolean
    warnings: string[]
  }>
  invariantNotes: string[]
}

export interface DispatchPickingPosition {
  outboundDispatchId: string
  pickLists: DispatchPickList[]
}

export interface DispatchPickingReconciliation {
  outboundDispatchId: string
  dispatchNo: string
  status: OutboundDispatchStatus
  lines: Array<{
    outboundDispatchLineId: string
    lineNo: number
    dispatchQty: number
    netReservedQty: number
    netPickedQty: number
    shortageQty: number
    fgDispatchMovementCount: number
    reconciled: boolean
    warnings: string[]
  }>
  invariantNotes: string[]
}

export interface DispatchPackingPosition {
  outboundDispatchId: string
  packingSessions: DispatchPackingSession[]
}

export interface DeliveryChallanRow {
  id: string
  challanNumber: string | null
  status: string
  versionNumber: number
  outboundDispatchId: string
  packingSessionId: string
  customerId: string | null
  shipToKey: string | null
  sourceWarehouseId: string | null
  documentDate: string
  movementDate: string | null
  movementReason: string | null
  transportMode: string | null
  transporterName: string | null
  transporterDocumentRef: string | null
  vehicleNumber: string | null
  driverName: string | null
  driverPhone: string | null
  lrGrNumber: string | null
  lrGrDate: string | null
  eWayBillReference: string | null
  eWayBillDate: string | null
  destination: string | null
  totalPackages: number
  totalQuantity: number
  grossWeight: number | null
  netWeight: number | null
  remarks: string | null
  termsText: string | null
  sourceVersion: number | null
  sourceFingerprint: string | null
  documentGenStatus: string | null
  issuedAt: string | null
  issuedBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  outboundDispatch?: { dispatchNo: string; status: string; salesOrderNo: string | null }
  packingSession?: { packingSessionNumber: string; status: string }
  note?: string
  allowedActions?: string[]
}

// ─── Phase 7C0 — Outbound dispatch + SO fulfilment ────────────────────────────

export async function listOutboundDispatches(params?: {
  page?: number
  limit?: number
  status?: OutboundDispatchStatus
  salesOrderId?: string
  search?: string
}) {
  return fetchPaginated<OutboundDispatch>(`${tenantPath(OUTBOUND)}`, params)
}

export async function getOutboundDispatch(id: string) {
  return fetchData<OutboundDispatch>(tenantPath(`${OUTBOUND}/${id}`))
}

export interface DispatchPodDto {
  id: string
  outboundDispatchId: string
  dispatchNo: string | null
  outboundStatus: string | null
  deliveryChallanId: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  customerId: string | null
  status: DispatchPodStatus
  deliveryAddress: string | null
  deliveredAt: string | null
  receiverName: string | null
  receiverContact: string | null
  hasSignature: boolean
  quantityDelivered: number
  quantityDamaged: number
  quantityShort: number
  deliveryRemarks: string | null
  transporterRemarks: string | null
  exceptionCode: string | null
  exceptionNotes: string | null
  gpsLatitude: number | null
  gpsLongitude: number | null
  inTransitAt: string | null
  capturedAt: string | null
  lines: Array<{
    id: string
    outboundDispatchLineId: string
    itemId: string
    dispatchedQty: number
    deliveredQty: number
    damagedQty: number
    shortQty: number
    remarks: string | null
  }>
  attachments: Array<{
    id: string
    kind: string
    fileName: string
    mimeType: string
    byteSize: number
    createdAt: string
  }>
}

export async function getOutboundPod(outboundId: string) {
  return fetchData<{
    pod: DispatchPodDto | null
    outbound: {
      id: string
      dispatchNo: string | null
      status: string | null
      deliveryStatus: DispatchPodStatus | null
      salesOrderId: string | null
      salesOrderNo: string | null
      customerId: string | null
      shipToAddress: string | null
    }
    stockNote: string
  }>(tenantPath(`${OUTBOUND}/${outboundId}/pod`))
}

export async function markOutboundPodInTransit(outboundId: string) {
  return fetchData<DispatchPodDto>(tenantPath(`${OUTBOUND}/${outboundId}/pod/in-transit`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function captureOutboundPod(
  outboundId: string,
  body: {
    status?: DispatchPodStatus
    deliveredAt?: string
    receiverName?: string
    receiverContact?: string
    deliveryAddress?: string
    quantityDelivered?: number
    quantityDamaged?: number
    quantityShort?: number
    deliveryRemarks?: string
    transporterRemarks?: string
    lines?: Array<{
      outboundDispatchLineId: string
      deliveredQty: number
      damagedQty?: number
      shortQty?: number
    }>
  },
) {
  return fetchData<DispatchPodDto>(tenantPath(`${OUTBOUND}/${outboundId}/pod/capture`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function addOutboundPodAttachment(
  outboundId: string,
  body: { kind: string; fileName: string; mimeType: string; contentBase64: string },
) {
  return fetchData<{ id: string; kind: string; fileName: string }>(
    tenantPath(`${OUTBOUND}/${outboundId}/pod/attachments`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function confirmOutboundDispatch(id: string, body?: { idempotencyKey?: string }) {
  return fetchData<OutboundDispatch>(tenantPath(`${OUTBOUND}/${id}/confirm`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function cancelOutboundDispatch(id: string, reason?: string) {
  return fetchData<OutboundDispatch>(tenantPath(`${OUTBOUND}/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/** Phase 7C5 hardened post — requires ISSUED Delivery Challan on workbench path (unless emergency). */
export async function postOutboundDispatch(
  id: string,
  body?: {
    idempotencyKey?: string
    emergency?: boolean
    overrideReason?: string
    emergencyOverride?: {
      businessReason: string
      urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      riskAcknowledged: boolean
      approvedByName?: string
      approvalReference?: string
      expiresAt?: string
      scope?: string
      remarks?: string
      overrideId?: string
    }
  },
) {
  return fetchData<OutboundDispatch>(tenantPath(`${OUTBOUND}/${id}/post`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

/** Phase 7C5 — backend posting readiness checklist. */
export async function getOutboundPostingReadiness(id: string, mode: 'post' | 'confirm' = 'post') {
  return fetchData<Record<string, unknown>>(
    `${tenantPath(`${OUTBOUND}/${id}/posting-readiness`)}${buildQuery({ mode })}`,
  )
}

/** Phase 7C5 — reverse dependency preflight (invoice / COGS blockers). */
export type DispatchReversalDependency = {
  code: string
  module: string
  message: string
  documentId?: string
}

export async function getOutboundReversalDependencies(id: string) {
  return fetchData<{ dependencies: DispatchReversalDependency[] }>(
    tenantPath(`${DISPATCH}/outbound/${id}/reversal-dependencies`),
  )
}

/** Phase 7C5 reverse — partial lines + approval workflow; may return awaitingApproval. */
export type DispatchReversalResult = {
  awaitingApproval: boolean
  reversal: {
    id: string
    reversalNumber: string
    status: string
    lines: Array<{ id: string; quantity: number; originalPostingLineId: string }>
  }
  outbound?: OutboundDispatch | null
}

export async function reverseOutboundDispatch(
  id: string,
  body?: {
    reason?: string
    reasonCode?: string
    force?: boolean
    skipApproval?: boolean
    applyImmediately?: boolean
    requestOnly?: boolean
    idempotencyKey?: string
    lines?: Array<{ outboundDispatchLineId?: string; postingLineId?: string; quantity: number }>
  },
) {
  return fetchData<DispatchReversalResult>(tenantPath(`${OUTBOUND}/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function listOutboundReversals(outboundId: string) {
  return fetchData<DispatchReversalResult['reversal'][]>(
    tenantPath(`${DISPATCH}/outbound/${outboundId}/reversals`),
  )
}

export async function createOutboundReversal(
  outboundId: string,
  body?: {
    reason?: string
    reasonCode?: string
    lines?: Array<{ outboundDispatchLineId?: string; postingLineId?: string; quantity: number }>
    idempotencyKey?: string
  },
) {
  return fetchData<DispatchReversalResult['reversal']>(
    tenantPath(`${DISPATCH}/outbound/${outboundId}/reversals`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function submitDispatchReversal(reversalId: string) {
  return fetchData<DispatchReversalResult['reversal']>(
    tenantPath(`${DISPATCH}/reversals/${reversalId}/submit`),
    { method: 'POST', body: '{}' },
  )
}

export async function approveDispatchReversal(reversalId: string) {
  return fetchData<DispatchReversalResult['reversal']>(
    tenantPath(`${DISPATCH}/reversals/${reversalId}/approve`),
    { method: 'POST', body: '{}' },
  )
}

export async function applyDispatchReversal(reversalId: string) {
  return fetchData<DispatchReversalResult['reversal']>(
    tenantPath(`${DISPATCH}/reversals/${reversalId}/apply`),
    { method: 'POST', body: '{}' },
  )
}

export async function getSalesOrderFulfilment(salesOrderId: string) {
  return fetchData<SalesOrderFulfilment>(tenantPath(`${CRM_SO}/${salesOrderId}/fulfilment`))
}

// ─── Phase 7C1 — Requirements workbench ───────────────────────────────────────

export async function getDispatchWorkbenchSummary(refresh = false) {
  return fetchData<DispatchWorkbenchSummary>(
    `${tenantPath(`${DISPATCH}/workbench/summary`)}${buildQuery({ refresh: refresh || undefined })}`,
  )
}

export async function listDispatchRequirements(params?: {
  page?: number
  limit?: number
  tab?: 'ready' | 'waiting_production' | 'waiting_quality' | 'waiting_stock' | 'overdue' | 'blocked' | 'all'
  refresh?: boolean
  salesOrderId?: string
  customerId?: string
  search?: string
}) {
  return fetchPaginated<DispatchRequirementListItem>(tenantPath(`${DISPATCH}/requirements`), params)
}

export async function synchroniseDispatchRequirements(body?: { salesOrderId?: string; idempotencyKey?: string }) {
  return fetchData<{ synchronised: number }>(tenantPath(`${DISPATCH}/requirements/synchronise`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function createDraftDispatchFromRequirements(body: {
  requirementIds: string[]
  lines?: Array<{ requirementId: string; quantity: number; warehouseId?: string }>
  plannedDispatchDate?: string
  preferredWarehouseId?: string
  remarks?: string
  idempotencyKey?: string
  planBeforeStockAllowed?: boolean
  sourceFingerprintByRequirement?: Record<string, string>
}) {
  return fetchData<OutboundDispatch>(tenantPath(`${DISPATCH}/orders/from-requirements`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getSalesOrderDispatchRequirements(salesOrderId: string) {
  return fetchData<DispatchRequirementListItem[]>(
    tenantPath(`${CRM_SO}/${salesOrderId}/dispatch-requirements`),
  )
}

export async function getSalesOrderDispatchHistory(salesOrderId: string) {
  return fetchData<SalesOrderDispatchHistory>(tenantPath(`${CRM_SO}/${salesOrderId}/dispatch-history`))
}

export async function getSalesOrderFulfilmentSummary(salesOrderId: string) {
  return fetchData<SalesOrderFulfilmentSummary>(tenantPath(`${CRM_SO}/${salesOrderId}/fulfilment-summary`))
}

// ─── Phase 7C2 — Reservations + pick lists ────────────────────────────────────

export async function previewDispatchReservations(
  dispatchId: string,
  lines: Array<{ outboundDispatchLineId: string; quantity: number }>,
) {
  return fetchData<ReservationPreviewLine[]>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/reservations/preview`),
    { method: 'POST', body: JSON.stringify({ lines }) },
  )
}

export async function postDispatchReservations(
  dispatchId: string,
  body: {
    lines: Array<{ outboundDispatchLineId: string; quantity: number }>
    remarks?: string
    idempotencyKey?: string
  },
) {
  return fetchData<unknown>(tenantPath(`${DISPATCH}/orders/${dispatchId}/reservations`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getDispatchReservationPosition(dispatchId: string) {
  return fetchData<DispatchReservationPosition>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/reservation-position`),
  )
}

export async function createDispatchPickLists(
  dispatchId: string,
  body?: { idempotencyKey?: string; plannedPickDate?: string; priority?: string; remarks?: string },
) {
  return fetchData<DispatchPickList[]>(tenantPath(`${DISPATCH}/orders/${dispatchId}/pick-lists`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function listDispatchPickLists(params?: {
  page?: number
  limit?: number
  outboundDispatchId?: string
  status?: string
}) {
  return fetchPaginated<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists`), params)
}

export async function getDispatchPickList(id: string) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${id}`))
}

export async function releaseDispatchPickList(id: string) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${id}/release`), { method: 'POST' })
}

export async function startDispatchPickList(id: string) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${id}/start`), { method: 'POST' })
}

export async function pickDispatchPickLine(
  pickListId: string,
  body: {
    pickLineId: string
    quantity: number
    lotRef?: string
    serialRef?: string
    heatNumber?: string
    idempotencyKey?: string
    remarks?: string
  },
) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${pickListId}/pick`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function unpickDispatchPickLine(
  pickListId: string,
  body: {
    pickLineId: string
    quantity: number
    idempotencyKey?: string
    remarks?: string
  },
) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${pickListId}/unpick`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reportDispatchPickShortage(
  pickListId: string,
  body: {
    pickLineId: string
    quantity: number
    reasonCode?: string
    remarks?: string
    idempotencyKey?: string
  },
) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${pickListId}/report-shortage`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function completeDispatchPickList(id: string) {
  return fetchData<DispatchPickList>(tenantPath(`${DISPATCH}/pick-lists/${id}/complete`), { method: 'POST' })
}

export async function getDispatchPickingPosition(dispatchId: string) {
  return fetchData<DispatchPickingPosition>(tenantPath(`${DISPATCH}/orders/${dispatchId}/picking-position`))
}

export async function getDispatchPickingReconciliation(dispatchId: string) {
  return fetchData<DispatchPickingReconciliation>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/picking-reconciliation`),
  )
}

export async function listWorkbenchReservations() {
  return fetchData<WorkbenchReservationRow[]>(tenantPath(`${DISPATCH}/workbench/reservations`))
}

export async function listWorkbenchPickLists() {
  return fetchData<WorkbenchPickListRow[]>(tenantPath(`${DISPATCH}/workbench/pick-lists`))
}

export async function listWorkbenchPicking() {
  return fetchData<WorkbenchPickListRow[]>(tenantPath(`${DISPATCH}/workbench/picking`))
}

export async function listWorkbenchPicked() {
  return fetchData<WorkbenchPickListRow[]>(tenantPath(`${DISPATCH}/workbench/picked`))
}

export async function listWorkbenchShortages() {
  return fetchData<WorkbenchShortageRow[]>(tenantPath(`${DISPATCH}/workbench/shortages`))
}

// ─── Phase 7C3 — Packing sessions + packages ──────────────────────────────────

export async function createDispatchPackingSessions(
  dispatchId: string,
  body?: { idempotencyKey?: string; plannedPackingDate?: string; remarks?: string },
) {
  return fetchData<DispatchPackingSession[]>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/packing-sessions`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function listDispatchPackingSessions(params?: {
  page?: number
  limit?: number
  outboundDispatchId?: string
  status?: string
}) {
  return fetchPaginated<DispatchPackingSession>(tenantPath(`${DISPATCH}/packing-sessions`), params)
}

export async function getDispatchPackingSession(id: string) {
  return fetchData<DispatchPackingSession>(tenantPath(`${DISPATCH}/packing-sessions/${id}`))
}

export async function startDispatchPackingSession(id: string) {
  return fetchData<DispatchPackingSession>(tenantPath(`${DISPATCH}/packing-sessions/${id}/start`), {
    method: 'POST',
  })
}

export async function completeDispatchPackingSession(id: string) {
  return fetchData<DispatchPackingSession>(tenantPath(`${DISPATCH}/packing-sessions/${id}/complete`), {
    method: 'POST',
  })
}

export async function verifyDispatchPackingSession(id: string) {
  return fetchData<DispatchPackingSession>(tenantPath(`${DISPATCH}/packing-sessions/${id}/verify`), {
    method: 'POST',
  })
}

export async function listDispatchPackages(packingSessionId: string) {
  return fetchData<DispatchPackage[]>(
    tenantPath(`${DISPATCH}/packing-sessions/${packingSessionId}/packages`),
  )
}

export async function createDispatchPackage(
  packingSessionId: string,
  body?: {
    packageTypeId?: string
    packageReference?: string
    tareWeight?: number
    sealNumber?: string
    externalMarking?: string
    remarks?: string
    idempotencyKey?: string
  },
) {
  return fetchData<DispatchPackage>(
    tenantPath(`${DISPATCH}/packing-sessions/${packingSessionId}/packages`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function getDispatchPackage(id: string) {
  return fetchData<DispatchPackage>(tenantPath(`${DISPATCH}/packages/${id}`))
}

export async function packIntoDispatchPackage(
  packageId: string,
  body: {
    pickLineId: string
    quantity: number
    lotRef?: string
    serialRef?: string
    heatNumber?: string
    idempotencyKey?: string
    remarks?: string
  },
) {
  return fetchData<DispatchPackage>(tenantPath(`${DISPATCH}/packages/${packageId}/pack`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function unpackFromDispatchPackage(
  packageId: string,
  body: { packageLineId: string; quantity: number; idempotencyKey?: string; remarks?: string },
) {
  return fetchData<DispatchPackage>(tenantPath(`${DISPATCH}/packages/${packageId}/unpack`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reportDispatchPackingShortage(
  packingSessionId: string,
  body: {
    pickLineId: string
    quantity: number
    reasonCode?: string
    remarks?: string
    idempotencyKey?: string
  },
) {
  return fetchData<DispatchPackingSession>(
    tenantPath(`${DISPATCH}/packing-sessions/${packingSessionId}/report-shortage`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function getDispatchPackingPosition(dispatchId: string) {
  return fetchData<DispatchPackingPosition>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/packing-position`),
  )
}

export async function getDispatchPackingReconciliation(dispatchId: string) {
  return fetchData<DispatchPackingReconciliation>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/packing-reconciliation`),
  )
}

export async function getDispatchSessionReconciliation(packingSessionId: string) {
  return fetchData<DispatchSessionReconciliation>(
    tenantPath(`${DISPATCH}/packing-sessions/${packingSessionId}/reconciliation`),
  )
}

export async function listWorkbenchReadyToPack() {
  return fetchData<WorkbenchPackingSessionRow[]>(tenantPath(`${DISPATCH}/workbench/ready-to-pack`))
}

export async function listWorkbenchPacking() {
  return fetchData<WorkbenchPackingSessionRow[]>(tenantPath(`${DISPATCH}/workbench/packing`))
}

export async function listWorkbenchPacked() {
  return fetchData<WorkbenchPackingSessionRow[]>(tenantPath(`${DISPATCH}/workbench/packed`))
}

export async function listWorkbenchPackingShortages() {
  return fetchData<WorkbenchPackingSessionRow[]>(tenantPath(`${DISPATCH}/workbench/packing-shortages`))
}

// ─── Phase 7C4 — Delivery challans (document only) ────────────────────────────

export async function createDeliveryChallan(
  dispatchId: string,
  body?: { idempotencyKey?: string; documentDate?: string; remarks?: string },
) {
  return fetchData<DeliveryChallanRow>(
    tenantPath(`${DISPATCH}/orders/${dispatchId}/delivery-challans`),
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export async function listDeliveryChallans(params?: {
  page?: number
  limit?: number
  status?: string
  outboundDispatchId?: string
  salesOrderId?: string
}) {
  return fetchPaginated<DeliveryChallanRow>(tenantPath(`${DISPATCH}/delivery-challans`), params)
}

export async function getDeliveryChallan(id: string) {
  return fetchData<DeliveryChallanRow>(tenantPath(`${DISPATCH}/delivery-challans/${id}`))
}

export async function updateDeliveryChallan(
  id: string,
  body: {
    transporterName?: string
    vehicleNumber?: string
    lrGrNumber?: string
    eWayBillReference?: string
    driverName?: string
    driverPhone?: string
    destination?: string
    remarks?: string
  },
) {
  return fetchData<DeliveryChallanRow>(tenantPath(`${DISPATCH}/delivery-challans/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function submitDeliveryChallan(id: string) {
  return fetchData<DeliveryChallanRow>(
    tenantPath(`${DISPATCH}/delivery-challans/${id}/ready-for-review`),
    { method: 'POST' },
  )
}

export async function approveDeliveryChallan(id: string) {
  return fetchData<DeliveryChallanRow>(tenantPath(`${DISPATCH}/delivery-challans/${id}/approve`), {
    method: 'POST',
  })
}

export async function issueDeliveryChallan(id: string, body?: { idempotencyKey?: string; sourceVersion?: number }) {
  return fetchData<DeliveryChallanRow>(tenantPath(`${DISPATCH}/delivery-challans/${id}/issue`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function cancelDeliveryChallan(id: string, reason: string) {
  return fetchData<DeliveryChallanRow>(tenantPath(`${DISPATCH}/delivery-challans/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function deliveryChallanPreviewUrl(challanId: string): string {
  return `${API_CONFIG.baseUrl}${tenantPath(`${DISPATCH}/delivery-challans/${challanId}/preview`)}`
}

export function deliveryChallanPdfUrl(challanId: string): string {
  return `${API_CONFIG.baseUrl}${tenantPath(`${DISPATCH}/delivery-challans/${challanId}/pdf`)}`
}

/** Fetch printable challan HTML with auth (Bearer) — use for Print / Save as PDF. */
export async function fetchDeliveryChallanPrintHtml(
  challanId: string,
  mode: 'preview' | 'pdf' = 'preview',
): Promise<{ html: string; filename?: string }> {
  const path = tenantPath(
    `${DISPATCH}/delivery-challans/${challanId}/${mode === 'pdf' ? 'pdf' : 'preview'}`,
  )
  const { blob, filename } = await apiDownloadBlob(path)
  return { html: await blob.text(), filename }
}

export async function listWorkbenchChallanDrafts() {
  return fetchData<DeliveryChallanRow[]>(tenantPath(`${DISPATCH}/workbench/challan-drafts`))
}

export async function listWorkbenchChallanReview() {
  return fetchData<DeliveryChallanRow[]>(tenantPath(`${DISPATCH}/workbench/challan-review`))
}

export async function listWorkbenchChallansIssued() {
  return fetchData<DeliveryChallanRow[]>(tenantPath(`${DISPATCH}/workbench/challans-issued`))
}

export async function listWorkbenchReadyForDispatch() {
  return fetchData<DeliveryChallanRow[]>(tenantPath(`${DISPATCH}/workbench/ready-for-dispatch`))
}
