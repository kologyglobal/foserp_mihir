import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  Info,
  Package,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  ShieldAlert,
  UserPlus,
  AlertTriangle,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot } from '@/components/design-system/StatusDot'
import { ErpCommandBar, type ErpCommandAction } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
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
  createWorkOrderShortageRequisition,
  recordProgress,
  releaseWorkOrder,
  reserveWorkOrderMaterials,
  resumeWorkOrder,
  returnWorkOrderMaterial,
  startWorkOrder,
  splitWorkOrder,
  syncWorkOrderMaterialRequirements,
  listRuntimeChanges,
  submitRuntimeChange,
  applyRuntimeChange,
  approveRuntimeChange,
  rejectRuntimeChange,
  cancelRuntimeChange,
  listWipMovements,
} from '@/services/api/manufacturingApi'
import { getWorkOrderQualityBlockers, listInspections, type QualityBlocker, type QualityInspection } from '@/services/api/qualityApi'
import type {
  HoldReasonCategory,
  ProductionActivityEntry,
  ProductionOrderMaterial,
  ProductionStageLedgerEntry,
  WorkOrderDetail,
} from '@/types/manufacturingProduction'
import {
  HOLD_REASON_CATEGORY_LABELS,
  HOLD_REASON_CATEGORY_VALUES,
} from '@/types/manufacturingProduction'
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
  DocumentInfoPanel,
  NextBestActionBanner,
  WorkOrderHealthBadge,
  WorkOrderStatusBadge,
  assignmentStatusMeta,
  materialLineMeta,
  qualityStatusMeta,
  stageStatusMeta,
  type NextBestAction,
} from '../ui'
import { RecordProgressDrawer } from './components/RecordProgressDrawer'
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
  { id: 'stages', label: 'Stages' },
  { id: 'materials', label: 'Materials' },
  { id: 'issues', label: 'Quality' },
  { id: 'changes', label: 'Changes' },
  { id: 'timeline', label: 'Timeline' },
]

const MORE_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'assignments', label: 'Assignments' },
  { id: 'transfers', label: 'Job Work / Transfers' },
  { id: 'costing', label: 'Costing' },
  { id: 'bom', label: 'BOM Snapshot' },
  { id: 'ledger', label: 'Documents / Ledger' },
]

type Dialog = null | 'hold' | 'resume' | 'complete' | 'cancel'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-erp-text">{value ?? '—'}</div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-erp-border bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-erp-text">{value}</div>
    </div>
  )
}

function personLabel(id: string | null | undefined, names: Record<string, string>): string {
  if (!id) return '—'
  return names[id] ?? 'Assigned'
}

