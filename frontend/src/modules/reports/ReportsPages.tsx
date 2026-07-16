import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { BarChart3, FileText, Layers } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
} from '../../components/dynamics'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { DataTable } from '../../components/tables/DataTable'
import { TableLink } from '../../components/ui/AppLink'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import {
  OPERATIONAL_REPORTS,
  REPORT_MODULE_LABELS,
  REPORT_MODULES,
  type ReportDefinition,
} from '../../types/reports'
import {
  getDelayedPoReport,
  getDeliveryCommitmentsReport,
  getNcrAgeingReport,
  getNegativeStockReport,
  getOpenPoReport,
  getOpenSalesOrdersReport,
  getPendingDispatchReport,
  getPodPendingReport,
  getReworkTrendReport,
  getSlowMovingReport,
  getStockAgingReport,
  getWipAgingReport,
  getWoStatusReport,
} from '../../utils/operationalReports'
import {
  getEngineeringChangeReport,
  getObsoleteProductReport,
  getProductCostReport,
  getProductRevisionReport,
  getProductUsageReport,
} from '../../utils/productReports'
import { dispatchStatusLabel } from '../../types/dispatch'

function ReportShell({
  title,
  description,
  module,
  children,
  rowCount,
}: {
  title: string
  description: string
  module: ReportDefinition['module']
  children: ReactNode
  rowCount?: number
}) {
  return (
    <div className="erp-page">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: 'Reports', to: '/reports' },
          { label: REPORT_MODULE_LABELS[module], to: `/reports#${module}` },
          { label: title },
        ]}
      />
      {rowCount !== undefined && (
        <p className="mb-4 text-sm text-erp-muted">{rowCount} row{rowCount === 1 ? '' : 's'}</p>
      )}
      <SectionCard noPadding>{children}</SectionCard>
    </div>
  )
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-erp-muted">
        {message}
      </td>
    </tr>
  )
}

export function ReportsIndexPage() {
  const reportCount = OPERATIONAL_REPORTS.length
  const moduleCount = REPORT_MODULES.length

  return (
    <DynamicsModuleDashboard
      title="Operational Reports Hub"
      subtitle="Tabular operational reports — run directly from live ERP data"
      badge="Reports"
      favoritePath="/reports"
      healthScore={94}
      heroMetrics={[
        { id: 'reports', label: 'Live Reports', value: reportCount, icon: FileText, accent: 'blue' },
        { id: 'modules', label: 'Report Modules', value: moduleCount, icon: Layers, accent: 'indigo' },
        { id: 'inventory', label: 'Inventory Reports', value: OPERATIONAL_REPORTS.filter((r) => r.module === 'inventory').length, icon: BarChart3, accent: 'green' },
        { id: 'sales', label: 'Sales Reports', value: OPERATIONAL_REPORTS.filter((r) => r.module === 'sales').length, icon: BarChart3, accent: 'amber' },
      ]}
      kpiStrip={[
        { label: 'Production Reports', value: OPERATIONAL_REPORTS.filter((r) => r.module === 'production').length, tone: 'primary' },
        { label: 'Quality Reports', value: OPERATIONAL_REPORTS.filter((r) => r.module === 'quality').length, tone: 'neutral' },
        { label: 'Dispatch Reports', value: OPERATIONAL_REPORTS.filter((r) => r.module === 'dispatch').length, tone: 'success' },
      ]}
    >
      {REPORT_MODULES.map((mod) => {
        const reports = OPERATIONAL_REPORTS.filter((r) => r.module === mod)
        return (
          <DynamicsDashboardPanel
            key={mod}
            title={REPORT_MODULE_LABELS[mod]}
            actions={<span className="dyn-entity-list-meta">{reports.length} reports</span>}
          >
            <ul className="dyn-report-grid">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link to={r.path} className="dyn-report-card">
                    <p className="dyn-report-card-title">{r.title}</p>
                    <p className="dyn-report-card-desc">{r.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </DynamicsDashboardPanel>
        )
      })}
    </DynamicsModuleDashboard>
  )
}

export function StockAgingReportPage() {
  const data = getStockAgingReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    {
      accessorKey: 'itemCode',
      header: 'Item',
      cell: ({ row }) => (
        <TableLink to={`/inventory/stock/${row.original.itemId}`}>{row.original.itemCode}</TableLink>
      ),
    },
    { accessorKey: 'itemName', header: 'Description' },
    { accessorKey: 'warehouseCode', header: 'WH' },
    { accessorKey: 'onHand', header: 'On Hand', cell: ({ row }) => formatNumber(row.original.onHand), meta: { align: 'right' } },
    { accessorKey: 'uomCode', header: 'UOM' },
    { accessorKey: 'ageDays', header: 'Age (days)', meta: { align: 'right' } },
    { accessorKey: 'ageBucket', header: 'Bucket' },
    { accessorKey: 'lastMovementDate', header: 'Last Movement', cell: ({ row }) => formatDate(row.original.lastMovementDate) },
    { accessorKey: 'stockValue', header: 'Value', cell: ({ row }) => formatCurrency(row.original.stockValue), meta: { align: 'right' } },
  ]
  return (
    <ReportShell title="Stock Aging" description="On-hand inventory by days since last ledger movement" module="inventory" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No stocked positions found." />
    </ReportShell>
  )
}

