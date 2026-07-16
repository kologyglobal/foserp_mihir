import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { CommandBarButton } from '@/components/ui/CommandBar'
import {
  FinancialReportDemoBanner,
  FinancialReportExportMenu,
  FinancialReportFilterBar,
  FinancialReportLoadingState,
  FinancialReportErrorState,
  FinancialReportNoDataState,
  FinancialReportAccessDeniedState,
  FinancialReportsSummaryCards,
  FinancialReportsWorkspaceTabs,
} from '@/components/accounting/financialReports'
import {
  DEFAULT_FINANCIAL_REPORT_FILTER,
  exportFinancialReport,
  FinancialReportsServiceError,
  getFinancialMis,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
  getFinancialReportsDashboard,
} from '@/services/accounting/financialReportsService'
import type {
  FinancialMisDashboard,
  FinancialReportFilter,
  FinancialReportLookups,
  FinancialReportsDashboardData,
} from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  downloadTextFile,
  financialReportsBreadcrumb,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

type MisSection = {
  id: string
  title: string
  rows: { label: string; value: string; tone?: string }[]
}

export function FinancialMisPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [mis, setMis] = useState<FinancialMisDashboard | null>(null)
  const [dashboard, setDashboard] = useState<FinancialReportsDashboardData | null>(null)
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')

  useEffect(() => {
    setDraftFilter(appliedFilter)
  }, [appliedFilter])

  useEffect(() => {
    void getFinancialReportLookups().then(setLookups).catch(() => setLookups(null))
  }, [])

  const load = useCallback(async (filter: FinancialReportFilter) => {
    setLoadState('loading')
    try {
      const [misData, dash] = await Promise.all([getFinancialMis(filter), getFinancialReportsDashboard(filter)])
      setMis(misData)
      setDashboard(dash)
      setLoadState('ready')
    } catch (e) {
      setMis(null)
      setDashboard(null)
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load financial MIS')
    }
  }, [])

  useEffect(() => {
    if (!perms.canViewMis) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canViewMis])

  const applyFilter = () => syncFilterToUrl(draftFilter)
  const handleReset = () => {
    setDraftFilter({ ...DEFAULT_FINANCIAL_REPORT_FILTER })
    resetFilter()
  }

  const summaryItems = useMemo(() => {
    if (!mis) return []
    return mis.kpis.map((k, i) => ({
      id: `kpi-${i}`,
      label: k.label,
      value: `${k.value}${k.unit === '%' ? '%' : k.unit ? ` ${k.unit}` : ''}`,
      helper: k.trendPct !== undefined ? `${k.trendPct >= 0 ? '+' : ''}${k.trendPct}% vs prior` : undefined,
      accent: (['blue', 'green', 'amber', 'slate'] as const)[i % 4],
    }))
  }, [mis])

  const sections = useMemo((): MisSection[] => {
    if (!dashboard || !mis) return []
    const k = dashboard.kpis
    return [
      {
        id: 'monthly',
        title: 'Monthly Summary',
        rows: dashboard.monthlyTrend.map((m) => ({
          label: m.month,
          value: `Rev ${formatCompactCurrency(m.revenue)} · NP ${formatCompactCurrency(m.netProfit)}`,
        })),
      },
      {
        id: 'sales-margin',
        title: 'Sales & Margin',
        rows: [
          { label: 'Revenue YTD', value: formatCurrency(k.revenue) },
          { label: 'Gross Profit', value: formatCurrency(k.grossProfit) },
          { label: 'Gross Margin %', value: `${((k.grossProfit / k.revenue) * 100).toFixed(1)}%` },
          ...dashboard.productCategoryProfitability.map((p) => ({
            label: p.category,
            value: `${formatCompactCurrency(p.revenue)} · ${p.marginPct}% margin`,
          })),
        ],
      },
      {
        id: 'expense',
        title: 'Expense Breakdown',
        rows: dashboard.expenseByCategory.map((e) => ({
          label: e.category,
          value: formatCurrency(e.amount),
        })),
      },
      {
        id: 'wc',
        title: 'Working Capital',
        rows: [
          { label: 'Working Capital', value: formatCurrency(k.workingCapital) },
          { label: 'Current Ratio', value: `${k.currentRatio.toFixed(2)}×` },
          { label: 'Receivables', value: formatCurrency(k.receivables) },
          { label: 'Payables', value: formatCurrency(k.payables) },
          { label: 'Inventory', value: formatCurrency(k.inventoryValue) },
        ],
      },
      {
        id: 'ar-ap',
        title: 'AR / AP Ageing (summary)',
        rows: dashboard.receivablesVsPayables.map((m) => ({
          label: m.month,
          value: `AR ${formatCompactCurrency(m.receivables)} · AP ${formatCompactCurrency(m.payables)}`,
        })),
      },
      {
        id: 'inventory',
        title: 'Inventory',
        rows: [
          { label: 'Inventory Value', value: formatCurrency(k.inventoryValue) },
          { label: 'RM / WIP / FG mix', value: 'Demo split — see inventory module' },
        ],
      },
      {
        id: 'bank',
        title: 'Bank & Cash',
        rows: [{ label: 'Cash & Bank', value: formatCurrency(k.cashAndBank) }],
      },
      {
        id: 'plant',
        title: 'Plant Performance',
        rows: dashboard.plantProfitability.map((p) => ({
          label: p.plant,
          value: `${formatCompactCurrency(p.revenue)} · ${p.marginPct}% margin`,
        })),
      },
      {
        id: 'variance',
        title: 'Production Variance',
        rows: dashboard.alerts
          .filter((a) => a.type === 'production_variance')
          .map((a) => ({ label: a.title, value: a.description, tone: 'text-rose-700' })),
      },
      {
        id: 'cash-forecast',
        title: 'Cash-flow Forecast',
        rows: [
          {
            label: '13-week forecast',
            value: 'Placeholder — connect treasury / bank cash module for live forecast',
            tone: 'text-erp-muted italic',
          },
        ],
      },
    ]
  }, [dashboard, mis])

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!perms.canExport) {
      notify.error('Permission denied')
      return
    }
    try {
      const result = await exportFinancialReport({ scope: 'mis', format, filter: appliedFilter })
      downloadTextFile(result.filename, result.content)
      notify.success(`${result.filename} generated (demo).`)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!perms.canPrint) {
      notify.error('Permission denied')
      return
    }
    try {
      const preview = await getFinancialReportPrintPreview('Financial MIS', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canViewMis) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Financial MIS" breadcrumbs={financialReportsBreadcrumb('MIS')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Financial MIS"
      description="Management information views — sales, WC, plant, and forecast placeholders."
      breadcrumbs={financialReportsBreadcrumb('MIS')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/mis"
      showDescription
      commandBar={(
        <ErpCommandBar inline sticky={false}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinancialReportExportMenu
              disabled={loadState !== 'ready'}
              onExport={perms.canExport ? handleExport : undefined}
              onPrint={perms.canPrint ? handlePrint : undefined}
            />
            <CommandBarButton
              icon={RefreshCw}
              label="Refresh"
              accent
              onClick={() => void load(appliedFilter)}
            />
          </div>
        </ErpCommandBar>
      )}
    >
      <FinancialReportsWorkspaceTabs active="financial_mis" preserveQuery={preserveQuery} />
      {lookups ? (
        <FinancialReportFilterBar filter={draftFilter} onChange={setDraftFilter} lookups={lookups} onApply={applyFilter} onReset={handleReset} />
      ) : null}
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner />
        {loadState === 'loading' ? <FinancialReportLoadingState variant="dashboard" /> : null}
        {loadState === 'error' ? <FinancialReportErrorState onRetry={() => void load(appliedFilter)} /> : null}
        {loadState === 'empty' ? <FinancialReportNoDataState /> : null}
        {loadState === 'ready' && mis ? (
          <>
            <div className="rounded-lg border border-erp-border bg-white p-4">
              <h2 className="text-[14px] font-semibold text-erp-text">{mis.headline}</h2>
              <p className="mt-1 text-[11px] text-erp-muted">{mis.periodLabel}</p>
            </div>
            <FinancialReportsSummaryCards items={summaryItems} />
            <div className="grid gap-3 lg:grid-cols-2">
              {sections.map((section) => (
                <section key={section.id} className="rounded-lg border border-erp-border bg-white">
                  <h3 className="border-b border-erp-border bg-erp-surface px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                    {section.title}
                  </h3>
                  <ul className="divide-y divide-erp-border/60">
                    {section.rows.length === 0 ? (
                      <li className="px-3 py-3 text-[12px] text-erp-muted">No data</li>
                    ) : (
                      section.rows.map((row) => (
                        <li key={row.label} className="flex items-start justify-between gap-3 px-3 py-2 text-[12px]">
                          <span className="font-medium text-erp-text">{row.label}</span>
                          <span className={cn('text-right text-erp-muted', row.tone)}>{row.value}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              ))}
            </div>
            {mis.charts.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {mis.charts.map((chart) => (
                  <div key={chart.id} className="rounded-lg border border-erp-border bg-white p-3">
                    <h4 className="text-[12px] font-semibold text-erp-text">{chart.title}</h4>
                    <ul className="mt-2 space-y-1">
                      {chart.data.map((d) => (
                        <li key={d.label} className="flex justify-between text-[11px]">
                          <span className="text-erp-muted">{d.label}</span>
                          <span className="font-semibold tabular-nums">{d.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <h4 className="text-[12px] font-semibold text-emerald-900">Highlights</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-emerald-900">
                  {mis.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                <h4 className="text-[12px] font-semibold text-rose-900">Risks</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-900">
                  {mis.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
