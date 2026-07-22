import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertOctagon, RefreshCw, ShieldOff } from 'lucide-react'
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
import { getImpairments } from '@/services/accounting/fixedAssetsService'
import type { AssetImpairment } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

export function AssetImpairmentPage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<AssetImpairment[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getImpairments()
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
    return rows.filter((r) => `${r.impairmentNumber} ${r.assetNumber} ${r.assetName}`.toLowerCase().includes(q))
  }, [rows, search])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const totalLoss = rows.reduce((s, r) => s + r.impairmentLoss, 0)
    const recognized = rows.filter((r) => r.status === 'Recognized').length
    return [
      { id: 'count', label: 'Impairments', value: rows.length, accent: 'blue' },
      { id: 'recognized', label: 'Recognized', value: recognized, accent: 'red' },
      { id: 'loss', label: 'Total Impairment Loss', value: formatCompactCurrency(totalLoss), helper: formatCurrency(totalLoss), accent: 'red' },
    ]
  }, [rows])

  if (!perms.canImpair && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Impairment" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Impairment' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Impairment"
      description="Recoverable amount testing and impairment loss recognition for fixed assets."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Impairment' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/impairment"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="impairment" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        <FixedAssetsSummaryCards items={kpis} columns={3} />

        <div className="min-w-[220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search impairment number, asset…" />
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={AlertOctagon} title="Could not load impairments" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={AlertOctagon} title="No impairments match" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[980px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Impairment No</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Carrying Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">Recoverable Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">Impairment Loss</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{r.impairmentNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.assetNumber}</p>
                          <p className="text-[11px] text-erp-muted">{r.assetName}</p>
                        </td>
                        <td className="px-3 py-2">{formatDate(r.impairmentDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.carryingAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.recoverableAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-700">{formatCurrency(r.impairmentLoss)}</td>
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
