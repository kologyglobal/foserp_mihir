import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CreateJournalInput,
  Journal,
  JournalAuditEntry,
  JournalListFilters,
  JournalValidationReport,
  UpdateJournalInput,
} from '../types/journals'
import type { JournalLine } from '../types/journals'
import { getApprovalDemoState } from './approvalDemoStore'
import { hasFinancePermission } from '../utils/permissions/finance'
import { resolveLegalEntityId } from '../services/bridges/financeApiBridge'

function id() {
  return crypto.randomUUID()
}

function draftRef(journalId: string) {
  return `JRN-D-${journalId.slice(0, 8).toUpperCase()}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeLines(lines: CreateJournalInput['lines']) {
  return lines.map((line, index) => ({
    ...line,
    id: line.id ?? id(),
    lineNumber: index + 1,
    debitAmount: line.debitAmount || '0',
    creditAmount: line.creditAmount || '0',
    currencyCode: line.currencyCode ?? 'INR',
    exchangeRate: line.exchangeRate ?? '1',
  }))
}

function sumAmounts(lines: CreateJournalInput['lines'], field: 'debitAmount' | 'creditAmount') {
  return lines.reduce((acc: number, line: JournalLine) => acc + Number(line[field] || 0), 0).toFixed(4)
}

function validateDemoJournal(journal: Journal, mode: 'draft' | 'submit'): JournalValidationReport {
  const errors: JournalValidationReport['errors'] = []
  const warnings: JournalValidationReport['warnings'] = []

  if (journal.lines.length < 2) {
    errors.push({ code: 'INSUFFICIENT_LINES', message: 'At least two journal lines are required', field: 'lines' })
  }

  let totalDebit = 0
  let totalCredit = 0
  for (const line of journal.lines) {
    const debit = Number(line.debitAmount || 0)
    const credit = Number(line.creditAmount || 0)
    if (debit < 0 || credit < 0) errors.push({ code: 'NEGATIVE_AMOUNT', message: 'Amounts must not be negative' })
    if (debit > 0 && credit > 0) errors.push({ code: 'BOTH_DEBIT_CREDIT', message: 'Line cannot have both debit and credit' })
    totalDebit += debit
    totalCredit += credit
  }

  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    errors.push({ code: 'UNBALANCED', message: `Total debit (${totalDebit.toFixed(4)}) must equal total credit (${totalCredit.toFixed(4)})` })
  }

  const amount = Math.max(totalDebit, totalCredit)
  const approvalRequired = amount >= 10000

  if (mode === 'submit' && approvalRequired && amount >= 50000) {
    errors.push({
      code: 'JOURNAL_APPROVAL_BLOCKED',
      message: 'Journal amount exceeds approval limit and no matching approval rule is configured (demo)',
    })
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
      baseTotalDebit: totalDebit.toFixed(4),
      baseTotalCredit: totalCredit.toFixed(4),
      lineCount: journal.lines.length,
    },
    errors,
    warnings,
    approval: {
      required: approvalRequired,
      canSubmit: !(mode === 'submit' && approvalRequired && amount >= 50000),
      amount: amount.toFixed(4),
      levels: approvalRequired
        ? [{ level: 1, ruleId: 'demo-rule', ruleName: 'Demo large journal rule', approverRoleId: null, approverUserId: null }]
        : [],
      totalLevels: approvalRequired ? 1 : 0,
      matchedRuleName: approvalRequired ? 'Demo large journal rule' : null,
      approvalLevel: approvalRequired ? 1 : 0,
    },
  }
}

function allowedActions(journal: Journal): Journal['allowedActions'] {
  const editable = journal.status === 'DRAFT' || journal.status === 'SENT_BACK'
  const pending = journal.status === 'PENDING_APPROVAL'
  const canApprove = pending && hasFinancePermission('finance.voucher.approve')
  return {
    edit: editable,
    validate: true,
    submit: editable,
    cancel: editable,
    approve: canApprove,
    reject: canApprove,
    sendBack: canApprove,
    post: false,
    reverse: false,
  }
}

interface JournalDemoState {
  journals: Journal[]
  audit: Record<string, JournalAuditEntry[]>
  listJournals: (filters: JournalListFilters) => Journal[]
  getJournal: (id: string) => Journal | undefined
  createJournal: (input: CreateJournalInput) => Journal
  updateJournal: (id: string, input: UpdateJournalInput) => Journal
  validateJournal: (id: string) => JournalValidationReport
  submitJournal: (id: string) => Journal
  cancelJournal: (id: string, reason: string) => Journal
  getJournalAudit: (id: string) => JournalAuditEntry[]
}

export const useJournalDemoStore = create<JournalDemoState>()(
  persist(
    (set, get) => ({
      journals: [],
      audit: {},

      listJournals(filters) {
        let rows = get().journals.filter((j) => j.legalEntityId === filters.legalEntityId)
        if (filters.status) rows = rows.filter((j) => j.status === filters.status)
        if (filters.search) {
          const q = filters.search.toLowerCase()
          rows = rows.filter(
            (j) =>
              (j.referenceNumber ?? '').toLowerCase().includes(q) ||
              (j.narration ?? '').toLowerCase().includes(q) ||
              (j.externalReference ?? '').toLowerCase().includes(q),
          )
        }
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      },

      getJournal(id) {
        const journal = get().journals.find((j) => j.id === id)
        return journal ? { ...journal, allowedActions: allowedActions(journal) } : undefined
      },

      createJournal(input) {
        const journalId = id()
        const lines = normalizeLines(input.lines)
        const now = new Date().toISOString()
        const journal: Journal = {
          id: journalId,
          legalEntityId: input.legalEntityId,
          branchId: input.branchId ?? null,
          financialYearId: 'demo-fy',
          accountingPeriodId: 'demo-period',
          voucherType: 'JOURNAL',
          voucherNumber: null,
          status: 'DRAFT',
          documentDate: input.documentDate,
          postingDate: input.postingDate,
          referenceNumber: input.referenceNumber ?? draftRef(journalId),
          externalReference: input.externalReference ?? null,
          narration: input.narration ?? null,
          currencyCode: input.currencyCode ?? 'INR',
          exchangeRate: input.exchangeRate ?? '1',
          totalDebit: sumAmounts(lines, 'debitAmount'),
          totalCredit: sumAmounts(lines, 'creditAmount'),
          baseTotalDebit: sumAmounts(lines, 'debitAmount'),
          baseTotalCredit: sumAmounts(lines, 'creditAmount'),
          sourceModule: 'ACCOUNTING',
          sourceDocumentType: 'MANUAL_JOURNAL',
          approvalRequired: false,
          currentApprovalLevel: 0,
          createdAt: now,
          updatedAt: now,
          lines,
        }
        journal.allowedActions = allowedActions(journal)
        set((s) => ({
          journals: [journal, ...s.journals],
          audit: {
            ...s.audit,
            [journalId]: [{ id: id(), action: 'CREATE_DRAFT', createdAt: now }],
          },
        }))
        return journal
      },

      updateJournal(journalId, input) {
        const existing = get().journals.find((j) => j.id === journalId)
        if (!existing) throw new Error('Journal not found')
        if (existing.status !== 'DRAFT' && existing.status !== 'SENT_BACK') {
          throw new Error(`Journal in status ${existing.status} cannot be edited`)
        }
        const lines = normalizeLines(input.lines)
        const now = new Date().toISOString()
        const updated: Journal = {
          ...existing,
          branchId: input.branchId ?? existing.branchId,
          documentDate: input.documentDate ?? existing.documentDate,
          postingDate: input.postingDate ?? existing.postingDate,
          referenceNumber: input.referenceNumber ?? existing.referenceNumber,
          externalReference: input.externalReference ?? existing.externalReference,
          narration: input.narration ?? existing.narration,
          currencyCode: input.currencyCode ?? existing.currencyCode,
          exchangeRate: input.exchangeRate ?? existing.exchangeRate,
          totalDebit: sumAmounts(lines, 'debitAmount'),
          totalCredit: sumAmounts(lines, 'creditAmount'),
          baseTotalDebit: sumAmounts(lines, 'debitAmount'),
          baseTotalCredit: sumAmounts(lines, 'creditAmount'),
          lines,
          updatedAt: now,
        }
        updated.allowedActions = allowedActions(updated)
        set((s) => ({
          journals: s.journals.map((j) => (j.id === journalId ? updated : j)),
          audit: {
            ...s.audit,
            [journalId]: [...(s.audit[journalId] ?? []), { id: id(), action: 'UPDATE_DRAFT', createdAt: now }],
          },
        }))
        return updated
      },

      validateJournal(journalId) {
        const journal = get().journals.find((j) => j.id === journalId)
        if (!journal) throw new Error('Journal not found')
        return validateDemoJournal(journal, 'draft')
      },

      submitJournal(journalId) {
        const journal = get().journals.find((j) => j.id === journalId)
        if (!journal) throw new Error('Journal not found')
        if (journal.status !== 'DRAFT' && journal.status !== 'SENT_BACK') {
          throw new Error(`Journal in status ${journal.status} cannot be submitted`)
        }
        const report = validateDemoJournal(journal, 'submit')
        if (!report.valid) throw new Error(report.errors[0]?.message ?? 'Validation failed')
        if (!report.approval.canSubmit) throw new Error(report.approval.blockReason ?? 'Approval blocked')

        const now = new Date().toISOString()
        const updated: Journal = {
          ...journal,
          status: report.approval.required ? 'PENDING_APPROVAL' : 'APPROVED',
          approvalRequired: report.approval.required,
          currentApprovalLevel: report.approval.required ? report.approval.approvalLevel ?? 1 : 0,
          updatedAt: now,
          voucherNumber: null,
        }
        updated.allowedActions = allowedActions(updated)
        if (report.approval.required) {
          getApprovalDemoState().createOnSubmit(updated)
        }
        set((s) => ({
          journals: s.journals.map((j) => (j.id === journalId ? updated : j)),
          audit: {
            ...s.audit,
            [journalId]: [...(s.audit[journalId] ?? []), { id: id(), action: 'SUBMIT', createdAt: now }],
          },
        }))
        return updated
      },

      cancelJournal(journalId, reason) {
        if (!reason.trim()) throw new Error('Cancellation reason is required')
        const journal = get().journals.find((j) => j.id === journalId)
        if (!journal) throw new Error('Journal not found')
        if (journal.status !== 'DRAFT' && journal.status !== 'SENT_BACK') {
          throw new Error(`Journal in status ${journal.status} cannot be cancelled`)
        }
        const now = new Date().toISOString()
        const updated: Journal = {
          ...journal,
          status: 'CANCELLED',
          cancellationReason: reason.trim(),
          updatedAt: now,
        }
        updated.allowedActions = allowedActions(updated)
        set((s) => ({
          journals: s.journals.map((j) => (j.id === journalId ? updated : j)),
          audit: {
            ...s.audit,
            [journalId]: [...(s.audit[journalId] ?? []), { id: id(), action: 'CANCEL', createdAt: now }],
          },
        }))
        return updated
      },

      getJournalAudit(journalId) {
        return get().audit[journalId] ?? []
      },
    }),
    { name: 'fos-journal-demo' },
  ),
)

export function getJournalDemoState() {
  return useJournalDemoStore.getState()
}

export function patchJournalInDemo(id: string, patch: Partial<Journal>) {
  useJournalDemoStore.setState((s) => ({
    journals: s.journals.map((j) => {
      if (j.id !== id) return j
      const merged = { ...j, ...patch }
      return { ...merged, allowedActions: allowedActions(merged) }
    }),
  }))
}

export function demoListJournals(filters?: Partial<JournalListFilters>) {
  const leId = filters?.legalEntityId ?? resolveLegalEntityId()
  return getJournalDemoState().listJournals({ legalEntityId: leId, ...filters })
}

export function seedDemoJournalIfEmpty(legalEntityId: string) {
  const store = getJournalDemoState()
  if (store.journals.some((j) => j.legalEntityId === legalEntityId)) return
  store.createJournal({
    legalEntityId,
    documentDate: today(),
    postingDate: today(),
    narration: 'Demo opening adjustment',
    lines: [
      { accountId: 'demo-cash', debitAmount: '5000.0000', creditAmount: '0' },
      { accountId: 'demo-purchase', debitAmount: '0', creditAmount: '5000.0000' },
    ],
  })
}
