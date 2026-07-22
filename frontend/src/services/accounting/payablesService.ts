/**
 * Accounts Payable mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT post real GL, settle vendor ledger, or trigger bank payments.
 *
 * SECURITY: All reads/writes/exports must also be enforced by the future backend
 * (tenant isolation + accounting.payables.* permissions). UI gating alone is not security.
 */

import { isApiMode } from '../../config/apiConfig'
import {
  PAYABLE_BANK_ACCOUNTS,
  PAYABLES_REPORT_CATALOG,
  seedMsmeAgeingRows,
  seedPayableDebitNotes,
  seedPayableInvoices,
  seedPayablesAudit,
  seedPayablesSetup,
  seedPayableVendors,
  seedPaymentHolds,
  seedPaymentProposals,
  seedThreeWayMatches,
  seedVendorAdvances,
  seedVendorBankDetails,
  seedVendorDisputes,
  seedVendorPayments,
} from '../../data/accounting/payablesSeed'
import {
  createLiveVendorDispute,
  getLiveVendorDisputes,
  updateLiveVendorDispute,
} from './payablesDisputeLiveService'
import type {
  PayableAgeingBucket,
  PayableAgeingResult,
  PayablesAuditEntry,
  PayableDebitNote,
  PayableExportRequest,
  PayableFilter,
  PayableInvoice,
  PayableInvoiceStatus,
  PayableLookups,
  PayablesPrintPreview,
  PayablesReportCatalogEntry,
  PayablesSetup,
  PaymentAdvicePreview,
  PaymentAllocationLine,
  PaymentAllocationPreview,
  PaymentHold,
  PaymentPlanningCriteria,
  PaymentPlanningPreview,
  PayablePriorityFlowStep,
  PayableVendor,
  PaymentAllocation,
  PaymentAllocationStatus,
  PaymentPostingPreview,
  PaymentProposal,
  PaymentProposalLine,
  PayablesDashboardData,
  ThreeWayMatchResult,
  VendorAdvance,
  VendorBankDetails,
  VendorDispute,
  VendorOutstandingSummary,
  VendorPayablesCard,
  VendorPayment,
  VendorPaymentDraftInput,
  VendorStatementPreview,
} from '../../types/payables'
import { DEFAULT_PAYABLE_FILTER, ELECTRONIC_VENDOR_PAYMENT_MODES, PAYABLE_AGEING_BUCKETS } from '../../types/payables'
import { getSessionUser } from '../../utils/permissions'

export { DEFAULT_PAYABLE_FILTER }

export class PayablesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayablesServiceError'
  }
}

const delay = () => new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 80)))

let vendorsStore = seedPayableVendors()
let invoicesStore = seedPayableInvoices()
let proposalsStore = seedPaymentProposals()
let paymentsStore = seedVendorPayments()
let advancesStore = seedVendorAdvances()
let debitNotesStore = seedPayableDebitNotes()
let disputesStore = seedVendorDisputes()
let holdsStore = seedPaymentHolds()
let bankDetailsStore = seedVendorBankDetails()
let threeWayMatchStore = seedThreeWayMatches()
let setupStore = seedPayablesSetup()
let auditStore = seedPayablesAudit()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

function computeBucket(dueDate: string, asOf: string): { overdueDays: number; bucket: PayableAgeingBucket } {
  const diff = daysBetween(dueDate, asOf)
  if (diff <= 0) return { overdueDays: 0, bucket: 'Not Due' }
  if (diff <= 30) return { overdueDays: diff, bucket: '1–30 Days' }
  if (diff <= 60) return { overdueDays: diff, bucket: '31–60 Days' }
  if (diff <= 90) return { overdueDays: diff, bucket: '61–90 Days' }
  if (diff <= 180) return { overdueDays: diff, bucket: '91–180 Days' }
  return { overdueDays: diff, bucket: 'Above 180 Days' }
}

function refreshInvoiceAgeing(asOf = new Date().toISOString().slice(0, 10)) {
  invoicesStore = invoicesStore.map((inv) => {
    if (inv.status === 'Paid' || inv.status === 'Cancelled') return inv
    const { overdueDays, bucket } = computeBucket(inv.dueDate, asOf)
    let status: PayableInvoiceStatus = inv.status
    if (inv.hasDispute) status = 'Disputed'
    else if (inv.outstandingBalance <= 0) status = 'Paid'
    else if (overdueDays > 0) status = 'Overdue'
    else if (inv.paidAmount > 0 && inv.outstandingBalance > 0) status = 'Partially Paid'
    else status = 'Open'
    return { ...inv, overdueDays, ageingBucket: bucket, status }
  })
}

function syncVendorBalances() {
  refreshInvoiceAgeing()
  vendorsStore = vendorsStore.map((v) => {
    const invs = invoicesStore.filter((i) => i.vendorId === v.id && i.outstandingBalance > 0 && i.status !== 'Cancelled')
    const outstanding = invs.reduce((s, i) => s + i.outstandingBalance, 0)
    const overdue = invs.filter((i) => i.overdueDays > 0).reduce((s, i) => s + i.outstandingBalance, 0)
    return { ...v, outstanding, overdue }
  })
}

function derivePaymentPriority(
  v: PayableVendor,
  overdueAmount: number,
  maxOverdueDays: number,
): VendorOutstandingSummary['paymentPriority'] {
  if (v.paymentHold?.status === 'Active' || v.status === 'On Hold') return 'Critical'
  if (v.msmeCategory !== 'Not MSME' && maxOverdueDays > 0) return 'MSME Priority'
  if (overdueAmount > 100_000 || maxOverdueDays > 60) return 'High'
  if (overdueAmount > 0) return 'Normal'
  return 'Low'
}

function buildOutstandingSummaries(): VendorOutstandingSummary[] {
  syncVendorBalances()
  return vendorsStore.map((v) => {
    const invs = invoicesStore.filter((i) => i.vendorId === v.id && i.outstandingBalance > 0 && i.status !== 'Cancelled')
    const totalOutstanding = invs.reduce((s, i) => s + i.outstandingBalance, 0)
    const overdueAmount = invs.filter((i) => i.overdueDays > 0).reduce((s, i) => s + i.outstandingBalance, 0)
    const currentAmount = totalOutstanding - overdueAmount
    const oldest = invs.filter((i) => i.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    const maxOverdue = invs.reduce((m, i) => Math.max(m, i.overdueDays), 0)
    const unallocated = paymentsStore
      .filter((p) => p.vendorId === v.id && p.status !== 'Reversed' && p.status !== 'Cancelled')
      .reduce((s, p) => s + p.unallocatedAmount, 0)
    const disputeAmount = disputesStore
      .filter((d) => d.vendorId === v.id && !['Resolved', 'Rejected', 'Closed'].includes(d.status))
      .reduce((s, d) => s + d.disputedAmount, 0)
    const advanceBalance = advancesStore
      .filter((a) => a.vendorId === v.id && a.status !== 'Cancelled' && a.remainingAmount > 0)
      .reduce((s, a) => s + a.remainingAmount, 0)
    const debitNoteBalance = debitNotesStore
      .filter((dn) => dn.vendorId === v.id && dn.remainingAmount > 0)
      .reduce((s, dn) => s + dn.remainingAmount, 0)
    const lastPayment = paymentsStore
      .filter((p) => p.vendorId === v.id && p.status === 'Posted')
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0]
    const utilization = v.creditLimit > 0 ? Math.round((totalOutstanding / v.creditLimit) * 1000) / 10 : 0
    const activeHold =
      v.paymentHold?.status === 'Active'
        ? v.paymentHold
        : holdsStore.find((h) => h.entityId === v.id && h.status === 'Active') ?? null
    return {
      vendorId: v.id,
      vendorCode: v.code,
      vendorName: v.name,
      category: v.category,
      gstin: v.gstin,
      creditDays: v.creditDays,
      creditLimit: v.creditLimit,
      totalOutstanding,
      currentAmount,
      overdueAmount,
      oldestDueDate: oldest?.dueDate ?? null,
      maximumOverdueDays: maxOverdue,
      unallocatedPayment: unallocated,
      creditUtilization: utilization,
      openInvoiceCount: invs.length,
      disputeAmount,
      advanceBalance,
      debitNoteBalance,
      paymentHold: !!activeHold || v.status === 'On Hold',
      holdReason: activeHold?.reason ?? null,
      paymentPriority: derivePaymentPriority(v, overdueAmount, maxOverdue),
      msme: v.msmeCategory !== 'Not MSME',
      msmeCategory: v.msmeCategory !== 'Not MSME' ? v.msmeCategory : null,
      status: v.status,
      lastPaymentDate: lastPayment?.paymentDate ?? null,
      lastPaymentAmount: lastPayment?.amount ?? 0,
      hasDispute: disputeAmount > 0,
    }
  })
}

function matchSearch(haystack: string, q: string) {
  return !q || haystack.toLowerCase().includes(q.toLowerCase())
}

