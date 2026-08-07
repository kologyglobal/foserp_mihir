/**
 * GST & TDS Compliance service — dual-mode.
 * Demo (`VITE_USE_API=false`): in-memory seed.
 * API (`VITE_USE_API=true`): live GST extract + e-invoice / e-way + GSTR-2B import/recon (no portal / no auto ITC claim).
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
  fetchGstrReturnPrep,
  fetchGstRegister,
  fetchInwardSupplies,
  fetchOutwardSupplies,
  fetchRcmRegister,
  generateEInvoiceApi,
  generateEWayBillApi,
  getGstr2bReconSummaryApi,
  importGstr2bBatchApi,
  listGstr2bBatchesApi,
  listGstr2bRowsApi,
  lockGstrReturnApi,
  markGstrFiledExternalApi,
  markRcmItcNotClaimableApi,
  markRcmLiabilityPaidApi,
  prepareGstrReturnApi,
  recognizeRcmItcApi,
  reconcileGstr2bBatchApi,
  unlockGstrReturnApi,
  fetchGstPaymentChallans,
  proposeGstPaymentApi,
  confirmGstPaymentApi,
  postGstPaymentGlApi,
  closeGstPaymentPeriodApi,
  voidGstPaymentApi,
  fetchGstLuts,
  upsertGstLutApi,
  fetchExportSezRegister,
  fetchExportRefundClaims,
  proposeExportRefundClaimApi,
  fetchSpecialsCapabilityMatrix,
  fetchNilExemptRegister,
  fetchGstWithholding,
  fetchGstAdvances,
  fetchCompositionGates,
  fetchHardeningCapabilityMatrix,
  fetchPeriodComplianceHealth,
  fetchGoLiveGate,
  fetchGstrFilingCapability,
  fetchGstrFilingSessions,
  createGstrFilingPackageApi,
  submitGstrFilingSessionApi,
  approveGstrFilingCheckerApi,
  captureGstrFilingArnApi,
  markGstrFilingFiledApi,
  fetchRateOpsReport,
  createRateOpsRunApi,
  fetchRateOpsRuns,
  fetchDataQualityFreeze,
  postDataQualityBackfillDryRun,
  postDataQualityBackfillApply,
  createDataQualityRunApi,
  fetchDataQualityRuns,
  fetchGlReconReport,
  createGlReconRunApi,
  fetchGlReconRuns,
  fetchPhase14CapabilityMatrix,
  fetchAnnualFyCockpit,
  fetchAnnualReturns,
  fetchAnnualReturn,
  prepareAnnualReturnApi,
  lockAnnualReturnApi,
  markAnnualFiledExternalApi,
  archiveFinancialYearApi,
  fetchFyArchives,
  fetchOpsCapabilityMatrix,
  fetchComplianceCockpit,
  fetchMultiPeriodHealth,
  type GenerateEWayBillPayload,
  type Gstr2bRowDto,
  type GstEInvoiceDto,
  type GstEWayBillDto,
  type GstRegisterKind,
  type GstPaymentChallanDto,
  type GstLutDto,
  type GstExportRegisterDocDto,
  type GstExportRefundClaimDto,
  type GstSupplyExtractDto,
  type GstrReturnPrepResponse,
  type RcmRegisterEntryDto,
  type GstrFilingSessionDto,
  type GstrFilingCapabilityDto,
} from '@/services/api/taxComplianceApi'
import {
  filterDatesFromPeriod,
  resolveDefaultLegalEntity,
  resolvePeriod,
  periodKeyToDateRange,
} from '@/services/accounting/taxComplianceApiComposer'
import type {
  ComplianceCalendarItem,
  ComplianceNotice,
  ComplianceStatus,
  EInvoiceRow,
  EWayBillRow,
  GstExceptionRow,
  GstReturnPrep,
  GstSupplyRow,
  Gstr2bLine,
  GstinProfile,
  ItcMatchStatus,
  ItcReconRow,
  MatchConfidence,
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
    placeOfSupply: row.placeOfSupply ?? row.stateCode ?? '-',
    taxableValue: money(row.taxableAmount),
    cgst: money(row.cgstAmount),
    sgst: money(row.sgstAmount),
    igst: money(row.igstAmount),
    cess: money(row.cessAmount),
    totalTax: money(row.totalTaxAmount),
    invoiceTotal: money(row.totalAmount),
    hsnSac: '-',
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
    gstin: legalEntity.gstin ?? '-',
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
  if (!isApiMode()) {
    await delay()
    const inward = structuredClone(INWARD_SUPPLIES_SEED).filter((r) => r.reverseCharge)
    return inward.map((r) => ({
      ...r,
      rcmLifecycleStatus:
        r.rcmLifecycleStatus ??
        (r.status === 'Exception' ? 'LIABILITY_POSTED' : 'LIABILITY_PAID'),
      itcClaimBlocked: r.itcClaimBlocked ?? r.status === 'Exception',
    }))
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const { fromDate, toDate } = filterDatesFromPeriod(f)
  const res = await fetchRcmRegister({
    legalEntityId: legalEntity.id,
    fromDate,
    toDate,
    page: 1,
    pageSize: 200,
  })
  return res.data.items.map(mapRcmRegisterRow)
}

function mapRcmRegisterRow(row: RcmRegisterEntryDto): GstSupplyRow {
  const statusMap: Record<string, ComplianceStatus> = {
    LIABILITY_POSTED: 'Open',
    LIABILITY_PAID: 'In Progress',
    ITC_RECOGNIZED: 'Ready for Review',
    ITC_NOT_CLAIMABLE: 'Exception',
    VOID: 'Exception',
  }
  return {
    id: row.id,
    docType: 'Vendor Invoice (RCM)',
    docNo: row.documentNumber,
    docDate: row.documentDate,
    partyName: row.vendorName,
    partyGstin: row.vendorGstin ?? '',
    placeOfSupply: row.placeOfSupply ?? '',
    taxableValue: money(row.taxableValue),
    cgst: money(row.cgstAmount),
    sgst: money(row.sgstAmount),
    igst: money(row.igstAmount),
    cess: money(row.cessAmount),
    totalTax: money(row.totalTaxAmount),
    invoiceTotal: money(row.taxableValue) + money(row.totalTaxAmount),
    hsnSac: '',
    supplyType: 'B2B',
    reverseCharge: true,
    sourceDocPath: '/accounting/payables/vendor-invoices',
    status: statusMap[row.status] ?? 'Open',
    notes: row.itcGate?.reasons?.join('; '),
    rcmLifecycleStatus: row.status,
    vendorInvoiceId: row.vendorInvoiceId,
    returnPeriod: row.returnPeriod,
    liabilityPaymentRef: row.liabilityPaymentRef,
    itcClaimBlocked: row.itcGate?.claimBlocked ?? true,
  }
}

export async function markRcmLiabilityPaid(
  id: string,
  payload: { liabilityPaidDate: string; liabilityPaymentRef?: string; notes?: string },
): Promise<GstSupplyRow> {
  if (!isApiMode()) {
    await delay(200)
    return {
      id,
      docType: 'Vendor Invoice (RCM)',
      docNo: 'DEMO',
      docDate: payload.liabilityPaidDate,
      partyName: 'Demo vendor',
      partyGstin: '',
      placeOfSupply: '',
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      invoiceTotal: 0,
      hsnSac: '',
      supplyType: 'B2B',
      reverseCharge: true,
      status: 'In Progress',
      rcmLifecycleStatus: 'LIABILITY_PAID',
      liabilityPaymentRef: payload.liabilityPaymentRef ?? null,
      itcClaimBlocked: false,
    }
  }
  const res = await markRcmLiabilityPaidApi(id, payload)
  return mapRcmRegisterRow(res.data)
}

export async function recognizeRcmItc(id: string, notes?: string): Promise<GstSupplyRow> {
  if (!isApiMode()) {
    await delay(200)
    return {
      id,
      docType: 'Vendor Invoice (RCM)',
      docNo: 'DEMO',
      docDate: new Date().toISOString().slice(0, 10),
      partyName: 'Demo vendor',
      partyGstin: '',
      placeOfSupply: '',
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      invoiceTotal: 0,
      hsnSac: '',
      supplyType: 'B2B',
      reverseCharge: true,
      status: 'Ready for Review',
      rcmLifecycleStatus: 'ITC_RECOGNIZED',
      itcClaimBlocked: false,
      notes,
    }
  }
  const res = await recognizeRcmItcApi(id, { notes })
  return mapRcmRegisterRow(res.data)
}

export async function markRcmItcNotClaimable(id: string, notes?: string): Promise<GstSupplyRow> {
  if (!isApiMode()) {
    await delay(200)
    return {
      id,
      docType: 'Vendor Invoice (RCM)',
      docNo: 'DEMO',
      docDate: new Date().toISOString().slice(0, 10),
      partyName: 'Demo vendor',
      partyGstin: '',
      placeOfSupply: '',
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      invoiceTotal: 0,
      hsnSac: '',
      supplyType: 'B2B',
      reverseCharge: true,
      status: 'Exception',
      rcmLifecycleStatus: 'ITC_NOT_CLAIMABLE',
      itcClaimBlocked: true,
      notes,
    }
  }
  const res = await markRcmItcNotClaimableApi(id, { notes })
  return mapRcmRegisterRow(res.data)
}

export async function getGstr2bLines(filter?: PeriodFilterState): Promise<{
  lines: Gstr2bLine[]
  imported: boolean
  disclaimer: string
  batchId?: string | null
  batchStatus?: string | null
}> {
  if (!isApiMode()) {
    await delay()
    return {
      lines: structuredClone(GSTR2B_SEED),
      imported: gstr2bImported,
      disclaimer: setupState.previewDisclaimer,
      batchId: null,
      batchStatus: null,
    }
  }

  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const batchesRes = await listGstr2bBatchesApi({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    page: 1,
    pageSize: 20,
  })
  const active = batchesRes.data.items.find((b) => b.status !== 'VOID') ?? null
  if (!active) {
    return {
      lines: [],
      imported: false,
      disclaimer:
        'No GSTR-2B batch for this period. Import offline JSON (not GST portal). Auto ITC claim is blocked.',
      batchId: null,
      batchStatus: null,
    }
  }
  const rowsRes = await listGstr2bRowsApi(active.id, { page: 1, pageSize: 500 })
  return {
    lines: rowsRes.data.items.map(mapApiRowToGstr2bLine),
    imported: true,
    disclaimer:
      'Live GSTR-2B import batch (offline file). Not portal download. No automatic ITC claim.',
    batchId: active.id,
    batchStatus: active.status,
  }
}

function mapApiRowToGstr2bLine(row: Gstr2bRowDto): Gstr2bLine {
  const taxAvail =
    row.itcClaimClass === 'INELIGIBLE' || row.itcClaimClass === 'BLOCKED'
      ? 'N'
      : row.itcClaimClass === 'ELIGIBLE' || row.itcClaimClass === 'RCM_ELIGIBLE'
        ? 'Y'
        : 'P'
  return {
    id: row.id,
    supplierGstin: row.supplierGstin,
    supplierName: row.supplierName ?? '-',
    invoiceNo: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    taxableValue: money(row.taxableValue),
    igst: money(row.igstAmount),
    cgst: money(row.cgstAmount),
    sgst: money(row.sgstAmount),
    cess: money(row.cessAmount),
    itcAvailability: taxAvail,
    returnPeriod: '',
  }
}

function mapMatchStatus(api: string): ItcMatchStatus {
  switch (api) {
    case 'MATCHED':
      return 'Matched'
    case 'PARTIAL_MATCH':
      return 'Partial Match'
    case 'MISSING_IN_BOOKS':
      return '2B Only'
    case 'MISSING_IN_2B':
      return 'Books Only'
    case 'VALUE_MISMATCH':
    case 'TAX_MISMATCH':
    case 'GSTIN_MISMATCH':
      return 'Mismatch'
    case 'REVIEW_REQUIRED':
    case 'UNMATCHED':
      return 'Pending Review'
    default:
      return 'Pending Review'
  }
}

function mapConfidence(score: number): MatchConfidence {
  if (score >= 200) return 'High'
  if (score >= 140) return 'Medium'
  if (score >= 80) return 'Low'
  return 'Manual'
}

export async function importGstr2bPreview(fileName: string): Promise<{
  importedCount: number
  fileName: string
  batchId?: string
}> {
  if (!isApiMode()) {
    await delay(320)
    if (!fileName.trim()) throw new TaxComplianceServiceError('Select a demo CSV/JSON file name to continue.')
    gstr2bImported = true
    return { importedCount: GSTR2B_SEED.length, fileName }
  }

  const legalEntity = await resolveDefaultLegalEntity()
  const f = loadPeriodFilter()
  // Demo seed mapped into import payload so API mode has a one-click sample import.
  // Production users should replace rows with portal-extracted JSON (not implemented here).
  const rows = GSTR2B_SEED.map((l) => ({
    supplierGstin: l.supplierGstin,
    supplierName: l.supplierName,
    invoiceNumber: l.invoiceNo,
    invoiceDate: l.invoiceDate,
    taxableValue: l.taxableValue,
    cgstAmount: l.cgst,
    sgstAmount: l.sgst,
    igstAmount: l.igst,
    cessAmount: l.cess,
  }))
  const res = await importGstr2bBatchApi({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    source: 'FILE',
    fileName: fileName.trim() || 'gstr2b-import.json',
    providerMode: 'SIMULATED',
    importNotes: 'Imported from Tax Compliance workbench (offline file payload).',
    rows,
  })
  return {
    importedCount: res.data.batch.rowCount,
    fileName: res.data.batch.fileName ?? fileName,
    batchId: res.data.batch.id,
  }
}

export async function reconcileActiveGstr2bBatch(filter?: PeriodFilterState): Promise<{
  batchId: string
  followUpsOpened: number
  disclaimer: string
}> {
  if (!isApiMode()) {
    await delay(200)
    return {
      batchId: 'demo',
      followUpsOpened: 0,
      disclaimer: 'Demo mode — run import then review ITC workbench seeds.',
    }
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const batchesRes = await listGstr2bBatchesApi({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    page: 1,
    pageSize: 20,
  })
  const active = batchesRes.data.items.find((b) => b.status !== 'VOID')
  if (!active) throw new TaxComplianceServiceError('Import a GSTR-2B batch for this period before reconciling.')
  const res = await reconcileGstr2bBatchApi(active.id, true)
  return {
    batchId: res.data.batch.id,
    followUpsOpened: res.data.followUpsOpened,
    disclaimer: res.data.disclaimer,
  }
}

export async function getItcReconciliation(filter?: PeriodFilterState): Promise<{
  rows: ItcReconRow[]
  summary: {
    matchedTax: number
    mismatchTax: number
    booksOnlyTax: number
    gstr2bOnlyTax: number
    pendingCount: number
  }
  autoClaimBlocked?: boolean
}> {
  if (!isApiMode()) {
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
      autoClaimBlocked: true,
    }
  }

  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const batchesRes = await listGstr2bBatchesApi({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    page: 1,
    pageSize: 20,
  })
  const active =
    batchesRes.data.items.find((b) => b.status === 'RECONCILED') ??
    batchesRes.data.items.find((b) => b.status !== 'VOID') ??
    null
  if (!active) {
    return {
      rows: [],
      summary: { matchedTax: 0, mismatchTax: 0, booksOnlyTax: 0, gstr2bOnlyTax: 0, pendingCount: 0 },
      autoClaimBlocked: true,
    }
  }

  if (active.status === 'IMPORTED') {
    // Surface unreconciled import as pending 2B-only rows
    const rowsRes = await listGstr2bRowsApi(active.id, { page: 1, pageSize: 500 })
    const rows: ItcReconRow[] = rowsRes.data.items.map((row) => {
      const g = mapApiRowToGstr2bLine(row)
      return {
        id: row.id,
        gstr2b: g,
        matchStatus: mapMatchStatus(row.matchStatus),
        confidence: mapConfidence(row.matchScore),
        varianceTaxable: 0,
        varianceTax: 0,
        reviewerNote: row.matchNotes ?? 'Import present — run Reconcile to match posted vendor invoices.',
      }
    })
    const gstr2bOnlyTax = rows.reduce(
      (s, r) => s + (r.gstr2b ? r.gstr2b.igst + r.gstr2b.cgst + r.gstr2b.sgst + r.gstr2b.cess : 0),
      0,
    )
    return {
      rows,
      summary: {
        matchedTax: 0,
        mismatchTax: 0,
        booksOnlyTax: 0,
        gstr2bOnlyTax,
        pendingCount: rows.length,
      },
      autoClaimBlocked: true,
    }
  }

  const [rowsRes, summaryRes] = await Promise.all([
    listGstr2bRowsApi(active.id, { page: 1, pageSize: 500 }),
    getGstr2bReconSummaryApi(active.id),
  ])

  const rows: ItcReconRow[] = rowsRes.data.items.map((row) => {
    const g = mapApiRowToGstr2bLine(row)
    const books =
      row.matchedVendorInvoiceId
        ? ({
            id: row.matchedVendorInvoiceId,
            docType: 'Vendor Invoice',
            docNo: row.invoiceNumber,
            docDate: row.invoiceDate,
            partyName: row.supplierName ?? '-',
            partyGstin: row.supplierGstin,
            placeOfSupply: row.placeOfSupply ?? '',
            taxableValue: money(row.taxableValue),
            cgst: money(row.cgstAmount),
            sgst: money(row.sgstAmount),
            igst: money(row.igstAmount),
            cess: money(row.cessAmount),
            totalTax:
              money(row.cgstAmount) +
              money(row.sgstAmount) +
              money(row.igstAmount) +
              money(row.cessAmount),
            invoiceTotal: money(row.taxableValue),
            hsnSac: '',
            supplyType: 'B2B' as const,
            reverseCharge: row.itcClaimClass === 'RCM_ELIGIBLE',
            status: 'Ready for Review' as const,
            notes: `VI ${row.matchedVendorInvoiceId.slice(0, 8)}… · ${row.itcClaimClass} (suggestion only)`,
          } satisfies GstSupplyRow)
        : undefined
    return {
      id: row.id,
      books,
      gstr2b: g,
      matchStatus: mapMatchStatus(row.matchStatus),
      confidence: mapConfidence(row.matchScore),
      varianceTaxable: 0,
      varianceTax: 0,
      reviewerNote: row.matchNotes ?? undefined,
    }
  })

  const tax = summaryRes.data.taxTotals
  return {
    rows,
    summary: {
      matchedTax: money(tax.matchedTax),
      mismatchTax: money(tax.mismatchTax),
      booksOnlyTax: Number(tax.booksOnlyEstimated) || 0,
      gstr2bOnlyTax: money(tax.gstr2bOnlyTax),
      pendingCount: summaryRes.data.pendingReviewCount,
    },
    autoClaimBlocked: true,
  }
}

export async function updateItcMatchStatus(
  id: string,
  matchStatus: ItcMatchStatus,
  opts?: { overrideReason?: string; reviewerNote?: string },
): Promise<ItcReconRow> {
  if (isApiMode()) {
    // Phase 3: reviewer actions are workbench notes only — no AP ITC auto-claim writeback.
    throw new TaxComplianceServiceError(
      'Live ITC accept/reject does not post claims. Update vendor-invoice ITC eligibility in AP, and use follow-ups for vendor exceptions. Auto-claim remains blocked.',
    )
  }
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

function mapReturnPrepApi(returnType: 'GSTR-1' | 'GSTR-3B', res: GstrReturnPrepResponse): GstReturnPrep {
  const p = res.period
  const prep = res.preparation ?? {}
  const statusMap: Record<string, GstReturnPrep['status']> = {
    OPEN: 'OPEN',
    DRAFT: 'DRAFT',
    LOCKED: 'LOCKED',
    MARKED_FILED_EXTERNAL: 'MARKED_FILED_EXTERNAL',
  }
  return {
    id: p.id,
    returnType,
    periodKey: p.returnPeriod,
    status: statusMap[p.status] ?? p.status,
    outwardTaxable: money(prep.outwardTaxable as number | undefined),
    taxLiability: money(prep.taxLiability as number | undefined),
    itcAvailable: money(prep.itcAvailable as number | undefined),
    netPayable: money(prep.netPayable as number | undefined),
    markedFiledAt: p.markedFiledAt ?? undefined,
    acknowledgmentRef: p.acknowledgmentRef ?? undefined,
    filedOnPortalDate: p.filedOnPortalDate ?? undefined,
    remarks: p.remarks ?? undefined,
    companyGstin: p.companyGstin,
    draftVersion: p.draftVersion,
    sourceImmutable: p.sourceImmutable,
    frozen: Boolean(prep.frozen),
    disclaimer: p.disclaimer,
  }
}

export async function getGstReturnPrep(returnType: 'GSTR-1' | 'GSTR-3B', filter?: PeriodFilterState): Promise<GstReturnPrep> {
  if (!isApiMode()) {
    await delay()
    const row = returnsState.find((r) => r.returnType === returnType)
    if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found for period.`)
    return structuredClone(row)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstrReturnPrep({
    returnType,
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    companyGstin: legalEntity.gstin ?? undefined,
  })
  return mapReturnPrepApi(returnType, res.data)
}

export async function prepareGstReturn(returnType: 'GSTR-1' | 'GSTR-3B', filter?: PeriodFilterState): Promise<GstReturnPrep> {
  if (!isApiMode()) {
    await delay(200)
    const row = returnsState.find((r) => r.returnType === returnType)
    if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found.`)
    row.status = 'DRAFT'
    return structuredClone(row)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await prepareGstrReturnApi({
    returnType,
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    companyGstin: legalEntity.gstin,
  })
  return mapReturnPrepApi(returnType, res.data)
}

export async function lockGstReturn(returnType: 'GSTR-1' | 'GSTR-3B', filter?: PeriodFilterState): Promise<GstReturnPrep> {
  if (!isApiMode()) {
    await delay(200)
    const row = returnsState.find((r) => r.returnType === returnType)
    if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found.`)
    row.status = 'LOCKED'
    return structuredClone(row)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await lockGstrReturnApi({
    returnType,
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    companyGstin: legalEntity.gstin,
  })
  return mapReturnPrepApi(returnType, res.data)
}

export async function unlockGstReturn(
  returnType: 'GSTR-1' | 'GSTR-3B',
  reason: string,
  filter?: PeriodFilterState,
): Promise<GstReturnPrep> {
  if (!isApiMode()) {
    await delay(200)
    const row = returnsState.find((r) => r.returnType === returnType)
    if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found.`)
    row.status = 'DRAFT'
    return structuredClone(row)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await unlockGstrReturnApi({
    returnType,
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    companyGstin: legalEntity.gstin,
    reason,
  })
  return mapReturnPrepApi(returnType, res.data)
}

export async function markReturnFiledExternally(
  returnType: 'GSTR-1' | 'GSTR-3B',
  payload: { acknowledgmentRef: string; filedOnPortalDate: string; remarks?: string },
  filter?: PeriodFilterState,
): Promise<GstReturnPrep> {
  if (!payload.acknowledgmentRef.trim() || !payload.filedOnPortalDate) {
    throw new TaxComplianceServiceError('Acknowledgment reference and portal filing date are required.')
  }
  if (!isApiMode()) {
    await delay(220)
    const row = returnsState.find((r) => r.returnType === returnType)
    if (!row) throw new TaxComplianceServiceError(`${returnType} prep not found.`)
    row.status = 'Marked Filed Externally'
    row.markedFiledAt = new Date().toISOString()
    row.markedFiledBy = 'Demo User'
    row.acknowledgmentRef = payload.acknowledgmentRef.trim()
    row.filedOnPortalDate = payload.filedOnPortalDate
    row.remarks = payload.remarks
    return structuredClone(row)
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await markGstrFiledExternalApi({
    returnType,
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    companyGstin: legalEntity.gstin,
    acknowledgmentRef: payload.acknowledgmentRef,
    filedOnPortalDate: payload.filedOnPortalDate,
    remarks: payload.remarks,
  })
  return mapReturnPrepApi(returnType, res.data)
}

/** Phase 5 live register — API reads GST ledger; demo uses empty with label. */
export async function getGstRegister(
  kind: GstRegisterKind,
  filter?: PeriodFilterState,
): Promise<Record<string, unknown>> {
  if (!isApiMode()) {
    await delay()
    return {
      kind,
      items: [],
      source: 'DEMO',
      disclaimer: 'Demo mode has empty ledger-backed registers. Enable API mode for live GST ledger registers.',
    }
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstRegister({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    kind,
    companyGstin: legalEntity.gstin ?? undefined,
  })
  return res.data
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

function returnPeriodFromFilter(filter?: PeriodFilterState): string {
  const f = filter ?? loadPeriodFilter()
  if (/^\d{4}-\d{2}$/.test(f.periodKey)) return f.periodKey
  return periodKeyToDateRange(f.periodKey).fromDate.slice(0, 7)
}

/** Phase 8 — list books-side PMT-06 style challans. */
export async function getGstPaymentChallans(filter?: PeriodFilterState): Promise<GstPaymentChallanDto[]> {
  if (!isApiMode()) {
    await delay()
    return []
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstPaymentChallans({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(filter),
  })
  return res.data.items
}

export async function proposeGstPaymentChallan(
  extras?: { interestAmount?: number; lateFeeAmount?: number },
  filter?: PeriodFilterState,
): Promise<GstPaymentChallanDto> {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('GST payment propose is available in API mode only.')
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await proposeGstPaymentApi({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(filter),
    interestAmount: extras?.interestAmount,
    lateFeeAmount: extras?.lateFeeAmount,
  })
  return res.data
}

export async function confirmGstPaymentChallan(
  id: string,
  input: { paymentDate: string; cpin?: string; challanNumber?: string; bankReference?: string },
): Promise<GstPaymentChallanDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('API mode only')
  const res = await confirmGstPaymentApi(id, input)
  return res.data
}

export async function postGstPaymentChallanGl(
  id: string,
  bankAccountId: string,
): Promise<GstPaymentChallanDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('API mode only')
  const res = await postGstPaymentGlApi(id, { bankAccountId })
  return res.data
}

export async function closeGstPaymentChallan(id: string): Promise<GstPaymentChallanDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('API mode only')
  const res = await closeGstPaymentPeriodApi(id)
  return res.data
}

