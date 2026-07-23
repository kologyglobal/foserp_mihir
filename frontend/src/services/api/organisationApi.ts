import { apiRequest, tenantPath } from '../api/client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type OrgLegalEntity = {
  id: string
  tenantId: string
  code: string
  legalName: string
  tradeName: string
  businessType: string
  gstNumber: string | null
  pan: string | null
  country: string
  state: string
  district: string | null
  city: string
  postalCode: string
  addressLine: string
  status: 'ACTIVE' | 'INACTIVE'
  isDefault: boolean
  fiscalYearStartMonth: number
  createdAt: string
  updatedAt: string
}

export type OrgRegistration = {
  id: string
  tenantId: string
  legalEntityId: string
  registrationType: 'GST' | 'PAN' | 'CIN' | 'OTHER'
  registrationNumber: string
  country: string
  state: string | null
  validFrom: string | null
  validTo: string | null
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export type OrgAccount = {
  id: string
  accountCode: string
  accountName: string
  category: string
  accountType: string
  isGroup: boolean
  isActive: boolean
}

export type OrgMapping = {
  id: string
  legalEntityId: string
  transactionType: string
  accountId: string
  account?: { accountCode: string; accountName: string }
}

export type OrgFiscalYear = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  isCurrent: boolean
}

export type OrgPeriod = {
  id: string
  name: string
  periodNumber: number
  startDate: string
  endDate: string
  status: string
  financialYearId: string
}

function unwrapList<T>(res: { data: T[] | { items?: T[] }; meta?: unknown }): T[] {
  const data = res.data as T[] | { items?: T[] }
  if (Array.isArray(data)) return data
  return data.items ?? []
}

export async function listOrgLegalEntities() {
  const res = await apiRequest<OrgLegalEntity[] | { items: OrgLegalEntity[] }>(
    `${tenantPath('/organisation/legal-entities')}${buildQuery({ limit: 100 })}`,
  )
  return unwrapList(res)
}

export async function createOrgLegalEntity(data: Record<string, unknown>) {
  const res = await apiRequest<OrgLegalEntity>(tenantPath('/organisation/legal-entities'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function updateOrgLegalEntity(id: string, data: Record<string, unknown>) {
  const res = await apiRequest<OrgLegalEntity>(tenantPath(`/organisation/legal-entities/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function listOrgRegistrations(legalEntityId?: string) {
  const res = await apiRequest<OrgRegistration[] | { items: OrgRegistration[] }>(
    `${tenantPath('/organisation/registrations')}${buildQuery({ legalEntityId, limit: 100 })}`,
  )
  return unwrapList(res)
}

export async function createOrgRegistration(data: Record<string, unknown>) {
  const res = await apiRequest<OrgRegistration>(tenantPath('/organisation/registrations'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function updateOrgRegistration(id: string, data: Record<string, unknown>) {
  const res = await apiRequest<OrgRegistration>(tenantPath(`/organisation/registrations/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function listOrgChartOfAccounts(legalEntityId: string) {
  const res = await apiRequest<OrgAccount[] | { items: OrgAccount[] }>(
    `${tenantPath('/organisation/chart-of-accounts')}${buildQuery({ legalEntityId, limit: 500 })}`,
  )
  return unwrapList(res)
}

export async function createOrgAccount(data: Record<string, unknown>) {
  const res = await apiRequest<OrgAccount>(tenantPath('/organisation/chart-of-accounts'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function listOrgAccountMappings(legalEntityId: string) {
  const res = await apiRequest<OrgMapping[]>(
    `${tenantPath('/organisation/account-mappings')}${buildQuery({ legalEntityId })}`,
  )
  return Array.isArray(res.data) ? res.data : []
}

export async function upsertOrgAccountMappings(legalEntityId: string, mappings: Array<{ transactionType: string; accountId: string }>) {
  const res = await apiRequest<OrgMapping[]>(tenantPath('/organisation/account-mappings'), {
    method: 'PUT',
    body: JSON.stringify({ legalEntityId, mappings }),
  })
  return res.data
}

export async function listOrgFiscalYears(legalEntityId?: string) {
  const res = await apiRequest<OrgFiscalYear[] | { items: OrgFiscalYear[] }>(
    `${tenantPath('/organisation/fiscal-years')}${buildQuery({ legalEntityId, limit: 100 })}`,
  )
  return unwrapList(res)
}

export async function createOrgFiscalYear(data: Record<string, unknown>) {
  const res = await apiRequest<OrgFiscalYear>(tenantPath('/organisation/fiscal-years'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function listOrgPostingPeriods(params?: { legalEntityId?: string; financialYearId?: string }) {
  const res = await apiRequest<OrgPeriod[] | { items: OrgPeriod[] }>(
    `${tenantPath('/organisation/posting-periods')}${buildQuery({ ...params, limit: 100 })}`,
  )
  return unwrapList(res)
}

export async function generateOrgPostingPeriods(financialYearId: string) {
  const res = await apiRequest<OrgPeriod[]>(tenantPath('/organisation/posting-periods/generate'), {
    method: 'POST',
    body: JSON.stringify({ financialYearId }),
  })
  return res.data
}
