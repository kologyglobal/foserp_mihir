/**
 * Accounts Receivable mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT post real GL, settle customer ledger, or send communications.
 *
 * SECURITY: All reads/writes/exports must also be enforced by the future backend
 * (tenant isolation + accounting.receivables.* permissions). UI gating alone is not security.
 */

import {
  RECEIVABLE_BANK_ACCOUNTS,
  SEED_RECEIVABLE_SAVED_VIEWS,
  seedCollectionActivities,
  seedCreditNotes,
  seedCustomerDisputes,
  seedCustomerReceipts,
  seedPaymentPromises,
  seedPaymentReminders,
  seedReceivableAudit,
  seedReceivableCustomers,
  seedReceivableInvoices,
} from '../../data/accounting/receivablesSeed'
import type {
  AllocationStatus,
  AutoAllocationMethod,
  AutoAllocationPreview,
  CollectionActivity,
  CollectionWorklistItem,
  CreditHoldInput,
  CreditHoldReleaseInput,
  CreditNote,
  CustomerDispute,
  CustomerOutstandingSummary,
  CustomerReceipt,
  CustomerReceivableCard,
  CustomerStatement,
  PaymentPromise,
  PaymentReminder,
  ReceiptAllocation,
  ReceiptAllocationLine,
  ReceiptDraftInput,
  ReceiptPostingPreview,
  ReceivableAgeingBucket,
  ReceivableAgeingResult,
  ReceivableAuditEntry,
  ReceivableCustomer,
  ReceivableExportRequest,
  ReceivableFilter,
  ReceivableInvoice,
  ReceivableLookups,
  ReceivablePrintPreview,
  ReceivableSavedView,
  ReceivablesDashboardData,
  StatementType,
} from '../../types/receivables'
import { DEFAULT_RECEIVABLE_FILTER, ELECTRONIC_PAYMENT_MODES, RECEIVABLE_AGEING_BUCKETS } from '../../types/receivables'
import { getSessionUser } from '../../utils/permissions'

export { DEFAULT_RECEIVABLE_FILTER }

export class ReceivablesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceivablesServiceError'
  }
}

const COMPANY_NAME = 'Vasant Trailers Pvt Ltd'
const delay = () => new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 80)))

let customersStore = seedReceivableCustomers()
let invoicesStore = seedReceivableInvoices()
let receiptsStore = seedCustomerReceipts()
let activitiesStore = seedCollectionActivities()
let promisesStore = seedPaymentPromises()
let disputesStore = seedCustomerDisputes()
let creditNotesStore = seedCreditNotes()
let remindersStore = seedPaymentReminders()
let auditStore = seedReceivableAudit()
let savedViewsStore: ReceivableSavedView[] = [...SEED_RECEIVABLE_SAVED_VIEWS]

function pushAudit(entityType: string, entityId: string, action: string, details: string) {
  const user = getSessionUser()
  auditStore = [
    {
      id: `raudit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

function computeBucket(dueDate: string, asOf: string): { overdueDays: number; bucket: ReceivableAgeingBucket } {
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
    if (inv.invoiceStatus === 'Paid' || inv.invoiceStatus === 'Cancelled') return inv
    const { overdueDays, bucket } = computeBucket(inv.dueDate, asOf)
    let status: ReceivableInvoice['invoiceStatus'] = inv.invoiceStatus
    if (inv.hasDispute) status = 'Disputed'
    else if (inv.outstandingBalance <= 0) status = 'Paid'
    else if (overdueDays > 0) status = 'Overdue'
    else if (daysBetween(asOf, inv.dueDate) <= 7 && inv.outstandingBalance > 0) status = 'Due Soon'
    else if (inv.appliedAmount > 0 && inv.outstandingBalance > 0) status = 'Partially Paid'
    else status = 'Open'
    return { ...inv, overdueDays, ageingBucket: bucket, invoiceStatus: status }
  })
}

function buildOutstandingSummaries(): CustomerOutstandingSummary[] {
  refreshInvoiceAgeing()
  return customersStore.map((c) => {
    const invs = invoicesStore.filter((i) => i.customerId === c.id && i.outstandingBalance > 0 && i.invoiceStatus !== 'Cancelled')
    const totalOutstanding = invs.reduce((s, i) => s + i.outstandingBalance, 0)
    const overdueAmount = invs.filter((i) => i.overdueDays > 0).reduce((s, i) => s + i.outstandingBalance, 0)
    const currentAmount = totalOutstanding - overdueAmount
    const oldest = invs
      .filter((i) => i.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    const unallocated = receiptsStore
      .filter((r) => r.customerId === c.id && r.voucherStatus !== 'Reversed' && r.voucherStatus !== 'Cancelled')
      .reduce((s, r) => s + r.unallocatedAmount, 0)
    const disputeAmount = disputesStore
      .filter((d) => d.customerId === c.id && !['Resolved', 'Rejected', 'Closed'].includes(d.status))
      .reduce((s, d) => s + d.disputedAmount, 0)
    const activePromise = promisesStore.find((p) => p.customerId === c.id && (p.status === 'Active' || p.status === 'Partially Fulfilled'))
    const lastReceipt = receiptsStore
      .filter((r) => r.customerId === c.id && r.voucherStatus === 'Posted')
      .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))[0]
    const utilization = c.creditLimit > 0 ? Math.round((totalOutstanding / c.creditLimit) * 1000) / 10 : 0
    return {
      customerId: c.id,
      customerCode: c.customerCode,
      customerName: c.customerName,
      customerGroup: c.customerGroup,
      gstNumber: c.gstNumber,
      state: c.state,
      salesperson: c.salesperson,
      territory: c.territory,
      paymentTerms: c.paymentTerms,
      creditLimit: c.creditLimit,
      totalOutstanding,
      currentAmount,
      overdueAmount,
      oldestDueDate: oldest?.dueDate ?? null,
      maximumOverdueDays: invs.reduce((m, i) => Math.max(m, i.overdueDays), 0),
      unallocatedReceipt: unallocated,
      creditUtilization: utilization,
      collectionOwner: c.collectionOwner,
      creditStatus: c.creditStatus,
      averageCollectionDays: c.averageCollectionDays,
      lastReceiptDate: lastReceipt?.receiptDate ?? null,
      lastReceiptAmount: lastReceipt?.receiptAmount ?? 0,
      openInvoiceCount: invs.length,
      disputeAmount,
      promisedPaymentDate: activePromise?.promiseDate ?? null,
      hasDispute: disputeAmount > 0,
      hasPaymentPromise: Boolean(activePromise),
      collectionStatus: invs[0]?.collectionStatus ?? 'Not Contacted',
      gstRegistrationType: c.gstRegistrationType,
    }
  })
}

function matchSearch(haystack: string, q: string) {
  return !q || haystack.toLowerCase().includes(q.toLowerCase())
}

function filterInvoices(filter: Partial<ReceivableFilter>): ReceivableInvoice[] {
  refreshInvoiceAgeing(filter.asOfDate || undefined)
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  return invoicesStore.filter((inv) => {
    if (f.search) {
      const blob = `${inv.invoiceNumber} ${inv.customerName} ${inv.customerCode} ${inv.salesOrderNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.customerId && inv.customerId !== f.customerId) return false
    if (f.salesperson && inv.salesperson !== f.salesperson) return false
    if (f.territory && inv.territory !== f.territory) return false
    if (f.location && inv.location !== f.location) return false
    if (f.ageingBucket && inv.ageingBucket !== f.ageingBucket) return false
    if (f.invoiceStatus && inv.invoiceStatus !== f.invoiceStatus) return false
    if (f.hasDispute === 'yes' && !inv.hasDispute) return false
    if (f.hasDispute === 'no' && inv.hasDispute) return false
    if (f.amountMin != null && inv.originalAmount < f.amountMin) return false
    if (f.amountMax != null && inv.originalAmount > f.amountMax) return false
    if (f.dueDateFrom && inv.dueDate < f.dueDateFrom) return false
    if (f.dueDateTo && inv.dueDate > f.dueDateTo) return false
    if (f.collectionOwner && inv.collectionOwner !== f.collectionOwner) return false
    if (f.overdueStatus === 'overdue' && inv.overdueDays <= 0) return false
    if (f.overdueStatus === 'current' && inv.overdueDays > 0) return false
    if (f.overdueStatus === 'due_soon') {
      const rem = daysBetween(new Date().toISOString().slice(0, 10), inv.dueDate)
      if (rem < 0 || rem > 7 || inv.outstandingBalance <= 0) return false
    }
    const tab = f.invoiceTab
    if (tab && tab !== 'all') {
      const map: Record<string, (i: ReceivableInvoice) => boolean> = {
        open: (i) => i.invoiceStatus === 'Open',
        partially_paid: (i) => i.invoiceStatus === 'Partially Paid',
        due_soon: (i) => i.invoiceStatus === 'Due Soon',
        overdue: (i) => i.invoiceStatus === 'Overdue',
        disputed: (i) => i.invoiceStatus === 'Disputed' || i.hasDispute,
        paid: (i) => i.invoiceStatus === 'Paid',
        cancelled: (i) => i.invoiceStatus === 'Cancelled',
      }
      if (map[tab] && !map[tab](inv)) return false
    }
    return true
  })
}

