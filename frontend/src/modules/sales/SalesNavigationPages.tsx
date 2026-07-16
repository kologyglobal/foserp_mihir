import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  Factory,
  Gauge,
  ShoppingCart,
  Truck,
  FileText,
  Clock,
} from 'lucide-react'
import { salesModuleBreadcrumbs } from '../../utils/salesNavigation'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar } from '../../components/design-system/SmartFilterBar'
import { DataGrid } from '../../components/design-system/DataGrid'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import { SearchInput } from '../../components/ui/SearchInput'
import { Select } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { SalesOrderStatusPipeline } from '../../components/sales/SalesOrderStatusPipeline'
import { useMrpStore } from '../../store/mrpStore'
import { useCrmStore } from '../../store/crmStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
import { useUIStore } from '../../store/uiStore'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import {
  EnterpriseNumericCell,
  entNumericMeta,
} from '../../design-system/enterprise'
import { formatStatus } from '../../components/ui/Badge'
import {
  buildSalesAtRiskOrders,
  buildSalesExecutionStages,
  getSalesOrderFulfillmentLabel,
  type SalesExecutionStageId,
} from '../../utils/salesDashboardMetrics'
import { buildSalesLiveAlerts } from '../../utils/liveErpMetrics'
import { buildOrderStatusKpis } from '../../utils/salesModuleKpis'
import { resolveSalesOrderValue } from '../../components/sales/SalesOrder360Sections'
import type { SalesOrder, SalesOrderStatus } from '../../types/mrp'
import { cn } from '../../utils/cn'
import { SaaSPageShell } from '../../components/saas'
import { PageHeader } from '../../components/ui/PageHeader'
import { OPERATIONAL_REPORTS } from '../../types/reports'

type RiskFilter = '' | 'at_risk' | 'overdue'

const STATUS_OPTIONS: { value: SalesOrderStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Draft SO' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_production', label: 'In production' },
  { value: 'ready_dispatch', label: 'Dispatch ready' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'closed', label: 'Closed' },
]

function woCountFor(soId: string, workOrders: ReturnType<typeof useWorkOrderStore.getState>['workOrders']) {
  return workOrders.filter((w) => w.salesOrderId === soId).length
}

function dispatchCountFor(soId: string, dispatches: ReturnType<typeof useDispatchStore.getState>['dispatches']) {
  return dispatches.filter((d) => d.salesOrderId === soId).length
}

