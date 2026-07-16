import type { Lead } from '../types/sales'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import {
  KPI_ICON_PRESETS,
  buildSparklineFromCounts,
  countSince,
  percentOf,
} from '../design-system/enterprise/enterpriseKpiUtils'
import { formatCompactCurrency } from './formatters/currency'
export interface LeadKpiCounts {
  open: number
  qualified: number
  converted: number
  lost: number
  pipeline: number
}

function dailyCounts(leads: Lead[], predicate: (l: Lead) => boolean, days = 7): number[] {
  const counts: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - i)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    counts.push(
      leads.filter((l) => {
        if (!predicate(l)) return false
        const c = new Date(l.createdAt)
        return c >= day && c < next
      }).length,
    )
  }
  return counts
}

function countToday(leads: Lead[], predicate: (l: Lead) => boolean): number {
  return leads.filter((l) => predicate(l) && countSince(l.createdAt, 0)).length
}

export function buildLeadRegisterKpiItems(
  leads: Lead[],
  kpis: LeadKpiCounts,
  filters: { status: string; stage: string },
  onFilter: (patch: { status?: string; stage?: string }) => void,
): EnterpriseKpiItem[] {
  const visible = leads.filter((l) => !l.isArchived)
  const total = visible.length
  const now = Date.now()

  const openLeads = visible.filter((l) => l.stage !== 'closed' && l.stage !== 'converted_to_opportunity')
  const qualifiedLeads = visible.filter((l) => l.stage === 'qualified' || l.stage === 'requirement_collected')
  const convertedLeads = visible.filter((l) => l.stage === 'converted_to_opportunity')

  const openToday = countToday(visible, (l) => l.stage !== 'closed' && l.stage !== 'converted_to_opportunity')
  const qualifiedToday = countToday(visible, (l) => l.stage === 'qualified' || l.stage === 'requirement_collected')
  const lostWeek = visible.filter((l) => l.stage === 'closed' && countSince(l.createdAt, 7)).length

  // Cap to 4 high-action KPIs — expected-revenue demoted from register strip
  return [
    {
      id: 'open',
      label: 'Open Leads',
      value: kpis.open,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      active: filters.status === 'open',
      context: `${percentOf(kpis.open, total)} of total · ${formatCompactCurrency(kpis.pipeline)} expected`,
      trend: openToday > 0
        ? { direction: 'up', label: `+${openToday} today`, tone: 'positive' }
        : { direction: 'flat', label: 'No new today', tone: 'neutral' },
      sparkline: buildSparklineFromCounts(dailyCounts(visible, (l) => l.stage !== 'closed' && l.stage !== 'converted_to_opportunity')),
      updatedAt: now,
      onClick: () => onFilter({ status: filters.status === 'open' ? '' : 'open', stage: '' }),
    },
    {
      id: 'qualified',
      label: 'Qualified',
      value: kpis.qualified,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'green',
      active: filters.stage === 'qualified',
      context: total > 0
        ? `${percentOf(kpis.qualified, total)} · ${openLeads.length} open · ${qualifiedLeads.length} on path`
        : undefined,
      trend: qualifiedToday > 0
        ? { direction: 'up', label: `+${qualifiedToday} today`, tone: 'positive' }
        : undefined,
      sparkline: buildSparklineFromCounts(dailyCounts(visible, (l) => l.stage === 'qualified' || l.stage === 'requirement_collected')),
      updatedAt: now,
      onClick: () => onFilter({ stage: filters.stage === 'qualified' ? '' : 'qualified', status: '' }),
    },
    {
      id: 'converted',
      label: 'Converted',
      value: kpis.converted,
      icon: KPI_ICON_PRESETS.converted,
      accent: 'green',
      active: filters.status === 'converted',
      context: `${convertedLeads.length} to opportunity`,
      sparkline: buildSparklineFromCounts(dailyCounts(visible, (l) => l.stage === 'converted_to_opportunity')),
      updatedAt: now,
      onClick: () => onFilter({ status: filters.status === 'converted' ? '' : 'converted', stage: '' }),
    },
    {
      id: 'lost',
      label: 'Lost / Closed',
      value: kpis.lost,
      icon: KPI_ICON_PRESETS.lost,
      accent: 'red',
      active: filters.status === 'closed',
      context: total > 0 ? `${percentOf(kpis.lost, total)} loss ratio` : undefined,
      trend: lostWeek > 0
        ? { direction: 'down', label: `${lostWeek} this week`, tone: 'negative' }
        : undefined,
      sparkline: buildSparklineFromCounts(dailyCounts(visible, (l) => l.stage === 'closed')),
      updatedAt: now,
      onClick: () => onFilter({ status: filters.status === 'closed' ? '' : 'closed', stage: '' }),
    },
  ]
}
