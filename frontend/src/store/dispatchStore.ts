import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CustomerAcknowledgement,
  DispatchLine,
  DispatchPlan,
  DispatchReadyCandidate,
  DispatchReportRow,
  DispatchStatus,
} from '../types/dispatch'
import { allMandatoryChecklistPassed, DISPATCH_STATUS_FLOW } from '../types/dispatch'
import { assertStatusTransition } from '../types/purchase'
import { buildDefaultDispatchChecklist, suggestTrailerIdentity } from '../data/dispatch/dispatchChecklist'
import { stampApproved, stampCreated, stampModified, mergeAudit } from '../utils/audit'
import { nextDocumentNo } from '../utils/documentNumbers'
import { getNextCode } from '../services/codeSeriesService'
import { assertPermission, getSessionUser } from '../utils/permissions'
import { assertDispatchCloseDocuments } from '../utils/dmsRules'
import {
  assertMatrixApproval,
  advanceApprovalStep,
  buildApprovalContext,
  isApprovalComplete,
  syncApprovalRequest,
} from '../utils/approvalEngine'
import { useApprovalStore } from './approvalStore'
import { useInventoryStore } from './inventoryStore'
import { useMasterStore } from './masterStore'
import { locationDisplayLabel } from '../utils/locationUtils'
import { useMrpStore } from './mrpStore'
import { useWorkOrderStore } from './workOrderStore'
import { assertSerialDispatchReady } from './serialStore'
import { onDispatchSerialsConfirmed } from '../utils/serialIntegration'
import { getQualityStoreState } from './storeBridge'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function normalizeDispatchLine(line: DispatchLine): DispatchLine {
  return {
    ...line,
    trailerNo: line.trailerNo ?? '',
    chassisNo: line.chassisNo ?? '',
    serialNo: line.serialNo ?? line.trailerNo ?? '',
  }
}

function normalizeDispatch(plan: DispatchPlan): DispatchPlan {
  return {
    ...plan,
    dispatchDate: plan.dispatchDate ?? null,
    ewayBillNo: plan.ewayBillNo ?? '',
    invoiceId: plan.invoiceId ?? null,
    invoiceNo: plan.invoiceNo ?? null,
    finalQcInspectionId: plan.finalQcInspectionId ?? null,
    gatePass: plan.gatePass ?? null,
    createdById: plan.createdById ?? 'legacy',
    createdByName: plan.createdByName ?? 'System',
    createdAt: plan.createdAt ?? new Date().toISOString(),
    modifiedById: plan.modifiedById ?? null,
    modifiedByName: plan.modifiedByName ?? null,
    modifiedAt: plan.modifiedAt ?? null,
    approvedById: plan.approvedById ?? null,
    approvedByName: plan.approvedByName ?? null,
    approvedAt: plan.approvedAt ?? null,
    lines: plan.lines.map(normalizeDispatchLine),
    checklist: plan.checklist.map((c) => ({ ...c, mandatory: c.mandatory ?? true, systemGate: c.systemGate ?? false })),
    photos: plan.photos.map((p) => ({ ...p, category: p.category ?? 'loading' })),
  }
}

function syncSystemChecklist(plan: DispatchPlan, fgOnHand: number, finalQcPassed: boolean): DispatchPlan['checklist'] {
  return plan.checklist.map((c) => {
    if (c.id === 'dchk-fqc') return { ...c, passed: finalQcPassed, systemGate: true }
    if (c.id === 'dchk-fg') return { ...c, passed: fgOnHand > 0, systemGate: true }
    return c
  })
}


function nextDispatchNo(_existing: string[]): string {
  return getNextCode('dispatch')
}

interface DispatchState {
  dispatches: DispatchPlan[]

  getDispatch: (id: string) => DispatchPlan | undefined
  getDispatchesBySo: (salesOrderId: string) => DispatchPlan[]
  getReadyCandidates: () => DispatchReadyCandidate[]
  getMetrics: () => { total: number; planned: number; inTransit: number; delivered: number }

