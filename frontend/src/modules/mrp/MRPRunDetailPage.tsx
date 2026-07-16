import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, Play, ShoppingCart, Wrench } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsCommandButton,
  DynamicsTabs,
} from '../../components/dynamics'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useMrpStore } from '../../store/mrpStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
type ResultTab = 'materials' | 'buy' | 'make'

export function MRPRunDetailPage() {
  const { id } = useParams()
  const run = useMrpStore((s) => (id ? s.getRun(id) : undefined))
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const prs = useMemo(() => requisitions.filter((p) => p.mrpRunId === id), [requisitions, id])
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const linkedWos = useMemo(
    () => workOrders.filter((w) => run?.salesOrderIds.includes(w.salesOrderId)),
    [workOrders, run?.salesOrderIds],
  )
  const [tab, setTab] = useState<ResultTab>('materials')

  const shortageLines = useMemo(() => run?.materialLines.filter((m) => m.shortageQty > 0) ?? [], [run])
  const purchaseLines = useMemo(
    () => run?.materialLines.filter((m) => m.suggestedPoQty > 0 || m.suggestedPrQty > 0) ?? [],
    [run],
  )

  if (!run) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Planning run not found.</p>
        <Link to="/mrp" className="mt-2 text-sm text-erp-accent hover:underline">Back to Planning</Link>
      </div>
    )
  }

  const tabs = [
    { id: 'materials', label: `All Items (${run.materialLines.length})` },
    { id: 'buy', label: shortageLines.length > 0 ? `To Buy (${purchaseLines.length})` : 'To Buy' },
    { id: 'make', label: `To Make (${run.woRequirements.length})` },
  ]

  return (
    <DynamicsModuleDashboard
      title={`Planning Result ${run.runNo}`}
      subtitle={`${formatDate(run.runAt.slice(0, 10))} · ${run.salesOrderIds.length} order(s) · ${shortageLines.length} shortage(s)`}
      badge="Planning"
      favoritePath={`/mrp/runs/${run.id}`}
      heroMetrics={[
        { id: 'items', label: 'Materials', value: run.materialLines.length, helper: 'Total lines' },
        { id: 'short', label: 'Shortages', value: shortageLines.length, accent: shortageLines.length ? 'red' : 'green', helper: 'Need attention' },
        { id: 'make', label: 'To Make', value: run.woRequirements.length, helper: 'Work order items' },
      ]}
      quickActions={
        <>
          <Link to="/mrp">
            <DynamicsCommandButton icon={<ArrowLeft className="h-4 w-4" />}>Back to Planning</DynamicsCommandButton>
          </Link>
          <Link to={`/mrp/run?so=${run.salesOrderIds[0] ?? ''}`}>
            <DynamicsCommandButton icon={<Play className="h-4 w-4" />}>Run Again</DynamicsCommandButton>
          </Link>
        </>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/inventory/reservations">
            <Button size="sm" variant="secondary"><Bookmark className="h-4 w-4" /> Reservations</Button>
          </Link>
          {prs.length > 0 && (
            <Link to={`/purchase/requisitions/${prs[0].id}`}>
              <Button size="sm" variant="secondary"><ShoppingCart className="h-4 w-4" /> PR {prs[0].prNo}</Button>
            </Link>
          )}
          {linkedWos.length > 0 ? (
            <Link to={`/work-orders/${linkedWos[0].id}`}>
              <Button size="sm" variant="secondary"><Wrench className="h-4 w-4" /> WO {linkedWos[0].woNo}</Button>
            </Link>
          ) : run.salesOrderIds[0] ? (
            <Link to={`/work-orders/create-from-mrp?run=${run.id}`}>
              <Button size="sm" variant="primary"><Wrench className="h-4 w-4" /> Create Work Orders</Button>
            </Link>
          ) : null}
        </div>
      }
    >
      {run.exceptions.length > 0 && (
        <DynamicsDashboardPanel title="Issues found">
          <ul className="space-y-2">
            {run.exceptions.map((ex) => (
              <li key={ex.id} className="flex items-start gap-2 text-sm">
                <Badge color={ex.severity === 'error' ? 'red' : 'yellow'}>{ex.type.replace(/_/g, ' ')}</Badge>
                <span>{ex.message}</span>
              </li>
            ))}
          </ul>
        </DynamicsDashboardPanel>
      )}

      <DynamicsTabs
        items={tabs.map((t) => ({ label: t.label, path: t.id }))}
        activePath={tab}
        onChange={(id) => setTab(id as ResultTab)}
      />

      {tab === 'materials' && (
        <DynamicsDashboardPanel title="All materials" noPadding>
          <DataGrid
            data={run.materialLines}
            columns={[
              { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
              { accessorKey: 'itemName', header: 'Name' },
              { accessorKey: 'salesOrderNo', header: 'Order' },
              { accessorKey: 'requiredQty', header: 'Needed', cell: ({ row }) => formatNumber(row.original.requiredQty) },
              { accessorKey: 'freeStock', header: 'In stock', cell: ({ row }) => formatNumber(row.original.freeStock) },
              {
                accessorKey: 'shortageQty',
                header: 'Short',
                cell: ({ row }) => (
                  <span className={row.original.shortageQty > 0 ? 'font-semibold text-erp-danger' : 'text-erp-success'}>
                    {formatNumber(row.original.shortageQty)}
                  </span>
                ),
              },
              { accessorKey: 'requiredDate', header: 'Needed by', cell: ({ row }) => formatDate(row.original.requiredDate) },
            ]}
            compact
          />
        </DynamicsDashboardPanel>
      )}

      {tab === 'buy' && (
        <DynamicsDashboardPanel title="What to buy" noPadding>
          <DataGrid
            data={purchaseLines.length > 0 ? purchaseLines : shortageLines}
            columns={[
              { accessorKey: 'itemCode', header: 'Item' },
              { accessorKey: 'itemName', header: 'Name' },
              { accessorKey: 'salesOrderNo', header: 'Order' },
              { accessorKey: 'shortageQty', header: 'Shortage', cell: ({ row }) => formatNumber(row.original.shortageQty) },
              {
                accessorKey: 'suggestedPrQty',
                header: 'Buy qty',
                cell: ({ row }) => formatNumber(row.original.suggestedPrQty || row.original.suggestedPoQty),
              },
              { accessorKey: 'requiredDate', header: 'Needed by', cell: ({ row }) => formatDate(row.original.requiredDate) },
            ]}
            compact
            emptyMessage="Nothing to purchase."
          />
        </DynamicsDashboardPanel>
      )}

      {tab === 'make' && (
        <DynamicsDashboardPanel title="What to make in-house" noPadding>
          <DataGrid
            data={run.woRequirements}
            columns={[
              { accessorKey: 'salesOrderNo', header: 'Order' },
              { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
              { accessorKey: 'itemName', header: 'Name' },
              { accessorKey: 'requiredQty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.requiredQty) },
              { accessorKey: 'startByDate', header: 'Start by', cell: ({ row }) => formatDate(row.original.startByDate) },
              { accessorKey: 'requiredDate', header: 'Needed by', cell: ({ row }) => formatDate(row.original.requiredDate) },
            ]}
            compact
            emptyMessage="No in-house production required."
          />
        </DynamicsDashboardPanel>
      )}
    </DynamicsModuleDashboard>
  )
}
