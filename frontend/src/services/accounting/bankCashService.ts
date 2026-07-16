/**
 * Bank & Cash Management mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT post real GL, execute bank payments, or import live bank feeds.
 *
 * SECURITY: All reads/writes/exports must also be enforced by the future backend
 * (tenant isolation + accounting.bank_cash.* permissions). UI gating alone is not security.
 */

import {
  seedBankAccounts,
  seedBankCashAudit,
  seedBankCashSetup,
  seedBankCashTransactions,
  seedBankDeposits,
  seedBankStatementLines,
  seedBankStatements,
  seedCashAccounts,
  seedCashCounts,
  seedCheques,
  seedFundTransfers,
  seedReconciliations,
} from '../../data/accounting/bankCashSeed'
import type {
  AutoMatchPreview,
  BankAccount,
  BankCashAuditEntry,
  BankCashDashboardData,
  BankCashExportRequest,
  BankCashFilter,
  BankCashLookups,
  BankCashPrintPreview,
  BankCashReportCard,
  BankCashSetup,
  BankCashTransaction,
  BankDeposit,
  BankDepositInput,
  BankStatement,
  BankStatementLine,
  CashAccount,
  CashBookEntry,
  CashCount,
  CashCountInput,
  Cheque,
  ChequeStatus,
  FundTransfer,
  FundTransferInput,
  FundTransferStatus,
  ManualMatchInput,
  Reconciliation,
  ReconciliationDraftPayload,
  StatementImportPreview,
  StatementImportPreviewRow,
} from '../../types/bankCash'
import { DEFAULT_BANK_CASH_FILTER } from '../../types/bankCash'
import { getSessionUser } from '../../utils/permissions'

export { DEFAULT_BANK_CASH_FILTER }

export class BankCashServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BankCashServiceError'
  }
}

const COMPANY_NAME = 'Vasant Trailers Pvt Ltd'
const delay = () => new Promise((r) => setTimeout(r, 80 + Math.floor(Math.random() * 70)))

let bankAccountsStore = seedBankAccounts()
let cashAccountsStore = seedCashAccounts()
let transactionsStore = seedBankCashTransactions()
let fundTransfersStore = seedFundTransfers()
let statementsStore = seedBankStatements()
let statementLinesStore = seedBankStatementLines()
let reconciliationsStore = seedReconciliations()
let chequesStore = seedCheques()
let depositsStore = seedBankDeposits()
let cashCountsStore = seedCashCounts()
let setupStore = seedBankCashSetup()
let auditStore = seedBankCashAudit()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function pushAudit(entityType: string, entityId: string, action: string, details: string) {
  const user = getSessionUser()
  auditStore = [
    {
      id: `bca-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entityType,
      entityId,
      action,
      details,
      performedBy: user.name,
      performedAt: new Date().toISOString(),
      isDemo: true,
    },
    ...auditStore,
  ]
}

function matchSearch(blob: string, q: string): boolean {
  return !q || blob.toLowerCase().includes(q.toLowerCase())
}

function inDateRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function applyTxnFilter(list: BankCashTransaction[], filter: Partial<BankCashFilter>): BankCashTransaction[] {
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return list.filter((t) => {
    if (f.search) {
      const blob = `${t.transactionNumber} ${t.accountName} ${t.counterpartyName ?? ''} ${t.reference} ${t.narration}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.bankAccountId && t.bankAccountId !== f.bankAccountId) return false
    if (f.cashAccountId && t.cashAccountId !== f.cashAccountId) return false
    if (f.accountKind === 'bank' && t.accountKind !== 'bank') return false
    if (f.accountKind === 'cash' && t.accountKind !== 'cash') return false
    if (f.transactionType && t.transactionType !== f.transactionType) return false
    if (f.transferMode && t.transferMode !== f.transferMode) return false
    if (f.currency && t.currency !== f.currency) return false
    if (f.isReconciled === 'yes' && !t.isReconciled) return false
    if (f.isReconciled === 'no' && t.isReconciled) return false
    if (!inDateRange(t.transactionDate, f.dateFrom, f.dateTo)) return false
    const amt = Math.max(t.debitAmount, t.creditAmount)
    if (f.amountMin != null && amt < f.amountMin) return false
    if (f.amountMax != null && amt > f.amountMax) return false
    return true
  })
}

function accountLabel(kind: 'bank' | 'cash', bankId: string | null, cashId: string | null): string {
  if (kind === 'bank' && bankId) return bankAccountsStore.find((b) => b.id === bankId)?.name ?? bankId
  if (kind === 'cash' && cashId) return cashAccountsStore.find((c) => c.id === cashId)?.name ?? cashId
  return 'Unknown'
}

