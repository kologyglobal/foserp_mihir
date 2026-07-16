/**
 * Accounting Vouchers mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT post real GL, bank, GST, or TDS.
 *
 * SECURITY: Mutations must also be enforced by the future backend
 * (tenant isolation + accounting.voucher.* permissions). UI gating alone is not security.
 */

import {
  seedAccountingVouchers,
  VOUCHER_COST_CENTRES,
  VOUCHER_PARTY_OPTIONS,
} from '../../data/accounting/vouchersSeed'
import type {
  AccountingVoucher,
  AccountingVoucherLine,
  VoucherExportFormat,
  VoucherExportScope,
  VoucherFilter,
  VoucherFormInput,
  VoucherImportPreview,
  VoucherImportPreviewRow,
  VoucherKpiSummary,
  VoucherLifecycleStatus,
} from '../../types/vouchers'
import {
  DEFAULT_VOUCHER_FILTER,
  MANUAL_VOUCHER_TYPES,
  sumVoucherDebitCredit,
  VOUCHER_DOCUMENT_TYPE_PREFIX,
} from '../../types/vouchers'
import { getSessionUser } from '../../utils/permissions'

export class VouchersServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VouchersServiceError'
  }
}

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms))

let vouchersStore: AccountingVoucher[] = seedAccountingVouchers()

