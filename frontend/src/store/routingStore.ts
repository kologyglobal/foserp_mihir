import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RoutingHeader, RoutingOperation, RoutingOperationEnriched, RoutingStatus } from '../types/routing'
import {
  computeRoutingTotalHours,
  enrichRoutingOperations,
  getReleasedRoutingForProduct,
  hasInactiveWorkCenters,
  nextRoutingRevision,
} from '../utils/routing'
import { getDefaultQcChecklist } from '../data/routing/qcChecklists'
import { useMasterStore } from './masterStore'
import { getNextCode } from '../services/codeSeriesService'
import { useWorkCenterStore } from './workCenterStore'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { mergeRoutingWithSeed, type RoutingPersistSlice } from '../utils/persistMigration'
import { getSessionUser, assertPermission } from '../utils/permissions'
import {
  assertMatrixApproval,
  advanceApprovalStep,
  buildApprovalContext,
  syncApprovalRequest,
} from '../utils/approvalEngine'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

interface RoutingState {
  routingHeaders: RoutingHeader[]
  routingOperations: RoutingOperation[]

  getRouting: (id: string) => RoutingHeader | undefined
  getRoutingsByProduct: (productId: string) => RoutingHeader[]
  getOperations: (routingHeaderId: string) => RoutingOperation[]
  getEnrichedOperations: (routingHeaderId: string) => RoutingOperationEnriched[]
  isProductionEligible: (routingHeaderId: string) => boolean
  getReleasedRoutingForProduct: (productId: string) => RoutingHeader | undefined

  createRouting: (productId: string, description: string, routingNo?: string) => string
  updateRoutingHeader: (id: string, data: Partial<RoutingHeader>) => void
  addOperation: (
    routingHeaderId: string,
    data: Omit<RoutingOperation, 'id' | 'routingHeaderId' | 'sortOrder' | 'qcChecklist'> & { qcChecklist?: import('../types/qc').QcChecklistItem[] },
  ) => { ok: boolean; error?: string; operationId?: string }
  updateOperation: (
    operationId: string,
    data: Partial<Pick<RoutingOperation, 'operationName' | 'workCenterId' | 'standardHours' | 'setupTimeHours' | 'runTimeHours' | 'laborRequirement' | 'qcRequired' | 'outsourced'>>,
  ) => { ok: boolean; error?: string }
  removeOperation: (operationId: string) => void

  cloneRouting: (routingHeaderId: string) => string
  reviseRouting: (routingHeaderId: string) => string
  submitForApproval: (routingHeaderId: string) => { ok: boolean; error?: string }
  approveRouting: (routingHeaderId: string, approvedBy: string) => { ok: boolean; error?: string; pendingNextApprover?: string }
  releaseRouting: (routingHeaderId: string) => { ok: boolean; error?: string }

  refreshTotalHours: (routingHeaderId: string) => void
}

function recalcTotal(headerId: string, operations: RoutingOperation[]): number {
  return computeRoutingTotalHours(operations.filter((o) => o.routingHeaderId === headerId))
}

