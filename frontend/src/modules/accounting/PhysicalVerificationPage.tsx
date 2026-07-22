import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, RefreshCw, ShieldOff } from 'lucide-react'
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
import { getVerifications } from '@/services/accounting/fixedAssetsService'
import type { PhysicalVerification } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

export function PhysicalVerificationPage() {
  const navigate = useNavigate()
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<PhysicalVerification[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getVerifications()
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
    return rows.filter((r) => `${r.verificationNumber} ${r.plant} ${r.department ?? ''}`.toLowerCase().includes(q))
  }, [rows, search])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const inProgress = rows.filter((r) => r.status === 'In Progress').length
    const totalNotFound = rows.reduce((s, r) => s + r.notFoundCount, 0)
    const totalDamaged = rows.reduce((s, r) => s + r.damagedCount, 0)
    return [
      { id: 'count', label: 'Verification Cycles', value: rows.length, accent: 'blue' },
      { id: 'progress', label: 'In Progress', value: inProgress, accent: 'amber' },
      { id: 'notfound', label: 'Not Found (all cycles)', value: totalNotFound, accent: totalNotFound > 0 ? 'red' : 'slate' },
      { id: 'damaged', label: 'Damaged (all cycles)', value: totalDamaged, accent: totalDamaged > 0 ? 'red' : 'slate' },
    ]
  }, [rows])

  if (!perms.canVerify && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Physical Verification" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Verification' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Physical Verification"
      description="Periodic physical count cycles reconciling fixed assets against expected location — demo data only."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Verification' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/verification"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="verification" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        <FixedAssetsSummaryCards items={kpis} columns={4} />

        <div className="min-w-[220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search verification number, plant, department…" />
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={ClipboardCheck} title="Could not load verification cycles" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={ClipboardCheck} title="No verification cycles match" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Verification No</th>
                      <th className="px-3 py-2 font-semibold">Plant / Dept</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Total Assets</th>
                      <th className="px-3 py-2 text-right font-semibold">Verified</th>
                      <th className="px-3 py-2 text-right font-semibold">Not Found</th>
                      <th className="px-3 py-2 text-right font-semibold">Damaged</th>
                      <th className="px-3 py-2 font-semibold">Conducted By</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="cursor-pointer border-b border-erp-border/80 hover:bg-erp-surface-alt/40" onClick={() => navigate(`/accounting/fixed-assets/verification/${r.id}`)}>
                        <td className="px-3 py-2 font-mono text-erp-primary">{r.verificationNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.plant}</p>
                          {r.department ? <p className="text-[11px] text-erp-muted">{r.department}</p> : null}
                        </td>
                        <td className="px-3 py-2">{formatDate(r.verificationDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.totalAssets}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{r.verifiedCount}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${r.notFoundCount > 0 ? 'text-rose-700 font-semibold' : ''}`}>{r.notFoundCount}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${r.damagedCount > 0 ? 'text-amber-700 font-semibold' : ''}`}>{r.damagedCount}</td>
                        <td className="px-3 py-2">{r.conductedBy}</td>
                        <td className="px-3 py-2"><FixedAssetsGenericStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </EnterpriseRegisterTableShell>
        <p className="text-[12px] text-erp-muted">Click a row to open the verification detail and line items.</p>
      </div>
    </OperationalPageShell>
  )
}
