import type { Lead, LeadStage } from '../../types/sales'
import type { CrmActivity, CrmActivityType, CrmContact, FollowUp, Opportunity, OpportunityStage } from '../../types/crm'
import { syncQuotationsFromApi } from './quotationApiBridge'
import { syncQuotationTemplatesFromApi } from './quotationTemplateApiBridge'
import { syncSalesOrdersFromApi } from './salesOrderApiBridge'
import type { Customer } from '../../types/master'
import { formatApiError, stageMissingFieldsFromApiError } from '../api/apiErrors'
import { getStoredSession } from '../api/client'
import * as api from '../api/crmApi'
import type { PipelineDto } from '../api/crmApi'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { useSalesStore } from '../../store/salesStore'
import type { StoreActionResult } from '../../store/storeAction'
import { sanitizePhoneDigits } from '../../utils/phoneValidation'
import { getLeadUser } from '../../data/crm/leadUsers'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { normalizeLead, resolveLeadConvertToOpportunityGate, leadStageLabel } from '../../utils/leadUtils'
import {
  formatMissingStageFieldsMessage,
  getMissingLeadStageFields,
  getMissingOpportunityStageFields,
} from '../../config/crmStageRequirements'

const submitLocks = new Set<string>()
let defaultPipelineCache: PipelineDto | null = null

function lockKey(scope: string, id?: string): string {
  return id ? `${scope}:${id}` : scope
}

async function withSubmitLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (submitLocks.has(key)) throw new Error('Operation already in progress')
  submitLocks.add(key)
  try {
    return await fn()
  } finally {
    submitLocks.delete(key)
  }
}

function fail(err: unknown): StoreActionResult {
  const missingFields = stageMissingFieldsFromApiError(err)
  return {
    ok: false,
    error: formatApiError(err),
    ...(err instanceof Error && 'code' in err && typeof (err as { code?: string }).code === 'string'
      ? { code: (err as { code: string }).code }
      : {}),
    ...(missingFields ? { missingFields } : {}),
  }
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function sessionUserId(): string | undefined {
  return getStoredSession()?.user.id
}

function resolveOwnerId(ownerId?: string | null): string | undefined {
  if (ownerId && isUuid(ownerId)) return ownerId
  return sessionUserId()
}

export function toApiDateTime(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return value === '' ? null : value
  if (value.includes('T')) return value
  return `${value}T00:00:00.000Z`
}

function upsertLead(lead: Lead): void {
  const sessionUser = getStoredSession()?.user
  const sessionName = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim() || sessionUser.email
    : ''
  const ownerName =
    lead.leadOwnerName?.trim()
    || (lead.leadOwnerId ? getLeadUser(lead.leadOwnerId)?.name : undefined)
    || sessionName
    || ''
  const normalized = normalizeLead({
    ...lead,
    leadOwnerName: ownerName || lead.leadOwnerName,
    salesOwner: ownerName || lead.salesOwner || lead.leadOwnerName,
  })
  useSalesStore.setState((s) => ({ leads: [normalized, ...s.leads.filter((l) => l.id !== lead.id)] }))
}

/** Zustand equivalent of React Query `invalidateQueries(["crm","leads"])` — refetch leads slice only. */
export async function syncLeadsFromApi(): Promise<void> {
  const leads = await api.fetchAllCrmPages<Lead>('/crm/leads')
  useSalesStore.setState({ leads: leads.map((l) => normalizeLead(l)) })
}

function removeLead(id: string): void {
  useSalesStore.setState((s) => ({ leads: s.leads.filter((l) => l.id !== id) }))
}

function upsertCustomer(customer: Customer): void {
  useMasterStore.setState((s) => ({ customers: [customer, ...s.customers.filter((c) => c.id !== customer.id)] }))
}

function removeCustomer(id: string): void {
  useMasterStore.setState((s) => ({ customers: s.customers.filter((c) => c.id !== id) }))
}

function upsertContact(contact: CrmContact): void {
  useCrmStore.setState((s) => ({ contacts: [contact, ...s.contacts.filter((c) => c.id !== contact.id)] }))
}

function removeContact(id: string): void {
  useCrmStore.setState((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }))
}

