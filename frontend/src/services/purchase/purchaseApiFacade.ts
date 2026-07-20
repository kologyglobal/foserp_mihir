/**
 * Dual-mode purchase facade.
 * `VITE_USE_API=true` → backend is source of truth for PR + Planning.
 * Demo mode keeps in-memory `purchaseService` behavior.
 * Approval / conversion / PO creation never use optimistic local updates in API mode.
 */

import { isApiMode } from '../../config/apiConfig'
import { useMasterStore } from '../../store/masterStore'
import type { Item as MasterItem, Vendor as MasterVendor } from '../../types/master'
import type {
  PurchaseApprovalDocumentType,
  PurchaseApprovalQueueFilters,
  PurchaseApprovalQueueRow,
  PurchaseApprovalQueueTab,
  PurchaseApprovalReviewDetail,
  PurchaseApprovalRole,
  PurchaseDashboardData,
  PurchaseDashboardFilters,
  PurchaseItem,
  PurchaseItemCategory,
  PurchaseOrder,
  PurchaseOrderLinkedDocuments,
  PurchaseOrderListRow,
  PurchasePlanningSheetInput,
  PurchasePlanningSheetRow,
  PurchaseRequisition,
  PurchaseRequisitionInput,
  PurchaseRequisitionListRow,
  QuotationComparison,
  QuotationComparisonInput,
  QuotationSelectionMode,
  RequestForQuotation,
  RfqInput,
  Vendor,
  VendorQuotation,
  VendorQuotationInput,
  VendorQuotationListRow,
  RfqListRow,
} from '../../types/purchaseDomain'
import {
  PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS,
  PURCHASE_APPROVAL_STATUS_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
} from '../../types/purchaseDomain'
import { prDepartmentLabel } from '../../utils/purchaseRequisitionValidation'
import { getStoredSession } from '../api/client'
import * as demo from './purchaseService'
import { PurchaseServiceError } from './purchaseService'
import * as prApi from './purchaseRequisitionApi'
import * as planningApi from './purchasePlanningApi'
import * as rfqApi from './rfqApi'
import * as vqApi from './vendorQuotationApi'
import * as comparisonApi from './comparisonApi'
import * as poApi from './purchaseOrderApi'
import {
  formatPurchaseApiError,
  isBackendMissingError,
  mapApiComparisonToDomain,
  mapApiPlanningRowToDomain,
  mapApiPurchaseOrderToDomain,
  mapApiPurchaseOrderToListRow,
  mapApiRequisitionToDomain,
  mapApiRequisitionToListRow,
  mapApiRfqToDomain,
  mapApiRfqToListRow,
  mapApiVendorQuotationToDomain,
  mapApiVendorQuotationToListRow,
  mapDomainInputToApiPayload,
  mapDomainRfqInputToApiPayload,
  mapDomainVendorQuotationInputToApiPayload,
  mapPlanningPatchToApi,
} from './purchaseMappers'
import type { PlanningSheetSummary } from './purchaseApiTypes'

function throwApi(err: unknown): never {
  const { code, message } = formatPurchaseApiError(err)
  throw new PurchaseServiceError(code, message)
}

function throwIfMissing(err: unknown, feature: string): never {
  if (isBackendMissingError(err)) {
    throw new PurchaseServiceError(
      'PURCHASE_API_NOT_IMPLEMENTED',
      `${feature} backend is not available yet. Use demo mode (VITE_USE_API=false) or wait for that API.`,
    )
  }
  throwApi(err)
}

/* ─── Purchase Requisitions ─── */

