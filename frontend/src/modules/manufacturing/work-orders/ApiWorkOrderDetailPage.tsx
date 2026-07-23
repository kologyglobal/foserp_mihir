import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Package,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  ShieldAlert,
  Truck,
  UserPlus,
  AlertTriangle,
  Pencil,
  X,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot } from '@/components/design-system/StatusDot'
import { ErpCommandBar, type ErpCommandAction } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  cancelWorkOrder,
  completeStage,
  completeWorkOrder,
  getWorkOrderActivities,
  getWorkOrderDetail,
  getWorkOrderLedger,
  getWorkOrderMaterialsReadiness,
  getAssignmentHistory,
  holdWorkOrder,
  issueWorkOrderMaterial,
  listIssues,
  listWorkOrderAssignments,
  listWorkOrderMaterials,
  createWorkOrderShortageRequisition,
  recordProgress,
  releaseWorkOrder,
  reserveWorkOrderMaterials,
  resumeWorkOrder,
  returnWorkOrderMaterial,
  startWorkOrder,
  splitWorkOrder,
  syncWorkOrderMaterialRequirements,
  removeWorkOrderMaterialRequirement,
  removeWorkOrderBomLine,
  addWorkOrderBomLine,
  updateWorkOrderBomLine,
  createRuntimeChange,
  applyRuntimeChange,
  listRuntimeChanges,
  submitRuntimeChange,
  approveRuntimeChange,
  rejectRuntimeChange,
  cancelRuntimeChange,
  listWipMovements,
  listFgReceipts,
  startAssignment,
  pauseAssignment,
  resumeAssignment,
  listMachines,
  listWorkCentres,
} from '@/services/api/manufacturingApi'
import { getWorkOrderQualityBlockers, listInspections, type QualityBlocker, type QualityInspection } from '@/services/api/qualityApi'
import type {
  HoldReasonCategory,
  ProductionActivityEntry,
  ProductionOrderMaterial,
  ProductionStageLedgerEntry,
  WorkOrderDetail,
  WorkOrderFgReceiptSummary,
} from '@/types/manufacturingProduction'
import {
  HOLD_REASON_CATEGORY_LABELS,
  HOLD_REASON_CATEGORY_VALUES,
} from '@/types/manufacturingProduction'
import type { RuntimeChangeType } from '@/types/manufacturingRuntimeChange'
import { useSetupLookup } from '../setup/useSetupLookups'
import {
  useManufacturingWorkOrderPermissions,
  useManufacturingPhase2bPermissions,
  canApplyRuntimeChange,
  canApproveRuntimeChange,
  canRejectRuntimeChange,
  canRequestRuntimeChange,
  canViewRuntimeChanges,
  canMoveWip,
  canTransferMaterials,
  canViewCorrections,
  canRequestCorrection,
  canViewCost,
} from '@/utils/permissions/manufacturing'
import { WorkOrderCostingPanel } from './WorkOrderCostingPanel'
import { notify } from '@/store/toastStore'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import {
  DocumentFormSection,
  DocumentInfoPanel,
  DocumentSummaryStrip,
  FulfilmentJourneyStrip,
  NextBestActionBanner,
  WorkOrderHealthBadge,
  WorkOrderStatusBadge,
  assignmentStatusMeta,
  deriveWoFulfilmentJourney,
  getFulfilmentAutoMode,
  materialControlMeta,
  materialLineMeta,
  qualityStatusMeta,
  stageStatusMeta,
  type NextBestAction,
} from '../ui'
import { RecordProgressDrawer } from './components/RecordProgressDrawer'
import { CompleteStageModal } from './components/CompleteStageModal'
import { StageQcPanel } from './components/StageQcPanel'
import { MaterialIssueDrawer, MaterialReturnDrawer } from './components/MaterialActionDrawers'
import { FgReceiptDrawer } from './components/FgReceiptDrawer'
import { CompleteWorkOrderDialog } from './components/CompleteWorkOrderDialog'
import { AssignmentDrawer } from './components/AssignmentDrawer'
import { AssignmentHistory } from './components/AssignmentHistory'
import { IssueStatusBadge } from '../issues/IssueStatusBadge'
import type { ProductionAssignment, ProductionIssue } from '@/types/manufacturingPhase2b'
import { ISSUE_SEVERITY_LABELS, ISSUE_TYPE_LABELS } from '@/types/manufacturingPhase2b'
import { t } from '../i18n/operatorStrings'
import { RuntimeChangeDrawer } from './RuntimeChangeDrawer'
import { MaterialRequirementDrawer } from './MaterialRequirementDrawer'
import { WorkOrderBomSnapshotPanel } from './WorkOrderBomSnapshotPanel'
import { WipTransferDrawer } from './WipTransferDrawer'
import { CorrectionDrawer } from '../corrections/CorrectionDrawer'
import type { RuntimeChange } from '@/types/manufacturingRuntimeChange'
import { RUNTIME_CHANGE_STATUS_LABELS, RUNTIME_CHANGE_TYPE_LABELS } from '@/types/manufacturingRuntimeChange'
import type { WipMovement } from '@/types/manufacturingWipMovement'
import { WIP_MOVEMENT_STATUS_LABELS, WIP_MOVEMENT_TYPE_LABELS } from '@/types/manufacturingWipMovement'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { fetchAdminUsersApi } from '@/services/api/adminApi'
import { ManufacturingActionDrawer } from '@/components/manufacturing/ManufacturingActionDrawer'

type DetailTab =
  | 'overview'
  | 'stages'
  | 'materials'
  | 'issues'
  | 'changes'
  | 'timeline'
  | 'assignments'
  | 'transfers'
  | 'bom'
  | 'ledger'
  | 'costing'

const PRIMARY_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'stages', label: 'Route' },
  { id: 'bom', label: 'BOM' },
  { id: 'materials', label: 'Materials' },
  { id: 'issues', label: 'Quality' },
  { id: 'changes', label: 'Changes' },
  { id: 'timeline', label: 'Timeline' },
]

const MORE_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'assignments', label: 'Assignments' },
  { id: 'transfers', label: 'Job Work / Transfers' },
  { id: 'costing', label: 'Costing' },
  { id: 'ledger', label: 'Documents / Ledger' },
]

function asListArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as { items?: unknown; data?: unknown; blockers?: unknown }
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.data)) return obj.data as T[]
    if (Array.isArray(obj.blockers)) return obj.blockers as T[]
  }
  return []
}

type Dialog = null | 'hold' | 'resume' | 'complete' | 'cancel'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-erp-muted">{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-snug text-erp-text">{value ?? '—'}</div>
    </div>
  )
}

function personLabel(id: string | null | undefined, names: Record<string, string>): string {
  if (!id) return '—'
  return names[id] ?? 'Assigned'
}

function sourceLabel(wo: WorkOrderDetail): string {
  const related = wo.relatedSalesOrder
  if (related) {
    const company = related.customerName || related.customerCode
    return company ? `Sales Order · ${related.salesOrderNo} · ${company}` : `Sales Order · ${related.salesOrderNo}`
  }
  const source = wo.sourceType === 'SALES_ORDER' ? 'Sales Order' : wo.sourceType.replace(/_/g, ' ')
  if (wo.jobNumber) return `${source} · Job ${wo.jobNumber}`
  return source
}

function currentStageLabel(wo: WorkOrderDetail): string {
  if (wo.currentStageCode || wo.currentStageName) {
    return [wo.currentStageCode, wo.currentStageName].filter(Boolean).join(' · ')
  }
  if (!wo.currentStageId) return '—'
  const stage = wo.stages.find((s) => s.id === wo.currentStageId)
  return stage ? `${stage.code} · ${stage.name}` : '—'
}

