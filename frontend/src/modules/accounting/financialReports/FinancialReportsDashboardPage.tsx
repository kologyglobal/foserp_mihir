import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  Download,
  HandCoins,
  Landmark,
  Package,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import {
  FinancialReportAccessDeniedState,
  FinancialReportDemoBanner,
  FinancialReportErrorState,
  FinancialReportLoadingState,
  FinancialReportsSummaryCards,
  FinancialReportsWorkspaceTabs,
} from '@/components/accounting/financialReports'
import {
  exportFinancialReport,
  FinancialReportsServiceError,
  getFinancialReportsDashboard,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportsDashboardData } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { cn } from '@/utils/cn'
import {
  appendFilterQuery,
  downloadTextFile,
  FINANCIAL_REPORTS_BREADCRUMB,
  type FinancialReportLoadState,
  useFinancialReportFilterSync,
} from './financialReportsUi'

const SEVERITY_STYLES = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-erp-text',
} as const

const EXPENSE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b']

export function FinancialReportsDashboardPage() {
  const navigate = useNavigate()
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery } = useFinancialReportFilterSync()
  const [data, setData] = useState<FinancialReportsDashboardData | null>(null)
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getFinancialReportsDashboard(appliedFilter)
      if (signal?.cancelled) return
      setData(result)
      setLoadState('ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Dashboard could not be loaded.')
      setLoadState('error')
    }
  }, [appliedFilter])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const reportHref = useCallback(
    (path: string) => appendFilterQuery(path, appliedFilter),
    [appliedFilter],
  )

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    const k = data.kpis
    return [
      {
        id: 'revenue',
        label: 'Revenue',
        value: formatCompactCurrency(k.revenue),
        helper: formatCurrency(k.revenue),
        icon: TrendingUp,
        accent: 'blue',
        onClick: () => navigate(reportHref('/accounting/reports/profit-loss')),
      },
      {
        id: 'grossProfit',
        label: 'Gross Profit',
        value: formatCompactCurrency(k.grossProfit),
        icon: BarChart3,
        accent: 'green',
        onClick: () => navigate(reportHref('/accounting/reports/profit-loss')),
      },
      {
        id: 'ebitda',
        label: 'EBITDA',
        value: formatCompactCurrency(k.ebitda),
        icon: TrendingUp,
        accent: 'green',
        onClick: () => navigate(reportHref('/accounting/reports/profit-loss')),
      },
      {
        id: 'netProfit',
        label: 'Net Profit',
        value: formatCompactCurrency(k.netProfit),
        icon: Wallet,
        accent: 'green',
        onClick: () => navigate(reportHref('/accounting/reports/profit-loss')),
      },
      {
        id: 'totalAssets',
        label: 'Total Assets',
        value: formatCompactCurrency(k.totalAssets),
        icon: Building2,
        accent: 'blue',
        onClick: () => navigate(reportHref('/accounting/reports/balance-sheet')),
      },
      {
        id: 'totalLiabilities',
        label: 'Total Liabilities',
        value: formatCompactCurrency(k.totalLiabilities),
        icon: Scale,
        accent: 'amber',
        onClick: () => navigate(reportHref('/accounting/reports/balance-sheet')),
      },
      {
        id: 'workingCapital',
        label: 'Working Capital',
        value: formatCompactCurrency(k.workingCapital),
        icon: Landmark,
        accent: 'blue',
        onClick: () => navigate(reportHref('/accounting/reports/ratios')),
      },
      {
        id: 'cashAndBank',
        label: 'Cash & Bank',
        value: formatCompactCurrency(k.cashAndBank),
        icon: Banknote,
        accent: 'green',
        onClick: () => navigate(reportHref('/accounting/reports/cash-flow')),
      },
      {
        id: 'receivables',
        label: 'Receivables',
        value: formatCompactCurrency(k.receivables),
        icon: HandCoins,
        accent: 'amber',
        onClick: () => navigate('/accounting/receivables/ageing'),
      },
      {
        id: 'payables',
        label: 'Payables',
        value: formatCompactCurrency(k.payables),
        icon: TrendingDown,
        accent: 'red',
        onClick: () => navigate('/accounting/payables/outstanding'),
      },
      {
        id: 'inventory',
        label: 'Inventory',
        value: formatCompactCurrency(k.inventoryValue),
        icon: Package,
        accent: 'blue',
        onClick: () => navigate(reportHref('/accounting/reports/balance-sheet')),
      },
      {
        id: 'currentRatio',
        label: 'Current Ratio',
        value: `${k.currentRatio.toFixed(2)}×`,
        helper: 'Current assets / liabilities',
        icon: Scale,
        accent: k.currentRatio >= 1.5 ? 'green' : 'amber',
        onClick: () => navigate(reportHref('/accounting/reports/ratios')),
      },
    ]
  }, [data, navigate, reportHref])

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportFinancialReport({
        scope: 'dashboard',
        format: 'csv',
        filter: appliedFilter,
      })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof FinancialReportsServiceError ? err.message : 'Export failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Financial Reports"
        breadcrumbs={[...FINANCIAL_REPORTS_BREADCRUMB]}
        autoBreadcrumbs={false}
      >
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Financial Reports"
      description="Management and statutory views from posted accounting data — trial balance, P&L, balance sheet and cash flow."
      breadcrumbs={[...FINANCIAL_REPORTS_BREADCRUMB]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => void handleExport(),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => setRefreshToken((n) => n + 1),
            },
          ]}
        />
      )}
    >
      <FinancialReportsWorkspaceTabs active="overview" preserveQuery={preserveQuery} />

      <div className="mt-3 space-y-4 px-1">
        <FinancialReportDemoBanner />

        {loadState === 'loading' ? <FinancialReportLoadingState variant="dashboard" rows={8} /> : null}

        {loadState === 'error' ? (
          <FinancialReportErrorState
            title="Financial reports dashboard could not be loaded."
            description={errorMessage ?? undefined}
            onRetry={() => setRefreshToken((n) => n + 1)}
          />
        ) : null}

        {loadState === 'ready' && data ? (
          <>
            <FinancialReportsSummaryCards items={kpiItems} />

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-erp-border bg-white p-3 lg:col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[13px] font-semibold text-erp-text">Monthly revenue & profit trend</h2>
                  <Link
                    to={reportHref('/accounting/reports/profit-loss')}
                    className="text-[12px] font-semibold text-erp-primary"
                  >
                    Profit & Loss →
                  </Link>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-erp-text">Expense by category</h2>
                  <Link
                    to={reportHref('/accounting/reports/profit-loss')}
                    className="text-[12px] font-semibold text-erp-primary"
                  >
                    View P&L →
                  </Link>
                </div>
                <div className="flex h-48 items-center gap-2">
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.expenseByCategory}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={64}
                      >
                        {data.expenseByCategory.map((_, i) => (
                          <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
                    {data.expenseByCategory.map((row, i) => (
                      <li key={row.category} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
                          />
                          {row.category}
                        </span>
                        <span className="tabular-nums font-semibold">{formatCompactCurrency(row.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-erp-text">Actual vs budget</h2>
                  <Link
                    to={reportHref('/accounting/reports/budget-vs-actual')}
                    className="text-[12px] font-semibold text-erp-primary"
                  >
                    Budget vs Actual →
                  </Link>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.budgetVsActual} layout="vertical" margin={{ top: 4, right: 8, left: 48, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={72} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[0, 2, 2, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-erp-text">Receivables vs payables</h2>
                  <div className="flex gap-3 text-[12px] font-semibold">
                    <Link to="/accounting/receivables/ageing" className="text-erp-primary">
                      Receivables →
                    </Link>
                    <Link to="/accounting/payables/outstanding" className="text-erp-primary">
                      Payables →
                    </Link>
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.receivablesVsPayables} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="receivables" name="Receivables" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="payables" name="Payables" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-erp-text">Plant profitability</h2>
                  <Link
                    to={reportHref('/accounting/reports/cost-centre')}
                    className="text-[12px] font-semibold text-erp-primary"
                  >
                    Cost centres →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                        <th className="px-2 py-1">Plant</th>
                        <th className="px-2 py-1 text-right">Revenue</th>
                        <th className="px-2 py-1 text-right">Contribution</th>
                        <th className="px-2 py-1 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.plantProfitability.map((row) => (
                        <tr key={row.plant} className="border-t border-erp-border">
                          <td className="px-2 py-1.5 font-medium">{row.plant}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.revenue)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.contribution)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.marginPct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-erp-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-erp-text">Product-category profitability</h2>
                  <Link
                    to={reportHref('/accounting/reports/manufacturing')}
                    className="text-[12px] font-semibold text-erp-primary"
                  >
                    Manufacturing →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                        <th className="px-2 py-1">Category</th>
                        <th className="px-2 py-1 text-right">Revenue</th>
                        <th className="px-2 py-1 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.productCategoryProfitability.map((row) => (
                        <tr key={row.category} className="border-t border-erp-border">
                          <td className="px-2 py-1.5 font-medium">{row.category}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.revenue)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.marginPct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {data.alerts.length > 0 ? (
                <section className="rounded-lg border border-erp-border bg-white p-3 lg:col-span-2">
                  <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-erp-text">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Alerts & variances
                  </h2>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {data.alerts.map((alert) => (
                      <li key={alert.id}>
                        <Link
                          to={alert.href.includes('?') ? alert.href : appendFilterQuery(alert.href, appliedFilter)}
                          className={cn(
                            'block rounded-md border px-3 py-2 text-[12px] transition-colors hover:opacity-90',
                            SEVERITY_STYLES[alert.severity],
                          )}
                        >
                          <p className="font-semibold">{alert.title}</p>
                          <p className="text-[11px] opacity-80">{alert.description}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <footer className="border-t border-erp-border/60 pt-3 text-[11px] text-erp-muted">
              Remaining accounting sequence:{' '}
              <span className="text-erp-text">Budgeting</span>
              {' → '}
              <Link to="/accounting/period-close" className="font-semibold text-erp-primary hover:underline">
                Period Close
              </Link>
              {' → '}
              <Link to="/accounting/setup" className="font-semibold text-erp-primary hover:underline">
                Accounting Setup
              </Link>
            </footer>
          </>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
