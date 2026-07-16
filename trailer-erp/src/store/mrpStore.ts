import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MrpDashboardSummary, MrpMaterialLine, MrpRun, MrpRunInput, MrpRunOptions, SalesOrder, SalesOrderLine, SalesOrderSource, SoReservationResult } from '../types/mrp'
import { seedSalesOrders } from '../data/mrp/seed'
import { isApiMode } from '../config/apiConfig'
import {
  aggregateMaterialShortages,
  buildMrpContext,
  isProductionReady,
  runMrpForSalesOrder,
} from '../utils/mrpEngine'
import { useMasterStore } from './masterStore'
import { useBomStore } from './bomStore'
import { useInventoryStore } from './inventoryStore'
import { usePurchaseStore } from './purchaseStore'
import { useFreezeStore } from './freezeStore'
import { erpStorage } from './persistConfig'
import { nextDocumentNo } from '../utils/documentNumbers'
import { getNextCode } from '../services/codeSeriesService'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function nextSalesOrderNo(existing: SalesOrder[]): string {
  const fromQuo = existing.filter((s) => s.salesOrderNo.startsWith('SO-')).map((s) => s.salesOrderNo)
  return nextDocumentNo('SO-', fromQuo)
}

function nextRunNo(_existing: string[]): string {
  return getNextCode('mrp_run')
}

interface MrpState {
  salesOrders: SalesOrder[]
  runs: MrpRun[]

  getSalesOrder: (id: string) => SalesOrder | undefined
  getRun: (id: string) => MrpRun | undefined
  getLatestRun: () => MrpRun | undefined
  getDashboardSummary: () => MrpDashboardSummary

  addSalesOrderFromQuotation: (input: {
    customerId: string
    productId: string
    qty: number
    requiredDate: string
    remarks: string
    quotationId: string
    quotationNo: string
    quotationRevisionNo: number
    quotationDocumentId?: string | null
    quotationDocumentRevisionNo?: number | null
    inquiryId: string
    opportunityId?: string | null
    contactId?: string | null
    unitPrice: number
    discountPct?: number | null
    grandTotal: number
    paymentTerms?: string | null
    deliveryTerms?: string | null
    warrantyTerms?: string | null
    commercialNotes?: string | null
    technicalNotes?: string | null
    customerCode?: string | null
    customerPoNumber?: string | null
    customerPoDate?: string | null
    expectedDeliveryDate?: string | null
    deliveryLocation?: string | null
    locationId?: string | null
    billingAddress?: string | null
    shippingAddress?: string | null
    salesOwnerId?: string | null
    salesOwnerName?: string | null
    basicAmount?: number | null
    gstAmount?: number | null
    internalRemarks?: string | null
    lines?: SalesOrderLine[]
    source?: SalesOrderSource
    directSoReason?: string | null
  }) => { ok: boolean; error?: string; salesOrderId?: string; salesOrderNo?: string }
  updateSalesOrderDraft: (
    salesOrderId: string,
    patch: Partial<Pick<SalesOrder,
      | 'customerPoNumber' | 'customerPoDate' | 'expectedDeliveryDate' | 'deliveryLocation'
      | 'locationId'
      | 'internalRemarks' | 'paymentTerms' | 'deliveryTerms' | 'warrantyTerms'
      | 'commercialNotes' | 'technicalNotes' | 'remarks' | 'requiredDate' | 'qty' | 'grandTotal'
    >>,
  ) => { ok: boolean; error?: string }
  deleteSalesOrderDraft: (salesOrderId: string) => { ok: boolean; error?: string }
  confirmSalesOrder: (salesOrderId: string) => { ok: boolean; error?: string }

  computeOrderDemand: (input: MrpRunInput) => { ok: boolean; materials: MrpMaterialLine[]; error?: string }
  reserveAvailableForOrder: (
    salesOrderId: string,
    overrides?: Partial<Pick<MrpRunInput, 'qty' | 'requiredDate'>>,
  ) => SoReservationResult
  runMrp: (inputs: MrpRunInput[], options?: MrpRunOptions) => { ok: boolean; error?: string; runId?: string; reservation?: SoReservationResult }
  runMrpForOrder: (
    salesOrderId: string,
    overrides?: Partial<Pick<MrpRunInput, 'qty' | 'requiredDate'>>,
    options?: MrpRunOptions,
  ) => { ok: boolean; error?: string; runId?: string; reservation?: SoReservationResult }
}