export function NegativeStockReportPage() {
  const data = getNegativeStockReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono">{row.original.itemCode}</span> },
    { accessorKey: 'itemName', header: 'Description' },
    { accessorKey: 'warehouseCode', header: 'WH' },
    {
      accessorKey: 'onHand',
      header: 'On Hand',
      cell: ({ row }) => <span className="font-semibold text-erp-danger">{formatNumber(row.original.onHand)}</span>,
      meta: { align: 'right' },
    },
    { accessorKey: 'uomCode', header: 'UOM' },
    { accessorKey: 'lastMovementDate', header: 'Last Movement', cell: ({ row }) => formatDate(row.original.lastMovementDate) },
  ]
  return (
    <ReportShell title="Negative Stock" description="Item/warehouse balances below zero — requires immediate correction" module="inventory" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No negative stock positions — ledger is clean." />
    </ReportShell>
  )
}

export function SlowMovingReportPage() {
  const data = getSlowMovingReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono">{row.original.itemCode}</span> },
    { accessorKey: 'itemName', header: 'Description' },
    { accessorKey: 'warehouseCode', header: 'WH' },
    { accessorKey: 'onHand', header: 'On Hand', cell: ({ row }) => formatNumber(row.original.onHand), meta: { align: 'right' } },
    {
      accessorKey: 'daysSinceIssue',
      header: 'Days Since Issue',
      cell: ({ row }) => (row.original.daysSinceIssue < 0 ? 'Never issued' : row.original.daysSinceIssue),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'lastIssueDate',
      header: 'Last Issue',
      cell: ({ row }) => (row.original.lastIssueDate ? formatDate(row.original.lastIssueDate) : '—'),
    },
    { accessorKey: 'stockValue', header: 'Value', cell: ({ row }) => formatCurrency(row.original.stockValue), meta: { align: 'right' } },
  ]
  return (
    <ReportShell title="Slow Moving Stock" description="On-hand items with no issue activity in 90+ days" module="inventory" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No slow-moving stock identified." />
    </ReportShell>
  )
}

