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
  SalesInvoiceDto,
  SalesInvoiceValidationPreview,
  UpdateSalesInvoiceInput,
} from '../../types/moneyIn'
import { apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const BASE = '/accounting/receivables'

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function listSalesInvoices(params: ListSalesInvoicesQuery) {
  return apiRequest<SalesInvoiceDto[]>(`${tenantPath(`${BASE}/invoices`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`)
}

export async function getSalesInvoice(id: string) {
  return apiRequest<SalesInvoiceDto>(tenantPath(`${BASE}/invoices/${id}`))
}

export async function createSalesInvoice(data: CreateSalesInvoiceInput) {
  return apiRequest<SalesInvoiceDto>(tenantPath(`${BASE}/invoices`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSalesInvoice(id: string, data: UpdateSalesInvoiceInput) {
  return apiRequest<SalesInvoiceDto>(tenantPath(`${BASE}/invoices/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function validateSalesInvoice(id: string) {
  return apiRequest<SalesInvoiceValidationPreview>(tenantPath(`${BASE}/invoices/${id}/validate`), { method: 'POST' })
}

export async function markSalesInvoiceReady(id: string) {
  return apiRequest<SalesInvoiceDto>(tenantPath(`${BASE}/invoices/${id}/mark-ready`), { method: 'POST' })
}

export async function cancelSalesInvoice(id: string, cancellationReason: string) {
  return apiRequest<SalesInvoiceDto>(tenantPath(`${BASE}/invoices/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ cancellationReason }),
  })
}

export async function postSalesInvoice(id: string) {
  return apiRequest<PostSalesInvoiceResult>(tenantPath(`${BASE}/invoices/${id}/post`), { method: 'POST', body: '{}' })
}

// ─── Reporting ──────────────────────────────────────────────────────────────

export async function getReceivableOverview(params: { legalEntityId: string; reportDate?: string }) {
  return apiRequest<ReceivableOverviewDto>(`${tenantPath(`${BASE}/overview`)}${buildQuery(params)}`)
}

export async function listOutstanding(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PaginatedResult<OutstandingOpenItemDto>>(`${tenantPath(`${BASE}/outstanding`)}${buildQuery(params)}`)
}

export async function getAgeingReport(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<AgeingReportDto>(`${tenantPath(`${BASE}/ageing`)}${buildQuery(params)}`)
}

export async function listCustomerSummaries(params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PaginatedResult<CustomerReceivableDetailDto>>(`${tenantPath(`${BASE}/customers`)}${buildQuery(params)}`)
}

export async function getCustomerSummary(customerId: string, params: { legalEntityId: string; reportDate?: string }) {
  return apiRequest<CustomerReceivableDetailDto>(
    `${tenantPath(`${BASE}/customers/${customerId}`)}${buildQuery(params)}`,
  )
}

export async function listCustomerOpenItems(customerId: string, params: Record<string, string | number | boolean | undefined>) {
  return apiRequest<PaginatedResult<OutstandingOpenItemDto>>(
    `${tenantPath(`${BASE}/customers/${customerId}/open-items`)}${buildQuery(params)}`,
  )
}

export async function getReconciliation(params: { legalEntityId: string; asOfDate?: string }) {
  return apiRequest<ReceivableReconciliationDto>(`${tenantPath(`${BASE}/reconciliation`)}${buildQuery(params)}`)
}
