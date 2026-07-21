import type {
  FixedAsset,
  FixedAssetCategory,
  FixedAssetDepreciationLine,
  FixedAssetDepreciationRun,
  FixedAssetDepreciationMethod,
  FixedAssetDepreciationRunStatus,
  FixedAssetDisposalType,
  FixedAssetStatus,
} from '@prisma/client'
import type { Request } from 'express'
import { formatForPersistence } from '../shared/finance-decimal.js'
import type {
  FixedAssetAllowedActions,
  FixedAssetCategoryDto,
  FixedAssetDepreciationLineDto,
  FixedAssetDepreciationMethodApi,
  FixedAssetDepreciationRunDto,
  FixedAssetDepreciationRunStatusApi,
  FixedAssetDisposalTypeApi,
  FixedAssetDto,
  FixedAssetStatusApi,
} from './fixed-assets.types.js'

const STATUS_LABELS: Record<FixedAssetStatus, FixedAssetStatusApi> = {
  DRAFT: 'Draft',
  PENDING_CAPITALIZATION: 'Pending Capitalization',
  ACTIVE: 'Active',
  IDLE: 'Idle',
  FULLY_DEPRECIATED: 'Fully Depreciated',
  DISPOSED: 'Disposed',
  CANCELLED: 'Cancelled',
}

const METHOD_LABELS: Record<FixedAssetDepreciationMethod, FixedAssetDepreciationMethodApi> = {
  STRAIGHT_LINE: 'Straight Line',
}

const RUN_STATUS_LABELS: Record<FixedAssetDepreciationRunStatus, FixedAssetDepreciationRunStatusApi> = {
  DRAFT: 'Draft',
  PREVIEWED: 'Previewed',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
}

const DISPOSAL_TYPE_LABELS: Record<FixedAssetDisposalType, FixedAssetDisposalTypeApi> = {
  SALE: 'Sale',
  SCRAP: 'Scrap',
  WRITE_OFF: 'Write-off',
}

function money(value: string | number | { toString(): string }): string {
  return formatForPersistence(value.toString(), 4)
}