function filterOutstanding(filter: Partial<ReceivableFilter>): CustomerOutstandingSummary[] {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  return buildOutstandingSummaries().filter((row) => {
    if (f.search) {
      const blob = `${row.customerCode} ${row.customerName} ${row.gstNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.customerId && row.customerId !== f.customerId) return false
    if (f.customerGroup && row.customerGroup !== f.customerGroup) return false
    if (f.salesperson && row.salesperson !== f.salesperson) return false
    if (f.territory && row.territory !== f.territory) return false
    if (f.state && row.state !== f.state) return false
    if (f.creditStatus && row.creditStatus !== f.creditStatus) return false
    if (f.overdueStatus === 'overdue' && row.overdueAmount <= 0) return false
    if (f.overdueStatus === 'current' && row.overdueAmount > 0) return false
    if (f.ageingBucket) {
      const has = invoicesStore.some(
        (i) => i.customerId === row.customerId && i.outstandingBalance > 0 && i.ageingBucket === f.ageingBucket,
      )
      if (!has) return false
    }
    if (f.amountMin != null && row.totalOutstanding < f.amountMin) return false
    if (f.amountMax != null && row.totalOutstanding > f.amountMax) return false
    if (f.gstRegistrationType && row.gstRegistrationType !== f.gstRegistrationType) return false
    if (f.hasDispute === 'yes' && !row.hasDispute) return false
    if (f.hasDispute === 'no' && row.hasDispute) return false
    if (f.hasPaymentPromise === 'yes' && !row.hasPaymentPromise) return false
    if (f.hasPaymentPromise === 'no' && row.hasPaymentPromise) return false
    if (f.collectionOwner && row.collectionOwner !== f.collectionOwner) return false
    return true
  })
}

function filterReceipts(filter: Partial<ReceivableFilter>): CustomerReceipt[] {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  return receiptsStore.filter((r) => {
    if (f.search) {
      const blob = `${r.receiptNumber} ${r.customerName} ${r.transactionReference ?? ''} ${r.chequeNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.customerId && r.customerId !== f.customerId) return false
    if (f.paymentMode && r.paymentMode !== f.paymentMode) return false
    if (f.allocationStatus && r.allocationStatus !== f.allocationStatus) return false
    if (f.voucherStatus && r.voucherStatus !== f.voucherStatus) return false
    if (f.amountMin != null && r.receiptAmount < f.amountMin) return false
    if (f.amountMax != null && r.receiptAmount > f.amountMax) return false
    const tab = f.receiptTab
    if (tab && tab !== 'all' && tab !== 'all_receipts') {
      const map: Record<string, (x: CustomerReceipt) => boolean> = {
        draft: (x) => x.voucherStatus === 'Draft',
        pending_approval: (x) => x.voucherStatus === 'Pending Approval',
        posted: (x) => x.voucherStatus === 'Posted',
        unallocated: (x) => x.allocationStatus === 'Unallocated',
        partially_allocated: (x) => x.allocationStatus === 'Partially Allocated',
        fully_allocated: (x) => x.allocationStatus === 'Fully Allocated',
        reversed: (x) => x.voucherStatus === 'Reversed',
      }
      if (map[tab] && !map[tab](r)) return false
    }
    return true
  })
}

function deriveAllocationStatus(receiptAmount: number, allocated: number): AllocationStatus {
  if (allocated <= 0) return 'Unallocated'
  if (allocated + 0.01 >= receiptAmount) return 'Fully Allocated'
  return 'Partially Allocated'
}

export async function getReceivableLookups(): Promise<ReceivableLookups> {
  await delay()
  return {
    customers: customersStore.map((c) => ({ id: c.id, code: c.customerCode, name: c.customerName })),
    customerGroups: [...new Set(customersStore.map((c) => c.customerGroup))],
    salespersons: [...new Set(customersStore.map((c) => c.salesperson))],
    territories: [...new Set(customersStore.map((c) => c.territory))],
    states: [...new Set(customersStore.map((c) => c.state))],
    locations: [...new Set(invoicesStore.map((i) => i.location))],
    collectionOwners: [...new Set(customersStore.map((c) => c.collectionOwner))],
    bankAccounts: RECEIVABLE_BANK_ACCOUNTS,
  }
}

export async function getReceivablesDashboard(): Promise<ReceivablesDashboardData> {
  await delay()
  refreshInvoiceAgeing()
  const outstanding = buildOutstandingSummaries()
  const openInvs = invoicesStore.filter((i) => i.outstandingBalance > 0 && i.invoiceStatus !== 'Cancelled')
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const monthPrefix = today.slice(0, 7)

  const totalReceivables = outstanding.reduce((s, r) => s + r.totalOutstanding, 0)
  const overdueAmount = outstanding.reduce((s, r) => s + r.overdueAmount, 0)
  const currentOutstanding = totalReceivables - overdueAmount
  const dueThisWeek = openInvs
    .filter((i) => i.dueDate >= today && i.dueDate <= weekEndStr)
    .reduce((s, i) => s + i.outstandingBalance, 0)
  const receiptsThisMonth = receiptsStore
    .filter((r) => r.receiptDate.startsWith(monthPrefix) && r.voucherStatus !== 'Reversed' && r.voucherStatus !== 'Cancelled')
    .reduce((s, r) => s + r.receiptAmount, 0)
  const unallocatedReceipts = receiptsStore
    .filter((r) => r.unallocatedAmount > 0 && r.voucherStatus !== 'Reversed')
    .reduce((s, r) => s + r.unallocatedAmount, 0)
  const customersOverCreditLimit = outstanding.filter(
    (r) => r.creditStatus === 'Over Limit' || (r.creditLimit > 0 && r.totalOutstanding > r.creditLimit),
  ).length
  const avgDays =
    customersStore.length > 0
      ? Math.round(customersStore.reduce((s, c) => s + c.averageCollectionDays, 0) / customersStore.length)
      : 0

  const ageing = RECEIVABLE_AGEING_BUCKETS.map((bucket) => {
    const match = openInvs.filter((i) => i.ageingBucket === bucket)
    return { bucket, amount: match.reduce((s, i) => s + i.outstandingBalance, 0), count: match.length }
  })

  const criticalAlerts: ReceivablesDashboardData['criticalAlerts'] = []
  outstanding
    .filter((r) => r.creditStatus === 'Over Limit' || r.creditUtilization >= 100)
    .forEach((r) =>
      criticalAlerts.push({
        id: `alert-overlimit-${r.customerId}`,
        type: 'over_credit_limit',
        severity: 'critical',
        title: `${r.customerName} over credit limit`,
        description: `Utilization ${r.creditUtilization}%`,
        href: `/accounting/receivables/customer/${r.customerId}`,
      }),
    )
  openInvs
    .filter((i) => i.overdueDays > 90)
    .slice(0, 4)
    .forEach((i) =>
      criticalAlerts.push({
        id: `alert-overdue-${i.id}`,
        type: 'long_overdue',
        severity: 'critical',
        title: `Long overdue ${i.invoiceNumber}`,
        description: `${i.customerName} — ${i.overdueDays} days`,
        href: `/accounting/receivables/invoice/${i.id}`,
      }),
    )
  promisesStore
    .filter((p) => p.status === 'Broken')
    .forEach((p) =>
      criticalAlerts.push({
        id: `alert-broken-${p.id}`,
        type: 'broken_promise',
        severity: 'warning',
        title: `Broken promise — ${p.customerName}`,
        description: `Promised ${p.promiseDate}`,
        href: `/accounting/receivables/collections?tab=broken_promises`,
      }),
    )
  disputesStore
    .filter((d) => !['Resolved', 'Rejected', 'Closed'].includes(d.status))
    .slice(0, 3)
    .forEach((d) =>
      criticalAlerts.push({
        id: `alert-dispute-${d.id}`,
        type: 'dispute',
        severity: 'warning',
        title: `Dispute ${d.disputeNumber}`,
        description: `${d.customerName} — ${d.disputeType}`,
        href: `/accounting/receivables/disputes`,
      }),
    )
  receiptsStore
    .filter((r) => r.unallocatedAmount > 0 && r.voucherStatus === 'Posted')
    .slice(0, 3)
    .forEach((r) =>
      criticalAlerts.push({
        id: `alert-unalloc-${r.id}`,
        type: 'unallocated_receipt',
        severity: 'info',
        title: `Unallocated ${r.receiptNumber}`,
        description: r.customerName,
        href: `/accounting/receivables/receipts/${r.id}`,
      }),
    )
  customersStore
    .filter((c) => c.creditStatus === 'Credit Hold')
    .forEach((c) =>
      criticalAlerts.push({
        id: `alert-hold-${c.id}`,
        type: 'credit_hold',
        severity: 'critical',
        title: `Credit hold — ${c.customerName}`,
        description: 'Customer placed on credit hold',
        href: `/accounting/receivables/customer/${c.id}`,
      }),
    )

  const months: ReceivablesDashboardData['billingCollectionTrend'] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const prefix = d.toISOString().slice(0, 7)
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    months.push({
      month: label,
      billed: invoicesStore.filter((inv) => inv.invoiceDate.startsWith(prefix)).reduce((s, inv) => s + inv.originalAmount, 0),
      collected: receiptsStore
        .filter((r) => r.receiptDate.startsWith(prefix) && r.voucherStatus === 'Posted')
        .reduce((s, r) => s + r.receiptAmount, 0),
    })
  }

  return {
    kpis: {
      totalReceivables,
      currentOutstanding,
      overdueAmount,
      dueThisWeek,
      receiptsThisMonth,
      unallocatedReceipts,
      customersOverCreditLimit,
      averageCollectionDays: avgDays,
    },
    ageing,
    outstandingByCustomer: outstanding.filter((r) => r.totalOutstanding > 0).sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 8),
    upcomingDueInvoices: openInvs
      .filter((i) => i.dueDate >= today && i.dueDate <= weekEndStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8),
    criticalAlerts,
    billingCollectionTrend: months,
    topOverdueCustomers: outstanding.filter((r) => r.overdueAmount > 0).sort((a, b) => b.overdueAmount - a.overdueAmount).slice(0, 6),
    recentReceipts: [...receiptsStore].sort((a, b) => b.receiptDate.localeCompare(a.receiptDate)).slice(0, 6),
    collectionTeamActivity: [...activitiesStore].sort((a, b) => b.activityDate.localeCompare(a.activityDate)).slice(0, 8),
  }
}

