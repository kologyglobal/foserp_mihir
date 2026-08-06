/**
 * Dual-mode purchase facade.
 * `VITE_USE_API=true` → backend is source of truth for PR, Planning, RFQ flow, PO, GRN,
 * Purchase Invoice, Quality Inspection, and Purchase Return.
 * Demo mode keeps in-memory `purchaseService` behavior.
 * Approval / conversion / PO creation never use optimistic local updates in API mode.
 */

import { isApiMode } from '../../config/apiConfig'
import { apiRequest, tenantPath } from '../api/client'
import { useMasterStore } from '../../store/masterStore'
import type { Item as MasterItem, Vendor as MasterVendor } from '../../types/master'
import { deriveEngineeringProductTypeFromMaster, normalizeEngineeringProductType } from '../../utils/purchaseProductType'
import { resolveGstStateCode } from '../../utils/gstStateCode'
import { determinePurchaseGstSupply } from '../../utils/gstSupply'
import { resolveLineTaxFromLocalMasters } from '../../utils/commercialLineTax'
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
  PurchaseOrderInput,
  PurchaseOrderLinkedDocuments,
  PurchaseOrderListRow,
  PurchasePlanningSheetInput,
  PurchasePlanningSheetRow,
  PurchaseRequisition,
  PurchaseRequisitionInput,
  PurchaseRequisitionListRow,
  PurchaseRequisitionRevisionSnapshot,
  PurchaseSetup,
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
  GoodsReceiptNote,
  GrnInput,
  GrnListRow,
  PurchaseInvoice,
  PurchaseInvoiceInput,
  PurchaseInvoiceListRow,
  InvoiceMatchingResult,
  QualityInspection,
  QualityInspectionInput,
  QualityInspectionListRow,
  QualityInspectionParameter,
  PurchaseReturn,
  PurchaseReturnInput,
  PurchaseReturnListRow,
  PurchaseReturnOrigin,
  PurchaseReturnReason,
  ReturnWizardPrefill,
  SupplierQualityDashboardWidgets,
  ItemSupplierQualityHistory,
  VendorQualityScorecard,
} from '../../types/purchaseDomain'
import { INVOICE_MATCHING_RESULT_STATUS_LABELS } from '../../types/purchaseDomain'
import { ApiError } from '../api/apiErrors'
import * as demo from './purchaseService'
import { PurchaseServiceError, type PurchaseOrderSeriesOption, type CreatePurchaseOrderFromPrOptions } from './purchaseService'
export type { CreatePurchaseOrderFromPrOptions }
import * as prApi from './purchaseRequisitionApi'
import * as approvalApi from './purchaseApprovalApi'
import * as planningApi from './purchasePlanningApi'
import * as rfqApi from './rfqApi'
import * as vqApi from './vendorQuotationApi'
import * as comparisonApi from './comparisonApi'
import * as poApi from './purchaseOrderApi'
import * as grnApi from './goodsReceiptApi'
import * as invoiceApi from './purchaseInvoiceApi'
import * as qiApi from './qualityInspectionApi'
import * as returnApi from './purchaseReturnApi'
import * as supplierQualityApi from './supplierQualityApi'
import * as setupApi from '../api/purchaseSetupApi'
import {
  aggregateGrniReportToDashboardRows,
  buildPurchaseDashboardGrniRows,
  type GrniReportApiRow,
} from './purchaseDashboardGrni'
import {
  formatPurchaseApiError,
  isBackendMissingError,
  mapApiComparisonToDomain,
  mapApiGoodsReceiptToDomain,
  mapApiGoodsReceiptToListRow,
  mapApiPlanningRowToDomain,
  mapApiPurchaseOrderToDomain,
  mapApiPurchaseOrderToListRow,
  mapApiRequisitionToDomain,
  mapApiRequisitionToListRow,
  mapApiRfqToDomain,
  mapApiRfqToListRow,
  mapApiVendorQuotationToDomain,
  mapApiVendorQuotationToListRow,
  mapDomainGrnInputToApiPayload,
  mapDomainInputToApiPayload,
  mapDomainPoInputToApiPayload,
  mapDomainRfqInputToApiPayload,
  mapDomainVendorQuotationInputToApiPayload,
  mapPlanningPatchToApi,
  mapApiPurchaseInvoiceToDomain,
  mapApiPurchaseInvoiceToListRow,
  mapDomainPurchaseInvoiceInputToApiPayload,
  mapApiQualityInspectionToDomain,
  mapApiQualityInspectionToListRow,
  mapDomainQualityInspectionInputToApiPayload,
  mapApiPurchaseReturnToDomain,
  mapApiPurchaseReturnToListRow,
  mapDomainPurchaseReturnInputToApiPayload,
} from './purchaseMappers'
import type { PlanningSheetSummary } from './purchaseApiTypes'

function throwApi(err: unknown): never {
  const { code, message, fieldErrors } = formatPurchaseApiError(err)
  throw new PurchaseServiceError(code, message, fieldErrors)
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

/** Peek next RFQ number without consuming the series. */
export async function previewNextRfqNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextRfqNumber()
  try {
    const res = await rfqApi.previewNextRfqNumberApi()
    return res.data.rfqNumber
  } catch (err) {
    throwApi(err)
  }
}

/** Peek next vendor quotation number without consuming the series. */
export async function previewNextVendorQuotationNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextVendorQuotationNumber()
  try {
    const res = await vqApi.previewNextVendorQuotationNumberApi()
    return res.data.quotationNumber
  } catch (err) {
    throwApi(err)
  }
}

/** Peek next PO number without consuming the series. */
export async function previewNextPurchaseOrderNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextPurchaseOrderNumber()
  try {
    const res = await poApi.previewNextPurchaseOrderNumberApi()
    return res.data.orderNumber
  } catch (err) {
    throwApi(err)
  }
}

/** Peek next GRN number without consuming the series. */
export async function previewNextGoodsReceiptNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextGoodsReceiptNumber()
  try {
    const res = await grnApi.previewNextGoodsReceiptNumberApi()
    return res.data.grnNumber
  } catch (err) {
    throwApi(err)
  }
}

/** Peek next invoice number. No backend preview endpoint — number is allocated on save. */
export async function previewNextPurchaseInvoiceNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextPurchaseInvoiceNumber()
  throw new PurchaseServiceError(
    'PURCHASE_API_NOT_IMPLEMENTED',
    'Invoice number is allocated on save.',
  )
}

