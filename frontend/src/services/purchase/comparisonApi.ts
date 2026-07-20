import { apiRequest, tenantPath } from '../api/client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const base = () => tenantPath('/purchase/comparisons')

export type ApiComparisonVendorMatrixRow = {
  vendorId: string
  quotationId: string
  quotationNumber: string
  basicRateTotal: number
  discountAmount: number
  taxAmount: number
  freightAmount: number
  otherCharges: number
  landedCost: number
  deliveryLeadDays: number | null
  paymentTerms: string | null
  warranty: string | null
  validUntil: string | null
  isAwarded: boolean
}

export type ApiVendorComparison = {
  id: string
  comparisonNumber: string
  comparisonDate: string | null
  requestForQuotationId: string
  status: string
  awardedVendorId: string | null
  awardedVendorQuotationId: string | null
  selectionReason: string | null
  awardedById: string | null
  selectedAt: string | null
  remarks: string | null
  vendors?: ApiComparisonVendorMatrixRow[]
  lines?: Array<Record<string, unknown>>
  createdAt: string | null
  updatedAt: string | null
}

export async function listComparisonsApi(filters: Record<string, string | number | undefined> = {}) {
  return apiRequest<ApiVendorComparison[]>(`${base()}${buildQuery(filters)}`)
}

export async function getComparisonApi(id: string) {
  return apiRequest<ApiVendorComparison>(`${base()}/${id}`)
}

export async function buildComparisonApi(payload: { requestForQuotationId: string }) {
  return apiRequest<ApiVendorComparison>(base(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function awardComparisonApi(
  id: string,
  payload: { awardedVendorQuotationId: string; selectionReason: string },
) {
  return apiRequest<ApiVendorComparison>(`${base()}/${id}/award`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createPoFromComparisonApi(id: string) {
  return apiRequest<{
    id: string
    orderNumber: string
    orderDate: string | null
    vendorId: string
    status: string
    origin: string
    requestForQuotationId: string | null
    vendorQuotationId: string | null
    vendorComparisonId: string | null
    purchaseRequisitionId: string | null
    totalAmount: number
  }>(`${base()}/${id}/create-po`, { method: 'POST', body: JSON.stringify({}) })
}