export async function getCustomerOutstanding(filter: Partial<ReceivableFilter> = {}): Promise<CustomerOutstandingSummary[]> {
  await delay()
  return filterOutstanding(filter)
}

export async function getReceivableInvoices(filter: Partial<ReceivableFilter> = {}): Promise<ReceivableInvoice[]> {
  await delay()
  return filterInvoices(filter)
}

export async function getReceivableInvoiceById(invoiceId: string): Promise<ReceivableInvoice> {
  await delay()
  refreshInvoiceAgeing()
  const inv = invoicesStore.find((i) => i.id === invoiceId)
  if (!inv) throw new ReceivablesServiceError('Receivable invoice not found.')
  return inv
}

export async function getReceivableAgeing(filter: Partial<ReceivableFilter> = {}): Promise<ReceivableAgeingResult> {
  await delay()
  const asOf = filter.asOfDate || new Date().toISOString().slice(0, 10)
  const basis = filter.ageingBasis || 'Due Date'
  refreshInvoiceAgeing(asOf)
  const openInvs = invoicesStore.filter((i) => i.outstandingBalance > 0 && i.invoiceStatus !== 'Cancelled')
  const customerWise = customersStore
    .map((c) => {
      const invs = openInvs.filter((i) => i.customerId === c.id)
      const bucketAmt = (b: ReceivableAgeingBucket) =>
        invs.filter((i) => {
          const dateField = basis === 'Invoice Date' ? i.invoiceDate : basis === 'Posting Date' ? i.postingDate : i.dueDate
          return computeBucket(dateField, asOf).bucket === b
        }).reduce((s, i) => s + i.outstandingBalance, 0)
      const total = invs.reduce((s, i) => s + i.outstandingBalance, 0)
      if (total <= 0) return null
      return {
        customerId: c.id,
        customerName: c.customerName,
        creditLimit: c.creditLimit,
        notDue: bucketAmt('Not Due'),
        d1to30: bucketAmt('1–30 Days'),
        d31to60: bucketAmt('31–60 Days'),
        d61to90: bucketAmt('61–90 Days'),
        d91to180: bucketAmt('91–180 Days'),
        above180: bucketAmt('Above 180 Days'),
        totalOutstanding: total,
      }
    })
    .filter(Boolean) as ReceivableAgeingResult['customerWise']

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

  return {
    asOfDate: asOf,
    ageingBasis: basis,
    summary,
    customerWise,
    invoiceWise: openInvs,
  }
}

