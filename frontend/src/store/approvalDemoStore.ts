import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApprovalListFilters, ApprovalRequest, JournalApprovalTimelineEntry } from '../types/approvals'
import type { Journal } from '../types/journals'
import { getJournalDemoState, patchJournalInDemo } from './journalDemoStore'

const DEMO_APPROVER_USER = 'demo-approver'

function id() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

function buildRequest(journal: Journal, cycleNumber: number): ApprovalRequest {
  const amount = Math.max(Number(journal.totalDebit), Number(journal.totalCredit)).toFixed(4)
  return {
    id: id(),
    tenantId: journal.tenantId ?? 'demo-tenant',
    legalEntityId: journal.legalEntityId,
    documentType: 'JOURNAL',
    documentId: journal.id,
    documentNumberSnapshot: journal.referenceNumber,
    documentStatusSnapshot: journal.status,
    cycleNumber,
    status: 'PENDING',
    amountBasis: amount,
    currencyCode: journal.currencyCode,
    currentLevel: 1,
    totalLevels: 1,
    requestedBy: journal.createdBy ?? 'demo-maker',
    requestedAt: nowIso(),
    completedAt: null,
    completedBy: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    steps: [
      {
        id: id(),
        level: 1,
        sequence: 1,
        approverRoleId: null,
        approverUserId: DEMO_APPROVER_USER,
        status: 'PENDING',
        actedBy: null,
        actedAt: null,
        comments: null,
      },
    ],
    allowedActions: {
      view: true,
      approve: true,
      reject: true,
      sendBack: true,
    },
  }
}

interface ApprovalDemoState {
  requests: ApprovalRequest[]
  createOnSubmit: (journal: Journal) => void
  listApprovals: (filters: ApprovalListFilters) => ApprovalRequest[]
  getApproval: (id: string) => ApprovalRequest | undefined
  getJournalApprovals: (journalId: string) => JournalApprovalTimelineEntry[]
  approveJournal: (journalId: string, comments?: string) => Journal
  sendBackJournal: (journalId: string, comments: string) => Journal
  rejectJournal: (journalId: string, comments: string) => Journal
}

export const useApprovalDemoStore = create<ApprovalDemoState>()(
  persist(
    (set, get) => ({
      requests: [],

      createOnSubmit(journal) {
        if (!journal.approvalRequired) return
        const existing = get().requests.filter((r) => r.documentId === journal.id)
        const cycleNumber = existing.length > 0 ? Math.max(...existing.map((r) => r.cycleNumber)) + 1 : 1
        const request = buildRequest(journal, cycleNumber)
        set((s) => ({ requests: [...s.requests, request] }))
      },

      listApprovals(filters) {
        let rows = get().requests.filter((r) => r.legalEntityId === filters.legalEntityId)
        if (filters.view === 'my_pending' || !filters.view) {
          rows = rows.filter((r) => r.status === 'PENDING')
        } else if (filters.view === 'submitted_by_me') {
          rows = rows.filter((r) => r.requestedBy === 'demo-maker' || Boolean(r.requestedBy))
        } else if (filters.view === 'completed_by_me') {
          rows = rows.filter((r) =>
            ['APPROVED', 'SENT_BACK', 'REJECTED'].includes(r.status),
          )
        }
        if (filters.status) rows = rows.filter((r) => r.status === filters.status)
        return rows.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      },

      getApproval(id) {
        return get().requests.find((r) => r.id === id)
      },

      getJournalApprovals(journalId) {
        return get()
          .requests.filter((r) => r.documentId === journalId)
          .sort((a, b) => a.cycleNumber - b.cycleNumber)
          .map((r) => ({
            requestId: r.id,
            cycleNumber: r.cycleNumber,
            status: r.status,
            requestedBy: r.requestedBy,
            requestedAt: r.requestedAt,
            completedAt: r.completedAt,
            completedBy: r.completedBy,
            currentLevel: r.currentLevel,
            totalLevels: r.totalLevels,
            steps: r.steps ?? [],
          }))
      },

      approveJournal(journalId, comments) {
        const journal = getJournalDemoState().getJournal(journalId)
        if (!journal) throw new Error('Journal not found')
        if (journal.status !== 'PENDING_APPROVAL') throw new Error('Journal is not pending approval')
        if (journal.createdBy === DEMO_APPROVER_USER) {
          throw new Error('SELF_APPROVAL_NOT_ALLOWED')
        }

        patchJournalInDemo(journalId, {
          status: 'APPROVED',
          currentApprovalLevel: journal.currentApprovalLevel || 1,
          updatedAt: nowIso(),
        })

        set((s) => ({
          requests: s.requests.map((r) =>
            r.documentId === journalId && r.status === 'PENDING'
              ? {
                  ...r,
                  status: 'APPROVED',
                  completedAt: nowIso(),
                  completedBy: DEMO_APPROVER_USER,
                  steps: (r.steps ?? []).map((step) =>
                    step.status === 'PENDING'
                      ? {
                          ...step,
                          status: 'APPROVED',
                          actedBy: DEMO_APPROVER_USER,
                          actedAt: nowIso(),
                          comments: comments?.trim() || null,
                        }
                      : step,
                  ),
                }
              : r,
          ),
        }))

        return getJournalDemoState().getJournal(journalId)!
      },

      sendBackJournal(journalId, comments) {
        const journal = getJournalDemoState().getJournal(journalId)
        if (!journal) throw new Error('Journal not found')

        patchJournalInDemo(journalId, { status: 'SENT_BACK', updatedAt: nowIso() })

        set((s) => ({
          requests: s.requests.map((r) =>
            r.documentId === journalId && r.status === 'PENDING'
              ? {
                  ...r,
                  status: 'SENT_BACK',
                  completedAt: nowIso(),
                  completedBy: DEMO_APPROVER_USER,
                  steps: (r.steps ?? []).map((step) =>
                    step.status === 'PENDING'
                      ? {
                          ...step,
                          status: 'SENT_BACK',
                          actedBy: DEMO_APPROVER_USER,
                          actedAt: nowIso(),
                          comments,
                        }
                      : step,
                  ),
                }
              : r,
          ),
        }))

        return getJournalDemoState().getJournal(journalId)!
      },

      rejectJournal(journalId, comments) {
        const journal = getJournalDemoState().getJournal(journalId)
        if (!journal) throw new Error('Journal not found')

        patchJournalInDemo(journalId, { status: 'REJECTED', updatedAt: nowIso() })

        set((s) => ({
          requests: s.requests.map((r) =>
            r.documentId === journalId && r.status === 'PENDING'
              ? {
                  ...r,
                  status: 'REJECTED',
                  completedAt: nowIso(),
                  completedBy: DEMO_APPROVER_USER,
                  steps: (r.steps ?? []).map((step) =>
                    step.status === 'PENDING'
                      ? {
                          ...step,
                          status: 'REJECTED',
                          actedBy: DEMO_APPROVER_USER,
                          actedAt: nowIso(),
                          comments,
                        }
                      : step,
                  ),
                }
              : r,
          ),
        }))

        return getJournalDemoState().getJournal(journalId)!
      },
    }),
    { name: 'fos-approval-demo' },
  ),
)

export function getApprovalDemoState() {
  return useApprovalDemoStore.getState()
}