function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear()
  const nums = existing
    .map((n) => {
      const m = n.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`))
      return m && Number(m[1]) === year ? Number(m[2]) : 0
    })
    .filter((n) => n > 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}-${year}-${String(next).padStart(5, '0')}`
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function buildBankBalanceTrend(): Array<{ month: string; balance: number }> {
  const months = [
    { key: '2026-01', label: 'Jan 2026', balance: 7_820_000 },
    { key: '2026-02', label: 'Feb 2026', balance: 7_450_000 },
    { key: '2026-03', label: 'Mar 2026', balance: 8_120_000 },
    { key: '2026-04', label: 'Apr 2026', balance: 8_540_000 },
    { key: '2026-05', label: 'May 2026', balance: 9_180_000 },
    { key: '2026-06', label: 'Jun 2026', balance: 8_960_000 },
    { key: '2026-07', label: 'Jul 2026', balance: 0 },
  ]
  const currentTotal = bankAccountsStore.reduce(
    (s, b) => s + (b.currency === 'INR' ? b.bookBalance : b.bookBalance * 83.25),
    0,
  )
  months[months.length - 1].balance = Math.round(currentTotal)
  return months.map(({ label, balance }) => ({ month: label, balance }))
}

function buildCashMovementTrend(): Array<{ month: string; receipts: number; payments: number }> {
  const monthLabels = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026']
  const buckets = new Map<string, { receipts: number; payments: number }>()
  monthLabels.forEach((m) => buckets.set(m, { receipts: 0, payments: 0 }))

  transactionsStore
    .filter((t) => t.accountKind === 'cash')
    .forEach((t) => {
      const d = new Date(`${t.transactionDate}T00:00:00`)
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
      const bucket = buckets.get(label)
      if (!bucket) return
      bucket.receipts += t.debitAmount
      bucket.payments += t.creditAmount
    })

  return monthLabels.map((month) => {
    const b = buckets.get(month) ?? { receipts: 0, payments: 0 }
    return { month, receipts: b.receipts, payments: b.payments }
  })
}

function countOverdueReconciliations(): number {
  const asOf = new Date('2026-07-16T00:00:00')
  return bankAccountsStore.filter((b) => {
    if (b.reconciliationStatus === 'Completed' && b.lastReconciledDate) {
      const last = new Date(`${b.lastReconciledDate}T00:00:00`)
      const days = Math.floor((asOf.getTime() - last.getTime()) / 86_400_000)
      const threshold = b.reconciliationFrequency === 'Daily' ? 1 : b.reconciliationFrequency === 'Weekly' ? 7 : 31
      return days > threshold
    }
    return b.reconciliationStatus === 'Not Started' || b.reconciliationStatus === 'Draft'
  }).length
}

export async function getBankCashDashboard(): Promise<BankCashDashboardData> {
  await delay()
  const totalBankBalance = bankAccountsStore.reduce((s, b) => s + (b.currency === 'INR' ? b.bookBalance : b.bookBalance * 83.25), 0)
  const totalCashBalance = cashAccountsStore.reduce((s, c) => s + c.bookBalance, 0)
  const unreconciledBankAmount = bankAccountsStore.reduce((s, b) => s + Math.abs(b.unreconciledAmount), 0)
  const unreconciledTransactionCount = transactionsStore.filter((t) => t.accountKind === 'bank' && !t.isReconciled).length
  const paymentsInTransit = bankAccountsStore.reduce((s, b) => s + b.paymentsInTransit, 0)
  const depositsInTransit = bankAccountsStore.reduce((s, b) => s + b.depositsInTransit, 0)
  const pendingFundTransfers = fundTransfersStore.filter((f) => ['Draft', 'Pending Approval', 'Approved', 'In Process'].includes(f.status)).length
  const pendingCheques = chequesStore.filter((c) => ['Issued', 'Deposited', 'PDC'].includes(c.status)).length
  const chequesPendingClearance = chequesStore.filter((c) => c.status === 'Deposited').length
  const openReconciliations = reconciliationsStore.filter((r) => r.status === 'Draft' || r.status === 'In Progress').length
  const cashVarianceAmount = cashAccountsStore.reduce((s, c) => s + Math.abs(c.variance), 0)

  const reconciledAccounts = bankAccountsStore.filter((b) => b.reconciliationStatus === 'Completed').length
  const pendingAccounts = bankAccountsStore.filter((b) => b.reconciliationStatus === 'Not Started' || b.reconciliationStatus === 'Draft').length
  const partiallyReconciledAccounts = bankAccountsStore.filter((b) => b.reconciliationStatus === 'In Progress' || b.reconciliationStatus === 'Reopened').length
  const reconciliationDifference = Math.round(unreconciledBankAmount)
  const overdueReconciliations = countOverdueReconciliations()

  const recentTransactions = [...transactionsStore]
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, 8)

  const upcomingCheques = chequesStore
    .filter((c) => c.status === 'PDC' || c.status === 'Issued')
    .sort((a, b) => (a.pdcDate ?? a.chequeDate).localeCompare(b.pdcDate ?? b.chequeDate))
    .slice(0, 5)

  const pendingActions: BankCashDashboardData['pendingActions'] = []
  if (openReconciliations > 0) {
    pendingActions.push({
      id: 'pa-recon',
      label: 'Complete bank reconciliations',
      count: openReconciliations,
      href: '/accounting/bank-cash/reconciliation',
      severity: 'warning',
    })
  }
  if (pendingFundTransfers > 0) {
    pendingActions.push({
      id: 'pa-transfer',
      label: 'Approve fund transfers',
      count: pendingFundTransfers,
      href: '/accounting/bank-cash/transfers',
      severity: 'info',
    })
  }
  const submittedCounts = cashCountsStore.filter((c) => c.status === 'Submitted').length
  if (submittedCounts > 0) {
    pendingActions.push({
      id: 'pa-cash-count',
      label: 'Review cash count variances',
      count: submittedCounts,
      href: '/accounting/bank-cash/cash-counts',
      severity: 'critical',
    })
  }
  if (chequesPendingClearance > 0) {
    pendingActions.push({
      id: 'pa-cheques',
      label: 'Cheques pending clearance',
      count: chequesPendingClearance,
      href: '/accounting/bank-cash/cheques',
      severity: 'info',
    })
  }
  const draftDeposits = depositsStore.filter((d) => d.status === 'Draft' || d.status === 'Pending').length
  if (draftDeposits > 0) {
    pendingActions.push({
      id: 'pa-deposits',
      label: 'Pending bank deposits',
      count: draftDeposits,
      href: '/accounting/bank-cash/deposits',
      severity: 'warning',
    })
  }

  const alerts: BankCashDashboardData['alerts'] = []
  if (openReconciliations > 0) {
    alerts.push({ id: 'alert-recon', severity: 'warning', message: `${openReconciliations} bank reconciliation(s) pending completion`, href: '/accounting/bank-cash/reconciliation' })
  }
  if (cashVarianceAmount > 0) {
    alerts.push({ id: 'alert-cash', severity: 'critical', message: `Cash variance of ₹${cashVarianceAmount.toLocaleString('en-IN')} across accounts` })
  }
  const bounced = chequesStore.filter((c) => c.status === 'Bounced').length
  if (bounced > 0) {
    alerts.push({ id: 'alert-chq', severity: 'warning', message: `${bounced} bounced cheque(s) require follow-up`, href: '/accounting/bank-cash/cheques' })
  }
  if (overdueReconciliations > 0) {
    alerts.push({ id: 'alert-overdue', severity: 'warning', message: `${overdueReconciliations} bank account(s) have overdue reconciliation`, href: '/accounting/bank-cash/reconciliation' })
  }

  return {
    asOfDate: '2026-07-16',
    companyName: COMPANY_NAME,
    totalBankBalance: Math.round(totalBankBalance),
    totalCashBalance,
    totalAvailableBalance: Math.round(totalBankBalance + totalCashBalance - paymentsInTransit),
    unreconciledBankAmount: Math.round(unreconciledBankAmount),
    unreconciledTransactionCount,
    paymentsInTransit,
    depositsInTransit,
    chequesPendingClearance,
    pendingFundTransfers,
    pendingCheques,
    openReconciliations,
    cashVarianceAmount,
    reconciliationSummary: {
      reconciled: reconciledAccounts,
      pending: pendingAccounts,
      partiallyReconciled: partiallyReconciledAccounts,
      difference: reconciliationDifference,
      overdue: overdueReconciliations,
    },
    pendingActions,
    bankAccounts: bankAccountsStore.map((b) => ({
      id: b.id,
      name: b.name,
      bankName: b.bankName,
      bookBalance: b.bookBalance,
      statementBalance: b.statementBalance,
      availableBalance: b.availableBalance,
      unreconciledAmount: b.unreconciledAmount,
      lastReconciledDate: b.lastReconciledDate,
      reconciliationStatus: b.reconciliationStatus,
      status: b.status,
    })),
    cashAccounts: cashAccountsStore.map((c) => ({
      id: c.id,
      name: c.name,
      bookBalance: c.bookBalance,
      physicalBalance: c.physicalBalance,
      variance: c.variance,
      lastCountDate: c.lastCountDate,
      custodian: c.custodian,
      location: c.location,
      status: c.status,
    })),
    recentTransactions: clone(recentTransactions),
    upcomingCheques: clone(upcomingCheques),
    bankBalanceTrend: buildBankBalanceTrend(),
    cashMovementTrend: buildCashMovementTrend(),
    alerts,
  }
}

// ─── Bank accounts ────────────────────────────────────────────────────────────

export async function getBankAccounts(filter?: Partial<BankCashFilter>): Promise<BankAccount[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    bankAccountsStore.filter((b) => {
      if (f.search && !matchSearch(`${b.code} ${b.name} ${b.bankName} ${b.ifsc}`, f.search)) return false
      if (f.bankAccountId && b.id !== f.bankAccountId) return false
      if (f.location && b.location !== f.location) return false
      if (f.currency && b.currency !== f.currency) return false
      if (f.reconciliationStatus && b.reconciliationStatus !== f.reconciliationStatus) return false
      return true
    }),
  )
}

export async function getBankAccountById(id: string): Promise<BankAccount | null> {
  await delay()
  const row = bankAccountsStore.find((b) => b.id === id)
  return row ? clone(row) : null
}

