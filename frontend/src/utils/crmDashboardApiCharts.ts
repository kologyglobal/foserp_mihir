import type { CrmDashboardMetricsDto } from '../services/api/crmApi'
import type {
  ActivityTrendPoint,
  FollowUpUrgencyPoint,
  OutcomeChartPoint,
  OwnerPipelinePoint,
  PipelineChartPoint,
} from './crmDashboardCharts'
import { resolveStageFunnelColor } from './crmStageTheme'

type ChartsDto = NonNullable<CrmDashboardMetricsDto['charts']>

export interface CrmDashboardChartSeries {
  pipelineChart: PipelineChartPoint[]
  stageFunnel: Array<{ id: string; stage: string; short: string; count: number; fill: string }>
  leadStageFunnel: Array<{ stage: string; label: string; count: number }>
  dealOutcomes: OutcomeChartPoint[]
  activityTrend: ActivityTrendPoint[]
  followUpUrgency: FollowUpUrgencyPoint[]
  ownerPipeline: OwnerPipelinePoint[]
  dealOutcomeMeta: {
    openCount: number
    wonCount: number
    lostCount: number
    conversionRate: number
    weightedForecast: number
  }
}

const OUTCOME_COLORS: Record<string, string> = {
  Open: '#3b82f6',
  Won: '#10b981',
  Lost: '#ef4444',
}

const URGENCY_COLORS: Record<string, string> = {
  Overdue: '#ef4444',
  'Due today': '#f59e0b',
  Upcoming: '#3b82f6',
}

function stageColor(slug: string): string {
  return resolveStageFunnelColor(slug)
}

/** Map backend chart series into chart component data shapes. */
export function buildCrmDashboardChartSeries(
  api: CrmDashboardMetricsDto | null,
): CrmDashboardChartSeries | null {
  if (!api?.charts) return null

  const charts: ChartsDto = api.charts

  const pipelineChart: PipelineChartPoint[] = charts.pipelineByStage.map((row) => ({
    id: row.slug,
    label: row.label,
    shortLabel: row.shortLabel,
    count: row.count,
    value: row.value,
    weighted: row.value,
    color: stageColor(row.slug),
  }))

  const stageFunnel = charts.stageFunnel.map((row) => ({
    id: row.slug,
    stage: row.label,
    short: row.shortLabel,
    count: row.count,
    fill: stageColor(row.slug),
  }))

  const dealOutcomes = [
    { name: 'Open', value: charts.dealOutcomes.open, color: OUTCOME_COLORS.Open },
    { name: 'Won', value: charts.dealOutcomes.won, color: OUTCOME_COLORS.Won },
    { name: 'Lost', value: charts.dealOutcomes.lost, color: OUTCOME_COLORS.Lost },
  ].filter((row) => row.value > 0)

  const followUpUrgency: FollowUpUrgencyPoint[] = charts.followUpUrgency.map((row) => ({
    name: row.name,
    value: row.value,
    color: URGENCY_COLORS[row.name] ?? '#6366f1',
  }))

  return {
    pipelineChart,
    stageFunnel,
    leadStageFunnel: charts.leadStageFunnel,
    dealOutcomes,
    activityTrend: charts.activityTrend,
    followUpUrgency,
    ownerPipeline: charts.ownerPipeline.map((row) => ({
      owner: row.ownerName,
      value: row.value,
      count: row.count,
    })),
    dealOutcomeMeta: {
      openCount: charts.dealOutcomes.open,
      wonCount: charts.dealOutcomes.won,
      lostCount: charts.dealOutcomes.lost,
      conversionRate: api.rates.winRate,
      weightedForecast: api.opportunities.weightedForecast,
    },
  }
}
