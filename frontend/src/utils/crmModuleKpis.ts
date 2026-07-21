import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  FileText,
  FolderOpen,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { EnterpriseKpiItem } from '../design-system/enterprise/enterpriseKpiTypes'
import { KPI_ICON_PRESETS } from '../design-system/enterprise/enterpriseKpiUtils'
import type { CrmDashboardMetrics } from './crmMetrics'
import type { CrmReportId } from './crmReports'
import type { CrmSalesForecastSnapshot } from './crmForecastMetrics'
import { formatCompactCurrency } from './formatters/currency'
export function buildForecastKpiStrip(forecast: CrmSalesForecastSnapshot): EnterpriseKpiItem[] {
  const now = Date.now()
  return [
    {
      id: 'pipeline',
      label: 'Open Pipeline',
      value: formatCompactCurrency(forecast.pipelineValue),
      icon: KPI_ICON_PRESETS.pipeline,
      accent: 'blue',
      context: `${forecast.openCount} opportunities`,
      trend: forecast.openCount > 0
        ? { direction: 'up', label: 'Active deals', tone: 'neutral' }
        : undefined,
      updatedAt: now,
    },
    {
      id: 'weighted',
      label: 'Weighted Forecast',
      value: formatCompactCurrency(forecast.weightedForecast),
      icon: KPI_ICON_PRESETS.revenue,
      accent: 'green',
      context: `Avg probability ${forecast.avgProbability}%`,
      updatedAt: now,
    },
    {
      id: 'month',
      label: 'Closing This Month',
      value: forecast.closingThisMonth,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'amber',
      context: 'Expected close this month',
      trend: forecast.closingThisMonth > 0
        ? { direction: 'up', label: `${forecast.closingThisMonth} deals`, tone: 'positive' }
        : { direction: 'flat', label: 'None scheduled', tone: 'neutral' },
      updatedAt: now,
    },
    {
      id: 'quarter',
      label: 'Closing This Quarter',
      value: forecast.closingThisQuarter,
      icon: Target,
      accent: 'slate',
      context: 'Expected close this quarter',
      updatedAt: now,
    },
    {
      id: 'at-risk',
      label: 'At-Risk Deals',
      value: forecast.atRisk.length,
      icon: KPI_ICON_PRESETS.lost,
      accent: forecast.atRisk.length > 0 ? 'red' : 'green',
      context: forecast.atRisk.length > 0 ? 'Needs attention' : 'Pipeline healthy',
      updatedAt: now,
    },
  ]
}

export function buildCrmReportsHubKpiStrip(input: {
  catalogSize: number
  openOpps: number
  openPipeline: number
  overdueFollowUps: number
  pendingQuotations: number
  wonCount: number
  reportPath: (id: CrmReportId) => string
}): EnterpriseKpiItem[] {
  const now = Date.now()
  const actionItems = input.overdueFollowUps + input.pendingQuotations
  return [
    {
      id: 'library',
      label: 'Report Library',
      value: input.catalogSize,
      icon: BarChart3,
      accent: 'slate',
      context: 'Curated CRM exports',
      updatedAt: now,
    },
    {
      id: 'open-opps',
      label: 'Open Opportunities',
      value: input.openOpps,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      context: 'In active pipeline',
      href: input.reportPath('pipeline'),
      updatedAt: now,
    },
    {
      id: 'pipeline',
      label: 'Pipeline Value',
      value: formatCompactCurrency(input.openPipeline),
      icon: KPI_ICON_PRESETS.pipeline,
      accent: 'green',
      context: `${input.openOpps} open deals`,
      href: input.reportPath('pipeline'),
      updatedAt: now,
    },
    {
      id: 'actions',
      label: 'Action Items',
      value: actionItems,
      icon: Bell,
      accent: input.overdueFollowUps > 0 ? 'red' : 'amber',
      context: input.overdueFollowUps > 0
        ? `${input.overdueFollowUps} overdue follow-ups`
        : 'Follow-ups & quotations',
      trend: input.overdueFollowUps > 0
        ? { direction: 'down', label: 'Overdue', tone: 'negative' }
        : undefined,
      href: input.reportPath('follow-up-due'),
      updatedAt: now,
    },
    {
      id: 'won',
      label: 'Won Deals',
      value: input.wonCount,
      icon: CheckCircle2,
      accent: 'green',
      context: 'Closed-won outcomes',
      href: input.reportPath('won-lost'),
      updatedAt: now,
    },
  ]
}

