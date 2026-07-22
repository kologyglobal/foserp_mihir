/**
 * Fixed Assets Phase 1 — API client (mirrors backend fixed-assets.types.ts).
 */
import { apiRequest, tenantPath, type ApiResponse } from './client'

export type FixedAssetStatusApi =
  | 'Draft'
  | 'Pending Capitalization'
  | 'Active'
  | 'Idle'
  | 'Fully Depreciated'
  | 'Disposed'
  | 'Cancelled'

export type FixedAssetDepreciationMethodApi = 'Straight Line'

export type FixedAssetDepreciationRunStatusApi = 'Draft' | 'Previewed' | 'Posted' | 'Cancelled'

export interface FixedAssetAllowedActions {
  capitalize: boolean
  edit: boolean
  dispose?: boolean
}

export interface FixedAssetCategoryDto {
  id: string
  legalEntityId: string
  code: string
  name: string
  depreciationMethod: FixedAssetDepreciationMethodApi
  usefulLifeYears: number
  residualPercent: string
  assetAccountId: string
  accumDepAccountId: string
  depExpenseAccountId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FixedAssetDto {
  id: string
  legalEntityId: string
  categoryId: string
  categoryName: string
  assetNumber: string
  draftReference: string | null
  name: string
  status: FixedAssetStatusApi
  acquisitionDate: string
  capitalizationDate: string | null
  acquisitionCost: string
  residualValue: string
  usefulLifeYears: number
  depreciationMethod: FixedAssetDepreciationMethodApi
  accumulatedDepreciation: string
  netBookValue: string
  location: string | null
  plant: string | null
  department: string | null
  custodian: string | null
  serialNumber: string | null
  manufacturer: string | null
  model: string | null
  vendorName: string | null
  notes: string | null
  currencyCode: string
  capitalizationVoucherId: string | null
  capitalizationPostingEventId: string | null
  capitalizedAt: string | null
  disposalType?: string | null
  disposalDate?: string | null
  disposalProceeds?: string | null
  disposalGainLoss?: string | null
  disposalProceedsAccountId?: string | null
  disposalBuyerName?: string | null
  disposalReason?: string | null
  disposalVoucherId?: string | null
  disposalPostingEventId?: string | null
  disposedAt?: string | null
  allowedActions: FixedAssetAllowedActions
  createdAt: string
  updatedAt: string
}

export interface FixedAssetDepreciationLineDto {
  id?: string
  lineNumber: number
  assetId: string
  assetNumber: string
  assetName: string
  categoryName: string
  openingNbv: string
  depreciationAmount: string
  closingNbv: string
  accumulatedDepreciation: string
  depExpenseAccountId: string
  accumDepAccountId: string
}

export interface FixedAssetDepreciationRunDto {
  id: string
  legalEntityId: string
  runNumber: string
  periodKey: string
  periodFrom: string
  periodTo: string
  runDate: string
  postingDate: string | null
  status: FixedAssetDepreciationRunStatusApi
  totalDepreciation: string
  assetCount: number
  voucherId: string | null
  postingEventId: string | null
  postedAt: string | null
  lines?: FixedAssetDepreciationLineDto[]
  createdAt: string
  updatedAt: string
}

export interface FixedAssetDepreciationPreviewDto {
  legalEntityId: string
  periodKey: string
  periodFrom: string
  periodTo: string
  totalDepreciation: string
  assetCount: number
  lines: FixedAssetDepreciationLineDto[]
}

export interface FixedAssetOverviewDto {
  legalEntityId: string
  totalAssetValue: string
  netBookValue: string
  accumulatedDepreciation: string
  pendingCapitalization: number
  assetsUnderConstruction: number
  depreciationDue: string
  dueForVerification: number
  pendingDisposal: number
  statusSummary: Array<{ status: FixedAssetStatusApi; count: number }>
  categorySummary: Array<{ categoryId: string; categoryName: string; count: number; netBookValue: string }>
  recentActivity: unknown[]
  alerts: unknown[]
  trends: unknown[]
}

export interface FixedAssetCapitalizeResultDto {
  asset: FixedAssetDto
  posting: unknown | null
  idempotentReplay: boolean
}

export interface FixedAssetDepreciationPostResultDto {
  run: FixedAssetDepreciationRunDto
  posting: unknown | null
  idempotentReplay: boolean
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

const BASE = '/accounting/fixed-assets'

export async function fetchFixedAssetsOverview(params: {
  legalEntityId: string
}): Promise<ApiResponse<FixedAssetOverviewDto>> {
  return apiRequest<FixedAssetOverviewDto>(`${tenantPath(`${BASE}/overview`)}${buildQuery(params)}`)
}

export async function fetchFixedAssetCategories(params: {
  legalEntityId: string
  isActive?: boolean
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<FixedAssetCategoryDto[]>> {
  return apiRequest<FixedAssetCategoryDto[]>(
    `${tenantPath(`${BASE}/categories`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      isActive: params.isActive,
      search: params.search,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
    })}`,
  )
}

export async function fetchFixedAssetCategory(id: string): Promise<ApiResponse<FixedAssetCategoryDto>> {
  return apiRequest<FixedAssetCategoryDto>(tenantPath(`${BASE}/categories/${id}`))
}

export interface CreateFixedAssetCategoryBody {
  legalEntityId: string
  code: string
  name: string
  usefulLifeYears: number
  residualPercent: string
  assetAccountId: string
  accumDepAccountId: string
  depExpenseAccountId: string
}

export async function createFixedAssetCategory(
  body: CreateFixedAssetCategoryBody,
): Promise<ApiResponse<FixedAssetCategoryDto>> {
  return apiRequest<FixedAssetCategoryDto>(tenantPath(`${BASE}/categories`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateFixedAssetCategory(
  id: string,
  body: Partial<Omit<CreateFixedAssetCategoryBody, 'legalEntityId' | 'code'>> & { isActive?: boolean },
): Promise<ApiResponse<FixedAssetCategoryDto>> {
  return apiRequest<FixedAssetCategoryDto>(tenantPath(`${BASE}/categories/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export interface CreateFixedAssetBody {
  legalEntityId: string
  categoryId: string
  name: string
  acquisitionDate: string
  acquisitionCost: string
  usefulLifeYears?: number
  draftReference?: string
  location?: string
  plant?: string
  department?: string
  custodian?: string
  serialNumber?: string
  manufacturer?: string
  model?: string
  vendorName?: string
  notes?: string
  currencyCode?: string
  status?: 'DRAFT' | 'PENDING_CAPITALIZATION'
}

export async function createFixedAsset(body: CreateFixedAssetBody): Promise<ApiResponse<FixedAssetDto>> {
  return apiRequest<FixedAssetDto>(tenantPath(`${BASE}/assets`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateFixedAsset(
  id: string,
  body: Partial<Omit<CreateFixedAssetBody, 'legalEntityId'>> & { expectedUpdatedAt?: string },
): Promise<ApiResponse<FixedAssetDto>> {
  return apiRequest<FixedAssetDto>(tenantPath(`${BASE}/assets/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function fetchFixedAssets(params: {
  legalEntityId: string
  categoryId?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<FixedAssetDto[]>> {
  return apiRequest<FixedAssetDto[]>(
    `${tenantPath(`${BASE}/assets`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      categoryId: params.categoryId,
      status: params.status,
      search: params.search,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
    })}`,
  )
}

export async function fetchFixedAsset(id: string): Promise<ApiResponse<FixedAssetDto>> {
  return apiRequest<FixedAssetDto>(tenantPath(`${BASE}/assets/${id}`))
}

export async function capitalizeFixedAsset(
  id: string,
  body?: { postingDate?: string; creditAccountId?: string; expectedUpdatedAt?: string },
): Promise<ApiResponse<FixedAssetCapitalizeResultDto>> {
  return apiRequest<FixedAssetCapitalizeResultDto>(tenantPath(`${BASE}/assets/${id}/capitalize`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function fetchDepreciationRuns(params: {
  legalEntityId: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<FixedAssetDepreciationRunDto[]>> {
  return apiRequest<FixedAssetDepreciationRunDto[]>(
    `${tenantPath(`${BASE}/depreciation-runs`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      status: params.status,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
    })}`,
  )
}

export async function fetchDepreciationRun(id: string): Promise<ApiResponse<FixedAssetDepreciationRunDto>> {
  return apiRequest<FixedAssetDepreciationRunDto>(tenantPath(`${BASE}/depreciation-runs/${id}`))
}

export async function previewDepreciationRun(body: {
  legalEntityId: string
  periodKey: string
}): Promise<ApiResponse<FixedAssetDepreciationPreviewDto>> {
  return apiRequest<FixedAssetDepreciationPreviewDto>(tenantPath(`${BASE}/depreciation-runs/preview`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createDepreciationRun(body: {
  legalEntityId: string
  periodKey: string
  postingDate?: string
}): Promise<ApiResponse<FixedAssetDepreciationPostResultDto>> {
  return apiRequest<FixedAssetDepreciationPostResultDto>(tenantPath(`${BASE}/depreciation-runs`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type FixedAssetDisposalTypeApi = 'Sale' | 'Scrap' | 'Write-off'

export interface FixedAssetDisposalPreviewDto {
  assetId: string
  assetNumber: string
  assetName: string
  disposalType: FixedAssetDisposalTypeApi
  acquisitionCost: string
  accumulatedDepreciation: string
  netBookValue: string
  proceeds: string
  gainLoss: string
  isGain: boolean
  currencyCode: string
  isPartial?: boolean
  disposeCostAmount?: string | null
  disposedAccumDep?: string | null
  disposedNbv?: string | null
  remainingCost?: string | null
  remainingNbv?: string | null
}

export interface FixedAssetDisposeResultDto {
  asset: FixedAssetDto
  preview: FixedAssetDisposalPreviewDto
  posting: unknown | null
  idempotentReplay: boolean
  isPartial?: boolean
  disposalId?: string | null
}

export async function disposeFixedAsset(
  id: string,
  body: {
    disposalType: 'SALE' | 'SCRAP' | 'WRITE_OFF'
    disposalDate?: string
    postingDate?: string
    proceeds?: string
    disposeCostAmount?: string
    proceedsAccountId?: string
    buyerName?: string
    reason: string
    expectedUpdatedAt?: string
  },
): Promise<ApiResponse<FixedAssetDisposeResultDto>> {
  return apiRequest<FixedAssetDisposeResultDto>(tenantPath(`${BASE}/assets/${id}/dispose`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function previewFixedAssetDispose(
  id: string,
  body: {
    disposalType: 'SALE' | 'SCRAP' | 'WRITE_OFF'
    proceeds?: string
    disposeCostAmount?: string
  },
): Promise<ApiResponse<FixedAssetDisposalPreviewDto>> {
  return apiRequest<FixedAssetDisposalPreviewDto>(tenantPath(`${BASE}/assets/${id}/dispose/preview`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type FixedAssetTransferStatusApi = 'Draft' | 'Completed' | 'Cancelled'

export interface FixedAssetTransferDto {
  id: string
  legalEntityId: string
  assetId: string
  assetNumber: string
  assetName: string
  transferNumber: string
  transferDate: string
  status: FixedAssetTransferStatusApi
  fromLocation: string | null
  fromPlant: string | null
  fromDepartment: string | null
  fromCustodian: string | null
  toLocation: string | null
  toPlant: string | null
  toDepartment: string | null
  toCustodian: string | null
  reason: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function fetchFixedAssetTransfers(params: {
  legalEntityId: string
  assetId?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<FixedAssetTransferDto[]>> {
  return apiRequest<FixedAssetTransferDto[]>(
    `${tenantPath(`${BASE}/transfers`)}${buildQuery({
      legalEntityId: params.legalEntityId,
      assetId: params.assetId,
      status: params.status,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
    })}`,
  )
}

export async function createFixedAssetTransfer(body: {
  legalEntityId: string
  assetId: string
  transferDate?: string
  toLocation?: string
  toPlant?: string
  toDepartment?: string
  toCustodian?: string
  reason: string
}): Promise<ApiResponse<FixedAssetTransferDto>> {
  return apiRequest<FixedAssetTransferDto>(tenantPath(`${BASE}/transfers`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function completeFixedAssetTransfer(
  id: string,
  body?: { expectedUpdatedAt?: string; assetExpectedUpdatedAt?: string },
): Promise<ApiResponse<FixedAssetTransferDto>> {
  return apiRequest<FixedAssetTransferDto>(tenantPath(`${BASE}/transfers/${id}/complete`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}
