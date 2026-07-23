/**
 * Phase 7C1/7C4 — Sales Order 360 dispatch/fulfilment panel (API mode).
 * Guided Fulfilment strip + coach CTAs. Challan qty is document-only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackageCheck, RefreshCw, Truck } from 'lucide-react'
import { DataGrid } from '@/components/design-system/DataGrid'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import {
  FulfilmentJourneyStrip,
  deriveSoFulfilmentJourney,
  useFulfilmentJourneyStep,
} from '@/modules/manufacturing/ui'
import {
  createDraftDispatchFromRequirements,
  getSalesOrderDispatchHistory,
  getSalesOrderDispatchRequirements,
  getSalesOrderFulfilmentSummary,
  synchroniseDispatchRequirements,
  type DispatchRequirementListItem,
  type SalesOrderDispatchHistoryItem,
} from '@/services/api/dispatchApi'

interface Props {
  salesOrderId: string
}

type ChallanLink = {
  id: string
  challanNumber: string | null
  status: string
  versionNumber: number
  totalQuantity: number
  documentDate: string
}

export function SalesOrderDispatchFulfilmentPanel({ salesOrderId }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [requirements, setRequirements] = useState<DispatchRequirementListItem[]>([])
  const [history, setHistory] = useState<SalesOrderDispatchHistoryItem[]>([])
  const [totals, setTotals] = useState<Record<string, number> | null>(null)
  const [challans, setChallans] = useState<ChallanLink[]>([])
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqs, hist, summary] = await Promise.all([
        getSalesOrderDispatchRequirements(salesOrderId),
        getSalesOrderDispatchHistory(salesOrderId),
        getSalesOrderFulfilmentSummary(salesOrderId),
      ])
      setRequirements(Array.isArray(reqs) ? reqs : [])
      setHistory(hist?.items ?? [])
      setTotals(summary?.totals ?? null)
      setChallans((summary as { deliveryChallans?: ChallanLink[] })?.deliveryChallans ?? [])
      setNote(
        (summary as { notes?: { challanVsDispatch?: string } })?.notes?.challanVsDispatch ?? null,
      )
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load fulfilment')
      setRequirements([])
      setHistory([])
      setTotals(null)
      setChallans([])
      setNote(null)
    } finally {
      setLoading(false)
    }
  }, [salesOrderId])

  useEffect(() => {
    void load()
  }, [load])

  const journey = useMemo(() => {
    const t = totals ?? {}
    return deriveSoFulfilmentJourney({
      remainingQty: Number(t.remainingQty ?? 0),
      reservedQty: Number(t.reservedQty ?? 0),
      pickedQty: Number(t.pickedQty ?? 0),
      packedQty: Number(t.packedQty ?? 0),
      challanQty: Number(t.challanQty ?? 0),
      dispatchedQty: Number(t.netDispatchedQty ?? t.dispatchedQty ?? 0),
      waitingProduction: requirements.some((r) => r.readinessStatus === 'WAITING_FOR_PRODUCTION'),
      waitingQuality: requirements.some((r) => r.readinessStatus === 'WAITING_FOR_QUALITY'),
      waitingStock: requirements.some((r) => r.readinessStatus === 'WAITING_FOR_STOCK'),
      readyQty: requirements.reduce((sum, r) => sum + Number(r.readyQty ?? 0), 0),
    })
  }, [totals, requirements])

  const { step: journeyStep, urlStep: journeyUrlStep, setStep: setJourneyStep } =
    useFulfilmentJourneyStep(journey.activeStep)

  useEffect(() => {
    if (journeyUrlStep || totals == null) return
    setJourneyStep(journey.activeStep, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesOrderId, totals == null])

  const readyRequirementIds = useMemo(
    () =>
      requirements
        .filter(
          (r) =>
            r.readinessStatus === 'READY_TO_DISPATCH' ||
            r.readinessStatus === 'PARTIALLY_READY' ||
            Number(r.readyQty) > 0,
        )
        .map((r) => r.id),
    [requirements],
  )

  const syncRequirements = async () => {
    setBusy(true)
    try {
      const result = await synchroniseDispatchRequirements({
        salesOrderId,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success(`Synchronised ${result.synchronised ?? 0} requirement(s)`)
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  const createDraft = async () => {
    if (readyRequirementIds.length === 0) {
      notify.warning('No ready requirements — sync and wait for FG stock first')
      return
    }
    setBusy(true)
    try {
      const draft = await createDraftDispatchFromRequirements({
        requirementIds: readyRequirementIds,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success(`Draft dispatch ${draft.dispatchNo ?? draft.id} created`)
      navigate(`/dispatch/${draft.id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not create draft dispatch')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState variant="card" />

  const nextCoach =
    journeyStep === 'produce'
      ? 'Finish linked work orders, then sync requirements.'
      : journeyStep === 'quality'
        ? 'Clear quality holds on FG / stages, then refresh.'
        : journeyStep === 'stock'
          ? 'Receive FG on the work order, then Sync requirements.'
          : readyRequirementIds.length > 0
            ? 'Create a draft outbound, then reserve → pick → pack → challan on the workbench.'
            : 'Open the workbench to reserve, pick, pack, and issue the delivery challan.'

  return (
    <div className="space-y-4 p-4">
      <FulfilmentJourneyStrip
        activeStep={journeyStep}
        steps={journey.steps.map((step) => ({
          ...step,
          onSelect: () => {
            setJourneyStep(step.id)
            if (step.id === 'dispatch') {
              navigate(`/dispatch/workbench?salesOrderId=${encodeURIComponent(salesOrderId)}`)
            }
          },
        }))}
        compactTip={`${nextCoach} Progress resumes via ?step= in the URL.`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-erp-muted space-y-1">
          {totals ? (
            <>
              <div>
                Ordered {totals.orderedQty ?? 0} · Reserved {totals.reservedQty ?? 0} · Picked{' '}
                {totals.pickedQty ?? 0} · Packed {totals.packedQty ?? 0} · Challan{' '}
                {totals.challanQty ?? 0} · Dispatched {totals.netDispatchedQty ?? 0} · Remaining{' '}
                {totals.remainingQty ?? 0}
              </div>
              {note ? <div className="text-xs">{note}</div> : null}
            </>
          ) : (
            <span>Fulfilment position from server (not demo store).</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void syncRequirements()}>
            Sync requirements
          </Button>
          <Button size="sm" variant="secondary" disabled={busy || readyRequirementIds.length === 0} onClick={() => void createDraft()}>
            <PackageCheck className="h-3.5 w-3.5 mr-1" /> Create draft outbound
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => navigate(`/dispatch/workbench?salesOrderId=${encodeURIComponent(salesOrderId)}`)}
          >
            <Truck className="h-3.5 w-3.5 mr-1" /> Open workbench
          </Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Dispatch requirements</h4>
        <DataGrid
          data={requirements}
          compact
          emptyMessage="No dispatch requirements yet — confirm the sales order and synchronise from here or the workbench."
          columns={[
            { accessorKey: 'requirementNumber', header: 'Requirement' },
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
          ]}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Delivery Challans</h4>
        <DataGrid
          data={challans}
          compact
          emptyMessage="No Delivery Challans for this sales order."
          columns={[
            {
              accessorKey: 'challanNumber',
              header: 'Challan',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/delivery-challans/${row.original.id}`}>
                  {row.original.challanNumber ?? `Draft v${row.original.versionNumber}`}
                </TableLink>
              ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => <StatusBadge status={row.original.status} />,
            },
            {
              accessorKey: 'totalQuantity',
              header: 'Challan qty',
              cell: ({ row }) => String(row.original.totalQuantity),
            },
            {
              accessorKey: 'documentDate',
              header: 'Date',
              cell: ({ row }) => row.original.documentDate,
            },
          ]}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Dispatch history</h4>
        <DataGrid
          data={history}
          compact
          emptyMessage="No outbound dispatches for this sales order."
          columns={[
            {
              accessorKey: 'dispatchNo',
              header: 'Dispatch',
              cell: ({ row }) => (
                <TableLink to={`/dispatch/${row.original.id}`}>{row.original.dispatchNo}</TableLink>
              ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => <StatusBadge status={row.original.status} />,
            },
            {
              accessorKey: 'planningSource',
              header: 'Source',
              cell: ({ row }) => row.original.planningSource ?? '—',
            },
            {
              accessorKey: 'totalQty',
              header: 'Qty',
              cell: ({ row }) => String(row.original.totalQty),
            },
            {
              accessorKey: 'createdAt',
              header: 'Created',
              cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
            },
          ]}
        />
      </div>
    </div>
  )
}
