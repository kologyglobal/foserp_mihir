import type { Opportunity } from '../types/crm'
import { opportunityStageLabel } from './opportunityUtils'

export type ForecastMonthRow = {
  month: string
  label: string
  pipeline: number
  weighted: number
  count: number
}

export type ForecastOwnerRow = {
  ownerName: string
  pipeline: number
  weighted: number
  count: number
}

export type ForecastStageRow = {
  stage: string
  label: string
  pipeline: number
  weighted: number
  count: number
}

export type ForecastAtRiskRow = {
  id: string
  opportunityName: string
  stage: string
  probability: number
  value: number
  expectedCloseDate?: string | null
  ownerName?: string
}

export type CrmSalesForecastSnapshot = {
  openCount: number
  pipelineValue: number
  weightedForecast: number
  avgProbability: number
  closingThisMonth: number
  closingThisQuarter: number
  byMonth: ForecastMonthRow[]
  byOwner: ForecastOwnerRow[]
  byStage: ForecastStageRow[]
  atRisk: ForecastAtRiskRow[]
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

function addToBucket<T extends { pipeline: number; weighted: number; count: number }>(
  map: Map<string, T>,
  key: string,
  factory: () => T,
  value: number,
  probability: number,
) {
  const row = map.get(key) ?? factory()
  row.pipeline += value
  row.weighted += value * (probability / 100)
  row.count += 1
  map.set(key, row)
}

export function buildCrmSalesForecast(opportunities: Opportunity[]): CrmSalesForecastSnapshot {
  const open = opportunities.filter((o) => o.status === 'open')
  const now = new Date()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
    .toISOString()
    .slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const pipelineValue = open.reduce((s, o) => s + o.value, 0)
  const weightedForecast = open.reduce((s, o) => s + o.value * (o.probability / 100), 0)
  const avgProbability = open.length
    ? Math.round(open.reduce((s, o) => s + o.probability, 0) / open.length)
    : 0

  const closingThisMonth = open.filter(
    (o) => o.expectedCloseDate && o.expectedCloseDate >= today && o.expectedCloseDate <= monthEnd,
  ).length
  const closingThisQuarter = open.filter(
    (o) => o.expectedCloseDate && o.expectedCloseDate >= today && o.expectedCloseDate <= quarterEnd,
  ).length

  const byMonthMap = new Map<string, ForecastMonthRow>()
  const byOwnerMap = new Map<string, ForecastOwnerRow>()
  const byStageMap = new Map<string, ForecastStageRow>()

  for (const o of open) {
    const monthKey = o.expectedCloseDate ? o.expectedCloseDate.slice(0, 7) : 'unscheduled'
    addToBucket(
      byMonthMap,
      monthKey,
      () => ({
        month: monthKey,
        label: monthKey === 'unscheduled' ? 'Unscheduled' : monthLabel(monthKey),
        pipeline: 0,
        weighted: 0,
        count: 0,
      }),
      o.value,
      o.probability,
    )

    const owner = o.ownerName?.trim() || 'Unassigned'
    addToBucket(
      byOwnerMap,
      owner,
      () => ({ ownerName: owner, pipeline: 0, weighted: 0, count: 0 }),
      o.value,
      o.probability,
    )

    addToBucket(
      byStageMap,
      o.stage,
      () => ({
        stage: o.stage,
        label: opportunityStageLabel(o.stage),
        pipeline: 0,
        weighted: 0,
        count: 0,
      }),
      o.value,
      o.probability,
    )
  }

  const byMonth = [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month))
  const byOwner = [...byOwnerMap.values()].sort((a, b) => b.weighted - a.weighted)
  const byStage = [...byStageMap.values()].sort((a, b) => b.pipeline - a.pipeline)

  const atRisk: ForecastAtRiskRow[] = [...open]
    .filter((o) => {
      if (!o.expectedCloseDate) return true
      const close = o.expectedCloseDate.slice(0, 10)
      return close < today || o.probability < 25
    })
    .sort((a, b) => a.probability - b.probability || b.value - a.value)
    .slice(0, 12)
    .map((o) => ({
      id: o.id,
      opportunityName: o.opportunityName,
      stage: o.stage,
      probability: o.probability,
      value: o.value,
      expectedCloseDate: o.expectedCloseDate || null,
      ownerName: o.ownerName,
    }))

  return {
    openCount: open.length,
    pipelineValue,
    weightedForecast,
    avgProbability,
    closingThisMonth,
    closingThisQuarter,
    byMonth,
    byOwner,
    byStage,
    atRisk,
  }
}
