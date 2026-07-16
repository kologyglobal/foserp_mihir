import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  FgReceipt,
  JobCard,
  SaReceipt,
  SubcontractShipment,
  WorkOrder,
  WorkOrderActivity,
  WorkOrderConfig,
  WorkOrderMaterialLine,
  WorkOrderProductionOperation,
  WorkOrderStatus,
} from '../types/workorder'
import {
  computeMaterialLineStatus,
  DEFAULT_WO_CONFIG,
  isWoEditable,
} from '../types/workorder'
import { buildWoDraftsFromMrp, toMaterialLine } from '../utils/workOrderEngine'
import { buildBomTree } from '../utils/bom'
import { useMasterStore } from './masterStore'
import { useBomStore } from './bomStore'
import { useInventoryStore } from './inventoryStore'
import type { MrpRun } from '../types/mrp'
import { useMrpStore } from './mrpStore'
import { useRoutingStore } from './routingStore'
import { assertSoFrozenForProduction, useFreezeStore } from './freezeStore'
import { useWorkCenterStore } from './workCenterStore'
import { buildProductionOperationsFromRouting } from '../utils/routing'
import { buildJobCardsFromOperations } from '../utils/jobCard'
import { allQcChecksPassed, type JobCardQcCheck } from '../types/qc'
import { canStartOperation } from '../utils/qualityEngine'
import {
  assertFgSubAssemblyStockAvailable,
  assertSaSubAssembliesReceivedForFg,
  resolveSaReceiptWarehouseCode,
} from '../utils/saReceipt'
import {
  moveFromWipOnOperationComplete,
  moveToWipOnOperationStart,
  receiveMaterialIssueToWip,
  resolveFgReceiptWipWarehouseId,
  resolveSubcontractReceiveWipWarehouseId,
  validateJobCardWarehouseMapping,
} from '../utils/woWipActions'
import { erpStorage } from './persistConfig'
import { useQualityStore, assertWoCanComplete, assertWoCanReceiveFg } from './qualityStore'