export async function createBankAccountDemo(partial: Partial<BankAccount>): Promise<BankAccount> {
  await delay()
  const last4 = partial.accountNumberLast4 ?? String(Math.floor(1000 + Math.random() * 9000))
  const row: BankAccount = {
    id: `bacc-${Date.now()}`,
    code: partial.code ?? nextNumber('BNK', bankAccountsStore.map((b) => b.code)),
    name: partial.name ?? 'New Bank Account',
    bankName: partial.bankName ?? 'HDFC Bank',
    branch: partial.branch ?? 'Pune',
    ifsc: partial.ifsc ?? 'HDFC0000000',
    swiftCode: partial.swiftCode ?? null,
    accountNumberMasked: partial.accountNumberMasked ?? `XXXX XXXX ${last4}`,
    accountNumberLast4: last4,
    accountType: partial.accountType ?? 'Current Account',
    currency: partial.currency ?? 'INR',
    bookBalance: partial.bookBalance ?? 0,
    statementBalance: partial.statementBalance ?? 0,
    availableBalance: partial.availableBalance ?? 0,
    unreconciledAmount: partial.unreconciledAmount ?? 0,
    paymentsInTransit: partial.paymentsInTransit ?? 0,
    depositsInTransit: partial.depositsInTransit ?? 0,
    overdraftLimit: partial.overdraftLimit ?? null,
    minimumBalance: partial.minimumBalance ?? null,
    lastReconciledDate: null,
    lastStatementDate: null,
    lastTransactionDate: null,
    status: partial.status ?? 'Active',
    reconciliationStatus: 'Not Started',
    ledgerAccountId: partial.ledgerAccountId ?? 'coa-1199',
    bankChargesAccountId: partial.bankChargesAccountId ?? 'coa-5210',
    interestIncomeAccountId: partial.interestIncomeAccountId ?? 'coa-4210',
    interestExpenseAccountId: partial.interestExpenseAccountId ?? 'coa-5310',
    suspenseAccountId: partial.suspenseAccountId ?? 'coa-1199',
    exchangeGainAccountId: partial.exchangeGainAccountId ?? null,
    exchangeLossAccountId: partial.exchangeLossAccountId ?? null,
    purpose: partial.purpose ?? '',
    reconciliationFrequency: partial.reconciliationFrequency ?? 'Monthly',
    custodian: partial.custodian ?? getSessionUser().name,
    isPaymentAccount: partial.isPaymentAccount ?? false,
    isCollectionAccount: partial.isCollectionAccount ?? false,
    location: partial.location ?? 'Head Office — Pune',
    company: COMPANY_NAME,
    createdBy: getSessionUser().name,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  }
  bankAccountsStore = [row, ...bankAccountsStore]
  pushAudit('BankAccount', row.id, 'Create', `Created bank account ${row.code}`)
  return clone(row)
}

export async function updateBankAccountDemo(id: string, patch: Partial<BankAccount>): Promise<BankAccount> {
  await delay()
  const idx = bankAccountsStore.findIndex((b) => b.id === id)
  if (idx < 0) throw new BankCashServiceError('Bank account not found')
  bankAccountsStore[idx] = { ...bankAccountsStore[idx], ...patch, modifiedAt: new Date().toISOString() }
  pushAudit('BankAccount', id, 'Update', `Updated bank account ${bankAccountsStore[idx].code}`)
  return clone(bankAccountsStore[idx])
}

export async function deactivateBankAccountDemo(id: string): Promise<BankAccount> {
  return updateBankAccountDemo(id, { status: 'Inactive' })
}

// ─── Cash accounts ──────────────────────────────────────────────────────────────

export async function getCashAccounts(filter?: Partial<BankCashFilter>): Promise<CashAccount[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    cashAccountsStore.filter((c) => {
      if (f.search && !matchSearch(`${c.code} ${c.name} ${c.location}`, f.search)) return false
      if (f.cashAccountId && c.id !== f.cashAccountId) return false
      if (f.location && c.location !== f.location) return false
      return true
    }),
  )
}

export async function getCashAccountById(id: string): Promise<CashAccount | null> {
  await delay()
  const row = cashAccountsStore.find((c) => c.id === id)
  return row ? clone(row) : null
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getBankCashTransactions(filter?: Partial<BankCashFilter>): Promise<BankCashTransaction[]> {
  await delay()
  return clone(applyTxnFilter(transactionsStore, filter ?? {}))
}

// ─── Fund transfers ─────────────────────────────────────────────────────────────

export async function getFundTransfers(filter?: Partial<BankCashFilter>): Promise<FundTransfer[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    fundTransfersStore.filter((t) => {
      if (f.search && !matchSearch(`${t.transferNumber} ${t.fromAccountName} ${t.toAccountName} ${t.reference}`, f.search)) return false
      if (f.transferStatus && t.status !== f.transferStatus) return false
      if (f.transferMode && t.transferMode !== f.transferMode) return false
      if (f.bankAccountId && t.fromBankAccountId !== f.bankAccountId && t.toBankAccountId !== f.bankAccountId) return false
      if (f.cashAccountId && t.fromCashAccountId !== f.cashAccountId && t.toCashAccountId !== f.cashAccountId) return false
      if (!inDateRange(t.transferDate, f.dateFrom, f.dateTo)) return false
      return true
    }),
  )
}

export async function getFundTransferById(id: string): Promise<FundTransfer | null> {
  await delay()
  const row = fundTransfersStore.find((f) => f.id === id)
  return row ? clone(row) : null
}

export async function createFundTransfer(input: FundTransferInput): Promise<FundTransfer> {
  await delay()
  const num = nextNumber('FTR', fundTransfersStore.map((f) => f.transferNumber))
  const row: FundTransfer = {
    id: `ftr-${Date.now()}`,
    transferNumber: num,
    transferDate: input.transferDate,
    valueDate: input.valueDate,
    transferType: input.transferType,
    transferMode: input.transferMode,
    status: 'Draft',
    fromAccountKind: input.fromAccountKind,
    fromBankAccountId: input.fromBankAccountId,
    fromCashAccountId: input.fromCashAccountId,
    fromAccountName: accountLabel(input.fromAccountKind, input.fromBankAccountId, input.fromCashAccountId),
    toAccountKind: input.toAccountKind,
    toBankAccountId: input.toBankAccountId,
    toCashAccountId: input.toCashAccountId,
    toAccountName: accountLabel(input.toAccountKind, input.toBankAccountId, input.toCashAccountId),
    amount: input.amount,
    currency: input.currency,
    exchangeRate: null,
    charges: input.charges,
    narration: input.narration,
    reference: input.reference,
    utrNumber: null,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    completedAt: null,
    createdBy: getSessionUser().name,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  }
  fundTransfersStore = [row, ...fundTransfersStore]
  pushAudit('FundTransfer', row.id, 'Create', `Created fund transfer ${row.transferNumber}`)
  return clone(row)
}

export async function updateFundTransfer(id: string, input: Partial<FundTransferInput>): Promise<FundTransfer> {
  await delay()
  const idx = fundTransfersStore.findIndex((f) => f.id === id)
  if (idx < 0) throw new BankCashServiceError('Fund transfer not found')
  const cur = fundTransfersStore[idx]
  if (cur.status !== 'Draft') throw new BankCashServiceError('Only draft transfers can be edited')
  const merged = { ...cur, ...input, modifiedAt: new Date().toISOString() }
  if (input.fromAccountKind || input.fromBankAccountId !== undefined || input.fromCashAccountId !== undefined) {
    merged.fromAccountName = accountLabel(merged.fromAccountKind, merged.fromBankAccountId, merged.fromCashAccountId)
  }
  if (input.toAccountKind || input.toBankAccountId !== undefined || input.toCashAccountId !== undefined) {
    merged.toAccountName = accountLabel(merged.toAccountKind, merged.toBankAccountId, merged.toCashAccountId)
  }
  fundTransfersStore[idx] = merged
  pushAudit('FundTransfer', id, 'Update', `Updated fund transfer ${merged.transferNumber}`)
  return clone(merged)
}

