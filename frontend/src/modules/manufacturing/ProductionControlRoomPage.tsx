import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingDemoBanner, ShopfloorStatusChip } from '@/components/manufacturing'
import {
  getManufacturingControlDashboard,
  updateProductionQualityResultDemo,
} from '@/services/manufacturing'
import type { ManufacturingControlDashboard, ManufacturingPlanRow } from '@/types/manufacturing'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { isApiMode } from '@/config/apiConfig'
import { cn } from '@/utils/cn'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { ProductionEmptyState, ProductionPageHeader } from './ui'
import { ApiProductionControlRoomView } from './ApiProductionControlRoomView'

type LoadState = 'loading' | 'ready' | 'error'

function PanelHeader({
  title,
  count,
  to,
  linkLabel,
}: {
  title: string
  count: number
  to: string
  linkLabel: string
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-erp-border px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.04em] text-erp-muted">
          {title}
        </h2>
        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-erp-text ring-1 ring-erp-border">
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
            className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-erp-surface-alt/40"
            onClick={() => navigate(row.href)}
            aria-label={`Open work order ${row.woNumber}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[13px] font-semibold text-erp-primary">{row.woNumber}</span>
              <span className="text-[11px] text-erp-muted">Due {formatDate(row.dueDate)}</span>
            </div>
            <p className="truncate text-[13px] font-medium text-erp-text">
              {row.finishedItemCode}
              <span className="font-normal text-erp-muted"> — {row.finishedItemName}</span>
            </p>
            <div className="flex flex-wrap gap-3 text-[11px] text-erp-muted">
              <span className="tabular-nums">Qty {row.plannedQty}</span>
              <ShopfloorStatusChip status={row.status as never} />
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
  if (isApiMode()) return <ApiProductionControlRoomView />
  return <DemoProductionControlRoomPage />
}

function DemoProductionControlRoomPage() {
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
    return () => {
      signal.cancelled = true
    }
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

  const jwPending = data
    ? data.jobWork.materialSent + data.jobWork.partiallyReceived + data.jobWork.pendingReconciliation
    : 0

  const kpiStrip: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    return [
      { id: 'plan', label: "Today's Plan", value: String(data.todaysPlan.length) },
      { id: 'running', label: 'Running', value: String(data.runningOrders.length) },
      { id: 'shortage', label: 'Material Shortage', value: String(data.materialRisks.length) },
      { id: 'qc', label: 'QC Pending', value: String(data.qcAttention.length) },
      { id: 'delayed', label: 'Delayed', value: String(data.delayedOrders.length) },
      { id: 'jw', label: 'Job Work Pending', value: String(jwPending) },
    ]
  }, [data, jwPending])

  if (!perms.canViewDashboard) {
    return (
      <ProductionPageHeader title="Production Control Room" favoritePath="/manufacturing/control-room">
        <ProductionEmptyState
          icon={LayoutGrid}
          title="Access denied"
          description="You do not have permission to view the Production Control Room."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Production Control Room"
      favoritePath="/manufacturing/control-room"
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
      kpiStrip={loadState === 'ready' ? kpiStrip : undefined}
    >
      <div className="space-y-3">
        <ManufacturingDemoBanner
          showCommandMap
          message="Control Room is the owner/manager attention board. Execute production on the Work Order — not here."
        />

        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        {loadState === 'error' ? (
          <p className="text-sm text-red-600">Unable to load Production Control Room.</p>
        ) : null}

        {loadState === 'ready' && data ? (
          <div className="grid gap-4 lg:grid-cols-2">
              <section id="todays-plan" className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <PanelHeader title="Today's Plan" count={data.todaysPlan.length} to="/manufacturing/work-orders" linkLabel="All WOs" />
                <WoList rows={data.todaysPlan} empty="No work orders planned for today." showMaterial />
              </section>

              <section id="running" className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <PanelHeader title="Running WOs" count={data.runningOrders.length} to="/manufacturing/shopfloor" linkLabel="Shopfloor" />
                <div className="flex items-center gap-2 border-b border-erp-border/60 bg-emerald-50/40 px-4 py-1.5 text-[11px] text-emerald-900">
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  In progress — open WO to hold, complete, or QC.
                </div>
                <WoList rows={data.runningOrders} empty="No work orders running." />
              </section>

              <section id="shortage" className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <PanelHeader
                  title="Material Shortage"
                  count={data.materialRisks.length}
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
                          className="flex w-full flex-col gap-1 px-4 py-2.5 text-left hover:bg-erp-surface-alt/40"
                          onClick={() => navigate(row.href)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[13px] font-semibold">{row.itemCode}</p>
                              <p className="text-[11px] text-erp-muted">{row.itemName}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-rose-200">
                              <AlertTriangle className="h-3 w-3" /> Short {row.shortageQty}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[11px] text-erp-muted">
                            <span>Req {row.requiredQty}</span>
                            <span>Avail {row.availableQty}</span>
                            <span className="font-mono text-erp-primary">{row.workOrderNo}</span>
                          </div>
                          <p className="text-[12px] font-medium text-amber-900">{row.suggestedAction}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section id="qc" className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <PanelHeader title="QC Pending" count={data.qcAttention.length} to="/manufacturing/work-orders" linkLabel="Work Orders" />
                {data.qcAttention.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-erp-muted">No QC backlog.</p>
                ) : (
                  <ul className="divide-y divide-erp-border">
                    {data.qcAttention.map((row) => (
                      <li key={row.id} className="px-4 py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => navigate(row.href)}
                            aria-label={`Open work order ${row.woNumber} for QC`}
                          >
                            <p className="font-mono text-[13px] font-semibold text-erp-primary">{row.woNumber}</p>
                            <p className="text-[12px] text-erp-text">{row.finishedItem}</p>
                            <p className="text-[11px] text-erp-muted">Pending qty {row.pendingQty}</p>
                          </button>
                          {perms.canInspectQuality || perms.canViewQuality ? (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={busyQc === row.workOrderId || !perms.canInspectQuality}
                                className="erp-btn erp-btn-primary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                                aria-label={`Accept QC for ${row.woNumber}`}
                                onClick={() => void runQc(row.workOrderId, 'accepted')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Accept
                              </button>
                              <button
                                type="button"
                                disabled={busyQc === row.workOrderId || !perms.canInspectQuality}
                                className="erp-btn erp-btn-secondary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                                aria-label={`Reject QC for ${row.woNumber}`}
                                onClick={() => void runQc(row.workOrderId, 'rejected')}
                              >
                                <XCircle className="h-3.5 w-3.5" aria-hidden /> Reject
                              </button>
                              <button
                                type="button"
                                disabled={busyQc === row.workOrderId || !perms.canInspectQuality}
                                className="erp-btn erp-btn-secondary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                                aria-label={`Raise rework for ${row.woNumber}`}
                                onClick={() => void runQc(row.workOrderId, 'rework')}
                              >
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Rework
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section id="delayed" className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <PanelHeader title="Delayed WOs" count={data.delayedOrders.length} to="/manufacturing/work-orders" linkLabel="Work Orders" />
                <div className="flex items-center gap-2 border-b border-erp-border/60 bg-rose-50/40 px-4 py-1.5 text-[11px] text-rose-900">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Past due and still open — prioritize on the Work Order.
                </div>
                <WoList rows={data.delayedOrders} empty="No delayed work orders." showMaterial />
              </section>

              <section id="job-work" className="overflow-hidden rounded-lg border border-erp-border bg-white shadow-sm">
                <PanelHeader title="Job Work Pending" count={jwPending} to="/manufacturing/job-work" linkLabel="Job Work" />
                <div className="grid gap-2 border-b border-erp-border p-3 sm:grid-cols-3">
                  {[
                    { label: 'Material Sent', value: data.jobWork.materialSent, icon: Truck },
                    { label: 'Partially Received', value: data.jobWork.partiallyReceived, icon: Truck },
                    { label: 'Pending Reconciliation', value: data.jobWork.pendingReconciliation, icon: Truck },
                  ].map((c) => (
                    <div key={c.label} className="rounded-md border border-erp-border bg-slate-50/60 px-3 py-2.5 text-center">
                      <div className="text-[18px] font-semibold tabular-nums tracking-tight text-erp-text">{c.value}</div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{c.label}</div>
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
                          className="flex items-center justify-between gap-3 px-4 py-2 text-[12px] hover:bg-erp-surface-alt/40"
                        >
                          <span className="font-mono font-semibold text-erp-primary">{row.jwNumber}</span>
                          <span className="truncate text-erp-muted">{row.vendorName}</span>
                          <span className={cn('capitalize text-erp-text')}>{row.status}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
        ) : null}
      </div>
    </ProductionPageHeader>
  )
}
