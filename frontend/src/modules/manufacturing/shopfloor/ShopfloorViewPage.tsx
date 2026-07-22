import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardCheck,
  LayoutGrid,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Table2,
  Wrench,
  XCircle,
} from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  MfgTouchBtn,
  ShopfloorStatusChip,
} from '@/components/manufacturing'
import {
  ProductionEmptyState,
  ProductionPageHeader,
} from '../ui'
import {
  closeWorkOrderDemo,
  completeProductionQuantityDemo,
  getManufacturingControlDashboard,
  getWorkOrders,
  holdWorkOrderDemo,
  resumeWorkOrderDemo,
  sendWorkOrderToQcDemo,
  startWorkOrderDemo,
} from '@/services/manufacturing'
import type { ManufacturingControlDashboard } from '@/types/manufacturing'
import type { WorkOrder, WorkOrderStatus } from '@/types/manufacturingWorkOrder'
import {
  HOLD_REASON_LABELS,
  WO_MATERIAL_STATUS_LABELS,
} from '@/types/manufacturingWorkOrder'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type ViewTab = 'live' | 'line' | 'summary'
type LaneId = 'ready' | 'running' | 'hold' | 'qc' | 'done'

const VIEW_TABS: Array<{ id: ViewTab; label: string; icon: typeof LayoutGrid }> = [
  { id: 'live', label: 'Live Board', icon: LayoutGrid },
  { id: 'line', label: 'Machine / Line View', icon: Table2 },
  { id: 'summary', label: 'Daily Production Summary', icon: ClipboardCheck },
]

const LANES: Array<{ id: LaneId; title: string; hint: string; tone: string }> = [
  { id: 'ready', title: 'Ready', hint: 'Draft — ready to start', tone: 'border-t-slate-400' },
  { id: 'running', title: 'In Progress', hint: 'Running now', tone: 'border-t-sky-500' },
  { id: 'hold', title: 'On Hold', hint: 'Blocked', tone: 'border-t-amber-500' },
  { id: 'qc', title: 'QC Pending', hint: 'Awaiting inspection', tone: 'border-t-violet-500' },
  { id: 'done', title: 'Completed', hint: 'Ready to close', tone: 'border-t-emerald-500' },
]

function laneFor(wo: WorkOrder): LaneId | null {
  if (wo.status === 'cancelled' || wo.status === 'closed') return null
  if (wo.qualityHold) return 'qc'
  if (wo.status === 'on_hold') return 'hold'
  if (wo.status === 'completed') return 'done'
  if (wo.status === 'in_progress') return 'running'
  if (wo.status === 'draft') return 'ready'
  return 'ready'
}

