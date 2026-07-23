/**
 * GST & TDS Compliance service — dual-mode.
 * Demo (`VITE_USE_API=false`): in-memory seed.
 * API (`VITE_USE_API=true`): live GST extract + e-invoice / e-way registers (simulated NIC).
 * Portal filing / challans / GSTR auto-submit remain demo preview only.
 */

import { isApiMode } from '@/config/apiConfig'
import {
  CALENDAR_SEED,
  EINVOICE_SEED,
  EWAY_SEED,
  GST_EXCEPTIONS_SEED,
  GST_RETURNS_SEED,
  GSTR2B_SEED,
  GSTIN_PROFILES,
  INWARD_SUPPLIES_SEED,
  ITC_RECON_SEED,
  NOTICES_SEED,
  OUTWARD_SUPPLIES_SEED,
  TAX_PERIODS,
  TAX_REPORTS_SEED,
  TAX_SETUP_SEED,
  TCS_SEED,
  TDS_CERTS_SEED,
  TDS_CHALLANS_SEED,
  TDS_RETURNS_SEED,
  TDS_TXNS_SEED,
  buildComplianceDashboard,
  buildGstDashboard,
} from '@/data/accounting/taxComplianceSeed'
import {
  cancelEInvoiceApi,
  cancelEWayBillApi,
  fetchEInvoices,
  fetchEWayBills,
  fetchGstComplianceSummary,
  fetchInwardSupplies,
  fetchOutwardSupplies,
  generateEInvoiceApi,
  generateEWayBillApi,
  type GenerateEWayBillPayload,
  type GstEInvoiceDto,
  type GstEWayBillDto,
  type GstSupplyExtractDto,
} from '@/services/api/taxComplianceApi'
import {
  filterDatesFromPeriod,
  resolveDefaultLegalEntity,
  resolvePeriod,
} from '@/services/accounting/taxComplianceApiComposer'
import type {
  ComplianceCalendarItem,
  ComplianceNotice,
  EInvoiceRow,
  EWayBillRow,
  GstExceptionRow,
  GstReturnPrep,
  GstSupplyRow,
  Gstr2bLine,
  GstinProfile,
  ItcMatchStatus,
  ItcReconRow,
  PeriodFilterState,
  TaxComplianceDashboard,
  TaxCompliancePeriod,
  TaxComplianceSetup,
  TaxReportCard,
  TcsRow,
  TdsCertificate,
  TdsChallan,
  TdsReturn,
  TdsTransaction,
  GstDashboardData,
} from '@/types/taxCompliance'

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))

export class TaxComplianceServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaxComplianceServiceError'
  }
}

let setupState: TaxComplianceSetup = structuredClone(TAX_SETUP_SEED)
let itcState: ItcReconRow[] = structuredClone(ITC_RECON_SEED)
let returnsState: GstReturnPrep[] = structuredClone(GST_RETURNS_SEED)
let tdsTxnState: TdsTransaction[] = structuredClone(TDS_TXNS_SEED)
let noticesState: ComplianceNotice[] = structuredClone(NOTICES_SEED)
let gstr2bImported = false

