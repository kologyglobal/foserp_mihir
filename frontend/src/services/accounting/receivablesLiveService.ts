/**
 * Receivables live service (Phase 8C Wave 2 — 8B-R-011).
 *
 * Adapts the live AR backend (`/accounting/receivables/*` via `receivablesApiBridge`)
 * onto the approved legacy Receivables view models (`types/receivables.ts`) so the
 * legacy screens render unchanged in API mode with real MySQL data.
 *
 * Rules:
 *  - API mode only. Never reads seed stores; failures surface as controlled errors.
 *  - Fields with no live backend yet (credit limit/hold, collection owner/activities,
 *    promises, dispute documents, salesperson/territory dimensions) resolve to neutral
 *    placeholders ('' / 0 / empty arrays) until their wave ships (W5/W6).
 */
import type {
  AgeingBasis,
  AllocationStatus,
  CreditNote,
  CustomerDispute,
  CustomerOutstandingSummary,
  CustomerReceipt,
  CustomerReceivableCard,
  CustomerStatement,
  DisputeStatus,
  DisputeType,
  ReceiptPaymentMode,
  ReceiptVoucherStatus,
  ReceivableAgeingBucket,
  ReceivableAgeingResult,
  ReceivableCustomer,
  ReceivableFilter,
  ReceivableInvoice,
  ReceivableLookups,
  ReceivablesDashboardData,
  StatementType,
} from '../../types/receivables'
import { DEFAULT_RECEIVABLE_FILTER, RECEIVABLE_AGEING_BUCKETS } from '../../types/receivables'
import type {
  CustomerCreditNoteListItemDto,
  CustomerReceiptListItemDto,
  CustomerReceivableSummaryRow,
  OutstandingOpenItemDto,
  SalesInvoiceDto,
} from '../../types/moneyIn'
import type { ArDisputeDto, ArDisputePriority, ArDisputeStatus, ArDisputeType } from '../api/receivablesApi'
import { ensureLegalEntityId } from '../bridges/financeApiBridge'
import {
  allocateReceipt,
  createArDispute,
  getAgeingReport,
  getCustomerReceipt,
  getCustomerSummary,
  getReceivableOverview,
  listArDisputes,
  listCustomerCreditNotes,
  listCustomerOpenItems,
  listCustomerReceipts,
  listCustomerSummaries,
  listOutstanding,
  listReceiptAllocations,
  listSalesInvoices,
  markCustomerReceiptReady,
  postCustomerReceipt,
  reverseCustomerReceipt,
  transitionArDispute,
  updateArDispute,
  validateCustomerReceipt,
} from '../bridges/receivablesApiBridge'

/** Backend caps both `limit` and `pageSize` at 100; registers page through up to PAGE_CAP pages. */
const PAGE_SIZE = 100
const PAGE_CAP = 10

/** Drain a paginated reporting endpoint (`page`/`pageSize`, PaginatedResult). */
async function drainPaged<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= PAGE_CAP; page++) {
    const res = await fetchPage(page)
    all.push(...res.items)
    if (all.length >= res.total || res.items.length < PAGE_SIZE) break
  }
  return all
}

/** Drain an array-returning document list endpoint (`page`/`limit`). */
async function drainList<T>(fetchPage: (page: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= PAGE_CAP; page++) {
    const items = await fetchPage(page)
    all.push(...items)
    if (items.length < PAGE_SIZE) break
  }
  return all
}

function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

function bucketFromOverdueDays(overdueDays: number): ReceivableAgeingBucket {
  if (overdueDays <= 0) return 'Not Due'
  if (overdueDays <= 30) return '1–30 Days'
  if (overdueDays <= 60) return '31–60 Days'
  if (overdueDays <= 90) return '61–90 Days'
  if (overdueDays <= 180) return '91–180 Days'
  return 'Above 180 Days'
}

// ─── Open item / invoice mapping ────────────────────────────────────────────

function deriveInvoiceStatus(args: {
  isDisputed: boolean
  outstanding: number
  overdueDays: number
  applied: number
  dueDate: string | null
  docStatus?: string | null
}): ReceivableInvoice['invoiceStatus'] {
  if (args.docStatus === 'CANCELLED' || args.docStatus === 'REVERSED') return 'Cancelled'
  if (args.isDisputed) return 'Disputed'
  if (args.outstanding <= 0) return 'Paid'
  if (args.overdueDays > 0) return 'Overdue'
  if (args.dueDate && daysBetween(today(), args.dueDate) <= 7) return 'Due Soon'
  if (args.applied > 0) return 'Partially Paid'
  return 'Open'
}

const EMPTY_INVOICE_DIMENSIONS = {
  customerGstNumber: null as string | null,
  salesOrderNumber: null as string | null,
  deliveryNumber: null as string | null,
  paymentTerms: '',
  placeOfSupply: '',
  salesperson: '',
  territory: '',
  location: '',
  collectionStatus: 'Not Contacted' as const,
  collectionOwner: '',
  gstStatus: '',
  eInvoiceStatus: '—',
  eInvoiceIrn: null as string | null,
  eWayBillNumber: null as string | null,
  hasCreditNote: false,
  lastReminderDate: null as string | null,
  paymentPromiseDate: null as string | null,
  invoiceType: 'Tax Invoice',
}

export function mapOpenItemToLegacyInvoice(oi: OutstandingOpenItemDto): ReceivableInvoice {
  const outstanding = num(oi.outstandingAmount)
  const original = num(oi.originalAmount)
  const overdueDays = oi.daysOverdue ?? 0
  const applied = Math.max(0, original - outstanding)
  return {
    id: oi.salesInvoiceId ?? oi.openItemId,
    invoiceNumber: oi.invoiceNumber ?? oi.voucherNumber ?? '—',
    invoiceDate: oi.invoiceDate ?? '',
    postingDate: oi.postingDate ?? oi.invoiceDate ?? '',
    dueDate: oi.dueDate ?? '',
    customerId: oi.customerId,
    customerCode: oi.customerCode ?? '',
    customerName: oi.customerName ?? '',
    referenceNumber: oi.referenceNumber,
    originalAmount: original,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    appliedAmount: applied,
    creditNoteAmount: 0,
    outstandingBalance: outstanding,
    overdueDays: Math.max(0, overdueDays),
    ageingBucket: bucketFromOverdueDays(overdueDays),
    invoiceStatus: deriveInvoiceStatus({
      isDisputed: oi.isDisputed,
      outstanding,
      overdueDays,
      applied,
      dueDate: oi.dueDate,
    }),
    hasDispute: oi.isDisputed,
    sourceSalesInvoiceId: oi.salesInvoiceId,
    ...EMPTY_INVOICE_DIMENSIONS,
  }
}

