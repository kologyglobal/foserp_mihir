import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import {
  FixedAssetsDemoBanner,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getAssets, getCategories } from '@/services/accounting/fixedAssetsService'
import type { FixedAssetCategory } from '@/types/fixedAssets'
import { DEPRECIATION_METHODS } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

export function AssetCategoriesPage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<FixedAssetCategory[]>([])
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({})
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const [cats, assets] = await Promise.all([getCategories(), getAssets()])
      setRows(cats)
      const counts: Record<string, number> = {}
      for (const a of assets) counts[a.categoryId] = (counts[a.categoryId] ?? 0) + 1
      setAssetCounts(counts)
      setLoadState(cats.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    return rows.filter((c) => {
      if (search && !`${c.code} ${c.name}`.toLowerCase().includes(search.toLowerCase())) return false
      if (methodFilter && c.depreciationMethod !== methodFilter) return false
      if (activeFilter === 'active' && !c.active) return false
      if (activeFilter === 'inactive' && c.active) return false
      return true
    })
  }, [rows, search, methodFilter, activeFilter])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const active = rows.filter((c) => c.active).length
    return [
      { id: 'count', label: 'Categories', value: rows.length, accent: 'blue' },
      { id: 'active', label: 'Active', value: active, accent: 'green' },
      { id: 'assets', label: 'Assets Classified', value: Object.values(assetCounts).reduce((s, n) => s + n, 0), accent: 'slate' },
    ]
  }, [rows, assetCounts])

  if (!perms.canViewCategories) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Asset Categories" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Categories' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Categories"
      description="Depreciation method, useful life and GL mapping by fixed asset category."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Categories' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/categories"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="categories" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="auto" />
        <FixedAssetsSummaryCards items={kpis} columns={3} />

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search category code or name…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Method
            <Select wrapClassName="w-44" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">All methods</option>
              {DEPRECIATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Status
            <Select wrapClassName="w-36" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={Layers} title="Could not load categories" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={Layers} title="No categories match" description="Adjust filters to see categories." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[880px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Code</th>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Method</th>
                      <th className="px-3 py-2 text-right font-semibold">Useful Life (yrs)</th>
                      <th className="px-3 py-2 text-right font-semibold">Residual %</th>
                      <th className="px-3 py-2 font-semibold">GL Asset</th>
                      <th className="px-3 py-2 font-semibold">GL Accum. Dep.</th>
                      <th className="px-3 py-2 font-semibold">GL Dep. Expense</th>
                      <th className="px-3 py-2 text-right font-semibold">Assets</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => (
                      <tr key={c.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{c.code}</td>
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2">{c.depreciationMethod}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.usefulLifeYears}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.residualPercent}%</td>
                        <td className="px-3 py-2 font-mono">{c.glAssetAccount}</td>
                        <td className="px-3 py-2 font-mono">{c.glAccumDepAccount}</td>
                        <td className="px-3 py-2 font-mono">{c.glDepExpenseAccount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{assetCounts[c.id] ?? 0}</td>
                        <td className="px-3 py-2">
                          <span className={c.active ? 'text-emerald-700' : 'text-erp-muted'}>{c.active ? 'Active' : 'Inactive'}</span>
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
    </OperationalPageShell>
  )
}