export async function getPurchaseRequisitions(): Promise<PurchaseRequisitionListRow[]> {
  if (!isApiMode()) return demo.getPurchaseRequisitions()
  try {
    const res = await prApi.listPurchaseRequisitionsApi({ page: 1, limit: 100, sortOrder: 'desc' })
    return res.data.map(mapApiRequisitionToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseRequisitionById(id: string): Promise<PurchaseRequisition | null> {
  if (!isApiMode()) return demo.getPurchaseRequisitionById(id)
  try {
    const res = await prApi.getPurchaseRequisitionApi(id)
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    const { code } = formatPurchaseApiError(err)
    if (code === 'PURCHASE_REQUISITION_NOT_FOUND' || code === 'HTTP_404' || code === 'NOT_FOUND') {
      return null
    }
    throwApi(err)
  }
}

/** Peek next PR number without consuming the series. */
export async function previewNextPurchaseRequisitionNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextPurchaseRequisitionNumber()
  try {
    const res = await prApi.previewNextPurchaseRequisitionNumberApi()
    return res.data.requisitionNumber
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseRequisitionListSummary(): Promise<{
  total: number
  draft: number
  pendingApproval: number
  approved: number
  converted: number
}> {
  if (!isApiMode()) return demo.getPurchaseRequisitionListSummary()
  const rows = await getPurchaseRequisitions()
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
  if (!isApiMode()) return demo.createPurchaseRequisition(input)
  try {
    const res = await prApi.createPurchaseRequisitionApi(mapDomainInputToApiPayload(input))
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function updatePurchaseRequisition(
  id: string,
  input: PurchaseRequisitionInput,
): Promise<PurchaseRequisition> {
  if (!isApiMode()) return demo.updatePurchaseRequisition(id, input)
  try {
    const res = await prApi.updatePurchaseRequisitionApi(id, mapDomainInputToApiPayload(input))
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function submitPurchaseRequisition(id: string): Promise<PurchaseRequisition> {
  if (!isApiMode()) return demo.submitPurchaseRequisition(id)
  try {
    const res = await prApi.submitPurchaseRequisitionApi(id, {})
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function approvePurchaseRequisition(
  id: string,
  remarks = '',
): Promise<PurchaseRequisition> {
  if (!isApiMode()) return demo.approvePurchaseRequisition(id, remarks)
  // No optimistic update — wait for server (planning sync happens server-side).
  try {
    const res = await prApi.approvePurchaseRequisitionApi(id, { remarks: remarks || null })
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function rejectPurchaseRequisition(
  id: string,
  reason: string,
): Promise<PurchaseRequisition> {
  if (!isApiMode()) return demo.rejectPurchaseRequisition(id, reason)
  try {
    const res = await prApi.rejectPurchaseRequisitionApi(id, { reason })
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelPurchaseRequisition(
  id: string,
  remarks = '',
): Promise<PurchaseRequisition> {
  if (!isApiMode()) return demo.cancelPurchaseRequisition(id, remarks)
  try {
    const res = await prApi.cancelPurchaseRequisitionApi(id, { remarks: remarks || null })
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function deletePurchaseRequisition(id: string): Promise<void> {
  if (!isApiMode()) return demo.deletePurchaseRequisition(id)
  // Soft-cancel via API until hard-delete ships.
  await cancelPurchaseRequisition(id, 'Deleted')
}

export async function duplicatePurchaseRequisition(id: string): Promise<PurchaseRequisition> {
  if (!isApiMode()) return demo.duplicatePurchaseRequisition(id)
  const source = await getPurchaseRequisitionById(id)
  if (!source) throw new PurchaseServiceError('PR_NOT_FOUND', `Purchase requisition not found: ${id}`)
  return createPurchaseRequisition({
    ...source,
    documentDate: new Date().toISOString().slice(0, 10),
    status: undefined,
    rfqRequired: source.rfqRequired,
    lines: source.lines.map(({ id: _id, ...line }) => line),
  })
}

export async function convertPurchaseRequisitionToRfq(id: string): Promise<RequestForQuotation> {
  if (!isApiMode()) return demo.convertPurchaseRequisitionToRfq(id)
  try {
    const res = await rfqApi.createRfqFromRequisitionApi(id, {})
    return mapApiRfqToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'RFQ conversion')
  }
}

/* ─── Planning Sheet ─── */

async function ensureMasterVendorsForMapping(): Promise<void> {
  if (useMasterStore.getState().vendors.length) return
  try {
    const { syncBatchMastersFromApi } = await import('../bridges/masterBatchApiBridge')
    await syncBatchMastersFromApi()
  } catch {
    /* mapping falls back to null names */
  }
}

export async function getPurchasePlanningSheet(): Promise<PurchasePlanningSheetRow[]> {
  if (!isApiMode()) return demo.getPurchasePlanningSheet()
  try {
    await ensureMasterVendorsForMapping()
    const res = await planningApi.listPlanningSheetApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPlanningRowToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchasePlanningSheetById(
  id: string,
): Promise<PurchasePlanningSheetRow | null> {
  if (!isApiMode()) return demo.getPurchasePlanningSheetById(id)
  try {
    await ensureMasterVendorsForMapping()
    const res = await planningApi.getPlanningRowApi(id)
    return mapApiPlanningRowToDomain(res.data)
  } catch (err) {
    const { code } = formatPurchaseApiError(err)
    if (code === 'PPS_NOT_FOUND' || code === 'HTTP_404' || code === 'NOT_FOUND') return null
    throwApi(err)
  }
}

export async function getPurchasePlanningSheetSummary(): Promise<PlanningSheetSummary> {
  if (!isApiMode()) {
    const rows = await demo.getPurchasePlanningSheet()
    const today = new Date().toISOString().slice(0, 10)
    return {
      totalPendingPlanning: rows.filter((r) => r.status === 'draft').length,
      criticalItems: rows.filter((r) => r.priority === 'critical').length,
      overdueItems: rows.filter(
        (r) => r.requiredByDate && r.requiredByDate < today && !['completed', 'cancelled', 'po_created'].includes(r.status),
      ).length,
      vendorSelectionPending: rows.filter(
        (r) => !r.preferredVendorId && ['draft', 'pending_review'].includes(r.status),
      ).length,
      poPending: rows.filter((r) => r.status === 'po_pending').length,
      poCreated: rows.filter((r) => r.status === 'po_created').length,
      totalEstimatedPurchaseValue: rows
        .filter((r) => !['cancelled', 'completed'].includes(r.status))
        .reduce((s, r) => s + r.estimatedAmount, 0),
    }
  }
  try {
    const res = await planningApi.getPlanningSheetSummaryApi()
    return res.data
  } catch (err) {
    throwApi(err)
  }
}

export async function updatePurchasePlanningSheetRow(
  id: string,
  patch: PurchasePlanningSheetInput,
): Promise<PurchasePlanningSheetRow> {
  if (!isApiMode()) return demo.updatePurchasePlanningSheetRow(id, patch)
  try {
    await ensureMasterVendorsForMapping()
    const res = await planningApi.updatePlanningRowApi(
      id,
      mapPlanningPatchToApi({
        selectedVendorId: patch.preferredVendorId,
        expectedRate: patch.expectedRate,
        negotiatedRate: patch.negotiatedRate,
        requiredByDate: patch.requiredByDate,
        purchaseType: patch.purchaseType,
        buyerId: patch.buyerId,
        priority: patch.priority,
        actionMessage: patch.actionMessage,
        remarks: patch.remarks,
        status: patch.status,
      }),
    )
    return mapApiPlanningRowToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function assignPurchasePlanningBuyer(
  id: string,
  buyerId: string,
  buyerName = '',
): Promise<PurchasePlanningSheetRow> {
  if (!isApiMode()) return demo.assignPurchasePlanningBuyer(id, buyerId, buyerName || buyerId)
  try {
    const res = await planningApi.bulkAssignBuyerApi({ rowIds: [id], buyerId })
    const row = res.data.find((r) => r.id === id) ?? res.data[0]
    if (!row) throw new PurchaseServiceError('PPS_NOT_FOUND', 'Planning row not found')
    return mapApiPlanningRowToDomain(row)
  } catch (err) {
    throwApi(err)
  }
}

export async function selectPurchasePlanningVendor(
  id: string,
  vendorId: string,
  expectedRate?: number,
): Promise<PurchasePlanningSheetRow> {
  if (!isApiMode()) return demo.selectPurchasePlanningVendor(id, vendorId)
  try {
    const res = await planningApi.bulkSelectVendorApi({
      rowIds: [id],
      vendorId,
      expectedRate: expectedRate ?? null,
    })
    const row = res.data.find((r) => r.id === id) ?? res.data[0]
    if (!row) throw new PurchaseServiceError('PPS_NOT_FOUND', 'Planning row not found')
    return mapApiPlanningRowToDomain(row)
  } catch (err) {
    throwApi(err)
  }
}

export async function approvePurchasePlanningRow(id: string): Promise<PurchasePlanningSheetRow> {
  if (!isApiMode()) return demo.approvePurchasePlanningRow(id)
  try {
    const res = await planningApi.bulkPlanningStatusApi({
      rowIds: [id],
      status: 'APPROVED',
    })
    const row = res.data.find((r) => r.id === id) ?? res.data[0]
    if (!row) throw new PurchaseServiceError('PPS_NOT_FOUND', 'Planning row not found')
    return mapApiPlanningRowToDomain(row)
  } catch (err) {
    throwApi(err)
  }
}

export async function holdPurchasePlanningRow(
  id: string,
  reason = 'On hold',
): Promise<PurchasePlanningSheetRow> {
  if (!isApiMode()) return demo.holdPurchasePlanningRow(id, reason)
  try {
    const res = await planningApi.bulkPlanningStatusApi({
      rowIds: [id],
      status: 'ON_HOLD',
      reason,
    })
    const row = res.data.find((r) => r.id === id) ?? res.data[0]
    if (!row) throw new PurchaseServiceError('PPS_NOT_FOUND', 'Planning row not found')
    return mapApiPlanningRowToDomain(row)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelPurchasePlanningRow(
  id: string,
  reason = 'Cancelled',
): Promise<PurchasePlanningSheetRow> {
  if (!isApiMode()) return demo.cancelPurchasePlanningRow(id, reason)
  try {
    const res = await planningApi.bulkPlanningStatusApi({
      rowIds: [id],
      status: 'CANCELLED',
      reason,
    })
    const row = res.data.find((r) => r.id === id) ?? res.data[0]
    if (!row) throw new PurchaseServiceError('PPS_NOT_FOUND', 'Planning row not found')
    return mapApiPlanningRowToDomain(row)
  } catch (err) {
    throwApi(err)
  }
}

export async function bulkAssignPurchasePlanningBuyer(
  rowIds: string[],
  buyerId: string,
  buyerName = '',
): Promise<PurchasePlanningSheetRow[]> {
  if (!rowIds.length) return []
  if (!isApiMode()) {
    const out: PurchasePlanningSheetRow[] = []
    for (const id of rowIds) {
      out.push(await demo.assignPurchasePlanningBuyer(id, buyerId, buyerName || buyerId))
    }
    return out
  }
  try {
    const res = await planningApi.bulkAssignBuyerApi({ rowIds, buyerId })
    return res.data.map(mapApiPlanningRowToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function bulkSelectPurchasePlanningVendor(
  rowIds: string[],
  vendorId: string,
  expectedRate?: number | null,
): Promise<PurchasePlanningSheetRow[]> {
  if (!rowIds.length) return []
  if (!isApiMode()) {
    const out: PurchasePlanningSheetRow[] = []
    for (const id of rowIds) {
      out.push(await demo.selectPurchasePlanningVendor(id, vendorId))
      if (expectedRate != null) {
        out[out.length - 1] = await demo.updatePurchasePlanningSheetRow(id, { expectedRate })
      }
    }
    return out
  }
  try {
    const res = await planningApi.bulkSelectVendorApi({
      rowIds,
      vendorId,
      expectedRate: expectedRate ?? null,
    })
    return res.data.map(mapApiPlanningRowToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function bulkUpdatePurchasePlanningStatus(
  rowIds: string[],
  status: string,
  reason?: string,
): Promise<PurchasePlanningSheetRow[]> {
  if (!rowIds.length) return []
  if (!isApiMode()) {
    const out: PurchasePlanningSheetRow[] = []
    for (const id of rowIds) {
      if (status === 'CANCELLED' || status === 'cancelled') {
        out.push(await demo.cancelPurchasePlanningRow(id, reason))
      } else if (status === 'ON_HOLD' || status === 'pending_review') {
        out.push(await demo.holdPurchasePlanningRow(id, reason))
      } else if (status === 'APPROVED' || status === 'approved') {
        out.push(await demo.approvePurchasePlanningRow(id))
      } else {
        out.push(await demo.updatePurchasePlanningSheetRow(id, { status: status as never }))
      }
    }
    return out
  }
  try {
    const res = await planningApi.bulkPlanningStatusApi({ rowIds, status, reason })
    return res.data.map(mapApiPlanningRowToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function recalculatePurchasePlanningRows(
  rowIds: string[] = [],
): Promise<PurchasePlanningSheetRow[]> {
  if (!isApiMode()) {
    // Demo: re-read sheet (net qty already computed on write)
    const all = await demo.getPurchasePlanningSheet()
    if (!rowIds.length) return all
    return all.filter((r) => rowIds.includes(r.id))
  }
  try {
    const res = await planningApi.recalculatePlanningApi({ rowIds })
    return res.data.map(mapApiPlanningRowToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function createPurchaseOrdersFromPlanningSelection(
  planningRowIds: string[],
  options?: { seriesPrefix?: string },
): Promise<PurchaseOrder[]> {
  if (!isApiMode()) return demo.createPurchaseOrdersFromPlanningSelection(planningRowIds, options)
  // No optimistic PO creation — server groups and numbers.
  try {
    const res = await poApi.createPurchaseOrdersFromPlanningApi({
      rowIds: planningRowIds,
    })
    // Re-fetch full DTOs so detail page has vendor + lines.
    const orders = await Promise.all(
      res.data.orders.map(async (o) => {
        try {
          const full = await poApi.getPurchaseOrderApi(o.id)
          return mapApiPurchaseOrderToDomain(full.data)
        } catch {
          return mapApiPurchaseOrderToDomain(o)
        }
      }),
    )
    return orders
  } catch (err) {
    throwIfMissing(err, 'Create PO from Planning')
  }
}

export async function createPurchaseOrderFromPlanningRow(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.createPurchaseOrderFromPlanningRow(id)
  const orders = await createPurchaseOrdersFromPlanningSelection([id])
  if (!orders[0]) throw new PurchaseServiceError('PPS_PO_NOT_READY', 'PO was not created')
  return orders[0]
}

/**
 * Create PO from an approved PR.
 * Demo: direct PO from PR lines.
 * API: RFQ-required PRs are blocked; direct PRs use Planning Sheet create-PO.
 */
export async function createPurchaseOrderFromPr(
  prId: string,
  vendorId?: string,
): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.createPurchaseOrderFromPr(prId, vendorId)

  const pr = await getPurchaseRequisitionById(prId)
  if (!pr) {
    throw new PurchaseServiceError('PR_NOT_FOUND', 'Purchase requisition not found.')
  }

  if (pr.rfqRequired) {
    throw new PurchaseServiceError(
      'PR_RFQ_REQUIRED',
      'This requisition requires the RFQ path. Create an RFQ, then award via comparison.',
    )
  }

  if (pr.status !== 'approved') {
    throw new PurchaseServiceError('PR_NOT_APPROVED', 'Only approved PRs can create a PO')
  }

  let sheet = await getPurchasePlanningSheet()
  let rows = sheet.filter(
    (r) =>
      r.purchaseRequisitionId === prId &&
      !['po_created', 'cancelled', 'completed'].includes(r.status),
  )

  if (rows.length === 0) {
    throw new PurchaseServiceError(
      'PPS_PO_NOT_READY',
      'No Planning Sheet rows for this PR. Open Planning Sheet after approval, set vendor/rate, then create PO.',
    )
  }

  if (vendorId) {
    for (const row of rows) {
      if (row.preferredVendorId !== vendorId) {
        await selectPurchasePlanningVendor(row.id, vendorId, row.expectedRate || undefined)
      }
    }
    sheet = await getPurchasePlanningSheet()
    rows = sheet.filter(
      (r) =>
        r.purchaseRequisitionId === prId &&
        !['po_created', 'cancelled', 'completed'].includes(r.status),
    )
  }

  const eligible = rows.filter(demo.canSelectPlanningRowForPo)
  if (eligible.length === 0) {
    throw new PurchaseServiceError(
      'PPS_PO_NOT_READY',
      'Planning rows need vendor, rate, and quantity before PO creation. Open the Planning Sheet to complete them.',
    )
  }

  const orders = await createPurchaseOrdersFromPlanningSelection(eligible.map((r) => r.id))
  if (!orders[0]) {
    throw new PurchaseServiceError('PPS_PO_NOT_READY', 'PO was not created')
  }
  return orders[0]
}

/** Alias used by PR list “Create PO” — same Planning path as createPurchaseOrderFromPr. */
export async function convertPurchaseRequisitionToPo(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.convertPurchaseRequisitionToPo(id)
  return createPurchaseOrderFromPr(id)
}

/* ─── Purchase Orders (list / get) ─── */

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  if (!isApiMode()) return demo.getPurchaseOrders()
  try {
    const res = await poApi.listPurchaseOrdersApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPurchaseOrderToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  if (!isApiMode()) return demo.getPurchaseOrderById(id)
  try {
    const res = await poApi.getPurchaseOrderApi(id)
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    if (isBackendMissingError(err)) return null
    const { code } = formatPurchaseApiError(err)
    if (code === 'PO_NOT_FOUND' || code === 'NOT_FOUND') return null
    throwApi(err)
  }
}

export async function getPurchaseOrderList(): Promise<PurchaseOrderListRow[]> {
  if (!isApiMode()) return demo.getPurchaseOrderList()
  try {
    const res = await poApi.listPurchaseOrdersApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPurchaseOrderToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseOrderLinkedDocuments(
  id: string,
): Promise<PurchaseOrderLinkedDocuments> {
  if (!isApiMode()) return demo.getPurchaseOrderLinkedDocuments(id)
  const po = await getPurchaseOrderById(id)
  if (!po) {
    throw new PurchaseServiceError('PO_NOT_FOUND', `Purchase order not found: ${id}`)
  }
  // GRN / invoice / return links not mounted yet — return PR/RFQ refs from the PO only.
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
      ? {
          id: po.comparisonId,
          documentNumber: po.comparisonNumber ?? po.comparisonId,
        }
      : null,
    blanketOrder: null,
    grns: [],
    invoices: [],
    returns: [],
  }
}

/* ─── RFQ ─── */

export async function getRFQs(): Promise<RequestForQuotation[]> {
  if (!isApiMode()) return demo.getRFQs()
  try {
    const res = await rfqApi.listRfqsApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiRfqToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getRfqList(): Promise<RfqListRow[]> {
  if (!isApiMode()) return demo.getRfqList()
  try {
    const res = await rfqApi.listRfqsApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiRfqToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getRFQById(id: string): Promise<RequestForQuotation | null> {
  if (!isApiMode()) return demo.getRFQById(id)
  try {
    const res = await rfqApi.getRfqApi(id)
    return mapApiRfqToDomain(res.data)
  } catch (err) {
    const { code } = formatPurchaseApiError(err)
    if (code === 'RFQ_NOT_FOUND' || code === 'HTTP_404' || code === 'NOT_FOUND') return null
    throwApi(err)
  }
}

export async function createRFQ(input: RfqInput): Promise<RequestForQuotation> {
  if (!isApiMode()) return demo.createRFQ(input)
  try {
    const res = await rfqApi.createRfqApi(mapDomainRfqInputToApiPayload(input))
    return mapApiRfqToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Create RFQ')
  }
}

export async function updateRFQ(id: string, input: RfqInput): Promise<RequestForQuotation> {
  if (!isApiMode()) return demo.updateRFQ(id, input)
  try {
    const payload = mapDomainRfqInputToApiPayload(input)
    const res = await rfqApi.updateRfqApi(id, {
      title: null,
      responseDueDate: payload.responseDueDate,
      remarks: payload.remarks,
      vendorIds: payload.vendorIds,
      lines: payload.lines,
    })
    return mapApiRfqToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Update RFQ')
  }
}

export async function sendRFQ(id: string): Promise<RequestForQuotation> {
  if (!isApiMode()) return demo.sendRFQ(id)
  try {
    const res = await rfqApi.sendRfqApi(id, {})
    return mapApiRfqToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Send RFQ')
  }
}

export async function cancelRFQ(id: string, remarks = 'Cancelled'): Promise<RequestForQuotation> {
  if (!isApiMode()) return demo.cancelRFQ(id, remarks)
  try {
    const res = await rfqApi.cancelRfqApi(id, { remarks })
    return mapApiRfqToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Cancel RFQ')
  }
}

/* ─── Vendor quotations ─── */

export async function getVendorQuotationList(): Promise<VendorQuotationListRow[]> {
  if (!isApiMode()) return demo.getVendorQuotationList()
  try {
    const res = await vqApi.listVendorQuotationsApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiVendorQuotationToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getVendorQuotations(rfqId?: string): Promise<VendorQuotation[]> {
  if (!isApiMode()) return demo.getVendorQuotations(rfqId)
  try {
    const res = await vqApi.listVendorQuotationsApi({
      page: 1,
      pageSize: 100,
      sortOrder: 'desc',
      requestForQuotationId: rfqId,
    })
    return res.data.map(mapApiVendorQuotationToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getVendorQuotationById(id: string): Promise<VendorQuotation | null> {
  if (!isApiMode()) return demo.getVendorQuotationById(id)
  try {
    const res = await vqApi.getVendorQuotationApi(id)
    return mapApiVendorQuotationToDomain(res.data)
  } catch (err) {
    const { code } = formatPurchaseApiError(err)
    if (code === 'VQ_NOT_FOUND' || code === 'HTTP_404' || code === 'NOT_FOUND') return null
    throwApi(err)
  }
}

export async function createVendorQuotation(input: VendorQuotationInput): Promise<VendorQuotation> {
  if (!isApiMode()) return demo.createVendorQuotation(input)
  try {
    const res = await vqApi.createVendorQuotationApi(mapDomainVendorQuotationInputToApiPayload(input))
    return mapApiVendorQuotationToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Create vendor quotation')
  }
}

export async function updateVendorQuotation(
  id: string,
  input: VendorQuotationInput,
): Promise<VendorQuotation> {
  if (!isApiMode()) return demo.updateVendorQuotation(id, input)
  try {
    const payload = mapDomainVendorQuotationInputToApiPayload(input)
    const { requestForQuotationId: _rfq, vendorId: _vendor, ...patch } = payload as Record<
      string,
      unknown
    > & { requestForQuotationId?: string; vendorId?: string }
    const res = await vqApi.updateVendorQuotationApi(id, patch)
    return mapApiVendorQuotationToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Update vendor quotation')
  }
}

export async function submitVendorQuotation(id: string): Promise<VendorQuotation> {
  if (!isApiMode()) return demo.submitVendorQuotation(id)
  try {
    const res = await vqApi.submitVendorQuotationApi(id, {})
    return mapApiVendorQuotationToDomain(res.data)
  } catch (err) {
    throwIfMissing(err, 'Submit vendor quotation')
  }
}

/* ─── Quotation comparison / award / PO ─── */

export async function getQuotationComparison(rfqId: string): Promise<QuotationComparison | null> {
  if (!isApiMode()) return demo.getQuotationComparison(rfqId)
  try {
    const res = await comparisonApi.listComparisonsApi({
      requestForQuotationId: rfqId,
      page: 1,
      pageSize: 10,
    })
    const first = res.data[0]
    if (!first) {
      // Also allow lookup by comparison id
      try {
        const byId = await comparisonApi.getComparisonApi(rfqId)
        return mapApiComparisonToDomain(byId.data)
      } catch {
        return null
      }
    }
    return mapApiComparisonToDomain(first)
  } catch (err) {
    const { code } = formatPurchaseApiError(err)
    if (code === 'HTTP_404' || code === 'NOT_FOUND') return null
    throwApi(err)
  }
}

export async function buildQuotationComparison(
  input: QuotationComparisonInput,
): Promise<QuotationComparison> {
  if (!isApiMode()) return demo.buildQuotationComparison(input)
  try {
    const res = await comparisonApi.buildComparisonApi({
      requestForQuotationId: input.rfqId,
    })
    const mapped = mapApiComparisonToDomain(res.data)
    if (input.selectionReason) mapped.selectionReason = input.selectionReason
    if (input.recommendedVendorId) {
      mapped.recommendedVendorId = input.recommendedVendorId
      mapped.recommendationStatus = 'recommended'
      mapped.rows = mapped.rows.map((row) => ({
        ...row,
        selectedVendorId: input.recommendedVendorId!,
        recommendedVendorId: input.recommendedVendorId!,
      }))
    }
    if (input.vendorIds?.length) {
      mapped.selectedVendorIds = [...input.vendorIds]
    }
    if (input.method) mapped.method = input.method
    if (input.criteria) mapped.criteria = input.criteria
    if (input.selectionMode) mapped.selectionMode = input.selectionMode
    return mapped
  } catch (err) {
    throwIfMissing(err, 'Build quotation comparison')
  }
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
  if (!isApiMode()) return demo.updateQuotationComparisonSelection(id, input)
  // Selection is held client-side until award; refresh base comparison then overlay.
  try {
    const res = await comparisonApi.getComparisonApi(id)
    const mapped = mapApiComparisonToDomain(res.data)
    mapped.selectionMode = input.selectionMode
    mapped.selectionReason = input.selectionReason
    if (input.selectionMode === 'all_lines' && input.recommendedVendorId) {
      mapped.recommendedVendorId = input.recommendedVendorId
      mapped.recommendationStatus = 'recommended'
      mapped.rows = mapped.rows.map((row) => ({
        ...row,
        selectedVendorId: input.recommendedVendorId!,
        recommendedVendorId: input.recommendedVendorId!,
      }))
    } else if (input.lineSelections?.length) {
      mapped.rows = mapped.rows.map((row) => {
        const sel = input.lineSelections!.find((s) => s.itemId === row.itemId)
        return sel
          ? { ...row, selectedVendorId: sel.vendorId, recommendedVendorId: sel.vendorId }
          : row
      })
      mapped.recommendedVendorId = input.lineSelections[0]?.vendorId ?? mapped.recommendedVendorId
      mapped.recommendationStatus = 'recommended'
    }
    return mapped
  } catch (err) {
    throwIfMissing(err, 'Update comparison selection')
  }
}

export async function recommendQuotationVendor(
  id: string,
  input: { vendorId?: string; selectionReason?: string } = {},
): Promise<QuotationComparison> {
  if (!isApiMode()) return demo.recommendQuotationVendor(id, input)
  try {
    const res = await comparisonApi.getComparisonApi(id)
    const mapped = mapApiComparisonToDomain(res.data)
    if (input.selectionReason != null) mapped.selectionReason = input.selectionReason
    const vendorId = input.vendorId ?? mapped.recommendedVendorId
    if (!vendorId) {
      throw new PurchaseServiceError('CMP_NO_VENDOR', 'Select a vendor to recommend')
    }
    mapped.recommendedVendorId = vendorId
    mapped.recommendationStatus = 'recommended'
    mapped.rows = mapped.rows.map((row) => ({
      ...row,
      selectedVendorId: vendorId,
      recommendedVendorId: vendorId,
    }))
    return mapped
  } catch (err) {
    if (err instanceof PurchaseServiceError) throw err
    throwIfMissing(err, 'Recommend vendor')
  }
}

export async function approveQuotationRecommendation(
  id: string,
  input?: { vendorId?: string; selectionReason?: string; awardedVendorQuotationId?: string },
): Promise<QuotationComparison> {
  if (!isApiMode()) return demo.approveQuotationRecommendation(id)
  try {
    const current = await comparisonApi.getComparisonApi(id)
    const mapped = mapApiComparisonToDomain(current.data)
    const vendorId = input?.vendorId ?? mapped.recommendedVendorId
    const reason =
      (input?.selectionReason ?? mapped.selectionReason ?? '').trim() || 'Lowest landed cost / recommended vendor'
    let quotationId = input?.awardedVendorQuotationId
    if (!quotationId && vendorId) {
      quotationId =
        current.data.vendors?.find((v) => v.vendorId === vendorId)?.quotationId ??
        mapped.rows.flatMap((r) => r.quotes).find((q) => q.vendorId === vendorId)?.vendorQuotationId
    }
    if (!quotationId) {
      throw new PurchaseServiceError('CMP_NO_VENDOR', 'Select a vendor quotation to award')
    }
    const res = await comparisonApi.awardComparisonApi(id, {
      awardedVendorQuotationId: quotationId,
      selectionReason: reason,
    })
    return mapApiComparisonToDomain(res.data)
  } catch (err) {
    if (err instanceof PurchaseServiceError) throw err
    throwIfMissing(err, 'Award vendor')
  }
}

export async function createPurchaseOrderFromComparison(
  comparisonId: string,
): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.createPurchaseOrderFromComparison(comparisonId)
  try {
    const res = await comparisonApi.createPoFromComparisonApi(comparisonId)
    return {
      id: res.data.id,
      documentNumber: res.data.orderNumber,
      documentDate: res.data.orderDate ?? new Date().toISOString().slice(0, 10),
      status: 'draft',
      rfqId: res.data.requestForQuotationId,
      vendorQuotationId: res.data.vendorQuotationId,
      comparisonId: res.data.vendorComparisonId,
      purchaseRequisitionId: res.data.purchaseRequisitionId,
    } as PurchaseOrder
  } catch (err) {
    throwIfMissing(err, 'Create PO from comparison')
  }
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function mapPrToApprovalQueueRow(pr: PurchaseRequisition): PurchaseApprovalQueueRow {
  const status =
    pr.status === 'approved'
      ? 'approved'
      : pr.status === 'rejected'
        ? 'rejected'
        : pr.status === 'cancelled'
          ? 'cancelled'
          : 'pending'
  const session = getStoredSession()
  const canAct =
    status === 'pending' &&
    Boolean(
      session?.user?.permissions?.includes('purchase.pr.approve') ||
        session?.user?.permissions?.includes('tenant.manage'),
    )
  const warehouses = useMasterStore.getState().warehouses
  const wh = warehouses.find((w) => w.id === pr.location.id)
  const submittedDate = pr.updatedAt || pr.createdAt
  return {
    approvalId: pr.id,
    documentType: 'purchase_requisition',
    documentTypeLabel: PURCHASE_APPROVAL_DOCUMENT_TYPE_LABELS.purchase_requisition,
    documentId: pr.id,
    documentNumber: pr.documentNumber,
    documentDate: pr.documentDate,
    requestedBy: pr.requester.name || pr.requester.id || '—',
    requesterId: pr.requester.id,
    department: prDepartmentLabel(pr.department || ''),
    locationId: pr.location.id,
    locationName: pr.location.name || wh?.warehouseName || wh?.warehouseCode || '—',
    amount: pr.totalAmount,
    priority: pr.priority,
    priorityLabel: PURCHASE_REQUISITION_PRIORITY_LABELS[pr.priority],
    submittedDate,
    pendingSinceDays: daysSince(submittedDate),
    approvalLevel: 1,
    approvalLevelLabel: '1 of 1 · Approver',
    chainLength: 1,
    status,
    statusLabel: PURCHASE_APPROVAL_STATUS_LABELS[status],
    approverId: '',
    approverName: '',
    approverRole: 'purchase_head',
    approverRoleLabel: 'Purchase Head',
    canAct: canAct || status === 'pending',
  }
}

function applyApprovalQueueFilters(
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
    return true
  })
}

/** Approvals inbox — API mode uses pending/approved/rejected PRs from backend. */
export async function getPurchaseApprovalQueue(
  tab: PurchaseApprovalQueueTab = 'pending_mine',
  filters: PurchaseApprovalQueueFilters = {},
): Promise<PurchaseApprovalQueueRow[]> {
  if (!isApiMode()) return demo.getPurchaseApprovalQueue(tab, filters)
  try {
    const statusByTab: Record<PurchaseApprovalQueueTab, string | undefined> = {
      pending_mine: 'PENDING_APPROVAL',
      approved_by_me: 'APPROVED',
      rejected_by_me: 'REJECTED',
      all_history: undefined,
    }
    const status = statusByTab[tab]
    const res = await prApi.listPurchaseRequisitionsApi({
      page: 1,
      limit: 100,
      sortOrder: 'desc',
      ...(status ? { status } : {}),
    })
    let rows = res.data
      .map(mapApiRequisitionToDomain)
      .filter((pr) => {
        if (tab === 'pending_mine') return pr.status === 'pending_approval'
        if (tab === 'approved_by_me') return pr.status === 'approved'
        if (tab === 'rejected_by_me') return pr.status === 'rejected'
        return ['pending_approval', 'approved', 'rejected', 'cancelled'].includes(pr.status)
      })
      .map(mapPrToApprovalQueueRow)
      .sort((a, b) => b.submittedDate.localeCompare(a.submittedDate))
    rows = applyApprovalQueueFilters(rows, filters)
    return rows
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseApprovalReview(
  approvalId: string,
): Promise<PurchaseApprovalReviewDetail> {
  if (!isApiMode()) return demo.getPurchaseApprovalReview(approvalId)
  try {
    const pr = await getPurchaseRequisitionById(approvalId)
    if (!pr) {
      throw new PurchaseServiceError('APPROVAL_NOT_FOUND', `Approval not found: ${approvalId}`)
    }
    const row = mapPrToApprovalQueueRow(pr)
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
      availableBudgetPlaceholderInr: 0,
      previousApprovals: [],
      attachments: [],
      chainRoles: ['purchase_head'] as PurchaseApprovalRole[],
    }
  } catch (err) {
    if (err instanceof PurchaseServiceError) throw err
    throwApi(err)
  }
}

export async function approvePurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks = 'Approved',
): Promise<PurchaseRequisition | PurchaseOrder> {
  if (!isApiMode()) return demo.approvePurchaseDocument(documentType, documentId, remarks)
  if (documentType !== 'purchase_requisition') {
    throw new PurchaseServiceError(
      'NOT_SUPPORTED',
      'Only purchase requisition approval is available in API mode yet.',
    )
  }
  return approvePurchaseRequisition(documentId, remarks)
}

export async function rejectPurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder> {
  if (!isApiMode()) return demo.rejectPurchaseDocument(documentType, documentId, remarks)
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Rejection comments are mandatory')
  }
  if (documentType !== 'purchase_requisition') {
    throw new PurchaseServiceError(
      'NOT_SUPPORTED',
      'Only purchase requisition rejection is available in API mode yet.',
    )
  }
  return rejectPurchaseRequisition(documentId, remarks)
}

export async function sendBackPurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder> {
  if (!isApiMode()) return demo.sendBackPurchaseDocument(documentType, documentId, remarks)
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Send-back comments are mandatory')
  }
  if (documentType !== 'purchase_requisition') {
    throw new PurchaseServiceError(
      'NOT_SUPPORTED',
      'Only purchase requisition send-back is available in API mode yet.',
    )
  }
  try {
    const res = await prApi.reopenPurchaseRequisitionApi(documentId, { remarks })
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function delegatePurchaseApproval(
  approvalId: string,
  toRole: PurchaseApprovalRole,
  remarks = '',
) {
  if (!isApiMode()) return demo.delegatePurchaseApproval(approvalId, toRole, remarks)
  throw new PurchaseServiceError(
    'NOT_SUPPORTED',
    'Approval delegation is not available in API mode yet.',
  )
}

export {
  canCreatePoFromPlanningRow,
  canSelectPlanningRowForPo,
  getPurchaseOrderSeriesOptions,
} from './purchaseService'

/**
 * Dashboard in API mode uses live PR + RFQ only.
 * PO / GRN / invoice backends are not mounted yet — those KPIs stay at zero (no demo seed).
 */
export async function getPurchaseDashboard(
  filters: PurchaseDashboardFilters = {},
): Promise<PurchaseDashboardData> {
  if (!isApiMode()) return demo.getPurchaseDashboard(filters)

  const [requisitions, rfqs, warehouses] = await Promise.all([
    getPurchaseRequisitions(),
    getRFQs(),
    getPurchaseWarehouses(),
  ])

  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo
  const locationId = filters.locationId
  const inDateRange = (isoDate: string) => {
    if (dateFrom && isoDate < dateFrom) return false
    if (dateTo && isoDate > dateTo) return false
    return true
  }
  const matchLocation = (locId: string) => !locationId || locId === locationId

  const prs = requisitions.filter(
    (r) => inDateRange(r.documentDate) && matchLocation(r.location.id),
  )
  const filteredRfqs = rfqs.filter(
    (r) => inDateRange(r.documentDate) && matchLocation(r.location.id),
  )

  const openRequisitions = prs.filter((r) =>
    ['draft', 'pending_approval', 'approved'].includes(r.status),
  ).length
  const pendingPrApprovals = prs.filter((r) => r.status === 'pending_approval').length
  const openRfqs = filteredRfqs.filter((r) => !['closed', 'cancelled'].includes(r.status)).length

  const emptyPoStatus = [
    { key: 'released', label: 'Released', count: 0, href: '/purchase/orders?status=released' },
    {
      key: 'partially_received',
      label: 'Partially Received',
      count: 0,
      href: '/purchase/orders?status=partially_received',
    },
    {
      key: 'fully_received',
      label: 'Fully Received',
      count: 0,
      href: '/purchase/orders?status=fully_received',
    },
    { key: 'overdue', label: 'Overdue', count: 0, href: '/purchase/orders?status=overdue' },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const monthlyTrend = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(`${today}T00:00:00`)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyTrend.push({
      month: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      value: 0,
    })
  }

  return {
    kpis: {
      openRequisitions,
      pendingPrApprovals,
      openRfqs,
      purchaseOrdersThisMonth: 0,
      pendingDeliveries: 0,
      pendingGrns: 0,
      pendingPurchaseInvoices: 0,
      monthlyPurchaseValue: 0,
    },
    kpiHrefs: {
      openRequisitions: '/purchase/requisitions',
      pendingPrApprovals: '/purchase/requisitions?status=pending_approval',
      openRfqs: '/purchase/rfqs',
      purchaseOrdersThisMonth: '/purchase/orders',
      pendingDeliveries: '/purchase/orders?status=overdue',
      pendingGrns: '/purchase/grn',
      pendingPurchaseInvoices: '/purchase/invoices',
      monthlyPurchaseValue: '/purchase/orders',
    },
    prStatus: [
      {
        key: 'draft',
        label: 'Draft',
        count: prs.filter((r) => r.status === 'draft').length,
        href: '/purchase/requisitions?status=draft',
      },
      {
        key: 'pending_approval',
        label: 'Pending Approval',
        count: pendingPrApprovals,
        href: '/purchase/requisitions?status=pending_approval',
      },
      {
        key: 'approved',
        label: 'Approved',
        count: prs.filter((r) => r.status === 'approved').length,
        href: '/purchase/requisitions?status=approved',
      },
      {
        key: 'converted',
        label: 'Converted',
        count: prs.filter((r) =>
          ['converted_to_rfq', 'converted_to_po'].includes(r.status),
        ).length,
        href: '/purchase/requisitions?status=converted',
      },
    ],
    poStatus: emptyPoStatus,
    upcomingDeliveries: [],
    pendingActions: [
      {
        id: 'pr-approval',
        type: 'pr_approval' as const,
        label: 'PR approvals',
        count: pendingPrApprovals,
        href: '/purchase/requisitions?status=pending_approval',
        severity: 'primary' as const,
      },
    ].filter((a) => a.count > 0),
    monthlyTrend,
    byCategory: [],
    topVendors: [],
    recentActivity: prs
      .slice(0, 10)
      .map((r) => ({
        id: `act-pr-${r.id}`,
        at: r.updatedAt ?? r.createdAt,
        summary: `PR ${r.documentNumber} · ${r.status.replace(/_/g, ' ')}`,
        href: `/purchase/requisitions/${r.id}`,
        kind: 'purchase_requisition' as const,
      }))
      .sort((a, b) => b.at.localeCompare(a.at)),
    locations: warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name })),
    pendingApprovals: [],
    currency: 'INR',
    asOf: new Date().toISOString(),
    filtersApplied: filters,
  }
}

/** Prefer vendors linked on items; otherwise return active vendors (no demo seed). */
export async function getRecommendedVendorsForItems(itemIds: string[]): Promise<Vendor[]> {
  if (!isApiMode()) return demo.getRecommendedVendorsForItems(itemIds)
  const [items, vendors] = await Promise.all([getPurchaseItems(), getVendors()])
  const preferred = new Set(
    itemIds
      .map((id) => items.find((i) => i.id === id)?.preferredVendorId)
      .filter((v): v is string => Boolean(v)),
  )
  const fromPreferred = vendors.filter((v) => preferred.has(v.id) && v.isActive)
  if (fromPreferred.length >= 2) return fromPreferred
  const extras = vendors.filter((v) => v.isActive && !preferred.has(v.id)).slice(0, 3)
  return [...fromPreferred, ...extras]
}

function mapItemTypeToCategory(itemType: MasterItem['itemType']): PurchaseItemCategory {
  switch (itemType) {
    case 'raw':
      return 'raw_material'
    case 'bought_out':
      return 'component'
    case 'consumable':
      return 'consumable'
    case 'sub_assembly':
      return 'component'
    case 'finished_good':
      return 'component'
    default:
      return 'consumable'
  }
}

function mapMasterItemToPurchaseItem(item: MasterItem): PurchaseItem {
  const uom =
    useMasterStore.getState().uoms.find((u) => u.id === item.baseUomId)?.uomCode ??
    useMasterStore.getState().uoms.find((u) => u.id === item.baseUomId)?.uomName ??
    'NOS'
  return {
    id: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    category: mapItemTypeToCategory(item.itemType),
    description: item.itemDescription ?? '',
    uomId: item.baseUomId || null,
    uom,
    hsnCode: item.hsnCode ?? '',
    sacCode: null,
    gstRatePct: 18,
    standardRate: Number(item.standardRate ?? 0),
    reorderLevel: Number(item.reorderLevel ?? 0),
    preferredVendorId: null,
    isStockable: Boolean(item.isStockable),
    qcRequired: Boolean(item.qcRequired),
    batchControlled: false,
    serialControlled: false,
    expiryControlled: false,
    isActive: item.isActive !== false && item.isBlocked !== true,
    remarks: '',
    createdBy: 'API',
    createdAt: item.createdAt,
    updatedBy: null,
    updatedAt: item.updatedAt ?? null,
  }
}

function mapMasterVendorToPurchaseVendor(v: MasterVendor): Vendor {
  const vendorType =
    v.vendorType === 'service' ? 'service' : v.vendorType === 'trader' ? 'trader' : 'manufacturer'
  return {
    id: v.id,
    vendorCode: v.vendorCode,
    vendorName: v.vendorName,
    vendorType,
    contactPerson: v.contactPerson ?? '',
    contactPhone: v.contactPhone ?? '',
    contactEmail: v.email ?? '',
    address: v.address ?? '',
    city: v.city ?? '',
    state: v.state ?? '',
    stateCode: '',
    pincode: v.pincode ?? '',
    gstin: v.gstin ?? '',
    pan: v.pan ?? '',
    isInterstate: false,
    paymentTerms: v.paymentTermsDays ? `Net ${v.paymentTermsDays}` : '',
    deliveryTerms: '',
    currency: 'INR',
    leadTimeDays: Number(v.defaultLeadTimeDays ?? 0),
    rating: Number(v.rating ?? 0),
    qualityScore: 0,
    deliveryScore: 0,
    isActive: v.isActive !== false && v.isBlocked !== true,
    remarks: '',
    createdBy: 'API',
    createdAt: v.createdAt,
    updatedBy: v.modifiedByName ?? null,
    updatedAt: v.modifiedAt ?? null,
  }
}

/** Items for PR/PO pickers — master store in API mode, demo seed otherwise. */
export async function getPurchaseItems(): Promise<PurchaseItem[]> {
  if (!isApiMode()) return demo.getPurchaseItems()
  let items = useMasterStore.getState().items
  if (!items.length) {
    try {
      const { syncBatchMastersFromApi } = await import('../bridges/masterBatchApiBridge')
      await syncBatchMastersFromApi()
      items = useMasterStore.getState().items
    } catch {
      /* keep empty — UI shows no matching items */
    }
  }
  return items
    .filter((i) => i.isActive !== false && i.isBlocked !== true && i.isPurchasable !== false)
    .map(mapMasterItemToPurchaseItem)
}

/** Vendors for purchase docs — master store in API mode, demo seed otherwise. */
export async function getVendors(): Promise<Vendor[]> {
  if (!isApiMode()) return demo.getVendors()
  let vendors = useMasterStore.getState().vendors
  if (!vendors.length) {
    try {
      const { syncBatchMastersFromApi } = await import('../bridges/masterBatchApiBridge')
      await syncBatchMastersFromApi()
      vendors = useMasterStore.getState().vendors
    } catch {
      /* keep empty */
    }
  }
  return vendors
    .filter((v) => v.isActive !== false && v.isBlocked !== true)
    .map(mapMasterVendorToPurchaseVendor)
}

export type PurchaseWarehouseOption = {
  id: string
  code: string
  name: string
  state: string
  city: string
}

/** Warehouses used as PR/PO location — master store in API mode. */
export async function getPurchaseWarehouses(): Promise<PurchaseWarehouseOption[]> {
  if (!isApiMode()) {
    const { PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG } = await import(
      '../../data/purchase/purchaseDomainSeed'
    )
    return [
      {
        id: PURCHASE_DEMO_LOCATION.id,
        code: PURCHASE_DEMO_LOCATION.code,
        name: PURCHASE_DEMO_LOCATION.name,
        state: PURCHASE_DEMO_LOCATION.state,
        city: PURCHASE_DEMO_LOCATION.city,
      },
      {
        id: PURCHASE_DEMO_LOCATION_FG.id,
        code: PURCHASE_DEMO_LOCATION_FG.code,
        name: PURCHASE_DEMO_LOCATION_FG.name,
        state: PURCHASE_DEMO_LOCATION_FG.state,
        city: PURCHASE_DEMO_LOCATION_FG.city,
      },
    ]
  }
  return useMasterStore
    .getState()
    .warehouses.filter((w) => w.isActive !== false)
    .map((w) => ({
      id: w.id,
      code: w.warehouseCode,
      name: w.warehouseName,
      state: '',
      city: '',
    }))
}

export type { PlanningSheetSummary }
