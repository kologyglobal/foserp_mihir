import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  CircleDot,
  Clock3,
  Factory,
  LayoutGrid,
  List,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  UserRound,
  Wrench,
} from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { ErpSegmentedControl } from '@/components/erp/ErpSegmentedControl'
import { ManufacturingDemoBanner, ShopfloorStatusChip } from '@/components/manufacturing'
import { DataTable } from '@/components/tables/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
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

type ViewMode = 'board' | 'centres' | 'list'
type LaneId = 'ready' | 'running' | 'hold' | 'qc' | 'done' | 'all'

const LANE_ORDER: Exclude<LaneId, 'all'>[] = ['ready', 'running', 'hold', 'qc', 'done']

const LANES: Array<{
  id: Exclude<LaneId, 'all'>
  title: string
  hint: string
  barClass: string
  headerClass: string
}> = [
  {
    id: 'ready',
    title: 'Ready',
    hint: 'Released · waiting to start',
    barClass: 'bg-slate-400',
    headerClass: 'bg-slate-50 border-slate-200',
  },
  {
    id: 'running',
    title: 'In Progress',
    hint: 'Running on the floor now',
    barClass: 'bg-sky-500',
    headerClass: 'bg-sky-50 border-sky-200',
  },
  {
    id: 'hold',
    title: 'On Hold',
    hint: 'Blocked · needs attention',
    barClass: 'bg-amber-500',
    headerClass: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'qc',
    title: 'QC',
    hint: 'Inspection / quality hold',
    barClass: 'bg-violet-500',
    headerClass: 'bg-violet-50 border-violet-200',
  },
  {
    id: 'done',
    title: 'Completed',
    hint: 'Finished · ready to close',
    barClass: 'bg-emerald-500',
    headerClass: 'bg-emerald-50 border-emerald-200',
  },
]

function statusOf(wo: ShopfloorLiveWorkOrder): string {
  return String(wo.status ?? 'unknown').toLowerCase()
}

function laneFor(status: string): Exclude<LaneId, 'all'> {
  const s = status.toLowerCase()
  if (s.includes('qc') || s.includes('quality')) return 'qc'
  if (s.includes('hold')) return 'hold'
  if (s === 'in_progress' || s === 'running' || s === 'started' || s === 'active') return 'running'
  if (s === 'completed' || s === 'done' || s === 'finished') return 'done'
  return 'ready'
}

function progressOf(wo: ShopfloorLiveWorkOrder): number {
  if (typeof wo.progressPct === 'number' && Number.isFinite(wo.progressPct)) {
    return Math.max(0, Math.min(100, Math.round(wo.progressPct)))
  }
  const planned = Number(wo.plannedQty ?? 0)
  const completed = Number(wo.completedQty ?? 0)
  if (planned <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completed / planned) * 100)))
}

