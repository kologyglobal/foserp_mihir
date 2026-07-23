/**
 * API-mode Outbound Dispatch register + detail.
 * Aligned with packing/pick OperationalPageShell patterns and CRM/purchase view standards.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  RefreshCw,
  RotateCcw,
  Send,
  Truck,
  Warehouse,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DetailSection } from '@/components/masters/MasterLayouts'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DataGrid } from '@/components/design-system/DataGrid'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { DispatchReservationDrawer } from '@/modules/dispatch/DispatchReservationDrawer'
import { DispatchPodPanel } from '@/modules/dispatch/DispatchPodPanel'
import { EmergencyOverrideDrawer } from '@/modules/dispatch/EmergencyOverrideDrawer'
import { SalesOrderDispatchFulfilmentPanel } from '@/modules/dispatch/SalesOrderDispatchFulfilmentPanel'
import { formatApiError } from '@/services/api/apiErrors'
import {
  cancelOutboundDispatch,
  confirmOutboundDispatch,
  createDeliveryChallan,
  createDispatchPackingSessions,
  createDispatchPickLists,
  getOutboundDispatch,
  getOutboundPostingReadiness,
  listDeliveryChallans,
  listDispatchPickLists,
  listOutboundDispatches,
  postOutboundDispatch,
  reverseOutboundDispatch,
  getOutboundReversalDependencies,
  type OutboundDispatch,
  type OutboundDispatchStatus,
} from '@/services/api/dispatchApi'
import { getFulfilmentAutoMode, setFulfilmentAutoMode } from '@/modules/manufacturing/ui'
import {
  advanceAfterReserve,
} from '@/modules/dispatch/fulfilmentAutoAdvance'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

function errMsg(e: unknown): string {
  return formatApiError(e) || (e instanceof Error ? e.message : 'Request failed')
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function statusTone(status: OutboundDispatchStatus): 'neutral' | 'info' | 'success' | 'warning' | 'critical' {
  switch (status) {
    case 'DRAFT':
      return 'info'
    case 'CONFIRMED':
      return 'success'
    case 'CANCELLED':
      return 'neutral'
    case 'REVERSED':
      return 'warning'
    default:
      return 'neutral'
  }
}

const LIFECYCLE: { key: string; label: string; match: (s: OutboundDispatchStatus) => boolean }[] = [
  { key: 'draft', label: 'Draft', match: (s) => s === 'DRAFT' },
  { key: 'reserved', label: 'Reserved / Pack', match: (s) => s === 'DRAFT' },
  { key: 'confirmed', label: 'Posted', match: (s) => s === 'CONFIRMED' },
  { key: 'closed', label: 'Cancelled / Reversed', match: (s) => s === 'CANCELLED' || s === 'REVERSED' },
]

type GateMap = Record<string, { ready: boolean; detail: string }>

/** Phase 7C5 coach — Reserve → Pick → Pack → Issue Challan → Post. */
function HardenedPostingCoach({
  gates,
  canPost,
  onReserve,
  onPick,
  onPack,
  onChallan,
  onPost,
  busy,
}: {
  gates?: GateMap
  canPost: boolean
  onReserve: () => void
  onPick: () => void
  onPack: () => void
  onChallan: () => void
  onPost: () => void
  busy: boolean
}) {
  const [autoMode, setAutoMode] = useState(getFulfilmentAutoMode)
  useEffect(() => {
    setFulfilmentAutoMode(autoMode)
  }, [autoMode])

  const steps: Array<{
    id: string
    label: string
    ready: boolean
    detail: string
    action?: { label: string; onClick: () => void }
  }> = [
    {
      id: 'reservation',
      label: 'Reserve',
      ready: Boolean(gates?.reservation?.ready),
      detail: gates?.reservation?.detail ?? 'Reserve FG against this outbound',
      action: { label: 'Reserve stock', onClick: onReserve },
    },
    {
      id: 'pick',
      label: 'Pick',
      ready: Boolean(gates?.pick?.ready),
      detail: gates?.pick?.detail ?? 'Create and complete a pick list',
      action: { label: 'Create pick list', onClick: onPick },
    },
    {
      id: 'pack',
      label: 'Pack',
      ready: Boolean(gates?.pack?.ready),
      detail: gates?.pack?.detail ?? 'Complete packing session',
      action: { label: 'Start packing', onClick: onPack },
    },
    {
      id: 'challan',
      label: 'Challan',
      ready: Boolean(gates?.challan?.ready),
      detail: gates?.challan?.detail ?? 'Issue delivery challan (document)',
      action: { label: 'Create / open challan', onClick: onChallan },
    },
    {
      id: 'post',
      label: 'Post',
      ready: canPost,
      detail: canPost
        ? 'All gates clear — post FG_DISPATCH stock-out'
        : 'Posting blocked until gates pass',
      action: canPost ? { label: 'Post Dispatch (7C5)', onClick: onPost } : undefined,
    },
  ]

  const current = steps.find((s) => !s.ready) ?? steps[steps.length - 1]

  return (
    <div className="mb-4 space-y-2">
      <ol className="grid gap-2 sm:grid-cols-5" aria-label="Hardened posting steps">
        {steps.map((step, i) => (
          <li key={step.id}>
            <div
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left',
                step.id === current.id
                  ? 'border-erp-primary bg-erp-primary/5'
                  : step.ready
                    ? 'border-emerald-200 bg-emerald-50/80'
                    : 'border-erp-border bg-erp-surface',
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">
                {i + 1}. {step.label}
              </p>
              <p className="mt-0.5 text-[12px] text-erp-text">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-[12px] text-sky-950">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">7C5 next:</span> {current.label} — {current.detail}
          {autoMode ? (
            <span className="mt-0.5 block text-sky-900/80">
              Auto Mode opens Pick → Pack → Challan → Post after each success (you still confirm Post).
            </span>
          ) : null}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              className="rounded border-sky-400"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
            />
            Auto Mode
          </label>
          {current.action ? (
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={current.action.onClick}
            >
              {current.action.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DispatchLifecycleStrip({ status }: { status: OutboundDispatchStatus }) {
  const activeIdx =
    status === 'CANCELLED' || status === 'REVERSED'
      ? 3
      : status === 'CONFIRMED'
        ? 2
        : 0

  return (
    <ol className="mb-4 flex flex-wrap items-center gap-1 rounded border border-erp-border bg-erp-surface/60 px-3 py-2 text-[11px]">
      {LIFECYCLE.map((step, idx) => {
        const done = idx < activeIdx || (idx === activeIdx && status === 'CONFIRMED' && step.key === 'confirmed')
        const current = idx === activeIdx
        return (
          <li key={step.key} className="flex items-center gap-1">
            {idx > 0 ? <span className="mx-1 text-erp-muted">→</span> : null}
            <span
              className={cn(
                'rounded px-2 py-0.5 font-semibold',
                current && 'bg-erp-primary/10 text-erp-primary',
                done && !current && 'text-erp-muted',
                !done && !current && 'text-erp-muted/70',
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function ApiOutboundDispatchRegisterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OutboundDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { items } = await listOutboundDispatches({ page: 1, limit: 50 })
      setRows(items)
    } catch (e) {
      setError(errMsg(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo(
    () => [
      {
        accessorKey: 'dispatchNo',
        header: 'Dispatch #',
        cell: ({ row }: { row: { original: OutboundDispatch } }) => (
          <Link className="font-semibold text-erp-primary hover:underline" to={`/dispatch/${row.original.id}`}>
            {row.original.dispatchNo}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: { original: OutboundDispatch } }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'salesOrder',
        header: 'Sales order',
        cell: ({ row }: { row: { original: OutboundDispatch } }) =>
          row.original.salesOrderId ? (
            <Link className="text-erp-primary hover:underline" to={`/crm/sales-orders/${row.original.salesOrderId}`}>
              {row.original.salesOrderNo ?? shortId(row.original.salesOrderId)}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        id: 'lines',
        header: 'Lines',
        cell: ({ row }: { row: { original: OutboundDispatch } }) => String(row.original.lines?.length ?? 0),
      },
      {
        id: 'planned',
        header: 'Planned',
        cell: ({ row }: { row: { original: OutboundDispatch } }) =>
          row.original.plannedDispatchDate ? formatDate(row.original.plannedDispatchDate.slice(0, 10)) : '—',
      },
      {
        id: 'created',
        header: 'Created',
        cell: ({ row }: { row: { original: OutboundDispatch } }) =>
          formatDate(row.original.createdAt.slice(0, 10)),
      },
    ],
    [],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Dispatch"
      title="Outbound Dispatch Register"
      description="Outbound dispatches linked to sales orders — reserve, pack, and confirm stock-out."
      showDescription
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} />
            <CommandBarButton icon={Truck} label="Workbench" primary onClick={() => navigate('/dispatch/workbench')} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      {error ? (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</div>
      ) : null}
      {loading ? (
        <LoadingState variant="table" rows={6} cols={5} />
      ) : (
        <DataGrid data={rows} columns={columns} compact emptyMessage="No outbound dispatches yet." />
      )}
    </OperationalPageShell>
  )
}

export function ApiOutboundDispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<OutboundDispatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [readiness, setReadiness] = useState<{
    hardBlockers?: Array<{ code: string; message: string }>
    warnings?: Array<{ code: string; message: string }>
    allowedActions?: string[]
    gates?: Record<string, { ready: boolean; detail: string }>
    lifecycleStatus?: string
    quantity?: Record<string, number | null>
    hardenedPostingEnabled?: boolean
    emergencyOverride?: {
      canRequest?: boolean
      requiresPermission?: string
      overridableBlockers?: Array<{ code: string; message: string }>
      neverOverridableBlockers?: Array<{ code: string; message: string }>
      unknownBlockers?: Array<{ code: string; message: string }>
      message?: string
    }
  } | null>(null)

  async function reload() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const row = await getOutboundDispatch(id)
      setDetail(row)
      if (row.planningSource === 'WORKBENCH_7C1' || row.status === 'DRAFT') {
        try {
          setReadiness(await getOutboundPostingReadiness(id, 'post'))
        } catch {
          setReadiness(null)
        }
      } else {
        setReadiness(null)
      }
    } catch (e) {
      setError(errMsg(e))
      setDetail(null)
      setReadiness(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (searchParams.get('reserve') === '1' && detail?.status === 'DRAFT') {
      setReserveOpen(true)
    }
  }, [searchParams, detail?.status])

  useEffect(() => {
    if (searchParams.get('focus') !== 'post' || !detail || detail.status !== 'DRAFT') return
    const el = document.getElementById('dispatch-7c5-coach')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [searchParams, detail?.status, detail?.id])

  async function onConfirmStockOut() {
    if (!id || !detail) return
    const ok = await appConfirm({
      title: 'Confirm stock-out?',
      description: `Confirm stock-out for ${detail.dispatchNo}? This posts an inventory issue.`,
      confirmLabel: 'Confirm stock-out',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await confirmOutboundDispatch(id)
      notify.success(`Confirmed ${detail.dispatchNo}`)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onCancelDraft() {
    if (!id || !detail) return
    const note = await appPromptNote({
      title: 'Cancel draft',
      description: `Cancel draft dispatch ${detail.dispatchNo}?`,
      confirmLabel: 'Cancel draft',
      tone: 'danger',
      note: { required: false, label: 'Reason', placeholder: 'Optional reason' },
    })
    if (note == null) return
    setBusy(true)
    try {
      await cancelOutboundDispatch(id, note || undefined)
      notify.success(`Cancelled ${detail.dispatchNo}`)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onStartPacking() {
    if (!id || !detail) return
    const ok = await appConfirm({
      title: 'Start packing?',
      description: `Create packing session(s) for ${detail.dispatchNo}?`,
      confirmLabel: 'Start packing',
    })
    if (!ok) return
    setBusy(true)
    try {
      const sessions = await createDispatchPackingSessions(id, {
        idempotencyKey: `packing-${id}-${Date.now()}`,
      })
      const sessionId = sessions[0]?.id
      if (sessionId) navigate(`/dispatch/packing-sessions/${sessionId}`)
      else await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onCreatePickList() {
    if (!id || !detail) return
    setBusy(true)
    try {
      const existing = await listDispatchPickLists({ outboundDispatchId: id, limit: 5 })
      const open = existing.items?.find((p) => p.status !== 'CANCELLED' && p.status !== 'PICKED')
      if (open?.id) {
        navigate(`/dispatch/pick-lists/${open.id}/pick`)
        return
      }
      const done = existing.items?.find((p) => p.status === 'PICKED')
      if (done?.id) {
        notify.info('Pick list already complete — refresh readiness')
        await reload()
        return
      }
      const created = await createDispatchPickLists(id, {
        idempotencyKey: `pick-${id}-${Date.now()}`,
      })
      const pickId = created[0]?.id
      notify.success('Pick list created')
      if (pickId) navigate(`/dispatch/pick-lists/${pickId}/pick`)
      else await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onCreateOrOpenChallan() {
    if (!id || !detail) return
    setBusy(true)
    try {
      const existing = await listDeliveryChallans({ outboundDispatchId: id, limit: 5 })
      const active = existing.items?.find((c) => c.status !== 'CANCELLED')
      if (active?.id) {
        navigate(`/dispatch/delivery-challans/${active.id}`)
        return
      }
      const created = await createDeliveryChallan(id, {
        idempotencyKey: `dc-${id}-${Date.now()}`,
      })
      notify.success('Delivery challan draft created — issue it to clear the 7C5 gate')
      navigate(`/dispatch/delivery-challans/${created.id}`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onPostDispatch() {
    if (!id || !detail || busy) return
    if (!readiness?.allowedActions?.includes('POST')) {
      setError('Dispatch cannot be posted until all readiness gates pass.')
      return
    }
    const qty = readiness.quantity as
      | {
          requestedQty?: number
          reservedQty?: number
          pickedQty?: number
          packedQty?: number
          challanQty?: number
          salesOrderRemainingQty?: number | null
        }
      | undefined
    const qtyLines = qty
      ? [
          `Requested ${qty.requestedQty ?? '—'}`,
          `Reserved ${qty.reservedQty ?? '—'}`,
          `Picked ${qty.pickedQty ?? '—'}`,
          `Packed ${qty.packedQty ?? '—'}`,
          `Challan ${qty.challanQty ?? '—'}`,
          qty.salesOrderRemainingQty != null
            ? `SO remaining after post ≈ ${Math.max(0, Number(qty.salesOrderRemainingQty) - Number(qty.requestedQty ?? 0))}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : detail.dispatchNo
    const ok = await appConfirm({
      title: 'Post Dispatch',
      description: `${qtyLines}\n\nThis action posts Finished Goods Inventory outward and contributes to Sales Order fulfilment. The posting cannot be edited directly.`,
      confirmLabel: 'Post Dispatch',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await postOutboundDispatch(id, { idempotencyKey: `post-${id}` })
      notify.success('Dispatch posted successfully.')
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onEmergencyOverridePost(payload: {
    businessReason: string
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    riskAcknowledged: true
    approvedByName: string
    approvalReference?: string
    expiresAt: string
    scope: string
    remarks?: string
  }) {
    if (!id || !detail || busy) return
    setBusy(true)
    setError(null)
    try {
      await postOutboundDispatch(id, {
        idempotencyKey: `emergency-post-${id}-${Date.now()}`,
        emergency: true,
        overrideReason: payload.businessReason,
        emergencyOverride: payload,
      })
      notify.success('Emergency override granted — dispatch posted')
      setEmergencyOpen(false)
      await reload()
    } catch (e) {
      setError(errMsg(e))
      notify.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onReverse() {
    if (!id || !detail) return
    try {
      const depRes = await getOutboundReversalDependencies(id)
      const deps = depRes.dependencies ?? []
      if (deps.length) {
        const summary = deps.map((d) => `${d.code}: ${d.message}`).join('\n')
        setError(summary)
        notify.error('Reversal blocked — clear linked Sales Invoice / posted COGS first')
        return
      }
    } catch (e) {
      // Soft: if preflight fails, still allow prompt — server enforces hard block.
      notify.error(errMsg(e))
    }
    const note = await appPromptNote({
      title: 'Request Dispatch Reversal',
      description:
        'Posted Dispatches are immutable. Reversal creates compensating Inventory and fulfilment transactions — it does not delete the original posting.',
      confirmLabel: 'Apply Reversal',
      tone: 'danger',
      note: { required: true, label: 'Reason', placeholder: 'Why reverse this dispatch?' },
    })
    if (note == null) return
    setBusy(true)
    try {
      const result = await reverseOutboundDispatch(id, { reason: note })
      if (result.awaitingApproval) {
        notify.success(
          `Reversal ${result.reversal.reversalNumber} submitted for approval`,
        )
      } else {
        notify.success(`Reversed ${detail.dispatchNo}`)
      }
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!id) {
    return (
      <OperationalPageShell title="Outbound Dispatch" description="Missing dispatch id.">
        <Link className="text-[13px] font-semibold text-erp-primary hover:underline" to="/dispatch/register">
          Back to register
        </Link>
      </OperationalPageShell>
    )
  }

  const status = detail?.status
  const isDraft = status === 'DRAFT'
  const isWorkbench = detail?.planningSource === 'WORKBENCH_7C1'
  /** Basic 7C0 drafts use soft confirm; workbench uses hardened 7C5 post. */
  const canConfirm = isDraft && !isWorkbench
  const canStartPacking = isDraft
  const backendAllowsPost = readiness?.allowedActions?.includes('POST') === true
  const readinessLoaded = readiness != null
  const canPost = isDraft && isWorkbench && readinessLoaded && backendAllowsPost
  const canReverse = status === 'CONFIRMED'
  const postBlocked = isDraft && isWorkbench && readinessLoaded && !backendAllowsPost
  const postBlockers = readiness?.hardBlockers ?? []
  const emergencyMeta = readiness?.emergencyOverride
  const canEmergencyOverride =
    postBlocked &&
    (emergencyMeta?.canRequest === true ||
      (emergencyMeta?.neverOverridableBlockers?.length === 0 &&
        (emergencyMeta?.overridableBlockers?.length ?? 0) > 0))
  const showEmergencyDrawerEntry = postBlocked
  const awaitingReadiness = isDraft && isWorkbench && !readinessLoaded && !error

  const lineColumns = useMemo(
    () => [
      {
        accessorKey: 'lineNo' as const,
        header: '#',
        cell: ({ row }: { row: { original: OutboundDispatch['lines'][number] } }) => String(row.original.lineNo),
      },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }: { row: { original: OutboundDispatch['lines'][number] } }) => (
          <span className="font-medium text-erp-text" title={row.original.itemId}>
            {shortId(row.original.itemId)}
          </span>
        ),
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }: { row: { original: OutboundDispatch['lines'][number] } }) => (
          <span title={row.original.warehouseId}>{shortId(row.original.warehouseId)}</span>
        ),
      },
      {
        accessorKey: 'quantity' as const,
        header: 'Qty',
        cell: ({ row }: { row: { original: OutboundDispatch['lines'][number] } }) => (
          <span className="tabular-nums">{row.original.quantity}</span>
        ),
      },
      {
        id: 'ready',
        header: 'Ready snap.',
        cell: ({ row }: { row: { original: OutboundDispatch['lines'][number] } }) =>
          row.original.readyQuantitySnapshot != null ? (
            <span className="tabular-nums">{row.original.readyQuantitySnapshot}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'movement',
        header: 'Movement',
        cell: ({ row }: { row: { original: OutboundDispatch['lines'][number] } }) =>
          row.original.inventoryMovementNo ?? '—',
      },
    ],
    [],
  )

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Dispatch"
        title="Outbound Dispatch"
        backLink={{ to: '/dispatch/register', label: 'Back to register' }}
      >
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  if (!detail || !status) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Dispatch"
        title="Outbound Dispatch"
        description={error ?? 'Dispatch not found.'}
        backLink={{ to: '/dispatch/register', label: 'Back to register' }}
      >
        <p className="text-[13px] text-erp-muted">This outbound dispatch could not be loaded.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Dispatch"
      title={detail.dispatchNo}
      description={
        detail.salesOrderNo
          ? `Sales order ${detail.salesOrderNo} · outbound stock-out`
          : 'Outbound dispatch — reserve, pack, confirm stock-out'
      }
      showDescription
      backLink={{ to: '/dispatch/register', label: 'Back to register' }}
      actions={<DynamicsStatusChip label={status.replace(/_/g, ' ')} tone={statusTone(status)} />}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void reload()} disabled={busy} />
            {isDraft ? (
              <CommandBarButton
                icon={Warehouse}
                label="Reserve stock"
                onClick={() => setReserveOpen(true)}
                disabled={busy}
              />
            ) : null}
            {isDraft && isWorkbench ? (
              <CommandBarButton
                icon={ClipboardList}
                label="Create pick list"
                onClick={() => void onCreatePickList()}
                disabled={busy}
              />
            ) : null}
            {canStartPacking ? (
              <CommandBarButton
                icon={Package}
                label="Start packing"
                onClick={() => void onStartPacking()}
                disabled={busy}
              />
            ) : null}
            {isDraft && isWorkbench ? (
              <CommandBarButton
                icon={FileText}
                label="Create challan"
                onClick={() => void onCreateOrOpenChallan()}
                disabled={busy}
              />
            ) : null}
            {canConfirm ? (
              <CommandBarButton
                icon={CheckCircle2}
                label="Confirm stock-out"
                primary
                onClick={() => void onConfirmStockOut()}
                disabled={busy}
              />
            ) : null}
            {isDraft ? (
              <CommandBarButton icon={Ban} label="Cancel draft" onClick={() => void onCancelDraft()} disabled={busy} />
            ) : null}
            {canPost ? (
              <CommandBarButton
                icon={Send}
                label="Post Dispatch (7C5)"
                primary
                onClick={() => void onPostDispatch()}
                disabled={busy}
              />
            ) : null}
            {showEmergencyDrawerEntry ? (
              <CommandBarButton
                icon={Send}
                label="Emergency override…"
                onClick={() => setEmergencyOpen(true)}
                disabled={busy}
              />
            ) : null}
            {canReverse ? (
              <CommandBarButton
                icon={RotateCcw}
                label="Reverse (7C5)"
                onClick={() => void onReverse()}
                disabled={busy}
              />
            ) : null}
          </CommandBarGroup>
        </CommandBar>
      }
    >
      <DispatchReservationDrawer
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        dispatchId={id}
        onReserved={() => {
          void reload().then(() => {
            void advanceAfterReserve(id, navigate)
          })
        }}
      />

      <EmergencyOverrideDrawer
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        title="Emergency Dispatch Override"
        documentLabel={detail?.dispatchNo ?? id}
        blockedAction="POST_DISPATCH"
        blockers={
          emergencyMeta?.overridableBlockers?.length
            ? emergencyMeta.overridableBlockers
            : postBlockers
        }
        neverOverridableBlockers={[
          ...(emergencyMeta?.neverOverridableBlockers ?? []),
          ...(emergencyMeta?.unknownBlockers ?? []),
        ]}
        busy={busy}
        onSubmit={onEmergencyOverridePost}
      />

      {error ? (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</div>
      ) : null}

      <DispatchLifecycleStrip status={status} />

      {isWorkbench && isDraft && readiness ? (
        <div id="dispatch-7c5-coach">
          <HardenedPostingCoach
            gates={readiness.gates}
            canPost={canPost}
            busy={busy}
            onReserve={() => setReserveOpen(true)}
            onPick={() => void onCreatePickList()}
            onPack={() => void onStartPacking()}
            onChallan={() => void onCreateOrOpenChallan()}
            onPost={() => void onPostDispatch()}
          />
        </div>
      ) : null}

      {isWorkbench && awaitingReadiness ? (
        <div className="mb-3 rounded border border-erp-border bg-erp-surface px-3 py-2 text-[13px] text-erp-muted">
          Loading posting readiness…
        </div>
      ) : null}

      {isWorkbench && readiness ? (
        <DetailSection title="Posting readiness (7C5)">
          <p className="mb-2 text-[12px] text-erp-muted">
            Lifecycle: {readiness.lifecycleStatus ?? status}
            {readiness.quantity?.requestedQty != null
              ? ` · Requested ${readiness.quantity.requestedQty}`
              : ''}
            {readiness.hardenedPostingEnabled === false
              ? ' · Hardened posting flag OFF'
              : ''}
          </p>
          <ul className="mb-3 grid gap-1 text-[13px] sm:grid-cols-2">
            {Object.entries(readiness.gates ?? {}).map(([key, gate]) => (
              <li key={key} className="flex gap-2">
                <span className={gate.ready ? 'text-emerald-700' : 'text-rose-700'}>
                  {gate.ready ? '✓' : '✗'}
                </span>
                <span>
                  <span className="font-semibold capitalize">{key}</span>: {gate.detail}
                </span>
              </li>
            ))}
          </ul>
          {postBlocked ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              <p className="font-semibold">Dispatch cannot be posted.</p>
              <ul className="mt-1 list-disc pl-5">
                {postBlockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
              {emergencyMeta?.message ? (
                <p className="mt-2 text-[12px] text-amber-900/90">{emergencyMeta.message}</p>
              ) : null}
              {canEmergencyOverride ? (
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-erp-primary underline"
                  onClick={() => setEmergencyOpen(true)}
                >
                  Open Emergency Dispatch Override…
                </button>
              ) : null}
            </div>
          ) : null}
        </DetailSection>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
        <Link
          to="/dispatch/packing-sessions"
          className="rounded border border-erp-border px-2.5 py-1.5 font-semibold text-erp-primary hover:bg-erp-surface"
        >
          Packing sessions
        </Link>
        <Link
          to="/dispatch/pick-lists"
          className="rounded border border-erp-border px-2.5 py-1.5 font-semibold text-erp-primary hover:bg-erp-surface"
        >
          Pick lists
        </Link>
        <Link
          to="/dispatch/delivery-challans"
          className="rounded border border-erp-border px-2.5 py-1.5 font-semibold text-erp-primary hover:bg-erp-surface"
        >
          Delivery challans
        </Link>
        <Link
          to="/dispatch/workbench"
          className="rounded border border-erp-border px-2.5 py-1.5 font-semibold text-erp-primary hover:bg-erp-surface"
        >
          Workbench
        </Link>
      </div>

      <DetailSection title="Summary">
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Sales order</dt>
            <dd className="mt-0.5">
              {detail.salesOrderId ? (
                <Link className="font-semibold text-erp-primary hover:underline" to={`/crm/sales-orders/${detail.salesOrderId}`}>
                  {detail.salesOrderNo ?? shortId(detail.salesOrderId)}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Planned date</dt>
            <dd className="mt-0.5">{detail.plannedDispatchDate ? formatDate(detail.plannedDispatchDate.slice(0, 10)) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Preferred warehouse</dt>
            <dd className="mt-0.5" title={detail.preferredWarehouseId ?? undefined}>
              {shortId(detail.preferredWarehouseId)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Ship-to</dt>
            <dd className="mt-0.5">{detail.shipToAddress?.trim() || detail.shipToKey || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Confirmed</dt>
            <dd className="mt-0.5">
              {detail.confirmedAt ? new Date(detail.confirmedAt).toLocaleString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Lines</dt>
            <dd className="mt-0.5 tabular-nums">{detail.lines.length}</dd>
          </div>
        </dl>
        {detail.remarks ? (
          <p className="mt-3 rounded border border-erp-border/70 bg-erp-surface/40 px-3 py-2 text-[12px] text-erp-muted">
            {detail.remarks}
          </p>
        ) : null}
        {detail.cancellationReason ? (
          <p className="mt-2 text-[12px] text-rose-700">Cancel reason: {detail.cancellationReason}</p>
        ) : null}
      </DetailSection>

      <DetailSection title="Lines">
        <DataGrid
          data={detail.lines}
          columns={lineColumns}
          compact
          emptyMessage="No lines on this dispatch."
        />
      </DetailSection>

      {status === 'CONFIRMED' || detail.deliveryStatus ? (
        <DetailSection title="Proof of Delivery">
          <DispatchPodPanel detail={detail} onChanged={() => void reload()} />
        </DetailSection>
      ) : null}

      {detail.salesOrderId ? (
        <DetailSection title="Sales order fulfilment">
          <SalesOrderDispatchFulfilmentPanel salesOrderId={detail.salesOrderId} />
        </DetailSection>
      ) : null}
    </OperationalPageShell>
  )
}
