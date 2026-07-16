/**
 * Purchase Reports mock service — catalog + run against domain seed via public getters.
 * Additive module; does not mutate purchaseService state.
 */
import {
  getGRNs,
  getPurchaseInvoices,
  getPurchaseItems,
  getPurchaseOrders,
  getPurchaseRequisitions,
  getRFQs,
  getVendorQuotations,
  getVendors,
} from './purchaseService'
import type {
  GoodsReceiptNote,
  PurchaseInvoice,
  PurchaseItemCategory,
  PurchaseOrder,
  PurchaseRequisitionListRow,
  RequestForQuotation,
} from '../../types/purchaseDomain'
import {
  GRN_DOMAIN_STATUS_LABELS,
  PURCHASE_INVOICE_STATUS_LABELS,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  RFQ_DOMAIN_STATUS_LABELS,
  RFQ_VENDOR_INVITE_STATUS_LABELS,
} from '../../types/purchaseDomain'
import type {
  PurchaseReportCatalogEntry,
  PurchaseReportCategoryGroup,
  PurchaseReportColumn,
  PurchaseReportFilterOptions,
  PurchaseReportFilters,
  PurchaseReportId,
  PurchaseReportResult,
  PurchaseReportRow,
  PurchaseReportSummaryItem,
} from '../../types/purchaseReports'

const CATEGORY_LABELS: Record<PurchaseItemCategory, string> = {
  raw_material: 'Raw Material',
  component: 'Component',
  consumable: 'Consumable',
  packing_material: 'Packing Material',
  maintenance: 'Maintenance',
  job_work: 'Job Work',
}

