import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AgeingReportDto,
  CreateSalesInvoiceInput,
  CustomerReceivableDetailDto,
  ListSalesInvoicesQuery,
  OutstandingOpenItemDto,
  PaginatedResult,
  PostSalesInvoiceResult,
  ReceivableOverviewDto,
  ReceivableReconciliationDto,
  SalesInvoiceAllowedActions,
  SalesInvoiceDto,
  SalesInvoiceLineDto,
  SalesInvoiceStatus,
  SalesInvoiceValidationPreview,
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
