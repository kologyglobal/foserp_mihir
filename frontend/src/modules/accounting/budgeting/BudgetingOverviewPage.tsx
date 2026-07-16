import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { getBudgetingDashboard } from '@/services/accounting/budgetingService'
import type { BudgetingDashboard } from '@/types/budgeting'
import { CAPEX_STATUS_LABELS } from '@/types/budgeting'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

export function BudgetingOverviewPage() {
  const navigate = useNavigate()
  const perms = useBudgetingPermissions()
  const [data, setData] = useState<BudgetingDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view budgeting.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getBudgetingDashboard())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    const k = data.kpis
    return [
      {
        id: 'annual',
        label: 'Annual Budget',
        value: formatCompactCurrency(k.annualBudget),
        helper: formatCurrency(k.annualBudget),
        accent: 'blue',
        onClick: () => navigate('/accounting/budgeting/annual'),
      },
      {
        id: 'ytd',
        label: 'YTD Actual',
        value: formatCompactCurrency(k.actualYtd),
        accent: 'slate',
        onClick: () => navigate('/accounting/budgeting/vs-actual'),
      },
      {
        id: 'comm',
        label: 'Committed',
        value: formatCompactCurrency(k.committed),
        accent: 'amber',
        onClick: () => navigate('/purchase/orders'),
      },
      {
        id: 'avail',
        label: 'Available',
        value: formatCompactCurrency(k.available),
        accent: 'green',
      },
      {
        id: 'util',
        label: 'Utilization',
        value: `${k.utilizationPct}%`,
        accent: 'slate',
      },
      {
        id: 'cash',
        label: 'Cash Forecast',
        value: formatCompactCurrency(k.cashForecastClosing),
        accent: 'blue',
        onClick: () => navigate('/accounting/budgeting/cash-flow'),
      },
      {
        id: 'appr',
        label: 'Pending Approvals',
        value: String(k.pendingApprovals),
        accent: 'red',
        onClick: () => navigate('/accounting/budgeting/approvals'),
      },
    ]
  }, [data, navigate])

  return (
    <BudgetingShell
      title="Budgeting Overview"
      description="FY 2025-26 budgeting & forecasting workspace (demo)."
      kpiStrip={kpis}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export Preview',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => notify.info('Placeholder export — overview KPIs only.'),
            },
          ]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && data ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded border border-erp-border p-3 lg:col-span-2">
            <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Monthly budget vs actual</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyBudgetVsActual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill="#2563eb" radius={2} />
                  <Bar dataKey="actual" name="Actual" fill="#64748b" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Department utilization</h2>
            <ul className="mt-2 space-y-1.5">
              {data.departmentUtilization.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2 text-[12px]">
                  <Link to="/accounting/budgeting/departments" className="font-medium text-erp-primary hover:underline">
                    {d.name}
                  </Link>
                  <span className="text-erp-muted">{d.utilizationPct}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Cost centre variance</h2>
            <ul className="mt-2 space-y-1.5">
              {data.costCentreVariance.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2 text-[12px]">
                  <Link to="/accounting/budgeting/cost-centres" className="font-medium text-erp-primary hover:underline">
                    {c.name}
                  </Link>
                  <span className={c.variance < 0 ? 'text-rose-700' : 'text-erp-muted'}>
                    {formatCompactCurrency(c.variance)} ({c.variancePct}%)
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Expense category variance</h2>
            <ul className="mt-2 space-y-1.5">
              {data.expenseCategoryVariance.map((e) => (
                <li key={e.category} className="flex items-center justify-between gap-2 text-[12px]">
                  <span>{e.category}</span>
                  <span className="text-erp-muted">{formatCompactCurrency(e.variance)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">CAPEX status</h2>
            <ul className="mt-2 space-y-1.5">
              {data.capexStatus.map((c) => (
                <li key={c.status} className="flex items-center justify-between gap-2 text-[12px]">
                  <Link to="/accounting/budgeting/capex" className="font-medium text-erp-primary hover:underline">
                    {CAPEX_STATUS_LABELS[c.status]}
                  </Link>
                  <span className="text-erp-muted">
                    {c.count} · {formatCompactCurrency(c.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Cash forecast strip</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.cashForecastStrip.map((r) => (
                <div key={r.period} className="rounded border border-erp-border px-2 py-1 text-[11px]">
                  <div className="font-semibold text-erp-text">{r.period}</div>
                  <div className="text-erp-muted">{formatCompactCurrency(r.closing)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">High-risk overruns</h2>
            <ul className="mt-2 space-y-1.5">
              {data.highRiskOverruns.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-2 text-[12px]">
                  <span>{r.label}</span>
                  <span className="text-rose-700">
                    avail {formatCompactCurrency(r.available)} · {r.variancePct}%
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Pending approvals</h2>
            <ul className="mt-2 space-y-1.5">
              {data.pendingApprovals.length === 0 ? (
                <li className="text-[12px] text-erp-muted">None</li>
              ) : (
                data.pendingApprovals.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <Link to="/accounting/budgeting/approvals" className="font-medium text-erp-primary hover:underline">
                      {a.versionName} · {a.department}
                    </Link>
                    <span className="text-erp-muted">{formatCompactCurrency(a.requestedAmount)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3 lg:col-span-2">
            <p className="text-[12px] text-erp-muted">
              Revenue variance {formatCurrency(data.kpis.revenueVariance)} · Expense variance{' '}
              {formatCurrency(data.kpis.expenseVariance)}
            </p>
          </section>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