function mapSalesInvoiceToLegacyInvoice(
  si: SalesInvoiceDto,
  openItemByInvoiceId: Map<string, OutstandingOpenItemDto>,
): ReceivableInvoice {
  const oi = openItemByInvoiceId.get(si.id)
  const outstanding = num(si.outstandingAmount)
  const overdueDays =
    oi?.daysOverdue ?? (si.dueDate && outstanding > 0 ? Math.max(0, daysBetween(si.dueDate, today())) : 0)
  const applied = num(si.amountPaid)
  return {
    id: si.id,
    invoiceNumber: si.invoiceNumber ?? si.draftReference ?? '—',
    invoiceDate: si.invoiceDate,
    postingDate: si.postingDate ?? si.invoiceDate,
    dueDate: si.dueDate ?? '',
    customerId: si.customerId,
    customerCode: si.customerCodeSnapshot ?? '',
    customerName: si.customerNameSnapshot,
    referenceNumber: si.referenceNumber,
    originalAmount: num(si.totalAmount),
    taxableAmount: num(si.taxableAmount),
    cgst: num(si.cgstAmount),
    sgst: num(si.sgstAmount),
    igst: num(si.igstAmount),
    appliedAmount: applied,
    creditNoteAmount: num(si.amountAdjusted),
    outstandingBalance: outstanding,
    overdueDays: Math.max(0, overdueDays),
    ageingBucket: bucketFromOverdueDays(overdueDays),
    invoiceStatus: deriveInvoiceStatus({
      isDisputed: oi?.isDisputed ?? false,
      outstanding,
      overdueDays,
      applied,
      dueDate: si.dueDate,
      docStatus: si.status,
    }),
    hasDispute: oi?.isDisputed ?? false,
    sourceSalesInvoiceId: si.id,
    ...EMPTY_INVOICE_DIMENSIONS,
    customerGstNumber: si.customerGstinSnapshot,
    placeOfSupply: si.placeOfSupply ?? '',
    paymentTerms: si.paymentTermsDays != null ? `${si.paymentTermsDays} days` : '',
  }
}

// ─── Receipts mapping ───────────────────────────────────────────────────────

const PAYMENT_MODE_MAP: Record<string, ReceiptPaymentMode> = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CARD: 'Other',
  OTHER: 'Other',
}

const RECEIPT_STATUS_MAP: Record<string, ReceiptVoucherStatus> = {
  DRAFT: 'Draft',
  READY_TO_POST: 'Approved',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

function deriveAllocationStatus(receiptAmount: number, allocated: number): AllocationStatus {
  if (allocated <= 0) return 'Unallocated'
  if (allocated + 0.01 >= receiptAmount) return 'Fully Allocated'
  return 'Partially Allocated'
}

export function mapReceiptToLegacy(r: CustomerReceiptListItemDto): CustomerReceipt {
  const gross = num(r.grossReceiptAmount)
  const allocated = num(r.allocatedAmount)
  return {
    id: r.id,
    receiptNumber: r.receiptNumber ?? r.draftReference ?? '—',
    receiptDate: r.receiptDate,
    postingDate: r.postingDate ?? r.receiptDate,
    customerId: r.customerId,
    customerCode: r.customerCodeSnapshot ?? '',
    customerName: r.customerNameSnapshot,
    customerBankReference: r.customerBankReference,
    paymentMode: PAYMENT_MODE_MAP[r.paymentMethod] ?? 'Other',
    bankOrCashAccountId: r.bankCashAccountId ?? '',
    bankOrCashAccountName: '',
    transactionReference: r.transactionReference,
    chequeNumber: r.chequeNumber,
    chequeDate: r.chequeDate,
    bankName: r.bankName,
    currency: r.currencyCode,
    exchangeRate: num(r.exchangeRate) || 1,
    receiptAmount: gross,
    tdsDeducted: num(r.customerTdsAmount),
    bankCharges: num(r.bankChargeAmount),
    netAmountReceived: num(r.bankCashAmount),
    allocatedAmount: allocated,
    unallocatedAmount: num(r.unallocatedAmount),
    allocationStatus: deriveAllocationStatus(num(r.allocatableAmount) || gross, allocated),
    voucherStatus: RECEIPT_STATUS_MAP[r.status] ?? 'Draft',
    narration: r.narration ?? '',
    internalRemarks: r.internalRemarks ?? '',
    createdBy: r.createdBy ?? '',
    postedBy: r.postedBy,
    postedAt: r.postedAt,
    relatedVoucherId: r.accountingVoucherId,
    relatedVoucherNumber: null,
    originalReceiptId: null,
    reversalReceiptId: r.reversalVoucherId ?? null,
    allocationLines: [],
    attachments: [],
  }
}

// ─── Credit note mapping ────────────────────────────────────────────────────

const CN_PURPOSE_MAP: Record<string, CreditNote['reason']> = {
  SALES_RETURN: 'Sales Return',
  PRICE_ADJUSTMENT: 'Price Difference',
  QUANTITY_ADJUSTMENT: 'Quantity Difference',
  QUALITY_CLAIM: 'Quality Claim',
  DISCOUNT: 'Discount',
  FREIGHT_ADJUSTMENT: 'Freight Adjustment',
  TAX_CORRECTION: 'Tax Correction',
  COMMERCIAL_SETTLEMENT: 'Commercial Settlement',
  OTHER: 'Other',
}

function mapCreditNoteStatus(cn: CustomerCreditNoteListItemDto): CreditNote['status'] {
  switch (cn.status) {
    case 'DRAFT':
      return 'Draft'
    case 'PENDING_APPROVAL':
    case 'READY_TO_POST':
      return 'Pending Approval'
    case 'POSTED': {
      const allocated = num(cn.allocatedAmount)
      const unallocated = num(cn.unallocatedAmount)
      if (allocated <= 0) return 'Posted'
      return unallocated > 0 ? 'Partially Applied' : 'Applied'
    }
    default:
      return 'Cancelled'
  }
}

export function mapCreditNoteToLegacy(cn: CustomerCreditNoteListItemDto): CreditNote {
  return {
    id: cn.id,
    creditNoteNumber: cn.creditNoteNumber ?? cn.draftReference ?? '—',
    creditNoteDate: cn.creditNoteDate,
    customerId: cn.customerId,
    customerName: cn.customerNameSnapshot,
    referenceInvoiceId: cn.originalInvoiceId,
    referenceInvoiceNumber: cn.originalInvoiceNumberSnapshot,
    reason: CN_PURPOSE_MAP[cn.purpose] ?? 'Other',
    originalAmount: num(cn.grandTotal),
    appliedAmount: num(cn.allocatedAmount),
    remainingAmount: num(cn.unallocatedAmount),
    gstAdjustment: num(cn.totalTaxAmount),
    status: mapCreditNoteStatus(cn),
    sourceDocument: cn.sourceType === 'SALES_INVOICE' ? cn.originalInvoiceNumberSnapshot : null,
    relatedVoucherId: cn.accountingVoucherId,
    applications: [],
  }
}

// ─── Outstanding summaries ──────────────────────────────────────────────────

function summariseCustomer(
  row: CustomerReceivableSummaryRow,
  openItems: OutstandingOpenItemDto[],
  receipts: CustomerReceiptListItemDto[],
): CustomerOutstandingSummary {
  const items = openItems.filter((i) => i.customerId === row.customerId)
  const total = num(row.baseOutstandingAmount) || items.reduce((s, i) => s + num(i.baseOutstandingAmount), 0)
  const overdue = items.filter((i) => (i.daysOverdue ?? 0) > 0).reduce((s, i) => s + num(i.baseOutstandingAmount), 0)
  const custReceipts = receipts.filter(
    (r) => r.customerId === row.customerId && r.status !== 'REVERSED' && r.status !== 'CANCELLED',
  )
  const unallocated = custReceipts.reduce((s, r) => s + num(r.unallocatedAmount), 0)
  const lastReceipt = custReceipts
    .filter((r) => r.status === 'POSTED')
    .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))[0]
  return {
    customerId: row.customerId,
    customerCode: row.customerCode ?? '',
    customerName: row.customerName ?? '',
    customerGroup: '',
    gstNumber: null,
    state: '',
    salesperson: '',
    territory: '',
    paymentTerms: '',
    creditLimit: 0,
    totalOutstanding: total,
    currentAmount: Math.max(0, total - overdue),
    overdueAmount: overdue,
    oldestDueDate: row.oldestDueDate,
    maximumOverdueDays: row.maxDaysOverdue ?? 0,
    unallocatedReceipt: unallocated,
    creditUtilization: 0,
    collectionOwner: '',
    creditStatus: 'No Credit Limit',
    averageCollectionDays: 0,
    lastReceiptDate: lastReceipt?.receiptDate ?? null,
    lastReceiptAmount: lastReceipt ? num(lastReceipt.grossReceiptAmount) : 0,
    openInvoiceCount: row.openItemCount,
    disputeAmount: 0,
    promisedPaymentDate: null,
    hasDispute: row.disputedCount > 0,
    hasPaymentPromise: false,
    collectionStatus: 'Not Contacted',
    gstRegistrationType: 'Regular',
  }
}

