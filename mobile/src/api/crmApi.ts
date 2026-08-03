import { apiClient, tenantPath } from '@/api/client'
import type {
  CrmActivity,
  CrmAttachment,
  CrmCompany,
  CrmContact,
  CrmDashboardMetrics,
  CrmEntityNote,
  CrmFollowUp,
  CrmLead,
  CrmOpportunity,
  CrmQuotation,
  CrmSalesOrder,
  CrmSearchResults,
  PipelineDto,
} from '@/types/crm'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

function crm(path: string): string {
  return tenantPath(`/crm${path.startsWith('/') ? path : `/${path}`}`)
}

// ─── Dashboard / Search ──────────────────────────────────────────────────────

export async function fetchCrmDashboard(params?: Record<string, string | undefined>) {
  return apiClient.get<CrmDashboardMetrics>(crm(`/dashboard/metrics${buildQuery(params)}`))
}

export async function searchCrm(q: string, limit = 25) {
  return apiClient.get<CrmSearchResults>(crm(`/search${buildQuery({ q, limit })}`))
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function listLeads(params?: Record<string, string | number | boolean | undefined>) {
  return apiClient.get<CrmLead[]>(crm(`/leads${buildQuery(params)}`))
}

export async function getLead(id: string) {
  return apiClient.get<CrmLead>(crm(`/leads/${id}`))
}

export async function createLead(data: Record<string, unknown>) {
  return apiClient.post<CrmLead>(crm('/leads'), data)
}

export async function updateLead(id: string, data: Record<string, unknown>) {
  return apiClient.patch<CrmLead>(crm(`/leads/${id}`), data)
}

export async function qualifyLead(id: string, data?: Record<string, unknown>) {
  return apiClient.post<CrmLead>(crm(`/leads/${id}/qualify`), data ?? {})
}

export async function convertLead(id: string, data?: Record<string, unknown>) {
  return apiClient.post<{ lead: CrmLead; opportunity: CrmOpportunity | null }>(
    crm(`/leads/${id}/convert`),
    data ?? {},
  )
}

export async function fetchLeadStatusHistory(id: string) {
  return apiClient.get<Array<Record<string, unknown>>>(crm(`/leads/${id}/status-history`))
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function listCompanies(params?: Record<string, string | number | undefined>) {
  return apiClient.get<CrmCompany[]>(crm(`/companies${buildQuery(params)}`))
}

export async function getCompany(id: string) {
  return apiClient.get<CrmCompany>(crm(`/companies/${id}`))
}

export async function createCompany(data: Record<string, unknown>) {
  return apiClient.post<CrmCompany>(crm('/companies'), data)
}

export async function updateCompany(id: string, data: Record<string, unknown>) {
  return apiClient.patch<CrmCompany>(crm(`/companies/${id}`), data)
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function listContacts(params?: Record<string, string | number | undefined>) {
  return apiClient.get<CrmContact[]>(crm(`/contacts${buildQuery(params)}`))
}

export async function getContact(id: string) {
  return apiClient.get<CrmContact>(crm(`/contacts/${id}`))
}

export async function createContact(data: Record<string, unknown>) {
  return apiClient.post<CrmContact>(crm('/contacts'), data)
}

// ─── Opportunities ───────────────────────────────────────────────────────────

export async function listOpportunities(params?: Record<string, string | undefined>) {
  return apiClient.get<CrmOpportunity[]>(crm(`/opportunities${buildQuery(params)}`))
}

export async function getOpportunity(id: string) {
  return apiClient.get<CrmOpportunity>(crm(`/opportunities/${id}`))
}

export async function listPipelines() {
  return apiClient.get<PipelineDto[]>(crm('/pipelines?limit=50'))
}

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export async function listFollowUps(params?: Record<string, string | undefined>) {
  return apiClient.get<CrmFollowUp[]>(crm(`/follow-ups${buildQuery(params)}`))
}

export async function createFollowUp(data: Record<string, unknown>) {
  return apiClient.post<CrmFollowUp>(crm('/follow-ups'), data)
}

export async function completeFollowUp(id: string, data: { outcome: string }) {
  return apiClient.post<CrmFollowUp>(crm(`/follow-ups/${id}/complete`), data)
}

export async function rescheduleFollowUp(
  id: string,
  data: { dueDate: string; dueTime?: string },
) {
  return apiClient.post<CrmFollowUp>(crm(`/follow-ups/${id}/reschedule`), data)
}

// ─── Activities / Meetings ───────────────────────────────────────────────────

export async function listActivities(params?: Record<string, string | undefined>) {
  return apiClient.get<CrmActivity[]>(crm(`/activities${buildQuery(params)}`))
}

export async function createActivity(data: Record<string, unknown>) {
  return apiClient.post<CrmActivity>(crm('/activities'), data)
}

export async function completeActivity(
  id: string,
  data?: { outcome?: string; nextAction?: string },
) {
  return apiClient.post<CrmActivity>(crm(`/activities/${id}/complete`), data ?? {})
}

// ─── Quotations / SO ─────────────────────────────────────────────────────────

export async function listQuotations(params?: Record<string, string | undefined>) {
  return apiClient.get<CrmQuotation[]>(crm(`/quotations${buildQuery(params)}`))
}

export async function getQuotation(id: string) {
  return apiClient.get<CrmQuotation>(crm(`/quotations/${id}`))
}

export async function approveQuotationDocument(
  quotationId: string,
  docId: string,
  data?: { remarks?: string },
) {
  return apiClient.post<CrmQuotation>(
    crm(`/quotations/${quotationId}/documents/${docId}/approve`),
    data ?? {},
  )
}

export async function submitQuotationDocumentApproval(
  quotationId: string,
  docId: string,
  data?: { remarks?: string },
) {
  return apiClient.post<CrmQuotation>(
    crm(`/quotations/${quotationId}/documents/${docId}/submit-approval`),
    data ?? {},
  )
}

export async function convertQuotationToSalesOrder(
  quotationId: string,
  data?: Record<string, unknown>,
) {
  return apiClient.post<{
    salesOrderId: string
    salesOrderNo: string
    salesOrder: CrmSalesOrder
  }>(crm(`/quotations/${quotationId}/convert-to-sales-order`), data ?? {})
}

export async function listSalesOrders(params?: Record<string, string | undefined>) {
  return apiClient.get<CrmSalesOrder[]>(crm(`/sales-orders${buildQuery(params)}`))
}

export async function getSalesOrder(id: string) {
  return apiClient.get<CrmSalesOrder>(crm(`/sales-orders/${id}`))
}

export async function fetchCompanyCommercialPosition(companyId: string) {
  return apiClient.get<Record<string, unknown>>(crm(`/companies/${companyId}/commercial-position`))
}

// ─── Notes / Attachments ─────────────────────────────────────────────────────

export async function listEntityNotes(entityType: string, entityId: string) {
  return apiClient.get<CrmEntityNote[]>(crm(`/entities/${entityType}/${entityId}/notes`))
}

export async function createEntityNote(
  entityType: string,
  entityId: string,
  content: string,
  noteType?: string,
) {
  return apiClient.post<CrmEntityNote>(crm(`/entities/${entityType}/${entityId}/notes`), {
    content,
    noteType: noteType ?? null,
  })
}

export async function listEntityAttachments(entityType: string, entityId: string) {
  return apiClient.get<CrmAttachment[]>(crm(`/entities/${entityType}/${entityId}/attachments`))
}

export async function createEntityAttachment(
  entityType: string,
  entityId: string,
  data: {
    originalFilename: string
    mimeType: string
    contentBase64: string
    documentType: string
  },
) {
  return apiClient.post<CrmAttachment>(
    crm(`/entities/${entityType}/${entityId}/attachments`),
    data,
  )
}

export function entityAttachmentDownloadPath(attachmentId: string): string {
  return crm(`/entities/attachments/${attachmentId}/download`)
}
