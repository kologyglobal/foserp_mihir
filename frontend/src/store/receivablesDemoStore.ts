import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AgeingReportDto,
  CreateCustomerCreditNoteInput,
  CreateSalesInvoiceInput,
  CreditNoteAllocationHistoryRow,
  CreditNoteAllocationPreview,
  CreditNoteAllocationRequest,
  CreditNoteAllocationResult,
  CreditNoteValidationPreview,
  CustomerCreditNoteAllowedActions,
  CustomerCreditNoteDto,
  CustomerCreditNoteLineDto,
  CustomerCreditNoteListItemDto,
  CustomerCreditNoteStatus,
  CustomerReceivableDetailDto,
  ListCustomerCreditNotesQuery,
  ListSalesInvoicesQuery,
  OutstandingOpenItemDto,
  PaginatedResult,
  PostCreditNoteResult,
  PostSalesInvoiceResult,
  ReceivableOverviewDto,
  ReceivableReconciliationDto,
  SalesInvoiceAllowedActions,
  SalesInvoiceDto,
  SalesInvoiceLineDto,
  SalesInvoiceStatus,
  SalesInvoiceValidationPreview,
  UpdateCustomerCreditNoteInput,
  UpdateSalesInvoiceInput,
} from '../types/moneyIn'
import { DEMO_BRANCH_ID, DEMO_FY_ID, DEMO_LEGAL_ENTITY_ID } from './financeSetupStore'
import { formatDecimal, previewInterLineTotal, previewLineTotal } from '../modules/accounting/money-in/moneyInUi'

function id() {
  return crypto.randomUUID()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export const DEMO_CUSTOMER_IDS = {
  mahindra: 'b2000001-0001-4001-8001-000000000001',
  tata: 'b2000002-0002-4002-8002-000000000002',
  ashok: 'b2000003-0003-4003-8003-000000000003',
} as const

const CUSTOMERS = [
  { id: DEMO_CUSTOMER_IDS.mahindra, code: 'CUST-MHL', name: 'Mahindra Logistics Ltd', gstin: '27AABCM1234F1Z5', state: '27' },
  { id: DEMO_CUSTOMER_IDS.tata, code: 'CUST-TML', name: 'Tata Motors — Pune Plant', gstin: '27AAACT2727Q1Z6', state: '27' },
  { id: DEMO_CUSTOMER_IDS.ashok, code: 'CUST-AL', name: 'Ashok Leyland — Chennai', gstin: '33AAAAA0000A1Z5', state: '33' },
]

const RECEIVABLE_ACCOUNT_ID = 'acc-receivable'

interface OpenItemRecord extends OutstandingOpenItemDto {
  legalEntityId: string
}

interface CreditNoteAllocationDemoRow extends CreditNoteAllocationHistoryRow {
  creditNoteId: string
}

interface ReceivablesDemoState {
  invoices: SalesInvoiceDto[]
  openItems: OpenItemRecord[]
  postedEvents: Record<string, { voucherNumber: string; voucherId: string; openItemId: string }>
  invoiceSeq: number
  voucherSeq: number
  seeded: boolean
  seedIfEmpty: (legalEntityId: string) => void
  listInvoices: (q: ListSalesInvoicesQuery) => SalesInvoiceDto[]
  getInvoice: (id: string) => SalesInvoiceDto | undefined
  createInvoice: (input: CreateSalesInvoiceInput) => SalesInvoiceDto
  updateInvoice: (id: string, input: UpdateSalesInvoiceInput) => SalesInvoiceDto
  validateInvoice: (id: string) => SalesInvoiceValidationPreview
  markReady: (id: string) => SalesInvoiceDto
  cancelInvoice: (id: string, reason: string) => SalesInvoiceDto
  postInvoice: (id: string) => PostSalesInvoiceResult
  getOverview: (legalEntityId: string) => ReceivableOverviewDto
  listOutstanding: (params: Record<string, string | number | boolean | undefined>) => PaginatedResult<OutstandingOpenItemDto>
  getAgeing: (params: Record<string, string | number | boolean | undefined>) => AgeingReportDto
  listCustomers: (params: Record<string, string | number | boolean | undefined>) => PaginatedResult<CustomerReceivableDetailDto>
  getCustomer: (customerId: string, legalEntityId: string) => CustomerReceivableDetailDto | undefined
  listCustomerOpenItems: (customerId: string, params: Record<string, string | number | boolean | undefined>) => PaginatedResult<OutstandingOpenItemDto>
  getReconciliation: (legalEntityId: string) => ReceivableReconciliationDto

  // ─── Customer credit notes (Phase 3C6 demo) ──────────────────────────────
  creditNotes: CustomerCreditNoteDto[]
  creditNoteAllocations: CreditNoteAllocationDemoRow[]
  creditNoteSeq: number
  creditNoteVoucherSeq: number
  creditNoteAllocationSeq: number
  creditNotesSeeded: boolean
  seedCreditNotesIfEmpty: (legalEntityId: string) => void
  listCreditNotes: (q: ListCustomerCreditNotesQuery) => CustomerCreditNoteListItemDto[]
  getCreditNote: (id: string) => CustomerCreditNoteDto | undefined
  createCreditNote: (input: CreateCustomerCreditNoteInput) => CustomerCreditNoteDto
  updateCreditNote: (id: string, input: UpdateCustomerCreditNoteInput) => CustomerCreditNoteDto
  validateCreditNote: (id: string) => CreditNoteValidationPreview
  markCreditNoteReady: (id: string) => CustomerCreditNoteDto
  submitCreditNote: (id: string) => CustomerCreditNoteDto
  approveCreditNote: (id: string) => CustomerCreditNoteDto
  rejectCreditNote: (id: string) => CustomerCreditNoteDto
  cancelCreditNote: (id: string, reason: string) => CustomerCreditNoteDto
  postCreditNote: (id: string) => PostCreditNoteResult
  previewCreditNoteAllocationDemo: (creditNoteId: string, body: CreditNoteAllocationRequest) => CreditNoteAllocationPreview
  allocateCreditNoteDemo: (creditNoteId: string, body: CreditNoteAllocationRequest) => CreditNoteAllocationResult
  listCreditNoteAllocationsDemo: (creditNoteId: string) => CreditNoteAllocationHistoryRow[]
}

function allowedActions(status: SalesInvoiceStatus): SalesInvoiceAllowedActions {
  const editable = status === 'DRAFT' || status === 'READY_TO_POST'
  const cancellable = editable
  if (status === 'POSTED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      cancel: false,
      post: false,
      viewAccounting: true,
    }
  }
  return {
    edit: editable,
    validate: true,
    markReady: status === 'DRAFT',
    cancel: cancellable,
    post: status === 'READY_TO_POST',
  }
}

function buildLine(lineNumber: number, desc: string, qty: number, rate: number, inter: boolean): SalesInvoiceLineDto {
  const calc = inter ? previewInterLineTotal(qty, rate) : previewLineTotal(qty, rate)
  return {
    id: id(),
    lineNumber,
    sourceLineId: null,
    itemId: null,
    itemCodeSnapshot: `ITEM-${lineNumber}`,
    itemNameSnapshot: desc,
    hsnCodeSnapshot: '8716',
    uomSnapshot: 'NOS',
    description: desc,
    quantity: String(qty),
    unitRate: formatDecimal(rate),
    grossAmount: formatDecimal(calc.grossAmount),
    discountPercent: '0',
    discountAmount: formatDecimal(calc.discountAmount),
    taxableAmount: formatDecimal(calc.taxableAmount),
    cgstRate: inter ? '0' : '9',
    cgstAmount: formatDecimal(calc.cgstAmount),
    sgstRate: inter ? '0' : '9',
    sgstAmount: formatDecimal(calc.sgstAmount),
    igstRate: inter ? '18' : '0',
    igstAmount: formatDecimal(calc.igstAmount),
    cessRate: '0',
    cessAmount: '0.00',
    lineTotal: formatDecimal(calc.lineTotal),
    revenueAccountId: 'acc-sales',
    costCentreId: null,
  }
}