async function fetchAllOpenItems(params?: {
  reportDate?: string
  customerId?: string
  ageingBasis?: 'due_date' | 'invoice_age'
}): Promise<OutstandingOpenItemDto[]> {
  return drainPaged((page) =>
    listOutstanding({
      page,
      pageSize: PAGE_SIZE,
      reportDate: params?.reportDate,
      customerId: params?.customerId || undefined,
      ageingBasis: params?.ageingBasis,
    }),
  )
}

async function fetchAllCustomerSummaries(search?: string): Promise<CustomerReceivableSummaryRow[]> {
  return drainPaged((page) => listCustomerSummaries({ page, pageSize: PAGE_SIZE, search: search || undefined }))
}

async function fetchAllReceipts(customerId?: string, search?: string): Promise<CustomerReceiptListItemDto[]> {
  return drainList((page) =>
    listCustomerReceipts({ page, limit: PAGE_SIZE, customerId: customerId || undefined, search: search || undefined }),
  )
}

export async function getLiveCustomerOutstanding(
  filter: Partial<ReceivableFilter> = {},
): Promise<CustomerOutstandingSummary[]> {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const [customers, openItems, receipts] = await Promise.all([
    fetchAllCustomerSummaries(f.search),
    fetchAllOpenItems(),
    fetchAllReceipts(),
  ])
  let rows = customers.map((row) => summariseCustomer(row, openItems, receipts))
  if (f.customerId) rows = rows.filter((r) => r.customerId === f.customerId)
  if (f.overdueStatus === 'overdue') rows = rows.filter((r) => r.overdueAmount > 0)
  if (f.overdueStatus === 'current') rows = rows.filter((r) => r.overdueAmount <= 0)
  if (f.amountMin != null) rows = rows.filter((r) => r.totalOutstanding >= f.amountMin!)
  if (f.amountMax != null) rows = rows.filter((r) => r.totalOutstanding <= f.amountMax!)
  if (f.hasDispute === 'yes') rows = rows.filter((r) => r.hasDispute)
  if (f.hasDispute === 'no') rows = rows.filter((r) => !r.hasDispute)
  if (f.search) {
    const q = f.search.toLowerCase()
    rows = rows.filter((r) => `${r.customerCode} ${r.customerName}`.toLowerCase().includes(q))
  }
  return rows
}

// ─── Invoice register ───────────────────────────────────────────────────────

export async function getLiveReceivableInvoices(filter: Partial<ReceivableFilter> = {}): Promise<ReceivableInvoice[]> {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const [invoices, openItems] = await Promise.all([
    drainList((page) =>
      listSalesInvoices({
        page,
        limit: PAGE_SIZE,
        customerId: f.customerId || undefined,
        search: f.search || undefined,
      }),
    ),
    fetchAllOpenItems(),
  ])
  const openItemByInvoiceId = new Map<string, OutstandingOpenItemDto>()
  for (const oi of openItems) {
    if (oi.salesInvoiceId) openItemByInvoiceId.set(oi.salesInvoiceId, oi)
  }
  // Register shows real documents only — drafts stay in the Money In work queue.
  let rows = invoices
    .filter((si) => si.status === 'POSTED' || si.status === 'CANCELLED' || si.status === 'REVERSED')
    .map((si) => mapSalesInvoiceToLegacyInvoice(si, openItemByInvoiceId))

  if (f.customerId) rows = rows.filter((r) => r.customerId === f.customerId)
  if (f.ageingBucket) rows = rows.filter((r) => r.ageingBucket === f.ageingBucket)
  if (f.invoiceStatus) rows = rows.filter((r) => r.invoiceStatus === f.invoiceStatus)
  if (f.hasDispute === 'yes') rows = rows.filter((r) => r.hasDispute)
  if (f.hasDispute === 'no') rows = rows.filter((r) => !r.hasDispute)
  if (f.amountMin != null) rows = rows.filter((r) => r.originalAmount >= f.amountMin!)
  if (f.amountMax != null) rows = rows.filter((r) => r.originalAmount <= f.amountMax!)
  if (f.dueDateFrom) rows = rows.filter((r) => r.dueDate >= f.dueDateFrom)
  if (f.dueDateTo) rows = rows.filter((r) => r.dueDate <= f.dueDateTo)
  if (f.overdueStatus === 'overdue') rows = rows.filter((r) => r.overdueDays > 0)
  if (f.overdueStatus === 'current') rows = rows.filter((r) => r.overdueDays <= 0)
  if (f.overdueStatus === 'due_soon') {
    rows = rows.filter((r) => {
      if (!r.dueDate || r.outstandingBalance <= 0) return false
      const rem = daysBetween(today(), r.dueDate)
      return rem >= 0 && rem <= 7
    })
  }
  if (f.search) {
    const q = f.search.toLowerCase()
    rows = rows.filter((r) => `${r.invoiceNumber} ${r.customerName} ${r.customerCode}`.toLowerCase().includes(q))
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
    if (map[tab]) rows = rows.filter(map[tab])
  }
  return rows.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
}