function money(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapSupplyType(raw: string | null): GstSupplyRow['supplyType'] {
  switch (raw) {
    case 'EXPORT':
      return 'Export'
    case 'SEZ':
      return 'SEZ'
    case 'NON_GST':
      return 'Exempt'
    case 'INTRA_STATE':
    case 'INTER_STATE':
    default:
      return 'B2B'
  }
}

function mapExtractRow(row: GstSupplyExtractDto, docType: string): GstSupplyRow {
  return {
    id: row.id,
    docType,
    docNo: row.documentNumber || row.id.slice(0, 8),
    docDate: row.documentDate,
    partyName: row.partyName,
    partyGstin: row.partyGstin ?? '',
    placeOfSupply: row.placeOfSupply ?? row.stateCode ?? '—',
    taxableValue: money(row.taxableAmount),
    cgst: money(row.cgstAmount),
    sgst: money(row.sgstAmount),
    igst: money(row.igstAmount),
    cess: money(row.cessAmount),
    totalTax: money(row.totalTaxAmount),
    invoiceTotal: money(row.totalAmount),
    hsnSac: '—',
    supplyType: mapSupplyType(row.supplyType),
    reverseCharge: row.reverseCharge,
    status: 'Open',
    notes: row.taxTreatment ?? undefined,
  }
}

export const DEFAULT_TAX_PERIOD_FILTER: PeriodFilterState = {
  periodKey: TAX_PERIODS[0].periodKey,
  gstinId: GSTIN_PROFILES.find((g) => g.isDefault)?.id ?? GSTIN_PROFILES[0].id,
}

const SESSION_FILTER_KEY = 'fos.taxCompliance.periodFilter'

export function loadPeriodFilter(): PeriodFilterState {
  try {
    const raw = sessionStorage.getItem(SESSION_FILTER_KEY)
    if (!raw) return { ...DEFAULT_TAX_PERIOD_FILTER }
    const parsed = JSON.parse(raw) as PeriodFilterState
    return {
      periodKey: parsed.periodKey || DEFAULT_TAX_PERIOD_FILTER.periodKey,
      gstinId: parsed.gstinId || DEFAULT_TAX_PERIOD_FILTER.gstinId,
    }
  } catch {
    return { ...DEFAULT_TAX_PERIOD_FILTER }
  }
}

export function savePeriodFilter(filter: PeriodFilterState): void {
  sessionStorage.setItem(SESSION_FILTER_KEY, JSON.stringify(filter))
}

export async function listTaxPeriods(): Promise<TaxCompliancePeriod[]> {
  await delay()
  return [...TAX_PERIODS]
}

export async function listGstins(): Promise<GstinProfile[]> {
  await delay()
  return setupState.gstins.map((g) => ({ ...g }))
}

export async function getTaxComplianceDashboard(filter?: PeriodFilterState): Promise<TaxComplianceDashboard> {
  const f = filter ?? loadPeriodFilter()
  if (!isApiMode()) {
    await delay()
    return buildComplianceDashboard(f.periodKey, f.gstinId)
  }

  const legalEntity = await resolveDefaultLegalEntity()
  const { fromDate, toDate } = filterDatesFromPeriod(f)
  const summaryRes = await fetchGstComplianceSummary({
    legalEntityId: legalEntity.id,
    fromDate,
    toDate,
  })
  const summary = summaryRes.data
  const demo = buildComplianceDashboard(f.periodKey, f.gstinId)
  const period = resolvePeriod(f.periodKey)
  const gstin: GstinProfile = {
    id: legalEntity.id,
    gstin: legalEntity.gstin ?? '—',
    legalName: legalEntity.legalName,
    tradeName: legalEntity.displayName,
    stateCode: legalEntity.stateCode ?? '',
    stateName: legalEntity.stateCode ?? '',
    isDefault: legalEntity.isDefault,
  }

  return {
    ...demo,
    period,
    gstin,
    kpis: {
      ...demo.kpis,
      outwardTaxable: money(summary.outward.taxableAmount),
      inwardTaxable: money(summary.inward.taxableAmount),
      gstPayablePreview: money(summary.outward.totalTaxAmount),
      // ITC / TDS / exceptions remain demo until those extracts ship
    },
    recentActivity: [
      {
        id: 'live-extract',
        when: new Date().toISOString(),
        text: `Live GST extract ${fromDate} → ${toDate} (${summary.outward.documentCount} outward, ${summary.inward.documentCount} inward). Filing / ITC remain preview.`,
      },
      ...demo.recentActivity.slice(0, 2),
    ],
  }
}

export async function getGstDashboard(filter?: PeriodFilterState): Promise<GstDashboardData> {
  const f = filter ?? loadPeriodFilter()
  if (!isApiMode()) {
    await delay()
    return buildGstDashboard(f.periodKey, f.gstinId)
  }

  const overview = await getTaxComplianceDashboard(f)
  const demo = buildGstDashboard(f.periodKey, f.gstinId)
  return {
    ...demo,
    period: overview.period,
    gstin: overview.gstin,
    kpis: {
      ...demo.kpis,
      outwardSupplies: overview.kpis.outwardTaxable,
      inwardSupplies: overview.kpis.inwardTaxable,
      outputTax: overview.kpis.gstPayablePreview,
    },
  }
}

export async function getOutwardSupplies(filter?: PeriodFilterState): Promise<GstSupplyRow[]> {
  if (!isApiMode()) {
    await delay()
    return structuredClone(OUTWARD_SUPPLIES_SEED)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const { fromDate, toDate } = filterDatesFromPeriod(f)
  const res = await fetchOutwardSupplies({
    legalEntityId: legalEntity.id,
    fromDate,
    toDate,
    page: 1,
    pageSize: 200,
  })
  return res.data.items.map((row) => mapExtractRow(row, 'Sales Invoice'))
}

export async function getInwardSupplies(filter?: PeriodFilterState): Promise<GstSupplyRow[]> {
  if (!isApiMode()) {
    await delay()
    return structuredClone(INWARD_SUPPLIES_SEED)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const { fromDate, toDate } = filterDatesFromPeriod(f)
  const res = await fetchInwardSupplies({
    legalEntityId: legalEntity.id,
    fromDate,
    toDate,
    page: 1,
    pageSize: 200,
  })
  return res.data.items.map((row) => mapExtractRow(row, 'Vendor Invoice'))
}

export async function getReverseChargeSupplies(filter?: PeriodFilterState): Promise<GstSupplyRow[]> {
  const inward = await getInwardSupplies(filter)
  return inward.filter((r) => r.reverseCharge)
}

export async function getGstr2bLines(_filter?: PeriodFilterState): Promise<{
  lines: Gstr2bLine[]
  imported: boolean
  disclaimer: string
}> {
  await delay()
  return {
    lines: structuredClone(GSTR2B_SEED),
    imported: gstr2bImported,
    disclaimer: setupState.previewDisclaimer,
  }
}

export async function importGstr2bPreview(fileName: string): Promise<{ importedCount: number; fileName: string }> {
  await delay(320)
  if (!fileName.trim()) throw new TaxComplianceServiceError('Select a demo CSV/JSON file name to continue.')
  gstr2bImported = true
  return { importedCount: GSTR2B_SEED.length, fileName }
}

export async function getItcReconciliation(_filter?: PeriodFilterState): Promise<{
  rows: ItcReconRow[]
  summary: {
    matchedTax: number
    mismatchTax: number
    booksOnlyTax: number
    gstr2bOnlyTax: number
    pendingCount: number
  }
}> {
  await delay()
  const rows = structuredClone(itcState)
  const taxOf = (r: ItcReconRow) =>
    (r.books?.totalTax ?? 0) ||
    (r.gstr2b ? r.gstr2b.igst + r.gstr2b.cgst + r.gstr2b.sgst + r.gstr2b.cess : 0)
  return {
    rows,
    summary: {
      matchedTax: rows.filter((r) => r.matchStatus === 'Matched' || r.matchStatus === 'Accepted').reduce((s, r) => s + taxOf(r), 0),
      mismatchTax: rows.filter((r) => r.matchStatus === 'Mismatch').reduce((s, r) => s + Math.abs(r.varianceTax), 0),
      booksOnlyTax: rows.filter((r) => r.matchStatus === 'Books Only').reduce((s, r) => s + taxOf(r), 0),
      gstr2bOnlyTax: rows.filter((r) => r.matchStatus === '2B Only').reduce((s, r) => s + taxOf(r), 0),
      pendingCount: rows.filter((r) => r.matchStatus === 'Pending Review' || r.matchStatus === 'Mismatch').length,
    },
  }
}

export async function updateItcMatchStatus(
  id: string,
  matchStatus: ItcMatchStatus,
  opts?: { overrideReason?: string; reviewerNote?: string },
): Promise<ItcReconRow> {
  await delay(200)
  const row = itcState.find((r) => r.id === id)
  if (!row) throw new TaxComplianceServiceError('ITC reconciliation row not found.')
  if (row.confidence === 'Low' && (matchStatus === 'Accepted' || matchStatus === 'Matched')) {
    if (!opts?.overrideReason?.trim()) {
      throw new TaxComplianceServiceError('Override reason required for low-confidence auto-accept (preview rule).')
    }
  }
  row.matchStatus = matchStatus
  if (opts?.overrideReason) row.overrideReason = opts.overrideReason
  if (opts?.reviewerNote) row.reviewerNote = opts.reviewerNote
  return structuredClone(row)
}

export async function getGstReturnPrep(returnType: 'GSTR-1' | 'GSTR-3B', _filter?: PeriodFilterState): Promise<GstReturnPrep> {
  await delay()
  const row = returnsState.find((r) => r.returnType === returnType)
  if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found for period.`)
  return structuredClone(row)
}

export async function markReturnFiledExternally(
  returnType: 'GSTR-1' | 'GSTR-3B',
  payload: { acknowledgmentRef: string; filedOnPortalDate: string; remarks?: string },
): Promise<GstReturnPrep> {
  await delay(220)
  const row = returnsState.find((r) => r.returnType === returnType)
  if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found.`)
  if (!payload.acknowledgmentRef.trim() || !payload.filedOnPortalDate) {
    throw new TaxComplianceServiceError('Acknowledgment reference and portal filing date are required.')
  }
  row.status = 'Marked Filed Externally'
  row.markedFiledAt = new Date().toISOString()
  row.markedFiledBy = 'Demo User'
  row.acknowledgmentRef = payload.acknowledgmentRef.trim()
  row.filedOnPortalDate = payload.filedOnPortalDate
  row.remarks = payload.remarks
  return structuredClone(row)
}

export async function getEInvoices(filter?: PeriodFilterState): Promise<EInvoiceRow[]> {
  if (!isApiMode()) {
    await delay()
    return structuredClone(EINVOICE_SEED)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const { fromDate, toDate } = filterDatesFromPeriod(f)
  const res = await fetchEInvoices({
    legalEntityId: legalEntity.id,
    fromDate,
    toDate,
    page: 1,
    pageSize: 200,
  })
  return res.data.items.map(mapEInvoiceDto)
}

function mapEInvoiceDto(row: GstEInvoiceDto): EInvoiceRow {
  const irnStatus: EInvoiceRow['irnStatus'] =
    row.status === 'GENERATED'
      ? 'Generated'
      : row.status === 'CANCELLED'
        ? 'Cancelled'
        : row.status === 'EXCEPTION'
          ? 'Exception'
          : 'Pending'
  return {
    id: row.id,
    invoiceNo: row.invoiceNumber ?? row.salesInvoiceId.slice(0, 8),
    invoiceDate: row.invoiceDate,
    customerName: row.customerName,
    customerGstin: row.customerGstin ?? '',
    taxableValue: money(row.taxableAmount),
    taxAmount: money(row.taxAmount),
    irnStatus,
    irn: row.irn ?? undefined,
    ackNo: row.ackNo ?? undefined,
    ackDate: row.ackDate?.slice(0, 10),
    salesInvoiceId: row.salesInvoiceId,
    providerMode: row.providerMode,
    sourceDocPath: `/accounting/money-in/invoices/${row.salesInvoiceId}`,
  }
}

export async function generateEInvoice(salesInvoiceId: string): Promise<EInvoiceRow> {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Generate IRN is available in API mode only (simulated NIC).')
  }
  const res = await generateEInvoiceApi(salesInvoiceId)
  return mapEInvoiceDto(res.data.item)
}

export async function cancelEInvoice(id: string, reason: string): Promise<EInvoiceRow> {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Cancel IRN is available in API mode only (simulated NIC).')
  }
  const res = await cancelEInvoiceApi(id, reason)
  return mapEInvoiceDto(res.data)
}

export async function getEWayBills(filter?: PeriodFilterState): Promise<EWayBillRow[]> {
  if (!isApiMode()) {
    await delay()
    return structuredClone(EWAY_SEED)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const { fromDate, toDate } = filterDatesFromPeriod(f)
  const res = await fetchEWayBills({
    legalEntityId: legalEntity.id,
    fromDate,
    toDate,
    page: 1,
    pageSize: 200,
  })
  return res.data.items.map(mapEWayDto)
}

function mapEWayDto(row: GstEWayBillDto): EWayBillRow {
  const ewbStatus: EWayBillRow['ewbStatus'] =
    row.status === 'GENERATED'
      ? 'Generated'
      : row.status === 'CANCELLED'
        ? 'Cancelled'
        : row.status === 'NOT_REQUIRED'
          ? 'Not Required'
          : row.status === 'EXPIRED'
            ? 'Expired'
            : row.status === 'EXCEPTION'
              ? 'Exception'
              : 'Required'
  return {
    id: row.id,
    docNo: row.documentNumber,
    docDate: row.documentDate,
    partyName: row.partyName,
    fromPlace: row.fromPlace,
    toPlace: row.toPlace,
    distanceKm: row.distanceKm,
    vehicleNo: row.vehicleNumber ?? undefined,
    ewbStatus,
    ewbNo: row.ewbNumber ?? undefined,
    validUpto: row.validUpto?.slice(0, 10),
    sourceType: row.sourceType as EWayBillRow['sourceType'],
    salesInvoiceId: row.salesInvoiceId ?? undefined,
    deliveryChallanId: row.deliveryChallanId ?? undefined,
    providerMode: row.providerMode,
  }
}

export async function generateEWayBill(payload: GenerateEWayBillPayload): Promise<EWayBillRow> {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Generate e-way is available in API mode only (simulated NIC).')
  }
  const res = await generateEWayBillApi(payload)
  return mapEWayDto(res.data.item)
}

export async function cancelEWayBill(id: string, reason: string): Promise<EWayBillRow> {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Cancel e-way is available in API mode only (simulated NIC).')
  }
  const res = await cancelEWayBillApi(id, reason)
  return mapEWayDto(res.data)
}

