import type {
  AgeingReportDto,
  CreateCustomerCreditNoteInput,
  CreateSalesInvoiceInput,
  CreditNoteAllocationHistoryRow,
  CreditNoteAllocationPreview,
  CreditNoteAllocationRequest,
  CreditNoteAllocationResult,
  CreditNoteValidationPreview,
  CustomerCreditNoteDto,
  CustomerCreditNoteListItemDto,
  CustomerReceivableDetailDto,
  ListCustomerCreditNotesQuery,
  ListSalesInvoicesQuery,
  OutstandingOpenItemDto,
  PaginatedResult,
  PostCreditNoteResult,
  PostSalesInvoiceResult,
  ReceivableOverviewDto,
  ReceivableReconciliationDto,
  SalesInvoiceDto,
  SalesInvoiceValidationPreview,
  UpdateCustomerCreditNoteInput,
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

// ─── Credit notes ───────────────────────────────────────────────────────────

export async function listCustomerCreditNotes(params: ListCustomerCreditNotesQuery) {
  return apiRequest<CustomerCreditNoteListItemDto[]>(
    `${tenantPath(`${BASE}/credit-notes`)}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
}

export async function getCustomerCreditNote(id: string) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}`))
}

export async function createCustomerCreditNote(data: CreateCustomerCreditNoteInput) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCustomerCreditNote(id: string, data: UpdateCustomerCreditNoteInput) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function validateCustomerCreditNote(id: string) {
  return apiRequest<CreditNoteValidationPreview>(tenantPath(`${BASE}/credit-notes/${id}/validate`), { method: 'POST' })
}

export async function submitCustomerCreditNote(id: string, comments?: string) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}/submit`), {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export async function approveCustomerCreditNote(id: string, comments?: string) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export async function rejectCustomerCreditNote(id: string, comments?: string) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export async function markCustomerCreditNoteReady(id: string) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}/mark-ready`), { method: 'POST' })
}

export async function cancelCustomerCreditNote(id: string, cancellationReason: string) {
  return apiRequest<CustomerCreditNoteDto>(tenantPath(`${BASE}/credit-notes/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ cancellationReason }),
  })
}

export async function postCustomerCreditNote(id: string) {
  return apiRequest<PostCreditNoteResult>(tenantPath(`${BASE}/credit-notes/${id}/post`), { method: 'POST', body: '{}' })
}

// ─── Credit note allocations ───────────────────────────────────────────────

export async function previewCreditNoteAllocation(creditNoteId: string, body: CreditNoteAllocationRequest) {
  return apiRequest<CreditNoteAllocationPreview>(
    tenantPath(`${BASE}/credit-notes/${creditNoteId}/allocations/preview`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function allocateCreditNote(creditNoteId: string, body: CreditNoteAllocationRequest, idempotencyKey: string) {
  return apiRequest<CreditNoteAllocationResult>(tenantPath(`${BASE}/credit-notes/${creditNoteId}/allocations`), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export async function listCreditNoteAllocations(creditNoteId: string, params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<CreditNoteAllocationHistoryRow[]>(
    `${tenantPath(`${BASE}/credit-notes/${creditNoteId}/allocations`)}${buildQuery(params)}`,
  )
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
