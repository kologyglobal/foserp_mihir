/**
 * Phase 7C1 + 7C2 — Dispatch Workbench (API mode).
 * Demo mode keeps legacy DispatchWorkspace / plan pages.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, PackageCheck, RefreshCw, Truck } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import {
  createDraftDispatchFromRequirements,
  getDispatchWorkbenchSummary,
  listDispatchRequirements,
  listWorkbenchPacked,
  listWorkbenchPacking,
  listWorkbenchPackingShortages,
  listWorkbenchPickLists,
  listWorkbenchPicked,
  listWorkbenchPicking,
  listWorkbenchReadyToPack,
  listWorkbenchReservations,
  listWorkbenchShortages,
  listWorkbenchChallanDrafts,
  listWorkbenchChallanReview,
  listWorkbenchChallansIssued,
  listWorkbenchReadyForDispatch,
  createDeliveryChallan,
  synchroniseDispatchRequirements,
  type DeliveryChallanRow,
  type DispatchRequirementListItem,
  type DispatchWorkbenchSummary,
  type WorkbenchPackingSessionRow,
  type WorkbenchPickListRow,
  type WorkbenchReservationRow,
  type WorkbenchShortageRow,
} from '@/services/api/dispatchApi'

type RequirementTab =
  | 'ready'
  | 'waiting_production'
  | 'waiting_quality'
  | 'waiting_stock'
  | 'overdue'
  | 'blocked'
  | 'all'

type MainTab =
  | 'requirements'
  | 'draft_dispatches'
  | 'reservations'
  | 'pick_lists'
  | 'picking'
  | 'picked'
  | 'shortages'
  | 'ready_to_pack'
  | 'packing'
  | 'packed'
  | 'packing_shortages'
  | 'ready_for_challan'
  | 'challan_drafts'
  | 'challan_review'
  | 'challans_issued'
  | 'ready_for_dispatch'

const REQUIREMENT_TABS: Array<{ id: RequirementTab; label: string; kpi?: keyof DispatchWorkbenchSummary }> = [
  { id: 'ready', label: 'Ready', kpi: 'readyToDispatch' },
  { id: 'waiting_production', label: 'Waiting production', kpi: 'waitingForProduction' },
  { id: 'waiting_quality', label: 'Waiting quality', kpi: 'waitingForQuality' },
  { id: 'waiting_stock', label: 'Waiting stock', kpi: 'waitingForStock' },
  { id: 'overdue', label: 'Overdue', kpi: 'overdue' },
  { id: 'blocked', label: 'Blocked', kpi: 'blocked' },
  { id: 'all', label: 'All active', kpi: 'allActiveRequirements' },
]

const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'draft_dispatches', label: 'Draft Dispatches' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'pick_lists', label: 'Pick Lists' },
  { id: 'picking', label: 'Picking' },
  { id: 'picked', label: 'Picked' },
  { id: 'shortages', label: 'Pick Shortages' },
  { id: 'ready_to_pack', label: 'Ready to Pack' },
  { id: 'packing', label: 'Packing' },
  { id: 'packed', label: 'Packed' },
  { id: 'packing_shortages', label: 'Packing Shortages' },
  { id: 'ready_for_challan', label: 'Ready for Challan' },
  { id: 'challan_drafts', label: 'Challan Drafts' },
  { id: 'challan_review', label: 'Review' },
  { id: 'challans_issued', label: 'Issued' },
  { id: 'ready_for_dispatch', label: 'Ready for Dispatch' },
]

const EMPTY: DispatchWorkbenchSummary = {
  readyToDispatch: 0,
  waitingForProduction: 0,
  waitingForQuality: 0,
  waitingForStock: 0,
  overdue: 0,
  blocked: 0,
  draftDispatches: 0,
  allActiveRequirements: 0,
  activeReservations: 0,
  openPickLists: 0,
  inProgressPickLists: 0,
  openShortages: 0,
  readyToPack: 0,
  packingInProgress: 0,
  packedSessions: 0,
  packingShortages: 0,
  readyForChallan: 0,
  challanDrafts: 0,
  challanInReview: 0,
  challansIssued: 0,
  readyForDispatch: 0,
  challanBlocked: 0,
}

const KPI_CARDS: Array<{
  label: string
  key?: keyof DispatchWorkbenchSummary
  valueKey?: 'pickedKpi'
}> = [
  { label: 'Ready to Reserve', key: 'readyToDispatch' },
  { label: 'Partially Reserved', key: 'draftDispatches' },
  { label: 'Reserved', key: 'activeReservations' },
  { label: 'Picking', key: 'inProgressPickLists' },
  { label: 'Picked', valueKey: 'pickedKpi' },
  { label: 'Pick Shortages', key: 'openShortages' },
  { label: 'Ready to Pack', key: 'readyToPack' },
  { label: 'Packing', key: 'packingInProgress' },
  { label: 'Packed', key: 'packedSessions' },
  { label: 'Packing Shortages', key: 'packingShortages' },
  { label: 'Ready for Challan', key: 'readyForChallan' },
  { label: 'Challan Drafts', key: 'challanDrafts' },
  { label: 'In Review', key: 'challanInReview' },
  { label: 'Issued Challans', key: 'challansIssued' },
  { label: 'Ready for Dispatch', key: 'readyForDispatch' },
]

export function DispatchWorkbenchPage() {
  const navigate = useNavigate()
  const [mainTab, setMainTab] = useState<MainTab>('requirements')
  const [reqTab, setReqTab] = useState<RequirementTab>('ready')
  const [summary, setSummary] = useState<DispatchWorkbenchSummary>(EMPTY)
  const [reqRows, setReqRows] = useState<DispatchRequirementListItem[]>([])
  const [reservationRows, setReservationRows] = useState<WorkbenchReservationRow[]>([])
  const [pickListRows, setPickListRows] = useState<WorkbenchPickListRow[]>([])
  const [pickingRows, setPickingRows] = useState<WorkbenchPickListRow[]>([])
  const [pickedRows, setPickedRows] = useState<WorkbenchPickListRow[]>([])
  const [shortageRows, setShortageRows] = useState<WorkbenchShortageRow[]>([])
  const [readyToPackRows, setReadyToPackRows] = useState<WorkbenchPackingSessionRow[]>([])
  const [packingRows, setPackingRows] = useState<WorkbenchPackingSessionRow[]>([])
  const [packedRows, setPackedRows] = useState<WorkbenchPackingSessionRow[]>([])
  const [packingShortageRows, setPackingShortageRows] = useState<WorkbenchPackingSessionRow[]>([])
  const [challanRows, setChallanRows] = useState<DeliveryChallanRow[]>([])
  const [pickedKpi, setPickedKpi] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (activeMain: MainTab, activeReq: RequirementTab, refresh = false) => {
      if (!isApiMode()) {
        setSummary(EMPTY)
        setReqRows([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const sum = await getDispatchWorkbenchSummary(refresh)
        setSummary({ ...EMPTY, ...sum })
        setPickedKpi((await listWorkbenchPicked()).length)

        if (activeMain === 'requirements') {
          const list = await listDispatchRequirements({ tab: activeReq, limit: 100, refresh })
          setReqRows(list.items)
          setSelected(new Set())
        } else if (activeMain === 'reservations') {
          setReservationRows(await listWorkbenchReservations())
        } else if (activeMain === 'pick_lists') {
          setPickListRows(await listWorkbenchPickLists())
        } else if (activeMain === 'picking') {
          setPickingRows(await listWorkbenchPicking())
        } else if (activeMain === 'picked') {
          setPickedRows(await listWorkbenchPicked())
        } else if (activeMain === 'shortages') {
          setShortageRows(await listWorkbenchShortages())
        } else if (activeMain === 'ready_to_pack') {
          setReadyToPackRows(await listWorkbenchReadyToPack())
        } else if (activeMain === 'packing') {
          setPackingRows(await listWorkbenchPacking())
        } else if (activeMain === 'packed') {
          setPackedRows(await listWorkbenchPacked())
        } else if (activeMain === 'packing_shortages') {
          setPackingShortageRows(await listWorkbenchPackingShortages())
        } else if (activeMain === 'ready_for_challan') {
          setPackedRows(await listWorkbenchPacked())
        } else if (activeMain === 'challan_drafts') {
          setChallanRows(await listWorkbenchChallanDrafts())
        } else if (activeMain === 'challan_review') {
          setChallanRows(await listWorkbenchChallanReview())
        } else if (activeMain === 'challans_issued' || activeMain === 'ready_for_dispatch') {
          setChallanRows(
            activeMain === 'challans_issued'
              ? await listWorkbenchChallansIssued()
              : await listWorkbenchReadyForDispatch(),
          )
        }
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'Failed to load dispatch workbench')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void load(mainTab, reqTab)
  }, [mainTab, reqTab, load])

  const selectedRows = useMemo(() => reqRows.filter((r) => selected.has(r.id)), [reqRows, selected])

  async function handleSync() {
    setBusy(true)
    try {
      await synchroniseDispatchRequirements()
      notify.success('Requirements synchronised')
      await load(mainTab, reqTab, true)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Synchronise failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateDraft() {
    if (!selectedRows.length) {
      notify.error('Select one or more requirements')
      return
    }
    setBusy(true)
    try {
      const draft = await createDraftDispatchFromRequirements({
        requirementIds: selectedRows.map((r) => r.id),
        lines: selectedRows.map((r) => ({
          requirementId: r.id,
          quantity: r.readyQty > 0 ? r.readyQty : r.remainingQty,
        })),
        sourceFingerprintByRequirement: Object.fromEntries(
          selectedRows.map((r) => [r.id, r.sourceFingerprint]),
        ),
        idempotencyKey: `wb-draft-${[...selected].sort().join('-').slice(0, 120)}`,
      })
      notify.success(`Draft ${draft?.dispatchNo ?? 'dispatch'} created`)
      if (draft?.id) navigate(`/dispatch/${draft.id}`)
      else await load(mainTab, reqTab, true)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not create draft dispatch')
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!isApiMode()) {
    return (
      <OperationalPageShell
        title="Dispatch workbench"
        description="API mode required for Phase 7C1 requirement readiness."
      >
        <p className="text-sm text-erp-muted p-4">
          Set <code>VITE_USE_API=true</code> to use the live Dispatch Workbench. Demo mode continues to
          use the legacy Dispatch Plan store.
        </p>
        <Button size="sm" onClick={() => navigate('/dispatch/plan')}>
          Open demo Dispatch Plan
        </Button>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Dispatch & Delivery"
      description="Reserve FG and manage Store picking. Reserved/Picked ≠ Dispatched until confirm (7C0)."
      badge={`${summary.draftDispatches} drafts · ${summary.activeReservations ?? 0} reserved`}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => void load(mainTab, reqTab, true)}
              disabled={busy}
            />
            {mainTab === 'requirements' ? (
              <>
                <CommandBarButton
                  icon={PackageCheck}
                  label="Synchronise"
                  onClick={() => void handleSync()}
                  disabled={busy}
                />
                <CommandBarButton
                  icon={Truck}
                  label={`Create draft (${selected.size})`}
                  onClick={() => void handleCreateDraft()}
                  disabled={busy || selected.size === 0}
                  primary
                />
              </>
            ) : null}
            <CommandBarButton icon={ClipboardList} label="Outbound register" onClick={() => navigate('/dispatch/register')} />
            <CommandBarButton icon={PackageCheck} label="Pick lists" onClick={() => navigate('/dispatch/pick-lists')} />
            <CommandBarButton icon={PackageCheck} label="Packing sessions" onClick={() => navigate('/dispatch/packing-sessions')} />
          </CommandBarGroup>
        </CommandBar>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {KPI_CARDS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-md border border-erp-border bg-erp-surface px-3 py-2"
          >
            <p className="text-xs text-erp-muted">{kpi.label}</p>
            <p className="text-xl font-semibold tabular-nums">
              {kpi.valueKey === 'pickedKpi' ? pickedKpi : summary[kpi.key ?? 'readyToDispatch'] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-erp-border pb-3">
        {MAIN_TABS.map((t) => {
          const active = mainTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`rounded-md border px-3 py-1.5 text-sm ${
                active
                  ? 'border-erp-primary bg-erp-primary/10 text-erp-primary font-semibold'
                  : 'border-erp-border text-erp-muted hover:bg-erp-surface'
              }`}
              onClick={() => setMainTab(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {mainTab === 'requirements' ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {REQUIREMENT_TABS.map((t) => {
            const count = t.kpi ? summary[t.kpi] : undefined
            const active = reqTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  active
                    ? 'border-erp-primary bg-erp-primary/10 text-erp-primary font-semibold'
                    : 'border-erp-border text-erp-muted hover:bg-erp-surface'
                }`}
                onClick={() => setReqTab(t.id)}
              >
                {t.label}
                {count != null ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
      ) : null}

      {loading ? (
        <LoadingState variant="card" />
      ) : mainTab === 'requirements' ? (
        <DataGrid
          data={reqRows}
          compact
          emptyMessage="No dispatch requirements in this queue."
          columns={[
            {
              id: 'select',
              header: '',
              cell: ({ row }) => (
                <input
                  type="checkbox"
                  checked={selected.has(row.original.id)}
                  onChange={() => toggle(row.original.id)}
                  aria-label={`Select ${row.original.requirementNumber}`}
                />
              ),
            },
            {
              accessorKey: 'requirementNumber',
              header: 'Requirement',
              cell: ({ row }) => row.original.requirementNumber,
            },
            {
              accessorKey: 'salesOrderNo',
              header: 'Sales Order',
              cell: ({ row }) => (
                <TableLink to={`/crm/sales-orders/${row.original.salesOrderId}`}>
                  {row.original.salesOrderNo}
                </TableLink>
              ),
            },
            {
              accessorKey: 'customerName',
              header: 'Customer',
              cell: ({ row }) => row.original.customerName ?? '—',
            },
            { accessorKey: 'productOrItem', header: 'Item' },
            {
              accessorKey: 'remainingQty',
              header: 'Remaining',
              cell: ({ row }) => String(row.original.remainingQty),
            },
            {
              accessorKey: 'readyQty',
              header: 'Ready',
              cell: ({ row }) => String(row.original.readyQty),
            },
            {
              accessorKey: 'readinessStatus',
              header: 'Readiness',
              cell: ({ row }) => <StatusBadge status={row.original.readinessStatus} />,
            },
            {
              accessorKey: 'primaryBlockerCode',
              header: 'Blocker',
              cell: ({ row }) => row.original.primaryBlockerCode ?? '—',
            },
            {
              accessorKey: 'requestedDeliveryDate',
              header: 'Due',
              cell: ({ row }) => row.original.requestedDeliveryDate ?? '—',
            },
          ]}
        />
      ) : mainTab === 'draft_dispatches' ? (
        <div className="rounded-md border border-erp-border p-6 text-center space-y-3">
          <p className="text-sm text-erp-muted">
            {summary.draftDispatches} draft outbound dispatches awaiting reservation and picking.
          </p>
          <Button onClick={() => navigate('/dispatch/register')}>Open outbound register</Button>
        </div>
      ) : mainTab === 'reservations' ? (
        <DataGrid
          data={reservationRows}
          compact
          emptyMessage="No active dispatch reservations."
          columns={[
            { accessorKey: 'reservationNumber', header: 'Reservation' },
            {
              id: 'dispatch',
              header: 'Dispatch',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/${row.original.outboundDispatchId}`}>
                  {row.original.outboundDispatchId.slice(0, 8)}
                </TableLink>
              ),
            },
            { accessorKey: 'itemCode', header: 'Item' },
            { accessorKey: 'warehouseCode', header: 'WH' },
            {
              accessorKey: 'netReservedQty',
              header: 'Reserved',
              cell: ({ row }) => String(row.original.netReservedQty),
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      navigate(`/dispatch/${row.original.outboundDispatchId}?reserve=1`)
                    }
                  >
                    Reserve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/dispatch/${row.original.outboundDispatchId}`)}
                  >
                    Create Pick List
                  </Button>
                </div>
              ),
            },
          ]}
        />
      ) : mainTab === 'shortages' ? (
        <DataGrid
          data={shortageRows}
          compact
          emptyMessage="No pick shortages."
          columns={[
            { accessorKey: 'pickListNumber', header: 'Pick list' },
            {
              id: 'dispatch',
              header: 'Dispatch',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/${row.original.outboundDispatchId}`}>
                  {row.original.outboundDispatchId.slice(0, 8)}
                </TableLink>
              ),
            },
            { accessorKey: 'itemCode', header: 'Item' },
            {
              accessorKey: 'shortageQty',
              header: 'Shortage',
              cell: ({ row }) => String(row.original.shortageQty),
            },
            {
              accessorKey: 'reason',
              header: 'Reason',
              cell: ({ row }) => row.original.reason ?? '—',
            },
          ]}
        />
      ) : mainTab === 'ready_to_pack' ||
        mainTab === 'packing' ||
        mainTab === 'packed' ||
        mainTab === 'packing_shortages' ||
        mainTab === 'ready_for_challan' ? (
        <PackingSessionWorkbenchGrid
          rows={
            mainTab === 'ready_to_pack'
              ? readyToPackRows
              : mainTab === 'packing'
                ? packingRows
                : mainTab === 'packed' || mainTab === 'ready_for_challan'
                  ? packedRows
                  : packingShortageRows
          }
          emptyMessage={
            mainTab === 'ready_to_pack'
              ? 'Nothing ready to pack.'
              : mainTab === 'ready_for_challan'
                ? 'No packed sessions ready for challan.'
                : mainTab === 'packing'
                  ? 'Nothing in packing.'
                  : mainTab === 'packed'
                    ? 'No packed sessions.'
                    : 'No packing shortages.'
          }
          showStatus={mainTab !== 'ready_to_pack'}
          showPackedQty={mainTab === 'packing' || mainTab === 'ready_for_challan'}
          showShortageQty={mainTab === 'packing_shortages'}
          showCreateChallan={mainTab === 'ready_for_challan'}
          onCreateChallan={async (outboundDispatchId) => {
            try {
              setBusy(true)
              const created = await createDeliveryChallan(outboundDispatchId, {
                idempotencyKey: `wb-dc-${outboundDispatchId}`,
              })
              notify.success('Delivery challan draft created')
              navigate(`/dispatch/delivery-challans/${created.id}`)
            } catch (err) {
              notify.error(err instanceof Error ? err.message : 'Create challan failed')
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : mainTab === 'challan_drafts' ||
        mainTab === 'challan_review' ||
        mainTab === 'challans_issued' ||
        mainTab === 'ready_for_dispatch' ? (
        <DataGrid
          data={challanRows}
          compact
          emptyMessage="No delivery challans in this queue."
          columns={[
            {
              id: 'challan',
              header: 'Challan',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/delivery-challans/${row.original.id}`}>
                  {row.original.challanNumber ?? `Draft v${row.original.versionNumber}`}
                </TableLink>
              ),
            },
            {
              id: 'dispatch',
              header: 'Dispatch',
              cell: ({ row }) =>
                row.original.outboundDispatch?.dispatchNo ?? row.original.outboundDispatchId.slice(0, 8),
            },
            {
              accessorKey: 'totalQuantity',
              header: 'Qty',
              cell: ({ row }) => String(row.original.totalQuantity),
            },
            { accessorKey: 'status', header: 'Status' },
            { accessorKey: 'documentDate', header: 'Date' },
          ]}
        />
      ) : (
        <PickListWorkbenchGrid
          rows={
            mainTab === 'pick_lists' ? pickListRows : mainTab === 'picking' ? pickingRows : pickedRows
          }
          emptyMessage={
            mainTab === 'pick_lists'
              ? 'No open pick lists.'
              : mainTab === 'picking'
                ? 'Nothing in picking.'
                : 'No completed pick lists.'
          }
        />
      )}
    </OperationalPageShell>
  )
}

function PackingSessionWorkbenchGrid({
  rows,
  emptyMessage,
  showStatus,
  showPackedQty,
  showShortageQty,
  showCreateChallan,
  onCreateChallan,
}: {
  rows: WorkbenchPackingSessionRow[]
  emptyMessage: string
  showStatus?: boolean
  showPackedQty?: boolean
  showShortageQty?: boolean
  showCreateChallan?: boolean
  onCreateChallan?: (outboundDispatchId: string) => void
}) {
  return (
    <DataGrid
      data={rows}
      compact
      emptyMessage={emptyMessage}
      columns={[
        {
          accessorKey: 'packingSessionNumber',
          header: 'Packing session',
          cell: ({ row }) => (
            <TableLink to={`/dispatch/packing-sessions/${row.original.id}`}>
              {row.original.packingSessionNumber}
            </TableLink>
          ),
        },
        ...(showStatus
          ? [
              {
                accessorKey: 'status' as const,
                header: 'Status',
                cell: ({ row }: { row: { original: WorkbenchPackingSessionRow } }) => (
                  <StatusBadge status={row.original.status ?? 'READY'} />
                ),
              },
            ]
          : []),
        {
          id: 'dispatch',
          header: 'Dispatch',
          cell: ({ row }) => (
            <TableLink to={`/dispatch/${row.original.outboundDispatchId}`}>
              {row.original.outboundDispatchId.slice(0, 8)}
            </TableLink>
          ),
        },
        ...(showPackedQty
          ? [
              {
                accessorKey: 'totalPackedQuantity' as const,
                header: 'Packed',
                cell: ({ row }: { row: { original: WorkbenchPackingSessionRow } }) =>
                  String(row.original.totalPackedQuantity ?? 0),
              },
            ]
          : []),
        ...(showShortageQty
          ? [
              {
                accessorKey: 'totalShortageQuantity' as const,
                header: 'Shortage',
                cell: ({ row }: { row: { original: WorkbenchPackingSessionRow } }) =>
                  String(row.original.totalShortageQuantity ?? 0),
              },
            ]
          : []),
        {
          id: 'picked',
          header: 'Picked',
          cell: ({ row }) => String(row.original.totalPickedQuantity ?? '—'),
        },
        ...(showCreateChallan
          ? [
              {
                id: 'actions',
                header: 'Action',
                cell: ({ row }: { row: { original: WorkbenchPackingSessionRow } }) => (
                  <Button
                    size="sm"
                    onClick={() => onCreateChallan?.(row.original.outboundDispatchId)}
                  >
                    Create Delivery Challan
                  </Button>
                ),
              },
            ]
          : []),
      ]}
    />
  )
}

function PickListWorkbenchGrid({
  rows,
  emptyMessage,
}: {
  rows: WorkbenchPickListRow[]
  emptyMessage: string
}) {
  return (
    <DataGrid
      data={rows}
      compact
      emptyMessage={emptyMessage}
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
          accessorKey: 'lineCount',
          header: 'Lines',
          cell: ({ row }) => String(row.original.lineCount),
        },
      ]}
    />
  )
}