// ─── Receipts register ──────────────────────────────────────────────────────

export async function getLiveCustomerReceipts(filter: Partial<ReceivableFilter> = {}): Promise<CustomerReceipt[]> {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const receipts = await fetchAllReceipts(f.customerId, f.search)
  let rows = receipts.map(mapReceiptToLegacy)
  if (f.paymentMode) rows = rows.filter((r) => r.paymentMode === f.paymentMode)
  if (f.allocationStatus) rows = rows.filter((r) => r.allocationStatus === f.allocationStatus)
  if (f.voucherStatus) rows = rows.filter((r) => r.voucherStatus === f.voucherStatus)
  if (f.amountMin != null) rows = rows.filter((r) => r.receiptAmount >= f.amountMin!)
  if (f.amountMax != null) rows = rows.filter((r) => r.receiptAmount <= f.amountMax!)
  const tab = f.receiptTab
  if (tab && tab !== 'all' && tab !== 'all_receipts') {
    const map: Record<string, (x: CustomerReceipt) => boolean> = {
      draft: (x) => x.voucherStatus === 'Draft',
      // Live lifecycle has no approval queue — READY_TO_POST maps to 'Approved'.
      pending_approval: (x) => x.voucherStatus === 'Pending Approval' || x.voucherStatus === 'Approved',
      posted: (x) => x.voucherStatus === 'Posted',
      unallocated: (x) => x.allocationStatus === 'Unallocated',
      partially_allocated: (x) => x.allocationStatus === 'Partially Allocated',
      fully_allocated: (x) => x.allocationStatus === 'Fully Allocated',
      reversed: (x) => x.voucherStatus === 'Reversed',
    }
    if (map[tab]) rows = rows.filter(map[tab])
  }
  return rows.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))
}

// ─── Credit notes register ──────────────────────────────────────────────────

export async function getLiveCreditNotes(filter: Partial<ReceivableFilter> = {}): Promise<CreditNote[]> {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const notes = await drainList((page) =>
    listCustomerCreditNotes({
      page,
      limit: PAGE_SIZE,
      customerId: f.customerId || undefined,
      search: f.search || undefined,
    }),
  )
  let rows = notes.map(mapCreditNoteToLegacy)
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
    if (map[tab]) rows = rows.filter((cn) => cn.status === map[tab])
  }
  return rows
}

// ─── Ageing ─────────────────────────────────────────────────────────────────

function basisDateForInvoice(inv: ReceivableInvoice, basis: AgeingBasis): string {
  if (basis === 'Posting Date') return inv.postingDate || inv.invoiceDate || inv.dueDate
  if (basis === 'Invoice Date') return inv.invoiceDate || inv.postingDate || inv.dueDate
  return inv.dueDate || inv.invoiceDate || inv.postingDate
}

function ageInvoiceForBasis(inv: ReceivableInvoice, asOf: string, basis: AgeingBasis): ReceivableInvoice {
  const basisDate = basisDateForInvoice(inv, basis)
  if (!basisDate) {
    return { ...inv, overdueDays: 0, ageingBucket: 'Not Due' }
  }
  const ageDays = daysBetween(basisDate, asOf)
  if (basis === 'Due Date') {
    return {
      ...inv,
      overdueDays: Math.max(0, ageDays),
      ageingBucket: bucketFromOverdueDays(ageDays),
    }
  }
  // Posting / Invoice Date: age from document date (no "Not Due" — day 0–30 → 1–30).
  const age = Math.max(0, ageDays)
  let ageingBucket: ReceivableAgeingBucket
  if (age <= 30) ageingBucket = '1–30 Days'
  else if (age <= 60) ageingBucket = '31–60 Days'
  else if (age <= 90) ageingBucket = '61–90 Days'
  else if (age <= 180) ageingBucket = '91–180 Days'
  else ageingBucket = 'Above 180 Days'
  return { ...inv, overdueDays: age, ageingBucket }
}

/** Map UI ageing basis → backend reporting basis (Posting Date ≈ invoice_age). */
function toBackendAgeingBasis(basis: AgeingBasis): 'due_date' | 'invoice_age' {
  return basis === 'Due Date' ? 'due_date' : 'invoice_age'
}

