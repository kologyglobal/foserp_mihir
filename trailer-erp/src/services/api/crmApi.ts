import type { Lead, LeadStage } from '../../types/sales'
import type { CrmActivity, CrmContact, Opportunity } from '../../types/crm'
import type { Customer } from '../../types/master'
import { apiRequest, tenantPath } from './client'

export interface PipelineDto {
  id: string
  name: string
  isDefault: boolean
  stages: Array<{ id: string; slug: string; name: string; probability: number; isClosedWon: boolean; isClosedLost: boolean }>
}

export interface ConvertLeadResult {
  lead: Lead
  opportunity: Opportunity | null
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

const CRM_PAGE_LIMIT = 100

/** Fetches all pages for a paginated CRM list endpoint (backend max limit is 100). */
export async function fetchAllCrmPages<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T[]> {
  let page = 1
  const all: T[] = []
  for (;;) {
    const res = await apiRequest<T[]>(
      `${tenantPath(path)}${buildQuery({ ...params, page, limit: CRM_PAGE_LIMIT })}`,
    )
    all.push(...res.data)
    const meta = res.meta
    if (!meta || page >= meta.totalPages) break
    page += 1
  }
  return all
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function fetchCompanies(params?: Record<string, string | number | undefined>) {
  return apiRequest<Customer[]>(`${tenantPath('/crm/companies')}${buildQuery(params)}`)
}

export async function createCompanyApi(data: Partial<Customer>) {
  return apiRequest<Customer>(tenantPath('/crm/companies'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateCompanyApi(id: string, data: Partial<Customer>) {
  return apiRequest<Customer>(tenantPath(`/crm/companies/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteCompanyApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/companies/${id}`), { method: 'DELETE' })
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function fetchContacts(params?: Record<string, string | number | undefined>) {
  return apiRequest<CrmContact[]>(`${tenantPath('/crm/contacts')}${buildQuery(params)}`)
}

export async function createContactApi(data: Partial<CrmContact>) {
  return apiRequest<CrmContact>(tenantPath('/crm/contacts'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateContactApi(id: string, data: Partial<CrmContact>) {
  return apiRequest<CrmContact>(tenantPath(`/crm/contacts/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteContactApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/contacts/${id}`), { method: 'DELETE' })
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function fetchLeads(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<Lead[]>(`${tenantPath('/crm/leads')}${buildQuery(params)}`)
}

export async function fetchLead(id: string) {
  return apiRequest<Lead>(tenantPath(`/crm/leads/${id}`))
}

export async function createLeadApi(data: Record<string, unknown>) {
  return apiRequest<Lead>(tenantPath('/crm/leads'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateLeadApi(id: string, data: Record<string, unknown>) {
  return apiRequest<Lead>(tenantPath(`/crm/leads/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteLeadApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/leads/${id}`), { method: 'DELETE' })
}

export async function assignLeadApi(id: string, data: { leadOwnerId: string; notes?: string }) {
  return apiRequest<Lead>(tenantPath(`/crm/leads/${id}/assign`), { method: 'POST', body: JSON.stringify(data) })
}

export async function qualifyLeadApi(id: string, data?: { stage?: LeadStage; remarks?: string }) {
  return apiRequest<Lead>(tenantPath(`/crm/leads/${id}/qualify`), { method: 'POST', body: JSON.stringify(data ?? {}) })
}

export async function changeLeadStageApi(
  id: string,
  data: {
    stage: LeadStage
    remarks?: string
    notQualifiedReason?: string
    closedReason?: string
    closedDate?: string | null
  },
) {
  return apiRequest<Lead>(tenantPath(`/crm/leads/${id}/change-stage`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function disqualifyLeadApi(id: string, data: { notQualifiedReason: string; remarks?: string }) {
  return apiRequest<Lead>(tenantPath(`/crm/leads/${id}/disqualify`), { method: 'POST', body: JSON.stringify(data) })
}

export async function convertLeadApi(id: string, data?: Record<string, unknown>) {
  return apiRequest<ConvertLeadResult>(tenantPath(`/crm/leads/${id}/convert`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function fetchActivities(params?: Record<string, string | undefined>) {
  return apiRequest<CrmActivity[]>(`${tenantPath('/crm/activities')}${buildQuery(params)}`)
}

export async function createActivityApi(data: Record<string, unknown>) {
  return apiRequest<CrmActivity>(tenantPath('/crm/activities'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateActivityApi(id: string, data: Record<string, unknown>) {
  return apiRequest<CrmActivity>(tenantPath(`/crm/activities/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function completeActivityApi(id: string, data?: { outcome?: string; nextAction?: string }) {
  return apiRequest<CrmActivity>(tenantPath(`/crm/activities/${id}/complete`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function deleteActivityApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/activities/${id}`), { method: 'DELETE' })
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

export async function fetchPipelines() {
  return apiRequest<PipelineDto[]>(`${tenantPath('/crm/pipelines')}?limit=50`)
}

// ─── Opportunities ───────────────────────────────────────────────────────────

export async function fetchOpportunities(params?: Record<string, string | undefined>) {
  return apiRequest<Opportunity[]>(`${tenantPath('/crm/opportunities')}${buildQuery(params)}`)
}

export async function createOpportunityApi(data: Record<string, unknown>) {
  return apiRequest<Opportunity>(tenantPath('/crm/opportunities'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateOpportunityApi(id: string, data: Record<string, unknown>) {
  return apiRequest<Opportunity>(tenantPath(`/crm/opportunities/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function winOpportunityApi(id: string, data?: { winReason?: string }) {
  return apiRequest<Opportunity>(tenantPath(`/crm/opportunities/${id}/win`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export async function loseOpportunityApi(id: string, data: { lostReason: string }) {
  return apiRequest<Opportunity>(tenantPath(`/crm/opportunities/${id}/lose`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteOpportunityApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/opportunities/${id}`), { method: 'DELETE' })
}

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export async function fetchFollowUps(params?: Record<string, string | undefined>) {
  return apiRequest<import('../../types/crm').FollowUp[]>(`${tenantPath('/crm/follow-ups')}${buildQuery(params)}`)
}

export async function createFollowUpApi(data: Record<string, unknown>) {
  return apiRequest<import('../../types/crm').FollowUp>(tenantPath('/crm/follow-ups'), { method: 'POST', body: JSON.stringify(data) })
}

export async function updateFollowUpApi(id: string, data: Record<string, unknown>) {
  return apiRequest<import('../../types/crm').FollowUp>(tenantPath(`/crm/follow-ups/${id}`), { method: 'PATCH', body: JSON.stringify(data) })
}

export async function completeFollowUpApi(id: string, data: { outcome: string }) {
  return apiRequest<import('../../types/crm').FollowUp>(tenantPath(`/crm/follow-ups/${id}/complete`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function rescheduleFollowUpApi(id: string, data: { dueDate: string; dueTime?: string }) {
  return apiRequest<import('../../types/crm').FollowUp>(tenantPath(`/crm/follow-ups/${id}/reschedule`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function snoozeFollowUpApi(id: string, data: { dueDate: string }) {
  return apiRequest<import('../../types/crm').FollowUp>(tenantPath(`/crm/follow-ups/${id}/snooze`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteFollowUpApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/follow-ups/${id}`), { method: 'DELETE' })
}

// ─── Imports ─────────────────────────────────────────────────────────────────

export interface ImportSummaryDto {
  imported: number
  updated: number
  skipped: number
  failed: number
  rows: Array<{ row: number; ok: boolean; code?: string; errors?: string[] }>
}

export async function importCompaniesApi(rows: Record<string, string>[], duplicateMode: 'skip' | 'update' | 'error' = 'skip') {
  return apiRequest<ImportSummaryDto>(tenantPath('/crm/imports/companies'), {
    method: 'POST',
    body: JSON.stringify({ rows, duplicateMode }),
  })
}

export async function importContactsApi(rows: Record<string, string>[], duplicateMode: 'skip' | 'update' | 'error' = 'skip') {
  return apiRequest<ImportSummaryDto>(tenantPath('/crm/imports/contacts'), {
    method: 'POST',
    body: JSON.stringify({ rows, duplicateMode }),
  })
}

export async function importLeadsApi(rows: Record<string, string>[], duplicateMode: 'skip' | 'update' | 'error' = 'skip') {
  return apiRequest<ImportSummaryDto>(tenantPath('/crm/imports/leads'), {
    method: 'POST',
    body: JSON.stringify({ rows, duplicateMode }),
  })
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface CrmDashboardMetricsDto {
  period: string
  from: string
  to: string
  leads: {
    total: number
    new: number
    qualified: number
    converted: number
    lost: number
    byStage: Array<{ stage: string; count: number }>
    bySource: Array<{ source: string; count: number }>
  }
  opportunities: {
    open: number
    won: number
    lost: number
    pipelineValue: number
    weightedForecast: number
    expectedRevenue: number
    byStage: Array<{ stageId: string; count: number; value: number }>
  }
  followUps: { dueToday: number; overdue: number; upcoming: number }
  activities: { today: number; recent: Array<Record<string, unknown>> }
  rates: { conversionRate: number; winRate: number }
  upcomingFollowUps: Array<Record<string, unknown>>
  panels?: {
    definitions: Record<string, string>
    hotOpportunities: Array<{
      id: string
      opportunityCode: string
      name: string
      amount: number
      stageId: string
      companyId: string
      ownerId: string | null
      probability: number
      expectedCloseDate: string | null
      healthScore: number
      priority: string
      nextFollowUpAt: string | null
    }>
    stuckOpportunities: Array<{
      id: string
      opportunityCode: string
      name: string
      amount: number
      stageId: string
      companyId: string
      ownerId: string | null
      idleDays: number
      reason: string
    }>
    recentlyWon: Array<{
      id: string
      opportunityCode: string
      name: string
      amount: number
      companyId: string
      ownerId: string | null
      updatedAt: string
    }>
    todaysFollowUps: Array<Record<string, unknown>>
    overdueFollowUps: Array<Record<string, unknown>>
    hotLeads: Array<Record<string, unknown>>
    stuckLeads: Array<Record<string, unknown>>
    recentlyCreatedLeads: Array<Record<string, unknown>>
    opportunitiesClosingSoon: Array<Record<string, unknown>>
    ownerPerformance: Array<{ ownerId: string | null; openCount: number; pipelineValue: number }>
    monthlyLeadTrend: Array<{ month: string; count: number }>
    monthlyWonRevenueTrend: Array<{ month: string; revenue: number }>
  }
  charts?: {
    pipelineByStage: Array<{
      stageId: string
      slug: string
      label: string
      shortLabel: string
      count: number
      value: number
    }>
    stageFunnel: Array<{
      stageId: string
      slug: string
      label: string
      shortLabel: string
      count: number
    }>
    leadStageFunnel: Array<{ stage: string; label: string; count: number }>
    dealOutcomes: { open: number; won: number; lost: number }
    activityTrend: Array<{ day: string; label: string; count: number }>
    followUpUrgency: Array<{ name: string; value: number }>
    ownerPipeline: Array<{
      ownerId: string | null
      ownerName: string
      value: number
      count: number
    }>
  }
}

export async function fetchCrmDashboardMetrics(params?: Record<string, string | undefined>) {
  return apiRequest<CrmDashboardMetricsDto>(`${tenantPath('/crm/dashboard/metrics')}${buildQuery(params)}`)
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/** Reports implemented on backend. */
export const CRM_API_REPORT_IDS = [
  'pipeline', 'stage-wise', 'follow-up-due', 'sales-activity', 'won-lost',
  'customer-pipeline', 'conversion-funnel', 'lead-register', 'lead-owner',
  'lead-priority', 'lead-stage', 'lead-conversion', 'closed-leads', 'lead-active-inactive',
  'quotation-revision', 'quotation-approval',
] as const

export type CrmApiReportId = (typeof CRM_API_REPORT_IDS)[number]

export function isCrmApiReport(id: string): id is CrmApiReportId {
  return (CRM_API_REPORT_IDS as readonly string[]).includes(id)
}

export async function fetchCrmReport(
  reportId: CrmApiReportId,
  params?: Record<string, string | number | undefined>,
) {
  return apiRequest<Record<string, unknown>[]>(
    `${tenantPath('/crm/reports')}${buildQuery({ reportId, limit: 100, ...params })}`,
  )
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface CrmSearchResultsDto {
  leads: Array<{ id: string; leadCode: string; prospectName: string; stage: string; email?: string | null; mobile?: string | null }>
  companies: Array<{ id: string; companyCode: string; name: string; gstin?: string | null; city?: string | null }>
  contacts: Array<{ id: string; contactCode: string; firstName: string; lastName: string; email?: string | null; mobile?: string | null; companyId: string }>
  opportunities: Array<{ id: string; opportunityCode: string; name: string; status: string; amount: unknown }>
}

export async function searchCrmApi(q: string, limit = 25) {
  return apiRequest<CrmSearchResultsDto>(`${tenantPath('/crm/search')}${buildQuery({ q, limit })}`)
}

// ─── Lead history ────────────────────────────────────────────────────────────

export async function fetchLeadStatusHistoryApi(leadId: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/leads/${leadId}/status-history`))
}

export async function fetchLeadAssignmentHistoryApi(leadId: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/leads/${leadId}/assignment-history`))
}

// ─── CRM Masters ─────────────────────────────────────────────────────────────

export interface CrmMasterDto {
  id: string
  kind: string
  code: string
  name: string
  status: string
  sortOrder: number
  description?: string
  attributes: Record<string, string | number | boolean | null>
  systemControlled?: boolean
  createdBy?: string
  modifiedBy?: string
  createdByName?: string
  modifiedByName?: string
  createdAt: string
  updatedAt: string
}

export async function fetchCrmMastersSync() {
  return apiRequest<CrmMasterDto[]>(tenantPath('/crm/masters/sync'))
}

export async function fetchCrmMasterLookup(kind: string) {
  return apiRequest<CrmMasterDto[]>(tenantPath(`/crm/masters/${kind}/lookup`))
}

// ─── Bulk leads ──────────────────────────────────────────────────────────────

export interface BulkLeadResultDto {
  requested: number
  processed: number
  failed: number
  failures: Array<{ id: string; message: string }>
}

export async function bulkAssignLeadsApi(leadIds: string[], assignedTo: string, notes?: string) {
  return apiRequest<BulkLeadResultDto>(tenantPath('/crm/leads/bulk-assign'), {
    method: 'POST',
    body: JSON.stringify({ leadIds, assignedTo, notes }),
  })
}

export async function bulkStatusLeadsApi(leadIds: string[], activityStatus: 'active' | 'inactive') {
  return apiRequest<BulkLeadResultDto>(tenantPath('/crm/leads/bulk-status'), {
    method: 'POST',
    body: JSON.stringify({ leadIds, activityStatus }),
  })
}

// ─── Opportunity workflow ────────────────────────────────────────────────────

export async function moveOpportunityStageApi(id: string, stageId: string, reason?: string) {
  return apiRequest<Opportunity>(tenantPath(`/crm/opportunities/${id}/move-stage`), {
    method: 'POST',
    body: JSON.stringify({ stageId, reason }),
  })
}

export async function reopenOpportunityApi(id: string, data?: { stageId?: string; reason?: string }) {
  return apiRequest<Opportunity>(tenantPath(`/crm/opportunities/${id}/reopen`), {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function fetchEntityNotesApi(entityType: string, entityId: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/entities/${entityType}/${entityId}/notes`))
}

export async function createEntityNoteApi(entityType: string, entityId: string, content: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/crm/entities/${entityType}/${entityId}/notes`), {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function updateEntityNoteApi(noteId: string, content: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/crm/entities/notes/${noteId}`), {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export async function deleteEntityNoteApi(noteId: string) {
  return apiRequest<null>(tenantPath(`/crm/entities/notes/${noteId}`), { method: 'DELETE' })
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export interface CrmAttachmentDto {
  id: string
  entityType: string
  entityId: string
  originalFilename: string
  mimeType: string
  fileSize: number
  documentType?: string
  uploadedById: string
  uploadedByName: string
  createdAt: string
}

export async function fetchEntityAttachmentsApi(entityType: string, entityId: string) {
  return apiRequest<CrmAttachmentDto[]>(tenantPath(`/crm/entities/${entityType}/${entityId}/attachments`))
}

export async function createEntityAttachmentApi(
  entityType: string,
  entityId: string,
  data: { originalFilename: string; mimeType: string; contentBase64: string; documentType?: string },
) {
  return apiRequest<CrmAttachmentDto>(tenantPath(`/crm/entities/${entityType}/${entityId}/attachments`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteEntityAttachmentApi(attachmentId: string) {
  return apiRequest<null>(tenantPath(`/crm/entities/attachments/${attachmentId}`), { method: 'DELETE' })
}

export function attachmentDownloadPath(attachmentId: string): string {
  return tenantPath(`/crm/entities/attachments/${attachmentId}/download`)
}

// ─── CRM Master writes ───────────────────────────────────────────────────────

export async function createCrmMasterApi(kind: string, data: Record<string, unknown>) {
  return apiRequest<CrmMasterDto>(tenantPath(`/crm/masters/${kind}`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCrmMasterApi(kind: string, id: string, data: Record<string, unknown>) {
  return apiRequest<CrmMasterDto>(tenantPath(`/crm/masters/${kind}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteCrmMasterApi(kind: string, id: string) {
  return apiRequest<null>(tenantPath(`/crm/masters/${kind}/${id}`), { method: 'DELETE' })
}

export async function activateCrmMasterApi(kind: string, id: string) {
  return apiRequest<CrmMasterDto>(tenantPath(`/crm/masters/${kind}/${id}/activate`), { method: 'POST' })
}

export async function deactivateCrmMasterApi(kind: string, id: string) {
  return apiRequest<CrmMasterDto>(tenantPath(`/crm/masters/${kind}/${id}/deactivate`), { method: 'POST' })
}

// ─── Opportunity histories & workflow ────────────────────────────────────────

export async function assignOpportunityApi(id: string, data: { ownerId: string; notes?: string }) {
  return apiRequest<Opportunity>(tenantPath(`/crm/opportunities/${id}/assign`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function fetchOpportunityStageHistoryApi(id: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/opportunities/${id}/stage-history`))
}

export async function fetchOpportunityAssignmentHistoryApi(id: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/opportunities/${id}/assignment-history`))
}

export async function fetchOpportunityAmountHistoryApi(id: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/opportunities/${id}/amount-history`))
}

export async function fetchOpportunityStatusHistoryApi(id: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/crm/opportunities/${id}/status-history`))
}

export interface CrmEntityNoteDto {
  id: string
  entityType: string
  entityId: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function crmExportUrl(resource: string, params?: Record<string, string | undefined>): string {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v)
    }
  }
  const q = qs.toString()
  return `${tenantPath(`/crm/exports/${resource}`)}${q ? `?${q}` : ''}`
}

