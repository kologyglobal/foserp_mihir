import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Play,
  RefreshCw,
  RotateCcw,
  Truck,
  Wrench,
  XCircle,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAiRail,
  ManufacturingDemoBanner,
} from '@/components/manufacturing'
import {
  getManufacturingControlDashboard,
  updateProductionQualityResultDemo,
} from '@/services/manufacturing'
import type { ManufacturingControlDashboard, ManufacturingPlanRow } from '@/types/manufacturing'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error'

function PanelHeader({
  title,
  count,
  tone,
  to,
  linkLabel,
}: {
  title: string
  count: number
  tone: string
  to: string
  linkLabel: string
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-erp-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-[14px] font-semibold text-erp-text">{title}</h2>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1', tone)}>
          {count}
        </span>
      </div>
      <Link to={to} className="shrink-0 text-[12px] font-semibold text-erp-primary hover:underline">
        {linkLabel}
      </Link>
    </header>
  )
}

function WoList({
  rows,
  empty,
  showMaterial,
}: {
  rows: ManufacturingPlanRow[]
  empty: string
  showMaterial?: boolean
}) {
  const navigate = useNavigate()
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-erp-muted">{empty}</p>
  }
  return (
    <ul className="divide-y divide-erp-border">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-erp-surface-alt/50"
            onClick={() => navigate(row.href)}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-erp-primary">{row.woNumber}</span>
              <span className="text-[11px] text-erp-muted">Due {formatDate(row.dueDate)}</span>
            </div>
            <p className="text-[13px] font-medium text-erp-text">
              {row.finishedItemCode}
              <span className="font-normal text-erp-muted"> — {row.finishedItemName}</span>
            </p>
            <div className="flex flex-wrap gap-3 text-[11px] text-erp-muted">
              <span>Planned {row.plannedQty}</span>
              <span>{row.status}</span>
              {showMaterial ? <span>{row.materialStatus}</span> : null}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Owner / manager view — attention panels only, WO still opens for execution. */
export function ProductionControlRoomPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<ManufacturingControlDashboard | null>(null)
  const [busyQc, setBusyQc] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const dash = await getManufacturingControlDashboard()
      if (signal?.cancelled) return
      setData(dash)
      setLoadState('ready')
    } catch {
      if (!signal?.cancelled) setLoadState('error')
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const runQc = async (workOrderId: string, result: 'accepted' | 'rejected' | 'rework') => {
    if (!perms.canInspectQuality && !perms.canViewQuality) {
      notify.error('Permission denied')
      return
    }
    setBusyQc(workOrderId)
    try {
      const r = await updateProductionQualityResultDemo(workOrderId, {
        result,
        acceptedQty: result === 'accepted' ? undefined : 0,
        rejectedQty: result === 'rejected' ? 1 : 0,
        reworkQty: result === 'rework' ? 1 : 0,
        inspector: 'Control Room',
      })
      if (!r.ok) {
        notify.error(r.error ?? 'QC update failed')
        return
      }
      notify.success(
        result === 'accepted' ? 'QC accepted (demo)' : result === 'rejected' ? 'QC rejected (demo)' : 'Rework raised (demo)',
      )
      setRefreshToken((n) => n + 1)
    } finally {
      setBusyQc(null)
    }
  }

  if (!perms.canViewDashboard) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Manufacturing" title="Production Control Room">
        <p className="text-sm text-erp-muted">You do not have permission to view the Production Control Room.</p>
      </OperationalPageShell>
    )
  }

  const jwPending = data
    ? data.jobWork.materialSent + data.jobWork.partiallyReceived + data.jobWork.pendingReconciliation
    : 0

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Production Control Room"
      description="Owner / manager view — today's plan, running WOs, shortages, QC, delays, and job work in one place."
      breadcrumbs={[
        { label: 'Manufacturing', to: '/manufacturing/control-room' },
        { label: 'Control Room' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/control-room"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'work-orders',
            label: 'Work Orders',
            icon: Wrench,
            onClick: () => navigate('/manufacturing/work-orders'),
          }}
          secondaryActions={[
            { id: 'shopfloor', label: 'Shopfloor', icon: LayoutGrid, onClick: () => navigate('/manufacturing/shopfloor') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) },
          ]}
        />
      )}
    >
      <div className="space-y-4 p-1 sm:p-0">
        <ManufacturingDemoBanner
          showCommandMap
          message="Control Room is the owner/manager attention board. Execute production on the Work Order — not here."
        />

        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        {loadState === 'error' ? (
          <p className="text-sm text-red-600">Unable to load Production Control Room.</p>
        ) : null}

        {loadState === 'ready' && data ? (
          <ManufacturingAiRail title="Control Room Insights" suggestions={data.aiInsights}>
            {/* Summary chips */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "Today's Plan", value: data.todaysPlan.length, tone: 'border-sky-200 bg-sky-50/70', href: '#todays-plan' },
                { label: 'Running WOs', value: data.runningOrders.length, tone: 'border-emerald-200 bg-emerald-50/70', href: '#running' },
                { label: 'Material Shortage', value: data.materialRisks.length, tone: 'border-amber-200 bg-amber-50/70', href: '#shortage' },
                { label: 'QC Pending', value: data.qcAttention.length, tone: 'border-violet-200 bg-violet-50/70', href: '#qc' },
                { label: 'Delayed WOs', value: data.delayedOrders.length, tone: 'border-rose-200 bg-rose-50/70', href: '#delayed' },
                { label: 'Job Work Pending', value: jwPending, tone: 'border-slate-200 bg-white', href: '#job-work' },
              ].map((chip) => (
                <a
                  key={chip.label}
                  href={chip.href}
                  className={cn('rounded-xl border px-3 py-3 text-left shadow-sm transition hover:shadow-md', chip.tone)}
                >
                  <p className="text-[11px] font-medium text-erp-muted">{chip.label}</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-erp-text">{chip.value}</p>
                </a>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* 1. Today's Plan */}
              <section id="todays-plan" className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="Today's Plan"
                  count={data.todaysPlan.length}
                  tone="bg-sky-50 text-sky-900 ring-sky-200"
                  to="/manufacturing/work-orders"
                  linkLabel="All WOs"
                />
                <WoList rows={data.todaysPlan} empty="No work orders planned for today." showMaterial />
              </section>

              {/* 2. Running WOs */}
              <section id="running" className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="Running WOs"
                  count={data.runningOrders.length}
                  tone="bg-emerald-50 text-emerald-900 ring-emerald-200"
                  to="/manufacturing/shopfloor"
                  linkLabel="Shopfloor"
                />
                <div className="flex items-center gap-2 border-b border-erp-border/60 bg-emerald-50/40 px-4 py-2 text-[12px] text-emerald-900">
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  In progress on the floor — open WO to hold, complete, or QC.
                </div>
                <WoList rows={data.runningOrders} empty="No work orders running." />
              </section>

              {/* 3. Material Shortage */}
              <section id="shortage" className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="Material Shortage"
                  count={data.materialRisks.length}
                  tone="bg-amber-50 text-amber-900 ring-amber-200"
                  to="/manufacturing/work-orders"
                  linkLabel="Work Orders"
                />
                {data.materialRisks.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-erp-muted">No shortages right now.</p>
                ) : (
                  <ul className="divide-y divide-erp-border">
                    {data.materialRisks.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-erp-surface-alt/50"
                          onClick={() => navigate(row.href)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[13px] font-semibold">{row.itemCode}</p>
                              <p className="text-[11px] text-erp-muted">{row.itemName}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-rose-200">
                              <AlertTriangle className="h-3 w-3" /> Short {row.shortageQty}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[11px] text-erp-muted">
                            <span>Req {row.requiredQty}</span>
                            <span>Avail {row.availableQty}</span>
                            <span className="text-erp-primary">{row.workOrderNo}</span>
                          </div>
                          <p className="text-[12px] font-medium text-amber-900">{row.suggestedAction}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 4. QC Pending */}
              <section id="qc" className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="QC Pending"
                  count={data.qcAttention.length}
                  tone="bg-violet-50 text-violet-900 ring-violet-200"
                  to="/manufacturing/work-orders"
                  linkLabel="Work Orders"
                />
                {data.qcAttention.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-erp-muted">No QC backlog.</p>
                ) : (
                  <ul className="divide-y divide-erp-border">
                    {data.qcAttention.map((row) => (
                      <li key={row.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button type="button" className="text-left" onClick={() => navigate(row.href)}>
                            <p className="text-[13px] font-semibold text-erp-primary">{row.woNumber}</p>
                            <p className="text-[12px] text-erp-text">{row.finishedItem}</p>
                            <p className="text-[11px] text-erp-muted">Pending qty {row.pendingQty}</p>
                          </button>
                          {(perms.canInspectQuality || perms.canViewQuality) ? (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={busyQc === row.workOrderId || !perms.canInspectQuality}
                                className="erp-btn erp-btn-primary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                                onClick={() => void runQc(row.workOrderId, 'accepted')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                              </button>
                              <button
                                type="button"
                                disabled={busyQc === row.workOrderId || !perms.canInspectQuality}
                                className="erp-btn erp-btn-secondary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                                onClick={() => void runQc(row.workOrderId, 'rejected')}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                              <button
                                type="button"
                                disabled={busyQc === row.workOrderId || !perms.canInspectQuality}
                                className="erp-btn erp-btn-secondary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                                onClick={() => void runQc(row.workOrderId, 'rework')}
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Rework
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 5. Delayed WOs */}
              <section id="delayed" className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="Delayed WOs"
                  count={data.delayedOrders.length}
                  tone="bg-rose-50 text-rose-900 ring-rose-200"
                  to="/manufacturing/work-orders"
                  linkLabel="Work Orders"
                />
                <div className="flex items-center gap-2 border-b border-erp-border/60 bg-rose-50/40 px-4 py-2 text-[12px] text-rose-900">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Past due and still open — prioritize Start / Complete / Close on the Work Order.
                </div>
                <WoList rows={data.delayedOrders} empty="No delayed work orders." showMaterial />
              </section>

              {/* 6. Job Work Pending */}
              <section id="job-work" className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="Job Work Pending"
                  count={jwPending}
                  tone="bg-slate-100 text-slate-800 ring-slate-200"
                  to="/manufacturing/job-work"
                  linkLabel="Job Work"
                />
                <div className="grid gap-2 border-b border-erp-border p-4 sm:grid-cols-3">
                  {[
                    { label: 'Material Sent', value: data.jobWork.materialSent, icon: Truck },
                    { label: 'Partially Received', value: data.jobWork.partiallyReceived, icon: Truck },
                    { label: 'Pending Reconciliation', value: data.jobWork.pendingReconciliation, icon: Truck },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg bg-slate-50 px-3 py-2.5 text-center ring-1 ring-erp-border">
                      <div className="text-[20px] font-bold tabular-nums">{c.value}</div>
                      <div className="text-[11px] font-semibold text-erp-muted">{c.label}</div>
                    </div>
                  ))}
                </div>
                {data.jobWork.rows.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-erp-muted">No pending job work.</p>
                ) : (
                  <ul className="divide-y divide-erp-border">
                    {data.jobWork.rows.map((row) => (
                      <li key={row.id}>
                        <Link
                          to={row.href}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] hover:bg-erp-surface-alt/50"
                        >
                          <span className="font-semibold text-erp-primary">{row.jwNumber}</span>
                          <span className="text-erp-muted">{row.vendorName}</span>
                          <span className="capitalize text-erp-text">{row.status}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </ManufacturingAiRail>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