function setTransferStatus(id: string, status: FundTransferStatus, extra: Partial<FundTransfer> = {}): FundTransfer {
  const idx = fundTransfersStore.findIndex((f) => f.id === id)
  if (idx < 0) throw new BankCashServiceError('Fund transfer not found')
  fundTransfersStore[idx] = { ...fundTransfersStore[idx], status, ...extra, modifiedAt: new Date().toISOString() }
  return fundTransfersStore[idx]
}

export async function submitFundTransfer(id: string): Promise<FundTransfer> {
  await delay()
  const user = getSessionUser().name
  const row = setTransferStatus(id, 'Pending Approval', { submittedBy: user, submittedAt: new Date().toISOString() })
  pushAudit('FundTransfer', id, 'Submit', `Submitted ${row.transferNumber}`)
  return clone(row)
}

export async function approveFundTransfer(id: string): Promise<FundTransfer> {
  await delay()
  const user = getSessionUser().name
  const row = setTransferStatus(id, 'Approved', { approvedBy: user, approvedAt: new Date().toISOString() })
  pushAudit('FundTransfer', id, 'Approve', `Approved ${row.transferNumber}`)
  return clone(row)
}

export async function rejectFundTransfer(id: string, reason: string): Promise<FundTransfer> {
  await delay()
  const user = getSessionUser().name
  const row = setTransferStatus(id, 'Rejected', {
    rejectedBy: user,
    rejectedAt: new Date().toISOString(),
    rejectionReason: reason,
  })
  pushAudit('FundTransfer', id, 'Reject', `Rejected ${row.transferNumber}: ${reason}`)
  return clone(row)
}

export async function completeFundTransferDemo(id: string): Promise<FundTransfer> {
  await delay()
  const cur = fundTransfersStore.find((f) => f.id === id)
  if (!cur) throw new BankCashServiceError('Fund transfer not found')
  if (!['Approved', 'In Process'].includes(cur.status)) {
    throw new BankCashServiceError('Transfer must be approved or in process before completion')
  }
  const row = setTransferStatus(id, 'Completed', { completedAt: new Date().toISOString() })
  pushAudit('FundTransfer', id, 'Complete', `Completed ${row.transferNumber}`)
  return clone(row)
}

export async function reverseFundTransferDemo(id: string): Promise<FundTransfer> {
  await delay()
  const cur = fundTransfersStore.find((f) => f.id === id)
  if (!cur) throw new BankCashServiceError('Fund transfer not found')
  if (cur.status !== 'Completed') throw new BankCashServiceError('Only completed transfers can be reversed')
  const row = setTransferStatus(id, 'Reversed')
  pushAudit('FundTransfer', id, 'Reverse', `Reversed ${row.transferNumber}`)
  return clone(row)
}

// ─── Bank statements ────────────────────────────────────────────────────────────

export async function getBankStatements(filter?: Partial<BankCashFilter>): Promise<BankStatement[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    statementsStore.filter((s) => {
      if (f.bankAccountId && s.bankAccountId !== f.bankAccountId) return false
      if (f.search && !matchSearch(`${s.statementNumber} ${s.fileName ?? ''}`, f.search)) return false
      return true
    }),
  )
}

export async function getBankStatementById(id: string): Promise<{ statement: BankStatement; lines: BankStatementLine[] } | null> {
  await delay()
  const statement = statementsStore.find((s) => s.id === id)
  if (!statement) return null
  const lines = statementLinesStore.filter((l) => l.statementId === id)
  return { statement: clone(statement), lines: clone(lines) }
}

export async function validateBankStatementImport(
  fileName: string,
  csvText: string,
  bankAccountId: string,
): Promise<StatementImportPreview> {
  await delay()
  const bank = bankAccountsStore.find((b) => b.id === bankAccountId)
  if (!bank) throw new BankCashServiceError('Bank account not found')

  const lines = csvText.trim().split(/\r?\n/).filter(Boolean)
  const rows: StatementImportPreviewRow[] = []
  const seenRefs = new Set<string>()

  let totalDebits = 0
  let totalCredits = 0
  let valid = 0
  let warnings = 0
  let errors = 0
  let duplicates = 0

  const dataLines = lines.length > 1 && /date|description/i.test(lines[0]) ? lines.slice(1) : lines

  dataLines.forEach((line, idx) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''))
    const rowNumber = idx + 1
    const lineDate = parts[0] ?? ''
    const valueDate = parts[1] ?? lineDate
    const description = parts[2] ?? ''
    const reference = parts[3] ?? ''
    const debitAmount = Number(parts[4] ?? 0) || 0
    const creditAmount = Number(parts[5] ?? 0) || 0
    const balance = parts[6] != null && parts[6] !== '' ? Number(parts[6]) : null

    let status: StatementImportPreviewRow['status'] = 'Valid'
    let message: string | null = null

    if (!lineDate || Number.isNaN(Date.parse(lineDate))) {
      status = 'Error'
      message = 'Invalid or missing date'
      errors++
    } else if (debitAmount < 0 || creditAmount < 0) {
      status = 'Error'
      message = 'Negative amounts not allowed'
      errors++
    } else if (debitAmount === 0 && creditAmount === 0) {
      status = 'Error'
      message = 'Both debit and credit are zero'
      errors++
    } else if (!reference) {
      status = 'Warning'
      message = 'Missing reference number'
      warnings++
      valid++
    } else if (seenRefs.has(reference)) {
      status = 'Duplicate'
      message = 'Duplicate reference in file'
      duplicates++
    } else {
      seenRefs.add(reference)
      valid++
    }

    if (status !== 'Error') {
      totalDebits += debitAmount
      totalCredits += creditAmount
    }

    rows.push({
      rowNumber,
      lineDate,
      valueDate,
      description,
      reference,
      debitAmount,
      creditAmount,
      balance,
      status,
      message,
    })
  })

  const dates = rows.filter((r) => r.status !== 'Error').map((r) => r.lineDate).sort()

  return {
    fileName,
    bankAccountId,
    bankAccountName: bank.name,
    periodFrom: dates[0] ?? null,
    periodTo: dates[dates.length - 1] ?? null,
    openingBalance: null,
    closingBalance: rows.length ? rows[rows.length - 1].balance : null,
    totalDebits,
    totalCredits,
    validRowCount: valid,
    warningRowCount: warnings,
    errorRowCount: errors,
    duplicateRowCount: duplicates,
    rows,
    canImport: errors === 0 && valid > 0,
  }
}

export async function importBankStatementDemo(preview: StatementImportPreview): Promise<BankStatement> {
  await delay()
  if (!preview.canImport) throw new BankCashServiceError('Import preview has validation errors')

  const stmtId = `bstmt-${Date.now()}`
  const num = nextNumber('STMT', statementsStore.map((s) => s.statementNumber))
  const validRows = preview.rows.filter((r) => r.status === 'Valid' || r.status === 'Warning')

  const statement: BankStatement = {
    id: stmtId,
    statementNumber: num,
    bankAccountId: preview.bankAccountId,
    bankAccountName: preview.bankAccountName,
    periodFrom: preview.periodFrom ?? validRows[0]?.lineDate ?? '',
    periodTo: preview.periodTo ?? validRows[validRows.length - 1]?.lineDate ?? '',
    openingBalance: preview.openingBalance ?? 0,
    closingBalance: preview.closingBalance ?? 0,
    totalDebits: preview.totalDebits,
    totalCredits: preview.totalCredits,
    lineCount: validRows.length,
    importedAt: new Date().toISOString(),
    importedBy: getSessionUser().name,
    fileName: preview.fileName,
    status: preview.duplicateRowCount > 0 ? 'With Errors' : 'Imported',
    errorCount: preview.errorRowCount,
    duplicateCount: preview.duplicateRowCount,
    matchedCount: 0,
    unmatchedCount: validRows.length,
    createdAt: new Date().toISOString(),
  }

  const newLines: BankStatementLine[] = validRows.map((r, i) => ({
    id: `bsl-${stmtId}-${i}`,
    statementId: stmtId,
    lineDate: r.lineDate,
    valueDate: r.valueDate,
    description: r.description,
    reference: r.reference,
    debitAmount: r.debitAmount,
    creditAmount: r.creditAmount,
    balance: r.balance ?? 0,
    matchStatus: r.status === 'Duplicate' ? 'Duplicate' : 'Unmatched',
    reconciliationId: null,
    matchedBookLineId: null,
    isDuplicate: r.status === 'Duplicate',
    validationMessage: r.message,
  }))

  statementsStore = [statement, ...statementsStore]
  statementLinesStore = [...newLines, ...statementLinesStore]
  pushAudit('BankStatement', stmtId, 'Import', `Imported ${preview.fileName} — ${validRows.length} lines`)
  return clone(statement)
}