function filterInvoices(filter: Partial<PayableFilter>): PayableInvoice[] {
  refreshInvoiceAgeing(filter.asOfDate || undefined)
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return invoicesStore.filter((inv) => {
    if (f.search) {
      const blob = `${inv.invoiceNumber} ${inv.vendorName} ${inv.vendorCode} ${inv.poNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.vendorId && inv.vendorId !== f.vendorId) return false
    if (f.plant && inv.plant !== f.plant) return false
    if (f.costCentre && inv.costCentre !== f.costCentre) return false
    if (f.ageingBucket && inv.ageingBucket !== f.ageingBucket) return false
    if (f.invoiceStatus && inv.status !== f.invoiceStatus) return false
    if (f.matchStatus && inv.matchStatus !== f.matchStatus) return false
    if (f.amountMin != null && inv.originalAmount < f.amountMin) return false
    if (f.amountMax != null && inv.originalAmount > f.amountMax) return false
    if (f.dueDateFrom && inv.dueDate < f.dueDateFrom) return false
    if (f.dueDateTo && inv.dueDate > f.dueDateTo) return false
    if (f.overdueStatus === 'overdue' && inv.overdueDays <= 0) return false
    if (f.overdueStatus === 'current' && inv.overdueDays > 0) return false
    if (f.overdueStatus === 'due_soon') {
      const rem = daysBetween(new Date().toISOString().slice(0, 10), inv.dueDate)
      if (rem < 0 || rem > 7 || inv.outstandingBalance <= 0) return false
    }
    const tab = f.invoiceTab
    if (tab && tab !== 'all') {
      const map: Record<string, (i: PayableInvoice) => boolean> = {
        open: (i) => i.status === 'Open',
        partially_paid: (i) => i.status === 'Partially Paid',
        overdue: (i) => i.status === 'Overdue',
        disputed: (i) => i.status === 'Disputed' || i.hasDispute,
        paid: (i) => i.status === 'Paid',
        cancelled: (i) => i.status === 'Cancelled',
      }
      if (map[tab] && !map[tab](inv)) return false
    }
    return true
  })
}

function filterOutstanding(filter: Partial<PayableFilter>): VendorOutstandingSummary[] {
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return buildOutstandingSummaries().filter((row) => {
    if (f.search) {
      const blob = `${row.vendorCode} ${row.vendorName} ${row.gstin ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.vendorId && row.vendorId !== f.vendorId) return false
    if (f.vendorCategory && row.category !== f.vendorCategory) return false
    if (f.vendorStatus && row.status !== f.vendorStatus) return false
    if (f.overdueStatus === 'overdue' && row.overdueAmount <= 0) return false
    if (f.overdueStatus === 'current' && row.overdueAmount > 0) return false
    if (f.ageingBucket) {
      const has = invoicesStore.some(
        (i) => i.vendorId === row.vendorId && i.outstandingBalance > 0 && i.ageingBucket === f.ageingBucket,
      )
      if (!has) return false
    }
    if (f.amountMin != null && row.totalOutstanding < f.amountMin) return false
    if (f.amountMax != null && row.totalOutstanding > f.amountMax) return false
    return true
  })
}

function filterPayments(filter: Partial<PayableFilter>): VendorPayment[] {
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return paymentsStore.filter((p) => {
    if (f.search) {
      const blob = `${p.paymentNumber} ${p.vendorName} ${p.transactionReference ?? ''} ${p.chequeNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.vendorId && p.vendorId !== f.vendorId) return false
    if (f.paymentMode && p.paymentMode !== f.paymentMode) return false
    if (f.allocationStatus && p.allocationStatus !== f.allocationStatus) return false
    if (f.paymentStatus && p.status !== f.paymentStatus) return false
    if (f.amountMin != null && p.amount < f.amountMin) return false
    if (f.amountMax != null && p.amount > f.amountMax) return false
    const tab = f.paymentTab
    if (tab && tab !== 'all') {
      const map: Record<string, (x: VendorPayment) => boolean> = {
        draft: (x) => x.status === 'Draft',
        submitted: (x) => x.status === 'Submitted',
        approved: (x) => x.status === 'Approved',
        posted: (x) => x.status === 'Posted',
        unallocated: (x) => x.allocationStatus === 'Unallocated',
        partially_allocated: (x) => x.allocationStatus === 'Partially Allocated',
        fully_allocated: (x) => x.allocationStatus === 'Fully Allocated',
        reversed: (x) => x.status === 'Reversed',
      }
      if (map[tab] && !map[tab](p)) return false
    }
    return true
  })
}

function filterProposals(filter: Partial<PayableFilter>): PaymentProposal[] {
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return proposalsStore.filter((p) => {
    if (f.search) {
      const blob = `${p.proposalNumber} ${p.createdBy}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.proposalStatus && p.status !== f.proposalStatus) return false
    const tab = f.proposalTab
    if (tab && tab !== 'all') {
      if (tab === 'pending_approval' && !['Submitted', 'Pending Approval'].includes(p.status)) return false
      else if (tab === 'partially_processed' && p.status !== 'Partially Processed') return false
      else if (tab === 'processed' && p.status !== 'Processed') return false
      else {
        const map: Record<string, PaymentProposal['status']> = {
          draft: 'Draft',
          submitted: 'Submitted',
          pending_approval: 'Pending Approval',
          approved: 'Approved',
          rejected: 'Rejected',
          converted: 'Converted',
          cancelled: 'Cancelled',
        }
        if (map[tab] && p.status !== map[tab]) return false
      }
    }
    return true
  })
}

function deriveAllocationStatus(paymentAmount: number, allocated: number): PaymentAllocationStatus {
  if (allocated <= 0) return 'Unallocated'
  if (allocated + 0.01 >= paymentAmount) return 'Fully Allocated'
  return 'Partially Allocated'
}

function enrichPaymentAmounts(
  net: number,
  input: Partial<VendorPaymentDraftInput>,
  vendorId: string,
): Pick<
  VendorPayment,
  | 'amount'
  | 'grossAmount'
  | 'netPayment'
  | 'otherDeductions'
  | 'bankCharges'
  | 'beneficiaryBankMasked'
  | 'currency'
  | 'exchangeRate'
  | 'tdsDeducted'
  | 'tdsSection'
  | 'tdsRate'
  | 'tdsBaseAmount'
> {
  const tds = input.tdsDeducted ?? 0
  const other = input.otherDeductions ?? 0
  const bankCharges = input.bankCharges ?? 0
  const gross = net + tds + other + bankCharges
  const bank = bankDetailsStore.find((b) => b.vendorId === vendorId)
  return {
    amount: net,
    grossAmount: gross,
    netPayment: net,
    otherDeductions: other,
    bankCharges,
    beneficiaryBankMasked: bank?.accountNumberMasked ?? null,
    currency: input.currency ?? 'INR',
    exchangeRate: input.exchangeRate ?? 1,
    tdsDeducted: tds,
    tdsSection: input.tdsSection ?? null,
    tdsRate: input.tdsRate ?? null,
    tdsBaseAmount: input.tdsBaseAmount ?? (input.tdsSection ? gross : null),
  }
}

function validatePaymentInput(input: VendorPaymentDraftInput) {
  const errors: string[] = []
  if (!input.vendorId) errors.push('Vendor is required')
  if (!input.paymentDate) errors.push('Payment Date is required')
  if (!input.postingDate) errors.push('Posting Date is required')
  if (!input.paymentMode) errors.push('Payment Mode is required')
  if (!input.bankAccountId) errors.push('Bank Account is required')
  if (!(input.amount > 0)) errors.push('Payment Amount must be greater than zero')
  if (ELECTRONIC_VENDOR_PAYMENT_MODES.includes(input.paymentMode) && !input.transactionReference?.trim()) {
    errors.push('Transaction Reference is required for electronic payment modes')
  }
  if (input.paymentMode === 'Cheque') {
    if (!input.chequeNumber?.trim()) errors.push('Cheque Number is required')
    if (!input.chequeDate) errors.push('Cheque Date is required')
  }
  return errors
}

export function resetPayablesDemo(): void {
  vendorsStore = seedPayableVendors()
  invoicesStore = seedPayableInvoices()
  proposalsStore = seedPaymentProposals()
  paymentsStore = seedVendorPayments()
  advancesStore = seedVendorAdvances()
  debitNotesStore = seedPayableDebitNotes()
  disputesStore = seedVendorDisputes()
  holdsStore = seedPaymentHolds()
  bankDetailsStore = seedVendorBankDetails()
  threeWayMatchStore = seedThreeWayMatches()
  setupStore = seedPayablesSetup()
  auditStore = seedPayablesAudit()
}

export async function getPayableLookups(): Promise<PayableLookups> {
  await delay()
  syncVendorBalances()
  return {
    vendors: vendorsStore.map((v) => ({ id: v.id, code: v.code, name: v.name })),
    vendorCategories: [...new Set(vendorsStore.map((v) => v.category))],
    vendorGroups: [...new Set(vendorsStore.map((v) => v.vendorGroup))],
    plants: [...new Set(invoicesStore.map((i) => i.plant))],
    costCentres: [...new Set(invoicesStore.map((i) => i.costCentre))],
    buyers: [...new Set(vendorsStore.map((v) => v.buyer))],
    bankAccounts: PAYABLE_BANK_ACCOUNTS,
    matchStatuses: [...new Set(invoicesStore.map((i) => i.matchStatus))],
    tdsSections: ['194C', '194J', '194Q', '194H'],
  }
}

export async function getVendorById(vendorId: string): Promise<PayableVendor> {
  await delay()
  syncVendorBalances()
  const v = vendorsStore.find((x) => x.id === vendorId)
  if (!v) throw new PayablesServiceError('Vendor not found.')
  return clone(v)
}

export async function getPayablesDashboard(): Promise<PayablesDashboardData> {
  await delay()
  syncVendorBalances()
  const outstanding = buildOutstandingSummaries()
  const openInvs = invoicesStore.filter((i) => i.outstandingBalance > 0 && i.status !== 'Cancelled')
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const monthPrefix = today.slice(0, 7)

  const totalPayables = outstanding.reduce((s, r) => s + r.totalOutstanding, 0)
  const overdueAmount = outstanding.reduce((s, r) => s + r.overdueAmount, 0)
  const currentOutstanding = totalPayables - overdueAmount
  const dueThisWeek = openInvs
    .filter((i) => i.dueDate >= today && i.dueDate <= weekEndStr)
    .reduce((s, i) => s + i.outstandingBalance, 0)
  const paymentsThisMonth = paymentsStore
    .filter((p) => p.paymentDate.startsWith(monthPrefix) && p.status === 'Posted')
    .reduce((s, p) => s + p.amount, 0)
  const proposalsPendingApproval = proposalsStore.filter((p) => p.status === 'Submitted' || p.status === 'Pending Approval').length
  const advancesOutstanding = advancesStore
    .filter((a) => a.status !== 'Cancelled' && a.remainingAmount > 0)
    .reduce((s, a) => s + a.remainingAmount, 0)
  const disputedAmount = disputesStore
    .filter((d) => !['Resolved', 'Rejected', 'Closed'].includes(d.status))
    .reduce((s, d) => s + d.disputedAmount, 0)
  const unallocatedPayments = paymentsStore
    .filter((p) => p.unallocatedAmount > 0 && p.status === 'Posted')
    .reduce((s, p) => s + p.unallocatedAmount, 0)
  const invoicesOnHold = invoicesStore.filter((i) => i.paymentHold?.status === 'Active').length
  const tdsPayable = paymentsStore
    .filter((p) => p.status === 'Posted')
    .reduce((s, p) => s + p.tdsDeducted, 0)
  const matchDifferences = invoicesStore.filter(
    (i) => !['Fully Matched', 'Within Tolerance', 'Override Approved'].includes(i.matchStatus) && i.outstandingBalance > 0,
  ).length
  const msmePaymentsDue = invoicesStore.filter(
    (i) => i.msmeVendor && i.outstandingBalance > 0 && i.overdueDays > 0,
  ).reduce((s, i) => s + i.outstandingBalance, 0)
  const vendorsBlockedForPayment = vendorsStore.filter(
    (v) => v.status === 'On Hold' || v.paymentHold?.status === 'Active' || v.bankVerificationStatus === 'Rejected',
  ).length

  const ageingChart = PAYABLE_AGEING_BUCKETS.map((bucket) => {
    const match = openInvs.filter((i) => i.ageingBucket === bucket)
    return { bucket, amount: match.reduce((s, i) => s + i.outstandingBalance, 0), count: match.length }
  })

  const overdueCount = openInvs.filter((i) => i.overdueDays > 0).length
  const draftProposals = proposalsStore.filter((p) => p.status === 'Draft').length
  const unallocPayments = paymentsStore.filter((p) => p.unallocatedAmount > 0 && p.status === 'Posted').length
  const matchPending = openInvs.filter(
    (i) =>
      i.matchStatus === 'Pending Verification' ||
      i.matchStatus === 'Quantity Mismatch' ||
      i.matchStatus === 'Rate Mismatch' ||
      i.matchStatus === 'Amount Mismatch' ||
      i.matchStatus === 'Missing GRN' ||
      i.matchStatus === 'Missing PO',
  ).length
  const vendorsWithBalance = outstanding.filter((r) => r.totalOutstanding > 0).length
  const paymentDrafts = paymentsStore.filter((p) => p.status === 'Draft' || p.status === 'Approved').length
  const postingReady = paymentsStore.filter(
    (p) => (p.status === 'Approved' || p.status === 'Posted') && p.allocatedAmount > 0,
  ).length

  // Core flow: Invoice/Match → Outstanding → Planning → Proposal → Payment → Allocation → Ledger
  const priorityFlow: PayablePriorityFlowStep[] = [
    {
      id: 'verify_match',
      label: 'Invoice & Match',
      description: 'Verify purchase invoices and three-way match before payment',
      count: matchPending || overdueCount,
      href: '/accounting/payables/invoices?tab=mismatch',
      ctaLabel: 'Review invoices',
    },
    {
      id: 'vendor_outstanding',
      label: 'Vendor Outstanding',
      description: 'Primary — open vendor balances and payment priority',
      count: vendorsWithBalance,
      href: '/accounting/payables/outstanding',
      ctaLabel: 'Open outstanding',
    },
    {
      id: 'payment_planning',
      label: 'Payment Planning',
      description: 'Primary — select invoices and build the payment run',
      count: draftProposals,
      href: '/accounting/payables/payment-planning',
      ctaLabel: 'Plan payments',
    },
    {
      id: 'proposal_approval',
      label: 'Proposal Approval',
      description: 'Approve the payment proposal before creating drafts',
      count: proposalsPendingApproval,
      href: '/accounting/payables/payment-proposals?tab=submitted',
      ctaLabel: 'Approve proposals',
    },
    {
      id: 'vendor_payment',
      label: 'Vendor Payment',
      description: 'Capture bank/cheque payment and TDS',
      count: paymentDrafts,
      href: '/accounting/payables/payments',
      ctaLabel: 'Open payments',
    },
    {
      id: 'invoice_allocation',
      label: 'Invoice Allocation',
      description: 'Primary — apply payment to open invoices',
      count: unallocPayments,
      href: '/accounting/payables/allocations',
      ctaLabel: 'Allocate invoices',
    },
    {
      id: 'posting_ledger',
      label: 'Posting & Ledger',
      description: 'Demo posting preview, then ledger/bank review',
      count: postingReady,
      href: '/accounting/ledger-entries',
      ctaLabel: 'View ledger',
    },
  ]

  const alerts: PayablesDashboardData['alerts'] = []
  outstanding
    .filter((r) => r.status === 'On Hold')
    .forEach((r) =>
      alerts.push({
        id: `alert-hold-${r.vendorId}`,
        type: 'vendor_hold',
        severity: 'critical',
        title: `${r.vendorName} on hold`,
        description: 'Vendor payments blocked — resolve dispute or release hold',
        href: `/accounting/payables/outstanding?vendorId=${r.vendorId}`,
      }),
    )
  openInvs
    .filter((i) => i.overdueDays > 60)
    .slice(0, 4)
    .forEach((i) =>
      alerts.push({
        id: `alert-overdue-${i.id}`,
        type: 'long_overdue',
        severity: 'critical',
        title: `Long overdue ${i.invoiceNumber}`,
        description: `${i.vendorName} — ${i.overdueDays} days`,
        href: `/accounting/payables/invoice/${i.id}`,
      }),
    )
  proposalsStore
    .filter((p) => p.status === 'Submitted')
    .forEach((p) =>
      alerts.push({
        id: `alert-proposal-${p.id}`,
        type: 'proposal_pending',
        severity: 'warning',
        title: `Proposal ${p.proposalNumber} awaiting approval`,
        description: `₹${p.totalAmount.toLocaleString('en-IN')} — ${p.invoiceCount} invoices`,
        href: `/accounting/payables/payment-proposals/${p.id}`,
      }),
    )
  paymentsStore
    .filter((p) => p.unallocatedAmount > 0 && p.status === 'Posted')
    .slice(0, 3)
    .forEach((p) =>
      alerts.push({
        id: `alert-unalloc-${p.id}`,
        type: 'unallocated_payment',
        severity: 'info',
        title: `Unallocated ${p.paymentNumber}`,
        description: `${p.vendorName} — ₹${p.unallocatedAmount.toLocaleString('en-IN')}`,
        href: `/accounting/payables/allocations?paymentId=${p.id}`,
      }),
    )

  const paymentTrend: PayablesDashboardData['paymentTrend'] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const prefix = d.toISOString().slice(0, 7)
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    paymentTrend.push({
      month: label,
      invoiced: invoicesStore.filter((inv) => inv.invoiceDate.startsWith(prefix)).reduce((s, inv) => s + inv.originalAmount, 0),
      paid: paymentsStore
        .filter((p) => p.paymentDate.startsWith(prefix) && p.status === 'Posted')
        .reduce((s, p) => s + p.amount, 0),
    })
  }

  return {
    kpis: {
      totalPayables,
      currentOutstanding,
      overdueAmount,
      dueThisWeek,
      paymentsThisMonth,
      proposalsPendingApproval,
      advancesOutstanding,
      disputedAmount,
      unallocatedPayments,
      invoicesOnHold,
      tdsPayable,
      matchDifferences,
      msmePaymentsDue,
      vendorsBlockedForPayment,
    },
    priorityFlow,
    ageingChart,
    topVendors: outstanding.filter((r) => r.totalOutstanding > 0).sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 8),
    dueSoonInvoices: openInvs
      .filter((i) => i.dueDate >= today && i.dueDate <= weekEndStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8),
    alerts,
    paymentTrend,
    recentPayments: [...paymentsStore].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).slice(0, 6),
    pendingProposals: proposalsStore.filter(
      (p) => p.status === 'Submitted' || p.status === 'Pending Approval' || p.status === 'Approved',
    ),
  }
}