function getStores() {
  const master = useMasterStore.getState()
  const bom = useBomStore.getState()
  const inv = useInventoryStore.getState()
  return { master, bom, inv }
}

function computeDemandForInput(
  input: MrpRunInput,
  getSalesOrder: (id: string) => SalesOrder | undefined,
): { ok: boolean; materials: MrpMaterialLine[]; error?: string } {
  const { master, bom, inv } = getStores()
  const so = getSalesOrder(input.salesOrderId)
  if (!so) return { ok: false, materials: [], error: 'Sales order not found' }

  const product = master.getProduct(input.productId)
  if (!product) return { ok: false, materials: [], error: 'Product not found' }

  const fgItem = master.getItem(product.fgItemId)
  if (!fgItem) return { ok: false, materials: [], error: `FG Item missing for ${product.productName}` }

  const ctx = buildMrpContext(
    input,
    so,
    product,
    fgItem,
    bom.bomHeaders,
    bom.bomLines,
    master.items,
    master.warehouses,
    inv.stockMovements,
    inv.reservations,
    master.itemVendorMaps,
    master.vendors,
    (id) => master.uoms.find((u) => u.id === id)?.uomCode ?? '—',
    (id) => master.warehouses.find((w) => w.id === id)?.warehouseCode ?? '—',
  )

  const result = runMrpForSalesOrder(ctx)
  return { ok: true, materials: result.materials }
}