const CATALOG: PurchaseReportCatalogEntry[] = [
  { id: 'pr-register', title: 'Purchase Requisition Register', description: 'All purchase requisitions with status, department, and value.', categoryId: 'requisition', categoryLabel: 'Requisition Reports' },
  { id: 'pr-pending', title: 'Pending Requisitions', description: 'Draft and pending-approval requisitions awaiting action.', categoryId: 'requisition', categoryLabel: 'Requisition Reports' },
  { id: 'pr-ageing', title: 'Requisition Ageing', description: 'Open requisitions aged by days since document date.', categoryId: 'requisition', categoryLabel: 'Requisition Reports' },
  { id: 'pr-department-wise', title: 'Department-wise Requisitions', description: 'PR counts and values grouped by requesting department.', categoryId: 'requisition', categoryLabel: 'Requisition Reports' },
  { id: 'pr-to-po-conversion', title: 'PR to PO Conversion', description: 'Conversion status from requisition to purchase order.', categoryId: 'requisition', categoryLabel: 'Requisition Reports' },
  { id: 'rfq-register', title: 'RFQ Register', description: 'Request for quotation register with vendor invite counts.', categoryId: 'rfq_quotation', categoryLabel: 'RFQ and Quotation Reports' },
  { id: 'rfq-vendor-response', title: 'Vendor Response Report', description: 'Vendor invite status and response tracking per RFQ.', categoryId: 'rfq_quotation', categoryLabel: 'RFQ and Quotation Reports' },
  { id: 'rfq-quotation-comparison', title: 'Quotation Comparison Report', description: 'Vendor quotations submitted for RFQ comparison.', categoryId: 'rfq_quotation', categoryLabel: 'RFQ and Quotation Reports' },
  { id: 'rfq-price-comparison', title: 'Price Comparison Report', description: 'Line-level rates across vendor quotations.', categoryId: 'rfq_quotation', categoryLabel: 'RFQ and Quotation Reports' },
  { id: 'rfq-conversion', title: 'RFQ Conversion Report', description: 'RFQs converted (or pending) to purchase orders.', categoryId: 'rfq_quotation', categoryLabel: 'RFQ and Quotation Reports' },
  { id: 'po-register', title: 'Purchase Order Register', description: 'Full purchase order register with vendor and totals.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-open', title: 'Open Purchase Orders', description: 'Released and partially received POs with open quantity.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-pending-delivery', title: 'Pending Delivery Report', description: 'POs with pending delivery quantity and expected dates.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-overdue', title: 'Overdue Purchase Orders', description: 'Open POs past expected delivery with pending quantity.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-amendment', title: 'PO Amendment Report', description: 'Purchase orders with revision / amendment history.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-closure', title: 'PO Closure Report', description: 'Closed and cancelled purchase orders.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-item-wise', title: 'Item-wise Purchase Report', description: 'Purchase order lines aggregated by item.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'po-vendor-wise', title: 'Vendor-wise Purchase Report', description: 'Purchase order totals aggregated by vendor.', categoryId: 'purchase_order', categoryLabel: 'Purchase Order Reports' },
  { id: 'grn-register', title: 'GRN Register', description: 'Goods receipt notes with PO link and quantities.', categoryId: 'receipt_quality', categoryLabel: 'Receipt and Quality Reports' },
  { id: 'grn-pending-inspection', title: 'Pending Inspection Report', description: 'GRNs awaiting quality inspection.', categoryId: 'receipt_quality', categoryLabel: 'Receipt and Quality Reports' },
  { id: 'grn-rejection', title: 'Rejection Report', description: 'Receipt lines with rejected quantity.', categoryId: 'receipt_quality', categoryLabel: 'Receipt and Quality Reports' },
  { id: 'grn-shortage-excess', title: 'Shortage and Excess Report', description: 'Receipt quantity variances vs PO pending.', categoryId: 'receipt_quality', categoryLabel: 'Receipt and Quality Reports' },
  { id: 'grn-batch-receipt', title: 'Batch Receipt Report', description: 'Batch / lot numbers received on GRN lines.', categoryId: 'receipt_quality', categoryLabel: 'Receipt and Quality Reports' },
  { id: 'grn-quality-performance', title: 'Quality Performance Report', description: 'Acceptance vs rejection performance by vendor / item.', categoryId: 'receipt_quality', categoryLabel: 'Receipt and Quality Reports' },
  { id: 'inv-register', title: 'Purchase Invoice Register', description: 'Vendor invoices with match and approval status.', categoryId: 'invoice', categoryLabel: 'Invoice Reports' },
  { id: 'inv-matching', title: 'Invoice Matching Report', description: 'Three-way match status for purchase invoices.', categoryId: 'invoice', categoryLabel: 'Invoice Reports' },
  { id: 'inv-pending-approval', title: 'Pending Invoice Approval', description: 'Invoices waiting for verification or approval.', categoryId: 'invoice', categoryLabel: 'Invoice Reports' },
  { id: 'inv-vendor-outstanding', title: 'Vendor Outstanding', description: 'Accounts payable outstanding by vendor.', categoryId: 'invoice', categoryLabel: 'Invoice Reports', isPlaceholder: true },
  { id: 'inv-gst-register', title: 'GST Purchase Register', description: 'Taxable value and GST components on purchase invoices.', categoryId: 'invoice', categoryLabel: 'Invoice Reports' },
  { id: 'inv-itc', title: 'Input Tax Credit Report', description: 'ITC claim status for purchase GST.', categoryId: 'invoice', categoryLabel: 'Invoice Reports', isPlaceholder: true },
  { id: 'vendor-performance', title: 'Vendor Performance', description: 'Composite score from delivery, quality, and spend.', categoryId: 'vendor', categoryLabel: 'Vendor Reports' },
  { id: 'vendor-delivery', title: 'Vendor Delivery Performance', description: 'On-time delivery metrics by vendor.', categoryId: 'vendor', categoryLabel: 'Vendor Reports' },
  { id: 'vendor-quality', title: 'Vendor Quality Rating', description: 'Acceptance rate and rejection qty by vendor.', categoryId: 'vendor', categoryLabel: 'Vendor Reports' },
  { id: 'vendor-price-variance', title: 'Vendor Price Variance', description: 'Quoted vs ordered rate variance by item / vendor.', categoryId: 'vendor', categoryLabel: 'Vendor Reports' },
  { id: 'vendor-purchase-history', title: 'Vendor Purchase History', description: 'Historical POs and spend by vendor.', categoryId: 'vendor', categoryLabel: 'Vendor Reports' },
  { id: 'vendor-rejection', title: 'Vendor Rejection Analysis', description: 'Rejection quantities and reasons by vendor.', categoryId: 'vendor', categoryLabel: 'Vendor Reports' },
]

const CATEGORY_META: Array<{ id: PurchaseReportCatalogEntry['categoryId']; label: string; description: string }> = [
  { id: 'requisition', label: 'Requisition Reports', description: 'PR register, ageing, department spend, and conversion.' },
  { id: 'rfq_quotation', label: 'RFQ and Quotation Reports', description: 'RFQ lifecycle, vendor responses, and price comparison.' },
  { id: 'purchase_order', label: 'Purchase Order Reports', description: 'PO register, open/overdue, amendments, and item/vendor spend.' },
  { id: 'receipt_quality', label: 'Receipt and Quality Reports', description: 'GRN register, inspection, rejection, and batch receipt.' },
  { id: 'invoice', label: 'Invoice Reports', description: 'Invoice register, matching, GST, and AP placeholders.' },
  { id: 'vendor', label: 'Vendor Reports', description: 'Performance, delivery, quality, price variance, and history.' },
]

function delay(ms = 40): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function inDateRange(isoDate: string, filters: PurchaseReportFilters): boolean {
  if (filters.dateFrom && isoDate < filters.dateFrom) return false
  if (filters.dateTo && isoDate > filters.dateTo) return false
  return true
}

function matchesSearch(haystack: string, search?: string): boolean {
  if (!search?.trim()) return true
  return haystack.toLowerCase().includes(search.trim().toLowerCase())
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

function money(n: number): number {
  return round2(n)
}

function masterVendorHref(vendorId: string | null | undefined): string | null {
  if (!vendorId) return null
  return `/purchase/masters/vendors/${vendorId}`
}

function summarizeCount(
  rows: PurchaseReportRow[],
  label = 'Records',
  extra?: PurchaseReportSummaryItem[],
): PurchaseReportSummaryItem[] {
  return [{ label, value: rows.length }, ...(extra ?? [])]
}

function filterByCommon(
  row: {
    date: string
    vendorId?: string | null
    locationId?: string | null
    department?: string | null
    status?: string | null
    itemIds?: string[]
    categories?: PurchaseItemCategory[]
    searchBlob: string
  },
  filters: PurchaseReportFilters,
): boolean {
  if (!inDateRange(row.date, filters)) return false
  if (filters.vendorId && row.vendorId !== filters.vendorId) return false
  if (filters.locationId && row.locationId !== filters.locationId) return false
  if (filters.department && row.department !== filters.department) return false
  if (filters.status && row.status !== filters.status) return false
  if (filters.itemId && !(row.itemIds ?? []).includes(filters.itemId)) return false
  if (filters.category && !(row.categories ?? []).includes(filters.category)) return false
  if (!matchesSearch(row.searchBlob, filters.search)) return false
  return true
}

export function getPurchaseReportCatalog(): PurchaseReportCategoryGroup[] {
  return CATEGORY_META.map((meta) => ({
    ...meta,
    reports: CATALOG.filter((r) => r.categoryId === meta.id),
  }))
}

export function getPurchaseReportEntry(reportId: string): PurchaseReportCatalogEntry | null {
  return CATALOG.find((r) => r.id === reportId) ?? null
}

export function isPurchaseReportId(value: string): value is PurchaseReportId {
  return CATALOG.some((r) => r.id === value)
}

export async function getPurchaseReportFilterOptions(
  reportId?: PurchaseReportId,
): Promise<PurchaseReportFilterOptions> {
  await delay()
  const [vendors, items, prs, orders, rfqs, grns, invoices] = await Promise.all([
    getVendors(),
    getPurchaseItems(),
    getPurchaseRequisitions(),
    getPurchaseOrders(),
    getRFQs(),
    getGRNs(),
    getPurchaseInvoices(),
  ])

  const locationMap = new Map<string, string>()
  for (const row of [...prs, ...orders, ...rfqs, ...grns, ...invoices]) {
    const loc = 'location' in row ? row.location : null
    if (loc) locationMap.set(loc.id, loc.name)
  }

  const departments = new Set<string>()
  for (const row of [...prs, ...orders, ...rfqs, ...invoices]) {
    if ('department' in row && row.department) departments.add(row.department)
  }

  return {
    vendors: vendors.map((v) => ({ id: v.id, name: v.vendorName })),
    items: items.map((i) => ({ id: i.id, code: i.itemCode, name: i.itemName, category: i.category })),
    locations: [...locationMap.entries()].map(([id, name]) => ({ id, name })),
    departments: [...departments].sort(),
    categories: (Object.keys(CATEGORY_LABELS) as PurchaseItemCategory[]).map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
    })),
    statuses: statusOptionsFor(reportId),
  }
}

