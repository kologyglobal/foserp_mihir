import type { FixedAssetStatus } from '@prisma/client'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import * as repo from './fixed-assets.repository.js'
import { getCurrentMonthDepreciationDue } from './fixed-asset-depreciation.service.js'
import type { FixedAssetOverviewQueryInput } from './fixed-assets.schemas.js'
import type { FixedAssetOverviewDto, FixedAssetStatusApi } from './fixed-assets.types.js'

const STATUS_LABELS: Record<FixedAssetStatus, FixedAssetStatusApi> = {
  DRAFT: 'Draft',
  PENDING_CAPITALIZATION: 'Pending Capitalization',
  ACTIVE: 'Active',
  IDLE: 'Idle',
  FULLY_DEPRECIATED: 'Fully Depreciated',
  DISPOSED: 'Disposed',
  CANCELLED: 'Cancelled',
}

export async function getOverview(
  tenantId: string,
  query: FixedAssetOverviewQueryInput,
): Promise<FixedAssetOverviewDto> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const [metrics, depreciationDue] = await Promise.all([
    repo.aggregateOverviewMetrics(tenantId, query.legalEntityId),
    getCurrentMonthDepreciationDue(tenantId, query.legalEntityId),
  ])

  const totalAssetValue = formatForPersistence(metrics.totals._sum.acquisitionCost ?? '0', 4)
  const netBookValue = formatForPersistence(metrics.totals._sum.netBookValue ?? '0', 4)
  const accumulatedDepreciation = formatForPersistence(metrics.totals._sum.accumulatedDepreciation ?? '0', 4)

  const statusSummary = metrics.statusGroups.map((group) => ({
    status: STATUS_LABELS[group.status],
    count: group._count._all,
  }))

  const categorySummary = metrics.categoryGroups.map((group) => ({
    categoryId: group.categoryId,
    categoryName: metrics.categoryNameById.get(group.categoryId) ?? 'Unknown',
    count: group._count._all,
    netBookValue: formatForPersistence(group._sum.netBookValue ?? '0', 4),
  }))

  const pendingDisposal = 0

  return {
    legalEntityId: query.legalEntityId,
    totalAssetValue,
    netBookValue,
    accumulatedDepreciation,
    pendingCapitalization: metrics.pendingCapitalization,
    assetsUnderConstruction: 0,
    depreciationDue,
    dueForVerification: 0,
    pendingDisposal,
    statusSummary,
    categorySummary,
    recentActivity: [],
    alerts: [],
    trends: [],
  }
}