export async function getLiveReceivableAgeing(filter: Partial<ReceivableFilter> = {}): Promise<ReceivableAgeingResult> {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const asOf = f.asOfDate || today()
  const basis = f.ageingBasis || 'Due Date'
  const backendBasis = toBackendAgeingBasis(basis)

  const [openItems, ageingReport] = await Promise.all([
    fetchAllOpenItems({
      reportDate: asOf,
      customerId: f.customerId || undefined,
      ageingBasis: backendBasis,
    }),
    getAgeingReport({
      reportDate: asOf,
      ageingBasis: backendBasis,
      customerId: f.customerId || undefined,
    }).catch(() => null),
  ])

  // Recompute legacy 91–180 / 180+ buckets from the selected basis date so the
  // approved FE matrix stays intact (BE uses 91–120 / Above 120).
  let open = openItems
    .map(mapOpenItemToLegacyInvoice)
    .filter((i) => i.outstandingBalance > 0)
    .map((i) => ageInvoiceForBasis(i, asOf, basis))

  if (f.customerId) open = open.filter((i) => i.customerId === f.customerId)

  const byCustomer = new Map<string, ReceivableInvoice[]>()
  for (const inv of open) {
    const list = byCustomer.get(inv.customerId) ?? []
    list.push(inv)
    byCustomer.set(inv.customerId, list)
  }
  const customerWise: ReceivableAgeingResult['customerWise'] = [...byCustomer.entries()]
    .map(([customerId, invs]) => {
      const bucketAmt = (b: ReceivableAgeingBucket) =>
        invs.filter((i) => i.ageingBucket === b).reduce((s, i) => s + i.outstandingBalance, 0)
      return {
        customerId,
        customerName: invs[0]?.customerName ?? '',
        creditLimit: 0,
        notDue: bucketAmt('Not Due'),
        d1to30: bucketAmt('1–30 Days'),
        d31to60: bucketAmt('31–60 Days'),
        d61to90: bucketAmt('61–90 Days'),
        d91to180: bucketAmt('91–180 Days'),
        above180: bucketAmt('Above 180 Days'),
        totalOutstanding: invs.reduce((s, i) => s + i.outstandingBalance, 0),
      }
    })
    .filter((r) => r.totalOutstanding > 0)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)

  const sumBucket = (b: ReceivableAgeingBucket) =>
    open.filter((i) => i.ageingBucket === b).reduce((s, i) => s + i.outstandingBalance, 0)

  const limitations = [
    ...(ageingReport?.limitations ?? []),
    ...(asOf < today() && !(ageingReport?.limitations ?? []).includes('AGEING_USES_CURRENT_BALANCES')
      ? ['AGEING_USES_CURRENT_BALANCES']
      : []),
    ...(basis === 'Invoice Date'
      ? ['INVOICE_DATE_AGED_CLIENT_SIDE']
      : []),
  ]

  return {
    asOfDate: asOf,
    ageingBasis: basis,
    limitations: limitations.length ? [...new Set(limitations)] : undefined,
    summary: {
      totalOutstanding: open.reduce((s, i) => s + i.outstandingBalance, 0),
      notDue: sumBucket('Not Due'),
      d1to30: sumBucket('1–30 Days'),
      d31to60: sumBucket('31–60 Days'),
      d61to90: sumBucket('61–90 Days'),
      above90: sumBucket('91–180 Days') + sumBucket('Above 180 Days'),
    },
    customerWise,
    invoiceWise: open.sort((a, b) => b.overdueDays - a.overdueDays || a.dueDate.localeCompare(b.dueDate)),
  }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getLiveReceivablesDashboard(): Promise<ReceivablesDashboardData> {
  const [overview, customers, openItems, receiptDtos, invoices] = await Promise.all([
    getReceivableOverview(),
    fetchAllCustomerSummaries(),
    fetchAllOpenItems(),
    fetchAllReceipts(),
    drainList((page) => listSalesInvoices({ page, limit: PAGE_SIZE })),
  ])

  const receipts = receiptDtos.map(mapReceiptToLegacy)
  const openInvs = openItems.map(mapOpenItemToLegacyInvoice).filter((i) => i.outstandingBalance > 0)
  const outstanding = customers.map((row) => summariseCustomer(row, openItems, receiptDtos))

  const todayStr = today()
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const monthPrefix = todayStr.slice(0, 7)

  const totalReceivables = num(overview.totals.baseOutstandingAmount)
  const overdueAmount = openInvs.filter((i) => i.overdueDays > 0).reduce((s, i) => s + i.outstandingBalance, 0)
  const dueThisWeek = openInvs
    .filter((i) => i.dueDate && i.dueDate >= todayStr && i.dueDate <= weekEndStr)
    .reduce((s, i) => s + i.outstandingBalance, 0)
  const receiptsThisMonth = receipts
    .filter((r) => r.receiptDate.startsWith(monthPrefix) && r.voucherStatus !== 'Reversed' && r.voucherStatus !== 'Cancelled')
    .reduce((s, r) => s + r.receiptAmount, 0)
  const unallocatedReceipts = receipts
    .filter((r) => r.unallocatedAmount > 0 && r.voucherStatus === 'Posted')
    .reduce((s, r) => s + r.unallocatedAmount, 0)

  const ageing = RECEIVABLE_AGEING_BUCKETS.map((bucket) => {
    const match = openInvs.filter((i) => i.ageingBucket === bucket)
    return { bucket, amount: match.reduce((s, i) => s + i.outstandingBalance, 0), count: match.length }
  })

  const criticalAlerts: ReceivablesDashboardData['criticalAlerts'] = []
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
        href: `/accounting/receivables/invoices/${i.id}`,
      }),
    )
  openInvs
    .filter((i) => i.hasDispute)
    .slice(0, 3)
    .forEach((i) =>
      criticalAlerts.push({
        id: `alert-dispute-${i.id}`,
        type: 'dispute',
        severity: 'warning',
        title: `Disputed invoice ${i.invoiceNumber}`,
        description: i.customerName,
        href: `/accounting/receivables/invoices/${i.id}`,
      }),
    )
  receipts
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

  const months: ReceivablesDashboardData['billingCollectionTrend'] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const prefix = d.toISOString().slice(0, 7)
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    months.push({
      month: label,
      billed: invoices
        .filter((inv) => inv.status === 'POSTED' && inv.invoiceDate.startsWith(prefix))
        .reduce((s, inv) => s + num(inv.totalAmount), 0),
      collected: receipts
        .filter((r) => r.receiptDate.startsWith(prefix) && r.voucherStatus === 'Posted')
        .reduce((s, r) => s + r.receiptAmount, 0),
    })
  }

  return {
    kpis: {
      totalReceivables,
      currentOutstanding: Math.max(0, totalReceivables - overdueAmount),
      overdueAmount,
      dueThisWeek,
      receiptsThisMonth,
      unallocatedReceipts,
      // No credit-limit / collection engine on live AR yet (W6).
      customersOverCreditLimit: 0,
      averageCollectionDays: 0,
    },
    ageing,
    outstandingByCustomer: outstanding
      .filter((r) => r.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 8),
    upcomingDueInvoices: openInvs
      .filter((i) => i.dueDate && i.dueDate >= todayStr && i.dueDate <= weekEndStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8),
    criticalAlerts,
    billingCollectionTrend: months,
    topOverdueCustomers: outstanding
      .filter((r) => r.overdueAmount > 0)
      .sort((a, b) => b.overdueAmount - a.overdueAmount)
      .slice(0, 6),
    recentReceipts: [...receipts].sort((a, b) => b.receiptDate.localeCompare(a.receiptDate)).slice(0, 6),
    collectionTeamActivity: [],
  }
}

// ─── Customer AR 360 ────────────────────────────────────────────────────────

