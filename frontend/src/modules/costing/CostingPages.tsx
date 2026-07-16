import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  BarChart3,
  Calculator,
  IndianRupee,
  Layers,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsTabs,
} from '../../components/dynamics'
import { DataTable } from '../../components/tables/DataTable'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/forms/Inputs'
import { useCostingStore } from '../../store/costingStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import type { CostSheet, CostVarianceRow, ProductCostSummary, TrailerProfitabilityRow } from '../../types/costing'
import { costSheetTotals } from '../../types/costing'
import { cn } from '../../utils/cn'

type CostReportTab = 'dashboard' | 'wo-sheets' | 'product' | 'variance' | 'profitability'

const tabs: { id: CostReportTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'wo-sheets', label: 'WO Cost Sheets' },
  { id: 'product', label: 'Product Summary' },
  { id: 'variance', label: 'Cost Variance' },
  { id: 'profitability', label: 'Trailer Profitability' },
]

function OverheadConfig() {
  const overheadPct = useCostingStore((s) => s.overheadPct)
  const setOverheadPct = useCostingStore((s) => s.setOverheadPct)
  const [draft, setDraft] = useState(String(overheadPct))

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Overhead %</label>
        <Input
          type="number"
          min={0}
          max={100}
          step={0.5}
          className="w-24"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOverheadPct(parseFloat(draft) || 0)}
      >
        Apply
      </Button>
    </div>
  )
}