function sourceLabel(wo: WorkOrderDetail): string {
  const source = wo.sourceType === 'SALES_ORDER' ? 'Sales Order' : wo.sourceType.replace(/_/g, ' ')
  if (wo.jobNumber) return `${source} · Job ${wo.jobNumber}`
  return source
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-erp-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
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
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignments, setAssignments] = useState<ProductionAssignment[]>([])
  const [issues, setIssues] = useState<ProductionIssue[]>([])
  const [historyAssignmentId, setHistoryAssignmentId] = useState<string | null>(null)
  const [assignmentHistory, setAssignmentHistory] = useState<ProductionAssignment[]>([])
  const [materials, setMaterials] = useState<ProductionOrderMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [issueMaterial, setIssueMaterial] = useState<ProductionOrderMaterial | null>(null)
  const [returnMaterial, setReturnMaterial] = useState<ProductionOrderMaterial | null>(null)
  const [fgReceiptOpen, setFgReceiptOpen] = useState(false)
  const [qualityBlockers, setQualityBlockers] = useState<QualityBlocker[]>([])
  const [openInspections, setOpenInspections] = useState<QualityInspection[]>([])
  const [runtimeChanges, setRuntimeChanges] = useState<RuntimeChange[]>([])
  const [runtimeChangeOpen, setRuntimeChangeOpen] = useState(false)
  const [wipMovements, setWipMovements] = useState<WipMovement[]>([])
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
    return items.find((i) => i.id === wo.productItemId)?.label ?? 'Product'
  }, [items, wo])

  const [tabsMoreOpen, setTabsMoreOpen] = useState(false)

  const load = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    try {
      const [detail, acts, ledgerEntries, assignmentRows, issueRows, blockerRes, inspectionRes, changeRows, movementRows] = await Promise.all([
        getWorkOrderDetail(workOrderId),
        getWorkOrderActivities(workOrderId),
        getWorkOrderLedger(workOrderId),
        phase2b.canViewAssignments ? listWorkOrderAssignments(workOrderId, { limit: 50 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        phase2b.canViewIssues ? listIssues({ productionOrderId: workOrderId, limit: 50 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        getWorkOrderQualityBlockers(workOrderId).catch(() => ({ data: { blockers: [] } })),
        listInspections({ productionOrderId: workOrderId, status: 'PENDING', limit: 20 }).catch(() => ({ data: [] })),
        canViewRuntimeChanges() ? listRuntimeChanges(workOrderId, { limit: 100 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canMoveWip() ? listWipMovements(workOrderId, { limit: 100 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ])
      setWo(detail.data)
      setActivities(acts.data)
      setLedger(ledgerEntries.data)
      setAssignments(assignmentRows.data)
      setIssues(issueRows.data)
      setQualityBlockers(blockerRes.data.blockers)
      setOpenInspections(inspectionRes.data)
      setRuntimeChanges(changeRows.data)
      setWipMovements(movementRows.data)
      const needNames =
        Boolean(detail.data.supervisorId) ||
        Boolean(detail.data.managerId) ||
        assignmentRows.data.some((a) => a.userId) ||
        changeRows.data.some((change) => change.requestedBy)
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
  }, [navigate, workOrderId, phase2b.canViewAssignments, phase2b.canViewIssues])

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
      const readiness = await getWorkOrderMaterialsReadiness(workOrderId)
      setMaterials(readiness.data.materials)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load materials')
    } finally {
      setMaterialsLoading(false)
    }
  }, [perms.canViewMaterials, workOrderId])

  useEffect(() => {
    if (tab === 'materials') void loadMaterials()
  }, [tab, loadMaterials])

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      setBusy(true)
      try {
        await fn()
        notify.success(okMsg)
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
  const completionPct = Math.min(100, Math.max(0, Math.round(Number(wo.completionPercent) || 0)))
  const qualityMeta = qualityStatusMeta(wo.qualityStatus)
  const visibleMoreTabs = MORE_TABS.filter((item) => item.id !== 'costing' || canViewCost())
  const moreTabActive = visibleMoreTabs.some((t) => t.id === tab)

  const primaryAction: ErpCommandAction | undefined = canRelease
    ? { id: 'release', label: 'Release Work Order', icon: Play, onClick: () => void run(() => releaseWorkOrder(wo.id), 'Work order released') }
    : canStart
      ? { id: 'start', label: 'Start Production', icon: Play, onClick: () => void run(() => startWorkOrder(wo.id), 'Work order started') }
      : canResume
        ? { id: 'resume', label: 'Resume', icon: Play, onClick: () => setDialog('resume') }
        : canProgress
          ? { id: 'update', label: 'Record Production', icon: CheckCircle2, onClick: () => setProgressOpen(true) }
          : canReceiveFg
            ? { id: 'fg-receipt', label: 'Receive Finished Goods', icon: Package, onClick: () => setFgReceiptOpen(true) }
            : readOnly
              ? { id: 'review', label: 'Review', icon: CheckCircle2, onClick: () => setTab('timeline') }
              : undefined

  const nextBestAction: NextBestAction | null = canRelease
    ? {
        label: 'Release this work order to lock BOM and routing snapshots.',
        description: 'Material requirements sync at release; production can begin after readiness passes.',
        action: { label: 'Release Work Order', onClick: () => void run(() => releaseWorkOrder(wo.id), 'Work order released') },
      }
    : canStart
      ? {
          label: 'Ready to start production.',
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
          : canReceiveFg
            ? {
                label: 'Production complete — receive finished goods into inventory.',
                tone: 'success',
                action: { label: 'Receive Finished Goods', onClick: () => setFgReceiptOpen(true) },
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
      ? [{ id: 'runtime-change', label: 'Change / Exception', icon: AlertTriangle, onClick: () => setRuntimeChangeOpen(true) }]
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
      <div className="space-y-3">
        {nextBestAction ? <NextBestActionBanner nba={nextBestAction} /> : null}
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Material Control: <strong>Not connected to Inventory</strong> · Quality:{' '}
            <strong>{qualityMeta.label}</strong>
            {qualityBlockers.length > 0 ? (
              <>
                {' '}
                · <strong>{qualityBlockers.length} quality blocker{qualityBlockers.length === 1 ? '' : 's'}</strong>
              </>
            ) : null}
            {openInspections.length > 0 ? (
              <>
                {' '}
                ·{' '}
                <Link to="/quality/queue" className="font-semibold underline">
                  {openInspections.length} open inspection{openInspections.length === 1 ? '' : 's'}
                </Link>
              </>
            ) : null}
          </span>
        </div>

        {wo.status === 'COMPLETED' && !canReceiveFg ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-900">
            Operational Production Complete — Finished Goods Receipt pending.
          </div>
        ) : null}

        <div className="rounded-lg border border-erp-border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-lg font-semibold text-erp-primary">{wo.workOrderNo}</p>
              <p className="text-[14px] font-medium text-erp-text">{productLabel}</p>
              <p className="mt-1 text-[12px] text-erp-muted">{sourceLabel(wo)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <WorkOrderStatusBadge status={wo.status} />
              <WorkOrderHealthBadge health={wo.healthStatus} />
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
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Planned Qty" value={<span className="tabular-nums">{wo.plannedQuantity}</span>} />
            <Field label="Due" value={wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—'} />
            <Field label="Supervisor" value={personLabel(wo.supervisorId, userNames)} />
            <Field label="Priority" value={wo.priority} />
          </div>
          {wo.status === 'ON_HOLD' ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              On hold — {wo.holdReasonCategory ? HOLD_REASON_CATEGORY_LABELS[wo.holdReasonCategory] : 'Reason not set'}
              {wo.holdRemarks ? `: ${wo.holdRemarks}` : ''}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryTile label="Planned" value={wo.plannedQuantity} />
          <SummaryTile label="Good" value={wo.completedGoodQuantity} />
          <SummaryTile label="Rework" value={wo.reworkQuantity} />
          <SummaryTile label="Rejected" value={wo.rejectedQuantity} />
          <SummaryTile label="Scrap" value={wo.scrapQuantity} />
          <SummaryTile label="Completion" value={`${completionPct}%`} />
        </div>

        <div className="relative flex flex-wrap items-center gap-1 rounded-lg border border-erp-border bg-white p-1" role="tablist" aria-label="Work order tabs">
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
                'shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                tab === item.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
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
                'inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                moreTabActive || tabsMoreOpen
                  ? 'bg-erp-primary text-white'
                  : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              More
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            {tabsMoreOpen ? (
              <ul
                role="listbox"
                className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-md border border-erp-border bg-white py-1 shadow-lg"
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

        {tab === 'overview' ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <section className="rounded-lg border border-erp-border bg-white p-4 lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold">Basic info</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Product" value={productLabel} />
                <Field label="Plant" value={wo.plantCode || '—'} />
                <Field label="Manager" value={personLabel(wo.managerId, userNames)} />
                <Field label="Supervisor" value={personLabel(wo.supervisorId, userNames)} />
                <Field label="Released" value={wo.releasedAt ? formatDateTime(wo.releasedAt) : '—'} />
                <Field label="Started" value={wo.actualStartAt ? formatDateTime(wo.actualStartAt) : '—'} />
                <Field label="Completed" value={wo.actualCompletedAt ? formatDateTime(wo.actualCompletedAt) : '—'} />
                <Field label="Notes" value={wo.notes || '—'} />
              </div>
            </section>
            <div className="space-y-3">
              <section className="rounded-lg border border-erp-border bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold">Completion</h3>
                <div className="flex justify-between text-[11px] text-erp-muted">
                  <span>Progress</span>
                  <span className="tabular-nums">{completionPct}%</span>
                </div>
                <ProgressBar pct={completionPct} />
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between"><dt className="text-erp-muted">Planned</dt><dd className="tabular-nums font-semibold">{wo.plannedQuantity}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Good</dt><dd className="tabular-nums font-semibold">{wo.completedGoodQuantity}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Rework</dt><dd className="tabular-nums">{wo.reworkQuantity}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Rejected</dt><dd className="tabular-nums">{wo.rejectedQuantity}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Scrap</dt><dd className="tabular-nums">{wo.scrapQuantity}</dd></div>
                </dl>
              </section>
              <DocumentInfoPanel
                sections={[
                  {
                    title: 'General',
                    fields: [
                      { label: 'Document', value: wo.workOrderNo },
                      { label: 'Priority', value: wo.priority },
                      { label: 'Plant', value: wo.plantCode || '—' },
                      { label: 'Supervisor', value: personLabel(wo.supervisorId, userNames) },
                    ],
                  },
                  {
                    title: 'Dates',
                    fields: [
                      { label: 'Created', value: wo.createdAt ? formatDate(wo.createdAt) : '—' },
                      { label: 'Required', value: wo.requiredCompletionDate ? formatDate(wo.requiredCompletionDate) : '—' },
                      { label: 'Released', value: wo.releasedAt ? formatDate(wo.releasedAt) : '—' },
                      { label: 'Started', value: wo.actualStartAt ? formatDate(wo.actualStartAt) : '—' },
                      { label: 'Completed', value: wo.actualCompletedAt ? formatDate(wo.actualCompletedAt) : '—' },
                    ],
                  },
                  {
                    title: 'Source',
                    fields: [
                      { label: 'Source type', value: sourceLabel(wo) },
                      { label: 'Job number', value: wo.jobNumber || '—' },
                    ],
                  },
                  {
                    title: 'Setup',
                    fields: [
                      {
                        label: 'BOM snapshot',
                        value: wo.bomSnapshot ? `v${wo.bomSnapshot.bomVersionNumber} (locked)` : 'Not yet snapshotted',
                      },
                      {
                        label: 'Routing snapshot',
                        value: wo.routingSnapshot ? 'Locked at release' : 'Not yet snapshotted',
                      },
                    ],
                  },
                ]}
              />
            </div>
          </div>
        ) : null}

        {tab === 'stages' ? (
          <section className="space-y-2">
            {wo.stages.length === 0 ? (
              <div className="rounded-lg border border-erp-border bg-white px-4 py-10 text-center text-[13px] text-erp-muted">
                No stages yet — release the work order to snapshot the routing and compute stage readiness.
              </div>
            ) : (
              wo.stages
                .slice()
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((stage) => {
                  const stageMeta = stageStatusMeta(stage.status)
                  const canCompleteStage =
                    !['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(stage.status) &&
                    perms.canExecuteStage &&
                    wo.status === 'IN_PROGRESS'
                  return (
                    <article key={stage.id} className="rounded-lg border border-erp-border bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-erp-muted">Stage {stage.displayOrder}</p>
                          <h3 className="text-[14px] font-semibold text-erp-text">
                            {stage.name}
                            {stage.isOptional ? (
                              <span className="ml-1 text-[11px] font-normal text-erp-muted">(optional)</span>
                            ) : null}
                          </h3>
                        </div>
                        <DynamicsStatusChip label={stageMeta.label} tone={stageMeta.tone} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-erp-muted">
                        <span className="tabular-nums">Planned {stage.plannedQuantity}</span>
                        <span className="tabular-nums font-semibold text-erp-text">Good {stage.goodQuantity}</span>
                        <span className="tabular-nums">Rework {stage.reworkQuantity}</span>
                        <span className="tabular-nums">Rejected {stage.rejectedQuantity}</span>
                        <span className="tabular-nums">Scrap {stage.scrapQuantity}</span>
                      </div>
                      {canCompleteStage ? (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(() => completeStage(wo.id, { stageId: stage.id }), `Stage "${stage.name}" completed`)
                            }
                          >
                            Complete Stage
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  )
                })
            )}
          </section>
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
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
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
                action={canRequestRuntimeChange() && !readOnly ? <Button size="sm" onClick={() => setRuntimeChangeOpen(true)}>Change / Exception</Button> : undefined}
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
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            {!wo.bomSnapshot ? (
              <p className="text-center text-[13px] text-erp-muted">
                No BOM snapshot yet — release the work order to snapshot the active BOM version.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[12px] text-erp-muted">
                  BOM v{wo.bomSnapshot.bomVersionNumber} snapshot — base quantity {wo.bomSnapshot.baseQuantity}. Read-only;
                  later master revisions never change this work order.
                </p>
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th>Seq</th>
                        <th>Item</th>
                        <th className="text-right">Per Unit Qty</th>
                        <th className="text-right">Scrap %</th>
                        <th className="text-right">Required Qty</th>
                        <th>Make/Buy</th>
                        <th>Line Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.bomSnapshot.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="tabular-nums">{line.sequence}</td>
                          <td className="text-[12px]">{items.find((i) => i.id === line.itemId)?.label ?? line.descriptionOverride ?? 'Item'}</td>
                          <td className="text-right tabular-nums">{line.perUnitQuantity}</td>
                          <td className="text-right tabular-nums">{line.scrapPercent}</td>
                          <td className="text-right tabular-nums font-semibold">{line.requiredQuantity}</td>
                          <td>{line.makeOrBuy}</td>
                          <td>{line.lineType.replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
                    ? 'Release this work order to sync BOM material requirements.'
                    : 'Sync requirements from the BOM snapshot to begin reservation and issue.'
                }
                action={
                  wo.status !== 'DRAFT' && perms.canCreateMaterialRequirement ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => syncWorkOrderMaterialRequirements(workOrderId!),
                          'Material requirements synced',
                        ).then(() => loadMaterials())
                      }
                    >
                      Sync requirements
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] text-erp-muted">
                    Control status: <span className="font-medium text-erp-text">{wo.materialControlStatus.replace(/_/g, ' ')}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {perms.canCreateMaterialRequirement ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => syncWorkOrderMaterialRequirements(workOrderId!),
                            'Material requirements synced',
                          ).then(() => loadMaterials())
                        }
                      >
                        Sync
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
          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
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
                        <td className="text-erp-muted">{entry.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
        onPosted={() => void load()}
      />

      <RecordProgressDrawer
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        stages={wo.stages}
        busy={busy}
        onSubmit={(payload) =>
          run(async () => {
            await recordProgress(wo.id, payload)
            setProgressOpen(false)
          }, 'Progress recorded')
        }
      />

      <AssignmentDrawer
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        workOrder={wo}
        onCreated={() => void load()}
      />

      <RuntimeChangeDrawer
        open={runtimeChangeOpen}
        onClose={() => setRuntimeChangeOpen(false)}
        workOrder={wo}
        onChanged={() => void load()}
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
            res.data.warnings.forEach((w) => notify.warning(w))
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