  createDispatchPlan: (candidate: DispatchReadyCandidate, plannedDate?: string) => { ok: boolean; error?: string; id?: string }
  updateDispatchPlan: (
    id: string,
    data: Partial<
      Pick<
        DispatchPlan,
        | 'plannedDate'
        | 'destination'
        | 'vehicleNo'
        | 'lrNo'
        | 'transporter'
        | 'driverName'
        | 'driverPhone'
        | 'remarks'
        | 'status'
      >
    >,
  ) => { ok: boolean; error?: string }
  updateLogistics: (
    id: string,
    data: Pick<DispatchPlan, 'vehicleNo' | 'lrNo' | 'transporter' | 'driverName' | 'driverPhone'>,
  ) => { ok: boolean; error?: string }
  updateLineIdentity: (
    dispatchId: string,
    lineId: string,
    data: Pick<DispatchLine, 'trailerNo' | 'chassisNo'>,
  ) => { ok: boolean; error?: string }
  toggleChecklistItem: (dispatchId: string, itemId: string, passed: boolean, notes?: string) => { ok: boolean; error?: string }
  addPhoto: (dispatchId: string, label: string, dataUrl: string) => { ok: boolean; error?: string; photoId?: string }
  removePhoto: (dispatchId: string, photoId: string) => { ok: boolean; error?: string }
  markLoading: (dispatchId: string) => { ok: boolean; error?: string }
  confirmDispatch: (dispatchId: string) => { ok: boolean; error?: string; movementNo?: string }
  requestDispatchOverride: (dispatchId: string, reason: string) => { ok: boolean; error?: string }
  approveDispatchOverride: (dispatchId: string) => { ok: boolean; error?: string }
  markInTransit: (dispatchId: string) => { ok: boolean; error?: string }
  recordCustomerAck: (
    dispatchId: string,
    ack: Omit<CustomerAcknowledgement, 'recordedAt' | 'recordedByName'>,
  ) => { ok: boolean; error?: string }
  approveSecurityGate: (dispatchId: string) => { ok: boolean; error?: string }
  closeDispatch: (dispatchId: string) => { ok: boolean; error?: string }
  getDispatchReadyReport: () => DispatchReportRow[]
  getPendingDispatchReport: () => DispatchReportRow[]
  getDispatchedThisMonthReport: () => DispatchReportRow[]
  getPodPendingReport: () => DispatchReportRow[]
  cancelDispatch: (dispatchId: string) => { ok: boolean; error?: string }
}

function toReportRow(d: DispatchPlan): DispatchReportRow {
  const line = d.lines[0]
  return {
    dispatchId: d.id,
    dispatchNo: d.dispatchNo,
    salesOrderNo: d.salesOrderNo,
    customerName: d.customerName,
    status: d.status,
    plannedDate: d.plannedDate,
    trailerNo: line?.trailerNo ?? '—',
    chassisNo: line?.chassisNo ?? '—',
  }
}

