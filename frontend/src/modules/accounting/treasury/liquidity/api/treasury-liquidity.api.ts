import * as api from '@/services/api/treasuryApi'
import type {
  ClosingControlsResult,
  LiquidityQuery,
  ShortTermForecastResult,
  TreasuryDashboardResult,
  TreasuryDayCloseDto,
} from './treasury-liquidity.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchTreasuryDashboard(query: LiquidityQuery): Promise<TreasuryDashboardResult> {
  return unwrap(await api.getTreasuryLiquidityDashboard(query))
}

export async function fetchClosingControls(query: LiquidityQuery): Promise<ClosingControlsResult> {
  return unwrap(await api.getTreasuryClosingControls(query))
}

export async function fetchLiquidityForecast(query: LiquidityQuery): Promise<ShortTermForecastResult> {
  return unwrap(await api.getTreasuryLiquidityForecast(query))
}

export async function createDayClose(data: {
  legalEntityId: string
  closeDate: string
  notes?: string | null
}): Promise<TreasuryDayCloseDto> {
  return unwrap(await api.createTreasuryDayClose(data))
}

export async function reviewDayClose(
  id: string,
  data: { expectedUpdatedAt: string; notes?: string | null },
): Promise<TreasuryDayCloseDto> {
  return unwrap(await api.reviewTreasuryDayClose(id, data))
}

export async function closeDayClose(
  id: string,
  data: { expectedUpdatedAt: string; notes?: string | null },
): Promise<TreasuryDayCloseDto> {
  return unwrap(await api.closeTreasuryDayClose(id, data))
}

export async function reopenDayClose(
  id: string,
  data: { expectedUpdatedAt: string; reason: string; notes?: string | null },
): Promise<TreasuryDayCloseDto> {
  return unwrap(await api.reopenTreasuryDayClose(id, data))
}
