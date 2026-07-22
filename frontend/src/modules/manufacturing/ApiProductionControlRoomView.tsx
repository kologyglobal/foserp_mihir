import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, LayoutGrid, List, RefreshCw, Wrench } from 'lucide-react'
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

function CompactWoCard({
  wo,
  productLabel,
  layout,
  onOpen,
}: {
  wo: ProductionOrder
  productLabel: string
  layout: ViewMode
  onOpen: (id: string) => void
}) {
  const pct = completionPct(wo)
  const stageHint = wo.currentStageId ? 'Stage active' : '—'

  if (layout === 'list') {
    return (
      <li className="border-b border-erp-border last:border-b-0">
        <button
          type="button"
          className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-erp-surface-alt/40 sm:flex-row sm:items-center sm:justify-between"
          onClick={() => onOpen(wo.id)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[13px] font-semibold text-erp-primary">{wo.workOrderNo}</span>
              <span className="truncate text-[13px] font-medium text-erp-text">{productLabel}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-erp-muted">
              <span className="tabular-nums">Qty {wo.plannedQuantity}</span>
              <span className="tabular-nums">{pct}%</span>
              <span>Due {wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'}</span>
              <span>{stageHint}</span>
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
      className="flex h-full flex-col gap-2 rounded-lg border border-erp-border bg-white px-3 py-3 text-left transition hover:border-erp-primary/40 hover:bg-erp-surface-alt/30"
      onClick={() => onOpen(wo.id)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-mono text-[13px] font-semibold text-erp-primary">{wo.workOrderNo}</span>
        <div className="flex flex-wrap gap-1">
          <WorkOrderStatusBadge status={wo.status} />
          <WorkOrderHealthBadge health={wo.healthStatus} />
        </div>
      </div>
      <p className="truncate text-[13px] font-medium text-erp-text">{productLabel}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-erp-muted">
        <span className="tabular-nums">Qty {wo.plannedQuantity}</span>
        <span className="tabular-nums">{pct}%</span>
        <span>Due {wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'}</span>
      </div>
      <p className="text-[11px] text-erp-muted">{stageHint}</p>
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
    (id: string) => items.find((i) => i.id === id)?.label ?? 'Product',
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

  const kpiStrip: EnterpriseKpiItem[] = useMemo(() => {
    if (!overview || !summary) return []
    return [
      { id: 'total', label: 'Work Orders', value: String(summary.total) },
      { id: 'active', label: 'Active', value: String(overview.activeOrderCount) },
      {
        id: 'issues',
        label: 'Open Issues',
        value: String(overview.openIssues?.length ?? 0),
      },
      { id: 'paused', label: 'Paused Tasks', value: String(overview.pausedTasks ?? 0) },
      {
        id: 'unassigned',
        label: 'Unassigned Ready',
        value: String(overview.unassignedReadyWork ?? 0),
      },
      {
        id: 'assignments',
        label: 'Active Assignments',
        value: String(overview.activeAssignmentsInProgress ?? 0),
      },
    ].slice(0, 6)
  }, [overview, summary])

  if (!perms.canViewControlRoom) {
    return (
      <ProductionPageHeader
        title="Production Control Room"
        description="Monitor live Work Orders, Stages, people, machines and issues"
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
      description="Monitor live Work Orders, Stages, people, machines and issues"
      favoritePath="/manufacturing/control-room"
      primaryAction={{
        id: 'work-orders',
        label: 'Work Orders',
        icon: Wrench,
        onClick: () => navigate('/manufacturing/work-orders'),
      }}
      secondaryActions={[
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      kpiStrip={kpiStrip.length > 0 ? kpiStrip : undefined}
      filterBar={filterBar}
    >
      {loading ? <LoadingState variant="dashboard" rows={6} /> : null}

      {!loading && overview && summary ? (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <ProductionEmptyState
              icon={ClipboardList}
              title="No matching work orders"
              description="Adjust search or status/health filters, or open the Work Orders register."
            />
          ) : viewMode === 'board' ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {orders.map((wo) => (
                <CompactWoCard
                  key={wo.id}
                  wo={wo}
                  productLabel={itemLabel(wo.productItemId)}
                  layout="board"
                  onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                />
              ))}
            </div>
          ) : (
            <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
              <ul>
                {orders.map((wo) => (
                  <CompactWoCard
                    key={wo.id}
                    wo={wo}
                    productLabel={itemLabel(wo.productItemId)}
                    layout="list"
                    onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                  />
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
              <header className="border-b border-erp-border px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-erp-text">By Status</h2>
              </header>
              <ul className="divide-y divide-erp-border">
                {overview.byStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between px-4 py-2 text-[13px]">
                    <span className="flex items-center gap-2">
                      <WorkOrderStatusBadge status={row.status} />
                    </span>
                    <span className="tabular-nums font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
              <header className="border-b border-erp-border px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-erp-text">By Health</h2>
              </header>
              <ul className="divide-y divide-erp-border">
                {overview.byHealth.map((row) => (
                  <li key={row.healthStatus} className="flex items-center justify-between px-4 py-2 text-[13px]">
                    <WorkOrderHealthBadge health={row.healthStatus} />
                    <span className="tabular-nums font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
              <header className="flex items-center justify-between border-b border-erp-border px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-erp-text">Work Centre Load</h2>
                <LayoutGrid className="h-3.5 w-3.5 text-erp-muted" aria-hidden />
              </header>
              {overview.byWorkCentre.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-erp-muted">No active stages right now.</p>
              ) : (
                <ul className="divide-y divide-erp-border">
                  {overview.byWorkCentre.map((row) => (
                    <li
                      key={row.workCentreId ?? 'unassigned'}
                      className="flex items-center justify-between px-4 py-2 text-[13px]"
                    >
                      <span>{row.workCentreName}</span>
                      <span className="tabular-nums font-semibold">{row.orderCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
              <header className="border-b border-erp-border px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-erp-text">Current Stage</h2>
              </header>
              {overview.byCurrentStage.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-erp-muted">No active stages right now.</p>
              ) : (
                <ul className="divide-y divide-erp-border">
                  {overview.byCurrentStage.map((row) => (
                    <li key={row.stageName} className="flex items-center justify-between px-4 py-2 text-[13px]">
                      <span>{row.stageName}</span>
                      <span className="tabular-nums font-semibold">{row.orderCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
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