export const useMrpStore = create<MrpState>()(
  persist(
    (set, get) => ({
  salesOrders: isApiMode() ? [] : seedSalesOrders.map((s) => ({ ...s })),
  runs: [],

  getSalesOrder: (id) => get().salesOrders.find((s) => s.id === id),
  getRun: (id) => get().runs.find((r) => r.id === id),
  getLatestRun: () => get().runs[0],

  getDashboardSummary: () => {
    const latest = get().getLatestRun()
    if (!latest) {
      return {
        materialShortages: 0,
        delayedMaterials: 0,
        purchaseRequired: 0,
        productionReadyOrders: 0,
        lastRunAt: null,
      }
    }
    const shortages = aggregateMaterialShortages(latest.materialLines)
    const orderIds = [...new Set(latest.materialLines.map((m) => m.salesOrderId))]
    return {
      materialShortages: shortages.length,
      delayedMaterials: latest.materialLines.filter((m) => m.riskStatus === 'delayed').length,
      purchaseRequired: latest.materialLines.filter((m) => m.suggestedPoQty > 0).length,
      productionReadyOrders: orderIds.filter((id) => isProductionReady(id, latest.materialLines)).length,
      lastRunAt: latest.runAt,
    }
  },

  addSalesOrderFromQuotation: (input) => {
    const salesOrderNo = nextSalesOrderNo(get().salesOrders)
    const today = new Date().toISOString().slice(0, 10)
    const so: SalesOrder = {
      id: genId('so'),
      salesOrderNo,
      customerId: input.customerId,
      productId: input.productId,
      qty: input.qty,
      requiredDate: input.expectedDeliveryDate ?? input.requiredDate,
      status: 'open',
      remarks: input.remarks,
      createdAt: new Date().toISOString(),
      quotationId: input.quotationId || null,
      quotationNo: input.quotationNo || null,
      quotationRevisionNo: input.quotationRevisionNo ?? null,
      quotationDocumentId: input.quotationDocumentId ?? null,
      quotationDocumentRevisionNo: input.quotationDocumentRevisionNo ?? null,
      inquiryId: input.inquiryId || null,
      opportunityId: input.opportunityId ?? null,
      contactId: input.contactId ?? null,
      unitPrice: input.unitPrice,
      discountPct: input.discountPct ?? null,
      grandTotal: input.grandTotal,
      paymentTerms: input.paymentTerms ?? null,
      deliveryTerms: input.deliveryTerms ?? null,
      warrantyTerms: input.warrantyTerms ?? null,
      commercialNotes: input.commercialNotes ?? null,
      technicalNotes: input.technicalNotes ?? null,
      orderDate: today,
      source: input.source ?? (input.quotationId ? 'quotation' : 'direct'),
      customerCode: input.customerCode ?? null,
      customerPoNumber: input.customerPoNumber ?? null,
      customerPoDate: input.customerPoDate ?? null,
      expectedDeliveryDate: input.expectedDeliveryDate ?? input.requiredDate,
      deliveryLocation: input.deliveryLocation ?? null,
      locationId: input.locationId ?? null,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      salesOwnerId: input.salesOwnerId ?? null,
      salesOwnerName: input.salesOwnerName ?? null,
      basicAmount: input.basicAmount ?? null,
      gstAmount: input.gstAmount ?? null,
      internalRemarks: input.internalRemarks ?? null,
      directSoReason: input.directSoReason ?? null,
      lines: input.lines ?? [],
    }
    set((s) => ({ salesOrders: [so, ...s.salesOrders] }))
    return { ok: true, salesOrderId: so.id, salesOrderNo: so.salesOrderNo }
  },

  updateSalesOrderDraft: (salesOrderId, patch) => {
    const so = get().getSalesOrder(salesOrderId)
    if (!so) return { ok: false, error: 'Sales order not found' }
    if (so.status !== 'open') {
      return { ok: false, error: 'Only draft sales orders can be edited' }
    }
    set((s) => ({
      salesOrders: s.salesOrders.map((o) => (o.id === salesOrderId ? { ...o, ...patch } : o)),
    }))
    return { ok: true }
  },

  deleteSalesOrderDraft: (salesOrderId) => {
    const so = get().getSalesOrder(salesOrderId)
    if (!so) return { ok: false, error: 'Sales order not found' }
    if (so.status !== 'open') {
      return { ok: false, error: 'Only draft sales orders can be deleted' }
    }
    set((s) => ({ salesOrders: s.salesOrders.filter((o) => o.id !== salesOrderId) }))
    return { ok: true }
  },

  confirmSalesOrder: (salesOrderId) => {
    const so = get().getSalesOrder(salesOrderId)
    if (!so) return { ok: false, error: 'Sales order not found' }
    const quotationBacked = Boolean(so.quotationId)
    const directOrder = so.source === 'direct' || Boolean(so.directSoReason?.trim())
    if (!quotationBacked && !directOrder) {
      return { ok: false, error: 'Sales order must be linked to a quotation or created as a direct SO' }
    }
    if (directOrder && !quotationBacked && !so.directSoReason?.trim()) {
      return { ok: false, error: 'Direct sales orders require a justification before confirmation' }
    }
    if (so.status !== 'open') {
      return { ok: false, error: `Cannot confirm sales order in status ${so.status}` }
    }
    set((s) => ({
      salesOrders: s.salesOrders.map((o) => (o.id === salesOrderId ? { ...o, status: 'confirmed' } : o)),
    }))
    try {
      useFreezeStore.getState().createFreezeForSo(salesOrderId)
    } catch {
      /* freeze deferred until BOM/routing released */
    }
    return { ok: true }
  },

  runMrp: (inputs, options) => {
    if (inputs.length === 0) return { ok: false, error: 'Select at least one demand line' }

    let reservation: SoReservationResult | undefined
    if (options?.autoReserve) {
      let totalLines = 0
      let totalQty = 0
      let partial = 0
      for (const input of inputs) {
        const so = get().getSalesOrder(input.salesOrderId)
        if (!so) continue
        const demand = computeDemandForInput(input, get().getSalesOrder)
        if (!demand.ok) continue
        const r = useInventoryStore.getState().reserveForSalesOrder(
          so.salesOrderNo,
          demand.materials.map((m) => ({
            itemId: m.itemId,
            warehouseId: m.warehouseId,
            requiredQty: m.requiredQty,
          })),
        )
        totalLines += r.reservedLines
        totalQty += r.reservedQty
        partial += r.partialLines
      }
      reservation = {
        ok: totalLines > 0,
        reservedLines: totalLines,
        reservedQty: totalQty,
        partialLines: partial,
      }
    }

    const { master, bom, inv } = getStores()
    const allMaterials: MrpRun['materialLines'] = []
    const allWo: MrpRun['woRequirements'] = []
    const allExceptions: MrpRun['exceptions'] = []
    const allPegging: MrpRun['pegging'] = []
    const orderIds: string[] = []

    for (const input of inputs) {
      const so = get().getSalesOrder(input.salesOrderId)
      if (!so) return { ok: false, error: `Sales order not found: ${input.salesOrderId}` }

      const product = master.getProduct(input.productId)
      if (!product) return { ok: false, error: `Product not found: ${input.productId}` }

      const fgItem = master.getItem(product.fgItemId)
      if (!fgItem) return { ok: false, error: `FG Item missing for product ${product.productName}` }

      const ctx = buildMrpContext(
        input,
        so,
        product,
        fgItem,
        bom.bomHeaders,
        bom.bomLines,
        master.items,
        master.warehouses,
        inv.stockMovements,
        inv.reservations,
        master.itemVendorMaps,
        master.vendors,
        (id) => master.uoms.find((u) => u.id === id)?.uomCode ?? '—',
        (id) => master.warehouses.find((w) => w.id === id)?.warehouseCode ?? '—',
      )

      const result = runMrpForSalesOrder(ctx)
      allMaterials.push(...result.materials)
      allWo.push(...result.woRequirements)
      allExceptions.push(...result.exceptions)
      allPegging.push(...result.pegging)
      orderIds.push(so.id)
    }

    const run: MrpRun = {
      id: genId('mrp-run'),
      runNo: nextRunNo(get().runs.map((r) => r.runNo)),
      runAt: new Date().toISOString(),
      runBy: 'MRP Planner',
      salesOrderIds: orderIds,
      materialLines: allMaterials,
      woRequirements: allWo,
      exceptions: allExceptions,
      pegging: allPegging,
    }

    set((s) => ({ runs: [run, ...s.runs] }))

    const purchase = usePurchaseStore.getState()
    for (const soId of orderIds) {
      purchase.createPrFromMrpRun(run, soId)
    }

    return { ok: true, runId: run.id, reservation }
  },

  computeOrderDemand: (input) => computeDemandForInput(input, get().getSalesOrder),

  reserveAvailableForOrder: (salesOrderId, overrides) => {
    const so = get().getSalesOrder(salesOrderId)
    if (!so) return { ok: false, reservedLines: 0, reservedQty: 0, partialLines: 0, error: 'Sales order not found' }

    const input: MrpRunInput = {
      salesOrderId,
      productId: so.productId,
      qty: overrides?.qty ?? so.qty,
      requiredDate: overrides?.requiredDate ?? so.requiredDate,
    }
    const demand = computeDemandForInput(input, get().getSalesOrder)
    if (!demand.ok) {
      return { ok: false, reservedLines: 0, reservedQty: 0, partialLines: 0, error: demand.error }
    }

    return useInventoryStore.getState().reserveForSalesOrder(
      so.salesOrderNo,
      demand.materials.map((m) => ({
        itemId: m.itemId,
        warehouseId: m.warehouseId,
        requiredQty: m.requiredQty,
      })),
    )
  },

  runMrpForOrder: (salesOrderId, overrides, options) => {
    const so = get().getSalesOrder(salesOrderId)
    if (!so) return { ok: false, error: 'Sales order not found' }
    if (so.status !== 'confirmed' && so.status !== 'in_production') {
      return { ok: false, error: 'MRP requires a confirmed sales order — confirm the order first' }
    }
    return get().runMrp(
      [
        {
          salesOrderId,
          productId: so.productId,
          qty: overrides?.qty ?? so.qty,
          requiredDate: overrides?.requiredDate ?? so.requiredDate,
        },
      ],
      options,
    )
  },
    }),
    {
      name: 'vasant-erp-mrp-v1',
      storage: erpStorage,
      merge: (persisted, current) => {
        const p = persisted as Partial<MrpState> | undefined
        if (isApiMode()) {
          return {
            ...current,
            salesOrders: [],
            runs: [],
          }
        }
        return {
          ...current,
          ...p,
          salesOrders: Array.isArray(p?.salesOrders) ? p.salesOrders : current.salesOrders,
          runs: Array.isArray(p?.runs) ? p.runs : current.runs,
        }
      },
      partialize: (s) => ({
        salesOrders: isApiMode() ? [] : s.salesOrders,
        runs: isApiMode() ? [] : s.runs,
      }),
    },
  ),
)
