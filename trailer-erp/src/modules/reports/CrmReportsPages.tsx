import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3, Target, TrendingUp, Users, Bell, Activity, FileText, CheckCircle, XCircle,
  GitBranch, ArrowLeft, Search, ChevronRight, Lightbulb, Printer,
} from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar, type FilterChip } from '../../components/design-system/SmartFilterBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataGrid } from '../../components/design-system/DataGrid'
import { DynamicsDashboardPanel } from '../../components/dynamics/DynamicsDashboardPanel'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { crmBreadcrumbs, crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { ErpButton } from '../../components/erp/ErpButton'
import { useCrmStore } from '../../store/crmStore'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { cn } from '../../utils/cn'
import {
  EnterpriseNumericCell,
  EnterpriseProbabilityBadge,
  entNumericMeta,
} from '../../design-system/enterprise'
import {
  CRM_REPORT_GETTERS,
  CRM_REPORT_LABELS,
  type CrmReportId,
} from '../../utils/crmReports'
import { useCrmReportRows } from '../../hooks/useCrmReport'
import {
  buildCrmReportDetailKpiStrip,
  buildCrmReportsHubKpiStrip,
} from '../../utils/crmModuleKpis'

const CRM_REPORT_IDS = Object.keys(CRM_REPORT_LABELS) as CrmReportId[]

type ReportCategory = 'pipeline' | 'engagement' | 'quotations' | 'performance'
type CategoryFilter = ReportCategory | 'all'

interface CrmReportCatalogItem {
  id: CrmReportId
  title: string
  description: string
  category: ReportCategory
  icon: LucideIcon
  featured?: boolean
}

const CRM_REPORT_CATALOG: CrmReportCatalogItem[] = [
  {
    id: 'pipeline',
    title: 'Opportunity Pipeline',
    description: 'All opportunities with stage, value, owner, and close date',
    category: 'pipeline',
    icon: Target,
    featured: true,
  },
  {
    id: 'stage-wise',
    title: 'Stage-wise Opportunities',
    description: 'Deal count and total value grouped by pipeline stage',
    category: 'pipeline',
    icon: BarChart3,
  },
  {
    id: 'customer-pipeline',
    title: 'Customer Pipeline',
    description: 'Open pipeline value and opportunity count by company',
    category: 'pipeline',
    icon: Users,
  },
  {
    id: 'conversion-funnel',
    title: 'Conversion Funnel',
    description: 'Opportunity volume across each funnel stage',
    category: 'performance',
    icon: GitBranch,
  },
  {
    id: 'won-lost',
    title: 'Won / Lost Deals',
    description: 'Closed opportunities with outcome and lost reasons',
    category: 'performance',
    icon: CheckCircle,
    featured: true,
  },
  {
    id: 'lead-register',
    title: 'Lead Register',
    description: 'All leads with owner, priority, lifecycle, and follow-up dates',
    category: 'pipeline',
    icon: Users,
    featured: true,
  },
  {
    id: 'lead-owner',
    title: 'Lead Owner Report',
    description: 'Active and closed lead counts by owner with pipeline value',
    category: 'performance',
    icon: Users,
  },
  {
    id: 'lead-stage',
    title: 'Lead Stage Report',
    description: 'Lead volume and pipeline value grouped by sales stage',
    category: 'performance',
    icon: BarChart3,
    featured: true,
  },
  {
    id: 'lead-conversion',
    title: 'Lead Conversion Report',
    description: 'Qualified and converted lead metrics with conversion rate',
    category: 'performance',
    icon: TrendingUp,
  },
  {
    id: 'lead-priority',
    title: 'Priority-wise Leads',
    description: 'Lead volume and pipeline value grouped by priority',
    category: 'performance',
    icon: BarChart3,
  },
  {
    id: 'closed-leads',
    title: 'Closed Leads',
    description: 'Closed leads with reason, date, and owner',
    category: 'performance',
    icon: XCircle,
  },
  {
    id: 'lead-active-inactive',
    title: 'Active / Inactive Leads',
    description: 'Lead activity status with inactive reasons',
    category: 'engagement',
    icon: Activity,
  },
  {
    id: 'follow-up-due',
    title: 'Follow-up Due',
    description: 'Pending and overdue follow-ups by owner and priority',
    category: 'engagement',
    icon: Bell,
    featured: true,
  },
  {
    id: 'sales-activity',
    title: 'Sales Activity',
    description: 'Logged calls, meetings, and notes across the CRM',
    category: 'engagement',
    icon: Activity,
  },
  {
    id: 'quotation-revision',
    title: 'Quotation Revision',
    description: 'Document revisions, lock status, and revision reasons',
    category: 'quotations',
    icon: FileText,
  },
  {
    id: 'quotation-approval',
    title: 'Quotation Approval',
    description: 'Approval workflow entries and decision timeline',
    category: 'quotations',
    icon: TrendingUp,
  },
]

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  pipeline: 'Pipeline & deals',
  engagement: 'Follow-ups & activities',
  quotations: 'Quotations',
  performance: 'Performance & outcomes',
}