// ─── Reconciliation ─────────────────────────────────────────────────────────────

export async function getReconciliations(filter?: Partial<BankCashFilter>): Promise<Reconciliation[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    reconciliationsStore.filter((r) => {
      if (f.bankAccountId && r.bankAccountId !== f.bankAccountId) return false
      if (f.reconciliationStatus && r.status !== f.reconciliationStatus) return false
      if (f.search && !matchSearch(`${r.reconciliationNumber} ${r.bankAccountName}`, f.search)) return false
      return true
    }),
  )
}

export async function getReconciliationById(id: string): Promise<Reconciliation | null> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === id)
  if (idx < 0) return null
  reconciliationsStore[idx] = recalculateReconciliation(reconciliationsStore[idx])
  return clone(reconciliationsStore[idx])
}

function isMatchableStatus(status: Reconciliation['lines'][number]['matchStatus']): boolean {
  return status === 'Unmatched' || status === 'Suggested' || status === 'Partially Matched'
}

function isTransitLine(line: Reconciliation['lines'][number]): boolean {
  return /in transit|transit\)/i.test(line.description)
}

/** Timing / memo items explained in the sticky summary — not unexplained difference */
function isExplainedOpenItem(line: Reconciliation['lines'][number]): boolean {
  return (
    isTransitLine(line)
    || /interest/i.test(line.description)
    || (/charge|fee|sms|imps fee|maintenance/i.test(line.description) && line.matchStatus !== 'Adjustment Required')
  )
}

function lineNet(line: Reconciliation['lines'][number]): number {
  return line.creditAmount - line.debitAmount
}

function recalculateReconciliation(recon: Reconciliation): Reconciliation {
  const open = (l: Reconciliation['lines'][number]) =>
    !['Matched', 'Ignored', 'Excluded', 'Duplicate'].includes(l.matchStatus)

  const stmtOpen = recon.lines.filter((l) => l.side === 'statement' && open(l))
  const bookOpen = recon.lines.filter((l) => l.side === 'book' && open(l))
  const matchedAmount = recon.matches.reduce((s, m) => s + m.matchAmount, 0)

  const adjDiff = stmtOpen
    .filter((l) => l.matchStatus === 'Adjustment Required' || l.matchStatus === 'Difference')
    .reduce((s, l) => s + l.debitAmount - l.creditAmount, 0)

  const stmtMatchableNet = stmtOpen
    .filter((l) => isMatchableStatus(l.matchStatus) && !isExplainedOpenItem(l))
    .reduce((s, l) => s + lineNet(l), 0)
  const bookMatchableNet = bookOpen
    .filter((l) => isMatchableStatus(l.matchStatus) && !isExplainedOpenItem(l))
    .reduce((s, l) => s + lineNet(l), 0)

  const finalDifference = Math.round((adjDiff + (stmtMatchableNet - bookMatchableNet)) * 100) / 100

  return {
    ...recon,
    matchedAmount,
    unmatchedBookAmount: bookOpen.reduce((s, l) => s + l.amount, 0),
    unmatchedStatementAmount: stmtOpen.reduce((s, l) => s + l.amount, 0),
    finalDifference,
    modifiedAt: new Date().toISOString(),
  }
}

export async function getAutoMatchPreview(reconciliationId: string): Promise<AutoMatchPreview> {
  await delay()
  const recon = reconciliationsStore.find((r) => r.id === reconciliationId)
  if (!recon) throw new BankCashServiceError('Reconciliation not found')

  const unmatchedStmt = recon.lines.filter((l) => l.side === 'statement' && isMatchableStatus(l.matchStatus))
  const unmatchedBook = recon.lines.filter((l) => l.side === 'book' && isMatchableStatus(l.matchStatus))
  const usedBook = new Set<string>()

  const suggestedMatches: AutoMatchPreview['suggestedMatches'] = []

  unmatchedStmt.forEach((s, i) => {
    const book = unmatchedBook.find((b) => {
      if (usedBook.has(b.id)) return false
      const normS = s.reference.replace(/[^0-9A-Z]/gi, '')
      const normB = b.reference.replace(/[^0-9A-Z]/gi, '')
      return Math.abs(b.amount - s.amount) < 1 && (normB.includes(normS.slice(-6)) || normS.includes(normB.slice(-6)))
    }) ?? unmatchedBook.find((b) => !usedBook.has(b.id) && Math.abs(b.amount - s.amount) < 1)

    if (!book) return
    usedBook.add(book.id)

    const amountDiff = Math.abs(book.amount - s.amount)
    const refHit = Boolean(s.reference && book.reference && (
      book.reference.replace(/[^0-9A-Z]/gi, '').includes(s.reference.replace(/[^0-9A-Z]/gi, '').slice(-4))
    ))
    const dateNear = Math.abs(Date.parse(book.lineDate) - Date.parse(s.lineDate)) <= 3 * 86_400_000
    const criteria: string[] = ['Amount']
    if (refHit) criteria.push('Reference', 'UTR')
    if (dateNear) criteria.push('Date')
    if (/CHQ|cheque/i.test(s.reference + s.description)) criteria.push('Cheque Number')

    const confidence: AutoMatchPreview['suggestedMatches'][number]['confidence'] =
      amountDiff === 0 && refHit ? 'High'
        : amountDiff === 0 && dateNear ? 'Medium'
        : amountDiff === 0 ? 'Medium'
        : 'Low'

    suggestedMatches.push({
      matchId: `sug-${reconciliationId}-${i}`,
      statementLineId: s.id,
      bookLineId: book.id,
      statementDescription: s.description,
      bookDescription: book.description,
      amount: s.amount,
      confidence,
      matchStatus: 'Suggested',
      criteria,
    })
  })

  const high = suggestedMatches.filter((m) => m.confidence === 'High')
  const medium = suggestedMatches.filter((m) => m.confidence === 'Medium')
  const low = suggestedMatches.filter((m) => m.confidence === 'Low')
  const amountMatched = high.reduce((s, m) => s + m.amount, 0)

  return {
    reconciliationId,
    bankAccountId: recon.bankAccountId,
    totalStatementLines: recon.lines.filter((l) => l.side === 'statement').length,
    exactMatches: high.length,
    suggestedMatchCount: medium.length,
    ambiguousMatches: low.length,
    unmatchedLines: unmatchedStmt.length - suggestedMatches.length,
    amountMatched,
    remainingDifference: recon.finalDifference,
    suggestedMatches,
    highConfidenceCount: high.length,
    mediumConfidenceCount: medium.length,
    lowConfidenceCount: low.length,
    unmatchedStatementCount: unmatchedStmt.length,
    unmatchedBookCount: unmatchedBook.length,
  }
}

