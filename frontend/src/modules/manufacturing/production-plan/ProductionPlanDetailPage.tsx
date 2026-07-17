import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, RefreshCw, Wrench } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ManufacturingAiAssist, ManufacturingDemoBanner } from '@/components/manufacturing'
import {
  createWorkOrderDraftFromPlanDemo,
  generateWorkOrdersFromPlan,
  getProductionPlanAiSuggestions,
  getProductionPlanById,
  markProductionPlanPlanned,
} from '@/services/manufacturing'
import type { ProductionPlan } from '@/types/manufacturing'
import {
  BOM_READINESS_LABELS,
  MATERIAL_STATUS_LABELS,
  PRODUCTION_PLAN_SOURCE_LABELS,
  PRODUCTION_PLAN_STATUS_LABELS,
} from '@/types/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{children}</dd>
    </div>
  )
}

export function ProductionPlanDetailPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [plan, setPlan] = useState<ProductionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyLine, setBusyLine] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!planId) return
    setLoading(true)
    const row = await getProductionPlanById(planId)
    if (!row) {
      notify.error('Plan not found')
      navigate('/manufacturing/production-plan')
      return
    }
    setPlan(row)
    setLoading(false)
  }, [planId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const aiSuggestions = useMemo(
    () => (plan ? getProductionPlanAiSuggestions(plan) : []),
    [plan],
  )

  const generateAll = async () => {
    if (!plan || !perms.canCreateWoFromPlan) {
      notify.error('Permission denied')
      return
    }
    setBusy(true)
    try {
      const r = await generateWorkOrdersFromPlan(plan.id)
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success(`Created ${r.created.length} draft work order(s)`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const createOne = async (lineId: string) => {
    if (!perms.canCreateWoFromPlan) {
      notify.error('Permission denied')
      return
    }
    setBusyLine(lineId)
    try {
      const r = await createWorkOrderDraftFromPlanDemo(lineId)
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success(`Draft ${r.workOrderNo} created`)
      await load()
    } finally {
      setBusyLine(null)
    }
  }

  const markPlanned = async () => {
    if (!plan) return
    setBusy(true)
    try {
      const r = await markProductionPlanPlanned(plan.id)
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success('Plan marked as Planned')
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewPlan) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="Production Plan"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Production Plan', to: '/manufacturing/production-plan' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ClipboardList} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading || !plan) return <LoadingState variant="card" />

  const lines = plan.lines.filter((l) => !l.ignored)
  const canGenerate = plan.status !== 'closed' && plan.status !== 'cancelled'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={plan.planNo}
      description={plan.planName}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Production Plan', to: '/manufacturing/production-plan' },
        { label: plan.planNo },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/production-plan/${plan.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateWoFromPlan && canGenerate
              ? {
                  id: 'generate',
                  label: 'Generate Work Orders',
                  icon: Wrench,
                  onClick: () => void generateAll(),
                  disabled: busy,
                }
              : undefined
          }
          secondaryActions={[
            ...(plan.status === 'draft'
              ? [{ id: 'planned', label: 'Mark Planned', onClick: () => void markPlanned(), disabled: busy }]
              : []),
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            { id: 'list', label: 'Back to List', onClick: () => navigate('/manufacturing/production-plan') },
          ]}
        />
      )}
    >
      <div className="space-y-4">
        <ManufacturingDemoBanner message="Generate Work Orders creates drafts for planning handoff — complete them on Work Orders / Shopfloor." />

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusDot
                label={PRODUCTION_PLAN_STATUS_LABELS[plan.status]}
                tone={statusToneFromLabel(plan.status)}
              />
              <span className="text-[12px] text-erp-muted">
                {plan.totalItems} items · Planned {plan.plannedQty} · WOs {plan.wosCreated}
              </span>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Plan Date">{formatDate(plan.planDate)}</Field>
              <Field label="Source">{PRODUCTION_PLAN_SOURCE_LABELS[plan.source]}</Field>
              <Field label="Warehouse">{plan.warehouseName}</Field>
              <Field label="Planning Period">
                {formatDate(plan.planningPeriodFrom)} → {formatDate(plan.planningPeriodTo)}
              </Field>
              <Field label="Owner">{plan.owner}</Field>
              <Field label="Created By">{plan.createdBy}</Field>
            </dl>
          </section>
          <ManufacturingAiAssist title="Planning AI Insights" suggestions={aiSuggestions} />
        </div>

        <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
          <div className="border-b border-erp-border px-4 py-3">
            <h2 className="text-sm font-semibold text-erp-text">Plan Lines</h2>
            <p className="text-[12px] text-erp-muted">Review readiness, then create WO per line or generate all.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-[12px]">
              <thead>
                <tr>
                  <th>Finished Item</th>
                  <th className="text-right">Required Qty</th>
                  <th className="text-right">Available Stock</th>
                  <th className="text-right">Shortage Qty</th>
                  <th className="text-right">Suggested Production Qty</th>
                  <th>Due Date</th>
                  <th>BOM Status</th>
                  <th>Material Readiness</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-erp-muted">No active lines</td>
                  </tr>
                ) : null}
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <div className="font-mono font-semibold">{line.finishedItemCode}</div>
                      <div className="text-erp-muted">{line.finishedItemName}</div>
                      {line.workOrderNo ? (
                        <div className="mt-0.5 text-[11px] text-emerald-700">WO {line.workOrderNo}</div>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{line.demandQuantity}</td>
                    <td className="text-right tabular-nums">{line.availableFinishedStock}</td>
                    <td className={cn('text-right tabular-nums font-semibold', line.shortageQty > 0 && 'text-rose-700')}>
                      {line.shortageQty}
                    </td>
                    <td className="text-right tabular-nums font-semibold">{line.requiredProductionQuantity}</td>
                    <td>{formatDate(line.requiredDate)}</td>
                    <td>
                      <StatusDot
                        label={BOM_READINESS_LABELS[line.bomStatus]}
                        tone={statusToneFromLabel(line.bomStatus)}
                      />
                    </td>
                    <td>
                      <StatusDot
                        label={MATERIAL_STATUS_LABELS[line.materialStatus]}
                        tone={statusToneFromLabel(line.materialStatus)}
                      />
                    </td>
                    <td>
                      {line.woCreated ? (
                        <span className="text-[11px] font-medium text-emerald-700">WO created</span>
                      ) : perms.canCreateWoFromPlan && canGenerate ? (
                        <button
                          type="button"
                          className="erp-btn erp-btn-primary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
                          disabled={busy || busyLine === line.id || line.requiredProductionQuantity <= 0}
                          onClick={() => void createOne(line.id)}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Create WO
                        </button>
                      ) : (
                        <span className="text-erp-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </OperationalPageShell>
  )
}
