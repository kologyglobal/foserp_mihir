import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Calculator,
  Factory,
  Package,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingSummaryCards,
  ManufacturingAccountingWorkspaceTabs,
  ProductionOrderStatusBadge,
} from '@/components/accounting/manufacturingAccounting'
import { getManufacturingCostDashboard } from '@/services/accounting/manufacturingAccountingService'
import type { ManufacturingCostDashboard } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error'

const SEVERITY = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
} as const

export function ManufacturingAccountingOverviewPage() {
  const navigate = useNavigate()
  const perms = useManufacturingAccountingPermissions()
  const [data, setData] = useState<ManufacturingCostDashboard | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getManufacturingCostDashboard()
      if (signal?.cancelled) return
      setData(result)
      setLoadState('ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Dashboard could not be loaded.')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const varianceMap = useMemo(() => {
    const map = new Map<string, number>()
    data?.varianceByType.forEach((v) => map.set(v.type, v.amount))
    return map
  }, [data])

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    return [
      { id: 'mat', label: 'Material Consumption', value: formatCompactCurrency(data.materialConsumptionMtd), helper: formatCurrency(data.materialConsumptionMtd), icon: Package, accent: 'blue', onClick: () => navigate('/accounting/manufacturing/material-consumption') },
      { id: 'wip', label: 'Work-in-Progress Value', value: formatCompactCurrency(data.wipValue), helper: formatCurrency(data.wipValue), icon: Layers, accent: 'amber', onClick: () => navigate('/accounting/manufacturing/wip') },
      { id: 'fg', label: 'Finished Goods Value', value: formatCompactCurrency(data.fgInventoryValue), helper: formatCurrency(data.fgInventoryValue), icon: Factory, accent: 'green', onClick: () => navigate('/accounting/manufacturing/finished-goods') },
      { id: 'prod', label: 'Production Cost (MTD)', value: formatCompactCurrency(data.costSummary.totalProductionCost), helper: formatCurrency(data.costSummary.totalProductionCost), accent: 'slate', onClick: () => navigate('/accounting/manufacturing/production-costing') },
      { id: 'stdact', label: 'Std vs Actual (avg/unit)', value: formatCompactCurrency(data.averageCostPerTrailer), helper: `Method: ${data.costingMethod}`, accent: 'blue', onClick: () => navigate('/accounting/manufacturing/cost-sheet') },
      { id: 'pv', label: 'Purchase Variance', value: formatCompactCurrency(Math.abs(varianceMap.get('Material Price') ?? 0)), accent: (varianceMap.get('Material Price') ?? 0) < 0 ? 'red' : 'green', onClick: () => navigate('/accounting/manufacturing/variances') },
      { id: 'mu', label: 'Material Usage Variance', value: formatCompactCurrency(Math.abs(varianceMap.get('Material Usage') ?? 0)), accent: 'amber', onClick: () => navigate('/accounting/manufacturing/variances') },
      { id: 'lab', label: 'Labour Variance', value: formatCompactCurrency(Math.abs((varianceMap.get('Labour Rate') ?? 0) + (varianceMap.get('Labour Efficiency') ?? 0))), accent: 'amber', onClick: () => navigate('/accounting/manufacturing/variances') },
      { id: 'oh', label: 'Overhead Variance', value: formatCompactCurrency(Math.abs(varianceMap.get('Overhead') ?? 0)), accent: 'amber', onClick: () => navigate('/accounting/manufacturing/variances') },
      { id: 'scrap', label: 'Scrap & Rework Cost', value: formatCompactCurrency(Math.abs(data.costSummary.scrapRecovery) + Math.abs(varianceMap.get('Scrap') ?? 0)), accent: 'red', onClick: () => navigate('/accounting/manufacturing/scrap-rework') },
    ]
  }, [data, navigate, varianceMap])

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Manufacturing Accounting" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Manufacturing Accounting' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" description="You cannot view Manufacturing Accounting." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Manufacturing Accounting & Costing"
      description="Connect production, inventory, purchase and finance — WIP, FG valuation, variances and product cost sheets (demo)."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Manufacturing Accounting' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canRunCosting
              ? { id: 'costing', label: 'Production Costing', icon: Calculator, variant: 'primary', onClick: () => navigate('/accounting/manufacturing/production-costing') }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <ManufacturingAccountingWorkspaceTabs active="overview" />
      <div className="space-y-4 p-4">
        <ManufacturingAccountingDemoBanner />

        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        {loadState === 'error' ? (
          <ManufacturingAccountingEmptyState
            title="Could not load overview"
            description={errorMessage ?? undefined}
            actions={<button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[12px]" onClick={() => setRefreshToken((n) => n + 1)}>Retry</button>}
          />
        ) : null}

        {loadState === 'ready' && data ? (
          <>
            <ManufacturingAccountingSummaryCards items={kpiItems} columns={5} />

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-erp-border bg-white p-3">
                <h2 className="mb-2 text-[13px] font-semibold">WIP vs finished goods trend</h2>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.wipTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 100000) / 10}L`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Bar dataKey="wipValue" name="WIP" fill="#d97706" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="fgValue" name="FG" fill="#059669" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-md border border-erp-border bg-white p-3">
                <h2 className="mb-2 text-[13px] font-semibold">Alerts</h2>
                <ul className="space-y-2">
                  {data.alerts.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => a.href && navigate(a.href)}
                        className={cn('flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-[12px]', SEVERITY[a.severity])}
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{a.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-erp-border bg-white">
                <header className="border-b border-erp-border px-3 py-2"><h2 className="text-[13px] font-semibold">Production order status</h2></header>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                      <tr><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2 text-right">WIP Value</th></tr>
                    </thead>
                    <tbody>
                      {data.statusSummary.map((row) => (
                        <tr key={row.status} className="border-t border-erp-border/80">
                          <td className="px-3 py-2"><ProductionOrderStatusBadge status={row.status} /></td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.wipValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border border-erp-border bg-white">
                <header className="border-b border-erp-border px-3 py-2"><h2 className="text-[13px] font-semibold">Variance by type</h2></header>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                      <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Fav / Adv</th></tr>
                    </thead>
                    <tbody>
                      {data.varianceByType.map((row) => (
                        <tr key={row.type} className="border-t border-erp-border/80">
                          <td className="px-3 py-2">{row.type}</td>
                          <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', row.isFavourable ? 'text-emerald-700' : 'text-rose-700')}>
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-3 py-2 text-erp-muted">{row.isFavourable ? 'Favourable' : 'Adverse'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="rounded-md border border-erp-border bg-white">
              <header className="border-b border-erp-border px-3 py-2"><h2 className="text-[13px] font-semibold">Recent activity</h2></header>
              <ul className="divide-y divide-erp-border">
                {data.recentActivity.map((act) => (
                  <li key={act.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[12px] hover:bg-erp-surface-alt/60" onClick={() => navigate(act.href)}>
                      <div>
                        <p className="font-medium">{act.description}</p>
                        <p className="text-erp-muted">{act.type} · {formatDate(act.date)}</p>
                      </div>
                      {act.amount != null ? <span className="tabular-nums font-semibold">{formatCurrency(act.amount)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
