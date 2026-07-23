import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ClipboardList,
  LayoutGrid,
  List,
  RefreshCw,
  UserPlus,
  Wrench,
} from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import { ErpSegmentedControl } from '@/components/erp/ErpSegmentedControl'
import { getControlRoomDashboard, getWorkOrdersSummary, listWorkOrders } from '@/services/api/manufacturingApi'
import type {
  ControlRoomOverview,
  ProductionOrder,
  WorkOrderHealth,
  WorkOrderStatus,
  WorkOrdersSummary,
} from '@/types/manufacturingProduction'
import { useSetupLookup } from './setup/useSetupLookups'
import { useManufacturingWorkOrderPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  ProductionEmptyState,
  ProductionPageHeader,
  WorkOrderHealthBadge,
  WorkOrderStatusBadge,
  WO_HEALTH_UI_LABELS,
  WO_STATUS_UI_LABELS,
} from './ui'

type ViewMode = 'board' | 'list'

const STATUS_FILTERS: Array<{ value: '' | WorkOrderStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: WO_STATUS_UI_LABELS.DRAFT },
  { value: 'READY', label: WO_STATUS_UI_LABELS.READY },
  { value: 'IN_PROGRESS', label: WO_STATUS_UI_LABELS.IN_PROGRESS },
  { value: 'ON_HOLD', label: WO_STATUS_UI_LABELS.ON_HOLD },
  { value: 'COMPLETED', label: WO_STATUS_UI_LABELS.COMPLETED },
]

const HEALTH_FILTERS: Array<{ value: '' | WorkOrderHealth; label: string }> = [
  { value: '', label: 'All health' },
  { value: 'ON_TRACK', label: WO_HEALTH_UI_LABELS.ON_TRACK },
  { value: 'ATTENTION', label: WO_HEALTH_UI_LABELS.ATTENTION },
  { value: 'BLOCKED', label: WO_HEALTH_UI_LABELS.BLOCKED },
  { value: 'DELAYED', label: WO_HEALTH_UI_LABELS.DELAYED },
]