export function OpenPoReportPage() {
  const data = getOpenPoReport()
  return (
    <ReportShell title="Open PO" description="Purchase orders sent to vendor with open quantity" module="purchase" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead>
          <tr>
            <th>PO</th>
            <th>Vendor</th>
            <th>Status</th>
            <th className="text-right">Open Qty</th>
            <th>Expected</th>
            <th className="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.poId}>
              <td><TableLink to={`/purchase/orders/${p.poId}`}>{p.poNo}</TableLink></td>
              <td>{p.vendorName}</td>
              <td><Badge color={statusColor(p.status)}>{formatStatus(p.status)}</Badge></td>
              <td className="num">{formatNumber(p.openQty)}</td>
              <td>{formatDate(p.expectedDate)}</td>
              <td className="num">{formatCurrency(p.totalValue)}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={6} message="No open purchase orders." />}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function DelayedPoReportPage() {
  const data = getDelayedPoReport()
  return (
    <ReportShell title="Delayed PO" description="Open POs past expected delivery date" module="purchase" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead>
          <tr>
            <th>PO</th>
            <th>Vendor</th>
            <th>Expected</th>
            <th className="text-right">Open Qty</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.poId}>
              <td><TableLink to={`/purchase/orders/${p.poId}`}>{p.poNo}</TableLink></td>
              <td>{p.vendorName}</td>
              <td className="text-erp-danger">{formatDate(p.expectedDate)}</td>
              <td className="num">{formatNumber(p.openQty)}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={4} message="No delayed purchase orders." />}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function WoStatusReportPage() {
  const data = getWoStatusReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    {
      accessorKey: 'woNo',
      header: 'WO',
      cell: ({ row }) => <TableLink to={`/work-orders/${row.original.woId}`}>{row.original.woNo}</TableLink>,
    },
    { accessorKey: 'salesOrderNo', header: 'SO' },
    { accessorKey: 'productName', header: 'Product' },
    { accessorKey: 'outputItemCode', header: 'Output' },
    { accessorKey: 'qty', header: 'Qty', meta: { align: 'right' } },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>,
    },
    { accessorKey: 'plannedStartDate', header: 'Start', cell: ({ row }) => formatDate(row.original.plannedStartDate) },
    {
      accessorKey: 'plannedFinishDate',
      header: 'Finish',
      cell: ({ row }) => (
        <span className={row.original.isOverdue ? 'text-erp-danger font-medium' : ''}>
          {formatDate(row.original.plannedFinishDate)}
        </span>
      ),
    },
  ]
  return (
    <ReportShell title="WO Status" description="Active work orders by status and schedule" module="production" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No active work orders." />
    </ReportShell>
  )
}

export function WipAgingReportPage() {
  const data = getWipAgingReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    {
      accessorKey: 'woNo',
      header: 'WO',
      cell: ({ row }) => <TableLink to={`/work-orders/${row.original.woId}`}>{row.original.woNo}</TableLink>,
    },
    { accessorKey: 'salesOrderNo', header: 'SO' },
    { accessorKey: 'productName', header: 'Product' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>,
    },
    { accessorKey: 'wipStartDate', header: 'WIP Start', cell: ({ row }) => formatDate(row.original.wipStartDate) },
    { accessorKey: 'ageDays', header: 'WIP Age', meta: { align: 'right' } },
    { accessorKey: 'plannedFinishDate', header: 'Plan Finish', cell: ({ row }) => formatDate(row.original.plannedFinishDate) },
    {
      accessorKey: 'daysOverdue',
      header: 'Days Overdue',
      cell: ({ row }) => (row.original.daysOverdue > 0 ? row.original.daysOverdue : '—'),
      meta: { align: 'right' },
    },
  ]
  return (
    <ReportShell title="WIP Aging" description="In-progress work orders by days in WIP" module="production" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No work orders currently in WIP." />
    </ReportShell>
  )
}