function hasPerm(req: Request | undefined, permission: string): boolean {
  if (!req) return false
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function getAssetAllowedActions(req: Request | undefined, status: FixedAssetStatus): FixedAssetAllowedActions {
  const editable = status === 'DRAFT' || status === 'PENDING_CAPITALIZATION'
  const disposable = status === 'ACTIVE' || status === 'IDLE' || status === 'FULLY_DEPRECIATED'
  return {
    capitalize: editable && hasPerm(req, 'finance.fa.capitalize'),
    edit: editable && hasPerm(req, 'finance.fa.edit'),
    dispose: disposable && hasPerm(req, 'finance.fa.dispose'),
  }
}

export function serializeCategory(category: FixedAssetCategory): FixedAssetCategoryDto {
  return {
    id: category.id,
    legalEntityId: category.legalEntityId,
    code: category.code,
    name: category.name,
    depreciationMethod: METHOD_LABELS[category.depreciationMethod],
    usefulLifeYears: category.usefulLifeYears,
    residualPercent: money(category.residualPercent),
    assetAccountId: category.assetAccountId,
    accumDepAccountId: category.accumDepAccountId,
    depExpenseAccountId: category.depExpenseAccountId,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

export function serializeAsset(
  asset: FixedAsset & { category: Pick<FixedAssetCategory, 'name'> },
  req?: Request,
): FixedAssetDto {
  return {
    id: asset.id,
    legalEntityId: asset.legalEntityId,
    categoryId: asset.categoryId,
    categoryName: asset.category.name,
    assetNumber: asset.assetNumber,
    draftReference: asset.draftReference,
    name: asset.name,
    status: STATUS_LABELS[asset.status],
    acquisitionDate: asset.acquisitionDate.toISOString().slice(0, 10),
    capitalizationDate: asset.capitalizationDate ? asset.capitalizationDate.toISOString().slice(0, 10) : null,
    acquisitionCost: money(asset.acquisitionCost),
    residualValue: money(asset.residualValue),
    usefulLifeYears: asset.usefulLifeYears,
    depreciationMethod: METHOD_LABELS[asset.depreciationMethod],
    accumulatedDepreciation: money(asset.accumulatedDepreciation),
    netBookValue: money(asset.netBookValue),
    location: asset.location,
    plant: asset.plant,
    department: asset.department,
    custodian: asset.custodian,
    serialNumber: asset.serialNumber,
    manufacturer: asset.manufacturer,
    model: asset.model,
    vendorName: asset.vendorName,
    notes: asset.notes,
    currencyCode: asset.currencyCode,
    capitalizationVoucherId: asset.capitalizationVoucherId,
    capitalizationPostingEventId: asset.capitalizationPostingEventId,
    capitalizedAt: asset.capitalizedAt ? asset.capitalizedAt.toISOString() : null,
    disposalType: asset.disposalType ? DISPOSAL_TYPE_LABELS[asset.disposalType] : null,
    disposalDate: asset.disposalDate ? asset.disposalDate.toISOString().slice(0, 10) : null,
    disposalProceeds: asset.disposalProceeds != null ? money(asset.disposalProceeds) : null,
    disposalGainLoss: asset.disposalGainLoss != null ? money(asset.disposalGainLoss) : null,
    disposalProceedsAccountId: asset.disposalProceedsAccountId,
    disposalBuyerName: asset.disposalBuyerName,
    disposalReason: asset.disposalReason,
    disposalVoucherId: asset.disposalVoucherId,
    disposalPostingEventId: asset.disposalPostingEventId,
    disposedAt: asset.disposedAt ? asset.disposedAt.toISOString() : null,
    allowedActions: getAssetAllowedActions(req, asset.status),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

export function serializeDepreciationLine(line: FixedAssetDepreciationLine | FixedAssetDepreciationLineDto): FixedAssetDepreciationLineDto {
  if ('openingNbv' in line && typeof line.openingNbv === 'string') {
    return line as FixedAssetDepreciationLineDto
  }
  const dbLine = line as FixedAssetDepreciationLine
  return {
    id: dbLine.id,
    lineNumber: dbLine.lineNumber,
    assetId: dbLine.assetId,
    assetNumber: dbLine.assetNumber,
    assetName: dbLine.assetName,
    categoryName: dbLine.categoryName,
    openingNbv: money(dbLine.openingNbv),
    depreciationAmount: money(dbLine.depreciationAmount),
    closingNbv: money(dbLine.closingNbv),
    accumulatedDepreciation: money(dbLine.accumulatedDepreciation),
    depExpenseAccountId: dbLine.depExpenseAccountId,
    accumDepAccountId: dbLine.accumDepAccountId,
  }
}

export function serializeDepreciationRun(
  run: FixedAssetDepreciationRun,
  lines?: FixedAssetDepreciationLine[],
): FixedAssetDepreciationRunDto {
  return {
    id: run.id,
    legalEntityId: run.legalEntityId,
    runNumber: run.runNumber,
    periodKey: run.periodKey,
    periodFrom: run.periodFrom.toISOString().slice(0, 10),
    periodTo: run.periodTo.toISOString().slice(0, 10),
    runDate: run.runDate.toISOString().slice(0, 10),
    postingDate: run.postingDate ? run.postingDate.toISOString().slice(0, 10) : null,
    status: RUN_STATUS_LABELS[run.status],
    totalDepreciation: money(run.totalDepreciation),
    assetCount: run.assetCount,
    voucherId: run.voucherId,
    postingEventId: run.postingEventId,
    postedAt: run.postedAt ? run.postedAt.toISOString() : null,
    lines: lines?.map(serializeDepreciationLine),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

export function statusLabelToEnum(label: FixedAssetStatusApi): FixedAssetStatus | undefined {
  const entry = Object.entries(STATUS_LABELS).find(([, v]) => v === label)
  return entry ? (entry[0] as FixedAssetStatus) : undefined
}
