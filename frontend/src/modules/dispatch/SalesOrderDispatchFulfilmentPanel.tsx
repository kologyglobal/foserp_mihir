/**
 * Phase 7C1/7C4 — Sales Order 360 dispatch/fulfilment panel (API mode).
 * Challan qty is document-only and must not be shown as dispatched/fulfilled.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Truck } from 'lucide-react'
import { DataGrid } from '@/components/design-system/DataGrid'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import {
  getSalesOrderDispatchHistory,
  getSalesOrderDispatchRequirements,
  getSalesOrderFulfilmentSummary,
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
      setRequirements(reqs)
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

  if (loading) return <LoadingState variant="card" />

  return (
    <div className="space-y-4 p-4">
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
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => navigate('/dispatch/workbench')}>
            <Truck className="h-3.5 w-3.5 mr-1" /> Open workbench
          </Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Dispatch requirements</h4>
        <DataGrid
          data={requirements}
          compact
          emptyMessage="No dispatch requirements yet — confirm the sales order and synchronise from the workbench."
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