function sumLines(lines: SalesInvoiceLineDto[]) {
  const pick = (f: keyof SalesInvoiceLineDto) =>
    lines.reduce((acc, l) => acc + Number(l[f] || 0), 0)
  const subtotal = pick('grossAmount')
  const discount = pick('discountAmount')
  const taxable = pick('taxableAmount')
  const cgst = pick('cgstAmount')
  const sgst = pick('sgstAmount')
  const igst = pick('igstAmount')
  const tax = cgst + sgst + igst
  const total = taxable + tax
  return {
    subtotalAmount: formatDecimal(subtotal),
    discountAmount: formatDecimal(discount),
    taxableAmount: formatDecimal(taxable),
    cgstAmount: formatDecimal(cgst),
    sgstAmount: formatDecimal(sgst),
    igstAmount: formatDecimal(igst),
    cessAmount: '0.00',
    totalTaxAmount: formatDecimal(tax),
    roundOffAmount: '0.00',
    totalAmount: formatDecimal(total),
    baseSubtotalAmount: formatDecimal(subtotal),
    baseDiscountAmount: formatDecimal(discount),
    baseTaxableAmount: formatDecimal(taxable),
    baseCgstAmount: formatDecimal(cgst),
    baseSgstAmount: formatDecimal(sgst),
    baseIgstAmount: formatDecimal(igst),
    baseCessAmount: '0.00',
    baseTotalTaxAmount: formatDecimal(tax),
    baseRoundOffAmount: '0.00',
    baseTotalAmount: formatDecimal(total),
  }
}

function recalcInvoice(inv: SalesInvoiceDto, lines: SalesInvoiceLineDto[]): SalesInvoiceDto {
  const totals = sumLines(lines)
  const freight = Number(inv.freightAmount || 0)
  const other = Number(inv.otherChargesAmount || 0)
  const grand = Number(totals.totalAmount) + freight + other
  return {
    ...inv,
    lines,
    ...totals,
    totalAmount: formatDecimal(grand),
    baseTotalAmount: formatDecimal(grand),
    outstandingAmount: inv.status === 'POSTED' ? formatDecimal(grand) : '0.00',
    updatedAt: new Date().toISOString(),
  }
}

function customerMeta(customerId: string) {
  const c = CUSTOMERS.find((x) => x.id === customerId) ?? CUSTOMERS[0]
  return {
    customerCodeSnapshot: c.code,
    customerNameSnapshot: c.name,
    customerGstinSnapshot: c.gstin,
    customerPanSnapshot: null,
    customerStateCodeSnapshot: c.state,
  }
}

function validateDemo(inv: SalesInvoiceDto): SalesInvoiceValidationPreview {
  const errors: SalesInvoiceValidationPreview['errors'] = []
  const warnings: SalesInvoiceValidationPreview['warnings'] = []
  if (!inv.customerId) errors.push({ code: 'CUSTOMER_REQUIRED', message: 'Customer is required', field: 'customerId' })
  if ((inv.lines?.length ?? 0) < 1) errors.push({ code: 'INSUFFICIENT_LINES', message: 'At least one line required', field: 'lines' })
  for (const line of inv.lines ?? []) {
    if (Number(line.quantity) <= 0) errors.push({ code: 'INVALID_QTY', message: `Line ${line.lineNumber}: quantity must be positive`, field: 'lines' })
  }
  if (inv.status === 'READY_TO_POST' && !inv.draftReference) {
    warnings.push({ code: 'DRAFT_REF', message: 'Draft reference will be replaced on post', severity: 'warning' })
  }
  return { valid: errors.length === 0, errors, warnings }
}

function bucketForDueDate(dueDate: string | null, reportDate: string): OutstandingOpenItemDto['dueDateBucket'] {
  if (!dueDate) return 'NO_DUE_DATE'
  const diff = Math.floor((new Date(reportDate).getTime() - new Date(dueDate).getTime()) / 86400000)
  if (diff <= 0) return 'CURRENT'
  if (diff <= 30) return 'OVERDUE_1_30'
  if (diff <= 60) return 'OVERDUE_31_60'
  if (diff <= 90) return 'OVERDUE_61_90'
  if (diff <= 120) return 'OVERDUE_91_120'
  return 'OVERDUE_ABOVE_120'
}

function ageBucket(invoiceDate: string, reportDate: string): OutstandingOpenItemDto['invoiceAgeBucket'] {
  const diff = Math.floor((new Date(reportDate).getTime() - new Date(invoiceDate).getTime()) / 86400000)
  if (diff <= 30) return 'AGE_0_30'
  if (diff <= 60) return 'AGE_31_60'
  if (diff <= 90) return 'AGE_61_90'
  if (diff <= 120) return 'AGE_91_120'
  return 'AGE_ABOVE_120'
}

function buildOpenItem(inv: SalesInvoiceDto, voucherNumber: string, voucherId: string, openItemId: string): OpenItemRecord {
  const reportDate = today()
  const due = inv.dueDate ?? inv.invoiceDate
  const daysOutstanding = Math.max(0, Math.floor((new Date(reportDate).getTime() - new Date(inv.invoiceDate).getTime()) / 86400000))
  const daysOverdue = due < reportDate ? Math.floor((new Date(reportDate).getTime() - new Date(due).getTime()) / 86400000) : null
  return {
    openItemId,
    salesInvoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceStatus: inv.status,
    customerId: inv.customerId,
    customerCode: inv.customerCodeSnapshot,
    customerName: inv.customerNameSnapshot,
    referenceNumber: inv.referenceNumber,
    customerPoNumber: inv.customerPoNumber,
    invoiceDate: inv.invoiceDate,
    postingDate: inv.postingDate,
    dueDate: inv.dueDate,
    voucherNumber,
    voucherId,
    currencyCode: inv.currencyCode,
    exchangeRate: inv.exchangeRate,
    outstandingAmount: inv.outstandingAmount,
    baseOutstandingAmount: inv.baseTotalAmount,
    originalAmount: inv.totalAmount,
    baseOriginalAmount: inv.baseTotalAmount,
    daysOutstanding,
    daysOverdue,
    dueDateBucket: bucketForDueDate(due, reportDate),
    invoiceAgeBucket: ageBucket(inv.invoiceDate, reportDate),
    status: 'OPEN',
    isDisputed: false,
    isOnHold: false,
    receivableAccountId: RECEIVABLE_ACCOUNT_ID,
    allowedActions: { edit: false, validate: false, markReady: false, cancel: false, post: false, allocate: false, receipt: false, dispute: false, releaseHold: false },
    legalEntityId: inv.legalEntityId,
  }
}

