import { apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const base = () => tenantPath('/crm/integrations/indiamart')

export type IndiaMartSettings = {
  configured: boolean
  status: string
  hasCredentials: boolean
  accountName?: string | null
  apiKeyMasked?: string | null
  registeredMobileMasked?: string | null
  registeredEmailMasked?: string | null
  apiBaseUrl: string
  leadFetchEndpoint: string
  authenticationType: string
  syncEnabled: boolean
  autoCreateLead: boolean
  defaultLeadOwnerId?: string | null
  defaultPriority?: string | null
  duplicateBehaviour?: string
  assignmentMode?: string
  syncIntervalMinutes: number
  initialLookbackDays: number
  maxRecordsPerRun: number
  lastSuccessfulSyncAt?: string | null
  lastAttemptedSyncAt?: string | null
  nextScheduledSyncAt?: string | null
  configurationJson?: Record<string, unknown>
  fieldEncryptionConfigured?: boolean
  pushWebhookEnabled?: boolean
  pushWebhookTokenPrefix?: string | null
}

export type IndiaMartEnquiry = {
  id: string
  externalEnquiryId: string
  enquiryDate: string | null
  buyerName: string | null
  buyerCompanyName: string | null
  buyerMobile: string | null
  buyerEmail: string | null
  buyerCity: string | null
  buyerState: string | null
  productName: string | null
  requirementText: string | null
  quantityText: string | null
  processingStatus: string
  matchStatus: string
  importStatus: string
  createdLeadId: string | null
  matchedLeadId: string | null
  assignedUserId: string | null
  slaStatus: string | null
  failureMessage: string | null
  rawPayload?: unknown
}

export type IndiaMartSyncRun = {
  id: string
  triggerType: string
  status: string
  recordsFetched: number
  recordsInserted: number
  leadsCreated: number
  leadsLinked: number
  recordsFailed: number
  startedAt: string
  completedAt: string | null
  errorMessage: string | null
  durationMs: number | null
}

export type IndiaMartDashboard = {
  newEnquiriesToday: number
  leadsCreatedToday: number
  pendingReview: number
  possibleDuplicates: number
  failedImports: number
  overdueEnquiries: number
  unreadAlerts?: number
  averageFirstResponseMinutes?: number | null
  conversionToLeadPercent?: number
  enquiriesByDay?: Array<{ date: string; enquiries: number; leads: number }>
  enquiriesByProduct?: Array<{ name: string; count: number }>
  enquiriesByCity?: Array<{ name: string; count: number }>
  enquiriesByOwner?: Array<{ ownerId: string; count: number }>
  funnel?: { enquiries: number; imported: number; pendingReview: number; overdue: number }
}

export type IndiaMartAlert = {
  id: string
  alertType: string
  severity: string
  title: string
  message: string
  href: string | null
  isRead: boolean
  enquiryId: string | null
  createdAt: string
}

export type IndiaMartProductMapping = {
  id: string
  externalProductName: string
  normalizedProductName: string
  itemId: string | null
  itemCategoryId: string | null
  mappingStatus: string
  confidenceScore: number | null
  updatedAt: string
}

export async function fetchIndiaMartSettings() {
  return apiRequest<IndiaMartSettings>(`${base()}/settings`)
}

export async function updateIndiaMartSettings(body: Record<string, unknown>) {
  return apiRequest<IndiaMartSettings>(`${base()}/settings`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function testIndiaMartConnection() {
  return apiRequest<{ ok: boolean; message: string; errorCode?: string }>(`${base()}/test-connection`, {
    method: 'POST',
    body: '{}',
  })
}

export async function syncIndiaMart(body: Record<string, unknown> = {}) {
  return apiRequest<Record<string, unknown>>(`${base()}/sync`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchIndiaMartSyncRuns(params?: { page?: number; limit?: number }) {
  return apiRequest<IndiaMartSyncRun[]>(`${base()}/sync-runs${buildQuery(params)}`)
}

export async function fetchIndiaMartEnquiries(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<IndiaMartEnquiry[]>(`${base()}/enquiries${buildQuery(params)}`)
}

export async function fetchIndiaMartEnquiry(id: string) {
  return apiRequest<IndiaMartEnquiry>(`${base()}/enquiries/${id}`)
}

export async function createLeadFromIndiaMartEnquiry(id: string, body: Record<string, unknown> = {}) {
  return apiRequest<{ leadId: string }>(`${base()}/enquiries/${id}/create-lead`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function linkIndiaMartEnquiry(id: string, leadId: string) {
  return apiRequest<{ leadId: string }>(`${base()}/enquiries/${id}/link-lead`, {
    method: 'POST',
    body: JSON.stringify({ leadId, createActivity: true }),
  })
}

export async function assignIndiaMartEnquiry(id: string, assignedUserId: string) {
  return apiRequest<IndiaMartEnquiry>(`${base()}/enquiries/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedUserId }),
  })
}

export async function ignoreIndiaMartEnquiry(id: string, reason?: string) {
  return apiRequest<IndiaMartEnquiry>(`${base()}/enquiries/${id}/ignore`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function retryIndiaMartEnquiry(id: string) {
  return apiRequest<{ leadId: string }>(`${base()}/enquiries/${id}/retry`, {
    method: 'POST',
    body: '{}',
  })
}

export async function bulkCreateIndiaMartLeads(enquiryIds: string[]) {
  return apiRequest<{ results: Array<{ id: string; ok: boolean }> }>(`${base()}/enquiries/bulk-create-leads`, {
    method: 'POST',
    body: JSON.stringify({ enquiryIds }),
  })
}

export async function fetchIndiaMartDashboard() {
  return apiRequest<IndiaMartDashboard>(`${base()}/dashboard`)
}

export async function fetchIndiaMartAlerts(params?: { unreadOnly?: boolean }) {
  return apiRequest<IndiaMartAlert[]>(`${base()}/alerts${buildQuery(params)}`)
}

export async function markIndiaMartAlertRead(id: string) {
  return apiRequest<{ ok: boolean }>(`${base()}/alerts/${id}/read`, { method: 'POST', body: '{}' })
}

export async function markAllIndiaMartAlertsRead() {
  return apiRequest<{ ok: boolean }>(`${base()}/alerts/mark-all-read`, { method: 'POST', body: '{}' })
}

export async function enableIndiaMartWebhook() {
  return apiRequest<{ webhookUrl: string; webhookToken: string; tokenPrefix: string; enabled: boolean }>(
    `${base()}/push-webhook/enable`,
    { method: 'POST', body: '{}' },
  )
}

export async function rotateIndiaMartWebhook() {
  return apiRequest<{ webhookUrl: string; webhookToken: string; tokenPrefix: string; enabled: boolean }>(
    `${base()}/push-webhook/rotate`,
    { method: 'POST', body: '{}' },
  )
}

export async function disableIndiaMartWebhook() {
  return apiRequest<{ enabled: boolean }>(`${base()}/push-webhook/disable`, { method: 'POST', body: '{}' })
}

export async function fetchIndiaMartProductMappings() {
  return apiRequest<IndiaMartProductMapping[]>(`${base()}/product-mappings`)
}

export async function createIndiaMartProductMapping(body: Record<string, unknown>) {
  return apiRequest<IndiaMartProductMapping>(`${base()}/product-mappings`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateIndiaMartProductMapping(id: string, body: Record<string, unknown>) {
  return apiRequest<IndiaMartProductMapping>(`${base()}/product-mappings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function suggestIndiaMartProductMappings() {
  return apiRequest<{ suggested: number }>(`${base()}/product-mappings/suggest`, {
    method: 'POST',
    body: '{}',
  })
}
