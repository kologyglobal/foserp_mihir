import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AccountingDimension,
  AccountingMockRole,
  AccountingPeriodSetup,
  BankReconciliationSession,
  BankStatementLine,
  CashBankAccountSummary,
  CostVarianceRow,
  GrniRow,
  GstSummaryRow,
  InventoryValuationRow,
  InvVsGlRow,
  LedgerAccount,
  LedgerEntry,
  OpenItemEntry,
  PeriodCloseChecklist,
  PeriodCloseTaskStatus,
  PostingSetupRule,
  ProductionOrderCostMock,
  TdsEntryRow,
  Voucher,
  VoucherLine,
  WipRow,
} from '../types/accounting'
import { buildAccountingSeed } from '../data/accounting/seed'
import {
  buildLedgerEntriesFromVoucher,
  genAccountingId,
  isVoucherBalanced,
  nextVoucherSequence,
  sumVoucherLines,
} from '../utils/accounting/ledgerEngine'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { getSessionUser } from '../utils/permissions'
import { VOUCHER_TYPE_PREFIX } from '../types/accounting'

type Result = { ok: boolean; error?: string; id?: string }

interface AccountingState {
  accounts: LedgerAccount[]
  vouchers: Voucher[]
  ledgerEntries: LedgerEntry[]
  receivables: OpenItemEntry[]
  payables: OpenItemEntry[]
  bankAccounts: CashBankAccountSummary[]
  bankStatementLines: BankStatementLine[]
  bankReconciliations: BankReconciliationSession[]
  inventoryValuation: InventoryValuationRow[]
  wip: WipRow[]
  costVariance: CostVarianceRow[]
  grni: GrniRow[]
  invVsGl: InvVsGlRow[]
  productionOrderCosts: ProductionOrderCostMock[]
  gstSummary: GstSummaryRow[]
  tdsEntries: TdsEntryRow[]
  periodCloseChecklists: PeriodCloseChecklist[]
  postingSetupRules: PostingSetupRule[]
  dimensions: AccountingDimension[]
  periods: AccountingPeriodSetup[]
  mockRole: AccountingMockRole

  setMockRole: (role: AccountingMockRole) => void

  getAccount: (id: string) => LedgerAccount | undefined
  getVoucher: (id: string) => Voucher | undefined
  getPostableAccounts: () => LedgerAccount[]

