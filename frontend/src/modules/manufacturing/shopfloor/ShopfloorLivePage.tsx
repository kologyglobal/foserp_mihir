import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pause, Play, RotateCcw, ShieldAlert, Wrench } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingDemoBanner, ShopfloorStatusChip } from '@/components/manufacturing'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  getShopfloorLive,
  type ShopfloorLiveResult,
  type ShopfloorLiveWorkOrder,
} from '@/services/api/opsReportsApi'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/dates/format'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

const AUTO_REFRESH_MS = 30_000

function statusOf(wo: ShopfloorLiveWorkOrder): string {
  return String(wo.status ?? 'unknown')
}

/** Phase 7D — real-time shopfloor board sourced from the ops-reports live API. */
export function ShopfloorLivePage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()

  const [data, setData] = useState<ShopfloorLiveResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(async (silent = false) => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      const res = await getShopfloorLive(search.trim() ? { search: search.trim() } : undefined)
      setData(res.data)
      setLastRefreshedAt(new Date())
    } catch (error) {
      if (!silent) setData(null)
      notify.error(error instanceof Error ? error.message : 'Failed to load shopfloor board')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isApiMode() || !autoRefresh) return
    const id = window.setInterval(() => void load(true), AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, load])

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 5_000)
    return () => window.clearInterval(id)
  }, [])

  const refreshLabel = useMemo(() => {
    if (!lastRefreshedAt) return autoRefresh ? 'Auto-refresh on · not yet updated' : 'Auto-refresh off · not yet updated'
    const relative = formatRelativeTime(lastRefreshedAt.toISOString())
    return autoRefresh ? `Auto-refresh on · Updated ${relative}` : `Auto-refresh off · Updated ${relative}`
    // tick forces re-render so the relative label stays fresh without refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefreshedAt, autoRefresh, tick])

  const workOrders = useMemo(() => data?.workOrders ?? [], [data])

  const filtered = useMemo(() => {
    if (!search.trim()) return workOrders
    const q = search.trim().toLowerCase()
    return workOrders.filter((wo) => {
      const blob = `${wo.orderNumber ?? ''} ${wo.itemCode ?? ''} ${wo.itemName ?? ''} ${wo.workCentreName ?? ''} ${wo.operatorName ?? ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [workOrders, search])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const counts = new Map<string, number>()
    for (const wo of workOrders) {
      const s = statusOf(wo)
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return [...counts.entries()].map(([status, count]) => ({
      id: status,
      label: status.replace(/_/g, ' '),
      value: count,
      accent: status === 'on_hold' ? 'amber' : status === 'in_progress' ? 'blue' : 'slate',
    }))
  }, [workOrders])

  if (!perms.canViewShopfloorLive) {
    return (
      <ProductionPageHeader title="Shopfloor Live" favoritePath="/manufacturing/shopfloor">
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="You do not have permission to view the live shopfloor board."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Shopfloor Live"
      description="Active work orders across the shopfloor, refreshed from the ops-reports API."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Shopfloor Live' },
      ]}
      favoritePath="/manufacturing/shopfloor"
      secondaryActions={
        isApiMode()
          ? [
              {
                id: 'toggle-refresh',
                label: autoRefresh ? 'Pause Auto-refresh' : 'Resume Auto-refresh',
                icon: autoRefresh ? Pause : Play,
                onClick: () => setAutoRefresh((v) => !v),
              },
              { id: 'refresh', label: 'Refresh Now', icon: RotateCcw, onClick: () => void load() },
            ]
          : undefined
      }
      kpiStrip={isApiMode() && !loading ? kpiStrip : undefined}
      filterBar={
        isApiMode() ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search WO / item / work centre / operator…"
              className="min-w-[220px] max-w-md flex-1"
              aria-label="Search shopfloor live board"
            />
            <span className="text-[11px] font-medium text-erp-muted">{refreshLabel}</span>
          </div>
        ) : undefined
      }
    >
      {!isApiMode() ? (
        <>
          <ManufacturingDemoBanner message="Shopfloor Live requires API mode — enable VITE_USE_API to stream real-time work order status. Use Shopfloor View for the demo board." />
          <ProductionEmptyState
            icon={Wrench}
            title="Shopfloor Live requires API mode"
            description="Turn on VITE_USE_API to load the live shopfloor board from the ops-reports API."
          />
        </>
      ) : loading && !data ? (
        <LoadingState variant="card" rows={4} />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <ProductionEmptyState
              icon={Wrench}
              title="No active work orders"
              description="No work orders match this view right now."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((wo) => (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => navigate(`/manufacturing/work-orders/${wo.id}`)}
                  className={cn(
                    'rounded-lg border border-erp-border bg-white p-3 text-left transition hover:border-erp-primary/40 hover:bg-erp-surface-alt/40',
                  )}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold text-erp-primary">{wo.orderNumber}</span>
                    <ShopfloorStatusChip status={statusOf(wo) as never} />
                  </div>
                  <p className="text-[12px] font-medium text-erp-text">{wo.itemCode ?? '—'}</p>
                  <p className="line-clamp-1 text-[11px] text-erp-muted">{wo.itemName ?? ''}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <div>
                      <dt className="text-erp-muted">Work centre</dt>
                      <dd className="font-medium text-erp-text">{wo.workCentreName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-erp-muted">Operator</dt>
                      <dd className="font-medium text-erp-text">{wo.operatorName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-erp-muted">Planned</dt>
                      <dd className="font-medium tabular-nums text-erp-text">{wo.plannedQty ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-erp-muted">Completed</dt>
                      <dd className="font-medium tabular-nums text-erp-text">{wo.completedQty ?? '—'}</dd>
                    </div>
                  </dl>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ProductionPageHeader>
  )
}