export async function getCollectionWorklist(filter: Partial<ReceivableFilter> = {}): Promise<CollectionWorklistItem[]> {
  await delay()
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const outstanding = buildOutstandingSummaries().filter((r) => r.totalOutstanding > 0 || r.hasDispute || r.hasPaymentPromise)
  const user = getSessionUser()
  let items: CollectionWorklistItem[] = outstanding.map((r, idx) => {
    const broken = promisesStore.some((p) => p.customerId === r.customerId && p.status === 'Broken')
    const lastAct = activitiesStore
      .filter((a) => a.customerId === r.customerId)
      .sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0]
    const nextAct = activitiesStore
      .filter((a) => a.customerId === r.customerId && a.nextFollowUpDate && !a.completed)
      .sort((a, b) => (a.nextFollowUpDate ?? '').localeCompare(b.nextFollowUpDate ?? ''))[0]
    let priorityReason: CollectionWorklistItem['priorityReason'] =
      r.overdueAmount > 0 ? 'Highest Overdue' : 'Highest Outstanding'
    if (broken) priorityReason = 'Broken Promise'
    else if (r.creditUtilization >= 100) priorityReason = 'Credit Limit Exceeded'
    else if (customersStore.find((c) => c.id === r.customerId)?.isStrategic) priorityReason = 'Strategic Customer'
    return {
      id: `wl-${r.customerId}`,
      priority: idx + 1,
      priorityReason,
      customerId: r.customerId,
      customerName: r.customerName,
      totalOutstanding: r.totalOutstanding,
      overdue: r.overdueAmount,
      oldestOverdueDays: r.maximumOverdueDays,
      lastContact: lastAct?.activityDate ?? null,
      nextFollowUp: nextAct?.nextFollowUpDate ?? null,
      paymentPromise: r.promisedPaymentDate,
      promiseAmount: promisesStore.find((p) => p.customerId === r.customerId && p.status === 'Active')?.promiseAmount ?? null,
      collectionOwner: r.collectionOwner,
      collectionStatus: r.collectionStatus,
      isBrokenPromise: broken,
      hasDispute: r.hasDispute,
    }
  })

  const tab = f.collectionTab
  const today = new Date().toISOString().slice(0, 10)
  if (tab === 'my_worklist') items = items.filter((i) => i.collectionOwner === user.name || true)
  if (tab === 'due_today') items = items.filter((i) => i.nextFollowUp === today)
  if (tab === 'overdue_followups') items = items.filter((i) => i.nextFollowUp && i.nextFollowUp < today)
  if (tab === 'payment_promises') items = items.filter((i) => Boolean(i.paymentPromise))
  if (tab === 'broken_promises') items = items.filter((i) => i.isBrokenPromise)
  if (tab === 'disputes') items = items.filter((i) => i.hasDispute)
  if (tab === 'completed') items = items.filter((i) => i.collectionStatus === 'Closed')

  if (f.priority === 'Highest Overdue') items.sort((a, b) => b.overdue - a.overdue)
  else if (f.priority === 'Highest Outstanding') items.sort((a, b) => b.totalOutstanding - a.totalOutstanding)
  else if (f.priority === 'Oldest Invoice') items.sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays)
  else if (f.priority === 'Broken Promise') items.sort((a, b) => Number(b.isBrokenPromise) - Number(a.isBrokenPromise))
  else items.sort((a, b) => b.overdue - a.overdue)

  return items.map((item, i) => ({ ...item, priority: i + 1 }))
}

export async function createCollectionActivity(
  input: Omit<CollectionActivity, 'id' | 'createdAt' | 'createdBy' | 'customerName'> & { customerName?: string },
): Promise<CollectionActivity> {
  await delay()
  const customer = customersStore.find((c) => c.id === input.customerId)
  if (!customer) throw new ReceivablesServiceError('Customer not found.')
  const user = getSessionUser()
  const activity: CollectionActivity = {
    ...input,
    id: `cact-${Date.now()}`,
    customerName: input.customerName ?? customer.customerName,
    createdAt: new Date().toISOString(),
    createdBy: user.name,
  }
  activitiesStore = [activity, ...activitiesStore]
  pushAudit('collection_activity', activity.id, 'Created', `${activity.activityType} — ${activity.outcome}`)
  if (activity.activityType === 'Email' || activity.activityType === 'WhatsApp') {
    // Demo only — no real messaging
  }
  return activity
}

export async function createPaymentPromise(
  input: Omit<PaymentPromise, 'id' | 'createdAt' | 'collectedAmount' | 'customerName'> & { customerName?: string },
): Promise<PaymentPromise> {
  await delay()
  const customer = customersStore.find((c) => c.id === input.customerId)
  if (!customer) throw new ReceivablesServiceError('Customer not found.')
  const promise: PaymentPromise = {
    ...input,
    id: `pprom-${Date.now()}`,
    customerName: input.customerName ?? customer.customerName,
    collectedAmount: 0,
    createdAt: new Date().toISOString(),
  }
  promisesStore = [promise, ...promisesStore]
  pushAudit('payment_promise', promise.id, 'Created', `Promise ${promise.promiseDate} for ${promise.promiseAmount}`)
  return promise
}

export async function updatePaymentPromise(id: string, patch: Partial<PaymentPromise>): Promise<PaymentPromise> {
  await delay()
  const idx = promisesStore.findIndex((p) => p.id === id)
  if (idx < 0) throw new ReceivablesServiceError('Payment promise not found.')
  promisesStore[idx] = { ...promisesStore[idx], ...patch, id }
  pushAudit('payment_promise', id, 'Updated', patch.status ? `Status → ${patch.status}` : 'Updated')
  return promisesStore[idx]
}

export async function getCustomerReceipts(filter: Partial<ReceivableFilter> = {}): Promise<CustomerReceipt[]> {
  await delay()
  return filterReceipts(filter)
}

export async function getCustomerReceiptById(receiptId: string): Promise<CustomerReceipt> {
  await delay()
  const r = receiptsStore.find((x) => x.id === receiptId)
  if (!r) throw new ReceivablesServiceError('Customer receipt not found.')
  return r
}

function validateReceiptInput(input: ReceiptDraftInput) {
  const errors: string[] = []
  if (!input.customerId) errors.push('Customer is required')
  if (!input.receiptDate) errors.push('Receipt Date is required')
  if (!input.postingDate) errors.push('Posting Date is required')
  if (!input.paymentMode) errors.push('Payment Mode is required')
  if (!input.bankOrCashAccountId) errors.push('Bank or Cash Account is required')
  if (!(input.receiptAmount > 0)) errors.push('Receipt Amount must be greater than zero')
  if (ELECTRONIC_PAYMENT_MODES.includes(input.paymentMode) && !input.transactionReference?.trim()) {
    errors.push('Transaction Reference is required for electronic payment modes')
  }
  if (input.paymentMode === 'Cheque') {
    if (!input.chequeNumber?.trim()) errors.push('Cheque Number is required')
    if (!input.chequeDate) errors.push('Cheque Date is required')
    if (!input.bankName?.trim()) errors.push('Bank Name is required for cheque payments')
  }
  if (input.currency && input.currency !== 'INR' && !(input.exchangeRate && input.exchangeRate > 0)) {
    errors.push('Exchange Rate is required for foreign currency')
  }
  return errors
}