const CATEGORY_SHORT: Record<ReportCategory, string> = {
  pipeline: 'Pipeline',
  engagement: 'Engagement',
  quotations: 'Quotations',
  performance: 'Performance',
}

const CATEGORY_ORDER: ReportCategory[] = ['pipeline', 'engagement', 'quotations', 'performance']

const CATEGORY_FILTER_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All reports' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'quotations', label: 'Quotations' },
  { id: 'performance', label: 'Performance' },
]

function crmReportPath(id: CrmReportId) {
  return `/crm/reports/${id}`
}

function normalizeReportId(raw: string | undefined): CrmReportId {
  if (!raw) return 'pipeline'
  const id = raw.startsWith('crm-') ? raw.slice(4) : raw
  return CRM_REPORT_IDS.includes(id as CrmReportId) ? (id as CrmReportId) : 'pipeline'
}

function humanizeColumnKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

type ChipTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'pending'

function statusChipTone(key: string, value: unknown): ChipTone | null {
  if (typeof value !== 'string' || !value) return null
  const k = key.toLowerCase()
  if (!/status|stage|priority|action|outcome|locked/.test(k)) return null
  const v = value.toLowerCase()
  if (v === 'won' || v === 'approved' || v === 'completed' || v === 'yes') return 'success'
  if (v === 'lost' || v === 'overdue' || v === 'rejected' || v === 'critical') return 'critical'
  if (v === 'pending' || v === 'open' || v === 'high') return 'warning'
  if (v === 'draft' || v === 'no' || v === 'low') return 'neutral'
  if (/negotiation|quotation|review|qualified|discussion/.test(v)) return 'info'
  return 'info'
}

function formatCellValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    if (/value|amount|pipeline|revenue|total/i.test(key)) return formatCrmCurrency(value)
    return String(value)
  }
  return String(value)
}

function buildReportColumns(rows: Record<string, unknown>[]): ColumnDef<Record<string, unknown>>[] {
  if (!rows.length) {
    return [{ accessorKey: 'empty', header: 'Data', cell: () => '—' }]
  }
  return Object.keys(rows[0]).map((key) => ({
    accessorKey: key,
    header: humanizeColumnKey(key),
    cell: ({ row }) => {
      const val = row.original[key]
      const chipTone = statusChipTone(key, val)
      if (chipTone) {
        return <DynamicsStatusChip label={String(val)} tone={chipTone} />
      }
      const isMoney = typeof val === 'number' && /value|amount|pipeline|total|revenue/i.test(key)
      const isProb = typeof val === 'number' && /probability/i.test(key)
      const isCount = typeof val === 'number' && !isMoney && !isProb
      if (isMoney) {
        return <EnterpriseNumericCell value={formatCellValue(key, val)} className="text-erp-primary" />
      }
      if (isProb) {
        return <EnterpriseProbabilityBadge value={val} />
      }
      if (isCount) {
        return <EnterpriseNumericCell value={String(val)} />
      }
      return <span className="text-erp-text">{formatCellValue(key, val)}</span>
    },
    meta: {
      ...(typeof rows[0][key] === 'number' ? entNumericMeta(humanizeColumnKey(key)) : {}),
      cellClass: /date|close|at$/i.test(key) ? 'crm-report-table__date' : undefined,
    },
  }))
}