function ShopfloorWoCard({
  wo,
  onOpen,
}: {
  wo: ShopfloorLiveWorkOrder
  onOpen: (id: string) => void
}) {
  const status = statusOf(wo)
  const progress = progressOf(wo)
  const planned = wo.plannedQty ?? '—'
  const completed = wo.completedQty ?? '—'

  return (
    <button
      type="button"
      onClick={() => onOpen(wo.id)}
      className={cn(
        'group w-full rounded-xl border border-erp-border bg-white p-3.5 text-left shadow-sm',
        'transition hover:border-erp-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary/30',
      )}
      aria-label={`Open work order ${wo.orderNumber}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-erp-primary">{wo.orderNumber || '—'}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-erp-text">{wo.itemCode ?? '—'}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-erp-muted">{wo.itemName || 'No item name'}</p>
        </div>
        <ShopfloorStatusChip status={status as never} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
          <span>Progress</span>
          <span className="tabular-nums text-erp-text">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-erp-surface-alt">
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-sky-500' : 'bg-slate-300',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-erp-muted">
            <Factory className="h-3 w-3 shrink-0" aria-hidden />
            Work centre
          </dt>
          <dd className="truncate font-medium text-erp-text">{wo.workCentreName ?? '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-erp-muted">
            <UserRound className="h-3 w-3 shrink-0" aria-hidden />
            Operator
          </dt>
          <dd className="truncate font-medium text-erp-text">{wo.operatorName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Planned</dt>
          <dd className="font-semibold tabular-nums text-erp-text">{planned}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Completed</dt>
          <dd className="font-semibold tabular-nums text-erp-text">{completed}</dd>
        </div>
      </dl>

      {(wo.machineName || wo.dueDate) && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-erp-border/70 pt-2.5">
          {wo.machineName ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-erp-muted">
              <Wrench className="h-3 w-3" aria-hidden />
              {wo.machineName}
            </span>
          ) : null}
          {wo.dueDate ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-erp-muted">
              <Clock3 className="h-3 w-3" aria-hidden />
              Due {String(wo.dueDate).slice(0, 10)}
            </span>
          ) : null}
        </div>
      )}
    </button>
  )
}

/** Phase 7D — real-time shopfloor board sourced from the ops-reports live API. */
export function ShopfloorLivePage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()

  const [data, setData] = useState<ShopfloorLiveResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [laneFilter, setLaneFilter] = useState<LaneId>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(
    async (silent = false) => {
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
    },
    [search],
  )

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
    if (!lastRefreshedAt) return autoRefresh ? 'Live · waiting for first update' : 'Paused · not yet updated'
    const relative = formatRelativeTime(lastRefreshedAt.toISOString())
    return autoRefresh ? `Live · updated ${relative}` : `Paused · updated ${relative}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefreshedAt, autoRefresh, tick])

  const workOrders = useMemo(() => data?.workOrders ?? [], [data])

  const searched = useMemo(() => {
    if (!search.trim()) return workOrders
    const q = search.trim().toLowerCase()
    return workOrders.filter((wo) => {
      const blob = `${wo.orderNumber ?? ''} ${wo.itemCode ?? ''} ${wo.itemName ?? ''} ${wo.workCentreName ?? ''} ${wo.operatorName ?? ''} ${wo.machineName ?? ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [workOrders, search])

  const byLane = useMemo(() => {
    const map: Record<Exclude<LaneId, 'all'>, ShopfloorLiveWorkOrder[]> = {
      ready: [],
      running: [],
      hold: [],
      qc: [],
      done: [],
    }
    for (const wo of searched) {
      map[laneFor(statusOf(wo))].push(wo)
    }
    return map
  }, [searched])

  const visibleLanes = useMemo(
    () => (laneFilter === 'all' ? LANES : LANES.filter((l) => l.id === laneFilter)),
    [laneFilter],
  )

  const listRows = useMemo(() => {
    const lanes = laneFilter === 'all' ? LANE_ORDER : [laneFilter]
    return lanes.flatMap((id) => byLane[id])
  }, [byLane, laneFilter])

  const byWorkCentre = useMemo(() => {
    const map = new Map<string, ShopfloorLiveWorkOrder[]>()
    for (const wo of listRows) {
      const key = (wo.workCentreName ?? '').trim() || 'Unassigned'
      const bucket = map.get(key)
      if (bucket) bucket.push(wo)
      else map.set(key, [wo])
    }
    return Array.from(map.entries())
      .map(([name, rows]) => {
        const running = rows.filter((w) => laneFor(statusOf(w)) === 'running').length
        const hold = rows.filter((w) => laneFor(statusOf(w)) === 'hold').length
        const ready = rows.filter((w) => laneFor(statusOf(w)) === 'ready').length
        const qc = rows.filter((w) => laneFor(statusOf(w)) === 'qc').length
        return { name, rows, running, hold, ready, qc }
      })
      .sort((a, b) => {
        if (a.name === 'Unassigned') return 1
        if (b.name === 'Unassigned') return -1
        return a.name.localeCompare(b.name)
      })
  }, [listRows])

  const columns = useMemo<ColumnDef<ShopfloorLiveWorkOrder>[]>(
    () => [
      {
        id: 'orderNumber',
        accessorKey: 'orderNumber',
        header: 'WO #',
        cell: ({ row }) => (
          <TableLink
            to={`/manufacturing/work-orders/${row.original.id}`}
            className="font-mono font-semibold"
          >
            {row.original.orderNumber || '—'}
          </TableLink>
        ),
      },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[220px]">
            <p className="truncate font-mono text-[12px] font-medium text-erp-text">
              {row.original.itemCode ?? '—'}
            </p>
            <p className="truncate text-[11px] text-erp-muted">{row.original.itemName || '—'}</p>
          </div>
        ),
      },
      {
        id: 'lane',
        header: 'Lane',
        cell: ({ row }) => {
          const laneId = laneFor(statusOf(row.original))
          const lane = LANES.find((l) => l.id === laneId)
          return (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-erp-text">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', lane?.barClass)} aria-hidden />
              {lane?.title ?? '—'}
            </span>
          )
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <ShopfloorStatusChip status={statusOf(row.original) as never} />,
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => {
          const progress = progressOf(row.original)
          return (
            <div className="min-w-[100px]">
              <div className="mb-0.5 flex justify-between text-[10px] font-semibold tabular-nums text-erp-muted">
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-erp-surface-alt">
                <div
                  className={cn(
                    'h-full rounded-full',
                    progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-sky-500' : 'bg-slate-300',
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        id: 'workCentre',
        header: 'Work centre',
        cell: ({ row }) => (
          <span className="text-[12px] text-erp-text">{row.original.workCentreName ?? '—'}</span>
        ),
      },
      {
        id: 'operator',
        header: 'Operator',
        cell: ({ row }) => (
          <span className="text-[12px] text-erp-text">{row.original.operatorName ?? '—'}</span>
        ),
      },
      {
        id: 'machine',
        header: 'Machine',
        cell: ({ row }) => (
          <span className="text-[12px] text-erp-text">{row.original.machineName ?? '—'}</span>
        ),
      },
      {
        id: 'qty',
        header: 'Qty',
        cell: ({ row }) => (
          <span className="tabular-nums text-[12px] text-erp-text">
            {row.original.completedQty ?? 0} / {row.original.plannedQty ?? '—'}
          </span>
        ),
      },
      {
        id: 'dueDate',
        header: 'Due',
        cell: ({ row }) => (
          <span className="tabular-nums text-[12px] text-erp-text">
            {row.original.dueDate ? String(row.original.dueDate).slice(0, 10) : '—'}
          </span>
        ),
      },
    ],
    [],
  )

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const total = workOrders.length
    const running = workOrders.filter((w) => laneFor(statusOf(w)) === 'running').length
    const hold = workOrders.filter((w) => laneFor(statusOf(w)) === 'hold').length
    const qc = workOrders.filter((w) => laneFor(statusOf(w)) === 'qc').length
    const ready = workOrders.filter((w) => laneFor(statusOf(w)) === 'ready').length
    return [
      {
        id: 'total',
        label: 'On board',
        value: total,
        accent: 'slate',
        active: laneFilter === 'all',
        onClick: () => setLaneFilter('all'),
      },
      {
        id: 'ready',
        label: 'Ready',
        value: ready,
        accent: 'slate',
        active: laneFilter === 'ready',
        onClick: () => setLaneFilter('ready'),
      },
      {
        id: 'running',
        label: 'In progress',
        value: running,
        accent: 'blue',
        active: laneFilter === 'running',
        onClick: () => setLaneFilter('running'),
      },
      {
        id: 'hold',
        label: 'On hold',
        value: hold,
        accent: 'amber',
        active: laneFilter === 'hold',
        onClick: () => setLaneFilter('hold'),
      },
      {
        id: 'qc',
        label: 'QC',
        value: qc,
        accent: 'slate',
        active: laneFilter === 'qc',
        onClick: () => setLaneFilter('qc'),
      },
    ]
  }, [workOrders, laneFilter])

  const openWo = (id: string) => navigate(`/manufacturing/work-orders/${id}`)

  if (!perms.canViewShopfloorLive) {
    return (
      <ProductionPageHeader title="Shopfloor" favoritePath="/manufacturing/shopfloor">
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
      title="Shopfloor"
      description="Live work orders — Board by status, Centres by work centre, or List table. Filter, search, open any WO."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Shopfloor' },
      ]}
      favoritePath="/manufacturing/shopfloor"
      secondaryActions={
        isApiMode()
          ? [
              {
                id: 'toggle-refresh',
                label: autoRefresh ? 'Pause live' : 'Resume live',
                icon: autoRefresh ? Pause : Play,
                onClick: () => setAutoRefresh((v) => !v),
              },
              { id: 'refresh', label: 'Refresh now', icon: RotateCcw, onClick: () => void load() },
            ]
          : undefined
      }
      kpiStrip={isApiMode() && !loading ? kpiStrip : undefined}
      filterBar={
        isApiMode() ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search WO, item, work centre, operator…"
                  className="min-w-[220px] max-w-md flex-1"
                  aria-label="Search shopfloor board"
                />
                <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by lane">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={laneFilter === 'all'}
                    onClick={() => setLaneFilter('all')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                      laneFilter === 'all'
                        ? 'bg-erp-primary text-white'
                        : 'bg-erp-surface-alt text-erp-muted hover:text-erp-text',
                    )}
                  >
                    All ({searched.length})
                  </button>
                  {LANES.map((lane) => (
                    <button
                      key={lane.id}
                      type="button"
                      role="tab"
                      aria-selected={laneFilter === lane.id}
                      onClick={() => setLaneFilter(lane.id)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                        laneFilter === lane.id
                          ? 'bg-erp-primary text-white'
                          : 'bg-erp-surface-alt text-erp-muted hover:text-erp-text',
                      )}
                    >
                      {lane.title} ({byLane[lane.id].length})
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <ErpSegmentedControl
                  name="Shopfloor view"
                  variant="pills"
                  value={viewMode}
                  onChange={setViewMode}
                  options={[
                    { value: 'board', label: 'Board', icon: LayoutGrid },
                    { value: 'centres', label: 'Centres', icon: Factory },
                    { value: 'list', label: 'List', icon: List },
                  ]}
                />
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-erp-muted">
                  <span
                    className={cn(
                      'inline-flex h-2 w-2 rounded-full',
                      autoRefresh ? 'animate-pulse bg-emerald-500' : 'bg-slate-400',
                    )}
                    aria-hidden
                  />
                  {refreshLabel}
                </div>
              </div>
            </div>
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
      ) : listRows.length === 0 ? (
        <ProductionEmptyState
          icon={CircleDot}
          title={workOrders.length === 0 ? 'No active shopfloor work' : 'No work orders match'}
          description={
            workOrders.length === 0
              ? 'Nothing in Ready, In Progress, or On Hold right now. Release a work order to see it on this board.'
              : 'Clear the search or lane filter to see more work orders.'
          }
        />
      ) : viewMode === 'list' ? (
        <div className="overflow-x-auto rounded-xl border border-erp-border bg-white">
          <DataTable columns={columns} data={listRows} />
        </div>
      ) : viewMode === 'centres' ? (
        <div
          className={cn(
            'grid gap-3',
            byWorkCentre.length === 1
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
          )}
        >
          {byWorkCentre.map((centre) => (
            <section
              key={centre.name}
              className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-erp-border bg-erp-surface-alt/30"
              aria-label={`${centre.name} work centre`}
            >
              <header className="border-b border-sky-200 bg-sky-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Factory className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
                  <h2 className="min-w-0 truncate text-[13px] font-semibold text-erp-text">{centre.name}</h2>
                  <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-erp-text ring-1 ring-erp-border">
                    {centre.rows.length}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  {centre.running > 0 ? (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">
                      {centre.running} running
                    </span>
                  ) : null}
                  {centre.ready > 0 ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                      {centre.ready} ready
                    </span>
                  ) : null}
                  {centre.hold > 0 ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                      {centre.hold} hold
                    </span>
                  ) : null}
                  {centre.qc > 0 ? (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800">
                      {centre.qc} qc
                    </span>
                  ) : null}
                  {centre.running === 0 &&
                  centre.ready === 0 &&
                  centre.hold === 0 &&
                  centre.qc === 0 ? (
                    <span>Load on this centre</span>
                  ) : null}
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
                {centre.rows.map((wo) => (
                  <ShopfloorWoCard key={wo.id} wo={wo} onOpen={openWo} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-3',
            visibleLanes.length === 1
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5',
          )}
        >
          {visibleLanes.map((lane) => {
            const rows = byLane[lane.id]
            return (
              <section
                key={lane.id}
                className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-erp-border bg-erp-surface-alt/30"
                aria-label={`${lane.title} lane`}
              >
                <header className={cn('border-b px-3 py-2.5', lane.headerClass)}>
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', lane.barClass)} aria-hidden />
                    <h2 className="text-[13px] font-semibold text-erp-text">{lane.title}</h2>
                    <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-erp-text ring-1 ring-erp-border">
                      {rows.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-erp-muted">{lane.hint}</p>
                </header>
                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
                  {rows.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-erp-border bg-white/60 px-3 py-8 text-center text-[11px] text-erp-muted">
                      No WOs in this lane
                    </div>
                  ) : (
                    rows.map((wo) => <ShopfloorWoCard key={wo.id} wo={wo} onOpen={openWo} />)
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </ProductionPageHeader>
  )
}
