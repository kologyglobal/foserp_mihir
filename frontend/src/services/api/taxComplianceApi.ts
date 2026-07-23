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
  documentNumber: string
  documentDate: string
  partyName: string
  partyGstin: string | null
  fromPlace: string
  toPlace: string
  distanceKm: number
  vehicleNumber: string | null
  transporterName: string | null
  taxableAmount: string
  status: string
  ewbNumber: string | null
  validUpto: string | null
  cancelReason: string | null
  cancelledAt: string | null
  exceptionMessage: string | null
  providerMode: string
  createdAt: string
  updatedAt: string
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
