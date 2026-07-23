/**
 * Phase 7C3 — Packing session register, detail, and tablet pack mode.
 * Operational allocation only — packed ≠ dispatched until Basic Confirm (7C0).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
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
import {
  completeDispatchPackingSession,
  createDispatchPackage,
  getDispatchPackage,
  getDispatchPackingSession,
  getDispatchPickingPosition,
  getDispatchSessionReconciliation,
  listDispatchPackages,
  listDispatchPackingSessions,
  packIntoDispatchPackage,
  reportDispatchPackingShortage,
  startDispatchPackingSession,
  unpackFromDispatchPackage,
  verifyDispatchPackingSession,
  type DispatchPackage,
  type DispatchPickLine,
  type DispatchPackingSession,
  type DispatchSessionReconciliation,
} from '@/services/api/dispatchApi'

function ApiRequiredShell({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate()
  return (
    <OperationalPageShell title={title} description={description}>
      <p className="text-sm text-erp-muted p-4">
        Set <code>VITE_USE_API=true</code> for Phase 7C3 packing sessions. Demo mode uses the legacy
        dispatch plan workspace.
      </p>
      <Button size="sm" onClick={() => navigate('/dispatch/plan')}>
        Open demo Dispatch Plan
      </Button>
    </OperationalPageShell>
  )
}

export function DispatchPackingRegisterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DispatchPackingSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { items } = await listDispatchPackingSessions({ limit: 100 })
      setRows(items)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load packing sessions')
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
      <ApiRequiredShell title="Packing sessions" description="Operational packing register (Phase 7C3)." />
    )
  }

  return (
    <OperationalPageShell
      title="Packing sessions"
      description="Phase 7C3 — pack picked FG into packages. Packed ≠ Dispatched until confirm."
      badge={`${rows.length} sessions`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void load()} />
            <CommandBarButton
              icon={ClipboardList}
              label="Workbench"
              onClick={() => navigate('/dispatch/workbench')}
            />
            <CommandBarButton icon={Truck} label="Outbound register" onClick={() => navigate('/dispatch/register')} />
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
          emptyMessage="No packing sessions yet — pick stock on a dispatch, then start packing from the dispatch detail."
          columns={[
            {
              accessorKey: 'packingSessionNumber',
              header: 'Session',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/packing-sessions/${row.original.id}`}>
                  {row.original.packingSessionNumber}
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
              accessorKey: 'totalPickedQuantity',
              header: 'Picked',
              cell: ({ row }) => String(row.original.totalPickedQuantity),
            },
            {
              accessorKey: 'totalPackedQuantity',
              header: 'Packed',
              cell: ({ row }) => String(row.original.totalPackedQuantity),
            },
            {
              accessorKey: 'totalPackages',
              header: 'Packages',
              cell: ({ row }) => String(row.original.totalPackages),
            },
          ]}
        />
      )}
    </OperationalPageShell>
  )
}

function usePackingSession(id: string | undefined) {
  const [row, setRow] = useState<DispatchPackingSession | null>(null)
  const [packages, setPackages] = useState<DispatchPackage[]>([])
  const [recon, setRecon] = useState<DispatchSessionReconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id || !isApiMode()) {
      setRow(null)
      setPackages([])
      setRecon(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [session, pkgList, reconciliation] = await Promise.all([
        getDispatchPackingSession(id),
        listDispatchPackages(id),
        getDispatchSessionReconciliation(id).catch(() => null),
      ])
      setRow(session)
      setPackages(pkgList)
      setRecon(reconciliation)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load packing session')
      setRow(null)
      setPackages([])
      setRecon(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return { row, packages, recon, loading, busy, setBusy, reload: load }
}

export function DispatchPackingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { row, packages, recon, loading, busy, setBusy, reload } = usePackingSession(id)

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      notify.success(label)
      await reload()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isApiMode()) {
    return <ApiRequiredShell title="Packing session" description="Packing session detail (Phase 7C3)." />
  }

  if (loading) return <LoadingState variant="card" />
  if (!row || !id) {
    return (
      <OperationalPageShell title="Packing session" description="Not found">
        <Button variant="secondary" onClick={() => navigate('/dispatch/packing-sessions')}>
          Back to packing sessions
        </Button>
      </OperationalPageShell>
    )
  }

  const canStart = row.status === 'DRAFT' || row.status === 'READY'
  const canPack = !['CANCELLED', 'VERIFIED', 'PACKED'].includes(row.status)
  const canComplete = ['IN_PROGRESS', 'PARTIALLY_PACKED', 'PACKED'].includes(row.status) && row.status !== 'VERIFIED'
  const canVerify = row.status === 'PACKED'
  const readyForChallan = row.status === 'VERIFIED' || row.status === 'PACKED'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Dispatch"
      title={row.packingSessionNumber}
      description={`Packed ≠ Dispatched · ${row.status.replace(/_/g, ' ')}`}
      showDescription
      backLink={{ to: '/dispatch/packing-sessions', label: 'Packing sessions' }}
      actions={<StatusBadge status={row.status} />}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => void reload()} disabled={busy} />
            {canStart ? (
              <CommandBarButton
                icon={Play}
                label="Start"
                primary
                onClick={() => void act('Packing started', () => startDispatchPackingSession(id))}
                disabled={busy}
              />
            ) : null}
            {canPack ? (
              <CommandBarButton
                icon={Package}
                label="Continue Packing"
                primary={!canStart}
                onClick={() => navigate(`/dispatch/packing-sessions/${id}/pack`)}
                disabled={busy}
              />
            ) : null}
            {canComplete ? (
              <CommandBarButton
                icon={CheckCircle2}
                label="Complete"
                onClick={() => void act('Session completed', () => completeDispatchPackingSession(id))}
                disabled={busy}
              />
            ) : null}
            {canVerify ? (
              <CommandBarButton
                icon={CheckCircle2}
                label="Verify"
                primary
                onClick={() => void act('Session verified', () => verifyDispatchPackingSession(id))}
                disabled={busy}
              />
            ) : null}
          </CommandBarGroup>
        </CommandBar>
      }
    >
      {readyForChallan ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Ready for Delivery Challan — informational only; no challan document is created from this screen.
        </p>
      ) : null}

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
          <div>
            <dt className="text-muted-foreground">Picked</dt>
            <dd>{row.totalPickedQuantity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Packed</dt>
            <dd>{row.totalPackedQuantity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shortage</dt>
            <dd>{row.totalShortageQuantity}</dd>
          </div>
        </dl>
      </DetailSection>

      {recon ? (
        <DetailSection title="Reconciliation">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Events</dt>
              <dd>{recon.eventCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Packages</dt>
              <dd>{recon.packages.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unpacked</dt>
              <dd>{recon.totalUnpackedQuantity}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Note</dt>
              <dd className="text-xs text-muted-foreground">No stock movement until confirm</dd>
            </div>
          </dl>
        </DetailSection>
      ) : null}

      <DetailSection title="Packages">
        <DataGrid
          data={packages}
          compact
          emptyMessage="No packages yet — open pack mode to create packages."
          columns={[
            { accessorKey: 'packageNumber', header: 'Package' },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row: r }) => <StatusBadge status={r.original.status} />,
            },
            {
              accessorKey: 'packageSequence',
              header: 'Seq',
              cell: ({ row: r }) => String(r.original.packageSequence),
            },
            {
              id: 'lines',
              header: 'Lines',
              cell: ({ row: r }) => String(r.original.lines?.length ?? 0),
            },
            {
              accessorKey: 'packageReference',
              header: 'Reference',
              cell: ({ row: r }) => r.original.packageReference ?? '—',
            },
          ]}
        />
      </DetailSection>
    </OperationalPageShell>
  )
}

function flattenPickLines(
  pickLists: Awaited<ReturnType<typeof getDispatchPickingPosition>>['pickLists'],
): DispatchPickLine[] {
  return pickLists.flatMap((pl) => pl.lines ?? [])
}

export function DispatchPackingPackModePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { row, loading, busy, setBusy, reload } = usePackingSession(id)
  const [pickLines, setPickLines] = useState<DispatchPickLine[]>([])
  const [activePackage, setActivePackage] = useState<DispatchPackage | null>(null)
  const [lineIndex, setLineIndex] = useState(0)
  const [packQty, setPackQty] = useState('')
  const [lotRef, setLotRef] = useState('')
  const [serialRef, setSerialRef] = useState('')

  const loadPickLines = useCallback(async (dispatchId: string) => {
    try {
      const picking = await getDispatchPickingPosition(dispatchId)
      setPickLines(flattenPickLines(picking?.pickLists ?? []))
    } catch {
      setPickLines([])
    }
  }, [])

  useEffect(() => {
    if (row?.outboundDispatchId) void loadPickLines(row.outboundDispatchId)
  }, [row?.outboundDispatchId, loadPickLines])

  const lines = pickLines.filter((l) => l.pickedQuantity > 0)
  const current = lines[lineIndex]

  const packedOnActive = useMemo(() => {
    if (!current || !activePackage?.lines) return 0
    return activePackage.lines
      .filter((l) => l.pickLineId === current.id && (l.status === 'PACKED' || l.status === 'MOVED'))
      .reduce((s, l) => s + l.packedQuantity, 0)
  }, [current, activePackage])

  const remaining = useMemo(() => {
    if (!current) return 0
    return Math.max(0, current.pickedQuantity - packedOnActive)
  }, [current, packedOnActive])

  useEffect(() => {
    if (current) setPackQty(String(remaining))
  }, [current?.id, remaining])

  async function ensurePackage() {
    if (!id) return null
    if (activePackage) return activePackage
    setBusy(true)
    try {
      const created = await createDispatchPackage(id, {
        idempotencyKey: `pkg-${id}-${Date.now()}`,
      })
      const full = await getDispatchPackage(created!.id)
      setActivePackage(full ?? created)
      notify.success(`Package ${created?.packageNumber ?? ''} created`)
      return full ?? created
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create package failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function confirmPack() {
    if (!current || !id || busy) return
    const qty = Number(packQty)
    if (!qty || qty <= 0) {
      notify.error('Enter pack quantity')
      return
    }
    const pkg = await ensurePackage()
    if (!pkg) return
    setBusy(true)
    try {
      const updated = await packIntoDispatchPackage(pkg.id, {
        pickLineId: current.id,
        quantity: qty,
        lotRef: lotRef.trim() || undefined,
        serialRef: serialRef.trim() || undefined,
        idempotencyKey: `pack-${current.id}-${Date.now()}`,
      })
      setActivePackage(updated ?? pkg)
      notify.success('Pack recorded')
      await reload()
      if (row?.outboundDispatchId) await loadPickLines(row.outboundDispatchId)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Pack failed')
    } finally {
      setBusy(false)
    }
  }

  async function doUnpack() {
    if (!activePackage || !current || busy) return
    const line = activePackage.lines?.find((l) => l.pickLineId === current.id)
    if (!line) {
      notify.error('Nothing packed for this line in the active package')
      return
    }
    const qty = Number(packQty) || line.packedQuantity
    setBusy(true)
    try {
      const updated = await unpackFromDispatchPackage(activePackage.id, {
        packageLineId: line.id,
        quantity: qty,
        idempotencyKey: `unpack-${line.id}-${Date.now()}`,
      })
      setActivePackage(updated ?? activePackage)
      notify.success('Unpack recorded')
      await reload()
      if (row?.outboundDispatchId) await loadPickLines(row.outboundDispatchId)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Unpack failed')
    } finally {
      setBusy(false)
    }
  }

  async function reportShortage() {
    if (!current || !id || busy) return
    const qty = Number(packQty) || remaining
    setBusy(true)
    try {
      await reportDispatchPackingShortage(id, {
        pickLineId: current.id,
        quantity: qty,
        idempotencyKey: `pack-short-${current.id}-${Date.now()}`,
      })
      notify.success('Packing shortage recorded')
      await reload()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Shortage failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isApiMode()) {
    return <ApiRequiredShell title="Pack mode" description="Tablet pack mode (Phase 7C3)." />
  }

  if (loading) return <LoadingState variant="card" />
  if (!row || !id) {
    return (
      <OperationalPageShell title="Pack mode" description="Not found">
        <Button onClick={() => navigate('/dispatch/packing-sessions')}>Back</Button>
      </OperationalPageShell>
    )
  }

  if (!lines.length) {
    return (
      <OperationalPageShell title="Pack mode" description="No picked lines">
        <p className="text-sm text-erp-muted mb-4">Complete picking before packing.</p>
        <Button onClick={() => navigate(`/dispatch/packing-sessions/${id}`)}>Back to session</Button>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={`Pack · ${row.packingSessionNumber}`}
      description={`Line ${lineIndex + 1} of ${lines.length} · Packed ≠ Dispatched`}
      backLink={{ to: `/dispatch/packing-sessions/${id}`, label: 'Packing session' }}
    >
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-erp-border bg-erp-surface p-4 text-center">
          <p className="text-xs text-erp-muted">Active package</p>
          <p className="text-lg font-semibold">{activePackage?.packageNumber ?? 'None — tap Create Package'}</p>
          <Button size="sm" className="mt-2" disabled={busy} onClick={() => void ensurePackage()}>
            Create Package
          </Button>
        </div>

        <div className="rounded-lg border border-erp-border bg-erp-surface p-6 text-center">
          <p className="text-sm text-erp-muted">Item</p>
          <p className="text-2xl font-semibold">{current.itemId.slice(0, 8)}</p>
          <p className="mt-2 text-sm">
            Picked {current.pickedQuantity} · Packed (pkg) {packedOnActive} · Remaining {remaining}
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
            value={packQty}
            onChange={(e) => setPackQty(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-1">
            <span className="text-xs font-medium text-erp-muted">Lot ref (optional)</span>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-sm"
              value={lotRef}
              onChange={(e) => setLotRef(e.target.value)}
            />
          </label>
          <label className="block col-span-1">
            <span className="text-xs font-medium text-erp-muted">Serial ref (optional)</span>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-sm"
              value={serialRef}
              onChange={(e) => setSerialRef(e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="col-span-2 py-4 text-lg" disabled={busy} onClick={() => void confirmPack()}>
            Pack
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => void doUnpack()}>
            Unpack
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => void reportShortage()}>
            Report Shortage
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
