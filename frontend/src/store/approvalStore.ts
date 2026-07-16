import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ApprovalApproverDefinition,
  ApprovalDocumentType,
  ApprovalMatrixRule,
  ApprovalRequest,
  ApprovalStepRecord,
} from '../types/approvalMatrix'
import { DEFAULT_APPROVAL_RULES, DEFAULT_APPROVER_DEFINITIONS } from '../data/approval/seedApprovalMatrix'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { memoizedOnSource } from './selectors/memoizedGetters'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

interface ApprovalState {
  rules: ApprovalMatrixRule[]
  approvers: ApprovalApproverDefinition[]
  requests: ApprovalRequest[]

  getRules: () => ApprovalMatrixRule[]
  getRule: (id: string) => ApprovalMatrixRule | undefined
  updateRule: (id: string, patch: Partial<Pick<ApprovalMatrixRule, 'label' | 'active' | 'sequence'>> & { threshold?: number }) => boolean
  resetRulesToDefault: () => void
  updateApproverRoles: (code: ApprovalApproverDefinition['code'], mappedRoles: ApprovalApproverDefinition['mappedRoles']) => boolean

  getRequest: (id: string) => ApprovalRequest | undefined
  getActiveRequest: (documentType: ApprovalDocumentType, entityId: string) => ApprovalRequest | undefined
  listRequests: () => ApprovalRequest[]
  createRequest: (input: {
    documentType: ApprovalDocumentType
    entityId: string
    entityLabel: string
    context: Record<string, unknown>
    steps: ApprovalStepRecord[]
    submittedByName: string
  }) => ApprovalRequest
  updateRequestSteps: (requestId: string, steps: ApprovalStepRecord[]) => void
  approveCurrentStep: (requestId: string, approvedByName: string, remarks?: string) => { ok: boolean; error?: string }
  rejectCurrentStep: (requestId: string, rejectedByName: string, remarks: string) => { ok: boolean; error?: string }
  returnForCorrection: (requestId: string, returnedByName: string, remarks: string) => { ok: boolean; error?: string }
}

export const useApprovalStore = create<ApprovalState>()(
  persist(
    (set, get) => ({
      rules: DEFAULT_APPROVAL_RULES.map((r) => ({ ...r, condition: { ...r.condition } })),
      approvers: DEFAULT_APPROVER_DEFINITIONS.map((a) => ({ ...a, mappedRoles: [...a.mappedRoles] })),
      requests: [],

      getRules: () => get().rules,
      getRule: (id) => get().rules.find((r) => r.id === id),

      updateRule: (id, patch) => {
        let ok = false
        set((s) => ({
          rules: s.rules.map((r) => {
            if (r.id !== id) return r
            ok = true
            const { threshold, ...rest } = patch
            const next: ApprovalMatrixRule = { ...r, ...rest }
            if (threshold != null && r.condition.field === 'totalAmount') {
              next.condition = { ...r.condition, value: threshold }
            }
            return next
          }),
        }))
        return ok
      },

      resetRulesToDefault: () => {
        set({
          rules: DEFAULT_APPROVAL_RULES.map((r) => ({ ...r, condition: { ...r.condition } })),
          approvers: DEFAULT_APPROVER_DEFINITIONS.map((a) => ({ ...a, mappedRoles: [...a.mappedRoles] })),
        })
      },

      updateApproverRoles: (code, mappedRoles) => {
        let ok = false
        set((s) => ({
          approvers: s.approvers.map((a) => {
            if (a.code !== code) return a
            ok = true
            return { ...a, mappedRoles: [...mappedRoles] }
          }),
        }))
        return ok
      },

      getRequest: (id) => get().requests.find((r) => r.id === id),

      getActiveRequest: (documentType, entityId) => {
        const matches = get().requests.filter((r) => r.documentType === documentType && r.entityId === entityId)
        return matches.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
      },

      listRequests: () => {
        const requests = get().requests
        return memoizedOnSource(requests, 'approval:list-requests', () =>
          [...requests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
        )
      },

      createRequest: (input) => {
        const request: ApprovalRequest = {
          id: genId('apreq'),
          documentType: input.documentType,
          entityId: input.entityId,
          entityLabel: input.entityLabel,
          status: input.steps.length === 0 ? 'approved' : 'pending',
          steps: input.steps.map((s) => ({ ...s })),
          currentStepIndex: 0,
          context: input.context,
          submittedAt: ts(),
          submittedByName: input.submittedByName,
          completedAt: input.steps.length === 0 ? ts() : undefined,
        }
        set((s) => ({ requests: [request, ...s.requests] }))
        return request
      },

      updateRequestSteps: (requestId, steps) => {
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== requestId) return r
            return {
              ...r,
              steps: steps.map((st) => ({ ...st })),
              currentStepIndex: 0,
              status: steps.length === 0 ? ('approved' as const) : ('pending' as const),
              completedAt: steps.length === 0 ? ts() : undefined,
              rejectionReason: undefined,
              returnedAt: undefined,
              returnedByName: undefined,
            }
          }),
        }))
      },

      approveCurrentStep: (requestId, approvedByName, remarks = '') => {
        const request = get().getRequest(requestId)
        if (!request) return { ok: false, error: 'Approval request not found' }
        if (request.status !== 'pending') return { ok: false, error: 'Approval already completed' }

        const step = request.steps[request.currentStepIndex]
        if (!step) return { ok: false, error: 'No pending approval step' }

        const now = ts()
        const nextIndex = request.currentStepIndex + 1
        const allDone = nextIndex >= request.steps.length

        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== requestId) return r
            const steps = r.steps.map((st, idx) =>
              idx === r.currentStepIndex
                ? { ...st, status: 'approved' as const, approvedByName, approvedAt: now, remarks: remarks || st.remarks }
                : st,
            )
            return {
              ...r,
              steps,
              currentStepIndex: allDone ? r.currentStepIndex : nextIndex,
              status: allDone ? ('approved' as const) : ('pending' as const),
              completedAt: allDone ? now : undefined,
            }
          }),
        }))
        return { ok: true }
      },

      rejectCurrentStep: (requestId, rejectedByName, remarks) => {
        if (!remarks.trim()) return { ok: false, error: 'Rejection remarks are required' }
        const request = get().getRequest(requestId)
        if (!request) return { ok: false, error: 'Approval request not found' }
        if (request.status !== 'pending') return { ok: false, error: 'Approval already completed' }

        const now = ts()
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== requestId) return r
            const steps = r.steps.map((st, idx) =>
              idx === r.currentStepIndex
                ? { ...st, status: 'rejected' as const, approvedByName: rejectedByName, approvedAt: now, remarks }
                : st,
            )
            return {
              ...r,
              steps,
              status: 'rejected' as const,
              completedAt: now,
              rejectionReason: remarks,
            }
          }),
        }))
        return { ok: true }
      },

      returnForCorrection: (requestId, returnedByName, remarks) => {
        if (!remarks.trim()) return { ok: false, error: 'Return remarks are required' }
        const request = get().getRequest(requestId)
        if (!request) return { ok: false, error: 'Approval request not found' }
        if (request.status !== 'pending') return { ok: false, error: 'Approval already completed' }

        const now = ts()
        set((s) => ({
          requests: s.requests.map((r) => {
            if (r.id !== requestId) return r
            return {
              ...r,
              status: 'returned' as const,
              returnedAt: now,
              returnedByName,
              rejectionReason: remarks,
              completedAt: now,
            }
          }),
        }))
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.approval,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({ rules: s.rules, approvers: s.approvers, requests: s.requests }),
    },
  ),
)
