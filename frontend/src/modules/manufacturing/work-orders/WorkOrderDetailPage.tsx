import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Pause,
  Play,
  Package,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import {
  CheckMaterialDrawer,
  CloseWorkOrderDrawer,
  CompleteProductionDrawer,
  HoldWorkOrderDrawer,
  ManufacturingAiRail,
  ManufacturingDemoBanner,
  ManufacturingStickyActionBar,
  ManufacturingStickyActionSpacer,
  MfgTouchBtn,
  QcActionDrawer,
  ShopfloorStatusChip,
  StartProductionDrawer,
  WorkOrderExecutionStepper,
  WorkOrderOperationsPanel,
} from '@/components/manufacturing'
import {
  cancelWorkOrderDemo,
  checkWorkOrderMaterialAvailability,
  closeWorkOrderDemo,
  closeWorkOrderWithDifferenceDemo,
  completeProductionQuantityDemo,
  confirmManualMaterialIssueDemo,
  createProductionReworkDemo,
  createPurchaseRequisitionFromShortageDemo,
  createTransferFromShortageDemo,
  getJobWorkOrders,
  getManualMaterialIssuePreview,
  getMaterialReturnPreview,
  getManufacturingSettings,
  getProductionCostPreview,
  getProductionQualityReview,
  getProductionVariancePreview,
  getWorkOrderActivity,
  getWorkOrderById,
  getWorkOrderClosingPreview,
  getWorkOrderMaterials,
  getWorkOrderOperations,
  getWorkOrderOutputs,
  holdWorkOrderDemo,
  holdWorkOrderOperationDemo,
  markWorkOrderOperationJobWorkDemo,
  completeWorkOrderOperationDemo,
  resolveWorkOrderOperationQcDemo,
  resumeWorkOrderOperationDemo,
  sendWorkOrderOperationToQcDemo,
  startWorkOrderOperationDemo,
  recordProductionScrapDemo,
  releaseWorkOrderReservationsDemo,
  reserveWorkOrderMaterialsDemo,
  resumeWorkOrderDemo,
  returnUnusedMaterialDemo,
  sendWorkOrderToQcDemo,
  startWorkOrderDemo,
  updateProductionQualityResultDemo,
} from '@/services/manufacturing'
import type { ManufacturingSettings } from '@/types/manufacturingSettings'
import type { JobWorkOrder } from '@/types/manufacturingJobWork'
import type { WorkOrderOperation } from '@/types/manufacturingRoute'
import type {
  MaterialIssueLine,
  MaterialReturnLine,
  ProductionCostPreview,
  ProductionOutputEntry,
  ProductionQualityReview,
  ProductionVariancePreview,
  ScrapReason,
  WorkOrder,
  WorkOrderActivity,
  WorkOrderClosingPreview,
  WorkOrderMaterial,
} from '@/types/manufacturingWorkOrder'
import {
  SCRAP_REASON_LABELS,
  WO_MATERIAL_STATUS_LABELS,
  WO_QC_STATUS_LABELS,
  WO_SOURCE_LABELS,
  getWorkOrderListStatus,
  getWorkOrderOwnerLine,
  getWorkOrderQcStatus,
} from '@/types/manufacturingWorkOrder'
import { PRODUCTION_METHOD_LABELS } from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { buildWorkOrderAiInsights } from '@/utils/manufacturing/insights'
import { cn } from '@/utils/cn'

type DetailTab =
  | 'overview'
  | 'materials'
  | 'operations'
  | 'production'
  | 'quality'
  | 'job_work'
  | 'costing'
  | 'timeline'
  | 'documents'