export async function getVendorOutstanding(filter: Partial<PayableFilter> = {}): Promise<VendorOutstandingSummary[]> {
  await delay()
  return clone(filterOutstanding(filter))
}

export async function getPayableInvoices(filter: Partial<PayableFilter> = {}): Promise<PayableInvoice[]> {
  await delay()
  return clone(filterInvoices(filter))
}

export async function getPayableInvoiceById(invoiceId: string): Promise<PayableInvoice> {
  await delay()
  refreshInvoiceAgeing()
  const inv = invoicesStore.find((i) => i.id === invoiceId)
  if (!inv) throw new PayablesServiceError('Payable invoice not found.')
  return clone(inv)
}

export async function getPayablesAgeing(filter: Partial<PayableFilter> = {}): Promise<PayableAgeingResult> {
  await delay()
  const asOf = filter.asOfDate || new Date().toISOString().slice(0, 10)
  const basis = filter.ageingBasis || 'Due Date'
  refreshInvoiceAgeing(asOf)
  const openInvs = invoicesStore.filter((i) => i.outstandingBalance > 0 && i.status !== 'Cancelled')

  const vendorWise = vendorsStore
    .map((v) => {
      const invs = openInvs.filter((i) => i.vendorId === v.id)
      const bucketAmt = (b: PayableAgeingBucket) =>
        invs
          .filter((i) => {
            const dateField = basis === 'Invoice Date' ? i.invoiceDate : basis === 'Posting Date' ? i.postingDate : i.dueDate
            return computeBucket(dateField, asOf).bucket === b
          })
          .reduce((s, i) => s + i.outstandingBalance, 0)
      const total = invs.reduce((s, i) => s + i.outstandingBalance, 0)
      if (total <= 0) return null
      return {
        vendorId: v.id,
        vendorName: v.name,
        creditLimit: v.creditLimit,
        notDue: bucketAmt('Not Due'),
        d1to30: bucketAmt('1–30 Days'),
        d31to60: bucketAmt('31–60 Days'),
        d61to90: bucketAmt('61–90 Days'),
        d91to180: bucketAmt('91–180 Days'),
        above180: bucketAmt('Above 180 Days'),
        totalOutstanding: total,
      }
    })
    .filter(Boolean) as PayableAgeingResult['vendorWise']

  const summary = {
    totalOutstanding: openInvs.reduce((s, i) => s + i.outstandingBalance, 0),
    notDue: openInvs.filter((i) => i.ageingBucket === 'Not Due').reduce((s, i) => s + i.outstandingBalance, 0),
    d1to30: openInvs.filter((i) => i.ageingBucket === '1–30 Days').reduce((s, i) => s + i.outstandingBalance, 0),
    d31to60: openInvs.filter((i) => i.ageingBucket === '31–60 Days').reduce((s, i) => s + i.outstandingBalance, 0),
    d61to90: openInvs.filter((i) => i.ageingBucket === '61–90 Days').reduce((s, i) => s + i.outstandingBalance, 0),
    above90: openInvs
      .filter((i) => i.ageingBucket === '91–180 Days' || i.ageingBucket === 'Above 180 Days')
      .reduce((s, i) => s + i.outstandingBalance, 0),
  }

  return clone({
    asOfDate: asOf,
    ageingBasis: basis,
    summary,
    vendorWise,
    msmeWise: seedMsmeAgeingRows(),
    invoiceWise: openInvs,
  })
}