export const useRoutingStore = create<RoutingState>()(
  persist(
    (set, get) => {
  const initial = mergeRoutingWithSeed(null)

  return {
    routingHeaders: initial.routingHeaders,
    routingOperations: initial.routingOperations,

    getRouting: (id) => get().routingHeaders.find((r) => r.id === id),
    getRoutingsByProduct: (productId) => get().routingHeaders.filter((r) => r.productId === productId),
    getOperations: (routingHeaderId) =>
      get().routingOperations
        .filter((o) => o.routingHeaderId === routingHeaderId)
        .sort((a, b) => a.sequenceNo - b.sequenceNo),
    getEnrichedOperations: (routingHeaderId) =>
      enrichRoutingOperations(get().getOperations(routingHeaderId), useWorkCenterStore.getState().workCenters),
    isProductionEligible: (routingHeaderId) => {
      const h = get().getRouting(routingHeaderId)
      return h?.status === 'released'
    },
    getReleasedRoutingForProduct: (productId) =>
      getReleasedRoutingForProduct(get().routingHeaders, productId),

    createRouting: (productId, description, routingNo) => {
      const product = useMasterStore.getState().getProduct(productId)
      if (!product) throw new Error('Product not found')
      const resolvedRoutingNo = routingNo?.trim()
      if (!resolvedRoutingNo) throw new Error('Routing number required from Code Series Master')
      const id = genId('rtg')
      const ts = new Date().toISOString()
      const header: RoutingHeader = {
        id,
        routingNo: resolvedRoutingNo,
        productId,
        revision: 'Rev-A',
        description,
        status: 'draft',
        previousRevisionId: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        totalStdHours: 0,
        approvedBy: null,
        approvedAt: null,
        submittedAt: null,
        submittedBy: null,
        createdAt: ts,
        updatedAt: ts,
      }
      set((s) => ({ routingHeaders: [...s.routingHeaders, header] }))
      return id
    },

    updateRoutingHeader: (id, data) => {
      set((s) => ({
        routingHeaders: s.routingHeaders.map((h) =>
          h.id === id ? { ...h, ...data, updatedAt: new Date().toISOString() } : h,
        ),
      }))
    },

    addOperation: (routingHeaderId, data) => {
      const header = get().getRouting(routingHeaderId)
      if (!header) return { ok: false, error: 'Routing not found' }
      if (header.status !== 'draft') return { ok: false, error: 'Only draft routings can be edited' }

      const wc = useWorkCenterStore.getState().getWorkCenter(data.workCenterId)
      if (!wc) return { ok: false, error: 'Work center must exist' }
      if (!wc.isActive) return { ok: false, error: 'Work center is inactive' }

      const existing = get().getOperations(routingHeaderId)
      if (existing.some((o) => o.sequenceNo === data.sequenceNo)) {
        return { ok: false, error: `Sequence ${data.sequenceNo} already exists` }
      }
      if (existing.some((o) => o.operationCode === data.operationCode)) {
        return { ok: false, error: `Operation code ${data.operationCode} already exists` }
      }

      const operationId = genId('rop')
      const op: RoutingOperation = {
        id: operationId,
        routingHeaderId,
        ...data,
        sortOrder: data.sequenceNo,
        qcChecklist: data.qcChecklist ?? (data.qcRequired ? getDefaultQcChecklist(data.operationName) : []),
      }
      set((s) => ({ routingOperations: [...s.routingOperations, op] }))
      get().refreshTotalHours(routingHeaderId)
      return { ok: true, operationId }
    },

    updateOperation: (operationId, data) => {
      const op = get().routingOperations.find((o) => o.id === operationId)
      if (!op) return { ok: false, error: 'Operation not found' }
      const header = get().getRouting(op.routingHeaderId)
      if (!header || header.status !== 'draft') {
        return { ok: false, error: 'Only draft routings can be edited' }
      }
      if (data.workCenterId) {
        const wc = useWorkCenterStore.getState().getWorkCenter(data.workCenterId)
        if (!wc?.isActive) return { ok: false, error: 'Work center is inactive' }
      }
      set((s) => ({
        routingOperations: s.routingOperations.map((o) =>
          o.id === operationId ? { ...o, ...data } : o,
        ),
      }))
      get().refreshTotalHours(op.routingHeaderId)
      return { ok: true }
    },

    removeOperation: (operationId) => {
      const op = get().routingOperations.find((o) => o.id === operationId)
      if (!op) return
      const header = get().getRouting(op.routingHeaderId)
      if (!header || header.status !== 'draft') return
      set((s) => ({
        routingOperations: s.routingOperations.filter((o) => o.id !== operationId),
      }))
      get().refreshTotalHours(op.routingHeaderId)
    },

    cloneRouting: (routingHeaderId) => {
      const source = get().getRouting(routingHeaderId)!
      const newId = genId('rtg')
      const ts = new Date().toISOString()
      const header: RoutingHeader = {
        ...source,
        id: newId,
        routingNo: getNextCode('routing'),
        revision: 'Rev-A',
        status: 'draft',
        previousRevisionId: null,
        approvedBy: null,
        approvedAt: null,
        submittedAt: null,
        submittedBy: null,
        createdAt: ts,
        updatedAt: ts,
      }
      const idMap = new Map<string, string>()
      get().getOperations(routingHeaderId).forEach((o) => idMap.set(o.id, genId('rop')))
      const clonedOps = get().getOperations(routingHeaderId).map((o) => ({
        ...o,
        id: idMap.get(o.id)!,
        routingHeaderId: newId,
      }))
      set((s) => ({
        routingHeaders: [...s.routingHeaders, header],
        routingOperations: [...s.routingOperations, ...clonedOps],
      }))
      get().refreshTotalHours(newId)
      return newId
    },

    reviseRouting: (routingHeaderId) => {
      const source = get().getRouting(routingHeaderId)!
      const newId = genId('rtg')
      const ts = new Date().toISOString()
      const header: RoutingHeader = {
        ...source,
        id: newId,
        revision: nextRoutingRevision(source.revision),
        status: 'draft',
        previousRevisionId: routingHeaderId,
        approvedBy: null,
        approvedAt: null,
        submittedAt: null,
        submittedBy: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        createdAt: ts,
        updatedAt: ts,
      }
      set((s) => ({
        routingHeaders: [
          ...s.routingHeaders.map((h) =>
            h.id === routingHeaderId && h.status === 'approved'
              ? { ...h, status: 'obsolete' as RoutingStatus }
              : h,
          ),
          header,
        ],
      }))
      const idMap = new Map<string, string>()
      get().getOperations(routingHeaderId).forEach((o) => idMap.set(o.id, genId('rop')))
      const clonedOps = get().getOperations(routingHeaderId).map((o) => ({
        ...o,
        id: idMap.get(o.id)!,
        routingHeaderId: newId,
      }))
      set((s) => ({ routingOperations: [...s.routingOperations, ...clonedOps] }))
      get().refreshTotalHours(newId)
      return newId
    },

    submitForApproval: (routingHeaderId) => {
      const perm = assertPermission('engineering', 'submit')
      if (!perm.ok) return perm
      const header = get().getRouting(routingHeaderId)!
      if (header.status !== 'draft') return { ok: false, error: 'Only draft routings can be submitted' }
      const ops = get().getOperations(routingHeaderId)
      if (ops.length === 0) return { ok: false, error: 'Routing must have at least one operation' }
      if (hasInactiveWorkCenters(ops, useWorkCenterStore.getState().workCenters)) {
        return { ok: false, error: 'Routing references inactive work centers' }
      }
      const user = getSessionUser()
      syncApprovalRequest({
        documentType: 'routing_revision',
        entityId: routingHeaderId,
        entityLabel: `${header.routingNo} Rev ${header.revision}`,
        context: buildApprovalContext('routing_revision', header),
        submittedByName: user.name,
      })
      get().updateRoutingHeader(routingHeaderId, {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        submittedBy: user.name,
      })
      return { ok: true }
    },

    approveRouting: (routingHeaderId, approvedBy) => {
      const perm = assertPermission('engineering', 'approve')
      if (!perm.ok) return perm
      const header = get().getRouting(routingHeaderId)!
      if (header.status !== 'submitted') return { ok: false, error: 'Routing must be submitted to approve' }
      const user = getSessionUser()
      const matrixCheck = assertMatrixApproval('routing_revision', routingHeaderId, user)
      if (!matrixCheck.ok) return matrixCheck
      const advance = advanceApprovalStep('routing_revision', routingHeaderId, user)
      if (!advance.ok) return advance
      if (!advance.completed) {
        return { ok: true, pendingNextApprover: advance.nextApprover }
      }
      get().updateRoutingHeader(routingHeaderId, {
        status: 'approved',
        approvedBy: approvedBy ?? user.name,
        approvedAt: new Date().toISOString(),
      })
      return { ok: true }
    },

    releaseRouting: (routingHeaderId) => {
      const perm = assertPermission('engineering', 'release')
      if (!perm.ok) return perm
      const header = get().getRouting(routingHeaderId)!
      if (header.status !== 'approved') return { ok: false, error: 'Routing must be approved before release' }
      get().updateRoutingHeader(routingHeaderId, { status: 'released' })
      return { ok: true }
    },

    refreshTotalHours: (routingHeaderId) => {
      const total = recalcTotal(routingHeaderId, get().routingOperations)
      get().updateRoutingHeader(routingHeaderId, { totalStdHours: total })
    },
  }
    },
    {
      name: ERP_STORAGE_KEYS.routing,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        routingHeaders: s.routingHeaders,
        routingOperations: s.routingOperations,
      }),
      merge: (persisted, current) => {
        const merged = mergeRoutingWithSeed(persisted as Partial<RoutingPersistSlice> | undefined)
        return { ...current, ...merged }
      },
    },
  ),
)