export async function voidGstPaymentChallan(id: string, reason: string): Promise<GstPaymentChallanDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('API mode only')
  const res = await voidGstPaymentApi(id, reason)
  return res.data
}

// ─── Phase 10 — Export / SEZ / LUT ────────────────────────────────────────────

export async function getGstLuts(_filter?: PeriodFilterState): Promise<GstLutDto[]> {
  if (!isApiMode()) return []
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstLuts(legalEntity.id)
  return res.data.items ?? []
}

export async function saveGstLut(input: {
  id?: string | null
  lutNumber: string
  companyGstin?: string | null
  financialYearLabel?: string | null
  validFrom: string
  validTo?: string | null
  notes?: string | null
  status?: string
}): Promise<void> {
  if (!isApiMode()) throw new TaxComplianceServiceError('API mode only')
  const legalEntity = await resolveDefaultLegalEntity()
  await upsertGstLutApi({
    ...input,
    legalEntityId: legalEntity.id,
  })
}

export async function getExportSezRegister(filter?: PeriodFilterState): Promise<{
  items: GstExportRegisterDocDto[]
  partition: { wpayCount: number; wopayCount: number; otherCount: number }
}> {
  if (!isApiMode()) return { items: [], partition: { wpayCount: 0, wopayCount: 0, otherCount: 0 } }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchExportSezRegister({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  return {
    items: res.data.items ?? [],
    partition: res.data.partition ?? { wpayCount: 0, wopayCount: 0, otherCount: 0 },
  }
}

export async function getExportRefundClaims(filter?: PeriodFilterState): Promise<GstExportRefundClaimDto[]> {
  if (!isApiMode()) return []
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchExportRefundClaims({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  return res.data.items ?? []
}

export async function proposeExportRefundClaim(filter?: PeriodFilterState): Promise<void> {
  if (!isApiMode()) throw new TaxComplianceServiceError('API mode only')
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  await proposeExportRefundClaimApi({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
}

// ─── Phase 11 — Special schemes ─────────────────────────────────────────────

const DEMO_SPECIALS_MATRIX = {
  phase: 11,
  verdict: 'READY_WITH_CONDITIONS',
  notFullGstCompliant: true as const,
  featureEnabled: true,
  capabilities: [
    {
      id: 'nil_exempt_nongst_classify',
      label: 'Nil-rated / exempt / non-GST classification',
      status: 'READY' as const,
      notes: 'Demo fixture — API mode uses live capability matrix.',
    },
    {
      id: 'composition_gates',
      label: 'Composition e-invoice gates',
      status: 'READY' as const,
      notes: 'Demo fixture',
    },
    {
      id: 'gst_tds_tcs_books',
      label: 'GST TDS/TCS books register',
      status: 'PARTIAL' as const,
      notes: 'Demo empty — not portal GSTR-7/8',
    },
    {
      id: 'advances',
      label: 'Advances adjustment',
      status: 'PARTIAL' as const,
      notes: 'Demo empty',
    },
    {
      id: 'portal_filing',
      label: 'Portal filing',
      status: 'NOT_IN_SCOPE' as const,
      notes: 'Phase 12',
    },
  ],
}

export async function getSpecialsCapabilityMatrix() {
  if (!isApiMode()) return DEMO_SPECIALS_MATRIX
  const res = await fetchSpecialsCapabilityMatrix()
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load capability matrix')
  return res.data
}

export async function getNilExemptRegister(filter?: PeriodFilterState) {
  if (!isApiMode()) {
    return {
      items: [] as Array<Record<string, unknown>>,
      total: 0,
      note: 'Demo mode — no ledger specials seed. Use API mode for live nil/exempt register.',
    }
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchNilExemptRegister({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load nil/exempt register')
  return res.data
}

export async function getGstWithholdingRegister(filter?: PeriodFilterState) {
  if (!isApiMode()) {
    return { items: [] as Array<Record<string, unknown>>, total: 0, note: 'Demo — GST TDS/TCS books empty' }
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstWithholding({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load GST withholding')
  return res.data
}

export async function getGstAdvanceRegister(filter?: PeriodFilterState) {
  if (!isApiMode()) {
    return { items: [] as Array<Record<string, unknown>>, total: 0, note: 'Demo — advance register empty' }
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstAdvances({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load advances')
  return res.data
}

export async function getCompositionGatesInfo() {
  if (!isApiMode()) {
    return { compositionCount: 0, eInvoiceBlockedFor: [] as string[], note: 'Demo mode' }
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchCompositionGates(legalEntity.id)
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load composition gates')
  return res.data as {
    compositionCount: number
    eInvoiceBlockedFor: string[]
    note?: string
  }
}

// ─── Phase 13 — Go-live / hardening ─────────────────────────────────────────

export async function getHardeningCapabilityMatrix() {
  if (!isApiMode()) {
    return {
      phase: 13,
      verdict: 'READY_WITH_CONDITIONS',
      notFullGstCompliant: true as const,
      capabilities: [
        {
          id: 'period_books_reconcile',
          label: 'Period books reconciliation',
          status: 'READY',
        },
        { id: 'go_live_uat_gate', label: 'Statutory go-live / UAT gate', status: 'READY' },
        { id: 'full_gst_compliant', label: 'FULL GST COMPLIANT', status: 'NOT_IN_SCOPE' },
      ],
    }
  }
  const res = await fetchHardeningCapabilityMatrix()
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load hardening matrix')
  return res.data
}

export async function getPeriodComplianceHealth(filter?: PeriodFilterState) {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Use demo fixture on page when not in API mode')
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchPeriodComplianceHealth({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load period health')
  return res.data
}

export async function getGoLiveGate() {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Use demo fixture on page when not in API mode')
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGoLiveGate({ legalEntityId: legalEntity.id })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load go-live gate')
  return res.data
}

const DEMO_FILING_SESSIONS: GstrFilingSessionDto[] = [
  {
    id: 'demo-filing-gstr1',
    legalEntityId: 'demo-le',
    companyGstin: GSTIN_PROFILES[0]?.gstin ?? '27AAAAA0000A1Z5',
    returnPeriod: TAX_PERIODS[0]?.periodKey ?? '2026-07',
    returnType: 'GSTR-1',
    returnPeriodId: 'demo-period-gstr1',
    status: 'ACCEPTED_SIMULATED',
    providerMode: 'SIMULATED',
    packageVersion: 1,
    acknowledgmentRef: 'SIM-ARN-G1-DEMO000001',
    filedOnPortalDate: '2026-08-01',
    providerRef: 'SIM-FILING-DEMO',
    failureMessage: null,
    makerUserId: null,
    checkerUserId: null,
    submittedAt: '2026-08-01T10:00:00.000Z',
    submittedBy: null,
    acceptedAt: '2026-08-01T10:00:00.000Z',
    markedFiledAt: null,
    markedFiledBy: null,
    remarks: 'Demo seed — not a real portal ARN',
    readinessLabel: 'GST_PORTAL_FILING_SIMULATED',
    disclaimer: 'Demo mode illustration only. API mode uses locked GSTR prep packages.',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
]

export async function getGstrFilingCapability(): Promise<GstrFilingCapabilityDto> {
  if (!isApiMode()) {
    return {
      providerMode: 'SIMULATED',
      isSimulated: true,
      liveReady: false,
      liveBlockers: [],
      verdict: 'READY_WITH_CONDITIONS',
      notFullGstCompliant: true,
      note: 'Demo mode — portal filing is SIMULATED illustration only. Not GST portal success.',
    }
  }
  const res = await fetchGstrFilingCapability()
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load filing capability')
  return res.data
}

export async function listGstrFilingSessions(filter?: PeriodFilterState): Promise<GstrFilingSessionDto[]> {
  if (!isApiMode()) {
    await delay()
    return DEMO_FILING_SESSIONS
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGstrFilingSessions({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to list filing sessions')
  return res.data.items
}

export async function createGstrFilingPackage(
  returnType: 'GSTR-1' | 'GSTR-3B',
  options?: { requireChecker?: boolean; remarks?: string | null },
  filter?: PeriodFilterState,
): Promise<GstrFilingSessionDto> {
  if (!isApiMode()) {
    throw new TaxComplianceServiceError('Create filing package requires API mode (locked GSTR prep).')
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await createGstrFilingPackageApi({
    legalEntityId: legalEntity.id,
    returnPeriod: f.periodKey,
    returnType,
    requireChecker: options?.requireChecker,
    remarks: options?.remarks,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to create filing package')
  return res.data
}

export async function submitGstrFilingSession(id: string): Promise<GstrFilingSessionDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('Submit filing requires API mode.')
  const res = await submitGstrFilingSessionApi(id)
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to submit filing')
  return res.data
}

export async function approveGstrFilingChecker(id: string, remarks?: string | null): Promise<GstrFilingSessionDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('Checker approve requires API mode.')
  const res = await approveGstrFilingCheckerApi(id, remarks)
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to approve checker')
  return res.data
}

export async function captureGstrFilingArn(
  id: string,
  payload: { acknowledgmentRef: string; filedOnPortalDate: string; remarks?: string | null },
): Promise<GstrFilingSessionDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('Capture ARN requires API mode.')
  const res = await captureGstrFilingArnApi(id, payload)
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to capture ARN')
  return res.data
}

export async function markGstrFilingFiled(id: string, remarks?: string | null): Promise<GstrFilingSessionDto> {
  if (!isApiMode()) throw new TaxComplianceServiceError('Mark filed requires API mode.')
  const res = await markGstrFilingFiledApi(id, remarks)
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to mark filed')
  return res.data
}

/** Indian FY label from YYYY-MM (Apr–Mar). */
export function financialYearFromPeriodKey(periodKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!m) return periodKey
  const year = Number(m[1])
  const month = Number(m[2])
  if (month >= 4) return `${year}-${String((year + 1) % 100).padStart(2, '0')}`
  return `${year - 1}-${String(year % 100).padStart(2, '0')}`
}

export async function getPhase14CapabilityMatrix() {
  if (!isApiMode()) {
    return {
      phase: 14,
      verdict: 'READY_WITH_CONDITIONS',
      notFullGstCompliant: true,
      featureEnabled: true,
      capabilities: [
        {
          id: 'gstr9_books',
          label: 'GSTR-9 annual worksheet',
          status: 'ready',
          notes: 'Demo illustration — use API mode for live workbook.',
        },
        {
          id: 'portal_annual',
          label: 'Portal annual submit',
          status: 'deferred',
          notes: 'Not in FOS scope.',
        },
      ],
    }
  }
  const res = await fetchPhase14CapabilityMatrix()
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load Phase 14 matrix')
  return res.data
}

export async function getAnnualFyCockpit(financialYear?: string) {
  if (!isApiMode()) {
    await delay()
    return {
      financialYear: financialYear ?? '2025-26',
      health: {
        score: 72,
        grade: 'C',
        issues: [
          {
            code: 'DEMO',
            severity: 'info',
            message: 'Demo cockpit only — switch to API mode for live books score.',
          },
        ],
        metrics: {
          monthlyPeriodCount: 0,
          monthlyFiledCount: 0,
          monthlyOpenDraftCount: 0,
          openNotices: 0,
          overdueNotices: 0,
          openRcm: 0,
          simulatedFilingSessions: 0,
          annualPrepared: false,
          fyArchived: false,
        },
      },
      annualReturn: null,
      fyArchive: null,
      monthlyPeriods: [],
      disclaimer: 'Demo mode — not FULL GST COMPLIANT.',
    }
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchAnnualFyCockpit({ legalEntityId: legalEntity.id, financialYear })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load annual cockpit')
  return res.data
}

export async function getAnnualReturns(financialYear?: string) {
  if (!isApiMode()) return { items: [] as Array<Record<string, unknown>> }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchAnnualReturns({ legalEntityId: legalEntity.id, financialYear })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to list annual returns')
  return res.data
}

export async function getAnnualReturnDetail(financialYear: string) {
  if (!isApiMode()) return { item: null, livePreview: null }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchAnnualReturn({ legalEntityId: legalEntity.id, financialYear })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load annual return')
  return res.data
}

export async function prepareAnnualReturn(financialYear: string, remarks?: string | null) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Prepare annual requires API mode.')
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await prepareAnnualReturnApi({ legalEntityId: legalEntity.id, financialYear, remarks })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to prepare annual')
  return res.data
}

export async function lockAnnualReturn(financialYear: string) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Lock annual requires API mode.')
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await lockAnnualReturnApi({ legalEntityId: legalEntity.id, financialYear })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to lock annual')
  return res.data
}

export async function markAnnualFiledExternal(
  financialYear: string,
  payload: { acknowledgmentRef: string; filedOnPortalDate?: string | null },
) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Mark annual filed requires API mode.')
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await markAnnualFiledExternalApi({
    legalEntityId: legalEntity.id,
    financialYear,
    acknowledgmentRef: payload.acknowledgmentRef,
    filedOnPortalDate: payload.filedOnPortalDate,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to mark annual filed')
  return res.data
}

export async function archiveFinancialYear(financialYear: string, notes?: string | null) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Archive FY requires API mode.')
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await archiveFinancialYearApi({ legalEntityId: legalEntity.id, financialYear, notes })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to archive FY')
  return res.data
}

export async function getFyArchives(financialYear?: string) {
  if (!isApiMode()) return { items: [] as Array<Record<string, unknown>> }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchFyArchives({ legalEntityId: legalEntity.id, financialYear })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to list FY archives')
  return res.data
}

// ─── Phase 16 — Rate master ops ─────────────────────────────────────────────

const DEMO_RATE_OPS_REPORT = {
  phase: 16 as const,
  verdict: 'READY_WITH_CONDITIONS' as const,
  notFullGstCompliant: true as const,
  coverage: {
    asOfDate: new Date().toISOString().slice(0, 10),
    activeGroupCount: 3,
    activeRateCount: 4,
    gaps: [] as Array<Record<string, unknown>>,
    overlaps: [] as Array<Record<string, unknown>>,
    expiring: [] as Array<Record<string, unknown>>,
    note: 'Demo fixture — use API mode for live MasterGstRate coverage.',
  },
  drift: {
    sampleCount: 0,
    findingTotal: 0,
    findings: [] as Array<Record<string, unknown>>,
    impact: [] as Array<Record<string, unknown>>,
  },
  health: {
    overall: 'HEALTHY',
    scorePct: 100,
    gapCount: 0,
    expiringCount: 0,
    overlapCount: 0,
    driftCount: 0,
    criticalDriftCount: 0,
    notFullGstCompliant: true as const,
    readinessLabel: 'GST_RATE_OPS_READY_WITH_CONDITIONS',
    disclaimer: 'Demo mode — not LIVE tax masters.',
  },
  capability: {
    phase: 16,
    notFullGstCompliant: true,
    capabilities: [
      { id: 'rate_coverage', label: 'Rate coverage', status: 'READY', notes: 'Demo' },
      { id: 'portal_filing', label: 'Portal filing', status: 'NOT_IN_SCOPE', notes: 'Phase 12' },
    ],
  },
}

export async function getRateOpsFullReport(filter?: PeriodFilterState) {
  if (!isApiMode()) return DEMO_RATE_OPS_REPORT
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchRateOpsReport({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load rate ops report')
  return res.data as typeof DEMO_RATE_OPS_REPORT
}

export async function saveRateOpsRun(filter?: PeriodFilterState, notes?: string | null) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Save rate ops run requires API mode.')
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await createRateOpsRunApi({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
    notes,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to save rate ops run')
  return res.data
}

export async function getRateOpsRuns() {
  if (!isApiMode()) return { items: [] as Array<Record<string, unknown>> }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchRateOpsRuns({ legalEntityId: legalEntity.id })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to list rate ops runs')
  return res.data
}

// ─── Phase 17 — Data quality / GSTIN backfill / freeze ───────────────────────

const DEMO_DATA_QUALITY_FREEZE = {
  legalEntityId: 'demo-le',
  returnPeriod: '2026-07',
  health: { scorePct: 72, overall: 'ATTENTION' as const },
  checklist: {
    ready: false,
    summary: 'Demo: books freeze checklist with sample null GSTIN — not FULL GST COMPLIANT',
    items: [
      {
        id: 'company_gstin_complete',
        label: 'Company GSTIN stamped on period ledger',
        status: 'WARN' as const,
        message: 'Demo: 3 null companyGstin rows — backfillable from LE',
      },
      {
        id: 'single_gstin_slice',
        label: 'No multi-GSTIN contamination in slice',
        status: 'PASS' as const,
        message: 'Demo single GSTIN',
      },
      {
        id: 'honest_label',
        label: 'FULL GST COMPLIANT claim',
        status: 'FAIL' as const,
        message: 'Software freeze readiness never allows FULL GST COMPLIANT label',
      },
    ],
  },
  quality: {
    totalRows: 12,
    nullCompanyGstinCount: 3,
    filedWithNullGstinCount: 0,
    distinctGstins: ['27AAAAA0000A1Z5'],
    contaminated: false,
    findings: [
      {
        code: 'NULL_COMPANY_GSTIN',
        severity: 'WARN',
        message: '3 ledger row(s) missing companyGstin',
        count: 3,
        sampleDocumentNumbers: ['SI-DEMO-1'],
      },
    ],
  },
  backfill: { candidateTotal: 3, unresolvable: 0 },
  fullGstCompliant: false as const,
  disclaimer: 'Demo fixture — not LIVE ledger hygiene.',
}

export async function getDataQualityFreezeReadiness(filter?: PeriodFilterState) {
  if (!isApiMode()) return DEMO_DATA_QUALITY_FREEZE
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchDataQualityFreeze({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) {
    throw new TaxComplianceServiceError(res.message || 'Failed to load freeze readiness')
  }
  return res.data as typeof DEMO_DATA_QUALITY_FREEZE
}

export async function dryRunDataQualityBackfill(filter?: PeriodFilterState) {
  if (!isApiMode()) {
    return {
      dryRun: true as const,
      plan: {
        candidateTotal: 3,
        alreadyPopulated: 9,
        unresolvable: [] as Array<{ id: string; documentId: string; message: string }>,
        candidates: [
          {
            ledgerEntryId: 'demo-1',
            documentId: 'd1',
            documentNumber: 'SI-DEMO-1',
            toGstin: '27AAAAA0000A1Z5',
            source: 'LEGAL_ENTITY',
            reason: 'Demo LE GSTIN',
          },
        ],
      },
      disclaimer: 'Demo dry-run only.',
    }
  }
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await postDataQualityBackfillDryRun({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Dry-run failed')
  return res.data
}

export async function applyDataQualityBackfill(filter?: PeriodFilterState, notes?: string | null) {
  if (!isApiMode()) throw new TaxComplianceServiceError('GSTIN backfill apply requires API mode.')
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await postDataQualityBackfillApply({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
    confirm: true,
    notes,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Backfill apply failed')
  return res.data
}

export async function saveDataQualityRun(filter?: PeriodFilterState, notes?: string | null) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Save data quality run requires API mode.')
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await createDataQualityRunApi({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
    notes,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to save run')
  return res.data
}

export async function getDataQualityRuns() {
  if (!isApiMode()) return { items: [] as Array<Record<string, unknown>> }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchDataQualityRuns({ legalEntityId: legalEntity.id })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to list runs')
  return res.data
}

// ─── Phase 18 — GST vs GL control recon ──────────────────────────────────────

const DEMO_GL_RECON = {
  legalEntityId: 'demo-le',
  returnPeriod: '2026-07',
  period: { fromDate: '2026-07-01', toDate: '2026-07-31' },
  tolerance: 1,
  health: {
    scorePct: 78,
    overall: 'ATTENTION' as const,
    matchCount: 8,
    varianceCount: 2,
    unmappedCount: 1,
    totalAbsVariance: 250,
  },
  readyForCloseClaim: false,
  fullGstCompliant: false as const,
  lines: [
    {
      taxType: 'OUTPUT_CGST',
      mappingKey: 'GST_OUTPUT_CGST',
      label: 'Output CGST',
      status: 'MATCH',
      gstLedgerAmount: 9000,
      glNetAmount: 9000,
      variance: 0,
      message: 'Demo match',
    },
    {
      taxType: 'OUTPUT_SGST',
      mappingKey: 'GST_OUTPUT_SGST',
      label: 'Output SGST',
      status: 'VARIANCE',
      gstLedgerAmount: 9000,
      glNetAmount: 8850,
      variance: 150,
      message: 'Demo variance 150',
    },
    {
      taxType: 'INPUT_CGST',
      mappingKey: 'GST_INPUT_CGST',
      label: 'Input CGST',
      status: 'UNMAPPED',
      gstLedgerAmount: 500,
      glNetAmount: 0,
      variance: 500,
      message: 'Demo unmapped',
    },
  ],
  disclaimer: 'Demo GST vs GL recon fixture — not LIVE books.',
}

export async function getGlReconReport(filter?: PeriodFilterState) {
  if (!isApiMode()) return DEMO_GL_RECON
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGlReconReport({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load GL recon')
  return res.data as typeof DEMO_GL_RECON
}

export async function saveGlReconRun(filter?: PeriodFilterState, notes?: string | null) {
  if (!isApiMode()) throw new TaxComplianceServiceError('Save GL recon run requires API mode.')
  const f = filter ?? loadPeriodFilter()
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await createGlReconRunApi({
    legalEntityId: legalEntity.id,
    returnPeriod: returnPeriodFromFilter(f),
    notes,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to save GL recon run')
  return res.data
}

export async function getGlReconRuns() {
  if (!isApiMode()) return { items: [] as Array<Record<string, unknown>> }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchGlReconRuns({ legalEntityId: legalEntity.id })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to list GL recon runs')
  return res.data
}

// ─── Phase 15 — Compliance ops cockpit ───────────────────────────────────────

const DEMO_OPS_MATRIX = {
  phase: 15,
  verdict: 'READY_WITH_CONDITIONS',
  notFullGstCompliant: true as const,
  featureEnabled: true,
  capabilities: [
    {
      id: 'compliance_cockpit',
      label: 'GST compliance cockpit',
      status: 'READY' as const,
      notes: 'Demo fixture matrix',
    },
    {
      id: 'multi_period_health',
      label: 'Multi-period health',
      status: 'READY' as const,
      notes: 'Demo synthetic periods',
    },
    {
      id: 'portal_live',
      label: 'LIVE portal',
      status: 'NOT_IN_SCOPE' as const,
      notes: 'Never claimed from ops',
    },
  ],
}

function shiftPeriod(period: string, monthsBack: number): string {
  const [y, m] = period.split('-').map(Number)
  let yy = y
  let mm = m - monthsBack
  while (mm <= 0) {
    mm += 12
    yy -= 1
  }
  return `${yy}-${String(mm).padStart(2, '0')}`
}

export async function getOpsCapabilityMatrix() {
  if (!isApiMode()) return DEMO_OPS_MATRIX
  const res = await fetchOpsCapabilityMatrix()
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load ops matrix')
  return res.data
}

export async function getComplianceCockpit(filter?: PeriodFilterState) {
  const f = filter ?? loadPeriodFilter()
  const period = returnPeriodFromFilter(f)
  if (!isApiMode()) {
    return {
      returnPeriod: period,
      multiPeriod: {
        overallGrade: 'AT_RISK',
        averageScore: 72,
        periods: [
          {
            returnPeriod: period,
            grade: 'AT_RISK',
            score: 72,
            issues: [{ code: 'DEMO', severity: 'WARN', message: 'Demo mode — open API mode for live health' }],
          },
        ],
      },
      openWork: {
        openNotices: NOTICES_SEED.slice(0, 3).map((n, i) => ({
          id: `demo-n-${i}`,
          noticeRef: n.refNo,
          subject: n.summary,
          status: n.status,
        })),
        recentAuditPacks: [] as Array<Record<string, unknown>>,
      },
      notFullGstCompliant: true,
    }
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchComplianceCockpit({
    legalEntityId: legalEntity.id,
    returnPeriod: period,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load cockpit')
  return res.data as {
    multiPeriod?: {
      overallGrade?: string
      averageScore?: number
      periods?: Array<{
        returnPeriod: string
        grade: string
        score: number
        issues?: Array<{ code: string; severity: string; message: string }>
      }>
    }
    openWork?: {
      openNotices?: Array<Record<string, unknown>>
      recentAuditPacks?: Array<Record<string, unknown>>
    }
    [key: string]: unknown
  }
}

export async function getMultiPeriodHealth(filter?: PeriodFilterState) {
  const f = filter ?? loadPeriodFilter()
  const periodTo = returnPeriodFromFilter(f)
  const periodFrom = shiftPeriod(periodTo, 5)
  if (!isApiMode()) {
    return {
      periodFrom,
      periodTo,
      overallGrade: 'AT_RISK',
      averageScore: 72,
      periods: [{ returnPeriod: periodTo, grade: 'AT_RISK', score: 72, issues: [] as Array<{ message: string }> }],
      notFullGstCompliant: true as const,
    }
  }
  const legalEntity = await resolveDefaultLegalEntity()
  const res = await fetchMultiPeriodHealth({
    legalEntityId: legalEntity.id,
    periodFrom,
    periodTo,
  })
  if (!res.success || !res.data) throw new TaxComplianceServiceError(res.message || 'Failed to load multi-period health')
  return res.data as {
    periodFrom: string
    periodTo: string
    overallGrade: string
    averageScore: number
    periods: Array<{
      returnPeriod: string
      grade: string
      score: number
      issues?: Array<{ message: string }>
    }>
    notFullGstCompliant: true
  }
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