export async function getGstExceptions(_filter?: PeriodFilterState): Promise<GstExceptionRow[]> {
  await delay()
  return structuredClone(GST_EXCEPTIONS_SEED)
}

export async function getNotices(): Promise<ComplianceNotice[]> {
  await delay()
  return structuredClone(noticesState)
}

export async function getTdsDashboard(): Promise<{
  kpis: {
    deducted: number
    pendingDeposit: number
    exceptions: number
    returnsInProgress: number
    certificatesPending: number
  }
  recent: TdsTransaction[]
}> {
  await delay()
  return {
    kpis: {
      deducted: tdsTxnState.filter((t) => t.status === 'Deducted' || t.status === 'Deposited').reduce((s, t) => s + t.tdsAmount, 0),
      pendingDeposit: tdsTxnState.filter((t) => t.status === 'Deducted').reduce((s, t) => s + t.tdsAmount, 0),
      exceptions: tdsTxnState.filter((t) => t.status === 'Exception').length,
      returnsInProgress: TDS_RETURNS_SEED.filter((r) => r.status === 'In Progress' || r.status === 'Open').length,
      certificatesPending: TDS_CERTS_SEED.filter((c) => c.status === 'Draft Preview' || c.status === 'Ready').length,
    },
    recent: structuredClone(tdsTxnState).slice(0, 5),
  }
}