export async function applyMatchesDemo(reconciliationId: string, matchIds: string[]): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === reconciliationId)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')

  const preview = await getAutoMatchPreview(reconciliationId)
  /** Never auto-apply Low confidence — caller may still select manually, but filter Low out of bulk high apply */
  const toApply = preview.suggestedMatches.filter((m) => matchIds.includes(m.matchId) && m.confidence !== 'Low')
  if (toApply.length === 0) throw new BankCashServiceError('No eligible matches to apply (low-confidence matches are never auto-applied).')

  const recon = reconciliationsStore[idx]
  const newMatches = [...recon.matches]
  const now = new Date().toISOString()
  const user = getSessionUser().name
  let lines = [...recon.lines]

  toApply.forEach((m) => {
    newMatches.push({
      id: `rm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      reconciliationId,
      statementLineId: m.statementLineId,
      bookLineId: m.bookLineId,
      matchAmount: m.amount,
      confidence: m.confidence,
      matchStatus: 'Matched',
      matchedAt: now,
      matchedBy: user,
    })
    lines = lines.map((l) => {
      if (l.id === m.statementLineId || l.id === m.bookLineId) {
        return { ...l, matchStatus: 'Matched' as const, confidence: m.confidence }
      }
      return l
    })
  })

  reconciliationsStore[idx] = recalculateReconciliation({
    ...recon,
    lines,
    matches: newMatches,
    status: 'In Progress',
  })

  pushAudit('Reconciliation', reconciliationId, 'ApplyMatches', `Applied ${toApply.length} auto-match(es)`)
  return clone(reconciliationsStore[idx])
}

/**
 * Manual match — supports one-to-one, one-to-many and many-to-one.
 * Partial match allowed when allowPartial is true and amounts differ.
 */
export async function manualMatchDemo(reconciliationId: string, input: ManualMatchInput): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === reconciliationId)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')
  const recon = reconciliationsStore[idx]
  if (recon.status === 'Completed') throw new BankCashServiceError('Completed reconciliation cannot be matched')

  const stmtIds = input.statementLineIds
  const bookIds = input.bookLineIds
  if (stmtIds.length === 0 || bookIds.length === 0) {
    throw new BankCashServiceError('Select at least one statement line and one book line to match.')
  }

  const stmtLines = recon.lines.filter((l) => l.side === 'statement' && stmtIds.includes(l.id))
  const bookLines = recon.lines.filter((l) => l.side === 'book' && bookIds.includes(l.id))
  if (stmtLines.length !== stmtIds.length || bookLines.length !== bookIds.length) {
    throw new BankCashServiceError('One or more selected lines were not found.')
  }
  if (stmtLines.some((l) => !isMatchableStatus(l.matchStatus) && l.matchStatus !== 'Adjustment Required')) {
    throw new BankCashServiceError('Selected statement lines must be unmatched (or adjustment-required).')
  }
  if (bookLines.some((l) => !isMatchableStatus(l.matchStatus))) {
    throw new BankCashServiceError('Selected book lines must be unmatched.')
  }

  const stmtTotal = stmtLines.reduce((s, l) => s + l.amount, 0)
  const bookTotal = bookLines.reduce((s, l) => s + l.amount, 0)
  const amountDiff = Math.abs(stmtTotal - bookTotal)
  if (amountDiff > 0.01 && !input.allowPartial) {
    throw new BankCashServiceError(
      `Selected amounts differ by ₹${amountDiff.toLocaleString('en-IN')}. Enable partial match or adjust selection.`,
    )
  }

  const status = amountDiff > 0.01 ? 'Partially Matched' as const : 'Matched' as const
  const now = new Date().toISOString()
  const user = getSessionUser().name
  const matchAmount = Math.min(stmtTotal, bookTotal)
  const idSet = new Set([...stmtIds, ...bookIds])

  const lines = recon.lines.map((l) =>
    idSet.has(l.id) ? { ...l, matchStatus: status, confidence: 'Manual' as const } : l,
  )

  const newMatches = [
    ...recon.matches,
    ...stmtIds.flatMap((sid) =>
      bookIds.map((bid) => ({
        id: `rm-m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reconciliationId,
        statementLineId: sid,
        bookLineId: bid,
        matchAmount: matchAmount / (stmtIds.length * bookIds.length || 1),
        confidence: 'Manual' as const,
        matchStatus: status,
        matchedAt: now,
        matchedBy: user,
      })),
    ),
  ]

  reconciliationsStore[idx] = recalculateReconciliation({
    ...recon,
    lines,
    matches: newMatches,
    status: 'In Progress',
  })

  pushAudit(
    'Reconciliation',
    reconciliationId,
    'ManualMatch',
    `Manual ${stmtIds.length}:${bookIds.length} match — ${status}`,
  )
  return clone(reconciliationsStore[idx])
}

export async function unmatchLinesDemo(reconciliationId: string, lineIds: string[]): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === reconciliationId)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')
  const recon = reconciliationsStore[idx]
  if (recon.status === 'Completed') throw new BankCashServiceError('Completed reconciliation cannot be unmatched')

  const idSet = new Set(lineIds)
  const lines = recon.lines.map((l) =>
    idSet.has(l.id) && (l.matchStatus === 'Matched' || l.matchStatus === 'Partially Matched' || l.matchStatus === 'Suggested')
      ? { ...l, matchStatus: 'Unmatched' as const, confidence: null }
      : l,
  )
  const matches = recon.matches.filter(
    (m) => !idSet.has(m.statementLineId) && !idSet.has(m.bookLineId),
  )

  reconciliationsStore[idx] = recalculateReconciliation({
    ...recon,
    lines,
    matches,
    status: 'In Progress',
  })
  pushAudit('Reconciliation', reconciliationId, 'Unmatch', `Unmatched ${lineIds.length} line(s)`)
  return clone(reconciliationsStore[idx])
}

export async function ignoreLinesDemo(reconciliationId: string, lineIds: string[]): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === reconciliationId)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')
  const recon = reconciliationsStore[idx]
  if (recon.status === 'Completed') throw new BankCashServiceError('Completed reconciliation cannot be edited')

  const idSet = new Set(lineIds)
  const lines = recon.lines.map((l) =>
    idSet.has(l.id) ? { ...l, matchStatus: 'Ignored' as const } : l,
  )

  reconciliationsStore[idx] = recalculateReconciliation({
    ...recon,
    lines,
    status: 'In Progress',
  })
  pushAudit('Reconciliation', reconciliationId, 'Ignore', `Ignored ${lineIds.length} line(s)`)
  return clone(reconciliationsStore[idx])
}

export async function saveReconciliationDraft(id: string, payload: ReconciliationDraftPayload): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === id)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')
  const cur = reconciliationsStore[idx]
  if (cur.status === 'Completed') throw new BankCashServiceError('Completed reconciliation cannot be edited')

  reconciliationsStore[idx] = {
    ...cur,
    ...payload,
    lines: payload.lines ?? cur.lines,
    matches: payload.matches ?? cur.matches,
    status: 'Draft',
    modifiedAt: new Date().toISOString(),
  }
  pushAudit('Reconciliation', id, 'SaveDraft', 'Saved reconciliation draft')
  return clone(reconciliationsStore[idx])
}

export async function completeReconciliationDemo(
  id: string,
  options?: { allowAdjustment?: boolean },
): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === id)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')
  const recon = reconciliationsStore[idx]

  if (recon.finalDifference !== 0 && !options?.allowAdjustment && !recon.adjustmentPosted) {
    throw new BankCashServiceError(
      `Cannot complete reconciliation — final difference is ₹${recon.finalDifference.toLocaleString('en-IN')}. Post an authorized adjustment or enable allowAdjustment.`,
    )
  }

  const user = getSessionUser().name
  reconciliationsStore[idx] = {
    ...recon,
    status: 'Completed',
    completedAt: new Date().toISOString(),
    completedBy: user,
    modifiedAt: new Date().toISOString(),
  }

  const bankIdx = bankAccountsStore.findIndex((b) => b.id === recon.bankAccountId)
  if (bankIdx >= 0) {
    bankAccountsStore[bankIdx] = {
      ...bankAccountsStore[bankIdx],
      reconciliationStatus: 'Completed',
      lastReconciledDate: recon.periodTo,
      unreconciledAmount: 0,
      modifiedAt: new Date().toISOString(),
    }
  }

  pushAudit('Reconciliation', id, 'Complete', `Completed reconciliation ${recon.reconciliationNumber}`)
  return clone(reconciliationsStore[idx])
}