/** Order execution status — delivery, production, and fulfillment tracking */
export function SalesOrderStatusPage() {
  const navigate = useNavigate()
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const inspections = useQualityStore((s) => s.inspections)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | ''>('')
  const [stageFilter, setStageFilter] = useState<SalesExecutionStageId | null>(null)
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('')
  const [savedView, setSavedView] = useState('Execution view')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const customerName = useMemo(
    () => (id: string) => customers.find((c) => c.id === id)?.customerName ?? id,
    [customers],
  )
  const productName = useMemo(
    () => (id: string) => products.find((p) => p.id === id)?.productName ?? id,
    [products],
  )

  const atRiskOrders = useMemo(
    () => buildSalesAtRiskOrders(salesOrders, workOrders, inspections),
    [salesOrders, workOrders, inspections],
  )
  const atRiskIds = useMemo(() => new Set(atRiskOrders.map((o) => o.id)), [atRiskOrders])
  const atRiskMap = useMemo(() => new Map(atRiskOrders.map((o) => [o.id, o])), [atRiskOrders])

  const stages = useMemo(
    () => buildSalesExecutionStages(salesOrders, workOrders, inspections),
    [salesOrders, workOrders, inspections],
  )

  const openOrders = useMemo(
    () => salesOrders.filter((so) => !['closed', 'cancelled'].includes(so.status)),
    [salesOrders],
  )

  const metrics = useMemo(() => {
    const overdue = atRiskOrders.filter((o) => o.severity === 'critical').length
    const inProduction = openOrders.filter((so) =>
      workOrders.some((w) => w.salesOrderId === so.id && ['released', 'in_progress', 'in_production'].includes(w.status)),
    ).length
    const pendingMrp = openOrders.filter(
      (so) => so.status === 'confirmed' && !workOrders.some((w) => w.salesOrderId === so.id),
    ).length
    const dispatchReady = openOrders.filter((so) => so.status === 'ready_dispatch').length
    const orderBook = openOrders.reduce((s, o) => s + resolveSalesOrderValue(o, products.find((p) => p.id === o.productId)), 0)

    return { overdue, inProduction, pendingMrp, dispatchReady, orderBook, atRisk: atRiskOrders.length }
  }, [openOrders, workOrders, atRiskOrders, products])

  const liveAlerts = useMemo(
    () => buildSalesLiveAlerts({ atRiskOrders, ordersPendingMrp: metrics.pendingMrp }),
    [atRiskOrders, metrics.pendingMrp],
  )

  const filtered = useMemo(() => {
    let list = [...salesOrders]
    const today = new Date().toISOString().slice(0, 10)

    if (stageFilter) {
      list = list.filter((so) => {
        if (stageFilter === 'draft') return so.status === 'open'
        if (stageFilter === 'confirmed') return so.status === 'confirmed'
        if (stageFilter === 'in_production') {
          return so.status === 'in_production' || workOrders.some((w) => w.salesOrderId === so.id)
        }
        if (stageFilter === 'dispatch_ready') return so.status === 'ready_dispatch'
        if (stageFilter === 'dispatched') return so.status === 'dispatched'
        if (stageFilter === 'invoiced') return so.status === 'invoiced' || so.status === 'closed'
        return true
      })
    }

    if (statusFilter) list = list.filter((o) => o.status === statusFilter)

    if (riskFilter === 'at_risk') list = list.filter((o) => atRiskIds.has(o.id))
    if (riskFilter === 'overdue') {
      list = list.filter(
        (o) =>
          Boolean(o.requiredDate) &&
          o.requiredDate!.slice(0, 10) < today &&
          !['dispatched', 'closed', 'invoiced'].includes(o.status),
      )
    }

    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.salesOrderNo.toLowerCase().includes(s) ||
          customerName(o.customerId).toLowerCase().includes(s) ||
          productName(o.productId).toLowerCase().includes(s) ||
          (o.customerPoNumber ?? '').toLowerCase().includes(s),
      )
    }

    return list.sort((a, b) => (a.requiredDate || '9999-12-31').localeCompare(b.requiredDate || '9999-12-31'))
  }, [salesOrders, stageFilter, statusFilter, riskFilter, search, customerName, productName, atRiskIds, workOrders])

  const columns = useMemo<ColumnDef<SalesOrder, unknown>[]>(
    () => [
      {
        accessorKey: 'salesOrderNo',
        header: 'SO No',
        meta: { columnLabel: 'SO No' },
        cell: ({ row }) => (
          <TableLink to={`/sales/orders/${row.original.id}`}>{row.original.salesOrderNo}</TableLink>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        meta: { columnLabel: 'Customer' },
        cell: ({ row }) => customerName(row.original.customerId),
      },
      {
        id: 'product',
        header: 'Product',
        meta: { columnLabel: 'Product' },
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={productName(row.original.productId)}>
            {productName(row.original.productId)}
          </span>
        ),
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        meta: entNumericMeta('Qty'),
        cell: ({ row }) => <EnterpriseNumericCell value={row.original.qty} />,
      },
      {
        id: 'value',
        header: 'Value',
        meta: entNumericMeta('Value'),
        cell: ({ row }) => {
          const v = resolveSalesOrderValue(row.original, products.find((p) => p.id === row.original.productId))
          return <EnterpriseNumericCell value={v > 0 ? formatCurrency(v) : '—'} />
        },
      },
      {
        accessorKey: 'requiredDate',
        header: 'Required',
        meta: { columnLabel: 'Required' },
        cell: ({ row }) => {
          const today = new Date().toISOString().slice(0, 10)
          const required = row.original.requiredDate?.slice(0, 10)
          const overdue =
            Boolean(required) &&
            required! < today &&
            !['dispatched', 'closed', 'invoiced'].includes(row.original.status)
          return (
            <span className={cn(overdue && 'font-semibold text-erp-danger')}>
              {formatDate(row.original.requiredDate)}
            </span>
          )
        },
      },
      {
        id: 'fulfillment',
        header: 'Fulfillment',
        meta: { columnLabel: 'Fulfillment' },
        cell: ({ row }) => getSalesOrderFulfillmentLabel(row.original, workOrders),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot
            label={row.original.status === 'open' ? 'Draft SO' : formatStatus(row.original.status)}
            tone={statusToneFromLabel(row.original.status)}
          />
        ),
      },
      {
        id: 'wo',
        header: 'WO',
        meta: entNumericMeta('Work orders'),
        cell: ({ row }) => <EnterpriseNumericCell value={woCountFor(row.original.id, workOrders)} />,
      },
      {
        id: 'dispatch',
        header: 'Dispatch',
        meta: entNumericMeta('Dispatch'),
        cell: ({ row }) => <EnterpriseNumericCell value={dispatchCountFor(row.original.id, dispatches)} />,
      },
      {
        id: 'risk',
        header: 'Risk',
        meta: { columnLabel: 'Risk' },
        cell: ({ row }) => {
          const risk = atRiskMap.get(row.original.id)
          if (!risk) return <span className="text-erp-muted">—</span>
          return (
            <DynamicsStatusChip
              label={risk.severity === 'critical' ? 'Overdue' : risk.severity === 'high' ? 'At risk' : 'Watch'}
              tone={risk.severity === 'critical' ? 'critical' : risk.severity === 'high' ? 'warning' : 'info'}
            />
          )
        },
      },
    ],
    [customerName, productName, products, workOrders, dispatches, atRiskMap],
  )

  function openQuickView(so: SalesOrder) {
    const risk = atRiskMap.get(so.id)
    setSelectedRowId(so.id)
    openDetailPanel({
      title: so.salesOrderNo,
      subtitle: customerName(so.customerId),
      fields: [
        { label: 'Customer', value: customerName(so.customerId) },
        { label: 'Product', value: productName(so.productId) },
        { label: 'Qty', value: formatNumber(so.qty) },
        {
          label: 'Value',
          value: (() => {
            const v = resolveSalesOrderValue(so, products.find((p) => p.id === so.productId))
            return v > 0 ? formatCurrency(v) : '—'
          })(),
        },
        { label: 'Status', value: so.status === 'open' ? 'Draft SO' : formatStatus(so.status) },
        { label: 'Fulfillment', value: getSalesOrderFulfillmentLabel(so, workOrders) },
        { label: 'Required', value: formatDate(so.requiredDate) },
        { label: 'Work orders', value: String(woCountFor(so.id, workOrders)) },
        ...(risk ? [{ label: 'Risk', value: risk.riskReason }] : []),
      ],
      links: [{ label: 'Open Sales Order 360', href: `/sales/orders/${so.id}` }],
      timeline: [
        {
          id: 'status',
          label: so.status === 'open' ? 'Draft SO' : formatStatus(so.status),
          time: formatDate(so.requiredDate),
          status: 'current',
        },
      ],
    })
  }

  const filterChips = [
    ...(stageFilter ? [{ id: 'stage', label: `Stage: ${stages.find((s) => s.id === stageFilter)?.shortLabel ?? stageFilter}` }] : []),
    ...(statusFilter ? [{ id: 'status', label: statusFilter === 'open' ? 'Draft SO' : formatStatus(statusFilter) }] : []),
    ...(riskFilter === 'at_risk' ? [{ id: 'risk', label: 'At risk only' }] : []),
    ...(riskFilter === 'overdue' ? [{ id: 'risk', label: 'Overdue only' }] : []),
    ...(search ? [{ id: 'search', label: `Search: ${search}` }] : []),
  ]

  const orderStatusInsights = useMemo(
    () =>
      buildOrderStatusKpis(
        metrics,
        openOrders.length,
        { stage: stageFilter, status: statusFilter, risk: riskFilter },
        (patch) => {
          if (patch.stage !== undefined) setStageFilter(patch.stage as SalesExecutionStageId | null)
          if (patch.status !== undefined) setStatusFilter((patch.status ?? '') as '' | SalesOrderStatus)
          if (patch.risk !== undefined) setRiskFilter((patch.risk ?? '') as RiskFilter)
        },
      ),
    [metrics, openOrders.length, stageFilter, statusFilter, riskFilter],
  )

  return (
    <OperationalPageShell
      title="Order Status"
      description="Track delivery commitments, production progress, and fulfillment risk across the order book"
      favoritePath="/sales/order-status"
      badge="Execution"
      variant="dynamics"
      liveAlerts={liveAlerts.length > 0 ? liveAlerts : undefined}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Navigate">
            <CommandBarButton icon={ShoppingCart} label="Sales Orders" onClick={() => navigate('/sales/orders')} primary />
            <CommandBarButton icon={Gauge} label="Run MRP" onClick={() => navigate('/mrp/run')} />
            <CommandBarButton icon={Factory} label="Work Orders" onClick={() => navigate('/work-orders')} />
            <CommandBarButton icon={Truck} label="Dispatch" onClick={() => navigate('/dispatch/register')} />
          </CommandBarGroup>
          <CommandBarGroup label="Reports">
            <CommandBarButton icon={FileText} label="Open Orders" onClick={() => navigate('/reports/sales/open-orders')} />
            <CommandBarButton icon={Clock} label="Delivery Commitments" onClick={() => navigate('/reports/sales/delivery-commitments')} />
          </CommandBarGroup>
        </CommandBar>
      }
      kpiStrip={orderStatusInsights}
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={(id) => {
            if (id === 'stage') setStageFilter(null)
            if (id === 'status') setStatusFilter('')
            if (id === 'risk') setRiskFilter('')
            if (id === 'search') setSearch('')
          }}
          onClearAll={() => {
            setStageFilter(null)
            setStatusFilter('')
            setRiskFilter('')
            setSearch('')
          }}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={filtered.length}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search SO, customer, product, PO…"
            className="w-full sm:w-72"
          />
          <Select
            wrapClassName="w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SalesOrderStatus | '')}
            className="h-9"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            wrapClassName="w-36"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            className="h-9"
          >
            <option value="">All risk</option>
            <option value="at_risk">At risk</option>
            <option value="overdue">Overdue</option>
          </Select>
        </SmartFilterBar>
      }
    >
      <div className="crm-dashboard-zones">
        {metrics.atRisk > 0 && (
          <div className="opp-360-alert opp-360-alert--danger">
            <AlertTriangle className="opp-360-alert__icon" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="opp-360-alert__title">
                {metrics.atRisk} order{metrics.atRisk !== 1 ? 's' : ''} need attention
              </p>
              <p className="opp-360-alert__text">
                {metrics.overdue > 0
                  ? `${metrics.overdue} past delivery date · review MRP and production queues`
                  : 'Delivery or QC risk flagged on active orders'}
              </p>
              <button
                type="button"
                className="mt-2 text-[12px] font-semibold text-erp-primary"
                onClick={() => setRiskFilter('at_risk')}
              >
                Show at-risk orders →
              </button>
            </div>
          </div>
        )}

        <SalesOrderStatusPipeline
          stages={stages}
          activeStage={stageFilter}
          orderBookValue={metrics.orderBook}
          openOrderCount={openOrders.length}
          onStageClick={(id) => setStageFilter((cur) => (cur === id ? null : id))}
        />

        <DataGrid
          data={filtered}
          columns={columns}
          compact
          zebra
          stickyFirstColumn
          showToolbar={false}
          selectedRowId={selectedRowId}
          onRowSelect={(row) => setSelectedRowId(row.id)}
          onRowQuickView={openQuickView}
          onRowView={(row) => navigate(`/sales/orders/${row.id}`)}
          emptyMessage="No orders match your filters."
          exportFileName="sales-order-status"
        />
      </div>
    </OperationalPageShell>
  )
}

