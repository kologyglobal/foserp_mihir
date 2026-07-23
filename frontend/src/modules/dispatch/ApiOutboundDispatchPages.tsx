/**
 * API-mode Outbound Dispatch register + detail.
 * Aligned with packing/pick OperationalPageShell patterns and CRM/purchase view standards.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
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
import { SalesOrderDispatchFulfilmentPanel } from '@/modules/dispatch/SalesOrderDispatchFulfilmentPanel'
import { formatApiError } from '@/services/api/apiErrors'
import {
  cancelOutboundDispatch,
  confirmOutboundDispatch,
  createDispatchPackingSessions,
  getOutboundDispatch,
  listOutboundDispatches,
  postOutboundDispatch,
  reverseOutboundDispatch,
  type OutboundDispatch,
  type OutboundDispatchStatus,
} from '@/services/api/dispatchApi'
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
  { key: 'confirmed', label: 'Confirmed', match: (s) => s === 'CONFIRMED' },
  { key: 'closed', label: 'Cancelled / Reversed', match: (s) => s === 'CANCELLED' || s === 'REVERSED' },
]

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

  async function reload() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setDetail(await getOutboundDispatch(id))
    } catch (e) {
      setError(errMsg(e))
      setDetail(null)
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

  async function onPostDispatch() {
    if (!id || !detail) return
    const ok = await appConfirm({
      title: 'Post dispatch?',
      description: `Post ${detail.dispatchNo} as confirmed stock-out?`,
      confirmLabel: 'Post dispatch',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await postOutboundDispatch(id)
      notify.success(`Posted ${detail.dispatchNo}`)
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onReverse() {
    if (!id || !detail) return
    const note = await appPromptNote({
      title: 'Reverse dispatch?',
      description: `Reverse posted dispatch ${detail.dispatchNo}?`,
      confirmLabel: 'Reverse',
      tone: 'danger',
      note: { required: true, label: 'Reason', placeholder: 'Why reverse this dispatch?' },
    })
    if (note == null) return
    setBusy(true)
    try {
      await reverseOutboundDispatch(id, { reason: note })
      notify.success(`Reversed ${detail.dispatchNo}`)
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
  const canPost = isDraft && isWorkbench
  const canReverse = status === 'CONFIRMED'

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
            {canStartPacking ? (
              <CommandBarButton
                icon={Package}
                label="Start packing"
                onClick={() => void onStartPacking()}
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
        onReserved={() => void reload()}
      />

      {error ? (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</div>
      ) : null}

      <DispatchLifecycleStrip status={status} />

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

      {detail.salesOrderId ? (
        <DetailSection title="Sales order fulfilment">
          <SalesOrderDispatchFulfilmentPanel salesOrderId={detail.salesOrderId} />
        </DetailSection>
      ) : null}
    </OperationalPageShell>
  )
}
