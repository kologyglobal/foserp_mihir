import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  CapitalizationStatusBadge,
  FixedAssetsConfirmModal,
  FixedAssetsDemoBanner,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { capitalizeAssetDemo, getCapitalizations, FixedAssetsServiceError } from '@/services/accounting/fixedAssetsService'
import type { AssetCapitalization } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

export function AssetCapitalizationPage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<AssetCapitalization[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<AssetCapitalization | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getCapitalizations()
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
    return rows.filter((r) => {
      if (!search) return true
      const blob = `${r.capitalizationNumber} ${r.assetNumber} ${r.assetName}`.toLowerCase()
      return blob.includes(search.toLowerCase())
    })
  }, [rows, search])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'Pending Approval').length
    const capitalized = rows.filter((r) => r.status === 'Capitalized').length
    const totalCost = rows.reduce((s, r) => s + r.totalCost, 0)
    return [
      { id: 'count', label: 'Capitalization Requests', value: rows.length, accent: 'blue' },
      { id: 'pending', label: 'Pending Approval', value: pending, accent: 'amber' },
      { id: 'capitalized', label: 'Capitalized', value: capitalized, accent: 'green' },
      { id: 'cost', label: 'Total Cost', value: formatCompactCurrency(totalCost), helper: formatCurrency(totalCost), accent: 'slate' },
    ]
  }, [rows])

  const confirmCapitalize = async () => {
    if (!target || !perms.canCapitalize) {
      notify.error('Missing capitalize permission')
      return
    }
    setBusy(true)
    try {
      await capitalizeAssetDemo(target.id)
      notify.success(`${target.assetNumber} capitalized in demo mode. No GL posting occurred.`)
      setTarget(null)
      await load()
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Capitalize failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canCapitalize && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Capitalization" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Capitalization' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Capitalization"
      description="Move acquisitions and CWIP into active fixed assets — demo capitalization, no GL posting."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Capitalization' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/capitalization"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="capitalization" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        <FixedAssetsSummaryCards items={kpis} columns={4} />

        <div className="min-w-[220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search capitalization number, asset…" />
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={CheckCircle2} title="Could not load capitalization requests" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={CheckCircle2} title="No capitalization requests match" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[980px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Capitalization No</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Total Cost</th>
                      <th className="px-3 py-2 text-right font-semibold">Additional Costs</th>
                      <th className="px-3 py-2 font-semibold">GL Account</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{r.capitalizationNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.assetNumber}</p>
                          <p className="text-[11px] text-erp-muted">{r.assetName}</p>
                        </td>
                        <td className="px-3 py-2">{formatDate(r.capitalizationDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.totalCost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.additionalCosts)}</td>
                        <td className="px-3 py-2 font-mono">{r.glAssetAccount}</td>
                        <td className="px-3 py-2"><CapitalizationStatusBadge status={r.status} /></td>
                        <td className="px-3 py-2">
                          {r.status === 'Pending Approval' && perms.canCapitalize ? (
                            <button type="button" className="text-[12px] font-semibold text-erp-primary hover:underline" onClick={() => setTarget(r)}>
                              Capitalize (demo)
                            </button>
                          ) : (
                            <span className="text-erp-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </EnterpriseRegisterTableShell>
      </div>

      <FixedAssetsConfirmModal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Capitalize asset in demo mode"
        description={`This marks ${target?.assetNumber} as capitalized in frontend demo data only. No general ledger journals will be created.`}
        confirmLabel={busy ? 'Capitalizing…' : 'Confirm demo capitalize'}
        onConfirm={() => void confirmCapitalize()}
      />
    </OperationalPageShell>
  )
}
