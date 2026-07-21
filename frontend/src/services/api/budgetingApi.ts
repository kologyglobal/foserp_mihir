import { apiRequest, tenantPath } from './client'

const BUDGETING = '/accounting/budgeting'

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export type BudgetVersionApiStatus =
  | 'DRAFT'
  | 'IN_PREPARATION'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'LOCKED'
  | 'SUPERSEDED'
  | 'CANCELLED'

export interface BudgetVersionDto {
  id: string
  tenantId: string
  legalEntityId: string
  code: string
  name: string
  kind: string
  status: BudgetVersionApiStatus
  financialYearLabel: string
  fyStartDate: string
  fyEndDate: string
  currencyCode: string
  notes: string | null
  isPrimary: boolean
  submittedAt: string | null
  approvedAt: string | null
  lockedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BudgetLineDto {
  id: string
  versionId: string
  accountId: string
  accountCode: string | null
  accountName: string | null
  costCentreId: string | null
  months: Record<string, string>
  total: string
  notes: string | null
}

export interface BudgetingOverviewDto {
  legalEntityId: string
  totalVersions: number
  countsByStatus: Record<string, number>
  primaryVersionId: string | null
  primaryBudgetTotal: string
  recentVersions: BudgetVersionDto[]
}

export interface BudgetVsActualRowDto {
  accountId: string
  accountCode: string | null
  accountName: string | null
  budget: Record<string, string>
  actual: Record<string, string>
  variance: Record<string, string>
  budgetTotal: string
  actualTotal: string
  varianceTotal: string
}

export async function fetchBudgetingOverview(legalEntityId: string) {
  return apiRequest<BudgetingOverviewDto>(
    `${tenantPath(`${BUDGETING}/overview`)}${buildQuery({ legalEntityId })}`,
  )
}

export async function fetchBudgetVersions(params: {
  legalEntityId?: string
  status?: string
  page?: number
  limit?: number
}) {
  return apiRequest<BudgetVersionDto[]>(
    `${tenantPath(`${BUDGETING}/versions`)}${buildQuery(params)}`,
  )
}

export async function createBudgetVersionApi(data: Record<string, unknown>) {
  return apiRequest<BudgetVersionDto>(tenantPath(`${BUDGETING}/versions`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function submitBudgetVersionApi(id: string, expectedUpdatedAt: string) {
  return apiRequest<BudgetVersionDto>(tenantPath(`${BUDGETING}/versions/${id}/submit`), {
    method: 'POST',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
}

export async function approveBudgetVersionApi(id: string, expectedUpdatedAt: string) {
  return apiRequest<BudgetVersionDto>(tenantPath(`${BUDGETING}/versions/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
}

export async function lockBudgetVersionApi(id: string, expectedUpdatedAt: string) {
  return apiRequest<BudgetVersionDto>(tenantPath(`${BUDGETING}/versions/${id}/lock`), {
    method: 'POST',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
}

export async function fetchBudgetLines(versionId: string) {
  return apiRequest<BudgetLineDto[]>(tenantPath(`${BUDGETING}/versions/${versionId}/lines`))
}

export async function createBudgetLineApi(versionId: string, data: Record<string, unknown>) {
  return apiRequest<BudgetLineDto>(tenantPath(`${BUDGETING}/versions/${versionId}/lines`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBudgetLineApi(
  versionId: string,
  lineId: string,
  data: Record<string, unknown>,
) {
  return apiRequest<BudgetLineDto>(tenantPath(`${BUDGETING}/versions/${versionId}/lines/${lineId}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function fetchBudgetVsActual(legalEntityId: string, versionId: string) {
  return apiRequest<{ version: BudgetVersionDto; rows: BudgetVsActualRowDto[] }>(
    `${tenantPath(`${BUDGETING}/budget-vs-actual`)}${buildQuery({ legalEntityId, versionId })}`,
  )
}