export function NcrAgingReportPage() {
  const data = getNcrAgeingReport()
  return (
    <ReportShell title="NCR Aging" description="Open non-conformance reports older than 7 days" module="quality" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead>
          <tr>
            <th>NCR</th>
            <th>Source</th>
            <th>Item</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Reported</th>
          </tr>
        </thead>
        <tbody>
          {data.map((n) => (
            <tr key={n.id}>
              <td><TableLink to={`/quality/ncr/${n.id}`}>{n.ncrNo}</TableLink></td>
              <td>{formatStatus(n.source)}</td>
              <td className="font-mono text-xs">{n.itemCode}</td>
              <td>{n.severity}</td>
              <td><Badge color={statusColor(n.status)}>{formatStatus(n.status)}</Badge></td>
              <td>{formatDate(n.reportedDate ?? n.createdAt.slice(0, 10))}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={6} message="No aged open NCRs." />}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function ReworkTrendReportPage() {
  const data = getReworkTrendReport()
  return (
    <ReportShell title="Rework Trend" description="Monthly rework orders opened vs completed (last 6 months)" module="quality" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead>
          <tr>
            <th>Period</th>
            <th className="text-right">Opened</th>
            <th className="text-right">Completed</th>
            <th className="text-right">Open at Month End</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.period}>
              <td>{r.period}</td>
              <td className="num">{r.opened}</td>
              <td className="num">{r.completed}</td>
              <td className="num">{r.openAtPeriodEnd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function PendingDispatchReportPage() {
  const data = getPendingDispatchReport()
  return (
    <ReportShell title="Pending Dispatch" description="Dispatch plans not yet confirmed or dispatched" module="dispatch" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead>
          <tr>
            <th>DC</th>
            <th>SO</th>
            <th>Customer</th>
            <th>Trailer</th>
            <th>Status</th>
            <th>Planned</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.dispatchId}>
              <td><TableLink to={`/dispatch/${r.dispatchId}`}>{r.dispatchNo}</TableLink></td>
              <td>{r.salesOrderNo}</td>
              <td>{r.customerName}</td>
              <td>{r.trailerNo ?? '—'}</td>
              <td>{dispatchStatusLabel(r.status)}</td>
              <td>{formatDate(r.plannedDate)}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={6} message="No pending dispatches." />}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function PodPendingReportPage() {
  const data = getPodPendingReport()
  return (
    <ReportShell title="POD Pending" description="Dispatched units awaiting proof of delivery" module="dispatch" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead>
          <tr>
            <th>DC</th>
            <th>SO</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Dispatched</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.dispatchId}>
              <td><TableLink to={`/dispatch/${r.dispatchId}`}>{r.dispatchNo}</TableLink></td>
              <td>{r.salesOrderNo}</td>
              <td>{r.customerName}</td>
              <td><Badge color={statusColor(r.status)}>{dispatchStatusLabel(r.status)}</Badge></td>
              <td>{r.plannedDate ? formatDate(r.plannedDate) : '—'}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={5} message="No POD-pending dispatches." />}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function OpenOrdersReportPage() {
  const data = getOpenSalesOrdersReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    {
      accessorKey: 'salesOrderNo',
      header: 'SO',
      cell: ({ row }) => <TableLink to={`/sales/orders/${row.original.salesOrderId}`}>{row.original.salesOrderNo}</TableLink>,
    },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productName', header: 'Product' },
    { accessorKey: 'qty', header: 'Qty', meta: { align: 'right' } },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>,
    },
    {
      accessorKey: 'requiredDate',
      header: 'Required',
      cell: ({ row }) => (
        <span className={row.original.isOverdue ? 'text-erp-danger font-medium' : ''}>
          {formatDate(row.original.requiredDate)}
        </span>
      ),
    },
    {
      accessorKey: 'daysToDelivery',
      header: 'Days',
      cell: ({ row }) => (row.original.isOverdue ? `${Math.abs(row.original.daysToDelivery)}d late` : `${row.original.daysToDelivery}d`),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'grandTotal',
      header: 'Value',
      cell: ({ row }) => (row.original.grandTotal != null ? formatCurrency(row.original.grandTotal) : '—'),
      meta: { align: 'right' },
    },
  ]
  return (
    <ReportShell title="Open Orders" description="Sales orders not yet closed or invoiced" module="sales" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No open sales orders." />
    </ReportShell>
  )
}

export function DeliveryCommitmentsReportPage() {
  const data = getDeliveryCommitmentsReport()
  const columns: ColumnDef<(typeof data)[0], unknown>[] = [
    {
      accessorKey: 'salesOrderNo',
      header: 'SO',
      cell: ({ row }) => <TableLink to={`/sales/orders/${row.original.salesOrderId}`}>{row.original.salesOrderNo}</TableLink>,
    },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productName', header: 'Product' },
    { accessorKey: 'qty', header: 'Qty', meta: { align: 'right' } },
    { accessorKey: 'requiredDate', header: 'Commit Date', cell: ({ row }) => formatDate(row.original.requiredDate) },
    {
      accessorKey: 'status',
      header: 'SO Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>,
    },
    {
      accessorKey: 'commitmentRisk',
      header: 'Risk',
      cell: ({ row }) => (
        <Badge
          color={
            row.original.commitmentRisk === 'overdue'
              ? 'red'
              : row.original.commitmentRisk === 'at_risk'
                ? 'orange'
                : 'green'
          }
        >
          {formatStatus(row.original.commitmentRisk)}
        </Badge>
      ),
    },
  ]
  return (
    <ReportShell title="Delivery Commitments" description="Committed delivery dates within 90 days with risk flag" module="sales" rowCount={data.length}>
      <DataTable data={data} columns={columns} emptyMessage="No delivery commitments in horizon." />
    </ReportShell>
  )
}

export function ProductRevisionReportPage() {
  const data = getProductRevisionReport()
  return (
    <ReportShell title="Product Revision Report" description="Current revision and engineering control by product" module="products" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead><tr><th>Code</th><th>Product</th><th>Family</th><th>Rev</th><th>BOM</th><th>Routing</th><th>Status</th><th>Owner</th><th>Effective</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}>
              <td><TableLink to={`/masters/products/${r.productId}`}>{r.productCode}</TableLink></td>
              <td>{r.productName}</td>
              <td>{r.productFamily}</td>
              <td>{r.currentRevision}</td>
              <td>{r.bomRevision}</td>
              <td>{r.routingRevision}</td>
              <td>{r.status}</td>
              <td>{r.engineeringOwner}</td>
              <td>{formatDate(r.effectiveFrom)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function ObsoleteProductReportPage() {
  const data = getObsoleteProductReport()
  return (
    <ReportShell title="Obsolete Products" description="Products marked obsolete" module="products" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead><tr><th>Code</th><th>Product</th><th>Obsolete Date</th><th>Owner</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}><td>{r.productCode}</td><td>{r.productName}</td><td>{r.effectiveTo ? formatDate(r.effectiveTo) : '—'}</td><td>{r.engineeringOwner}</td></tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={4} message="No obsolete products." />}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function ProductCostReportPage() {
  const data = getProductCostReport()
  return (
    <ReportShell title="Product Cost Report" description="Standard costs by product" module="products" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead><tr><th>Code</th><th>Product</th><th className="text-right">Material</th><th className="text-right">Labor</th><th className="text-right">Machine</th><th className="text-right">Overhead</th><th className="text-right">Total</th><th className="text-right">List</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}>
              <td><TableLink to={`/masters/products/${r.productId}`}>{r.productCode}</TableLink></td>
              <td>{r.productName}</td>
              <td className="num">{formatCurrency(r.materialCost)}</td>
              <td className="num">{formatCurrency(r.laborCost)}</td>
              <td className="num">{formatCurrency(r.machineCost)}</td>
              <td className="num">{formatCurrency(r.overheadCost)}</td>
              <td className="num">{formatCurrency(r.totalCost)}</td>
              <td className="num">{formatCurrency(r.listPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function ProductUsageReportPage() {
  const data = getProductUsageReport()
  return (
    <ReportShell title="Product Usage Report" description="Open SO/WO and pipeline value by product" module="products" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead><tr><th>Code</th><th>Product</th><th>Status</th><th className="text-right">Open SO</th><th className="text-right">Open WO</th><th className="text-right">Pipeline</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.productId}>
              <td>{r.productCode}</td><td>{r.productName}</td><td>{r.status}</td>
              <td className="num">{r.openSalesOrders}</td><td className="num">{r.openWorkOrders}</td>
              <td className="num">{formatCurrency(r.totalRevenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  )
}

export function EngineeringChangeReportPage() {
  const data = getEngineeringChangeReport()
  return (
    <ReportShell title="Engineering Change Report" description="Product master field changes with reason" module="products" rowCount={data.length}>
      <table className="erp-table w-full">
        <thead><tr><th>Date</th><th>Product</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Reason</th></tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              <td>{formatDate(r.changedAt.slice(0, 10))}</td><td>{r.productCode}</td><td>{r.field}</td>
              <td className="max-w-[100px] truncate">{r.oldValue}</td><td className="max-w-[100px] truncate">{r.newValue}</td>
              <td>{r.changedByName}</td><td>{r.reason}</td>
            </tr>
          ))}
          {data.length === 0 && <EmptyRow colSpan={7} message="No engineering changes logged." />}
        </tbody>
      </table>
    </ReportShell>
  )
}