function statusEntries(labels: Record<string, string>): Array<{ value: string; label: string }> {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

function statusOptionsFor(reportId?: PurchaseReportId): Array<{ value: string; label: string }> {
  if (!reportId) return []
  if (reportId.startsWith('pr-')) return statusEntries(PURCHASE_REQUISITION_STATUS_LABELS)
  if (reportId.startsWith('rfq-')) return statusEntries(RFQ_DOMAIN_STATUS_LABELS)
  if (reportId.startsWith('po-') || reportId.startsWith('vendor-')) {
    return statusEntries(PURCHASE_ORDER_DOMAIN_STATUS_LABELS)
  }
  if (reportId.startsWith('grn-')) return statusEntries(GRN_DOMAIN_STATUS_LABELS)
  if (reportId.startsWith('inv-')) return statusEntries(PURCHASE_INVOICE_STATUS_LABELS)
  return []
}

function placeholderResult(
  entry: PurchaseReportCatalogEntry,
  filters: PurchaseReportFilters,
  message: string,
): PurchaseReportResult {
  return {
    reportId: entry.id,
    title: entry.title,
    description: entry.description,
    categoryLabel: entry.categoryLabel,
    isPlaceholder: true,
    placeholderMessage: message,
    columns: [
      { key: 'note', label: 'Status' },
      { key: 'detail', label: 'Detail' },
    ],
    rows: [],
    summary: [{ label: 'Records', value: 0 }],
    filtersApplied: filters,
    generatedAt: new Date().toISOString(),
  }
}

function resultOf(
  entry: PurchaseReportCatalogEntry,
  filters: PurchaseReportFilters,
  columns: PurchaseReportColumn[],
  rows: PurchaseReportRow[],
  summary?: PurchaseReportSummaryItem[],
): PurchaseReportResult {
  return {
    reportId: entry.id,
    title: entry.title,
    description: entry.description,
    categoryLabel: entry.categoryLabel,
    isPlaceholder: false,
    columns,
    rows,
    summary: summary ?? summarizeCount(rows),
    filtersApplied: filters,
    generatedAt: new Date().toISOString(),
  }
}

export async function runPurchaseReport(
  reportId: PurchaseReportId,
  filters: PurchaseReportFilters = {},
): Promise<PurchaseReportResult> {
  await delay()
  const entry = getPurchaseReportEntry(reportId)
  if (!entry) throw new Error(`Unknown purchase report: ${reportId}`)

  if (entry.isPlaceholder) {
    return placeholderResult(
      entry,
      filters,
      entry.id === 'inv-vendor-outstanding'
        ? 'Vendor outstanding / AP integration is pending. Filter chrome is available for demo.'
        : 'Input Tax Credit (ITC) integration is pending. Filter chrome is available for demo.',
    )
  }

  switch (reportId) {
    case 'pr-register':
      return buildPrRegister(filters, entry)
    case 'pr-pending':
      return buildPrPending(filters, entry)
    case 'pr-ageing':
      return buildPrAgeing(filters, entry)
    case 'pr-department-wise':
      return buildPrDepartmentWise(filters, entry)
    case 'pr-to-po-conversion':
      return buildPrToPoConversion(filters, entry)
    case 'rfq-register':
      return buildRfqRegister(filters, entry)
    case 'rfq-vendor-response':
      return buildRfqVendorResponse(filters, entry)
    case 'rfq-quotation-comparison':
      return buildRfqQuotationComparison(filters, entry)
    case 'rfq-price-comparison':
      return buildRfqPriceComparison(filters, entry)
    case 'rfq-conversion':
      return buildRfqConversion(filters, entry)
    case 'po-register':
      return buildPoRegister(filters, entry)
    case 'po-open':
      return buildPoOpen(filters, entry)
    case 'po-pending-delivery':
      return buildPoPendingDelivery(filters, entry)
    case 'po-overdue':
      return buildPoOverdue(filters, entry)
    case 'po-amendment':
      return buildPoAmendment(filters, entry)
    case 'po-closure':
      return buildPoClosure(filters, entry)
    case 'po-item-wise':
      return buildPoItemWise(filters, entry)
    case 'po-vendor-wise':
      return buildPoVendorWise(filters, entry)
    case 'grn-register':
      return buildGrnRegister(filters, entry)
    case 'grn-pending-inspection':
      return buildGrnPendingInspection(filters, entry)
    case 'grn-rejection':
    case 'vendor-rejection':
      return buildGrnRejection(filters, entry)
    case 'grn-shortage-excess':
      return buildGrnShortageExcess(filters, entry)
    case 'grn-batch-receipt':
      return buildGrnBatchReceipt(filters, entry)
    case 'grn-quality-performance':
    case 'vendor-quality':
      return buildGrnQualityPerformance(filters, entry)
    case 'inv-register':
      return buildInvRegister(filters, entry)
    case 'inv-matching':
      return buildInvMatching(filters, entry)
    case 'inv-pending-approval':
      return buildInvPendingApproval(filters, entry)
    case 'inv-gst-register':
      return buildInvGstRegister(filters, entry)
    case 'vendor-performance':
      return buildVendorPerformance(filters, entry)
    case 'vendor-delivery':
      return buildVendorDelivery(filters, entry)
    case 'vendor-price-variance':
      return buildVendorPriceVariance(filters, entry)
    case 'vendor-purchase-history':
      return buildVendorPurchaseHistory(filters, entry)
    default:
      return placeholderResult(entry, filters, 'Report not implemented.')
  }
}

/* ---- helpers: entity filters ---- */

async function filteredRequisitions(filters: PurchaseReportFilters): Promise<PurchaseRequisitionListRow[]> {
  const list = await getPurchaseRequisitions()
  return list.filter((pr) =>
    filterByCommon(
      {
        date: pr.documentDate,
        vendorId: pr.vendor?.id ?? null,
        locationId: pr.location.id,
        department: pr.department,
        status: pr.status,
        itemIds: pr.lines.map((l) => l.itemId),
        categories: pr.lines.map((l) => l.category),
        searchBlob: [pr.documentNumber, pr.department, pr.requester.name, pr.status, pr.remarks]
          .filter(Boolean)
          .join(' '),
      },
      filters,
    ),
  )
}

async function filteredRfqs(filters: PurchaseReportFilters): Promise<RequestForQuotation[]> {
  const list = await getRFQs()
  return list.filter((rfq) =>
    filterByCommon(
      {
        date: rfq.documentDate,
        vendorId: filters.vendorId
          ? rfq.vendors.some((v) => v.vendorId === filters.vendorId)
            ? filters.vendorId
            : '__no__'
          : null,
        locationId: rfq.location.id,
        department: rfq.department,
        status: rfq.status,
        itemIds: rfq.lines.map((l) => l.itemId),
        categories: [],
        searchBlob: [
          rfq.documentNumber,
          rfq.department,
          rfq.status,
          ...(rfq.itemSummaries ?? []).map((i) => `${i.itemCode} ${i.itemName}`),
        ]
          .filter(Boolean)
          .join(' '),
      },
      filters,
    ),
  )
}

async function filteredOrders(filters: PurchaseReportFilters): Promise<PurchaseOrder[]> {
  const list = await getPurchaseOrders()
  return list.filter((po) =>
    filterByCommon(
      {
        date: po.documentDate,
        vendorId: po.vendor.id,
        locationId: po.location.id,
        department: po.department,
        status: po.status,
        itemIds: po.lines.map((l) => l.itemId),
        categories: po.lines.map((l) => l.category),
        searchBlob: [po.documentNumber, po.vendor.name, po.vendor.gstin, po.department, po.status].join(' '),
      },
      filters,
    ),
  )
}

async function filteredGrns(filters: PurchaseReportFilters): Promise<GoodsReceiptNote[]> {
  const list = await getGRNs()
  return list.filter((grn) =>
    filterByCommon(
      {
        date: grn.documentDate,
        vendorId: grn.vendor.id,
        locationId: grn.location?.id ?? null,
        department: null,
        status: grn.status,
        itemIds: grn.lines.map((l) => l.itemId),
        categories: [],
        searchBlob: [grn.documentNumber, grn.purchaseOrderNumber, grn.vendor.name, grn.warehouseName].join(' '),
      },
      { ...filters, department: undefined },
    ),
  )
}

async function filteredInvoices(filters: PurchaseReportFilters): Promise<PurchaseInvoice[]> {
  const list = await getPurchaseInvoices()
  return list.filter((inv) =>
    filterByCommon(
      {
        date: inv.documentDate,
        vendorId: inv.vendor.id,
        locationId: inv.location.id,
        department: inv.department,
        status: inv.status,
        itemIds: inv.lines.map((l) => l.itemId),
        categories: [],
        searchBlob: [inv.documentNumber, inv.vendorInvoiceNumber, inv.vendor.name, inv.purchaseOrderNumber ?? ''].join(' '),
      },
      filters,
    ),
  )
}

function invoiceHref(id: string): string {
  return `/purchase/reports/inv-register?focus=${encodeURIComponent(id)}`
}

function qiHref(grn: GoodsReceiptNote): string {
  if (grn.qualityInspectionId) {
    return `/purchase/quality-inspections/${grn.qualityInspectionId}`
  }
  return `/purchase/grn/${grn.id}`
}

/* ---- Requisition builders ---- */

async function buildPrRegister(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredRequisitions(filters)).map((pr) => ({
    documentNumber: pr.documentNumber,
    documentHref: `/purchase/requisitions/${pr.id}`,
    documentDate: pr.documentDate,
    department: pr.department,
    requester: pr.requester.name,
    location: pr.location.name,
    priority: PURCHASE_REQUISITION_PRIORITY_LABELS[pr.priority],
    status: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
    lineCount: pr.lines.length,
    totalAmount: money(pr.totalAmount),
  }))
  const total = money(rows.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PR No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'department', label: 'Department' },
    { key: 'requester', label: 'Requester' },
    { key: 'location', label: 'Location' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'lineCount', label: 'Lines', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows, summarizeCount(rows, 'PRs', [{ label: 'Total Value', value: total }]))
}

