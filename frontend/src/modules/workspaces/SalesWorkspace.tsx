import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Gauge,
  Receipt,
  CheckCircle2,
  Truck,
  Plus,
  FileText,
  AlertTriangle,
  GitBranch,
  TrendingUp,
  Target,
  IndianRupee,
  BarChart3,
  LayoutGrid,
} from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardGrid,
  DynamicsDashboardPanel,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { LiveAlertStrip, LiveWorkspaceSections } from '../../components/live-erp'
import { SmartEmptyState } from '../../components/premium/SmartEmptyState'
import { TableLink } from '../../components/ui/AppLink'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { SalesExecutionPipelineBoard } from '../../components/sales/SalesExecutionPipelineBoard'
import {
  SalesBookingTrendChart,
  SalesCommercialFunnelChart,
  SalesCustomerOrderBookChart,
  SalesDeliveryCommitmentChart,
  SalesOrderStatusChart,
  SalesOwnerOrderBookChart,
} from '../../components/sales/SalesDashboardCharts'
import {
  SalesBillingSummaryPanel,
  SalesCommercialKpiStrip,
  SalesOwnerPerformancePanel,
  SalesPipelineHandoverPanel,
  SalesQuotationApprovalsPanel,
  SalesReceivablesPanel,
  SalesTopCustomersPanel,
} from '../../components/sales/SalesDashboardPanels'
import { useSalesWorkspaceMetrics, formatMetricCurrency } from '../../utils/workspaceMetrics'
import { buildSalesLiveAlerts } from '../../utils/liveErpMetrics'
import {
  buildSalesAtRiskOrders,
  buildPendingMrpOrders,
  computeSalesHealthScore,
} from '../../utils/salesDashboardMetrics'
import {
  buildSalesCommercialActivity,
  buildSalesManagementMetrics,
  formatSalesCurrency,
  SALES_VIEW_LABELS,
  type SalesDashboardView,
} from '../../utils/salesManagementMetrics'
import { useMrpStore } from '../../store/mrpStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
import { useCrmStore } from '../../store/crmStore'
import { useSalesStore } from '../../store/salesStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { KPI_ICON_PRESETS } from '../../design-system/enterprise'
import {
  DashboardManagementFeed,
  DashboardQuickViewDrawer,
  useDashboardNavigation,
} from '../../components/dashboard'
import {
  buildCrmManagementFeed,
  buildSalesManagementFeed,
  feedItemToLiveActivity,
} from '../../utils/dashboardLiveFeed'
import { FioriSegmentedView, FioriToolbarShell } from '../../components/fiori'
import type { LiveActivityEvent, LiveAlert } from '../../components/live-erp/types'

const VIEW_MODES: SalesDashboardView[] = ['overview', 'pipeline', 'execution', 'billing']