export function buildCrmReportDetailKpiStrip(input: {
  rowCount: number
  categoryLabel: string
  columnCount: number
}): EnterpriseKpiItem[] {
  const now = Date.now()
  return [
    {
      id: 'rows',
      label: 'Total Rows',
      value: input.rowCount,
      icon: FileText,
      accent: 'blue',
      context: 'Live CRM data',
      updatedAt: now,
    },
    {
      id: 'category',
      label: 'Category',
      value: input.categoryLabel,
      icon: FolderOpen,
      accent: 'slate',
      context: 'Report classification',
      updatedAt: now,
    },
    {
      id: 'columns',
      label: 'Columns',
      value: input.columnCount,
      icon: Activity,
      accent: 'slate',
      context: 'Sortable & searchable',
      updatedAt: now,
    },
    {
      id: 'export',
      label: 'Export',
      value: 'CSV',
      icon: KPI_ICON_PRESETS.revenue,
      accent: 'green',
      context: 'Use toolbar below',
      updatedAt: now,
    },
  ]
}

export function buildCrmQuotationRegisterKpis(
  kpis: { total: number; totalValue: number; pending: number; approved: number; draft: number },
  segment: string,
  onSegment: (seg: string) => void,
): EnterpriseKpiItem[] {
  const now = Date.now()
  // Cap to 4 — portfolio value folded into Documents context
  return [
    {
      id: 'documents',
      label: 'Documents',
      value: kpis.total,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      context: `${formatCompactCurrency(kpis.totalValue)} portfolio`,
      active: segment === 'all',
      onClick: () => onSegment('all'),
      updatedAt: now,
    },
    {
      id: 'pending',
      label: 'Pending Approval',
      value: kpis.pending,
      icon: Bell,
      accent: 'amber',
      context: 'Awaiting sign-off',
      active: segment === 'pending',
      trend: kpis.pending > 0
        ? { direction: 'up', label: 'Needs review', tone: 'neutral' }
        : undefined,
      onClick: () => onSegment(segment === 'pending' ? 'all' : 'pending'),
      updatedAt: now,
    },
    {
      id: 'approved',
      label: 'Approved',
      value: kpis.approved,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'green',
      context: 'Ready to send / convert',
      active: segment === 'approved',
      onClick: () => onSegment(segment === 'approved' ? 'all' : 'approved'),
      updatedAt: now,
    },
    {
      id: 'draft',
      label: 'Drafts',
      value: kpis.draft,
      icon: FileText,
      accent: 'slate',
      context: 'In progress',
      active: segment === 'draft',
      onClick: () => onSegment(segment === 'draft' ? 'all' : 'draft'),
      updatedAt: now,
    },
  ]
}