  createAccount: (input: Omit<LedgerAccount, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => Result
  updateAccount: (id: string, patch: Partial<LedgerAccount>) => Result
  setAccountActive: (id: string, isActive: boolean) => Result

  createVoucher: (input: {
    voucherType: Voucher['voucherType']
    voucherDate: string
    narration: string
    lines: Omit<VoucherLine, 'id' | 'lineNo'>[]
    referenceNo?: string
    bankAccountId?: string | null
    paymentMode?: Voucher['paymentMode']
    chequeNo?: string
    chequeDate?: string | null
    partyType?: Voucher['partyType']
    partyId?: string | null
    sourceDocument?: Voucher['sourceDocument']
  }) => Result
  updateVoucher: (
    id: string,
    patch: Partial<Pick<Voucher, 'voucherDate' | 'narration' | 'referenceNo' | 'bankAccountId' | 'paymentMode' | 'chequeNo' | 'chequeDate' | 'partyType' | 'partyId' | 'sourceDocument'>> & {
      lines?: Omit<VoucherLine, 'id' | 'lineNo'>[]
    },
  ) => Result
  deleteVoucher: (id: string) => Result
  submitVoucher: (id: string) => Result
  approveVoucher: (id: string) => Result
  rejectVoucher: (id: string, reason: string) => Result
  postVoucher: (id: string) => Result
  reverseVoucher: (id: string) => Result

  startBankReconciliation: (bankAccountId: string, statementDate: string) => Result
  matchReconciliation: (reconId: string, statementLineId: string, ledgerEntryId: string) => Result
  unmatchReconciliation: (reconId: string, statementLineId: string) => Result
  completeBankReconciliation: (reconId: string) => Result

  setPeriodCloseTaskStatus: (checklistId: string, taskId: string, status: PeriodCloseTaskStatus) => Result
  lockPeriodClose: (checklistId: string) => Result

  updatePostingSetupRule: (id: string, patch: Partial<PostingSetupRule>) => Result
  addDimensionValue: (dimensionId: string, name: string, code: string) => Result
  setAccountingPeriodStatus: (id: string, status: AccountingPeriodSetup['status']) => Result
}

function currentUserLabel(): string {
  return getSessionUser().name
}

export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => {
      const seed = buildAccountingSeed()

      return {
        accounts: seed.accounts,
        vouchers: seed.vouchers,
        ledgerEntries: seed.ledgerEntries,
        receivables: seed.receivables,
        payables: seed.payables,
        bankAccounts: seed.bankAccounts,
        bankStatementLines: seed.bankStatementLines,
        bankReconciliations: seed.bankReconciliations,
        inventoryValuation: seed.inventoryValuation,
        wip: seed.wip,
        costVariance: seed.costVariance,
        grni: seed.grni,
        invVsGl: seed.invVsGl,
        productionOrderCosts: seed.productionOrderCosts,
        gstSummary: seed.gstSummary,
        tdsEntries: seed.tdsEntries,
        periodCloseChecklists: [seed.periodCloseChecklist],
        postingSetupRules: seed.postingSetupRules,
        dimensions: seed.dimensions,
        periods: seed.periods,
        mockRole: 'finance-manager',

        setMockRole: (role) => set({ mockRole: role }),

        getAccount: (id) => get().accounts.find((a) => a.id === id),
        getVoucher: (id) => get().vouchers.find((v) => v.id === id),
        getPostableAccounts: () => get().accounts.filter((a) => a.isPostable && a.isActive),

        createAccount: (input) => {
          if (!input.code.trim() || !input.name.trim()) {
            return { ok: false, error: 'Account code and name are required.' }
          }
          if (get().accounts.some((a) => a.code === input.code.trim())) {
            return { ok: false, error: `Account code ${input.code} already exists.` }
          }
          const now = new Date().toISOString()
          const account: LedgerAccount = {
            ...input,
            id: genAccountingId('acc'),
            code: input.code.trim(),
            name: input.name.trim(),
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }
          set((s) => ({ accounts: [...s.accounts, account] }))
          return { ok: true, id: account.id }
        },

        updateAccount: (id, patch) => {
          const acc = get().accounts.find((a) => a.id === id)
          if (!acc) return { ok: false, error: 'Account not found.' }
          set((s) => ({
            accounts: s.accounts.map((a) =>
              a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
            ),
          }))
          return { ok: true, id }
        },

        setAccountActive: (id, isActive) => {
          const acc = get().accounts.find((a) => a.id === id)
          if (!acc) return { ok: false, error: 'Account not found.' }
          set((s) => ({
            accounts: s.accounts.map((a) => (a.id === id ? { ...a, isActive, updatedAt: new Date().toISOString() } : a)),
          }))
          return { ok: true, id }
        },

        createVoucher: (input) => {
          const lines: VoucherLine[] = input.lines.map((l, idx) => ({
            ...l,
            id: genAccountingId('vl'),
            lineNo: idx + 1,
          }))
          if (lines.length < 2) {
            return { ok: false, error: 'A voucher requires at least two lines.' }
          }
          if (input.voucherType === 'journal' && !isVoucherBalanced(lines)) {
            return { ok: false, error: 'Journal voucher must balance — total debit must equal total credit.' }
          }
          const { totalDebit, totalCredit } = sumVoucherLines(lines)
          const now = new Date().toISOString()
          const voucherNo = nextVoucherSequence(
            get().vouchers.map((v) => v.voucherNo),
            VOUCHER_TYPE_PREFIX[input.voucherType],
          )
          const voucher: Voucher = {
            id: genAccountingId('vch'),
            voucherNo,
            voucherType: input.voucherType,
            voucherDate: input.voucherDate,
            narration: input.narration,
            status: 'draft',
            lines,
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            sourceDocument: input.sourceDocument ?? null,
            referenceNo: input.referenceNo,
            bankAccountId: input.bankAccountId ?? null,
            paymentMode: input.paymentMode ?? null,
            chequeNo: input.chequeNo,
            chequeDate: input.chequeDate ?? null,
            partyType: input.partyType ?? null,
            partyId: input.partyId ?? null,
            createdBy: currentUserLabel(),
            createdAt: now,
            updatedAt: now,
            attachments: [],
          }
          set((s) => ({ vouchers: [...s.vouchers, voucher] }))
          return { ok: true, id: voucher.id }
        },

        updateVoucher: (id, patch) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status !== 'draft' && voucher.status !== 'rejected') {
            return { ok: false, error: 'Only draft or rejected vouchers can be edited. Posted vouchers are read-only — use Reverse.' }
          }
          let lines = voucher.lines
          if (patch.lines) {
            lines = patch.lines.map((l, idx) => ({ ...l, id: genAccountingId('vl'), lineNo: idx + 1 }))
            if (lines.length < 2) return { ok: false, error: 'A voucher requires at least two lines.' }
            if (voucher.voucherType === 'journal' && !isVoucherBalanced(lines)) {
              return { ok: false, error: 'Journal voucher must balance — total debit must equal total credit.' }
            }
          }
          const { totalDebit, totalCredit } = sumVoucherLines(lines)
          set((s) => ({
            vouchers: s.vouchers.map((v) =>
              v.id === id
                ? {
                    ...v,
                    ...patch,
                    lines,
                    totalDebit: Math.round(totalDebit * 100) / 100,
                    totalCredit: Math.round(totalCredit * 100) / 100,
                    status: 'draft',
                    rejectedReason: null,
                    updatedAt: new Date().toISOString(),
                  }
                : v,
            ),
          }))
          return { ok: true, id }
        },