export async function createCustomerReceipt(input: ReceiptDraftInput): Promise<CustomerReceipt> {
  await delay()
  const errors = validateReceiptInput(input)
  if (errors.length) throw new ReceivablesServiceError(errors.join('; '))
  const customer = customersStore.find((c) => c.id === input.customerId)
  if (!customer) throw new ReceivablesServiceError('Customer not found.')
  const bank = RECEIVABLE_BANK_ACCOUNTS.find((b) => b.id === input.bankOrCashAccountId)
  if (!bank) throw new ReceivablesServiceError('Bank or Cash Account not found.')
  const tds = input.tdsDeducted ?? 0
  const charges = input.bankCharges ?? 0
  const net = input.receiptAmount - tds - charges
  const seq = receiptsStore.length + 1
  const allocationLines: ReceiptAllocationLine[] = []
  let allocated = 0
  for (const line of input.allocationLines ?? []) {
    const inv = invoicesStore.find((i) => i.id === line.invoiceId)
    if (!inv) continue
    const amount = Math.min(line.allocationAmount, inv.outstandingBalance, net - allocated)
    if (amount <= 0) continue
    allocationLines.push({
      id: `ral-${Date.now()}-${allocationLines.length}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      originalAmount: inv.originalAmount,
      previousAllocation: inv.appliedAmount,
      outstandingBalance: inv.outstandingBalance,
      overdueDays: inv.overdueDays,
      discountEligible: false,
      tdsAmount: line.tdsAmount ?? 0,
      allocationAmount: amount,
      remainingBalance: inv.outstandingBalance - amount,
      status: amount >= inv.outstandingBalance ? 'Fully Allocated' : 'Partial',
    })
    allocated += amount
  }
  const user = getSessionUser()
  const receipt: CustomerReceipt = {
    id: `rcpt-${Date.now()}`,
    receiptNumber: `RCPT-DRAFT-${String(seq).padStart(4, '0')}`,
    receiptDate: input.receiptDate,
    postingDate: input.postingDate,
    customerId: customer.id,
    customerCode: customer.customerCode,
    customerName: customer.customerName,
    customerBankReference: input.customerBankReference ?? null,
    paymentMode: input.paymentMode,
    bankOrCashAccountId: bank.id,
    bankOrCashAccountName: bank.name,
    transactionReference: input.transactionReference ?? null,
    chequeNumber: input.chequeNumber ?? null,
    chequeDate: input.chequeDate ?? null,
    bankName: input.bankName ?? null,
    currency: input.currency ?? 'INR',
    exchangeRate: input.exchangeRate ?? 1,
    receiptAmount: input.receiptAmount,
    tdsDeducted: tds,
    bankCharges: charges,
    netAmountReceived: net,
    allocatedAmount: allocated,
    unallocatedAmount: Math.max(0, net - allocated),
    allocationStatus: deriveAllocationStatus(net, allocated),
    voucherStatus: 'Draft',
    narration: input.narration ?? '',
    internalRemarks: input.internalRemarks ?? '',
    createdBy: user.name,
    postedBy: null,
    postedAt: null,
    relatedVoucherId: null,
    relatedVoucherNumber: null,
    originalReceiptId: null,
    reversalReceiptId: null,
    allocationLines,
    attachments: [],
  }
  receiptsStore = [receipt, ...receiptsStore]
  pushAudit('receipt', receipt.id, 'Created', `Draft receipt ${receipt.receiptNumber}`)
  return receipt
}

export async function updateCustomerReceipt(receiptId: string, input: Partial<ReceiptDraftInput> & { voucherStatus?: CustomerReceipt['voucherStatus'] }): Promise<CustomerReceipt> {
  await delay()
  const idx = receiptsStore.findIndex((r) => r.id === receiptId)
  if (idx < 0) throw new ReceivablesServiceError('Customer receipt not found.')
  const existing = receiptsStore[idx]
  if (existing.voucherStatus === 'Posted' || existing.voucherStatus === 'Reversed') {
    throw new ReceivablesServiceError('Posted or reversed receipts cannot be edited.')
  }
  const merged: ReceiptDraftInput = {
    receiptDate: input.receiptDate ?? existing.receiptDate,
    postingDate: input.postingDate ?? existing.postingDate,
    customerId: input.customerId ?? existing.customerId,
    customerBankReference: input.customerBankReference ?? existing.customerBankReference,
    paymentMode: input.paymentMode ?? existing.paymentMode,
    bankOrCashAccountId: input.bankOrCashAccountId ?? existing.bankOrCashAccountId,
    transactionReference: input.transactionReference ?? existing.transactionReference,
    chequeNumber: input.chequeNumber ?? existing.chequeNumber,
    chequeDate: input.chequeDate ?? existing.chequeDate,
    bankName: input.bankName ?? existing.bankName,
    currency: input.currency ?? existing.currency,
    exchangeRate: input.exchangeRate ?? existing.exchangeRate,
    receiptAmount: input.receiptAmount ?? existing.receiptAmount,
    tdsDeducted: input.tdsDeducted ?? existing.tdsDeducted,
    bankCharges: input.bankCharges ?? existing.bankCharges,
    narration: input.narration ?? existing.narration,
    internalRemarks: input.internalRemarks ?? existing.internalRemarks,
    allocationLines: input.allocationLines,
  }
  const errors = validateReceiptInput(merged)
  if (errors.length) throw new ReceivablesServiceError(errors.join('; '))
  const customer = customersStore.find((c) => c.id === merged.customerId)!
  const bank = RECEIVABLE_BANK_ACCOUNTS.find((b) => b.id === merged.bankOrCashAccountId)!
  const tds = merged.tdsDeducted ?? 0
  const charges = merged.bankCharges ?? 0
  const net = merged.receiptAmount - tds - charges
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
        id: `ral-${Date.now()}-${allocationLines.length}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        originalAmount: inv.originalAmount,
        previousAllocation: inv.appliedAmount,
        outstandingBalance: inv.outstandingBalance,
        overdueDays: inv.overdueDays,
        discountEligible: false,
        tdsAmount: line.tdsAmount ?? 0,
        allocationAmount: amount,
        remainingBalance: inv.outstandingBalance - amount,
        status: amount >= inv.outstandingBalance ? 'Fully Allocated' : 'Partial',
      })
      allocated += amount
    }
  }
  const updated: CustomerReceipt = {
    ...existing,
    ...merged,
    customerCode: customer.customerCode,
    customerName: customer.customerName,
    bankOrCashAccountName: bank.name,
    tdsDeducted: tds,
    bankCharges: charges,
    netAmountReceived: net,
    allocatedAmount: allocated,
    unallocatedAmount: Math.max(0, net - allocated),
    allocationStatus: deriveAllocationStatus(net, allocated),
    allocationLines,
    voucherStatus: input.voucherStatus ?? existing.voucherStatus,
  }
  receiptsStore[idx] = updated
  pushAudit('receipt', receiptId, 'Updated', `Receipt ${updated.receiptNumber} updated (demo)`)
  return updated
}

export async function getReceiptAllocationPreview(receiptId: string): Promise<ReceiptAllocation> {
  await delay()
  const r = await getCustomerReceiptById(receiptId)
  const available = r.netAmountReceived
  return {
    receiptId: r.id,
    lines: r.allocationLines,
    receiptAmount: r.receiptAmount,
    tdsDeducted: r.tdsDeducted,
    bankCharges: r.bankCharges,
    amountAvailable: available,
    allocatedAmount: r.allocatedAmount,
    unallocatedAmount: r.unallocatedAmount,
    allocationStatus: r.allocationStatus,
  }
}

export async function getOpenInvoicesForAllocation(customerId: string): Promise<ReceivableInvoice[]> {
  await delay()
  refreshInvoiceAgeing()
  return invoicesStore.filter(
    (i) => i.customerId === customerId && i.outstandingBalance > 0 && i.invoiceStatus !== 'Cancelled' && i.invoiceStatus !== 'Paid',
  )
}

