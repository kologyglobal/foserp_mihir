/**
 * Pure calculation helpers for the Accounting demo module.
 * These are frontend view calculators only — no backend posting, no GST/TDS filing engine.
 */
import type {
  AgeingBucketRow,
  LedgerAccount,
  LedgerEntry,
  OpenItemEntry,
  Voucher,
  VoucherLine,
} from '../../types/accounting'

export function genAccountingId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function sumVoucherLines(lines: VoucherLine[]): { totalDebit: number; totalCredit: number } {
  return lines.reduce(
    (acc, l) => ({
      totalDebit: acc.totalDebit + (Number.isFinite(l.debit) ? l.debit : 0),
      totalCredit: acc.totalCredit + (Number.isFinite(l.credit) ? l.credit : 0),
    }),
    { totalDebit: 0, totalCredit: 0 },
  )
}

export function isVoucherBalanced(lines: VoucherLine[]): boolean {
  const { totalDebit, totalCredit } = sumVoucherLines(lines)
  return Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0
}

export function voucherBalanceDifference(lines: VoucherLine[]): number {
  const { totalDebit, totalCredit } = sumVoucherLines(lines)
  return Math.round((totalDebit - totalCredit) * 100) / 100
}

/** Convert a posted voucher's lines into immutable ledger entries. */
export function buildLedgerEntriesFromVoucher(voucher: Voucher): LedgerEntry[] {
  return voucher.lines.map((line) => ({
    id: genAccountingId('gl'),
    entryDate: voucher.voucherDate,
    accountId: line.accountId,
    voucherId: voucher.id,
    voucherNo: voucher.voucherNo,
    sourceType: voucher.voucherType,
    debit: line.debit,
    credit: line.credit,
    narration: line.narration || voucher.narration,
    partyType: line.partyType ?? voucher.partyType ?? null,
    partyId: line.partyId ?? voucher.partyId ?? null,
    costCenterId: line.costCenterId ?? null,
    createdAt: new Date().toISOString(),
  }))
}

/** Net movement for an account from ledger entries (debit − credit, sign per account nature). */
export function computeAccountBalance(
  account: LedgerAccount,
  entries: LedgerEntry[],
  asOfDate?: string,
): number {
  const relevant = entries.filter(
    (e) => e.accountId === account.id && (!asOfDate || e.entryDate <= asOfDate),
  )
  const debit = relevant.reduce((s, e) => s + e.debit, 0)
  const credit = relevant.reduce((s, e) => s + e.credit, 0)
  const opening = account.openingBalanceType === 'debit' ? account.openingBalance : -account.openingBalance
  const movement = account.nature === 'debit' ? debit - credit : credit - debit
  const openingSigned = account.nature === 'debit' ? opening : -opening
  return Math.round((openingSigned + movement) * 100) / 100
}

export interface TrialBalanceRow {
  account: LedgerAccount
  debit: number
  credit: number
}

export function computeTrialBalance(
  accounts: LedgerAccount[],
  entries: LedgerEntry[],
  asOfDate?: string,
): { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number } {
  const rows: TrialBalanceRow[] = accounts
    .filter((a) => a.isPostable)
    .map((account) => {
      const balance = computeAccountBalance(account, entries, asOfDate)
      const isDebitNature = account.nature === 'debit'
      return {
        account,
        debit: isDebitNature && balance >= 0 ? balance : isDebitNature ? 0 : balance < 0 ? -balance : 0,
        credit: !isDebitNature && balance >= 0 ? balance : !isDebitNature ? 0 : balance < 0 ? -balance : 0,
      }
    })
    .filter((row) => row.debit !== 0 || row.credit !== 0)

  const totalDebit = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100
  const totalCredit = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100
  return { rows, totalDebit, totalCredit }
}

export interface PnlSection {
  label: string
  rows: { account: LedgerAccount; amount: number }[]
  total: number
}

export function computeProfitAndLoss(
  accounts: LedgerAccount[],
  entries: LedgerEntry[],
  asOfDate?: string,
): { income: PnlSection; expense: PnlSection; netProfit: number } {
  const incomeAccounts = accounts.filter((a) => a.isPostable && a.groupType === 'income')
  const expenseAccounts = accounts.filter((a) => a.isPostable && a.groupType === 'expense')

  const incomeRows = incomeAccounts
    .map((a) => ({ account: a, amount: Math.abs(computeAccountBalance(a, entries, asOfDate)) }))
    .filter((r) => r.amount !== 0)
  const expenseRows = expenseAccounts
    .map((a) => ({ account: a, amount: Math.abs(computeAccountBalance(a, entries, asOfDate)) }))
    .filter((r) => r.amount !== 0)

  const totalIncome = Math.round(incomeRows.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const totalExpense = Math.round(expenseRows.reduce((s, r) => s + r.amount, 0) * 100) / 100

  return {
    income: { label: 'Income', rows: incomeRows, total: totalIncome },
    expense: { label: 'Expenses', rows: expenseRows, total: totalExpense },
    netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
  }
}

export interface BalanceSheetSection {
  label: string
  rows: { account: LedgerAccount; amount: number }[]
  total: number
}

export function computeBalanceSheet(
  accounts: LedgerAccount[],
  entries: LedgerEntry[],
  asOfDate?: string,
): { assets: BalanceSheetSection; liabilities: BalanceSheetSection; equity: BalanceSheetSection; netProfit: number } {
  const build = (groupType: 'asset' | 'liability' | 'equity', label: string): BalanceSheetSection => {
    const rows = accounts
      .filter((a) => a.isPostable && a.groupType === groupType)
      .map((a) => ({ account: a, amount: Math.abs(computeAccountBalance(a, entries, asOfDate)) }))
      .filter((r) => r.amount !== 0)
    const total = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100
    return { label, rows, total }
  }

  const { netProfit } = computeProfitAndLoss(accounts, entries, asOfDate)

  return {
    assets: build('asset', 'Assets'),
    liabilities: build('liability', 'Liabilities'),
    equity: build('equity', 'Equity'),
    netProfit,
  }
}

export function computeAgeingBuckets(openItems: OpenItemEntry[], asOfDate: string): AgeingBucketRow[] {
  const byParty = new Map<string, AgeingBucketRow>()
  const asOf = new Date(asOfDate).getTime()

  for (const item of openItems) {
    if (item.balance <= 0) continue
    const days = Math.floor((asOf - new Date(item.documentDate).getTime()) / (24 * 60 * 60 * 1000))
    const existing = byParty.get(item.partyId) ?? {
      partyId: item.partyId,
      partyName: item.partyName,
      current: 0,
      d1to30: 0,
      d31to60: 0,
      d61to90: 0,
      d90plus: 0,
      total: 0,
    }
    if (days <= 0) existing.current += item.balance
    else if (days <= 30) existing.d1to30 += item.balance
    else if (days <= 60) existing.d31to60 += item.balance
    else if (days <= 90) existing.d61to90 += item.balance
    else existing.d90plus += item.balance
    existing.total += item.balance
    byParty.set(item.partyId, existing)
  }

  return Array.from(byParty.values()).sort((a, b) => b.total - a.total)
}

export function nextVoucherSequence(existing: string[], prefix: string): string {
  const year = new Date().getFullYear()
  const yearPrefix = `${prefix}-${year}-`
  const nums = existing
    .filter((n) => n.startsWith(yearPrefix))
    .map((n) => parseInt(n.slice(yearPrefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  const max = nums.reduce((m, n) => (n > m ? n : m), 0)
  return `${yearPrefix}${String(max + 1).padStart(4, '0')}`
}
