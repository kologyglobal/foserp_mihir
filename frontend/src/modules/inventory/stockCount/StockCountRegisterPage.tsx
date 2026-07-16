import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Eye, MoreHorizontal, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { StockCountDemoBanner, StockCountStatusBadge } from '@/components/inventory/stockCount'
import { getStockCounts } from '@/services/inventory'
import type { StockCountListRow } from '@/types/inventoryDomain'
import { STOCK_COUNT_REGISTER_TABS, STOCK_COUNT_TYPE_LABELS } from '@/utils/stockCountLabels'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export function StockCountRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'all'
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [rows, setRows] = useState<StockCountListRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getStockCounts({ tab, search: search || undefined })
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load stock counts')
      setLoadState('error')
    }
  }, [tab, search])

  useEffect(() => { void load() }, [load])

  const setTab = (id: string) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'all') next.delete('tab')
    else next.set('tab', id)
    setSearchParams(next)
  }

  const kpis: EnterpriseKpiItem[] = [
    { id: 'total', label: 'Stock counts', value: rows.length, accent: 'blue' },
    {
      id: 'open',
      label: 'Open counts',
      value: rows.filter((r) => !['posted', 'cancelled'].includes(r.status)).length,
      accent: 'amber',
    },
    {
      id: 'variance',
      label: 'With differences',
      value: rows.filter((r) => r.differenceItems > 0).length,
      accent: rows.some((r) => r.differenceItems > 0) ? 'red' : 'slate',
    },
    {
      id: 'value',
      label: 'Difference value',
      value: formatCurrency(rows.reduce((s, r) => s + r.differenceValue, 0)),
      accent: 'slate',
    },
  ]

  if (!perms.canViewStockCount) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="Stock Count"
        breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Stock Count' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing stock count view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Stock Count"
      description="Physical verification, cycle counts, blind counts and variance approval."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Stock Count' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/stock-count"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateStockCount
              ? { id: 'new', label: 'New Stock Count', icon: Plus, onClick: () => navigate('/inventory/stock-count/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
      kpiStrip={loadState === 'ready' ? kpis : undefined}
    >
      <StockCountDemoBanner />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STOCK_COUNT_REGISTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                tab === t.id
                  ? 'bg-erp-primary text-white'
                  : 'bg-erp-surface-muted text-erp-muted hover:text-erp-text',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search count no., warehouse, assignee…"
          className="ml-auto max-w-xs"
        />
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" /> : null}
      {loadState === 'error' ? (
        <EmptyState icon={ClipboardList} title="Could not load stock counts" description={errorMsg} />
      ) : null}
      {loadState === 'empty' ? (
        <EmptyState
          icon={ClipboardList}
          title="No stock counts found"
          description="Create a new stock count to begin physical verification."
          action={
            perms.canCreateStockCount ? (
              <Link to="/inventory/stock-count/new" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">
                New Stock Count
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {loadState === 'ready' ? (
        <EnterpriseRegisterTableShell>
          <table className="erp-table w-full">
            <thead>
              <tr>
                <th>Count Number</th>
                <th>Count Type</th>
                <th>Warehouse</th>
                <th>Count Date</th>
                <th className="text-right">Items</th>
                <th className="text-right">Counted</th>
                <th className="text-right">Differences</th>
                <th className="text-right">Diff Value</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/inventory/stock-count/${row.id}`} className="font-mono text-erp-primary hover:underline">
                      {row.countNumber}
                    </Link>
                    {row.blindCount ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">BLIND</span>
                    ) : null}
                  </td>
                  <td>{STOCK_COUNT_TYPE_LABELS[row.countType]}</td>
                  <td>{row.warehouseName}</td>
                  <td>{formatDate(row.countDate)}</td>
                  <td className="num">{row.itemCount}</td>
                  <td className="num">{row.countedItems}</td>
                  <td className="num">{row.differenceItems}</td>
                  <td className="num">{formatCurrency(row.differenceValue)}</td>
                  <td>{row.assignedTo}</td>
                  <td><StockCountStatusBadge status={row.status} /></td>
                  <td className="relative">
                    <button
                      type="button"
                      className="erp-btn erp-btn-ghost h-8 w-8 p-0"
                      aria-label="Actions"
                      onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuId === row.id ? (
                      <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-md border border-erp-border bg-erp-surface py-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-erp-surface-muted"
                          onClick={() => { setMenuId(null); navigate(`/inventory/stock-count/${row.id}`) }}
                        >
                          <Eye className="h-3.5 w-3.5" /> Open Count
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EnterpriseRegisterTableShell>
      ) : null}
    </OperationalPageShell>
  )
}