export async function getTdsTransactions(): Promise<TdsTransaction[]> {
  await delay()
  return structuredClone(tdsTxnState)
}

export async function getTdsChallans(): Promise<TdsChallan[]> {
  await delay()
  return structuredClone(TDS_CHALLANS_SEED)
}

export async function getTdsReturns(): Promise<TdsReturn[]> {
  await delay()
  return structuredClone(TDS_RETURNS_SEED)
}

export async function getTdsCertificates(): Promise<TdsCertificate[]> {
  await delay()
  return structuredClone(TDS_CERTS_SEED)
}

export async function getTdsReconciliation(): Promise<{
  booksTotal: number
  challanTotal: number
  variance: number
  unmatchedTxns: TdsTransaction[]
  unusedChallans: TdsChallan[]
}> {
  await delay()
  const booksTotal = tdsTxnState.reduce((s, t) => s + t.tdsAmount, 0)
  const challanTotal = TDS_CHALLANS_SEED.reduce((s, c) => s + c.amount, 0)
  return {
    booksTotal,
    challanTotal,
    variance: booksTotal - challanTotal,
    unmatchedTxns: structuredClone(tdsTxnState.filter((t) => !t.challanId)),
    unusedChallans: structuredClone(TDS_CHALLANS_SEED.filter((c) => c.linkedTxnCount === 0)),
  }
}

