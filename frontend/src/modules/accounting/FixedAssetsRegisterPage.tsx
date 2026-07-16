import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  AssetStatusBadge,
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getAssets, getCategories } from '@/services/accounting/fixedAssetsService'
import type { AssetStatus, FixedAsset, FixedAssetCategory } from '@/types/fixedAssets'
import { ASSET_STATUSES, DEFAULT_FIXED_ASSETS_FILTER } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export function FixedAssetsRegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<FixedAsset[]>([])
  const [categories, setCategories] = useState<FixedAssetCategory[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<AssetStatus | ''>((params.get('status') as AssetStatus) || '')
  const [location, setLocation] = useState('')
  const [department, setDepartment] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const [list, cats] = await Promise.all([
        getAssets({ ...DEFAULT_FIXED_ASSETS_FILTER, search, categoryId, status, location, department }),
        categories.length ? Promise.resolve(categories) : getCategories(),
      ])
      if (signal?.cancelled) return
      setRows(list)
      setCategories(cats)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search, categoryId, status, location, department, categories])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const locations = useMemo(() => [...new Set(rows.map((r) => r.location))].sort(), [rows])
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows])

  const summary = useMemo(() => ({
    count: rows.length,
    cost: rows.reduce((s, r) => s + r.acquisitionCost, 0),
    accum: rows.reduce((s, r) => s + r.accumulatedDepreciation, 0),
    nbv: rows.reduce((s, r) => s + r.netBookValue, 0),
    active: rows.filter((r) => r.status === 'Active').length,
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'n', label: 'Assets', value: summary.count, accent: 'blue' },
    { id: 'active', label: 'Active', value: summary.active, accent: 'green' },
    { id: 'cost', label: 'Acquisition Cost', value: formatCompactCurrency(summary.cost), accent: 'slate' },
    { id: 'accum', label: 'Accum. Depreciation', value: formatCompactCurrency(summary.accum), accent: 'amber' },
    { id: 'nbv', label: 'Net Book Value', value: formatCompactCurrency(summary.nbv), helper: formatCurrency(summary.nbv), accent: 'green' },
  ]

  if (!perms.canViewRegister) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Asset Register" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Register' }]} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Register"
      description="Machinery, buildings, vehicles, tools and equipment with acquisition cost and net book value."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Asset Register' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/register"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <FixedAssetsWorkspaceTabs active="register" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner />
        <FixedAssetsSummaryCards items={kpis} columns={5} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search asset number, name, custodian…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Category
            <select className="mt-0.5 block h-9 min-w-[160px] rounded-md border border-erp-border px-2 text-[12px]" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Status
            <select className="mt-0.5 block h-9 min-w-[160px] rounded-md border border-erp-border px-2 text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as AssetStatus | '')}>
              <option value="">All</option>
              {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Location
            <select className="mt-0.5 block h-9 min-w-[140px] rounded-md border border-erp-border px-2 text-[12px]" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Department
            <select className="mt-0.5 block h-9 min-w-[140px] rounded-md border border-erp-border px-2 text-[12px]" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>

        {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}
        {loadState === 'error' ? <FixedAssetsEmptyState title="Load failed" /> : null}

        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Asset Number</th>
                <th className="px-3 py-2 font-semibold">Asset Name</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Custodian</th>
                <th className="px-3 py-2 text-right font-semibold">Acquisition Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Accum. Dep.</th>
                <th className="px-3 py-2 text-right font-semibold">Net Book Value</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="cursor-pointer border-t border-erp-border/80 hover:bg-erp-surface-alt/50" onClick={() => navigate(`/accounting/fixed-assets/register/${row.id}`)}>
                  <td className="px-3 py-2">
                    <Link className="font-medium text-erp-primary hover:underline" to={`/accounting/fixed-assets/register/${row.id}`} onClick={(e) => e.stopPropagation()}>
                      {row.assetNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.categoryName}</td>
                  <td className="px-3 py-2">{row.location}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{row.custodian}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.acquisitionCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.accumulatedDepreciation)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.netBookValue)}</td>
                  <td className="px-3 py-2"><AssetStatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <FixedAssetsEmptyState title="No assets match" description="Adjust filters to see fixed assets." />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
