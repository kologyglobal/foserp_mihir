import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldOff, TrendingUp } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  FixedAssetsDemoBanner,
  FixedAssetsGenericStatusBadge,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getRevaluations } from '@/services/accounting/fixedAssetsService'
import type { AssetRevaluation } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

export function AssetRevaluationPage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<AssetRevaluation[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getRevaluations()
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => `${r.revaluationNumber} ${r.assetNumber} ${r.assetName}`.toLowerCase().includes(q))
  }, [rows, search])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const totalSurplus = rows.reduce((s, r) => s + r.surplusAmount, 0)
    const posted = rows.filter((r) => r.status === 'Posted').length
    return [
      { id: 'count', label: 'Revaluations', value: rows.length, accent: 'blue' },
      { id: 'posted', label: 'Posted', value: posted, accent: 'green' },
      { id: 'surplus', label: 'Net Surplus / Deficit', value: formatCompactCurrency(totalSurplus), helper: formatCurrency(totalSurplus), accent: totalSurplus >= 0 ? 'green' : 'red' },
    ]
  }, [rows])

  if (!perms.canRevalue && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Revaluation" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Revaluation' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Revaluation"
      description="Fair-value revaluation of land, buildings and plant assets with revaluation surplus tracking."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Revaluation' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/revaluation"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="revaluation" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        <FixedAssetsSummaryCards items={kpis} columns={3} />

        <div className="min-w-[220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search revaluation number, asset…" />
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={TrendingUp} title="Could not load revaluations" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={TrendingUp} title="No revaluations match" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[980px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Revaluation No</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Previous NBV</th>
                      <th className="px-3 py-2 text-right font-semibold">Revalued Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">Surplus</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{r.revaluationNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.assetNumber}</p>
                          <p className="text-[11px] text-erp-muted">{r.assetName}</p>
                        </td>
                        <td className="px-3 py-2">{formatDate(r.revaluationDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.previousNBV)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.revaluedAmount)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.surplusAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatCurrency(r.surplusAmount)}
                        </td>
                        <td className="px-3 py-2"><FixedAssetsGenericStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </EnterpriseRegisterTableShell>
      </div>
    </OperationalPageShell>
  )
}