function seedInvoices(): SalesInvoiceDto[] {
  const now = new Date().toISOString()
  const draftLines = [buildLine(1, 'Semi-trailer chassis — draft quote', 1, 850000, false)]
  const draftTotals = sumLines(draftLines)
  const draft: SalesInvoiceDto = {
    id: 'c3000001-0001-4001-8001-000000000001',
    tenantId: 'demo',
    legalEntityId: DEMO_LEGAL_ENTITY_ID,
    branchId: DEMO_BRANCH_ID,
    financialYearId: DEMO_FY_ID,
    invoiceNumber: null,
    draftReference: 'SID-D-000001',
    status: 'DRAFT',
    customerId: DEMO_CUSTOMER_IDS.mahindra,
    ...customerMeta(DEMO_CUSTOMER_IDS.mahindra),
    customerBillingAddressSnapshot: null,
    customerShippingAddressSnapshot: null,
    sourceType: 'DIRECT',
    sourceDocumentId: null,
    sourceDocumentSnapshot: null,
    invoiceDate: today(),
    postingDate: today(),
    referenceNumber: null,
    customerPoNumber: 'PO-MHL-DRAFT',
    paymentTermsDays: 30,
    freightAmount: '0.00',
    otherChargesAmount: '0.00',
    dueDate: addDays(today(), 30),
    placeOfSupply: '27',
    supplyType: 'INTRA_STATE',
    taxTreatment: 'REGISTERED',
    currencyCode: 'INR',
    exchangeRate: '1',
    ...draftTotals,
    outstandingAmount: '0.00',
    amountPaid: '0.00',
    amountAdjusted: '0.00',
    narration: 'Draft invoice for trailer chassis',
    accountingVoucherId: null,
    postingEventId: null,
    postedAt: null,
    postedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdBy: 'demo',
    updatedBy: 'demo',
    createdAt: now,
    updatedAt: now,
    lines: draftLines,
  }

  const readyLines = [buildLine(1, 'Tipper trailer — 32 ft', 2, 425000, false)]
  const readyTotals = sumLines(readyLines)
  const ready: SalesInvoiceDto = {
    ...draft,
    id: 'c3000002-0002-4002-8002-000000000002',
    draftReference: 'SID-D-000002',
    status: 'READY_TO_POST',
    customerId: DEMO_CUSTOMER_IDS.tata,
    ...customerMeta(DEMO_CUSTOMER_IDS.tata),
    customerPoNumber: 'PO-TML-8821',
    ...readyTotals,
    lines: readyLines,
    narration: 'Ready to post — intra-state supply',
  }

  const postedIntraLines = [buildLine(1, 'Flatbed trailer — 40 ft', 1, 620000, false)]
  const postedIntraTotals = sumLines(postedIntraLines)
  const postedIntra: SalesInvoiceDto = {
    ...draft,
    id: 'c3000003-0003-4003-8003-000000000003',
    invoiceNumber: 'SINV-2026-00042',
    draftReference: 'SID-D-000042',
    status: 'POSTED',
    customerId: DEMO_CUSTOMER_IDS.mahindra,
    ...customerMeta(DEMO_CUSTOMER_IDS.mahindra),
    invoiceDate: daysAgo(45),
    postingDate: daysAgo(45),
    dueDate: daysAgo(15),
    customerPoNumber: 'PO-MHL-7712',
    ...postedIntraTotals,
    outstandingAmount: postedIntraTotals.totalAmount,
    accountingVoucherId: 'v-demo-sinv-42',
    postedAt: daysAgo(45),
    postedBy: 'demo',
    lines: postedIntraLines,
    receivableOpenItemId: 'oi-00042',
  }

  const postedInterLines = [buildLine(1, 'Tanker trailer — stainless', 1, 980000, true)]
  const postedInterTotals = sumLines(postedInterLines)
  const postedInter: SalesInvoiceDto = {
    ...postedIntra,
    id: 'c3000004-0004-4004-8004-000000000004',
    invoiceNumber: 'SINV-2026-00058',
    draftReference: 'SID-D-000058',
    customerId: DEMO_CUSTOMER_IDS.ashok,
    ...customerMeta(DEMO_CUSTOMER_IDS.ashok),
    supplyType: 'INTER_STATE',
    placeOfSupply: '33',
    invoiceDate: daysAgo(130),
    postingDate: daysAgo(130),
    dueDate: daysAgo(100),
    customerPoNumber: 'PO-AL-4410',
    ...postedInterTotals,
    outstandingAmount: postedInterTotals.totalAmount,
    accountingVoucherId: 'v-demo-sinv-58',
    postedAt: daysAgo(130),
    receivableOpenItemId: 'oi-00058',
    lines: postedInterLines,
  }

  const overdue90Lines = [buildLine(1, 'Low-bed trailer axle set', 4, 85000, false)]
  const overdue90Totals = sumLines(overdue90Lines)
  const overdue90: SalesInvoiceDto = {
    ...postedIntra,
    id: 'c3000005-0005-4005-8005-000000000005',
    invoiceNumber: 'SINV-2026-00021',
    customerId: DEMO_CUSTOMER_IDS.tata,
    ...customerMeta(DEMO_CUSTOMER_IDS.tata),
    invoiceDate: daysAgo(75),
    postingDate: daysAgo(75),
    dueDate: daysAgo(45),
    ...overdue90Totals,
    outstandingAmount: overdue90Totals.totalAmount,
    accountingVoucherId: 'v-demo-sinv-21',
    receivableOpenItemId: 'oi-00021',
    lines: overdue90Lines,
  }

  return [draft, ready, postedIntra, postedInter, overdue90]
}

// ─── Customer credit notes (Phase 3C6 demo) ────────────────────────────────

function buildCreditNoteLine(lineNumber: number, desc: string, qty: number, rate: number, inter: boolean): CustomerCreditNoteLineDto {
  const calc = inter ? previewInterLineTotal(qty, rate) : previewLineTotal(qty, rate)
  return {
    id: id(),
    lineNumber,
    originalInvoiceLineId: null,
    itemId: null,
    itemCodeSnapshot: `ITEM-${lineNumber}`,
    itemNameSnapshot: desc,
    hsnCodeSnapshot: '8716',
    uomSnapshot: 'NOS',
    description: desc,
    adjustmentMode: 'FULL_LINE',
    quantity: String(qty),
    unitRate: formatDecimal(rate),
    revisedUnitRate: null,
    grossAmount: formatDecimal(calc.grossAmount),
    discountAmount: formatDecimal(calc.discountAmount),
    taxableAmount: formatDecimal(calc.taxableAmount),
    cgstRate: inter ? '0' : '9',
    cgstAmount: formatDecimal(calc.cgstAmount),
    sgstRate: inter ? '0' : '9',
    sgstAmount: formatDecimal(calc.sgstAmount),
    igstRate: inter ? '18' : '0',
    igstAmount: formatDecimal(calc.igstAmount),
    cessRate: '0',
    cessAmount: '0.00',
    lineTotal: formatDecimal(calc.lineTotal),
    revenueReversalAccountId: 'acc-sales',
    costCentreId: null,
  }
}

function sumCreditNoteLines(lines: CustomerCreditNoteLineDto[]) {
  const pick = (f: keyof CustomerCreditNoteLineDto) => lines.reduce((acc, l) => acc + Number(l[f] || 0), 0)
  const taxable = pick('taxableAmount')
  const discount = pick('discountAmount')
  const cgst = pick('cgstAmount')
  const sgst = pick('sgstAmount')
  const igst = pick('igstAmount')
  const tax = cgst + sgst + igst
  return {
    taxableAmount: formatDecimal(taxable),
    discountAmount: formatDecimal(discount),
    cgstAmount: formatDecimal(cgst),
    sgstAmount: formatDecimal(sgst),
    igstAmount: formatDecimal(igst),
    cessAmount: '0.00',
    totalTaxAmount: formatDecimal(tax),
    baseTaxableAmount: formatDecimal(taxable),
    baseDiscountAmount: formatDecimal(discount),
    baseCgstAmount: formatDecimal(cgst),
    baseSgstAmount: formatDecimal(sgst),
    baseIgstAmount: formatDecimal(igst),
    baseCessAmount: '0.00',
    baseTotalTaxAmount: formatDecimal(tax),
  }
}

function recalcCreditNote(note: CustomerCreditNoteDto, lines: CustomerCreditNoteLineDto[]): CustomerCreditNoteDto {
  const totals = sumCreditNoteLines(lines)
  const freight = Number(note.freightAmount || 0)
  const other = Number(note.otherChargesAmount || 0)
  const roundOff = Number(note.roundOffAmount || 0)
  const grand = Number(totals.taxableAmount) + Number(totals.totalTaxAmount) + freight + other + roundOff
  return {
    ...note,
    lines,
    ...totals,
    freightAmount: formatDecimal(freight),
    otherChargesAmount: formatDecimal(other),
    roundOffAmount: formatDecimal(roundOff),
    baseFreightAmount: formatDecimal(freight),
    baseOtherChargesAmount: formatDecimal(other),
    baseRoundOffAmount: formatDecimal(roundOff),
    grandTotal: formatDecimal(grand),
    baseGrandTotal: formatDecimal(grand),
    updatedAt: new Date().toISOString(),
  }
}

function creditNoteAllowedActions(
  status: CustomerCreditNoteStatus,
  approvalRequired: boolean,
  unallocatedAmount: string,
): CustomerCreditNoteAllowedActions {
  const unallocated = Number(unallocatedAmount || 0)
  if (status === 'POSTED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      submit: false,
      approve: false,
      reject: false,
      cancel: false,
      post: false,
      viewAccounting: true,
      allocate: unallocated > 0,
      viewAllocations: true,
      reverse: false,
    }
  }
  if (status === 'PENDING_APPROVAL') {
    return {
      edit: false, validate: false, markReady: false, submit: false,
      approve: true, reject: true, cancel: false, post: false, reverse: false,
    }
  }
  if (status === 'CANCELLED') {
    return {
      edit: false, validate: false, markReady: false, submit: false,
      approve: false, reject: false, cancel: false, post: false, reverse: false,
    }
  }
  const editable = status === 'DRAFT' || status === 'READY_TO_POST' || status === 'REJECTED'
  return {
    edit: editable,
    validate: status === 'DRAFT' || status === 'READY_TO_POST',
    markReady: status === 'DRAFT' && !approvalRequired,
    submit: status === 'DRAFT' && approvalRequired,
    approve: false,
    reject: false,
    cancel: editable,
    post: status === 'READY_TO_POST',
    reverse: false,
  }
}

