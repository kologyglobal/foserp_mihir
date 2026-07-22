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
  dispose: boolean
}

export type FixedAssetDisposalTypeApi = 'Sale' | 'Scrap' | 'Write-off'

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
  disposalType: FixedAssetDisposalTypeApi | null
  disposalDate: string | null
  disposalProceeds: string | null
  disposalGainLoss: string | null
  disposalProceedsAccountId: string | null
  disposalBuyerName: string | null
  disposalReason: string | null
  disposalVoucherId: string | null
  disposalPostingEventId: string | null
  disposedAt: string | null
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
  posting: import('../posting/posting.types.js').PostingResult | null
  idempotentReplay: boolean
}

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
  posting: import('../posting/posting.types.js').PostingResult | null
  idempotentReplay: boolean
  isPartial?: boolean
  disposalId?: string | null
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