function getReportHighlight(id: CrmReportId): { label: string; value: string } {
  const rows = CRM_REPORT_GETTERS[id]()
  switch (id) {
    case 'pipeline': {
      const open = rows.filter((r) => r.status === 'open')
      const value = open.reduce((s, r) => s + (Number(r.value) || 0), 0)
      return { label: 'Open deals', value: `${open.length} · ${formatCrmCurrency(value)}` }
    }
    case 'follow-up-due': {
      const overdue = rows.filter((r) => r.status === 'overdue').length
      return { label: 'Overdue', value: overdue > 0 ? `${overdue} need action` : 'All on track' }
    }
    case 'won-lost': {
      const won = rows.filter((r) => r.status === 'won').length
      const lost = rows.filter((r) => r.status === 'lost').length
      return { label: 'Outcomes', value: `${won} won · ${lost} lost` }
    }
    case 'stage-wise':
      return { label: 'Stages', value: `${rows.length} active` }
    case 'customer-pipeline':
      return { label: 'Accounts', value: `${rows.length} companies` }
    case 'conversion-funnel': {
      const total = rows.reduce((s, r) => s + (Number(r.count) || 0), 0)
      return { label: 'In funnel', value: `${total} deals` }
    }
    case 'sales-activity':
      return { label: 'Logged', value: `${rows.length} activities` }
    case 'quotation-revision':
      return { label: 'Documents', value: `${rows.length} revisions` }
    case 'quotation-approval':
      return { label: 'Entries', value: `${rows.length} approvals` }
    default:
      return { label: 'Rows', value: `${rows.length}` }
  }
}

interface ReportInsight {
  id: string
  message: string
  reportId: CrmReportId
}

function buildReportInsights(
  overdueFollowUps: number,
  openPipeline: number,
  openCount: number,
  wonCount: number,
  pendingQuotations: number,
): ReportInsight[] {
  const insights: ReportInsight[] = []
  if (overdueFollowUps > 0) {
    insights.push({
      id: 'overdue-fu',
      message: `${overdueFollowUps} follow-up${overdueFollowUps > 1 ? 's are' : ' is'} overdue — review now`,
      reportId: 'follow-up-due',
    })
  }
  if (openCount > 0) {
    insights.push({
      id: 'pipeline',
      message: `${formatCrmCurrency(openPipeline)} open pipeline across ${openCount} deal${openCount > 1 ? 's' : ''}`,
      reportId: 'pipeline',
    })
  }
  if (wonCount > 0) {
    insights.push({
      id: 'won',
      message: `${wonCount} deal${wonCount > 1 ? 's' : ''} won — see conversion outcomes`,
      reportId: 'won-lost',
    })
  }
  if (pendingQuotations > 0) {
    insights.push({
      id: 'quotations',
      message: `${pendingQuotations} quotation revision${pendingQuotations > 1 ? 's' : ''} in workflow`,
      reportId: 'quotation-approval',
    })
  }
  return insights.slice(0, 3)
}