function currentUser(): string {
  try {
    return getSessionUser().name
  } catch {
    return 'Demo User'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function nextVoucherNumber(type: AccountingVoucher['voucherType']): string {
  const prefix = VOUCHER_DOCUMENT_TYPE_PREFIX[type]
  const year = new Date().getFullYear()
  const existing = vouchersStore
    .map((v) => v.voucherNumber)
    .filter((n) => n.startsWith(`${prefix}-${year}-`))
  let max = 0
  for (const n of existing) {
    const part = Number(n.split('-').pop())
    if (Number.isFinite(part) && part > max) max = part
  }
  return `${prefix}-${year}-${String(max + 1).padStart(5, '0')}`
}

function editableStatuses(): VoucherLifecycleStatus[] {
  return ['draft', 'rejected', 'sent_back']
}

function normalizeLines(lines: Omit<AccountingVoucherLine, 'id' | 'lineNo'>[]): AccountingVoucherLine[] {
  return lines.map((l, idx) => ({
    ...l,
    id: genId('vl'),
    lineNo: idx + 1,
    debit: Math.round((Number(l.debit) || 0) * 100) / 100,
    credit: Math.round((Number(l.credit) || 0) * 100) / 100,
  }))
}

export function validateVoucherInput(
  input: VoucherFormInput,
  opts: { requireBalanced?: boolean } = {},
): string[] {
  const errors: string[] = []
  if (!MANUAL_VOUCHER_TYPES.includes(input.voucherType)) {
    errors.push('Unsupported voucher type for manual entry')
  }
  if (!input.voucherDate) errors.push('Voucher Date is required')
  if (!input.postingDate) errors.push('Posting Date is required')
  if (!input.narration?.trim()) errors.push('Narration is required')
  if (!input.lines?.length) errors.push('At least one accounting entry line is required')
  if ((input.lines?.length ?? 0) < 2) errors.push('A voucher requires at least two entry lines')

  input.lines?.forEach((l, i) => {
    const row = i + 1
    if (!l.accountId) errors.push(`Line ${row}: Account is required`)
    const hasDebit = (l.debit || 0) > 0
    const hasCredit = (l.credit || 0) > 0
    if (hasDebit && hasCredit) errors.push(`Line ${row}: Enter either Debit or Credit, not both`)
    if (!hasDebit && !hasCredit) errors.push(`Line ${row}: Enter Debit or Credit amount`)
    if ((l.debit || 0) < 0 || (l.credit || 0) < 0) errors.push(`Line ${row}: Amounts cannot be negative`)
  })

  if (input.voucherType === 'payment' || input.voucherType === 'receipt') {
    if (!input.partyId) errors.push('Party is required for Payment / Receipt vouchers')
    if (!input.paymentMode) errors.push('Payment mode is required')
    if (input.paymentMode && input.paymentMode !== 'cash' && !input.bankAccountId) {
      errors.push('Bank / Cash account is required for this payment mode')
    }
    if (input.paymentMode === 'cheque' && !input.chequeNo?.trim()) {
      errors.push('Cheque number is required')
    }
  }

  if (input.voucherType === 'contra') {
    if (!input.fromAccountId || !input.toAccountId) {
      errors.push('From Account and To Account are required for Contra')
    } else if (input.fromAccountId === input.toAccountId) {
      errors.push('From and To accounts must be different')
    }
  }

  if (input.voucherType === 'debit_note' || input.voucherType === 'credit_note') {
    if (!input.partyId) errors.push('Party is required for Debit / Credit Note')
    if (!input.originalInvoiceNo?.trim()) errors.push('Original invoice number is required')
  }

  if (input.voucherType === 'opening_balance' && !input.openingBalanceAsOf) {
    errors.push('Opening balance as-of date is required')
  }

  const sums = sumVoucherDebitCredit(input.lines ?? [])
  if (opts.requireBalanced && !sums.isBalanced) {
    errors.push(`Voucher is not balanced (difference ${sums.difference.toFixed(2)})`)
  }

  return errors
}

function matchesFilter(v: AccountingVoucher, filter: VoucherFilter): boolean {
  if (filter.listTab !== 'all' && v.status !== filter.listTab) return false
  if (filter.voucherType !== 'all' && v.voucherType !== filter.voucherType) return false
  if (filter.status !== 'all' && v.status !== filter.status) return false
  if (filter.dateFrom && v.voucherDate < filter.dateFrom) return false
  if (filter.dateTo && v.voucherDate > filter.dateTo) return false
  if (filter.partyId && v.partyId !== filter.partyId) return false
  if (filter.createdBy && !v.createdBy.toLowerCase().includes(filter.createdBy.toLowerCase())) return false
  if (filter.unbalancedOnly && v.isBalanced) return false
  const min = filter.minAmount ? Number(filter.minAmount) : null
  const max = filter.maxAmount ? Number(filter.maxAmount) : null
  const amount = Math.max(v.totalDebit, v.totalCredit)
  if (min != null && Number.isFinite(min) && amount < min) return false
  if (max != null && Number.isFinite(max) && amount > max) return false
  const q = filter.search.trim().toLowerCase()
  if (q) {
    const hay = [
      v.voucherNumber,
      v.narration,
      v.partyName ?? '',
      v.referenceNo ?? '',
      v.voucherType,
      ...v.lines.map((l) => `${l.accountCode} ${l.accountName}`),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

function buildFromInput(input: VoucherFormInput, existing?: AccountingVoucher): AccountingVoucher {
  const lines = normalizeLines(input.lines)
  const sums = sumVoucherDebitCredit(lines)
  const user = currentUser()
  const now = nowIso()
  const base: AccountingVoucher = {
    id: existing?.id ?? genId('vch'),
    voucherNumber: existing?.voucherNumber ?? nextVoucherNumber(input.voucherType),
    voucherType: input.voucherType,
    status: existing?.status ?? 'draft',
    voucherDate: input.voucherDate,
    postingDate: input.postingDate,
    fiscalPeriod: input.fiscalPeriod || input.voucherDate.slice(0, 7),
    narration: input.narration.trim(),
    referenceNo: input.referenceNo?.trim() || undefined,
    partyType: input.partyType ?? null,
    partyId: input.partyId ?? null,
    partyName: input.partyName ?? null,
    partyGstin: input.partyGstin ?? null,
    paymentMode: input.paymentMode ?? null,
    bankAccountId: input.bankAccountId ?? null,
    bankAccountName: input.bankAccountName ?? null,
    chequeNo: input.chequeNo,
    chequeDate: input.chequeDate ?? null,
    transactionRef: input.transactionRef,
    fromAccountId: input.fromAccountId ?? null,
    fromAccountName: input.fromAccountName ?? null,
    toAccountId: input.toAccountId ?? null,
    toAccountName: input.toAccountName ?? null,
    originalInvoiceNo: input.originalInvoiceNo,
    originalInvoiceDate: input.originalInvoiceDate ?? null,
    reasonCode: input.reasonCode,
    openingBalanceAsOf: input.openingBalanceAsOf ?? null,
    lines,
    ...sums,
    currency: 'INR',
    createdBy: existing?.createdBy ?? user,
    createdAt: existing?.createdAt ?? now,
    updatedBy: user,
    updatedAt: now,
    submittedAt: existing?.submittedAt ?? null,
    submittedBy: existing?.submittedBy ?? null,
    approvedAt: existing?.approvedAt ?? null,
    approvedBy: existing?.approvedBy ?? null,
    postedAt: existing?.postedAt ?? null,
    postedBy: existing?.postedBy ?? null,
    rejectedReason: existing?.rejectedReason ?? null,
    sentBackReason: existing?.sentBackReason ?? null,
    cancelledReason: existing?.cancelledReason ?? null,
    reversedByVoucherId: existing?.reversedByVoucherId ?? null,
    reversedByVoucherNumber: existing?.reversedByVoucherNumber ?? null,
    reversalOfVoucherId: existing?.reversalOfVoucherId ?? null,
    reversalOfVoucherNumber: existing?.reversalOfVoucherNumber ?? null,
    attachments: existing?.attachments ?? [],
    notes: existing?.notes ?? [],
    approvalTrail: existing?.approvalTrail ?? [],
    auditTrail: existing?.auditTrail ?? [],
  }
  return base
}

export async function getVouchers(filter?: Partial<VoucherFilter>): Promise<AccountingVoucher[]> {
  await delay()
  const f: VoucherFilter = { ...DEFAULT_VOUCHER_FILTER, ...filter }
  return clone(vouchersStore.filter((v) => matchesFilter(v, f)).sort((a, b) => b.voucherDate.localeCompare(a.voucherDate) || b.voucherNumber.localeCompare(a.voucherNumber)))
}

export async function getVoucherById(id: string): Promise<AccountingVoucher | null> {
  await delay()
  const v = vouchersStore.find((x) => x.id === id)
  return v ? clone(v) : null
}

export async function getVoucherKpis(): Promise<VoucherKpiSummary> {
  await delay()
  const month = new Date().toISOString().slice(0, 7)
  const all = vouchersStore
  return {
    totalVouchers: all.length,
    draftCount: all.filter((v) => v.status === 'draft').length,
    pendingApprovalCount: all.filter((v) => v.status === 'pending_approval').length,
    approvedCount: all.filter((v) => v.status === 'approved').length,
    postedCount: all.filter((v) => v.status === 'posted').length,
    rejectedCount: all.filter((v) => v.status === 'rejected' || v.status === 'sent_back').length,
    postedValueThisMonth: all
      .filter((v) => v.status === 'posted' && v.postingDate.startsWith(month))
      .reduce((s, v) => s + Math.max(v.totalDebit, v.totalCredit), 0),
    unbalancedCount: all.filter((v) => !v.isBalanced && v.status === 'draft').length,
  }
}

export async function getVoucherTabCounts(): Promise<Record<string, number>> {
  await delay()
  const counts: Record<string, number> = { all: vouchersStore.length }
  for (const v of vouchersStore) {
    counts[v.status] = (counts[v.status] ?? 0) + 1
  }
  return counts
}

export async function createVoucher(input: VoucherFormInput): Promise<AccountingVoucher> {
  await delay()
  const errors = validateVoucherInput(input)
  if (errors.length) throw new VouchersServiceError(errors[0])
  const voucher = buildFromInput(input)
  voucher.auditTrail = [{ id: genId('au'), at: nowIso(), by: currentUser(), action: 'Created' }]
  vouchersStore = [...vouchersStore, voucher]
  return clone(voucher)
}

export async function updateVoucher(id: string, input: VoucherFormInput): Promise<AccountingVoucher> {
  await delay()
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (!editableStatuses().includes(existing.status)) {
    throw new VouchersServiceError('Only draft, rejected, or sent-back vouchers can be edited')
  }
  const errors = validateVoucherInput({ ...input, voucherType: existing.voucherType })
  if (errors.length) throw new VouchersServiceError(errors[0])
  const updated = buildFromInput({ ...input, voucherType: existing.voucherType }, existing)
  if (existing.status === 'rejected' || existing.status === 'sent_back') {
    updated.status = 'draft'
    updated.rejectedReason = null
    updated.sentBackReason = null
  }
  updated.auditTrail = [
    ...existing.auditTrail,
    { id: genId('au'), at: nowIso(), by: currentUser(), action: 'Updated' },
  ]
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function deleteVoucher(id: string): Promise<void> {
  await delay()
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (existing.status !== 'draft') {
    throw new VouchersServiceError('Only draft vouchers can be deleted')
  }
  vouchersStore = vouchersStore.filter((v) => v.id !== id)
}

export async function submitVoucher(id: string): Promise<AccountingVoucher> {
  await delay()
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (!editableStatuses().includes(existing.status)) {
    throw new VouchersServiceError('Only draft, rejected, or sent-back vouchers can be submitted')
  }
  const errors = validateVoucherInput(
    {
      voucherType: existing.voucherType,
      voucherDate: existing.voucherDate,
      postingDate: existing.postingDate,
      fiscalPeriod: existing.fiscalPeriod,
      narration: existing.narration,
      referenceNo: existing.referenceNo,
      partyType: existing.partyType,
      partyId: existing.partyId,
      partyName: existing.partyName,
      partyGstin: existing.partyGstin,
      paymentMode: existing.paymentMode,
      bankAccountId: existing.bankAccountId,
      bankAccountName: existing.bankAccountName,
      chequeNo: existing.chequeNo,
      chequeDate: existing.chequeDate,
      transactionRef: existing.transactionRef,
      fromAccountId: existing.fromAccountId,
      fromAccountName: existing.fromAccountName,
      toAccountId: existing.toAccountId,
      toAccountName: existing.toAccountName,
      originalInvoiceNo: existing.originalInvoiceNo,
      originalInvoiceDate: existing.originalInvoiceDate,
      reasonCode: existing.reasonCode,
      openingBalanceAsOf: existing.openingBalanceAsOf,
      lines: existing.lines.map(({ id: _id, lineNo: _n, ...rest }) => rest),
    },
    { requireBalanced: true },
  )
  if (errors.length) throw new VouchersServiceError(errors[0])
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    status: 'pending_approval',
    submittedAt: now,
    submittedBy: user,
    updatedAt: now,
    updatedBy: user,
    rejectedReason: null,
    sentBackReason: null,
    approvalTrail: [...existing.approvalTrail, { id: genId('ae'), action: 'submitted', at: now, by: user }],
    auditTrail: [...existing.auditTrail, { id: genId('au'), at: now, by: user, action: 'Submitted for approval' }],
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function approveVoucher(id: string, comment?: string): Promise<AccountingVoucher> {
  await delay()
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (existing.status !== 'pending_approval') {
    throw new VouchersServiceError('Only pending approval vouchers can be approved')
  }
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    status: 'approved',
    approvedAt: now,
    approvedBy: user,
    updatedAt: now,
    updatedBy: user,
    approvalTrail: [
      ...existing.approvalTrail,
      { id: genId('ae'), action: 'approved', at: now, by: user, comment },
    ],
    auditTrail: [...existing.auditTrail, { id: genId('au'), at: now, by: user, action: 'Approved' }],
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function rejectVoucher(id: string, reason: string): Promise<AccountingVoucher> {
  await delay()
  if (!reason.trim()) throw new VouchersServiceError('Rejection reason is required')
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (existing.status !== 'pending_approval') {
    throw new VouchersServiceError('Only pending approval vouchers can be rejected')
  }
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    status: 'rejected',
    rejectedReason: reason.trim(),
    updatedAt: now,
    updatedBy: user,
    approvalTrail: [
      ...existing.approvalTrail,
      { id: genId('ae'), action: 'rejected', at: now, by: user, comment: reason.trim() },
    ],
    auditTrail: [...existing.auditTrail, { id: genId('au'), at: now, by: user, action: 'Rejected', detail: reason.trim() }],
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function sendBackVoucher(id: string, reason: string): Promise<AccountingVoucher> {
  await delay()
  if (!reason.trim()) throw new VouchersServiceError('Send-back reason is required')
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (existing.status !== 'pending_approval') {
    throw new VouchersServiceError('Only pending approval vouchers can be sent back')
  }
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    status: 'sent_back',
    sentBackReason: reason.trim(),
    updatedAt: now,
    updatedBy: user,
    approvalTrail: [
      ...existing.approvalTrail,
      { id: genId('ae'), action: 'sent_back', at: now, by: user, comment: reason.trim() },
    ],
    auditTrail: [...existing.auditTrail, { id: genId('au'), at: now, by: user, action: 'Sent back', detail: reason.trim() }],
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

/** Demo post — updates status only; no real GL entries. */
export async function postVoucher(id: string): Promise<AccountingVoucher> {
  await delay()
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (existing.status !== 'approved') {
    throw new VouchersServiceError('Only approved vouchers can be posted')
  }
  if (!existing.isBalanced) throw new VouchersServiceError('Cannot post unbalanced voucher')
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    status: 'posted',
    postedAt: now,
    postedBy: user,
    updatedAt: now,
    updatedBy: user,
    approvalTrail: [...existing.approvalTrail, { id: genId('ae'), action: 'posted', at: now, by: user }],
    auditTrail: [
      ...existing.auditTrail,
      {
        id: genId('au'),
        at: now,
        by: user,
        action: 'Posted (demo)',
        detail: 'Status set to Posted — no real GL posting performed',
      },
    ],
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function reverseVoucher(id: string, reason: string): Promise<AccountingVoucher> {
  await delay()
  if (!reason.trim()) throw new VouchersServiceError('Reversal reason is required')
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (existing.status !== 'posted') throw new VouchersServiceError('Only posted vouchers can be reversed')
  if (existing.reversedByVoucherId) throw new VouchersServiceError('Voucher already reversed')
  const user = currentUser()
  const now = nowIso()
  const today = now.slice(0, 10)
  const reversalLines = existing.lines.map((l, idx) => ({
    ...l,
    id: genId('vl'),
    lineNo: idx + 1,
    debit: l.credit,
    credit: l.debit,
    narration: `Reversal: ${l.narration}`,
  }))
  const sums = sumVoucherDebitCredit(reversalLines)
  const reversal: AccountingVoucher = {
    ...existing,
    id: genId('vch'),
    voucherNumber: nextVoucherNumber(existing.voucherType),
    status: 'posted',
    voucherDate: today,
    postingDate: today,
    fiscalPeriod: today.slice(0, 7),
    narration: `Reversal of ${existing.voucherNumber} — ${reason.trim()}`,
    lines: reversalLines,
    ...sums,
    createdBy: user,
    createdAt: now,
    updatedBy: user,
    updatedAt: now,
    submittedAt: now,
    submittedBy: user,
    approvedAt: now,
    approvedBy: user,
    postedAt: now,
    postedBy: user,
    reversalOfVoucherId: existing.id,
    reversalOfVoucherNumber: existing.voucherNumber,
    reversedByVoucherId: null,
    reversedByVoucherNumber: null,
    attachments: [],
    notes: [],
    approvalTrail: [{ id: genId('ae'), action: 'posted', at: now, by: user, comment: `Reversal of ${existing.voucherNumber}` }],
    auditTrail: [
      {
        id: genId('au'),
        at: now,
        by: user,
        action: 'Reversal posted (demo)',
        detail: 'Status simulation only — no real GL reversal',
      },
    ],
  }
  const original: AccountingVoucher = {
    ...existing,
    status: 'reversed',
    reversedByVoucherId: reversal.id,
    reversedByVoucherNumber: reversal.voucherNumber,
    updatedAt: now,
    updatedBy: user,
    approvalTrail: [
      ...existing.approvalTrail,
      { id: genId('ae'), action: 'reversed', at: now, by: user, comment: reason.trim() },
    ],
    auditTrail: [...existing.auditTrail, { id: genId('au'), at: now, by: user, action: 'Reversed (demo)', detail: reason.trim() }],
  }
  vouchersStore = [...vouchersStore.map((v) => (v.id === id ? original : v)), reversal]
  return clone(reversal)
}

export async function cancelVoucher(id: string, reason: string): Promise<AccountingVoucher> {
  await delay()
  if (!reason.trim()) throw new VouchersServiceError('Cancellation reason is required')
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  if (!['draft', 'rejected', 'sent_back', 'pending_approval'].includes(existing.status)) {
    throw new VouchersServiceError('Posted vouchers cannot be cancelled — use Reverse')
  }
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    status: 'cancelled',
    cancelledReason: reason.trim(),
    updatedAt: now,
    updatedBy: user,
    approvalTrail: [
      ...existing.approvalTrail,
      { id: genId('ae'), action: 'cancelled', at: now, by: user, comment: reason.trim() },
    ],
    auditTrail: [...existing.auditTrail, { id: genId('au'), at: now, by: user, action: 'Cancelled', detail: reason.trim() }],
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function addVoucherNote(id: string, body: string): Promise<AccountingVoucher> {
  await delay()
  if (!body.trim()) throw new VouchersServiceError('Note cannot be empty')
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    notes: [...existing.notes, { id: genId('note'), body: body.trim(), createdAt: now, createdBy: user }],
    updatedAt: now,
    updatedBy: user,
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function addVoucherAttachmentMeta(
  id: string,
  name: string,
  sizeKb: number,
): Promise<AccountingVoucher> {
  await delay()
  const existing = vouchersStore.find((v) => v.id === id)
  if (!existing) throw new VouchersServiceError('Voucher not found')
  const user = currentUser()
  const now = nowIso()
  const updated: AccountingVoucher = {
    ...existing,
    attachments: [
      ...existing.attachments,
      { id: genId('att'), name, sizeKb, uploadedAt: now, uploadedBy: user },
    ],
    updatedAt: now,
    updatedBy: user,
  }
  vouchersStore = vouchersStore.map((v) => (v.id === id ? updated : v))
  return clone(updated)
}

export async function getPartyOptions() {
  await delay(40)
  return clone(VOUCHER_PARTY_OPTIONS)
}

export async function getCostCentreOptions() {
  await delay(40)
  return clone(VOUCHER_COST_CENTRES)
}

export async function validateVoucherImport(fileName: string, csvText: string): Promise<VoucherImportPreview> {
  await delay(150)
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const dataLines = lines[0]?.toLowerCase().includes('voucher') ? lines.slice(1) : lines
  const rows: VoucherImportPreviewRow[] = dataLines.map((raw, idx) => {
    const cols = raw.split(',').map((c) => c.trim())
    const [voucherType = '', voucherDate = '', narration = '', accountCode = '', debit = '', credit = ''] = cols
    const messages: string[] = []
    let status: VoucherImportPreviewRow['status'] = 'ok'
    if (!voucherType) {
      messages.push('Voucher type missing')
      status = 'error'
    }
    if (!accountCode) {
      messages.push('Account code missing')
      status = 'error'
    }
    if (!debit && !credit) {
      messages.push('Debit or credit required')
      status = 'error'
    }
    if (debit && credit) {
      messages.push('Both debit and credit set')
      status = 'error'
    }
    if (!voucherDate) {
      messages.push('Date missing')
      status = status === 'error' ? 'error' : 'warning'
    }
    return {
      rowNo: idx + 1,
      voucherType,
      voucherDate,
      narration,
      accountCode,
      debit,
      credit,
      status,
      messages,
    }
  })
  return {
    fileName,
    rows,
    okCount: rows.filter((r) => r.status === 'ok').length,
    errorCount: rows.filter((r) => r.status === 'error').length,
    warningCount: rows.filter((r) => r.status === 'warning').length,
  }
}

export async function importVouchersFromPreview(preview: VoucherImportPreview): Promise<{ imported: number; message: string }> {
  await delay(200)
  if (preview.errorCount > 0) {
    throw new VouchersServiceError('Fix import errors before confirming')
  }
  // Demo: create one draft journal from valid rows grouped loosely
  const ok = preview.rows.filter((r) => r.status === 'ok')
  if (!ok.length) throw new VouchersServiceError('No valid rows to import')
  const today = new Date().toISOString().slice(0, 10)
  const lines = ok.map((r) => ({
    accountId: `coa-${r.accountCode}`,
    accountCode: r.accountCode,
    accountName: r.accountCode,
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
    narration: r.narration || 'Imported line',
  }))
  // Pad to 2 lines if needed
  while (lines.length < 2) {
    lines.push({
      accountId: 'coa-4900',
      accountCode: '4900',
      accountName: 'Other Income',
      debit: 0,
      credit: 0,
      narration: 'Import placeholder',
    })
  }
  await createVoucher({
    voucherType: 'journal',
    voucherDate: today,
    postingDate: today,
    fiscalPeriod: today.slice(0, 7),
    narration: `Imported from ${preview.fileName}`,
    lines,
  })
  return { imported: 1, message: `Created 1 draft journal from ${ok.length} line(s). Demo import — review before submit.` }
}

export async function exportVouchers(
  scope: VoucherExportScope,
  format: VoucherExportFormat,
  filter?: Partial<VoucherFilter>,
): Promise<{ fileName: string; content: string; mime: string }> {
  await delay()
  const list = scope === 'all' ? clone(vouchersStore) : await getVouchers(filter)
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'json') {
    return {
      fileName: `vouchers-${stamp}.json`,
      content: JSON.stringify(list, null, 2),
      mime: 'application/json',
    }
  }
  const header =
    'Voucher Number,Type,Date,Status,Party,Narration,Total Debit,Total Credit,Balanced,Created By'
  const rows = list.map((v) =>
    [
      v.voucherNumber,
      v.voucherType,
      v.voucherDate,
      v.status,
      JSON.stringify(v.partyName ?? ''),
      JSON.stringify(v.narration),
      v.totalDebit,
      v.totalCredit,
      v.isBalanced ? 'Y' : 'N',
      JSON.stringify(v.createdBy),
    ].join(','),
  )
  return {
    fileName: `vouchers-${stamp}.csv`,
    content: [header, ...rows].join('\n'),
    mime: 'text/csv;charset=utf-8',
  }
}

export function getVoucherImportTemplateCsv(): string {
  return [
    'Voucher Type,Voucher Date,Narration,Account Code,Debit,Credit',
    'journal,2026-07-15,Import sample,6100,1000,',
    'journal,2026-07-15,Import sample,1112,,1000',
  ].join('\n')
}

export function resetVouchersDemo(): void {
  vouchersStore = seedAccountingVouchers()
}

export { DEFAULT_VOUCHER_FILTER }
