/**
 * Phase 7C2 — Pick list register, detail, and tablet pick mode.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Play,
  RefreshCw,
  Truck,
} from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { TableLink } from '@/components/ui/AppLink'
import { DetailSection } from '@/components/masters/MasterLayouts'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import { getFulfilmentAutoMode } from '@/modules/manufacturing/ui'
import { advanceAfterPickComplete } from '@/modules/dispatch/fulfilmentAutoAdvance'
import {
  completeDispatchPickList,
  getDispatchPickList,
  listDispatchPickLists,
  pickDispatchPickLine,
  releaseDispatchPickList,
  reportDispatchPickShortage,
  startDispatchPickList,
  unpickDispatchPickLine,
  type DispatchPickLine,
  type DispatchPickList,
} from '@/services/api/dispatchApi'

function ApiRequiredShell({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate()
  return (
    <OperationalPageShell title={title} description={description}>
      <p className="text-sm text-erp-muted p-4">
        Set <code>VITE_USE_API=true</code> for Phase 7C2 pick lists. Demo mode uses the legacy
        dispatch plan workspace.
      </p>
      <Button size="sm" onClick={() => navigate('/dispatch/plan')}>
        Open demo Dispatch Plan
      </Button>
    </OperationalPageShell>
  )
}

export function DispatchPickListRegisterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DispatchPickList[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { items } = await listDispatchPickLists({ limit: 100 })
      setRows(items)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load pick lists')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!isApiMode()) {
    return (
      <ApiRequiredShell
        title="Pick lists"
        description="Store picking register (Phase 7C2)."
      />
    )
  }

  return (
    <OperationalPageShell
      title="Pick lists"
      description="Phase 7C2 — store picking from reserved FG. Picked ≠ Dispatched until confirm."
      badge={`${rows.length} lists`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} />
            <CommandBarButton
              icon={ClipboardList}
              label="Workbench"
              onClick={() => navigate('/dispatch/workbench')}
            />
            <CommandBarButton
              icon={Truck}
              label="Outbound register"
              onClick={() => navigate('/dispatch/register')}
            />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <DataGrid
          data={rows}
          compact
          emptyMessage="No pick lists yet — reserve stock on a draft dispatch, then create pick lists."
          columns={[
            {
              accessorKey: 'pickListNumber',
              header: 'Pick list',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/pick-lists/${row.original.id}`}>
                  {row.original.pickListNumber}
                </TableLink>
              ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => <StatusBadge status={row.original.status} />,
            },
            {
              id: 'dispatch',
              header: 'Dispatch',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/${row.original.outboundDispatchId}`}>
                  {row.original.outboundDispatchId.slice(0, 8)}
                </TableLink>
              ),
            },
            {
              accessorKey: 'warehouseId',
              header: 'Warehouse',
              cell: ({ row }) => row.original.warehouseId.slice(0, 8),
            },
            {
              accessorKey: 'assignedTo',
              header: 'Assigned',
              cell: ({ row }) => row.original.assignedTo ?? '—',
            },
            {
              id: 'lines',
              header: 'Lines',
              cell: ({ row }) => String(row.original.lines?.length ?? 0),
            },
          ]}
        />
      )}
    </OperationalPageShell>
  )
}

function usePickList(id: string | undefined) {
  const [row, setRow] = useState<DispatchPickList | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id || !isApiMode()) {
      setRow(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setRow(await getDispatchPickList(id))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load pick list')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return { row, loading, busy, setBusy, reload: load }
}

export function DispatchPickListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { row, loading, busy, setBusy, reload } = usePickList(id)

  async function act(label: string, fn: () => Promise<unknown>, opts?: { afterComplete?: boolean }) {
    setBusy(true)
    try {
      await fn()
      notify.success(label)
      await reload()
      if (opts?.afterComplete && row?.outboundDispatchId) {
        await advanceAfterPickComplete(row.outboundDispatchId, navigate)
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isApiMode()) {
    return (
      <ApiRequiredShell title="Pick list" description="Store pick list detail (Phase 7C2)." />
    )
  }

  if (loading) return <LoadingState variant="card" />
  if (!row || !id) {
    return (
      <OperationalPageShell title="Pick list" description="Not found">
        <Button variant="secondary" onClick={() => navigate('/dispatch/pick-lists')}>
          Back to pick lists
        </Button>
      </OperationalPageShell>
    )
  }

  const canRelease = row.status === 'DRAFT'
  const canStart = row.status === 'DRAFT' || row.status === 'RELEASED'
  const canPick = !['CANCELLED', 'PICKED'].includes(row.status)
  const canComplete = canPick && row.status !== 'DRAFT'

  return (
    <OperationalPageShell
      title={row.pickListNumber}
      description={`Picked ≠ Dispatched · ${row.status.replace(/_/g, ' ')}`}
      backLink={{ to: '/dispatch/pick-lists', label: 'Pick lists' }}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void reload()} disabled={busy} />
            {canRelease ? (
              <CommandBarButton
                icon={Truck}
                label="Release"
                onClick={() => void act('Pick list released', () => releaseDispatchPickList(id))}
                disabled={busy}
              />
            ) : null}
            {canStart ? (
              <CommandBarButton
                icon={Play}
                label="Start"
                primary
                onClick={() => void act('Pick list started', () => startDispatchPickList(id))}
                disabled={busy}
              />
            ) : null}
            {canPick ? (
              <CommandBarButton
                icon={ClipboardList}
                label="Continue Picking"
                primary={!canStart}
                onClick={() => navigate(`/dispatch/pick-lists/${id}/pick`)}
                disabled={busy}
              />
            ) : null}
            {canComplete ? (
              <CommandBarButton
                icon={CheckCircle2}
                label="Complete"
                onClick={() =>
                  void act('Pick list completed', () => completeDispatchPickList(id), {
                    afterComplete: true,
                  })
                }
                disabled={busy}
              />
            ) : null}
          </CommandBarGroup>
        </CommandBar>
      }
    >
      <div className="mb-6 flex flex-wrap gap-3">
        {canRelease ? (
          <Button size="lg" className="min-w-[140px]" disabled={busy} onClick={() => void act('Released', () => releaseDispatchPickList(id))}>
            Release
          </Button>
        ) : null}
        {canStart ? (
          <Button size="lg" className="min-w-[140px]" disabled={busy} onClick={() => void act('Started', () => startDispatchPickList(id))}>
            Start
          </Button>
        ) : null}
        {canPick ? (
          <Button
            size="lg"
            variant="primary"
            className="min-w-[180px]"
            disabled={busy}
            onClick={() => navigate(`/dispatch/pick-lists/${id}/pick`)}
          >
            Continue Picking
          </Button>
        ) : null}
      </div>

      <DetailSection title="Header">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Dispatch</dt>
            <dd>
              <Link className="text-primary underline" to={`/dispatch/${row.outboundDispatchId}`}>
                {row.outboundDispatchId.slice(0, 8)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Warehouse</dt>
            <dd>{row.warehouseId.slice(0, 8)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Assigned</dt>
            <dd>{row.assignedTo ?? '—'}</dd>
          </div>
        </dl>
      </DetailSection>

      <DetailSection title="Lines">
        <PickListLinesTable
          pickListId={id}
          lines={row.lines ?? []}
          busy={busy}
          setBusy={setBusy}
          onChanged={() => void reload()}
          compactActions
        />
      </DetailSection>
    </OperationalPageShell>
  )
}

function PickListLinesTable({
  pickListId,
  lines,
  busy,
  setBusy,
  onChanged,
  compactActions,
}: {
  pickListId: string
  lines: DispatchPickLine[]
  busy: boolean
  setBusy: (v: boolean) => void
  onChanged: () => void
  compactActions?: boolean
}) {
  async function shortage(line: DispatchPickLine) {
    const qty = prompt('Shortage quantity', String(Math.max(0, line.reservedQuantity - line.pickedQuantity)))
    if (!qty) return
    setBusy(true)
    try {
      await reportDispatchPickShortage(pickListId, {
        pickLineId: line.id,
        quantity: Number(qty),
        idempotencyKey: `short-${line.id}-${Date.now()}`,
      })
      notify.success('Shortage recorded')
      onChanged()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Shortage failed')
    } finally {
      setBusy(false)
    }
  }

  async function unpick(line: DispatchPickLine) {
    const qty = prompt('Unpick quantity', String(line.pickedQuantity))
    if (!qty) return
    setBusy(true)
    try {
      await unpickDispatchPickLine(pickListId, {
        pickLineId: line.id,
        quantity: Number(qty),
        idempotencyKey: `unpick-${line.id}-${Date.now()}`,
      })
      notify.success('Unpick recorded')
      onChanged()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Unpick failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DataGrid
      data={lines}
      compact
      columns={[
        { accessorKey: 'itemId', header: 'Item', cell: ({ row }) => row.original.itemId.slice(0, 8) },
        { accessorKey: 'requestedQuantity', header: 'Requested' },
        { accessorKey: 'reservedQuantity', header: 'Reserved' },
        { accessorKey: 'pickedQuantity', header: 'Picked' },
        { accessorKey: 'shortageQuantity', header: 'Shortage' },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        {
          id: 'actions',
          header: '',
          cell: ({ row }) =>
            compactActions ? (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void shortage(row.original)}>
                  Shortage
                </Button>
                <Button size="sm" variant="secondary" disabled={busy || row.original.pickedQuantity <= 0} onClick={() => void unpick(row.original)}>
                  Unpick
                </Button>
              </div>
            ) : null,
        },
      ]}
    />
  )
}

export function DispatchPickListPickModePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { row, loading, busy, setBusy, reload } = usePickList(id)
  const [lineIndex, setLineIndex] = useState(0)
  const [pickQty, setPickQty] = useState('')

  const lines = row?.lines ?? []
  const current = lines[lineIndex]
  const remaining = useMemo(() => {
    if (!current) return 0
    return Math.max(0, current.reservedQuantity - current.pickedQuantity - current.shortageQuantity)
  }, [current])

  useEffect(() => {
    if (current) setPickQty(String(remaining))
  }, [current?.id, remaining])

  if (!isApiMode()) {
    return <ApiRequiredShell title="Pick mode" description="Tablet pick mode (Phase 7C2)." />
  }

  if (loading) return <LoadingState variant="card" />
  if (!row || !id || !lines.length) {
    return (
      <OperationalPageShell title="Pick mode" description="No lines">
        <Button onClick={() => navigate(`/dispatch/pick-lists/${id ?? ''}`)}>Back</Button>
      </OperationalPageShell>
    )
  }

  const pickListId = id

  async function confirmPick() {
    if (!current || busy) return
    const qty = Number(pickQty)
    if (!qty || qty <= 0) {
      notify.error('Enter pick quantity')
      return
    }
    setBusy(true)
    try {
      await pickDispatchPickLine(pickListId, {
        pickLineId: current.id,
        quantity: qty,
        idempotencyKey: `pick-${current.id}-${Date.now()}`,
      })
      notify.success('Pick recorded')
      const refreshed = await getDispatchPickList(pickListId)
      await reload()
      const dispatchId = refreshed.outboundDispatchId
      if (!getFulfilmentAutoMode() || !dispatchId) return
      const allDone = (refreshed.lines ?? []).every(
        (l) => l.pickedQuantity + l.shortageQuantity >= l.reservedQuantity - 1e-9,
      )
      if (!allDone || refreshed.status === 'PICKED' || refreshed.status === 'CANCELLED') return
      try {
        await completeDispatchPickList(pickListId)
        notify.success('Pick list completed')
        await advanceAfterPickComplete(dispatchId, navigate)
      } catch (completeErr) {
        notify.info(
          completeErr instanceof Error
            ? `Lines picked — complete manually (${completeErr.message})`
            : 'Lines picked — complete the pick list to continue',
        )
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Pick failed')
    } finally {
      setBusy(false)
    }
  }

  async function reportShortage() {
    if (!current || busy) return
    const qty = Number(pickQty) || remaining
    setBusy(true)
    try {
      await reportDispatchPickShortage(pickListId, {
        pickLineId: current.id,
        quantity: qty,
        idempotencyKey: `short-pick-${current.id}-${Date.now()}`,
      })
      notify.success('Shortage recorded')
      await reload()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Shortage failed')
    } finally {
      setBusy(false)
    }
  }

  async function unpick() {
    if (!current || busy) return
    const qty = Number(pickQty) || current.pickedQuantity
    setBusy(true)
    try {
      await unpickDispatchPickLine(pickListId, {
        pickLineId: current.id,
        quantity: qty,
        idempotencyKey: `unpick-pick-${current.id}-${Date.now()}`,
      })
      notify.success('Unpick recorded')
      await reload()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Unpick failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OperationalPageShell
      title={`Pick · ${row.pickListNumber}`}
      description={`Line ${lineIndex + 1} of ${lines.length} · Picked ≠ Dispatched`}
      backLink={{ to: `/dispatch/pick-lists/${id}`, label: 'Pick list' }}
    >
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-erp-border bg-erp-surface p-6 text-center">
          <p className="text-sm text-erp-muted">Item</p>
          <p className="text-2xl font-semibold">{current.itemId.slice(0, 8)}</p>
          <p className="mt-2 text-sm">
            Reserved {current.reservedQuantity} · Picked {current.pickedQuantity} · Short{' '}
            {current.shortageQuantity}
          </p>
          <StatusBadge status={current.status} />
        </div>

        <label className="block">
          <span className="text-sm font-medium">Quantity</span>
          <input
            type="number"
            min={0}
            step="any"
            className="mt-2 w-full rounded-lg border border-erp-border px-4 py-4 text-3xl text-center"
            value={pickQty}
            onChange={(e) => setPickQty(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="col-span-2 py-4 text-lg" disabled={busy} onClick={() => void confirmPick()}>
            Confirm Pick
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => void reportShortage()}>
            Report Shortage
          </Button>
          <Button size="lg" variant="secondary" disabled={busy || current.pickedQuantity <= 0} onClick={() => void unpick()}>
            Unpick
          </Button>
        </div>

        <div className="flex justify-between">
          <Button
            variant="secondary"
            disabled={lineIndex <= 0}
            onClick={() => setLineIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button
            variant="secondary"
            disabled={lineIndex >= lines.length - 1}
            onClick={() => setLineIndex((i) => Math.min(lines.length - 1, i + 1))}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </OperationalPageShell>
  )
}
