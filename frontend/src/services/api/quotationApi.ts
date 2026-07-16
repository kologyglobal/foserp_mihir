import type { Quotation } from '@/types/sales'
import type { QuotationDocument } from '@/types/crm'
import { apiRequest, tenantPath } from './client'

export type QuotationApiDto = Quotation & {
  documents: QuotationDocument[]
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

// ─── Quotations ──────────────────────────────────────────────────────────────

export async function fetchQuotations(params?: Record<string, string | undefined>) {
  return apiRequest<QuotationApiDto[]>(`${tenantPath('/crm/quotations')}${buildQuery(params)}`)
}

export async function fetchQuotation(id: string) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${id}`))
}

export async function createQuotationApi(data: Record<string, unknown>) {
  return apiRequest<QuotationApiDto>(tenantPath('/crm/quotations'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateQuotationApi(id: string, data: Record<string, unknown>) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteQuotationApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/quotations/${id}`), { method: 'DELETE' })
}

export async function createQuotationRevisionApi(id: string, data: { reason: string }) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${id}/revisions`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateQuotationDocumentApi(quotationId: string, docId: string, data: Record<string, unknown>) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${quotationId}/documents/${docId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function submitQuotationDocumentApprovalApi(quotationId: string, docId: string, data?: { remarks?: string }) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${quotationId}/documents/${docId}/submit-approval`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function approveQuotationDocumentApi(quotationId: string, docId: string, data?: { remarks?: string }) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${quotationId}/documents/${docId}/approve`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function rejectQuotationDocumentApi(quotationId: string, docId: string, data?: { remarks?: string }) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${quotationId}/documents/${docId}/reject`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function markQuotationDocumentSentApi(quotationId: string, docId: string) {
  return apiRequest<QuotationApiDto>(tenantPath(`/crm/quotations/${quotationId}/documents/${docId}/mark-sent`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
