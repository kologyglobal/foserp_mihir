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
