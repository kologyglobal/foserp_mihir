import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Calendar,
  Clock,
  Factory,
  FileText,
  LayoutDashboard,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Target,
  Truck,
  Wallet,
} from 'lucide-react'
import { Entity360Panel } from '../../components/design-system/Entity360Shell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Timeline } from '../../components/design-system/Timeline'
import { ActivityFeed } from '../../components/design-system/Timeline'
import { Customer360Hero } from '../../components/entity360/Customer360Hero'
import { DynamicsKpiRow, DynamicsKpiTile } from '../../components/dynamics/DynamicsKpiTile'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { ActiveBadge, StatusBadge, TypeBadge } from '../../components/ui/StatusBadge'
import { TableLink } from '../../components/ui/AppLink'
import { useCustomer360 } from '../../utils/entity360Metrics'
import { customer360HubPath, resolveCustomer360Path } from '../../config/entity360Routes'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { Button } from '../../components/ui/Button'
import { CustomerTrailerQrPanel } from '../../components/qr/CustomerTrailerQrPanel'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { useCrmContactsForCustomer, useCustomerContacts } from '../../hooks/useStableStoreData'
import { useCrmStore } from '../../store/crmStore'
import { LogActivityDrawer, QuickFollowUpDrawer } from '../../components/crm'
import { CrmUnifiedActivityFeed } from '../../components/crm/CrmUnifiedActivityFeed'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { customerCrmSummary, formatCrmCurrency } from '../../utils/crmMetrics'
import { resolveCrmCompanyStatus } from '../../utils/crmCompanyStatus'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { CompanyCustomerBadge } from '../../components/masters/CompanyCustomerBadge'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'
import { EntityNotesPanel } from '../../components/crm/shared/EntityNotesPanel'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { buildUnifiedFeed } from '../../utils/crmUnifiedFeed'
import type { CrmActivity, FollowUp } from '../../types/crm'
import { isApiMode } from '../../config/apiConfig'
import { useCompanyCommercialPosition } from '../../hooks/useCommercialPosition'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { canCrmPermission } from '../../utils/permissions/crm'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { resolveSalesOrderValue } from '../../components/sales/SalesOrder360Sections'
import { getSalesOrderFulfillmentLabel } from '../../utils/salesDashboardMetrics'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { CrmCardFormShell, ENTERPRISE_FORM_DETAIL_CLASS } from '@/components/crm/CrmCardFormShell'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import {
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { ErpCardSection } from '../../components/erp/card-form'
import {
  buildCompanyAiInsight,
  buildCompanyKeyDetails,
  buildCompanySmartSignals,
  companyOverviewChips,
  companyOverviewTitle,
  computeCompanyCompleteness,
  resolveCompanyNextBestAction,
} from '../../utils/companySmartOverview'
import type { SalesOrder } from '../../types/mrp'
import type { WorkOrder } from '../../types/workorder'
import type { DispatchPlan } from '../../types/dispatch'
import type { SalesInvoice } from '../../types/invoice'

type Tab = 'overview' | 'pipeline' | 'crm' | 'sales' | 'production' | 'dispatch' | 'financial' | 'quality' | 'documents' | 'timeline'

export function Customer360Page() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const data = useCustomer360(id)
  const companyCommercial = useCompanyCommercialPosition(id)
  const fromSales = pathname.startsWith('/sales/customers')
  const fromCrm = pathname.startsWith('/entity360/customers')
  const hubPath = customer360HubPath(pathname)
  const favoritePath = id ? resolveCustomer360Path(pathname, id) : hubPath
  const backLabel = fromCrm
    ? 'Back to Companies'
    : fromSales
      ? COMPANY_TERMINOLOGY.backTo360
      : COMPANY_TERMINOLOGY.backToMaster
  useQuickCreate()
  const customerContacts = useCustomerContacts(id)
  const crmContacts = useCrmContactsForCustomer(id)
  const crmOpportunities = useCrmStore((s) => s.opportunities)
  const products = useMasterStore((s) => s.products)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const crmFollowUps = useCrmStore((s) => s.followUps)
  const crmActivities = useCrmStore((s) => s.activities)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const deleteFollowUp = useCrmStore((s) => s.deleteFollowUp)
  const crmSummary = useMemo(
    () => (id ? customerCrmSummary(id, crmOpportunities, crmFollowUps, crmActivities) : null),
    [id, crmOpportunities, crmFollowUps, crmActivities],
  )
  const [tab, setTab] = useState<Tab>('overview')
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)
  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<FollowUp | null>(null)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [pendingFollowUpId, setPendingFollowUpId] = useState<string | null>(null)
  const canAddActivity = canCrmPermission('crm.activity.create')
  const canAddFollowUp = canCrmPermission('crm.follow_up.create')
  const canEditActivity = canCrmPermission('crm.activity.update')
  const canDeleteActivity = canCrmPermission('crm.activity.delete')
  const canEditFollowUp = canCrmPermission('crm.follow_up.update')
  const canDeleteFollowUp = canCrmPermission('crm.follow_up.delete')
  const customerCrmOpps = useMemo(() => crmOpportunities.filter((o) => o.customerId === id), [crmOpportunities, id])
  const crmCustomerActivities = useMemo(
    () => crmActivities.filter((a) => a.customerId === id).sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
    [crmActivities, id],
  )
  const crmCustomerFollowUps = useMemo(
    () => crmFollowUps.filter((f) => f.customerId === id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [crmFollowUps, id],
  )
  const nextCrmFollowUp = useMemo(
    () => crmCustomerFollowUps.find((f) => f.status === 'pending' || f.status === 'overdue') ?? null,
    [crmCustomerFollowUps],
  )
  const unifiedFeedItems = useMemo(
    () => buildUnifiedFeed({
      activities: crmCustomerActivities,
      followUps: crmCustomerFollowUps,
      notes: [],
      systemEvents: [],
    }),
    [crmCustomerActivities, crmCustomerFollowUps],
  )
  const crmQuotationDocs = useCrmStore((s) => s.quotationDocuments)
  const customerCrmDocs = useMemo(() => {
    if (!data) return []
    const quoIds = new Set(data.customerQuotations.map((q) => q.id))
    return crmQuotationDocs.filter((d) => quoIds.has(d.quotationId))
  }, [crmQuotationDocs, data])

  const crmQuotationPath = (quotationId: string | null | undefined) => {
    if (!quotationId) return null
    const doc = crmQuotationDocs.find((d) => d.quotationId === quotationId)
    return doc ? `/crm/quotations/${doc.id}` : '/crm/quotations'
  }

  const companyStatus = useMemo(() => {
    if (!id || !data || !crmSummary) return undefined
    const outstandingAr =
      isApiMode() && companyCommercial.data?.money
        ? companyCommercial.data.money.outstandingAmount
        : data.outstanding
    return resolveCrmCompanyStatus({
      customerId: id,
      opportunities: crmOpportunities,
      followUps: crmFollowUps,
      activities: crmActivities,
      quotationDocuments: crmQuotationDocs,
      outstandingAr,
      openOpportunities: crmSummary.openOpportunities,
      pipelineValue: crmSummary.pipelineValue,
      wonOpportunities: crmSummary.wonOpportunities,
      openSalesOrders: data.openSo.length,
      createdAt: data.customer.createdAt,
    })
  }, [id, data, crmSummary, crmOpportunities, crmFollowUps, crmActivities, crmQuotationDocs, companyCommercial.data])

  const sectionNavItems = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'crm', label: 'CRM', icon: Activity },
      { id: 'pipeline', label: 'Pipeline', icon: Target },
      { id: 'sales', label: 'Sales Orders', icon: ShoppingCart },
      { id: 'production', label: 'Production', icon: Factory },
      { id: 'dispatch', label: 'Dispatch', icon: Truck },
      { id: 'financial', label: 'Finance', icon: Wallet },
      { id: 'quality', label: 'Quality', icon: ShieldCheck },
      { id: 'documents', label: 'Documents', icon: FileText, done: (data?.documents.length ?? 0) > 0 },
      { id: 'timeline', label: 'Timeline', icon: Clock },
    ],
    [data?.documents.length],
  )

  const salesOrderColumns = useMemo<ColumnDef<SalesOrder, unknown>[]>(
    () => [
      {
        accessorKey: 'salesOrderNo',
        header: 'SO',
        cell: ({ row }) => (
          <TableLink to={`/sales/orders/${row.original.id}/360`}>{row.original.salesOrderNo}</TableLink>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }) => (row.original.source === 'direct' ? 'Direct' : 'Quotation'),
      },
      {
        id: 'quotation',
        header: 'Quotation',
        cell: ({ row }) => {
          if (!row.original.quotationNo) return '—'
          const path = crmQuotationPath(row.original.quotationId)
          return path ? <TableLink to={path}>{row.original.quotationNo}</TableLink> : row.original.quotationNo
        },
      },
      {
        id: 'opportunity',
        header: 'Opportunity',
        cell: ({ row }) => {
          const opp = crmOpportunities.find((o) => o.id === row.original.opportunityId)
          return opp ? <TableLink to={`/crm/opportunities/${opp.id}`}>{opp.opportunityNo}</TableLink> : '—'
        },
      },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row }) =>
          formatCurrency(resolveSalesOrderValue(row.original, products.find((p) => p.id === row.original.productId))),
      },
      {
        id: 'fulfillment',
        header: 'Fulfillment',
        cell: ({ row }) => getSalesOrderFulfillmentLabel(row.original, workOrders),
      },
      { accessorKey: 'qty', header: 'Qty' },
      { accessorKey: 'requiredDate', header: 'Required', cell: ({ row }) => formatDate(row.original.requiredDate) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [crmOpportunities, products, workOrders, crmQuotationDocs],
  )

  const soColumns = useMemo<ColumnDef<SalesOrder, unknown>[]>(
    () => [
      { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <TableLink to={`/sales/orders/${row.original.id}`}>{row.original.salesOrderNo}</TableLink> },
      { accessorKey: 'qty', header: 'Qty' },
      { accessorKey: 'requiredDate', header: 'Required', cell: ({ row }) => formatDate(row.original.requiredDate) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  )

  const woColumns = useMemo<ColumnDef<WorkOrder, unknown>[]>(
    () => [
      { accessorKey: 'woNo', header: 'WO', cell: ({ row }) => <TableLink to={`/work-orders/${row.original.id}`}>{row.original.woNo}</TableLink> },
      { accessorKey: 'qty', header: 'Qty' },
      { accessorKey: 'status', header: 'Stage', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'wo360', header: '', cell: ({ row }) => <TableLink to={`/work-orders/${row.original.id}/360`}>WO 360</TableLink> },
    ],
    [],
  )

  const dispatchColumns = useMemo<ColumnDef<DispatchPlan, unknown>[]>(
    () => [
      { accessorKey: 'dispatchNo', header: 'Dispatch', cell: ({ row }) => <TableLink to={`/dispatch/${row.original.id}`}>{row.original.dispatchNo}</TableLink> },
      { accessorKey: 'plannedDate', header: 'Planned', cell: ({ row }) => formatDate(row.original.plannedDate) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  )

  const invoiceColumns = useMemo<ColumnDef<SalesInvoice, unknown>[]>(
    () => [
      { accessorKey: 'invoiceNo', header: 'Invoice', cell: ({ row }) => <TableLink to={`/invoices/${row.original.id}`}>{row.original.invoiceNo}</TableLink> },
      { accessorKey: 'gst.grandTotal', header: 'Total', cell: ({ row }) => formatCurrency(row.original.gst.grandTotal) },
      { accessorKey: 'balanceDue', header: 'Balance', cell: ({ row }) => formatCurrency(row.original.balanceDue) },
      { accessorKey: 'paymentStatus', header: 'Payment', cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
    ],
    [],
  )

  if (!data) {
    return (
      <div className="customer-360-empty erp-page flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <div className="customer-360-empty__icon">
          <Target className="h-8 w-8 text-erp-primary" />
        </div>
        <h1 className="text-lg font-semibold text-erp-text">{COMPANY_TERMINOLOGY.notFound}</h1>
        <p className="mt-1 max-w-md text-sm text-erp-muted">
          {id ? `No company record for "${id}". It may have been removed or the link is incorrect.` : 'Select a company from the register.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to={hubPath}>
            <ErpButton variant="primary" icon={ArrowLeft}>{backLabel}</ErpButton>
          </Link>
          <Link to="/crm/customers">
            <ErpButton variant="secondary">CRM Companies</ErpButton>
          </Link>
          {!fromSales && (
            <Link to="/masters/companies">
              <ErpButton variant="ghost">Company Master</ErpButton>
            </Link>
          )}
        </div>
      </div>
    )
  }

  const { customer } = data
  const apiFinance = isApiMode() ? companyCommercial.data?.money : null
  const financeOutstanding = apiFinance?.outstandingAmount ?? data.outstanding
  const financeInvoiced = apiFinance?.invoicedAmount ?? data.invoiceValue
  const financeCollected = apiFinance?.collectedAmount ?? data.received
  const financeOrdered = apiFinance?.orderedAmount ?? data.revenue
  const financeDispatched = apiFinance?.dispatchedAmount ?? 0
  const financeMoneyVisible = isApiMode() ? companyCommercial.data?.moneyVisible ?? false : true

  const breadcrumbs = fromCrm
    ? [
        { label: 'CRM', to: '/crm' },
        { label: 'Companies', to: '/crm/customers' },
        { label: customer.customerName },
      ]
    : fromSales
      ? [
          { label: 'Sales', to: '/sales' },
          { label: 'Customers', to: hubPath },
          { label: customer.customerName },
        ]
      : [
          { label: 'Masters', to: '/masters' },
          { label: 'Companies', to: '/masters/companies' },
          { label: customer.customerName },
        ]

  const metrics = [
    {
      label: 'Open Orders',
      value: String(data.openSo.length),
      accent: 'blue' as const,
      hint: 'Active sales orders',
    },
    {
      label: 'Order Value',
      value: formatCurrency(financeOrdered),
      accent: 'green' as const,
      hint: 'Lifetime booked',
    },
    {
      label: 'Outstanding AR',
      value: financeMoneyVisible ? formatCurrency(financeOutstanding) : '—',
      accent: financeOutstanding > 0 ? ('amber' as const) : ('green' as const),
      hint: financeMoneyVisible
        ? financeOutstanding > 0
          ? 'Receivables due'
          : 'Fully collected'
        : 'Requires finance AR view',
    },
    {
      label: 'Dispatch Pending',
      value: String(data.pendingDispatch.length),
      accent: 'blue' as const,
      hint: 'Awaiting delivery',
    },
    {
      label: 'Active WO',
      value: String(data.activeWo.length),
      accent: 'violet' as const,
      hint: 'In production',
    },
    {
      label: 'Open Pipeline',
      value: formatCrmCurrency(crmSummary?.pipelineValue ?? 0),
      accent: 'blue' as const,
      hint: `${crmSummary?.openOpportunities ?? 0} opportunities`,
    },
  ]

  const heroStats = [
    {
      label: 'Open SO',
      value: String(data.openSo.length),
    },
    {
      label: 'Pipeline',
      value: formatCrmCurrency(crmSummary?.pipelineValue ?? 0),
    },
    {
      label: 'Outstanding',
      value: financeMoneyVisible ? formatCurrency(financeOutstanding) : '—',
      tone: financeOutstanding > 0 ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Contacts',
      value: String(crmContacts.length),
    },
  ]

  const documentStrip = [
    { label: 'Code', value: customer.customerCode, highlight: true },
    { label: 'City', value: customer.city ?? '—' },
    { label: 'Territory', value: customer.salesTerritory ?? '—' },
    { label: 'Type', value: customer.customerType ?? '—' },
    { label: 'Contact', value: customer.contactPerson ?? '—' },
    { label: 'Open SO', value: String(data.openSo.length) },
    { label: 'Pipeline', value: formatCrmCurrency(crmSummary?.pipelineValue ?? 0) },
    { label: 'Outstanding', value: financeMoneyVisible ? formatCurrency(financeOutstanding) : '—', highlight: financeOutstanding > 0 },
  ]

  const statusTone = (() => {
    const tone = companyStatus?.tone
    if (tone === 'pending' || tone === 'live') return 'info' as const
    if (tone === 'critical') return 'warning' as const
    return tone ?? (customer.isActive ? 'success' : 'neutral')
  })()

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        {
          id: 'new-opp',
          label: 'New Opportunity',
          icon: Plus,
          onClick: () => navigate(`/crm/opportunities/new?customerId=${customer.id}`),
          primary: true,
        },
        {
          id: 'follow-up',
          label: 'Quick Follow-up',
          icon: Calendar,
          onClick: () => setFollowUpOpen(true),
        },
      ]}
      moreActions={[
        {
          id: 'edit',
          label: 'Edit Master',
          icon: Pencil,
          onClick: () => navigate(`/masters/companies/${customer.id}/edit`),
        },
        {
          id: 'quotation',
          label: 'Quotations',
          icon: FileText,
          onClick: () => navigate('/crm/quotations'),
        },
        {
          id: 'so',
          label: 'Sales Orders',
          icon: ShoppingCart,
          onClick: () => setTab('sales'),
        },
        {
          id: 'dispatch',
          label: 'Dispatch',
          icon: Truck,
          onClick: () => setTab('dispatch'),
        },
        {
          id: 'finance',
          label: 'Finance',
          icon: BarChart3,
          onClick: () => setTab('financial'),
        },
      ]}
    />
  )

  const companySmartInput = {
    customerName: customer.customerName,
    customerCode: customer.customerCode,
    customerType: customer.customerType,
    city: customer.city,
    state: customer.state,
    gstin: customer.gstin ?? '',
    salesTerritory: customer.salesTerritory ?? '',
    creditLimit: customer.creditLimit && customer.creditLimit > 0 ? customer.creditLimit : data.creditLimit,
    creditDays: customer.creditDays ?? 0,
    isActive: customer.isActive !== false,
    hasBillingAddress: Boolean(customer.addressLine1?.trim()),
  }
  const companyNextAction = resolveCompanyNextBestAction(companySmartInput)
  const hasPipeline = (crmSummary?.pipelineValue ?? 0) > 0
  const smartNextAction =
    companyNextAction.id !== 'review'
      ? companyNextAction
      : hasPipeline
        ? {
            id: 'follow_up',
            title: 'Keep the deal moving',
            description: 'Schedule a follow-up while pipeline is active on this account.',
            ctaLabel: 'Schedule Follow-up',
          }
        : {
            id: 'new_opp',
            title: 'Create opportunity',
            description: 'No open pipeline on this account. Start an opportunity to drive the next deal.',
            ctaLabel: 'New Opportunity',
          }

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart company overview"
      title={companyOverviewTitle(companySmartInput)}
      chips={companyOverviewChips(companySmartInput)}
      meta={[
        companyStatus?.label ?? (customer.isActive ? 'Active' : 'Inactive'),
        `Pipeline ${formatCrmCurrency(crmSummary?.pipelineValue ?? 0)}`,
      ]}
      progressLabel="Profile readiness"
      progressPercent={computeCompanyCompleteness(companySmartInput)}
      signals={buildCompanySmartSignals(companySmartInput)}
      nextAction={smartNextAction}
      onNextAction={() => {
        if (smartNextAction.id === 'new_opp') {
          navigate(`/crm/opportunities/new?customerId=${customer.id}`)
          return
        }
        if (smartNextAction.id === 'follow_up') {
          setFollowUpOpen(true)
          return
        }
        navigate(`/masters/companies/${customer.id}/edit`)
      }}
      quickActions={[
        { id: 'opp', label: 'Opportunity', icon: Plus, onClick: () => navigate(`/crm/opportunities/new?customerId=${customer.id}`) },
        { id: 'follow-up', label: 'Follow-up', icon: Calendar, onClick: () => setFollowUpOpen(true) },
        { id: 'crm', label: 'CRM', icon: Activity, onClick: () => setTab('crm') },
        { id: 'sales', label: 'Orders', icon: ShoppingCart, onClick: () => setTab('sales') },
      ]}
      keyDetails={buildCompanyKeyDetails(companySmartInput)}
      aiInsight={buildCompanyAiInsight(companySmartInput)}
      footer={(
        <div className="customer-360-activity">
          <p className="customer-360-activity__title">Recent activity</p>
          <ActivityFeed items={data.activity} />
        </div>
      )}
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={customer.customerName}
        description={`${customer.customerCode} · ${customer.city}${customer.salesTerritory ? ` · ${customer.salesTerritory}` : ''}`}
        badge={COMPANY_TERMINOLOGY.hub360}
        className={`${ENTERPRISE_FORM_DETAIL_CLASS} enterprise-workspace--crm-smart-overview`}
        recordTitle={customer.customerName}
        recordNo={customer.customerCode}
        status={companyStatus?.label ?? (customer.isActive ? 'Active' : 'Inactive')}
        statusTone={statusTone}
        company={customer.customerType}
        owner={customer.contactPerson}
        favoritePath={favoritePath}
        breadcrumbs={breadcrumbs}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Smart Context"
        stickyFooter={false}
      >
        <div className="customer-360-workspace">
          <Customer360Hero
            customer={customer}
            status={companyStatus}
            stats={heroStats}
            onEdit={() => navigate(`/masters/companies/${customer.id}/edit`)}
          />

          <EnterpriseFormSectionNav
            sections={sectionNavItems}
            activeId={tab}
            onSelect={(t) => setTab(t as Tab)}
          />

          <EnterpriseFormMetrics metrics={metrics} />

          <div className="customer-360-tab-panel">
            <div className="customer-360-tab-body">
      {tab === 'overview' && (
        <div className="customer-360-overview space-y-4">
          {(nextCrmFollowUp || companyStatus?.label) ? (
            <div className="customer-360-insight" role="status">
              <div className="customer-360-insight__copy">
                <p className="customer-360-insight__eyebrow">Next best focus</p>
                <p className="customer-360-insight__title">
                  {nextCrmFollowUp
                    ? `Follow-up due ${formatDate(nextCrmFollowUp.dueDate)}`
                    : smartNextAction.title}
                </p>
                <p className="customer-360-insight__desc">
                  {nextCrmFollowUp
                    ? `${nextCrmFollowUp.followUpType.replace(/_/g, ' ')} · ${nextCrmFollowUp.assignedToName || 'Unassigned'}`
                    : smartNextAction.description}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (nextCrmFollowUp || smartNextAction.id === 'follow_up') {
                    setFollowUpOpen(true)
                    return
                  }
                  if (smartNextAction.id === 'new_opp') {
                    navigate(`/crm/opportunities/new?customerId=${customer.id}`)
                    return
                  }
                  navigate(`/masters/companies/${customer.id}/edit`)
                }}
              >
                {nextCrmFollowUp ? 'Open follow-up' : smartNextAction.ctaLabel}
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ErpCardSection
              title={COMPANY_TERMINOLOGY.profile}
              subtitle="Identity, territory and credit"
              icon={Target}
              accent="blue"
              columns={2}
              collapsible
              defaultOpen
            >
              <div className="customer-360-field-grid">
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Party status</span>
                  <span className="customer-360-field__value"><CompanyCustomerBadge company={customer} /></span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Industry</span>
                  <span className="customer-360-field__value"><TypeBadge value={customer.customerType} color="blue" /></span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">City</span>
                  <span className="customer-360-field__value">{customer.city || '—'}</span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Contact</span>
                  <span className="customer-360-field__value">{customer.contactPerson || '—'}</span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Credit limit</span>
                  <span className="customer-360-field__value">
                    {formatCurrency(customer.creditLimit && customer.creditLimit > 0 ? customer.creditLimit : data.creditLimit)}
                  </span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Status</span>
                  <span className="customer-360-field__value"><ActiveBadge isActive={customer.isActive} /></span>
                </div>
              </div>
            </ErpCardSection>

            <ErpCardSection
              title="Commercial snapshot"
              subtitle="Orders, receivables and CRM pulse"
              icon={Wallet}
              accent="teal"
              columns={2}
              collapsible
              defaultOpen
            >
              <div className="customer-360-field-grid">
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Outstanding</span>
                  <span className="customer-360-field__value">
                    {financeMoneyVisible ? formatCurrency(financeOutstanding) : '—'}
                  </span>
                </div>
                {isApiMode() ? (
                  <>
                    <div className="customer-360-field">
                      <span className="customer-360-field__label">Invoiced</span>
                      <span className="customer-360-field__value">
                        {financeMoneyVisible ? formatCurrency(financeInvoiced) : '—'}
                      </span>
                    </div>
                    <div className="customer-360-field">
                      <span className="customer-360-field__label">Collected</span>
                      <span className="customer-360-field__value">
                        {financeMoneyVisible ? formatCurrency(financeCollected) : '—'}
                      </span>
                    </div>
                    <div className="customer-360-field">
                      <span className="customer-360-field__label">Dispatched value</span>
                      <span className="customer-360-field__value">{formatCurrency(financeDispatched)}</span>
                    </div>
                  </>
                ) : null}
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Open orders</span>
                  <span className="customer-360-field__value">{data.openSo.length}</span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Dispatch pending</span>
                  <span className="customer-360-field__value">{data.pendingDispatch.length}</span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Payment pending</span>
                  <span className="customer-360-field__value">{data.paymentPending.length}</span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Next follow-up</span>
                  <span className="customer-360-field__value">{crmSummary?.nextFollowUpDate ?? '—'}</span>
                </div>
                <div className="customer-360-field">
                  <span className="customer-360-field__label">Last CRM activity</span>
                  <span className="customer-360-field__value">
                    {crmSummary?.lastActivityAt ? formatDate(crmSummary.lastActivityAt) : '—'}
                  </span>
                </div>
              </div>
            </ErpCardSection>
          </div>

        {id && (
          <Entity360Panel title="Contacts">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-erp-muted">
                {crmContacts.length} contact{crmContacts.length === 1 ? '' : 's'} linked to this company
              </p>
              <Button size="sm" onClick={() => navigate(`/crm/contacts/new?customerId=${id}`)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Contact
              </Button>
            </div>
            <DataGrid
              data={crmContacts}
              columns={[
                {
                  accessorKey: 'name',
                  header: 'Contact',
                  cell: ({ row }) => (
                    <TableLink to={`/crm/contacts/${row.original.id}`}>
                      {row.original.name}
                      {row.original.isPrimary ? ' · Primary' : ''}
                    </TableLink>
                  ),
                },
                { accessorKey: 'designation', header: 'Designation' },
                { accessorKey: 'department', header: 'Department', cell: ({ row }) => row.original.department || '—' },
                { accessorKey: 'phone', header: 'Phone' },
                { accessorKey: 'email', header: 'Email' },
              ]}
              compact
              emptyMessage="No contacts yet — add the first contact for this company."
            />
            {customerContacts.length > crmContacts.length ? (
              <p className="mt-2 text-[11px] text-erp-muted">
                {customerContacts.length - crmContacts.length} legacy master contact(s) also on file.
              </p>
            ) : null}
          </Entity360Panel>
        )}
        <CustomerTrailerQrPanel customerId={customer.id} customerName={customer.customerName} />
        </div>
      )}

      {tab === 'crm' && id && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setFollowUpOpen(true)}>Quick Follow-up</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/crm/opportunities')}>CRM Opportunities</Button>
          </div>
          <Entity360Panel title="Opportunities">
            <DataGrid
              data={customerCrmOpps}
              columns={[
                { accessorKey: 'opportunityNo', header: 'Opp', cell: ({ row }) => <TableLink to={`/crm/opportunities/${row.original.id}`}>{row.original.opportunityNo}</TableLink> },
                { accessorKey: 'stage', header: 'Stage', cell: ({ row }) => opportunityStageLabel(row.original.stage) },
                { accessorKey: 'value', header: 'Value', cell: ({ row }) => formatCrmCurrency(row.original.value) },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              ]}
              compact
              emptyMessage="No CRM opportunities."
            />
          </Entity360Panel>
          <Entity360Panel title="CRM Quotation Documents">
            <DataGrid
              data={customerCrmDocs}
              columns={[
                { accessorKey: 'quotationId', header: 'Quotation' },
                { accessorKey: 'revisionNo', header: 'Rev' },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
                { accessorKey: 'totalAmount', header: 'Total', cell: ({ row }) => formatCurrency(row.original.totalAmount) },
              ]}
              compact
              emptyMessage="No CRM quotation documents."
            />
          </Entity360Panel>
          <Entity360Panel title="Activity Timeline">
            <CrmUnifiedActivityFeed
              items={unifiedFeedItems}
              nextFollowUp={nextCrmFollowUp}
              canAddActivity={canAddActivity}
              canAddFollowUp={canAddFollowUp}
              canAddNote
              onLogActivity={() => {
                setEditingActivity(null)
                setLogActivityOpen(true)
              }}
              onScheduleFollowUp={() => {
                setEditingFollowUp(null)
                setFollowUpOpen(true)
              }}
              onAddNote={() => {
                window.requestAnimationFrame(() => {
                  document.getElementById('customer-crm-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }}
              onEditActivity={canEditActivity ? (activity) => {
                setEditingActivity(activity)
                setLogActivityOpen(true)
              } : undefined}
              onDeleteActivity={canDeleteActivity ? (activity) => setDeleteActivityTarget(activity) : undefined}
              onEditFollowUp={canEditFollowUp ? (followUp) => {
                setEditingFollowUp(followUp)
                setFollowUpOpen(true)
              } : undefined}
              onDeleteFollowUp={canDeleteFollowUp ? (followUp) => setDeleteFollowUpTarget(followUp) : undefined}
              pendingActivityId={pendingActivityId}
              pendingFollowUpId={pendingFollowUpId}
            />
          </Entity360Panel>
          <Entity360Panel title="Notes">
            <div id="customer-crm-notes">
              <EntityNotesPanel entityType="COMPANY" entityId={id} />
            </div>
          </Entity360Panel>
          {isApiMode() ? (
            <Entity360Panel title="Attachments">
              <EntityAttachmentsPanel entityType="COMPANY" entityId={id} />
            </Entity360Panel>
          ) : null}
        </div>
      )}

      {tab === 'pipeline' && (
        <div className="space-y-4">
          <Entity360Panel title="Leads">
            <DataGrid
              data={data.leads}
              columns={[
                { accessorKey: 'leadNo', header: 'Lead' },
                { accessorKey: 'stage', header: 'Stage', cell: ({ row }) => <StatusBadge status={row.original.stage} /> },
                { accessorKey: 'expectedValue', header: 'Value', cell: ({ row }) => formatCurrency(row.original.expectedValue) },
              ]}
              compact
              emptyMessage="No leads linked to this customer."
            />
          </Entity360Panel>
          <Entity360Panel title="Opportunities">
            <DataGrid
              data={customerCrmOpps}
              columns={[
                { accessorKey: 'opportunityNo', header: 'Opportunity', cell: ({ row }) => <TableLink to={`/crm/opportunities/${row.original.id}`}>{row.original.opportunityNo}</TableLink> },
                { accessorKey: 'stage', header: 'Stage', cell: ({ row }) => <StatusBadge status={row.original.stage} /> },
                { accessorKey: 'value', header: 'Value', cell: ({ row }) => formatCurrency(row.original.value) },
              ]}
              compact
              emptyMessage="No opportunities for this customer."
            />
          </Entity360Panel>
          <Entity360Panel title="Quotations">
            <DataGrid
              data={data.customerQuotations.filter((q) => q.isLatestRevision)}
              columns={[
                {
                  accessorKey: 'quotationNo',
                  header: 'Quote',
                  cell: ({ row }) => {
                    const path = crmQuotationPath(row.original.id)
                    return path ? <TableLink to={path}>{row.original.quotationNo}</TableLink> : row.original.quotationNo
                  },
                },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
                { accessorKey: 'pricing.grandTotal', header: 'Amount', cell: ({ row }) => formatCurrency(row.original.pricing.grandTotal) },
              ]}
              compact
              emptyMessage="No quotations for this customer."
            />
          </Entity360Panel>
          <Entity360Panel title="Approved Quotes">
            <DataGrid
              data={data.approvedQuotes}
              columns={[
                {
                  accessorKey: 'quotationNo',
                  header: 'Quote',
                  cell: ({ row }) => {
                    const path = crmQuotationPath(row.original.id)
                    return path ? <TableLink to={path}>{row.original.quotationNo}</TableLink> : row.original.quotationNo
                  },
                },
                { accessorKey: 'validityDate', header: 'Valid Until', cell: ({ row }) => formatDate(row.original.validityDate) },
              ]}
              compact
              emptyMessage="No approved quotes pending conversion."
            />
          </Entity360Panel>
          <Entity360Panel title="Lost Quotes">
            <DataGrid
              data={data.lostQuotes}
              columns={[
                { accessorKey: 'quotationNo', header: 'Quote' },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              ]}
              compact
              emptyMessage="No lost quotes recorded."
            />
          </Entity360Panel>
        </div>
      )}

      {tab === 'sales' && (
        <div className="space-y-4">
          <Entity360Panel title="All Sales Orders">
            <DataGrid
              data={data.salesOrders}
              columns={salesOrderColumns}
              compact
              emptyMessage="No sales orders for this customer."
            />
          </Entity360Panel>
          <Entity360Panel title="Open Sales Orders">
            <DataGrid data={data.openSo} columns={soColumns} compact emptyMessage="No open sales orders." />
          </Entity360Panel>
          <Entity360Panel title="In Production">
            <DataGrid data={data.inProductionSo} columns={soColumns} compact emptyMessage="No orders currently in production." />
          </Entity360Panel>
          <Entity360Panel title="Ready to Dispatch">
            <DataGrid data={data.readyToDispatchSo} columns={soColumns} compact emptyMessage="No orders ready to dispatch." />
          </Entity360Panel>
          <Entity360Panel title="Closed Sales Orders">
            <DataGrid data={data.closedSo} columns={soColumns} compact emptyMessage="No closed sales orders." />
          </Entity360Panel>
        </div>
      )}

      {tab === 'production' && (
        <div className="space-y-4">
          <Entity360Panel title="Linked Work Orders">
            <DataGrid data={data.customerWorkOrders} columns={woColumns} compact emptyMessage="No work orders linked to customer sales orders." />
          </Entity360Panel>
          <Entity360Panel title="Delayed Orders">
            <DataGrid data={data.delayedOrders} columns={woColumns} compact emptyMessage="No delayed work orders." />
          </Entity360Panel>
          <Entity360Panel title="QC Holds">
            <DataGrid
              data={data.qcHolds}
              columns={[
                { accessorKey: 'inspectionNo', header: 'Inspection' },
                { accessorKey: 'category', header: 'Category', cell: ({ row }) => <StatusBadge status={row.original.category} /> },
                { accessorKey: 'woNo', header: 'WO' },
              ]}
              compact
              emptyMessage="No QC holds on customer orders."
            />
          </Entity360Panel>
        </div>
      )}

      {tab === 'dispatch' && (
        <div className="space-y-4">
          <Entity360Panel title="Dispatch Plans">
            <DataGrid data={data.pendingDispatch} columns={dispatchColumns} compact emptyMessage="No pending dispatch plans." />
          </Entity360Panel>
          <Entity360Panel title="Dispatched Trailers">
            <DataGrid data={data.dispatchedTrailers} columns={dispatchColumns} compact emptyMessage="No dispatched trailers yet." />
          </Entity360Panel>
          <Entity360Panel title="POD Pending">
            <DataGrid data={data.podPending} columns={dispatchColumns} compact emptyMessage="No POD pending." />
          </Entity360Panel>
          <Entity360Panel title="Delivery History">
            <DataGrid data={data.dispatchHistory} columns={dispatchColumns} compact emptyMessage="No delivery history." />
          </Entity360Panel>
        </div>
      )}

      {tab === 'financial' && (
        <Entity360Panel title="Invoices & Payments">
          {isApiMode() && companyCommercial.loading ? (
            <p className="p-4 text-[12px] text-erp-muted">Loading commercial position…</p>
          ) : null}
          {isApiMode() && companyCommercial.error ? (
            <p className="p-4 text-[12px] text-red-700">{companyCommercial.error}</p>
          ) : null}
          <DynamicsKpiRow columns={5}>
            <DynamicsKpiTile label="Ordered" value={formatCurrency(financeOrdered)} tone="primary" />
            <DynamicsKpiTile label="Dispatched" value={formatCurrency(financeDispatched)} tone="primary" />
            <DynamicsKpiTile
              label="Invoice Value"
              value={financeMoneyVisible ? formatCurrency(financeInvoiced) : '—'}
              tone="primary"
            />
            <DynamicsKpiTile
              label="Paid Amount"
              value={financeMoneyVisible ? formatCurrency(financeCollected) : '—'}
              tone="success"
            />
            <DynamicsKpiTile
              label="Outstanding"
              value={financeMoneyVisible ? formatCurrency(financeOutstanding) : '—'}
              tone="warning"
            />
          </DynamicsKpiRow>
          {!isApiMode() ? (
            <DynamicsKpiRow columns={2}>
              <DynamicsKpiTile label="Overdue Amount" value={formatCurrency(data.overdueAmount)} tone="critical" />
              <DynamicsKpiTile label="Payment Pending" value={data.paymentPending.length} tone="warning" />
            </DynamicsKpiRow>
          ) : null}
          {!isApiMode() ? (
            <DataGrid data={data.customerInvoices} columns={invoiceColumns} compact emptyMessage="No invoices for this customer." />
          ) : (
            <p className="p-4 text-[12px] text-erp-muted">
              Invoice register remains in demo mode. API finance tiles above are projected from sales orders and posted AR.
            </p>
          )}
        </Entity360Panel>
      )}

      {tab === 'quality' && (
        <div className="space-y-4">
          <Entity360Panel title="Final QC Issues">
            <DataGrid
              data={data.finalQcIssues}
              columns={[
                { accessorKey: 'inspectionNo', header: 'Inspection' },
                { accessorKey: 'woNo', header: 'WO' },
                { accessorKey: 'result', header: 'Result', cell: ({ row }) => <StatusBadge status={row.original.result ?? 'pending'} /> },
              ]}
              compact
              emptyMessage="No final QC issues for this customer."
            />
          </Entity360Panel>
          <Entity360Panel title="Customer Complaints">
            <div className="p-4 text-2xl font-semibold tabular-nums text-erp-text">{data.complaints}</div>
          </Entity360Panel>
          <Entity360Panel title="Warranty Cases">
            <div className="p-4 text-2xl font-semibold tabular-nums text-erp-text">{data.warrantyCases}</div>
          </Entity360Panel>
          <Entity360Panel title="Trailer Serial Numbers">
            <div className="p-4">
              <SerialGenealogyPanel customerId={customer.id} />
            </div>
          </Entity360Panel>
          <Entity360Panel title="NCR Linked to Customer">
            <DataGrid
              data={data.customerNcrs}
              columns={[
                { accessorKey: 'ncrNo', header: 'NCR', cell: ({ row }) => <TableLink to={`/quality/ncr/${row.original.id}`}>{row.original.ncrNo}</TableLink> },
                { accessorKey: 'severity', header: 'Severity', cell: ({ row }) => <StatusBadge status={row.original.severity} /> },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              ]}
              compact
              emptyMessage="No NCRs linked to this customer."
            />
          </Entity360Panel>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          {isApiMode() ? (
            <Entity360Panel title="CRM Attachments">
              <EntityAttachmentsPanel entityType="COMPANY" entityId={customer.id} />
            </Entity360Panel>
          ) : (
            <EntityDocumentsPanel entityType="customer" entityId={customer.id} entityLabel={customer.customerName} />
          )}
          <Entity360Panel title="Customer Documents (Sales)">
          <DataGrid
            data={data.documents}
            columns={[
              { accessorKey: 'name', header: 'Document' },
              { accessorKey: 'type', header: 'Type', cell: ({ row }) => <StatusBadge status={row.original.type} /> },
              { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date) },
            ]}
            compact
            emptyMessage="No documents linked to this customer."
          />
        </Entity360Panel>
        </div>
      )}

      {tab === 'timeline' && (
        <Entity360Panel title="Customer Lifecycle Timeline">
          <div className="p-4">
            <Timeline events={data.timeline} />
          </div>
        </Entity360Panel>
      )}
            </div>
          </div>
        </div>
      </CrmCardFormShell>
      <QuickFollowUpDrawer
        open={followUpOpen}
        onClose={() => {
          setFollowUpOpen(false)
          setEditingFollowUp(null)
        }}
        context={{ customerId: id }}
        followUp={editingFollowUp}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => {
          setLogActivityOpen(false)
          setEditingActivity(null)
        }}
        context={{ customerId: id ?? undefined }}
        activity={editingActivity}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from this company’s timeline.` : undefined}
        confirmLabel="Delete activity"
        onCancel={() => setDeleteActivityTarget(null)}
        onConfirm={() => {
          if (!deleteActivityTarget) return
          setPendingActivityId(deleteActivityTarget.id)
          void (async () => {
            try {
              const r = await resolveStoreAction(deleteActivity(deleteActivityTarget.id))
              if (r.ok) {
                setDeleteActivityTarget(null)
                notify.success('Activity deleted')
              } else {
                notify.error(r.error ?? 'Failed to delete activity')
              }
            } finally {
              setPendingActivityId(null)
            }
          })()
        }}
        isDeleting={pendingActivityId === deleteActivityTarget?.id}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteFollowUpTarget)}
        title="Delete follow-up?"
        description={deleteFollowUpTarget
          ? `Follow-up (${deleteFollowUpTarget.followUpType.replace(/_/g, ' ')}) due ${deleteFollowUpTarget.dueDate} will be removed.`
          : undefined}
        confirmLabel="Delete follow-up"
        onCancel={() => setDeleteFollowUpTarget(null)}
        onConfirm={() => {
          if (!deleteFollowUpTarget) return
          setPendingFollowUpId(deleteFollowUpTarget.id)
          void (async () => {
            try {
              const r = await resolveStoreAction(deleteFollowUp(deleteFollowUpTarget.id))
              if (r.ok) {
                setDeleteFollowUpTarget(null)
                notify.success('Follow-up deleted')
              } else {
                notify.error(r.error ?? 'Failed to delete follow-up')
              }
            } finally {
              setPendingFollowUpId(null)
            }
          })()
        }}
        isDeleting={pendingFollowUpId === deleteFollowUpTarget?.id}
      />
    </>
  )
}