export function CostingDashboardPage() {
  const [tab, setTab] = useState<CostReportTab>('dashboard')
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const materialLines = useWorkOrderStore((s) => s.materialLines)
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const overheadPct = useCostingStore((s) => s.overheadPct)

  const costDeps = [workOrders, materialLines, jobCards, productionOperations, stockMovements, overheadPct]

  const allSheets = useMemo(() => useCostingStore.getState().getAllCostSheets(), costDeps)
  const productSummaries = useMemo(() => useCostingStore.getState().getProductCostSummaries(), costDeps)
  const varianceRows = useMemo(() => useCostingStore.getState().getVarianceReport(), costDeps)
  const profitability = useMemo(() => useCostingStore.getState().getTrailerProfitability(), costDeps)
  const expensiveComponents = useMemo(
    () => useCostingStore.getState().getMostExpensiveComponents(8),
    costDeps,
  )

  const dashboardStats = useMemo(() => {
    const fgSheets = allSheets.filter((s) => s.woType === 'finished_goods')
    const totalActual = fgSheets.reduce((sum, s) => sum + costSheetTotals(s).totalActual, 0)
    const totalStandard = fgSheets.reduce((sum, s) => sum + s.bomStandardCost, 0)
    const avgVariance =
      totalStandard > 0 ? ((totalActual - totalStandard) / totalStandard) * 100 : 0
    return {
      woCount: allSheets.length,
      fgCount: fgSheets.length,
      totalActual,
      avgVariance,
    }
  }, [allSheets])

  const woSheetColumns: ColumnDef<CostSheet, unknown>[] = [
    {
      accessorKey: 'woNo',
      header: 'WO No',
      cell: ({ row }) => (
        <Link
          to={`/work-orders/${row.original.workOrderId}?tab=cost`}
          className="font-mono text-xs font-medium text-erp-accent hover:underline"
        >
          {row.original.woNo}
        </Link>
      ),
    },
    { accessorKey: 'itemCode', header: 'Output', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
    { accessorKey: 'woType', header: 'Type', cell: ({ row }) => <span className="text-xs capitalize">{row.original.woType.replace(/_/g, ' ')}</span> },
    {
      id: 'planned',
      header: 'Total Planned',
      cell: ({ row }) => formatCurrency(costSheetTotals(row.original).totalPlanned),
    },
    {
      id: 'actual',
      header: 'Total Actual',
      cell: ({ row }) => formatCurrency(costSheetTotals(row.original).totalActual),
    },
    {
      id: 'variance',
      header: 'Variance %',
      cell: ({ row }) => {
        const v = costSheetTotals(row.original).variancePct
        return (
          <span className={cn('font-mono text-xs', v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : '')}>
            {formatNumber(v)}%
          </span>
        )
      },
    },
  ]

  const productColumns: ColumnDef<ProductCostSummary, unknown>[] = [
    { accessorKey: 'productCode', header: 'Product', cell: ({ row }) => <span className="font-mono text-xs">{row.original.productCode}</span> },
    { accessorKey: 'productName', header: 'Name' },
    { accessorKey: 'woCount', header: 'FG WOs' },
    { accessorKey: 'totalPlanned', header: 'Planned', cell: ({ row }) => formatCurrency(row.original.totalPlanned) },
    { accessorKey: 'totalActual', header: 'Actual', cell: ({ row }) => formatCurrency(row.original.totalActual) },
    { accessorKey: 'bomStandardCost', header: 'BOM Standard', cell: ({ row }) => formatCurrency(row.original.bomStandardCost) },
    {
      accessorKey: 'avgVariancePct',
      header: 'Variance %',
      cell: ({ row }) => (
        <span className={row.original.avgVariancePct > 0 ? 'text-red-600' : 'text-emerald-600'}>
          {formatNumber(row.original.avgVariancePct)}%
        </span>
      ),
    },
  ]

  const varianceColumns: ColumnDef<CostVarianceRow, unknown>[] = [
    {
      accessorKey: 'woNo',
      header: 'WO',
      cell: ({ row }) => (
        <Link to={`/work-orders/${row.original.workOrderId}?tab=cost`} className="font-mono text-xs text-erp-accent hover:underline">
          {row.original.woNo}
        </Link>
      ),
    },
    { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
    { accessorKey: 'totalPlanned', header: 'Planned', cell: ({ row }) => formatCurrency(row.original.totalPlanned) },
    { accessorKey: 'totalActual', header: 'Actual', cell: ({ row }) => formatCurrency(row.original.totalActual) },
    { accessorKey: 'bomStandardCost', header: 'BOM Std', cell: ({ row }) => formatCurrency(row.original.bomStandardCost) },
    {
      accessorKey: 'variancePct',
      header: 'Variance %',
      cell: ({ row }) => (
        <span className={row.original.variancePct > 0 ? 'text-red-600' : 'text-emerald-600'}>
          {formatNumber(row.original.variancePct)}%
        </span>
      ),
    },
    { accessorKey: 'materialVariance', header: 'Mat Δ', cell: ({ row }) => formatCurrency(row.original.materialVariance) },
    { accessorKey: 'laborVariance', header: 'Lab Δ', cell: ({ row }) => formatCurrency(row.original.laborVariance) },
  ]

  const profitColumns: ColumnDef<TrailerProfitabilityRow, unknown>[] = [
    { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrderNo}</span> },
    { accessorKey: 'fgWoNo', header: 'FG WO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.fgWoNo}</span> },
    { accessorKey: 'productCode', header: 'Product', cell: ({ row }) => <span className="font-mono text-xs">{row.original.productCode}</span> },
    { accessorKey: 'qty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.qty) },
    { accessorKey: 'totalActualCost', header: 'Actual Cost', cell: ({ row }) => formatCurrency(row.original.totalActualCost) },
    { accessorKey: 'revenue', header: 'Revenue', cell: ({ row }) => formatCurrency(row.original.revenue) },
    {
      accessorKey: 'grossMargin',
      header: 'Margin',
      cell: ({ row }) => (
        <span className={row.original.grossMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {formatCurrency(row.original.grossMargin)}
        </span>
      ),
    },
    {
      accessorKey: 'marginPct',
      header: 'Margin %',
      cell: ({ row }) => `${formatNumber(row.original.marginPct)}%`,
    },
  ]

  return (
    <DynamicsModuleDashboard
      title="Production Costing"
      subtitle="Planned vs actual cost for work orders, sub-assemblies, and finished trailers"
      badge="Costing"
      favoritePath="/costing"
      healthScore={dashboardStats.avgVariance > 10 ? 68 : dashboardStats.avgVariance > 0 ? 80 : 92}
      heroMetrics={[
        { id: 'sheets', label: 'Cost Sheets', value: dashboardStats.woCount, icon: Layers, accent: 'blue' },
        { id: 'fg', label: 'Finished Goods WOs', value: dashboardStats.fgCount, icon: Calculator, accent: 'indigo' },
        { id: 'actual', label: 'Trailer Actual Cost', value: formatCurrency(dashboardStats.totalActual), icon: IndianRupee, accent: 'amber' },
        { id: 'var', label: 'Avg Variance vs BOM', value: `${formatNumber(dashboardStats.avgVariance)}%`, icon: dashboardStats.avgVariance > 0 ? TrendingUp : TrendingDown, accent: dashboardStats.avgVariance > 0 ? 'red' : 'green' },
      ]}
      actions={<OverheadConfig />}
      kpiStrip={[
        { label: 'WO Cost Sheets', value: dashboardStats.woCount, tone: 'primary' },
        { label: 'FG Work Orders', value: dashboardStats.fgCount, tone: 'neutral' },
        { label: 'Variance vs BOM', value: `${formatNumber(dashboardStats.avgVariance)}%`, tone: dashboardStats.avgVariance > 5 ? 'warning' : 'success' },
      ]}
    >
      <DynamicsTabs
        items={tabs.map((t) => ({ label: t.label, path: t.id }))}
        activePath={tab}
        onChange={(id) => setTab(id as CostReportTab)}
      />

      {tab === 'dashboard' && (
        <DynamicsDashboardGrid>
          <DynamicsDashboardPanel title="Cost by Trailer (FG WOs)" noPadding>
            {profitability.length === 0 ? (
              <p className="dyn-empty-hint">No finished goods work orders yet.</p>
            ) : (
              <ul className="dyn-entity-list">
                {profitability.slice(0, 6).map((row) => (
                  <li key={row.fgWoNo} className="dyn-entity-list-item">
                    <span>
                      <span className="font-mono text-xs">{row.fgWoNo}</span>
                      <span className="dyn-entity-list-meta ml-2">{row.productCode}</span>
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(row.totalActualCost)}</span>
                  </li>
                ))}
              </ul>
            )}
          </DynamicsDashboardPanel>

          <DynamicsDashboardPanel title="Cost by Product" noPadding>
            {productSummaries.length === 0 ? (
              <p className="dyn-empty-hint">No product cost data.</p>
            ) : (
              <ul className="dyn-entity-list">
                {productSummaries.map((p) => (
                  <li key={p.productId} className="dyn-entity-list-item">
                    <span>{p.productName}</span>
                    <span className="font-mono font-medium">{formatCurrency(p.totalActual)}</span>
                  </li>
                ))}
              </ul>
            )}
          </DynamicsDashboardPanel>

          <DynamicsDashboardPanel title="Top Cost Variances" noPadding>
            <ul className="dyn-entity-list">
              {varianceRows.slice(0, 6).map((v) => (
                <li key={v.workOrderId}>
                  <Link to={`/work-orders/${v.workOrderId}?tab=cost`} className="dyn-entity-list-item dyn-entity-list-item-interactive">
                    <span className="font-mono text-xs">{v.woNo}</span>
                    <span className={cn(v.variancePct > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatNumber(v.variancePct)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </DynamicsDashboardPanel>

          <DynamicsDashboardPanel title="Most Expensive Components" noPadding>
            {expensiveComponents.length === 0 ? (
              <p className="dyn-empty-hint">No sub-assembly cost data.</p>
            ) : (
              <ul className="dyn-entity-list">
                {expensiveComponents.map((c) => (
                  <li key={c.itemCode} className="dyn-entity-list-item">
                    <span>
                      <span className="font-mono text-xs">{c.itemCode}</span>
                      <span className="dyn-entity-list-meta ml-2">{c.itemName}</span>
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(c.totalActualCost)}</span>
                  </li>
                ))}
              </ul>
            )}
          </DynamicsDashboardPanel>
        </DynamicsDashboardGrid>
      )}

      {tab === 'wo-sheets' && (
        <DynamicsDashboardPanel title="Work Order Cost Sheets" noPadding>
          {workOrders.length === 0 ? (
            <p className="dyn-empty-hint">Create work orders from MRP to generate cost sheets.</p>
          ) : (
            <DataTable data={allSheets} columns={woSheetColumns} />
          )}
        </DynamicsDashboardPanel>
      )}

      {tab === 'product' && (
        <DynamicsDashboardPanel
          title="Product Cost Summary"
          actions={<BarChart3 className="h-4 w-4 text-erp-muted" />}
          noPadding
        >
          <DataTable data={productSummaries} columns={productColumns} />
        </DynamicsDashboardPanel>
      )}

      {tab === 'variance' && (
        <DynamicsDashboardPanel title="Cost Variance Report" noPadding>
          <DataTable data={varianceRows} columns={varianceColumns} />
        </DynamicsDashboardPanel>
      )}

      {tab === 'profitability' && (
        <DynamicsDashboardPanel title="Trailer Profitability Report" noPadding>
          <DataTable data={profitability} columns={profitColumns} />
        </DynamicsDashboardPanel>
      )}
    </DynamicsModuleDashboard>
  )
}