async function buildPrPending(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const pending = (await filteredRequisitions(filters)).filter((pr) =>
    filters.status ? true : pr.status === 'draft' || pr.status === 'pending_approval',
  )
  const rows: PurchaseReportRow[] = pending.map((pr) => ({
    documentNumber: pr.documentNumber,
    documentHref: `/purchase/requisitions/${pr.id}`,
    documentDate: pr.documentDate,
    department: pr.department,
    status: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
    daysOpen: daysBetween(pr.documentDate, todayIso()),
    totalAmount: money(pr.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PR No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'daysOpen', label: 'Days Open', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPrAgeing(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const open = (await filteredRequisitions(filters)).filter((pr) =>
    ['draft', 'pending_approval', 'approved'].includes(pr.status),
  )
  const rows: PurchaseReportRow[] = open.map((pr) => {
    const age = daysBetween(pr.documentDate, todayIso())
    const bucket = age <= 3 ? '0–3' : age <= 7 ? '4–7' : age <= 15 ? '8–15' : '16+'
    return {
      documentNumber: pr.documentNumber,
      documentHref: `/purchase/requisitions/${pr.id}`,
      department: pr.department,
      status: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
      ageDays: age,
      ageingBucket: bucket,
      totalAmount: money(pr.totalAmount),
    }
  })
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PR No', hrefKey: 'documentHref' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'ageDays', label: 'Age (Days)', align: 'right', format: 'number' },
    { key: 'ageingBucket', label: 'Bucket' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPrDepartmentWise(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const list = await filteredRequisitions(filters)
  const map = new Map<string, { count: number; value: number; pending: number }>()
  for (const pr of list) {
    const cur = map.get(pr.department) ?? { count: 0, value: 0, pending: 0 }
    cur.count += 1
    cur.value += pr.totalAmount
    if (pr.status === 'draft' || pr.status === 'pending_approval') cur.pending += 1
    map.set(pr.department, cur)
  }
  const rows: PurchaseReportRow[] = [...map.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([department, agg]) => ({
      department,
      prCount: agg.count,
      pendingCount: agg.pending,
      totalAmount: money(agg.value),
    }))
  return resultOf(entry, filters, [
    { key: 'department', label: 'Department' },
    { key: 'prCount', label: 'PR Count', align: 'right', format: 'number' },
    { key: 'pendingCount', label: 'Pending', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPrToPoConversion(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredRequisitions(filters)).map((pr) => ({
    documentNumber: pr.documentNumber,
    documentHref: `/purchase/requisitions/${pr.id}`,
    documentDate: pr.documentDate,
    status: PURCHASE_REQUISITION_STATUS_LABELS[pr.status],
    convertedPo: pr.convertedPoNumber ?? '—',
    convertedPoHref: pr.convertedPoId ? `/purchase/orders/${pr.convertedPoId}` : null,
    convertedRfq: pr.convertedRfqNumber ?? '—',
    convertedRfqHref: pr.convertedRfqId ? `/purchase/rfqs/${pr.convertedRfqId}` : null,
    conversion:
      pr.status === 'converted_to_po'
        ? 'Converted to PO'
        : pr.status === 'converted_to_rfq'
          ? 'Converted to RFQ'
          : 'Not converted',
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PR No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'status', label: 'Status' },
    { key: 'conversion', label: 'Conversion' },
    { key: 'convertedRfq', label: 'RFQ', hrefKey: 'convertedRfqHref' },
    { key: 'convertedPo', label: 'PO', hrefKey: 'convertedPoHref' },
  ], rows)
}

/* ---- RFQ builders ---- */

async function buildRfqRegister(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredRfqs(filters)).map((rfq) => ({
    documentNumber: rfq.documentNumber,
    documentHref: `/purchase/rfqs/${rfq.id}`,
    documentDate: rfq.documentDate,
    department: rfq.department,
    location: rfq.location.name,
    vendorCount: rfq.vendors.length,
    lineCount: rfq.lines.length,
    status: RFQ_DOMAIN_STATUS_LABELS[rfq.status],
    estimatedValue: money(rfq.estimatedValue ?? 0),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'RFQ No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'department', label: 'Department' },
    { key: 'location', label: 'Location' },
    { key: 'vendorCount', label: 'Vendors', align: 'right', format: 'number' },
    { key: 'lineCount', label: 'Lines', align: 'right', format: 'number' },
    { key: 'status', label: 'Status' },
    { key: 'estimatedValue', label: 'Est. Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildRfqVendorResponse(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = []
  for (const rfq of await filteredRfqs(filters)) {
    for (const v of rfq.vendors) {
      if (filters.vendorId && v.vendorId !== filters.vendorId) continue
      rows.push({
        documentNumber: rfq.documentNumber,
        documentHref: `/purchase/rfqs/${rfq.id}`,
        vendorName: v.vendorName,
        vendorHref: masterVendorHref(v.vendorId),
        inviteStatus: RFQ_VENDOR_INVITE_STATUS_LABELS[v.status],
        quoted: v.status === 'quoted' ? 'Yes' : 'No',
        vendorRating: v.vendorRating,
      })
    }
  }
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'RFQ No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'inviteStatus', label: 'Invite Status' },
    { key: 'quoted', label: 'Responded' },
    { key: 'vendorRating', label: 'Rating', align: 'right', format: 'number' },
  ], rows)
}

async function buildRfqQuotationComparison(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const [rfqs, quotes] = await Promise.all([filteredRfqs(filters), getVendorQuotations()])
  const rfqIds = new Set(rfqs.map((r) => r.id))
  const rows: PurchaseReportRow[] = quotes
    .filter((q) => rfqIds.has(q.rfqId))
    .filter((q) =>
      filterByCommon(
        {
          date: q.documentDate,
          vendorId: q.vendor.id,
          locationId: null,
          department: null,
          status: q.status,
          itemIds: q.lines.map((l) => l.itemId),
          categories: [],
          searchBlob: [q.documentNumber, q.rfqNumber, q.vendor.name].join(' '),
        },
        { ...filters, locationId: undefined, department: undefined },
      ),
    )
    .map((q) => ({
      documentNumber: q.documentNumber,
      documentHref: `/purchase/vendor-quotations/${q.id}`,
      rfqNumber: q.rfqNumber,
      rfqHref: `/purchase/rfqs/${q.rfqId}`,
      vendorName: q.vendor.name,
      vendorHref: masterVendorHref(q.vendor.id),
      totalAmount: money(q.totalAmount),
      comparisonHref: `/purchase/comparison/${q.rfqId}`,
      comparison: 'Open comparison',
    }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'VQ No', hrefKey: 'documentHref' },
    { key: 'rfqNumber', label: 'RFQ', hrefKey: 'rfqHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'totalAmount', label: 'Quoted Value', align: 'right', format: 'currency' },
    { key: 'comparison', label: 'Comparison', hrefKey: 'comparisonHref' },
  ], rows)
}

async function buildRfqPriceComparison(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const quotes = await getVendorQuotations()
  const rows: PurchaseReportRow[] = []
  for (const q of quotes) {
    if (!inDateRange(q.documentDate, filters)) continue
    if (filters.vendorId && q.vendor.id !== filters.vendorId) continue
    for (const line of q.lines) {
      if (filters.itemId && line.itemId !== filters.itemId) continue
      const blob = [q.documentNumber, q.rfqNumber, q.vendor.name, line.itemCode, line.itemName].join(' ')
      if (!matchesSearch(blob, filters.search)) continue
      rows.push({
        rfqNumber: q.rfqNumber,
        rfqHref: `/purchase/rfqs/${q.rfqId}`,
        vqNumber: q.documentNumber,
        vqHref: `/purchase/vendor-quotations/${q.id}`,
        vendorName: q.vendor.name,
        vendorHref: masterVendorHref(q.vendor.id),
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: line.quantity,
        rate: money(line.rate),
        lineTotal: money(line.lineTotal),
      })
    }
  }
  return resultOf(entry, filters, [
    { key: 'rfqNumber', label: 'RFQ', hrefKey: 'rfqHref' },
    { key: 'vqNumber', label: 'VQ', hrefKey: 'vqHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'itemCode', label: 'Item' },
    { key: 'itemName', label: 'Description' },
    { key: 'quantity', label: 'Qty', align: 'right', format: 'number' },
    { key: 'rate', label: 'Rate', align: 'right', format: 'currency' },
    { key: 'lineTotal', label: 'Line Total', align: 'right', format: 'currency' },
  ], rows)
}

async function buildRfqConversion(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const [rfqs, orders] = await Promise.all([filteredRfqs(filters), getPurchaseOrders()])
  const rows: PurchaseReportRow[] = rfqs.map((rfq) => {
    const po = orders.find((o) => o.rfqId === rfq.id)
    return {
      documentNumber: rfq.documentNumber,
      documentHref: `/purchase/rfqs/${rfq.id}`,
      status: RFQ_DOMAIN_STATUS_LABELS[rfq.status],
      conversion: po ? 'Converted to PO' : 'Pending',
      poNumber: po?.documentNumber ?? '—',
      poHref: po ? `/purchase/orders/${po.id}` : null,
    }
  })
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'RFQ No', hrefKey: 'documentHref' },
    { key: 'status', label: 'Status' },
    { key: 'conversion', label: 'Conversion' },
    { key: 'poNumber', label: 'PO', hrefKey: 'poHref' },
  ], rows)
}

/* ---- PO builders ---- */

async function buildPoRegister(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredOrders(filters)).map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    documentDate: po.documentDate,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    location: po.location.name,
    expectedDeliveryDate: po.expectedDeliveryDate,
    status: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
    totalAmount: money(po.totalAmount),
    revisionNo: po.revisionNo,
  }))
  const total = money(rows.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'location', label: 'Location' },
    { key: 'expectedDeliveryDate', label: 'Expected', format: 'date' },
    { key: 'status', label: 'Status' },
    { key: 'revisionNo', label: 'Rev', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows, summarizeCount(rows, 'POs', [{ label: 'Total Value', value: total }]))
}

async function buildPoOpen(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const open = (await filteredOrders(filters)).filter((po) =>
    ['released', 'partially_received', 'approved'].includes(po.status),
  )
  const rows: PurchaseReportRow[] = open.map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    status: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
    pendingQty: round2(po.lines.reduce((s, l) => s + l.pendingQty, 0)),
    expectedDeliveryDate: po.expectedDeliveryDate,
    totalAmount: money(po.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'status', label: 'Status' },
    { key: 'pendingQty', label: 'Pending Qty', align: 'right', format: 'number' },
    { key: 'expectedDeliveryDate', label: 'Expected', format: 'date' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPoPendingDelivery(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const list = (await filteredOrders(filters)).filter((po) => po.lines.some((l) => l.pendingQty > 0))
  const rows: PurchaseReportRow[] = list.map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    pendingQty: round2(po.lines.reduce((s, l) => s + l.pendingQty, 0)),
    expectedDeliveryDate: po.expectedDeliveryDate,
    daysToDue: daysBetween(todayIso(), po.expectedDeliveryDate),
    status: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'pendingQty', label: 'Pending Qty', align: 'right', format: 'number' },
    { key: 'expectedDeliveryDate', label: 'Expected', format: 'date' },
    { key: 'daysToDue', label: 'Days to Due', align: 'right', format: 'number' },
    { key: 'status', label: 'Status' },
  ], rows)
}

async function buildPoOverdue(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const today = todayIso()
  const list = (await filteredOrders(filters)).filter(
    (po) =>
      po.expectedDeliveryDate < today &&
      po.lines.some((l) => l.pendingQty > 0) &&
      !['closed', 'cancelled', 'fully_received', 'invoiced'].includes(po.status),
  )
  const rows: PurchaseReportRow[] = list.map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    expectedDeliveryDate: po.expectedDeliveryDate,
    daysOverdue: daysBetween(po.expectedDeliveryDate, today),
    pendingQty: round2(po.lines.reduce((s, l) => s + l.pendingQty, 0)),
    totalAmount: money(po.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'expectedDeliveryDate', label: 'Expected', format: 'date' },
    { key: 'daysOverdue', label: 'Days Overdue', align: 'right', format: 'number' },
    { key: 'pendingQty', label: 'Pending Qty', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPoAmendment(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const list = (await filteredOrders(filters)).filter((po) => po.revisionNo > 0 || po.changeHistory.length > 0)
  const rows: PurchaseReportRow[] = list.map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    revisionNo: po.revisionNo,
    changeCount: po.changeHistory.length,
    lastChange: po.changeHistory[0]?.fieldLabel ?? '—',
    status: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'revisionNo', label: 'Revision', align: 'right', format: 'number' },
    { key: 'changeCount', label: 'Changes', align: 'right', format: 'number' },
    { key: 'lastChange', label: 'Last Change' },
    { key: 'status', label: 'Status' },
  ], rows)
}

async function buildPoClosure(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const list = (await filteredOrders(filters)).filter((po) => ['closed', 'cancelled'].includes(po.status))
  const rows: PurchaseReportRow[] = list.map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    status: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
    closedAt: po.closedAt?.slice(0, 10) ?? po.cancelledAt?.slice(0, 10) ?? '—',
    totalAmount: money(po.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'status', label: 'Status' },
    { key: 'closedAt', label: 'Closed / Cancelled', format: 'date' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPoItemWise(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const orders = await filteredOrders(filters)
  const map = new Map<string, { itemCode: string; itemName: string; category: string; qty: number; value: number; poCount: number }>()
  for (const po of orders) {
    const seen = new Set<string>()
    for (const line of po.lines) {
      if (filters.itemId && line.itemId !== filters.itemId) continue
      if (filters.category && line.category !== filters.category) continue
      const cur = map.get(line.itemId) ?? {
        itemCode: line.itemCode,
        itemName: line.itemName,
        category: CATEGORY_LABELS[line.category] ?? line.category,
        qty: 0,
        value: 0,
        poCount: 0,
      }
      cur.qty += line.quantity
      cur.value += line.lineTotal
      if (!seen.has(line.itemId)) {
        cur.poCount += 1
        seen.add(line.itemId)
      }
      map.set(line.itemId, cur)
    }
  }
  const rows: PurchaseReportRow[] = [...map.values()]
    .sort((a, b) => b.value - a.value)
    .map((r) => ({
      itemCode: r.itemCode,
      itemName: r.itemName,
      category: r.category,
      quantity: round2(r.qty),
      poCount: r.poCount,
      totalAmount: money(r.value),
    }))
  return resultOf(entry, filters, [
    { key: 'itemCode', label: 'Item Code' },
    { key: 'itemName', label: 'Item Name' },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Qty', align: 'right', format: 'number' },
    { key: 'poCount', label: 'PO Count', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildPoVendorWise(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const orders = await filteredOrders(filters)
  const map = new Map<string, { vendorName: string; vendorId: string; poCount: number; value: number; openCount: number }>()
  for (const po of orders) {
    const cur = map.get(po.vendor.id) ?? {
      vendorName: po.vendor.name,
      vendorId: po.vendor.id,
      poCount: 0,
      value: 0,
      openCount: 0,
    }
    cur.poCount += 1
    cur.value += po.totalAmount
    if (['released', 'partially_received', 'approved'].includes(po.status)) cur.openCount += 1
    map.set(po.vendor.id, cur)
  }
  const rows: PurchaseReportRow[] = [...map.values()]
    .sort((a, b) => b.value - a.value)
    .map((r) => ({
      vendorName: r.vendorName,
      vendorHref: masterVendorHref(r.vendorId),
      poCount: r.poCount,
      openCount: r.openCount,
      totalAmount: money(r.value),
    }))
  return resultOf(entry, filters, [
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'poCount', label: 'PO Count', align: 'right', format: 'number' },
    { key: 'openCount', label: 'Open', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

/* ---- GRN / Quality ---- */

async function buildGrnRegister(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredGrns(filters)).map((grn) => ({
    documentNumber: grn.documentNumber,
    documentHref: `/purchase/grn/${grn.id}`,
    documentDate: grn.documentDate,
    poNumber: grn.purchaseOrderNumber,
    poHref: `/purchase/orders/${grn.purchaseOrderId}`,
    vendorName: grn.vendor.name,
    vendorHref: masterVendorHref(grn.vendor.id),
    warehouse: grn.warehouseName,
    status: GRN_DOMAIN_STATUS_LABELS[grn.status],
    receivedQty: round2(grn.lines.reduce((s, l) => s + l.receivedQty, 0)),
    acceptedQty: round2(grn.lines.reduce((s, l) => s + l.acceptedQty, 0)),
    rejectedQty: round2(grn.lines.reduce((s, l) => s + l.rejectedQty, 0)),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'GRN No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'poNumber', label: 'PO', hrefKey: 'poHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'status', label: 'Status' },
    { key: 'receivedQty', label: 'Received', align: 'right', format: 'number' },
    { key: 'acceptedQty', label: 'Accepted', align: 'right', format: 'number' },
    { key: 'rejectedQty', label: 'Rejected', align: 'right', format: 'number' },
  ], rows)
}

async function buildGrnPendingInspection(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const list = (await filteredGrns(filters)).filter(
    (g) => g.status === 'pending_inspection' || (g.inspectionRequired && !g.qualityInspectionId),
  )
  const rows: PurchaseReportRow[] = list.map((grn) => ({
    documentNumber: grn.documentNumber,
    documentHref: `/purchase/grn/${grn.id}`,
    qiNumber: grn.qualityInspectionId ? 'QI linked' : 'Pending',
    qiHref: qiHref(grn),
    vendorName: grn.vendor.name,
    vendorHref: masterVendorHref(grn.vendor.id),
    poNumber: grn.purchaseOrderNumber,
    poHref: `/purchase/orders/${grn.purchaseOrderId}`,
    status: GRN_DOMAIN_STATUS_LABELS[grn.status],
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'GRN No', hrefKey: 'documentHref' },
    { key: 'qiNumber', label: 'Inspection', hrefKey: 'qiHref' },
    { key: 'poNumber', label: 'PO', hrefKey: 'poHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'status', label: 'Status' },
  ], rows)
}

async function buildGrnRejection(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = []
  for (const grn of await filteredGrns(filters)) {
    for (const line of grn.lines) {
      if (line.rejectedQty <= 0) continue
      if (filters.itemId && line.itemId !== filters.itemId) continue
      rows.push({
        documentNumber: grn.documentNumber,
        documentHref: `/purchase/grn/${grn.id}`,
        poNumber: grn.purchaseOrderNumber,
        poHref: `/purchase/orders/${grn.purchaseOrderId}`,
        vendorName: grn.vendor.name,
        vendorHref: masterVendorHref(grn.vendor.id),
        itemCode: line.itemCode,
        itemName: line.itemName,
        rejectedQty: round2(line.rejectedQty),
        receivedQty: round2(line.receivedQty),
      })
    }
  }
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'GRN No', hrefKey: 'documentHref' },
    { key: 'poNumber', label: 'PO', hrefKey: 'poHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'itemCode', label: 'Item' },
    { key: 'itemName', label: 'Description' },
    { key: 'receivedQty', label: 'Received', align: 'right', format: 'number' },
    { key: 'rejectedQty', label: 'Rejected', align: 'right', format: 'number' },
  ], rows)
}

async function buildGrnShortageExcess(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = []
  for (const grn of await filteredGrns(filters)) {
    for (const line of grn.lines) {
      const shortQty = line.shortQty ?? 0
      const excessQty = line.excessQty ?? 0
      if (shortQty <= 0 && excessQty <= 0) continue
      if (filters.itemId && line.itemId !== filters.itemId) continue
      rows.push({
        documentNumber: grn.documentNumber,
        documentHref: `/purchase/grn/${grn.id}`,
        itemCode: line.itemCode,
        itemName: line.itemName,
        shortQty: round2(shortQty),
        excessQty: round2(excessQty),
        receivedQty: round2(line.receivedQty),
        vendorName: grn.vendor.name,
        vendorHref: masterVendorHref(grn.vendor.id),
      })
    }
  }
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'GRN No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'itemCode', label: 'Item' },
    { key: 'itemName', label: 'Description' },
    { key: 'receivedQty', label: 'Received', align: 'right', format: 'number' },
    { key: 'shortQty', label: 'Shortage', align: 'right', format: 'number' },
    { key: 'excessQty', label: 'Excess', align: 'right', format: 'number' },
  ], rows)
}

async function buildGrnBatchReceipt(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = []
  for (const grn of await filteredGrns(filters)) {
    for (const line of grn.lines) {
      const batch = line.batchNumber || line.lotNumber
      if (!batch) continue
      if (filters.itemId && line.itemId !== filters.itemId) continue
      rows.push({
        documentNumber: grn.documentNumber,
        documentHref: `/purchase/grn/${grn.id}`,
        itemCode: line.itemCode,
        itemName: line.itemName,
        batchNumber: line.batchNumber || '—',
        lotNumber: line.lotNumber || '—',
        receivedQty: round2(line.receivedQty),
        manufacturingDate: line.manufacturingDate ?? '—',
        expiryDate: line.expiryDate ?? '—',
      })
    }
  }
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'GRN No', hrefKey: 'documentHref' },
    { key: 'itemCode', label: 'Item' },
    { key: 'itemName', label: 'Description' },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'lotNumber', label: 'Lot' },
    { key: 'receivedQty', label: 'Qty', align: 'right', format: 'number' },
    { key: 'manufacturingDate', label: 'Mfg Date', format: 'date' },
    { key: 'expiryDate', label: 'Expiry', format: 'date' },
  ], rows)
}

async function buildGrnQualityPerformance(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const map = new Map<string, { vendorName: string; vendorId: string; received: number; accepted: number; rejected: number }>()
  for (const grn of await filteredGrns(filters)) {
    const cur = map.get(grn.vendor.id) ?? {
      vendorName: grn.vendor.name,
      vendorId: grn.vendor.id,
      received: 0,
      accepted: 0,
      rejected: 0,
    }
    for (const line of grn.lines) {
      cur.received += line.receivedQty
      cur.accepted += line.acceptedQty
      cur.rejected += line.rejectedQty
    }
    map.set(grn.vendor.id, cur)
  }
  const rows: PurchaseReportRow[] = [...map.values()].map((r) => ({
    vendorName: r.vendorName,
    vendorHref: masterVendorHref(r.vendorId),
    receivedQty: round2(r.received),
    acceptedQty: round2(r.accepted),
    rejectedQty: round2(r.rejected),
    acceptanceRate: r.received > 0 ? round2((r.accepted / r.received) * 100) : 0,
  }))
  return resultOf(entry, filters, [
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'receivedQty', label: 'Received', align: 'right', format: 'number' },
    { key: 'acceptedQty', label: 'Accepted', align: 'right', format: 'number' },
    { key: 'rejectedQty', label: 'Rejected', align: 'right', format: 'number' },
    { key: 'acceptanceRate', label: 'Acceptance %', align: 'right', format: 'number' },
  ], rows)
}

/* ---- Invoice ---- */

async function buildInvRegister(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredInvoices(filters)).map((inv) => ({
    documentNumber: inv.documentNumber,
    documentHref: invoiceHref(inv.id),
    documentDate: inv.documentDate,
    vendorInvoiceNumber: inv.vendorInvoiceNumber,
    vendorName: inv.vendor.name,
    vendorHref: masterVendorHref(inv.vendor.id),
    poNumber: inv.purchaseOrderNumber ?? '—',
    poHref: inv.purchaseOrderId ? `/purchase/orders/${inv.purchaseOrderId}` : null,
    status: PURCHASE_INVOICE_STATUS_LABELS[inv.status],
    matchStatus: inv.matchStatus,
    totalAmount: money(inv.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'Invoice No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'vendorInvoiceNumber', label: 'Vendor Inv' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'poNumber', label: 'PO', hrefKey: 'poHref' },
    { key: 'matchStatus', label: 'Match' },
    { key: 'status', label: 'Status' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildInvMatching(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredInvoices(filters)).map((inv) => ({
    documentNumber: inv.documentNumber,
    documentHref: invoiceHref(inv.id),
    vendorName: inv.vendor.name,
    vendorHref: masterVendorHref(inv.vendor.id),
    poNumber: inv.purchaseOrderNumber ?? '—',
    poHref: inv.purchaseOrderId ? `/purchase/orders/${inv.purchaseOrderId}` : null,
    grnNumber: inv.goodsReceiptNumber ?? '—',
    grnHref: inv.goodsReceiptId ? `/purchase/grn/${inv.goodsReceiptId}` : null,
    matchStatus: inv.matchStatus,
    status: PURCHASE_INVOICE_STATUS_LABELS[inv.status],
    totalAmount: money(inv.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'Invoice No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'poNumber', label: 'PO', hrefKey: 'poHref' },
    { key: 'grnNumber', label: 'GRN', hrefKey: 'grnHref' },
    { key: 'matchStatus', label: 'Match Status' },
    { key: 'status', label: 'Status' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildInvPendingApproval(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const list = (await filteredInvoices(filters)).filter((inv) =>
    ['draft', 'pending_verification', 'pending_approval', 'matched', 'mismatch'].includes(inv.status),
  )
  const rows: PurchaseReportRow[] = list.map((inv) => ({
    documentNumber: inv.documentNumber,
    documentHref: invoiceHref(inv.id),
    vendorName: inv.vendor.name,
    vendorHref: masterVendorHref(inv.vendor.id),
    status: PURCHASE_INVOICE_STATUS_LABELS[inv.status],
    matchStatus: inv.matchStatus,
    totalAmount: money(inv.totalAmount),
    daysOpen: daysBetween(inv.documentDate, todayIso()),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'Invoice No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'status', label: 'Status' },
    { key: 'matchStatus', label: 'Match' },
    { key: 'daysOpen', label: 'Days Open', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}

async function buildInvGstRegister(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredInvoices(filters)).map((inv) => ({
    documentNumber: inv.documentNumber,
    documentHref: invoiceHref(inv.id),
    documentDate: inv.documentDate,
    vendorName: inv.vendor.name,
    vendorHref: masterVendorHref(inv.vendor.id),
    vendorGstin: inv.vendor.gstin,
    taxableAmount: money(inv.taxableAmount),
    cgst: money(inv.cgst),
    sgst: money(inv.sgst),
    igst: money(inv.igst),
    totalAmount: money(inv.totalAmount),
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'Invoice No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'vendorGstin', label: 'GSTIN' },
    { key: 'taxableAmount', label: 'Taxable', align: 'right', format: 'currency' },
    { key: 'cgst', label: 'CGST', align: 'right', format: 'currency' },
    { key: 'sgst', label: 'SGST', align: 'right', format: 'currency' },
    { key: 'igst', label: 'IGST', align: 'right', format: 'currency' },
    { key: 'totalAmount', label: 'Total', align: 'right', format: 'currency' },
  ], rows)
}

/* ---- Vendor ---- */

async function buildVendorPerformance(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const [orders, grns, vendors] = await Promise.all([filteredOrders(filters), getGRNs(), getVendors()])
  const rows: PurchaseReportRow[] = vendors
    .filter((v) => !filters.vendorId || v.id === filters.vendorId)
    .map((v) => {
      const vendorOrders = orders.filter((o) => o.vendor.id === v.id)
      const vendorGrns = grns.filter((g) => g.vendor.id === v.id)
      let received = 0
      let accepted = 0
      for (const g of vendorGrns) {
        for (const l of g.lines) {
          received += l.receivedQty
          accepted += l.acceptedQty
        }
      }
      const spend = vendorOrders.reduce((s, o) => s + o.totalAmount, 0)
      const qualityScore =
        received > 0 ? round2((accepted / received) * 100) : v.qualityScore ?? 0
      const deliveryScore = v.deliveryScore ?? 0
      return {
        vendorName: v.vendorName,
        vendorHref: masterVendorHref(v.id),
        poCount: vendorOrders.length,
        totalAmount: money(spend),
        qualityScore,
        deliveryScore,
        compositeScore: round2((qualityScore + deliveryScore) / 2),
      }
    })
    .filter((r) => matchesSearch(String(r.vendorName), filters.search))
  return resultOf(entry, filters, [
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'poCount', label: 'PO Count', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Spend', align: 'right', format: 'currency' },
    { key: 'deliveryScore', label: 'Delivery Score', align: 'right', format: 'number' },
    { key: 'qualityScore', label: 'Quality %', align: 'right', format: 'number' },
    { key: 'compositeScore', label: 'Composite', align: 'right', format: 'number' },
  ], rows)
}

async function buildVendorDelivery(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const orders = await filteredOrders(filters)
  const today = todayIso()
  const map = new Map<string, { vendorName: string; vendorId: string; total: number; onTime: number; overdue: number }>()
  for (const po of orders) {
    const cur = map.get(po.vendor.id) ?? {
      vendorName: po.vendor.name,
      vendorId: po.vendor.id,
      total: 0,
      onTime: 0,
      overdue: 0,
    }
    cur.total += 1
    if (po.expectedDeliveryDate < today && po.lines.some((l) => l.pendingQty > 0)) cur.overdue += 1
    else cur.onTime += 1
    map.set(po.vendor.id, cur)
  }
  const rows: PurchaseReportRow[] = [...map.values()].map((r) => ({
    vendorName: r.vendorName,
    vendorHref: masterVendorHref(r.vendorId),
    poCount: r.total,
    onTimeCount: r.onTime,
    overdueCount: r.overdue,
    onTimePct: r.total > 0 ? round2((r.onTime / r.total) * 100) : 0,
  }))
  return resultOf(entry, filters, [
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'poCount', label: 'PO Count', align: 'right', format: 'number' },
    { key: 'onTimeCount', label: 'On Time', align: 'right', format: 'number' },
    { key: 'overdueCount', label: 'Overdue', align: 'right', format: 'number' },
    { key: 'onTimePct', label: 'On-time %', align: 'right', format: 'number' },
  ], rows)
}

async function buildVendorPriceVariance(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const [orders, quotes] = await Promise.all([filteredOrders(filters), getVendorQuotations()])
  const quoteRate = new Map<string, number>()
  for (const q of quotes) {
    for (const line of q.lines) quoteRate.set(`${q.vendor.id}:${line.itemId}`, line.rate)
  }
  const rows: PurchaseReportRow[] = []
  for (const po of orders) {
    for (const line of po.lines) {
      if (filters.itemId && line.itemId !== filters.itemId) continue
      const quoted = quoteRate.get(`${po.vendor.id}:${line.itemId}`)
      if (quoted == null) continue
      const variance = round2(line.rate - quoted)
      rows.push({
        documentNumber: po.documentNumber,
        documentHref: `/purchase/orders/${po.id}`,
        vendorName: po.vendor.name,
        vendorHref: masterVendorHref(po.vendor.id),
        itemCode: line.itemCode,
        itemName: line.itemName,
        quotedRate: money(quoted),
        poRate: money(line.rate),
        variance,
        variancePct: quoted !== 0 ? round2((variance / quoted) * 100) : 0,
      })
    }
  }
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'itemCode', label: 'Item' },
    { key: 'itemName', label: 'Description' },
    { key: 'quotedRate', label: 'Quoted', align: 'right', format: 'currency' },
    { key: 'poRate', label: 'PO Rate', align: 'right', format: 'currency' },
    { key: 'variance', label: 'Variance', align: 'right', format: 'currency' },
    { key: 'variancePct', label: 'Var %', align: 'right', format: 'number' },
  ], rows)
}

async function buildVendorPurchaseHistory(filters: PurchaseReportFilters, entry: PurchaseReportCatalogEntry) {
  const rows: PurchaseReportRow[] = (await filteredOrders(filters)).map((po) => ({
    documentNumber: po.documentNumber,
    documentHref: `/purchase/orders/${po.id}`,
    documentDate: po.documentDate,
    vendorName: po.vendor.name,
    vendorHref: masterVendorHref(po.vendor.id),
    status: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status],
    totalAmount: money(po.totalAmount),
    lineCount: po.lines.length,
  }))
  return resultOf(entry, filters, [
    { key: 'documentNumber', label: 'PO No', hrefKey: 'documentHref' },
    { key: 'documentDate', label: 'Date', format: 'date' },
    { key: 'vendorName', label: 'Vendor', hrefKey: 'vendorHref' },
    { key: 'status', label: 'Status' },
    { key: 'lineCount', label: 'Lines', align: 'right', format: 'number' },
    { key: 'totalAmount', label: 'Value', align: 'right', format: 'currency' },
  ], rows)
}
