import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GrnHeader,
  GrnLine,
  OpenPoRow,
  PendingPrRow,
  PurchaseOrder,
  PurchaseRequisition,
  PurchaseReturn,
  PurchaseReturnLine,
  PurchaseReturnReason,
  RequestForQuotation,
  VendorComparisonRow,
  VendorPerformanceRow,
  VendorQuotation,
} from '../types/purchase'
import {
  assertStatusTransition,
  computeLandedCostPerUnit,
  MANUAL_PR_PURPOSE_LABELS,
  PO_STATUS_FLOW,
  PR_STATUS_FLOW,
  poIsAmendable,
  type ManualPrPurpose,
} from '../types/purchase'
import type { MrpMaterialLine, MrpRun } from '../types/mrp'
import { stampApproved, stampCreated, stampModified, mergeAudit } from '../utils/audit'
import { nextDocumentNo } from '../utils/documentNumbers'
import { assertPermission, getSessionUser } from '../utils/permissions'
import {
  advanceApprovalStep,
  assertMatrixApproval,
  buildApprovalContext,
  syncApprovalRequest,
} from '../utils/approvalEngine'
import { itemRequiresIncomingQc, getQuarantineWarehouseId } from '../data/quality/itemQcConfig'
import { usePurchaseMasterStore } from './purchaseMasterStore'
import { resolveDefaultCommercialTerm } from '../utils/quotationTermUtils'
import { useMasterStore } from './masterStore'
import { useInventoryStore } from './inventoryStore'
import { getQualityStoreState } from './storeBridge'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { normalizePurchasePersisted, type PurchasePersistSlice } from '../utils/documentNormalize'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function defaultPaymentTerms(): string {
  return resolveDefaultCommercialTerm('payment-terms').text
}

function defaultDeliveryTerms(): string {
  return resolveDefaultCommercialTerm('delivery-terms').text
}

interface PurchaseState {
  requisitions: PurchaseRequisition[]
  rfqs: RequestForQuotation[]
  purchaseOrders: PurchaseOrder[]
  grns: GrnHeader[]
  vendorQuotations: VendorQuotation[]
  purchaseReturns: PurchaseReturn[]

  getPr: (id: string) => PurchaseRequisition | undefined
  getRfq: (id: string) => RequestForQuotation | undefined
  getPo: (id: string) => PurchaseOrder | undefined
  getGrn: (id: string) => GrnHeader | undefined
  getVendorQuotation: (id: string) => VendorQuotation | undefined
  getPurchaseReturn: (id: string) => PurchaseReturn | undefined

  createPrFromMrpRun: (run: MrpRun, salesOrderId?: string) => string
  createManualPr: (input: {
    source: 'manual' | 'reorder'
    purpose: ManualPrPurpose
    lines: Omit<PurchaseRequisition['lines'][0], 'id' | 'mrpMaterialLineId' | 'mrpRunId'>[]
    salesOrderId?: string | null
    workOrderId?: string | null
  }) => { ok: boolean; error?: string; prId?: string }
  submitPr: (id: string) => { ok: boolean; error?: string }
  approvePr: (id: string) => { ok: boolean; error?: string }
  cancelPr: (id: string) => { ok: boolean; error?: string }

  createRfqFromPr: (prId: string, vendorIds: string[]) => { ok: boolean; error?: string; rfqId?: string }
  sendRfq: (id: string) => { ok: boolean; error?: string }
  closeRfq: (id: string) => { ok: boolean; error?: string }
  cancelRfq: (id: string) => { ok: boolean; error?: string }
  addRfqQuote: (
    rfqId: string,
    vendorId: string,
    itemId: string,
    input: { rate: number; leadTimeDays: number; deliveryDate?: string; paymentTerms?: string; freightAmount?: number; gstPct?: number; remarks?: string },
  ) => { ok: boolean; error?: string }
  setRfqRecommendation: (rfqId: string, vendorId: string, note: string) => { ok: boolean; error?: string }
  getVendorComparison: (rfqId: string) => VendorComparisonRow[]

  createPoFromRfq: (rfqId: string, vendorId: string) => { ok: boolean; error?: string; poId?: string }
  createPoFromPr: (prId: string, vendorId: string, lineIds?: string[], paymentTerms?: string) => { ok: boolean; error?: string; poId?: string }
  createManualPo: (input: {
    vendorId: string
    orderDate?: string
    expectedDate?: string
    paymentTerms?: string
    salesOrderId?: string | null
    lines: { itemId: string; warehouseId: string; qty: number; rate: number; requiredDate: string }[]
  }) => { ok: boolean; error?: string; poId?: string }
  submitPo: (id: string) => { ok: boolean; error?: string }
  approvePo: (id: string) => { ok: boolean; error?: string; pendingNextApprover?: string }
  sendPo: (id: string) => { ok: boolean; error?: string }
  releasePo: (id: string) => { ok: boolean; error?: string }
  amendPo: (id: string, lines: PurchaseOrder['lines'], reason: string) => { ok: boolean; error?: string }
  closePo: (id: string) => { ok: boolean; error?: string }
  cancelPo: (id: string) => { ok: boolean; error?: string }

  postGrn: (
    poId: string,
    receiptLines: { poLineId: string; receivedQty: number; acceptedQty?: number; rejectedQty?: number }[],
  ) => { ok: boolean; error?: string; grnId?: string }

  createVendorQuotationFromRfq: (rfqId: string, vendorId: string) => { ok: boolean; error?: string; quoteId?: string }
  createPurchaseReturnFromGrn: (
    grnId: string,
    lines: { grnLineId: string; returnQty: number; reason: PurchaseReturnReason }[],
  ) => { ok: boolean; error?: string; returnId?: string }
  approvePurchaseReturn: (id: string) => { ok: boolean; error?: string }
  dispatchPurchaseReturn: (id: string) => { ok: boolean; error?: string }