export async function reopenReconciliationDemo(id: string): Promise<Reconciliation> {
  await delay()
  const idx = reconciliationsStore.findIndex((r) => r.id === id)
  if (idx < 0) throw new BankCashServiceError('Reconciliation not found')
  reconciliationsStore[idx] = {
    ...reconciliationsStore[idx],
    status: 'Reopened',
    completedAt: null,
    completedBy: null,
    modifiedAt: new Date().toISOString(),
  }
  pushAudit('Reconciliation', id, 'Reopen', 'Reopened reconciliation for further matching')
  return clone(reconciliationsStore[idx])
}

// ─── Cheques ──────────────────────────────────────────────────────────────────

export async function getCheques(filter?: Partial<BankCashFilter>): Promise<Cheque[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    chequesStore.filter((c) => {
      if (f.bankAccountId && c.bankAccountId !== f.bankAccountId) return false
      if (f.chequeStatus && c.status !== f.chequeStatus) return false
      if (f.chequeDirection && c.direction !== f.chequeDirection) return false
      if (f.search && !matchSearch(`${c.chequeNumber} ${c.payeeName} ${c.reference}`, f.search)) return false
      if (!inDateRange(c.chequeDate, f.dateFrom, f.dateTo)) return false
      return true
    }),
  )
}

export async function updateChequeStatusDemo(id: string, status: ChequeStatus): Promise<Cheque> {
  await delay()
  const idx = chequesStore.findIndex((c) => c.id === id)
  if (idx < 0) throw new BankCashServiceError('Cheque not found')
  const patch: Partial<Cheque> = { status }
  if (status === 'Cleared') patch.clearanceDate = new Date().toISOString().slice(0, 10)
  if (status === 'Deposited') patch.depositDate = new Date().toISOString().slice(0, 10)
  if (status === 'Bounced') {
    patch.bounceDate = new Date().toISOString().slice(0, 10)
    patch.bounceReason = patch.bounceReason ?? 'Demo bounce'
  }
  chequesStore[idx] = { ...chequesStore[idx], ...patch }
  pushAudit('Cheque', id, 'StatusChange', `Cheque status changed to ${status}`)
  return clone(chequesStore[idx])
}

// ─── Deposits ─────────────────────────────────────────────────────────────────

export async function getBankDeposits(filter?: Partial<BankCashFilter>): Promise<BankDeposit[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    depositsStore.filter((d) => {
      if (f.bankAccountId && d.bankAccountId !== f.bankAccountId) return false
      if (f.depositStatus && d.status !== f.depositStatus) return false
      if (f.search && !matchSearch(`${d.depositNumber} ${d.narration}`, f.search)) return false
      return true
    }),
  )
}

export async function createBankDepositDemo(input: BankDepositInput): Promise<BankDeposit> {
  await delay()
  const bank = bankAccountsStore.find((b) => b.id === input.bankAccountId)
  const cash = input.cashAccountId ? cashAccountsStore.find((c) => c.id === input.cashAccountId) : null
  const row: BankDeposit = {
    id: `bdep-${Date.now()}`,
    depositNumber: nextNumber('DEP', depositsStore.map((d) => d.depositNumber)),
    depositDate: input.depositDate,
    depositType: input.depositType,
    status: 'Draft',
    bankAccountId: input.bankAccountId,
    bankAccountName: bank?.name ?? input.bankAccountId,
    cashAccountId: input.cashAccountId,
    cashAccountName: cash?.name ?? null,
    totalAmount: input.totalAmount,
    cashAmount: input.cashAmount,
    chequeAmount: input.chequeAmount,
    chequeCount: input.chequeCount,
    slipNumber: null,
    narration: input.narration,
    createdBy: getSessionUser().name,
    createdAt: new Date().toISOString(),
  }
  depositsStore = [row, ...depositsStore]
  pushAudit('BankDeposit', row.id, 'Create', `Created deposit ${row.depositNumber}`)
  return clone(row)
}

// ─── Cash book & counts ─────────────────────────────────────────────────────────

export async function getCashBook(cashAccountId: string, filter?: Partial<BankCashFilter>): Promise<CashBookEntry[]> {
  await delay()
  const txns = applyTxnFilter(
    transactionsStore.filter((t) => t.cashAccountId === cashAccountId),
    filter ?? {},
  ).sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))

  return txns.map((t) => ({
    id: t.id,
    cashAccountId,
    entryDate: t.transactionDate,
    voucherNumber: t.voucherNumber,
    transactionType: t.transactionType,
    reference: t.reference,
    narration: t.narration,
    receivedFrom: t.creditAmount > 0 ? t.counterpartyName : null,
    paidTo: t.debitAmount > 0 ? t.counterpartyName : null,
    debitAmount: t.debitAmount,
    creditAmount: t.creditAmount,
    runningBalance: t.runningBalance,
    createdBy: t.createdBy,
  }))
}

export async function getCashCounts(filter?: Partial<BankCashFilter>): Promise<CashCount[]> {
  await delay()
  const f = { ...DEFAULT_BANK_CASH_FILTER, ...filter }
  return clone(
    cashCountsStore.filter((c) => {
      if (f.cashAccountId && c.cashAccountId !== f.cashAccountId) return false
      if (f.cashCountStatus && c.status !== f.cashCountStatus) return false
      if (f.search && !matchSearch(`${c.countNumber} ${c.cashAccountName}`, f.search)) return false
      return true
    }),
  )
}

export async function getCashCountById(id: string): Promise<CashCount | null> {
  await delay()
  const row = cashCountsStore.find((c) => c.id === id)
  return row ? clone(row) : null
}

export async function createCashCount(input: CashCountInput): Promise<CashCount> {
  await delay()
  const cash = cashAccountsStore.find((c) => c.id === input.cashAccountId)
  if (!cash) throw new BankCashServiceError('Cash account not found')

  const physicalTotal = input.denominations.reduce((s, d) => s + d.amount, 0)
  const varianceAmount = physicalTotal - cash.bookBalance
  const varianceStatus = varianceAmount === 0 ? 'Matched' as const : varianceAmount > 0 ? 'Excess' as const : 'Shortage' as const

  const row: CashCount = {
    id: `ccnt-${Date.now()}`,
    countNumber: nextNumber('CCNT', cashCountsStore.map((c) => c.countNumber)),
    countDate: input.countDate,
    cashAccountId: input.cashAccountId,
    cashAccountName: cash.name,
    status: 'Draft',
    bookBalance: cash.bookBalance,
    physicalTotal,
    varianceAmount,
    varianceStatus,
    denominations: input.denominations,
    countedBy: input.countedBy,
    verifiedBy: null,
    approvedBy: null,
    approvedAt: null,
    adjustmentPosted: false,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  }
  cashCountsStore = [row, ...cashCountsStore]
  pushAudit('CashCount', row.id, 'Create', `Created cash count ${row.countNumber}`)
  return clone(row)
}

export async function submitCashCount(id: string): Promise<CashCount> {
  await delay()
  const idx = cashCountsStore.findIndex((c) => c.id === id)
  if (idx < 0) throw new BankCashServiceError('Cash count not found')
  cashCountsStore[idx] = { ...cashCountsStore[idx], status: 'Submitted' }
  pushAudit('CashCount', id, 'Submit', 'Submitted cash count for approval')
  return clone(cashCountsStore[idx])
}

