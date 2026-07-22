import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  PauseCircle,
  Plus,
  RefreshCw,
  UserX,
} from 'lucide-react'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ErpButton } from '@/components/erp/ErpButton'
import { getTodayDashboard } from '@/services/api/manufacturingApi'
import type { ProductionOrder, TodayOverview } from '@/types/manufacturingProduction'
import type { ProductionAssignment, TodayIssueSummary } from '@/types/manufacturingPhase2b'
import { ISSUE_SEVERITY_LABELS } from '@/types/manufacturingPhase2b'
import { useSetupLookup } from '../setup/useSetupLookups'
import { useManufacturingWorkOrderPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  ProductionEmptyState,
  ProductionPageHeader,
  WorkOrderHealthBadge,
  WorkOrderStatusBadge,
} from '../ui'

function completionPct(wo: ProductionOrder): number {
  const n = Number(wo.completionPercent)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function primaryActionFor(wo: ProductionOrder): { label: string; path: string } {
  switch (wo.status) {
    case 'DRAFT':
      return { label: 'Release', path: `/manufacturing/work-orders/${wo.id}` }
    case 'READY':
      return { label: 'Start', path: `/manufacturing/work-orders/${wo.id}` }
    case 'ON_HOLD':
      return { label: 'Resume', path: `/manufacturing/work-orders/${wo.id}` }
    case 'IN_PROGRESS':
      return { label: 'Update', path: `/manufacturing/work-orders/${wo.id}` }
    default:
      return { label: 'Open', path: `/manufacturing/work-orders/${wo.id}` }
  }
}

function WorkOrderCard({
  wo,
  productLabel,
  onOpen,
}: {
  wo: ProductionOrder
  productLabel: string
  onOpen: (id: string) => void
}) {
  const action = primaryActionFor(wo)
  const pct = completionPct(wo)

  return (
    <li className="border-b border-erp-border last:border-b-0">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="min-w-0 flex-1 text-left hover:opacity-90"
          onClick={() => onOpen(wo.id)}
          aria-label={`Open work order ${wo.workOrderNo}`}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[13px] font-semibold text-erp-primary">{wo.workOrderNo}</span>
            <span className="truncate text-[13px] font-medium text-erp-text">{productLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-erp-muted">
            <span>Stage {wo.currentStageId ? 'in progress' : '—'}</span>
            <span className="tabular-nums">{pct}%</span>
            <span>Due {wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'}</span>
            <span>Sup. {wo.supervisorId ? `${wo.supervisorId.slice(0, 8)}…` : '—'}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <WorkOrderStatusBadge status={wo.status} />
            <WorkOrderHealthBadge health={wo.healthStatus} />
          </div>
        </button>
        <ErpButton
          variant="secondary"
          className="h-8 shrink-0 px-2.5 text-[12px]"
          onClick={() => onOpen(wo.id)}
        >
          {action.label}
        </ErpButton>
      </div>
    </li>
  )
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-erp-border px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-erp-text">{title}</h2>
        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-erp-muted ring-1 ring-erp-border">
          {count}
        </span>
      </header>
      {count === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-erp-muted">{empty}</p>
      ) : (
        <ul>{children}</ul>
      )}
    </section>
  )
}

/** Production Today — supervisor daily overview. */
export function TodayPage() {
  const navigate = useNavigate()
  const perms = useManufacturingWorkOrderPermissions()
  const { options: items } = useSetupLookup('items')
  const [data, setData] = useState<TodayOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const itemLabel = useCallback(
    (id: string) => items.find((i) => i.id === id)?.label ?? `${id.slice(0, 8)}…`,
    [items],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTodayDashboard()
      setData(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to load today's overview")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    if (!data) return []
    const ready = data.counts.unassignedReadyWork ?? 0
    return [
      {
        id: 'ready',
        label: 'Ready to Start',
        value: ready,
        accent: 'green',
        helper: data.counts.unassignedReadyWork != null ? 'Unassigned ready stages' : undefined,
      },
      { id: 'running', label: 'Running', value: data.counts.running, accent: 'blue' },
      { id: 'due', label: 'Due Today', value: data.counts.dueToday, accent: 'amber' },
      { id: 'delayed', label: 'Delayed', value: data.counts.delayed, accent: 'red' },
      { id: 'hold', label: 'On Hold', value: data.counts.onHold, accent: 'slate' },
      { id: 'done', label: 'Completed Today', value: data.counts.completedToday, accent: 'green' },
    ]
  }, [data])

  const needsAttentionOrders = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    const out: ProductionOrder[] = []
    for (const wo of [...data.delayed, ...data.onHold]) {
      if (seen.has(wo.id)) continue
      seen.add(wo.id)
      out.push(wo)
    }
    return out
  }, [data])

  if (!perms.canViewControlRoom) {
    return (
      <ProductionPageHeader title="Production Today" favoritePath="/manufacturing/today">
        <ProductionEmptyState
          icon={Clock}
          title="Access denied"
          description="Missing control room view permission."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Production Today"
      description="What needs attention now — running jobs, due dates, delays, and today's completions."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Today' },
      ]}
      favoritePath="/manufacturing/today"
      primaryAction={
        perms.canCreateWo
          ? {
              id: 'create-wo',
              label: 'Create Work Order',
              icon: Plus,
              onClick: () => navigate('/manufacturing/work-orders/new'),
            }
          : {
              id: 'work-orders',
              label: 'Work Orders',
              icon: Plus,
              onClick: () => navigate('/manufacturing/work-orders'),
            }
      }
      secondaryActions={[
        {
          id: 'daily-update',
          label: 'Record Daily Update',
          icon: ClipboardList,
          onClick: () => navigate('/manufacturing/daily-update'),
        },
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      kpiStrip={loading ? undefined : kpiStrip}
    >
      {loading ? <LoadingState variant="dashboard" rows={6} /> : null}

      {!loading && !data ? (
        <ProductionEmptyState
          icon={Clock}
          title="Could not load today"
          description="Refresh to try again, or open Work Orders."
          action={
            <ErpButton variant="secondary" onClick={() => void load()}>
              Refresh
            </ErpButton>
          }
        />
      ) : null}

      {!loading && data ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="Needs Attention"
              count={needsAttentionOrders.length + (data.openIssues?.length ?? 0)}
              empty="Nothing blocked or delayed right now."
            >
              {needsAttentionOrders.map((wo) => (
                <WorkOrderCard
                  key={wo.id}
                  wo={wo}
                  productLabel={itemLabel(wo.productItemId)}
                  onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                />
              ))}
              {(data.openIssues ?? []).map((issue: TodayIssueSummary) => (
                <li key={issue.id} className="border-b border-erp-border last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-erp-surface-alt/50"
                    onClick={() => navigate('/manufacturing/issues')}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-erp-text">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                      {issue.title}
                    </span>
                    <span className="text-[11px] text-erp-muted">
                      {issue.issueNumber} · {ISSUE_SEVERITY_LABELS[issue.severity]}
                      {issue.productionBlocked ? ' · Production blocked' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </Section>

            <Section title="Running Now" count={data.running.length} empty="No work orders in progress.">
              {data.running.map((wo) => (
                <WorkOrderCard
                  key={wo.id}
                  wo={wo}
                  productLabel={itemLabel(wo.productItemId)}
                  onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                />
              ))}
            </Section>

            <Section title="Due Today" count={data.dueToday.length} empty="Nothing due today.">
              {data.dueToday.map((wo) => (
                <WorkOrderCard
                  key={wo.id}
                  wo={wo}
                  productLabel={itemLabel(wo.productItemId)}
                  onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                />
              ))}
            </Section>

            <Section
              title="Recently Completed"
              count={data.completedToday.length}
              empty="Nothing completed yet today."
            >
              {data.completedToday.map((wo) => (
                <WorkOrderCard
                  key={wo.id}
                  wo={wo}
                  productLabel={itemLabel(wo.productItemId)}
                  onOpen={(id) => navigate(`/manufacturing/work-orders/${id}`)}
                />
              ))}
            </Section>
          </div>

          {(data.pausedTasks?.length ?? 0) > 0 ? (
            <section className="overflow-hidden rounded-lg border border-erp-border bg-white">
              <header className="flex items-center justify-between gap-2 border-b border-erp-border px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-erp-text">
                  <PauseCircle className="h-4 w-4 text-amber-600" aria-hidden />
                  Paused Tasks
                </h2>
                <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-erp-muted ring-1 ring-erp-border">
                  {data.pausedTasks?.length ?? 0}
                </span>
              </header>
              <ul className="divide-y divide-erp-border">
                {(data.pausedTasks ?? []).map((task: ProductionAssignment) => (
                  <li key={task.id} className="px-4 py-3 text-[13px]">
                    <p className="font-semibold text-erp-text">
                      {task.productionOrder?.orderNumber ?? task.productionOrderId.slice(0, 8)} ·{' '}
                      {task.stage?.name ?? 'Stage'}
                    </p>
                    <p className="text-[11px] text-erp-muted">
                      {task.machine?.name ?? 'No machine'} · Qty {task.assignedQuantity}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.counts.unassignedReadyWork != null && data.counts.unassignedReadyWork > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-erp-border bg-erp-surface-alt/40 px-4 py-3 text-[13px] text-erp-text">
              <UserX className="h-4 w-4 shrink-0 text-erp-muted" aria-hidden />
              <span>
                <strong className="tabular-nums">{data.counts.unassignedReadyWork}</strong> ready
                stage(s) have no active assignment.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </ProductionPageHeader>
  )
}