  getPendingPrReport: () => PendingPrRow[]
  getOpenPoReport: () => OpenPoRow[]
  getDelayedPoReport: () => OpenPoRow[]
  getVendorPerformanceReport: () => VendorPerformanceRow[]
  getMaterialExpectedThisWeek: () => { poNo: string; itemCode: string; qty: number; expectedDate: string }[]
}

function linesToPr(run: MrpRun, salesOrderId?: string): MrpMaterialLine[] {
  const lines = run.materialLines.filter((m) => m.suggestedPoQty > 0 || m.suggestedPrQty > 0)
  if (salesOrderId) return lines.filter((m) => m.salesOrderId === salesOrderId)
  return lines
}

function buildPoLinesFromRfq(rfq: RequestForQuotation, vendorId: string, pr: PurchaseRequisition | undefined) {
  const master = useMasterStore.getState()
  return rfq.lines.map((l) => {
    const quote = rfq.quotes.find((q) => q.vendorId === vendorId && q.itemId === l.itemId)
    const prLine = pr?.lines.find((pl) => pl.id === l.prLineId)
    const item = master.getItem(l.itemId)!
    return {
      id: genId('pol'),
      itemId: l.itemId,
      warehouseId: l.warehouseId,
      qty: l.qty,
      rate: quote?.quotedRate ?? item.standardRate,
      receivedQty: 0,
      mrpMaterialLineId: prLine?.mrpMaterialLineId ?? null,
      prLineId: l.prLineId,
      requiredDate: prLine?.requiredDate ?? new Date().toISOString().slice(0, 10),
    }
  })
}