function validateCreditNoteDemo(note: CustomerCreditNoteDto): CreditNoteValidationPreview {
  const errors: CreditNoteValidationPreview['errors'] = []
  const warnings: CreditNoteValidationPreview['warnings'] = []
  if (!note.customerId) errors.push({ code: 'CUSTOMER_REQUIRED', message: 'Customer is required', field: 'customerId' })
  if ((note.lines?.length ?? 0) < 1) errors.push({ code: 'INSUFFICIENT_LINES', message: 'At least one line required', field: 'lines' })
  if (note.sourceType === 'SALES_INVOICE' && !note.originalInvoiceId) {
    errors.push({ code: 'ORIGINAL_INVOICE_REQUIRED', message: 'Original invoice is required for invoice-linked credit notes', field: 'originalInvoiceId' })
  }
  return { valid: errors.length === 0, errors, warnings }
}

function seedCreditNotes(): CustomerCreditNoteDto[] {
  const now = new Date().toISOString()

  const directLines = [buildCreditNoteLine(1, 'Freight adjustment — courtesy credit', 1, 12000, false)]
  const direct: CustomerCreditNoteDto = {
    id: 'd4000001-0001-4001-8001-000000000001',
    tenantId: 'demo',
    legalEntityId: DEMO_LEGAL_ENTITY_ID,
    branchId: DEMO_BRANCH_ID,
    financialYearId: DEMO_FY_ID,
    creditNoteNumber: null,
    draftReference: 'CN-D-000001',
    status: 'DRAFT',
    purpose: 'FREIGHT_ADJUSTMENT',
    reasonId: null,
    reasonCodeSnapshot: null,
    reasonNameSnapshot: null,
    sourceType: 'DIRECT',
    originalInvoiceId: null,
    originalInvoiceNumberSnapshot: null,
    customerId: DEMO_CUSTOMER_IDS.mahindra,
    ...customerMeta(DEMO_CUSTOMER_IDS.mahindra),
    customerBillingAddressSnapshot: null,
    creditNoteDate: today(),
    postingDate: today(),
    supplyType: 'INTRA_STATE',
    taxTreatment: 'REGISTERED',
    currencyCode: 'INR',
    exchangeRate: '1',
    ...sumCreditNoteLines(directLines),
    freightAmount: '0.00',
    otherChargesAmount: '0.00',
    roundOffAmount: '0.00',
    grandTotal: '0.00',
    baseFreightAmount: '0.00',
    baseOtherChargesAmount: '0.00',
    baseRoundOffAmount: '0.00',
    baseGrandTotal: '0.00',
    allocatableAmount: '0.00',
    allocatedAmount: '0.00',
    unallocatedAmount: '0.00',
    baseAllocatableAmount: '0.00',
    baseAllocatedAmount: '0.00',
    baseUnallocatedAmount: '0.00',
    inventoryReturnRequired: false,
    approvalRequired: false,
    approvalRequestId: null,
    accountingVoucherId: null,
    postingEventId: null,
    creditOpenItemId: null,
    postedAt: null,
    postedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    createdBy: 'demo',
    updatedBy: 'demo',
    createdAt: now,
    updatedAt: now,
    lines: directLines,
  }
  const directCalc = recalcCreditNote(direct, directLines)

  const postedLines = [buildCreditNoteLine(1, 'Quality claim — chassis rework credit', 1, 85000, false)]
  const posted: CustomerCreditNoteDto = {
    ...directCalc,
    id: 'd4000002-0002-4002-8002-000000000002',
    creditNoteNumber: 'CN-2026-00011',
    draftReference: 'CN-D-000002',
    status: 'POSTED',
    purpose: 'QUALITY_CLAIM',
    sourceType: 'SALES_INVOICE',
    originalInvoiceId: 'c3000003-0003-4003-8003-000000000003',
    originalInvoiceNumberSnapshot: 'SINV-2026-00042',
    customerId: DEMO_CUSTOMER_IDS.mahindra,
    ...customerMeta(DEMO_CUSTOMER_IDS.mahindra),
    creditNoteDate: daysAgo(10),
    postingDate: daysAgo(10),
    accountingVoucherId: 'v-demo-cn-11',
    creditOpenItemId: 'oi-cn-00011',
    postedAt: daysAgo(10),
    postedBy: 'demo',
    lines: postedLines,
  }
  const postedCalc = recalcCreditNote(posted, postedLines)
  const postedFinal: CustomerCreditNoteDto = {
    ...postedCalc,
    allocatableAmount: postedCalc.grandTotal,
    unallocatedAmount: postedCalc.grandTotal,
    baseAllocatableAmount: postedCalc.baseGrandTotal,
    baseUnallocatedAmount: postedCalc.baseGrandTotal,
  }

  return [directCalc, postedFinal]
}

function seedOpenItems(invoices: SalesInvoiceDto[]): OpenItemRecord[] {
  const posted = invoices.filter((i) => i.status === 'POSTED')
  return posted.map((inv) =>
    buildOpenItem(
      inv,
      inv.invoiceNumber ?? 'SINV',
      inv.accountingVoucherId ?? id(),
      inv.receivableOpenItemId ?? id(),
    ),
  )
}

