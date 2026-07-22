import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Calculator,
  ClipboardCheck,
  PackagePlus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  AssetStatusBadge,
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getFixedAssetsDashboard } from '@/services/accounting/fixedAssetsService'
import type { FixedAssetsDashboardData } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
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

export function FixedAssetsOverviewPage() {
  const navigate = useNavigate()
  const perms = useFixedAssetsPermissions()
  const [data, setData] = useState<FixedAssetsDashboardData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getFixedAssetsDashboard()
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

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    return [
      { id: 'gross', label: 'Total Asset Value', value: formatCompactCurrency(data.totalAssetValue), helper: formatCurrency(data.totalAssetValue), icon: Building2, accent: 'blue', onClick: () => navigate('/accounting/fixed-assets/register') },
      { id: 'nbv', label: 'Net Book Value', value: formatCompactCurrency(data.netBookValue), helper: formatCurrency(data.netBookValue), icon: Building2, accent: 'green', onClick: () => navigate('/accounting/fixed-assets/register') },
      { id: 'accum', label: 'Accumulated Depreciation', value: formatCompactCurrency(data.accumulatedDepreciation), accent: 'slate' },
      { id: 'auc', label: 'Assets Under Construction', value: data.assetsUnderConstruction, accent: 'amber', onClick: () => navigate('/accounting/fixed-assets/register?status=Under%20Construction') },
      { id: 'dep', label: 'Depreciation Due', value: formatCompactCurrency(data.depreciationDue), accent: 'amber', onClick: () => navigate('/accounting/fixed-assets/depreciation') },
      { id: 'cap', label: 'Pending Capitalization', value: data.pendingCapitalization, accent: 'amber', onClick: () => navigate('/accounting/fixed-assets/capitalization') },
      { id: 'ver', label: 'Due for Verification', value: data.dueForVerification, accent: 'amber', onClick: () => navigate('/accounting/fixed-assets/verification') },
      { id: 'disp', label: 'Pending Disposal', value: data.pendingDisposal, accent: 'red', onClick: () => navigate('/accounting/fixed-assets/disposal') },
    ]
  }, [data, navigate])

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Fixed Assets" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets' }]} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" description="You cannot view Fixed Assets." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Fixed Assets"
      description="Monitor asset value, net book value, depreciation, capitalization and disposal — Indian manufacturing demo."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canRunDepreciation
              ? { id: 'dep', label: 'Run Depreciation', icon: Calculator, variant: 'primary', onClick: () => navigate('/accounting/fixed-assets/depreciation') }
              : undefined
          }
          secondaryActions={[
            ...(perms.canAcquire
              ? [{ id: 'acq', label: 'New Acquisition', icon: PackagePlus, onClick: () => navigate('/accounting/fixed-assets/acquisition') }]
              : []),
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) },
          ]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="overview" />
      <div className="space-y-4 p-4">
        <FixedAssetsDemoBanner variant="auto" />

        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        {loadState === 'error' ? (
          <FixedAssetsEmptyState
            title="Could not load overview"
            description={errorMessage ?? undefined}
            actions={<button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[12px]" onClick={() => setRefreshToken((n) => n + 1)}>Retry</button>}
          />
        ) : null}

        {loadState === 'ready' && data ? (
          <>
            <FixedAssetsSummaryCards items={kpiItems} columns={4} />

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-erp-border bg-white p-3">
                <h2 className="mb-2 text-[13px] font-semibold">NBV by category</h2>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.nbvByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 100000) / 10}L`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="nbv" name="NBV" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-md border border-erp-border bg-white p-3">
                <h2 className="mb-2 text-[13px] font-semibold">Alerts & pending actions</h2>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="erp-btn erp-btn-secondary h-8 px-2.5 text-[11px]" to="/accounting/fixed-assets/depreciation"><Calculator className="mr-1 inline h-3.5 w-3.5" />Depreciation</Link>
                  <Link className="erp-btn erp-btn-secondary h-8 px-2.5 text-[11px]" to="/accounting/fixed-assets/verification"><ClipboardCheck className="mr-1 inline h-3.5 w-3.5" />Verification</Link>
                  <Link className="erp-btn erp-btn-secondary h-8 px-2.5 text-[11px]" to="/accounting/fixed-assets/disposal"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Disposal</Link>
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-erp-border bg-white">
                <header className="border-b border-erp-border px-3 py-2"><h2 className="text-[13px] font-semibold">Status summary</h2></header>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                      <tr><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2 text-right">NBV</th></tr>
                    </thead>
                    <tbody>
                      {data.statusSummary.map((row) => (
                        <tr key={row.status} className="border-t border-erp-border/80">
                          <td className="px-3 py-2"><AssetStatusBadge status={row.status} /></td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.nbv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border border-erp-border bg-white">
                <header className="flex items-center justify-between border-b border-erp-border px-3 py-2">
                  <h2 className="text-[13px] font-semibold">Recent activity</h2>
                  <Link to="/accounting/fixed-assets/register" className="text-[12px] font-semibold text-erp-primary">Asset register →</Link>
                </header>
                <ul className="divide-y divide-erp-border">
                  {data.recentActivity.map((act) => (
                    <li key={act.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[12px] hover:bg-erp-surface-alt/60" onClick={() => navigate(act.href)}>
                        <div>
                          <p className="font-medium text-erp-text">{act.description}</p>
                          <p className="text-erp-muted">{act.type} · {formatDate(act.date)}</p>
                        </div>
                        {act.amount != null ? <span className="tabular-nums font-semibold">{formatCurrency(act.amount)}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