function upsertOpportunity(opportunity: Opportunity): void {
  useCrmStore.setState((s) => ({ opportunities: [opportunity, ...s.opportunities.filter((o) => o.id !== opportunity.id)] }))
}

function removeOpportunity(id: string): void {
  useCrmStore.setState((s) => ({ opportunities: s.opportunities.filter((o) => o.id !== id) }))
}

function upsertActivity(activity: CrmActivity): void {
  useCrmStore.setState((s) => ({ activities: [activity, ...s.activities.filter((a) => a.id !== activity.id)] }))
}

function removeActivity(id: string): void {
  useCrmStore.setState((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
}

/** Immediate timeline entry after pipeline drag/move (API also persists STAGE_CHANGE). */
function recordLocalStageChangeActivity(
  opportunityId: string,
  fromStage: OpportunityStage,
  toStage: OpportunityStage,
  description?: string,
) {
  const opp = useCrmStore.getState().opportunities.find((o) => o.id === opportunityId)
  const session = getStoredSession()
  const now = new Date().toISOString()
  const ownerId = session?.user?.id ?? opp?.ownerId ?? 'system'
  const ownerName = session?.user
    ? `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.email
    : (opp?.ownerName ?? 'System')
  upsertActivity({
    id: `stage-${opportunityId}-${Date.now()}`,
    type: 'stage_change',
    subject: `Stage: ${opportunityStageLabel(fromStage)} → ${opportunityStageLabel(toStage)}`,
    description: description?.trim() || 'Pipeline stage updated.',
    customerId: opp?.customerId ?? null,
    contactId: opp?.contactId ?? null,
    opportunityId,
    quotationId: null,
    leadId: opp?.leadId ?? null,
    ownerId,
    ownerName,
    outcome: 'Stage changed',
    activityDate: now,
    attachmentNames: [],
    createdById: ownerId,
    createdByName: ownerName,
    createdAt: now,
    modifiedById: ownerId,
    modifiedByName: ownerName,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
    modifiedAt: now,
  })
  useCrmStore.setState((s) => ({
    opportunities: s.opportunities.map((o) =>
      o.id === opportunityId ? { ...o, lastActivityAt: now, modifiedAt: now } : o,
    ),
  }))
}

export async function syncAllCrmFromApi(): Promise<void> {
  const [leads, companies, contacts, opportunities, activities, followUps, quotationData, mastersRes, quotationTemplates] =
    await Promise.all([
      api.fetchAllCrmPages<Lead>('/crm/leads'),
      api.fetchAllCrmPages<Customer>('/crm/companies'),
      api.fetchAllCrmPages<CrmContact>('/crm/contacts'),
      api.fetchAllCrmPages<Opportunity>('/crm/opportunities'),
      api.fetchAllCrmPages<CrmActivity>('/crm/activities'),
      api.fetchAllCrmPages<FollowUp>('/crm/follow-ups'),
      syncQuotationsFromApi(),
      api.fetchCrmMastersSync(),
      syncQuotationTemplatesFromApi(),
    ])
  await syncSalesOrdersFromApi()
  useSalesStore.setState({
    leads: leads.map((l) => normalizeLead(l)),
    quotations: quotationData.quotationHeaders,
  })
  useMasterStore.setState({ customers: companies })
  useCrmStore.setState({
    contacts: Array.isArray(contacts) ? contacts : [],
    opportunities: Array.isArray(opportunities) ? opportunities : [],
    activities: Array.isArray(activities) ? activities : [],
    followUps: Array.isArray(followUps) ? followUps : [],
    quotationDocuments: Array.isArray(quotationData?.quotationDocuments)
      ? quotationData.quotationDocuments
      : [],
    quotationTemplates: Array.isArray(quotationTemplates) ? quotationTemplates : [],
  })
  const { useCrmMasterStore } = await import('../../store/crmMasterStore')
  useCrmMasterStore.getState().hydrateFromApi(
    mastersRes.data.map((row) => ({
      id: row.id,
      kind: row.kind as import('../../types/crmMasters').CrmMasterKind,
      code: row.code,
      name: row.name,
      status: row.status as 'active' | 'inactive',
      sortOrder: row.sortOrder,
      description: row.description,
      attributes: row.attributes ?? {},
      systemControlled: row.systemControlled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      modifiedBy: row.modifiedBy,
      createdByName: row.createdByName,
      modifiedByName: row.modifiedByName,
    })),
  )
  defaultPipelineCache = null
}

async function getDefaultPipeline(): Promise<PipelineDto> {
  if (defaultPipelineCache) return defaultPipelineCache
  const res = await api.fetchPipelines()
  const pipeline = res.data.find((p) => p.isDefault) ?? res.data[0]
  if (!pipeline) throw new Error('No CRM pipeline configured')
  defaultPipelineCache = pipeline
  return pipeline
}

const API_LEAD_SOURCES = new Set([
  'website',
  'referral',
  'trade_show',
  'cold_call',
  'existing_customer',
  'other',
  'indiamart',
  'justdial',
  'field_visit',
  'other_channel',
])

function mapLeadCreatePayload(input: Record<string, unknown>): Record<string, unknown> {
  const rawSource = String(input.source ?? 'other')
  const source = API_LEAD_SOURCES.has(rawSource) ? rawSource : 'other'
  const email = String(input.email ?? '').trim()
  return {
    prospectName: input.prospectName,
    customerId: isUuid(input.customerId as string) ? input.customerId : null,
    contactId: isUuid(input.contactId as string) ? input.contactId : null,
    source,
    industry: input.industry ?? '',
    email,
    mobile: sanitizePhoneDigits(String(input.mobile ?? '')) || '',
    contactPerson: input.contactPerson ?? '',
    productRequirement: input.productRequirement ?? input.remarks ?? '',
    expectedQty: input.expectedQty ?? null,
    expectedValue: input.expectedValue ?? 0,
    probability: input.probability ?? 30,
    stage: input.stage ?? 'new',
    priority: input.priority ?? 'medium',
    lifecycleStatus: input.lifecycleStatus ?? 'open',
    activityStatus: input.activityStatus ?? 'active',
    leadOwnerId: resolveOwnerId(input.leadOwnerId as string | undefined) ?? null,
    nextFollowUpDate: toApiDateTime(input.nextFollowUpDate as string | null | undefined),
    expectedCloseDate: toApiDateTime(input.expectedCloseDate as string | null | undefined),
    remarks: input.remarks ?? '',
    followUpType: input.followUpType ?? undefined,
    followUpNotes: input.followUpNotes ?? undefined,
    locationId: isUuid(input.locationId as string) ? input.locationId : null,
  }
}

function mapLeadUpdatePayload(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch }
  // Workflow-owned fields — must use change-stage / qualify / disqualify / convert.
  for (const key of ['stage', 'lifecycleStatus', 'qualificationStatus', 'opportunityId'] as const) {
    delete out[key]
  }
  if ('nextFollowUpDate' in patch) out.nextFollowUpDate = toApiDateTime(patch.nextFollowUpDate as string | null | undefined)
  if ('expectedCloseDate' in patch) out.expectedCloseDate = toApiDateTime(patch.expectedCloseDate as string | null | undefined)
  if ('leadOwnerId' in patch) out.leadOwnerId = resolveOwnerId(patch.leadOwnerId as string | undefined) ?? null
  if ('contactId' in patch) {
    out.contactId = isUuid(patch.contactId as string) ? patch.contactId : null
  }
  if ('mobile' in out && out.mobile != null) {
    out.mobile = sanitizePhoneDigits(String(out.mobile)) || null
  }
  // Empty optional strings may arrive as null from the form; API accepts nullish.
  for (const key of ['followUpNotes', 'followUpType', 'remarks', 'contactPerson', 'mobile', 'email', 'industry'] as const) {
    if (key in out && out[key] === '') out[key] = null
  }
  return out
}

async function hydrateCompanyContacts(customerId: string): Promise<void> {
  try {
    const res = await api.fetchContacts({ customerId, limit: 100 })
    const items = Array.isArray(res.data)
      ? res.data
      : ((res.data as { items?: CrmContact[] } | undefined)?.items ?? [])
    for (const contact of items) upsertContact(contact)
  } catch {
    /* company save succeeded; contacts list will catch up on next CRM hydrate */
  }
}

export async function apiCreateCompany(data: Partial<Customer>): Promise<StoreActionResult & { customerId?: string }> {
  return withSubmitLock(lockKey('company:create'), async () => {
    try {
      const res = await api.createCompanyApi(data)
      upsertCustomer(res.data)
      if (data.contactPerson?.trim()) {
        await hydrateCompanyContacts(res.data.id)
      }
      return { ok: true, customerId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateCompany(id: string, data: Partial<Customer>): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('company:update', id), async () => {
    try {
      const res = await api.updateCompanyApi(id, data)
      upsertCustomer(res.data)
      if (
        data.contactPerson !== undefined
        || data.contactPhone !== undefined
        || data.contactEmail !== undefined
      ) {
        await hydrateCompanyContacts(id)
      }
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteCompany(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('company:delete', id), async () => {
    try {
      await api.deleteCompanyApi(id)
      removeCustomer(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCreateContact(
  input: Omit<CrmContact, 'id' | 'masterContactId' | keyof import('../../types/audit').AuditTrail>,
): Promise<StoreActionResult & { contactId?: string }> {
  return withSubmitLock(lockKey('contact:create'), async () => {
    try {
      const res = await api.createContactApi({
        customerId: input.customerId,
        name: input.name,
        designation: input.designation,
        department: input.department,
        email: input.email,
        phone: sanitizePhoneDigits(input.phone ?? ''),
        isPrimary: input.isPrimary,
        isActive: input.isActive ?? true,
        ownerId: resolveOwnerId(sessionUserId()) ?? null,
      } as Partial<CrmContact> & { ownerId?: string | null })
      upsertContact(res.data)
      return { ok: true, contactId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateContact(
  id: string,
  patch: Partial<Pick<CrmContact, 'contactCode' | 'customerId' | 'name' | 'designation' | 'department' | 'email' | 'phone' | 'isPrimary' | 'isActive'>>,
): Promise<StoreActionResult & { contactId?: string }> {
  return withSubmitLock(lockKey('contact:update', id), async () => {
    try {
      const res = await api.updateContactApi(id, patch)
      upsertContact(res.data)
      return { ok: true, contactId: id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteContact(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('contact:delete', id), async () => {
    try {
      await api.deleteContactApi(id)
      removeContact(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCreateLead(input: Record<string, unknown>): Promise<StoreActionResult & { leadId?: string }> {
  return withSubmitLock(lockKey('lead:create'), async () => {
    try {
      const res = await api.createLeadApi(mapLeadCreatePayload(input))
      upsertLead(res.data)
      return { ok: true, leadId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateLead(id: string, patch: Record<string, unknown>): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('lead:update', id), async () => {
    try {
      const res = await api.updateLeadApi(id, mapLeadUpdatePayload(patch))
      upsertLead(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiAssignLead(id: string, leadOwnerId: string, notes?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('lead:assign', id), async () => {
    try {
      const owner = resolveOwnerId(leadOwnerId)
      if (!owner) return { ok: false, error: 'Valid owner is required' }
      const res = await api.assignLeadApi(id, { leadOwnerId: owner, notes })
      upsertLead(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiQualifyLead(id: string, stage?: LeadStage, remarks?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('lead:qualify', id), async () => {
    try {
      const res = await api.qualifyLeadApi(id, { stage, remarks })
      upsertLead(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDisqualifyLead(id: string, notQualifiedReason: string, remarks?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('lead:disqualify', id), async () => {
    try {
      const res = await api.disqualifyLeadApi(id, { notQualifiedReason, remarks })
      upsertLead(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiConvertLead(id: string, data?: Record<string, unknown>): Promise<StoreActionResult & { opportunityId?: string }> {
  return withSubmitLock(lockKey('lead:convert', id), async () => {
    try {
      const res = await api.convertLeadApi(id, {
        ...data,
        expectedCloseDate: toApiDateTime(data?.expectedCloseDate as string | undefined),
      })
      upsertLead(res.data.lead)
      if (res.data.opportunity) upsertOpportunity(res.data.opportunity)
      return { ok: true, opportunityId: res.data.opportunity?.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteLead(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('lead:delete', id), async () => {
    try {
      await api.deleteLeadApi(id)
      removeLead(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiAdvanceLeadStage(
  id: string,
  stage: LeadStage,
  extras?: {
    remarks?: string
    notQualifiedReason?: string
    closedReason?: string
    closedDate?: string | null
  },
): Promise<StoreActionResult> {
  if (stage === 'converted_to_opportunity') {
    return { ok: false, error: 'Use Convert to Opportunity to advance this lead' }
  }
  const lead = useSalesStore.getState().getLead(id) ?? useSalesStore.getState().leads.find(l => l.id === id)
  if (lead) {
    const gateLead = {
      ...lead,
      ...(extras?.notQualifiedReason !== undefined ? { notQualifiedReason: extras.notQualifiedReason } : {}),
      ...(extras?.closedReason !== undefined ? { closedReason: extras.closedReason } : {}),
    }
    const missing = getMissingLeadStageFields(gateLead, stage)
    if (missing.length > 0) {
      return {
        ok: false,
        error: formatMissingStageFieldsMessage(missing, leadStageLabel(stage)),
        code: 'STAGE_REQUIREMENTS_INCOMPLETE',
        missingFields: missing,
      }
    }
  }
  if (stage === 'qualified') return apiQualifyLead(id, stage, extras?.remarks)
  if (stage === 'not_qualified') {
    return apiDisqualifyLead(id, extras?.notQualifiedReason?.trim() || 'other', extras?.remarks)
  }
  return withSubmitLock(lockKey('lead:change-stage', id), async () => {
    try {
      const res = await api.changeLeadStageApi(id, {
        stage,
        remarks: extras?.remarks,
        notQualifiedReason: extras?.notQualifiedReason,
        closedReason: extras?.closedReason,
        closedDate: extras?.closedDate ? toApiDateTime(extras.closedDate) : extras?.closedDate,
      })
      upsertLead(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCreateActivity(input: {
  type: CrmActivityType | string
  subject: string
  description?: string
  customerId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  leadId?: string | null
  ownerId?: string
  activityDate?: string
  outcome?: string | null
}): Promise<StoreActionResult & { activityId?: string }> {
  return withSubmitLock(lockKey('activity:create'), async () => {
    try {
      const res = await api.createActivityApi({
        type: input.type,
        subject: input.subject,
        description: input.description ?? '',
        customerId: input.customerId ?? null,
        contactId: input.contactId ?? null,
        opportunityId: input.opportunityId ?? null,
        leadId: input.leadId ?? null,
        ownerId: resolveOwnerId(input.ownerId) ?? null,
        activityDate: toApiDateTime(input.activityDate ?? new Date().toISOString()),
        outcome: input.outcome ?? undefined,
      })
      upsertActivity(res.data)
      return { ok: true, activityId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateActivity(
  id: string,
  patch: Partial<{
    type: CrmActivityType | string
    subject: string
    description: string
    outcome: string | null
    activityDate: string
  }>,
): Promise<StoreActionResult & { activityId?: string }> {
  return withSubmitLock(lockKey('activity:update', id), async () => {
    try {
      const payload: Record<string, unknown> = { ...patch }
      if (patch.activityDate !== undefined) payload.activityDate = toApiDateTime(patch.activityDate)
      const res = await api.updateActivityApi(id, payload)
      upsertActivity(res.data)
      return { ok: true, activityId: id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCompleteActivity(id: string, outcome?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('activity:complete', id), async () => {
    try {
      const res = await api.completeActivityApi(id, { outcome })
      upsertActivity(res.data)
      return { ok: true, activityId: id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteActivity(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('activity:delete', id), async () => {
    try {
      await api.deleteActivityApi(id)
      removeActivity(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCreateOpportunity(
  input: Omit<Opportunity, keyof import('../../types/audit').AuditTrail | 'id' | 'opportunityNo' | 'healthScore' | 'lastActivityAt'>,
): Promise<StoreActionResult & { opportunityId?: string }> {
  if (input.leadId) {
    const lead = useSalesStore.getState().getLead(input.leadId)
    const gate = resolveLeadConvertToOpportunityGate(lead)
    if (!gate.ok) return { ok: false, error: gate.reason }
    return withSubmitLock(lockKey('lead:convert', input.leadId), async () => {
      try {
        const res = await api.convertLeadApi(input.leadId!, {
          opportunityName: input.opportunityName,
          value: input.value,
          expectedCloseDate: toApiDateTime(input.expectedCloseDate),
          lines: mapOpportunityLinesForApi(input.lines),
        })
        upsertLead(res.data.lead)
        if (res.data.opportunity) upsertOpportunity(res.data.opportunity)
        return { ok: true, opportunityId: res.data.opportunity?.id }
      } catch (err) {
        return fail(err)
      }
    })
  }
  return withSubmitLock(lockKey('opportunity:create'), async () => {
    try {
      const pipeline = await getDefaultPipeline()
      const stageSlug = input.stage as OpportunityStage
      const stage = pipeline.stages.find((s) => s.slug === stageSlug) ?? pipeline.stages[0]
      const res = await api.createOpportunityApi({
        opportunityName: input.opportunityName,
        customerId: input.customerId,
        contactId: input.contactId ?? null,
        leadId: input.leadId ?? null,
        pipelineId: pipeline.id,
        stageId: stage?.id,
        stage: stageSlug,
        ownerId: resolveOwnerId(input.ownerId) ?? null,
        value: input.value,
        probability: input.probability,
        expectedCloseDate: toApiDateTime(input.expectedCloseDate),
        productRequirement: input.productRequirement,
        priority: input.priority,
        status: input.status ?? 'open',
        healthScore: 60,
        locationId: isUuid(input.locationId ?? undefined) ? input.locationId : null,
        lines: mapOpportunityLinesForApi(input.lines),
      })
      upsertOpportunity(res.data)
      return { ok: true, opportunityId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiAssignOpportunity(id: string, ownerId: string, notes?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('opportunity:assign', id), async () => {
    try {
      const owner = resolveOwnerId(ownerId)
      if (!owner) return { ok: false, error: 'Valid owner is required' }
      const res = await api.assignOpportunityApi(id, { ownerId: owner, notes })
      upsertOpportunity(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

function mapOpportunityLinesForApi(lines: NonNullable<Opportunity['lines']> | undefined) {
  if (!lines) return undefined
  return lines.map((line) => ({
    lineNo: line.lineNo,
    productId: isUuid(line.productId ?? undefined) ? line.productId : null,
    itemId: isUuid(line.itemId ?? undefined) ? line.itemId : null,
    itemCode: line.itemCode,
    productOrItem: line.productOrItem,
    description: line.description,
    productFamily: line.productFamily,
    itemType: line.itemType,
    qty: line.qty,
    uom: line.uom,
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    discountAmount: line.discountAmount,
    taxableValue: line.taxableValue,
    taxPct: line.taxPct,
    gstAmount: line.gstAmount,
    lineTotal: line.lineTotal,
    expectedDeliveryDate: toApiDateTime(line.expectedDeliveryDate ?? undefined),
    remarks: line.remarks,
  }))
}

export async function apiUpdateOpportunity(
  id: string,
  patch: Partial<Pick<Opportunity, 'opportunityName' | 'value' | 'probability' | 'expectedCloseDate' | 'priority' | 'ownerId' | 'ownerName' | 'productRequirement' | 'contactId' | 'productId' | 'lines' | 'stage' | 'status' | 'locationId'>>,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('opportunity:update', id), async () => {
    try {
      const existing = useCrmStore.getState().opportunities.find((o) => o.id === id)
      const nextOwnerId = patch.ownerId !== undefined ? resolveOwnerId(patch.ownerId) : undefined
      const ownerChanged =
        Boolean(nextOwnerId)
        && Boolean(existing?.ownerId)
        && nextOwnerId !== resolveOwnerId(existing?.ownerId)

      // Never send workflow-only fields on PATCH (backend sanitize rejects them).
      const payload: Record<string, unknown> = {}
      if (patch.opportunityName !== undefined) payload.opportunityName = patch.opportunityName
      if (patch.value !== undefined) payload.value = patch.value
      if (patch.probability !== undefined) payload.probability = patch.probability
      if (patch.expectedCloseDate !== undefined) payload.expectedCloseDate = toApiDateTime(patch.expectedCloseDate)
      if (patch.priority !== undefined) payload.priority = patch.priority
      if (patch.productRequirement !== undefined) payload.productRequirement = patch.productRequirement
      if (patch.contactId !== undefined) {
        payload.contactId = isUuid(patch.contactId ?? undefined) ? patch.contactId : null
      }
      if (patch.locationId !== undefined) {
        payload.locationId = isUuid(patch.locationId ?? undefined) ? patch.locationId : null
      }
      if (patch.lines !== undefined) {
        payload.lines = mapOpportunityLinesForApi(patch.lines)
      }

      const res = await api.updateOpportunityApi(id, payload)
      upsertOpportunity(res.data)

      if (ownerChanged && nextOwnerId) {
        const assignRes = await api.assignOpportunityApi(id, {
          ownerId: nextOwnerId,
          notes: 'Owner updated from opportunity edit',
        })
        upsertOpportunity(assignRes.data)
      }

      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiMoveOpportunityStage(opportunityId: string, stage: OpportunityStage, lostReason?: string): Promise<StoreActionResult> {
  const before = useCrmStore.getState().opportunities.find((o) => o.id === opportunityId)
  const fromStage = before?.stage
  if (before) {
    const gateOpp = { ...before, ...(stage === 'lost' && lostReason !== undefined ? { lostReason } : {}) }
    const missing = getMissingOpportunityStageFields(gateOpp, stage)
    if (missing.length > 0) {
      return { ok: false, error: formatMissingStageFieldsMessage(missing, opportunityStageLabel(stage)), code: 'STAGE_REQUIREMENTS_INCOMPLETE', missingFields: missing }
    }
  }

  if (stage === 'won') {
    return withSubmitLock(lockKey('opportunity:win', opportunityId), async () => {
      try {
        const res = await api.winOpportunityApi(opportunityId, {})
        upsertOpportunity(res.data)
        if (fromStage && fromStage !== stage) {
          recordLocalStageChangeActivity(opportunityId, fromStage, stage, 'Deal marked as won.')
        }
        return { ok: true }
      } catch (err) {
        return fail(err)
      }
    })
  }
  if (stage === 'lost') {
    return withSubmitLock(lockKey('opportunity:lose', opportunityId), async () => {
      try {
        const res = await api.loseOpportunityApi(opportunityId, { lostReason: lostReason ?? 'Lost' })
        upsertOpportunity(res.data)
        if (fromStage && fromStage !== stage) {
          recordLocalStageChangeActivity(opportunityId, fromStage, stage, lostReason ?? 'Deal marked lost.')
        }
        return { ok: true }
      } catch (err) {
        return fail(err)
      }
    })
  }
  return withSubmitLock(lockKey('opportunity:move-stage', opportunityId), async () => {
    try {
      const pipeline = await getDefaultPipeline()
      const stageRow = pipeline.stages.find((s) => s.slug === stage)
      if (!stageRow) throw new Error(`Unknown stage: ${stage}`)
      const res = await api.moveOpportunityStageApi(opportunityId, stageRow.id)
      upsertOpportunity(res.data)
      if (fromStage && fromStage !== stage) {
        recordLocalStageChangeActivity(opportunityId, fromStage, stage)
      }
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteOpportunity(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('opportunity:delete', id), async () => {
    try {
      await api.deleteOpportunityApi(id)
      removeOpportunity(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiReopenOpportunity(id: string, reason?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('opportunity:reopen', id), async () => {
    try {
      const res = await api.reopenOpportunityApi(id, reason ? { reason } : undefined)
      upsertOpportunity(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

function upsertFollowUp(followUp: import('../../types/crm').FollowUp): void {
  useCrmStore.setState((s) => ({ followUps: [followUp, ...s.followUps.filter((f) => f.id !== followUp.id)] }))
}

function removeFollowUp(id: string): void {
  useCrmStore.setState((s) => ({ followUps: s.followUps.filter((f) => f.id !== id) }))
}

export async function apiCreateFollowUp(input: {
  followUpType: string
  customerId?: string | null
  contactId?: string | null
  opportunityId?: string | null
  leadId?: string | null
  assignedTo?: string | null
  dueDate: string
  dueTime?: string
  priority?: string
  notes?: string
  reminder?: boolean
}): Promise<StoreActionResult & { followUpId?: string }> {
  return withSubmitLock(lockKey('follow-up:create'), async () => {
    try {
      const res = await api.createFollowUpApi({
        followUpType: input.followUpType,
        customerId: input.customerId ?? null,
        contactId: input.contactId ?? null,
        opportunityId: input.opportunityId ?? null,
        leadId: input.leadId ?? null,
        assignedTo: resolveOwnerId(input.assignedTo ?? undefined) ?? null,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        priority: input.priority,
        notes: input.notes,
        reminder: input.reminder,
      })
      upsertFollowUp(res.data)
      return { ok: true, followUpId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateFollowUp(
  id: string,
  patch: Partial<{
    followUpType: string
    dueDate: string
    dueTime: string
    priority: string
    notes: string
    reminder: boolean
  }>,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('follow-up:update', id), async () => {
    try {
      const res = await api.updateFollowUpApi(id, patch)
      upsertFollowUp(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCompleteFollowUp(id: string, outcome: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('follow-up:complete', id), async () => {
    try {
      const res = await api.completeFollowUpApi(id, { outcome })
      upsertFollowUp(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiRescheduleFollowUp(id: string, dueDate: string, dueTime?: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('follow-up:reschedule', id), async () => {
    try {
      const res = await api.rescheduleFollowUpApi(id, { dueDate, dueTime })
      upsertFollowUp(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiSnoozeFollowUp(id: string, dueDate: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('follow-up:snooze', id), async () => {
    try {
      const res = await api.snoozeFollowUpApi(id, { dueDate })
      upsertFollowUp(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteFollowUp(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('follow-up:delete', id), async () => {
    try {
      await api.deleteFollowUpApi(id)
      removeFollowUp(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export * from './quotationApiBridge'
export * from './salesOrderApiBridge'