type Dialog =
  | null
  | 'check'
  | 'start'
  | 'hold'
  | 'resume'
  | 'complete'
  | 'close'
  | 'cancel'
  | 'issue'
  | 'return'
  | 'scrap'
  | 'rework'
  | 'quality'

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'materials', label: 'Materials' },
  { id: 'operations', label: 'Operations' },
  { id: 'production', label: 'Production' },
  { id: 'quality', label: 'Quality' },
  { id: 'job_work', label: 'Job Work' },
  { id: 'costing', label: 'Costing' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'documents', label: 'Documents' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-erp-text">{value ?? '—'}</div>
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-erp-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

export function WorkOrderDetailPage() {
  const { workOrderId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()

  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [mats, setMats] = useState<WorkOrderMaterial[]>([])
  const [operations, setOperations] = useState<WorkOrderOperation[]>([])
  const [acts, setActs] = useState<WorkOrderActivity[]>([])
  const [outputs, setOutputs] = useState<ProductionOutputEntry[]>([])
  const [quality, setQuality] = useState<ProductionQualityReview | null>(null)
  const [jobWorks, setJobWorks] = useState<JobWorkOrder[]>([])
  const [settings, setSettings] = useState<ManufacturingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  const [startAt, setStartAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [supervisor, setSupervisor] = useState('')
  const [shift, setShift] = useState('A')
  const [workstation, setWorkstation] = useState('')
  const [remarks, setRemarks] = useState('')
  const [expectedResume, setExpectedResume] = useState('')
  const [scrapQty, setScrapQty] = useState(0)
  const [reworkQty, setReworkQty] = useState(0)
  const productionDate = new Date().toISOString().slice(0, 10)
  const differenceReason = ''
  const [closingPreview, setClosingPreview] = useState<WorkOrderClosingPreview | null>(null)
  const [costPreview, setCostPreview] = useState<ProductionCostPreview | null>(null)
  const [variancePreview, setVariancePreview] = useState<ProductionVariancePreview | null>(null)
  const [issueLines, setIssueLines] = useState<MaterialIssueLine[]>([])
  const [returnLines, setReturnLines] = useState<MaterialReturnLine[]>([])
  const [scrapReason, setScrapReason] = useState<ScrapReason>('process_loss')
  const [startWarnings, setStartWarnings] = useState<string[]>([])

  const readOnly = wo?.status === 'closed' || wo?.status === 'cancelled'
  const listStatus = wo ? getWorkOrderListStatus(wo) : 'draft'
  const qcStatus = wo ? getWorkOrderQcStatus(wo) : 'not_required'

  const reload = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    try {
      const [w, m, a, o, q, s, jws, ops] = await Promise.all([
        getWorkOrderById(workOrderId),
        getWorkOrderMaterials(workOrderId),
        getWorkOrderActivity(workOrderId),
        getWorkOrderOutputs(workOrderId),
        getProductionQualityReview(workOrderId),
        getManufacturingSettings(),
        getJobWorkOrders(),
        getWorkOrderOperations(workOrderId),
      ])
      if (!w) {
        notify.error('Work order not found')
        navigate('/manufacturing/work-orders')
        return
      }
      setWo(w)
      setMats(m)
      setActs(a)
      setOutputs(o)
      setQuality(q)
      setSettings(s)
      setOperations(ops)
      setJobWorks(jws.filter((j) => j.workOrderId === workOrderId))
      setSupervisor(w.supervisor ?? '')
      setWorkstation(w.workstation ?? '')
      if (perms.canViewCost) {
        const [c, v] = await Promise.all([
          getProductionCostPreview(workOrderId),
          getProductionVariancePreview(workOrderId),
        ])
        setCostPreview(c)
        setVariancePreview(v)
      }
    } finally {
      setLoading(false)
    }
  }, [navigate, perms.canViewCost, workOrderId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const action = searchParams.get('action') as Dialog
    if (action) {
      setDialog(action)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
    const t = searchParams.get('tab') as DetailTab | null
    if (t && TABS.some((x) => x.id === t)) setTab(t)
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (dialog === 'close' && workOrderId) void getWorkOrderClosingPreview(workOrderId).then(setClosingPreview)
  }, [dialog, workOrderId])

  useEffect(() => {
    if (dialog !== 'check' || !workOrderId) return
    void (async () => {
      setBusy(true)
      try {
        const r = await checkWorkOrderMaterialAvailability(workOrderId)
        if (!r.ok) notify.error('Material check failed')
        else {
          r.warnings?.forEach((w) => notify.warning(w))
          notify.success('Materials checked')
        }
        const [w, m] = await Promise.all([getWorkOrderById(workOrderId), getWorkOrderMaterials(workOrderId)])
        if (w) setWo(w)
        setMats(m)
      } finally {
        setBusy(false)
      }
    })()
  }, [dialog, workOrderId])

  useEffect(() => {
    if (dialog === 'issue' && workOrderId) void getManualMaterialIssuePreview(workOrderId).then(setIssueLines)
  }, [dialog, workOrderId])

  useEffect(() => {
    if (dialog === 'return' && workOrderId) void getMaterialReturnPreview(workOrderId).then(setReturnLines)
  }, [dialog, workOrderId])

  const materialColumns = useMemo(
    () => [
      {
        id: 'comp',
        header: 'Item',
        cell: ({ row }: { row: { original: WorkOrderMaterial } }) => (
          <div>
            <div className="font-mono font-medium">{row.original.componentItemCode}</div>
            <div className="text-[11px] text-erp-muted">{row.original.componentItemName}</div>
          </div>
        ),
      },
      { accessorKey: 'requiredQty', header: 'Required Qty' },
      { accessorKey: 'availableQty', header: 'Available Qty' },
      { accessorKey: 'reservedQty', header: 'Reserved Qty' },
      { accessorKey: 'consumedQty', header: 'Consumed Qty' },
      { accessorKey: 'shortageQty', header: 'Shortage Qty' },
      { accessorKey: 'warehouseName', header: 'Warehouse' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: { original: WorkOrderMaterial } }) => (
          <StatusDot tone={statusToneFromLabel(row.original.status)} label={WO_MATERIAL_STATUS_LABELS[row.original.status]} />
        ),
      },
    ],
    [],
  )

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>, okMsg: string) => {
    setBusy(true)
    try {
      const r = await fn()
      if (!r.ok) {
        notify.error(r.error ?? 'Action failed')
        if (r.warnings?.length) setStartWarnings(r.warnings)
        return false
      }
      r.warnings?.forEach((w) => notify.warning(w))
      notify.success(okMsg)
      setDialog(null)
      await reload()
      return true
    } finally {
      setBusy(false)
    }
  }

  const aiSuggestions = useMemo(() => {
    if (!wo) return []
    return buildWorkOrderAiInsights(wo, mats)
  }, [mats, wo])

  if (loading || !wo) return <LoadingState variant="card" />

  const canCheck = !readOnly && ['draft', 'in_progress', 'on_hold'].includes(wo.status) && perms.canViewMaterials
  const canReserve = !readOnly && wo.status === 'draft' && perms.canReserveMaterials
  const canStart = !readOnly && wo.status === 'draft' && perms.canStartWo
  const canHold = !readOnly && wo.status === 'in_progress' && perms.canHoldWo
  const canResume = !readOnly && wo.status === 'on_hold' && perms.canResumeWo
  const canComplete = !readOnly && wo.status === 'in_progress' && perms.canCompleteProduction
  const canSendQc = !readOnly && ['in_progress', 'completed'].includes(wo.status) && wo.producedQty > 0 && !wo.qualityHold && wo.qualityRequired && (perms.canInspectQuality || perms.canViewQuality)
  const canQcAction = !readOnly && Boolean(quality?.result === 'pending') && perms.canInspectQuality
  const canClose = !readOnly && wo.status === 'completed' && !wo.qualityHold && perms.canCloseWo
  const canCancel = !readOnly && perms.canCancelWo

  const primaryAction = canStart
    ? { id: 'start', label: 'Start', icon: Play, onClick: () => setDialog('start') }
    : canResume
      ? { id: 'resume', label: 'Resume', icon: Play, onClick: () => setDialog('resume') }
      : canComplete
        ? { id: 'complete', label: 'Complete Production', icon: CheckCircle2, onClick: () => setDialog('complete') }
        : canQcAction
          ? { id: 'qc', label: 'QC Action', icon: ShieldCheck, onClick: () => setDialog('quality') }
          : canClose
            ? { id: 'close', label: 'Close', icon: CheckCircle2, onClick: () => setDialog('close') }
            : undefined

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={wo.woNumber}
      description={`${wo.finishedItemCode} — ${wo.finishedItemName}`}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: wo.woNumber },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/work-orders/${wo.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={primaryAction}
          secondaryActions={[
            ...(canCheck
              ? [{ id: 'check', label: 'Check Materials', icon: ClipboardCheck, onClick: () => setDialog('check'), disabled: busy }]
              : []),
            ...(canReserve
              ? [{ id: 'reserve', label: 'Reserve Materials', icon: Package, onClick: () => void run(async () => { const r = await reserveWorkOrderMaterialsDemo(wo.id); return { ok: r.ok, error: r.error } }, 'Materials reserved'), disabled: busy }]
              : []),
            ...(canHold
              ? [{ id: 'hold', label: 'Hold', icon: Pause, onClick: () => setDialog('hold') }]
              : []),
            ...(canSendQc
              ? [{ id: 'send-qc', label: 'Send to QC', icon: ShieldCheck, onClick: () => void run(() => sendWorkOrderToQcDemo(wo.id), 'Sent to QC'), disabled: busy }]
              : []),
            ...(canQcAction
              ? [{ id: 'qc', label: 'QC Action', icon: ShieldCheck, onClick: () => setDialog('quality') }]
              : []),
            ...(canCancel
              ? [{ id: 'cancel', label: 'Cancel', icon: Ban, onClick: () => setDialog('cancel') }]
              : []),
            { id: 'back', label: 'Back', onClick: () => navigate('/manufacturing/work-orders') },
          ]}
        />
      )}
    >
      <ManufacturingAiRail title="Work Order Insights" suggestions={aiSuggestions}>
      <div className="space-y-3">
        <ManufacturingDemoBanner message="Work Order is the center — materials, production, QC, and close stay on this page. Not separate ERP documents." />

        <WorkOrderExecutionStepper
          listStatus={listStatus}
          qualityRequired={wo.qualityRequired}
        />

        <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-lg font-semibold text-erp-primary">{wo.woNumber}</p>
              <p className="text-[14px] font-medium text-erp-text">{wo.finishedItemCode} — {wo.finishedItemName}</p>
              <p className="mt-1 text-[12px] text-erp-muted">
                Source: {WO_SOURCE_LABELS[wo.source]} · {wo.sourceDocumentNo || '—'}
              </p>
            </div>
            <ShopfloorStatusChip status={listStatus} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Field label="Status" value={<ShopfloorStatusChip status={listStatus} />} />
            <Field label="Planned Qty" value={`${wo.plannedQty} ${wo.uom}`} />
            <Field label="Good Qty" value={`${wo.producedQty} ${wo.uom}`} />
            <Field label="Due Date" value={formatDate(wo.dueDate)} />
            <Field
              label="Material Status"
              value={(
                <StatusDot
                  tone={statusToneFromLabel(wo.materialStatus)}
                  label={
                    wo.materialStatus in WO_MATERIAL_STATUS_LABELS
                      ? WO_MATERIAL_STATUS_LABELS[wo.materialStatus as keyof typeof WO_MATERIAL_STATUS_LABELS]
                      : wo.materialStatus
                  }
                />
              )}
            />
            <Field
              label="QC Status"
              value={(
                <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
                  {WO_QC_STATUS_LABELS[qcStatus]}
                </span>
              )}
            />
            <Field label="Source Reference" value={wo.sourceDocumentNo || '—'} />
            <Field label="Owner / Line" value={getWorkOrderOwnerLine(wo)} />
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-erp-muted">
              <span>Progress</span>
              <span className="tabular-nums">{wo.progressPercent}%</span>
            </div>
            <ProgressBar pct={wo.progressPercent} />
          </div>
        </div>

        <div className="hidden flex-wrap gap-1.5 lg:flex">
          {canCheck ? (
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" disabled={busy} onClick={() => setDialog('check')}>
              Check Materials
            </button>
          ) : null}
          {canReserve ? (
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" disabled={busy} onClick={() => void run(async () => { const r = await reserveWorkOrderMaterialsDemo(wo.id); return { ok: r.ok, error: r.error } }, 'Materials reserved')}>
              Reserve Materials
            </button>
          ) : null}
          {canStart ? (
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[12px]" onClick={() => setDialog('start')}>Start</button>
          ) : null}
          {canHold ? (
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" onClick={() => setDialog('hold')}>Hold</button>
          ) : null}
          {canResume ? (
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[12px]" onClick={() => setDialog('resume')}>Resume</button>
          ) : null}
          {canComplete ? (
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[12px]" onClick={() => setDialog('complete')}>Complete Production</button>
          ) : null}
          {canSendQc ? (
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" disabled={busy} onClick={() => void run(() => sendWorkOrderToQcDemo(wo.id), 'Sent to QC')}>Send to QC</button>
          ) : null}
          {canQcAction ? (
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" onClick={() => setDialog('quality')}>QC Action</button>
          ) : null}
          {canClose ? (
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" onClick={() => setDialog('close')}>Close</button>
          ) : null}
          {canCancel ? (
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px] text-rose-700" onClick={() => setDialog('cancel')}>
              <XCircle className="mr-1 inline h-3.5 w-3.5" /> Cancel
            </button>
          ) : null}
        </div>

        {/* Mobile / tablet: compact secondary actions only (primary lives in sticky footer) */}
        <div className="flex flex-wrap gap-2 lg:hidden">
          {canCheck ? (
            <MfgTouchBtn variant="secondary" disabled={busy} onClick={() => setDialog('check')} className="flex-none min-w-[44%]">
              Check Materials
            </MfgTouchBtn>
          ) : null}
          {canReserve ? (
            <MfgTouchBtn
              variant="secondary"
              disabled={busy}
              className="flex-none min-w-[44%]"
              onClick={() => void run(async () => { const r = await reserveWorkOrderMaterialsDemo(wo.id); return { ok: r.ok, error: r.error } }, 'Materials reserved')}
            >
              Reserve
            </MfgTouchBtn>
          ) : null}
          {canSendQc ? (
            <MfgTouchBtn
              variant="secondary"
              disabled={busy}
              className="flex-none min-w-[44%]"
              onClick={() => void run(() => sendWorkOrderToQcDemo(wo.id), 'Sent to QC')}
            >
              Send to QC
            </MfgTouchBtn>
          ) : null}
        </div>

        {readOnly ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
            This work order is read-only.
          </p>
        ) : null}

        <div role="tablist" aria-label="Work order tabs" className="flex gap-1 overflow-x-auto rounded-xl border border-erp-border bg-white p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition touch-manipulation sm:min-h-0 sm:py-1.5 sm:text-[12px]',
                tab === t.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold">Basic info</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Finished Item" value={`${wo.finishedItemCode} — ${wo.finishedItemName}`} />
                <Field label="Source" value={`${WO_SOURCE_LABELS[wo.source]} · ${wo.sourceDocumentNo || '—'}`} />
                <Field label="Method" value={PRODUCTION_METHOD_LABELS[wo.productionMethod]} />
                <Field label="BOM" value={`${wo.bomNumber} ${wo.bomVersion}`} />
                <Field
                  label="Route snapshot"
                  value={
                    wo.routeNo
                      ? `${wo.routeNo} — ${wo.routeName || ''}${wo.routeVersion ? ` (${wo.routeVersion})` : ''}`
                      : '— (no route snapshot)'
                  }
                />
                <Field
                  label="Snapshot at"
                  value={wo.routeSnapshotAt ? formatDateTime(wo.routeSnapshotAt) : '—'}
                />
                <Field label="Current Operation" value={wo.currentOperationName || '—'} />
                <Field label="Next Operation" value={wo.nextOperationName || '—'} />
                <Field label="Due Date" value={formatDate(wo.dueDate)} />
                <Field label="Owner / Line" value={getWorkOrderOwnerLine(wo)} />
                <Field label="Plant" value={wo.plantName} />
                <Field label="Customer" value={wo.customerName || '—'} />
              </div>
            </section>
            <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Quantity summary</h3>
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between"><dt className="text-erp-muted">Planned</dt><dd className="tabular-nums font-semibold">{wo.plannedQty}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Good</dt><dd className="tabular-nums font-semibold">{wo.producedQty}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Scrap</dt><dd className="tabular-nums">{wo.scrapQty}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Rework</dt><dd className="tabular-nums">{wo.reworkQty}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Rejected</dt><dd className="tabular-nums">{wo.rejectedQty}</dd></div>
                <div className="flex justify-between border-t border-erp-border pt-2"><dt className="text-erp-muted">Remaining</dt><dd className="tabular-nums font-semibold">{wo.remainingQty}</dd></div>
              </dl>
              <div className="mt-3">
                <ProgressBar pct={wo.progressPercent} />
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'operations' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Operation stages (WO snapshot)</h3>
                <p className="text-[12px] text-erp-muted">
                  Copied from Route Master at create. Actions here change this Work Order only — the master template stays unchanged.
                </p>
              </div>
              {wo.routeNo ? (
                <div className="text-right text-[12px]">
                  <TableLink to={`/manufacturing/routes/${wo.routeId}`}>{wo.routeNo}</TableLink>
                  {wo.routeVersion ? <p className="text-erp-muted">v {wo.routeVersion}</p> : null}
                </div>
              ) : null}
            </div>
            <WorkOrderOperationsPanel
              operations={operations}
              readOnly={readOnly}
              busy={busy}
              onStart={(opId, operator) => void run(() => startWorkOrderOperationDemo(wo.id, opId, operator), 'Operation started')}
              onHold={(opId) => void run(() => holdWorkOrderOperationDemo(wo.id, opId, 'Held from shopfloor'), 'Operation held')}
              onResume={(opId) => void run(() => resumeWorkOrderOperationDemo(wo.id, opId), 'Operation resumed')}
              onComplete={(opId, qty, scrap, rework, rejected) =>
                void run(
                  () => completeWorkOrderOperationDemo(wo.id, opId, {
                    completedQty: qty,
                    scrapQty: scrap,
                    reworkQty: rework,
                    rejectedQty: rejected,
                  }),
                  'Operation completed',
                )}
              onSendQc={(opId) => void run(() => sendWorkOrderOperationToQcDemo(wo.id, opId), 'Sent to QC')}
              onQc={(opId, result) => void run(() => resolveWorkOrderOperationQcDemo(wo.id, opId, result), `QC ${result}`)}
              onJobWork={(opId, action) =>
                void run(() => markWorkOrderOperationJobWorkDemo(wo.id, opId, action), action === 'send' ? 'Sent to job work' : 'Received from job work')}
            />
          </section>
        ) : null}

        {tab === 'materials' ? (
          <section className="space-y-3 rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={!perms.canViewMaterials || readOnly || busy} onClick={() => setDialog('check')}>Check Availability</Button>
              <Button size="sm" variant="secondary" disabled={!perms.canReserveMaterials || readOnly || busy} onClick={() => void run(async () => { const r = await reserveWorkOrderMaterialsDemo(wo.id); return { ok: r.ok, error: r.error } }, 'Materials reserved')}>Reserve</Button>
              <Button size="sm" variant="secondary" disabled={!perms.canReserveMaterials || readOnly || busy} onClick={() => void run(() => releaseWorkOrderReservationsDemo(wo.id), 'Reservation released')}>Release</Button>
              <Button size="sm" variant="secondary" disabled={!perms.canCreateRequirement || readOnly || busy} onClick={() => void run(async () => createPurchaseRequisitionFromShortageDemo(wo.id), 'PR draft created')}>Create PR</Button>
              <Button size="sm" variant="secondary" disabled={!perms.canCreateRequirement || readOnly || busy} onClick={() => void run(async () => createTransferFromShortageDemo(wo.id), 'Transfer draft created')}>Transfer Draft</Button>
              {settings?.materialConsumption.manualMaterialIssue ? (
                <Button size="sm" variant="secondary" disabled={!perms.canIssueMaterials || readOnly} onClick={() => setDialog('issue')}>Issue Material</Button>
              ) : null}
            </div>
            {/* Mobile: material cards */}
            <ul className="space-y-2 md:hidden">
              {mats.length === 0 ? (
                <li className="rounded-lg border border-dashed border-erp-border px-3 py-8 text-center text-[13px] text-erp-muted">
                  No material lines
                </li>
              ) : (
                mats.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      'rounded-xl border border-erp-border p-3',
                      m.shortageQty > 0 ? 'border-amber-200 bg-amber-50/50' : 'bg-white',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[14px] font-semibold">{m.componentItemCode}</p>
                        <p className="text-[12px] text-erp-muted">{m.componentItemName}</p>
                      </div>
                      <StatusDot tone={statusToneFromLabel(m.status)} label={WO_MATERIAL_STATUS_LABELS[m.status]} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                      <div>
                        <dt className="text-erp-muted">Required</dt>
                        <dd className="font-semibold tabular-nums">{m.requiredQty} {m.uom}</dd>
                      </div>
                      <div>
                        <dt className="text-erp-muted">Available</dt>
                        <dd className="font-semibold tabular-nums">{m.availableQty}</dd>
                      </div>
                      <div>
                        <dt className="text-erp-muted">Shortage</dt>
                        <dd className={cn('font-semibold tabular-nums', m.shortageQty > 0 && 'text-amber-800')}>{m.shortageQty}</dd>
                      </div>
                      <div>
                        <dt className="text-erp-muted">Warehouse</dt>
                        <dd className="font-medium">{m.warehouseName || '—'}</dd>
                      </div>
                    </dl>
                  </li>
                ))
              )}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <DataTable columns={materialColumns as never} data={mats} />
            </div>
          </section>
        ) : null}

        {tab === 'production' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Production quantities</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Planned Qty" value={wo.plannedQty} />
                <Field label="Good Qty" value={wo.producedQty} />
                <Field label="Scrap Qty" value={wo.scrapQty} />
                <Field label="Rework Qty" value={wo.reworkQty} />
                <Field label="Rejected Qty" value={wo.rejectedQty} />
                <Field label="Remaining" value={wo.remainingQty} />
                <Field label="Start" value={wo.startedAt ? formatDateTime(wo.startedAt) : '—'} />
                <Field label="End" value={wo.completedAt ? formatDateTime(wo.completedAt) : '—'} />
                <Field label="Operator / Line" value={getWorkOrderOwnerLine(wo)} />
                <Field label="Completion notes" value={wo.notes || '—'} />
              </div>
              {!readOnly && wo.status === 'in_progress' ? (
                <Button className="mt-4" onClick={() => setDialog('complete')}>Complete Production</Button>
              ) : null}
            </div>
            <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Output history</h3>
              {outputs.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No production output recorded yet.</p>
              ) : (
                <ul className="divide-y divide-erp-border text-[13px]">
                  {outputs.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2 py-2">
                      <span>{formatDateTime(o.at)} · Good {o.goodQty} · Scrap {o.scrapQty} · Rework {o.reworkQty}</span>
                      <span className="text-erp-muted">{o.userName}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={!perms.canRecordScrap || readOnly} onClick={() => setDialog('scrap')}>Record Scrap</Button>
                <Button size="sm" variant="secondary" disabled={!perms.canManageRework || readOnly} onClick={() => setDialog('rework')}>Record Rework</Button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'quality' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <Field label="QC Required" value={wo.qualityRequired ? 'Yes' : 'No'} />
            {!wo.qualityRequired ? (
              <p className="mt-3 text-[13px] text-erp-muted">QC is not required for this item. Close after Completed.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-[13px]">
                  Current: <strong>{WO_QC_STATUS_LABELS[qcStatus]}</strong>
                  {quality ? ` · Review ${quality.result}` : ''}
                </p>
                {quality && quality.result === 'pending' && perms.canInspectQuality ? (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setDialog('quality')}>Open QC Action</Button>
                  </div>
                ) : canSendQc ? (
                  <Button disabled={busy} onClick={() => void run(() => sendWorkOrderToQcDemo(wo.id), 'Sent to QC')}>Send to QC</Button>
                ) : (
                  <p className="text-[13px] text-erp-muted">No pending QC review.</p>
                )}
              </div>
            )}
          </section>
        ) : null}

        {tab === 'job_work' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {jobWorks.length === 0 ? (
              <div className="text-center">
                <p className="text-[13px] text-erp-muted">No job-work documents linked to this work order.</p>
                {perms.canCreateJobWork ? (
                  <Button className="mt-3" variant="secondary" onClick={() => navigate(`/manufacturing/job-work/new?workOrderId=${wo.id}`)}>
                    Create Job Work
                  </Button>
                ) : null}
              </div>
            ) : (
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>JW No</th>
                    <th>Vendor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobWorks.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <TableLink to={`/manufacturing/job-work/${j.id}`} className="font-semibold">
                          {j.jwNumber}
                        </TableLink>
                      </td>
                      <td>{j.vendorName}</td>
                      <td className="capitalize">{j.status.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}

        {tab === 'costing' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {!perms.canViewCost ? (
              <p className="text-[13px] text-erp-muted">Cost hidden by permission.</p>
            ) : costPreview ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <dl className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><dt className="text-erp-muted">Material</dt><dd className="tabular-nums">{formatCurrency(costPreview.materialCost)}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Labour</dt><dd className="tabular-nums">{formatCurrency(costPreview.labourCost)}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Machine</dt><dd className="tabular-nums">{formatCurrency(costPreview.machineCost)}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Job Work</dt><dd className="tabular-nums">{formatCurrency(costPreview.jobWorkCost)}</dd></div>
                  <div className="flex justify-between border-t border-erp-border pt-2 font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatCurrency(costPreview.totalProductionCost)}</dd>
                  </div>
                  <div className="flex justify-between text-erp-muted">
                    <dt>Per good unit</dt>
                    <dd className="tabular-nums">{formatCurrency(costPreview.costPerGoodUnit)}</dd>
                  </div>
                </dl>
                {variancePreview ? (
                  <dl className="space-y-2 text-[13px]">
                    <Field label="Planned vs Consumed Material" value={`${variancePreview.plannedMaterial} / ${variancePreview.consumedMaterial}`} />
                    <Field label="Planned vs Actual Output" value={`${variancePreview.plannedOutput} / ${variancePreview.actualOutput}`} />
                    <Field label="Yield Diff" value={variancePreview.yieldDiff} />
                    <Field label="Scrap Diff" value={variancePreview.scrapDiff} />
                  </dl>
                ) : null}
              </div>
            ) : (
              <LoadingState variant="card" rows={3} />
            )}
          </section>
        ) : null}

        {tab === 'timeline' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {acts.length === 0 ? (
              <p className="text-center text-[13px] text-erp-muted">No activities yet.</p>
            ) : (
              <ol className="space-y-3">
                {acts.map((a) => (
                  <li key={a.id} className="flex gap-3 border-b border-erp-border/70 pb-3 last:border-0">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-erp-primary" />
                    <div>
                      <p className="text-[13px] font-semibold text-erp-text">{a.action}</p>
                      <p className="text-[12px] text-erp-muted">
                        {a.userName} · {formatDateTime(a.at)}
                        {a.quantity != null ? ` · Qty ${a.quantity}` : ''}
                      </p>
                      {a.comment ? <p className="text-[12px] text-erp-text">{a.comment}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {tab === 'documents' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <Field label="Notes" value={wo.notes || 'No notes'} />
            <p className="mt-4 text-[13px] text-erp-muted">
              Attachments are demo-only until the manufacturing API ships. Source document: {wo.sourceDocumentNo || '—'}.
            </p>
            {wo.salesOrderId ? (
              <p className="mt-2 text-[13px]">
                Sales order:{' '}
                <TableLink to={`/sales/orders/${wo.salesOrderId}`}>{wo.salesOrderNo}</TableLink>
              </p>
            ) : null}
          </section>
        ) : null}

        <ManufacturingStickyActionSpacer />
      </div>
      </ManufacturingAiRail>

      {!readOnly && (canStart || canHold || canResume || canComplete || canQcAction || canClose) ? (
        <ManufacturingStickyActionBar className="lg:hidden">
          {canStart ? (
            <MfgTouchBtn variant="primary" disabled={busy} onClick={() => setDialog('start')}>
              <Play className="h-4 w-4" /> Start
            </MfgTouchBtn>
          ) : null}
          {canHold ? (
            <MfgTouchBtn variant="secondary" disabled={busy} onClick={() => setDialog('hold')}>
              <Pause className="h-4 w-4" /> Hold
            </MfgTouchBtn>
          ) : null}
          {canResume ? (
            <MfgTouchBtn variant="primary" disabled={busy} onClick={() => setDialog('resume')}>
              <Play className="h-4 w-4" /> Resume
            </MfgTouchBtn>
          ) : null}
          {canComplete ? (
            <MfgTouchBtn variant="primary" disabled={busy} onClick={() => setDialog('complete')}>
              <CheckCircle2 className="h-4 w-4" /> Complete
            </MfgTouchBtn>
          ) : null}
          {canQcAction ? (
            <MfgTouchBtn variant="primary" disabled={busy} onClick={() => setDialog('quality')}>
              <ShieldCheck className="h-4 w-4" /> QC Accept
            </MfgTouchBtn>
          ) : null}
          {canClose ? (
            <MfgTouchBtn variant="secondary" disabled={busy} onClick={() => setDialog('close')}>
              <CheckCircle2 className="h-4 w-4" /> Close
            </MfgTouchBtn>
          ) : null}
        </ManufacturingStickyActionBar>
      ) : null}

      {/* Quick action drawers */}
      <CheckMaterialDrawer
        open={dialog === 'check'}
        onClose={() => setDialog(null)}
        woNumber={wo.woNumber}
        materials={mats}
        busy={busy}
        canReserve={canReserve}
        canCreatePr={perms.canCreateRequirement && !readOnly}
        onReserve={() => void run(async () => {
          const r = await reserveWorkOrderMaterialsDemo(wo.id)
          return { ok: r.ok, error: r.error }
        }, 'Materials reserved')}
        onCreatePr={() => void run(async () => createPurchaseRequisitionFromShortageDemo(wo.id), 'PR draft created')}
        onRecheck={() => {
          setDialog(null)
          queueMicrotask(() => setDialog('check'))
        }}
      />

      <StartProductionDrawer
        open={dialog === 'start'}
        onClose={() => setDialog(null)}
        woNumber={wo.woNumber}
        busy={busy}
        warnings={startWarnings}
        initial={{
          startAt,
          operator: supervisor,
          machineLine: workstation,
          shift,
          remarks,
        }}
        onConfirm={(v) => {
          setSupervisor(v.operator)
          setWorkstation(v.machineLine)
          setShift(v.shift)
          setStartAt(v.startAt)
          setRemarks(v.remarks)
          void run(async () => {
            const r = await startWorkOrderDemo({
              workOrderId: wo.id,
              startAt: new Date(v.startAt).toISOString(),
              supervisor: v.operator,
              shift: v.shift,
              workstation: v.machineLine,
              remarks: v.remarks,
            })
            setStartWarnings(r.warnings)
            return { ok: r.ok, error: r.error, warnings: r.warnings }
          }, 'Production started')
        }}
      />

      <HoldWorkOrderDrawer
        open={dialog === 'hold'}
        onClose={() => setDialog(null)}
        woNumber={wo.woNumber}
        busy={busy}
        onConfirm={(v) => {
          setExpectedResume(v.expectedResumeDate)
          setRemarks(v.remarks)
          void run(
            () => holdWorkOrderDemo({
              workOrderId: wo.id,
              holdAt: new Date().toISOString(),
              reason: v.reason,
              expectedResumeDate: v.expectedResumeDate || undefined,
              remarks: v.remarks,
            }),
            'Work order on hold',
          )
        }}
      />

      <CompleteProductionDrawer
        open={dialog === 'complete'}
        onClose={() => setDialog(null)}
        wo={wo}
        busy={busy}
        defaultAutoConsume={settings?.materialConsumption.automaticConsumption ?? wo.consumptionMode === 'automatic'}
        onConfirm={(v) => {
          setRemarks(v.remarks)
          void run(
            async () => completeProductionQuantityDemo(wo.id, {
              goodQty: v.goodQty,
              scrapQty: v.scrapQty,
              reworkQty: v.reworkQty,
              rejectedQty: v.rejectedQty,
              productionDate: v.completionAt.slice(0, 10),
              comment: v.remarks,
              autoConsume: v.autoConsume,
              differenceReason: differenceReason || undefined,
            }),
            'Production completed',
          )
        }}
      />

      <QcActionDrawer
        open={dialog === 'quality'}
        onClose={() => setDialog(null)}
        woNumber={wo.woNumber}
        review={quality}
        busy={busy}
        onAction={(action, v) => {
          void run(
            () => updateProductionQualityResultDemo(wo.id, {
              result: action,
              acceptedQty: v.acceptedQty,
              rejectedQty: v.rejectedQty,
              reworkQty: v.reworkQty,
              remarks: v.remarks,
              inspector: 'QC User',
            }),
            action === 'accepted' ? 'QC Accepted' : action === 'rejected' ? 'QC Rejected' : 'Sent to Rework',
          )
        }}
      />

      <CloseWorkOrderDrawer
        open={dialog === 'close'}
        onClose={() => setDialog(null)}
        wo={wo}
        preview={closingPreview}
        cost={costPreview}
        busy={busy}
        onConfirm={() => void run(async () => {
          if (closingPreview && Math.abs(closingPreview.materialDifference) > 0.01) {
            return closeWorkOrderWithDifferenceDemo(wo.id, differenceReason || 'Approved difference')
          }
          return closeWorkOrderDemo(wo.id)
        }, 'Work order closed')}
      />

      <Modal open={dialog === 'resume'} onClose={() => setDialog(null)} title="Resume Production" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => resumeWorkOrderDemo({ workOrderId: wo.id, resumeAt: new Date().toISOString(), resolutionNote: remarks }), 'Production resumed')}>Resume</Button>
        </div>
      )}>
        <FormField label="Resolution Note"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} /></FormField>
      </Modal>

      <Modal open={dialog === 'cancel'} onClose={() => setDialog(null)} title="Cancel Work Order" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Back</Button>
          <Button disabled={busy || !perms.canCancelWo} onClick={() => void run(() => cancelWorkOrderDemo(wo.id, remarks), 'Cancelled')}>Confirm Cancel</Button>
        </div>
      )}>
        <FormField label="Reason"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} /></FormField>
      </Modal>

      <Modal open={dialog === 'issue'} onClose={() => setDialog(null)} title="Material Issue" size="lg" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => confirmManualMaterialIssueDemo(wo.id, issueLines.map((l) => ({ materialId: l.id, issueQty: l.issueQty, batchOrSerial: l.batchOrSerial }))), 'Material issued')}>Confirm Issue</Button>
        </div>
      )}>
        <ul className="space-y-2 text-[13px]">
          {issueLines.map((l, idx) => (
            <li key={l.id} className="grid gap-2 border-b border-erp-border pb-2 sm:grid-cols-3">
              <span className="font-medium">{l.componentItemCode} · pending {l.pendingQty}</span>
              <FormField label="Issue Qty"><Input type="number" value={l.issueQty} onChange={(e) => { const next = [...issueLines]; next[idx] = { ...l, issueQty: Number(e.target.value) }; setIssueLines(next) }} /></FormField>
              <FormField label="Batch/Serial"><Input value={l.batchOrSerial ?? ''} onChange={(e) => { const next = [...issueLines]; next[idx] = { ...l, batchOrSerial: e.target.value }; setIssueLines(next) }} /></FormField>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={dialog === 'return'} onClose={() => setDialog(null)} title="Return Unused Material" size="lg" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => returnUnusedMaterialDemo(wo.id, returnLines.map((l) => ({ materialId: l.id, returnQty: l.returnQty, reason: l.reason }))), 'Material returned')}>Confirm Return</Button>
        </div>
      )}>
        <ul className="space-y-2 text-[13px]">
          {returnLines.map((l, idx) => (
            <li key={l.id} className="grid gap-2 border-b border-erp-border pb-2 sm:grid-cols-3">
              <span>{l.componentItemCode} · returnable {l.returnableQty}</span>
              <FormField label="Return Qty"><Input type="number" value={l.returnQty} onChange={(e) => { const next = [...returnLines]; next[idx] = { ...l, returnQty: Number(e.target.value) }; setReturnLines(next) }} /></FormField>
              <FormField label="Reason"><Input value={l.reason ?? ''} onChange={(e) => { const next = [...returnLines]; next[idx] = { ...l, reason: e.target.value }; setReturnLines(next) }} /></FormField>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={dialog === 'scrap'} onClose={() => setDialog(null)} title="Record Scrap" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => recordProductionScrapDemo(wo.id, { scrapQty, reason: scrapReason, remarks }), 'Scrap recorded')}>Save Scrap</Button>
        </div>
      )}>
        <div className="grid gap-3">
          <FormField label="Scrap Quantity" required><Input type="number" min={0} value={scrapQty} onChange={(e) => setScrapQty(Number(e.target.value))} /></FormField>
          <FormField label="Reason"><Select value={scrapReason} onChange={(e) => setScrapReason(e.target.value as ScrapReason)}>{(Object.keys(SCRAP_REASON_LABELS) as ScrapReason[]).map((r) => <option key={r} value={r}>{SCRAP_REASON_LABELS[r]}</option>)}</Select></FormField>
          <FormField label="Remarks"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></FormField>
        </div>
      </Modal>

      <Modal open={dialog === 'rework'} onClose={() => setDialog(null)} title="Record Rework" footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void run(() => createProductionReworkDemo(wo.id, { reworkQty, reason: remarks || 'Rework', expectedCompletionDate: expectedResume || productionDate, workstation, remarks }), 'Rework created')}>Create Rework</Button>
        </div>
      )}>
        <div className="grid gap-3">
          <FormField label="Rework Quantity" required><Input type="number" min={0} value={reworkQty} onChange={(e) => setReworkQty(Number(e.target.value))} /></FormField>
          <FormField label="Expected Completion"><Input type="date" value={expectedResume} onChange={(e) => setExpectedResume(e.target.value)} /></FormField>
          <FormField label="Workstation"><Input value={workstation} onChange={(e) => setWorkstation(e.target.value)} /></FormField>
          <FormField label="Reason / Remarks"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></FormField>
        </div>
      </Modal>
    </OperationalPageShell>
  )
}