/** Live progress for Overview — pipeline + current-stage qty (WO FG qty only rolls up on final stage). */
function deriveLiveProgress(wo: WorkOrderDetail) {
  const stages = [...(wo.stages ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  const stagesDone = stages.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length
  const stagesTotal = stages.length
  const pipelinePct =
    stagesTotal > 0
      ? Math.round((stagesDone / stagesTotal) * 100)
      : Math.min(100, Math.max(0, Math.round(Number(wo.completionPercent) || 0)))
  const current =
    (wo.currentStageId ? stages.find((s) => s.id === wo.currentStageId) : undefined) ??
    stages.find((s) => s.status === 'IN_PROGRESS' || s.status === 'READY' || s.status === 'QC_PENDING') ??
    null
  const useStageQty = Boolean(current) && wo.status === 'IN_PROGRESS'
  return {
    pipelinePct,
    stagesDone,
    stagesTotal,
    current,
    planned: useStageQty ? current!.plannedQuantity : wo.plannedQuantity,
    good: useStageQty ? current!.goodQuantity : wo.completedGoodQuantity,
    rework: useStageQty ? current!.reworkQuantity : wo.reworkQuantity,
    rejected: useStageQty ? current!.rejectedQuantity : wo.rejectedQuantity,
    scrap: useStageQty ? current!.scrapQuantity : wo.scrapQuantity,
    fgGood: wo.completedGoodQuantity,
    qtyScope: useStageQty ? ('stage' as const) : ('order' as const),
  }
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-erp-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function RouteProgress({
  stages,
  currentStageId,
}: {
  stages: WorkOrderDetail['stages']
  currentStageId: string | null
}) {
  if (!stages.length) return null
  const sorted = [...stages].sort((a, b) => a.displayOrder - b.displayOrder)
  const currentIndex = sorted.findIndex((s) => s.id === currentStageId)

  return (
    <div className="space-y-3">
      <ol
        className="flex items-stretch overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Routing progress"
      >
        {sorted.map((stage, index) => {
          const meta = stageStatusMeta(stage.status)
          const isCurrent = stage.id === currentStageId
          const done = stage.status === 'COMPLETED' || stage.status === 'SKIPPED'
          const blocked = stage.status === 'ON_HOLD' || stage.status === 'BLOCKED'
          const qc = stage.status === 'QC_PENDING'
          const isFirst = index === 0
          const isLast = index === sorted.length - 1
          const connectorDone = done || (currentIndex >= 0 && index < currentIndex)

          const clip = isFirst
            ? '[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]'
            : isLast
              ? '[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,12px_50%)]'
              : '[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)]'

          return (
            <li
              key={stage.id}
              className={cn('relative flex min-w-[9.25rem] flex-1', !isFirst && '-ml-2.5')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div
                className={cn(
                  'relative z-[1] flex w-full flex-col justify-center gap-1 py-3 pl-5 pr-6',
                  clip,
                  done && 'bg-emerald-500 text-white',
                  blocked && !done && 'bg-amber-500 text-white',
                  qc && !done && !blocked && 'bg-violet-600 text-white',
                  isCurrent && !done && !blocked && !qc && 'bg-sky-600 text-white shadow-md ring-2 ring-sky-200 ring-offset-1',
                  !done && !isCurrent && !blocked && !qc && 'bg-slate-100 text-erp-text',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                      done || blocked || qc || isCurrent
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200',
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'truncate rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                      done || blocked || qc || isCurrent
                        ? 'bg-white/15 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200/80',
                    )}
                  >
                    {isCurrent && !done && !blocked && !qc ? 'Current' : meta.label}
                  </span>
                </div>
                <div className={cn('min-w-0', isFirst ? 'pl-0' : 'pl-1')}>
                  <p
                    className={cn(
                      'truncate font-mono text-[12px] font-semibold',
                      done || blocked || qc || isCurrent ? 'text-white' : 'text-erp-text',
                    )}
                  >
                    {stage.code}
                  </p>
                  <p
                    className={cn(
                      'truncate text-[11px] leading-snug',
                      done || blocked || qc || isCurrent ? 'text-white/85' : 'text-erp-muted',
                    )}
                  >
                    {stage.name}
                  </p>
                </div>
              </div>
              {/* Subtle depth edge so chevrons read as a continuous process */}
              {!isLast ? (
                <span
                  className={cn(
                    'pointer-events-none absolute right-0 top-1/2 z-[2] h-0 w-0 -translate-y-1/2 translate-x-[1px]',
                    'border-y-[14px] border-y-transparent border-l-[10px]',
                    connectorDone
                      ? done
                        ? 'border-l-emerald-600/40'
                        : 'border-l-sky-700/30'
                      : 'border-l-slate-300/60',
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium text-erp-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" aria-hidden />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-sky-600" aria-hidden />
          Current
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-amber-500" aria-hidden />
          Hold / Blocked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-violet-600" aria-hidden />
          QC
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-slate-200 ring-1 ring-slate-300" aria-hidden />
          Upcoming
        </span>
      </div>
    </div>
  )
}

function stageProgressPct(stage: WorkOrderDetail['stages'][number]): number {
  const planned = Number(stage.plannedQuantity)
  const good = Number(stage.goodQuantity)
  if (!Number.isFinite(planned) || planned <= 0) {
    if (stage.status === 'COMPLETED' || stage.status === 'SKIPPED') return 100
    if (stage.status === 'IN_PROGRESS' || stage.status === 'READY') return 0
    return 0
  }
  return Math.min(100, Math.max(0, Math.round((good / planned) * 100)))
}

function StagesProcessPanel({
  wo,
  busy,
  canExecuteStage,
  canRelease,
  canStartWo,
  canHold,
  canResume,
  canProgress,
  canEditRoute,
  openInspections,
  stageInspections,
  onRelease,
  onStartWo,
  onHold,
  onResume,
  onRecordProduction,
  onStartStage,
  onCompleteStage,
  onOverrideComplete,
  onOpenStageQc,
  onQcChanged,
  onEditRoute,
  onSaveOperationResources,
}: {
  wo: WorkOrderDetail
  busy: boolean
  canExecuteStage: boolean
  canRelease: boolean
  canStartWo: boolean
  canHold: boolean
  canResume: boolean
  canProgress: boolean
  canEditRoute: boolean
  openInspections: QualityInspection[]
  stageInspections: QualityInspection[]
  onRelease: () => void
  onStartWo: () => void
  onHold: () => void
  onResume: () => void
  onRecordProduction: () => void
  onStartStage: (stageId: string, stageName: string) => void
  onCompleteStage: (stageId: string, stageName: string) => void
  onOverrideComplete: (stageId: string, stageName: string, reason: string) => void
  onOpenStageQc: (stageId: string) => void
  onQcChanged: () => void
  onEditRoute: (seed?: { changeType?: RuntimeChangeType; operationId?: string; stageId?: string }) => void
  onSaveOperationResources: (input: {
    operationId: string
    stageId: string
    workCentreId: string | null
    machineId: string | null
  }) => Promise<void>
}) {
  const [wcLabels, setWcLabels] = useState<Record<string, string>>({})
  const [machineLabels, setMachineLabels] = useState<Record<string, string>>({})
  const [wcOptions, setWcOptions] = useState<Array<{ id: string; label: string }>>([])
  const [machineOptions, setMachineOptions] = useState<Array<{ id: string; label: string }>>([])
  const [editingOpId, setEditingOpId] = useState<string | null>(null)
  const [draftWcId, setDraftWcId] = useState('')
  const [draftMachineId, setDraftMachineId] = useState('')
  const [opSaving, setOpSaving] = useState(false)

  useEffect(() => {
    void Promise.all([
      listWorkCentres({ limit: 100 }).then((r) => {
        const map: Record<string, string> = {}
        const opts: Array<{ id: string; label: string }> = []
        for (const row of r.data) {
          const label = `${row.code} — ${row.name}`
          map[row.id] = label
          opts.push({ id: row.id, label })
        }
        setWcLabels(map)
        setWcOptions(opts)
      }),
      listMachines({ limit: 100 }).then((r) => {
        const map: Record<string, string> = {}
        const opts: Array<{ id: string; label: string }> = []
        for (const row of r.data) {
          const label = `${row.code} — ${row.name}`
          map[row.id] = label
          opts.push({ id: row.id, label })
        }
        setMachineLabels(map)
        setMachineOptions(opts)
      }),
    ]).catch(() => undefined)
  }, [])

  const sorted = useMemo(
    () => [...wo.stages].sort((a, b) => a.displayOrder - b.displayOrder),
    [wo.stages],
  )
  const opsByStage = useMemo(() => {
    const map = new Map<string, WorkOrderDetail['operations']>()
    for (const op of wo.operations ?? []) {
      const list = map.get(op.stageId) ?? []
      list.push(op)
      map.set(op.stageId, list)
    }
    for (const [id, list] of map) {
      map.set(
        id,
        [...list].sort((a, b) => a.sequence - b.sequence),
      )
    }
    return map
  }, [wo.operations])

  const completedCount = sorted.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length
  const current = sorted.find((s) => s.id === wo.currentStageId) ?? null
  const overallPct = sorted.length === 0 ? 0 : Math.round((completedCount / sorted.length) * 100)
  const labelWc = (id: string | null) => (id ? wcLabels[id] ?? id.slice(0, 8) : '—')
  const labelMachine = (id: string | null) => (id ? machineLabels[id] ?? id.slice(0, 8) : '—')

  const beginOpEdit = (op: WorkOrderDetail['operations'][number]) => {
    setEditingOpId(op.id)
    setDraftWcId(op.workCentreId ?? '')
    setDraftMachineId(op.machineId ?? '')
  }

  const cancelOpEdit = () => {
    setEditingOpId(null)
    setDraftWcId('')
    setDraftMachineId('')
  }

  const saveOpEdit = async (op: WorkOrderDetail['operations'][number], stageId: string) => {
    setOpSaving(true)
    try {
      await onSaveOperationResources({
        operationId: op.id,
        stageId,
        workCentreId: draftWcId || null,
        machineId: draftMachineId || null,
      })
      cancelOpEdit()
    } finally {
      setOpSaving(false)
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-erp-border bg-white px-4 py-12 text-center text-[13px] text-erp-muted">
        No route yet — release the work order to snapshot the routing and compute stage readiness.
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Route for this work order
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-erp-text">
              {completedCount} of {sorted.length} stages complete
              {current ? (
                <span className="ml-2 text-[13px] font-medium text-erp-muted">
                  · Current: <span className="text-erp-text">{current.code}</span> {current.name}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-[12px] text-erp-muted">
              {wo.routingSnapshot
                ? `Routing snapshot v${wo.routingSnapshot.routingVersionNumber} · locked ${formatDateTime(wo.routingSnapshot.snapshotAt)}. Click Edit on a row to change work centre / machine for this WO.`
                : 'Routing not yet snapshotted. After release, edit work centre and machine directly on each operation row.'}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {canEditRoute ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onEditRoute({ changeType: 'ADD_OPERATION' })}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit route
              </Button>
            ) : null}
            <div className="min-w-[160px] flex-1 sm:max-w-xs">
              <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                <span>Pipeline</span>
                <span className="tabular-nums text-erp-text">{overallPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-erp-border pt-3">
          {canRelease ? (
            <Button size="sm" disabled={busy} onClick={onRelease}>
              Release
            </Button>
          ) : null}
          {canStartWo ? (
            <Button size="sm" disabled={busy} onClick={onStartWo}>
              Start
            </Button>
          ) : null}
          {canHold ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onHold}>
              Hold
            </Button>
          ) : null}
          {canResume ? (
            <Button size="sm" disabled={busy} onClick={onResume}>
              Resume
            </Button>
          ) : null}
          {canProgress ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onRecordProduction}>
              Record Production
            </Button>
          ) : null}
          {!canRelease && !canStartWo && !canHold && !canResume && !canProgress ? (
            <p className="text-[12px] text-erp-muted">No lifecycle actions available for status {wo.status}.</p>
          ) : null}
        </div>
      </div>

      <ol className="relative space-y-0" aria-label="Work order stages">
        {sorted.map((stage, index) => {
          const stageMeta = stageStatusMeta(stage.status)
          const stageOps = opsByStage.get(stage.id) ?? []
          const isCurrent = wo.currentStageId === stage.id
          const stageDone = stage.status === 'COMPLETED' || stage.status === 'SKIPPED'
          const blocked = stage.status === 'ON_HOLD' || stage.status === 'BLOCKED'
          const isLast = index === sorted.length - 1
          const pct = stageProgressPct(stage)
          const canStartStage =
            ['READY', 'NOT_STARTED'].includes(stage.status) &&
            ((wo.status === 'READY' && canStartWo) || (wo.status === 'IN_PROGRESS' && canExecuteStage))
          const stageHasPassedQc = stageInspections.some(
            (i) => i.stageId === stage.id && i.status === 'PASSED',
          )
          const stageNeedsDeferredQc =
            stage.status === 'COMPLETED' && stage.qualityRequired && !stageHasPassedQc
          const canCompleteStage =
            (['READY', 'IN_PROGRESS', 'QC_PENDING'].includes(stage.status) || stageNeedsDeferredQc) &&
            canExecuteStage &&
            wo.status === 'IN_PROGRESS'
          const doneOps = stageOps.filter((op) => op.status === 'COMPLETED' || op.status === 'SKIPPED').length

          const nodeClass = stageDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : isCurrent
              ? 'border-sky-600 bg-sky-600 text-white ring-4 ring-sky-100'
              : blocked
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-slate-300 bg-white text-slate-500'

          const railClass = stageDone ? 'bg-emerald-400' : isCurrent ? 'bg-sky-300' : 'bg-slate-200'

          return (
            <li key={stage.id} className="relative flex gap-3 sm:gap-4" aria-current={isCurrent ? 'step' : undefined}>
              <div className="flex w-10 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    'relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border-2 text-[12px] font-bold tabular-nums',
                    nodeClass,
                  )}
                  aria-hidden
                >
                  {stageDone ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>
                {!isLast ? <span className={cn('mt-1 w-0.5 flex-1 min-h-[1.25rem]', railClass)} aria-hidden /> : null}
              </div>

              <article
                className={cn(
                  'mb-3 min-w-0 flex-1 overflow-hidden rounded-xl border bg-white shadow-sm',
                  isCurrent && 'border-sky-300 ring-1 ring-sky-100',
                  stageDone && !isCurrent && 'border-emerald-200',
                  blocked && 'border-amber-300',
                  !isCurrent && !stageDone && !blocked && 'border-erp-border',
                )}
              >
                <header
                  className={cn(
                    'flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3',
                    isCurrent ? 'border-sky-100 bg-sky-50/70' : stageDone ? 'border-emerald-50 bg-emerald-50/40' : 'border-erp-border/80 bg-slate-50/50',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-erp-muted">
                        Stage {stage.displayOrder}
                      </span>
                      {stage.code ? (
                        <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-erp-text ring-1 ring-erp-border">
                          {stage.code}
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          Current
                        </span>
                      ) : null}
                      {stage.isOptional ? (
                        <span className="text-[10px] font-medium text-erp-muted">Optional</span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-[15px] font-semibold text-erp-text">{stage.name}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-erp-muted">
                      {stageOps.length > 0 ? (
                        <span>
                          Ops {doneOps}/{stageOps.length}
                        </span>
                      ) : (
                        <span>No operations</span>
                      )}
                      {stage.startedAt ? <span>Started {formatDateTime(stage.startedAt)}</span> : null}
                      {stage.completedAt ? <span>Done {formatDateTime(stage.completedAt)}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <DynamicsStatusChip label={stageMeta.label} tone={stageMeta.tone} />
                      {stage.qualityRequired ? (
                        stageHasPassedQc ? (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                            QC cleared
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                            QC required
                          </span>
                        )
                      ) : null}
                      {stage.parallelAllowed ? (
                        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200">
                          Parallel OK
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {canStartStage ? (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => onStartStage(stage.id, stage.name)}
                        >
                          Start
                        </Button>
                      ) : null}
                      {canCompleteStage ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onCompleteStage(stage.id, stage.name)}
                        >
                          {stage.status === 'QC_PENDING' || stageNeedsDeferredQc
                            ? 'Open Stage QC'
                            : 'Complete Stage'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </header>

                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-[140px] flex-1">
                      <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                        <span>Stage qty</span>
                        <span className="tabular-nums text-erp-text">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            stageDone ? 'bg-emerald-500' : isCurrent ? 'bg-sky-500' : 'bg-slate-300',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Planned</dt>
                        <dd className="font-semibold tabular-nums text-erp-text">{stage.plannedQuantity}</dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Good</dt>
                        <dd className="font-semibold tabular-nums text-emerald-700">{stage.goodQuantity}</dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Rework</dt>
                        <dd className="font-medium tabular-nums text-erp-text">{stage.reworkQuantity}</dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Reject</dt>
                        <dd className="font-medium tabular-nums text-erp-text">{stage.rejectedQuantity}</dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Scrap</dt>
                        <dd className="font-medium tabular-nums text-erp-text">{stage.scrapQuantity}</dd>
                      </div>
                    </dl>
                  </div>

                  {stageOps.length > 0 ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-erp-border">
                      <table className="erp-table w-full text-[12px]">
                        <thead>
                          <tr className="bg-slate-50/80">
                            <th className="w-14">Seq</th>
                            <th>Operation</th>
                            <th>Work centre</th>
                            <th>Machine</th>
                            <th className="w-28">Status</th>
                            <th className="w-16 text-right">Good</th>
                            <th className="w-16 text-right">Rework</th>
                            <th className="w-16 text-right">Reject</th>
                            <th className="w-14 text-center">QC</th>
                            {canEditRoute ? <th className="w-20 text-right"> </th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {stageOps.map((op) => {
                            const opMeta = stageStatusMeta(op.status)
                            const opDone = op.status === 'COMPLETED' || op.status === 'SKIPPED'
                            const isEditing = editingOpId === op.id
                            return (
                              <tr
                                key={op.id}
                                className={cn(
                                  opDone && 'bg-emerald-50/30',
                                  op.status === 'IN_PROGRESS' && 'bg-sky-50/40',
                                  isEditing && 'bg-sky-50/60',
                                )}
                              >
                                <td className="font-mono text-[11px] tabular-nums text-erp-muted">{op.sequence}</td>
                                <td>
                                  <div className="min-w-0">
                                    <p className="font-medium text-erp-text">{op.name}</p>
                                    <p className="font-mono text-[11px] text-erp-muted">
                                      {op.code}
                                      {op.isOptional ? ' · optional' : ''}
                                    </p>
                                  </div>
                                </td>
                                <td className="max-w-[14rem] text-[11px] text-erp-text">
                                  {isEditing ? (
                                    <Select
                                      value={draftWcId}
                                      className="h-8 min-w-[10rem] text-[12px]"
                                      onChange={(e) => setDraftWcId(e.target.value)}
                                    >
                                      <option value="">{SELECT_PLACEHOLDER}</option>
                                      {wcOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </Select>
                                  ) : (
                                    <span className="truncate" title={labelWc(op.workCentreId)}>
                                      {labelWc(op.workCentreId)}
                                    </span>
                                  )}
                                </td>
                                <td className="max-w-[14rem] text-[11px] text-erp-muted">
                                  {isEditing ? (
                                    <Select
                                      value={draftMachineId}
                                      className="h-8 min-w-[10rem] text-[12px]"
                                      onChange={(e) => setDraftMachineId(e.target.value)}
                                    >
                                      <option value="">{SELECT_PLACEHOLDER}</option>
                                      {machineOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </Select>
                                  ) : (
                                    <span className="truncate" title={labelMachine(op.machineId)}>
                                      {labelMachine(op.machineId)}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <DynamicsStatusChip label={opMeta.label} tone={opMeta.tone} />
                                </td>
                                <td className="text-right tabular-nums font-medium">{op.goodQuantity}</td>
                                <td className="text-right tabular-nums">{op.reworkQuantity}</td>
                                <td className="text-right tabular-nums">{op.rejectedQuantity}</td>
                                <td className="text-center text-[11px] text-erp-muted">
                                  {op.qualityRequired ? (
                                    <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                      Yes
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                {canEditRoute ? (
                                  <td className="text-right">
                                    {isEditing ? (
                                      <div className="inline-flex items-center justify-end gap-0.5">
                                        <Button
                                          size="sm"
                                          className="h-7 px-2"
                                          disabled={busy || opSaving}
                                          title="Save"
                                          onClick={() => void saveOpEdit(op, stage.id)}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2"
                                          disabled={busy || opSaving}
                                          title="Cancel"
                                          onClick={cancelOpEdit}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={busy || opDone || Boolean(editingOpId)}
                                        title={
                                          opDone
                                            ? 'Completed operations cannot be edited'
                                            : 'Edit work centre / machine on this row'
                                        }
                                        onClick={() => beginOpEdit(op)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </td>
                                ) : null}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-erp-border bg-slate-50/60 px-3 py-2.5 text-[11px] text-erp-muted">
                      No operations snapshotted for this stage.
                    </p>
                  )}

                  <StageQcPanel
                    workOrderId={wo.id}
                    stage={stage}
                    inspection={
                      openInspections.find((i) => i.stageId === stage.id) ??
                      stageInspections.find(
                        (i) => i.stageId === stage.id && (i.status === 'PENDING' || i.status === 'REWORK'),
                      ) ??
                      null
                    }
                    qcPassed={stageHasPassedQc}
                    busy={busy}
                    canExecute={canExecuteStage && wo.status === 'IN_PROGRESS'}
                    onChanged={onQcChanged}
                    onOverrideComplete={onOverrideComplete}
                    onOpenStageQc={onOpenStageQc}
                  />
                </div>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function ApiWorkOrderDetailPage() {
  const { workOrderId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useManufacturingWorkOrderPermissions()
  const phase2b = useManufacturingPhase2bPermissions()
  const { options: items } = useSetupLookup('items')

  const [wo, setWo] = useState<WorkOrderDetail | null>(null)
  const [activities, setActivities] = useState<ProductionActivityEntry[]>([])
  const [ledger, setLedger] = useState<ProductionStageLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [progressOpen, setProgressOpen] = useState(false)
  const [completeStageId, setCompleteStageId] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignments, setAssignments] = useState<ProductionAssignment[]>([])
  const [issues, setIssues] = useState<ProductionIssue[]>([])
  const [historyAssignmentId, setHistoryAssignmentId] = useState<string | null>(null)
  const [assignmentHistory, setAssignmentHistory] = useState<ProductionAssignment[]>([])
  const [materials, setMaterials] = useState<ProductionOrderMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [issueMaterial, setIssueMaterial] = useState<ProductionOrderMaterial | null>(null)
  const [returnMaterial, setReturnMaterial] = useState<ProductionOrderMaterial | null>(null)
  const [materialEditorOpen, setMaterialEditorOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<ProductionOrderMaterial | null>(null)
  const [fgReceiptOpen, setFgReceiptOpen] = useState(false)
  const [qualityBlockers, setQualityBlockers] = useState<QualityBlocker[]>([])
  const [openInspections, setOpenInspections] = useState<QualityInspection[]>([])
  const [stageInspections, setStageInspections] = useState<QualityInspection[]>([])
  const [runtimeChanges, setRuntimeChanges] = useState<RuntimeChange[]>([])
  const [runtimeChangeOpen, setRuntimeChangeOpen] = useState(false)
  const [runtimeChangeSeed, setRuntimeChangeSeed] = useState<{
    changeType?: RuntimeChangeType
    operationId?: string
    stageId?: string
  } | null>(null)
  const [wipMovements, setWipMovements] = useState<WipMovement[]>([])
  const [fgReceipts, setFgReceipts] = useState<WorkOrderFgReceiptSummary[]>([])
  const [wipTransferOpen, setWipTransferOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitQuantity, setSplitQuantity] = useState('')
  const [splitReason, setSplitReason] = useState('')
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  const [holdReason, setHoldReason] = useState<HoldReasonCategory>('OTHER')
  const [holdExpectedResume, setHoldExpectedResume] = useState('')
  const [remarks, setRemarks] = useState('')

  const productLabel = useMemo(() => {
    if (!wo) return ''
    const fromApi = [wo.productItemCode, wo.productItemName].filter(Boolean).join(' — ')
    if (fromApi) return fromApi
    return items.find((i) => i.id === wo.productItemId)?.label ?? 'Item'
  }, [items, wo])

  const liveProgress = useMemo(() => (wo ? deriveLiveProgress(wo) : null), [wo])

  const [tabsMoreOpen, setTabsMoreOpen] = useState(false)
  const materialConnectAttempted = useRef(false)

  const load = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    try {
      const [detail, acts, ledgerEntries, assignmentRows, issueRows, blockerRes, inspectionRes, changeRows, movementRows, fgRows] = await Promise.all([
        getWorkOrderDetail(workOrderId),
        getWorkOrderActivities(workOrderId),
        getWorkOrderLedger(workOrderId),
        phase2b.canViewAssignments ? listWorkOrderAssignments(workOrderId, { limit: 50 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        phase2b.canViewIssues ? listIssues({ productionOrderId: workOrderId, limit: 50 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        getWorkOrderQualityBlockers(workOrderId).catch(() => ({ data: { blockers: [] } })),
        listInspections({ productionOrderId: workOrderId, limit: 50 }).catch(() => ({ data: [] })),
        canViewRuntimeChanges() ? listRuntimeChanges(workOrderId, { limit: 100 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canMoveWip()
          ? listWipMovements(workOrderId, { limit: 100 }).catch(() => ({ data: { total: 0, items: [] as WipMovement[] } }))
          : Promise.resolve({ data: { total: 0, items: [] as WipMovement[] } }),
        listFgReceipts(workOrderId).catch(() => ({ data: [] as WorkOrderFgReceiptSummary[] })),
      ])

      let woDetail = detail.data
      // Auto-connect Inventory material control once for released WOs still marked NOT_CONNECTED.
      if (
        !materialConnectAttempted.current &&
        woDetail.materialControlStatus === 'NOT_CONNECTED' &&
        woDetail.status !== 'DRAFT' &&
        perms.canCreateMaterialRequirement
      ) {
        materialConnectAttempted.current = true
        try {
          await syncWorkOrderMaterialRequirements(workOrderId)
          const refreshed = await getWorkOrderDetail(workOrderId)
          woDetail = refreshed.data
        } catch {
          // Leave NOT_CONNECTED — banner offers manual Connect.
        }
      }

      setWo(woDetail)
      setActivities(asListArray(acts.data))
      setLedger(asListArray(ledgerEntries.data))
      setAssignments(asListArray(assignmentRows.data))
      setIssues(asListArray(issueRows.data))
      setQualityBlockers(
        Array.isArray(blockerRes.data?.blockers)
          ? blockerRes.data.blockers
          : asListArray(blockerRes.data),
      )
      setOpenInspections(
        asListArray<QualityInspection>(inspectionRes.data).filter(
          (i) => i.status === 'PENDING' || i.status === 'REWORK',
        ),
      )
      setStageInspections(asListArray<QualityInspection>(inspectionRes.data))
      setRuntimeChanges(asListArray(changeRows.data))
      // API returns { total, items } — never assign the envelope as the list.
      setWipMovements(asListArray(movementRows.data?.items ?? movementRows.data))
      setFgReceipts(asListArray(fgRows.data))
      const assignmentList = asListArray<{ userId?: string | null }>(assignmentRows.data)
      const changeList = asListArray<{ requestedBy?: string | null }>(changeRows.data)
      const needNames =
        Boolean(woDetail.supervisorId) ||
        Boolean(woDetail.managerId) ||
        assignmentList.some((a) => a.userId) ||
        changeList.some((change) => change.requestedBy)
      if (needNames) {
        void fetchAdminUsersApi()
          .then((users) =>
            setUserNames(
              Object.fromEntries(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim() || user.email])),
            ),
          )
          .catch(() => undefined)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load work order')
      navigate('/manufacturing/work-orders')
    } finally {
      setLoading(false)
    }
  }, [navigate, workOrderId, phase2b.canViewAssignments, phase2b.canViewIssues, perms.canCreateMaterialRequirement])

  useEffect(() => {
    materialConnectAttempted.current = false
  }, [workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const action = searchParams.get('action') as Dialog
    if (action) {
      setDialog(action)
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const loadMaterials = useCallback(async () => {
    if (!workOrderId || !perms.canViewMaterials) return
    setMaterialsLoading(true)
    try {
      try {
        const readiness = await getWorkOrderMaterialsReadiness(workOrderId)
        setMaterials(readiness.data.materials)
      } catch {
        // Readiness depends on inventory balances; still show synced requirement lines.
        const listed = await listWorkOrderMaterials(workOrderId)
        setMaterials(listed.data.map((row) => ({ ...row, freeQty: row.freeQty ?? null, hasShortage: row.hasShortage ?? false })))
      }
      const detail = await getWorkOrderDetail(workOrderId)
      setWo((prev) => (prev ? { ...prev, materialControlStatus: detail.data.materialControlStatus } : prev))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load materials')
    } finally {
      setMaterialsLoading(false)
    }
  }, [perms.canViewMaterials, workOrderId])

  useEffect(() => {
    if (tab === 'materials' || tab === 'bom') void loadMaterials()
  }, [tab, loadMaterials])

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      setBusy(true)
      try {
        const result = await fn()
        const warnings = (() => {
          if (!result || typeof result !== 'object') return [] as string[]
          const r = result as { data?: { warnings?: string[] }; warnings?: string[] }
          return r.data?.warnings ?? r.warnings ?? []
        })()
        if (warnings.length > 0) {
          notify.success(okMsg)
          notify.warning(warnings.slice(0, 3).join(' · ') + (warnings.length > 3 ? '…' : ''))
        } else {
          notify.success(okMsg)
        }
        setDialog(null)
        await load()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  const runRuntimeChange = useCallback(async (fn: () => Promise<unknown>, message: string) => {
    await run(fn, message)
  }, [run])

  const applySyncedMaterials = useCallback((rows: ProductionOrderMaterial[]) => {
    setMaterials(
      rows.map((row) => ({
        ...row,
        freeQty: row.freeQty ?? null,
        hasShortage: row.hasShortage ?? false,
      })),
    )
  }, [])

  const syncMaterials = useCallback(async () => {
    if (!workOrderId) return
    await run(async () => {
      const res = await syncWorkOrderMaterialRequirements(workOrderId)
      applySyncedMaterials(res.data.materials)
      return res
    }, 'Material requirements synced')
    await loadMaterials()
  }, [applySyncedMaterials, loadMaterials, run, workOrderId])

  if (loading || !wo) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="Work Order"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Work Orders', to: '/manufacturing/work-orders' },
        ]}
        autoBreadcrumbs={false}
        backLink={{ to: '/manufacturing/work-orders', label: 'Work Orders' }}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  if (!perms.canViewWo) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" title="Work Order" badge="Manufacturing">
        <EmptyState icon={ShieldAlert} title="Access denied" description="Missing work order view permission." />
      </OperationalPageShell>
    )
  }

  const canRelease = wo.status === 'DRAFT' && perms.canRelease
  const canStart = wo.status === 'READY' && perms.canStart
  const canHold = wo.status === 'IN_PROGRESS' && perms.canHold
  const canResume = wo.status === 'ON_HOLD' && perms.canResume
  const canProgress = wo.status === 'IN_PROGRESS' && perms.canProgress
  const canCompleteWo = wo.status === 'IN_PROGRESS' && perms.canComplete
  const canCancel = !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status) && perms.canCancel
  const canReceiveFg = wo.status === 'COMPLETED' && perms.canPostFgReceipt
  const canSplit = ['READY', 'IN_PROGRESS'].includes(wo.status) && perms.canSplitWo
  const readOnly = ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status)
  const openIssueCount = issues.filter((i) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status)).length
  const activeAssignmentCount = assignments.filter((a) => !['COMPLETED', 'CANCELLED'].includes(a.status)).length
  const completionPct = liveProgress?.pipelinePct ?? Math.min(100, Math.max(0, Math.round(Number(wo.completionPercent) || 0)))
  const qualityMeta = qualityStatusMeta(wo.qualityStatus)
  const materialMeta = materialControlMeta(wo.materialControlStatus)
  const relatedSo = wo.relatedSalesOrder
  const visibleMoreTabs = MORE_TABS.filter((item) => item.id !== 'costing' || canViewCost())
  const moreTabActive = visibleMoreTabs.some((t) => t.id === tab)

  const postedFgQty = fgReceipts
    .filter((r) => r.status === 'POSTED' || r.status === 'PARTIALLY_REVERSED')
    .reduce((sum, r) => sum + Number(r.acceptedQuantity || r.receiptQuantity || 0), 0)
  const completedGood = Number(wo.completedGoodQuantity || 0)
  const fgRemaining = wo.status === 'COMPLETED' && completedGood > 0 && postedFgQty + 1e-9 < completedGood
  const stockReadyForDispatch = wo.status === 'COMPLETED' && !fgRemaining
  const soFulfilmentPath = relatedSo ? `/crm/sales-orders/${relatedSo.id}` : null
  const dispatchWorkbenchPath = relatedSo
    ? `/dispatch/workbench?salesOrderId=${encodeURIComponent(relatedSo.id)}`
    : '/dispatch/workbench'

  const journey = deriveWoFulfilmentJourney({
    status: wo.status,
    stages: wo.stages,
    qualityBlockerCount: qualityBlockers.length,
    fgReceiptCount: fgReceipts.length,
    fgRemaining,
    salesOrderId: relatedSo?.id ?? wo.salesOrderId ?? null,
    salesOrderNo: relatedSo?.salesOrderNo ?? null,
  })

  const openDispatchHandoff = () => {
    if (soFulfilmentPath) navigate(soFulfilmentPath)
    else navigate(dispatchWorkbenchPath)
  }

  const primaryAction: ErpCommandAction | undefined = canRelease
    ? { id: 'release', label: 'Release Work Order', icon: Play, onClick: () => void run(() => releaseWorkOrder(wo.id), 'Work order released') }
    : canStart
      ? { id: 'start', label: 'Start Production', icon: Play, onClick: () => void run(() => startWorkOrder(wo.id), 'Work order started') }
      : canResume
        ? { id: 'resume', label: 'Resume', icon: Play, onClick: () => setDialog('resume') }
        : canProgress
          ? { id: 'update', label: 'Record Production', icon: CheckCircle2, onClick: () => setProgressOpen(true) }
          : canReceiveFg && fgRemaining
            ? { id: 'fg-receipt', label: 'Receive Finished Goods', icon: Package, onClick: () => setFgReceiptOpen(true) }
            : stockReadyForDispatch
              ? {
                  id: 'dispatch',
                  label: relatedSo ? 'Open Dispatch Fulfilment' : 'Open Store / Dispatch',
                  icon: Truck,
                  onClick: openDispatchHandoff,
                }
              : readOnly
                ? { id: 'review', label: 'Review', icon: CheckCircle2, onClick: () => setTab('timeline') }
                : undefined

  const nextBestAction: NextBestAction | null = canRelease
    ? {
        label: 'Release this work order to lock BOM and routing snapshots.',
        description: 'Stages appear after release. Then Start → Record Production → Complete Stage.',
        action: { label: 'Release Work Order', onClick: () => void run(() => releaseWorkOrder(wo.id), 'Work order released') },
      }
    : canStart
      ? {
          label: 'Ready to start production.',
          description: 'Flexible mode allows start even if materials are not reserved yet (warning only).',
          action: { label: 'Start Production', onClick: () => void run(() => startWorkOrder(wo.id), 'Work order started') },
        }
      : wo.status === 'ON_HOLD'
        ? {
            label: 'This work order is on hold.',
            description: wo.holdReasonCategory ? HOLD_REASON_CATEGORY_LABELS[wo.holdReasonCategory] : undefined,
            tone: 'warning',
            action: canResume ? { label: 'Resume Work Order', onClick: () => setDialog('resume') } : undefined,
          }
        : qualityBlockers.length > 0 && wo.status === 'IN_PROGRESS'
          ? {
              label: `${qualityBlockers.length} quality blocker${qualityBlockers.length === 1 ? '' : 's'} need attention before finished goods can be received.`,
              tone: 'warning',
              action: { label: 'Open Quality', onClick: () => setTab('issues') },
            }
          : canProgress
            ? (() => {
                const current =
                  (wo.currentStageId ? wo.stages.find((s) => s.id === wo.currentStageId) : null) ??
                  wo.stages.find((s) => s.status === 'IN_PROGRESS' || s.status === 'READY' || s.status === 'QC_PENDING') ??
                  null
                const allStagesDone =
                  wo.stages.length > 0 &&
                  wo.stages.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.isOptional)
                const deferredQc = wo.stages.find((s) => {
                  const passed = stageInspections.some(
                    (i) => i.stageId === s.id && i.status === 'PASSED',
                  )
                  return s.qualityRequired && s.status === 'COMPLETED' && !passed
                })
                if (deferredQc) {
                  return {
                    label: `Stage "${deferredQc.name}" still needs QC measurements.`,
                    tone: 'warning' as const,
                    action: {
                      label: 'Open Stage QC',
                      onClick: () => {
                        setTab('stages')
                        setCompleteStageId(deferredQc.id)
                      },
                    },
                  }
                }
                if (allStagesDone && canCompleteWo) {
                  return {
                    label: 'All stages complete — finish the work order.',
                    tone: 'success' as const,
                    action: { label: 'Complete Work Order', onClick: () => setDialog('complete') },
                  }
                }
                if (current?.status === 'QC_PENDING') {
                  return {
                    label: `Stage "${current.name}" is awaiting QC.`,
                    tone: 'warning' as const,
                    action: {
                      label: 'Open Stage QC',
                      onClick: () => {
                        setTab('stages')
                        setCompleteStageId(current.id)
                      },
                    },
                  }
                }
                if (current && perms.canExecuteStage) {
                  return {
                    label: `Continue production on ${current.code} · ${current.name}.`,
                    description: 'Record qty, then Complete Stage to open the next process.',
                    action: {
                      label: 'Complete Stage',
                      onClick: () => {
                        setTab('stages')
                        setCompleteStageId(current.id)
                      },
                    },
                  }
                }
                return {
                  label: 'Record production quantities for the current stage.',
                  action: { label: 'Record Production', onClick: () => setProgressOpen(true) },
                }
              })()
            : canReceiveFg && fgRemaining
              ? {
                  label: 'Production complete — receive finished goods into inventory.',
                  tone: 'success',
                  action: { label: 'Receive Finished Goods', onClick: () => setFgReceiptOpen(true) },
                }
              : stockReadyForDispatch
                ? {
                    label: relatedSo
                      ? `Stock ready — continue fulfilment on ${relatedSo.salesOrderNo}.`
                      : 'Stock ready — open dispatch / store workbench.',
                    description: relatedSo
                      ? 'Sync requirements → reserve FG → pick → pack → delivery challan.'
                      : 'No linked sales order — receive FG is done; create dispatch from an SO when ready.',
                    tone: 'success',
                    action: {
                      label: relatedSo ? 'Open SO Fulfilment' : 'Open Dispatch Workbench',
                      onClick: openDispatchHandoff,
                    },
                  }
                : null

  const moreActions: ErpCommandAction[] = [
    ...(perms.canAssign && phase2b.canManageAssignments && !readOnly
      ? [{ id: 'assign', label: t('assignment.assignWork'), icon: UserPlus, onClick: () => setAssignOpen(true) }]
      : []),
    ...(canProgress && primaryAction?.id !== 'update'
      ? [{ id: 'progress', label: 'Record Progress', icon: CheckCircle2, onClick: () => setProgressOpen(true) }]
      : []),
    ...(canHold ? [{ id: 'hold', label: 'Hold', icon: Pause, onClick: () => setDialog('hold') }] : []),
    ...(canCompleteWo
      ? [{ id: 'complete', label: 'Complete Work Order', icon: CheckCircle2, onClick: () => setDialog('complete') }]
      : []),
    ...(canRequestRuntimeChange() && !readOnly
      ? [{ id: 'runtime-change', label: 'Change / Exception', icon: AlertTriangle, onClick: () => { setRuntimeChangeSeed(null); setRuntimeChangeOpen(true) } }]
      : []),
    ...(canSplit
      ? [{ id: 'split', label: 'Split Work Order', icon: Scissors, onClick: () => setSplitOpen(true) }]
      : []),
    ...((canMoveWip() || canTransferMaterials()) && !readOnly
      ? [{ id: 'transfer', label: 'Transfer', icon: ArrowLeftRight, onClick: () => setWipTransferOpen(true) }]
      : []),
    ...(canRequestCorrection() && !readOnly
      ? [{ id: 'correct', label: 'Correct / Reverse', icon: RotateCcw, onClick: () => setCorrectionOpen(true) }]
      : []),
    ...(canCancel ? [{ id: 'cancel', label: 'Cancel', icon: Ban, onClick: () => setDialog('cancel') }] : []),
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title={wo.workOrderNo}
      description={productLabel}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders', to: '/manufacturing/work-orders' },
        { label: wo.workOrderNo },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/manufacturing/work-orders/${wo.id}`}
      backLink={{ to: '/manufacturing/work-orders', label: 'Work Orders' }}
      commandBar={
        <ErpCommandBar
          inline
          sticky
          primaryAction={primaryAction}
          moreActions={moreActions}
          moreActionsLabel="More"
        />
      }
    >
      <div className="space-y-4">
        <FulfilmentJourneyStrip
          activeStep={journey.activeStep}
          steps={journey.steps.map((step) => ({
            ...step,
            onSelect:
              step.id === 'produce'
                ? () => setTab('stages')
                : step.id === 'quality'
                  ? () => setTab('issues')
                  : step.id === 'stock'
                    ? () => {
                        if (canReceiveFg && fgRemaining) setFgReceiptOpen(true)
                        else setTab('overview')
                      }
                    : () => openDispatchHandoff(),
          }))}
          compactTip="Flexible execution: inventory, purchase, and QC warn instead of hard-blocking production on this Work Order."
        />

        {nextBestAction ? <NextBestActionBanner nba={nextBestAction} /> : null}

        <div className="grid gap-2 rounded-lg border border-erp-border bg-white px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Field label="Status" value={<WorkOrderStatusBadge status={wo.status} />} />
          <Field label="Current Stage" value={currentStageLabel(wo)} />
          <Field
            label="Progress"
            value={
              <span className="tabular-nums font-semibold">
                {completionPct}%
                {liveProgress && liveProgress.stagesTotal > 0
                  ? ` · ${liveProgress.stagesDone}/${liveProgress.stagesTotal} stages`
                  : ` · ${wo.completedGoodQuantity}/${wo.plannedQuantity} FG`}
              </span>
            }
          />
          <Field label="Health" value={<WorkOrderHealthBadge health={wo.healthStatus} />} />
          <Field
            label="Started"
            value={wo.actualStartAt ? formatDateTime(wo.actualStartAt) : '—'}
          />
          <Field
            label="Duration"
            value={
              wo.actualStartAt
                ? (() => {
                    const end = wo.actualCompletedAt ? new Date(wo.actualCompletedAt).getTime() : Date.now()
                    const mins = Math.max(0, Math.round((end - new Date(wo.actualStartAt).getTime()) / 60_000))
                    if (mins < 60) return `${mins} min`
                    const h = Math.floor(mins / 60)
                    return `${h}h ${mins % 60}m`
                  })()
                : '—'
            }
          />
        </div>

        {/* Status + control strip */}
        <div className="overflow-hidden rounded-lg border border-erp-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-erp-border px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <WorkOrderStatusBadge status={wo.status} />
              <WorkOrderHealthBadge health={wo.healthStatus} />
              <DynamicsStatusChip label={materialMeta.label} tone={materialMeta.tone} />
              <DynamicsStatusChip label={qualityMeta.label} tone={qualityMeta.tone} />
              {openIssueCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-900 ring-1 ring-rose-200">
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  {openIssueCount} open
                </span>
              ) : null}
              {activeAssignmentCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-sky-900 ring-1 ring-sky-200">
                  <UserPlus className="h-3 w-3" aria-hidden />
                  {activeAssignmentCount} active
                </span>
              ) : null}
              {canViewCorrections() ? (
                <Link
                  to={`/manufacturing/corrections?workOrderId=${wo.id}`}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  Corrections
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-erp-muted">
              {relatedSo ? (
                <span>
                  SO{' '}
                  <Link
                    to={`/crm/sales-orders/${relatedSo.id}`}
                    className="font-semibold text-erp-primary hover:underline"
                  >
                    {relatedSo.salesOrderNo}
                  </Link>
                  {relatedSo.customerName ? (
                    <span className="text-erp-muted"> · {relatedSo.customerName}</span>
                  ) : null}
                </span>
              ) : (
                <span>{sourceLabel(wo)}</span>
              )}
              {wo.jobNumber ? <span>Job {wo.jobNumber}</span> : null}
              {wo.splitFromOrderId ? (
                <span>
                  Split from{' '}
                  <Link
                    to={`/manufacturing/work-orders/${wo.splitFromOrderId}`}
                    className="font-semibold text-erp-primary hover:underline"
                  >
                    parent WO
                  </Link>
                  {wo.splitSequence != null ? ` (#${wo.splitSequence})` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Field label="Planned Qty" value={<span className="tabular-nums">{wo.plannedQuantity}</span>} />
            <Field label="Planned Start" value={wo.plannedStartDate ? formatDate(wo.plannedStartDate) : '—'} />
            <Field label="Due" value={wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'} />
            <Field label="Current Stage" value={currentStageLabel(wo)} />
            <Field label="Priority" value={wo.priority} />
            <Field label="Plant" value={wo.plantCode || '—'} />
            <Field label="Supervisor" value={personLabel(wo.supervisorId, userNames)} />
            <Field label="Manager" value={personLabel(wo.managerId, userNames)} />
          </div>

          {(qualityBlockers.length > 0 ||
            openInspections.length > 0 ||
            fgReceipts.length > 0 ||
            wo.materialControlStatus === 'NOT_CONNECTED' ||
            (wo.status === 'COMPLETED' && !canReceiveFg) ||
            wo.status === 'ON_HOLD') && (
            <div className="flex flex-wrap items-start gap-3 border-t border-erp-border bg-slate-50/80 px-4 py-2.5 text-[12px] text-erp-text">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-erp-muted" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-erp-muted">
                  Material <span className="font-medium text-erp-text">{materialMeta.label}</span>
                  <span className="mx-1.5 text-erp-border">·</span>
                  Quality <span className="font-medium text-erp-text">{qualityMeta.label}</span>
                  {qualityBlockers.length > 0 ? (
                    <>
                      <span className="mx-1.5 text-erp-border">·</span>
                      <span className="font-medium text-amber-800">
                        {qualityBlockers.length} blocker{qualityBlockers.length === 1 ? '' : 's'}
                      </span>
                    </>
                  ) : null}
                  {openInspections.length > 0 ? (
                    <>
                      <span className="mx-1.5 text-erp-border">·</span>
                      <Link to="/quality/queue" className="font-semibold text-erp-primary hover:underline">
                        {openInspections.length} open inspection{openInspections.length === 1 ? '' : 's'}
                      </Link>
                    </>
                  ) : null}
                  {fgReceipts.length > 0 ? (
                    <>
                      <span className="mx-1.5 text-erp-border">·</span>
                      <span className="font-medium text-erp-text">
                        {fgReceipts.length} FG receipt{fgReceipts.length === 1 ? '' : 's'}
                      </span>
                    </>
                  ) : null}
                </p>
                {wo.status === 'COMPLETED' && !canReceiveFg ? (
                  <p className="font-medium text-emerald-800">
                    Operational production complete — finished goods receipt pending.
                  </p>
                ) : null}
                {wo.status === 'ON_HOLD' ? (
                  <p className="font-medium text-amber-900">
                    On hold — {wo.holdReasonCategory ? HOLD_REASON_CATEGORY_LABELS[wo.holdReasonCategory] : 'Reason not set'}
                    {wo.holdRemarks ? `: ${wo.holdRemarks}` : ''}
                    {wo.holdExpectedResumeAt ? ` · Expected resume ${formatDate(wo.holdExpectedResumeAt)}` : ''}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {wo.materialControlStatus === 'NOT_CONNECTED' && wo.status !== 'DRAFT' && perms.canCreateMaterialRequirement ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setTab('materials')
                        void syncMaterials()
                      }}
                    >
                      Connect Inventory
                    </Button>
                  ) : null}
                  {wo.materialControlStatus === 'NOT_CONNECTED' && wo.status !== 'DRAFT' ? (
                    <span className="text-[11px] text-erp-muted">
                      Requires a production warehouse on the manufacturing profile and a released BOM snapshot.
                    </span>
                  ) : null}
                  {wo.materialControlStatus !== 'NOT_CONNECTED' ? (
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-erp-primary hover:underline"
                      onClick={() => setTab('materials')}
                    >
                      Materials
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-erp-primary hover:underline"
                    onClick={() => setTab('issues')}
                  >
                    Quality
                  </button>
                  {openInspections.length > 0 ? (
                    <Link to="/quality/queue" className="text-[12px] font-semibold text-erp-primary hover:underline">
                      Open QC queue
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {wo.stages.length > 0 ? (
          <DocumentFormSection title="Routing progress" subtitle="Process flow along the released routing — completed, current, and upcoming stages">
            <RouteProgress stages={wo.stages} currentStageId={wo.currentStageId} />
          </DocumentFormSection>
        ) : wo.status === 'DRAFT' ? (
          <div className="rounded-lg border border-dashed border-erp-border bg-slate-50/80 px-4 py-3 text-[13px] text-erp-text">
            <p className="font-semibold">Routing not snapshotted yet</p>
            <p className="mt-0.5 text-[12px] text-erp-muted">
              Release this work order to copy the active BOM and routing stages. Then Start → Record Production → Complete
              Stage.
            </p>
            {canRelease ? (
              <Button
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => void run(() => releaseWorkOrder(wo.id), 'Work order released')}
              >
                Release Work Order
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-950">
            <p className="font-semibold">No stages on this work order</p>
            <p className="mt-0.5 text-[12px] text-amber-900/80">
              The released routing had no stage groups. Check Manufacturing Setup → Routings, then recreate or amend the
              work order.
            </p>
          </div>
        )}

        <DocumentSummaryStrip
          items={[
            {
              id: 'planned',
              label: liveProgress?.qtyScope === 'stage' ? 'Stage planned' : 'Planned',
              value: liveProgress?.planned ?? wo.plannedQuantity,
            },
            {
              id: 'good',
              label: liveProgress?.qtyScope === 'stage' ? 'Stage good' : 'Good',
              value: liveProgress?.good ?? wo.completedGoodQuantity,
              tone: 'success',
            },
            {
              id: 'rework',
              label: 'Rework',
              value: liveProgress?.rework ?? wo.reworkQuantity,
              tone: Number(liveProgress?.rework ?? wo.reworkQuantity) > 0 ? 'warning' : 'default',
            },
            {
              id: 'rejected',
              label: 'Rejected',
              value: liveProgress?.rejected ?? wo.rejectedQuantity,
              tone: Number(liveProgress?.rejected ?? wo.rejectedQuantity) > 0 ? 'danger' : 'default',
            },
            {
              id: 'scrap',
              label: 'Scrap',
              value: liveProgress?.scrap ?? wo.scrapQuantity,
              tone: Number(liveProgress?.scrap ?? wo.scrapQuantity) > 0 ? 'danger' : 'default',
            },
            {
              id: 'completion',
              label: 'Pipeline',
              value: `${completionPct}%`,
              helper: currentStageLabel(wo),
            },
          ]}
        />

        {/* Underline tabs */}
        <div className="border-b border-erp-border" role="tablist" aria-label="Work order tabs">
          <div className="relative flex flex-wrap items-end gap-0">
            {PRIMARY_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id)
                  setTabsMoreOpen(false)
                }}
                className={cn(
                  '-mb-px border-b-2 px-3.5 py-2.5 text-[12px] font-semibold transition',
                  tab === item.id
                    ? 'border-erp-primary text-erp-primary'
                    : 'border-transparent text-erp-muted hover:border-slate-300 hover:text-erp-text',
                )}
              >
                {item.label}
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                aria-expanded={tabsMoreOpen}
                aria-haspopup="listbox"
                onClick={() => setTabsMoreOpen((o) => !o)}
                className={cn(
                  '-mb-px inline-flex items-center gap-1 border-b-2 px-3.5 py-2.5 text-[12px] font-semibold transition',
                  moreTabActive
                    ? 'border-erp-primary text-erp-primary'
                    : tabsMoreOpen
                      ? 'border-slate-300 text-erp-text'
                      : 'border-transparent text-erp-muted hover:border-slate-300 hover:text-erp-text',
                )}
              >
                More
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              {tabsMoreOpen ? (
                <ul
                  role="listbox"
                  className="absolute left-0 z-30 mt-1 min-w-[11rem] rounded-md border border-erp-border bg-white py-1 shadow-lg"
                >
                  {visibleMoreTabs.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={tab === item.id}
                        className={cn(
                          'w-full px-3 py-2 text-left text-[12px] font-medium hover:bg-erp-surface-alt',
                          tab === item.id ? 'text-erp-primary' : 'text-erp-text',
                        )}
                        onClick={() => {
                          setTab(item.id)
                          setTabsMoreOpen(false)
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        {tab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="space-y-4 lg:col-span-2">
              <DocumentFormSection title="Identity & commercial" subtitle="Item, demand, and ownership">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Item" value={productLabel} />
                  <Field label="Source" value={sourceLabel(wo)} />
                  <Field
                    label="Sales Order"
                    value={
                      relatedSo ? (
                        <Link to={`/crm/sales-orders/${relatedSo.id}`} className="text-erp-primary hover:underline">
                          {relatedSo.salesOrderNo}
                        </Link>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <Field label="Customer" value={relatedSo?.customerName || relatedSo?.customerCode || '—'} />
                  <Field label="Job Number" value={wo.jobNumber || '—'} />
                  <Field label="Project Ref" value={wo.projectRef || '—'} />
                  <Field
                    label="Demand"
                    value={wo.demandId ? <span className="font-mono text-[12px]">{wo.demandId.slice(0, 8)}…</span> : '—'}
                  />
                  <Field label="Plant" value={wo.plantCode || '—'} />
                  <Field label="Manager" value={personLabel(wo.managerId, userNames)} />
                  <Field label="Supervisor" value={personLabel(wo.supervisorId, userNames)} />
                  <Field label="Tracking" value={wo.outputTrackingType?.replace(/_/g, ' ') || '—'} />
                  <Field label="Released" value={wo.releasedAt ? formatDateTime(wo.releasedAt) : '—'} />
                  <Field label="Started" value={wo.actualStartAt ? formatDateTime(wo.actualStartAt) : '—'} />
                  <Field label="Completed" value={wo.actualCompletedAt ? formatDateTime(wo.actualCompletedAt) : '—'} />
                  {wo.notes ? (
                    <div className="sm:col-span-2">
                      <Field label="Notes" value={wo.notes} />
                    </div>
                  ) : null}
                </div>
              </DocumentFormSection>

              {fgReceipts.length > 0 ? (
                <DocumentFormSection title="Finished goods receipts">
                  <div className="mb-3 flex justify-end">
                    {canReceiveFg ? (
                      <Button size="sm" variant="secondary" onClick={() => setFgReceiptOpen(true)}>
                        Receive FG
                      </Button>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="erp-table w-full text-[12px]">
                      <thead>
                        <tr>
                          <th>Receipt</th>
                          <th>Status</th>
                          <th className="text-right">Qty</th>
                          <th>Warehouse</th>
                          <th>Batch / Lot</th>
                          <th>Posted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fgReceipts.map((receipt) => (
                          <tr key={receipt.id}>
                            <td className="font-mono font-medium">{receipt.receiptNumber}</td>
                            <td>{receipt.status}</td>
                            <td className="text-right tabular-nums">
                              {receipt.acceptedQuantity || receipt.receiptQuantity}
                              {receipt.uom?.code ? ` ${receipt.uom.code}` : ''}
                            </td>
                            <td>{receipt.warehouse?.name ?? receipt.warehouse?.code ?? '—'}</td>
                            <td>{receipt.batchOrLotNumber || '—'}</td>
                            <td>
                              {receipt.postedAt
                                ? formatDateTime(receipt.postedAt)
                                : receipt.receiptDate
                                  ? formatDate(receipt.receiptDate)
                                  : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DocumentFormSection>
              ) : null}
            </section>
            <div className="space-y-4">
              <DocumentFormSection title="Completion">
                <div className="flex justify-between text-[11px] font-medium text-erp-muted">
                  <span>Pipeline progress</span>
                  <span className="tabular-nums text-erp-text">
                    {completionPct}%
                    {liveProgress && liveProgress.stagesTotal > 0
                      ? ` · ${liveProgress.stagesDone}/${liveProgress.stagesTotal}`
                      : ''}
                  </span>
                </div>
                <ProgressBar pct={completionPct} />
                <dl className="mt-4 divide-y divide-erp-border border-t border-erp-border text-[13px]">
                  <div className="flex justify-between py-2">
                    <dt className="text-erp-muted">
                      {liveProgress?.qtyScope === 'stage' ? 'Stage planned' : 'Planned'}
                    </dt>
                    <dd className="tabular-nums font-semibold">{liveProgress?.planned ?? wo.plannedQuantity}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-erp-muted">
                      {liveProgress?.qtyScope === 'stage' ? 'Stage good' : 'Good'}
                    </dt>
                    <dd className="tabular-nums font-semibold text-emerald-700">
                      {liveProgress?.good ?? wo.completedGoodQuantity}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-erp-muted">Rework</dt>
                    <dd className="tabular-nums">{liveProgress?.rework ?? wo.reworkQuantity}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-erp-muted">Rejected</dt>
                    <dd className="tabular-nums">{liveProgress?.rejected ?? wo.rejectedQuantity}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-erp-muted">Scrap</dt>
                    <dd className="tabular-nums">{liveProgress?.scrap ?? wo.scrapQuantity}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-erp-muted">FG good (order)</dt>
                    <dd className="tabular-nums font-medium">{wo.completedGoodQuantity}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <dt className="shrink-0 text-erp-muted">Current stage</dt>
                    <dd className="text-right text-[12px] font-medium">{currentStageLabel(wo)}</dd>
                  </div>
                </dl>
              </DocumentFormSection>
              <DocumentInfoPanel
                sections={[
                  {
                    title: 'General',
                    fields: [
                      { label: 'Document', value: wo.workOrderNo },
                      { label: 'Priority', value: wo.priority },
                      { label: 'Plant', value: wo.plantCode || '—' },
                      { label: 'Supervisor', value: personLabel(wo.supervisorId, userNames) },
                      { label: 'Manager', value: personLabel(wo.managerId, userNames) },
                      { label: 'Tracking', value: wo.outputTrackingType?.replace(/_/g, ' ') || '—' },
                    ],
                  },
                  {
                    title: 'Dates',
                    fields: [
                      { label: 'Created', value: wo.createdAt ? formatDate(wo.createdAt) : '—' },
                      { label: 'Planned start', value: wo.plannedStartDate ? formatDate(wo.plannedStartDate) : '—' },
                      { label: 'Required', value: wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—' },
                      { label: 'Released', value: wo.releasedAt ? formatDate(wo.releasedAt) : '—' },
                      { label: 'Started', value: wo.actualStartAt ? formatDate(wo.actualStartAt) : '—' },
                      { label: 'Completed', value: wo.actualCompletedAt ? formatDate(wo.actualCompletedAt) : '—' },
                    ],
                  },
                  {
                    title: 'Setup',
                    fields: [
                      {
                        label: 'BOM snapshot',
                        value: wo.bomSnapshot
                          ? `v${wo.bomSnapshot.bomVersionNumber} · ${formatDateTime(wo.bomSnapshot.snapshotAt)}`
                          : 'Not yet snapshotted',
                      },
                      {
                        label: 'Routing snapshot',
                        value: wo.routingSnapshot
                          ? `v${wo.routingSnapshot.routingVersionNumber} · ${formatDateTime(wo.routingSnapshot.snapshotAt)}`
                          : 'Not yet snapshotted',
                      },
                      { label: 'Operations', value: String(wo.operations?.length ?? 0) },
                      { label: 'Stages', value: String(wo.stages?.length ?? 0) },
                    ],
                  },
                ]}
              />
            </div>
          </div>
        ) : null}

        {tab === 'stages' ? (
          <StagesProcessPanel
            wo={wo}
            busy={busy}
            canExecuteStage={Boolean(perms.canExecuteStage)}
            canRelease={canRelease}
            canStartWo={canStart}
            canHold={canHold}
            canResume={canResume}
            canProgress={canProgress}
            canEditRoute={canRequestRuntimeChange() && !readOnly}
            openInspections={openInspections}
            stageInspections={stageInspections}
            onRelease={() => void run(() => releaseWorkOrder(wo.id), 'Work order released')}
            onStartWo={() => void run(() => startWorkOrder(wo.id), 'Work order started')}
            onHold={() => setDialog('hold')}
            onResume={() => setDialog('resume')}
            onRecordProduction={() => setProgressOpen(true)}
            onStartStage={(stageId, stageName) =>
              void run(() => startWorkOrder(wo.id, { stageId }), `Stage "${stageName}" started`)
            }
            onCompleteStage={(stageId) => setCompleteStageId(stageId)}
            onOverrideComplete={(stageId, stageName, reason) =>
              void run(
                () =>
                  completeStage(wo.id, {
                    stageId,
                    skipQcGate: true,
                    qcOverrideReason: reason,
                  }),
                `Stage "${stageName}" completed (QC override)`,
              )
            }
            onOpenStageQc={(stageId) => setCompleteStageId(stageId)}
            onQcChanged={() => void load()}
            onEditRoute={(seed) => {
              setRuntimeChangeSeed(seed ?? null)
              setRuntimeChangeOpen(true)
            }}
            onSaveOperationResources={async ({ operationId, stageId, workCentreId, machineId }) => {
              const op = wo.operations.find((row) => row.id === operationId)
              if (!op) return
              const reason = 'Updated from route grid'
              try {
                if ((workCentreId || null) !== (op.workCentreId || null)) {
                  const created = await createRuntimeChange(wo.id, {
                    changeType: 'WORK_CENTRE_CHANGE',
                    operationId,
                    stageId,
                    reason,
                    proposedValue: { workCentreId },
                    idempotencyKey: `wc-inline:${operationId}:${workCentreId ?? 'none'}:${crypto.randomUUID()}`,
                  })
                  await applyRuntimeChange(wo.id, created.data.id, {
                    idempotencyKey: `wc-apply:${created.data.id}:${crypto.randomUUID()}`,
                  })
                }
                if ((machineId || null) !== (op.machineId || null)) {
                  const created = await createRuntimeChange(wo.id, {
                    changeType: 'MACHINE_CHANGE',
                    operationId,
                    stageId,
                    reason,
                    proposedValue: { machineId },
                    idempotencyKey: `mc-inline:${operationId}:${machineId ?? 'none'}:${crypto.randomUUID()}`,
                  })
                  await applyRuntimeChange(wo.id, created.data.id, {
                    idempotencyKey: `mc-apply:${created.data.id}:${crypto.randomUUID()}`,
                  })
                }
                notify.success('Operation resources updated')
                await load()
              } catch (e) {
                notify.error(e instanceof Error ? e.message : 'Unable to update operation')
                throw e
              }
            }}
          />
        ) : null}

        {tab === 'assignments' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {assignments.length === 0 ? (
              <p className="text-center text-[13px] text-erp-muted">{t('assignment.noAssignments')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Operator</th>
                      <th>Status</th>
                      <th className="text-right">Assigned</th>
                      <th className="text-right">Completed</th>
                      <th>Machine</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => {
                      const aMeta = assignmentStatusMeta(a.status)
                      return (
                      <tr key={a.id}>
                        <td>{a.stage?.name ?? 'Stage'}</td>
                        <td>{personLabel(a.userId, userNames)}</td>
                        <td><DynamicsStatusChip label={aMeta.label} tone={aMeta.tone} /></td>
                        <td className="text-right tabular-nums">{a.assignedQuantity}</td>
                        <td className="text-right tabular-nums">{a.completedQuantity}</td>
                        <td>{a.machine?.name ?? '—'}</td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {a.status === 'ACCEPTED' || a.status === 'ASSIGNED' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void run(() => startAssignment(a.id), 'Assignment started')}
                              >
                                Start
                              </Button>
                            ) : null}
                            {a.status === 'IN_PROGRESS' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    () => pauseAssignment(a.id, { startDowntime: true }),
                                    'Assignment paused',
                                  )
                                }
                              >
                                Pause
                              </Button>
                            ) : null}
                            {a.status === 'PAUSED' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void run(() => resumeAssignment(a.id), 'Assignment resumed')}
                              >
                                Resume
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setHistoryAssignmentId(a.id)
                                void getAssignmentHistory(a.id)
                                  .then((res) => setAssignmentHistory(res.data))
                                  .catch(() => setAssignmentHistory([]))
                              }}
                            >
                              History
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {assignmentHistory.length > 0 && historyAssignmentId ? (
              <div className="mt-4 border-t border-erp-border pt-4">
                <AssignmentHistory assignments={assignmentHistory} />
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'issues' ? (
          <section className="space-y-3">
            <div className="rounded-lg border border-erp-border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Quality status</h3>
                  <p className="mt-1 text-[12px] text-erp-muted">
                    {wo.qualityStatus === 'NOT_APPLICABLE'
                      ? 'No stage or operation on this work order requires QC. Enable qualityRequired on the routing to activate Quality.'
                      : wo.qualityStatus === 'PENDING_QC'
                        ? 'QC is required. Inspections are created when a quality-required stage is completed.'
                        : 'Linked to the Quality module — inspections and NCRs update this status automatically.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DynamicsStatusChip label={qualityMeta.label} tone={qualityMeta.tone} />
                  <Link to="/quality/queue" className="text-[12px] font-semibold text-erp-primary hover:underline">
                    Quality queue
                  </Link>
                </div>
              </div>
            </div>

            {qualityBlockers.length > 0 ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-rose-900">
                  Quality blockers ({qualityBlockers.length})
                </h3>
                <ul className="space-y-2">
                  {qualityBlockers.map((blocker) => (
                    <li key={`${blocker.code}-${blocker.inspectionId ?? blocker.ncrId ?? blocker.message}`} className="text-[12px] text-rose-900">
                      <span className="font-semibold">{blocker.code}</span>
                      <span className="mx-1">·</span>
                      <span>{blocker.message}</span>
                      {blocker.inspectionId ? (
                        <>
                          {' '}
                          <Link to={`/quality/inspections/${blocker.inspectionId}`} className="font-semibold underline">
                            Open inspection
                          </Link>
                        </>
                      ) : null}
                      {blocker.ncrId ? (
                        <>
                          {' '}
                          <Link to={`/quality/ncrs/${blocker.ncrId}`} className="font-semibold underline">
                            Open NCR
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {openInspections.length > 0 ? (
              <div className="rounded-lg border border-erp-border bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Open inspections</h3>
                  <Link to="/quality/queue" className="text-[12px] font-semibold text-erp-primary hover:underline">
                    Quality queue
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>Inspection</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInspections.map((inspection) => (
                        <tr key={inspection.id}>
                          <td>
                            <Link
                              to={`/quality/inspections/${inspection.id}`}
                              className="font-mono font-semibold text-erp-primary hover:underline"
                            >
                              {inspection.inspectionNumber ?? inspection.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td>{inspection.category?.replace(/_/g, ' ') ?? '—'}</td>
                          <td>{inspection.status}</td>
                          <td>{inspection.stageId ? wo.stages.find((s) => s.id === inspection.stageId)?.name ?? '—' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Production issues</h3>
              {issues.length === 0 ? (
                <p className="text-center text-[13px] text-erp-muted">No issues reported for this work order.</p>
              ) : (
                <ul className="divide-y divide-erp-border">
                  {issues.map((issue) => (
                    <li key={issue.id} className="py-3 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-[11px] text-erp-muted">{issue.issueNumber}</p>
                          <p className="font-semibold text-erp-text">{issue.title}</p>
                          <p className="text-[12px] text-erp-muted">
                            {ISSUE_TYPE_LABELS[issue.issueType]} · {ISSUE_SEVERITY_LABELS[issue.severity]}
                          </p>
                        </div>
                        <IssueStatusBadge status={issue.status} />
                      </div>
                      {issue.description ? <p className="mt-1 text-[13px] text-erp-text">{issue.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        {tab === 'changes' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {!canViewRuntimeChanges() ? (
              <EmptyState icon={ShieldAlert} title="Access denied" description="Missing runtime change view permission." />
            ) : runtimeChanges.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No runtime changes"
                description="Requests, approvals, and applied production exceptions will appear here."
                action={canRequestRuntimeChange() && !readOnly ? <Button size="sm" onClick={() => { setRuntimeChangeSeed(null); setRuntimeChangeOpen(true) }}>Change / Exception</Button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full text-[12px]">
                  <thead><tr><th>Change</th><th>Status</th><th>Risk</th><th>Requested by / on</th><th>Reason</th><th className="text-right">Actions</th></tr></thead>
                  <tbody>{runtimeChanges.map((change) => (
                    <tr key={change.id}>
                      <td><p className="font-medium">{RUNTIME_CHANGE_TYPE_LABELS[change.changeType]}</p><p className="font-mono text-[10px] text-erp-muted">{change.changeNumber}</p></td>
                      <td><StatusDot tone={change.status === 'APPLIED' ? 'success' : change.status === 'FAILED' || change.status === 'REJECTED' ? 'danger' : 'neutral'} label={RUNTIME_CHANGE_STATUS_LABELS[change.status]} /></td>
                      <td>{change.riskLevel.toLowerCase()}</td>
                      <td><p>{change.requestedBy ? userNames[change.requestedBy] ?? 'User' : 'System'}</p><p className="text-[10px] text-erp-muted">{change.requestedAt ? formatDateTime(change.requestedAt) : '—'}</p></td>
                      <td className="max-w-52 truncate" title={change.reason}>{change.reason}</td>
                      <td className="text-right"><div className="flex justify-end gap-1">
                        {change.status === 'DRAFT' && canRequestRuntimeChange() ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void runRuntimeChange(() => submitRuntimeChange(wo.id, change.id), 'Change submitted')}>Submit</Button> : null}
                        {['DRAFT', 'APPROVED'].includes(change.status) && canApplyRuntimeChange() ? <Button size="sm" disabled={busy} onClick={() => void runRuntimeChange(() => applyRuntimeChange(wo.id, change.id), 'Change applied')}>Apply</Button> : null}
                        {change.status === 'PENDING_APPROVAL' && canApproveRuntimeChange() ? <Button size="sm" disabled={busy} onClick={() => void runRuntimeChange(() => approveRuntimeChange(wo.id, change.id), 'Change approved')}>Approve</Button> : null}
                        {change.status === 'PENDING_APPROVAL' && canRejectRuntimeChange() ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void (async () => { const rejectionReason = await appPromptNote({ title: 'Reject change?', confirmLabel: 'Reject', tone: 'danger', note: { required: true, label: 'Reason for rejection' } }); if (rejectionReason !== null) await runRuntimeChange(() => rejectRuntimeChange(wo.id, change.id, { reason: rejectionReason }), 'Change rejected') })()}>Reject</Button> : null}
                        {['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(change.status) && canRequestRuntimeChange() ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void (async () => { const confirmed = await appConfirm({ title: 'Cancel change request?', description: 'This cannot be undone.', confirmLabel: 'Cancel change', tone: 'danger' }); if (confirmed) await runRuntimeChange(() => cancelRuntimeChange(wo.id, change.id), 'Change cancelled') })()}>Cancel</Button> : null}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === 'transfers' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {!canMoveWip() ? (
              <EmptyState icon={ShieldAlert} title="Access denied" description="Missing WIP move permission." />
            ) : wipMovements.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No transfers"
                description="WIP location moves, material relocations, and work-order transfers will appear here."
                action={(canMoveWip() || canTransferMaterials()) && !readOnly ? <Button size="sm" onClick={() => setWipTransferOpen(true)}>Transfer</Button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>Movement</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th className="text-right">Qty</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Posted</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wipMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td>
                          <p className="font-mono text-[11px] font-medium">{movement.movementNumber}</p>
                          {movement.targetProductionOrderNumber ? (
                            <p className="text-[10px] text-erp-muted">→ {movement.targetProductionOrderNumber}</p>
                          ) : null}
                        </td>
                        <td>{WIP_MOVEMENT_TYPE_LABELS[movement.movementType]}</td>
                        <td>
                          <StatusDot
                            tone={movement.status === 'POSTED' ? 'success' : movement.status === 'CANCELLED' ? 'danger' : 'neutral'}
                            label={WIP_MOVEMENT_STATUS_LABELS[movement.status]}
                          />
                        </td>
                        <td className="text-right tabular-nums font-semibold">{movement.quantity}</td>
                        <td>
                          <p className="font-medium">{movement.fromWarehouseCode}</p>
                          <p className="text-[10px] text-erp-muted">{movement.fromWarehouseName}</p>
                        </td>
                        <td>
                          <p className="font-medium">{movement.toWarehouseCode}</p>
                          <p className="text-[10px] text-erp-muted">{movement.toWarehouseName}</p>
                        </td>
                        <td>
                          <p>{movement.physicalPosted ? 'Physical' : 'Logical'}</p>
                          <p className="text-[10px] text-erp-muted">{movement.postedAt ? formatDateTime(movement.postedAt) : '—'}</p>
                        </td>
                        <td className="max-w-52 truncate" title={movement.reason}>{movement.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === 'bom' ? (
          <section className="space-y-3">
            <div className="rounded-lg border border-erp-border bg-white p-4">
              {!wo.bomSnapshot ? (
                <div className="space-y-3 text-center">
                  <p className="text-[13px] text-erp-muted">
                    No BOM snapshot yet — release the work order to snapshot the active BOM version for this WO.
                  </p>
                  {canRequestRuntimeChange() && !readOnly ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRuntimeChangeSeed({ changeType: 'QUANTITY_CHANGE' })
                        setRuntimeChangeOpen(true)
                      }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Change WO quantity
                    </Button>
                  ) : null}
                </div>
              ) : (
                <WorkOrderBomSnapshotPanel
                  snapshot={wo.bomSnapshot}
                  itemLabel={(line) =>
                    items.find((i) => i.id === line.itemId)?.label ??
                    line.descriptionOverride ??
                    'Item'
                  }
                  canEdit={Boolean(perms.canCreateMaterialRequirement && !readOnly && wo.status !== 'DRAFT')}
                  busy={busy}
                  isItemLocked={(line) =>
                    materials.some(
                      (m) =>
                        m.bomLineId === line.id &&
                        (Number(m.reservedQty) > 0 || Number(m.issuedQty) > 0),
                    )
                  }
                  onSaveLine={async (lineId, payload) => {
                    if (lineId) {
                      await updateWorkOrderBomLine(wo.id, lineId, {
                        itemId: payload.itemId,
                        uomId: payload.uomId,
                        scrapPercent: payload.scrapPercent,
                        makeOrBuy: payload.makeOrBuy,
                        lineType: payload.lineType,
                        isOptional: payload.isOptional,
                        descriptionOverride: payload.descriptionOverride,
                        ...(payload.requiredQuantity !== undefined
                          ? { requiredQuantity: payload.requiredQuantity }
                          : { perUnitQuantity: payload.perUnitQuantity }),
                      })
                      notify.success('BOM line updated')
                    } else {
                      await addWorkOrderBomLine(wo.id, {
                        itemId: payload.itemId,
                        uomId: payload.uomId,
                        perUnitQuantity: payload.perUnitQuantity ?? 1,
                        scrapPercent: payload.scrapPercent,
                        makeOrBuy: payload.makeOrBuy,
                        lineType: payload.lineType,
                        isOptional: payload.isOptional,
                        descriptionOverride: payload.descriptionOverride,
                        parentLineId: payload.parentLineId ?? null,
                        syncMaterial: true,
                      })
                      notify.success('BOM line added')
                    }
                    await load()
                    void loadMaterials()
                  }}
                  onRemoveLine={(line) => {
                    void (async () => {
                      const confirmed = await appConfirm({
                        title: 'Remove BOM line?',
                        description:
                          'Removes this line from the work order BOM snapshot (and linked material if unused). Master BOM is unchanged.',
                        confirmLabel: 'Remove',
                        tone: 'danger',
                      })
                      if (!confirmed) return
                      await run(() => removeWorkOrderBomLine(wo.id, line.id), 'BOM line removed')
                      void loadMaterials()
                    })()
                  }}
                  headerActions={
                    <>
                      {wo.routingSnapshot ? (
                        <div className="rounded-md border border-erp-border bg-slate-50 px-3 py-2 text-[11px] text-erp-muted">
                          Routing snapshot v{wo.routingSnapshot.routingVersionNumber}
                          <div>Locked {formatDateTime(wo.routingSnapshot.snapshotAt)}</div>
                        </div>
                      ) : null}
                      {canRequestRuntimeChange() && !readOnly ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setRuntimeChangeSeed({ changeType: 'QUANTITY_CHANGE' })
                            setRuntimeChangeOpen(true)
                          }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          WO qty
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setTab('materials')}>
                        Materials
                      </Button>
                    </>
                  }
                  banner={
                    <p className="rounded-md border border-sky-100 bg-sky-50/70 px-3 py-2 text-[12px] text-sky-900">
                      Edit directly in the grid for <strong>this work order only</strong>. Click the pencil, change
                      values, then ✓ Save. Master BOM is unchanged.
                    </p>
                  }
                />
              )}
            </div>
          </section>
        ) : null}

        {tab === 'materials' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {!perms.canViewMaterials ? (
              <EmptyState icon={ShieldAlert} title="Access denied" description="Missing materials view permission." />
            ) : materialsLoading ? (
              <LoadingState variant="card" />
            ) : materials.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No material requirements"
                description={
                  wo.status === 'DRAFT'
                    ? 'Release this work order to sync BOM material requirements, or add items after release.'
                    : 'Sync from the BOM snapshot, or add items manually for this work order only.'
                }
                action={
                  wo.status !== 'DRAFT' && perms.canCreateMaterialRequirement ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void syncMaterials()}>
                        Sync from BOM
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setEditingMaterial(null)
                          setMaterialEditorOpen(true)
                        }}
                      >
                        Add item
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] text-erp-muted">
                    Control status: <span className="font-medium text-erp-text">{materialMeta.label}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {perms.canCreateMaterialRequirement && !readOnly ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setEditingMaterial(null)
                          setMaterialEditorOpen(true)
                        }}
                      >
                        Add item
                      </Button>
                    ) : null}
                    {perms.canCreateMaterialRequirement ? (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void syncMaterials()}>
                        Sync from BOM
                      </Button>
                    ) : null}
                    {perms.canReserveMaterials ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => reserveWorkOrderMaterials(workOrderId!),
                            'Materials reserved',
                          ).then(() => loadMaterials())
                        }
                      >
                        Reserve all
                      </Button>
                    ) : null}
                    {perms.canCreateMaterialRequirement ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => createWorkOrderShortageRequisition(workOrderId!),
                            'Shortage requisition created',
                          ).then(() => loadMaterials())
                        }
                      >
                        Shortage PR
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right">Required</th>
                        <th className="text-right">Reserved</th>
                        <th className="text-right">Issued</th>
                        <th className="text-right">Shortage</th>
                        <th className="text-right">Free</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((line) => {
                        const itemLabel =
                          items.find((i) => i.id === line.itemId)?.label ??
                          `${line.item.code} — ${line.item.name}`
                        const remaining = Math.max(
                          0,
                          Number(line.requiredQty) - Number(line.issuedQty) + Number(line.returnedQty),
                        )
                        return (
                          <tr key={line.id}>
                            <td className="font-mono text-[11px]">{itemLabel}</td>
                            <td className="text-right tabular-nums">{line.requiredQty}</td>
                            <td className="text-right tabular-nums">{line.reservedQty}</td>
                            <td className="text-right tabular-nums">{line.issuedQty}</td>
                            <td className="text-right tabular-nums">{line.shortageQty}</td>
                            <td className="text-right tabular-nums">{line.freeQty ?? '—'}</td>
                            <td>
                              {(() => {
                                const meta = materialLineMeta(line.status)
                                return <DynamicsStatusChip label={meta.label} tone={meta.tone} />
                              })()}
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center gap-1">
                                {perms.canCreateMaterialRequirement && !readOnly ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditingMaterial(line)
                                      setMaterialEditorOpen(true)
                                    }}
                                  >
                                    Edit…
                                  </Button>
                                ) : null}
                                {perms.canCreateMaterialRequirement &&
                                !readOnly &&
                                Number(line.reservedQty) === 0 &&
                                Number(line.issuedQty) === 0 ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() =>
                                      void run(
                                        () => removeWorkOrderMaterialRequirement(wo.id, line.id),
                                        'Material removed',
                                      ).then(() => loadMaterials())
                                    }
                                  >
                                    Remove
                                  </Button>
                                ) : null}
                                {perms.canReserveMaterials ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() =>
                                      void run(
                                        () => reserveWorkOrderMaterials(workOrderId!, { materialIds: [line.id] }),
                                        'Material reserved',
                                      ).then(() => loadMaterials())
                                    }
                                  >
                                    Reserve
                                  </Button>
                                ) : null}
                                {perms.canIssueMaterials ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy || remaining <= 0}
                                    onClick={() => setIssueMaterial(line)}
                                  >
                                    Issue…
                                  </Button>
                                ) : null}
                                {perms.canReturnMaterials && Number(line.issuedQty) - Number(line.returnedQty) > 0 ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => setReturnMaterial(line)}
                                  >
                                    Return…
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : null}

        {tab === 'timeline' ? (
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {activities.length === 0 ? (
              <p className="text-center text-[13px] text-erp-muted">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex gap-3 border-b border-erp-border/70 pb-3 last:border-0">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-erp-primary" />
                    <div>
                      <p className="text-[13px] font-semibold text-erp-text">{a.activityType.replace(/_/g, ' ')}</p>
                      <p className="text-[12px] text-erp-muted">{formatDateTime(a.createdAt)}</p>
                      <p className="text-[12px] text-erp-text">{a.message}</p>
                      {a.reason ? <p className="text-[12px] text-erp-muted">Reason: {a.reason}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {tab === 'ledger' ? (
          <section className="space-y-3">
            <div className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold">Finished goods receipts</h3>
              {fgReceipts.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No FG receipts posted yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Status</th>
                        <th className="text-right">Qty</th>
                        <th>Warehouse</th>
                        <th>Batch / Lot</th>
                        <th>Posted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fgReceipts.map((receipt) => (
                        <tr key={receipt.id}>
                          <td className="font-mono font-medium">{receipt.receiptNumber}</td>
                          <td>{receipt.status}</td>
                          <td className="text-right tabular-nums">
                            {receipt.acceptedQuantity || receipt.receiptQuantity}
                            {receipt.uom?.code ? ` ${receipt.uom.code}` : ''}
                          </td>
                          <td>{receipt.warehouse?.name ?? receipt.warehouse?.code ?? '—'}</td>
                          <td>{receipt.batchOrLotNumber || '—'}</td>
                          <td>
                            {receipt.postedAt
                              ? formatDateTime(receipt.postedAt)
                              : receipt.receiptDate
                                ? formatDate(receipt.receiptDate)
                                : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Stage progress ledger</h3>
              {ledger.length === 0 ? (
                <p className="text-center text-[13px] text-erp-muted">No progress recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Type</th>
                        <th className="text-right">Good</th>
                        <th className="text-right">Rework</th>
                        <th className="text-right">Rejected</th>
                        <th className="text-right">Scrap</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((entry) => (
                        <tr key={entry.id}>
                          <td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                          <td>{entry.transactionType.replace(/_/g, ' ')}</td>
                          <td className="text-right tabular-nums">{entry.goodQuantity}</td>
                          <td className="text-right tabular-nums">{entry.reworkQuantity}</td>
                          <td className="text-right tabular-nums">{entry.rejectedQuantity}</td>
                          <td className="text-right tabular-nums">{entry.scrapQuantity}</td>
                          <td className="max-w-xs truncate" title={entry.remarks ?? undefined}>
                            {entry.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === 'costing' ? <WorkOrderCostingPanel workOrderId={wo.id} /> : null}

        {readOnly ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
            This work order is read-only.
          </p>
        ) : null}
      </div>

      <MaterialIssueDrawer
        open={Boolean(issueMaterial)}
        onClose={() => setIssueMaterial(null)}
        material={issueMaterial}
        workOrderNo={wo.workOrderNo}
        busy={busy}
        onSubmit={(payload) =>
          run(async () => {
            await issueWorkOrderMaterial(wo.id, payload)
            setIssueMaterial(null)
          }, 'Material issued').then(() => loadMaterials())
        }
      />

      <MaterialReturnDrawer
        open={Boolean(returnMaterial)}
        onClose={() => setReturnMaterial(null)}
        material={returnMaterial}
        workOrderNo={wo.workOrderNo}
        busy={busy}
        onSubmit={(payload) =>
          run(async () => {
            await returnWorkOrderMaterial(wo.id, payload)
            setReturnMaterial(null)
          }, 'Material returned').then(() => loadMaterials())
        }
      />

      <FgReceiptDrawer
        open={fgReceiptOpen}
        onClose={() => setFgReceiptOpen(false)}
        workOrderId={wo.id}
        workOrderNo={wo.workOrderNo}
        onPosted={() => {
          void load().then(() => {
            if (!getFulfilmentAutoMode()) return
            if (relatedSo) {
              notify.success('FG posted — continue on Sales Order fulfilment')
              navigate(`/crm/sales-orders/${relatedSo.id}`)
            } else {
              notify.info('FG posted — open Dispatch when a sales order is linked')
            }
          })
        }}
      />

      <RecordProgressDrawer
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        stages={wo.stages}
        currentStageId={wo.currentStageId}
        busy={busy}
        onSubmit={(payload) =>
          run(async () => {
            const stage = wo.stages.find((s) => s.id === payload.stageId)
            if (stage && (stage.status === 'NOT_STARTED' || stage.status === 'READY')) {
              await startWorkOrder(wo.id, { stageId: payload.stageId })
            }
            await recordProgress(wo.id, payload)
            setProgressOpen(false)
          }, 'Progress recorded')
        }
      />

      <CompleteStageModal
        open={Boolean(completeStageId)}
        onClose={() => setCompleteStageId(null)}
        workOrderId={wo.id}
        stage={completeStageId ? wo.stages.find((s) => s.id === completeStageId) ?? null : null}
        inspection={
          completeStageId
            ? openInspections.find((i) => i.stageId === completeStageId) ?? null
            : null
        }
        onDone={() => void load()}
      />

      <AssignmentDrawer
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        workOrder={wo}
        onCreated={() => void load()}
      />

      <RuntimeChangeDrawer
        open={runtimeChangeOpen}
        onClose={() => {
          setRuntimeChangeOpen(false)
          setRuntimeChangeSeed(null)
        }}
        workOrder={wo}
        onChanged={() => void load()}
        initialChangeType={runtimeChangeSeed?.changeType}
        initialOperationId={runtimeChangeSeed?.operationId}
        initialStageId={runtimeChangeSeed?.stageId}
      />

      <MaterialRequirementDrawer
        open={materialEditorOpen}
        onClose={() => {
          setMaterialEditorOpen(false)
          setEditingMaterial(null)
        }}
        workOrderId={wo.id}
        material={editingMaterial}
        onSaved={() => {
          void loadMaterials()
          void load()
        }}
      />

      <WipTransferDrawer
        open={wipTransferOpen}
        onClose={() => setWipTransferOpen(false)}
        workOrder={wo}
        onChanged={() => void load()}
      />
      <CorrectionDrawer
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        onChanged={() => void load()}
        context={{ workOrderId: wo.id, workOrderNumber: wo.workOrderNo }}
      />
      <ManufacturingActionDrawer
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        closeDisabled={busy}
        title="Split Work Order"
        subtitle={`${wo.workOrderNo} · Remaining ${Math.max(0, Number(wo.plannedQuantity) - Number(wo.completedGoodQuantity))}`}
        widthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setSplitOpen(false)}>Cancel</Button>
            <Button
              disabled={
                busy ||
                !(Number(splitQuantity) > 0) ||
                Number(splitQuantity) >= Number(wo.plannedQuantity) - Number(wo.completedGoodQuantity)
              }
              onClick={() =>
                void run(async () => {
                  const result = await splitWorkOrder(wo.id, {
                    quantity: Number(splitQuantity),
                    reason: splitReason.trim() || undefined,
                  })
                  setSplitOpen(false)
                  setSplitQuantity('')
                  setSplitReason('')
                  navigate(`/manufacturing/work-orders/${result.data.child.id}`)
                }, 'Work order split created')
              }
            >
              Create Split
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Split quantity" required>
            <Input
              type="number"
              min="0"
              step="any"
              value={splitQuantity}
              onChange={(event) => setSplitQuantity(event.target.value)}
              placeholder="Quantity for child work order"
            />
          </FormField>
          <FormField label="Reason">
            <Textarea
              value={splitReason}
              onChange={(event) => setSplitReason(event.target.value)}
              rows={3}
              placeholder="Optional split reason"
            />
          </FormField>
          <p className="text-[12px] text-erp-muted">
            The child receives cloned BOM and routing snapshots. Existing progress and ledger history remain on the parent.
          </p>
        </div>
      </ManufacturingActionDrawer>

      <Modal
        open={dialog === 'hold'}
        onClose={() => setDialog(null)}
        title="Put Work Order On Hold"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => holdWorkOrder(wo.id, { reasonCategory: holdReason, remarks: remarks.trim() || undefined, expectedResumeAt: holdExpectedResume || undefined }),
                  'Work order put on hold',
                )
              }
            >
              Hold
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <FormField label="Reason Category" required>
            <Select value={holdReason} onChange={(e) => setHoldReason(e.target.value as HoldReasonCategory)}>
              {HOLD_REASON_CATEGORY_VALUES.map((r) => (
                <option key={r} value={r}>
                  {HOLD_REASON_CATEGORY_LABELS[r]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Expected Resume Date">
            <Input type="date" value={holdExpectedResume} onChange={(e) => setHoldExpectedResume(e.target.value)} />
          </FormField>
          <FormField label="Remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={dialog === 'resume'}
        onClose={() => setDialog(null)}
        title="Resume Work Order"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void run(() => resumeWorkOrder(wo.id, { remarks: remarks.trim() || undefined }), 'Work order resumed')}>
              Resume
            </Button>
          </div>
        }
      >
        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
      </Modal>

      <CompleteWorkOrderDialog
        open={dialog === 'complete'}
        onClose={() => setDialog(null)}
        workOrder={wo}
        busy={busy}
        onConfirm={(completeRemarks) =>
          void run(async () => {
            const res = await completeWorkOrder(wo.id, { remarks: completeRemarks.trim() || undefined })
            const warnings = res.data.warnings ?? []
            warnings.forEach((w) => notify.warning(w))
            if (!getFulfilmentAutoMode()) return
            const pendingFg = warnings.includes('FINISHED_GOODS_RECEIPT_PENDING')
            if (pendingFg && perms.canPostFgReceipt) {
              setFgReceiptOpen(true)
              return
            }
            if (relatedSo) {
              notify.success('Production complete — open Sales Order fulfilment for dispatch')
            }
          }, 'Work order completed')
        }
      />

      <Modal
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel Work Order"
        closeDisabled={busy}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Back
            </Button>
            <Button disabled={busy || !perms.canCancel} onClick={() => void run(() => cancelWorkOrder(wo.id, { reason: remarks.trim() || undefined }), 'Work order cancelled')}>
              Confirm Cancel
            </Button>
          </div>
        }
      >
        <FormField label="Reason">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
      </Modal>
    </OperationalPageShell>
  )
}
