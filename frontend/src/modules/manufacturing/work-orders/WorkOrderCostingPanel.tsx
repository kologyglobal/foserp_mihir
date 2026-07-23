/**
 * Phase 7E — Work Order Costing tab (API mode only).
 * Loads cost-summary + accounting-readiness; never shows a misleading 0 as a
 * real cost — incomplete categories render "Pending Rate" / "Not Available".
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Calculator, CheckCircle2, Landmark, ShieldAlert } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { appConfirm } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import {
  calculateWorkOrderCost,
  getWorkOrderAccountingReadiness,
  getWorkOrderCostSummary,
  previewWorkOrderFinancialClose,
  recordWorkOrderFinancialClose,
  type FinancialClosePreview,
  type ManufacturingAccountingReadiness,
  type WorkOrderCostSummary,
} from '@/services/api/manufacturingCostingApi'
import {
  canCalculateCost,
  canFinancialClose,
  canViewAccounting,
  canViewCost,
} from '@/utils/permissions/manufacturing'

type CategoryKey = 'MATERIAL' | 'LABOUR' | 'MACHINE' | 'JOB_WORK' | 'OVERHEAD' | 'SCRAP_REWORK'

interface CategoryFlags {
  pendingRate: boolean
  notAvailable: boolean
  provisional: boolean
}

function categoryFlags(warnings: string[]): Record<CategoryKey, CategoryFlags> {
  const has = (prefix: string) => warnings.some((w) => w === prefix || w.startsWith(`${prefix}:`))
  return {
    MATERIAL: {
      pendingRate: has('INCOMPLETE_MATERIAL_RATE'),
      notAvailable: false,
      provisional: has('PROVISIONAL_MATERIAL_RATE'),
    },
    LABOUR: {
      pendingRate: has('INCOMPLETE_LABOUR_RATE'),
      notAvailable: has('INCOMPLETE_LABOUR_TIME'),
      provisional: false,
    },
    MACHINE: {
      pendingRate: has('INCOMPLETE_MACHINE_RATE'),
      notAvailable: has('INCOMPLETE_MACHINE_TIME'),
      provisional: false,
    },
    JOB_WORK: { pendingRate: false, notAvailable: false, provisional: has('PROVISIONAL_JOB_WORK') },
    OVERHEAD: { pendingRate: false, notAvailable: false, provisional: false },
    SCRAP_REWORK: { pendingRate: false, notAvailable: false, provisional: false },
  }
}

const WARNING_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: 'NOT_CALCULATED', label: 'Cost has not been calculated yet' },
  { prefix: 'INCOMPLETE_MATERIAL_RATE', label: 'Material rate missing (item standard rate not set)' },
  { prefix: 'PROVISIONAL_MATERIAL_RATE', label: 'Material valued at provisional (standard) rate' },
  { prefix: 'INCOMPLETE_LABOUR_RATE', label: 'Labour rate missing (work centre / policy rate not set)' },
  { prefix: 'INCOMPLETE_LABOUR_TIME', label: 'Labour time not recorded yet' },
  { prefix: 'INCOMPLETE_MACHINE_RATE', label: 'Machine rate missing (machine / work centre rate not set)' },
  { prefix: 'INCOMPLETE_MACHINE_TIME', label: 'Machine time not recorded yet' },
  { prefix: 'PROVISIONAL_JOB_WORK', label: 'Job work cost is provisional (vendor invoice not linked)' },
]

function humanizeWarning(code: string): string {
  const match = WARNING_LABELS.find((entry) => code === entry.prefix || code.startsWith(`${entry.prefix}:`))
  return match ? match.label : code.replace(/_/g, ' ').toLowerCase()
}

function humanizeBlocker(code: string): string {
  const map: Record<string, string> = {
    NO_LEGAL_ENTITY: 'No active legal entity is configured',
    MANUFACTURING_ACCOUNTING_FLAG_DISABLED: 'Manufacturing Accounting feature flag is disabled for this tenant',
    MISSING_ACCOUNT_MAPPINGS: 'Required default account mappings are missing',
    WIP_ACCOUNT_NOT_CONFIGURED: 'WIP inventory account is not configured',
    FG_ACCOUNT_NOT_CONFIGURED: 'Finished goods inventory account is not configured',
    FINISHED_GOODS_ACCOUNT_NOT_CONFIGURED: 'Finished goods inventory account is not configured',
    VARIANCE_ACCOUNT_NOT_CONFIGURED: 'Production variance account is not configured',
    PRODUCTION_VARIANCE_ACCOUNT_NOT_CONFIGURED: 'Production variance account is not configured',
    LABOUR_ACCOUNT_NOT_CONFIGURED: 'Labour absorption account is not configured',
    MACHINE_ACCOUNT_NOT_CONFIGURED: 'Machine absorption account is not configured',
    JOB_WORK_ACCOUNT_NOT_CONFIGURED: 'Job-work absorption account is not configured',
    OVERHEAD_ACCOUNT_NOT_CONFIGURED: 'Manufacturing overhead absorption account is not configured',
    SCRAP_ACCOUNT_NOT_CONFIGURED: 'Scrap expense account is not configured',
    MAPPING_ACCOUNT_INACTIVE: 'A mapped account is inactive or blocked',
    MAPPING_ACCOUNT_NOT_POSTABLE: 'A mapped account is a group account and cannot be posted',
    MAPPING_ACCOUNT_WRONG_SCOPE: 'A mapped account is outside the current legal entity',
    DUPLICATE_CONFLICTING_MAPPING: 'Duplicate conflicting account mappings exist',
    NO_OPEN_ACCOUNTING_PERIOD: 'No open accounting period covers today',
    FAILED_ACCOUNTING_EVENTS: 'There are failed accounting events to resolve',
    UNRECONCILED_ACCOUNTING_EVENTS: 'There are unposted (RECORDED) accounting events to clear',
    INVENTORY_POSTINGS_UNRECONCILED:
      'Inventory-linked or unreconciled manufacturing accounting exceptions remain',
    INVENTORY_RECONCILE_NOT_SIGNED_OFF: 'Inventory reconciliation has not been signed off',
    PILOT_FINANCE_SIGNOFF_REQUIRED: 'Pilot Finance approval is required before enabling Manufacturing Accounting',
    WORK_ORDER_NOT_COMPLETED: 'Work order is not completed yet',
    COST_NOT_CALCULATED: 'Work-order cost has not been calculated',
  }
  return map[code] ?? code.replace(/_/g, ' ').toLowerCase()
}

function moneyValue(value: string | null | undefined): string {
  return formatCurrency(Number(value ?? 0))
}

function CostKpi({ label, value, helper, tone }: { label: string; value: string; helper?: string; tone?: 'warn' | 'ok' }) {
  return (
    <div className="rounded-md border border-erp-border bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</div>
      <div
        className={
          tone === 'warn'
            ? 'mt-0.5 text-[15px] font-semibold tabular-nums text-amber-700'
            : 'mt-0.5 text-[15px] font-semibold tabular-nums text-erp-text'
        }
      >
        {value}
      </div>
      {helper ? <div className="mt-0.5 text-[10px] text-erp-muted">{helper}</div> : null}
    </div>
  )
}

const CATEGORY_ROWS: Array<{ key: CategoryKey; label: string; planned: string; actual: string }> = [
  { key: 'MATERIAL', label: 'Materials', planned: 'plannedMaterialCost', actual: 'actualMaterialCost' },
  { key: 'LABOUR', label: 'Labour', planned: 'plannedLabourCost', actual: 'actualLabourCost' },
  { key: 'MACHINE', label: 'Machine', planned: 'plannedMachineCost', actual: 'actualMachineCost' },
  { key: 'JOB_WORK', label: 'Job Work', planned: 'plannedJobWorkCost', actual: 'actualJobWorkCost' },
  { key: 'OVERHEAD', label: 'Overhead', planned: 'plannedOverheadCost', actual: 'actualOverheadCost' },
  { key: 'SCRAP_REWORK', label: 'Scrap / Rework', planned: '', actual: 'scrapCost' },
]

function costingStatusMeta(status: string | undefined): { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral' } {
  if (!status || status === 'NOT_CALCULATED') return { label: 'Not Calculated', tone: 'neutral' }
  if (status === 'COMPLETE') return { label: 'Complete', tone: 'success' }
  if (status === 'COMPLETE_WITH_PROVISIONAL') return { label: 'Provisional', tone: 'warning' }
  if (status.startsWith('INCOMPLETE')) {
    return { label: `Incomplete — ${status.replace('INCOMPLETE_', '').replace(/_/g, ' ').toLowerCase()}`, tone: 'critical' }
  }
  return { label: status.replace(/_/g, ' '), tone: 'neutral' }
}

export function WorkOrderCostingPanel({ workOrderId }: { workOrderId: string }) {
  const [summary, setSummary] = useState<WorkOrderCostSummary | null>(null)
  const [readiness, setReadiness] = useState<ManufacturingAccountingReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showReadiness, setShowReadiness] = useState(false)
  const [closePreview, setClosePreview] = useState<FinancialClosePreview | null>(null)
  const [closePreviewOpen, setClosePreviewOpen] = useState(false)

  const accountingViewAllowed = canViewAccounting()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryRes, readinessRes] = await Promise.all([
        getWorkOrderCostSummary(workOrderId),
        accountingViewAllowed
          ? getWorkOrderAccountingReadiness(workOrderId).catch(() => null)
          : Promise.resolve(null),
      ])
      setSummary(summaryRes.data)
      setReadiness(readinessRes?.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load work order costing')
    } finally {
      setLoading(false)
    }
  }, [workOrderId, accountingViewAllowed])

  useEffect(() => {
    void load()
  }, [load])

  const snapshot = summary?.snapshot ?? null
  const warnings = summary?.warnings ?? []
  const flags = useMemo(() => categoryFlags(warnings), [warnings])
  const completeness = snapshot?.completenessStatus ?? summary?.completenessStatus ?? 'NOT_CALCULATED'
  const notCalculated = !snapshot
  const statusMeta = costingStatusMeta(completeness)
  const accountingFlagOff = readiness != null && !readiness.accountingFlag.enabled

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of summary?.accountingStatus ?? []) counts[row.status] = row._count._all
    return counts
  }, [summary])

  const handleCalculate = useCallback(async () => {
    setBusy(true)
    try {
      const res = await calculateWorkOrderCost(workOrderId)
      notify.success('Work-order cost calculated')
      res.data.warnings.slice(0, 5).forEach((w) => notify.warning(humanizeWarning(w)))
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cost calculation failed')
    } finally {
      setBusy(false)
    }
  }, [workOrderId, load])

  const handleClosePreview = useCallback(async () => {
    setBusy(true)
    try {
      const res = await previewWorkOrderFinancialClose(workOrderId)
      setClosePreview(res.data)
      setClosePreviewOpen(true)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Financial close preview failed')
    } finally {
      setBusy(false)
    }
  }, [workOrderId])

  const handleFinancialClose = useCallback(async () => {
    const confirmed = await appConfirm({
      title: 'Record financial close?',
      description:
        'This records a production variance accounting event for the residual difference. Posted accounting events create immutable journal vouchers and cannot be edited — corrections require reversal entries.',
      confirmLabel: 'Record Financial Close',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await recordWorkOrderFinancialClose(workOrderId)
      notify.success('Financial close event recorded')
      setClosePreviewOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Financial close failed')
    } finally {
      setBusy(false)
    }
  }, [workOrderId, load])

  if (!canViewCost()) {
    return (
      <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
        <EmptyState icon={ShieldAlert} title="Access denied" description="Missing cost view permission (manufacturing.cost.view)." />
      </section>
    )
  }

  if (loading) return <LoadingState variant="card" />

  const cellValue = (raw: string | undefined, flag: CategoryFlags): { text: string; warn: boolean } => {
    if (notCalculated) return { text: 'Not Available', warn: true }
    if (flag.notAvailable) return { text: 'Not Available', warn: true }
    if (flag.pendingRate) return { text: 'Pending Rate', warn: true }
    return { text: moneyValue(raw), warn: false }
  }

  return (
    <div className="space-y-3">
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-erp-border bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-erp-muted" aria-hidden />
          <span className="text-sm font-semibold text-erp-text">Costing</span>
          <DynamicsStatusChip label={statusMeta.label} tone={statusMeta.tone} />
          {snapshot?.snapshotVersion != null ? (
            <span className="text-[11px] text-erp-muted">
              Snapshot v{snapshot.snapshotVersion} · {formatDateTime(snapshot.calculationDate)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canCalculateCost() ? (
            <Button size="sm" disabled={busy} onClick={() => void handleCalculate()}>
              {notCalculated ? 'Calculate Cost' : 'Recalculate Cost'}
            </Button>
          ) : null}
          {accountingViewAllowed ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setShowReadiness((v) => !v)}>
              Review Readiness
            </Button>
          ) : null}
          {canFinancialClose() ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleClosePreview()}>
              Financial Close Preview
            </Button>
          ) : null}
        </div>
      </div>

      {/* Accounting status banner */}
      {!accountingViewAllowed ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
          Accounting Status: <strong>Not available</strong> — missing manufacturing.accounting.view permission. Cost
          calculation remains available.
        </div>
      ) : accountingFlagOff ? (
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Accounting Status: <strong>Disabled / Not Enabled</strong> — the MANUFACTURING_ACCOUNTING feature flag is off
            for this tenant. Cost calculation still works; no GL vouchers are posted.
          </span>
        </div>
      ) : readiness ? (
        <div
          className={
            readiness.ready
              ? 'flex flex-wrap items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900'
              : 'flex flex-wrap items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900'
          }
        >
          {readiness.ready ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>
            Accounting Status: <strong>{readiness.ready ? 'Ready to post' : 'Blocked'}</strong>
            {readiness.pendingEventCount > 0 ? <> · {readiness.pendingEventCount} unposted event(s)</> : null}
            {readiness.failedEventCount > 0 ? <> · {readiness.failedEventCount} failed event(s)</> : null}
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
          Accounting Status: <strong>Unavailable</strong> — readiness could not be loaded.
        </div>
      )}

      {/* Readiness detail */}
      {showReadiness && readiness ? (
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">Accounting readiness</h3>
          <div className="grid gap-2 text-[12px] sm:grid-cols-2">
            <div>
              <p className="text-erp-muted">Feature flag</p>
              <p className="font-medium">{readiness.accountingFlag.enabled ? 'Enabled' : `Disabled (${readiness.accountingFlag.reason})`}</p>
            </div>
            <div>
              <p className="text-erp-muted">Open accounting period</p>
              <p className="font-medium">
                {readiness.openPeriod
                  ? `${readiness.openPeriod.code} (${readiness.openPeriod.status})`
                  : 'None'}
              </p>
              {readiness.postingDateChecked ? (
                <p className="text-xs text-erp-muted">As of {readiness.postingDateChecked}</p>
              ) : null}
            </div>
            <div>
              <p className="text-erp-muted">Account mappings</p>
              <p className="font-medium">
                {readiness.mappingKeys.missing.length === 0
                  ? `All ${readiness.mappingKeys.required.length} present`
                  : `${readiness.mappingKeys.missing.length} missing: ${readiness.mappingKeys.missing.join(', ')}`}
              </p>
            </div>
            <div>
              <p className="text-erp-muted">Provisional cost snapshots</p>
              <p className="font-medium tabular-nums">{readiness.provisionalCostCount}</p>
            </div>
          </div>
          {readiness.blockers.length > 0 ? (
            <ul className="mt-3 space-y-1 text-[12px] text-rose-800">
              {readiness.blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {humanizeBlocker(blocker)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <CostKpi label="Planned" value={notCalculated ? 'Not Available' : moneyValue(snapshot?.totalPlannedCost)} tone={notCalculated ? 'warn' : undefined} />
        <CostKpi
          label="Actual"
          value={notCalculated ? 'Not Available' : completeness.startsWith('INCOMPLETE') ? 'Incomplete' : moneyValue(snapshot?.totalActualCost)}
          helper={snapshot && Number(snapshot.provisionalCost) > 0 ? `incl. ${moneyValue(snapshot.provisionalCost)} provisional` : undefined}
          tone={notCalculated || completeness.startsWith('INCOMPLETE') ? 'warn' : undefined}
        />
        <CostKpi label="Posted" value={notCalculated ? 'Not Available' : moneyValue(snapshot?.totalPostedCost)} tone={notCalculated ? 'warn' : undefined} />
        <CostKpi
          label="Variance"
          value={notCalculated ? 'Not Available' : moneyValue(snapshot?.varianceAmount)}
          helper={notCalculated ? undefined : 'actual − posted'}
          tone={notCalculated ? 'warn' : undefined}
        />
        <CostKpi
          label="Unit Cost"
          value={
            notCalculated
              ? 'Not Available'
              : Number(snapshot?.goodQuantity) > 0
                ? moneyValue(snapshot?.unitActualCost)
                : 'Not Available'
          }
          helper={notCalculated ? undefined : Number(snapshot?.goodQuantity) > 0 ? 'per good unit' : 'no good quantity yet'}
          tone={notCalculated || Number(snapshot?.goodQuantity) <= 0 ? 'warn' : undefined}
        />
        <CostKpi label="Costing Status" value={statusMeta.label} tone={statusMeta.tone === 'success' ? 'ok' : 'warn'} />
      </div>

      {/* Category breakdown */}
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">Cost breakdown</h3>
        <div className="overflow-x-auto">
          <table className="erp-table w-full text-[12px]">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Planned</th>
                <th className="text-right">Actual</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ROWS.map((row) => {
                const flag = flags[row.key]
                const planned =
                  row.planned && snapshot
                    ? moneyValue(snapshot[row.planned as keyof typeof snapshot] as string)
                    : '—'
                const actualRaw = snapshot
                  ? row.key === 'SCRAP_REWORK'
                    ? String(Number(snapshot.scrapCost) + Number(snapshot.reworkCost))
                    : (snapshot[row.actual as keyof typeof snapshot] as string)
                  : undefined
                const actual = cellValue(actualRaw, flag)
                return (
                  <tr key={row.key}>
                    <td className="font-medium">{row.label}</td>
                    <td className="text-right tabular-nums">{notCalculated ? '—' : planned}</td>
                    <td className={actual.warn ? 'text-right font-medium text-amber-700' : 'text-right tabular-nums'}>
                      {actual.text}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {flag.provisional ? <DynamicsStatusChip label="Provisional" tone="warning" /> : null}
                        {flag.pendingRate ? <DynamicsStatusChip label="Pending Rate" tone="critical" /> : null}
                        {flag.notAvailable ? <DynamicsStatusChip label="Not Available" tone="neutral" /> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Warnings */}
      {warnings.length > 0 ? (
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold">Warnings</h3>
          <ul className="space-y-1 text-[12px] text-amber-800">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {humanizeWarning(warning)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Accounting event counts */}
      <section className="rounded-lg border border-erp-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Accounting events</h3>
          {accountingViewAllowed ? (
            <Link to="/accounting/manufacturing" className="text-[12px] font-semibold text-erp-primary hover:underline">
              Open Manufacturing Accounting workspace
            </Link>
          ) : null}
        </div>
        {Object.keys(eventCounts).length === 0 ? (
          <p className="mt-2 text-[12px] text-erp-muted">No accounting events recorded for this work order.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(eventCounts).map(([status, count]) => (
              <DynamicsStatusChip
                key={status}
                label={`${status.replace(/_/g, ' ')} · ${count}`}
                tone={status === 'POSTED' ? 'success' : status === 'FAILED' ? 'critical' : 'neutral'}
              />
            ))}
          </div>
        )}
      </section>

      {/* Financial close preview modal */}
      <Modal
        open={closePreviewOpen}
        onClose={() => setClosePreviewOpen(false)}
        title="Financial Close Preview"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setClosePreviewOpen(false)} disabled={busy}>
              Close
            </Button>
            {closePreview?.ready && canFinancialClose() ? (
              <Button disabled={busy} onClick={() => void handleFinancialClose()}>
                Record Financial Close
              </Button>
            ) : null}
          </div>
        }
      >
        {closePreview ? (
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center gap-2">
              <DynamicsStatusChip
                label={closePreview.ready ? 'Ready for financial close' : 'Not ready'}
                tone={closePreview.ready ? 'success' : 'critical'}
              />
              <span className="text-[12px] text-erp-muted">Work order status: {closePreview.orderStatus.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">Residual variance (actual − posted)</p>
              <p className="text-[15px] font-semibold tabular-nums">
                {closePreview.residualVariance != null ? moneyValue(closePreview.residualVariance) : 'Not Available'}
              </p>
            </div>
            {closePreview.blockers.length > 0 ? (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-erp-muted">Blockers</p>
                <ul className="space-y-1 text-[12px] text-rose-800">
                  {closePreview.blockers.map((blocker) => (
                    <li key={blocker} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {humanizeBlocker(blocker)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[12px] text-erp-muted">
                Recording financial close creates a PRODUCTION_VARIANCE accounting event. Posted vouchers are immutable.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