export async function getReceiptAllocationPreviewByMethod(
  customerId: string,
  availableAmount: number,
  method: AutoAllocationMethod,
): Promise<AutoAllocationPreview> {
  await delay()
  let invs = await getOpenInvoicesForAllocation(customerId)
  if (method === 'Oldest Due First') invs = [...invs].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  else if (method === 'Oldest Invoice First') invs = [...invs].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))
  else if (method === 'Smallest Balance First') invs = [...invs].sort((a, b) => a.outstandingBalance - b.outstandingBalance)
  else if (method === 'Exact Amount Match') {
    const exact = invs.find((i) => Math.abs(i.outstandingBalance - availableAmount) < 0.01)
    invs = exact ? [exact] : [...invs].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }

  let remaining = availableAmount
  const proposed: ReceiptAllocationLine[] = []
  for (const inv of invs) {
    if (remaining <= 0) break
    const amount = Math.min(inv.outstandingBalance, remaining)
    proposed.push({
      id: `preview-${inv.id}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      originalAmount: inv.originalAmount,
      previousAllocation: inv.appliedAmount,
      outstandingBalance: inv.outstandingBalance,
      overdueDays: inv.overdueDays,
      discountEligible: false,
      tdsAmount: 0,
      allocationAmount: amount,
      remainingBalance: inv.outstandingBalance - amount,
      status: 'Proposed',
    })
    remaining -= amount
  }
  const totalAllocated = availableAmount - remaining
  return {
    method,
    receiptAmount: availableAmount,
    invoiceCount: proposed.length,
    totalAllocated,
    remainingAmount: remaining,
    proposedLines: proposed,
  }
}

export async function allocateReceiptDemo(
  receiptId: string,
  lines: { invoiceId: string; allocationAmount: number; tdsAmount?: number }[],
): Promise<CustomerReceipt> {
  await delay()
  return updateCustomerReceipt(receiptId, { allocationLines: lines })
}

export async function getReceiptPostingPreview(receiptId: string): Promise<ReceiptPostingPreview> {
  await delay()
  const r = await getCustomerReceiptById(receiptId)
  const customer = customersStore.find((c) => c.id === r.customerId)
  const warnings: string[] = []
  if (r.allocationStatus === 'Partially Allocated' || r.allocationStatus === 'Unallocated') {
    warnings.push('Receipt is partially allocated')
  }
  if (customer?.creditStatus === 'Credit Hold') warnings.push('Customer is on credit hold')
  if (r.transactionReference) {
    const dup = receiptsStore.some(
      (x) => x.id !== r.id && x.transactionReference === r.transactionReference && x.voucherStatus !== 'Reversed',
    )
    if (dup) warnings.push('Duplicate transaction reference')
  }
  if (!r.bankOrCashAccountId) warnings.push('Bank account not configured')
  if (r.tdsDeducted > 0 && !r.narration.toLowerCase().includes('tds')) {
    warnings.push('TDS details incomplete')
  }
  return {
    receiptNumber: r.receiptNumber,
    customerName: r.customerName,
    receiptAmount: r.receiptAmount,
    allocatedAmount: r.allocatedAmount,
    unallocatedAmount: r.unallocatedAmount,
    bankOrCashAccountName: r.bankOrCashAccountName,
    customerControlAccount: '1121 — Trade Debtors',
    tdsAmount: r.tdsDeducted,
    bankCharges: r.bankCharges,
    postingDate: r.postingDate,
    warnings,
  }
}

export async function postReceiptDemo(receiptId: string): Promise<CustomerReceipt> {
  await delay()
  const idx = receiptsStore.findIndex((r) => r.id === receiptId)
  if (idx < 0) throw new ReceivablesServiceError('Customer receipt not found.')
  const existing = receiptsStore[idx]
  if (existing.voucherStatus === 'Posted') throw new ReceivablesServiceError('Receipt is already posted (demo).')
  if (existing.voucherStatus === 'Reversed') throw new ReceivablesServiceError('Reversed receipts cannot be posted.')
  const user = getSessionUser()
  const seq = receiptsStore.filter((r) => r.voucherStatus === 'Posted').length + 1
  const posted: CustomerReceipt = {
    ...existing,
    receiptNumber: existing.receiptNumber.startsWith('RCPT-DRAFT')
      ? `RCPT-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
      : existing.receiptNumber,
    voucherStatus: 'Posted',
    postedBy: user.name,
    postedAt: new Date().toISOString(),
    relatedVoucherId: `voucher-demo-${Date.now()}`,
    relatedVoucherNumber: `RV-${String(seq).padStart(4, '0')}`,
  }
  // Demo: update invoice applied amounts in memory only
  for (const line of posted.allocationLines) {
    const invIdx = invoicesStore.findIndex((i) => i.id === line.invoiceId)
    if (invIdx < 0) continue
    const inv = invoicesStore[invIdx]
    const applied = inv.appliedAmount + line.allocationAmount
    const bal = Math.max(0, inv.originalAmount - applied - inv.creditNoteAmount)
    invoicesStore[invIdx] = {
      ...inv,
      appliedAmount: applied,
      outstandingBalance: bal,
      invoiceStatus: bal <= 0 ? 'Paid' : applied > 0 ? 'Partially Paid' : inv.invoiceStatus,
    }
  }
  receiptsStore[idx] = posted
  pushAudit('receipt', receiptId, 'Posted (demo)', 'Receipt marked as posted in demo mode. Backend accounting posting is not connected.')
  return posted
}

export async function reverseReceiptDemo(receiptId: string, reason: string): Promise<CustomerReceipt> {
  await delay()
  const idx = receiptsStore.findIndex((r) => r.id === receiptId)
  if (idx < 0) throw new ReceivablesServiceError('Customer receipt not found.')
  const existing = receiptsStore[idx]
  if (existing.voucherStatus !== 'Posted') throw new ReceivablesServiceError('Only posted receipts can be reversed (demo).')
  const user = getSessionUser()
  const reversal: CustomerReceipt = {
    ...existing,
    id: `rcpt-rev-${Date.now()}`,
    receiptNumber: `${existing.receiptNumber}-R`,
    voucherStatus: 'Reversed',
    receiptAmount: -existing.receiptAmount,
    allocatedAmount: 0,
    unallocatedAmount: 0,
    allocationStatus: 'Unallocated',
    allocationLines: [],
    originalReceiptId: existing.id,
    relatedVoucherId: `voucher-rev-${Date.now()}`,
    relatedVoucherNumber: `REV-${existing.relatedVoucherNumber ?? existing.receiptNumber}`,
    postedBy: user.name,
    postedAt: new Date().toISOString(),
    narration: `Reversal of ${existing.receiptNumber}: ${reason}`,
    internalRemarks: reason,
  }
  receiptsStore[idx] = {
    ...existing,
    voucherStatus: 'Reversed',
    reversalReceiptId: reversal.id,
  }
  receiptsStore = [reversal, ...receiptsStore]
  // Demo: restore invoice balances
  for (const line of existing.allocationLines) {
    const invIdx = invoicesStore.findIndex((i) => i.id === line.invoiceId)
    if (invIdx < 0) continue
    const inv = invoicesStore[invIdx]
    const applied = Math.max(0, inv.appliedAmount - line.allocationAmount)
    const bal = Math.max(0, inv.originalAmount - applied - inv.creditNoteAmount)
    invoicesStore[invIdx] = {
      ...inv,
      appliedAmount: applied,
      outstandingBalance: bal,
      invoiceStatus: bal <= 0 ? 'Paid' : applied > 0 ? 'Partially Paid' : 'Open',
    }
  }
  pushAudit('receipt', receiptId, 'Reversed (demo)', reason)
  return reversal
}

export async function getCreditNotes(filter: Partial<ReceivableFilter> = {}): Promise<CreditNote[]> {
  await delay()
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  return creditNotesStore.filter((cn) => {
    if (f.search) {
      const blob = `${cn.creditNoteNumber} ${cn.customerName} ${cn.referenceInvoiceNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.customerId && cn.customerId !== f.customerId) return false
    const tab = f.creditNoteTab
    if (tab && tab !== 'all') {
      const map: Record<string, CreditNote['status']> = {
        draft: 'Draft',
        pending_approval: 'Pending Approval',
        posted: 'Posted',
        applied: 'Applied',
        partially_applied: 'Partially Applied',
        unapplied: 'Unapplied',
        cancelled: 'Cancelled',
      }
      if (map[tab] && cn.status !== map[tab]) return false
    }
    return true
  })
}

export async function getCustomerDisputes(filter: Partial<ReceivableFilter> = {}): Promise<CustomerDispute[]> {
  await delay()
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  return disputesStore.filter((d) => {
    if (f.search) {
      const blob = `${d.disputeNumber} ${d.customerName} ${d.invoiceNumber}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.customerId && d.customerId !== f.customerId) return false
    const tab = f.disputeTab
    if (tab && tab !== 'all') {
      const map: Record<string, CustomerDispute['status']> = {
        open: 'Open',
        under_review: 'Under Review',
        awaiting_customer: 'Awaiting Customer',
        awaiting_internal_team: 'Awaiting Internal Team',
        resolved: 'Resolved',
        rejected: 'Rejected',
        closed: 'Closed',
      }
      if (map[tab] && d.status !== map[tab]) return false
    }
    return true
  })
}

export async function createDispute(
  input: Omit<CustomerDispute, 'id' | 'disputeNumber' | 'createdAt' | 'customerName' | 'supportingDocuments'> & {
    supportingDocuments?: string[]
  },
): Promise<CustomerDispute> {
  await delay()
  const customer = customersStore.find((c) => c.id === input.customerId)
  if (!customer) throw new ReceivablesServiceError('Customer not found.')
  const seq = disputesStore.length + 1
  const dispute: CustomerDispute = {
    ...input,
    id: `disp-${Date.now()}`,
    disputeNumber: `DSP-${String(seq).padStart(4, '0')}`,
    customerName: customer.customerName,
    supportingDocuments: input.supportingDocuments ?? [],
    createdAt: new Date().toISOString(),
  }
  disputesStore = [dispute, ...disputesStore]
  const invIdx = invoicesStore.findIndex((i) => i.id === dispute.invoiceId)
  if (invIdx >= 0) {
    invoicesStore[invIdx] = { ...invoicesStore[invIdx], hasDispute: true, invoiceStatus: 'Disputed', collectionStatus: 'Disputed' }
  }
  pushAudit('dispute', dispute.id, 'Created', dispute.disputeType)
  return dispute
}

export async function updateDispute(id: string, patch: Partial<CustomerDispute>): Promise<CustomerDispute> {
  await delay()
  const idx = disputesStore.findIndex((d) => d.id === id)
  if (idx < 0) throw new ReceivablesServiceError('Dispute not found.')
  disputesStore[idx] = { ...disputesStore[idx], ...patch, id }
  pushAudit('dispute', id, 'Updated', patch.status ? `Status → ${patch.status}` : 'Updated')
  return disputesStore[idx]
}

export async function getPaymentReminders(filter: Partial<ReceivableFilter> = {}): Promise<PaymentReminder[]> {
  await delay()
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  return remindersStore.filter((r) => {
    if (r.excluded) return false
    if (f.search) {
      const blob = `${r.customerName} ${r.invoiceNumber} ${r.email}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.customerId && r.customerId !== f.customerId) return false
    if (f.reminderCategory && r.category !== f.reminderCategory) return false
    if (f.collectionOwner && r.collectionOwner !== f.collectionOwner) return false
    return true
  })
}

export async function createReminderPreview(reminderId: string, channel: 'email' | 'whatsapp' | 'print'): Promise<{
  subject: string
  body: string
  channel: string
  disclaimer: string
}> {
  await delay()
  const r = remindersStore.find((x) => x.id === reminderId)
  if (!r) throw new ReceivablesServiceError('Reminder not found.')
  return {
    channel,
    subject: `${r.reminderLevel}: Invoice ${r.invoiceNumber} — ${COMPANY_NAME}`,
    body: `Dear ${r.contactPerson},\n\nThis is a ${r.reminderLevel.toLowerCase()} regarding invoice ${r.invoiceNumber} due on ${r.dueDate}. Outstanding amount: ₹${r.outstandingAmount.toLocaleString('en-IN')}.\n\nPlease arrange payment at the earliest.\n\nRegards,\n${r.collectionOwner}\n${COMPANY_NAME}`,
    disclaimer: 'Communication integration is not connected.',
  }
}

export async function markReminderDemo(reminderId: string): Promise<PaymentReminder> {
  await delay()
  const idx = remindersStore.findIndex((r) => r.id === reminderId)
  if (idx < 0) throw new ReceivablesServiceError('Reminder not found.')
  remindersStore[idx] = {
    ...remindersStore[idx],
    lastReminderDate: new Date().toISOString().slice(0, 10),
    demoMarkedSentAt: new Date().toISOString(),
  }
  pushAudit('reminder', reminderId, 'Marked sent (demo)', 'Reminder marked as sent in demo mode. No message was delivered.')
  return remindersStore[idx]
}

export async function excludeReminderDemo(reminderId: string): Promise<PaymentReminder> {
  await delay()
  const idx = remindersStore.findIndex((r) => r.id === reminderId)
  if (idx < 0) throw new ReceivablesServiceError('Reminder not found.')
  remindersStore[idx] = { ...remindersStore[idx], excluded: true }
  return remindersStore[idx]
}

export async function getCustomerReceivableCard(customerId: string): Promise<CustomerReceivableCard> {
  await delay()
  const customer = customersStore.find((c) => c.id === customerId)
  if (!customer) throw new ReceivablesServiceError('Customer not found.')
  refreshInvoiceAgeing()
  const openInvoices = invoicesStore.filter((i) => i.customerId === customerId)
  const openBal = openInvoices.filter((i) => i.outstandingBalance > 0)
  const totalOutstanding = openBal.reduce((s, i) => s + i.outstandingBalance, 0)
  const overdue = openBal.filter((i) => i.overdueDays > 0).reduce((s, i) => s + i.outstandingBalance, 0)
  const receipts = receiptsStore.filter((r) => r.customerId === customerId)
  const lastReceipt = [...receipts].filter((r) => r.voucherStatus === 'Posted').sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))[0] ?? null
  const disputes = disputesStore.filter((d) => d.customerId === customerId)
  const disputeAmount = disputes.filter((d) => !['Resolved', 'Rejected', 'Closed'].includes(d.status)).reduce((s, d) => s + d.disputedAmount, 0)
  const ageing = Object.fromEntries(RECEIVABLE_AGEING_BUCKETS.map((b) => [b, openBal.filter((i) => i.ageingBucket === b).reduce((s, i) => s + i.outstandingBalance, 0)])) as Record<ReceivableAgeingBucket, number>
  const alerts: string[] = []
  if (customer.creditStatus === 'Credit Hold') alerts.push('Customer is on credit hold')
  if (customer.creditLimit > 0 && totalOutstanding > customer.creditLimit) alerts.push('Outstanding exceeds credit limit')
  if (overdue > 0) alerts.push(`Overdue balance outstanding`)
  if (disputeAmount > 0) alerts.push('Open dispute(s) on invoices')
  return {
    customer,
    creditLimit: customer.creditLimit,
    totalOutstanding,
    overdue,
    availableCredit: Math.max(0, customer.creditLimit - totalOutstanding),
    averageCollectionDays: customer.averageCollectionDays,
    lastReceipt,
    openInvoiceCount: openBal.length,
    disputeAmount,
    creditUtilization: customer.creditLimit > 0 ? Math.round((totalOutstanding / customer.creditLimit) * 1000) / 10 : 0,
    ageing,
    openInvoices,
    receipts,
    creditNotes: creditNotesStore.filter((c) => c.customerId === customerId),
    disputes,
    activities: activitiesStore.filter((a) => a.customerId === customerId),
    promises: promisesStore.filter((p) => p.customerId === customerId),
    alerts,
    audit: auditStore.filter((a) => a.entityId === customerId || openInvoices.some((i) => i.id === a.entityId) || receipts.some((r) => r.id === a.entityId)),
  }
}

export async function getCustomerStatementPreview(opts: {
  customerId: string
  dateFrom: string
  dateTo: string
  statementType: StatementType
  includeOpenEntriesOnly?: boolean
  includeSettledEntries?: boolean
  includeCreditNotes?: boolean
  includeReceipts?: boolean
  includeAgeingSummary?: boolean
  includeContactDetails?: boolean
}): Promise<CustomerStatement> {
  await delay()
  const customer = customersStore.find((c) => c.id === opts.customerId)
  if (!customer) throw new ReceivablesServiceError('Customer not found.')
  const lines: CustomerStatement['lines'] = []
  let running = 0
  const invs = invoicesStore.filter(
    (i) =>
      i.customerId === opts.customerId &&
      i.invoiceDate >= opts.dateFrom &&
      i.invoiceDate <= opts.dateTo &&
      i.invoiceStatus !== 'Cancelled' &&
      (!opts.includeOpenEntriesOnly || i.outstandingBalance > 0) &&
      (opts.includeSettledEntries !== false || i.outstandingBalance > 0 || true),
  )
  for (const inv of invs.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))) {
    if (opts.includeOpenEntriesOnly && inv.outstandingBalance <= 0 && !opts.includeSettledEntries) continue
    running += inv.originalAmount
    lines.push({
      date: inv.invoiceDate,
      documentNumber: inv.invoiceNumber,
      documentType: 'Invoice',
      reference: inv.salesOrderNumber ?? '',
      debit: inv.originalAmount,
      credit: 0,
      runningBalance: running,
    })
  }
  if (opts.includeReceipts !== false) {
    for (const r of receiptsStore
      .filter((x) => x.customerId === opts.customerId && x.receiptDate >= opts.dateFrom && x.receiptDate <= opts.dateTo && x.voucherStatus === 'Posted')
      .sort((a, b) => a.receiptDate.localeCompare(b.receiptDate))) {
      running -= r.receiptAmount
      lines.push({
        date: r.receiptDate,
        documentNumber: r.receiptNumber,
        documentType: 'Receipt',
        reference: r.transactionReference ?? '',
        debit: 0,
        credit: r.receiptAmount,
        runningBalance: running,
      })
    }
  }
  if (opts.includeCreditNotes !== false) {
    for (const cn of creditNotesStore.filter(
      (c) => c.customerId === opts.customerId && c.creditNoteDate >= opts.dateFrom && c.creditNoteDate <= opts.dateTo && c.status !== 'Cancelled' && c.status !== 'Draft',
    )) {
      running -= cn.originalAmount
      lines.push({
        date: cn.creditNoteDate,
        documentNumber: cn.creditNoteNumber,
        documentType: 'Credit Note',
        reference: cn.referenceInvoiceNumber ?? '',
        debit: 0,
        credit: cn.originalAmount,
        runningBalance: running,
      })
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.documentNumber.localeCompare(b.documentNumber))
  let bal = 0
  for (const line of lines) {
    bal += line.debit - line.credit
    line.runningBalance = bal
  }
  const card = await getCustomerReceivableCard(opts.customerId)
  return {
    companyName: COMPANY_NAME,
    customerId: customer.id,
    customerName: customer.customerName,
    customerAddress: customer.billingAddress,
    gstNumber: customer.gstNumber,
    statementPeriodFrom: opts.dateFrom,
    statementPeriodTo: opts.dateTo,
    statementType: opts.statementType,
    openingBalance: 0,
    closingBalance: bal,
    lines: opts.statementType === 'Summary' ? lines.slice(0, 0) : lines,
    ageingSummary: opts.includeAgeingSummary ? card.ageing : null,
    contactDetails: opts.includeContactDetails
      ? { person: customer.contactPerson, email: customer.email, mobile: customer.mobile }
      : null,
  }
}

export async function placeCustomerOnHoldDemo(input: CreditHoldInput): Promise<ReceivableCustomer> {
  await delay()
  const idx = customersStore.findIndex((c) => c.id === input.customerId)
  if (idx < 0) throw new ReceivablesServiceError('Customer not found.')
  customersStore[idx] = { ...customersStore[idx], creditStatus: 'Credit Hold' }
  pushAudit('customer', input.customerId, 'Credit hold (demo)', `${input.holdReason}: ${input.internalNote}`)
  return customersStore[idx]
}

export async function releaseCustomerHoldDemo(input: CreditHoldReleaseInput): Promise<ReceivableCustomer> {
  await delay()
  const idx = customersStore.findIndex((c) => c.id === input.customerId)
  if (idx < 0) throw new ReceivablesServiceError('Customer not found.')
  customersStore[idx] = { ...customersStore[idx], creditStatus: 'Temporarily Released' }
  pushAudit('customer', input.customerId, 'Credit hold released (demo)', `${input.releaseReason} until ${input.validUntil}`)
  return customersStore[idx]
}

export async function getReceivableAuditTrail(entityId?: string): Promise<ReceivableAuditEntry[]> {
  await delay()
  if (!entityId) return [...auditStore]
  return auditStore.filter((a) => a.entityId === entityId)
}

export async function getSavedReceivableViews(): Promise<ReceivableSavedView[]> {
  await delay()
  return [...savedViewsStore]
}

export async function saveReceivableView(
  view: Omit<ReceivableSavedView, 'id' | 'createdAt' | 'isDemo'> & { id?: string },
): Promise<ReceivableSavedView> {
  await delay()
  if (view.id) {
    const idx = savedViewsStore.findIndex((v) => v.id === view.id)
    if (idx >= 0) {
      savedViewsStore[idx] = { ...savedViewsStore[idx], ...view, id: view.id, isDemo: false }
      return savedViewsStore[idx]
    }
  }
  const saved: ReceivableSavedView = {
    ...view,
    id: `rsv-${Date.now()}`,
    createdAt: new Date().toISOString(),
    isDemo: true,
  }
  savedViewsStore = [saved, ...savedViewsStore]
  return saved
}

export async function deleteReceivableView(id: string): Promise<void> {
  await delay()
  savedViewsStore = savedViewsStore.filter((v) => v.id !== id)
}

export async function exportReceivables(req: ReceivableExportRequest): Promise<{ filename: string; content: string; disclaimer: string }> {
  await delay()
  const disclaimer = 'Export generated in demo mode. Backend export service is not connected.'
  let rows: string[][] = [['Demo export', req.scope, req.format]]
  if (req.scope === 'customer_outstanding') {
    const data = await getCustomerOutstanding(req.filter)
    rows = [['Customer Code', 'Customer Name', 'Outstanding', 'Overdue'], ...data.map((d) => [d.customerCode, d.customerName, String(d.totalOutstanding), String(d.overdueAmount)])]
  } else if (req.scope === 'open_invoices') {
    const data = await getReceivableInvoices(req.filter)
    rows = [['Invoice', 'Customer', 'Balance'], ...data.map((d) => [d.invoiceNumber, d.customerName, String(d.outstandingBalance)])]
  } else if (req.scope === 'receipts') {
    const data = await getCustomerReceipts(req.filter)
    rows = [['Receipt', 'Customer', 'Amount'], ...data.map((d) => [d.receiptNumber, d.customerName, String(d.receiptAmount)])]
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  return {
    filename: `receivables-${req.scope}-${new Date().toISOString().slice(0, 10)}.${req.format === 'csv' ? 'csv' : req.format === 'pdf' ? 'txt' : 'csv'}`,
    content: csv,
    disclaimer,
  }
}

export async function getReceivablePrintPreview(opts: {
  reportName: string
  subtitle?: string
  filtersApplied?: string
  htmlBody: string
}): Promise<ReceivablePrintPreview> {
  await delay()
  const user = getSessionUser()
  const generatedAt = new Date().toLocaleString('en-IN')
  const html = `<!DOCTYPE html><html><head><title>${opts.reportName}</title>
<style>body{font-family:Segoe UI,sans-serif;font-size:12px;color:#0f172a}h1{font-size:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:4px 6px;text-align:left}.num{text-align:right}.meta{color:#64748b;font-size:11px}</style>
</head><body>
<p class="meta">${COMPANY_NAME}</p>
<h1>${opts.reportName}</h1>
<p class="meta">${opts.subtitle ?? ''}</p>
<p class="meta">Filters: ${opts.filtersApplied ?? 'None'} · Generated by ${user.name} · ${generatedAt}</p>
${opts.htmlBody}
</body></html>`
  return {
    companyName: COMPANY_NAME,
    reportName: opts.reportName,
    subtitle: opts.subtitle ?? '',
    filtersApplied: opts.filtersApplied ?? '',
    generatedBy: user.name,
    generatedAt,
    html,
  }
}

export async function getReceivableCustomerById(customerId: string): Promise<ReceivableCustomer> {
  await delay()
  const c = customersStore.find((x) => x.id === customerId)
  if (!c) throw new ReceivablesServiceError('Customer not found.')
  return c
}

export function validateReceiptDraft(input: ReceiptDraftInput): { infoErrors: string[]; allocationErrors: string[] } {
  const infoErrors = validateReceiptInput(input)
  const allocationErrors: string[] = []
  const tds = input.tdsDeducted ?? 0
  const charges = input.bankCharges ?? 0
  const available = input.receiptAmount - tds - charges
  let totalAlloc = 0
  for (const line of input.allocationLines ?? []) {
    const inv = invoicesStore.find((i) => i.id === line.invoiceId)
    if (!inv) {
      allocationErrors.push(`Invoice ${line.invoiceId} not found`)
      continue
    }
    if (line.allocationAmount > inv.outstandingBalance + 0.001) {
      allocationErrors.push(`Allocation amount exceeds invoice balance for ${inv.invoiceNumber}`)
    }
    totalAlloc += line.allocationAmount
  }
  if (totalAlloc > available + 0.001) {
    allocationErrors.push('Total allocation exceeds available receipt amount')
  }
  return { infoErrors, allocationErrors }
}