        deleteVoucher: (id) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status === 'posted') {
            return { ok: false, error: 'Posted vouchers cannot be deleted. Use Reverse instead.' }
          }
          set((s) => ({ vouchers: s.vouchers.filter((v) => v.id !== id) }))
          return { ok: true, id }
        },

        submitVoucher: (id) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status !== 'draft' && voucher.status !== 'rejected') {
            return { ok: false, error: 'Only draft or rejected vouchers can be submitted for approval.' }
          }
          if (!isVoucherBalanced(voucher.lines)) {
            return { ok: false, error: 'Voucher is not balanced — total debit must equal total credit before submission.' }
          }
          set((s) => ({
            vouchers: s.vouchers.map((v) =>
              v.id === id ? { ...v, status: 'pending_approval', submittedAt: new Date().toISOString(), rejectedReason: null } : v,
            ),
          }))
          return { ok: true, id }
        },

        approveVoucher: (id) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status !== 'pending_approval') {
            return { ok: false, error: 'Only vouchers pending approval can be approved.' }
          }
          set((s) => ({
            vouchers: s.vouchers.map((v) =>
              v.id === id
                ? { ...v, status: 'approved', approvedBy: currentUserLabel(), approvedAt: new Date().toISOString() }
                : v,
            ),
          }))
          return { ok: true, id }
        },

        rejectVoucher: (id, reason) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status !== 'pending_approval') {
            return { ok: false, error: 'Only vouchers pending approval can be rejected.' }
          }
          set((s) => ({
            vouchers: s.vouchers.map((v) =>
              v.id === id ? { ...v, status: 'rejected', rejectedReason: reason } : v,
            ),
          }))
          return { ok: true, id }
        },

        postVoucher: (id) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status !== 'approved') {
            return { ok: false, error: 'Only approved vouchers can be posted.' }
          }
          if (!isVoucherBalanced(voucher.lines)) {
            return { ok: false, error: 'Voucher is not balanced — cannot post.' }
          }
          const postedVoucher: Voucher = {
            ...voucher,
            status: 'posted',
            postedBy: currentUserLabel(),
            postedAt: new Date().toISOString(),
          }
          const entries = buildLedgerEntriesFromVoucher(postedVoucher)
          set((s) => ({
            vouchers: s.vouchers.map((v) => (v.id === id ? postedVoucher : v)),
            ledgerEntries: [...s.ledgerEntries, ...entries],
          }))
          return { ok: true, id }
        },

        reverseVoucher: (id) => {
          const voucher = get().vouchers.find((v) => v.id === id)
          if (!voucher) return { ok: false, error: 'Voucher not found.' }
          if (voucher.status !== 'posted') {
            return { ok: false, error: 'Only posted vouchers can be reversed.' }
          }
          if (voucher.reversedByVoucherId) {
            return { ok: false, error: 'This voucher has already been reversed.' }
          }
          const now = new Date().toISOString()
          const reversalLines: VoucherLine[] = voucher.lines.map((l, idx) => ({
            ...l,
            id: genAccountingId('vl'),
            lineNo: idx + 1,
            debit: l.credit,
            credit: l.debit,
          }))
          const voucherNo = nextVoucherSequence(
            get().vouchers.map((v) => v.voucherNo),
            VOUCHER_TYPE_PREFIX[voucher.voucherType],
          )
          const reversal: Voucher = {
            ...voucher,
            id: genAccountingId('vch'),
            voucherNo,
            voucherDate: now.slice(0, 10),
            narration: `Reversal of ${voucher.voucherNo} — ${voucher.narration}`,
            status: 'posted',
            lines: reversalLines,
            createdBy: currentUserLabel(),
            createdAt: now,
            updatedAt: now,
            submittedAt: now,
            approvedBy: currentUserLabel(),
            approvedAt: now,
            postedBy: currentUserLabel(),
            postedAt: now,
            rejectedReason: null,
            reversedByVoucherId: null,
            reversalOfVoucherId: voucher.id,
            attachments: [],
          }
          const entries = buildLedgerEntriesFromVoucher(reversal)
          set((s) => ({
            vouchers: [
              ...s.vouchers.map((v) => (v.id === id ? { ...v, reversedByVoucherId: reversal.id } : v)),
              reversal,
            ],
            ledgerEntries: [...s.ledgerEntries, ...entries],
          }))
          return { ok: true, id: reversal.id }
        },

        startBankReconciliation: (bankAccountId, statementDate) => {
          const recon: BankReconciliationSession = {
            id: genAccountingId('recon'),
            bankAccountId,
            statementDate,
            openingBalanceBank: 0,
            closingBalanceBank: 0,
            openingBalanceBooks: 0,
            closingBalanceBooks: 0,
            status: 'in_progress',
            matches: [],
            completedAt: null,
            completedBy: null,
          }
          set((s) => ({ bankReconciliations: [...s.bankReconciliations, recon] }))
          return { ok: true, id: recon.id }
        },

        matchReconciliation: (reconId, statementLineId, ledgerEntryId) => {
          const recon = get().bankReconciliations.find((r) => r.id === reconId)
          if (!recon) return { ok: false, error: 'Reconciliation session not found.' }
          if (recon.status === 'completed') return { ok: false, error: 'This reconciliation is already completed.' }
          set((s) => ({
            bankReconciliations: s.bankReconciliations.map((r) =>
              r.id === reconId
                ? { ...r, matches: [...r.matches, { statementLineId, ledgerEntryId, matchedAt: new Date().toISOString() }] }
                : r,
            ),
            bankStatementLines: s.bankStatementLines.map((l) =>
              l.id === statementLineId ? { ...l, isMatched: true, matchedLedgerEntryId: ledgerEntryId } : l,
            ),
          }))
          return { ok: true, id: reconId }
        },

        unmatchReconciliation: (reconId, statementLineId) => {
          set((s) => ({
            bankReconciliations: s.bankReconciliations.map((r) =>
              r.id === reconId ? { ...r, matches: r.matches.filter((m) => m.statementLineId !== statementLineId) } : r,
            ),
            bankStatementLines: s.bankStatementLines.map((l) =>
              l.id === statementLineId ? { ...l, isMatched: false, matchedLedgerEntryId: null } : l,
            ),
          }))
          return { ok: true, id: reconId }
        },

        completeBankReconciliation: (reconId) => {
          const recon = get().bankReconciliations.find((r) => r.id === reconId)
          if (!recon) return { ok: false, error: 'Reconciliation session not found.' }
          const difference = Math.round((recon.closingBalanceBank - recon.closingBalanceBooks) * 100) / 100
          if (Math.abs(difference) > 0.005) {
            return { ok: false, error: `Cannot complete — difference of ₹${difference.toFixed(2)} must be resolved first.` }
          }
          set((s) => ({
            bankReconciliations: s.bankReconciliations.map((r) =>
              r.id === reconId
                ? { ...r, status: 'completed', completedAt: new Date().toISOString(), completedBy: currentUserLabel() }
                : r,
            ),
          }))
          return { ok: true, id: reconId }
        },

        setPeriodCloseTaskStatus: (checklistId, taskId, status) => {
          set((s) => ({
            periodCloseChecklists: s.periodCloseChecklists.map((c) =>
              c.id === checklistId
                ? {
                    ...c,
                    tasks: c.tasks.map((t) =>
                      t.id === taskId
                        ? { ...t, status, completedAt: status === 'done' ? new Date().toISOString() : null }
                        : t,
                    ),
                  }
                : c,
            ),
          }))
          return { ok: true, id: taskId }
        },

        lockPeriodClose: (checklistId) => {
          const checklist = get().periodCloseChecklists.find((c) => c.id === checklistId)
          if (!checklist) return { ok: false, error: 'Checklist not found.' }
          const incomplete = checklist.tasks.filter((t) => t.status !== 'done')
          if (incomplete.length > 0) {
            return { ok: false, error: `${incomplete.length} task(s) still open — complete all tasks before locking the period.` }
          }
          set((s) => ({
            periodCloseChecklists: s.periodCloseChecklists.map((c) => (c.id === checklistId ? { ...c, isLocked: true } : c)),
          }))
          return { ok: true, id: checklistId }
        },

        updatePostingSetupRule: (id, patch) => {
          set((s) => ({
            postingSetupRules: s.postingSetupRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          }))
          return { ok: true, id }
        },

        addDimensionValue: (dimensionId, name, code) => {
          if (!name.trim() || !code.trim()) return { ok: false, error: 'Name and code are required.' }
          const valueId = genAccountingId('dimval')
          set((s) => ({
            dimensions: s.dimensions.map((d) =>
              d.id === dimensionId
                ? { ...d, values: [...d.values, { id: valueId, code: code.trim(), name: name.trim(), isActive: true }] }
                : d,
            ),
          }))
          return { ok: true, id: valueId }
        },

        setAccountingPeriodStatus: (id, status) => {
          set((s) => ({
            periods: s.periods.map((p) => (p.id === id ? { ...p, status } : p)),
          }))
          return { ok: true, id }
        },
      }
    },
    {
      name: ERP_STORAGE_KEYS.accounting,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)