export function SalesWorkspacePage() {
  const navigate = useNavigate()
  const dashboardNav = useDashboardNavigation()
  const [viewMode, setViewMode] = useState<SalesDashboardView>('overview')
  const m = useSalesWorkspaceMetrics()
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const opportunities = useCrmStore((s) => s.opportunities)
  const followUps = useCrmStore((s) => s.followUps)
  const activities = useCrmStore((s) => s.activities)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const leads = useSalesStore((s) => s.leads)
  const quotations = useSalesStore((s) => s.quotations)
  const invoices = useInvoiceStore((s) => s.invoices)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const proformas = useProformaInvoiceStore((s) => s.proformaInvoices)

  const customerName = useMemo(
    () => (id: string) => customers.find((c) => c.id === id)?.customerName ?? id,
    [customers],
  )
  const productName = useMemo(
    () => (id: string) => products.find((p) => p.id === id)?.productName ?? id,
    [products],
  )
  const lookup = useMemo(
    () => ({ customerName, productName: (id: string) => productName(id) }),
    [customerName, productName],
  )

  const invoiceMetrics = useMemo(() => useInvoiceStore.getState().getMetrics(), [invoices])
  const receivables = useMemo(() => useInvoiceStore.getState().getReceivables(), [invoices])

  const metrics = useMemo(
    () =>
      buildSalesManagementMetrics({
        salesOrders,
        workOrders,
        inspections,
        opportunities,
        followUps,
        activities,
        quotationDocuments,
        leads,
        quotations,
        invoiceMetrics,
        receivables,
        proformas,
        resolveCustomerName: customerName,
      }),
    [
      salesOrders,
      workOrders,
      inspections,
      opportunities,
      followUps,
      activities,
      quotationDocuments,
      leads,
      quotations,
      invoiceMetrics,
      receivables,
      proformas,
      customerName,
    ],
  )

  const atRiskOrders = useMemo(
    () => buildSalesAtRiskOrders(salesOrders, workOrders, inspections),
    [salesOrders, workOrders, inspections],
  )
  const pendingMrp = useMemo(
    () => buildPendingMrpOrders(salesOrders, workOrders),
    [salesOrders, workOrders],
  )
  const recentOrders = useMemo(
    () =>
      [...salesOrders]
        .sort((a, b) => (b.orderDate ?? b.createdAt).localeCompare(a.orderDate ?? a.createdAt))
        .slice(0, 8),
    [salesOrders],
  )
  const overdueDeliveries = useMemo(
    () => atRiskOrders.filter((o) => o.severity === 'critical').length,
    [atRiskOrders],
  )

  const healthScore = useMemo(
    () =>
      computeSalesHealthScore({
        atRiskCount: atRiskOrders.length,
        ordersPendingMrp: m.ordersPendingMrp,
        ordersOnQcHold: m.ordersOnQcHold,
        overdueDeliveries,
      }),
    [atRiskOrders.length, m.ordersPendingMrp, m.ordersOnQcHold, overdueDeliveries],
  )

  const liveAlerts = useMemo(
    () => buildSalesLiveAlerts({ atRiskOrders, ordersPendingMrp: m.ordersPendingMrp }),
    [atRiskOrders, m.ordersPendingMrp],
  )

  const commercialActivity = useMemo(
    () =>
      buildSalesCommercialActivity({
        salesOrders,
        invoices,
        dispatches,
        resolveCustomerName: customerName,
      }),
    [salesOrders, invoices, dispatches, customerName],
  )

  const crmFeed = useMemo(
    () =>
      buildCrmManagementFeed({
        opportunities,
        followUps,
        activities,
        quotationDocuments,
        leads,
        resolveCustomerName: customerName,
      }),
    [opportunities, followUps, activities, quotationDocuments, leads, customerName],
  )

  const managementFeed = useMemo(
    () =>
      buildSalesManagementFeed({
        crmFeed,
        salesOrders,
        invoices,
        dispatches,
        receivables,
        atRiskOrders: atRiskOrders.map((o) => ({
          salesOrderId: o.id,
          salesOrderNo: o.salesOrderNo,
          customerName: customerName(o.customerId),
          reason: o.riskReason,
          severity: o.severity,
        })),
        resolveCustomerName: customerName,
      }),
    [crmFeed, salesOrders, invoices, dispatches, receivables, atRiskOrders, customerName],
  )

  const liveActivityEvents = useMemo(
    (): LiveActivityEvent[] =>
      managementFeed
        .filter((i) => ['order', 'billing', 'activity'].includes(i.category))
        .slice(0, 8)
        .map(feedItemToLiveActivity),
    [managementFeed],
  )

  const handleLiveActivityClick = (ev: LiveActivityEvent) => {
    if (ev.quickView) dashboardNav.openQuickView(ev.quickView, ev.href)
    else if (ev.href) navigate(ev.href)
  }

  const handleLiveAlertClick = (alert: LiveAlert) => {
    if (alert.quickView) dashboardNav.openQuickView(alert.quickView, alert.href)
    else if (alert.href) navigate(alert.href)
  }

  const nextActions = useMemo(
    () => [
      ...(metrics.wonDealsWithoutSo > 0
        ? [{ id: 'won-so', label: `${metrics.wonDealsWithoutSo} won deal(s) need SO`, href: '/crm/opportunities?status=won', priority: 'primary' as const }]
        : []),
      ...(m.ordersPendingMrp > 0
        ? [{ id: 'mrp', label: 'Run MRP for pending orders', href: '/mrp/run', priority: metrics.wonDealsWithoutSo > 0 ? undefined : ('primary' as const) }]
        : [{ id: 'orders', label: 'Sales Orders', href: '/sales/orders', priority: 'primary' as const }]),
      ...(metrics.overdueReceivables > 0
        ? [{ id: 'ar', label: `${metrics.overdueReceivables} overdue invoice(s)`, href: '/invoices/register' }]
        : []),
      ...(metrics.quotationsPending > 0
        ? [{ id: 'quotes', label: 'Review quotation approvals', href: '/crm/quotations?status=pending_approval' }]
        : []),
      { id: 'status', label: 'Order Status', href: '/sales/order-status' },
      { id: 'crm', label: 'CRM Pipeline', href: '/crm' },
    ],
    [m.ordersPendingMrp, metrics],
  )

  const subtitle =
    viewMode === 'overview'
      ? 'Full commercial view — pipeline, execution, billing & collections'
      : viewMode === 'pipeline'
        ? 'Leads · opportunities · quotations · order handover'
        : viewMode === 'execution'
          ? 'Order book · MRP · production · dispatch · delivery risk'
          : 'Invoicing · receivables · proforma · collection performance'

  const showPipeline = viewMode === 'overview' || viewMode === 'pipeline'
  const showExecution = viewMode === 'overview' || viewMode === 'execution'
  const showBilling = viewMode === 'overview' || viewMode === 'billing'

  return (
    <>
    <DynamicsModuleDashboard
      variant="fiori"
      breadcrumb={[
        { label: 'Home', href: '/home' },
        { label: 'Sales', href: '/sales' },
        { label: 'Management Dashboard' },
      ]}
      title="Sales Management Dashboard"
      subtitle={subtitle}
      badge="Sales"
      favoritePath="/sales"
      showFactoryLive={false}
      heroLayout="uniform"
      healthScore={healthScore}
      healthLabel="Sales health"
      healthSublabel="Pipeline · delivery · collections"
      kpiColumns={5}
      heroMetrics={[
        {
          id: 'pipeline',
          label: 'Pipeline Value',
          value: formatSalesCurrency(metrics.pipelineValue),
          helper: `${metrics.openOpportunities} open opportunities`,
          icon: TrendingUp,
          accent: 'green',
          href: '/crm/opportunities',
        },
        {
          id: 'forecast',
          label: 'Weighted Forecast',
          value: formatSalesCurrency(metrics.weightedForecast),
          helper: 'Probability-adjusted',
          icon: Target,
          accent: 'blue',
          href: '/crm/forecast',
        },
        {
          id: 'orderbook',
          label: 'Order Book Value',
          value: formatMetricCurrency(m.salesOrderValue),
          helper: `${metrics.openOrders} active SOs`,
          icon: ShoppingCart,
          accent: 'indigo',
          href: '/sales/orders',
        },
        {
          id: 'receivable',
          label: 'Receivables',
          value: formatSalesCurrency(metrics.totalReceivable),
          helper: metrics.overdueReceivables > 0 ? `${metrics.overdueReceivables} overdue` : `${metrics.collectionRate}% collected`,
          icon: IndianRupee,
          accent: metrics.overdueReceivables > 0 ? 'amber' : 'green',
          href: '/invoices/register',
        },
        {
          id: 'dispatch',
          label: 'Dispatch Ready',
          value: m.dispatchReadyOrders,
          helper: `${m.ordersInProduction} in production`,
          icon: Truck,
          accent: 'indigo',
          href: '/dispatch/register',
        },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      emptyState={
        liveAlerts.length === 0 && m.openOrders === 0 && metrics.openOpportunities === 0 ? (
          <SmartEmptyState
            icon={CheckCircle2}
            title="No active sales pipeline or orders"
            insight="Start with CRM leads or create a sales order directly."
            healthNote="Commercial + execution visibility"
          />
        ) : undefined
      }
      liveSections={
        <LiveWorkspaceSections
          needsAttention={liveAlerts}
          recentlyUpdated={liveActivityEvents.length > 0 ? liveActivityEvents : commercialActivity}
          nextActions={nextActions}
          onAlertClick={handleLiveAlertClick}
          onActivityClick={handleLiveActivityClick}
        />
      }
      quickActions={
        <FioriToolbarShell
          tabs={
            <FioriSegmentedView<SalesDashboardView>
              tabs={VIEW_MODES.map((mode) => ({
                id: mode,
                label: SALES_VIEW_LABELS[mode],
                icon:
                  mode === 'overview'
                    ? LayoutGrid
                    : mode === 'pipeline'
                      ? GitBranch
                      : mode === 'execution'
                        ? Truck
                        : Receipt,
              }))}
              value={viewMode}
              onChange={setViewMode}
              ariaLabel="Sales dashboard view"
            />
          }
          actions={
            <>
              <DynamicsCommandButton primary icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/sales/orders/new')}>
                New Sales Order
              </DynamicsCommandButton>
              <DynamicsCommandButton icon={<GitBranch className="h-4 w-4" />} onClick={() => navigate('/crm')}>
                CRM Pipeline
              </DynamicsCommandButton>
              <DynamicsCommandButton icon={<BarChart3 className="h-4 w-4" />} onClick={() => navigate('/sales/reports')}>
                Reports
              </DynamicsCommandButton>
              <DynamicsCommandButton icon={<Gauge className="h-4 w-4" />} onClick={() => navigate('/mrp/run')}>
                Run MRP
              </DynamicsCommandButton>
              <DynamicsCommandButton icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/sales/order-status')}>
                Order Status
              </DynamicsCommandButton>
            </>
          }
        />
      }
      kpiStrip={[
        {
          id: 'leads',
          label: 'Active Leads',
          value: metrics.activeLeads,
          icon: KPI_ICON_PRESETS.open,
          accent: 'blue',
          context: 'CRM funnel',
          href: '/crm/leads',
          updatedAt: Date.now(),
        },
        {
          id: 'quotes',
          label: 'Quotes Pending',
          value: metrics.quotationsPending,
          icon: FileText,
          accent: metrics.quotationsPending ? 'amber' : 'green',
          context: metrics.approvedQuotesNotConverted ? `${metrics.approvedQuotesNotConverted} approved — no SO` : 'Approval queue',
          href: '/crm/quotations',
          updatedAt: Date.now(),
        },
        {
          id: 'at-risk',
          label: 'At-Risk Orders',
          value: atRiskOrders.length,
          icon: AlertTriangle,
          accent: atRiskOrders.length ? 'red' : 'green',
          context: atRiskOrders.length ? `${overdueDeliveries} overdue` : 'On track',
          href: '/sales/order-status',
          updatedAt: Date.now(),
        },
        {
          id: 'mrp',
          label: 'Pending MRP',
          value: m.ordersPendingMrp,
          icon: Gauge,
          accent: m.ordersPendingMrp ? 'amber' : 'green',
          context: m.ordersPendingMrp ? 'WO not created' : 'All planned',
          href: '/mrp/run',
          updatedAt: Date.now(),
        },
        {
          id: 'invoiced',
          label: 'Invoiced',
          value: m.invoicedOrders,
          icon: Receipt,
          accent: 'green',
          context: formatSalesCurrency(metrics.totalInvoiced),
          href: '/invoices/register',
          updatedAt: Date.now(),
        },
      ]}
    >
      <div className="sales-dashboard-zones">
        <DashboardManagementFeed
          items={managementFeed}
          title="Activity stream"
          subtitle="Pipeline, orders, billing & alerts — select any item for details"
          navigation={dashboardNav}
        />

        {(viewMode === 'overview') && <SalesCommercialKpiStrip metrics={metrics} />}

        {showPipeline && (
          <>
            <section className="sales-zone" aria-label="Commercial pipeline">
              <h2 className="sales-zone-title">Commercial pipeline</h2>
              <DynamicsDashboardGrid>
                <SalesPipelineHandoverPanel metrics={metrics} lookup={lookup} />
                <SalesCommercialFunnelChart funnel={metrics.commercialFunnel} />
              </DynamicsDashboardGrid>
              <DynamicsDashboardGrid>
                <SalesQuotationApprovalsPanel
                  documents={metrics.pendingApprovalDocs}
                  customers={customers}
                  opportunities={opportunities}
                />
                <SalesCustomerOrderBookChart topCustomers={metrics.topCustomers} />
              </DynamicsDashboardGrid>
            </section>
          </>
        )}

        {showExecution && (
          <>
            <section className="sales-zone" aria-label="Order execution">
              <h2 className="sales-zone-title">Order execution</h2>
              <SalesExecutionPipelineBoard
                salesOrders={salesOrders}
                workOrders={workOrders}
                inspections={inspections}
              />
              <DynamicsDashboardGrid>
                <SalesOrderStatusChart salesOrders={salesOrders} />
                <SalesDeliveryCommitmentChart salesOrders={salesOrders} />
                <SalesBookingTrendChart salesOrders={salesOrders} />
              </DynamicsDashboardGrid>
            </section>

            <section className="sales-zone" aria-label="Execution action zone">
              <h2 className="sales-zone-title">Execution actions</h2>
              <DynamicsDashboardGrid>
                <DynamicsDashboardPanel
                  title="Pending MRP"
                  actions={
                    <span className="dyn-entity-list-meta">
                      {pendingMrp.length ? `${pendingMrp.length} need planning` : 'All confirmed orders planned'}
                    </span>
                  }
                  noPadding
                >
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>SO No</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Delivery</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMrp.slice(0, 6).map((so) => (
                        <tr key={so.id}>
                          <td><TableLink to={`/sales/orders/${so.id}`}>{so.salesOrderNo}</TableLink></td>
                          <td>{customerName(so.customerId)}</td>
                          <td>{productName(so.productId)}</td>
                          <td>{formatDate(so.requiredDate)}</td>
                          <td className="num">{so.grandTotal != null ? formatCurrency(so.grandTotal) : '—'}</td>
                        </tr>
                      ))}
                      {pendingMrp.length === 0 && (
                        <tr><td colSpan={5} className="dyn-empty-hint">No confirmed orders waiting for MRP</td></tr>
                      )}
                    </tbody>
                  </table>
                </DynamicsDashboardPanel>

                <DynamicsDashboardPanel
                  title="Orders at risk"
                  actions={
                    atRiskOrders.length > 0 ? (
                      <span className="dyn-entity-list-meta sales-at-risk-badge">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        {atRiskOrders.length} flagged
                      </span>
                    ) : (
                      <span className="dyn-entity-list-meta">Delivery &amp; execution heatmap</span>
                    )
                  }
                  noPadding
                >
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>SO No</th>
                        <th>Customer</th>
                        <th>Delivery</th>
                        <th>Risk</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRiskOrders.slice(0, 6).map((row) => (
                        <tr
                          key={row.id}
                          className={row.severity === 'critical' ? 'sales-risk-row-critical' : row.severity === 'high' ? 'sales-risk-row-high' : undefined}
                        >
                          <td><TableLink to={`/sales/orders/${row.id}`}>{row.salesOrderNo}</TableLink></td>
                          <td>{customerName(row.customerId)}</td>
                          <td>{formatDate(row.requiredDate)}</td>
                          <td><span className={`sales-risk-pill sales-risk-pill-${row.severity}`}>{row.riskReason}</span></td>
                          <td><StatusDot label={row.status} tone={statusToneFromLabel(row.status)} /></td>
                        </tr>
                      ))}
                      {atRiskOrders.length === 0 && (
                        <tr><td colSpan={5} className="dyn-empty-hint">No delivery or execution risks on active orders</td></tr>
                      )}
                    </tbody>
                  </table>
                </DynamicsDashboardPanel>
              </DynamicsDashboardGrid>
            </section>
          </>
        )}

        {showBilling && (
          <section className="sales-zone" aria-label="Billing and collections">
            <h2 className="sales-zone-title">Billing &amp; collections</h2>
            <DynamicsDashboardGrid>
              <SalesBillingSummaryPanel metrics={metrics} />
              <SalesReceivablesPanel receivables={metrics.topReceivables} />
            </DynamicsDashboardGrid>
          </section>
        )}

        {(viewMode === 'overview' || viewMode === 'pipeline') && (
          <section className="sales-zone" aria-label="Sales intelligence">
            <h2 className="sales-zone-title">Sales intelligence</h2>
            <DynamicsDashboardGrid>
              <SalesOwnerOrderBookChart topOwners={metrics.topOwners} />
              <SalesOwnerPerformancePanel owners={metrics.topOwners} />
              <SalesTopCustomersPanel customers={metrics.topCustomers} />
            </DynamicsDashboardGrid>
          </section>
        )}

        {viewMode === 'overview' && (
          <DynamicsDashboardPanel
            title="Recent sales orders"
            actions={<span className="dyn-entity-list-meta">Latest commercial documents</span>}
            noPadding
          >
            <table className="erp-table">
              <thead>
                <tr>
                  <th>SO No</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Owner</th>
                  <th>Qty</th>
                  <th>Delivery</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((so) => (
                  <tr key={so.id}>
                    <td><TableLink to={`/sales/orders/${so.id}`}>{so.salesOrderNo}</TableLink></td>
                    <td>{customerName(so.customerId)}</td>
                    <td>{productName(so.productId)}</td>
                    <td>{so.salesOwnerName ?? '—'}</td>
                    <td className="num">{so.qty}</td>
                    <td>{formatDate(so.requiredDate)}</td>
                    <td className="num">{so.grandTotal != null ? formatCurrency(so.grandTotal) : '—'}</td>
                    <td><StatusDot label={so.status === 'open' ? 'Draft SO' : so.status} tone={statusToneFromLabel(so.status)} /></td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr><td colSpan={8} className="dyn-empty-hint">No sales orders yet</td></tr>
                )}
              </tbody>
            </table>
          </DynamicsDashboardPanel>
        )}
      </div>
    </DynamicsModuleDashboard>
    <DashboardQuickViewDrawer
      open={!!dashboardNav.quickView}
      view={dashboardNav.quickView}
      fallbackHref={dashboardNav.quickViewHref}
      onClose={dashboardNav.closeQuickView}
    />
    </>
  )
}