export const useReceivablesDemoStore = create<ReceivablesDemoState>()(
  persist(
    (set, get) => ({
      invoices: [],
      openItems: [],
      postedEvents: {},
      invoiceSeq: 100,
      voucherSeq: 200,
      seeded: false,
      creditNotes: [],
      creditNoteAllocations: [],
      creditNoteSeq: 100,
      creditNoteVoucherSeq: 300,
      creditNoteAllocationSeq: 1,
      creditNotesSeeded: false,

      seedIfEmpty(legalEntityId) {
        if (get().seeded && get().invoices.some((i) => i.legalEntityId === legalEntityId)) return
        const invoices = seedInvoices()
        const openItems = seedOpenItems(invoices)
        const postedEvents: ReceivablesDemoState['postedEvents'] = {}
        for (const inv of invoices.filter((i) => i.status === 'POSTED')) {
          postedEvents[inv.id] = {
            voucherNumber: inv.invoiceNumber ?? 'SINV',
            voucherId: inv.accountingVoucherId ?? id(),
            openItemId: inv.receivableOpenItemId ?? id(),
          }
        }
        set({ invoices, openItems, postedEvents, seeded: true, invoiceSeq: 100, voucherSeq: 200 })
      },

      listInvoices(q) {
        get().seedIfEmpty(q.legalEntityId)
        let rows = get().invoices.filter((i) => i.legalEntityId === q.legalEntityId)
        if (q.status) rows = rows.filter((i) => i.status === q.status)
        if (q.customerId) rows = rows.filter((i) => i.customerId === q.customerId)
        if (q.search) {
          const s = q.search.toLowerCase()
          rows = rows.filter(
            (i) =>
              (i.invoiceNumber ?? '').toLowerCase().includes(s) ||
              (i.draftReference ?? '').toLowerCase().includes(s) ||
              (i.customerNameSnapshot ?? '').toLowerCase().includes(s) ||
              (i.customerPoNumber ?? '').toLowerCase().includes(s),
          )
        }
        return rows
          .map(({ lines: _l, ...rest }) => ({ ...rest, allowedActions: allowedActions(rest.status) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      },

      getInvoice(invoiceId) {
        const inv = get().invoices.find((i) => i.id === invoiceId)
        if (!inv) return undefined
        return { ...inv, allowedActions: allowedActions(inv.status), validationSummary: validateDemo(inv) }
      },

      createInvoice(input) {
        get().seedIfEmpty(input.legalEntityId)
        const invoiceId = id()
        const seq = get().invoiceSeq + 1
        set({ invoiceSeq: seq })
        const lines = input.lines.map((l, idx) =>
          buildLine(
            l.lineNumber ?? idx + 1,
            l.description,
            Number(l.quantity),
            Number(l.unitPrice),
            input.supplyType === 'INTER_STATE',
          ),
        )
        const now = new Date().toISOString()
        let inv: SalesInvoiceDto = {
          id: invoiceId,
          tenantId: 'demo',
          legalEntityId: input.legalEntityId,
          branchId: input.branchId ?? DEMO_BRANCH_ID,
          financialYearId: DEMO_FY_ID,
          invoiceNumber: null,
          draftReference: `SID-D-${String(seq).padStart(6, '0')}`,
          status: 'DRAFT',
          customerId: input.customerId,
          ...customerMeta(input.customerId),
          customerBillingAddressSnapshot: null,
          customerShippingAddressSnapshot: null,
          sourceType: input.sourceType ?? 'DIRECT',
          sourceDocumentId: input.sourceDocumentId ?? null,
          sourceDocumentSnapshot: null,
          invoiceDate: input.invoiceDate,
          postingDate: input.postingDate,
          referenceNumber: input.referenceNumber ?? null,
          customerPoNumber: input.customerPoNumber ?? null,
          paymentTermsDays: input.paymentTermsDays ?? 30,
          freightAmount: input.freightAmount ?? '0.00',
          otherChargesAmount: input.otherChargesAmount ?? '0.00',
          dueDate: input.dueDate ?? addDays(input.invoiceDate, input.paymentTermsDays ?? 30),
          placeOfSupply: input.placeOfSupply ?? '27',
          supplyType: input.supplyType ?? 'INTRA_STATE',
          taxTreatment: input.taxTreatment,
          currencyCode: input.currencyCode ?? 'INR',
          exchangeRate: input.exchangeRate ?? '1',
          ...sumLines(lines),
          outstandingAmount: '0.00',
          amountPaid: '0.00',
          amountAdjusted: '0.00',
          narration: input.narration ?? null,
          accountingVoucherId: null,
          postingEventId: null,
          postedAt: null,
          postedBy: null,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          createdBy: 'demo',
          updatedBy: 'demo',
          createdAt: now,
          updatedAt: now,
          lines,
        }
        inv = recalcInvoice(inv, lines)
        set({ invoices: [...get().invoices, inv] })
        return { ...inv, allowedActions: allowedActions(inv.status) }
      },

      updateInvoice(invoiceId, input) {
        const existing = get().getInvoice(invoiceId)
        if (!existing) throw Object.assign(new Error('Sales invoice not found'), { code: 'SALES_INVOICE_NOT_FOUND' })
        if (existing.updatedAt !== input.updatedAt) {
          throw Object.assign(new Error('Invoice was updated elsewhere'), { code: 'STALE_UPDATE' })
        }
        if (existing.status === 'POSTED' || existing.status === 'CANCELLED') {
          throw Object.assign(new Error('Invoice is read-only'), { code: 'INVOICE_LOCKED' })
        }
        const revertDraft = existing.status === 'READY_TO_POST'
        const lines = input.lines.map((l, idx) =>
          buildLine(
            l.lineNumber ?? idx + 1,
            l.description,
            Number(l.quantity),
            Number(l.unitPrice),
            (input.supplyType ?? existing.supplyType) === 'INTER_STATE',
          ),
        )
        let updated: SalesInvoiceDto = {
          ...existing,
          ...input,
          status: revertDraft ? 'DRAFT' : existing.status,
          ...customerMeta(input.customerId),
          lines,
          updatedAt: new Date().toISOString(),
        }
        updated = recalcInvoice(updated, lines)
        set({ invoices: get().invoices.map((i) => (i.id === invoiceId ? updated : i)) })
        return { ...updated, allowedActions: allowedActions(updated.status) }
      },

      validateInvoice(invoiceId) {
        const inv = get().getInvoice(invoiceId)
        if (!inv) throw new Error('Sales invoice not found')
        return validateDemo(inv)
      },

      markReady(invoiceId) {
        const inv = get().getInvoice(invoiceId)
        if (!inv) throw new Error('Sales invoice not found')
        const report = validateDemo(inv)
        if (!report.valid) {
          throw Object.assign(new Error(report.errors[0]?.message ?? 'Validation failed'), { code: 'SALES_INVOICE_VALIDATION_FAILED' })
        }
        const updated = { ...inv, status: 'READY_TO_POST' as const, updatedAt: new Date().toISOString() }
        set({ invoices: get().invoices.map((i) => (i.id === invoiceId ? updated : i)) })
        return { ...updated, allowedActions: allowedActions(updated.status) }
      },

      cancelInvoice(invoiceId, reason) {
        const inv = get().getInvoice(invoiceId)
        if (!inv) throw new Error('Sales invoice not found')
        const updated: SalesInvoiceDto = {
          ...inv,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set({ invoices: get().invoices.map((i) => (i.id === invoiceId ? updated : i)) })
        return { ...updated, allowedActions: allowedActions(updated.status) }
      },

      postInvoice(invoiceId) {
        const replay = get().postedEvents[invoiceId]
        const inv = get().getInvoice(invoiceId)
        if (!inv) throw new Error('Sales invoice not found')
        if (replay) {
          return {
            invoice: { ...inv, allowedActions: allowedActions(inv.status) },
            posting: { voucherId: replay.voucherId, voucherNumber: replay.voucherNumber, postingEventId: id() },
            receivableOpenItemId: replay.openItemId,
            idempotentReplay: true,
          }
        }
        if (inv.status !== 'READY_TO_POST') {
          throw Object.assign(new Error('Only ready-to-post invoices can be posted'), { code: 'INVALID_STATUS' })
        }
        const vSeq = get().voucherSeq + 1
        const iSeq = get().invoiceSeq + 1
        set({ voucherSeq: vSeq, invoiceSeq: iSeq })
        const voucherNumber = `SINV-2026-${String(vSeq).padStart(5, '0')}`
        const voucherId = id()
        const openItemId = id()
        const posted: SalesInvoiceDto = {
          ...inv,
          status: 'POSTED',
          invoiceNumber: voucherNumber,
          postingDate: today(),
          postedAt: new Date().toISOString(),
          accountingVoucherId: voucherId,
          outstandingAmount: inv.totalAmount,
          receivableOpenItemId: openItemId,
          updatedAt: new Date().toISOString(),
        }
        const oi = buildOpenItem(posted, voucherNumber, voucherId, openItemId)
        set({
          invoices: get().invoices.map((i) => (i.id === invoiceId ? posted : i)),
          openItems: [...get().openItems, oi],
          postedEvents: { ...get().postedEvents, [invoiceId]: { voucherNumber, voucherId, openItemId } },
        })
        return {
          invoice: { ...posted, allowedActions: allowedActions(posted.status) },
          posting: { voucherId, voucherNumber, postingEventId: id() },
          receivableOpenItemId: openItemId,
          idempotentReplay: false,
        }
      },

      getOverview(legalEntityId) {
        get().seedIfEmpty(legalEntityId)
        const openItems = get().openItems.filter((o) => o.legalEntityId === legalEntityId)
        const outstanding = openItems.reduce((s, o) => s + Number(o.baseOutstandingAmount), 0)
        const customers = new Set(openItems.map((o) => o.customerId))
        const ready = get().invoices.filter((i) => i.legalEntityId === legalEntityId && i.status === 'READY_TO_POST').length
        const monthStart = today().slice(0, 7)
        const postedMonth = get().invoices.filter(
          (i) => i.legalEntityId === legalEntityId && i.status === 'POSTED' && (i.postedAt ?? '').startsWith(monthStart),
        ).length
        return {
          reportDate: today(),
          legalEntityId,
          limitations: [],
          totals: {
            openItemCount: openItems.length,
            customerCount: customers.size,
            outstandingAmount: formatDecimal(outstanding),
            baseOutstandingAmount: formatDecimal(outstanding),
          },
          readyToPostCount: ready,
          postedThisMonthCount: postedMonth,
          dataQualityExceptionCount: 0,
          currencyBreakdown: [{ currencyCode: 'INR', outstandingAmount: formatDecimal(outstanding), baseOutstandingAmount: formatDecimal(outstanding), openItemCount: openItems.length }],
        }
      },

      listOutstanding(params) {
        const legalEntityId = String(params.legalEntityId ?? DEMO_LEGAL_ENTITY_ID)
        get().seedIfEmpty(legalEntityId)
        let rows = get().openItems.filter((o) => o.legalEntityId === legalEntityId)
        if (params.customerId) rows = rows.filter((o) => o.customerId === params.customerId)
        if (params.search) {
          const s = String(params.search).toLowerCase()
          rows = rows.filter(
            (o) =>
              (o.invoiceNumber ?? '').toLowerCase().includes(s) ||
              (o.customerName ?? '').toLowerCase().includes(s),
          )
        }
        if (params.ageingBucket) rows = rows.filter((o) => o.dueDateBucket === params.ageingBucket || o.invoiceAgeBucket === params.ageingBucket)
        const page = Number(params.page ?? 1)
        const pageSize = Number(params.pageSize ?? 50)
        const start = (page - 1) * pageSize
        return {
          items: rows.slice(start, start + pageSize).map(({ legalEntityId: _l, ...rest }) => rest),
          total: rows.length,
          page,
          pageSize,
        }
      },

      getAgeing(params) {
        const legalEntityId = String(params.legalEntityId ?? DEMO_LEGAL_ENTITY_ID)
        get().seedIfEmpty(legalEntityId)
        const basis = (params.ageingBasis as 'due_date' | 'invoice_age') ?? 'due_date'
        const rows = get().openItems.filter((o) => o.legalEntityId === legalEntityId)
        const bucketMap = new Map<string, AgeingReportDto['buckets'][0]>()
        for (const o of rows) {
          const key = basis === 'invoice_age' ? o.invoiceAgeBucket : o.dueDateBucket
          const prev = bucketMap.get(key) ?? { bucket: key, openItemCount: 0, outstandingAmount: '0', baseOutstandingAmount: '0' }
          prev.openItemCount += 1
          prev.outstandingAmount = formatDecimal(Number(prev.outstandingAmount) + Number(o.outstandingAmount))
          prev.baseOutstandingAmount = formatDecimal(Number(prev.baseOutstandingAmount) + Number(o.baseOutstandingAmount))
          bucketMap.set(key, prev)
        }
        const total = rows.reduce((s, o) => s + Number(o.baseOutstandingAmount), 0)
        return {
          reportDate: today(),
          ageingBasis: basis,
          limitations: [],
          totals: { openItemCount: rows.length, outstandingAmount: formatDecimal(total), baseOutstandingAmount: formatDecimal(total) },
          buckets: [...bucketMap.values()],
          currencyBreakdown: [{ currencyCode: 'INR', outstandingAmount: formatDecimal(total), baseOutstandingAmount: formatDecimal(total), openItemCount: rows.length }],
        }
      },

      listCustomers(params) {
        const legalEntityId = String(params.legalEntityId ?? DEMO_LEGAL_ENTITY_ID)
        get().seedIfEmpty(legalEntityId)
        const grouped = new Map<string, CustomerReceivableDetailDto>()
        for (const o of get().openItems.filter((x) => x.legalEntityId === legalEntityId)) {
          const prev = grouped.get(o.customerId) ?? {
            customerId: o.customerId,
            customerCode: o.customerCode,
            customerName: o.customerName,
            openItemCount: 0,
            outstandingAmount: '0',
            baseOutstandingAmount: '0',
            oldestDueDate: null,
            maxDaysOverdue: null,
            disputedCount: 0,
            onHoldCount: 0,
            currencyBreakdown: [],
            reportDate: today(),
            limitations: [],
          }
          prev.openItemCount += 1
          prev.outstandingAmount = formatDecimal(Number(prev.outstandingAmount) + Number(o.outstandingAmount))
          prev.baseOutstandingAmount = formatDecimal(Number(prev.baseOutstandingAmount) + Number(o.baseOutstandingAmount))
          if (!prev.oldestDueDate || (o.dueDate && o.dueDate < prev.oldestDueDate)) prev.oldestDueDate = o.dueDate
          if (o.daysOverdue != null) prev.maxDaysOverdue = Math.max(prev.maxDaysOverdue ?? 0, o.daysOverdue)
          grouped.set(o.customerId, prev)
        }
        let items = [...grouped.values()]
        if (params.search) {
          const s = String(params.search).toLowerCase()
          items = items.filter((c) => (c.customerName ?? '').toLowerCase().includes(s) || (c.customerCode ?? '').toLowerCase().includes(s))
        }
        return { items, total: items.length, page: 1, pageSize: items.length }
      },

      getCustomer(customerId, legalEntityId) {
        return get().listCustomers({ legalEntityId }).items.find((c) => c.customerId === customerId)
      },

      listCustomerOpenItems(customerId, params) {
        return get().listOutstanding({ ...params, customerId })
      },

      getReconciliation(legalEntityId) {
        get().seedIfEmpty(legalEntityId)
        const subledger = get()
          .openItems.filter((o) => o.legalEntityId === legalEntityId)
          .reduce((s, o) => s + Number(o.baseOutstandingAmount), 0)
        return {
          asOfDate: today(),
          legalEntityId,
          status: 'MATCHED',
          tolerance: '0.01',
          subledgerTotal: formatDecimal(subledger),
          glTotal: formatDecimal(subledger),
          variance: '0.00',
          accounts: [
            {
              receivableAccountId: RECEIVABLE_ACCOUNT_ID,
              accountCode: '1101',
              accountName: 'Trade Receivables',
              subledgerBalance: formatDecimal(subledger),
              glBalance: formatDecimal(subledger),
              variance: '0.00',
              matched: true,
            },
          ],
          exceptions: [],
        }
      },

      // ─── Customer credit notes (Phase 3C6 demo) ────────────────────────

      seedCreditNotesIfEmpty(legalEntityId) {
        get().seedIfEmpty(legalEntityId)
        if (get().creditNotesSeeded && get().creditNotes.some((n) => n.legalEntityId === legalEntityId)) return
        set({ creditNotes: seedCreditNotes(), creditNoteAllocations: [], creditNotesSeeded: true, creditNoteSeq: 100, creditNoteVoucherSeq: 300, creditNoteAllocationSeq: 1 })
      },

      listCreditNotes(q) {
        get().seedCreditNotesIfEmpty(q.legalEntityId)
        let rows = get().creditNotes.filter((n) => n.legalEntityId === q.legalEntityId)
        if (q.status) rows = rows.filter((n) => n.status === q.status)
        if (q.purpose) rows = rows.filter((n) => n.purpose === q.purpose)
        if (q.customerId) rows = rows.filter((n) => n.customerId === q.customerId)
        if (q.originalInvoiceId) rows = rows.filter((n) => n.originalInvoiceId === q.originalInvoiceId)
        if (q.search) {
          const s = q.search.toLowerCase()
          rows = rows.filter(
            (n) =>
              (n.creditNoteNumber ?? '').toLowerCase().includes(s) ||
              (n.draftReference ?? '').toLowerCase().includes(s) ||
              (n.customerNameSnapshot ?? '').toLowerCase().includes(s),
          )
        }
        return rows
          .map(({ lines: _l, ...rest }) => ({ ...rest, allowedActions: creditNoteAllowedActions(rest.status, rest.approvalRequired, rest.unallocatedAmount) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      },

      getCreditNote(noteId) {
        const note = get().creditNotes.find((n) => n.id === noteId)
        if (!note) return undefined
        const creditOpenItem = note.creditOpenItemId
          ? { id: note.creditOpenItemId, side: 'CREDIT' as const, originalAmount: note.grandTotal, openAmount: note.unallocatedAmount, status: Number(note.unallocatedAmount) > 0 ? ('OPEN' as const) : ('SETTLED' as const) }
          : null
        return {
          ...note,
          allowedActions: creditNoteAllowedActions(note.status, note.approvalRequired, note.unallocatedAmount),
          creditOpenItem,
        }
      },

      createCreditNote(input) {
        get().seedCreditNotesIfEmpty(input.legalEntityId)
        const noteId = id()
        const seq = get().creditNoteSeq + 1
        set({ creditNoteSeq: seq })
        const inter = input.supplyType === 'INTER_STATE'
        const lines = input.lines.map((l, idx) =>
          buildCreditNoteLine(l.lineNumber ?? idx + 1, l.description ?? l.itemName ?? `Line ${idx + 1}`, Number(l.quantity ?? 1), Number(l.unitRate ?? l.value ?? 0), inter),
        )
        const now = new Date().toISOString()
        let note: CustomerCreditNoteDto = {
          id: noteId,
          tenantId: 'demo',
          legalEntityId: input.legalEntityId,
          branchId: input.branchId ?? DEMO_BRANCH_ID,
          financialYearId: DEMO_FY_ID,
          creditNoteNumber: null,
          draftReference: `CN-D-${String(seq).padStart(6, '0')}`,
          status: 'DRAFT',
          purpose: input.purpose,
          reasonId: input.reasonId ?? null,
          reasonCodeSnapshot: null,
          reasonNameSnapshot: null,
          sourceType: input.sourceType,
          originalInvoiceId: input.originalInvoiceId ?? null,
          originalInvoiceNumberSnapshot: input.originalInvoiceId
            ? get().getInvoice(input.originalInvoiceId)?.invoiceNumber ?? null
            : null,
          customerId: input.customerId,
          ...customerMeta(input.customerId),
          customerBillingAddressSnapshot: null,
          creditNoteDate: input.creditNoteDate,
          postingDate: input.postingDate,
          supplyType: input.supplyType ?? 'INTRA_STATE',
          taxTreatment: input.taxTreatment ?? 'REGISTERED',
          currencyCode: input.currencyCode ?? 'INR',
          exchangeRate: input.exchangeRate ?? '1',
          taxableAmount: '0.00', cgstAmount: '0.00', sgstAmount: '0.00', igstAmount: '0.00', cessAmount: '0.00', totalTaxAmount: '0.00',
          discountAmount: '0.00',
          freightAmount: input.freightAmount ?? '0.00',
          otherChargesAmount: input.otherChargesAmount ?? '0.00',
          roundOffAmount: input.roundOffAmount ?? '0.00',
          grandTotal: '0.00',
          baseTaxableAmount: '0.00', baseCgstAmount: '0.00', baseSgstAmount: '0.00', baseIgstAmount: '0.00', baseCessAmount: '0.00', baseTotalTaxAmount: '0.00',
          baseDiscountAmount: '0.00', baseFreightAmount: '0.00', baseOtherChargesAmount: '0.00', baseRoundOffAmount: '0.00', baseGrandTotal: '0.00',
          allocatableAmount: '0.00', allocatedAmount: '0.00', unallocatedAmount: '0.00',
          baseAllocatableAmount: '0.00', baseAllocatedAmount: '0.00', baseUnallocatedAmount: '0.00',
          inventoryReturnRequired: input.inventoryReturnRequired ?? false,
          approvalRequired: input.approvalRequired ?? false,
          approvalRequestId: null,
          accountingVoucherId: null,
          postingEventId: null,
          creditOpenItemId: null,
          postedAt: null,
          postedBy: null,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          createdBy: 'demo',
          updatedBy: 'demo',
          createdAt: now,
          updatedAt: now,
          lines,
        }
        note = recalcCreditNote(note, lines)
        set({ creditNotes: [...get().creditNotes, note] })
        return { ...note, allowedActions: creditNoteAllowedActions(note.status, note.approvalRequired, note.unallocatedAmount) }
      },

      updateCreditNote(noteId, input) {
        const existing = get().getCreditNote(noteId)
        if (!existing) throw Object.assign(new Error('Credit note not found'), { code: 'CREDIT_NOTE_NOT_FOUND' })
        if (existing.updatedAt !== input.updatedAt) {
          throw Object.assign(new Error('Credit note was updated elsewhere'), { code: 'STALE_UPDATE' })
        }
        if (existing.status === 'POSTED' || existing.status === 'CANCELLED') {
          throw Object.assign(new Error('Credit note is read-only'), { code: 'CREDIT_NOTE_LOCKED' })
        }
        const revertDraft = existing.status === 'READY_TO_POST'
        const inter = (input.supplyType ?? existing.supplyType) === 'INTER_STATE'
        const lines = input.lines.map((l, idx) =>
          buildCreditNoteLine(l.lineNumber ?? idx + 1, l.description ?? l.itemName ?? `Line ${idx + 1}`, Number(l.quantity ?? 1), Number(l.unitRate ?? l.value ?? 0), inter),
        )
        let updated: CustomerCreditNoteDto = {
          ...existing,
          ...input,
          status: revertDraft ? 'DRAFT' : existing.status,
          ...customerMeta(input.customerId),
          lines,
          updatedAt: new Date().toISOString(),
        }
        updated = recalcCreditNote(updated, lines)
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? updated : n)) })
        return { ...updated, allowedActions: creditNoteAllowedActions(updated.status, updated.approvalRequired, updated.unallocatedAmount) }
      },

      validateCreditNote(noteId) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        return validateCreditNoteDemo(note)
      },

      markCreditNoteReady(noteId) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        const report = validateCreditNoteDemo(note)
        if (!report.valid) {
          throw Object.assign(new Error(report.errors[0]?.message ?? 'Validation failed'), { code: 'CREDIT_NOTE_VALIDATION_FAILED' })
        }
        const updated = { ...note, status: 'READY_TO_POST' as const, updatedAt: new Date().toISOString() }
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? updated : n)) })
        return { ...updated, allowedActions: creditNoteAllowedActions(updated.status, updated.approvalRequired, updated.unallocatedAmount) }
      },

      submitCreditNote(noteId) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        const updated = { ...note, status: 'PENDING_APPROVAL' as const, updatedAt: new Date().toISOString() }
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? updated : n)) })
        return { ...updated, allowedActions: creditNoteAllowedActions(updated.status, updated.approvalRequired, updated.unallocatedAmount) }
      },

      approveCreditNote(noteId) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        const updated = { ...note, status: 'READY_TO_POST' as const, updatedAt: new Date().toISOString() }
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? updated : n)) })
        return { ...updated, allowedActions: creditNoteAllowedActions(updated.status, updated.approvalRequired, updated.unallocatedAmount) }
      },

      rejectCreditNote(noteId) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        const updated = { ...note, status: 'REJECTED' as const, updatedAt: new Date().toISOString() }
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? updated : n)) })
        return { ...updated, allowedActions: creditNoteAllowedActions(updated.status, updated.approvalRequired, updated.unallocatedAmount) }
      },

      cancelCreditNote(noteId, reason) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        const updated: CustomerCreditNoteDto = {
          ...note,
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? updated : n)) })
        return { ...updated, allowedActions: creditNoteAllowedActions(updated.status, updated.approvalRequired, updated.unallocatedAmount) }
      },

      postCreditNote(noteId) {
        const note = get().getCreditNote(noteId)
        if (!note) throw new Error('Credit note not found')
        if (note.status === 'POSTED' && note.accountingVoucherId) {
          return {
            creditNote: { ...note, allowedActions: creditNoteAllowedActions(note.status, note.approvalRequired, note.unallocatedAmount) },
            posting: { voucherId: note.accountingVoucherId, voucherNumber: note.creditNoteNumber ?? 'CN', postingEventId: id() },
            creditOpenItemId: note.creditOpenItemId ?? id(),
            idempotentReplay: true,
          }
        }
        if (note.status !== 'READY_TO_POST') {
          throw Object.assign(new Error('Only ready-to-post credit notes can be posted'), { code: 'INVALID_STATUS' })
        }
        const vSeq = get().creditNoteVoucherSeq + 1
        set({ creditNoteVoucherSeq: vSeq })
        const voucherNumber = `CN-2026-${String(vSeq).padStart(5, '0')}`
        const voucherId = id()
        const openItemId = id()
        const posted: CustomerCreditNoteDto = {
          ...note,
          status: 'POSTED',
          creditNoteNumber: voucherNumber,
          postingDate: today(),
          postedAt: new Date().toISOString(),
          accountingVoucherId: voucherId,
          creditOpenItemId: openItemId,
          allocatableAmount: note.grandTotal,
          allocatedAmount: '0.00',
          unallocatedAmount: note.grandTotal,
          baseAllocatableAmount: note.baseGrandTotal,
          baseAllocatedAmount: '0.00',
          baseUnallocatedAmount: note.baseGrandTotal,
          updatedAt: new Date().toISOString(),
        }
        set({ creditNotes: get().creditNotes.map((n) => (n.id === noteId ? posted : n)) })
        return {
          creditNote: { ...posted, allowedActions: creditNoteAllowedActions(posted.status, posted.approvalRequired, posted.unallocatedAmount) },
          posting: { voucherId, voucherNumber, postingEventId: id() },
          creditOpenItemId: openItemId,
          idempotentReplay: false,
        }
      },

      previewCreditNoteAllocationDemo(creditNoteId, body) {
        const note = get().getCreditNote(creditNoteId)
        if (!note) throw new Error('Credit note not found')
        const unallocatedBefore = Number(note.unallocatedAmount)
        let running = unallocatedBefore
        const lines = body.allocations.map((line) => {
          const openItem = get().openItems.find((o) => o.openItemId === line.invoiceOpenItemId)
          const before = Number(openItem?.outstandingAmount ?? 0)
          const amount = Number(line.amount)
          running -= amount
          return {
            invoiceId: line.invoiceId,
            invoiceOpenItemId: line.invoiceOpenItemId,
            invoiceNumber: openItem?.invoiceNumber ?? null,
            currencyCode: note.currencyCode,
            invoiceOutstandingBefore: formatDecimal(before),
            proposedAllocationAmount: formatDecimal(amount),
            invoiceOutstandingAfter: formatDecimal(before - amount),
            baseInvoiceOutstandingBefore: formatDecimal(before),
            baseProposedAllocationAmount: formatDecimal(amount),
            baseInvoiceOutstandingAfter: formatDecimal(before - amount),
            status: 'VALID' as const,
            issues: [],
          }
        })
        const totalProposed = body.allocations.reduce((s, l) => s + Number(l.amount), 0)
        return {
          creditNoteId,
          creditOpenItemId: note.creditOpenItemId ?? '',
          currencyCode: note.currencyCode,
          exchangeRate: note.exchangeRate,
          creditNoteUnallocatedBefore: formatDecimal(unallocatedBefore),
          totalProposedAllocation: formatDecimal(totalProposed),
          creditNoteUnallocatedAfter: formatDecimal(running),
          customerAdvanceAfter: formatDecimal(running),
          valid: running >= 0,
          lines,
          errors: running < 0 ? [{ code: 'OVER_ALLOCATION', message: 'Allocation exceeds unallocated credit note amount' }] : [],
          warnings: [],
        }
      },

      allocateCreditNoteDemo(creditNoteId, body) {
        const note = get().getCreditNote(creditNoteId)
        if (!note) throw new Error('Credit note not found')
        if (note.status !== 'POSTED') {
          throw Object.assign(new Error('Only posted credit notes can be allocated'), { code: 'CREDIT_NOTE_ALLOCATION_NOTE_NOT_POSTED' })
        }
        const totalAllocated = body.allocations.reduce((s, l) => s + Number(l.amount), 0)
        const unallocatedBefore = Number(note.unallocatedAmount)
        if (totalAllocated <= 0 || totalAllocated > unallocatedBefore) {
          throw Object.assign(new Error('Allocation exceeds unallocated credit note amount'), { code: 'CREDIT_NOTE_ALLOCATION_OVER_LIMIT' })
        }
        const now = new Date().toISOString()
        const batchId = id()
        let seq = get().creditNoteAllocationSeq
        const newRows: CreditNoteAllocationDemoRow[] = []
        const invoiceRows: CreditNoteAllocationResult['invoices'] = []
        let openItems = [...get().openItems]
        let invoices = [...get().invoices]

        for (const line of body.allocations) {
          const openItem = openItems.find((o) => o.openItemId === line.invoiceOpenItemId)
          if (!openItem) throw Object.assign(new Error('Invoice open item not found'), { code: 'CREDIT_NOTE_ALLOCATION_INVOICE_NOT_FOUND' })
          const before = Number(openItem.outstandingAmount)
          const amount = Number(line.amount)
          const after = before - amount
          openItems = openItems.map((o) =>
            o.openItemId === line.invoiceOpenItemId
              ? { ...o, outstandingAmount: formatDecimal(after), baseOutstandingAmount: formatDecimal(after), status: after <= 0.001 ? 'SETTLED' : 'PARTIALLY_SETTLED' }
              : o,
          )
          invoices = invoices.map((i) =>
            i.id === openItem.salesInvoiceId ? { ...i, outstandingAmount: formatDecimal(after), amountAdjusted: formatDecimal(Number(i.amountAdjusted) + amount) } : i,
          )
          newRows.push({
            creditNoteId,
            batchId,
            allocationId: id(),
            allocationDate: body.allocationDate,
            allocationSequence: seq,
            invoiceId: line.invoiceId,
            invoiceNumber: openItem.invoiceNumber,
            invoiceOpenItemId: line.invoiceOpenItemId,
            allocatedAmount: formatDecimal(amount),
            baseAllocatedAmount: formatDecimal(amount),
            invoiceOutstandingBefore: formatDecimal(before),
            invoiceOutstandingAfter: formatDecimal(after),
            status: 'POSTED',
            createdBy: 'demo',
            createdAt: now,
          })
          invoiceRows.push({
            invoiceId: line.invoiceId,
            openItemId: line.invoiceOpenItemId,
            openAmount: formatDecimal(after),
            allocatedAmount: formatDecimal(amount),
            status: after <= 0.001 ? 'SETTLED' : 'PARTIALLY_SETTLED',
            amountPaid: formatDecimal(amount),
            outstandingAmount: formatDecimal(after),
          })
          seq += 1
        }

        const unallocatedAfter = unallocatedBefore - totalAllocated
        const updatedNote: CustomerCreditNoteDto = {
          ...note,
          allocatedAmount: formatDecimal(Number(note.allocatedAmount) + totalAllocated),
          unallocatedAmount: formatDecimal(unallocatedAfter),
          baseAllocatedAmount: formatDecimal(Number(note.baseAllocatedAmount) + totalAllocated),
          baseUnallocatedAmount: formatDecimal(unallocatedAfter),
          updatedAt: now,
        }

        set({
          creditNotes: get().creditNotes.map((n) => (n.id === creditNoteId ? updatedNote : n)),
          creditNoteAllocations: [...get().creditNoteAllocations, ...newRows],
          openItems,
          invoices,
          creditNoteAllocationSeq: seq,
        })

        return {
          batch: {
            id: batchId,
            status: 'POSTED',
            allocationDate: body.allocationDate,
            currencyCode: note.currencyCode,
            exchangeRate: note.exchangeRate,
            totalAllocatedAmount: formatDecimal(totalAllocated),
            baseTotalAllocatedAmount: formatDecimal(totalAllocated),
            allocationCount: newRows.length,
            createdBy: 'demo',
            createdAt: now,
            completedAt: now,
          },
          allocations: newRows.map((r) => ({
            id: r.allocationId,
            batchId: r.batchId,
            creditNoteId,
            invoiceId: r.invoiceId,
            invoiceOpenItemId: r.invoiceOpenItemId,
            allocationDate: r.allocationDate,
            allocatedAmount: r.allocatedAmount,
            baseAllocatedAmount: r.baseAllocatedAmount,
            invoiceOutstandingBefore: r.invoiceOutstandingBefore,
            invoiceOutstandingAfter: r.invoiceOutstandingAfter,
            status: r.status,
            createdBy: r.createdBy,
            createdAt: r.createdAt,
          })),
          creditNote: {
            id: updatedNote.id,
            allocatedAmount: updatedNote.allocatedAmount,
            unallocatedAmount: updatedNote.unallocatedAmount,
            baseAllocatedAmount: updatedNote.baseAllocatedAmount,
            baseUnallocatedAmount: updatedNote.baseUnallocatedAmount,
          },
          creditOpenItem: {
            id: updatedNote.creditOpenItemId ?? '',
            openAmount: updatedNote.unallocatedAmount,
            allocatedAmount: updatedNote.allocatedAmount,
            status: Number(updatedNote.unallocatedAmount) > 0 ? 'OPEN' : 'SETTLED',
          },
          invoices: invoiceRows,
          customerAdvance: updatedNote.unallocatedAmount,
          idempotentReplay: false,
        }
      },

      listCreditNoteAllocationsDemo(creditNoteId) {
        return get()
          .creditNoteAllocations.filter((r) => r.creditNoteId === creditNoteId)
          .sort((a, b) => b.allocationSequence - a.allocationSequence)
      },
    }),
    { name: 'fos-receivables-demo' },
  ),
)

export function getReceivablesDemoState() {
  return useReceivablesDemoStore.getState()
}

export function seedReceivablesDemoIfEmpty(legalEntityId: string) {
  getReceivablesDemoState().seedIfEmpty(legalEntityId)
}