export async function approveCashVarianceDemo(id: string): Promise<CashCount> {
  await delay()
  const idx = cashCountsStore.findIndex((c) => c.id === id)
  if (idx < 0) throw new BankCashServiceError('Cash count not found')
  const user = getSessionUser().name
  cashCountsStore[idx] = {
    ...cashCountsStore[idx],
    status: 'Approved',
    approvedBy: user,
    approvedAt: new Date().toISOString(),
  }
  pushAudit('CashCount', id, 'Approve', 'Approved cash count variance')
  return clone(cashCountsStore[idx])
}

export async function postCashAdjustmentDemo(id: string): Promise<CashCount> {
  await delay()
  const idx = cashCountsStore.findIndex((c) => c.id === id)
  if (idx < 0) throw new BankCashServiceError('Cash count not found')
  const count = cashCountsStore[idx]
  if (count.status !== 'Approved') throw new BankCashServiceError('Cash count must be approved before posting adjustment')

  const cashIdx = cashAccountsStore.findIndex((c) => c.id === count.cashAccountId)
  if (cashIdx >= 0) {
    cashAccountsStore[cashIdx] = {
      ...cashAccountsStore[cashIdx],
      bookBalance: count.physicalTotal,
      physicalBalance: count.physicalTotal,
      variance: 0,
      lastCountDate: count.countDate,
      modifiedAt: new Date().toISOString(),
    }
  }

  cashCountsStore[idx] = { ...count, status: 'Posted', adjustmentPosted: true }
  pushAudit('CashCount', id, 'PostAdjustment', `Posted cash adjustment of ₹${count.varianceAmount}`)
  return clone(cashCountsStore[idx])
}

// ─── Reports / setup / audit / export ───────────────────────────────────────────

export async function getBankCashReports(): Promise<BankCashReportCard[]> {
  await delay()
  return [
    { id: 'rpt-bank-summary', name: 'Bank Balance Summary', description: 'Book vs statement balances by bank account', category: 'Bank', lastGeneratedAt: '2026-07-10T10:00:00.000Z' },
    { id: 'rpt-cash-summary', name: 'Cash Position Report', description: 'Cash balances by location and custodian', category: 'Cash', lastGeneratedAt: '2026-07-08T10:00:00.000Z' },
    { id: 'rpt-recon-status', name: 'Reconciliation Status', description: 'Open and completed reconciliations', category: 'Reconciliation', lastGeneratedAt: '2026-07-12T10:00:00.000Z' },
    { id: 'rpt-cheque-register', name: 'Cheque Register', description: 'Issued and received cheques with status', category: 'Compliance', lastGeneratedAt: null },
    { id: 'rpt-fund-transfer', name: 'Fund Transfer Log', description: 'Internal and external fund movements', category: 'Bank', lastGeneratedAt: '2026-07-14T10:00:00.000Z' },
    { id: 'rpt-cash-variance', name: 'Cash Variance Report', description: 'Physical vs book cash variances', category: 'Cash', lastGeneratedAt: '2026-07-05T10:00:00.000Z' },
  ]
}

export async function getBankCashSetup(): Promise<BankCashSetup> {
  await delay()
  return clone(setupStore)
}

export async function updateBankCashSetupDemo(patch: Partial<BankCashSetup>): Promise<BankCashSetup> {
  await delay()
  setupStore = { ...setupStore, ...patch }
  pushAudit('Setup', 'bank-cash', 'Update', 'Updated bank & cash setup configuration')
  return clone(setupStore)
}

export async function getBankCashAuditTrail(entityType?: string, entityId?: string): Promise<BankCashAuditEntry[]> {
  await delay()
  return clone(
    auditStore.filter((a) => {
      if (entityType && a.entityType !== entityType) return false
      if (entityId && a.entityId !== entityId) return false
      return true
    }),
  )
}

export async function exportBankCashData(req: BankCashExportRequest): Promise<{ fileName: string; rowCount: number; format: string }> {
  await delay()
  let rowCount = 0
  if (req.reportName.includes('transaction')) rowCount = (await getBankCashTransactions(req.filter)).length
  else if (req.reportName.includes('cheque')) rowCount = (await getCheques(req.filter)).length
  else if (req.reportName.includes('transfer')) rowCount = (await getFundTransfers(req.filter)).length
  else rowCount = bankAccountsStore.length + cashAccountsStore.length

  pushAudit('Export', req.reportName, 'Export', `Exported ${rowCount} rows as ${req.format}`)
  return {
    fileName: `${req.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${req.format}`,
    rowCount,
    format: req.format,
  }
}

export async function getBankCashPrintPreview(reportName: string, filter?: Partial<BankCashFilter>): Promise<BankCashPrintPreview> {
  await delay()
  const f = filter ?? {}
  let rows: Array<Record<string, string | number | null>> = []

  if (reportName.includes('Bank Balance')) {
    rows = (await getBankAccounts(f)).map((b) => ({
      Account: b.name,
      Book: b.bookBalance,
      Statement: b.statementBalance,
      Unreconciled: b.unreconciledAmount,
      Status: b.status,
    }))
  } else if (reportName.includes('Cash')) {
    rows = (await getCashAccounts(f)).map((c) => ({
      Account: c.name,
      Book: c.bookBalance,
      Physical: c.physicalBalance,
      Location: c.location,
      Custodian: c.custodian,
    }))
  } else {
    rows = (await getBankCashTransactions(f)).slice(0, 50).map((t) => ({
      Date: t.transactionDate,
      Number: t.transactionNumber,
      Type: t.transactionType,
      Account: t.accountName,
      Debit: t.debitAmount,
      Credit: t.creditAmount,
      Reference: t.reference,
    }))
  }

  return {
    reportName,
    generatedAt: new Date().toISOString(),
    companyName: COMPANY_NAME,
    filterSummary: f.search ? `Search: ${f.search}` : 'All records',
    rows,
  }
}

export async function getBankCashLookups(): Promise<BankCashLookups> {
  await delay()
  const locations = [...new Set([...bankAccountsStore, ...cashAccountsStore].map((a) => a.location))]
  const custodians = [...new Set([...bankAccountsStore.map((b) => b.custodian), ...cashAccountsStore.map((c) => c.custodian)])]
  const currencies = [...new Set([...bankAccountsStore.map((b) => b.currency), ...cashAccountsStore.map((c) => c.currency)])]

  return {
    bankAccounts: bankAccountsStore.map((b) => ({ id: b.id, label: `${b.code} — ${b.name}`, currency: b.currency })),
    cashAccounts: cashAccountsStore.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}`, currency: c.currency })),
    locations,
    custodians,
    currencies,
    transferModes: ['Internal Transfer', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash Deposit', 'Cash Withdrawal', 'Other'],
    transactionTypes: [
      'Customer Receipt', 'Vendor Payment', 'Bank Transfer', 'Cash Transfer', 'Cash Deposit', 'Cash Withdrawal',
      'Bank Charge', 'Bank Interest', 'Cheque Issue', 'Cheque Deposit', 'Cheque Clearance', 'Direct Debit',
      'Direct Credit', 'Adjustment', 'Reversal',
    ],
  }
}

export function resetBankCashDemo(): void {
  bankAccountsStore = seedBankAccounts()
  cashAccountsStore = seedCashAccounts()
  transactionsStore = seedBankCashTransactions()
  fundTransfersStore = seedFundTransfers()
  statementsStore = seedBankStatements()
  statementLinesStore = seedBankStatementLines()
  reconciliationsStore = seedReconciliations()
  chequesStore = seedCheques()
  depositsStore = seedBankDeposits()
  cashCountsStore = seedCashCounts()
  setupStore = seedBankCashSetup()
  auditStore = seedBankCashAudit()
}