/** Sales execution reports hub */
export function SalesReportsHubPage() {
  const salesReports = OPERATIONAL_REPORTS.filter((r) => r.module === 'sales' || r.path.includes('/reports/sales/'))
  return (
    <SaaSPageShell>
      <div className="erp-page space-y-4">
        <PageHeader
          title="Sales Reports"
          description="Order book, delivery commitments, and sales execution analytics"
          breadcrumbs={salesModuleBreadcrumbs('Reports', '/sales/reports')}
          autoBreadcrumbs={false}
        />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {salesReports.map((r) => (
            <li key={r.id}>
              <Link to={r.path} className="block rounded-lg border border-erp-border p-4 hover:bg-erp-surface-alt/60">
                <p className="font-semibold text-erp-text">{r.title}</p>
                <p className="mt-1 text-sm text-erp-muted">{r.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SaaSPageShell>
  )
}

/** Alias route — same detail view as /sales/orders/:id */
export { SalesOrder360Page } from './SalesOrder360Page'

export function SalesPipelineLegacyRedirect() {
  return <Navigate to="/crm/opportunities" replace />
}

export function SalesLeadsLegacyRedirect() {
  return <Navigate to="/crm/leads" replace />
}

export function SalesLeadNewLegacyRedirect() {
  return <Navigate to="/crm/leads/new" replace />
}

export function SalesLeadDetailLegacyRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/crm/leads/${id}` : '/crm/leads'} replace />
}

export function SalesLeadEditLegacyRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/crm/leads/${id}/edit` : '/crm/leads'} replace />
}

export function SalesInquiriesLegacyRedirect() {
  return <Navigate to="/crm/opportunities" replace />
}

export function InquiryDetailLegacyRedirect() {
  const { id } = useParams()
  const opportunity = useCrmStore((s) => s.opportunities.find((o) => o.inquiryId === id || o.id === id))
  if (opportunity) return <Navigate to={`/crm/opportunities/${opportunity.id}`} replace />
  return <Navigate to="/crm/opportunities" replace />
}

export function SalesQuotationsLegacyRedirect() {
  return <Navigate to="/crm/quotations" replace />
}

export function SalesQuotationNewLegacyRedirect() {
  return <Navigate to="/crm/quotations/new" replace />
}

export function SalesQuotationDetailLegacyRedirect() {
  const { id } = useParams()
  const document = useCrmStore((s) =>
    id ? s.quotationDocuments.find((d) => d.id === id || d.quotationId === id) : undefined,
  )
  if (document) return <Navigate to={`/crm/quotations/${document.id}`} replace />
  return <Navigate to="/crm/quotations" replace />
}

export function SalesApprovalsLegacyRedirect() {
  return <Navigate to="/crm/quotations?status=pending_approval&segment=pending" replace />
}

/** Canonical SO detail is /sales/orders/:id — legacy /360 suffix redirects here. */
export function SalesOrder360LegacyRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/sales/orders/${id}` : '/sales/orders'} replace />
}