export function buildCrmDashboardKpiStrip(
  metrics: CrmDashboardMetrics,
  approvalPending: number,
): ModuleDashboardKpiCompat[] {
  const now = Date.now()
  return [
    {
      id: 'open-opps',
      label: 'Open Opportunities',
      value: metrics.openOpportunities,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      context: 'In pipeline',
      href: '/crm/opportunities',
      updatedAt: now,
    },
    {
      id: 'quotes-pending',
      label: 'Quotations Pending',
      value: metrics.quotationsPending,
      icon: FileText,
      accent: approvalPending > 0 ? 'amber' : 'slate',
      context: approvalPending > 0 ? `${approvalPending} need approval` : 'All clear',
      trend: approvalPending > 0
        ? { direction: 'up', label: `${approvalPending} awaiting`, tone: 'neutral' }
        : undefined,
      href: '/crm/quotations',
      updatedAt: now,
    },
    {
      id: 'follow-ups',
      label: 'Follow-ups Today',
      value: metrics.followUpsDueToday,
      icon: Bell,
      accent: metrics.followUpsDueToday > 0 ? 'amber' : 'green',
      context: metrics.followUpsDueToday > 0 ? 'Due today' : 'None scheduled',
      href: '/crm/opportunities?view=follow-ups',
      updatedAt: now,
    },
    {
      id: 'new-leads',
      label: 'New Leads',
      value: metrics.newLeads,
      icon: Users,
      accent: 'blue',
      context: `${metrics.contactedLeads} contacted`,
      trend: metrics.leadsCreatedToday > 0
        ? { direction: 'up', label: `+${metrics.leadsCreatedToday} today`, tone: 'positive' }
        : undefined,
      href: '/crm/leads?stage=new',
      updatedAt: now,
    },
    {
      id: 'qualified',
      label: 'Qualified Leads',
      value: metrics.qualifiedLeads,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'green',
      context: `${metrics.convertedLeads} converted`,
      href: '/crm/leads?stage=qualified',
      updatedAt: now,
    },
    {
      id: 'win-rate',
      label: 'Win Rate',
      value: `${metrics.conversionRate}%`,
      icon: TrendingUp,
      accent: 'green',
      context: `${metrics.dealsWon} won · ${metrics.dealsLost} lost`,
      trend: metrics.conversionRate >= 30
        ? { direction: 'up', label: 'Healthy', tone: 'positive' }
        : { direction: 'flat', label: 'Monitor', tone: 'neutral' },
      href: '/crm/opportunities?stage=won',
      updatedAt: now,
    },
    {
      id: 'pipeline',
      label: 'Pipeline Value',
      value: formatCompactCurrency(metrics.pipelineValue),
      icon: KPI_ICON_PRESETS.pipeline,
      accent: 'blue',
      context: `${metrics.openOpportunities} active deals`,
      href: '/crm/opportunities',
      updatedAt: now,
    },
    {
      id: 'approved-not-converted',
      label: 'Approved Not Converted',
      value: metrics.approvedQuotationsNotConverted,
      icon: KPI_ICON_PRESETS.revenue,
      accent: metrics.approvedQuotationsNotConverted > 0 ? 'amber' : 'slate',
      context: 'Ready for SO handover',
      href: '/crm/quotations',
      updatedAt: now,
    },
  ]
}

export function buildQuotationTemplateKpis(kpis: {
  total: number
  active: number
  avgSections: number
  specTables: number
  families: number
}): EnterpriseKpiItem[] {
  const now = Date.now()
  return [
    {
      id: 'templates',
      label: 'Templates',
      value: kpis.total,
      icon: KPI_ICON_PRESETS.open,
      accent: 'blue',
      context: 'Template library',
      updatedAt: now,
    },
    {
      id: 'active',
      label: 'Active',
      value: kpis.active,
      icon: KPI_ICON_PRESETS.qualified,
      accent: 'green',
      context: 'Available for quotations',
      updatedAt: now,
    },
    {
      id: 'sections',
      label: 'Avg Sections',
      value: kpis.avgSections,
      icon: FileText,
      accent: 'slate',
      context: 'Per template',
      updatedAt: now,
    },
    {
      id: 'spec-tables',
      label: 'Spec Tables',
      value: kpis.specTables,
      icon: BarChart3,
      accent: 'green',
      context: 'Technical spec blocks',
      updatedAt: now,
    },
    {
      id: 'families',
      label: 'Product Families',
      value: kpis.families,
      icon: FolderOpen,
      accent: 'amber',
      context: 'ISO tank, trailer, services…',
      updatedAt: now,
    },
  ]
}

type ModuleDashboardKpiCompat = {
  id?: string
  label: string
  value: string | number
  context?: string
  href?: string
  icon?: EnterpriseKpiItem['icon']
  accent?: EnterpriseKpiItem['accent']
  trend?: EnterpriseKpiItem['trend']
  updatedAt?: number
}