export async function getPaymentProposals(filter: Partial<PayableFilter> = {}): Promise<PaymentProposal[]> {
  await delay()
  return clone(filterProposals(filter))
}

export async function getPaymentProposalById(id: string): Promise<PaymentProposal> {
  await delay()
  const p = proposalsStore.find((x) => x.id === id)
  if (!p) throw new PayablesServiceError('Payment proposal not found.')
  return clone(p)
}

export async function submitPaymentProposal(id: string): Promise<PaymentProposal> {
  await delay()
  const idx = proposalsStore.findIndex((p) => p.id === id)
  if (idx < 0) throw new PayablesServiceError('Payment proposal not found.')
  if (proposalsStore[idx].status !== 'Draft') {
    throw new PayablesServiceError('Only draft proposals can be submitted.')
  }
  proposalsStore[idx] = {
    ...proposalsStore[idx],
    status: 'Submitted',
    submittedAt: new Date().toISOString(),
  }
  return clone(proposalsStore[idx])
}

export async function approvePaymentProposal(id: string): Promise<PaymentProposal> {
  await delay()
  const idx = proposalsStore.findIndex((p) => p.id === id)
  if (idx < 0) throw new PayablesServiceError('Payment proposal not found.')
  if (proposalsStore[idx].status !== 'Submitted' && proposalsStore[idx].status !== 'Pending Approval') {
    throw new PayablesServiceError('Only submitted proposals can be approved.')
  }
  const user = getSessionUser()
  proposalsStore[idx] = {
    ...proposalsStore[idx],
    status: 'Approved',
    approvedBy: user.name,
    approvedAt: new Date().toISOString(),
  }
  return clone(proposalsStore[idx])
}

export async function rejectPaymentProposal(id: string, reason: string): Promise<PaymentProposal> {
  await delay()
  const idx = proposalsStore.findIndex((p) => p.id === id)
  if (idx < 0) throw new PayablesServiceError('Payment proposal not found.')
  if (proposalsStore[idx].status !== 'Submitted') {
    throw new PayablesServiceError('Only submitted proposals can be rejected.')
  }
  proposalsStore[idx] = {
    ...proposalsStore[idx],
    status: 'Rejected',
    rejectionReason: reason,
  }
  return clone(proposalsStore[idx])
}

export async function createPaymentProposalFromInvoices(
  invoiceIds: string[],
  proposedDate: string,
): Promise<PaymentProposal> {
  await delay()
  refreshInvoiceAgeing()
  const lines: PaymentProposalLine[] = []
  for (const invoiceId of invoiceIds) {
    const inv = invoicesStore.find((i) => i.id === invoiceId)
    if (!inv || inv.outstandingBalance <= 0) continue
    lines.push({
      id: `ppl-${Date.now()}-${lines.length}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorId: inv.vendorId,
      vendorName: inv.vendorName,
      dueDate: inv.dueDate,
      outstanding: inv.outstandingBalance,
      proposedAmount: inv.outstandingBalance,
      selected: true,
    })
  }
  if (lines.length === 0) throw new PayablesServiceError('No open invoices selected for proposal.')
  const user = getSessionUser()
  const seq = proposalsStore.length + 1
  const proposal: PaymentProposal = {
    id: `aprop-${Date.now()}`,
    proposalNumber: `PP-DRAFT-${String(seq).padStart(4, '0')}`,
    status: 'Draft',
    proposedPaymentDate: proposedDate,
    totalAmount: lines.reduce((s, l) => s + l.proposedAmount, 0),
    vendorCount: new Set(lines.map((l) => l.vendorId)).size,
    invoiceCount: lines.length,
    lines,
    createdBy: user.name,
    approvedBy: null,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
    submittedAt: null,
    approvedAt: null,
  }
  proposalsStore = [proposal, ...proposalsStore]
  return clone(proposal)
}

export async function getVendorPayments(filter: Partial<PayableFilter> = {}): Promise<VendorPayment[]> {
  await delay()
  return clone(filterPayments(filter))
}

export async function getVendorPaymentById(paymentId: string): Promise<VendorPayment> {
  await delay()
  const p = paymentsStore.find((x) => x.id === paymentId)
  if (!p) throw new PayablesServiceError('Vendor payment not found.')
  return clone(p)
}

export async function createVendorPayment(input: VendorPaymentDraftInput): Promise<VendorPayment> {
  await delay()
  const errors = validatePaymentInput(input)
  if (errors.length) throw new PayablesServiceError(errors.join('; '))
  const vendor = vendorsStore.find((v) => v.id === input.vendorId)
  if (!vendor) throw new PayablesServiceError('Vendor not found.')
  const bank = PAYABLE_BANK_ACCOUNTS.find((b) => b.id === input.bankAccountId)
  if (!bank) throw new PayablesServiceError('Bank account not found.')
  const net = input.amount
  const allocationLines: PaymentAllocationLine[] = []
  let allocated = 0
  for (const line of input.allocationLines ?? []) {
    const inv = invoicesStore.find((i) => i.id === line.invoiceId)
    if (!inv) continue
    const amount = Math.min(line.allocationAmount, inv.outstandingBalance, net - allocated)
    if (amount <= 0) continue
    allocationLines.push({
      id: `pal-${Date.now()}-${allocationLines.length}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      originalAmount: inv.originalAmount,
      previousAllocation: inv.paidAmount,
      outstandingBalance: inv.outstandingBalance,
      overdueDays: inv.overdueDays,
      tdsDeducted: line.tdsDeducted ?? 0,
      allocationAmount: amount,
      remainingBalance: inv.outstandingBalance - amount,
      status: amount >= inv.outstandingBalance ? 'Fully Allocated' : 'Partial',
    })
    allocated += amount
  }
  const user = getSessionUser()
  const seq = paymentsStore.length + 1
  const payment: VendorPayment = {
    id: `apay-${Date.now()}`,
    paymentNumber: `PAY-DRAFT-${String(seq).padStart(4, '0')}`,
    status: 'Draft',
    vendorId: vendor.id,
    vendorCode: vendor.code,
    vendorName: vendor.name,
    paymentDate: input.paymentDate,
    postingDate: input.postingDate,
    paymentMode: input.paymentMode,
    bankAccountId: bank.id,
    bankAccountName: bank.name,
    transactionReference: input.transactionReference ?? null,
    chequeNumber: input.chequeNumber ?? null,
    chequeDate: input.chequeDate ?? null,
    ...enrichPaymentAmounts(net, input, vendor.id),
    unallocatedAmount: Math.max(0, net - allocated),
    allocatedAmount: allocated,
    allocationStatus: deriveAllocationStatus(net, allocated),
    allocationLines,
    voucherId: null,
    voucherNumber: null,
    ledgerEntryIds: null,
    narration: input.narration ?? '',
    internalRemarks: input.internalRemarks ?? '',
    createdBy: user.name,
    approvedBy: null,
    postedBy: null,
    postedAt: null,
    proposalId: null,
  }
  paymentsStore = [payment, ...paymentsStore]
  return clone(payment)
}