export const usePurchaseStore = create<PurchaseState>()(
  persist(
    (set, get) => ({
      requisitions: [],
      rfqs: [],
      purchaseOrders: [],
      grns: [],
      vendorQuotations: [],
      purchaseReturns: [],

      getPr: (id) => get().requisitions.find((p) => p.id === id),
      getRfq: (id) => get().rfqs.find((r) => r.id === id),
      getPo: (id) => get().purchaseOrders.find((p) => p.id === id),
      getGrn: (id) => get().grns.find((g) => g.id === id),
      getVendorQuotation: (id) => get().vendorQuotations.find((q) => q.id === id),
      getPurchaseReturn: (id) => get().purchaseReturns.find((r) => r.id === id),

      createPrFromMrpRun: (run, salesOrderId) => {
        const demandLines = linesToPr(run, salesOrderId)
        const soLine = demandLines[0]
        const audit = stampCreated()
        const pr: PurchaseRequisition = {
          id: genId('pr'),
          prNo: nextDocumentNo('PR-', get().requisitions.map((p) => p.prNo)),
          source: 'mrp',
          mrpRunId: run.id,
          salesOrderId: salesOrderId ?? soLine?.salesOrderId ?? null,
          salesOrderNo: soLine?.salesOrderNo ?? null,
          workOrderId: null,
          workOrderNo: null,
          status: 'draft',
          requestedBy: audit.createdByName,
          purpose: null,
          lines: demandLines.map((m) => ({
            id: genId('prl'),
            itemId: m.itemId,
            warehouseId: m.warehouseId,
            qty: m.suggestedPoQty > 0 ? m.suggestedPoQty : m.suggestedPrQty,
            requiredDate: m.requiredDate,
            mrpMaterialLineId: m.id,
            mrpRunId: run.id,
            salesOrderId: m.salesOrderId,
            workOrderId: null,
            remarks: `Shortage ${m.shortageQty} · ${m.itemCode}`,
          })),
          ...audit,
        }
        set((s) => ({ requisitions: [pr, ...s.requisitions] }))
        return pr.id
      },

      createManualPr: (input) => {
        const perm = assertPermission('purchase', 'create')
        if (!perm.ok) return perm
        if (input.lines.length === 0) return { ok: false, error: 'At least one line required' }

        const master = useMasterStore.getState()
        const purposeLabel = MANUAL_PR_PURPOSE_LABELS[input.purpose]

        for (const line of input.lines) {
          const item = master.getItem(line.itemId)
          if (!item) return { ok: false, error: 'Item not found in Item Master' }
          if (!item.isActive) return { ok: false, error: `Item ${item.itemCode} is inactive` }
          if (!item.isPurchasable) return { ok: false, error: `${item.itemCode} is not purchasable` }
          const wh = master.getWarehouse(line.warehouseId)
          if (!wh) return { ok: false, error: 'Warehouse not found' }
          if (!wh.isActive) return { ok: false, error: `Warehouse ${wh.warehouseCode} is inactive` }
          if (line.qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' }
        }

        const audit = stampCreated()
        const pr: PurchaseRequisition = {
          id: genId('pr'),
          prNo: nextDocumentNo('PR-', get().requisitions.map((p) => p.prNo)),
          source: input.source,
          mrpRunId: null,
          salesOrderId: input.salesOrderId ?? input.lines[0]?.salesOrderId ?? null,
          salesOrderNo: null,
          workOrderId: input.workOrderId ?? input.lines[0]?.workOrderId ?? null,
          workOrderNo: null,
          status: 'draft',
          requestedBy: audit.createdByName,
          purpose: input.purpose,
          lines: input.lines.map((l) => ({
            ...l,
            id: genId('prl'),
            mrpMaterialLineId: null,
            mrpRunId: null,
            remarks: l.remarks?.trim() ? l.remarks : purposeLabel,
          })),
          ...audit,
        }
        set((s) => ({ requisitions: [pr, ...s.requisitions] }))
        return { ok: true, prId: pr.id }
      },

      submitPr: (id) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const pr = get().getPr(id)
        if (!pr) return { ok: false, error: 'PR not found' }
        const tr = assertStatusTransition(PR_STATUS_FLOW, pr.status, 'submitted')
        if (!tr.ok) return tr
        set((s) => ({
          requisitions: s.requisitions.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'submitted' }) : p,
          ),
        }))
        return { ok: true }
      },

      approvePr: (id) => {
        const perm = assertPermission('purchase', 'approve')
        if (!perm.ok) return perm
        const pr = get().getPr(id)
        if (!pr) return { ok: false, error: 'PR not found' }
        const tr = assertStatusTransition(PR_STATUS_FLOW, pr.status, 'approved')
        if (!tr.ok) return tr
        set((s) => ({
          requisitions: s.requisitions.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), ...stampApproved(), status: 'approved' }) : p,
          ),
        }))
        return { ok: true }
      },

      cancelPr: (id) => {
        const perm = assertPermission('purchase', 'cancel')
        if (!perm.ok) return perm
        const pr = get().getPr(id)
        if (!pr) return { ok: false, error: 'PR not found' }
        if (pr.status === 'converted') return { ok: false, error: 'Converted PR cannot be cancelled' }
        set((s) => ({
          requisitions: s.requisitions.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'cancelled' }) : p,
          ),
        }))
        return { ok: true }
      },

      createRfqFromPr: (prId, vendorIds) => {
        const perm = assertPermission('purchase', 'create')
        if (!perm.ok) return perm
        const pr = get().getPr(prId)
        if (!pr) return { ok: false, error: 'PR not found' }
        if (pr.status !== 'approved') return { ok: false, error: 'PR must be approved' }
        if (vendorIds.length < 2) return { ok: false, error: 'Select at least 2 vendors for comparison' }
        const audit = stampCreated()
        const rfq: RequestForQuotation = {
          id: genId('rfq'),
          rfqNo: nextDocumentNo('RFQ-', get().rfqs.map((r) => r.rfqNo)),
          prId,
          status: 'draft',
          vendorIds,
          lines: pr.lines.map((l) => ({
            id: genId('rfql'),
            itemId: l.itemId,
            warehouseId: l.warehouseId,
            qty: l.qty,
            prLineId: l.id,
          })),
          quotes: [],
          recommendedVendorId: null,
          recommendationNote: '',
          ...audit,
        }
        set((s) => ({ rfqs: [rfq, ...s.rfqs] }))
        return { ok: true, rfqId: rfq.id }
      },

      sendRfq: (id) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const rfq = get().getRfq(id)
        if (!rfq) return { ok: false, error: 'RFQ not found' }
        if (rfq.status !== 'draft') return { ok: false, error: 'Only draft RFQs can be sent' }
        if (rfq.vendorIds.length < 2) return { ok: false, error: 'Invite at least 2 vendors before sending' }
        set((s) => ({
          rfqs: s.rfqs.map((r) =>
            r.id === id ? mergeAudit(r, { ...stampModified(r), status: 'sent' }) : r,
          ),
        }))
        return { ok: true }
      },

      closeRfq: (id) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const rfq = get().getRfq(id)
        if (!rfq) return { ok: false, error: 'RFQ not found' }
        if (rfq.status === 'closed' || rfq.status === 'cancelled') {
          return { ok: false, error: 'RFQ is already closed' }
        }
        set((s) => ({
          rfqs: s.rfqs.map((r) =>
            r.id === id ? mergeAudit(r, { ...stampModified(r), status: 'closed' }) : r,
          ),
        }))
        return { ok: true }
      },

      cancelRfq: (id) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const rfq = get().getRfq(id)
        if (!rfq) return { ok: false, error: 'RFQ not found' }
        if (rfq.status === 'closed') return { ok: false, error: 'Closed RFQ cannot be cancelled' }
        const hasPo = get().purchaseOrders.some((p) => p.rfqId === id)
        if (hasPo) return { ok: false, error: 'RFQ linked to PO cannot be cancelled' }
        set((s) => ({
          rfqs: s.rfqs.map((r) =>
            r.id === id ? mergeAudit(r, { ...stampModified(r), status: 'cancelled' }) : r,
          ),
        }))
        return { ok: true }
      },

      addRfqQuote: (rfqId, vendorId, itemId, input) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const deliveryDate =
          input.deliveryDate ??
          new Date(Date.now() + (input.leadTimeDays || 7) * 86400000).toISOString().slice(0, 10)
        set((s) => ({
          rfqs: s.rfqs.map((r) => {
            if (r.id !== rfqId) return r
            const filtered = r.quotes.filter((q) => !(q.vendorId === vendorId && q.itemId === itemId))
            return mergeAudit(r, {
              ...stampModified(r),
              quotes: [
                ...filtered,
                {
                  vendorId,
                  itemId,
                  quotedRate: input.rate,
                  leadTimeDays: input.leadTimeDays,
                  deliveryDate,
                  paymentTerms: input.paymentTerms ?? defaultPaymentTerms(),
                  freightAmount: input.freightAmount ?? 0,
                  gstPct: input.gstPct ?? 18,
                  remarks: input.remarks ?? '',
                },
              ],
              status: 'quoted',
            })
          }),
        }))
        get().createVendorQuotationFromRfq(rfqId, vendorId)
        return { ok: true }
      },

      setRfqRecommendation: (rfqId, vendorId, note) => {
        const perm = assertPermission('purchase', 'approve')
        if (!perm.ok) return perm
        set((s) => ({
          rfqs: s.rfqs.map((r) =>
            r.id === rfqId
              ? mergeAudit(r, { ...stampModified(r), recommendedVendorId: vendorId, recommendationNote: note })
              : r,
          ),
        }))
        return { ok: true }
      },

      getVendorComparison: (rfqId) => {
        const rfq = get().getRfq(rfqId)
        if (!rfq) return []
        const master = useMasterStore.getState()
        const rows: VendorComparisonRow[] = []
        for (const q of rfq.quotes) {
          const line = rfq.lines.find((l) => l.itemId === q.itemId)
          const item = master.getItem(q.itemId)
          const vendor = master.vendors.find((v) => v.id === q.vendorId)
          const maps = master.getVendorMapsForItem(q.itemId)
          rows.push({
            vendorId: q.vendorId,
            vendorName: vendor?.vendorName ?? q.vendorId,
            itemId: q.itemId,
            itemCode: item?.itemCode ?? '—',
            quotedRate: q.quotedRate,
            landedCostPerUnit: computeLandedCostPerUnit(q.quotedRate, line?.qty ?? 1, q.freightAmount, q.gstPct),
            deliveryDate: q.deliveryDate,
            leadTimeDays: q.leadTimeDays,
            paymentTerms: q.paymentTerms,
            isPreferred: maps.some((m) => m.vendorId === q.vendorId && m.isPreferred),
            rank: 0,
          })
        }
        rows.sort((a, b) => a.landedCostPerUnit - b.landedCostPerUnit)
        return rows.map((r, i) => ({ ...r, rank: i + 1 }))
      },

      createPoFromRfq: (rfqId, vendorId) => {
        const perm = assertPermission('purchase', 'create')
        if (!perm.ok) return perm
        const rfq = get().getRfq(rfqId)
        if (!rfq) return { ok: false, error: 'RFQ not found' }
        const pr = get().getPr(rfq.prId)
        const master = useMasterStore.getState()
        const vendor = master.vendors.find((v) => v.id === vendorId)
        if (!vendor?.isActive) return { ok: false, error: 'Vendor is inactive' }
        const quote = rfq.quotes.find((q) => q.vendorId === vendorId)
        const audit = stampCreated()
        const poLines = buildPoLinesFromRfq(rfq, vendorId, pr)
        const po: PurchaseOrder = {
          id: genId('po'),
          poNo: nextDocumentNo('PO-', get().purchaseOrders.map((p) => p.poNo)),
          revisionNo: 1,
          vendorId,
          prId: rfq.prId,
          rfqId,
          mrpRunId: pr?.mrpRunId ?? null,
          salesOrderId: pr?.salesOrderId ?? null,
          status: 'draft',
          orderDate: new Date().toISOString().slice(0, 10),
          expectedDate: poLines[0]?.requiredDate ?? new Date().toISOString().slice(0, 10),
          paymentTerms: quote?.paymentTerms ?? defaultPaymentTerms(),
          lines: poLines,
          revisions: [],
          sentAt: null,
          ...audit,
        }
        set((s) => ({
          purchaseOrders: [po, ...s.purchaseOrders],
          requisitions: s.requisitions.map((p) => (p.id === rfq.prId ? mergeAudit(p, { status: 'converted' }) : p)),
          rfqs: s.rfqs.map((r) => (r.id === rfqId ? mergeAudit(r, { status: 'closed' }) : r)),
        }))
        return { ok: true, poId: po.id }
      },

      createPoFromPr: (prId, vendorId, lineIds, paymentTerms) => {
        const perm = assertPermission('purchase', 'create')
        if (!perm.ok) return perm
        const pr = get().getPr(prId)
        if (!pr) return { ok: false, error: 'PR not found' }
        if (pr.status !== 'approved' && pr.status !== 'converted') {
          return { ok: false, error: 'PR must be approved before PO creation' }
        }
        const master = useMasterStore.getState()
        const vendor = master.vendors.find((v) => v.id === vendorId)
        if (!vendor?.isActive) return { ok: false, error: 'Vendor is inactive' }
        const convertedLineIds = new Set(
          get()
            .purchaseOrders.filter((po) => po.prId === prId)
            .flatMap((po) => po.lines.map((l) => l.prLineId))
            .filter(Boolean) as string[],
        )
        const selected = (lineIds ? pr.lines.filter((l) => lineIds.includes(l.id)) : pr.lines).filter(
          (l) => !convertedLineIds.has(l.id),
        )
        const vendorItems = master.getVendorMapsForItem
        const poLines = selected
          .filter((l) => vendorItems(l.itemId).some((v) => v.vendorId === vendorId))
          .map((l) => {
            const vm = vendorItems(l.itemId).find((v) => v.vendorId === vendorId)
            return {
              id: genId('pol'),
              itemId: l.itemId,
              warehouseId: l.warehouseId,
              qty: l.qty,
              rate: vm?.lastRate ?? master.getItem(l.itemId)!.standardRate,
              receivedQty: 0,
              mrpMaterialLineId: l.mrpMaterialLineId,
              prLineId: l.id,
              requiredDate: l.requiredDate,
            }
          })
        if (poLines.length === 0) return { ok: false, error: 'Vendor does not supply selected items' }
        const audit = stampCreated()
        const po: PurchaseOrder = {
          id: genId('po'),
          poNo: nextDocumentNo('PO-', get().purchaseOrders.map((p) => p.poNo)),
          revisionNo: 1,
          vendorId,
          prId,
          rfqId: null,
          mrpRunId: pr.mrpRunId,
          salesOrderId: pr.salesOrderId,
          status: 'draft',
          orderDate: new Date().toISOString().slice(0, 10),
          expectedDate: poLines[0].requiredDate,
          paymentTerms: paymentTerms ?? defaultPaymentTerms(),
          lines: poLines,
          revisions: [],
          sentAt: null,
          ...audit,
        }
        const allLineIds = new Set(pr.lines.map((l) => l.id))
        const coveredAfter = new Set([...convertedLineIds, ...poLines.map((l) => l.prLineId!)])
        const fullyConverted = [...allLineIds].every((id) => coveredAfter.has(id))
        set((s) => ({
          purchaseOrders: [po, ...s.purchaseOrders],
          requisitions: s.requisitions.map((p) =>
            p.id === prId
              ? mergeAudit(p, { status: fullyConverted ? ('converted' as const) : p.status })
              : p,
          ),
        }))
        return { ok: true, poId: po.id }
      },

      createManualPo: (input) => {
        const perm = assertPermission('purchase', 'create')
        if (!perm.ok) return perm
        if (input.lines.length === 0) return { ok: false, error: 'At least one line required' }

        const master = useMasterStore.getState()
        const vendor = master.vendors.find((v) => v.id === input.vendorId)
        if (!vendor) return { ok: false, error: 'Vendor not found' }
        if (!vendor.isActive) return { ok: false, error: 'Vendor is inactive' }

        const poLines: PurchaseOrder['lines'] = []
        for (const line of input.lines) {
          const item = master.getItem(line.itemId)
          if (!item) return { ok: false, error: 'Item not found in Item Master' }
          if (!item.isActive) return { ok: false, error: `Item ${item.itemCode} is inactive` }
          if (!item.isPurchasable) return { ok: false, error: `${item.itemCode} is not purchasable` }
          const wh = master.getWarehouse(line.warehouseId)
          if (!wh) return { ok: false, error: 'Warehouse not found' }
          if (!wh.isActive) return { ok: false, error: `Warehouse ${wh.warehouseCode} is inactive` }
          if (line.qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' }
          if (line.rate < 0) return { ok: false, error: 'Rate cannot be negative' }
          poLines.push({
            id: genId('pol'),
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            qty: line.qty,
            rate: line.rate,
            receivedQty: 0,
            mrpMaterialLineId: null,
            prLineId: null,
            requiredDate: line.requiredDate,
          })
        }

        const orderDate = input.orderDate ?? new Date().toISOString().slice(0, 10)
        const expectedDate = input.expectedDate ?? poLines[0]!.requiredDate
        const audit = stampCreated()
        const po: PurchaseOrder = {
          id: genId('po'),
          poNo: nextDocumentNo('PO-', get().purchaseOrders.map((p) => p.poNo)),
          revisionNo: 1,
          vendorId: input.vendorId,
          prId: null,
          rfqId: null,
          mrpRunId: null,
          salesOrderId: input.salesOrderId ?? null,
          status: 'draft',
          orderDate,
          expectedDate,
          paymentTerms: input.paymentTerms ?? (vendor.paymentTermsDays ? `Net ${vendor.paymentTermsDays}` : defaultPaymentTerms()),
          lines: poLines,
          revisions: [],
          sentAt: null,
          ...audit,
        }
        set((s) => ({ purchaseOrders: [po, ...s.purchaseOrders] }))
        return { ok: true, poId: po.id }
      },

      submitPo: (id) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        const tr = assertStatusTransition(PO_STATUS_FLOW, po.status, 'submitted')
        if (!tr.ok) return tr
        syncApprovalRequest({
          documentType: 'purchase_order',
          entityId: id,
          entityLabel: po.poNo,
          context: buildApprovalContext('purchase_order', po),
          submittedByName: getSessionUser().name,
        })
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'submitted' }) : p,
          ),
        }))
        return { ok: true }
      },

      approvePo: (id) => {
        const perm = assertPermission('purchase', 'approve')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        if (po.status !== 'submitted') return { ok: false, error: 'PO must be submitted before approval' }
        const vendor = useMasterStore.getState().vendors.find((v) => v.id === po.vendorId)
        if (!vendor?.isActive) return { ok: false, error: 'Cannot approve PO — vendor inactive' }

        const user = getSessionUser()
        const matrixCheck = assertMatrixApproval('purchase_order', id, user)
        if (!matrixCheck.ok) return matrixCheck

        const advance = advanceApprovalStep('purchase_order', id, user)
        if (!advance.ok) return advance
        if (!advance.completed) {
          return { ok: true, pendingNextApprover: advance.nextApprover }
        }

        const tr = assertStatusTransition(PO_STATUS_FLOW, po.status, 'approved')
        if (!tr.ok) return tr
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), ...stampApproved(), status: 'approved' }) : p,
          ),
        }))
        return { ok: true }
      },

      sendPo: (id) => {
        const perm = assertPermission('purchase', 'post')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        if (!['approved', 'released'].includes(po.status)) {
          return { ok: false, error: 'PO cannot be sent before approval/release' }
        }
        const tr = assertStatusTransition(PO_STATUS_FLOW, po.status, 'sent')
        if (!tr.ok) return tr
        const ts = new Date().toISOString()
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'sent', sentAt: ts }) : p,
          ),
        }))
        return { ok: true }
      },

      releasePo: (id) => {
        const perm = assertPermission('purchase', 'release')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        if (po.status !== 'approved') return { ok: false, error: 'Only approved POs can be released' }
        const tr = assertStatusTransition(PO_STATUS_FLOW, po.status, 'released')
        if (!tr.ok) return tr
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'released' }) : p,
          ),
        }))
        return { ok: true }
      },

      amendPo: (id, lines, reason) => {
        const perm = assertPermission('purchase', 'edit')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        if (!poIsAmendable(po)) {
          return { ok: false, error: 'PO cannot be amended — fully received, closed, or cancelled' }
        }
        const trimmedReason = reason.trim()
        if (!trimmedReason) return { ok: false, error: 'Amendment reason is required' }
        if (lines.length !== po.lines.length) {
          return { ok: false, error: 'Amendment cannot add or remove lines — adjust quantities and rates only' }
        }
        for (const line of lines) {
          const existing = po.lines.find((l) => l.id === line.id)
          if (!existing) return { ok: false, error: 'Invalid PO line in amendment' }
          if (line.itemId !== existing.itemId || line.warehouseId !== existing.warehouseId) {
            return { ok: false, error: 'Cannot change item or warehouse on an existing line' }
          }
          if (line.qty < existing.receivedQty) {
            return { ok: false, error: `Qty cannot be less than received (${existing.receivedQty})` }
          }
          if (line.qty <= 0) return { ok: false, error: 'Line quantity must be greater than zero' }
          if (line.rate < 0) return { ok: false, error: 'Rate cannot be negative' }
        }
        const audit = stampModified(po)
        const revision: PurchaseOrder['revisions'][0] = {
          revisionNo: po.revisionNo,
          amendedAt: audit.modifiedAt!,
          amendedByName: audit.modifiedByName!,
          reason: trimmedReason,
          previousLines: po.lines.map((l) => ({ ...l })),
        }
        const wasReleased = ['approved', 'sent', 'partial'].includes(po.status)
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id
              ? mergeAudit(p, {
                  ...audit,
                  revisionNo: p.revisionNo + 1,
                  lines: lines.map((l) => {
                    const existing = po.lines.find((x) => x.id === l.id)!
                    return { ...existing, qty: l.qty, rate: l.rate, requiredDate: l.requiredDate }
                  }),
                  revisions: [revision, ...p.revisions],
                  status: 'draft',
                  approvedById: null,
                  approvedByName: null,
                  approvedAt: null,
                  ...(wasReleased ? { sentAt: null } : {}),
                })
              : p,
          ),
        }))
        return { ok: true }
      },

      closePo: (id) => {
        const perm = assertPermission('purchase', 'close')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        const pending = po.lines.some((l) => l.receivedQty < l.qty)
        if (pending) return { ok: false, error: 'Cannot close PO — pending GRN quantity exists' }
        const tr = assertStatusTransition(PO_STATUS_FLOW, po.status, 'closed')
        if (!tr.ok) return tr
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'closed' }) : p,
          ),
        }))
        return { ok: true }
      },

      cancelPo: (id) => {
        const perm = assertPermission('purchase', 'cancel')
        if (!perm.ok) return perm
        const po = get().getPo(id)
        if (!po) return { ok: false, error: 'PO not found' }
        if (['partial', 'received', 'closed'].includes(po.status)) {
          return { ok: false, error: 'Cannot cancel PO with receipts' }
        }
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? mergeAudit(p, { ...stampModified(p), status: 'cancelled' }) : p,
          ),
        }))
        return { ok: true }
      },

      postGrn: (poId, receiptLines) => {
        const perm = assertPermission('purchase', 'post')
        if (!perm.ok) return perm
        const po = get().getPo(poId)
        if (!po) return { ok: false, error: 'PO not found' }
        if (!['sent', 'partial', 'released'].includes(po.status)) {
          return { ok: false, error: 'GRN only for sent/partial/released PO' }
        }
        const inv = useInventoryStore.getState()
        const ts = new Date().toISOString()
        const quarantineWh = getQuarantineWarehouseId()

        const grnLines: GrnLine[] = []
        let qcRequired = false
        let tolerancePct = usePurchaseMasterStore.getState().settings.defaultGrnTolerancePct

        for (const rl of receiptLines) {
          const poLine = po.lines.find((l) => l.id === rl.poLineId)
          if (!poLine) return { ok: false, error: 'Invalid PO line' }
          const lineTolerance = usePurchaseMasterStore.getState().getGrnTolerancePct(poLine.itemId)
          tolerancePct = lineTolerance
          const maxAllowed = poLine.qty * (1 + lineTolerance / 100)
          if (poLine.receivedQty + rl.receivedQty > maxAllowed) {
            return {
              ok: false,
              error: `Excess receipt — max ${maxAllowed} for line (tolerance ${lineTolerance}%)`,
            }
          }
          const needsQc = itemRequiresIncomingQc(poLine.itemId)
          if (needsQc) qcRequired = true
          const rejected = rl.rejectedQty ?? 0
          const accepted = needsQc ? 0 : rl.receivedQty - rejected
          const quarantine = needsQc ? rl.receivedQty - rejected : rejected
          grnLines.push({
            id: genId('grnl'),
            poLineId: rl.poLineId,
            itemId: poLine.itemId,
            warehouseId: poLine.warehouseId,
            receivedQty: rl.receivedQty,
            acceptedQty: accepted,
            rejectedQty: rejected,
            quarantineQty: quarantine,
            rate: poLine.rate,
          })
        }

        const audit = stampCreated()
        const grnId = genId('grn')
        const grnNo = nextDocumentNo('GRN-', get().grns.map((g) => g.grnNo))

        for (const gl of grnLines) {
          if (gl.quarantineQty > 0) {
            const r = inv.postGrnReceipt({
              itemId: gl.itemId,
              warehouseId: quarantineWh,
              qty: gl.quarantineQty,
              rate: gl.rate,
              referenceNo: grnNo,
              remarks: `GRN quarantine pending QC — ${po.poNo}`,
            })
            if (!r.ok) return { ok: false, error: r.error }
          }
          if (gl.acceptedQty > 0) {
            const r = inv.postGrnReceipt({
              itemId: gl.itemId,
              warehouseId: gl.warehouseId,
              qty: gl.acceptedQty,
              rate: gl.rate,
              referenceNo: grnNo,
              remarks: `GRN accepted — ${po.poNo}`,
            })
            if (!r.ok) return { ok: false, error: r.error }
          }
        }

        let incomingInspectionId: string | null = null
        if (qcRequired) {
          incomingInspectionId = getQualityStoreState().createIncomingInspection({
            grnId,
            grnNo,
            poId: po.id,
            vendorId: po.vendorId,
            lines: grnLines.map((l) => ({
              itemId: l.itemId,
              receivedQty: l.receivedQty,
              warehouseId: l.warehouseId,
            })),
          })
        }

        const grn: GrnHeader = {
          id: grnId,
          grnNo,
          poId,
          poNo: po.poNo,
          vendorId: po.vendorId,
          warehouseId: grnLines[0]?.warehouseId ?? '',
          grnDate: ts.slice(0, 10),
          status: qcRequired ? 'pending_qc' : 'posted',
          qcRequired,
          incomingInspectionId,
          lines: grnLines,
          postedAt: ts,
          excessTolerancePct: tolerancePct,
          ...audit,
        }

        const updatedLines = po.lines.map((l) => {
          const recv = receiptLines.find((r) => r.poLineId === l.id)
          return recv ? { ...l, receivedQty: l.receivedQty + recv.receivedQty } : l
        })
        const allReceived = updatedLines.every((l) => l.receivedQty >= l.qty)
        const newStatus = allReceived ? ('received' as const) : ('partial' as const)

        set((s) => ({
          grns: [grn, ...s.grns],
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === poId ? mergeAudit(p, { ...stampModified(p), lines: updatedLines, status: newStatus }) : p,
          ),
        }))
        return { ok: true, grnId: grn.id }
      },

      createVendorQuotationFromRfq: (rfqId, vendorId) => {
        const rfq = get().getRfq(rfqId)
        if (!rfq) return { ok: false, error: 'RFQ not found' }
        const existing = get().vendorQuotations.find((q) => q.rfqId === rfqId && q.vendorId === vendorId)
        if (existing) return { ok: true, quoteId: existing.id }
        const vendorQuotes = rfq.quotes.filter((q) => q.vendorId === vendorId)
        if (vendorQuotes.length === 0) return { ok: false, error: 'No quotes for vendor' }
        const master = useMasterStore.getState()
        const vendor = master.vendors.find((v) => v.id === vendorId)
        const audit = stampCreated()
        const lines = rfq.lines
          .filter((l) => vendorQuotes.some((q) => q.itemId === l.itemId))
          .map((l) => {
            const q = vendorQuotes.find((vq) => vq.itemId === l.itemId)!
            const item = master.getItem(l.itemId)
            const uom = master.uoms.find((u) => u.id === item?.baseUomId)?.uomCode ?? 'Nos'
            return {
              id: genId('vql'),
              rfqLineId: l.id,
              itemId: l.itemId,
              qty: l.qty,
              uom,
              quotedRate: q.quotedRate,
              discountPct: 0,
              gstPct: q.gstPct,
              freightAmount: q.freightAmount,
              deliveryDays: q.leadTimeDays,
              makeBrand: '',
              remarks: q.remarks,
            }
          })
        const totalValue = lines.reduce(
          (s, l) => s + l.qty * computeLandedCostPerUnit(l.quotedRate, l.qty, l.freightAmount, l.gstPct),
          0,
        )
        const quote: VendorQuotation = {
          id: genId('vq'),
          vendorQuoteNo: nextDocumentNo('VQ-', get().vendorQuotations.map((q) => q.vendorQuoteNo)),
          rfqId,
          vendorId,
          quoteDate: new Date().toISOString().slice(0, 10),
          validTill: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          contactPerson: vendor?.contactPerson ?? '',
          currency: 'INR',
          paymentTerms: vendorQuotes[0]?.paymentTerms ?? defaultPaymentTerms(),
          deliveryTerms: defaultDeliveryTerms(),
          freightTerms: 'To Pay',
          warranty: '12 months',
          status: 'submitted',
          totalValue,
          remarks: '',
          lines,
          ...audit,
        }
        set((s) => ({ vendorQuotations: [quote, ...s.vendorQuotations] }))
        return { ok: true, quoteId: quote.id }
      },

      createPurchaseReturnFromGrn: (grnId, lines) => {
        const perm = assertPermission('purchase', 'create')
        if (!perm.ok) return perm
        const grn = get().getGrn(grnId)
        if (!grn) return { ok: false, error: 'GRN not found' }
        const audit = stampCreated()
        const returnLines: PurchaseReturnLine[] = lines.map((l) => {
          const gl = grn.lines.find((x) => x.id === l.grnLineId)
          return {
            id: genId('prtl'),
            itemId: gl?.itemId ?? '',
            grnLineId: l.grnLineId,
            lotNo: '',
            receivedQty: gl?.receivedQty ?? 0,
            rejectedQty: gl?.rejectedQty ?? 0,
            returnQty: l.returnQty,
            reason: l.reason,
            remarks: '',
          }
        })
        const ret: PurchaseReturn = {
          id: genId('pret'),
          returnNo: nextDocumentNo('PRET-', get().purchaseReturns.map((r) => r.returnNo)),
          returnDate: new Date().toISOString().slice(0, 10),
          vendorId: grn.vendorId,
          grnId,
          poId: grn.poId,
          returnReason: lines[0]?.reason ?? 'qc_rejection',
          transportDetails: '',
          status: 'draft',
          lines: returnLines,
          ...audit,
        }
        set((s) => ({ purchaseReturns: [ret, ...s.purchaseReturns] }))
        return { ok: true, returnId: ret.id }
      },

      approvePurchaseReturn: (id) => {
        const perm = assertPermission('purchase', 'approve')
        if (!perm.ok) return perm
        const ret = get().getPurchaseReturn(id)
        if (!ret) return { ok: false, error: 'Return not found' }
        set((s) => ({
          purchaseReturns: s.purchaseReturns.map((r) =>
            r.id === id ? mergeAudit(r, { ...stampModified(r), ...stampApproved(), status: 'approved' }) : r,
          ),
        }))
        return { ok: true }
      },

      dispatchPurchaseReturn: (id) => {
        const perm = assertPermission('purchase', 'post')
        if (!perm.ok) return perm
        const ret = get().getPurchaseReturn(id)
        if (!ret || ret.status !== 'approved') return { ok: false, error: 'Return must be approved' }
        set((s) => ({
          purchaseReturns: s.purchaseReturns.map((r) =>
            r.id === id ? mergeAudit(r, { ...stampModified(r), status: 'dispatched' }) : r,
          ),
        }))
        return { ok: true }
      },

      getPendingPrReport: () =>
        get()
          .requisitions.filter((p) => ['draft', 'submitted', 'approved'].includes(p.status))
          .map((p) => ({
            prId: p.id,
            prNo: p.prNo,
            source: p.source,
            purpose: p.purpose ?? null,
            salesOrderNo: p.salesOrderNo,
            lineCount: p.lines.length,
            status: p.status,
            requiredDate: p.lines[0]?.requiredDate ?? '—',
            createdAt: p.createdAt,
          })),

      getOpenPoReport: () => {
        const master = useMasterStore.getState()
        const today = new Date().toISOString().slice(0, 10)
        return get()
          .purchaseOrders.filter((p) => ['sent', 'partial'].includes(p.status))
          .map((p) => {
            const openQty = p.lines.reduce((s, l) => s + Math.max(0, l.qty - l.receivedQty), 0)
            return {
              poId: p.id,
              poNo: p.poNo,
              vendorName: master.vendors.find((v) => v.id === p.vendorId)?.vendorName ?? '—',
              status: p.status,
              expectedDate: p.expectedDate,
              openQty,
              totalValue: p.lines.reduce((s, l) => s + l.qty * l.rate, 0),
              isDelayed: p.expectedDate < today,
            }
          })
      },

      getDelayedPoReport: () => get().getOpenPoReport().filter((r) => r.isDelayed),

      getVendorPerformanceReport: () => {
        const master = useMasterStore.getState()
        const byVendor = new Map<string, { poCount: number; grnCount: number; onTime: number; total: number }>()
        for (const po of get().purchaseOrders) {
          const v = byVendor.get(po.vendorId) ?? { poCount: 0, grnCount: 0, onTime: 0, total: 0 }
          v.poCount++
          byVendor.set(po.vendorId, v)
        }
        for (const grn of get().grns) {
          const po = get().getPo(grn.poId)
          if (!po) continue
          const v = byVendor.get(grn.vendorId) ?? { poCount: 0, grnCount: 0, onTime: 0, total: 0 }
          v.grnCount++
          v.total++
          if (po.expectedDate >= grn.grnDate) v.onTime++
          byVendor.set(grn.vendorId, v)
        }
        return [...byVendor.entries()].map(([vendorId, stats]) => ({
          vendorId,
          vendorName: master.vendors.find((v) => v.id === vendorId)?.vendorName ?? vendorId,
          poCount: stats.poCount,
          grnCount: stats.grnCount,
          onTimePct: stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 100,
          avgLeadDays: 7,
          rejectionPct: 2,
          priceVariancePct: 3,
          rfqResponseDays: 3,
          totalPoValue: get()
            .purchaseOrders.filter((p) => p.vendorId === vendorId)
            .reduce((s, p) => s + p.lines.reduce((ls, l) => ls + l.qty * l.rate, 0), 0),
          openPoValue: get()
            .purchaseOrders.filter((p) => p.vendorId === vendorId && ['sent', 'partial', 'released'].includes(p.status))
            .reduce((s, p) => s + p.lines.reduce((ls, l) => ls + (l.qty - l.receivedQty) * l.rate, 0), 0),
          rating: 4,
          lastPurchaseDate: get()
            .purchaseOrders.filter((p) => p.vendorId === vendorId)
            .sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0]?.orderDate,
        }))
      },

      getMaterialExpectedThisWeek: () => {
        const master = useMasterStore.getState()
        const now = new Date()
        const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
        const today = now.toISOString().slice(0, 10)
        const rows: { poNo: string; itemCode: string; qty: number; expectedDate: string }[] = []
        for (const po of get().purchaseOrders.filter((p) => ['sent', 'partial'].includes(p.status))) {
          if (po.expectedDate < today || po.expectedDate > weekEnd) continue
          for (const l of po.lines.filter((ln) => ln.receivedQty < ln.qty)) {
            rows.push({
              poNo: po.poNo,
              itemCode: master.getItem(l.itemId)?.itemCode ?? l.itemId,
              qty: l.qty - l.receivedQty,
              expectedDate: po.expectedDate,
            })
          }
        }
        return rows
      },
    }),
    {
      name: ERP_STORAGE_KEYS.purchase,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        requisitions: s.requisitions,
        rfqs: s.rfqs,
        purchaseOrders: s.purchaseOrders,
        grns: s.grns,
        vendorQuotations: s.vendorQuotations,
        purchaseReturns: s.purchaseReturns,
      }),
      merge: (persisted, current) => {
        const normalized = normalizePurchasePersisted(persisted as Partial<PurchasePersistSlice> | undefined)
        return { ...current, ...normalized }
      },
    },
  ),
)