import { getNextCode } from '../services/codeSeriesService'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function nextWoNo(_existing: string[]): string {
  return getNextCode('work_order')
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function syncLineBalance(line: WorkOrderMaterialLine): WorkOrderMaterialLine {
  const balanceQty = Math.max(0, line.requiredQty - line.issuedQty)
  const updated = { ...line, balanceQty, status: computeMaterialLineStatus(line) }
  return updated
}

function logActivity(woId: string, action: string, details: string): WorkOrderActivity {
  return {
    id: genId('woa'),
    workOrderId: woId,
    action,
    details,
    createdAt: new Date().toISOString(),
    createdBy: 'Production Planner',
  }
}

function deriveIssueStatus(lines: WorkOrderMaterialLine[]): WorkOrderStatus | null {
  if (lines.length === 0) return null
  const anyIssued = lines.some((l) => l.issuedQty > 0)
  const allIssued = lines.every((l) => l.issuedQty >= l.requiredQty)
  if (allIssued) return 'fully_issued'
  if (anyIssued) return 'partially_issued'
  return null
}

function deriveReserveStatus(lines: WorkOrderMaterialLine[]): WorkOrderStatus | null {
  if (lines.length === 0) return null
  const anyReserved = lines.some((l) => l.reservedQty > 0)
  if (anyReserved) return 'material_reserved'
  return null
}

interface WorkOrderState {
  config: WorkOrderConfig
  workOrders: WorkOrder[]
  materialLines: WorkOrderMaterialLine[]
  subcontractShipments: SubcontractShipment[]
  fgReceipts: FgReceipt[]
  saReceipts: SaReceipt[]
  activities: WorkOrderActivity[]
  productionOperations: WorkOrderProductionOperation[]
  jobCards: JobCard[]

  getWorkOrder: (id: string) => WorkOrder | undefined
  getWoMaterials: (woId: string) => WorkOrderMaterialLine[]
  getProductionOperations: (woId: string) => WorkOrderProductionOperation[]
  getJobCards: (woId: string) => JobCard[]
  getJobCardByOperation: (productionOperationId: string) => JobCard | undefined
  getWosBySalesOrder: (salesOrderId: string) => WorkOrder[]
  getActivities: (woId: string) => WorkOrderActivity[]
  getSubcontractShipments: (woId: string) => SubcontractShipment[]
  getFgReceipts: (woId: string) => FgReceipt[]
  getSaReceipts: (woId: string) => SaReceipt[]
  getChildWorkOrders: (parentWoId: string) => WorkOrder[]

  appendActivity: (woId: string, action: string, details: string) => void

  setConfig: (config: Partial<WorkOrderConfig>) => void

  createFromSalesOrder: (salesOrderId: string, mrpRun?: MrpRun) => { ok: boolean; error?: string; woIds?: string[] }
  createFromMrpRun: (mrpRunId: string, salesOrderId: string) => { ok: boolean; error?: string; woIds?: string[] }

  planWorkOrder: (woId: string) => { ok: boolean; error?: string }
  releaseWorkOrder: (woId: string) => { ok: boolean; error?: string }
  reserveMaterials: (woId: string) => { ok: boolean; error?: string; reserved?: number }
  issueMaterialLine: (woId: string, lineId: string, qty: number) => { ok: boolean; error?: string }
  issueAllReserved: (woId: string) => { ok: boolean; error?: string; issued?: number }
  startProduction: (woId: string) => { ok: boolean; error?: string }
  startJobCard: (jobCardId: string, input: { assignedTeam: string; startTime: string }) => { ok: boolean; error?: string }
  pauseJobCard: (jobCardId: string) => { ok: boolean; error?: string }
  completeJobCard: (jobCardId: string, input: { endTime: string; actualHours: number; remarks: string; qcChecks?: JobCardQcCheck[] }) => { ok: boolean; error?: string }
  completeWorkOrder: (woId: string) => { ok: boolean; error?: string }
  postFgReceipt: (woId: string, qty?: number) => { ok: boolean; error?: string; receiptId?: string }
  postSaReceipt: (woId: string, qty?: number) => { ok: boolean; error?: string; receiptId?: string }
  closeWorkOrder: (woId: string) => { ok: boolean; error?: string }

  sendSubcontractMaterial: (woId: string, lineId: string, vendorId: string, challanNo: string, qty: number, expectedReturnDate: string) => { ok: boolean; error?: string }
  receiveSubcontractMaterial: (shipmentId: string, receivedQty: number, rejectedQty: number) => { ok: boolean; error?: string }
}

export const useWorkOrderStore = create<WorkOrderState>()(
  persist(
    (set, get) => ({
  config: { ...DEFAULT_WO_CONFIG },
  workOrders: [],
  materialLines: [],
  subcontractShipments: [],
  fgReceipts: [],
  saReceipts: [],
  activities: [],
  productionOperations: [],
  jobCards: [],

  getWorkOrder: (id) => get().workOrders.find((w) => w.id === id),
  getWoMaterials: (woId) => get().materialLines.filter((m) => m.workOrderId === woId),
  getProductionOperations: (woId) =>
    get().productionOperations
      .filter((o) => o.workOrderId === woId)
      .sort((a, b) => a.sequenceNo - b.sequenceNo),
  getJobCards: (woId) =>
    get().jobCards
      .filter((j) => j.workOrderId === woId)
      .sort((a, b) => a.sequenceNo - b.sequenceNo),
  getJobCardByOperation: (productionOperationId) =>
    get().jobCards.find((j) => j.productionOperationId === productionOperationId),
  getWosBySalesOrder: (soId) => get().workOrders.filter((w) => w.salesOrderId === soId),
  getActivities: (woId) => get().activities.filter((a) => a.workOrderId === woId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getSubcontractShipments: (woId) => get().subcontractShipments.filter((s) => s.workOrderId === woId),
  getFgReceipts: (woId) => get().fgReceipts.filter((r) => r.workOrderId === woId),
  getSaReceipts: (woId) =>
    get().saReceipts.filter((r) => r.sourceWoId === woId || r.parentWoId === woId),
  getChildWorkOrders: (parentWoId) => get().workOrders.filter((w) => w.parentWoId === parentWoId),

  appendActivity: (woId, action, details) => {
    const act = logActivity(woId, action, details)
    set((s) => ({ activities: [act, ...s.activities] }))
  },

  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),

  createFromMrpRun: (mrpRunId, salesOrderId) => {
    const mrpRun = useMrpStore.getState().getRun(mrpRunId)
    if (!mrpRun) return { ok: false, error: 'MRP run not found' }
    return get().createFromSalesOrder(salesOrderId, mrpRun)
  },

  createFromSalesOrder: (salesOrderId, mrpRun) => {
    const so = useMrpStore.getState().getSalesOrder(salesOrderId)
    if (!so) return { ok: false, error: 'Sales order not found' }
    if (!mrpRun) return { ok: false, error: 'MRP run required — run MRP before creating work orders' }

    let freezeCheck = assertSoFrozenForProduction(salesOrderId)
    if (!freezeCheck.ok) {
      const created = useFreezeStore.getState().createFreezeForSo(salesOrderId)
      if (!created.ok) return created
    }

    const master = useMasterStore.getState()
    const bomStore = useBomStore.getState()
    const product = master.getProduct(so.productId)
    if (!product) return { ok: false, error: 'Product not found' }
    const fgItem = master.getItem(product.fgItemId)
    if (!fgItem) return { ok: false, error: 'FG item not found' }
    const releasedBom = bomStore.getReleasedBomForProduct(so.productId)
    if (!releasedBom) return { ok: false, error: 'No Released BOM — cannot create Work Orders' }

    const releasedRouting = useRoutingStore.getState().getReleasedRoutingForProduct(so.productId)
    if (!releasedRouting) {
      return { ok: false, error: 'No Released Routing — define and release product routing before creating Work Orders' }
    }

    const driftCheck = useFreezeStore.getState().assertRevisionMatchesFreeze(salesOrderId, releasedBom.id, releasedRouting.id)
    if (!driftCheck.ok) return driftCheck

    if (!bomStore.getBom(releasedBom.id)) {
      return { ok: false, error: `BOM ${releasedBom.bomNo} missing from store — refresh or run master migration` }
    }
    if (!useRoutingStore.getState().getRouting(releasedRouting.id)) {
      return { ok: false, error: `Routing ${releasedRouting.routingNo} missing from store — refresh or run master migration` }
    }

    const bomLines = bomStore.getLines(releasedBom.id)
    const tree = buildBomTree(
      releasedBom,
      bomLines,
      master.items,
      (id) => master.uoms.find((u) => u.id === id)?.uomCode ?? '—',
      (id) => master.warehouses.find((w) => w.id === id)?.warehouseCode ?? '—',
    )

    const drafts = buildWoDraftsFromMrp(
      mrpRun,
      salesOrderId,
      fgItem.id,
      fgItem.itemCode,
      so.qty,
      tree,
      get().config,
    )

    if (drafts.length === 0) return { ok: false, error: 'No work orders generated from MRP configuration' }

    const ts = new Date().toISOString()
    const plannedStart = addDays(so.requiredDate, 45)
    const woIds: string[] = []
    const newWos: WorkOrder[] = []
    const newLines: WorkOrderMaterialLine[] = []
    const newActivities: WorkOrderActivity[] = []

    const resolveWarehouseId = (codeOrId: string) =>
      master.warehouses.find((w) => w.id === codeOrId)?.id ??
      master.warehouses.find((w) => w.warehouseCode === codeOrId)?.id ??
      codeOrId

    for (const draft of drafts) {
      const woId = genId('wo')
      const woNo = nextWoNo([...get().workOrders.map((w) => w.woNo), ...newWos.map((w) => w.woNo)])
      const wo: WorkOrder = {
        id: woId,
        woNo,
        woType: draft.woType,
        salesOrderId: so.id,
        salesOrderNo: so.salesOrderNo,
        productId: so.productId,
        fgItemId: product.fgItemId,
        outputItemId: draft.outputItemId,
        outputItemCode: draft.outputItemCode,
        qty: draft.qty,
        plannedStartDate: plannedStart,
        plannedFinishDate: so.requiredDate,
        status: 'draft',
        bomHeaderId: releasedBom.id,
        bomRevision: releasedBom.revision,
        routingHeaderId: releasedRouting.id,
        routingRevision: releasedRouting.revision,
        mrpRunId: mrpRun.id,
        parentWoId: null,
        vendorId: draft.vendorId,
        releasedAt: null,
        completedAt: null,
        fgReceivedAt: null,
        closedAt: null,
        remarks: draft.remarks,
        createdAt: ts,
        updatedAt: ts,
      }
      newWos.push(wo)
      woIds.push(woId)
      newActivities.push(logActivity(woId, 'Created', `${draft.woType} WO from ${so.salesOrderNo} / MRP ${mrpRun.runNo}`))
    }

    const fgWo = newWos.find((w) => w.woType === 'finished_goods')
    if (fgWo && get().config.creationMode === 'per_sub_assembly') {
      for (const wo of newWos) {
        if (wo.id !== fgWo.id) wo.parentWoId = fgWo.id
      }
    }

    for (let i = 0; i < drafts.length; i += 1) {
      const draft = drafts[i]
      const wo = newWos[i]
      for (const mat of draft.materials) {
        const childWo = newWos.find((w) => w.outputItemId === mat.itemId && w.id !== wo.id)
        newLines.push(
          toMaterialLine(genId('wom'), wo.id, mat, master.items, {
            sourceWoId: wo.woType === 'finished_goods' ? childWo?.id ?? null : null,
            resolveWarehouseId,
          }),
        )
      }
    }

    set((s) => ({
      workOrders: [...newWos, ...s.workOrders],
      materialLines: [...newLines, ...s.materialLines],
      activities: [...newActivities, ...s.activities],
    }))
    return { ok: true, woIds }
  },

  planWorkOrder: (woId) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.status !== 'draft') return { ok: false, error: 'Only draft WO can be planned' }
    const ts = new Date().toISOString()
    const act = logActivity(woId, 'Planned', 'Work order moved to planned status')
    set((s) => ({
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, status: 'planned' as const, updatedAt: ts } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  releaseWorkOrder: (woId) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.status !== 'planned' && wo.status !== 'draft') return { ok: false, error: 'WO must be draft or planned to release' }
    const bom = useBomStore.getState().getBom(wo.bomHeaderId)
    if (!bom || bom.status !== 'released') return { ok: false, error: 'Cannot release — BOM must be Released' }
    const ts = new Date().toISOString()
    const act = logActivity(woId, 'Released', `BOM ${wo.bomRevision} confirmed for production`)
    set((s) => ({
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, status: 'released' as const, releasedAt: ts, updatedAt: ts } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  reserveMaterials: (woId) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.status !== 'released') return { ok: false, error: 'WO must be released before reservation' }
    const inv = useInventoryStore.getState()
    const lines = get().getWoMaterials(woId)
    let reserved = 0
    const updatedLines = [...get().materialLines]

    for (const line of lines) {
      const toReserve = line.requiredQty - line.reservedQty
      if (toReserve <= 0) continue
      const free = inv.getFreeQty(line.itemId, line.warehouseId)
      const qty = Math.min(toReserve, free)
      if (qty <= 0) continue
      const result = inv.createReservation({
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty,
        demandType: 'WO',
        demandId: wo.woNo,
        remarks: `WO material reservation — ${wo.outputItemCode}`,
      })
      if (result.ok) {
        reserved += qty
        const idx = updatedLines.findIndex((m) => m.id === line.id)
        if (idx >= 0) {
          updatedLines[idx] = syncLineBalance({ ...updatedLines[idx], reservedQty: updatedLines[idx].reservedQty + qty })
        }
      }
    }

    const woLines = updatedLines.filter((m) => m.workOrderId === woId)
    const newStatus = deriveReserveStatus(woLines) ?? wo.status
    const act = logActivity(woId, 'Material Reserved', `${reserved} units reserved across ${woLines.filter((l) => l.reservedQty > 0).length} lines`)
    set((s) => ({
      materialLines: updatedLines,
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, status: newStatus, updatedAt: new Date().toISOString() } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true, reserved }
  },

  issueMaterialLine: (woId, lineId, qty) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.status === 'closed' || wo.status === 'cancelled') {
      return { ok: false, error: 'Cannot issue on closed/cancelled WO' }
    }
    const allowedIssueStatuses: WorkOrderStatus[] = ['released', 'material_reserved', 'partially_issued', 'fully_issued', 'in_production']
    if (!allowedIssueStatuses.includes(wo.status)) {
      return { ok: false, error: 'WO must be released before material issue' }
    }

    const line = get().materialLines.find((m) => m.id === lineId && m.workOrderId === woId)
    if (!line) return { ok: false, error: 'Material line not found' }

    const pending = line.reservedQty - line.issuedQty
    if (qty <= 0 || qty > pending) {
      return { ok: false, error: `Issue qty must be 1–${pending} (reserved minus already issued)` }
    }

    const inv = useInventoryStore.getState()
    const result = inv.postIssueToWorkOrder({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qty,
      referenceNo: wo.woNo,
      remarks: `Issue to WO ${wo.woNo} — ${line.itemCode}`,
      workOrderId: wo.id,
      maxFromReserved: pending,
    })
    if (!result.ok) return result

    receiveMaterialIssueToWip(wo, line, qty)

    const updatedLines = get().materialLines.map((m) => {
      if (m.id !== lineId) return m
      return syncLineBalance({ ...m, issuedQty: m.issuedQty + qty })
    })

    const woLines = updatedLines.filter((m) => m.workOrderId === woId)
    const issueStatus = deriveIssueStatus(woLines)
    const act = logActivity(woId, 'Material Issued', `${qty} × ${line.itemCode} from ${line.warehouseId}`)
    set((s) => ({
      materialLines: updatedLines,
      workOrders: s.workOrders.map((w) =>
        w.id === woId ? { ...w, status: issueStatus ?? w.status, updatedAt: new Date().toISOString() } : w,
      ),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  issueAllReserved: (woId) => {
    const lines = get().getWoMaterials(woId)
    let issued = 0
    for (const line of lines) {
      const pending = line.reservedQty - line.issuedQty
      if (pending <= 0) continue
      const r = get().issueMaterialLine(woId, line.id, pending)
      if (r.ok) issued += pending
    }
    return { ok: issued > 0, issued, error: issued === 0 ? 'Nothing to issue' : undefined }
  },

  startProduction: (woId) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    const lines = get().getWoMaterials(woId)
    const allowedStart: WorkOrderStatus[] = ['fully_issued', 'material_reserved', 'released']
    if (!allowedStart.includes(wo.status)) {
      return { ok: false, error: 'Materials must be issued (or no materials required) before starting production' }
    }
    if (lines.length > 0 && !lines.every((l) => l.issuedQty >= l.requiredQty)) {
      return { ok: false, error: 'All material lines must be fully issued before production start' }
    }

    if (wo.woType === 'finished_goods') {
      const saGate = assertSaSubAssembliesReceivedForFg({
        fgWoId: woId,
        workOrders: get().workOrders,
        materialLines: get().materialLines,
        saReceipts: get().saReceipts,
      })
      if (!saGate.ok) return saGate

      const hasPendingSaIssue = lines.some((l) => {
        if (!l.sourceWoId || l.issuedQty >= l.requiredQty) return false
        const child = get().workOrders.find((w) => w.id === l.sourceWoId)
        return child?.woType === 'manufactured_sub_assembly'
      })
      if (hasPendingSaIssue) {
        const stockGate = assertFgSubAssemblyStockAvailable({
          fgWoId: woId,
          materialLines: get().materialLines,
          workOrders: get().workOrders,
          getOnHand: useInventoryStore.getState().getOnHand.bind(useInventoryStore.getState()),
        })
        if (!stockGate.ok) return stockGate
      }
    }

    if (wo.bomHeaderId && !useBomStore.getState().getBom(wo.bomHeaderId)) {
      return { ok: false, error: 'Work order references missing BOM — restore masters before starting production' }
    }

    const routing = wo.routingHeaderId
      ? useRoutingStore.getState().getRouting(wo.routingHeaderId)
      : useRoutingStore.getState().getReleasedRoutingForProduct(wo.productId)
    if (!routing || routing.status !== 'released') {
      return { ok: false, error: 'No Released Routing — production cannot start without routing' }
    }
    if (wo.routingHeaderId && wo.routingHeaderId !== routing.id) {
      return { ok: false, error: 'Work order routing reference is stale or missing' }
    }

    const routingOps = useRoutingStore.getState().getOperations(routing.id)
    const wcIds = new Set(useWorkCenterStore.getState().workCenters.map((w) => w.id))
    const missingWc = routingOps.find((o) => !wcIds.has(o.workCenterId))
    if (missingWc) {
      return { ok: false, error: `Routing operation ${missingWc.operationCode} references missing work center` }
    }

    const existingOps = get().getProductionOperations(woId)
    let newOps: WorkOrderProductionOperation[] = []
    if (existingOps.length === 0) {
      const templateOps = useRoutingStore.getState().getEnrichedOperations(routing.id)
      if (templateOps.length === 0) {
        return { ok: false, error: 'Routing has no operations — cannot start production' }
      }
      newOps = buildProductionOperationsFromRouting(woId, wo.qty, templateOps, genId)
    }

    const opsForCards = newOps.length > 0 ? newOps : existingOps
    const existingOpIds = new Set(get().jobCards.map((j) => j.productionOperationId))
    const opsNeedingCards = opsForCards.filter((o) => !existingOpIds.has(o.id))
    const newJobCards = opsNeedingCards.length > 0
      ? buildJobCardsFromOperations(
          wo,
          opsNeedingCards,
          get().jobCards.map((j) => j.jobCardNo),
          genId,
        )
      : []

    const ts = new Date().toISOString()
    const act = logActivity(
      woId,
      'Production Started',
      `${wo.outputItemCode} × ${wo.qty} — ${opsForCards.length} operations, ${newJobCards.length} job cards from ${routing.routingNo} ${routing.revision}`,
    )
    set((s) => ({
      productionOperations: newOps.length > 0 ? [...newOps, ...s.productionOperations] : s.productionOperations,
      jobCards: newJobCards.length > 0 ? [...newJobCards, ...s.jobCards] : s.jobCards,
      workOrders: s.workOrders.map((w) =>
        w.id === woId
          ? {
              ...w,
              status: 'in_production' as const,
              routingHeaderId: routing.id,
              routingRevision: routing.revision,
              updatedAt: ts,
            }
          : w,
      ),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  startJobCard: (jobCardId, input) => {
    const jc = get().jobCards.find((j) => j.id === jobCardId)
    if (!jc) return { ok: false, error: 'Job card not found' }
    if (jc.status === 'completed') return { ok: false, error: 'Job card already completed' }
    if (!input.assignedTeam.trim()) return { ok: false, error: 'Assigned team is required' }
    if (!input.startTime.trim()) return { ok: false, error: 'Start time is required' }

    const woOps = get().getProductionOperations(jc.workOrderId)
    const seqGate = canStartOperation(woOps, jc.productionOperationId)
    if (!seqGate.ok) return { ok: false, error: seqGate.error }

    const op = woOps.find((o) => o.id === jc.productionOperationId)
    if (!op) return { ok: false, error: 'Production operation not found' }

    const mappingGate = validateJobCardWarehouseMapping(
      op.workCenterId,
      op.workCenterCode,
      op.operationName,
      op.outsourced,
    )
    if (!mappingGate.ok) return { ok: false, error: mappingGate.error }

    const wipStart = moveToWipOnOperationStart(jc.workOrderId, jc.productionOperationId)
    if (!wipStart.ok && !wipStart.skipped) {
      return { ok: false, error: wipStart.error ?? 'WIP move to work center failed' }
    }

    const ts = new Date().toISOString()
    set((s) => ({
      jobCards: s.jobCards.map((j) =>
        j.id === jobCardId
          ? {
              ...j,
              assignedTeam: input.assignedTeam,
              startTime: input.startTime,
              status: 'in_progress' as const,
              updatedAt: ts,
            }
          : j,
      ),
      productionOperations: s.productionOperations.map((o) =>
        o.id === jc.productionOperationId ? { ...o, status: 'in_progress' as const } : o,
      ),
      activities: [
        logActivity(jc.workOrderId, 'Job Card Started', `${jc.jobCardNo} · Op ${jc.sequenceNo} ${jc.operationName} · ${input.assignedTeam}`),
        ...s.activities,
      ],
    }))
    return { ok: true }
  },

  pauseJobCard: (jobCardId) => {
    const jc = get().jobCards.find((j) => j.id === jobCardId)
    if (!jc) return { ok: false, error: 'Job card not found' }
    if (jc.status !== 'in_progress') return { ok: false, error: 'Only in-progress jobs can be paused' }
    const ts = new Date().toISOString()
    set((s) => ({
      jobCards: s.jobCards.map((j) =>
        j.id === jobCardId ? { ...j, status: 'assigned' as const, updatedAt: ts } : j,
      ),
      activities: [
        logActivity(jc.workOrderId, 'Job Card Paused', `${jc.jobCardNo} · Op ${jc.sequenceNo} ${jc.operationName}`),
        ...s.activities,
      ],
    }))
    return { ok: true }
  },

  completeJobCard: (jobCardId, input) => {
    const jc = get().jobCards.find((j) => j.id === jobCardId)
    if (!jc) return { ok: false, error: 'Job card not found' }
    if (jc.status === 'completed') return { ok: false, error: 'Job card already completed' }
    if (input.actualHours <= 0) return { ok: false, error: 'Actual hours must be greater than zero' }
    if (!input.endTime.trim()) return { ok: false, error: 'End time is required' }

    const qcChecks = input.qcChecks ?? jc.qcChecks
    if (jc.requiresQc && jc.qcChecks.length > 0 && !allQcChecksPassed(qcChecks)) {
      return { ok: false, error: 'Complete all QC checklist items before finishing the job card' }
    }

    const ts = new Date().toISOString()
    const opStatus = jc.requiresQc ? 'qc_hold' as const : 'completed' as const

    const wo = get().getWorkOrder(jc.workOrderId)
    const op = get().productionOperations.find((o) => o.id === jc.productionOperationId)!
    if (jc.requiresQc && wo) {
      useQualityStore.getState().createPendingInspection({
        workOrderId: jc.workOrderId,
        woNo: jc.woNo,
        jobCard: { ...jc, qcChecks, status: 'completed', completedAt: ts, updatedAt: ts },
        operation: op,
      })
    }

    if (!jc.requiresQc) {
      const wipResult = moveFromWipOnOperationComplete(jc.workOrderId, jc.productionOperationId)
      if (!wipResult.ok && !wipResult.skipped) {
        return { ok: false, error: wipResult.error ?? 'WIP move from work center failed' }
      }
    }

    set((s) => ({
      jobCards: s.jobCards.map((j) =>
        j.id === jobCardId
          ? {
              ...j,
              endTime: input.endTime,
              actualHours: input.actualHours,
              remarks: input.remarks,
              qcChecks,
              status: 'completed' as const,
              completedAt: ts,
              updatedAt: ts,
            }
          : j,
      ),
      productionOperations: s.productionOperations.map((o) =>
        o.id === jc.productionOperationId ? { ...o, status: opStatus } : o,
      ),
      activities: [
        logActivity(
          jc.workOrderId,
          'Job Card Completed',
          `${jc.jobCardNo} · ${input.actualHours}h · ${input.remarks || 'No remarks'}`,
        ),
        ...s.activities,
      ],
    }))

    return { ok: true }
  },

  completeWorkOrder: (woId) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.status !== 'in_production' && wo.status !== 'fully_issued') {
      return { ok: false, error: 'WO must be in production to complete' }
    }
    const lines = get().getWoMaterials(woId)
    if (lines.length > 0 && !lines.every((l) => l.issuedQty >= l.requiredQty)) {
      return { ok: false, error: 'Cannot complete — not all required materials issued' }
    }
    const qualityGate = assertWoCanComplete(woId)
    if (!qualityGate.ok) return { ok: false, error: qualityGate.error }

    if (wo.woType === 'finished_goods') {
      const saGate = assertSaSubAssembliesReceivedForFg({
        fgWoId: woId,
        workOrders: get().workOrders,
        materialLines: get().materialLines,
        saReceipts: get().saReceipts,
      })
      if (!saGate.ok) return saGate
    }

    const ts = new Date().toISOString()
    const act = logActivity(woId, 'Completed', `Manufacturing complete for ${wo.outputItemCode}`)
    set((s) => ({
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, status: 'completed' as const, completedAt: ts, updatedAt: ts } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  postFgReceipt: (woId, qty) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.woType !== 'finished_goods') return { ok: false, error: 'FG receipt only for Finished Goods work orders' }
    if (wo.status !== 'completed') return { ok: false, error: 'WO must be completed before FG receipt' }

    const fgQualityGate = assertWoCanReceiveFg(woId)
    if (!fgQualityGate.ok) return { ok: false, error: fgQualityGate.error }

    const master = useMasterStore.getState()
    const fgWarehouse = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')
    if (!fgWarehouse) return { ok: false, error: 'FG Yard warehouse not configured' }

    const receiptQty = qty ?? wo.qty
    const inv = useInventoryStore.getState()
    const fgItem = master.getItem(wo.fgItemId)!
    const wipWhId = resolveFgReceiptWipWarehouseId(wo)
    const wipPaint = wipWhId ? master.warehouses.find((w) => w.id === wipWhId) : undefined
    const wipOnHand = wipPaint ? inv.getOnHand(wo.fgItemId, wipPaint.id) : 0

    const result =
      wipPaint && wipOnHand >= receiptQty
        ? inv.postWipTransfer({
            itemId: wo.fgItemId,
            fromWarehouseId: wipPaint.id,
            warehouseId: fgWarehouse.id,
            qty: receiptQty,
            rate: fgItem.standardRate,
            referenceNo: wo.woNo,
            remarks: `FG receipt — ${wipPaint.warehouseCode} → FG Yard`,
            workOrderId: wo.id,
          })
        : inv.postFgReceipt({
            itemId: wo.fgItemId,
            warehouseId: fgWarehouse.id,
            qty: receiptQty,
            rate: fgItem.standardRate,
            referenceNo: wo.woNo,
            remarks: `FG receipt — ${wo.outputItemCode} from ${wo.woNo}`,
            workOrderId: wo.id,
          })
    if (!result.ok) return result

    const ts = new Date().toISOString()
    const receipt: FgReceipt = {
      id: genId('fgr'),
      workOrderId: woId,
      itemId: wo.fgItemId,
      warehouseId: fgWarehouse.id,
      qty: receiptQty,
      receiptDate: ts.slice(0, 10),
      movementNo: result.movementNo ?? null,
      createdAt: ts,
    }
    const act = logActivity(woId, 'FG Received', `${receiptQty} × ${wo.outputItemCode} into FG_YARD`)
    set((s) => ({
      fgReceipts: [receipt, ...s.fgReceipts],
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, status: 'fg_received' as const, fgReceivedAt: ts, updatedAt: ts } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true, receiptId: receipt.id }
  },

  postSaReceipt: (woId, qty) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.woType !== 'manufactured_sub_assembly') {
      return { ok: false, error: 'Semi-finished receipt only for manufactured sub-assembly work orders' }
    }
    if (wo.status !== 'completed') {
      return { ok: false, error: 'WO must be completed before posting semi-finished receipt' }
    }

    const existing = get().saReceipts.find((r) => r.sourceWoId === woId && r.status === 'posted')
    if (existing) return { ok: false, error: 'Semi-finished receipt already posted for this WO' }

    const master = useMasterStore.getState()
    const item = master.getItem(wo.outputItemId)
    if (!item) return { ok: false, error: 'Output item not found' }
    if (!item.isStockable) {
      return { ok: false, error: `${item.itemCode} is not stockable — enable stockable flag in Item Master` }
    }

    const productionOps = get().getProductionOperations(woId)
    const warehouseCode = resolveSaReceiptWarehouseCode(
      productionOps,
      useWorkCenterStore.getState().workCenters,
    )
    const warehouse = master.warehouses.find((w) => w.warehouseCode === warehouseCode)
    if (!warehouse) return { ok: false, error: `Receipt warehouse ${warehouseCode} not configured` }

    const receiptQty = qty ?? wo.qty
    const parentWo = wo.parentWoId ? get().getWorkOrder(wo.parentWoId) : undefined
    const inv = useInventoryStore.getState()
    const result = inv.postSaReceipt({
      itemId: wo.outputItemId,
      warehouseId: warehouse.id,
      qty: receiptQty,
      rate: item.standardRate,
      referenceNo: wo.woNo,
      remarks: `SA receipt — ${wo.outputItemCode} from ${wo.woNo}${parentWo ? ` → parent ${parentWo.woNo}` : ''}`,
      workOrderId: wo.id,
      sourceWoId: wo.id,
      parentWoId: parentWo?.id ?? null,
    })
    if (!result.ok) return result

    const ts = new Date().toISOString()
    const receipt: SaReceipt = {
      id: genId('sar'),
      sourceWoId: woId,
      sourceWoNo: wo.woNo,
      parentWoId: parentWo?.id ?? null,
      parentWoNo: parentWo?.woNo ?? null,
      itemId: wo.outputItemId,
      itemCode: wo.outputItemCode,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      qty: receiptQty,
      receiptDate: ts.slice(0, 10),
      movementNo: result.movementNo ?? null,
      status: 'posted',
      createdAt: ts,
    }
    const act = logActivity(
      woId,
      'Semi-Finished Receipt',
      `Semi-finished receipt posted into ${warehouse.warehouseCode} · ${receiptQty} × ${wo.outputItemCode}${parentWo ? ` · parent ${parentWo.woNo}` : ''}`,
    )
    set((s) => ({
      saReceipts: [receipt, ...s.saReceipts],
      activities: [act, ...s.activities],
    }))
    return { ok: true, receiptId: receipt.id }
  },

  closeWorkOrder: (woId) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.woType === 'finished_goods' && wo.status !== 'fg_received') {
      return { ok: false, error: 'FG WO must receive finished goods before close' }
    }
    if (wo.woType === 'manufactured_sub_assembly') {
      const receipt = get().saReceipts.find((r) => r.sourceWoId === woId && r.status === 'posted')
      if (!receipt) return { ok: false, error: 'Post semi-finished receipt before closing sub-assembly WO' }
      if (wo.status !== 'completed') {
        return { ok: false, error: 'WO must be completed before close' }
      }
    } else if (wo.woType !== 'finished_goods' && wo.status !== 'completed') {
      return { ok: false, error: 'WO must be completed before close' }
    }
    const ts = new Date().toISOString()
    const act = logActivity(woId, 'Closed', 'Work order closed — no further edits')
    set((s) => ({
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, status: 'closed' as const, closedAt: ts, updatedAt: ts } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  sendSubcontractMaterial: (woId, lineId, vendorId, challanNo, qty, expectedReturnDate) => {
    const wo = get().getWorkOrder(woId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (wo.woType !== 'subcontract') return { ok: false, error: 'Subcontract shipment only for subcontract WO' }
    const line = get().materialLines.find((m) => m.id === lineId)
    if (!line) return { ok: false, error: 'Line not found' }

    const inv = useInventoryStore.getState()
    const result = inv.postSubcontractOut({
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      qty,
      referenceNo: challanNo,
      remarks: `Subcontract send — ${wo.woNo} to vendor`,
      workOrderId: wo.id,
    })
    if (!result.ok) return result

    const ts = new Date().toISOString()
    const shipment: SubcontractShipment = {
      id: genId('sc'),
      workOrderId: woId,
      vendorId,
      challanNo,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      sentQty: qty,
      receivedQty: 0,
      rejectedQty: 0,
      reworkQty: 0,
      expectedReturnDate,
      status: 'sent',
      sentAt: ts,
      receivedAt: null,
      createdAt: ts,
    }
    const act = logActivity(woId, 'Subcontract Sent', `${qty} × ${line.itemCode} challan ${challanNo}`)
    set((s) => ({
      subcontractShipments: [shipment, ...s.subcontractShipments],
      workOrders: s.workOrders.map((w) => w.id === woId ? { ...w, vendorId, updatedAt: ts } : w),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },

  receiveSubcontractMaterial: (shipmentId, receivedQty, rejectedQty) => {
    const shipment = get().subcontractShipments.find((s) => s.id === shipmentId)
    if (!shipment) return { ok: false, error: 'Shipment not found' }
    const wo = get().getWorkOrder(shipment.workOrderId)
    if (!wo) return { ok: false, error: 'WO not found' }
    if (receivedQty <= 0 && rejectedQty <= 0) return { ok: false, error: 'Enter received or rejected quantity' }
    if (shipment.receivedQty + receivedQty + rejectedQty > shipment.sentQty) {
      return { ok: false, error: 'Receive qty cannot exceed sent balance' }
    }

    const inv = useInventoryStore.getState()
    if (receivedQty > 0) {
      const wipWhId = resolveSubcontractReceiveWipWarehouseId(wo)
      const result = inv.postSubcontractIn({
        itemId: wo.outputItemId,
        warehouseId: wipWhId ?? shipment.warehouseId,
        qty: receivedQty,
        rate: useMasterStore.getState().getItem(wo.outputItemId)?.standardRate ?? 0,
        referenceNo: shipment.challanNo,
        remarks: `Subcontract return — ${wo.woNo}`,
        workOrderId: wo.id,
      })
      if (!result.ok) return result
    }

    const ts = new Date().toISOString()
    const updated: SubcontractShipment = {
      ...shipment,
      receivedQty: shipment.receivedQty + receivedQty,
      rejectedQty: shipment.rejectedQty + rejectedQty,
      status: receivedQty + rejectedQty >= shipment.sentQty ? 'received' : 'partial_received',
      receivedAt: ts,
    }
    const act = logActivity(wo.id, 'Subcontract Received', `Received ${receivedQty}, rejected ${rejectedQty} — challan ${shipment.challanNo}`)
    set((s) => ({
      subcontractShipments: s.subcontractShipments.map((sh) => sh.id === shipmentId ? updated : sh),
      activities: [act, ...s.activities],
    }))
    return { ok: true }
  },
    }),
    {
      name: 'vasant-erp-workorders-v1',
      storage: erpStorage,
      partialize: (s) => ({
        config: s.config,
        workOrders: s.workOrders,
        materialLines: s.materialLines,
        subcontractShipments: s.subcontractShipments,
        fgReceipts: s.fgReceipts,
        saReceipts: s.saReceipts,
        activities: s.activities,
        productionOperations: s.productionOperations,
        jobCards: s.jobCards,
      }),
    },
  ),
)

export { isWoEditable }
