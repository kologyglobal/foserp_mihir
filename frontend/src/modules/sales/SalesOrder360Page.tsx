import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Play,
  CheckCircle,
  FileText,
  Factory,
  Truck,
  ExternalLink,
  Pencil,
  Receipt,
  LayoutGrid,
  Banknote,
} from 'lucide-react'
import { Entity360Panel } from '../../components/design-system/Entity360Shell'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import {
  ENTERPRISE_FORM_DETAIL_CLASS,
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { SalesCardFormShell } from './SalesCardFormShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { TableLink } from '../../components/ui/AppLink'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { salesOrderStatusLabel } from '../../utils/salesOrderStatus'
import { Toast } from '../../components/ui/Toast'
import { useMrpStore } from '../../store/mrpStore'
import { useSalesStore } from '../../store/salesStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useDispatchStore } from '../../store/dispatchStore'
import { useQualityStore } from '../../store/qualityStore'
import { useMasterStore } from '../../store/masterStore'
import { useCrmStore } from '../../store/crmStore'
import { resolveCompany360Path } from '../../config/entity360Routes'
import { crmQuotationPath } from '../../utils/crmQuotationNavigation'
import {
  CRM_SALES_ORDERS_PATH,
  buildSalesOrderEditUrl,
  resolveSalesOrderDetailPath,
} from '../../utils/crmSalesOrderNavigation'
import { formatNumber, formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { salesBreadcrumbs } from '../../utils/salesNavigation'
import {
  EnterpriseNumericCell,
  entNumericMeta,
} from '../../design-system/enterprise'
import { computeSoHealth } from '../../utils/liveErpMetrics'
import {
  OrderHeroCard,
  OrderFulfillmentStepper,
  OrderCommercialSummary,
  OrderNextActionPanel,
  OrderExecutionTiles,
  OrderLinkageStrip,
  OrderDeliveryCard,
  OrderLineItemsPanel,
  buildSalesOrderHealthFactors,
  resolveSalesOrderValue,
} from '../../components/sales/SalesOrder360Sections'
import type { WorkOrder } from '../../types/workorder'
import type { DispatchPlan } from '../../types/dispatch'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { buildProformaNewUrl } from '../../utils/proformaInvoicePrefill'
import { ReservationsPanel } from '../../components/inventory/ReservationsPanel'

type SoTab = 'overview' | 'production' | 'dispatch' | 'commercial'

function healthScore(so: ReturnType<ReturnType<typeof useMrpStore.getState>['getSalesOrder']>): number {
  if (!so) return 0
  const h = computeSoHealth(so)
  if (h === 'healthy') return 88
  if (h === 'at_risk') return 42
  return 65
}

export function SalesOrder360Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const crmMode = pathname.startsWith('/crm/sales-orders')
  const listPath = crmMode ? CRM_SALES_ORDERS_PATH : '/sales/orders'
  const detailPath = id ? resolveSalesOrderDetailPath(id, crmMode) : listPath
  const editPath = id ? buildSalesOrderEditUrl(id, { fromCrm: crmMode }) : listPath
  const so = useMrpStore((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))
  const confirmSalesOrder = useSalesStore((s) => s.confirmSalesOrder)
  const triggerProductionForOrder = useSalesStore((s) => s.triggerProductionForOrder)
  const getQuotation = useSalesStore((s) => s.getQuotation)
  const getLatestQuotationDocument = useCrmStore((s) => s.getLatestQuotationDocument)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const proformaInvoices = useProformaInvoiceStore((s) => s.proformaInvoices)
  const linkedProformas = useMemo(
    () => (id ? proformaInvoices.filter((p) => p.salesOrderId === id) : []),
    [proformaInvoices, id],
  )
  const activeProforma = linkedProformas.find((p) => p.status !== 'cancelled')

  const [tab, setTab] = useState<SoTab>('overview')
  const [activeSection, setActiveSection] = useState<SoTab>('overview')
  const [toast, setToast] = useState<string | null>(null)

  const customer = so ? customers.find((c) => c.id === so.customerId) : undefined
  const product = so ? products.find((p) => p.id === so.productId) : undefined
  const quo = so?.quotationId ? getQuotation(so.quotationId) : undefined
  const crmDoc = so?.quotationId ? getLatestQuotationDocument(so.quotationId) : undefined

  const orderWos = useMemo(
    () => (id ? workOrders.filter((w) => w.salesOrderId === id) : []),
    [workOrders, id],
  )
  const orderDispatches = useMemo(
    () => (id ? dispatches.filter((d) => d.salesOrderId === id) : []),
    [dispatches, id],
  )

  const qcHold = useMemo(() => {
    if (!id) return false
    const woIds = orderWos.map((w) => w.id)
    return inspections.some((i) => i.workOrderId != null && woIds.includes(i.workOrderId) && i.status === 'pending')
  }, [id, orderWos, inspections])

  const pendingMrp = Boolean(so?.status === 'confirmed' && orderWos.length === 0)
  const score = so ? healthScore(so) : 0
  const displayValue = so ? resolveSalesOrderValue(so, product) : 0

  const overdue = Boolean(
    so &&
      so.requiredDate &&
      so.requiredDate.slice(0, 10) < new Date().toISOString().slice(0, 10) &&
      !['dispatched', 'closed', 'invoiced'].includes(so.status),
  )

  const woColumns = useMemo<ColumnDef<WorkOrder, unknown>[]>(
    () => [
      {
        accessorKey: 'woNo',
        header: 'WO No',
        meta: { columnLabel: 'WO No' },
        cell: ({ row }) => (
          <TableLink to={`/work-orders/${row.original.id}/360`}>{row.original.woNo}</TableLink>
        ),
      },
      { accessorKey: 'outputItemCode', header: 'Item', meta: { columnLabel: 'Item' } },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>
        ),
      },
      { accessorKey: 'qty', header: 'Qty', meta: entNumericMeta('Qty'), cell: ({ row }) => <EnterpriseNumericCell value={row.original.qty} /> },
      {
        accessorKey: 'plannedFinishDate',
        header: 'Due',
        cell: ({ row }) => formatDate(row.original.plannedFinishDate),
      },
    ],
    [],
  )

  const dispatchColumns = useMemo<ColumnDef<DispatchPlan, unknown>[]>(
    () => [
      {
        accessorKey: 'dispatchNo',
        header: 'Dispatch',
        cell: ({ row }) => (
          <TableLink to={`/dispatch/plans/${row.original.id}`}>{row.original.dispatchNo}</TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>
        ),
      },
      {
        accessorKey: 'plannedDate',
        header: 'Planned',
        cell: ({ row }) => formatDate(row.original.plannedDate),
      },
      {
        id: 'lines',
        header: 'Lines',
        meta: entNumericMeta('Lines'),
        cell: ({ row }) => <EnterpriseNumericCell value={row.original.lines.length} />,
      },
    ],
    [],
  )

  if (!id || !so) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Sales order not found.</p>
        <Link to={listPath} className="text-sm font-semibold text-erp-primary hover:underline">
          Back to {crmMode ? 'CRM sales orders' : 'sales orders'}
        </Link>
      </div>
    )
  }

  const order = so

  async function handleConfirm() {
    const { isApiMode } = await import('../../config/apiConfig')
    if (isApiMode()) {
      const { apiConfirmSalesOrder } = await import('../../services/bridges/salesOrderApiBridge')
      const r = await apiConfirmSalesOrder(order.id)
      setToast(r.ok ? 'Order confirmed' : r.error ?? 'Failed')
      return
    }
    const r = confirmSalesOrder(order.id)
    setToast(r.ok ? 'Order confirmed' : r.error ?? 'Failed')
  }

  function handleMrp() {
    const r = triggerProductionForOrder(order.id)
    if (r.ok) setToast(`MRP run ${r.runId} started`)
    else setToast(r.error ?? 'MRP failed')
  }

  function selectSection(sectionId: SoTab) {
    setActiveSection(sectionId)
    setTab(sectionId)
  }

  const sectionNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'production', label: 'Production', icon: Factory, done: orderWos.length > 0 },
    { id: 'dispatch', label: 'Dispatch', icon: Truck, done: orderDispatches.length > 0 },
    { id: 'commercial', label: 'Commercial', icon: Banknote },
  ]

  const healthFactors = buildSalesOrderHealthFactors({
    status: so.status,
    overdue,
    workOrderCount: orderWos.length,
    dispatchCount: orderDispatches.length,
    pendingMrp,
    qcHold,
  })

  const formMetrics = [
    { label: 'Order Value', value: displayValue > 0 ? formatCurrency(displayValue) : '—', accent: 'green' as const, hint: customer?.customerName ?? 'Customer' },
    { label: 'Quantity', value: formatNumber(so.qty), accent: 'blue' as const, hint: product?.productName ?? 'Product' },
    { label: 'Required', value: formatDate(so.requiredDate), accent: overdue ? 'amber' as const : 'blue' as const, hint: overdue ? 'Overdue' : 'On schedule' },
    { label: 'Work Orders', value: String(orderWos.length), accent: 'blue' as const, hint: `${orderDispatches.length} dispatch` },
  ]

  const documentStrip = [
    { label: 'SO No.', value: so.salesOrderNo, highlight: true },
    { label: 'Status', value: salesOrderStatusLabel(so.status) },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Product', value: product?.productName ?? '—' },
    { label: 'Qty', value: formatNumber(so.qty) },
    { label: 'Order Value', value: displayValue > 0 ? formatCurrency(displayValue) : '—', highlight: displayValue > 0 },
    { label: 'Required', value: formatDate(so.requiredDate) },
    { label: 'Work Orders', value: String(orderWos.length) },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        ...(so.status === 'open' ? [{ id: 'confirm', label: 'Confirm Order', icon: CheckCircle, primary: true, onClick: handleConfirm }] : []),
        ...(so.status === 'confirmed' ? [{ id: 'mrp', label: 'Trigger MRP', icon: Play, primary: true, onClick: handleMrp }] : []),
        ...(so.status === 'open' ? [{ id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(editPath) }] : []),
        ...(so.status !== 'open' && !activeProforma ? [{ id: 'proforma', label: 'Create Proforma', icon: Receipt, onClick: () => navigate(buildProformaNewUrl(so.id)) }] : []),
      ]}
      moreActions={[
        ...(activeProforma ? [{ id: 'view-proforma', label: `Proforma ${activeProforma.proformaNo}`, icon: Receipt, onClick: () => navigate(`/sales/proforma-invoices/${activeProforma.id}`) }] : []),
        ...(quo ? [{ id: 'quotation', label: 'Quotation', icon: FileText, onClick: () => navigate(crmQuotationPath(quo.id)) }] : []),
        ...(crmDoc ? [{ id: 'quote-360', label: 'CRM Quote 360', icon: ExternalLink, onClick: () => navigate(`/crm/quotations/${so.quotationId}`) }] : []),
        { id: 'production', label: 'Work Orders', icon: Factory, onClick: () => selectSection('production') },
        { id: 'dispatch', label: 'Dispatch', icon: Truck, onClick: () => selectSection('dispatch') },
        ...(customer ? [{ id: 'company', label: 'Company 360', icon: ExternalLink, onClick: () => navigate(resolveCompany360Path(customer.id, pathname)) }] : []),
      ]}
    />
  )

  const factBox = (
    <EnterpriseBusinessFactBox
      aiInsights={[
        {
          id: 'next',
          label: 'Suggested Next',
          value: so.status === 'open' ? 'Confirm order' : pendingMrp ? 'Trigger MRP' : overdue ? 'Expedite delivery' : 'Monitor production',
          tone: so.status === 'open' || pendingMrp || overdue ? 'warning' as const : 'info' as const,
        },
      ]}
    >
      <EnterpriseFormMetrics metrics={formMetrics} className="dyn-form-metrics--factbox" />
      <EnterpriseFormContextPanel
        summaryTitle="Order Summary"
        actionsTitle="Quick Actions"
        summary={[
          { label: 'Status', value: salesOrderStatusLabel(so.status) },
          { label: 'Customer', value: customer?.customerName ?? '—' },
          { label: 'Product', value: product?.productName ?? '—' },
          { label: 'Qty', value: formatNumber(so.qty) },
          { label: 'Value', value: displayValue > 0 ? formatCurrency(displayValue) : '—', highlight: true },
          { label: 'Work Orders', value: String(orderWos.length) },
          { label: 'Dispatches', value: String(orderDispatches.length) },
          { label: 'Quotation', value: so.quotationNo ? `${so.quotationNo} Rev ${so.quotationRevisionNo ?? 1}` : '—' },
        ]}
        actions={[
          ...(so.status === 'open' ? [{ id: 'confirm', label: 'Confirm Order', icon: CheckCircle, primary: true, onClick: handleConfirm }] : []),
          ...(so.status === 'confirmed' ? [{ id: 'mrp', label: 'Trigger MRP', icon: Play, primary: true, onClick: handleMrp }] : []),
          ...(so.status === 'open' ? [{ id: 'edit', label: 'Edit Draft', icon: Pencil, onClick: () => navigate(editPath) }] : []),
        ]}
      />
    </EnterpriseBusinessFactBox>
  )

  const breadcrumbs = crmMode
    ? [
        { label: 'Home', to: '/home' },
        { label: 'CRM', to: '/crm' },
        { label: 'Sales Orders', to: CRM_SALES_ORDERS_PATH },
        { label: so.salesOrderNo },
      ]
    : salesBreadcrumbs({ label: 'Sales Orders', to: '/sales/orders' }, { label: so.salesOrderNo })

  return (
    <>
      <SalesCardFormShell
        title={so.salesOrderNo}
        badge={crmMode ? 'CRM' : 'Sales'}
        className={ENTERPRISE_FORM_DETAIL_CLASS}
        recordNo={so.salesOrderNo}
        recordTitle={customer?.customerName ?? so.salesOrderNo}
        status={salesOrderStatusLabel(so.status)}
        statusTone={so.status === 'open' ? 'info' : score >= 70 ? 'success' : 'warning'}
        stage={product?.productName ?? 'Product'}
        createdDate={formatDate(so.orderDate ?? so.createdAt.slice(0, 10))}
        company={customer?.customerName}
        favoritePath={detailPath}
        breadcrumbs={breadcrumbs}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        collapsibleFactBox
        factBoxLabel="Details"
        stickyFooter={false}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={(id) => selectSection(id as SoTab)}
          trailing={<FactBoxPaneAiToggle />}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />
        {tab === 'overview' && (
          <div className="so-360-overview">
            <OrderHeroCard
              order={so}
              customer={customer}
              product={product}
              workOrderCount={orderWos.length}
              healthScore={score}
              healthFactors={healthFactors}
              onOpenCustomer={customer ? () => navigate(resolveCompany360Path(customer.id, pathname)) : undefined}
            />

            <OrderLinkageStrip order={so} onNavigate={navigate} />

            <OrderFulfillmentStepper
              status={so.status}
              onStepClick={(s) => {
                if (s === 'in_production') selectSection('production')
                else if (s === 'ready_dispatch' || s === 'dispatched') selectSection('dispatch')
              }}
            />

            <OrderExecutionTiles
              workOrderCount={orderWos.length}
              dispatchCount={orderDispatches.length}
              pendingMrp={pendingMrp}
              qcHold={qcHold}
              onOpenProduction={() => selectSection('production')}
              onOpenDispatch={() => selectSection('dispatch')}
              onTriggerMrp={so.status === 'confirmed' ? handleMrp : undefined}
            />

            <div className="so-360-overview-grid">
              <OrderCommercialSummary order={so} product={product} />
              <div className="so-360-overview-aside">
                <Entity360Panel title="Next best action" subtitle="Recommended from order state">
                  <div className="p-4">
                    <OrderNextActionPanel
                      status={so.status}
                      overdue={overdue}
                      onConfirm={so.status === 'open' ? handleConfirm : undefined}
                      onTriggerMrp={so.status === 'confirmed' ? handleMrp : undefined}
                    />
                  </div>
                </Entity360Panel>
                <OrderDeliveryCard order={so} />
              </div>
            </div>

            <OrderLineItemsPanel order={so} />

            <Entity360Panel title="Inventory reservations" subtitle={`Stock reserved against ${so.salesOrderNo}`}>
              <div className="p-4">
                <ReservationsPanel referenceNo={so.salesOrderNo} compact />
              </div>
            </Entity360Panel>

            {so.remarks ? (
              <Entity360Panel title="Order remarks" subtitle="Commercial and delivery notes">
                <p className="p-4 text-sm leading-relaxed text-erp-text whitespace-pre-wrap">{so.remarks}</p>
              </Entity360Panel>
            ) : null}

            {(so.commercialNotes || so.technicalNotes) && (
              <div className="so-360-notes-grid">
                {so.commercialNotes ? (
                  <Entity360Panel title="Commercial notes">
                    <p className="p-4 text-sm text-erp-text whitespace-pre-wrap">{so.commercialNotes}</p>
                  </Entity360Panel>
                ) : null}
                {so.technicalNotes ? (
                  <Entity360Panel title="Technical notes">
                    <p className="p-4 text-sm text-erp-text whitespace-pre-wrap">{so.technicalNotes}</p>
                  </Entity360Panel>
                ) : null}
              </div>
            )}
          </div>
        )}

        {tab === 'production' && (
          <Entity360Panel
            title="Work orders"
            subtitle={`${orderWos.length} manufacturing order${orderWos.length !== 1 ? 's' : ''} for ${so.salesOrderNo}`}
          >
            <div className="p-4">
              {orderWos.length === 0 ? (
                <div className="so-360-empty">
                  <Factory className="so-360-empty__icon" aria-hidden />
                  <p className="so-360-empty__title">No work orders yet</p>
                  <p className="so-360-empty__text">
                    {so.status === 'confirmed'
                      ? 'Trigger MRP to explode BOM and create shop-floor work orders.'
                      : 'Work orders appear after MRP planning for confirmed orders.'}
                  </p>
                  {so.status === 'confirmed' ? (
                    <button type="button" className="so-360-empty__action" onClick={handleMrp}>
                      Trigger MRP →
                    </button>
                  ) : null}
                </div>
              ) : (
                <DataGrid
                  data={orderWos}
                  columns={woColumns}
                  compact
                  toolbar="compact"
                  showToolbarExport
                  exportFileName={so.salesOrderNo}
                />
              )}
            </div>
          </Entity360Panel>
        )}

        {tab === 'dispatch' && (
          <Entity360Panel title="Dispatch plans" subtitle="Trailers scheduled for delivery">
            <div className="p-4">
              {orderDispatches.length === 0 ? (
                <div className="so-360-empty">
                  <Truck className="so-360-empty__icon" aria-hidden />
                  <p className="so-360-empty__title">No dispatch plans linked</p>
                  <p className="so-360-empty__text">
                    Create a dispatch plan when FG is ready and delivery is scheduled.
                  </p>
                  <button
                    type="button"
                    className="so-360-empty__action"
                    onClick={() => navigate('/dispatch/plan')}
                  >
                    Open dispatch planning →
                  </button>
                </div>
              ) : (
                <DataGrid
                  data={orderDispatches}
                  columns={dispatchColumns}
                  compact
                  toolbar="compact"
                  showToolbarExport
                  exportFileName={`${so.salesOrderNo}-dispatch`}
                />
              )}
            </div>
          </Entity360Panel>
        )}

        {tab === 'commercial' && (
          <div className="so-360-commercial-tab">
            <div className="so-360-commercial-tab__main">
              <OrderCommercialSummary order={so} product={product} />
              <OrderDeliveryCard order={so} />
              <OrderLineItemsPanel order={so} />
            </div>
            <Entity360Panel title="Source quotation" subtitle="Approved quote that created this order">
              <div className="p-4 text-[13px]">
                {quo ? (
                  <div className="space-y-3">
                    <p>
                      <TableLink to={crmQuotationPath(quo.id)}>{quo.quotationNo}</TableLink>
                      {' '}
                      · Rev {quo.revisionNo}
                    </p>
                    <p className="text-erp-muted">
                      Grand total {formatCurrency(quo.pricing.grandTotal)}
                    </p>
                    {crmDoc ? (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-erp-primary hover:underline"
                        onClick={() => navigate(`/crm/quotations/${quo.id}`)}
                      >
                        Open CRM Quote 360 →
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-erp-muted">
                    No linked quotation — order may have been created manually.
                  </p>
                )}
              </div>
            </Entity360Panel>
          </div>
        )}
      </SalesCardFormShell>
      {toast ? <Toast message={toast} variant="success" /> : null}
    </>
  )
}