function CategoryToggle({
  value,
  onChange,
}: {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
}) {
  return (
    <div className="crm-reports-category-toggle" role="group" aria-label="Report category">
      {CATEGORY_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function CrmReportsInsightStrip({
  insights,
  onSelect,
}: {
  insights: ReportInsight[]
  onSelect: (id: CrmReportId) => void
}) {
  if (!insights.length) return null
  return (
    <div className="crm-reports-insight-strip" role="region" aria-label="Report insights">
      <Lightbulb className="crm-reports-insight-strip__icon" aria-hidden />
      <div className="crm-reports-insight-strip__items">
        {insights.map((insight) => (
          <button
            key={insight.id}
            type="button"
            className="crm-reports-insight-strip__item"
            onClick={() => onSelect(insight.reportId)}
          >
            {insight.message}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CrmReportsIndexPage() {
  const navigate = useNavigate()
  const opportunities = useCrmStore((s) => s.opportunities)
  const followUps = useCrmStore((s) => s.followUps)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CRM_REPORT_CATALOG.filter((r) => {
      if (category !== 'all' && r.category !== category) return false
      if (!q) return true
      return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    })
  }, [search, category])

  const grouped = useMemo(() => {
    const map = new Map<ReportCategory, CrmReportCatalogItem[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const item of filteredCatalog) {
      map.get(item.category)?.push(item)
    }
    return map
  }, [filteredCatalog])

  const openOpps = useMemo(() => opportunities.filter((o) => o.status === 'open'), [opportunities])
  const openPipeline = useMemo(() => openOpps.reduce((s, o) => s + o.value, 0), [openOpps])
  const overdueFollowUps = useMemo(() => followUps.filter((f) => f.status === 'overdue').length, [followUps])
  const wonCount = useMemo(() => opportunities.filter((o) => o.status === 'won').length, [opportunities])
  const pendingQuotations = useMemo(
    () => quotationDocuments.filter((d) => d.status === 'pending_approval' || d.status === 'draft').length,
    [quotationDocuments],
  )

  const reportsHubKpiStrip = useMemo(
    () =>
      buildCrmReportsHubKpiStrip({
        catalogSize: CRM_REPORT_CATALOG.length,
        openOpps: openOpps.length,
        openPipeline,
        overdueFollowUps,
        pendingQuotations,
        wonCount,
        reportPath: crmReportPath,
      }),
    [openOpps.length, openPipeline, overdueFollowUps, pendingQuotations, wonCount],
  )

  const contextualInsights = useMemo(
    () => buildReportInsights(overdueFollowUps, openPipeline, openOpps.length, wonCount, pendingQuotations),
    [overdueFollowUps, openPipeline, openOpps.length, wonCount, pendingQuotations],
  )

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []
    if (category !== 'all') chips.push({ id: 'category', label: CATEGORY_SHORT[category] })
    if (search.trim()) chips.push({ id: 'search', label: `Search: ${search.trim()}` })
    return chips
  }, [category, search])

  function removeFilterChip(id: string) {
    if (id === 'category') setCategory('all')
    if (id === 'search') setSearch('')
  }

  function clearAllFilters() {
    setCategory('all')
    setSearch('')
  }

  const showFeatured = category === 'all' && !search.trim()

  return (
    <OperationalPageShell
      title="CRM Reports"
      description="Pipeline, activity, quotation, and conversion reports from live CRM data"
      favoritePath="/crm/reports"
      badge="CRM"
      variant="dynamics"
      breadcrumbs={crmModuleBreadcrumbs('Reports', '/crm/reports')}
      autoBreadcrumbs={false}
      kpiStrip={reportsHubKpiStrip}
      commandBar={
        <ErpCommandBar
          sticky={false}
          primaryAction={{
            id: 'pipeline-report',
            label: 'Pipeline Report',
            icon: Target,
            onClick: () => navigate(crmReportPath('pipeline')),
          }}
          secondaryActions={[
            {
              id: 'follow-up-report',
              label: 'Follow-up Due',
              icon: Bell,
              onClick: () => navigate(crmReportPath('follow-up-due')),
            },
            {
              id: 'won-lost',
              label: 'Won / Lost',
              icon: XCircle,
              onClick: () => navigate(crmReportPath('won-lost')),
            },
          ]}
        />
      }
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={removeFilterChip}
          onClearAll={filterChips.length > 1 ? clearAllFilters : undefined}
          resultCount={filteredCatalog.length}
        >
          <CategoryToggle value={category} onChange={setCategory} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search reports…" className="w-44 sm:w-52" />
        </SmartFilterBar>
      }
    >
      <CrmReportsInsightStrip insights={contextualInsights} onSelect={(id) => navigate(crmReportPath(id))} />

      <div className="crm-reports-hub mt-4 space-y-5">
        {showFeatured ? (
          <DynamicsDashboardPanel title="Quick access" actions={<span className="crm-reports-hub__count">Most used</span>}>
            <ul className="crm-reports-featured">
              {CRM_REPORT_CATALOG.filter((r) => r.featured).map((report) => {
                const Icon = report.icon
                const highlight = getReportHighlight(report.id)
                const rowCount = CRM_REPORT_GETTERS[report.id]().length
                return (
                  <li key={report.id}>
                    <Link
                      to={crmReportPath(report.id)}
                      className={cn('crm-reports-featured-card', `crm-reports-featured-card--${report.category}`)}
                    >
                      <div className="crm-reports-featured-card__icon">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="crm-reports-featured-card__body">
                        <p className="crm-reports-featured-card__eyebrow">{CATEGORY_SHORT[report.category]}</p>
                        <p className="crm-reports-featured-card__title">{report.title}</p>
                        <p className="crm-reports-featured-card__stat">
                          <span>{highlight.value}</span>
                          <span className="crm-reports-featured-card__rows">{rowCount} rows</span>
                        </p>
                      </div>
                      <ChevronRight className="crm-reports-featured-card__chevron" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </DynamicsDashboardPanel>
        ) : null}

        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? []
          if (!items.length) return null
          return (
            <DynamicsDashboardPanel
              key={cat}
              title={CATEGORY_LABELS[cat]}
              actions={<span className="crm-reports-hub__count">{items.length} report{items.length > 1 ? 's' : ''}</span>}
            >
              <ul className="crm-reports-grid">
                {items.map((report) => {
                  const Icon = report.icon
                  const highlight = getReportHighlight(report.id)
                  const rowCount = CRM_REPORT_GETTERS[report.id]().length
                  return (
                    <li key={report.id}>
                      <Link
                        to={crmReportPath(report.id)}
                        className={cn('crm-report-card', `crm-report-card--${report.category}`)}
                      >
                        <div className="crm-report-card__icon">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="crm-report-card__body">
                          <div className="crm-report-card__head">
                            <p className="crm-report-card__title">{report.title}</p>
                            <span className="crm-report-card__category">{CATEGORY_SHORT[report.category]}</span>
                          </div>
                          <p className="crm-report-card__desc">{report.description}</p>
                          <p className="crm-report-card__meta">
                            <span className="crm-report-card__highlight">{highlight.value}</span>
                            <span className="crm-report-card__rows">{rowCount} rows</span>
                          </p>
                        </div>
                        <ChevronRight className="crm-report-card__chevron" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </DynamicsDashboardPanel>
          )
        })}

        {filteredCatalog.length === 0 ? (
          <div className="crm-reports-empty">
            <Search className="h-8 w-8 text-erp-muted" />
            <p className="font-semibold text-erp-text">No reports match your filters</p>
            <p className="text-sm">Try a different category or clear your search.</p>
            <ErpButton type="button" size="sm" variant="secondary" onClick={clearAllFilters}>
              Clear filters
            </ErpButton>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}

export function CrmReportPage() {
  const navigate = useNavigate()
  const { reportId: rawId } = useParams<{ reportId: string }>()
  const id = normalizeReportId(rawId)
  const catalogItem = CRM_REPORT_CATALOG.find((r) => r.id === id)
  const { rows, loading, error } = useCrmReportRows(id)
  const columns = useMemo(() => buildReportColumns(rows), [rows])
  const relatedReports = useMemo(
    () => CRM_REPORT_CATALOG.filter((r) => r.id !== id && r.category === (catalogItem?.category ?? 'pipeline')),
    [id, catalogItem?.category],
  )

  const ReportIcon = catalogItem?.icon ?? BarChart3
  const reportDetailKpiStrip = useMemo(
    () =>
      buildCrmReportDetailKpiStrip({
        rowCount: rows.length,
        categoryLabel: catalogItem ? CATEGORY_SHORT[catalogItem.category] : '—',
        columnCount: columns.length,
      }),
    [rows.length, catalogItem, columns.length],
  )

  function handlePrint() {
    window.print()
  }

  return (
    <OperationalPageShell
      title={CRM_REPORT_LABELS[id]}
      description={catalogItem?.description ?? 'Live CRM data export'}
      favoritePath={crmReportPath(id)}
      badge="CRM Report"
      variant="dynamics"
      breadcrumbs={crmBreadcrumbs(
        { label: 'Reports', to: '/crm/reports' },
        { label: CRM_REPORT_LABELS[id] },
      )}
      autoBreadcrumbs={false}
      kpiStrip={reportDetailKpiStrip}
      actions={
        <Link to="/crm/reports">
          <ErpButton variant="secondary" size="sm" icon={ArrowLeft}>
            All reports
          </ErpButton>
        </Link>
      }
      commandBar={
        <ErpCommandBar
          sticky={false}
          primaryAction={{
            id: 'print',
            label: 'Print',
            icon: Printer,
            onClick: handlePrint,
          }}
          secondaryActions={[
            { id: 'pipeline', label: 'Pipeline Report', icon: Target, onClick: () => navigate(crmReportPath('pipeline')) },
            { id: 'follow-up', label: 'Follow-up Due', icon: Bell, onClick: () => navigate(crmReportPath('follow-up-due')) },
          ]}
        />
      }
    >
      <div className="crm-report-detail-hero">
        <div className={cn('crm-report-detail-hero__icon', catalogItem && `crm-report-detail-hero__icon--${catalogItem.category}`)}>
          <ReportIcon className="h-6 w-6" />
        </div>
        <div className="crm-report-detail-hero__body">
          <p className="crm-report-detail-hero__eyebrow">
            {catalogItem ? CATEGORY_LABELS[catalogItem.category] : 'CRM Report'}
          </p>
          <p className="crm-report-detail-hero__desc">{catalogItem?.description}</p>
        </div>
        <div className="crm-report-detail-hero__badge">
          <DynamicsStatusChip label="Live data" tone="success" />
        </div>
      </div>

      <div className="crm-report-detail-layout mt-4">
        {loading ? (
          <p className="text-sm text-erp-muted px-4 py-8">Loading report data…</p>
        ) : error ? (
          <p className="text-sm text-red-600 px-4 py-8">{error}</p>
        ) : (
        <div className="crm-report-table">
          <DataGrid
            data={rows}
            columns={columns}
            compact={false}
            stickyHeader
            zebra
            pageSize={25}
            showPagination
            toolbar="compact"
            showCompactSearch
            showToolbarExport
            exportFileName={`crm-report-${id}`}
            emptyMessage="No data for this report."
          />
        </div>
        )}

        {relatedReports.length > 0 ? (
          <aside className="crm-report-related" aria-label="Related reports">
            <h3 className="crm-report-related__title">Related reports</h3>
            <p className="crm-report-related__hint">More in {catalogItem ? CATEGORY_SHORT[catalogItem.category] : 'this category'}</p>
            <ul className="crm-report-related__list">
              {relatedReports.map((report) => {
                const Icon = report.icon
                const rowCount = CRM_REPORT_GETTERS[report.id]().length
                return (
                  <li key={report.id}>
                    <Link to={crmReportPath(report.id)} className="crm-report-related__link">
                      <span className={cn('crm-report-related__icon', `crm-report-related__icon--${report.category}`)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="crm-report-related__text">
                        <span className="crm-report-related__name">{report.title}</span>
                        <span className="crm-report-related__meta">{rowCount} rows</span>
                      </span>
                      <ChevronRight className="crm-report-related__chevron" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link to="/crm/reports" className="crm-report-related__back">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all reports
            </Link>
          </aside>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