export async function getLiveCustomerReceivableCard(customerId: string): Promise<CustomerReceivableCard> {
  const [summary, openItems, receiptDtos, creditNoteDtos] = await Promise.all([
    getCustomerSummary(customerId),
    drainPaged((page) => listCustomerOpenItems(customerId, { page, pageSize: PAGE_SIZE })),
    fetchAllReceipts(customerId),
    drainList((page) => listCustomerCreditNotes({ page, limit: PAGE_SIZE, customerId })),
  ])
  const openInvoices = openItems.map(mapOpenItemToLegacyInvoice)
  const openBal = openInvoices.filter((i) => i.outstandingBalance > 0)
  const receipts = receiptDtos.map(mapReceiptToLegacy)
  const totalOutstanding = num(summary.baseOutstandingAmount)
  const overdue = openBal.filter((i) => i.overdueDays > 0).reduce((s, i) => s + i.outstandingBalance, 0)
  const lastReceipt =
    [...receipts].filter((r) => r.voucherStatus === 'Posted').sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))[0] ?? null
  const ageing = Object.fromEntries(
    RECEIVABLE_AGEING_BUCKETS.map((b) => [
      b,
      openBal.filter((i) => i.ageingBucket === b).reduce((s, i) => s + i.outstandingBalance, 0),
    ]),
  ) as Record<ReceivableAgeingBucket, number>

  const customer: ReceivableCustomer = {
    id: summary.customerId,
    customerCode: summary.customerCode ?? '',
    customerName: summary.customerName ?? '',
    customerGroup: '',
    gstNumber: null,
    gstRegistrationType: 'Regular',
    state: '',
    territory: '',
    salesperson: '',
    collectionOwner: '',
    paymentTerms: '',
    creditLimit: 0,
    creditStatus: 'No Credit Limit',
    contactPerson: '',
    email: '',
    mobile: '',
    billingAddress: '',
    shippingAddress: '',
    averageCollectionDays: 0,
    isStrategic: false,
    masterCustomerId: summary.customerId,
  }

  const alerts: string[] = []
  if (overdue > 0) alerts.push('Overdue balance outstanding')
  if (summary.disputedCount > 0) alerts.push('Open dispute flag(s) on invoices')
  if (summary.onHoldCount > 0) alerts.push('On-hold open item(s)')

  return {
    customer,
    creditLimit: 0,
    totalOutstanding,
    overdue,
    availableCredit: 0,
    averageCollectionDays: 0,
    lastReceipt,
    openInvoiceCount: openBal.length,
    disputeAmount: 0,
    creditUtilization: 0,
    ageing,
    openInvoices,
    receipts,
    creditNotes: creditNoteDtos.map(mapCreditNoteToLegacy),
    disputes: await getLiveCustomerDisputes({ customerId }),
    activities: [],
    promises: [],
    alerts,
    audit: [],
  }
}

export async function getLiveReceivableCustomerById(customerId: string): Promise<ReceivableCustomer> {
  const summary = await getCustomerSummary(customerId)
  return {
    id: summary.customerId,
    customerCode: summary.customerCode ?? '',
    customerName: summary.customerName ?? '',
    customerGroup: '',
    gstNumber: null,
    gstRegistrationType: 'Regular',
    state: '',
    territory: '',
    salesperson: '',
    collectionOwner: '',
    paymentTerms: '',
    creditLimit: 0,
    creditStatus: 'No Credit Limit',
    contactPerson: '',
    email: '',
    mobile: '',
    billingAddress: '',
    shippingAddress: '',
    averageCollectionDays: 0,
    isStrategic: false,
    masterCustomerId: summary.customerId,
  }
}

// ─── Lookups ────────────────────────────────────────────────────────────────

export async function getLiveReceivableLookups(): Promise<ReceivableLookups> {
  const customers = await fetchAllCustomerSummaries()
  return {
    customers: customers.map((c) => ({
      id: c.customerId,
      code: c.customerCode ?? '',
      name: c.customerName ?? '',
    })),
    customerGroups: [],
    salespersons: [],
    territories: [],
    states: [],
    locations: [],
    collectionOwners: [],
    bankAccounts: [],
  }
}

// ─── Receipt allocations (live batch engine) ────────────────────────────────

export async function getLiveOpenInvoicesForAllocation(customerId: string): Promise<ReceivableInvoice[]> {
  const openItems = await drainPaged((page) => listCustomerOpenItems(customerId, { page, pageSize: PAGE_SIZE }))
  return openItems
    .map(mapOpenItemToLegacyInvoice)
    .filter((i) => i.outstandingBalance > 0 && i.invoiceStatus !== 'Cancelled' && i.invoiceStatus !== 'Paid')
}

/**
 * Allocates a posted receipt against invoices via the live allocation batch API.
 * Legacy callers pass invoice ids; the live engine needs open-item ids, so they
 * are resolved from the customer's open items before posting the batch.
 */
export async function allocateLiveReceipt(
  receiptId: string,
  lines: { invoiceId: string; allocationAmount: number }[],
): Promise<CustomerReceipt> {
  const receipt = await getCustomerReceipt(receiptId)
  const openItems = await drainPaged((page) =>
    listCustomerOpenItems(receipt.customerId, { page, pageSize: PAGE_SIZE }),
  )
  const openItemByInvoiceId = new Map(
    openItems.filter((oi) => oi.salesInvoiceId).map((oi) => [oi.salesInvoiceId as string, oi.openItemId]),
  )
  const allocations = lines
    .filter((l) => l.allocationAmount > 0)
    .map((l) => {
      const invoiceOpenItemId = openItemByInvoiceId.get(l.invoiceId)
      if (!invoiceOpenItemId) {
        throw new Error(`Invoice has no open receivable item to allocate against (${l.invoiceId}).`)
      }
      return { invoiceId: l.invoiceId, invoiceOpenItemId, amount: l.allocationAmount.toFixed(2) }
    })
  if (allocations.length === 0) throw new Error('No allocation lines with a positive amount.')
  await allocateReceipt(receiptId, { allocationDate: today(), allocations }, crypto.randomUUID())
  return getLiveCustomerReceiptById(receiptId)
}

/** Read-only allocation lines for a receipt, from posted allocation history. */
export async function getLiveReceiptAllocationLines(receiptId: string) {
  const history = await listReceiptAllocations(receiptId)
  return history
    .filter((h) => h.status !== 'REVERSED')
    .map((h) => ({
      id: h.allocationId,
      invoiceId: h.invoiceId ?? '',
      invoiceNumber: h.invoiceNumber ?? '—',
      invoiceDate: '',
      dueDate: '',
      originalAmount: num(h.invoiceOutstandingBefore),
      previousAllocation: 0,
      outstandingBalance: num(h.invoiceOutstandingAfter),
      overdueDays: 0,
      discountEligible: false,
      tdsAmount: 0,
      allocationAmount: num(h.allocatedAmount),
      remainingBalance: num(h.invoiceOutstandingAfter),
      status: h.status,
    }))
}

// ─── Customer statement ─────────────────────────────────────────────────────