/** Peek next return number. No backend preview endpoint — number is allocated on save. */
export async function previewNextPurchaseReturnNumber(): Promise<string> {
  if (!isApiMode()) return demo.previewNextPurchaseReturnNumber()
  throw new PurchaseServiceError(
    'PURCHASE_API_NOT_IMPLEMENTED',
    'Return number is allocated on save.',
  )
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
    const pageSize = 100
    let page = 1
    const rows: ReturnType<typeof mapApiPlanningRowToDomain>[] = []
    for (;;) {
      const res = await planningApi.listPlanningSheetApi({
        page,
        pageSize,
        sortOrder: 'desc',
      })
      rows.push(...res.data.map(mapApiPlanningRowToDomain))
      const total = res.meta?.total ?? rows.length
      if (rows.length >= total || res.data.length < pageSize) break
      page += 1
      if (page > 50) break
    }
    return rows
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

export async function splitPurchasePlanningRowByVendor(
  id: string,
  splits: Array<{ vendorId: string; allocatedQuantity: number }>,
): Promise<PurchasePlanningSheetRow[]> {
  if (!isApiMode()) return demo.splitPurchasePlanningRowByVendor(id, splits)
  try {
    await ensureMasterVendorsForMapping()
    const res = await planningApi.splitPlanningRowApi(id, { splits })
    return res.data.map(mapApiPlanningRowToDomain)
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
  options?: {
    seriesPrefix?: string
    orderDate?: string
    deliveryWarehouseId?: string
    deliveryAddress?: string
    remarks?: string
    orderQuantities?: Record<string, number>
  },
): Promise<PurchaseOrder[]> {
  if (!isApiMode()) return demo.createPurchaseOrdersFromPlanningSelection(planningRowIds, options)
  try {
    const res = await poApi.createPurchaseOrdersFromPlanningApi({
      rowIds: planningRowIds,
      orderDate: options?.orderDate,
      deliveryWarehouseId: options?.deliveryWarehouseId,
      deliveryAddress: options?.deliveryAddress,
      remarks: options?.remarks,
      orderQuantities: options?.orderQuantities,
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

export async function createPurchaseOrdersFromConsolidation(payload: {
  planningRowIds: string[]
  allocations: Array<{ vendorId: string; quantity: number; rate: number }>
}): Promise<PurchaseOrder[]> {
  if (!isApiMode()) {
    return demo.createPurchaseOrdersFromConsolidation(payload)
  }
  try {
    const res = await planningApi.createPurchaseOrdersFromConsolidationApi(payload)
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
    throwIfMissing(err, 'Create PO from consolidation')
  }
}

export async function createPurchaseOrderFromPlanningRow(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.createPurchaseOrderFromPlanningRow(id)
  const orders = await createPurchaseOrdersFromPlanningSelection([id])
  if (!orders[0]) throw new PurchaseServiceError('PPS_PO_NOT_READY', 'PO was not created')
  return orders[0]
}

/**
 * Create PO from an approved PR (optionally a line subset + partial qtys).
 * Demo: direct PO from PR lines.
 * API: RFQ-required PRs are blocked; direct PRs use Planning Sheet create-PO.
 */
export async function createPurchaseOrderFromPr(
  prId: string,
  vendorId?: string,
  options?: CreatePurchaseOrderFromPrOptions,
): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.createPurchaseOrderFromPr(prId, vendorId, options)

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

  if (options?.lineIds?.length) {
    const want = new Set(options.lineIds)
    rows = rows.filter((r) => want.has(r.purchaseRequisitionLineId))
  }

  if (rows.length === 0) {
    throw new PurchaseServiceError(
      'PPS_PO_NOT_READY',
      options?.lineIds?.length
        ? 'No Planning Sheet rows for the selected PR lines. Open Planning Sheet, set vendor/rate, then create PO.'
        : 'No Planning Sheet rows for this PR. Open Planning Sheet after approval, set vendor/rate, then create PO.',
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
    if (options?.lineIds?.length) {
      const want = new Set(options.lineIds)
      rows = rows.filter((r) => want.has(r.purchaseRequisitionLineId))
    }
  }

  const eligible = rows.filter(demo.canSelectPlanningRowForPo)
  if (eligible.length === 0) {
    throw new PurchaseServiceError(
      'PPS_PO_NOT_READY',
      'Planning rows need vendor, rate, and quantity before PO creation. Open the Planning Sheet to complete them.',
    )
  }

  const orderQuantitiesByRow: Record<string, number> = {}
  if (options?.orderQuantities) {
    for (const row of eligible) {
      const q = options.orderQuantities[row.purchaseRequisitionLineId]
      if (q != null && Number.isFinite(q) && q > 0) {
        orderQuantitiesByRow[row.id] = q
      }
    }
  }

  const orders = await createPurchaseOrdersFromPlanningSelection(
    eligible.map((r) => r.id),
    Object.keys(orderQuantitiesByRow).length ? { orderQuantities: orderQuantitiesByRow } : undefined,
  )
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

/* ─── Purchase Orders (create / update / lifecycle) — backend is source of truth ─── */

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.createPurchaseOrder(input)
  try {
    const res = await poApi.createPurchaseOrderApi(
      mapDomainPoInputToApiPayload(input) as unknown as Record<string, unknown>,
    )
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderInput,
): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.updatePurchaseOrder(id, input)
  try {
    const res = await poApi.updatePurchaseOrderApi(
      id,
      mapDomainPoInputToApiPayload(input) as unknown as Record<string, unknown>,
    )
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.submitPurchaseOrder(id)
  try {
    const res = await poApi.submitPurchaseOrderApi(id, {})
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function approvePurchaseOrder(id: string, remarks = ''): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.approvePurchaseOrder(id, remarks)
  try {
    const res = await poApi.approvePurchaseOrderApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function rejectPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'PO rejection requires API mode.')
  }
  try {
    const res = await poApi.rejectPurchaseOrderApi(id, { reason })
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function sendBackPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'PO send-back requires API mode.')
  }
  try {
    const res = await poApi.sendBackPurchaseOrderApi(id, { reason })
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/** "Release" maps to send-to-vendor on the backend (approved → sent_to_vendor). */
export async function releasePurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.releasePurchaseOrder(id)
  return sendPurchaseOrderToVendor(id)
}

export async function sendPurchaseOrderToVendor(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.sendPurchaseOrderToVendor(id)
  try {
    const res = await poApi.sendPurchaseOrderToVendorApi(id, {})
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelPurchaseOrder(id: string, reason = ''): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.cancelPurchaseOrder(id, reason)
  try {
    const res = await poApi.cancelPurchaseOrderApi(id, reason ? { remarks: reason } : {})
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function closePurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.closePurchaseOrder(id)
  try {
    const res = await poApi.closePurchaseOrderApi(id, {})
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function reopenPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.reopenPurchaseOrder(id)
  try {
    const res = await poApi.reopenPurchaseOrderApi(id, {})
    return mapApiPurchaseOrderToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/** PO revision (versioned amendments) — API persists Rev N snapshots. */
export async function revisePurchaseOrder(
  id: string,
  input: Parameters<typeof demo.revisePurchaseOrder>[1],
): Promise<PurchaseOrder> {
  if (!isApiMode()) return demo.revisePurchaseOrder(id, input)
  try {
    const payload: Record<string, unknown> = {
      reason: input.reason,
    }
    if (input.expectedDeliveryDate != null) payload.expectedDeliveryDate = input.expectedDeliveryDate
    if (input.paymentTerms != null) payload.paymentTerms = input.paymentTerms
    if (input.deliveryTerms != null) payload.deliveryTerms = input.deliveryTerms
    if (input.freight != null) payload.freightAmount = input.freight
    if (input.remarks != null) payload.remarks = input.remarks
    if (input.lines?.length) {
      payload.lines = input.lines.map((l) => ({
        id: l.id,
        quantity: l.quantity,
        rate: l.rate,
      }))
    }
    const res = await poApi.revisePurchaseOrderApi(id, payload)
    return mapApiPurchaseOrderToDomain(res.data)
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
  const [grnRes, invRes, retRes] = await Promise.all([
    grnApi.listGoodsReceiptsApi({ page: 1, pageSize: 100, purchaseOrderId: id, sortOrder: 'desc' }),
    invoiceApi.listPurchaseInvoicesApi({ page: 1, limit: 100, purchaseOrderId: id, sortOrder: 'desc' }),
    returnApi.listPurchaseReturnsApi({ page: 1, limit: 100, purchaseOrderId: id, sortOrder: 'desc' }),
  ])
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
    grns: grnRes.data.map((g) => {
      const mapped = mapApiGoodsReceiptToListRow(g)
      return {
        id: mapped.id,
        documentNumber: mapped.documentNumber,
        status: mapped.status,
        documentDate: mapped.documentDate,
      }
    }),
    invoices: invRes.data.map((i) => {
      const mapped = mapApiPurchaseInvoiceToListRow(i)
      return {
        id: mapped.id,
        documentNumber: mapped.documentNumber,
        status: mapped.status,
        documentDate: mapped.documentDate,
      }
    }),
    returns: retRes.data.map((r) => {
      const mapped = mapApiPurchaseReturnToListRow(r)
      return {
        id: mapped.id,
        documentNumber: mapped.documentNumber,
        status: mapped.status,
        documentDate: mapped.documentDate,
      }
    }),
  }
}

/* ─── Goods Receipt Notes (GRN) ─── */

export async function getGRNs(): Promise<GoodsReceiptNote[]> {
  if (!isApiMode()) return demo.getGRNs()
  try {
    const res = await grnApi.listGoodsReceiptsApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiGoodsReceiptToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getGrnList(): Promise<GrnListRow[]> {
  if (!isApiMode()) return demo.getGrnList()
  try {
    const res = await grnApi.listGoodsReceiptsApi({ page: 1, pageSize: 100, sortOrder: 'desc' })
    return res.data.map(mapApiGoodsReceiptToListRow)
  } catch (err) {
    throwApi(err)
  }
}

async function enrichGrnWithQualityInspectionId(
  grn: GoodsReceiptNote,
): Promise<GoodsReceiptNote> {
  if (!grn.inspectionRequired || grn.qualityInspectionId) return grn
  try {
    const res = await qiApi.listQualityInspectionsApi({
      goodsReceiptId: grn.id,
      page: 1,
      limit: 1,
      sortOrder: 'desc',
    })
    const linked = res.data[0]
    if (linked) return { ...grn, qualityInspectionId: linked.id }
  } catch {
    // Non-fatal — GRN detail can still link via grnId filter on the QI register.
  }
  return grn
}

export async function getGRNById(id: string): Promise<GoodsReceiptNote | null> {
  if (!isApiMode()) return demo.getGRNById(id)
  try {
    const res = await grnApi.getGoodsReceiptApi(id)
    return enrichGrnWithQualityInspectionId(mapApiGoodsReceiptToDomain(res.data))
  } catch (err) {
    if (isBackendMissingError(err)) return null
    const { code } = formatPurchaseApiError(err)
    if (code === 'GRN_NOT_FOUND' || code === 'NOT_FOUND') return null
    throwApi(err)
  }
}

export async function createGRNFromPo(input: GrnInput): Promise<GoodsReceiptNote> {
  if (!isApiMode()) return demo.createGRNFromPo(input)
  try {
    const res = await grnApi.createGoodsReceiptApi(mapDomainGrnInputToApiPayload(input))
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function createGRN(input: GrnInput): Promise<GoodsReceiptNote> {
  return createGRNFromPo(input)
}

export async function updateGRN(id: string, input: Partial<GrnInput>): Promise<GoodsReceiptNote> {
  if (!isApiMode()) return demo.updateGRN(id, input)
  try {
    const payload = mapDomainGrnInputToApiPayload({
      purchaseOrderId: input.purchaseOrderId || '',
      lines: input.lines || [],
      ...input,
    } as GrnInput)
    // purchaseOrderId cannot change on update
    delete payload.purchaseOrderId
    if (!input.lines) delete payload.lines
    const res = await grnApi.updateGoodsReceiptApi(id, payload)
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function submitGRN(id: string): Promise<GoodsReceiptNote> {
  if (!isApiMode()) return demo.submitGRN(id)
  try {
    const res = await grnApi.submitGoodsReceiptApi(id, {})
    let grn = mapApiGoodsReceiptToDomain(res.data)
    if (grn.status === 'pending_tolerance_approval') {
      return grn
    }
    if (grn.inspectionRequired && !grn.qualityInspectionId) {
      const qcLine =
        grn.lines.find((l) => l.inspectionStatus === 'pending' || l.pendingInspectionQty > 0)
        ?? grn.lines[0]
      if (qcLine) {
        try {
          const qi = await createQualityInspection({
            goodsReceiptId: grn.id,
            goodsReceiptLineId: qcLine.id,
            sampleQty: Math.min(5, qcLine.receivedQty || qcLine.pendingInspectionQty || 1),
          })
          grn = { ...grn, qualityInspectionId: qi.id }
        } catch (err) {
          grn = await enrichGrnWithQualityInspectionId(grn)
          if (!grn.qualityInspectionId) {
            // GRN submit already succeeded — do not fail the whole action on QI bootstrap.
            console.warn('[submitGRN] QI auto-create failed after submit', err)
          }
        }
      }
    }
    return grn
  } catch (err) {
    throwApi(err)
  }
}

export async function approveToleranceGRN(id: string, remarks = ''): Promise<GoodsReceiptNote> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'Tolerance approval is only available in API mode.')
  }
  try {
    const res = await grnApi.approveToleranceGoodsReceiptApi(id, remarks ? { remarks } : {})
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function rejectToleranceGRN(id: string, remarks = ''): Promise<GoodsReceiptNote> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'Tolerance rejection is only available in API mode.')
  }
  try {
    const res = await grnApi.rejectToleranceGoodsReceiptApi(id, remarks ? { remarks } : {})
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/** Demo posts stock locally; API mode calls GRN `post-inventory` (idempotent). */
export async function postGRN(id: string): Promise<GoodsReceiptNote> {
  if (!isApiMode()) return demo.postGRN(id)
  try {
    const current = await getGRNById(id)
    if (!current) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${id}`)
    if (current.status === 'draft') {
      // submitGRN mapper sets inventoryPostDeferred from backend INVENTORY_POSTED status.
      return submitGRN(id)
    }
    const res = await grnApi.postInventoryGoodsReceiptApi(id, {})
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelGRN(id: string, remarks = ''): Promise<GoodsReceiptNote> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'Cancel GRN is only available in API mode.')
  }
  try {
    const res = await grnApi.cancelGoodsReceiptApi(id, remarks ? { remarks } : {})
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function reverseGRN(
  id: string,
  remarks = '',
  options?: { lineIds?: string[] },
): Promise<GoodsReceiptNote> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'Reverse GRN is only available in API mode.')
  }
  try {
    const payload: Record<string, unknown> = {}
    if (remarks.trim()) payload.remarks = remarks.trim()
    if (options?.lineIds?.length) payload.lineIds = options.lineIds
    const res = await grnApi.reverseGoodsReceiptApi(id, payload)
    return mapApiGoodsReceiptToDomain(res.data)
  } catch (err) {
    throwApi(err)
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

/** Approvals inbox — API mode uses GET /purchase/approvals (PR + PO + GRN tolerance). */
export async function getPurchaseApprovalQueue(
  tab: PurchaseApprovalQueueTab = 'pending_mine',
  filters: PurchaseApprovalQueueFilters = {},
): Promise<PurchaseApprovalQueueRow[]> {
  if (!isApiMode()) return demo.getPurchaseApprovalQueue(tab, filters)
  try {
    const documentType =
      filters.documentType === 'purchase_requisition'
        ? 'PURCHASE_REQUISITION'
        : filters.documentType === 'purchase_order'
          ? 'PURCHASE_ORDER'
          : filters.documentType === 'goods_receipt_note'
            ? 'GOODS_RECEIPT'
            : undefined
    const res = await approvalApi.listPurchaseApprovalsApi({
      page: 1,
      limit: 100,
      tab,
      documentType,
      documentNumber: filters.documentNumber,
      requester: filters.requester,
      department: filters.department,
      locationId: filters.locationId,
    })
    let rows = res.data ?? []
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
    const res = await approvalApi.getPurchaseApprovalApi(approvalId)
    const detail = res.data
    return {
      ...detail,
      previousApprovals: detail.previousApprovals ?? [],
      attachments: detail.attachments ?? [],
      chainRoles: detail.chainRoles ?? [],
      eligibleApprovers: detail.eligibleApprovers ?? [],
    }
  } catch (err) {
    throwApi(err)
  }
}

export async function approvePurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks = 'Approved',
): Promise<PurchaseRequisition | PurchaseOrder | GoodsReceiptNote> {
  if (!isApiMode()) return demo.approvePurchaseDocument(documentType, documentId, remarks)
  if (documentType === 'purchase_requisition') {
    return approvePurchaseRequisition(documentId, remarks)
  }
  if (documentType === 'purchase_order') {
    return approvePurchaseOrder(documentId, remarks)
  }
  if (documentType === 'goods_receipt_note') {
    return approveToleranceGRN(documentId, remarks)
  }
  throw new PurchaseServiceError(
    'NOT_SUPPORTED',
    'Only PR, PO, and GRN tolerance approvals are available in API mode yet.',
  )
}

export async function rejectPurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder | GoodsReceiptNote> {
  if (!isApiMode()) return demo.rejectPurchaseDocument(documentType, documentId, remarks)
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Rejection comments are mandatory')
  }
  if (documentType === 'purchase_requisition') {
    return rejectPurchaseRequisition(documentId, remarks)
  }
  if (documentType === 'purchase_order') {
    return rejectPurchaseOrder(documentId, remarks)
  }
  if (documentType === 'goods_receipt_note') {
    return rejectToleranceGRN(documentId, remarks)
  }
  throw new PurchaseServiceError(
    'NOT_SUPPORTED',
    'Only PR, PO, and GRN tolerance rejection are available in API mode yet.',
  )
}

export async function sendBackPurchaseDocument(
  documentType: PurchaseApprovalDocumentType,
  documentId: string,
  remarks: string,
): Promise<PurchaseRequisition | PurchaseOrder | GoodsReceiptNote> {
  if (!isApiMode()) return demo.sendBackPurchaseDocument(documentType, documentId, remarks)
  if (!remarks.trim()) {
    throw new PurchaseServiceError('REMARKS_REQUIRED', 'Send-back comments are mandatory')
  }
  if (documentType === 'goods_receipt_note') {
    return rejectToleranceGRN(documentId, remarks)
  }
  if (documentType === 'purchase_order') {
    return sendBackPurchaseOrder(documentId, remarks)
  }
  if (documentType !== 'purchase_requisition') {
    throw new PurchaseServiceError(
      'NOT_SUPPORTED',
      'Only PR, PO, and GRN tolerance send-back are available in API mode yet.',
    )
  }
  try {
    const res = await prApi.sendBackPurchaseRequisitionApi(documentId, {
      reason: remarks,
      remarks,
    })
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function revisePurchaseRequisition(
  id: string,
  input: {
    reason: string
    requiredDate?: string | null
    purchasePurpose?: string | null
    remarks?: string | null
    lines?: Array<{ id: string; requiredQuantity?: number; estimatedRate?: number }>
  },
): Promise<PurchaseRequisition> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'PR revision is API mode only in this build.')
  }
  try {
    const res = await prApi.revisePurchaseRequisitionApi(id, input)
    return mapApiRequisitionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseRequisitionRevisions(
  id: string,
): Promise<PurchaseRequisitionRevisionSnapshot[]> {
  if (!isApiMode()) return []
  try {
    const res = await prApi.listPurchaseRequisitionRevisionsApi(id)
    return (res.data ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id ?? ''),
        revisionNo: Number(row.revisionNo ?? 0),
        reason: String(row.reason ?? ''),
        revisedAt: String(row.revisedAt ?? row.createdAt ?? ''),
        revisedById: row.revisedById != null ? String(row.revisedById) : null,
        headerSnapshot: row.headerSnapshot,
        linesSnapshot: row.linesSnapshot,
        changes: row.changes,
      }
    })
  } catch (err) {
    throwApi(err)
  }
}

export async function delegatePurchaseApproval(
  approvalId: string,
  toUserId: string,
  remarks = '',
) {
  if (!isApiMode()) {
    return demo.delegatePurchaseApproval(
      approvalId,
      toUserId as PurchaseApprovalRole,
      remarks,
    )
  }
  try {
    return (await approvalApi.delegatePurchaseApprovalApi(approvalId, {
      toUserId,
      remarks,
    })).data
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseOrderSeriesOptions(): Promise<PurchaseOrderSeriesOption[]> {
  // Demo and API mode both use the Purchase Setup series config for the modal label.
  // Server still issues the real PO number on create-po.
  if (!isApiMode()) return demo.getPurchaseOrderSeriesOptions()
  try {
    const setup = await getPurchaseSetup()
    const series = setup.numberSeries.purchaseOrder
    const prefix = series.prefix || 'PO'
    return [
      {
        id: 'po-master',
        code: prefix,
        label: `Purchase Order (${prefix})`,
        prefix,
      },
    ]
  } catch {
    return [
      {
        id: 'po-master',
        code: 'PO',
        label: 'Purchase Order (PO)',
        prefix: 'PO',
      },
    ]
  }
}

export {
  canCreatePoFromPlanningRow,
  canSelectPlanningRowForPo,
  planningOrderableQuantity,
} from './purchaseService'

/**
 * Dashboard in API mode uses live PR + RFQ only.
 * API mode: PR/RFQ/PO/GRN/invoice KPIs from live lists (client-side aggregates; no dedicated BE dashboard API).
 */
export async function getPurchaseDashboard(
  filters: PurchaseDashboardFilters = {},
): Promise<PurchaseDashboardData> {
  if (!isApiMode()) return demo.getPurchaseDashboard(filters)

  // Soft-fail individual registers so one schema/API gap does not blank the whole dashboard.
  const [requisitions, rfqs, warehouses, orders, grns, invoices] = await Promise.all([
    getPurchaseRequisitions().catch(() => [] as Awaited<ReturnType<typeof getPurchaseRequisitions>>),
    getRFQs().catch(() => [] as Awaited<ReturnType<typeof getRFQs>>),
    getPurchaseWarehouses().catch(() => [] as Awaited<ReturnType<typeof getPurchaseWarehouses>>),
    getPurchaseOrders().catch(() => [] as Awaited<ReturnType<typeof getPurchaseOrders>>),
    getGRNs().catch(() => [] as Awaited<ReturnType<typeof getGRNs>>),
    getPurchaseInvoices().catch(() => [] as Awaited<ReturnType<typeof getPurchaseInvoices>>),
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
  const filteredGrns = grns.filter(
    (g) => inDateRange(g.documentDate) && matchLocation(g.location.id),
  )

  const openRequisitions = prs.filter((r) =>
    ['draft', 'pending_approval', 'approved'].includes(r.status),
  ).length
  const pendingPrApprovals = prs.filter((r) => r.status === 'pending_approval').length
  const openRfqs = filteredRfqs.filter((r) => !['closed', 'cancelled'].includes(r.status)).length

  const today = new Date().toISOString().slice(0, 10)
  const monthPrefix = today.slice(0, 7)
  const ordersInRange = orders.filter((o) => inDateRange(o.documentDate))
  const purchaseOrdersThisMonth = ordersInRange.filter((o) => o.documentDate.startsWith(monthPrefix)).length
  const pendingDeliveries = ordersInRange.filter((o) =>
    ['released', 'partially_received', 'confirmed', 'sent'].includes(o.status),
  ).length
  const pendingGrns = filteredGrns.filter((g) =>
    ['draft', 'submitted', 'qc_pending', 'receiving_completed', 'pending_inspection', 'pending_tolerance_approval'].includes(
      g.status,
    ),
  ).length
  const pendingPurchaseInvoices = invoices.filter((inv) =>
    ['draft', 'pending_approval', 'approved', 'matched', 'partially_matched', 'pending_verification'].includes(
      inv.status,
    ),
  ).length
  const monthlyPurchaseValue = ordersInRange
    .filter((o) => o.documentDate.startsWith(monthPrefix))
    .reduce((sum, o) => sum + (Number(o.totalAmount ?? 0) || 0), 0)

  let grniPending = buildPurchaseDashboardGrniRows(filteredGrns, invoices, { today })
  try {
    const qs = new URLSearchParams()
    if (dateFrom) qs.set('dateFrom', dateFrom)
    if (dateTo) qs.set('dateTo', dateTo)
    const q = qs.toString()
    const res = await apiRequest<{ rows: GrniReportApiRow[]; openValueTotal: number }>(
      `${tenantPath('/purchase/reports/grni')}${q ? `?${q}` : ''}`,
    )
    const reportRows = (res.data?.rows ?? []).filter((row) => {
      if (!locationId) return true
      const grn = grns.find((g) => g.id === row.goodsReceiptId)
      return grn ? matchLocation(grn.location.id) : true
    })
    grniPending = aggregateGrniReportToDashboardRows(reportRows, { limit: 15 })
  } catch {
    // Fall back to client-side GRNI from listed GRNs + invoices.
  }

  const emptyPoStatus = [
    {
      key: 'released',
      label: 'Released',
      count: ordersInRange.filter((o) => o.status === 'released').length,
      href: '/purchase/orders?status=released',
    },
    {
      key: 'partially_received',
      label: 'Partially Received',
      count: ordersInRange.filter((o) => o.status === 'partially_received').length,
      href: '/purchase/orders?status=partially_received',
    },
    {
      key: 'fully_received',
      label: 'Fully Received',
      count: ordersInRange.filter((o) => o.status === 'fully_received').length,
      href: '/purchase/orders?status=fully_received',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      count: ordersInRange.filter((o) => {
        if (['closed', 'cancelled', 'fully_received', 'invoiced'].includes(o.status)) return false
        if (!['released', 'partially_received', 'approved'].includes(o.status)) return false
        return Boolean(o.expectedDeliveryDate && o.expectedDeliveryDate < today)
      }).length,
      href: '/purchase/orders?status=overdue',
    },
  ]

  const monthlyTrend = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(`${today}T00:00:00`)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const value = orders
      .filter((o) => o.documentDate.startsWith(key))
      .reduce((sum, o) => sum + (Number(o.totalAmount ?? 0) || 0), 0)
    monthlyTrend.push({
      month: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      value,
    })
  }

  const grnInspections = filteredGrns.filter((g) =>
    ['pending_inspection', 'qc_pending'].includes(g.status),
  ).length

  return {
    kpis: {
      openRequisitions,
      pendingPrApprovals,
      openRfqs,
      purchaseOrdersThisMonth,
      pendingDeliveries,
      pendingGrns,
      grniPending: grniPending.length,
      pendingPurchaseInvoices,
      monthlyPurchaseValue,
    },
    kpiHrefs: {
      openRequisitions: '/purchase/requisitions',
      pendingPrApprovals: '/purchase/requisitions?status=pending_approval',
      openRfqs: '/purchase/rfqs',
      purchaseOrdersThisMonth: '/purchase/orders',
      pendingDeliveries: '/purchase/orders?status=overdue',
      pendingGrns: '/purchase/grn',
      grniPending: '/purchase/reports?focus=grn-grni',
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
      {
        id: 'grn-inspection',
        type: 'grn_inspection' as const,
        label: 'GRN inspections',
        count: grnInspections,
        href: '/purchase/grn?status=pending_inspection',
        severity: 'warning' as const,
      },
      {
        id: 'grn-not-invoiced',
        type: 'grn_not_invoiced' as const,
        label: 'GRNs awaiting invoice',
        count: grniPending.length,
        href: '/purchase/reports?focus=grn-grni',
        severity: 'warning' as const,
      },
    ].filter((a) => a.count > 0),
    grniPending,
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

/** Prefer engineering productType when present — aligns PR Product Type with Item Master. */
function mapMasterItemToPurchaseCategory(item: MasterItem): PurchaseItemCategory {
  const productType = normalizeEngineeringProductType(item.productType)
  switch (productType) {
    case 'raw_material':
    case 'scrap':
      return 'raw_material'
    case 'boi':
      return 'component'
    case 'sub_assembly':
    case 'assembly_product':
      return 'component'
    case 'finish_product':
      return 'component'
    case 'service':
      return 'job_work'
    default:
      return mapItemTypeToCategory(item.itemType)
  }
}

function mapMasterItemToPurchaseItem(item: MasterItem): PurchaseItem {
  const store = useMasterStore.getState()
  const uom =
    store.uoms.find((u) => u.id === item.baseUomId)?.uomCode ??
    store.uoms.find((u) => u.id === item.baseUomId)?.uomName ??
    'NOS'
  const productType = deriveEngineeringProductTypeFromMaster({
    productType: item.productType,
    itemType: item.itemType,
    category: mapMasterItemToPurchaseCategory(item),
  })
  let gstRatePct = 0
  if (store.gstRates?.length) {
    const snap = resolveLineTaxFromLocalMasters({
      direction: 'PURCHASE',
      item,
      hsnById: (id) => store.getHsn(id),
      hsnByCode: (code) => store.getHsnByCode(code),
      gstRates: store.gstRates,
    })
    if (snap.resolved) gstRatePct = snap.taxPct
  }
  return {
    id: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    category: mapMasterItemToPurchaseCategory(item),
    productType: productType || null,
    masterItemType: item.itemType,
    description: item.itemDescription ?? '',
    uomId: item.baseUomId || null,
    uom,
    hsnCode: item.hsnCode ?? '',
    sacCode: null,
    gstGroupId: item.gstGroupId ?? null,
    hsnId: item.hsnId ?? null,
    qualityTestGroupCode: item.qualityTestGroupCode ?? null,
    gstRatePct,
    standardRate: Number(item.standardRate ?? 0),
    reorderLevel: Number(item.reorderLevel ?? 0),
    preferredVendorId: null,
    isStockable: Boolean(item.isStockable),
    qcRequired: Boolean(item.qcRequired),
    batchControlled: Boolean(item.batchTracked),
    serialControlled: Boolean(item.serialTracked),
    expiryControlled: false,
    receivingTolerancePercentage: Number(item.receivingTolerancePercentage ?? 0),
    defaultBinId: item.defaultBinId ?? null,
    defaultBinCode: item.defaultBinCode ?? null,
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
  const stateCode = resolveGstStateCode(v.gstin) ?? resolveGstStateCode(v.state) ?? ''
  const gst = determinePurchaseGstSupply({
    supplierState: v.state ?? '',
    supplierStateCode: stateCode,
    supplierGstin: v.gstin ?? '',
    defaultPlaceOfSupplyState: 'Maharashtra',
    defaultPlaceOfSupplyStateCode: '27',
  })
  return {
    id: v.id,
    vendorCode: v.vendorCode,
    vendorName: v.vendorName,
    vendorType,
    contactPerson: v.contactPerson ?? '',
    contactPhone: v.contactPhone ?? '',
    contactEmail: v.email ?? '',
    address: v.address ?? '',
    address2: v.address2 ?? '',
    city: v.city ?? '',
    state: v.state ?? '',
    stateCode,
    pincode: v.pincode ?? '',
    country: v.country ?? '',
    gstin: v.gstin ?? '',
    pan: v.pan ?? '',
    isInterstate: gst.isInterstate,
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

/** Map master vendor → purchase domain vendor (quick-create / PO select). */
export function mapMasterVendorToDomainVendor(v: MasterVendor): Vendor {
  return mapMasterVendorToPurchaseVendor(v)
}

/**
 * Ensure a quick-created / master vendor is selectable on purchase docs.
 * Demo: inject into in-memory purchase vendor list. API: already on master store.
 */
export function ensurePurchaseVendorKnown(vendor: Vendor): void {
  if (isApiMode()) return
  demo.ensurePurchaseVendorKnown(vendor)
}

/** Items for PR/PO pickers — Item Master via API in API mode, demo seed otherwise. */
export async function getPurchaseItems(options?: {
  forceRefresh?: boolean
  /**
   * When true (default), only items with Allow purchase.
   * PO editors pass false so Product Type filters include Finish Product / Sub Assembly
   * rows that exist in Item Master but are marked non-purchasable for manufacturing.
   */
  purchasableOnly?: boolean
}): Promise<PurchaseItem[]> {
  if (!isApiMode()) return demo.getPurchaseItems()
  let items = useMasterStore.getState().items
  // Refresh from Item Master API when empty or when the caller asks for a live snapshot.
  if (!items.length || options?.forceRefresh) {
    try {
      const api = await import('../api/masterBatchApi')
      const rows = await api.fetchItems()
      useMasterStore.setState({ items: rows.map(api.mapItemDto) })
      items = useMasterStore.getState().items
    } catch {
      if (!items.length) {
        try {
          const { syncBatchMastersFromApi } = await import('../bridges/masterBatchApiBridge')
          await syncBatchMastersFromApi()
          items = useMasterStore.getState().items
        } catch {
          /* keep empty — UI shows no matching items */
        }
      }
    }
  }
  const purchasableOnly = options?.purchasableOnly !== false
  return items
    .filter((i) => {
      if (i.isActive === false || i.isBlocked === true) return false
      if (purchasableOnly && i.isPurchasable === false) return false
      return true
    })
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
  address: string
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
        address: [PURCHASE_DEMO_LOCATION.name, PURCHASE_DEMO_LOCATION.city, PURCHASE_DEMO_LOCATION.state]
          .filter(Boolean)
          .join(', '),
        state: PURCHASE_DEMO_LOCATION.state,
        city: PURCHASE_DEMO_LOCATION.city,
      },
      {
        id: PURCHASE_DEMO_LOCATION_FG.id,
        code: PURCHASE_DEMO_LOCATION_FG.code,
        name: PURCHASE_DEMO_LOCATION_FG.name,
        address: [
          PURCHASE_DEMO_LOCATION_FG.name,
          PURCHASE_DEMO_LOCATION_FG.city,
          PURCHASE_DEMO_LOCATION_FG.state,
        ]
          .filter(Boolean)
          .join(', '),
        state: PURCHASE_DEMO_LOCATION_FG.state,
        city: PURCHASE_DEMO_LOCATION_FG.city,
      },
    ]
  }
  let warehouses = useMasterStore.getState().warehouses
  if (!warehouses.length) {
    try {
      const { syncCoreMastersFromApi } = await import('../bridges/masterApiBridge')
      await syncCoreMastersFromApi()
      warehouses = useMasterStore.getState().warehouses
    } catch {
      /* keep empty */
    }
  }
  return warehouses
    .filter((w) => w.isActive !== false)
    .map((w) => ({
      id: w.id,
      code: w.warehouseCode,
      name: w.warehouseName,
      address: w.address || '',
      state: '',
      city: '',
    }))
}

export type { PlanningSheetSummary }

const emptyIdToNull = (value: string | null | undefined): string | null => value || null

const NUMBER_SERIES_KEYS: readonly (keyof PurchaseSetup['numberSeries'])[] = [
  'purchaseRequisition',
  'rfq',
  'vendorQuotation',
  'purchaseOrder',
  'grn',
  'qualityInspection',
  'purchaseInvoice',
  'purchaseReturn',
]

function mapApiSetupToDomain(api: setupApi.ApiPurchaseSetup): PurchaseSetup {
  const g = api.general
  return {
    id: api.id,
    isConfigured: api.isConfigured,
    version: api.version,
    selfApprovalPolicy: api.selfApprovalPolicy ?? 'PERMISSION_ONLY',
    general: {
      defaultPlantId: g.defaultPlantId ?? '',
      defaultWarehouseId: g.defaultWarehouseId ?? '',
      defaultBuyerId: g.defaultBuyerId ?? '',
      defaultCurrency: (g.defaultCurrency as PurchaseSetup['general']['defaultCurrency']) || 'INR',
      defaultPaymentTerms: g.defaultPaymentTerms ?? '',
      defaultPaymentTermCode: g.defaultPaymentTermCode ?? '',
      defaultDeliveryTerms: g.defaultDeliveryTerms ?? '',
      allowDirectPo: g.allowDirectPo,
      requirePrBeforePo: g.requirePrBeforePo,
      requireRfqAboveAmountInr: Number(g.requireRfqAboveAmountInr ?? 0),
      minimumRfqVendorCount: g.minimumRfqVendorCount,
      requireQuotationComparison: g.requireQuotationComparison,
      allowOverReceipt: g.allowOverReceipt,
      overReceiptTolerancePct: Number(g.overReceiptTolerancePct ?? 0),
      requireApprovalOnPoRevision: g.requireApprovalOnPoRevision ?? true,
      requireApprovalOnPo: g.requireApprovalOnPo ?? true,
      requirePoReleaseWorkflow: g.requirePoReleaseWorkflow !== false,
      requireApprovalOnPrRevision: g.requireApprovalOnPrRevision ?? true,
      allowBackdatedPo: g.allowBackdatedPo ?? false,
      backdatedPoDaysLimit: Number(g.backdatedPoDaysLimit ?? 0),
      requireApprovalForBackdatedPo: g.requireApprovalForBackdatedPo !== false,
      allowShortClose: g.allowShortClose,
      requirePoWarehouse: g.requirePoWarehouse,
      requireExpectedDeliveryDate: g.requireExpectedDeliveryDate,
      requirePaymentTerms: g.requirePaymentTerms,
      planningConsolidationEnabled: g.planningConsolidationEnabled !== false,
    },
    requisition: {
      skipRfq: api.requisition.skipRfq,
      defaultWarehouseId: api.requisition.defaultWarehouseId ?? '',
      autoCompleteRef: api.requisition.autoCompleteRef,
    },
    numberSeries: NUMBER_SERIES_KEYS.reduce((acc, key) => {
      const entry = api.numberSeries[key]
      acc[key] = {
        prefix: entry.prefix,
        padLength: entry.padLength,
        nextNumber: entry.nextNumber,
      }
      return acc
    }, {} as PurchaseSetup['numberSeries']),
    approvalMatrix: api.approvalMatrix.map((tier) => ({
      id: tier.id,
      minAmount: Number(tier.minAmount ?? 0),
      maxAmount: tier.maxAmount == null ? null : Number(tier.maxAmount),
      requiredRoles: tier.requiredRoles as PurchaseApprovalRole[],
      sortOrder: tier.sortOrder,
      isActive: tier.isActive,
      label: tier.label,
      documentType:
        (tier.documentType as NonNullable<PurchaseSetup['approvalMatrix'][number]['documentType']>) ||
        'all',
    })),
    approverLimits: (api.approverLimits ?? []).map((lim) => ({
      id: lim.id,
      userId: lim.userId,
      userName: lim.userName,
      maxAmountInr: Number(lim.maxAmountInr ?? 0),
      documentType:
        (lim.documentType as PurchaseSetup['approverLimits'][number]['documentType']) || 'all',
      isActive: lim.isActive,
      sortOrder: lim.sortOrder,
    })),
    tax: {
      defaultGstScheme: api.tax.defaultGstScheme,
      placeOfSupplyState: api.tax.placeOfSupplyState ?? '',
      placeOfSupplyStateCode: api.tax.placeOfSupplyStateCode ?? '',
      reverseChargeDefault: api.tax.reverseChargeDefault,
      tcsEnabled: api.tax.tcsEnabled,
      tdsEnabled: api.tax.tdsEnabled,
      roundOffRule: api.tax.roundOffRule,
    },
    invoiceMatchTolerances: {
      requirePoMatch: api.invoiceMatchTolerances.requirePoMatch,
      requireGrnMatch: api.invoiceMatchTolerances.requireGrnMatch,
      quantityTolerancePct: Number(api.invoiceMatchTolerances.quantityTolerancePct ?? 0),
      rateTolerancePct: Number(api.invoiceMatchTolerances.rateTolerancePct ?? 0),
      amountToleranceInr: Number(api.invoiceMatchTolerances.amountToleranceInr ?? 0),
      amountTolerancePct: Number(api.invoiceMatchTolerances.amountTolerancePct ?? 0),
      taxToleranceInr: Number(api.invoiceMatchTolerances.taxToleranceInr ?? 0),
      taxTolerancePct: Number(api.invoiceMatchTolerances.taxTolerancePct ?? 0),
      allowAuthorizedOverride: api.invoiceMatchTolerances.allowAuthorizedOverride,
    },
    allowDirectInvoice: api.allowDirectInvoice,
    receiving: {
      requireGateEntry: api.receiving.requireGateEntry,
      requireVendorChallan: api.receiving.requireVendorChallan,
      requireVehicleNumber: api.receiving.requireVehicleNumber,
      requireBatch: api.receiving.requireBatch,
      requireSerial: api.receiving.requireSerial,
      requireExpiry: api.receiving.requireExpiry,
      autoCreateInspection: api.receiving.autoCreateInspection,
      defaultReceivingLocationId: api.receiving.defaultReceivingLocationId ?? '',
      duplicateChallanPolicy: api.receiving.duplicateChallanPolicy,
    },
    quality: {
      inspectionRequiredCategories:
        api.quality.inspectionRequiredCategories as PurchaseItemCategory[],
      allowAcceptanceUnderDeviation: api.quality.allowAcceptanceUnderDeviation,
      deviationApproverRole: api.quality.deviationApproverRole as PurchaseApprovalRole,
      allowRejectedStockInQuarantine: api.quality.allowRejectedStockInQuarantine,
      defaultQualityHoldLocationId: api.quality.defaultQualityHoldLocationId ?? '',
      defaultRejectedLocationId: api.quality.defaultRejectedLocationId ?? '',
      defaultVendorReturnLocationId: api.quality.defaultVendorReturnLocationId ?? '',
    },
    print: {
      companyName: api.print.companyName ?? '',
      logoUrl: api.print.logoUrl ?? api.print.logoPlaceholderUrl ?? '',
      showTermsOnPo: api.print.showTermsOnPo,
      showTermsOnGrn: api.print.showTermsOnGrn,
      showTermsOnInvoice: api.print.showTermsOnInvoice,
      defaultCopies: api.print.defaultCopies,
      paperSize: api.print.paperSize,
      orientation: api.print.orientation,
    },
    notifications: {
      prPendingApproval: { ...(api.notifications?.prPendingApproval ?? { inApp: true, email: true }) },
      rfqResponseDue: { ...(api.notifications?.rfqResponseDue ?? { inApp: true, email: true }) },
      poDeliveryApproaching: {
        ...(api.notifications?.poDeliveryApproaching ?? { inApp: true, email: false }),
      },
      poOverdue: { ...(api.notifications?.poOverdue ?? { inApp: true, email: true }) },
      grnPendingInspection: {
        ...(api.notifications?.grnPendingInspection ?? { inApp: true, email: false }),
      },
      invoiceMismatch: { ...(api.notifications?.invoiceMismatch ?? { inApp: true, email: true }) },
      invoicePendingApproval: {
        ...(api.notifications?.invoicePendingApproval ?? { inApp: true, email: true }),
      },
    },
    updatedAt: api.updatedAt ?? '',
    updatedBy: api.updatedById ?? 'System',
  }
}

/** Full nested PUT payload — round-trips every editable field. */
function mapDomainSetupToApiPayload(setup: PurchaseSetup): setupApi.ApiPurchaseSetupInput {
  return {
    version: setup.version || undefined,
    selfApprovalPolicy: setup.selfApprovalPolicy,
    general: {
      defaultPlantId: emptyIdToNull(setup.general.defaultPlantId),
      defaultWarehouseId: emptyIdToNull(setup.general.defaultWarehouseId),
      defaultBuyerId: emptyIdToNull(setup.general.defaultBuyerId),
      defaultCurrency: setup.general.defaultCurrency || 'INR',
      defaultPaymentTerms: setup.general.defaultPaymentTerms ?? '',
      defaultPaymentTermCode: setup.general.defaultPaymentTermCode || null,
      defaultDeliveryTerms: setup.general.defaultDeliveryTerms ?? '',
      allowDirectPo: setup.general.allowDirectPo,
      requirePrBeforePo: setup.general.requirePrBeforePo,
      requireRfqAboveAmountInr: setup.general.requireRfqAboveAmountInr,
      minimumRfqVendorCount: setup.general.minimumRfqVendorCount,
      requireQuotationComparison: setup.general.requireQuotationComparison,
      allowOverReceipt: setup.general.allowOverReceipt,
      overReceiptTolerancePct: setup.general.overReceiptTolerancePct,
      requireApprovalOnPoRevision: setup.general.requireApprovalOnPoRevision,
      requireApprovalOnPo: setup.general.requireApprovalOnPo,
      requirePoReleaseWorkflow: setup.general.requirePoReleaseWorkflow,
      requireApprovalOnPrRevision: setup.general.requireApprovalOnPrRevision,
      allowBackdatedPo: setup.general.allowBackdatedPo,
      backdatedPoDaysLimit: setup.general.backdatedPoDaysLimit,
      requireApprovalForBackdatedPo: setup.general.requireApprovalForBackdatedPo,
      allowShortClose: setup.general.allowShortClose,
      requirePoWarehouse: setup.general.requirePoWarehouse,
      requireExpectedDeliveryDate: setup.general.requireExpectedDeliveryDate,
      requirePaymentTerms: setup.general.requirePaymentTerms,
      planningConsolidationEnabled: setup.general.planningConsolidationEnabled,
    },
    requisition: {
      skipRfq: setup.requisition.skipRfq,
      defaultWarehouseId: emptyIdToNull(setup.requisition.defaultWarehouseId),
      autoCompleteRef: setup.requisition.autoCompleteRef,
    },
    // nextNumber is server-allocated and read-only — only prefix / padLength are sent.
    numberSeries: NUMBER_SERIES_KEYS.reduce((acc, key) => {
      acc[key] = {
        prefix: setup.numberSeries[key].prefix,
        padLength: setup.numberSeries[key].padLength,
      }
      return acc
    }, {} as NonNullable<setupApi.ApiPurchaseSetupInput['numberSeries']>),
    // Tier ids are demo/local values; backend replaces the whole matrix per save.
    approvalMatrix: setup.approvalMatrix.map((tier) => ({
      minAmount: tier.minAmount,
      maxAmount: tier.maxAmount,
      requiredRoles: tier.requiredRoles,
      sortOrder: tier.sortOrder,
      isActive: tier.isActive,
      label: tier.label,
      documentType: tier.documentType ?? 'all',
    })),
    approverLimits: setup.approverLimits.map((lim) => ({
      userId: lim.userId,
      maxAmountInr: lim.maxAmountInr,
      documentType: lim.documentType ?? 'all',
      isActive: lim.isActive,
      sortOrder: lim.sortOrder,
    })),
    tax: { ...setup.tax },
    invoiceMatchTolerances: { ...setup.invoiceMatchTolerances },
    allowDirectInvoice: setup.allowDirectInvoice,
    receiving: {
      requireGateEntry: setup.receiving.requireGateEntry,
      requireVendorChallan: setup.receiving.requireVendorChallan,
      requireVehicleNumber: setup.receiving.requireVehicleNumber,
      requireBatch: setup.receiving.requireBatch,
      requireSerial: setup.receiving.requireSerial,
      requireExpiry: setup.receiving.requireExpiry,
      autoCreateInspection: setup.receiving.autoCreateInspection,
      defaultReceivingLocationId: emptyIdToNull(setup.receiving.defaultReceivingLocationId),
      duplicateChallanPolicy: setup.receiving.duplicateChallanPolicy,
    },
    quality: {
      inspectionRequiredCategories: setup.quality.inspectionRequiredCategories,
      allowAcceptanceUnderDeviation: setup.quality.allowAcceptanceUnderDeviation,
      deviationApproverRole: setup.quality.deviationApproverRole,
      allowRejectedStockInQuarantine: setup.quality.allowRejectedStockInQuarantine,
      defaultQualityHoldLocationId: emptyIdToNull(setup.quality.defaultQualityHoldLocationId),
      defaultRejectedLocationId: emptyIdToNull(setup.quality.defaultRejectedLocationId),
      defaultVendorReturnLocationId: emptyIdToNull(setup.quality.defaultVendorReturnLocationId),
    },
    print: {
      companyName: setup.print.companyName,
      logoUrl: setup.print.logoUrl || null,
      showTermsOnPo: setup.print.showTermsOnPo,
      showTermsOnGrn: setup.print.showTermsOnGrn,
      showTermsOnInvoice: setup.print.showTermsOnInvoice,
      defaultCopies: setup.print.defaultCopies,
      // Locked ERP standard — always A4 portrait at tenant default; per-doc orientation is code-driven.
      paperSize: 'A4',
      orientation: 'portrait',
    },
    notifications: {
      prPendingApproval: { ...setup.notifications.prPendingApproval },
      rfqResponseDue: { ...setup.notifications.rfqResponseDue },
      poDeliveryApproaching: { ...setup.notifications.poDeliveryApproaching },
      poOverdue: { ...setup.notifications.poOverdue },
      grnPendingInspection: { ...setup.notifications.grnPendingInspection },
      invoiceMismatch: { ...setup.notifications.invoiceMismatch },
      invoicePendingApproval: { ...setup.notifications.invoicePendingApproval },
    },
  }
}

/** Load tenant Purchase Setup — API is source of truth in API mode (no memory fallback). */
export async function getPurchaseSetup(): Promise<PurchaseSetup> {
  if (!isApiMode()) return demo.getPurchaseSetup()
  try {
    const res = await setupApi.getPurchaseSetupApi()
    return mapApiSetupToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/** Persist Purchase Setup — success only after backend confirmation. */
export async function updatePurchaseSetup(
  patch: Partial<Omit<PurchaseSetup, 'updatedAt' | 'updatedBy'>>,
): Promise<PurchaseSetup> {
  if (!isApiMode()) return demo.updatePurchaseSetup(patch)
  try {
    const current = await getPurchaseSetup()
    const merged: PurchaseSetup = {
      ...current,
      ...patch,
      general: { ...current.general, ...(patch.general ?? {}) },
      requisition: { ...current.requisition, ...(patch.requisition ?? {}) },
      numberSeries: NUMBER_SERIES_KEYS.reduce((acc, key) => {
        acc[key] = { ...current.numberSeries[key], ...(patch.numberSeries?.[key] ?? {}) }
        return acc
      }, {} as PurchaseSetup['numberSeries']),
      approvalMatrix: patch.approvalMatrix ?? current.approvalMatrix,
      approverLimits: patch.approverLimits ?? current.approverLimits,
      tax: { ...current.tax, ...(patch.tax ?? {}) },
      invoiceMatchTolerances: {
        ...current.invoiceMatchTolerances,
        ...(patch.invoiceMatchTolerances ?? {}),
      },
      receiving: { ...current.receiving, ...(patch.receiving ?? {}) },
      quality: { ...current.quality, ...(patch.quality ?? {}) },
      print: { ...current.print, ...(patch.print ?? {}) },
      // notifications merge is sent to API via mapDomainSetupToApiPayload
      notifications: {
        prPendingApproval: {
          ...current.notifications.prPendingApproval,
          ...(patch.notifications?.prPendingApproval ?? {}),
        },
        rfqResponseDue: {
          ...current.notifications.rfqResponseDue,
          ...(patch.notifications?.rfqResponseDue ?? {}),
        },
        poDeliveryApproaching: {
          ...current.notifications.poDeliveryApproaching,
          ...(patch.notifications?.poDeliveryApproaching ?? {}),
        },
        poOverdue: {
          ...current.notifications.poOverdue,
          ...(patch.notifications?.poOverdue ?? {}),
        },
        grnPendingInspection: {
          ...current.notifications.grnPendingInspection,
          ...(patch.notifications?.grnPendingInspection ?? {}),
        },
        invoiceMismatch: {
          ...current.notifications.invoiceMismatch,
          ...(patch.notifications?.invoiceMismatch ?? {}),
        },
        invoicePendingApproval: {
          ...current.notifications.invoicePendingApproval,
          ...(patch.notifications?.invoicePendingApproval ?? {}),
        },
      },
    }
    const res = await setupApi.putPurchaseSetupApi(mapDomainSetupToApiPayload(merged))
    return mapApiSetupToDomain(res.data)
  } catch (err) {
    // Preserve ApiError so the page can surface field errors and version conflicts.
    if (err instanceof ApiError) throw err
    throwApi(err)
  }
}

export type PurchasePlantSetup = {
  id: string | null
  plantId: string
  defaultWarehouseId: string | null
  defaultReceivingLocationId: string | null
  defaultQualityHoldLocationId: string | null
  defaultRejectedLocationId: string | null
  defaultVendorReturnLocationId: string | null
  isConfigured: boolean
}

function mapApiPlantSetupToDomain(api: setupApi.ApiPurchasePlantSetup): PurchasePlantSetup {
  return {
    id: api.id,
    plantId: api.plantId,
    defaultWarehouseId: api.defaultWarehouseId,
    defaultReceivingLocationId: api.defaultReceivingLocationId,
    defaultQualityHoldLocationId: api.defaultQualityHoldLocationId,
    defaultRejectedLocationId: api.defaultRejectedLocationId,
    defaultVendorReturnLocationId: api.defaultVendorReturnLocationId,
    isConfigured: api.isConfigured ?? api.id != null,
  }
}

/** List plant-level Purchase Setup overrides (API mode only; demo returns empty). */
export async function getPurchasePlantSettings(): Promise<PurchasePlantSetup[]> {
  if (!isApiMode()) return []
  try {
    const res = await setupApi.listPurchasePlantSetupsApi()
    return (res.data ?? []).map(mapApiPlantSetupToDomain)
  } catch (err) {
    throwApi(err)
  }
}

/** Load one plant override — API is source of truth (no memory fallback). */
export async function getPurchasePlantSetup(plantId: string): Promise<PurchasePlantSetup> {
  if (!isApiMode()) {
    return {
      id: null,
      plantId,
      defaultWarehouseId: null,
      defaultReceivingLocationId: null,
      defaultQualityHoldLocationId: null,
      defaultRejectedLocationId: null,
      defaultVendorReturnLocationId: null,
      isConfigured: false,
    }
  }
  try {
    const res = await setupApi.getPurchasePlantSetupApi(plantId)
    return mapApiPlantSetupToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/** Persist plant-level Purchase Setup override. */
export async function updatePurchasePlantSetup(
  plantId: string,
  body: setupApi.ApiPurchasePlantSetupInput,
): Promise<PurchasePlantSetup> {
  if (!isApiMode()) {
    throw new PurchaseServiceError(
      'DEMO_NOT_SUPPORTED',
      'Plant setup overrides are only available in API mode.',
    )
  }
  try {
    const res = await setupApi.putPurchasePlantSetupApi(plantId, body)
    return mapApiPlantSetupToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

function notSupportedInApiMode(feature: string): never {
  throw new PurchaseServiceError(
    'PURCHASE_API_NOT_IMPLEMENTED',
    `${feature} is not available in API mode yet.`,
  )
}

/* ─── Purchase Invoices ─── */

export async function getPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  if (!isApiMode()) return demo.getPurchaseInvoices()
  try {
    const res = await invoiceApi.listPurchaseInvoicesApi({ page: 1, limit: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPurchaseInvoiceToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseInvoiceList(): Promise<PurchaseInvoiceListRow[]> {
  if (!isApiMode()) return demo.getPurchaseInvoiceList()
  try {
    const res = await invoiceApi.listPurchaseInvoicesApi({ page: 1, limit: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPurchaseInvoiceToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice | null> {
  if (!isApiMode()) return demo.getPurchaseInvoiceById(id)
  try {
    const res = await invoiceApi.getPurchaseInvoiceApi(id)
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    if (isBackendMissingError(err)) return null
    const { code } = formatPurchaseApiError(err)
    if (code === 'PURCHASE_INVOICE_NOT_FOUND' || code === 'NOT_FOUND' || code === 'HTTP_404') {
      return null
    }
    throwApi(err)
  }
}

export async function createPurchaseInvoice(input: PurchaseInvoiceInput): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.createPurchaseInvoice(input)
  try {
    const res = await invoiceApi.createPurchaseInvoiceApi(
      mapDomainPurchaseInvoiceInputToApiPayload(input),
    )
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function createDirectPurchaseInvoice(
  input: PurchaseInvoiceInput,
): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.createDirectPurchaseInvoice(input)
  return createPurchaseInvoice({ ...input, origin: 'direct' })
}

export async function createPurchaseInvoiceFromPo(purchaseOrderId: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.createPurchaseInvoiceFromPo(purchaseOrderId)
  const po = await getPurchaseOrderById(purchaseOrderId)
  if (!po) throw new PurchaseServiceError('PO_NOT_FOUND', `PO not found: ${purchaseOrderId}`)

  const setup = await getPurchaseSetup().catch(() => null)
  let postedGrn: GoodsReceiptNote | undefined
  try {
    const res = await grnApi.listGoodsReceiptsApi({
      page: 1,
      pageSize: 20,
      sortOrder: 'desc',
      purchaseOrderId: po.id,
    })
    postedGrn = res.data
      .map(mapApiGoodsReceiptToDomain)
      .find((g) => g.status === 'posted')
  } catch {
    const grns = await getGRNs().catch(() => [] as GoodsReceiptNote[])
    postedGrn = grns.find((g) => g.purchaseOrderId === po.id && g.status === 'posted')
  }

  // Setup requireGrnMatch: PO-only create is rejected by API — use posted GRN when present.
  if (postedGrn) {
    return createPurchaseInvoiceFromGrn(postedGrn.id)
  }
  if (setup?.invoiceMatchTolerances.requireGrnMatch) {
    throw new PurchaseServiceError(
      'GRN_REQUIRED',
      'Purchase Setup requires a posted GRN match. Open origin “Posted GRN” and select the GRN for this PO (or post a GRN first).',
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  return createPurchaseInvoice({
    vendorId: po.vendor.id,
    vendorInvoiceNumber: '',
    vendorInvoiceDate: today,
    documentDate: today,
    origin: 'purchase_order',
    purchaseOrderId: po.id,
    placeOfSupply: po.placeOfSupply || po.vendor.state || '',
    paymentTerms: po.paymentTerms,
    lines: po.lines
      .filter((l) => l.lineStatus !== 'cancelled')
      .map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        rate: l.rate,
        purchaseOrderLineId: l.id,
        description: l.description || l.itemName,
        gstRatePct: l.gstRatePct,
      })),
  })
}

export async function createPurchaseInvoiceFromGrn(goodsReceiptId: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.createPurchaseInvoiceFromGrn(goodsReceiptId)
  const grn = await getGRNById(goodsReceiptId)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${goodsReceiptId}`)
  const today = new Date().toISOString().slice(0, 10)
  const lines = grn.lines
    .map((l) => ({
      itemId: l.itemId,
      quantity: l.acceptedQty || l.receivedQty,
      rate: l.rate,
      purchaseOrderLineId: l.purchaseOrderLineId,
      goodsReceiptLineId: l.id,
      description: l.description || l.itemName,
    }))
    .filter((l) => l.quantity > 0)
  if (!lines.length) {
    throw new PurchaseServiceError(
      'GRN_NO_QTY',
      'This GRN has no accepted/received quantity to invoice.',
    )
  }
  return createPurchaseInvoice({
    vendorId: grn.vendor.id,
    vendorInvoiceNumber: '',
    vendorInvoiceDate: today,
    documentDate: today,
    origin: 'goods_receipt',
    purchaseOrderId: grn.purchaseOrderId,
    goodsReceiptId: grn.id,
    paymentTerms: grn.paymentTerms,
    lines,
  })
}

export async function createPurchaseInvoiceFromServicePo(
  purchaseOrderId: string,
): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.createPurchaseInvoiceFromServicePo(purchaseOrderId)
  return createPurchaseInvoiceFromPo(purchaseOrderId)
}

export async function updatePurchaseInvoice(
  id: string,
  input: PurchaseInvoiceInput,
): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.updatePurchaseInvoice(id, input)
  try {
    const res = await invoiceApi.updatePurchaseInvoiceApi(
      id,
      mapDomainPurchaseInvoiceInputToApiPayload(input),
    )
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/**
 * API mode: matching is computed on submit and stored on the invoice.
 * Enrich with linked PO/GRN quantities when available for the detail panel.
 */
export async function computeInvoiceMatching(id: string): Promise<InvoiceMatchingResult> {
  if (!isApiMode()) return demo.computeInvoiceMatching(id)
  const inv = await getPurchaseInvoiceById(id)
  if (!inv) throw new PurchaseServiceError('INV_NOT_FOUND', `Invoice not found: ${id}`)
  const overallStatus = inv.matchingResultStatus
  const exceedsTolerance =
    overallStatus === 'amount_mismatch'
    || overallStatus === 'quantity_mismatch'
    || overallStatus === 'rate_mismatch'
    || overallStatus === 'tax_mismatch'
    || overallStatus === 'missing_grn'
    || inv.matchStatus === 'mismatch'

  const po = inv.purchaseOrderId ? await getPurchaseOrderById(inv.purchaseOrderId) : null
  const grn = inv.goodsReceiptId ? await getGRNById(inv.goodsReceiptId) : null
  const poLines = po?.lines ?? []
  const grnLines = grn?.lines ?? []

  const lines = inv.lines.map((l) => {
    const poLine =
      (l.purchaseOrderLineId
        ? poLines.find((pl) => pl.id === l.purchaseOrderLineId)
        : undefined)
      ?? poLines.find((pl) => pl.itemId === l.itemId || pl.itemCode === l.itemCode)
    const grnLine =
      (l.goodsReceiptLineId
        ? grnLines.find((gl) => gl.id === l.goodsReceiptLineId)
        : undefined)
      ?? grnLines.find((gl) => gl.itemId === l.itemId || gl.itemCode === l.itemCode)
    const poQty = poLine?.quantity ?? null
    const grnQty = grnLine?.receivedQty ?? grnLine?.acceptedQty ?? null
    const poRate = poLine?.rate ?? null
    const flags: InvoiceMatchingResult['lines'][number]['flags'] = []
    let withinTolerance = true
    if (poQty != null && Math.abs(poQty - l.quantity) > 1e-6) {
      flags.push('quantity_mismatch')
      withinTolerance = false
    }
    if (poRate != null && Math.abs(poRate - l.rate) > 0.01) {
      flags.push('rate_mismatch')
      withinTolerance = false
    }
    return {
      lineNo: l.lineNo,
      itemCode: l.itemCode,
      itemName: l.itemName,
      poQty,
      grnReceivedQty: grnQty,
      invoiceQty: l.quantity,
      poRate,
      invoiceRate: l.rate,
      poTaxPct: poLine?.gstRatePct ?? null,
      invoiceTaxPct: l.gstRatePct,
      poLineTotal: poLine?.lineTotal ?? null,
      invoiceLineTotal: l.lineTotal,
      flags,
      withinTolerance: withinTolerance && !exceedsTolerance,
    }
  })

  return {
    overallStatus,
    overallStatusLabel: INVOICE_MATCHING_RESULT_STATUS_LABELS[overallStatus],
    exceedsTolerance: exceedsTolerance || lines.some((l) => !l.withinTolerance),
    isDuplicateVendorInvoice: false,
    missingGrn: !inv.goodsReceiptId,
    lines,
    summary: {
      poQty: poLines.reduce((s, l) => s + (l.quantity ?? 0), 0),
      grnQty: grnLines.reduce((s, l) => s + (l.receivedQty ?? l.acceptedQty ?? 0), 0),
      invoiceQty: inv.lines.reduce((s, l) => s + l.quantity, 0),
      poTotal: po?.totalAmount ?? 0,
      invoiceTotal: inv.totalAmount,
      poTax: po ? (po.cgst ?? 0) + (po.sgst ?? 0) + (po.igst ?? 0) : 0,
      invoiceTax: inv.cgst + inv.sgst + inv.igst,
    },
    tolerancesApplied: {
      requirePoMatch: Boolean(inv.purchaseOrderId),
      requireGrnMatch: Boolean(inv.goodsReceiptId),
      quantityTolerancePct: 0,
      rateTolerancePct: 0,
      amountToleranceInr: 0,
      amountTolerancePct: 0,
      taxToleranceInr: 0,
      taxTolerancePct: 0,
      allowAuthorizedOverride: true,
    },
  }
}

/** API mode: verification is part of submit — moves the draft into approval with matching applied. */
export async function verifyPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.verifyPurchaseInvoice(id)
  try {
    const res = await invoiceApi.submitPurchaseInvoiceApi(id, {})
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function submitPurchaseInvoiceForApproval(id: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.submitPurchaseInvoiceForApproval(id)
  try {
    const res = await invoiceApi.submitPurchaseInvoiceApi(id, {})
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function approvePurchaseInvoice(id: string, remarks?: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.approvePurchaseInvoice(id, remarks)
  try {
    const res = await invoiceApi.approvePurchaseInvoiceApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function rejectPurchaseInvoice(id: string, remarks: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.rejectPurchaseInvoice(id, remarks)
  try {
    const res = await invoiceApi.rejectPurchaseInvoiceApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseInvoiceApHandoffPreview(
  id: string,
): Promise<Record<string, unknown>> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'AP handoff preview requires API mode.')
  }
  try {
    const res = await invoiceApi.previewPurchaseInvoiceApHandoffApi(id)
    return res.data
  } catch (err) {
    throwApi(err)
  }
}

export async function holdPurchaseInvoice(id: string, reason: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.holdPurchaseInvoice(id, reason)
  notSupportedInApiMode('Invoice hold')
}

export async function approveInvoiceMatchingException(
  id: string,
  remarks?: string,
): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.approveInvoiceMatchingException(id, remarks)
  notSupportedInApiMode('Matching exception approval (use authorized override on submit)')
}

export async function postPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  if (!isApiMode()) return demo.postPurchaseInvoice(id)
  try {
    const res = await invoiceApi.postPurchaseInvoiceApi(id, {})
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelPurchaseInvoice(
  id: string,
  remarks = 'Cancelled',
): Promise<PurchaseInvoice> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'Cancel invoice is only available in API mode.')
  }
  try {
    const res = await invoiceApi.cancelPurchaseInvoiceApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseInvoiceToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function createDebitNoteFromInvoice(
  id: string,
  reason?: string,
): Promise<{ invoice: PurchaseInvoice; debitNoteNumber: string; debitNoteId: string }> {
  if (!isApiMode()) return demo.createDebitNoteFromInvoice(id, reason)
  notSupportedInApiMode('Debit note from invoice')
}

/* ─── Quality Inspections ─── */

export async function getQualityInspections(goodsReceiptId?: string): Promise<QualityInspection[]> {
  if (!isApiMode()) return demo.getQualityInspections(goodsReceiptId)
  try {
    const res = await qiApi.listQualityInspectionsApi({
      page: 1,
      limit: 100,
      sortOrder: 'desc',
      goodsReceiptId,
    })
    return res.data.map(mapApiQualityInspectionToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getQualityInspectionList(
  goodsReceiptId?: string,
): Promise<QualityInspectionListRow[]> {
  if (!isApiMode()) return demo.getQualityInspectionList(goodsReceiptId)
  try {
    const res = await qiApi.listQualityInspectionsApi({
      page: 1,
      limit: 100,
      sortOrder: 'desc',
      goodsReceiptId,
    })
    return res.data.map(mapApiQualityInspectionToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getQualityInspectionById(id: string): Promise<QualityInspection | null> {
  if (!isApiMode()) return demo.getQualityInspectionById(id)
  try {
    const res = await qiApi.getQualityInspectionApi(id)
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    if (isBackendMissingError(err)) return null
    const { code } = formatPurchaseApiError(err)
    if (code === 'QUALITY_INSPECTION_NOT_FOUND' || code === 'NOT_FOUND' || code === 'HTTP_404') {
      return null
    }
    throwApi(err)
  }
}

export async function createQualityInspection(
  input: QualityInspectionInput,
): Promise<QualityInspection> {
  if (!isApiMode()) return demo.createQualityInspection(input)
  try {
    const res = await qiApi.createQualityInspectionApi(
      mapDomainQualityInspectionInputToApiPayload(input),
    )
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

type QualityInspectionUpdatePatch = Partial<QualityInspectionInput> & {
  parameters?: QualityInspectionParameter[]
  acceptedQty?: number
  rejectedQty?: number
  sampleQty?: number
  inspectionPlan?: string
  remarks?: string
}

/** Sync header + first-line quantities. Backend replaces lines wholesale, so preserve the rest. */
async function patchQualityInspectionApi(
  id: string,
  patch: QualityInspectionUpdatePatch,
): Promise<QualityInspection> {
  const current = (await qiApi.getQualityInspectionApi(id)).data
  const payload: Record<string, unknown> = {}
  if (patch.inspectorName !== undefined || patch.inspectorId !== undefined) {
    payload.inspectedByName = patch.inspectorName ?? null
    payload.inspectedById = patch.inspectorId ?? null
  }
  if (patch.remarks !== undefined) payload.remarks = patch.remarks || null
  if (patch.inspectionPlan !== undefined) payload.inspectionPlan = patch.inspectionPlan || null
  if (patch.parameters !== undefined) {
    payload.parameters = patch.parameters.map((p) => ({
      id: p.id,
      parameter: p.parameter,
      specification: p.specification,
      minValue: p.minValue,
      maxValue: p.maxValue,
      observedValue: p.observedValue,
      unit: p.unit,
      result: p.result,
      remarks: p.remarks,
    }))
  }
  const hasQtyPatch =
    patch.sampleQty !== undefined
    || patch.acceptedQty !== undefined
    || patch.rejectedQty !== undefined
  if (hasQtyPatch && current.lines.length) {
    payload.lines = current.lines.map((l, index) =>
      index === 0
        ? {
            goodsReceiptLineId: l.goodsReceiptLineId,
            purchaseOrderLineId: l.purchaseOrderLineId,
            itemId: l.itemId,
            inspectedQuantity: Number(patch.sampleQty ?? l.inspectedQuantity) || 1,
            acceptedQuantity: Number(patch.acceptedQty ?? l.acceptedQuantity) || 0,
            rejectedQuantity: Number(patch.rejectedQty ?? l.rejectedQuantity) || 0,
            deviationQuantity: Number(l.deviationQuantity) || 0,
            remarks: l.remarks,
          }
        : {
            goodsReceiptLineId: l.goodsReceiptLineId,
            purchaseOrderLineId: l.purchaseOrderLineId,
            itemId: l.itemId,
            inspectedQuantity: Number(l.inspectedQuantity) || 1,
            acceptedQuantity: Number(l.acceptedQuantity) || 0,
            rejectedQuantity: Number(l.rejectedQuantity) || 0,
            deviationQuantity: Number(l.deviationQuantity) || 0,
            remarks: l.remarks,
          },
    )
  }
  const res = await qiApi.updateQualityInspectionApi(id, payload)
  return mapApiQualityInspectionToDomain(res.data)
}

export async function updateQualityInspection(
  id: string,
  input: QualityInspectionUpdatePatch,
): Promise<QualityInspection> {
  if (!isApiMode()) return demo.updateQualityInspection(id, input)
  try {
    return await patchQualityInspectionApi(id, input)
  } catch (err) {
    throwApi(err)
  }
}

export async function acceptQualityInspection(
  id: string,
  acceptedQty?: number,
  rejectedQty = 0,
): Promise<QualityInspection> {
  if (!isApiMode()) return demo.acceptQualityInspection(id, acceptedQty, rejectedQty)
  try {
    if (acceptedQty != null || rejectedQty > 0) {
      await patchQualityInspectionApi(id, { acceptedQty, rejectedQty })
      if (rejectedQty > 0) {
        const res = await qiApi.completeQualityInspectionApi(id, { outcome: 'AUTO' })
        return mapApiQualityInspectionToDomain(res.data)
      }
    }
    const res = await qiApi.acceptQualityInspectionApi(id, {})
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function rejectQualityInspection(
  id: string,
  rejectedQty?: number,
): Promise<QualityInspection> {
  if (!isApiMode()) return demo.rejectQualityInspection(id, rejectedQty)
  try {
    if (rejectedQty != null && rejectedQty >= 0) {
      // Persist split before complete — REJECT outcome would force full inspected qty.
      await patchQualityInspectionApi(id, { acceptedQty: 0, rejectedQty })
      const res = await qiApi.completeQualityInspectionApi(id, { outcome: 'AUTO' })
      return mapApiQualityInspectionToDomain(res.data)
    }
    const res = await qiApi.rejectQualityInspectionApi(id, {})
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function holdQualityInspection(id: string, remarks = ''): Promise<QualityInspection> {
  if (!isApiMode()) return demo.holdQualityInspection(id, remarks)
  try {
    const res = await qiApi.holdQualityInspectionApi(id, { remarks: remarks || undefined })
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelQualityInspection(
  id: string,
  remarks = '',
): Promise<QualityInspection> {
  if (!isApiMode()) {
    throw new PurchaseServiceError('NOT_SUPPORTED', 'Cancel quality inspection is only available in API mode.')
  }
  try {
    const res = await qiApi.cancelQualityInspectionApi(id, { remarks: remarks || undefined })
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function requestDeviationApproval(
  id: string,
  remarks: string,
): Promise<QualityInspection> {
  if (!isApiMode()) return demo.requestDeviationApproval(id, remarks)
  try {
    const res = await qiApi.completeQualityInspectionApi(id, {
      outcome: 'AUTO',
      deviationRemarks: remarks,
    })
    return mapApiQualityInspectionToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/* ─── Purchase Returns ─── */

function mapWizardPrefillFromApi(api: returnApi.ApiReturnWizardPrefill): ReturnWizardPrefill {
  const linesSrc = api.linesPrefill?.length
    ? api.linesPrefill
    : (api.lines ?? [])
        .filter((l) => Number(l.remainingReturnableQuantity) > 0)
        .map((l) => ({
          goodsReceiptLineId: l.goodsReceiptLineId,
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          returnQuantity: l.remainingReturnableQuantity,
          rate: l.rate,
          batchNumber: l.batchNumber,
          serialNumber: l.serialNumber,
          remainingReturnableQuantity: l.remainingReturnableQuantity,
        }))
  return {
    vendorId: api.vendorId || '',
    purchaseOrderId: api.purchaseOrderId,
    goodsReceiptId: api.goodsReceiptId,
    qualityInspectionId: api.qualityInspectionId,
    qualityInspectionNumber: api.qualityInspectionNumber,
    warehouseId: api.warehouseId,
    suggestedReturnType: api.suggestedReturnType || 'CREDIT',
    replacementRequired: api.suggestedReturnType === 'REPLACEMENT',
    reason: api.reason || 'Rejected on quality inspection',
    totalRejected: Number(api.totalRejected) || 0,
    totalReturned: Number(api.totalReturned) || 0,
    totalRemaining: Number(api.totalRemaining) || 0,
    lines: linesSrc.map((l) => ({
      goodsReceiptLineId: l.goodsReceiptLineId,
      purchaseOrderLineId: l.purchaseOrderLineId,
      itemId: l.itemId || '',
      itemCode: l.itemCode || '',
      itemName: l.itemName || '',
      returnQty: Number(l.returnQuantity) || Number(l.remainingReturnableQuantity) || 0,
      unitCost: Number(l.rate) || 0,
      batchLotNo: l.batchNumber || '',
      serialNumber: l.serialNumber || '',
      availableReturnQty:
        Number(l.remainingReturnableQuantity) || Number(l.returnQuantity) || 0,
    })),
  }
}

/** Demo fallback: build wizard-style prefill without posting a return document. */
async function buildDemoReturnWizardPrefill(params: {
  qualityInspectionId?: string
  goodsReceiptId?: string
}): Promise<ReturnWizardPrefill> {
  if (params.qualityInspectionId) {
    const qi = await demo.getQualityInspectionById(params.qualityInspectionId)
    if (!qi) throw new PurchaseServiceError('QI_NOT_FOUND', 'Quality inspection not found')
    if (qi.rejectedQty <= 0) {
      throw new PurchaseServiceError('RETURN_NO_QTY', 'Quality inspection has no rejected quantity')
    }
    const grn = qi.goodsReceiptId ? await demo.getGRNById(qi.goodsReceiptId) : null
    const grnLine = grn?.lines.find((l) => l.id === qi.goodsReceiptLineId)
    return {
      vendorId: qi.vendor.id,
      purchaseOrderId: qi.purchaseOrderId,
      goodsReceiptId: qi.goodsReceiptId,
      qualityInspectionId: qi.id,
      qualityInspectionNumber: qi.documentNumber,
      warehouseId: grn?.warehouseId ?? qi.location.id,
      suggestedReturnType: 'CREDIT',
      replacementRequired: false,
      reason: qi.remarks || `Rejected on ${qi.documentNumber}`,
      totalRejected: qi.rejectedQty,
      totalReturned: 0,
      totalRemaining: qi.rejectedQty,
      lines: [
        {
          goodsReceiptLineId: qi.goodsReceiptLineId,
          purchaseOrderLineId: null,
          itemId: qi.itemId,
          itemCode: qi.itemCode || '',
          itemName: qi.itemName,
          returnQty: qi.rejectedQty,
          unitCost: grnLine?.rate ?? 0,
          batchLotNo: qi.batchLotNo || '',
          serialNumber: grnLine?.serialNumber || '',
          availableReturnQty: qi.rejectedQty,
        },
      ],
    }
  }
  if (params.goodsReceiptId) {
    const grn = await demo.getGRNById(params.goodsReceiptId)
    if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', 'GRN not found')
    const lines = grn.lines
      .filter((l) => (l.rejectedQty || 0) > 0 || (l.damagedQty || 0) > 0 || (l.excessQty || 0) > 0)
      .map((l) => {
        const qty = Math.max(l.rejectedQty || 0, l.damagedQty || 0, l.excessQty || 0)
        return {
          goodsReceiptLineId: l.id,
          purchaseOrderLineId: l.purchaseOrderLineId ?? null,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          returnQty: qty,
          unitCost: l.rate,
          batchLotNo: l.batchNumber || '',
          serialNumber: l.serialNumber || '',
          availableReturnQty: qty,
        }
      })
    if (!lines.length) {
      throw new PurchaseServiceError('RETURN_NO_QTY', 'No returnable quantity on this GRN')
    }
    return {
      vendorId: grn.vendor.id,
      purchaseOrderId: grn.purchaseOrderId,
      goodsReceiptId: grn.id,
      qualityInspectionId: null,
      qualityInspectionNumber: null,
      warehouseId: grn.warehouseId,
      suggestedReturnType: 'CREDIT',
      replacementRequired: false,
      reason: `Rejected on ${grn.documentNumber}`,
      totalRejected: lines.reduce((s, l) => s + l.returnQty, 0),
      totalReturned: 0,
      totalRemaining: lines.reduce((s, l) => s + l.returnQty, 0),
      lines,
    }
  }
  throw new PurchaseServiceError('RETURN_PREFILL_ARGS', 'Provide qualityInspectionId or goodsReceiptId')
}

/**
 * Prefill purchase return create wizard from QI and/or GRN
 * (does not create a document — forms stay on /returns/new until save).
 */
export async function getReturnWizardPrefill(params: {
  qualityInspectionId?: string
  goodsReceiptId?: string
}): Promise<ReturnWizardPrefill> {
  if (!params.qualityInspectionId && !params.goodsReceiptId) {
    throw new PurchaseServiceError(
      'RETURN_PREFILL_ARGS',
      'Provide qualityInspectionId or goodsReceiptId for return wizard prefill',
    )
  }
  if (!isApiMode()) return buildDemoReturnWizardPrefill(params)
  try {
    const res = await returnApi.getReturnWizardPrefillApi({
      qualityInspectionId: params.qualityInspectionId,
      goodsReceiptId: params.goodsReceiptId,
    })
    const mapped = mapWizardPrefillFromApi(res.data)
    if (!mapped.vendorId) {
      throw new PurchaseServiceError('RETURN_NO_VENDOR', 'Cannot prefill — no vendor on QI/GRN')
    }
    if (!mapped.lines.length) {
      throw new PurchaseServiceError(
        'RETURN_NO_QTY',
        'No remaining returnable quantity for purchase return',
      )
    }
    return mapped
  } catch (err) {
    throwApi(err)
  }
}

export async function getSupplierQualityDashboardWidgets(): Promise<SupplierQualityDashboardWidgets> {
  const empty: SupplierQualityDashboardWidgets = {
    pendingReturns: 0,
    rejectedStockQty: 0,
    rejectedStockValue: 0,
    replacementPending: 0,
    vendorAdjustmentsPending: 0,
    topRejectedVendors: [],
    mostRejectedItems: [],
  }
  if (!isApiMode()) return empty
  try {
    const res = await supplierQualityApi.getSupplierQualityDashboardWidgetsApi()
    const d = res.data
    const rejectedQty = Number(d.rejectedStockQty) || 0
    const masters = useMasterStore.getState()
    return {
      pendingReturns: Number(d.pendingReturns) || 0,
      rejectedStockQty: rejectedQty,
      // Value pricing not returned by API yet — surface qty under the reject-stock KPI.
      rejectedStockValue: rejectedQty,
      replacementPending: Number(d.replacementPending) || 0,
      vendorAdjustmentsPending: Number(d.vendorAdjustmentsPending) || 0,
      topRejectedVendors: (d.topRejectedVendors ?? []).map((r) => {
        const v = masters.getVendor(r.vendorId)
        return {
          vendorId: r.vendorId,
          vendorName: r.vendorName || v?.vendorName,
          vendorCode: r.vendorCode || v?.vendorCode,
          rejectedQty: Number(r.rejectedQty) || 0,
          acceptedQty: Number(r.acceptedQty) || 0,
          inspectionCount: Number(r.inspectionCount) || 0,
          rejectRatePct: Number(r.rejectRatePct) || 0,
        }
      }),
      mostRejectedItems: (d.mostRejectedItems ?? []).map((r) => {
        const item = masters.getItem(r.itemKey)
        return {
          itemKey: r.itemKey,
          itemCode: r.itemCode || item?.itemCode || undefined,
          itemName: r.itemName || item?.itemName || undefined,
          rejectedQty: Number(r.rejectedQty) || 0,
          acceptedQty: Number(r.acceptedQty) || 0,
          rejectRatePct: Number(r.rejectRatePct) || 0,
        }
      }),
    }
  } catch (err) {
    if (isBackendMissingError(err)) return empty
    throwApi(err)
  }
}

export async function getVendorQualityScorecard(
  vendorId: string,
): Promise<VendorQualityScorecard | null> {
  if (!isApiMode()) return null
  try {
    const res = await supplierQualityApi.getVendorQualityScorecardApi(vendorId)
    return res.data
  } catch (err) {
    if (isBackendMissingError(err)) return null
    const { code } = formatPurchaseApiError(err)
    if (code === 'NOT_FOUND' || code === 'HTTP_404') return null
    throwApi(err)
  }
}

export async function getItemSupplierQualityHistory(
  itemId: string,
): Promise<ItemSupplierQualityHistory> {
  if (!isApiMode()) return { itemId, timeline: [] }
  try {
    const res = await supplierQualityApi.getItemSupplierQualityHistoryApi(itemId)
    return {
      itemId: res.data.itemId,
      timeline: (res.data.timeline ?? []).map((e) => ({
        at: e.at,
        type: e.type,
        number: e.number,
        status: e.status,
        href: e.href,
        detail: e.detail,
      })),
    }
  } catch (err) {
    if (isBackendMissingError(err)) return { itemId, timeline: [] }
    throwApi(err)
  }
}

export async function getPurchaseReturns(): Promise<PurchaseReturn[]> {
  if (!isApiMode()) return demo.getPurchaseReturns()
  try {
    const res = await returnApi.listPurchaseReturnsApi({ page: 1, limit: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPurchaseReturnToDomain)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseReturnList(): Promise<PurchaseReturnListRow[]> {
  if (!isApiMode()) return demo.getPurchaseReturnList()
  try {
    const res = await returnApi.listPurchaseReturnsApi({ page: 1, limit: 100, sortOrder: 'desc' })
    return res.data.map(mapApiPurchaseReturnToListRow)
  } catch (err) {
    throwApi(err)
  }
}

export async function getPurchaseReturnById(id: string): Promise<PurchaseReturn | null> {
  if (!isApiMode()) return demo.getPurchaseReturnById(id)
  try {
    const res = await returnApi.getPurchaseReturnApi(id)
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    if (isBackendMissingError(err)) return null
    const { code } = formatPurchaseApiError(err)
    if (code === 'PURCHASE_RETURN_NOT_FOUND' || code === 'NOT_FOUND' || code === 'HTTP_404') {
      return null
    }
    throwApi(err)
  }
}

export async function createPurchaseReturn(input: PurchaseReturnInput): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.createPurchaseReturn(input)
  try {
    const res = await returnApi.createPurchaseReturnApi(
      mapDomainPurchaseReturnInputToApiPayload(input),
    )
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function updatePurchaseReturn(
  id: string,
  input: PurchaseReturnInput,
): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.updatePurchaseReturn(id, input)
  try {
    const res = await returnApi.updatePurchaseReturnApi(
      id,
      mapDomainPurchaseReturnInputToApiPayload(input),
    )
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function createPurchaseReturnFromGrn(
  grnId: string,
  options?: { origin?: PurchaseReturnOrigin; returnReason?: PurchaseReturnReason },
): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.createPurchaseReturnFromGrn(grnId, options)
  const origin = options?.origin ?? 'grn_rejected_quantity'
  const returnReason =
    options?.returnReason
    ?? (origin === 'quality_rejection'
      ? 'quality_rejection'
      : origin === 'damaged_material'
        ? 'damaged'
        : origin === 'excess_receipt'
          ? 'excess_quantity'
          : origin === 'wrong_material'
            ? 'wrong_item'
            : 'quality_rejection')

  // Quality / rejected qty: use live remaining-returnable wizard (QI-aware).
  if (origin === 'quality_rejection' || origin === 'grn_rejected_quantity') {
    try {
      const prefill = await getReturnWizardPrefill({ goodsReceiptId: grnId })
      if (prefill.lines.length) {
        return createPurchaseReturn({
          vendorId: prefill.vendorId,
          origin,
          goodsReceiptId: prefill.goodsReceiptId,
          purchaseOrderId: prefill.purchaseOrderId,
          qualityInspectionId: prefill.qualityInspectionId,
          returnReason,
          returnType: prefill.suggestedReturnType,
          warehouseId: prefill.warehouseId ?? undefined,
          replacementRequired: prefill.replacementRequired,
          debitNoteRequired: true,
          remarks: prefill.reason,
          lines: prefill.lines.map((l) => ({
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            returnQty: l.returnQty,
            unitCost: l.unitCost,
            goodsReceiptLineId: l.goodsReceiptLineId,
            purchaseOrderLineId: l.purchaseOrderLineId,
            description: l.itemName,
            batchLotNo: l.batchLotNo,
            serialNumber: l.serialNumber,
            availableReturnQty: l.availableReturnQty,
            reason: returnReason,
            remarks: prefill.reason,
          })),
        })
      }
    } catch {
      // Fall through to GRN line mapping.
    }
  }

  const grn = await getGRNById(grnId)
  if (!grn) throw new PurchaseServiceError('GRN_NOT_FOUND', `GRN not found: ${grnId}`)
  const lines = grn.lines
    .map((l) => {
      const qty =
        origin === 'excess_receipt'
          ? l.excessQty
          : origin === 'damaged_material'
            ? l.damagedQty || l.rejectedQty
            : l.rejectedQty
      return {
        itemId: l.itemId,
        returnQty: Math.max(0, qty),
        unitCost: l.rate,
        goodsReceiptLineId: l.id,
        description: l.description || l.itemName,
        batchLotNo: l.batchNumber || '',
        serialNumber: l.serialNumber || '',
        reason: returnReason,
      }
    })
    .filter((l) => l.returnQty > 0)
  if (!lines.length) {
    throw new PurchaseServiceError('RETURN_NO_QTY', 'No returnable quantity on this GRN')
  }
  return createPurchaseReturn({
    vendorId: grn.vendor.id,
    origin,
    goodsReceiptId: grn.id,
    purchaseOrderId: grn.purchaseOrderId,
    returnReason,
    warehouseId: grn.warehouseId,
    remarks: `Created from ${grn.documentNumber}`,
    lines,
  })
}

export async function createPurchaseReturnFromQualityInspection(
  qualityInspectionId: string,
): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.createPurchaseReturnFromQualityInspection(qualityInspectionId)
  const prefill = await getReturnWizardPrefill({ qualityInspectionId })
  return createPurchaseReturn({
    vendorId: prefill.vendorId,
    origin: 'quality_rejection',
    goodsReceiptId: prefill.goodsReceiptId,
    purchaseOrderId: prefill.purchaseOrderId,
    qualityInspectionId: prefill.qualityInspectionId,
    returnReason: 'quality_rejection',
    returnType: prefill.suggestedReturnType,
    warehouseId: prefill.warehouseId ?? undefined,
    replacementRequired: prefill.replacementRequired,
    debitNoteRequired: true,
    remarks: prefill.reason,
    lines: prefill.lines.map((l) => ({
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      returnQty: l.returnQty,
      unitCost: l.unitCost,
      goodsReceiptLineId: l.goodsReceiptLineId,
      purchaseOrderLineId: l.purchaseOrderLineId,
      description: l.itemName,
      batchLotNo: l.batchLotNo,
      serialNumber: l.serialNumber,
      availableReturnQty: l.availableReturnQty,
      reason: 'quality_rejection',
      remarks: prefill.reason,
    })),
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
  if (!isApiMode()) return demo.createPurchaseReturnFromReason(origin, options)
  if (options.goodsReceiptId) {
    return createPurchaseReturnFromGrn(options.goodsReceiptId, {
      origin,
      returnReason: options.returnReason,
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
    returnReason: options.returnReason ?? 'other',
    lines: options.lines,
  })
}

export async function submitPurchaseReturn(id: string): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.submitPurchaseReturn(id)
  try {
    const res = await returnApi.submitPurchaseReturnApi(id, {})
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/**
 * API mode: submit moves DRAFT → SUBMITTED (pending approval).
 * Approve advances SUBMITTED → APPROVED.
 */
export async function approvePurchaseReturn(id: string, remarks = ''): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.approvePurchaseReturn(id, remarks)
  try {
    const res = await returnApi.approvePurchaseReturnApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

/** API: APPROVED → SHIPPED (REJECTED → BLOCKED transit via inventory engine). */
export async function shipPurchaseReturn(id: string, remarks = ''): Promise<PurchaseReturn> {
  if (!isApiMode()) {
    throw new PurchaseServiceError(
      'RETURN_SHIP_DEMO',
      'Ship return is available in API mode only',
    )
  }
  try {
    const res = await returnApi.shipPurchaseReturnApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function postPurchaseReturn(id: string): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.postPurchaseReturn(id)
  try {
    const res = await returnApi.completePurchaseReturnApi(id, {})
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function linkReplacementGrnToReturn(
  id: string,
  goodsReceiptId: string,
): Promise<PurchaseReturn> {
  if (!isApiMode()) {
    throw new PurchaseServiceError(
      'RETURN_REPLACEMENT_DEMO',
      'Link replacement GRN is available in API mode only',
    )
  }
  try {
    const res = await returnApi.linkReplacementGrnApi(id, { goodsReceiptId })
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function cancelPurchaseReturn(id: string, remarks = 'Cancelled'): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.cancelPurchaseReturn(id, remarks)
  try {
    const res = await returnApi.cancelPurchaseReturnApi(id, remarks ? { remarks } : {})
    return mapApiPurchaseReturnToDomain(res.data)
  } catch (err) {
    throwApi(err)
  }
}

export async function createDebitNoteFromReturn(id: string): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.createDebitNoteFromReturn(id)
  notSupportedInApiMode('Debit note from return')
}

export async function createReplacementPoFromReturn(id: string): Promise<PurchaseReturn> {
  if (!isApiMode()) return demo.createReplacementPoFromReturn(id)
  notSupportedInApiMode('Replacement PO from return')
}

/* ─── Shared helpers (approval history remains demo-only until timeline covers returns/invoices) ─── */

export async function getApprovalHistory(documentId?: string) {
  if (!isApiMode()) return demo.getApprovalHistory(documentId)
  return []
}