export async function getTcsRegister(): Promise<TcsRow[]> {
  await delay()
  return structuredClone(TCS_SEED)
}

export async function getComplianceCalendar(): Promise<ComplianceCalendarItem[]> {
  await delay()
  return structuredClone(CALENDAR_SEED)
}

export async function getTaxReports(): Promise<TaxReportCard[]> {
  await delay()
  return structuredClone(TAX_REPORTS_SEED)
}

export async function getTaxSetup(): Promise<TaxComplianceSetup> {
  await delay()
  return structuredClone(setupState)
}

export async function saveTaxSetup(patch: Partial<TaxComplianceSetup>): Promise<TaxComplianceSetup> {
  await delay(250)
  setupState = { ...setupState, ...patch, gstins: patch.gstins ?? setupState.gstins }
  return structuredClone(setupState)
}

export async function exportTaxPreviewCsv(kind: string, rows: Record<string, string | number>[]): Promise<string> {
  await delay(120)
  if (!rows.length) return `${kind}\n(no rows)\n`
  const headers = Object.keys(rows[0])
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))]
  return lines.join('\n')
}

/** Reset mutable demo state (tests / session reset) */
export function __resetTaxComplianceDemoState(): void {
  setupState = structuredClone(TAX_SETUP_SEED)
  itcState = structuredClone(ITC_RECON_SEED)
  returnsState = structuredClone(GST_RETURNS_SEED)
  tdsTxnState = structuredClone(TDS_TXNS_SEED)
  noticesState = structuredClone(NOTICES_SEED)
  gstr2bImported = false
}