export async function getLiveCustomerStatementPreview(opts: {
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
  const [summary, invoiceDtos, receiptDtos, creditNoteDtos, openItems] = await Promise.all([
    getCustomerSummary(opts.customerId),
    drainList((page) => listSalesInvoices({ page, limit: PAGE_SIZE, customerId: opts.customerId })),
    fetchAllReceipts(opts.customerId),
    drainList((page) => listCustomerCreditNotes({ page, limit: PAGE_SIZE, customerId: opts.customerId })),
    drainPaged((page) => listCustomerOpenItems(opts.customerId, { page, pageSize: PAGE_SIZE })),
  ])

  const postedInvoices = invoiceDtos.filter((i) => i.status === 'POSTED')
  const postedReceipts = receiptDtos.filter((r) => r.status === 'POSTED')
  const postedCreditNotes = creditNoteDtos.filter((cn) => cn.status === 'POSTED')

  const openingBalance =
    postedInvoices.filter((i) => i.invoiceDate < opts.dateFrom).reduce((s, i) => s + num(i.baseTotalAmount), 0) -
    postedReceipts.filter((r) => r.receiptDate < opts.dateFrom).reduce((s, r) => s + num(r.baseAllocatableAmount) || num(r.baseGrossReceiptAmount), 0) -
    postedCreditNotes.filter((cn) => cn.creditNoteDate < opts.dateFrom).reduce((s, cn) => s + num(cn.baseGrandTotal), 0)

  type Txn = { date: string; documentNumber: string; documentType: string; reference: string; debit: number; credit: number }
  const txns: Txn[] = []
  for (const inv of postedInvoices.filter((i) => i.invoiceDate >= opts.dateFrom && i.invoiceDate <= opts.dateTo)) {
    if (opts.includeOpenEntriesOnly && num(inv.outstandingAmount) <= 0 && !opts.includeSettledEntries) continue
    txns.push({
      date: inv.invoiceDate,
      documentNumber: inv.invoiceNumber ?? '—',
      documentType: 'Invoice',
      reference: inv.referenceNumber ?? '',
      debit: num(inv.baseTotalAmount),
      credit: 0,
    })
  }
  if (opts.includeReceipts !== false) {
    for (const r of postedReceipts.filter((x) => x.receiptDate >= opts.dateFrom && x.receiptDate <= opts.dateTo)) {
      txns.push({
        date: r.receiptDate,
        documentNumber: r.receiptNumber ?? '—',
        documentType: 'Receipt',
        reference: r.transactionReference ?? '',
        debit: 0,
        credit: num(r.baseAllocatableAmount) || num(r.baseGrossReceiptAmount),
      })
    }
  }
  if (opts.includeCreditNotes !== false) {
    for (const cn of postedCreditNotes.filter((x) => x.creditNoteDate >= opts.dateFrom && x.creditNoteDate <= opts.dateTo)) {
      txns.push({
        date: cn.creditNoteDate,
        documentNumber: cn.creditNoteNumber ?? '—',
        documentType: 'Credit Note',
        reference: cn.originalInvoiceNumberSnapshot ?? '',
        debit: 0,
        credit: num(cn.baseGrandTotal),
      })
    }
  }
  txns.sort((a, b) => a.date.localeCompare(b.date))

  let running = openingBalance
  const lines: CustomerStatement['lines'] = txns.map((t) => {
    running += t.debit - t.credit
    return { ...t, runningBalance: running }
  })

  const openInvoices = openItems.map(mapOpenItemToLegacyInvoice).filter((i) => i.outstandingBalance > 0)
  const ageingSummary = opts.includeAgeingSummary
    ? (Object.fromEntries(
        RECEIVABLE_AGEING_BUCKETS.map((b) => [
          b,
          openInvoices.filter((i) => i.ageingBucket === b).reduce((s, i) => s + i.outstandingBalance, 0),
        ]),
      ) as Record<ReceivableAgeingBucket, number>)
    : null

  return {
    companyName: 'Vasant Trailers Pvt Ltd',
    customerId: summary.customerId,
    customerName: summary.customerName ?? '',
    customerAddress: '',
    gstNumber: null,
    statementPeriodFrom: opts.dateFrom,
    statementPeriodTo: opts.dateTo,
    statementType: opts.statementType,
    openingBalance,
    closingBalance: running,
    lines,
    ageingSummary,
    contactDetails: null,
  }
}

// ─── Receipt lifecycle (live) ───────────────────────────────────────────────

export async function getLiveCustomerReceiptById(receiptId: string): Promise<CustomerReceipt> {
  const receipt = await getCustomerReceipt(receiptId)
  const mapped = mapReceiptToLegacy(receipt)
  if (receipt.status === 'POSTED') {
    // Posted receipts carry their allocation history so legacy consumers of
    // `allocationLines` (detail grid, posting preview) see live settlements.
    mapped.allocationLines = await getLiveReceiptAllocationLines(receiptId).catch(() => [])
  }
  return mapped
}

export async function postLiveReceipt(receiptId: string): Promise<CustomerReceipt> {
  const result = await postCustomerReceipt(receiptId)
  return mapReceiptToLegacy(result.receipt)
}

export async function reverseLiveReceipt(receiptId: string, reason: string): Promise<CustomerReceipt> {
  const result = await reverseCustomerReceipt(receiptId, reason, crypto.randomUUID())
  return mapReceiptToLegacy(result.receipt)
}

export async function markLiveReceiptReady(receiptId: string): Promise<CustomerReceipt> {
  const receipt = await markCustomerReceiptReady(receiptId)
  return mapReceiptToLegacy(receipt)
}

export async function getLiveReceiptPostingPreview(receiptId: string): Promise<{
  receiptNumber: string
  customerName: string
  receiptAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  bankOrCashAccountName: string
  customerControlAccount: string
  tdsAmount: number
  bankCharges: number
  postingDate: string
  warnings: string[]
}> {
  const [receipt, validation] = await Promise.all([
    getCustomerReceipt(receiptId),
    validateCustomerReceipt(receiptId).catch(() => null),
  ])
  return {
    receiptNumber: receipt.receiptNumber ?? receipt.draftReference ?? '—',
    customerName: receipt.customerNameSnapshot,
    receiptAmount: num(receipt.grossReceiptAmount),
    allocatedAmount: num(receipt.allocatedAmount),
    unallocatedAmount: num(receipt.unallocatedAmount),
    bankOrCashAccountName: receipt.bankCashAccountId ?? '',
    customerControlAccount: receipt.customerReceivableAccountId ?? '',
    tdsAmount: num(receipt.customerTdsAmount),
    bankCharges: num(receipt.bankChargeAmount),
    postingDate: receipt.postingDate ?? receipt.receiptDate,
    warnings: [
      ...(validation?.warnings.map((w) => w.message) ?? []),
      ...(validation && !validation.valid ? validation.errors.map((e) => e.message) : []),
    ],
  }
}

// --- AR disputes (Wave 5) ---------------------------------------------------

const DISPUTE_STATUS_TO_LEGACY: Record<ArDisputeStatus, DisputeStatus> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under Review',
  AWAITING_CUSTOMER: 'Awaiting Customer',
  AWAITING_INTERNAL_TEAM: 'Awaiting Internal Team',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
}

const DISPUTE_STATUS_FROM_LEGACY: Record<DisputeStatus, ArDisputeStatus> = {
  Open: 'OPEN',
  'Under Review': 'UNDER_REVIEW',
  'Awaiting Customer': 'AWAITING_CUSTOMER',
  'Awaiting Internal Team': 'AWAITING_INTERNAL_TEAM',
  Resolved: 'RESOLVED',
  Rejected: 'REJECTED',
  Closed: 'CLOSED',
}