export async function updateVendorPayment(
  paymentId: string,
  input: Partial<VendorPaymentDraftInput> & { status?: VendorPayment['status'] },
): Promise<VendorPayment> {
  await delay()
  const idx = paymentsStore.findIndex((p) => p.id === paymentId)
  if (idx < 0) throw new PayablesServiceError('Vendor payment not found.')
  const existing = paymentsStore[idx]
  if (existing.status === 'Posted' || existing.status === 'Reversed') {
    throw new PayablesServiceError('Posted or reversed payments cannot be edited.')
  }
  const merged: VendorPaymentDraftInput = {
    paymentDate: input.paymentDate ?? existing.paymentDate,
    postingDate: input.postingDate ?? existing.postingDate,
    vendorId: input.vendorId ?? existing.vendorId,
    paymentMode: input.paymentMode ?? existing.paymentMode,
    bankAccountId: input.bankAccountId ?? existing.bankAccountId,
    transactionReference: input.transactionReference ?? existing.transactionReference,
    chequeNumber: input.chequeNumber ?? existing.chequeNumber,
    chequeDate: input.chequeDate ?? existing.chequeDate,
    amount: input.amount ?? existing.amount,
    tdsDeducted: input.tdsDeducted ?? existing.tdsDeducted,
    otherDeductions: input.otherDeductions ?? existing.otherDeductions,
    bankCharges: input.bankCharges ?? existing.bankCharges,
    currency: input.currency ?? existing.currency,
    exchangeRate: input.exchangeRate ?? existing.exchangeRate,
    tdsSection: input.tdsSection ?? existing.tdsSection,
    tdsRate: input.tdsRate ?? existing.tdsRate,
    tdsBaseAmount: input.tdsBaseAmount ?? existing.tdsBaseAmount,
    narration: input.narration ?? existing.narration,
    internalRemarks: input.internalRemarks ?? existing.internalRemarks,
    allocationLines: input.allocationLines,
  }
  const errors = validatePaymentInput(merged)
  if (errors.length) throw new PayablesServiceError(errors.join('; '))
  const vendor = vendorsStore.find((v) => v.id === merged.vendorId)!
  const bank = PAYABLE_BANK_ACCOUNTS.find((b) => b.id === merged.bankAccountId)!
  const net = merged.amount
  let allocationLines = existing.allocationLines
  let allocated = existing.allocatedAmount
  if (merged.allocationLines) {
    allocationLines = []
    allocated = 0
    for (const line of merged.allocationLines) {
      const inv = invoicesStore.find((i) => i.id === line.invoiceId)
      if (!inv) continue
      const amount = Math.min(line.allocationAmount, inv.outstandingBalance, net - allocated)
      if (amount <= 0) continue
      allocationLines.push({
        id: `pal-${Date.now()}-${allocationLines.length}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        originalAmount: inv.originalAmount,
        previousAllocation: inv.paidAmount,
        outstandingBalance: inv.outstandingBalance,
        overdueDays: inv.overdueDays,
        tdsDeducted: line.tdsDeducted ?? 0,
        allocationAmount: amount,
        remainingBalance: inv.outstandingBalance - amount,
        status: amount >= inv.outstandingBalance ? 'Fully Allocated' : 'Partial',
      })
      allocated += amount
    }
  }
  const updated: VendorPayment = {
    ...existing,
    ...merged,
    vendorCode: vendor.code,
    vendorName: vendor.name,
    bankAccountName: bank.name,
    ...enrichPaymentAmounts(net, merged, merged.vendorId),
    unallocatedAmount: Math.max(0, net - allocated),
    allocatedAmount: allocated,
    allocationStatus: deriveAllocationStatus(net, allocated),
    allocationLines,
    status: input.status ?? existing.status,
  }
  paymentsStore[idx] = updated
  return clone(updated)
}

export async function submitVendorPayment(paymentId: string): Promise<VendorPayment> {
  await delay()
  const idx = paymentsStore.findIndex((p) => p.id === paymentId)
  if (idx < 0) throw new PayablesServiceError('Vendor payment not found.')
  if (paymentsStore[idx].status !== 'Draft') {
    throw new PayablesServiceError('Only draft payments can be submitted.')
  }
  paymentsStore[idx] = { ...paymentsStore[idx], status: 'Submitted' }
  return clone(paymentsStore[idx])
}

export async function approveVendorPayment(paymentId: string): Promise<VendorPayment> {
  await delay()
  const idx = paymentsStore.findIndex((p) => p.id === paymentId)
  if (idx < 0) throw new PayablesServiceError('Vendor payment not found.')
  if (paymentsStore[idx].status !== 'Submitted') {
    throw new PayablesServiceError('Only submitted payments can be approved.')
  }
  const user = getSessionUser()
  paymentsStore[idx] = { ...paymentsStore[idx], status: 'Approved', approvedBy: user.name }
  return clone(paymentsStore[idx])
}

export async function getPaymentPostingPreview(paymentId: string): Promise<PaymentPostingPreview> {
  await delay()
  const p = await getVendorPaymentById(paymentId)
  const warnings: string[] = []
  if (p.allocationStatus === 'Partially Allocated' || p.allocationStatus === 'Unallocated') {
    warnings.push('Payment is partially or fully unallocated')
  }
  const vendor = vendorsStore.find((v) => v.id === p.vendorId)
  if (vendor?.status === 'On Hold') warnings.push('Vendor is on payment hold')
  if (p.tdsDeducted > 0 && !p.narration.toLowerCase().includes('tds')) {
    warnings.push('TDS details incomplete in narration')
  }

  const lines: PaymentPostingPreview['lines'] = [
    {
      account: '2111 — Trade Creditors',
      debit: p.allocatedAmount + p.unallocatedAmount,
      credit: 0,
      narration: `Vendor payment — ${p.vendorName}`,
    },
    {
      account: p.bankAccountName,
      debit: 0,
      credit: p.amount - p.tdsDeducted,
      narration: `${p.paymentMode} disbursement`,
    },
  ]
  if (p.tdsDeducted > 0) {
    lines.push({
      account: '2140 — TDS Payable',
      debit: 0,
      credit: p.tdsDeducted,
      narration: 'TDS deducted u/s 194C',
    })
  }

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01
  const seq = paymentsStore.filter((x) => x.status === 'Posted').length + 1

  return {
    paymentNumber: p.paymentNumber,
    vendorName: p.vendorName,
    paymentAmount: p.amount,
    allocatedAmount: p.allocatedAmount,
    unallocatedAmount: p.unallocatedAmount,
    bankAccountName: p.bankAccountName,
    vendorControlAccount: '2111 — Trade Creditors',
    tdsAmount: p.tdsDeducted,
    postingDate: p.postingDate,
    lines,
    balanced,
    voucherNumber: `PAY-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`,
    message: balanced
      ? 'Demo posting preview — balanced. Backend GL posting is not connected.'
      : 'Demo posting preview — entries are not balanced.',
    warnings,
  }
}

export async function postVendorPayment(paymentId: string): Promise<VendorPayment> {
  await delay()
  const idx = paymentsStore.findIndex((p) => p.id === paymentId)
  if (idx < 0) throw new PayablesServiceError('Vendor payment not found.')
  const existing = paymentsStore[idx]
  if (existing.status === 'Posted') throw new PayablesServiceError('Payment is already posted (demo).')
  if (existing.status === 'Reversed') throw new PayablesServiceError('Reversed payments cannot be posted.')
  const preview = await getPaymentPostingPreview(paymentId)
  const user = getSessionUser()
  const seq = paymentsStore.filter((p) => p.status === 'Posted').length + 1
  const posted: VendorPayment = {
    ...existing,
    paymentNumber: existing.paymentNumber.startsWith('PAY-DRAFT')
      ? `PAY-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`
      : existing.paymentNumber,
    status: 'Posted',
    postedBy: user.name,
    postedAt: new Date().toISOString(),
    voucherId: `voucher-demo-${Date.now()}`,
    voucherNumber: preview.voucherNumber,
    ledgerEntryIds: [`gle-pay-demo-${Date.now()}-dr`, `gle-pay-demo-${Date.now()}-cr`],
  }
  for (const line of posted.allocationLines) {
    const invIdx = invoicesStore.findIndex((i) => i.id === line.invoiceId)
    if (invIdx < 0) continue
    const inv = invoicesStore[invIdx]
    const paid = inv.paidAmount + line.allocationAmount
    const bal = Math.max(0, inv.originalAmount - paid - inv.debitNoteAmount)
    invoicesStore[invIdx] = {
      ...inv,
      paidAmount: paid,
      outstandingBalance: bal,
      status: bal <= 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : inv.status,
    }
  }
  paymentsStore[idx] = posted
  syncVendorBalances()
  return clone(posted)
}

export async function getPaymentAllocations(filter: Partial<PayableFilter> = {}): Promise<PaymentAllocation[]> {
  await delay()
  const payments = filterPayments(filter).filter((p) => p.status !== 'Cancelled' && p.status !== 'Reversed')
  return clone(
    payments.map((p) => ({
      paymentId: p.id,
      lines: p.allocationLines,
      paymentAmount: p.amount,
      tdsDeducted: p.tdsDeducted,
      amountAvailable: p.amount,
      allocatedAmount: p.allocatedAmount,
      unallocatedAmount: p.unallocatedAmount,
      allocationStatus: p.allocationStatus,
    })),
  )
}

export async function allocatePayment(
  paymentId: string,
  lines: { invoiceId: string; allocationAmount: number; tdsDeducted?: number }[],
): Promise<VendorPayment> {
  await delay()
  return updateVendorPayment(paymentId, { allocationLines: lines })
}

export async function allocatePaymentDemo(
  paymentId: string,
  lines: { invoiceId: string; allocationAmount: number; tdsDeducted?: number }[],
): Promise<VendorPayment> {
  return allocatePayment(paymentId, lines)
}

export async function getThreeWayMatch(invoiceId: string): Promise<ThreeWayMatchResult> {
  await delay()
  const match = threeWayMatchStore.find((m) => m.invoiceId === invoiceId)
  if (!match) {
    const inv = invoicesStore.find((i) => i.id === invoiceId)
    if (!inv) throw new PayablesServiceError('Payable invoice not found.')
    return clone({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorName: inv.vendorName,
      poNumber: inv.poNumber,
      grnNumber: inv.grnNumber,
      overallStatus: inv.matchStatus,
      lines: [],
      totalDifference: 0,
      toleranceAmount: setupStore.general.autoMatchToleranceAmount,
      withinTolerance: inv.matchStatus === 'Fully Matched' || inv.matchStatus === 'Within Tolerance',
      verifiedBy: null,
      verifiedAt: null,
    })
  }
  return clone(match)
}

export async function getPaymentPlanningPreview(criteria: PaymentPlanningCriteria): Promise<PaymentPlanningPreview> {
  await delay()
  refreshInvoiceAgeing()
  const today = new Date().toISOString().slice(0, 10)
  const warnings: string[] = []
  let candidates = invoicesStore.filter((i) => i.outstandingBalance > 0 && i.status !== 'Cancelled')

  if (criteria.excludeOnHold) {
    candidates = candidates.filter((i) => !i.paymentHold || i.paymentHold.status !== 'Active')
  }
  if (criteria.excludeDisputed) {
    candidates = candidates.filter((i) => !i.hasDispute && i.status !== 'Disputed')
  }
  if (criteria.vendorIds.length) {
    candidates = candidates.filter((i) => criteria.vendorIds.includes(i.vendorId))
  }
  if (criteria.minimumInvoiceAmount != null) {
    candidates = candidates.filter((i) => i.outstandingBalance >= criteria.minimumInvoiceAmount!)
  }
  if (!criteria.includeOverdue) {
    candidates = candidates.filter((i) => i.overdueDays <= 0)
  }
  if (criteria.includeDueWithinDays >= 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + criteria.includeDueWithinDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    candidates = candidates.filter((i) => i.dueDate <= cutoffStr || (criteria.includeOverdue && i.overdueDays > 0))
  }

  const sortFns: Record<PaymentPlanningCriteria['priority'], (a: PayableInvoice, b: PayableInvoice) => number> = {
    'MSME First': (a, b) => Number(b.msmeVendor) - Number(a.msmeVendor) || a.dueDate.localeCompare(b.dueDate),
    'Overdue First': (a, b) => b.overdueDays - a.overdueDays || a.dueDate.localeCompare(b.dueDate),
    'Due Date': (a, b) => a.dueDate.localeCompare(b.dueDate),
    'Amount Descending': (a, b) => b.outstandingBalance - a.outstandingBalance,
    'Vendor Priority': (a, b) => a.vendorName.localeCompare(b.vendorName) || a.dueDate.localeCompare(b.dueDate),
  }
  candidates.sort(sortFns[criteria.priority])

  const lines: PaymentPlanningPreview['lines'] = []
  let running = 0
  for (const inv of candidates) {
    const vendor = vendorsStore.find((v) => v.id === inv.vendorId)
    if (vendor?.status === 'On Hold' && criteria.excludeOnHold) continue
    if (vendor?.bankVerificationStatus === 'Rejected') {
      warnings.push(`${inv.vendorName} bank verification rejected — skipped`)
      continue
    }
    const proposed = inv.outstandingBalance
    if (criteria.maxPaymentAmount != null && running + proposed > criteria.maxPaymentAmount) continue
    lines.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      vendorId: inv.vendorId,
      vendorName: inv.vendorName,
      dueDate: inv.dueDate,
      outstanding: inv.outstandingBalance,
      proposedAmount: proposed,
      msmeVendor: inv.msmeVendor,
      overdueDays: inv.overdueDays,
      paymentHold: !!inv.paymentHold && inv.paymentHold.status === 'Active',
      selected: true,
    })
    running += proposed
  }

  if (criteria.msmePriority && lines.some((l) => l.msmeVendor)) {
    warnings.push('MSME vendors prioritized per setup configuration')
  }
  if (lines.length === 0) warnings.push('No invoices matched the planning criteria')

  return clone({
    criteria,
    proposedPaymentDate: criteria.paymentDate || today,
    totalProposed: running,
    vendorCount: new Set(lines.map((l) => l.vendorId)).size,
    invoiceCount: lines.length,
    msmeAmount: lines.filter((l) => l.msmeVendor).reduce((s, l) => s + l.proposedAmount, 0),
    overdueAmount: lines.filter((l) => l.overdueDays > 0).reduce((s, l) => s + l.proposedAmount, 0),
    lines,
    warnings,
  })
}

export async function createPaymentProposal(
  invoiceIds: string[],
  proposedDate: string,
): Promise<PaymentProposal> {
  return createPaymentProposalFromInvoices(invoiceIds, proposedDate)
}

export async function updatePaymentProposal(
  id: string,
  patch: Partial<Pick<PaymentProposal, 'proposedPaymentDate' | 'lines'>> & { lineSelections?: Record<string, boolean> },
): Promise<PaymentProposal> {
  await delay()
  const idx = proposalsStore.findIndex((p) => p.id === id)
  if (idx < 0) throw new PayablesServiceError('Payment proposal not found.')
  if (!['Draft', 'Rejected'].includes(proposalsStore[idx].status)) {
    throw new PayablesServiceError('Only draft or rejected proposals can be edited.')
  }
  let lines = patch.lines ?? proposalsStore[idx].lines
  if (patch.lineSelections) {
    lines = lines.map((l) => ({ ...l, selected: patch.lineSelections![l.id] ?? l.selected }))
  }
  const selected = lines.filter((l) => l.selected)
  proposalsStore[idx] = {
    ...proposalsStore[idx],
    proposedPaymentDate: patch.proposedPaymentDate ?? proposalsStore[idx].proposedPaymentDate,
    lines,
    totalAmount: selected.reduce((s, l) => s + l.proposedAmount, 0),
    vendorCount: new Set(selected.map((l) => l.vendorId)).size,
    invoiceCount: selected.length,
  }
  return clone(proposalsStore[idx])
}

export async function createPaymentDraftsDemo(proposalId: string): Promise<VendorPayment[]> {
  await delay()
  const proposal = proposalsStore.find((p) => p.id === proposalId)
  if (!proposal) throw new PayablesServiceError('Payment proposal not found.')
  if (!['Approved', 'Partially Processed'].includes(proposal.status)) {
    throw new PayablesServiceError('Only approved proposals can generate payment drafts.')
  }
  const selected = proposal.lines.filter((l) => l.selected)
  const byVendor = new Map<string, PaymentProposalLine[]>()
  for (const line of selected) {
    const arr = byVendor.get(line.vendorId) ?? []
    arr.push(line)
    byVendor.set(line.vendorId, arr)
  }
  const created: VendorPayment[] = []
  for (const [vendorId, lines] of byVendor) {
    const total = lines.reduce((s, l) => s + l.proposedAmount, 0)
    const payment = await createVendorPayment({
      paymentDate: proposal.proposedPaymentDate,
      postingDate: proposal.proposedPaymentDate,
      vendorId,
      paymentMode: 'NEFT',
      bankAccountId: 'bank-hdfc',
      amount: total,
      narration: `Draft from ${proposal.proposalNumber}`,
      internalRemarks: 'Auto-generated from approved proposal (demo)',
      allocationLines: lines.map((l) => ({ invoiceId: l.invoiceId, allocationAmount: l.proposedAmount })),
    })
    const pIdx = paymentsStore.findIndex((p) => p.id === payment.id)
    if (pIdx >= 0) paymentsStore[pIdx] = { ...paymentsStore[pIdx], proposalId }
    created.push(clone(paymentsStore[pIdx >= 0 ? pIdx : 0]))
  }
  const propIdx = proposalsStore.findIndex((p) => p.id === proposalId)
  if (propIdx >= 0) proposalsStore[propIdx] = { ...proposalsStore[propIdx], status: 'Partially Processed' }
  return created
}

export async function getPaymentAllocationPreview(paymentId: string): Promise<PaymentAllocationPreview> {
  await delay()
  const payment = await getVendorPaymentById(paymentId)
  const openInvs = invoicesStore.filter(
    (i) => i.vendorId === payment.vendorId && i.outstandingBalance > 0 && i.status !== 'Cancelled',
  )
  const warnings: string[] = []
  if (payment.vendorId) {
    const vendor = vendorsStore.find((v) => v.id === payment.vendorId)
    if (vendor?.paymentHold?.status === 'Active') warnings.push('Vendor has active payment hold')
    if (vendor?.bankVerificationStatus === 'Changed Recently') warnings.push('Vendor bank details changed recently')
  }
  let remaining = payment.unallocatedAmount || payment.amount
  const suggested: PaymentAllocationLine[] = []
  for (const inv of openInvs.sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    if (remaining <= 0) break
    const alloc = Math.min(inv.outstandingBalance, remaining)
    suggested.push({
      id: `suggest-${inv.id}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      originalAmount: inv.originalAmount,
      previousAllocation: inv.paidAmount,
      outstandingBalance: inv.outstandingBalance,
      overdueDays: inv.overdueDays,
      tdsDeducted: inv.tdsAmount,
      allocationAmount: alloc,
      remainingBalance: inv.outstandingBalance - alloc,
      status: alloc >= inv.outstandingBalance ? 'Fully Allocated' : 'Partial',
    })
    remaining -= alloc
  }
  return clone({
    paymentId: payment.id,
    paymentNumber: payment.paymentNumber,
    vendorName: payment.vendorName,
    grossAmount: payment.grossAmount,
    tdsDeducted: payment.tdsDeducted,
    amountAvailable: payment.unallocatedAmount || payment.amount,
    suggestedLines: suggested,
    unallocatedAfter: remaining,
    warnings,
  })
}

export async function postPaymentDemo(paymentId: string): Promise<VendorPayment> {
  return postVendorPayment(paymentId)
}

export async function reversePaymentDemo(paymentId: string, reason?: string): Promise<VendorPayment> {
  await delay()
  const idx = paymentsStore.findIndex((p) => p.id === paymentId)
  if (idx < 0) throw new PayablesServiceError('Vendor payment not found.')
  if (paymentsStore[idx].status !== 'Posted') {
    throw new PayablesServiceError('Only posted payments can be reversed (demo).')
  }
  const user = getSessionUser()
  for (const line of paymentsStore[idx].allocationLines) {
    const invIdx = invoicesStore.findIndex((i) => i.id === line.invoiceId)
    if (invIdx < 0) continue
    const inv = invoicesStore[invIdx]
    const paid = Math.max(0, inv.paidAmount - line.allocationAmount)
    const bal = Math.max(0, inv.originalAmount - paid - inv.debitNoteAmount)
    invoicesStore[invIdx] = {
      ...inv,
      paidAmount: paid,
      outstandingBalance: bal,
      status: bal <= 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Open',
    }
  }
  paymentsStore[idx] = {
    ...paymentsStore[idx],
    status: 'Reversed',
    internalRemarks: `${paymentsStore[idx].internalRemarks} | Reversed: ${reason ?? 'Demo reversal'}`,
    postedBy: user.name,
  }
  auditStore = [
    {
      id: `apaud-${Date.now()}`,
      entityType: 'payment',
      entityId: paymentId,
      action: 'Reversed',
      details: reason ?? 'Payment reversed in demo mode',
      performedBy: user.name,
      performedAt: new Date().toISOString(),
      isDemo: true,
    },
    ...auditStore,
  ]
  syncVendorBalances()
  return clone(paymentsStore[idx])
}

export async function applyVendorAdvanceDemo(advanceId: string, invoiceId: string, amount: number): Promise<VendorAdvance> {
  await delay()
  const advIdx = advancesStore.findIndex((a) => a.id === advanceId)
  if (advIdx < 0) throw new PayablesServiceError('Vendor advance not found.')
  const invIdx = invoicesStore.findIndex((i) => i.id === invoiceId)
  if (invIdx < 0) throw new PayablesServiceError('Payable invoice not found.')
  const advance = advancesStore[advIdx]
  const inv = invoicesStore[invIdx]
  if (advance.vendorId !== inv.vendorId) throw new PayablesServiceError('Advance and invoice vendor must match.')
  const applyAmt = Math.min(amount, advance.remainingAmount, inv.outstandingBalance)
  if (applyAmt <= 0) throw new PayablesServiceError('Invalid advance application amount.')
  advancesStore[advIdx] = {
    ...advance,
    adjustedAmount: advance.adjustedAmount + applyAmt,
    remainingAmount: advance.remainingAmount - applyAmt,
    status: advance.remainingAmount - applyAmt <= 0 ? 'Fully Adjusted' : 'Partially Adjusted',
  }
  const paid = inv.paidAmount + applyAmt
  const bal = Math.max(0, inv.originalAmount - paid - inv.debitNoteAmount)
  invoicesStore[invIdx] = { ...inv, paidAmount: paid, outstandingBalance: bal, status: bal <= 0 ? 'Paid' : 'Partially Paid' }
  syncVendorBalances()
  return clone(advancesStore[advIdx])
}

export async function applyDebitNoteDemo(debitNoteId: string, invoiceId: string, amount: number): Promise<PayableDebitNote> {
  await delay()
  const dnIdx = debitNotesStore.findIndex((d) => d.id === debitNoteId)
  if (dnIdx < 0) throw new PayablesServiceError('Debit note not found.')
  const invIdx = invoicesStore.findIndex((i) => i.id === invoiceId)
  if (invIdx < 0) throw new PayablesServiceError('Payable invoice not found.')
  const dn = debitNotesStore[dnIdx]
  const inv = invoicesStore[invIdx]
  if (dn.vendorId !== inv.vendorId) throw new PayablesServiceError('Debit note and invoice vendor must match.')
  const applyAmt = Math.min(amount, dn.remainingAmount, inv.outstandingBalance)
  if (applyAmt <= 0) throw new PayablesServiceError('Invalid debit note application amount.')
  debitNotesStore[dnIdx] = {
    ...dn,
    appliedAmount: dn.appliedAmount + applyAmt,
    remainingAmount: dn.remainingAmount - applyAmt,
    status: dn.remainingAmount - applyAmt <= 0 ? 'Applied' : 'Partially Applied',
  }
  const dnTotal = inv.debitNoteAmount + applyAmt
  const bal = Math.max(0, inv.originalAmount - inv.paidAmount - dnTotal)
  invoicesStore[invIdx] = { ...inv, debitNoteAmount: dnTotal, outstandingBalance: bal, hasDebitNote: true }
  syncVendorBalances()
  return clone(debitNotesStore[dnIdx])
}

export async function createVendorDispute(
  input: Omit<VendorDispute, 'id' | 'disputeNumber' | 'createdAt'>,
): Promise<VendorDispute> {
  if (isApiMode()) {
    try {
      return await createLiveVendorDispute(input)
    } catch (e) {
      throw new PayablesServiceError(e instanceof Error ? e.message : 'Failed to create vendor dispute')
    }
  }
  await delay()
  const user = getSessionUser()
  const seq = disputesStore.length + 1
  const dispute: VendorDispute = {
    ...input,
    id: `apdisp-${Date.now()}`,
    disputeNumber: `VDP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
  }
  disputesStore = [dispute, ...disputesStore]
  auditStore = [
    { id: `apaud-${Date.now()}`, entityType: 'dispute', entityId: dispute.id, action: 'Created', details: input.description.slice(0, 120), performedBy: user.name, performedAt: dispute.createdAt, isDemo: true },
    ...auditStore,
  ]
  const invIdx = invoicesStore.findIndex((i) => i.id === input.invoiceId)
  if (invIdx >= 0) {
    invoicesStore[invIdx] = { ...invoicesStore[invIdx], hasDispute: true, status: 'Disputed' }
  }
  return clone(dispute)
}

export async function updateVendorDispute(id: string, patch: Partial<VendorDispute>): Promise<VendorDispute> {
  if (isApiMode()) {
    try {
      return await updateLiveVendorDispute(id, patch)
    } catch (e) {
      throw new PayablesServiceError(e instanceof Error ? e.message : 'Failed to update vendor dispute')
    }
  }
  await delay()
  const idx = disputesStore.findIndex((d) => d.id === id)
  if (idx < 0) throw new PayablesServiceError('Vendor dispute not found.')
  disputesStore[idx] = { ...disputesStore[idx], ...patch }
  return clone(disputesStore[idx])
}

export async function getVendorPayablesCard(vendorId: string): Promise<VendorPayablesCard> {
  await delay()
  syncVendorBalances()
  const vendor = vendorsStore.find((v) => v.id === vendorId)
  if (!vendor) throw new PayablesServiceError('Vendor not found.')
  const outstanding = buildOutstandingSummaries().find((r) => r.vendorId === vendorId)!
  const openInvoices = invoicesStore.filter((i) => i.vendorId === vendorId && i.outstandingBalance > 0)
  const recentPayments = paymentsStore.filter((p) => p.vendorId === vendorId).slice(0, 5)
  const advances = advancesStore.filter((a) => a.vendorId === vendorId)
  const debitNotes = debitNotesStore.filter((dn) => dn.vendorId === vendorId)
  const disputes = disputesStore.filter((d) => d.vendorId === vendorId)
  const paymentHolds = holdsStore.filter((h) => h.entityId === vendorId && h.status === 'Active')
  const bankDetails = bankDetailsStore.find((b) => b.vendorId === vendorId) ?? null
  const threeWayMatchIssues = openInvoices.filter(
    (i) => !['Fully Matched', 'Within Tolerance', 'Override Approved'].includes(i.matchStatus),
  ).length
  const alerts: string[] = []
  if (vendor.paymentHold) alerts.push(`Payment hold: ${vendor.paymentHold.reason}`)
  if (vendor.bankVerificationStatus === 'Changed Recently') alerts.push('Bank details changed — re-verification required')
  if (threeWayMatchIssues > 0) alerts.push(`${threeWayMatchIssues} invoice(s) with match exceptions`)
  if (outstanding.overdueAmount > 0) alerts.push(`₹${outstanding.overdueAmount.toLocaleString('en-IN')} overdue`)
  return clone({
    vendor,
    outstanding,
    openInvoices,
    recentPayments,
    advances,
    debitNotes,
    disputes,
    paymentHolds,
    bankDetails,
    threeWayMatchIssues,
    alerts,
  })
}

export async function getVendorStatementPreview(
  vendorId: string,
  from: string,
  to: string,
): Promise<VendorStatementPreview> {
  await delay()
  const vendor = vendorsStore.find((v) => v.id === vendorId)
  if (!vendor) throw new PayablesServiceError('Vendor not found.')
  const invs = invoicesStore.filter((i) => i.vendorId === vendorId && i.invoiceDate >= from && i.invoiceDate <= to)
  const pays = paymentsStore.filter((p) => p.vendorId === vendorId && p.paymentDate >= from && p.paymentDate <= to && p.status === 'Posted')
  let running = 0
  const lines = [
    ...invs.map((i) => ({
      date: i.invoiceDate,
      documentNumber: i.invoiceNumber,
      documentType: 'Invoice',
      reference: i.reference ?? '',
      debit: i.originalAmount,
      credit: 0,
      runningBalance: 0,
    })),
    ...pays.map((p) => ({
      date: p.paymentDate,
      documentNumber: p.paymentNumber,
      documentType: 'Payment',
      reference: p.transactionReference ?? '',
      debit: 0,
      credit: p.amount,
      runningBalance: 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  for (const line of lines) {
    running += line.debit - line.credit
    line.runningBalance = running
  }
  const openInvs = invoicesStore.filter((i) => i.vendorId === vendorId && i.outstandingBalance > 0)
  const ageingSummary = PAYABLE_AGEING_BUCKETS.reduce(
    (acc, bucket) => {
      acc[bucket] = openInvs.filter((i) => i.ageingBucket === bucket).reduce((s, i) => s + i.outstandingBalance, 0)
      return acc
    },
    {} as Record<PayableAgeingBucket, number>,
  )
  return clone({
    companyName: 'Vasant Trailers Pvt Ltd',
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorAddress: `${vendor.state}, India`,
    gstNumber: vendor.gstin,
    pan: vendor.pan,
    statementPeriodFrom: from,
    statementPeriodTo: to,
    openingBalance: 0,
    closingBalance: running,
    lines,
    ageingSummary,
  })
}

export async function getPaymentAdvicePreview(paymentId: string): Promise<PaymentAdvicePreview> {
  await delay()
  const payment = await getVendorPaymentById(paymentId)
  const bank = bankDetailsStore.find((b) => b.vendorId === payment.vendorId)
  const lines: PaymentAdvicePreview['lines'] = payment.allocationLines.map((l) => ({
    invoiceNumber: l.invoiceNumber,
    invoiceDate: l.invoiceDate,
    grossAmount: l.allocationAmount + l.tdsDeducted,
    tdsDeducted: l.tdsDeducted,
    otherDeductions: 0,
    netPayable: l.allocationAmount,
  }))
  return clone({
    paymentNumber: payment.paymentNumber,
    paymentDate: payment.paymentDate,
    vendorName: payment.vendorName,
    vendorCode: payment.vendorCode,
    beneficiaryName: bank?.beneficiaryName ?? payment.vendorName,
    bankName: bank?.bankName ?? '—',
    ifsc: bank?.ifsc ?? '—',
    accountNumberMasked: bank?.accountNumberMasked ?? payment.beneficiaryBankMasked ?? '—',
    paymentMode: payment.paymentMode,
    grossAmount: payment.grossAmount,
    tdsDeducted: payment.tdsDeducted,
    otherDeductions: payment.otherDeductions,
    bankCharges: payment.bankCharges,
    netPayment: payment.netPayment,
    narration: payment.narration,
    lines,
  })
}

export async function placePaymentHoldDemo(
  holdType: PaymentHold['holdType'],
  entityId: string,
  reason: PaymentHold['reason'],
  remarks: string,
): Promise<PaymentHold> {
  await delay()
  const user = getSessionUser()
  const hold: PaymentHold = {
    id: `phold-${Date.now()}`,
    holdType,
    reason,
    status: 'Active',
    entityId,
    entityType: holdType.toLowerCase(),
    placedBy: user.name,
    placedAt: new Date().toISOString(),
    releasedBy: null,
    releasedAt: null,
    remarks,
  }
  holdsStore = [hold, ...holdsStore]
  if (holdType === 'Vendor') {
    const vIdx = vendorsStore.findIndex((v) => v.id === entityId)
    if (vIdx >= 0) vendorsStore[vIdx] = { ...vendorsStore[vIdx], paymentHold: hold, status: 'On Hold' }
  } else if (holdType === 'Invoice') {
    const iIdx = invoicesStore.findIndex((i) => i.id === entityId)
    if (iIdx >= 0) invoicesStore[iIdx] = { ...invoicesStore[iIdx], paymentHold: hold }
  }
  return clone(hold)
}

export async function releasePaymentHoldDemo(holdId: string): Promise<PaymentHold> {
  await delay()
  const idx = holdsStore.findIndex((h) => h.id === holdId)
  if (idx < 0) throw new PayablesServiceError('Payment hold not found.')
  const user = getSessionUser()
  holdsStore[idx] = {
    ...holdsStore[idx],
    status: 'Released',
    releasedBy: user.name,
    releasedAt: new Date().toISOString(),
  }
  const hold = holdsStore[idx]
  if (hold.holdType === 'Vendor') {
    const vIdx = vendorsStore.findIndex((v) => v.id === hold.entityId)
    if (vIdx >= 0) vendorsStore[vIdx] = { ...vendorsStore[vIdx], paymentHold: null, status: 'Active' }
  } else if (hold.holdType === 'Invoice') {
    const iIdx = invoicesStore.findIndex((i) => i.id === hold.entityId)
    if (iIdx >= 0) invoicesStore[iIdx] = { ...invoicesStore[iIdx], paymentHold: null }
  }
  return clone(hold)
}

export async function getVendorBankDetails(vendorId: string): Promise<VendorBankDetails> {
  await delay()
  const bank = bankDetailsStore.find((b) => b.vendorId === vendorId)
  if (!bank) throw new PayablesServiceError('Vendor bank details not available.')
  return clone(bank)
}

export async function verifyVendorBankDemo(vendorId: string): Promise<VendorBankDetails> {
  await delay()
  const idx = bankDetailsStore.findIndex((b) => b.vendorId === vendorId)
  if (idx < 0) throw new PayablesServiceError('Vendor bank details not found.')
  const user = getSessionUser()
  bankDetailsStore[idx] = {
    ...bankDetailsStore[idx],
    verificationStatus: 'Verified',
    verifiedBy: user.name,
    verifiedAt: new Date().toISOString(),
  }
  const vIdx = vendorsStore.findIndex((v) => v.id === vendorId)
  if (vIdx >= 0) vendorsStore[vIdx] = { ...vendorsStore[vIdx], bankVerificationStatus: 'Verified' }
  return clone(bankDetailsStore[idx])
}

export async function getPayablesReports(): Promise<PayablesReportCatalogEntry[]> {
  await delay()
  return clone(PAYABLES_REPORT_CATALOG)
}

export async function getPayablesSetup(): Promise<PayablesSetup> {
  await delay()
  return clone(setupStore)
}

export async function updatePayablesSetupDemo(patch: Partial<PayablesSetup>): Promise<PayablesSetup> {
  await delay()
  const user = getSessionUser()
  setupStore = {
    ...setupStore,
    ...patch,
    general: { ...setupStore.general, ...patch.general },
    approval: { ...setupStore.approval, ...patch.approval },
    tds: { ...setupStore.tds, ...patch.tds },
    notifications: { ...setupStore.notifications, ...patch.notifications },
    lastUpdatedBy: user.name,
    lastUpdatedAt: new Date().toISOString(),
  }
  return clone(setupStore)
}

export async function getPayablesAuditTrail(entityType?: string, entityId?: string): Promise<PayablesAuditEntry[]> {
  await delay()
  return clone(
    auditStore.filter((e) => {
      if (entityType && e.entityType !== entityType) return false
      if (entityId && e.entityId !== entityId) return false
      return true
    }),
  )
}

export async function getPayablesPrintPreview(
  documentType: PayablesPrintPreview['documentType'],
  entityId: string,
): Promise<PayablesPrintPreview> {
  await delay()
  let title = 'Payables Document'
  let body = ''
  if (documentType === 'payment_advice') {
    const advice = await getPaymentAdvicePreview(entityId)
    title = `Payment Advice — ${advice.paymentNumber}`
    body = `${advice.vendorName} | Net ₹${advice.netPayment.toLocaleString('en-IN')} via ${advice.paymentMode}`
  } else if (documentType === 'vendor_statement') {
    const today = new Date().toISOString().slice(0, 10)
    const from = new Date()
    from.setMonth(from.getMonth() - 3)
    const stmt = await getVendorStatementPreview(entityId, from.toISOString().slice(0, 10), today)
    title = `Vendor Statement — ${stmt.vendorName}`
    body = `Closing balance ₹${stmt.closingBalance.toLocaleString('en-IN')}`
  } else if (documentType === 'payment_proposal') {
    const prop = await getPaymentProposalById(entityId)
    title = `Payment Proposal — ${prop.proposalNumber}`
    body = `₹${prop.totalAmount.toLocaleString('en-IN')} | ${prop.invoiceCount} invoices`
  } else {
    title = 'Vendor Ageing Report'
    body = 'Ageing snapshot (demo preview)'
  }
  return {
    documentType,
    title,
    generatedAt: new Date().toISOString(),
    htmlPreview: `<div><h1>${title}</h1><p>${body}</p><p><em>Demo print preview — not a legal document.</em></p></div>`,
    disclaimer: 'Print preview generated in demo mode. Backend document service is not connected.',
  }
}

export async function getVendorAdvances(filter: Partial<PayableFilter> = {}): Promise<VendorAdvance[]> {
  await delay()
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return clone(
    advancesStore.filter((a) => {
      if (f.search) {
        const blob = `${a.advanceNumber} ${a.vendorName}`
        if (!matchSearch(blob, f.search)) return false
      }
      if (f.vendorId && a.vendorId !== f.vendorId) return false
      const tab = f.advanceTab
      if (tab && tab !== 'all') {
        const map: Record<string, VendorAdvance['status']> = {
          open: 'Open',
          partially_adjusted: 'Partially Adjusted',
          fully_adjusted: 'Fully Adjusted',
          cancelled: 'Cancelled',
        }
        if (map[tab] && a.status !== map[tab]) return false
      }
      return true
    }),
  )
}

export async function getDebitNotes(filter: Partial<PayableFilter> = {}): Promise<PayableDebitNote[]> {
  await delay()
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return clone(
    debitNotesStore.filter((dn) => {
      if (f.search) {
        const blob = `${dn.debitNoteNumber} ${dn.vendorName} ${dn.referenceInvoiceNumber ?? ''}`
        if (!matchSearch(blob, f.search)) return false
      }
      if (f.vendorId && dn.vendorId !== f.vendorId) return false
      const tab = f.debitNoteTab
      if (tab && tab !== 'all') {
        const map: Record<string, PayableDebitNote['status']> = {
          draft: 'Draft',
          pending_approval: 'Pending Approval',
          posted: 'Posted',
          applied: 'Applied',
          partially_applied: 'Partially Applied',
          unapplied: 'Unapplied',
          cancelled: 'Cancelled',
        }
        if (map[tab] && dn.status !== map[tab]) return false
      }
      return true
    }),
  )
}

export async function getDisputes(filter: Partial<PayableFilter> = {}): Promise<VendorDispute[]> {
  return getVendorDisputes(filter)
}

export async function getVendorDisputes(filter: Partial<PayableFilter> = {}): Promise<VendorDispute[]> {
  if (isApiMode()) {
    try {
      return await getLiveVendorDisputes(filter)
    } catch (e) {
      throw new PayablesServiceError(e instanceof Error ? e.message : 'Failed to load vendor disputes')
    }
  }
  await delay()
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  return clone(
    disputesStore.filter((d) => {
      if (f.search) {
        const blob = `${d.disputeNumber} ${d.vendorName} ${d.invoiceNumber}`
        if (!matchSearch(blob, f.search)) return false
      }
      if (f.vendorId && d.vendorId !== f.vendorId) return false
      const tab = f.disputeTab
      if (tab && tab !== 'all') {
        const map: Record<string, VendorDispute['status']> = {
          open: 'Open',
          under_review: 'Under Review',
          awaiting_vendor: 'Awaiting Vendor',
          awaiting_internal_team: 'Awaiting Internal Team',
          resolved: 'Resolved',
          rejected: 'Rejected',
          closed: 'Closed',
        }
        if (map[tab] && d.status !== map[tab]) return false
      }
      return true
    }),
  )
}

export async function exportPayables(req: PayableExportRequest): Promise<{ filename: string; content: string; disclaimer: string }> {
  await delay()
  const disclaimer = 'Export generated in demo mode. Backend export service is not connected.'
  let rows: string[][] = [['Demo export', req.scope, req.format]]
  if (req.scope === 'vendor_outstanding') {
    const data = await getVendorOutstanding(req.filter)
    rows = [['Vendor Code', 'Vendor Name', 'Outstanding', 'Overdue'], ...data.map((d) => [d.vendorCode, d.vendorName, String(d.totalOutstanding), String(d.overdueAmount)])]
  } else if (req.scope === 'open_invoices') {
    const data = await getPayableInvoices(req.filter)
    rows = [['Invoice', 'Vendor', 'Balance'], ...data.map((d) => [d.invoiceNumber, d.vendorName, String(d.outstandingBalance)])]
  } else if (req.scope === 'vendor_payments') {
    const data = await getVendorPayments(req.filter)
    rows = [['Payment', 'Vendor', 'Amount'], ...data.map((d) => [d.paymentNumber, d.vendorName, String(d.amount)])]
  } else if (req.scope === 'payment_proposals') {
    const data = await getPaymentProposals(req.filter)
    rows = [['Proposal', 'Status', 'Amount'], ...data.map((d) => [d.proposalNumber, d.status, String(d.totalAmount)])]
  } else if (req.scope === 'msme_ageing') {
    const ageing = await getPayablesAgeing(req.filter)
    rows = [['Vendor', 'MSME Category', 'Outstanding'], ...ageing.msmeWise.map((r) => [r.vendorName, r.msmeCategory, String(r.totalOutstanding)])]
  } else if (req.scope === 'tds_summary') {
    const data = await getVendorPayments(req.filter)
    rows = [['Payment', 'Vendor', 'TDS', 'Section'], ...data.filter((d) => d.tdsDeducted > 0).map((d) => [d.paymentNumber, d.vendorName, String(d.tdsDeducted), d.tdsSection ?? ''])]
  } else if (req.scope === 'match_exceptions') {
    const data = await getPayableInvoices(req.filter)
    rows = [['Invoice', 'Vendor', 'Match Status'], ...data.filter((d) => !['Fully Matched', 'Within Tolerance'].includes(d.matchStatus)).map((d) => [d.invoiceNumber, d.vendorName, d.matchStatus])]
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  return {
    filename: `payables-${req.scope}-${new Date().toISOString().slice(0, 10)}.${req.format === 'csv' ? 'csv' : req.format === 'pdf' ? 'txt' : 'csv'}`,
    content: csv,
    disclaimer,
  }
}