function operatorLine(wo: WorkOrder): string {
  const parts = [wo.supervisor, wo.workstation].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

function materialTone(status: WorkOrder['materialStatus']): string {
  if (status === 'shortage') return 'text-rose-700'
  if (status === 'partial' || status === 'not_checked') return 'text-amber-700'
  if (status === 'available' || status === 'reserved') return 'text-emerald-700'
  return 'text-erp-muted'
}

function materialLabel(status: WorkOrder['materialStatus']): string {
  if (status === 'not_checked') return 'Not checked'
  return WO_MATERIAL_STATUS_LABELS[status]
}

interface LineRow {
  line: string
  current: WorkOrder | null
  next: WorkOrder | null
}

function buildLineRows(orders: WorkOrder[]): LineRow[] {
  const lines = new Map<string, WorkOrder[]>()
  for (const wo of orders) {
    const key = wo.workstation?.trim() || 'Unassigned'
    const list = lines.get(key) ?? []
    list.push(wo)
    lines.set(key, list)
  }

  const rank = (w: WorkOrder) => {
    if (w.status === 'in_progress') return 0
    if (w.status === 'on_hold') return 1
    if (w.status === 'draft') return 2
    if (w.qualityHold) return 3
    if (w.status === 'completed') return 4
    return 5
  }

  return [...lines.entries()]
    .map(([line, list]) => {
      const sorted = [...list].sort((a, b) => rank(a) - rank(b) || a.dueDate.localeCompare(b.dueDate))
      const current =
        sorted.find((w) => w.status === 'in_progress' || w.status === 'on_hold')
        ?? sorted.find((w) => w.status === 'draft')
        ?? null
      const next =
        sorted.find(
          (w) =>
            w.id !== current?.id
            && (w.status === 'draft' || (w.status === 'in_progress' && current?.status === 'on_hold')),
        ) ?? null
      return { line, current, next }
    })
    .sort((a, b) => a.line.localeCompare(b.line))
}

export function ShopfloorViewPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [tab, setTab] = useState<ViewTab>('live')
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [dashboard, setDashboard] = useState<ManufacturingControlDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [plantFilter, setPlantFilter] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [mobileLane, setMobileLane] = useState<LaneId>('running')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    try {
      const [list, dash] = await Promise.all([
        getWorkOrders({ search, status: '' as WorkOrderStatus | '' }),
        getManufacturingControlDashboard(),
      ])
      if (signal?.cancelled) return
      setRows(list.filter((w) => w.status !== 'cancelled'))
      setDashboard(dash)
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const plants = useMemo(() => [...new Set(rows.map((r) => r.plantName))].sort(), [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (plantFilter && r.plantName !== plantFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const blob = `${r.woNumber} ${r.finishedItemCode} ${r.finishedItemName} ${r.customerName ?? ''} ${r.workstation ?? ''} ${r.supervisor ?? ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [rows, plantFilter, search])

  const byLane = useMemo(() => {
    const map: Record<LaneId, WorkOrder[]> = { ready: [], running: [], hold: [], qc: [], done: [] }
    for (const wo of filtered) {
      const lane = laneFor(wo)
      if (!lane) continue
      map[lane].push(wo)
    }
    return map
  }, [filtered])

  const lineRows = useMemo(() => buildLineRows(filtered.filter((w) => w.status !== 'closed')), [filtered])

  const summary = useMemo(() => {
    const active = filtered.filter((w) => w.status !== 'closed')
    const today = dashboard?.asOfDate ?? new Date().toISOString().slice(0, 10)
    const plannedToday = active.filter(
      (w) => w.dueDate === today || w.startDate === today || ['draft', 'in_progress', 'on_hold'].includes(w.status),
    )
    const kpi = (id: string) => dashboard?.kpis.find((k) => k.id === id)?.value
    const jwFromKpi = kpi('jw-pending')
    const jwPending =
      jwFromKpi !== undefined
        ? Number(jwFromKpi)
        : (
          (dashboard?.jobWork.materialSent ?? 0)
          + (dashboard?.jobWork.partiallyReceived ?? 0)
          + (dashboard?.jobWork.pendingReconciliation ?? 0)
        )
    return {
      plannedQty: Number(kpi('planned-today') ?? plannedToday.reduce((s, w) => s + w.plannedQty, 0)),
      goodQty: Number(kpi('good-today') ?? active.reduce((s, w) => s + w.producedQty, 0)),
      scrapQty: active.reduce((s, w) => s + w.scrapQty, 0),
      reworkQty: active.reduce((s, w) => s + w.reworkQty, 0),
      rejectedQty: active.reduce((s, w) => s + w.rejectedQty, 0),
      qcPendingQty: Number(
        kpi('qc-pending')
        ?? active.filter((w) => w.qualityHold).reduce((s, w) => s + Math.max(0, w.producedQty - w.rejectedQty), 0),
      ),
      delayedWos: Number(
        kpi('delayed')
        ?? active.filter((w) => w.dueDate < today && !['completed', 'closed'].includes(w.status)).length,
      ),
      jobWorkPending: jwPending,
    }
  }, [filtered, dashboard])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    return [
      {
        id: 'ready',
        label: 'Ready',
        value: byLane.ready.length,
        accent: 'slate',
        active: tab === 'live' && mobileLane === 'ready',
        onClick: () => {
          setTab('live')
          setMobileLane('ready')
        },
      },
      {
        id: 'running',
        label: 'Running',
        value: byLane.running.length,
        accent: 'blue',
        active: tab === 'live' && mobileLane === 'running',
        onClick: () => {
          setTab('live')
          setMobileLane('running')
        },
      },
      {
        id: 'hold',
        label: 'On Hold',
        value: byLane.hold.length,
        accent: 'amber',
        active: tab === 'live' && mobileLane === 'hold',
        onClick: () => {
          setTab('live')
          setMobileLane('hold')
        },
      },
      {
        id: 'qc',
        label: 'QC',
        value: byLane.qc.length,
        accent: 'slate',
        active: tab === 'live' && mobileLane === 'qc',
        onClick: () => {
          setTab('live')
          setMobileLane('qc')
        },
      },
      {
        id: 'delayed',
        label: 'Delayed',
        value: summary.delayedWos,
        accent: 'red',
      },
      {
        id: 'done',
        label: 'Done',
        value: byLane.done.length,
        accent: 'green',
        active: tab === 'live' && mobileLane === 'done',
        onClick: () => {
          setTab('live')
          setMobileLane('done')
        },
      },
    ]
  }, [byLane, mobileLane, summary.delayedWos, tab])

  const runAction = async (id: string, fn: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>, success: string) => {
    setBusyId(id)
    try {
      const r = await fn()
      if (!r.ok) {
        notify.error(r.error ?? 'Action failed')
        return
      }
      r.warnings?.forEach((w) => notify.warning(w))
      notify.success(success)
      setRefreshToken((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  const quickStart = (wo: WorkOrder) => {
    if (!perms.canStartWo) { notify.error('Permission denied'); return }
    void runAction(
      wo.id,
      () => startWorkOrderDemo({
        workOrderId: wo.id,
        startAt: new Date().toISOString(),
        supervisor: wo.supervisor || 'Shopfloor',
        shift: wo.shift || 'A',
        workstation: wo.workstation,
      }),
      'Production started',
    )
  }

  const quickHold = (id: string) => {
    if (!perms.canHoldWo) { notify.error('Permission denied'); return }
    void runAction(
      id,
      () => holdWorkOrderDemo({
        workOrderId: id,
        holdAt: new Date().toISOString(),
        reason: 'other',
        remarks: 'Held from shopfloor',
      }),
      'Work order on hold',
    )
  }

  const quickResume = (id: string) => {
    if (!perms.canResumeWo) { notify.error('Permission denied'); return }
    void runAction(
      id,
      () => resumeWorkOrderDemo({ workOrderId: id, resumeAt: new Date().toISOString(), resolutionNote: 'Resumed from shopfloor' }),
      'Production resumed',
    )
  }

  const quickComplete = (wo: WorkOrder) => {
    if (!perms.canCompleteProduction) { notify.error('Permission denied'); return }
    const remaining = Math.max(1, wo.remainingQty || wo.plannedQty - wo.producedQty)
    void runAction(
      wo.id,
      () => completeProductionQuantityDemo(wo.id, {
        goodQty: remaining,
        comment: 'Completed from shopfloor board',
      }),
      'Production completed',
    )
  }

  const quickSendQc = (id: string) => {
    if (!perms.canInspectQuality && !perms.canViewQuality) { notify.error('Permission denied'); return }
    void runAction(id, () => sendWorkOrderToQcDemo(id), 'Sent to QC')
  }

  const quickClose = (id: string) => {
    if (!perms.canCloseWo) { notify.error('Permission denied'); return }
    void runAction(id, () => closeWorkOrderDemo(id), 'Work order closed')
  }

  const openQcAction = (wo: WorkOrder) => {
    if (!perms.canInspectQuality) { notify.error('Permission denied'); return }
    navigate(`/manufacturing/work-orders/${wo.id}?action=quality`)
  }

  const renderCardActions = (wo: WorkOrder) => {
    const busy = busyId === wo.id
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {wo.status === 'draft' && perms.canStartWo ? (
          <MfgTouchBtn disabled={busy} variant="primary" onClick={() => quickStart(wo)}>
            <Play className="h-4 w-4" /> Start
          </MfgTouchBtn>
        ) : null}
        {wo.status === 'in_progress' && !wo.qualityHold && perms.canHoldWo ? (
          <MfgTouchBtn disabled={busy} variant="secondary" onClick={() => quickHold(wo.id)}>
            <PauseCircle className="h-4 w-4" /> Hold
          </MfgTouchBtn>
        ) : null}
        {wo.status === 'on_hold' && perms.canResumeWo ? (
          <MfgTouchBtn disabled={busy} variant="primary" onClick={() => quickResume(wo.id)}>
            <Play className="h-4 w-4" /> Resume
          </MfgTouchBtn>
        ) : null}
        {wo.status === 'in_progress' && !wo.qualityHold && perms.canCompleteProduction ? (
          <MfgTouchBtn disabled={busy} variant="primary" onClick={() => quickComplete(wo)}>
            <CheckCircle2 className="h-4 w-4" /> Complete
          </MfgTouchBtn>
        ) : null}
        {wo.qualityHold && perms.canInspectQuality ? (
          <MfgTouchBtn disabled={busy} variant="primary" onClick={() => openQcAction(wo)}>
            <ClipboardCheck className="h-4 w-4" /> QC Accept
          </MfgTouchBtn>
        ) : null}
        {['in_progress', 'completed'].includes(wo.status) && wo.producedQty > 0 && !wo.qualityHold && (perms.canInspectQuality || perms.canViewQuality) ? (
          <MfgTouchBtn disabled={busy} variant="secondary" onClick={() => quickSendQc(wo.id)}>
            <ClipboardCheck className="h-4 w-4" /> Send to QC
          </MfgTouchBtn>
        ) : null}
        {wo.status === 'completed' && !wo.qualityHold && perms.canCloseWo ? (
          <MfgTouchBtn disabled={busy} variant="secondary" onClick={() => quickClose(wo.id)}>
            <XCircle className="h-4 w-4" /> Close
          </MfgTouchBtn>
        ) : null}
      </div>
    )
  }

  const renderWoCard = (wo: WorkOrder) => (
    <article
      className={cn(
        'rounded-xl border border-erp-border bg-white p-3 shadow-sm sm:p-4',
        wo.dueDate === dashboard?.asOfDate && 'ring-1 ring-orange-200',
      )}
    >
      <button
        type="button"
        className="w-full text-left touch-manipulation"
        onClick={() => navigate(`/manufacturing/work-orders/${wo.id}`)}
        aria-label={`Open work order ${wo.woNumber}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-erp-primary sm:text-[14px]">{wo.woNumber}</p>
            <p className="text-[14px] font-medium text-erp-text sm:text-[12px]">{wo.finishedItemCode}</p>
            <p className="line-clamp-1 text-[12px] text-erp-muted sm:text-[11px]">{wo.finishedItemName}</p>
          </div>
          <ShopfloorStatusChip status={wo.status} />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] sm:mt-2 sm:gap-y-1 sm:text-[11px]">
          <div>
            <dt className="text-erp-muted">Current Op</dt>
            <dd className="font-semibold text-erp-text">{wo.currentOperationName || '—'}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Next Op</dt>
            <dd className="font-medium text-erp-text">{wo.nextOperationName || '—'}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Planned</dt>
            <dd className="font-semibold tabular-nums text-erp-text">{wo.plannedQty} {wo.uom}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Completed</dt>
            <dd className="font-semibold tabular-nums text-erp-text">{wo.producedQty} {wo.uom}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Pending</dt>
            <dd className="font-semibold tabular-nums text-erp-text">
              {Math.max(0, wo.remainingQty ?? wo.plannedQty - wo.producedQty)} {wo.uom}
            </dd>
          </div>
          <div>
            <dt className="text-erp-muted">Due</dt>
            <dd className="font-medium text-erp-text">{formatDate(wo.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Material</dt>
            <dd className={cn('font-medium', materialTone(wo.materialStatus))}>
              {materialLabel(wo.materialStatus)}
            </dd>
          </div>
          <div>
            <dt className="text-erp-muted">QC</dt>
            <dd className="font-medium text-erp-text">
              {wo.qualityHold ? 'Pending' : wo.qualityRequired ? 'Required' : 'N/A'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-erp-muted">Operator / Line</dt>
            <dd className="font-medium text-erp-text">{operatorLine(wo)}</dd>
          </div>
        </dl>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {wo.qualityRequired ? (
            <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
              QC Required
            </span>
          ) : null}
          {wo.qualityHold ? <ShopfloorStatusChip status="quality_hold" /> : null}
          {wo.materialStatus === 'shortage' ? <ShopfloorStatusChip status="shortage" /> : null}
          {wo.dueDate === dashboard?.asOfDate ? <ShopfloorStatusChip status="due_today" /> : null}
        </div>
      </button>
      {renderCardActions(wo)}
    </article>
  )

  if (!perms.canViewWo) {
    return (
      <ProductionPageHeader title="Shopfloor" favoritePath="/manufacturing/shopfloor">
        <ProductionEmptyState
          icon={Wrench}
          title="Access denied"
          description="You do not have permission to view the shopfloor."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Shopfloor View"
      description="What is happening now — live Work Orders by status and line. Open a WO to execute."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Shopfloor View' },
      ]}
      favoritePath="/manufacturing/shopfloor"
      primaryAction={
        perms.canCreateWo
          ? { id: 'new', label: 'New Work Order', icon: Plus, onClick: () => navigate('/manufacturing/work-orders/new') }
          : undefined
      }
      secondaryActions={[
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) },
        { id: 'list', label: 'WO Register', onClick: () => navigate('/manufacturing/work-orders') },
      ]}
      kpiStrip={loading ? undefined : kpiStrip}
      filterBar={
        <div className="flex flex-wrap items-end gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search WO / item / line / operator…"
            className="min-w-[200px] max-w-md flex-1"
            aria-label="Search shopfloor"
          />
          <label className="text-[11px] font-medium text-erp-muted">
            Plant
            <Select
              native
              className="mt-0.5 block h-9 min-w-[160px]"
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              aria-label="Filter by plant"
            >
              <option value="">All plants</option>
              {plants.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </label>
        </div>
      }
    >
      <div className="space-y-3">
        <div
          role="tablist"
          aria-label="Shopfloor views"
          className="flex flex-wrap gap-1 rounded-lg border border-erp-border bg-white p-1"
        >
          {VIEW_TABS.map(({ id, label, icon: Icon }) => {
            const selected = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-semibold transition sm:flex-none',
                  selected
                    ? 'bg-erp-primary text-white'
                    : 'text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text',
                )}
                onClick={() => setTab(id)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>

        {loading ? <LoadingState variant="card" rows={4} /> : null}

        {!loading && tab === 'live' ? (
          <>
            {/* Phone / tablet: one lane at a time */}
            <div className="space-y-3 xl:hidden">
              <div
                role="tablist"
                aria-label="Shopfloor lanes"
                className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {LANES.map((lane) => {
                  const selected = mobileLane === lane.id
                  const count = byLane[lane.id].length
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={`${lane.title}, ${count} work orders`}
                      onClick={() => setMobileLane(lane.id)}
                      className={cn(
                        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-4 text-[13px] font-semibold touch-manipulation',
                        selected
                          ? 'bg-erp-primary text-white'
                          : 'bg-white text-erp-text ring-1 ring-erp-border',
                      )}
                    >
                      {lane.title}
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                          selected ? 'bg-white/20' : 'bg-slate-100',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
              <ul className="flex flex-col gap-3">
                {byLane[mobileLane].length === 0 ? (
                  <li className="rounded-xl border border-dashed border-erp-border bg-white px-4 py-10 text-center text-[14px] text-erp-muted">
                    No work orders in {LANES.find((l) => l.id === mobileLane)?.title}
                  </li>
                ) : (
                  byLane[mobileLane].map((wo) => (
                    <li key={wo.id}>{renderWoCard(wo)}</li>
                  ))
                )}
              </ul>
            </div>

            {/* Desktop: multi-lane board */}
            <div className="hidden gap-3 xl:grid xl:grid-cols-5">
              {LANES.map((lane) => (
                <section
                  key={lane.id}
                  className={cn('flex min-h-[300px] flex-col rounded-xl border border-erp-border border-t-4 bg-slate-50/80', lane.tone)}
                >
                  <header className="border-b border-erp-border/80 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-[13px] font-semibold text-erp-text">{lane.title}</h2>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-erp-border">
                        {byLane[lane.id].length}
                      </span>
                    </div>
                    <p className="text-[11px] text-erp-muted">{lane.hint}</p>
                  </header>
                  <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                    {byLane[lane.id].length === 0 ? (
                      <li className="rounded-lg border border-dashed border-erp-border bg-white/60 px-3 py-6 text-center text-[12px] text-erp-muted">
                        None
                      </li>
                    ) : null}
                    {byLane[lane.id].map((wo) => (
                      <li key={wo.id}>{renderWoCard(wo)}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        ) : null}

        {!loading && tab === 'line' ? (
          <>
            {/* Mobile / tablet: card per line */}
            <ul className="grid gap-3 md:hidden">
              {lineRows.length === 0 ? (
                <li className="rounded-xl border border-dashed border-erp-border bg-white px-4 py-10 text-center text-[14px] text-erp-muted">
                  No lines in view
                </li>
              ) : (
                lineRows.map(({ line, current, next }) => (
                  <li key={line} className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[16px] font-semibold text-erp-text">{line}</h3>
                      {current ? (
                        <ShopfloorStatusChip status={current.qualityHold ? 'quality_hold' : current.status} />
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-erp-muted">Idle</span>
                      )}
                    </div>
                    {current ? (
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg bg-slate-50 p-3 text-left touch-manipulation"
                        onClick={() => navigate(`/manufacturing/work-orders/${current.id}`)}
                      >
                        <p className="text-[15px] font-semibold text-erp-primary">{current.woNumber}</p>
                        <p className="text-[13px] font-medium text-erp-text">{current.finishedItemCode}</p>
                        <p className="line-clamp-1 text-[12px] text-erp-muted">{current.finishedItemName}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                          <div>
                            <dt className="text-erp-muted">Operator</dt>
                            <dd className="font-medium">{current.supervisor || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-erp-muted">Qty</dt>
                            <dd className="font-medium tabular-nums">{current.producedQty} / {current.plannedQty}</dd>
                          </div>
                          {current.status === 'on_hold' && current.holdReason ? (
                            <div className="col-span-2">
                              <dt className="text-erp-muted">Hold reason</dt>
                              <dd className="font-medium">{HOLD_REASON_LABELS[current.holdReason]}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </button>
                    ) : (
                      <p className="mt-3 text-[13px] text-erp-muted">No current work order</p>
                    )}
                    {current ? renderCardActions(current) : null}
                    {next ? (
                      <button
                        type="button"
                        className="mt-3 text-[13px] font-semibold text-erp-primary touch-manipulation"
                        onClick={() => navigate(`/manufacturing/work-orders/${next.id}`)}
                      >
                        Next: {next.woNumber}
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border border-erp-border bg-white md:block">
              <div className="overflow-x-auto">
                <table className="erp-table min-w-full text-left text-[13px]">
                  <thead>
                    <tr>
                      <th>Machine / Line</th>
                      <th>Current WO</th>
                      <th>Item</th>
                      <th>Current Op</th>
                      <th>Next Op</th>
                      <th>Operator</th>
                      <th>Status</th>
                      <th className="tabular-nums">Planned Qty</th>
                      <th className="tabular-nums">Completed Qty</th>
                      <th>Next WO</th>
                      <th>Hold Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-10 text-center text-erp-muted">No lines in view</td>
                      </tr>
                    ) : null}
                    {lineRows.map(({ line, current, next }) => (
                      <tr key={line} className="border-t border-erp-border/80 hover:bg-slate-50/80">
                        <td className="px-3 py-3 font-semibold text-erp-text">{line}</td>
                        <td className="px-3 py-3">
                          {current ? (
                            <button
                              type="button"
                              className="font-semibold text-erp-primary hover:underline"
                              onClick={() => navigate(`/manufacturing/work-orders/${current.id}`)}
                            >
                              {current.woNumber}
                            </button>
                          ) : (
                            <span className="text-erp-muted">Idle</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {current ? (
                            <div>
                              <p className="font-medium text-erp-text">{current.finishedItemCode}</p>
                              <p className="line-clamp-1 text-[11px] text-erp-muted">{current.finishedItemName}</p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-erp-text">{current?.currentOperationName || '—'}</td>
                        <td className="px-3 py-3 text-erp-muted">{current?.nextOperationName || '—'}</td>
                        <td className="px-3 py-3 text-erp-text">{current?.supervisor || '—'}</td>
                        <td className="px-3 py-3">
                          {current ? <ShopfloorStatusChip status={current.qualityHold ? 'quality_hold' : current.status} /> : '—'}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{current?.plannedQty ?? '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{current?.producedQty ?? '—'}</td>
                        <td className="px-3 py-3">
                          {next ? (
                            <button
                              type="button"
                              className="text-erp-primary hover:underline"
                              onClick={() => navigate(`/manufacturing/work-orders/${next.id}`)}
                            >
                              {next.woNumber}
                            </button>
                          ) : (
                            <span className="text-erp-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-erp-muted">
                          {current?.status === 'on_hold' && current.holdReason
                            ? HOLD_REASON_LABELS[current.holdReason]
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {!loading && tab === 'summary' ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Today Planned Qty', value: summary.plannedQty },
              { label: 'Today Good Qty', value: summary.goodQty },
              { label: 'Scrap Qty', value: summary.scrapQty },
              { label: 'Rework Qty', value: summary.reworkQty },
              { label: 'Rejected Qty', value: summary.rejectedQty },
              { label: 'QC Pending Qty', value: summary.qcPendingQty },
              { label: 'Delayed WOs', value: summary.delayedWos },
              { label: 'Job Work Pending', value: summary.jobWorkPending },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-erp-border bg-white px-3 py-3"
              >
                <p className="text-[11px] font-medium text-erp-muted">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-erp-text">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-[11px] text-erp-muted">
          Tip: Keep execution on the Work Order — this board is for live status, not a full MES. Demo actions update the local store only.
        </p>
      </div>
    </ProductionPageHeader>
  )
}
