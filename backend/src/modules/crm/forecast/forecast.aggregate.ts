/** Pure forecast rollup — unit-tested without DB. */

export type ForecastInputRow = {
  id: string
  name: string
  amount: number
  /** Prefer pipeline stage probability; fall back to opportunity.probability. */
  probability: number
  expectedCloseDate: string | null
  ownerId: string | null
  ownerName: string
  stageId: string
  stageSlug: string
  stageLabel: string
}

export type ForecastMonthRow = {
  month: string
  label: string
  pipeline: number
  weighted: number
  count: number
}

export type ForecastOwnerRow = {
  ownerId: string | null
  ownerName: string
  pipeline: number
  weighted: number
  count: number
}

export type ForecastStageRow = {
  stageId: string
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
  expectedCloseDate: string | null
  ownerName: string
}

export type SalesForecastSnapshot = {
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
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
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

function dateBounds(now: Date): { today: string; monthEnd: string; quarterEnd: string } {
  const today = now.toISOString().slice(0, 10)
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)
  const qStartMonth = Math.floor(now.getUTCMonth() / 3) * 3
  const quarterEnd = new Date(Date.UTC(now.getUTCFullYear(), qStartMonth + 3, 0))
    .toISOString()
    .slice(0, 10)
  return { today, monthEnd, quarterEnd }
}

/** Weighted forecast = Σ (amount × probability / 100). */
export function weightedForecastTotal(rows: Array<{ amount: number; probability: number }>): number {
  return rows.reduce((sum, row) => sum + row.amount * (row.probability / 100), 0)
}

export function aggregateSalesForecast(
  rows: ForecastInputRow[],
  now: Date = new Date(),
): SalesForecastSnapshot {
  const { today, monthEnd, quarterEnd } = dateBounds(now)

  const pipelineValue = rows.reduce((s, r) => s + r.amount, 0)
  const weightedForecast = weightedForecastTotal(rows)
  const avgProbability = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.probability, 0) / rows.length)
    : 0

  const closingThisMonth = rows.filter(
    (r) => r.expectedCloseDate && r.expectedCloseDate >= today && r.expectedCloseDate <= monthEnd,
  ).length
  const closingThisQuarter = rows.filter(
    (r) => r.expectedCloseDate && r.expectedCloseDate >= today && r.expectedCloseDate <= quarterEnd,
  ).length

  const byMonthMap = new Map<string, ForecastMonthRow>()
  const byOwnerMap = new Map<string, ForecastOwnerRow>()
  const byStageMap = new Map<string, ForecastStageRow>()

  for (const r of rows) {
    const monthKey = r.expectedCloseDate ? r.expectedCloseDate.slice(0, 7) : 'unscheduled'
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
      r.amount,
      r.probability,
    )

    const ownerKey = r.ownerId ?? '__unassigned__'
    addToBucket(
      byOwnerMap,
      ownerKey,
      () => ({
        ownerId: r.ownerId,
        ownerName: r.ownerName.trim() || 'Unassigned',
        pipeline: 0,
        weighted: 0,
        count: 0,
      }),
      r.amount,
      r.probability,
    )

    addToBucket(
      byStageMap,
      r.stageId,
      () => ({
        stageId: r.stageId,
        stage: r.stageSlug,
        label: r.stageLabel,
        pipeline: 0,
        weighted: 0,
        count: 0,
      }),
      r.amount,
      r.probability,
    )
  }

  const byMonth = [...byMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month))
  const byOwner = [...byOwnerMap.values()].sort((a, b) => b.weighted - a.weighted)
  const byStage = [...byStageMap.values()].sort((a, b) => b.pipeline - a.pipeline)

  const atRisk = [...rows]
    .filter((r) => {
      if (!r.expectedCloseDate) return true
      return r.expectedCloseDate < today || r.probability < 25
    })
    .sort((a, b) => a.probability - b.probability || b.amount - a.amount)
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      opportunityName: r.name,
      stage: r.stageSlug,
      probability: r.probability,
      value: r.amount,
      expectedCloseDate: r.expectedCloseDate,
      ownerName: r.ownerName,
    }))

  return {
    openCount: rows.length,
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