function completionPct(wo: ProductionOrder): number {
  const n = Number(wo.completionPercent)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function productLabel(wo: ProductionOrder, fallback: (id: string) => string): string {
  if (wo.productItemCode && wo.productItemName) return `${wo.productItemCode} · ${wo.productItemName}`
  if (wo.productItemName) return wo.productItemName
  if (wo.productItemCode) return wo.productItemCode
  return fallback(wo.productItemId)
}

function stageLabel(wo: ProductionOrder): string {
  if (wo.currentStageCode && wo.currentStageName) return `${wo.currentStageCode} · ${wo.currentStageName}`
  if (wo.currentStageName) return wo.currentStageName
  if (wo.currentStageCode) return wo.currentStageCode
  return wo.currentStageId ? 'Stage active' : 'No stage'
}

function healthAccent(health: WorkOrderHealth): string {
  switch (health) {
    case 'BLOCKED':
      return 'border-l-rose-500'
    case 'DELAYED':
      return 'border-l-amber-500'
    case 'ATTENTION':
      return 'border-l-amber-400'
    case 'ON_TRACK':
      return 'border-l-emerald-500'
    default:
      return 'border-l-slate-300'
  }
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-erp-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function DistributionPanel({
  title,
  empty,
  children,
  action,
}: {
  title: string
  empty?: boolean
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-erp-border px-3.5 py-2.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-erp-muted">{title}</h2>
        {action}
      </header>
      {empty ? (
        <p className="px-3.5 py-6 text-center text-[12px] text-erp-muted">No data right now.</p>
      ) : (
        children
      )}
    </section>
  )
}

function CountBar({
  label,
  count,
  max,
  onClick,
}: {
  label: React.ReactNode
  count: number
  max: number
  onClick?: () => void
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums font-semibold text-erp-text">{count}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-erp-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className="flex w-full flex-col gap-1 px-3.5 py-2 text-left hover:bg-erp-surface-alt/50"
        onClick={onClick}
      >
        {body}
      </button>
    )
  }
  return <div className="flex w-full flex-col gap-1 px-3.5 py-2 text-left">{body}</div>
}

function CompactWoCard({
  wo,
  product,
  layout,
  onOpen,
}: {
  wo: ProductionOrder
  product: string
  layout: ViewMode
  onOpen: (id: string) => void
}) {
  const pct = completionPct(wo)
  const stage = stageLabel(wo)

  if (layout === 'list') {
    return (
      <li className="border-b border-erp-border last:border-b-0">
        <button
          type="button"
          className={cn(
            'flex w-full flex-col gap-2 border-l-[3px] px-4 py-3 text-left transition hover:bg-erp-surface-alt/40 sm:flex-row sm:items-center sm:justify-between',
            healthAccent(wo.healthStatus),
          )}
          onClick={() => onOpen(wo.id)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[13px] font-semibold text-erp-primary">{wo.workOrderNo}</span>
              <span className="truncate text-[13px] font-medium text-erp-text">{product}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-erp-muted">
              <span className="tabular-nums">Qty {wo.plannedQuantity}</span>
              <span className="tabular-nums font-medium text-erp-text">{pct}%</span>
              <span>Due {wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'}</span>
              <span className="truncate">{stage}</span>
              {wo.salesOrderNo ? <span className="font-mono">SO {wo.salesOrderNo}</span> : null}
              {wo.priority ? <span className="uppercase tracking-wide">{wo.priority}</span> : null}
            </div>
            <div className="mt-2 max-w-xs">
              <ProgressBar pct={pct} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <WorkOrderStatusBadge status={wo.status} />
            <WorkOrderHealthBadge health={wo.healthStatus} />
          </div>
        </button>
      </li>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex h-full flex-col gap-2.5 rounded-lg border border-erp-border border-l-[3px] bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-erp-primary/35 hover:shadow',
        healthAccent(wo.healthStatus),
      )}
      onClick={() => onOpen(wo.id)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold text-erp-primary">{wo.workOrderNo}</span>
        <div className="flex flex-wrap justify-end gap-1">
          <WorkOrderStatusBadge status={wo.status} />
          <WorkOrderHealthBadge health={wo.healthStatus} />
        </div>
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-erp-text">{product}</p>
      <div className="rounded-md bg-slate-50/80 px-2 py-1.5 text-[11px] text-erp-muted">
        <span className="font-medium text-erp-text">{stage}</span>
      </div>
      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between text-[11px] text-erp-muted">
          <span className="tabular-nums">Qty {wo.plannedQuantity}</span>
          <span className="tabular-nums font-semibold text-erp-text">{pct}%</span>
        </div>
        <ProgressBar pct={pct} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-erp-muted">
          <span>Due {wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'}</span>
          {wo.salesOrderNo ? <span className="font-mono">SO {wo.salesOrderNo}</span> : null}
          {wo.priority ? <span className="uppercase tracking-wide">{wo.priority}</span> : null}
        </div>
      </div>
    </button>
  )
}

/** API-backed Control Room — live WO board/list + status/health/centre aggregates. */
export function ApiProductionControlRoomView() {
  const navigate = useNavigate()
  const perms = useManufacturingWorkOrderPermissions()
  const { options: items } = useSetupLookup('items')
  const [overview, setOverview] = useState<ControlRoomOverview | null>(null)
  const [summary, setSummary] = useState<WorkOrdersSummary | null>(null)
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | WorkOrderStatus>('')
  const [healthFilter, setHealthFilter] = useState<'' | WorkOrderHealth>('')

  const itemLabel = useCallback(
    (id: string) => items.find((i) => i.id === id)?.label ?? 'Item',
    [items],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, sum, list] = await Promise.all([
        getControlRoomDashboard(),
        getWorkOrdersSummary(),
        listWorkOrders({
          search: search || undefined,
          status: statusFilter || undefined,
          healthStatus: healthFilter || undefined,
          limit: 100,
        }),
      ])
      setOverview(ov.data)
      setSummary(sum.data)
      setOrders(list.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load control room')
      setOverview(null)
      setSummary(null)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, healthFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openIssueCount = overview?.openIssues?.length ?? 0
  const statusMax = useMemo(
    () => Math.max(1, ...(overview?.byStatus.map((r) => r.count) ?? [1])),
    [overview],
  )
  const healthMax = useMemo(
    () => Math.max(1, ...(overview?.byHealth.map((r) => r.count) ?? [1])),
    [overview],
  )
  const centreMax = useMemo(
    () => Math.max(1, ...(overview?.byWorkCentre.map((r) => r.orderCount) ?? [1])),
    [overview],
  )
  const stageMax = useMemo(
    () => Math.max(1, ...(overview?.byCurrentStage.map((r) => r.orderCount) ?? [1])),
    [overview],
  )

  const kpiStrip: EnterpriseKpiItem[] = useMemo(() => {
    if (!overview || !summary) return []
    return [
      {
        id: 'total',
        label: 'Work Orders',
        value: String(summary.total),
        accent: 'blue',
        onClick: () => {
          setStatusFilter('')
          setHealthFilter('')
        },
      },
      {
        id: 'active',
        label: 'Active',
        value: String(overview.activeOrderCount),
        accent: 'green',
        helper: 'Ready + in progress',
        onClick: () => setStatusFilter('IN_PROGRESS'),
      },
      {
        id: 'issues',
        label: 'Open Issues',
        value: String(openIssueCount),
        accent: openIssueCount > 0 ? 'red' : 'slate',
        onClick: () => navigate('/manufacturing/issues'),
      },
      {
        id: 'paused',
        label: 'Paused Tasks',
        value: String(overview.pausedTasks ?? 0),
        accent: (overview.pausedTasks ?? 0) > 0 ? 'amber' : 'slate',
      },
      {
        id: 'unassigned',
        label: 'Unassigned Ready',
        value: String(overview.unassignedReadyWork ?? 0),
        accent: (overview.unassignedReadyWork ?? 0) > 0 ? 'amber' : 'slate',
        onClick: () => setStatusFilter('READY'),
      },
      {
        id: 'assignments',
        label: 'Active Assignments',
        value: String(overview.activeAssignmentsInProgress ?? 0),
        accent: 'blue',
      },
    ]
  }, [overview, summary, openIssueCount, navigate])

  if (!perms.canViewControlRoom) {
    return (
      <ProductionPageHeader
        title="Production Control Room"
        description="Live work orders, stage load, people, and issues needing attention"
        favoritePath="/manufacturing/control-room"
      >
        <p className="text-sm text-erp-muted">You do not have permission to view the Production Control Room.</p>
      </ProductionPageHeader>
    )
  }

  const filterBar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search work orders…"
        className="min-w-[12rem] flex-1 sm:max-w-xs"
      />
      <Select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as '' | WorkOrderStatus)}
        className="h-9 w-full sm:w-40"
        aria-label="Filter by status"
      >
        {STATUS_FILTERS.map((o) => (
          <option key={o.value || 'all-status'} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select
        value={healthFilter}
        onChange={(e) => setHealthFilter(e.target.value as '' | WorkOrderHealth)}
        className="h-9 w-full sm:w-40"
        aria-label="Filter by health"
      >
        {HEALTH_FILTERS.map((o) => (
          <option key={o.value || 'all-health'} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <ErpSegmentedControl
        name="Control room view"
        variant="pills"
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'board', label: 'Board', icon: LayoutGrid },
          { value: 'list', label: 'List', icon: List },
        ]}
        className="sm:ml-auto"
      />
    </div>
  )

  return (
    <ProductionPageHeader
      title="Production Control Room"
      description="Live work orders, stage load, people, and issues needing attention"
      favoritePath="/manufacturing/control-room"
      primaryAction={{
        id: 'work-orders',
        label: 'Work Orders',
        icon: Wrench,
        onClick: () => navigate('/manufacturing/work-orders'),
      }}
      secondaryActions={[
        {
          id: 'shopfloor',
          label: 'Shopfloor',
          icon: LayoutGrid,
          onClick: () => navigate('/manufacturing/shopfloor'),
        },
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      kpiStrip={kpiStrip.length > 0 ? kpiStrip : undefined}
      filterBar={filterBar}
    >
      {loading ? <LoadingState variant="dashboard" rows={6} /> : null}

      {!loading && overview && summary ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold text-erp-text">Live work orders</h2>
                <p className="text-[12px] text-erp-muted">
                  {orders.length} matching · open a card to execute on the work order
                </p>
              </div>
              {(statusFilter || healthFilter || search) && (
                <button
                  type="button"
                  className="text-[12px] font-semibold text-erp-primary hover:underline"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('')
                    setHealthFilter('')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {orders.length === 0 ? (
              <ProductionEmptyState
                icon={ClipboardList}
                title="No matching work orders"
                description="Adjust search or status/health filters, or open the Work Orders register."
              />
            ) : viewMode === 'board' ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {orders.map((wo) => (
                  <CompactWoCard
                    key={wo.id}
                    wo={wo}
                    product={productLabel(wo, itemLabel)}
                    layout="board"
                    onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                  />
                ))}
              </div>
            ) : (
              <section className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <ul>
                  {orders.map((wo) => (
                    <CompactWoCard
                      key={wo.id}
                      wo={wo}
                      product={productLabel(wo, itemLabel)}
                      layout="list"
                      onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-3 lg:col-span-4">
            {(openIssueCount > 0 || (overview.unassignedReadyWork ?? 0) > 0) && (
              <section className="overflow-hidden rounded-lg border border-amber-200/80 bg-amber-50/40">
                <header className="flex items-center gap-2 border-b border-amber-200/60 px-3.5 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-amber-900">
                    Needs attention
                  </h2>
                </header>
                <ul className="divide-y divide-amber-200/50">
                  {openIssueCount > 0 ? (
                    <li>
                      <Link
                        to="/manufacturing/issues"
                        className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] hover:bg-amber-50"
                      >
                        <span className="font-medium text-erp-text">Open production issues</span>
                        <span className="tabular-nums font-semibold text-rose-700">{openIssueCount}</span>
                      </Link>
                    </li>
                  ) : null}
                  {(overview.unassignedReadyWork ?? 0) > 0 ? (
                    <li>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] hover:bg-amber-50"
                        onClick={() => setStatusFilter('READY')}
                      >
                        <span className="inline-flex items-center gap-1.5 font-medium text-erp-text">
                          <UserPlus className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                          Unassigned ready work
                        </span>
                        <span className="tabular-nums font-semibold text-amber-800">
                          {overview.unassignedReadyWork}
                        </span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              </section>
            )}

            {overview.openIssues && overview.openIssues.length > 0 ? (
              <DistributionPanel
                title="Open issues"
                action={
                  <Link to="/manufacturing/issues" className="text-[11px] font-semibold text-erp-primary hover:underline">
                    Queue
                  </Link>
                }
              >
                <ul className="max-h-48 divide-y divide-erp-border overflow-y-auto">
                  {overview.openIssues.slice(0, 6).map((issue) => (
                    <li key={issue.id}>
                      <Link
                        to={`/manufacturing/work-orders/${issue.productionOrderId}`}
                        className="block px-3.5 py-2 hover:bg-erp-surface-alt/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-erp-primary">
                            {issue.issueNumber}
                          </span>
                          {issue.productionBlocked ? (
                            <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-800 ring-1 ring-rose-200">
                              Blocked
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-erp-text">{issue.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </DistributionPanel>
            ) : null}

            <DistributionPanel title="By status" empty={overview.byStatus.length === 0}>
              <div className="divide-y divide-erp-border py-0.5">
                {overview.byStatus.map((row) => (
                  <CountBar
                    key={row.status}
                    label={<WorkOrderStatusBadge status={row.status} />}
                    count={row.count}
                    max={statusMax}
                    onClick={() => setStatusFilter(row.status)}
                  />
                ))}
              </div>
            </DistributionPanel>

            <DistributionPanel title="By health" empty={overview.byHealth.length === 0}>
              <div className="divide-y divide-erp-border py-0.5">
                {overview.byHealth.map((row) => (
                  <CountBar
                    key={row.healthStatus}
                    label={<WorkOrderHealthBadge health={row.healthStatus} />}
                    count={row.count}
                    max={healthMax}
                    onClick={() => setHealthFilter(row.healthStatus)}
                  />
                ))}
              </div>
            </DistributionPanel>

            <DistributionPanel title="Work centre load" empty={overview.byWorkCentre.length === 0}>
              <div className="divide-y divide-erp-border py-0.5">
                {overview.byWorkCentre.map((row) => (
                  <CountBar
                    key={row.workCentreId ?? 'unassigned'}
                    label={row.workCentreName}
                    count={row.orderCount}
                    max={centreMax}
                  />
                ))}
              </div>
            </DistributionPanel>

            <DistributionPanel title="Current stage" empty={overview.byCurrentStage.length === 0}>
              <div className="divide-y divide-erp-border py-0.5">
                {overview.byCurrentStage.map((row) => (
                  <CountBar
                    key={row.stageName}
                    label={row.stageName}
                    count={row.orderCount}
                    max={stageMax}
                  />
                ))}
              </div>
            </DistributionPanel>
          </aside>
        </div>
      ) : null}

      {!loading && !overview ? (
        <ProductionEmptyState
          icon={ClipboardList}
          title="Unable to load Control Room"
          description="Refresh to try again."
        />
      ) : null}
    </ProductionPageHeader>
  )
}
