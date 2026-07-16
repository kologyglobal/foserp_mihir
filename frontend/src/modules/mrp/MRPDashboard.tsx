import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileText, Play, ShoppingCart } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsCommandButton,
  DynamicsTabs,
} from '../../components/dynamics'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Toast } from '../../components/ui/Toast'
import { TableLink } from '../../components/ui/AppLink'
import { useMrpStore } from '../../store/mrpStore'
import { useMrpPlannerWorkbench } from '../../utils/controlTowerMetrics'
import { aggregateMaterialShortages, isProductionReady } from '../../utils/mrpEngine'
import { useMasterStore } from '../../store/masterStore'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
type PlanningTab = 'overview' | 'buy' | 'orders'

export function MRPDashboardPage() {
  const navigate = useNavigate()
  const data = useMrpPlannerWorkbench()
  const runs = useMrpStore((s) => s.runs)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const runMrpForOrder = useMrpStore((s) => s.runMrpForOrder)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getProduct = useMasterStore((s) => s.getProduct)
  const [tab, setTab] = useState<PlanningTab>('overview')
  const [toast, setToast] = useState<string | null>(null)

  const latestRun = runs[0]
  const readyCount = data.soReadiness.filter((s) => s.ready).length

  const summary = useMemo(() => {
    if (!latestRun) {
      return { shortages: 0, toBuy: 0, ready: 0 }
    }
    const shortages = aggregateMaterialShortages(latestRun.materialLines)
    const orderIds = [...new Set(latestRun.materialLines.map((m) => m.salesOrderId))]
    return {
      shortages: shortages.length,
      toBuy: latestRun.materialLines.filter((m) => m.suggestedPoQty > 0 || m.suggestedPrQty > 0).length,
      ready: orderIds.filter((oid) => isProductionReady(oid, latestRun.materialLines)).length,
    }
  }, [latestRun])

  const buyItems = useMemo(() => {
    if (data.purchaseRequired.length > 0) return data.purchaseRequired
    return latestRun?.materialLines.filter((m) => m.shortageQty > 0) ?? []
  }, [data.purchaseRequired, latestRun])

  function handleQuickRun(soId: string) {
    const r = runMrpForOrder(soId, undefined, { autoReserve: true })
    if (r.ok && r.runId) navigate(`/mrp/runs/${r.runId}`)
    else setToast(r.error ?? 'Planning run failed')
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'buy', label: summary.toBuy > 0 ? `What to Buy (${summary.toBuy})` : 'What to Buy' },
    { id: 'orders', label: `Orders (${salesOrders.length})` },
  ]

  return (
    <>
      <Toast message={toast} variant="error" />

      <DynamicsModuleDashboard
        title="Planning"
        subtitle="Check material needs for sales orders, then run planning to see what to buy or make."
        badge="Planning"
        favoritePath="/mrp"
        healthScore={summary.shortages > 3 ? 65 : summary.shortages > 0 ? 78 : 92}
        heroMetrics={[
          { id: 'short', label: 'Shortages', value: summary.shortages, icon: AlertTriangle, accent: summary.shortages ? 'red' : 'green', helper: 'Items not in stock' },
          { id: 'buy', label: 'To Buy', value: summary.toBuy, icon: ShoppingCart, accent: 'blue', helper: 'Purchase suggestions' },
          { id: 'ready', label: 'Ready to Make', value: readyCount || summary.ready, icon: CheckCircle2, accent: 'green', helper: 'Orders fully covered' },
        ]}
        quickActions={
          <>
            <DynamicsCommandButton primary icon={<Play className="h-4 w-4" />} onClick={() => navigate('/mrp/run')}>
              Run Planning
            </DynamicsCommandButton>
            {latestRun && (
              <DynamicsCommandButton icon={<FileText className="h-4 w-4" />} onClick={() => navigate(`/mrp/runs/${latestRun.id}`)}>
                Latest Result
              </DynamicsCommandButton>
            )}
          </>
        }
        kpiStrip={[
          { label: 'Open Orders', value: salesOrders.length, tone: 'primary', href: '/mrp' },
          { label: 'Planning Runs', value: runs.length, tone: 'neutral' },
          { label: 'Shortages', value: summary.shortages, tone: summary.shortages ? 'critical' : 'success' },
        ]}
      >
        <DynamicsTabs
          items={tabs.map((t) => ({ label: t.label, path: t.id }))}
          activePath={tab}
          onChange={(id) => setTab(id as PlanningTab)}
        />

        {tab === 'overview' && (
          !latestRun ? (
            <DynamicsDashboardPanel title="Get started">
              <p className="dyn-empty-hint">No planning run yet. Pick a sales order and run planning to see material needs.</p>
              <div className="mt-4">
                <DynamicsCommandButton primary icon={<Play className="h-4 w-4" />} onClick={() => navigate('/mrp/run')}>
                  Run Planning
                </DynamicsCommandButton>
              </div>
            </DynamicsDashboardPanel>
          ) : (
            <>
              <DynamicsDashboardPanel
                title={`Latest run · ${latestRun.runNo}`}
                actions={<span className="dyn-entity-list-meta">{formatDate(latestRun.runAt.slice(0, 10))}</span>}
              >
                <p className="mb-3 text-[13px] text-erp-muted">
                  {summary.shortages === 0
                    ? 'All materials are available — you can create work orders.'
                    : `${summary.shortages} item(s) need attention. Review the What to Buy tab.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/mrp/runs/${latestRun.id}`)}>
                    View full results
                  </Button>
                  {summary.toBuy > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => setTab('buy')}>
                      See what to buy
                    </Button>
                  )}
                  <Link to="/purchase/requisitions">
                    <Button size="sm" variant="secondary">Purchase requisitions</Button>
                  </Link>
                </div>
              </DynamicsDashboardPanel>

              {data.shortages.length > 0 && (
                <DynamicsDashboardPanel title="Top shortages" noPadding>
                  <DataGrid
                    data={data.shortages.slice(0, 8)}
                    columns={[
                      { accessorKey: 'itemCode', header: 'Item' },
                      { accessorKey: 'salesOrderNo', header: 'Order' },
                      {
                        accessorKey: 'shortageQty',
                        header: 'Short',
                        cell: ({ row }) => <span className="font-semibold text-erp-danger">{formatNumber(row.original.shortageQty)}</span>,
                      },
                      { accessorKey: 'requiredDate', header: 'Needed by', cell: ({ row }) => formatDate(row.original.requiredDate) },
                    ]}
                    compact
                    emptyMessage="No shortages."
                  />
                </DynamicsDashboardPanel>
              )}

              {runs.length > 1 && (
                <DynamicsDashboardPanel title="Recent runs" noPadding>
                  <DataGrid
                    data={runs.slice(0, 5)}
                    columns={[
                      {
                        accessorKey: 'runNo',
                        header: 'Run',
                        cell: ({ row }) => <TableLink to={`/mrp/runs/${row.original.id}`}>{row.original.runNo}</TableLink>,
                      },
                      { accessorKey: 'runAt', header: 'Date', cell: ({ row }) => formatDate(row.original.runAt.slice(0, 10)) },
                      {
                        id: 'shortages',
                        header: 'Shortages',
                        cell: ({ row }) => row.original.materialLines.filter((m) => m.shortageQty > 0).length,
                      },
                      { id: 'orders', header: 'Orders', cell: ({ row }) => row.original.salesOrderIds.length },
                    ]}
                    compact
                  />
                </DynamicsDashboardPanel>
              )}
            </>
          )
        )}

        {tab === 'buy' && (
          <DynamicsDashboardPanel title="What to buy" noPadding>
            {!latestRun ? (
              <p className="dyn-empty-hint p-4">Run planning first to see purchase suggestions.</p>
            ) : (
              <DataGrid
                data={buyItems}
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
                emptyMessage="Nothing to purchase — stock covers all demand."
              />
            )}
          </DynamicsDashboardPanel>
        )}

        {tab === 'orders' && (
          <DynamicsDashboardPanel title="Sales orders" actions={<span className="dyn-entity-list-meta">Run planning per order</span>} noPadding>
            <DataGrid
              data={salesOrders}
              columns={[
                {
                  accessorKey: 'salesOrderNo',
                  header: 'Order',
                  cell: ({ row }) => <span className="font-mono font-semibold text-erp-primary">{row.original.salesOrderNo}</span>,
                },
                { accessorKey: 'customerId', header: 'Customer', cell: ({ row }) => getCustomer(row.original.customerId)?.customerName ?? '—' },
                { accessorKey: 'productId', header: 'Product', cell: ({ row }) => getProduct(row.original.productId)?.productName ?? '—' },
                { accessorKey: 'qty', header: 'Qty' },
                { accessorKey: 'requiredDate', header: 'Due', cell: ({ row }) => formatDate(row.original.requiredDate) },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge color="blue">{row.original.status.replace('_', ' ')}</Badge> },
                {
                  id: 'action',
                  header: '',
                  cell: ({ row }) => (
                    <Button size="sm" variant="secondary" onClick={() => handleQuickRun(row.original.id)}>
                      <Play className="h-3.5 w-3.5" /> Run
                    </Button>
                  ),
                },
              ]}
              compact
            />
          </DynamicsDashboardPanel>
        )}
      </DynamicsModuleDashboard>
    </>
  )
}
