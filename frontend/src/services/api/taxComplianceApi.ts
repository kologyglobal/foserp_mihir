/**
 * GST / Tax Compliance Phase 1 — read-only extract API client.
 */
import { apiRequest, tenantPath, type ApiResponse } from './client'

export type GstSupplyExtractDto = {
  id: string
  documentNumber: string
  documentDate: string
  invoiceDate: string
  postingDate: string | null
  partyName: string
  partyGstin: string | null
  placeOfSupply: string | null
  stateCode: string | null
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalAmount: string
  supplyType: string | null
  taxTreatment: string | null
  currencyCode: string
  reverseCharge: boolean
}

export type GstExtractSummaryDto = {
  documentCount: number
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  totalAmount: string
}

export type GstExtractListDto = {
  fromDate: string
  toDate: string
  legalEntityId: string
  items: GstSupplyExtractDto[]
  summary: GstExtractSummaryDto
}

export type GstComplianceSummaryDto = {
  fromDate: string
  toDate: string
  legalEntityId: string
  outward: GstExtractSummaryDto
  inward: GstExtractSummaryDto
}

export type GstExtractQuery = {
  legalEntityId: string
  fromDate: string
  toDate: string
  page?: number
  pageSize?: number
  search?: string
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const BASE = '/accounting/tax-compliance'

export async function fetchOutwardSupplies(params: GstExtractQuery): Promise<ApiResponse<GstExtractListDto>> {
  return apiRequest<GstExtractListDto>(
    `${tenantPath(`${BASE}/outward-supplies`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
      search: params.search,
    })}`,
  )
}

export async function fetchInwardSupplies(params: GstExtractQuery): Promise<ApiResponse<GstExtractListDto>> {
  return apiRequest<GstExtractListDto>(
    `${tenantPath(`${BASE}/inward-supplies`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
      search: params.search,
    })}`,
  )
}

export async function fetchGstComplianceSummary(params: {
  legalEntityId: string
  fromDate: string
  toDate: string
}): Promise<ApiResponse<GstComplianceSummaryDto>> {
  return apiRequest<GstComplianceSummaryDto>(
    `${tenantPath(`${BASE}/summary`)}${buildQuery(params)}`,
  )
}

export type GstEInvoiceDto = {
  id: string
  legalEntityId: string
  salesInvoiceId: string
  invoiceNumber: string | null
  invoiceDate: string
  customerName: string
  customerGstin: string | null
  taxableAmount: string
  taxAmount: string
  totalAmount: string
  status: string
  irn: string | null
  ackNo: string | null
  ackDate: string | null
  cancelReason: string | null
  cancelledAt: string | null
  exceptionMessage: string | null
  providerMode: string
  createdAt: string
  updatedAt: string
}

export type GstEWayBillDto = {
  id: string
  legalEntityId: string
  sourceType: string
  salesInvoiceId: string | null
  deliveryChallanId: string | null
  outboundDispatchId?: string | null
  documentNumber: string
  documentDate: string
  partyName: string
  partyGstin: string | null
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber: string | null
  transporterName: string | null
  transporterId?: string | null
  taxableAmount: string
  status: string
  ewbNumber: string | null
  generatedAt?: string | null
  validUpto: string | null
  requiredReason?: string | null
  movementReason?: string | null
  cancelReason: string | null
  cancelledAt: string | null
  exceptionMessage: string | null
  providerMode: string
  providerRef?: string | null
  lastRequestJson?: unknown
  lastResponseJson?: unknown
  createdAt: string
  updatedAt: string
}

export type EWayPanelDto = {
  required: boolean
  reason: string | null
  thresholdInr: number
  taxableAmount: string
  deliveryChallanId: string | null
  outboundDispatchId: string | null
  dispatchNo?: string | null
  challanNumber?: string | null
  challanStatus?: string | null
  vehicleNumber?: string | null
  transporterName?: string | null
  destination?: string | null
  ewayBill: GstEWayBillDto | null
  canGenerate: boolean
  message?: string
}

export async function fetchEInvoices(params: GstExtractQuery): Promise<ApiResponse<{ items: GstEInvoiceDto[] }>> {
  return apiRequest<{ items: GstEInvoiceDto[] }>(
    `${tenantPath(`${BASE}/e-invoices`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
      search: params.search,
    })}`,
  )
}

export async function generateEInvoiceApi(salesInvoiceId: string): Promise<ApiResponse<{ item: GstEInvoiceDto; idempotentReplay: boolean }>> {
  return apiRequest<{ item: GstEInvoiceDto; idempotentReplay: boolean }>(
    `${tenantPath(`${BASE}/e-invoices/generate`)}`,
    { method: 'POST', body: JSON.stringify({ salesInvoiceId }) },
  )
}

export async function cancelEInvoiceApi(
  id: string,
  reason: string,
): Promise<ApiResponse<GstEInvoiceDto>> {
  return apiRequest<GstEInvoiceDto>(`${tenantPath(`${BASE}/e-invoices/${id}/cancel`)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function fetchEWayBills(params: GstExtractQuery): Promise<ApiResponse<{ items: GstEWayBillDto[] }>> {
  return apiRequest<{ items: GstEWayBillDto[] }>(
    `${tenantPath(`${BASE}/e-way-bills`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
      search: params.search,
    })}`,
  )
}

export type GenerateEWayBillPayload = {
  sourceType: 'SALES_INVOICE' | 'DELIVERY_CHALLAN'
  salesInvoiceId?: string
  deliveryChallanId?: string
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber?: string | null
  transporterName?: string | null
  transporterId?: string | null
  movementReason?: string | null
  force?: boolean
}

export async function generateEWayBillApi(
  payload: GenerateEWayBillPayload,
): Promise<ApiResponse<{ item: GstEWayBillDto; idempotentReplay: boolean }>> {
  return apiRequest<{ item: GstEWayBillDto; idempotentReplay: boolean }>(
    `${tenantPath(`${BASE}/e-way-bills/generate`)}`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function cancelEWayBillApi(id: string, reason: string): Promise<ApiResponse<GstEWayBillDto>> {
  return apiRequest<GstEWayBillDto>(`${tenantPath(`${BASE}/e-way-bills/${id}/cancel`)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function fetchEWayPanel(params: {
  deliveryChallanId?: string
  outboundDispatchId?: string
}): Promise<ApiResponse<EWayPanelDto>> {
  return apiRequest<EWayPanelDto>(
    `${tenantPath(`${BASE}/e-way-bills/panel`)}${buildQuery({
      deliveryChallanId: params.deliveryChallanId,
      outboundDispatchId: params.outboundDispatchId,
    })}`,
  )
}

export async function updateEWayVehicleApi(
  id: string,
  payload: { vehicleNumber: string; fromPlace?: string | null; reasonCode?: string | null },
): Promise<ApiResponse<GstEWayBillDto>> {
  return apiRequest<GstEWayBillDto>(`${tenantPath(`${BASE}/e-way-bills/${id}/update-vehicle`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getEWayBillApi(id: string): Promise<ApiResponse<GstEWayBillDto>> {
  return apiRequest<GstEWayBillDto>(`${tenantPath(`${BASE}/e-way-bills/${id}`)}`)
}

// ─── Phase 4 — Reverse charge register ───────────────────────────────────────

export type RcmRegisterEntryDto = {
  id: string
  legalEntityId: string
  vendorInvoiceId: string
  returnPeriod: string
  documentNumber: string
  documentDate: string
  vendorId: string
  vendorName: string
  vendorGstin: string | null
  placeOfSupply: string | null
  taxableValue: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  recoverableTaxAmount: string
  itcEligibility: string | null
  status: string
  glInputTaxBookedAtPost: boolean
  liabilityPaidAt: string | null
  liabilityPaidBy: string | null
  liabilityPaidDate: string | null
  liabilityPaymentRef: string | null
  liabilityPaidNotes: string | null
  itcRecognizedAt: string | null
  itcRecognizedBy: string | null
  itcClaimNotes: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  notes: string | null
  itcGate?: { claimBlocked: boolean; reasons: string[] }
}

export type RcmRegisterListDto = {
  legalEntityId: string
  returnPeriod: string | null
  items: RcmRegisterEntryDto[]
  disclaimer?: string
}

export async function fetchRcmRegister(params: {
  legalEntityId: string
  returnPeriod?: string
  fromDate?: string
  toDate?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<RcmRegisterListDto>> {
  return apiRequest<RcmRegisterListDto>(
    `${tenantPath(`${BASE}/rcm-register`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      fromDate: params.fromDate,
      toDate: params.toDate,
      status: params.status,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
    })}`,
  )
}

export async function markRcmLiabilityPaidApi(
  id: string,
  payload: { liabilityPaidDate: string; liabilityPaymentRef?: string | null; notes?: string | null },
): Promise<ApiResponse<RcmRegisterEntryDto>> {
  return apiRequest<RcmRegisterEntryDto>(`${tenantPath(`${BASE}/rcm-register/${id}/mark-liability-paid`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function recognizeRcmItcApi(
  id: string,
  payload?: { notes?: string | null },
): Promise<ApiResponse<RcmRegisterEntryDto>> {
  return apiRequest<RcmRegisterEntryDto>(`${tenantPath(`${BASE}/rcm-register/${id}/recognize-itc`)}`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

export async function markRcmItcNotClaimableApi(
  id: string,
  payload?: { notes?: string | null },
): Promise<ApiResponse<RcmRegisterEntryDto>> {
  return apiRequest<RcmRegisterEntryDto>(`${tenantPath(`${BASE}/rcm-register/${id}/mark-not-claimable`)}`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

// ─── Phase 3 — GSTR-2B / ITC ────────────────────────────────────────────────

export type Gstr2bBatchDto = {
  id: string
  legalEntityId: string
  returnPeriod: string
  source: string
  fileName: string | null
  providerMode: string
  status: string
  rowCount: number
  matchedCount: number
  mismatchCount: number
  missingInBooks: number
  missingIn2b: number
  payloadChecksum: string | null
  importNotes: string | null
  importedAt: string
  importedBy: string | null
  reconciledAt: string | null
  reconciledBy: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
  updatedAt: string
}

export type Gstr2bRowDto = {
  id: string
  batchId: string
  lineNo: number
  supplierGstin: string
  supplierName: string | null
  invoiceNumber: string
  invoiceNumberNorm: string
  invoiceDate: string
  taxableValue: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  placeOfSupply: string | null
  documentTypeHint: string | null
  matchStatus: string
  matchScore: number
  matchedVendorInvoiceId: string | null
  matchNotes: string | null
  itcClaimClass: string
  createdAt: string
  updatedAt: string
}

export type Gstr2bImportRowPayload = {
  supplierGstin: string
  supplierName?: string | null
  invoiceNumber: string
  invoiceDate: string
  taxableValue: number
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
  cessAmount?: number
  placeOfSupply?: string | null
  documentTypeHint?: string | null
}

export type Gstr2bFollowUpDto = {
  id: string
  legalEntityId: string
  batchId: string | null
  rowId: string | null
  vendorInvoiceId: string | null
  vendorId: string | null
  vendorGstin: string | null
  vendorName: string | null
  reasonCode: string
  status: string
  notes: string | null
  assignedToUserId: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
  updatedAt: string
}

export type Gstr2bReconSummaryDto = {
  batch: Gstr2bBatchDto
  byMatchStatus: Record<string, number>
  byItcClaimClass: Record<string, number>
  taxTotals: {
    matchedTax: string
    mismatchTax: string
    gstr2bOnlyTax: string
    booksOnlyEstimated: string
  }
  pendingReviewCount: number
  openFollowUpCount: number
  autoClaimBlocked: true
}

export async function listGstr2bBatchesApi(params: {
  legalEntityId: string
  returnPeriod?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ items: Gstr2bBatchDto[] }>> {
  return apiRequest<{ items: Gstr2bBatchDto[] }>(
    `${tenantPath(`${BASE}/gstr2b/batches`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      status: params.status,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    })}`,
  )
}

export async function importGstr2bBatchApi(payload: {
  legalEntityId: string
  returnPeriod: string
  source?: string
  fileName?: string | null
  providerMode?: string
  importNotes?: string | null
  rows: Gstr2bImportRowPayload[]
}): Promise<ApiResponse<{ batch: Gstr2bBatchDto; disclaimer: string }>> {
  return apiRequest<{ batch: Gstr2bBatchDto; disclaimer: string }>(
    `${tenantPath(`${BASE}/gstr2b/batches`)}`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function listGstr2bRowsApi(
  batchId: string,
  params?: { matchStatus?: string; search?: string; page?: number; pageSize?: number },
): Promise<ApiResponse<{ batchId: string; status: string; items: Gstr2bRowDto[] }>> {
  return apiRequest<{ batchId: string; status: string; items: Gstr2bRowDto[] }>(
    `${tenantPath(`${BASE}/gstr2b/batches/${batchId}/rows`)}${buildQuery({
      matchStatus: params?.matchStatus,
      search: params?.search,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 200,
    })}`,
  )
}

export async function reconcileGstr2bBatchApi(
  batchId: string,
  openFollowUps = true,
): Promise<
  ApiResponse<{
    batch: Gstr2bBatchDto
    followUpsOpened: number
    autoClaimBlocked: true
    disclaimer: string
  }>
> {
  return apiRequest(`${tenantPath(`${BASE}/gstr2b/batches/${batchId}/reconcile`)}`, {
    method: 'POST',
    body: JSON.stringify({ openFollowUps }),
  })
}

export async function getGstr2bReconSummaryApi(
  batchId: string,
): Promise<ApiResponse<Gstr2bReconSummaryDto>> {
  return apiRequest<Gstr2bReconSummaryDto>(
    `${tenantPath(`${BASE}/gstr2b/batches/${batchId}/summary`)}`,
  )
}

export async function voidGstr2bBatchApi(
  batchId: string,
  reason: string,
): Promise<ApiResponse<Gstr2bBatchDto>> {
  return apiRequest<Gstr2bBatchDto>(`${tenantPath(`${BASE}/gstr2b/batches/${batchId}/void`)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function listGstr2bFollowUpsApi(params: {
  legalEntityId: string
  batchId?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ items: Gstr2bFollowUpDto[] }>> {
  return apiRequest<{ items: Gstr2bFollowUpDto[] }>(
    `${tenantPath(`${BASE}/gstr2b/follow-ups`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      batchId: params.batchId,
      status: params.status,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 100,
    })}`,
  )
}

export async function updateGstr2bFollowUpApi(
  followUpId: string,
  payload: { status?: string; notes?: string | null; assignedToUserId?: string | null },
): Promise<ApiResponse<Gstr2bFollowUpDto>> {
  return apiRequest<Gstr2bFollowUpDto>(`${tenantPath(`${BASE}/gstr2b/follow-ups/${followUpId}`)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

// ─── Phase 5 — Registers & GSTR-1 / 3B preparation ───────────────────────────

export type GstRegisterKind =
  | 'SALES'
  | 'PURCHASE'
  | 'CN_DN'
  | 'RCM'
  | 'EXPORT_SEZ'
  | 'HSN'
  | 'STATE'
  | 'LIABILITY'
  | 'ITC'
  | 'PAYMENT_SUMMARY'

export type GstrReturnPeriodDto = {
  id: string
  legalEntityId: string
  companyGstin: string
  returnPeriod: string
  returnType: 'GSTR-1' | 'GSTR-3B'
  status: 'OPEN' | 'DRAFT' | 'LOCKED' | 'MARKED_FILED_EXTERNAL'
  preparedAt: string | null
  lockedAt: string | null
  markedFiledAt: string | null
  acknowledgmentRef: string | null
  filedOnPortalDate: string | null
  remarks: string | null
  draftVersion: number
  sourceImmutable: boolean
  disclaimer: string
  readinessLabel: string
}

export type GstrReturnPrepResponse = {
  period: GstrReturnPeriodDto
  preparation: {
    outwardTaxable?: number
    taxLiability?: number
    itcAvailable?: number
    netPayable?: number
    frozen?: boolean
    disclaimer?: string
    [key: string]: unknown
  }
}

export async function fetchGstRegister(params: {
  legalEntityId: string
  returnPeriod: string
  kind: GstRegisterKind
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/registers`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      kind: params.kind,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export async function fetchGstrReturnPrep(params: {
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR-1' | 'GSTR-3B'
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string
}): Promise<ApiResponse<GstrReturnPrepResponse>> {
  const rt = params.returnType.replace('-', '')
  return apiRequest(
    `${tenantPath(`${BASE}/returns/${rt}`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export async function prepareGstrReturnApi(params: {
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR-1' | 'GSTR-3B'
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}): Promise<ApiResponse<GstrReturnPrepResponse>> {
  const rt = params.returnType.replace('-', '')
  return apiRequest(`${tenantPath(`${BASE}/returns/${rt}/prepare`)}`, {
    method: 'POST',
    body: JSON.stringify({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    }),
  })
}

export async function lockGstrReturnApi(params: {
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR-1' | 'GSTR-3B'
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
}): Promise<ApiResponse<GstrReturnPrepResponse>> {
  const rt = params.returnType.replace('-', '')
  return apiRequest(`${tenantPath(`${BASE}/returns/${rt}/lock`)}`, {
    method: 'POST',
    body: JSON.stringify({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    }),
  })
}

export async function unlockGstrReturnApi(params: {
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR-1' | 'GSTR-3B'
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  reason: string
}): Promise<ApiResponse<GstrReturnPrepResponse>> {
  const rt = params.returnType.replace('-', '')
  return apiRequest(`${tenantPath(`${BASE}/returns/${rt}/unlock`)}`, {
    method: 'POST',
    body: JSON.stringify({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
      reason: params.reason,
    }),
  })
}

export async function markGstrFiledExternalApi(params: {
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR-1' | 'GSTR-3B'
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  acknowledgmentRef: string
  filedOnPortalDate: string
  remarks?: string | null
}): Promise<ApiResponse<GstrReturnPrepResponse>> {
  const rt = params.returnType.replace('-', '')
  return apiRequest(`${tenantPath(`${BASE}/returns/${rt}/mark-filed-external`)}`, {
    method: 'POST',
    body: JSON.stringify({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
      acknowledgmentRef: params.acknowledgmentRef,
      filedOnPortalDate: params.filedOnPortalDate,
      remarks: params.remarks,
    }),
  })
}

// ─── Phase 8 — GST payment challans ──────────────────────────────────────────

export type GstPaymentChallanDto = {
  id: string
  legalEntityId: string
  companyGstin: string
  returnPeriod: string
  status: string
  totalLiability: string
  totalItc: string
  netTaxPayable: string
  interestAmount: string
  lateFeeAmount: string
  totalPayable: string
  cpin: string | null
  challanNumber: string | null
  bankReference: string | null
  paymentDate: string | null
  accountingVoucherId: string | null
  disclaimer?: string
}

export async function fetchGstPaymentChallans(params: {
  legalEntityId: string
  returnPeriod?: string
  companyGstin?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ items: GstPaymentChallanDto[] }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/payments`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    })}`,
  )
}

export async function previewGstPaymentApi(body: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  interestAmount?: number
  lateFeeAmount?: number
  roundOffAmount?: number
}): Promise<ApiResponse<{ companyGstin: string; returnPeriod: string; proposal: unknown; ledgerRowCount: number }>> {
  return apiRequest(`${tenantPath(`${BASE}/payments/preview`)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function proposeGstPaymentApi(body: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  interestAmount?: number
  lateFeeAmount?: number
  roundOffAmount?: number
  remarks?: string | null
}): Promise<ApiResponse<GstPaymentChallanDto>> {
  return apiRequest(`${tenantPath(`${BASE}/payments/propose`)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function confirmGstPaymentApi(
  id: string,
  body: {
    paymentDate: string
    cpin?: string | null
    challanNumber?: string | null
    bankReference?: string | null
    remarks?: string | null
  },
): Promise<ApiResponse<GstPaymentChallanDto>> {
  return apiRequest(`${tenantPath(`${BASE}/payments/${id}/confirm-external`)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postGstPaymentGlApi(
  id: string,
  body: { bankAccountId: string; postingDate?: string },
): Promise<ApiResponse<GstPaymentChallanDto>> {
  return apiRequest(`${tenantPath(`${BASE}/payments/${id}/post-gl`)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function closeGstPaymentPeriodApi(id: string): Promise<ApiResponse<GstPaymentChallanDto>> {
  return apiRequest(`${tenantPath(`${BASE}/payments/${id}/close-period`)}`, { method: 'POST', body: JSON.stringify({}) })
}

export async function voidGstPaymentApi(id: string, reason: string): Promise<ApiResponse<GstPaymentChallanDto>> {
  return apiRequest(`${tenantPath(`${BASE}/payments/${id}/void`)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

// ─── Phase 10 — Export / SEZ / LUT ────────────────────────────────────────────

export type GstLutDto = {
  id: string
  lutNumber: string
  companyGstin: string | null
  financialYearLabel: string | null
  validFrom: string | null
  validTo: string | null
  status: string
  isActive: boolean
  notes: string | null
}

export async function fetchGstLuts(legalEntityId: string): Promise<ApiResponse<{ legalEntityId: string; items: GstLutDto[] }>> {
  return apiRequest(`${tenantPath(`${BASE}/export/luts`)}${buildQuery({ legalEntityId })}`)
}

export async function upsertGstLutApi(body: {
  id?: string | null
  legalEntityId: string
  companyGstin?: string | null
  lutNumber: string
  financialYearLabel?: string | null
  validFrom: string
  validTo?: string | null
  status?: string
  isActive?: boolean
  notes?: string | null
}): Promise<ApiResponse<unknown>> {
  return apiRequest(`${tenantPath(`${BASE}/export/luts`)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type GstExportRegisterDocDto = {
  documentId: string
  documentNumber: string
  documentDate: string
  taxTreatment: string | null
  supplyType: string | null
  placeOfSupply: string | null
  zeroRatedMode: string | null
  partyGstin: string | null
  taxableValue: number
  totalTax: number
}

export async function fetchExportSezRegister(params: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string
}): Promise<
  ApiResponse<{
    items: GstExportRegisterDocDto[]
    partition: { wpayCount: number; wopayCount: number; otherCount: number }
  }>
> {
  return apiRequest(
    `${tenantPath(`${BASE}/export/register`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export type GstExportRefundClaimDto = {
  id: string
  returnPeriod: string
  claimType: string
  status: string
  taxableValue: string
  igstAmount: string
  currencyCode: string
  externalArn: string | null
  notes: string | null
  companyGstin: string | null
}

export async function fetchExportRefundClaims(params: {
  legalEntityId: string
  returnPeriod?: string
}): Promise<ApiResponse<{ items: GstExportRefundClaimDto[] }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/export/refund-claims`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
    })}`,
  )
}

export async function proposeExportRefundClaimApi(body: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  notes?: string | null
}): Promise<ApiResponse<unknown>> {
  return apiRequest(`${tenantPath(`${BASE}/export/refund-claims/propose`)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── Phase 11 — Special schemes ───────────────────────────────────────────────

export type GstSpecialCapabilityDto = {
  id: string
  label: string
  status: 'READY' | 'PARTIAL' | 'DEFERRED' | 'NOT_IN_SCOPE'
  notes: string
}

export type GstSpecialsMatrixDto = {
  phase: number
  verdict: string
  notFullGstCompliant: boolean
  featureEnabled: boolean
  capabilities: GstSpecialCapabilityDto[]
}

export async function fetchSpecialsCapabilityMatrix(): Promise<ApiResponse<GstSpecialsMatrixDto>> {
  return apiRequest(`${tenantPath(`${BASE}/specials/capability-matrix`)}`)
}

export async function fetchNilExemptRegister(params: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>>; total: number }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/specials/nil-exempt`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
      page: params.page,
      pageSize: params.pageSize,
    })}`,
  )
}

export async function fetchGstWithholding(params: {
  legalEntityId: string
  returnPeriod?: string
  kind?: string
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>>; total: number; note?: string }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/specials/withholding`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      kind: params.kind,
    })}`,
  )
}

export async function fetchGstAdvances(params: {
  legalEntityId: string
  returnPeriod?: string
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>>; total: number; note?: string }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/specials/advances`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
    })}`,
  )
}

export async function fetchCompositionGates(legalEntityId: string): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/specials/composition-gates`)}${buildQuery({ legalEntityId })}`,
  )
}

// ─── Phase 13 — Go-live / hardening ──────────────────────────────────────────

export async function fetchHardeningCapabilityMatrix(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/hardening/capability-matrix`)}`)
}

export async function fetchPeriodComplianceHealth(params: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/hardening/period-health`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export async function fetchGoLiveGate(params: {
  legalEntityId: string
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/hardening/go-live-gate`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      companyGstin: params.companyGstin,
    })}`,
  )
}

// ─── Phase 12 — Portal filing sessions (SIMULATED) ───────────────────────────

export type GstrFilingSessionDto = {
  id: string
  legalEntityId: string
  companyGstin: string
  returnPeriod: string
  returnType: string
  returnPeriodId: string
  status: string
  providerMode: string
  packageVersion: number
  package?: unknown
  request?: unknown
  response?: unknown
  acknowledgmentRef: string | null
  filedOnPortalDate: string | null
  providerRef: string | null
  failureMessage: string | null
  makerUserId: string | null
  checkerUserId: string | null
  submittedAt: string | null
  submittedBy: string | null
  acceptedAt: string | null
  markedFiledAt: string | null
  markedFiledBy: string | null
  remarks: string | null
  readinessLabel?: string
  disclaimer?: string
  createdAt: string
  updatedAt: string
}

export type GstrFilingCapabilityDto = {
  providerMode: string
  isSimulated: boolean
  liveReady: boolean
  liveBlockers: string[]
  verdict: string
  notFullGstCompliant: boolean
  note: string
}

export async function fetchGstrFilingCapability(): Promise<ApiResponse<GstrFilingCapabilityDto>> {
  return apiRequest(`${tenantPath(`${BASE}/filing/capability`)}`)
}

export async function fetchGstrFilingSessions(params: {
  legalEntityId: string
  returnPeriod?: string
  companyGstin?: string
  returnType?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ items: GstrFilingSessionDto[] }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/filing/sessions`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
      returnType: params.returnType,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    })}`,
  )
}

export async function createGstrFilingPackageApi(payload: {
  legalEntityId: string
  returnPeriod: string
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR-1' | 'GSTR-3B'
  companyGstin?: string | null
  requireChecker?: boolean
  remarks?: string | null
}): Promise<ApiResponse<GstrFilingSessionDto>> {
  return apiRequest(`${tenantPath(`${BASE}/filing/sessions`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function submitGstrFilingSessionApi(id: string): Promise<ApiResponse<GstrFilingSessionDto>> {
  return apiRequest(`${tenantPath(`${BASE}/filing/sessions/${id}/submit`)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function approveGstrFilingCheckerApi(
  id: string,
  remarks?: string | null,
): Promise<ApiResponse<GstrFilingSessionDto>> {
  return apiRequest(`${tenantPath(`${BASE}/filing/sessions/${id}/approve-checker`)}`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  })
}

export async function captureGstrFilingArnApi(
  id: string,
  payload: { acknowledgmentRef: string; filedOnPortalDate: string; remarks?: string | null },
): Promise<ApiResponse<GstrFilingSessionDto>> {
  return apiRequest(`${tenantPath(`${BASE}/filing/sessions/${id}/capture-arn`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function markGstrFilingFiledApi(
  id: string,
  remarks?: string | null,
): Promise<ApiResponse<GstrFilingSessionDto>> {
  return apiRequest(`${tenantPath(`${BASE}/filing/sessions/${id}/mark-filed`)}`, {
    method: 'POST',
    body: JSON.stringify({ remarks }),
  })
}

// ─── Phase 16 — Rate master ops ──────────────────────────────────────────────

export type GstRateOpsHealthDto = {
  overall: string
  scorePct: number
  gapCount: number
  expiringCount: number
  overlapCount: number
  driftCount: number
  criticalDriftCount: number
  notFullGstCompliant: true
  readinessLabel: string
  disclaimer: string
}

export async function fetchRateOpsCapability(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/rate-ops/capability`)}`)
}

export async function fetchRateOpsCoverage(params?: {
  asOfDate?: string
  horizonDays?: number
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/rate-ops/coverage`)}${buildQuery({
      asOfDate: params?.asOfDate,
      horizonDays: params?.horizonDays,
    })}`,
  )
}

export async function fetchRateOpsReport(params: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/rate-ops/report`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export async function createRateOpsRunApi(payload: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string | null
  notes?: string | null
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/rate-ops/runs`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchRateOpsRuns(params: {
  legalEntityId: string
  page?: number
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>> }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/rate-ops/runs`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      page: params.page,
    })}`,
  )
}

// ─── Phase 17 — Data quality / GSTIN backfill / freeze ───────────────────────

export async function fetchDataQualityFreeze(params: {
  legalEntityId: string
  returnPeriod: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/data-quality/freeze-readiness`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
    })}`,
  )
}

export async function fetchDataQualityScan(params: {
  legalEntityId: string
  returnPeriod: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/data-quality/scan`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
    })}`,
  )
}

export async function postDataQualityBackfillDryRun(payload: {
  legalEntityId: string
  returnPeriod: string
  limit?: number
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/data-quality/backfill/dry-run`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function postDataQualityBackfillApply(payload: {
  legalEntityId: string
  returnPeriod: string
  limit?: number
  confirm: true
  notes?: string | null
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/data-quality/backfill/apply`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createDataQualityRunApi(payload: {
  legalEntityId: string
  returnPeriod: string
  notes?: string | null
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/data-quality/runs`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchDataQualityRuns(params: {
  legalEntityId: string
  page?: number
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>> }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/data-quality/runs`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      page: params.page,
    })}`,
  )
}

// ─── Phase 18 — GST vs GL control recon ──────────────────────────────────────

export async function fetchGlReconReport(params: {
  legalEntityId: string
  returnPeriod: string
  tolerance?: number
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/gl-recon/report`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      tolerance: params.tolerance,
    })}`,
  )
}

export async function createGlReconRunApi(payload: {
  legalEntityId: string
  returnPeriod: string
  tolerance?: number
  notes?: string | null
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/gl-recon/runs`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchGlReconRuns(params: {
  legalEntityId: string
  page?: number
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>> }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/gl-recon/runs`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      page: params.page,
    })}`,
  )
}

// ─── Phase 14 — Annual worksheet / FY cockpit / multi-year archive ───────────

export async function fetchPhase14CapabilityMatrix(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/annual/capability-matrix`)}`)
}

export async function fetchAnnualFyCockpit(params: {
  legalEntityId: string
  financialYear?: string
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/annual/cockpit`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      financialYear: params.financialYear,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export async function fetchAnnualReturns(params: {
  legalEntityId: string
  financialYear?: string
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>> }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/annual/returns`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      financialYear: params.financialYear,
    })}`,
  )
}

export async function fetchAnnualReturn(params: {
  legalEntityId: string
  financialYear: string
  returnType?: string
}): Promise<ApiResponse<{ item: Record<string, unknown> | null; livePreview: Record<string, unknown> | null }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/annual/return`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      financialYear: params.financialYear,
      returnType: params.returnType,
    })}`,
  )
}

export async function prepareAnnualReturnApi(payload: {
  legalEntityId: string
  financialYear: string
  returnType?: string
  remarks?: string | null
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/annual/returns/prepare`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function lockAnnualReturnApi(payload: {
  legalEntityId: string
  financialYear: string
  returnType?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/annual/returns/lock`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function markAnnualFiledExternalApi(payload: {
  legalEntityId: string
  financialYear: string
  acknowledgmentRef: string
  filedOnPortalDate?: string | null
  returnType?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/annual/returns/mark-filed-external`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function archiveFinancialYearApi(payload: {
  legalEntityId: string
  financialYear: string
  notes?: string | null
  retainUntil?: string | null
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`${tenantPath(`${BASE}/annual/fy-archives`)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchFyArchives(params: {
  legalEntityId: string
  financialYear?: string
}): Promise<ApiResponse<{ items: Array<Record<string, unknown>> }>> {
  return apiRequest(
    `${tenantPath(`${BASE}/annual/fy-archives`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      financialYear: params.financialYear,
    })}`,
  )
}

// ─── Phase 15 — Compliance ops cockpit ───────────────────────────────────────

export async function fetchOpsCapabilityMatrix(): Promise<ApiResponse<{
  phase: number
  verdict: string
  notFullGstCompliant: boolean
  featureEnabled: boolean
  capabilities: Array<{ id: string; label: string; status: string; notes: string }>
}>> {
  return apiRequest(`${tenantPath(`${BASE}/ops/capability-matrix`)}`)
}

export async function fetchComplianceCockpit(params: {
  legalEntityId: string
  returnPeriod: string
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/ops/cockpit`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      returnPeriod: params.returnPeriod,
      companyGstin: params.companyGstin,
    })}`,
  )
}

export async function fetchMultiPeriodHealth(params: {
  legalEntityId: string
  periodFrom: string
  periodTo: string
  companyGstin?: string
}): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(
    `${tenantPath(`${BASE}/ops/period-health`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
      companyGstin: params.companyGstin,
    })}`,
  )
}