export const useDispatchStore = create<DispatchState>()(
  persist(
    (set, get) => ({
      dispatches: [],

      getDispatch: (id) => {
        const plan = get().dispatches.find((d) => d.id === id)
        return plan ? normalizeDispatch(plan) : undefined
      },
      getDispatchesBySo: (salesOrderId) => get().dispatches.filter((d) => d.salesOrderId === salesOrderId),

      getReadyCandidates: () => {
        const master = useMasterStore.getState()
        const inv = useInventoryStore.getState()
        const woStore = useWorkOrderStore.getState()
        const mrp = useMrpStore.getState()
        const fgWarehouse = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')
        if (!fgWarehouse) return []

        const candidates: DispatchReadyCandidate[] = []
        const activeDispatchWoIds = new Set(
          get()
            .dispatches.filter((d) => !['cancelled', 'delivered'].includes(d.status))
            .flatMap((d) => d.lines.map((l) => l.workOrderId))
            .filter(Boolean) as string[],
        )

        const quality = getQualityStoreState()

        for (const wo of woStore.workOrders) {
          if (wo.woType !== 'finished_goods') continue
          if (wo.status !== 'fg_received' && wo.status !== 'closed') continue
          if (activeDispatchWoIds.has(wo.id)) continue
          if (!quality.hasFinalQcPassed(wo.id)) continue

          const so = mrp.getSalesOrder(wo.salesOrderId)
          if (!so || so.status === 'dispatched' || so.status === 'closed') continue

          const product = master.getProduct(wo.productId)
          const cust = master.customers.find((c) => c.id === so.customerId)
          const loc = so.locationId ? master.locations.find((l) => l.id === so.locationId) : null
          const fgOnHand = inv.getOnHand(wo.fgItemId, fgWarehouse.id)
          if (fgOnHand < wo.qty) continue

          const identity = suggestTrailerIdentity('READY', wo.woNo, 0)
          candidates.push({
            salesOrderId: so.id,
            salesOrderNo: so.salesOrderNo,
            customerId: so.customerId,
            customerName: cust?.customerName ?? '—',
            productId: wo.productId,
            productCode: product?.productCode ?? wo.outputItemCode,
            productName: product?.productName ?? wo.outputItemCode,
            fgItemId: wo.fgItemId,
            fgItemCode: wo.outputItemCode,
            workOrderId: wo.id,
            workOrderNo: wo.woNo,
            woQty: wo.qty,
            fgOnHand,
            destination: so.deliveryLocation ?? (loc ? locationDisplayLabel(loc) : (cust ? `${cust.city}, ${cust.state}` : '—')),
            locationId: so.locationId ?? null,
            requiredDate: so.requiredDate,
            finalQcPassed: true,
            trailerSerial: identity.trailerNo,
            chassisNo: identity.chassisNo,
          })
        }
        return candidates
      },

      getMetrics: () => {
        const dispatches = get().dispatches.filter((d) => d.status !== 'cancelled')
        return {
          total: dispatches.length,
          planned: dispatches.filter((d) => ['draft', 'planned', 'loading'].includes(d.status)).length,
          inTransit: dispatches.filter((d) => ['dispatched', 'in_transit'].includes(d.status)).length,
          delivered: dispatches.filter((d) => d.status === 'delivered').length,
        }
      },

      createDispatchPlan: (candidate, plannedDate) => {
        const master = useMasterStore.getState()
        const fgWarehouse = master.warehouses.find((w) => w.warehouseCode === 'FG_YARD')
        if (!fgWarehouse) return { ok: false, error: 'FG Yard warehouse not configured' }

        const audit = stampCreated()
        const id = genId('dsp')
        const dispatchNo = nextDispatchNo(get().dispatches.map((d) => d.dispatchNo))
        const finalQcPassed = getQualityStoreState().hasFinalQcPassed(candidate.workOrderId)

        const lines: DispatchLine[] = []
        for (let i = 0; i < candidate.woQty; i++) {
          const identity = suggestTrailerIdentity(dispatchNo, candidate.workOrderNo, i)
          lines.push({
            id: genId('dspl'),
            itemId: candidate.fgItemId,
            itemCode: candidate.fgItemCode,
            warehouseId: fgWarehouse.id,
            warehouseCode: fgWarehouse.warehouseCode,
            qty: 1,
            workOrderId: candidate.workOrderId,
            workOrderNo: candidate.workOrderNo,
            trailerNo: identity.trailerNo,
            chassisNo: identity.chassisNo,
            serialNo: identity.trailerNo,
          })
        }

        const baseChecklist = buildDefaultDispatchChecklist()
        const checklist = syncSystemChecklist(
          { ...({} as DispatchPlan), checklist: baseChecklist },
          candidate.fgOnHand,
          finalQcPassed,
        )

        const plan: DispatchPlan = {
          id,
          dispatchNo,
          salesOrderId: candidate.salesOrderId,
          salesOrderNo: candidate.salesOrderNo,
          customerId: candidate.customerId,
          customerName: candidate.customerName,
          productId: candidate.productId,
          productCode: candidate.productCode,
          productName: candidate.productName,
          destination: candidate.destination,
          locationId: candidate.locationId ?? null,
          plannedDate: plannedDate ?? candidate.requiredDate,
          dispatchDate: null,
          status: 'planned',
          vehicleNo: '',
          lrNo: '',
          transporter: '',
          driverName: '',
          driverPhone: '',
          ewayBillNo: '',
          invoiceId: null,
          invoiceNo: null,
          finalQcInspectionId: getQualityStoreState().inspections.find(
            (i) => i.category === 'final' && i.workOrderId === candidate.workOrderId && i.status === 'pass',
          )?.id ?? null,
          gatePass: null,
          lines,
          checklist,
          photos: [],
          customerAck: null,
          dispatchedAt: null,
          movementNo: null,
          remarks: '',
          ...audit,
        }

        set((s) => ({ dispatches: [plan, ...s.dispatches] }))

        const so = useMrpStore.getState().getSalesOrder(candidate.salesOrderId)
        if (so && so.status !== 'ready_dispatch' && so.status !== 'dispatched') {
          useMrpStore.setState((state) => ({
            salesOrders: state.salesOrders.map((o) =>
              o.id === candidate.salesOrderId ? { ...o, status: 'ready_dispatch' as const } : o,
            ),
          }))
        }

        return { ok: true, id }
      },

      updateDispatchPlan: (id, data) => {
        const plan = get().getDispatch(id)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (['dispatched', 'in_transit', 'delivered', 'cancelled'].includes(plan.status)) {
          return { ok: false, error: 'Cannot edit dispatch in current status' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) => (d.id === id ? { ...d, ...data, updatedAt: ts } : d)),
        }))
        return { ok: true }
      },

      updateLogistics: (id, data) => {
        const plan = get().getDispatch(id)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (plan.status === 'cancelled' || plan.status === 'delivered') {
          return { ok: false, error: 'Cannot update logistics in current status' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === id ? { ...d, ...data, updatedAt: ts } : d,
          ),
        }))
        return { ok: true }
      },

      updateLineIdentity: (dispatchId, lineId, data) => {
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (['dispatched', 'in_transit', 'delivered', 'cancelled'].includes(plan.status)) {
          return { ok: false, error: 'Cannot edit trailer identity after dispatch' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? {
                  ...d,
                  lines: d.lines.map((line) =>
                    line.id === lineId ? { ...line, ...data } : line,
                  ),
                  updatedAt: ts,
                }
              : d,
          ),
        }))
        return { ok: true }
      },

      toggleChecklistItem: (dispatchId, itemId, passed, notes) => {
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        const item = plan.checklist.find((c) => c.id === itemId)
        if (item?.systemGate) return { ok: false, error: 'System gate items are auto-validated' }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? {
                  ...d,
                  checklist: d.checklist.map((c) =>
                    c.id === itemId ? { ...c, passed, notes: notes ?? c.notes } : c,
                  ),
                  updatedAt: ts,
                }
              : d,
          ),
        }))
        return { ok: true }
      },

      addPhoto: (dispatchId, label, dataUrl) => {
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        const photoId = genId('dph')
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? {
                  ...d,
                  photos: [...d.photos, { id: photoId, label, dataUrl, capturedAt: ts, category: 'loading' as const }],
                  modifiedAt: ts,
                }
              : d,
          ),
        }))
        return { ok: true, photoId }
      },

      removePhoto: (dispatchId, photoId) => {
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? { ...d, photos: d.photos.filter((p) => p.id !== photoId), updatedAt: ts }
              : d,
          ),
        }))
        return { ok: true }
      },

      markLoading: (dispatchId) => {
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (!['planned', 'draft'].includes(plan.status)) {
          return { ok: false, error: 'Only planned dispatches can move to loading' }
        }
        if (!plan.vehicleNo.trim()) {
          return { ok: false, error: 'Vehicle number is required before loading' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId ? { ...d, status: 'loading' as DispatchStatus, updatedAt: ts } : d,
          ),
        }))
        return { ok: true }
      },

      confirmDispatch: (dispatchId) => {
        const perm = assertPermission('dispatch', 'post')
        if (!perm.ok) return perm
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (!['planned', 'loading'].includes(plan.status)) {
          return { ok: false, error: 'Dispatch already confirmed or closed' }
        }

        const woId = plan.lines[0]?.workOrderId
        const finalQcPassed = woId ? getQualityStoreState().hasFinalQcPassed(woId) : true
        if (woId && !finalQcPassed) {
          const overrideReq = useApprovalStore.getState().getActiveRequest('dispatch_override', dispatchId)
          if (!isApprovalComplete(overrideReq)) {
            return {
              ok: false,
              error: 'Final QC must be approved before dispatch — request dispatch override approval first',
            }
          }
        }

        const inv = useInventoryStore.getState()
        for (const line of plan.lines) {
          const free = inv.getFreeQty(line.itemId, line.warehouseId)
          if (line.qty > free) {
            return { ok: false, error: `Insufficient FG stock for ${line.itemCode}. Free: ${free}` }
          }
        }

        if (!plan.vehicleNo.trim()) return { ok: false, error: 'Vehicle number is required' }
        if (!plan.lrNo.trim()) return { ok: false, error: 'LR number is required before dispatch' }
        if (!plan.transporter.trim()) return { ok: false, error: 'Transporter is required' }
        if (!plan.driverName.trim()) return { ok: false, error: 'Driver name is required' }
        if (!plan.driverPhone.trim()) return { ok: false, error: 'Driver mobile is required' }
        const missingIdentity = plan.lines.find(
          (l) => !l.trailerNo.trim() || !l.chassisNo.trim(),
        )
        if (missingIdentity) {
          return { ok: false, error: 'Trailer number and chassis number required for every unit' }
        }
        for (const line of plan.lines) {
          const serialCheck = assertSerialDispatchReady(line.trailerNo, line.chassisNo)
          if (!serialCheck.ok) return serialCheck
        }
        if (!allMandatoryChecklistPassed(plan.checklist)) {
          return { ok: false, error: 'Complete all mandatory checklist items before confirming' }
        }
        if (plan.photos.filter((p) => p.category !== 'pod').length === 0) {
          return { ok: false, error: 'Add at least one loading photo before confirming' }
        }
        if (!plan.gatePass?.securityApprovedBy) {
          return { ok: false, error: 'Security gate approval required before dispatch' }
        }

        const master = useMasterStore.getState()
        let movementNo: string | undefined

        for (const line of plan.lines) {
          const item = master.getItem(line.itemId)
          const result = inv.postDispatchIssue({
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            qty: line.qty,
            rate: item?.standardRate ?? 0,
            referenceNo: plan.dispatchNo,
            remarks: `FG dispatch ${plan.dispatchNo} — SO ${plan.salesOrderNo} · ${plan.vehicleNo}`,
            dispatchId: plan.id,
            salesOrderNo: plan.salesOrderNo,
          })
          if (!result.ok) return result
          movementNo = result.movementNo
          onDispatchSerialsConfirmed(line.trailerNo, line.chassisNo)
        }

        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? mergeAudit(d, {
                  ...stampModified(d),
                  ...stampApproved(),
                  status: 'dispatched' as DispatchStatus,
                  dispatchedAt: ts,
                  dispatchDate: ts.slice(0, 10),
                  movementNo: movementNo ?? null,
                })
              : d,
          ),
        }))

        useMrpStore.setState((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === plan.salesOrderId ? { ...o, status: 'dispatched' as const } : o,
          ),
        }))

        return { ok: true, movementNo }
      },

      requestDispatchOverride: (dispatchId, reason) => {
        const perm = assertPermission('dispatch', 'override')
        if (!perm.ok) return perm
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (!reason.trim()) return { ok: false, error: 'Override reason is required' }
        const user = getSessionUser()
        syncApprovalRequest({
          documentType: 'dispatch_override',
          entityId: dispatchId,
          entityLabel: plan.dispatchNo,
          context: buildApprovalContext('dispatch_override', { dispatchOverride: true, reason }),
          submittedByName: user.name,
        })
        return { ok: true }
      },

      approveDispatchOverride: (dispatchId) => {
        const perm = assertPermission('dispatch', 'approve')
        if (!perm.ok) return perm
        const user = getSessionUser()
        const matrixCheck = assertMatrixApproval('dispatch_override', dispatchId, user)
        if (!matrixCheck.ok) return matrixCheck
        return advanceApprovalStep('dispatch_override', dispatchId, user)
      },

      markInTransit: (dispatchId) => {
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (plan.status !== 'dispatched') {
          return { ok: false, error: 'Only dispatched orders can be marked in transit' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId ? { ...d, status: 'in_transit' as DispatchStatus, updatedAt: ts } : d,
          ),
        }))
        return { ok: true }
      },

      recordCustomerAck: (dispatchId, ack) => {
        const perm = assertPermission('dispatch', 'post')
        if (!perm.ok) return perm
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (!['dispatched', 'in_transit', 'delivered'].includes(plan.status)) {
          return { ok: false, error: 'Customer acknowledgement only after dispatch' }
        }
        if (!ack.acknowledgedBy.trim()) return { ok: false, error: 'Acknowledged by name is required' }
        if (!ack.ackDate.trim()) return { ok: false, error: 'Acknowledgement date is required' }

        const ts = new Date().toISOString()
        const user = stampModified(plan)
        const customerAck: CustomerAcknowledgement = {
          ...ack,
          recordedAt: ts,
          recordedByName: user.modifiedByName ?? 'Dispatch',
        }

        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? mergeAudit(d, {
                  ...user,
                  customerAck,
                  status: 'pod_received' as DispatchStatus,
                })
              : d,
          ),
        }))
        return { ok: true }
      },

      approveSecurityGate: (dispatchId) => {
        const perm = assertPermission('dispatch', 'approve')
        if (!perm.ok) return perm
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (!plan.vehicleNo.trim() || !plan.driverName.trim() || !plan.driverPhone.trim()) {
          return { ok: false, error: 'Vehicle, driver name and mobile required for gate pass' }
        }
        const approval = stampApproved()
        const gatePassNo = nextDocumentNo('GP-', get().dispatches.map((d) => d.gatePass?.gatePassNo ?? ''))
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId
              ? mergeAudit(d, {
                  ...stampModified(d),
                  gatePass: {
                    gatePassNo,
                    vehicleNo: plan.vehicleNo,
                    driverName: plan.driverName,
                    driverPhone: plan.driverPhone,
                    transporter: plan.transporter,
                    lrNo: plan.lrNo,
                    securityApprovedBy: approval.approvedByName,
                    securityApprovedAt: approval.approvedAt,
                  },
                })
              : d,
          ),
        }))
        return { ok: true }
      },

      closeDispatch: (dispatchId) => {
        const perm = assertPermission('dispatch', 'close')
        if (!perm.ok) return perm
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (plan.status !== 'pod_received') {
          return { ok: false, error: 'POD must be received before closing dispatch' }
        }
        const podDoc = assertDispatchCloseDocuments(dispatchId)
        if (!podDoc.ok) return podDoc
        const tr = assertStatusTransition(DISPATCH_STATUS_FLOW, plan.status, 'closed')
        if (!tr.ok) return tr
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId ? mergeAudit(d, { ...stampModified(d), status: 'closed' as DispatchStatus }) : d,
          ),
        }))
        return { ok: true }
      },

      getDispatchReadyReport: () => {
        return get()
          .getReadyCandidates()
          .map((c) => ({
            dispatchId: '',
            dispatchNo: '—',
            salesOrderNo: c.salesOrderNo,
            customerName: c.customerName,
            status: 'ready' as DispatchStatus,
            plannedDate: c.requiredDate,
            trailerNo: c.trailerSerial,
            chassisNo: c.chassisNo,
          }))
      },

      getPendingDispatchReport: () =>
        get()
          .dispatches.filter((d) => ['planned', 'loading'].includes(d.status))
          .map(toReportRow),

      getDispatchedThisMonthReport: () => {
        const month = new Date().toISOString().slice(0, 7)
        return get()
          .dispatches.filter((d) => d.dispatchedAt?.startsWith(month))
          .map(toReportRow)
      },

      getPodPendingReport: () =>
        get()
          .dispatches.filter((d) => ['dispatched', 'in_transit', 'delivered'].includes(d.status))
          .map(toReportRow),

      cancelDispatch: (dispatchId) => {
        const plan = get().getDispatch(dispatchId)
        if (!plan) return { ok: false, error: 'Dispatch plan not found' }
        if (['dispatched', 'in_transit', 'delivered'].includes(plan.status)) {
          return { ok: false, error: 'Cannot cancel after stock issue' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          dispatches: s.dispatches.map((d) =>
            d.id === dispatchId ? { ...d, status: 'cancelled' as DispatchStatus, updatedAt: ts } : d,
          ),
        }))
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.dispatch,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      merge: (persisted, current) => {
        const p = persisted as { dispatches?: DispatchPlan[] } | undefined
        return {
          ...current,
          dispatches: (p?.dispatches ?? []).map(normalizeDispatch),
        }
      },
    },
  ),
)