const DISPUTE_TYPE_TO_LEGACY: Record<ArDisputeType, DisputeType> = {
  PRICE_DIFFERENCE: 'Price Difference',
  QUANTITY_DIFFERENCE: 'Quantity Difference',
  QUALITY_ISSUE: 'Quality Issue',
  DELIVERY_DELAY: 'Delivery Delay',
  SHORT_SUPPLY: 'Short Supply',
  TAX_ISSUE: 'Tax Issue',
  MISSING_DOCUMENT: 'Missing Document',
  DUPLICATE_INVOICE: 'Duplicate Invoice',
  COMMERCIAL_TERMS: 'Commercial Terms',
  OTHER: 'Other',
}

const DISPUTE_TYPE_FROM_LEGACY: Record<DisputeType, ArDisputeType> = {
  'Price Difference': 'PRICE_DIFFERENCE',
  'Quantity Difference': 'QUANTITY_DIFFERENCE',
  'Quality Issue': 'QUALITY_ISSUE',
  'Delivery Delay': 'DELIVERY_DELAY',
  'Short Supply': 'SHORT_SUPPLY',
  'Tax Issue': 'TAX_ISSUE',
  'Missing Document': 'MISSING_DOCUMENT',
  'Duplicate Invoice': 'DUPLICATE_INVOICE',
  'Commercial Terms': 'COMMERCIAL_TERMS',
  Other: 'OTHER',
}

const DISPUTE_PRIORITY_TO_LEGACY: Record<ArDisputePriority, CustomerDispute['priority']> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

const DISPUTE_PRIORITY_FROM_LEGACY: Record<CustomerDispute['priority'], ArDisputePriority> = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Critical: 'CRITICAL',
}

export function mapArDisputeToLegacy(d: ArDisputeDto): CustomerDispute {
  return {
    id: d.id,
    disputeNumber: d.disputeNumber,
    customerId: d.customerId,
    customerName: d.customerNameSnapshot,
    invoiceId: d.salesInvoiceId,
    invoiceNumber: d.invoiceNumberSnapshot,
    salesOrders: d.sourceContext.salesOrders,
    dispatches: d.sourceContext.dispatches,
    disputeDate: d.disputeDate,
    disputeType: DISPUTE_TYPE_TO_LEGACY[d.disputeType] ?? 'Other',
    disputedAmount: num(d.disputedAmount),
    description: d.description,
    owner: d.ownerName,
    responsibleDepartment: d.responsibleDepartment,
    priority: DISPUTE_PRIORITY_TO_LEGACY[d.priority] ?? 'Medium',
    targetResolutionDate: d.targetResolutionDate ?? '',
    status: DISPUTE_STATUS_TO_LEGACY[d.status] ?? 'Open',
    resolution: d.resolution,
    creditNoteRequired: d.creditNoteRequired,
    collectionHold: d.collectionHold,
    supportingDocuments: d.supportingDocuments ?? [],
    createdAt: d.createdAt,
  }
}

export async function getLiveCustomerDisputes(filter: Partial<ReceivableFilter> = {}): Promise<CustomerDispute[]> {
  const f = { ...DEFAULT_RECEIVABLE_FILTER, ...filter }
  const statusMap: Record<string, ArDisputeStatus> = {
    open: 'OPEN',
    under_review: 'UNDER_REVIEW',
    awaiting_customer: 'AWAITING_CUSTOMER',
    awaiting_internal_team: 'AWAITING_INTERNAL_TEAM',
    resolved: 'RESOLVED',
    rejected: 'REJECTED',
    closed: 'CLOSED',
  }
  const rows = await drainList((page) =>
    listArDisputes({
      page,
      limit: PAGE_SIZE,
      search: f.search || undefined,
      customerId: f.customerId || undefined,
      status: f.disputeTab && f.disputeTab !== 'all' ? statusMap[f.disputeTab] : undefined,
    }),
  )
  return rows.map(mapArDisputeToLegacy)
}

export async function createLiveDispute(
  input: Omit<CustomerDispute, 'id' | 'disputeNumber' | 'createdAt' | 'customerName' | 'supportingDocuments'> & {
    supportingDocuments?: string[]
  },
): Promise<CustomerDispute> {
  const created = await createArDispute({
    legalEntityId: await ensureLegalEntityId(),
    salesInvoiceId: input.invoiceId,
    disputeDate: input.disputeDate,
    disputeType: DISPUTE_TYPE_FROM_LEGACY[input.disputeType] ?? 'OTHER',
    disputedAmount: String(input.disputedAmount),
    description: input.description,
    ownerName: input.owner,
    responsibleDepartment: input.responsibleDepartment,
    priority: DISPUTE_PRIORITY_FROM_LEGACY[input.priority] ?? 'MEDIUM',
    targetResolutionDate: input.targetResolutionDate || null,
    creditNoteRequired: input.creditNoteRequired,
    collectionHold: input.collectionHold,
    supportingDocuments: input.supportingDocuments ?? [],
  })
  if (input.status && input.status !== 'Open') {
    return mapArDisputeToLegacy(
      await transitionArDispute(created.id, {
        status: DISPUTE_STATUS_FROM_LEGACY[input.status],
        resolution: input.resolution,
      }),
    )
  }
  return mapArDisputeToLegacy(created)
}

export async function updateLiveDispute(id: string, patch: Partial<CustomerDispute>): Promise<CustomerDispute> {
  const updated = await updateArDispute(id, {
    disputeDate: patch.disputeDate,
    disputeType: patch.disputeType ? DISPUTE_TYPE_FROM_LEGACY[patch.disputeType] : undefined,
    disputedAmount: patch.disputedAmount != null ? String(patch.disputedAmount) : undefined,
    description: patch.description,
    ownerName: patch.owner,
    responsibleDepartment: patch.responsibleDepartment,
    priority: patch.priority ? DISPUTE_PRIORITY_FROM_LEGACY[patch.priority] : undefined,
    targetResolutionDate: patch.targetResolutionDate === undefined ? undefined : patch.targetResolutionDate || null,
    creditNoteRequired: patch.creditNoteRequired,
    collectionHold: patch.collectionHold,
  })
  if (patch.status && DISPUTE_STATUS_FROM_LEGACY[patch.status] !== updated.status) {
    return mapArDisputeToLegacy(
      await transitionArDispute(id, {
        status: DISPUTE_STATUS_FROM_LEGACY[patch.status],
        resolution: patch.resolution,
      }),
    )
  }
  if (patch.resolution !== undefined && patch.status === undefined) {
    return mapArDisputeToLegacy(
      await transitionArDispute(id, { status: updated.status, resolution: patch.resolution }),
    )
  }
  return mapArDisputeToLegacy(updated)
}
