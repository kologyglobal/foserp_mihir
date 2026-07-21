import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  FileText,
  GitBranch,
  Handshake,
  Pencil,
  Plus,
  Save,
  ShoppingBag,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../../components/tables/DataTable'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { SmartFilterBar } from '../../components/design-system/SmartFilterBar'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { useCommercialTermsByType } from '../../hooks/useStableStoreData'
import { getCommercialTermById } from '../../utils/commercialTermsAdapter'
import { useSavedViews } from '../../hooks/useSavedViews'
import { SALES_ORDER_REGISTER_PRESETS } from '../../config/savedViewPresets'
import type { CrmFilterField } from '../../types/crmListFilters'
import { SearchInput } from '../../components/ui/SearchInput'
import { Select } from '../../components/forms/Inputs'
import { useUIStore } from '../../store/uiStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { StatCard } from '../../components/ui/StatCard'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { TableLink } from '../../components/ui/AppLink'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { Button } from '../../components/ui/Button'
import { AppLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { useSalesStore } from '../../store/salesStore'
import { useCrmStore } from '../../store/crmStore'
import { useMrpStore } from '../../store/mrpStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMasterStore } from '../../store/masterStore'
import { formatNumber, formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { exportRowsToCsv } from '../../utils/exportCsv'
import {
  buildQuotationRegisterKpis,
  buildSalesOrderRegisterKpis,
} from '../../utils/salesModuleKpis'
import {
  EnterpriseNumericCell,
  entNumericMeta,
} from '../../design-system/enterprise'
import { StatusBadge } from '../../design-system/list-page'
import { SalesQuotationsTable } from '../../components/sales/SalesQuotationsTable'
import { SalesOrdersTable } from '../../components/sales/SalesOrdersTable'
import type { Quotation } from '../../types/sales'
import type { SalesOrder } from '../../types/mrp'
import { resolveSalesOrderValue } from '../../components/sales/SalesOrder360Sections'
import { getSalesOrderFulfillmentLabel, sortSalesOrders, type SalesOrderSortKey } from '../../utils/salesDashboardMetrics'
import { crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { salesModuleBreadcrumbs } from '../../utils/salesNavigation'
import {
  CRM_QUOTATIONS_PATH,
  CRM_QUOTATIONS_NEW_PATH,
  CRM_QUOTATIONS_PENDING_APPROVAL_PATH,
  crmQuotationPath,
  crmQuotationEditorPath,
} from '../../utils/crmQuotationNavigation'
import {
  buildBlankSalesOrderNewUrl,
  buildSalesOrderEditUrl,
  resolveSalesOrderDetailPath,
  resolveSalesOrderPrintPath,
} from '../../utils/crmSalesOrderNavigation'
import {
  buildPendingSoCreateUrl,
  isPendingSalesOrderHandover,
  listPendingQuotationSoHandovers,
  PENDING_SO_STATUS,
} from '../../utils/pendingSalesOrderHandover'
import { salesOrderStatusLabel } from '../../utils/salesOrderStatus'
import { buildProformaNewUrl } from '../../utils/proformaInvoicePrefill'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { systemConfirm } from '../../utils/systemConfirm'
import { QuickCreateSelect } from '../../components/quick-create/QuickCreateSelect'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { usePendingCustomerApprovals } from '../../hooks/useStableStoreData'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { Lead360Workspace } from '@/components/crm/Lead360Workspace'

function useMasterLabels() {
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const customerName = useCallback(
    (id: string | null | undefined) =>
      id ? (customers.find((c) => c.id === id)?.customerName ?? id) : '—',
    [customers],
  )
  const productName = useCallback(
    (id: string | null | undefined) =>
      id ? (products.find((p) => p.id === id)?.productName ?? id) : '—',
    [products],
  )
  return { customerName, productName, customers, products }
}

function PipelineStep({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 min-w-[120px] flex-col items-center rounded-lg border px-3 py-4 text-center transition-colors ${
        active
          ? 'border-erp-primary bg-erp-primary/5'
          : 'border-erp-border bg-erp-surface hover:border-erp-primary/40'
      }`}
    >
      <span className="text-2xl font-semibold text-erp-text">{count}</span>
      <span className="mt-1 text-xs font-medium text-erp-muted">{label}</span>
    </button>
  )
}

export function SalesDashboardPage() {
  const navigate = useNavigate()
  const leads = useSalesStore((s) => s.leads)
  const opportunities = useCrmStore((s) => s.opportunities)
  const quotations = useSalesStore((s) => s.quotations)
  const pendingApprovals = usePendingCustomerApprovals()
  const salesOrders = useMrpStore((s) => s.salesOrders)

  const openLeads = leads.filter((l) => !['converted_to_opportunity', 'closed', 'converted', 'disqualified'].includes(l.stage))
  const openOpportunities = opportunities.filter((o) => o.status === 'open')
  const activeQuotations = quotations.filter((q) => q.isLatestRevision && !['converted', 'cancelled', 'superseded'].includes(q.status))
  const approvedQuo = quotations.filter((q) => q.customerApproval === 'approved' && q.status !== 'converted' && q.isLatestRevision).length
  const openOrders = salesOrders.filter((so) => !['closed', 'invoiced'].includes(so.status))

  return (
    <div className="erp-page">
      <PageHeader
        title="Sales Hub"
        description="Commercial lifecycle — Lead → Opportunity → Quotation → Customer Approval → Sales Order → MRP"
        breadcrumbs={[
          { label: 'Home', to: '/masters' },
          { label: 'Sales', to: '/sales' },
          { label: 'Sales Hub' },
        ]}
        commandBar={
          <CommandBar>
            <CommandBarGroup label="Create">
              <CommandBarButton icon={UserPlus} label="New Lead" onClick={() => navigate('/crm/leads/new')} primary />
              <CommandBarButton icon={Handshake} label="New Opportunity" onClick={() => navigate('/crm/opportunities/new')} />
            </CommandBarGroup>
            <CommandBarGroup label="Navigate">
              <CommandBarButton icon={Handshake} label="Approvals" onClick={() => navigate(CRM_QUOTATIONS_PENDING_APPROVAL_PATH)} />
              <CommandBarButton icon={ShoppingBag} label="Sales Orders" onClick={() => navigate('/sales/orders')} />
            </CommandBarGroup>
          </CommandBar>
        }
      />

      <SectionCard title="Commercial Pipeline" subtitle="Click a stage to open the register">
        <div className="flex flex-wrap items-center gap-2">
          <PipelineStep label="Leads" count={openLeads.length} onClick={() => navigate('/crm/leads')} />
          <ChevronRight className="hidden h-5 w-5 shrink-0 text-erp-muted sm:block" aria-hidden />
          <PipelineStep label="Opportunities" count={openOpportunities.length} onClick={() => navigate('/crm/opportunities')} />
          <ChevronRight className="hidden h-5 w-5 shrink-0 text-erp-muted sm:block" aria-hidden />
          <PipelineStep label="Quotations" count={activeQuotations.length} onClick={() => navigate(CRM_QUOTATIONS_PATH)} />
          <ChevronRight className="hidden h-5 w-5 shrink-0 text-erp-muted sm:block" aria-hidden />
          <PipelineStep label="Pending Approval" count={pendingApprovals.length} onClick={() => navigate(CRM_QUOTATIONS_PENDING_APPROVAL_PATH)} />
          <ChevronRight className="hidden h-5 w-5 shrink-0 text-erp-muted sm:block" aria-hidden />
          <PipelineStep label="Sales Orders" count={openOrders.length} onClick={() => navigate('/sales/orders')} />
        </div>
      </SectionCard>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Open Leads" value={openLeads.length} icon={UserPlus} accent="blue" onClick={() => navigate('/crm/leads')} />
        <StatCard title="Open Opportunities" value={openOpportunities.length} icon={Handshake} accent="purple" onClick={() => navigate('/crm/opportunities')} />
        <StatCard title="Awaiting Approval" value={pendingApprovals.length} icon={Handshake} accent="amber" helper={`${approvedQuo} approved, not converted`} onClick={() => navigate(CRM_QUOTATIONS_PENDING_APPROVAL_PATH)} />
        <StatCard title="Sales Orders" value={salesOrders.length} icon={ShoppingBag} accent="green" onClick={() => navigate('/sales/orders')} />
      </div>

      {pendingApprovals.length > 0 && (
        <SectionCard title="Approval Queue" subtitle="Company sign-off required before sales order" className="mt-4">
          <DashboardQuotationTable data={pendingApprovals} />
        </SectionCard>
      )}

      <SectionCard title="Latest Quotations" subtitle="Most recent pricing documents" className="mt-4">
        <DashboardQuotationTable data={quotations.filter((q) => q.isLatestRevision).slice(0, 8)} />
      </SectionCard>
    </div>
  )
}

export { LeadListPage } from '../crm/CrmLeadListPage'

export function LeadDetailPage() {
  return <Lead360Workspace />
}

function DashboardQuotationTable({
  data,
  selectedRowId,
  onRowSelect,
  onRowQuickView,
}: {
  data: Quotation[]
  selectedRowId?: string | null
  onRowSelect?: (row: Quotation) => void
  onRowQuickView?: (row: Quotation) => void
}) {
  const { customerName, productName } = useMasterLabels()
  const columns: ColumnDef<Quotation, unknown>[] = [
    {
      accessorKey: 'quotationNo',
      header: 'Quotation',
      cell: ({ row }) => (
        <TableLink to={crmQuotationPath(row.original.id)}>
          {row.original.quotationNo} Rev {row.original.revisionNo}
        </TableLink>
      ),
    },
    {
      id: 'opportunityNo',
      header: 'Opportunity',
      cell: ({ row }) => row.original.opportunityNo ?? row.original.inquiryNo ?? '—',
    },
    { accessorKey: 'customerId', header: 'Company', cell: ({ row }) => customerName(row.original.customerId) },
    { accessorKey: 'productId', header: 'Product', cell: ({ row }) => productName(row.original.productId) },
    {
      accessorKey: 'pricing.grandTotal',
      header: 'Total',
      cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.pricing.grandTotal)} />,
      meta: entNumericMeta('Total'),
    },
    {
      accessorKey: 'validityDate',
      header: 'Valid Until',
      cell: ({ row }) => formatDate(row.original.validityDate),
    },
    {
      accessorKey: 'customerApproval',
      header: 'Approval',
      cell: ({ row }) => (
        <Badge color={statusColor(row.original.customerApproval)}>{formatStatus(row.original.customerApproval)}</Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
          {row.original.locked && <GitBranch className="h-3 w-3 text-erp-muted" aria-label="Locked revision" />}
          <StatusBadge label={row.original.status} status={row.original.status} />
        </span>
      ),
    },
  ]
  return (
    <DataTable
      data={data}
      columns={columns}
      stickyFirstColumn
      zebra
      showToolbar={false}
      selectedRowId={selectedRowId}
      onRowSelect={onRowSelect}
      onRowQuickView={onRowQuickView}
      emptyMessage="No quotations match your filters."
      exportFileName="quotations"
    />
  )
}

/** @deprecated Approvals unified at /crm/quotations — use SalesApprovalsLegacyRedirect route */
export function ApprovalQueuePage() {
  const navigate = useNavigate()
  const pending = usePendingCustomerApprovals()
  const recordCustomerApproval = useSalesStore((s) => s.recordCustomerApproval)
  const [toast, setToast] = useState<string | null>(null)
  const { customerName, productName } = useMasterLabels()

  return (
    <div className="erp-page">
      <PageHeader
        title="Customer Approval Queue"
        description="Quotations sent to the customer — record acceptance before creating a sales order"
        breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: 'Approvals' }]}
        commandBar={
          <CommandBar>
            <CommandBarGroup label="Navigate">
              <CommandBarButton icon={FileText} label="Quotations" onClick={() => navigate(CRM_QUOTATIONS_PATH)} />
              <CommandBarButton icon={ShoppingBag} label="Sales Orders" onClick={() => navigate('/sales/orders')} primary />
              <CommandBarButton icon={UserPlus} label="New Lead" onClick={() => navigate('/crm/leads/new')} />
            </CommandBarGroup>
          </CommandBar>
        }
      />

      {pending.length === 0 ? (
        <SectionCard>
          <p className="text-sm text-erp-muted">No quotations pending customer approval.</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {pending.map((q) => (
            <SectionCard key={q.id} title={`${q.quotationNo} · Rev ${q.revisionNo}`} subtitle={`${customerName(q.customerId)} · ${productName(q.productId)} × ${q.qty}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-erp-muted">Grand Total</dt>
                    <dd className="font-semibold">{formatCurrency(q.pricing.grandTotal)}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Valid Until</dt>
                    <dd>{formatDate(q.validityDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Payment</dt>
                    <dd>{q.paymentTerms}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Opportunity</dt>
                    <dd>{q.opportunityNo ?? q.inquiryNo ?? '—'}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => navigate(crmQuotationPath(q.id))}>
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const r = recordCustomerApproval(q.id, 'approved')
                      setToast(r.ok ? `${q.quotationNo} approved` : r.error ?? 'Failed')
                    }}
                  >
                    <CheckCircle className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const r = recordCustomerApproval(q.id, 'rejected', 'Customer declined terms')
                      setToast(r.ok ? `${q.quotationNo} rejected` : r.error ?? 'Failed')
                    }}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
      {toast && <Toast message={toast} />}
    </div>
  )
}

export function QuotationListPage() {
  const navigate = useNavigate()
  const allQuotations = useSalesStore((s) => s.quotations)
  const quotations = useMemo(
    () => allQuotations.filter((q) => q.isLatestRevision),
    [allQuotations],
  )
  const { customerName, productName } = useMasterLabels()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const pending = quotations.filter((q) => q.status === 'pending_approval').length
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savedView, setSavedView] = useState('My View')

  const filtered = useMemo(() => {
    let list = [...quotations]
    if (statusFilter) list = list.filter((q) => q.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (q) =>
          q.quotationNo.toLowerCase().includes(s) ||
          customerName(q.customerId).toLowerCase().includes(s) ||
          (q.opportunityNo ?? q.inquiryNo ?? '').toLowerCase().includes(s),
      )
    }
    return list
  }, [quotations, statusFilter, search, customerName])

  const quotationKpiStrip = useMemo(
    () =>
      buildQuotationRegisterKpis(
        {
          total: quotations.length,
          pending,
          approved: quotations.filter((q) => q.customerApproval === 'approved').length,
          converted: quotations.filter((q) => q.status === 'converted').length,
          pipelineValue: quotations.reduce((s, q) => s + q.pricing.grandTotal, 0),
        },
        statusFilter,
        setStatusFilter,
      ),
    [quotations, pending, statusFilter],
  )

  function openQuotationPreview(quotation: Quotation) {
    const crmDoc = useCrmStore.getState().getLatestQuotationDocument(quotation.id)
    openDetailPanel({
      title: `${quotation.quotationNo} Rev ${quotation.revisionNo}`,
      subtitle: customerName(quotation.customerId),
      fields: [
        { label: 'Opportunity', value: quotation.opportunityNo ?? quotation.inquiryNo ?? '—' },
        { label: 'Product', value: productName(quotation.productId) },
        { label: 'Grand Total', value: formatCurrency(quotation.pricing.grandTotal) },
        { label: 'Valid Until', value: formatDate(quotation.validityDate) },
        { label: 'Company Approval', value: formatStatus(quotation.customerApproval) },
        { label: 'Status', value: formatStatus(quotation.status) },
      ],
      links: [{ label: 'Open Quotation', href: crmQuotationPath(quotation.id) }],
      timeline: [{ id: 'status', label: formatStatus(quotation.status), time: formatDate(quotation.validityDate), status: 'current' }],
      aiSummary: `${quotation.quotationNo} for ${customerName(quotation.customerId)} is ${formatStatus(quotation.status).toLowerCase()} at ${formatCurrency(quotation.pricing.grandTotal)}.${quotation.status === 'pending_approval' ? ' Follow up on customer approval.' : quotation.status === 'approved' ? ' Ready to convert to sales order.' : ''}`,
      actions: [
        { label: 'Open Quotation', onClick: () => navigate(crmQuotationPath(quotation.id)), primary: true },
        { label: 'Edit', onClick: () => navigate(crmQuotationEditorPath(quotation.id, crmDoc?.id)) },
      ],
    })
  }

  function exportSelectedQuotations(selected: Quotation[]) {
    exportRowsToCsv(
      'quotations-selected',
      ['Quotation', 'Opportunity', 'Company', 'Total', 'Status'],
      selected.map((q) => [
        `${q.quotationNo} Rev ${q.revisionNo}`,
        q.opportunityNo ?? q.inquiryNo ?? '',
        customerName(q.customerId),
        q.pricing.grandTotal,
        q.status,
      ]),
    )
  }

  function duplicateLegacyQuotation(quotation: Quotation) {
    const params = new URLSearchParams({ customerId: quotation.customerId })
    if (quotation.opportunityId) params.set('opportunityId', quotation.opportunityId)
    navigate(`${CRM_QUOTATIONS_NEW_PATH}?${params.toString()}`)
  }

  return (
    <OperationalPageShell
      title="Quotation Register"
      description="Version-controlled pricing with terms, taxes, validity, and customer approval"
      favoritePath={CRM_QUOTATIONS_PATH}
      variant="dynamics"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={Plus} label="New Quotation" onClick={() => navigate(CRM_QUOTATIONS_NEW_PATH)} primary />
            {pending > 0 && (
              <CommandBarButton icon={Handshake} label={`Approvals (${pending})`} onClick={() => navigate(CRM_QUOTATIONS_PENDING_APPROVAL_PATH)} />
            )}
          </CommandBarGroup>
          <CommandBarGroup label="Navigate">
            <CommandBarButton icon={Handshake} label="Opportunities" onClick={() => navigate('/crm/opportunities')} />
            <CommandBarButton icon={ShoppingBag} label="Sales Orders" onClick={() => navigate('/sales/orders')} />
          </CommandBarGroup>
        </CommandBar>
      }
      kpiStrip={quotationKpiStrip}
      filterBar={
        <SmartFilterBar
          chips={[
            ...(statusFilter ? [{ id: 'status', label: formatStatus(statusFilter) }] : []),
            ...(search ? [{ id: 'search', label: `Search: ${search}` }] : []),
          ]}
          onRemoveChip={(id) => { if (id === 'status') setStatusFilter(''); if (id === 'search') setSearch('') }}
          onClearAll={() => { setStatusFilter(''); setSearch('') }}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={filtered.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search quotation, customer…" className="w-full sm:w-64" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40 text-[13px]">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="converted">Converted</option>
          </Select>
        </SmartFilterBar>
      }
    >
      <div className="erp-page-panel overflow-hidden p-0">
        <SalesQuotationsTable
          rows={filtered}
          onView={(row) => navigate(crmQuotationPath(row.id))}
          onEdit={(row) => navigate(crmQuotationEditorPath(row.id))}
          onDuplicate={duplicateLegacyQuotation}
          onPreview={openQuotationPreview}
          onBulkExport={exportSelectedQuotations}
        />
      </div>
    </OperationalPageShell>
  )
}

export function QuotationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const quotation = useSalesStore((s) => (id ? s.getQuotation(id) : undefined))
  const crmDoc = useCrmStore((s) => (id ? s.getLatestQuotationDocument(id) : undefined))
  const getRevisionChain = useSalesStore((s) => s.getRevisionChain)
  const submitQuotationForApproval = useSalesStore((s) => s.submitQuotationForApproval)
  const approveQuotationInternally = useSalesStore((s) => s.approveQuotationInternally)
  const rejectQuotationInternally = useSalesStore((s) => s.rejectQuotationInternally)
  const markQuotationSent = useSalesStore((s) => s.markQuotationSent)
  const recordCustomerApproval = useSalesStore((s) => s.recordCustomerApproval)
  const createQuotationRevision = useSalesStore((s) => s.createQuotationRevision)
  const createSalesOrderFromQuotation = useSalesStore((s) => s.createSalesOrderFromQuotation)
  const updateQuotationDraft = useSalesStore((s) => s.updateQuotationDraft)
  const commercialTerms = useCommercialTermsByType('payment')
  useQuickCreate()
  const { customerName, productName } = useMasterLabels()
  const [toast, setToast] = useState<string | null>(null)
  const [paymentTermId, setPaymentTermId] = useState('')
  const [revPrice, setRevPrice] = useState('')

  if (!quotation) {
    return (
      <div className="erp-page">
        <p className="text-erp-muted">Quotation not found.</p>
        <AppLink to={CRM_QUOTATIONS_PATH}>Back</AppLink>
      </div>
    )
  }

  const chain = getRevisionChain(quotation.rootQuotationId)

  return (
    <div className="erp-page">
      <PageHeader
        title={`${quotation.quotationNo} · Rev ${quotation.revisionNo}`}
        description={quotation.locked ? 'Locked revision (superseded)' : quotation.isLatestRevision ? 'Latest revision' : 'Historical revision'}
        breadcrumbs={[
          { label: 'Sales', to: '/sales' },
          { label: 'Quotations', to: CRM_QUOTATIONS_PATH },
          { label: quotation.quotationNo },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {crmDoc ? (
              <>
                <Link to={`/crm/quotations/${quotation.id}`}>
                  <Button variant="secondary" size="sm">
                    <FileText className="h-4 w-4" />
                    CRM Quote 360
                  </Button>
                </Link>
                <Link to={`/crm/quotations/${quotation.id}/editor?doc=${crmDoc.id}`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="h-4 w-4" />
                    {crmDoc.locked ? 'View Editor' : 'Edit Document'}
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(CRM_QUOTATIONS_PATH)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {quotation.status === 'draft' && !quotation.locked && (
          <Button size="sm" onClick={() => setToast(submitQuotationForApproval(quotation.id).ok ? 'Sent for approval' : submitQuotationForApproval(quotation.id).error ?? 'Failed')}>
            Submit for Approval
          </Button>
        )}
        {quotation.status === 'pending_approval' && quotation.isLatestRevision && (
          <>
            <Button size="sm" variant="primary" onClick={() => setToast(approveQuotationInternally(quotation.id).ok ? 'Quotation approved' : approveQuotationInternally(quotation.id).error ?? 'Failed')}>
              <CheckCircle className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setToast(rejectQuotationInternally(quotation.id).ok ? 'Quotation rejected' : 'Failed')}>
              Reject
            </Button>
          </>
        )}
        {quotation.status === 'approved' && quotation.isLatestRevision && (
          <Button size="sm" variant="primary" onClick={() => setToast(markQuotationSent(quotation.id).ok ? 'Quotation sent' : markQuotationSent(quotation.id).error ?? 'Failed')}>
            Send to Customer
          </Button>
        )}
        {quotation.status === 'sent' && quotation.customerApproval === 'pending' && quotation.isLatestRevision && (
          <>
            <Button size="sm" variant="primary" onClick={() => setToast(recordCustomerApproval(quotation.id, 'approved').ok ? 'Customer approved' : recordCustomerApproval(quotation.id, 'approved').error ?? 'Failed')}>
              <CheckCircle className="mr-1 h-4 w-4" /> Customer Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setToast(recordCustomerApproval(quotation.id, 'rejected', 'Price too high').ok ? 'Customer rejected' : 'Failed')}>
              Customer Reject
            </Button>
          </>
        )}
        {quotation.status === 'sent' && quotation.customerApproval === 'approved' && quotation.isLatestRevision && !quotation.salesOrderId && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const r = createSalesOrderFromQuotation(quotation.id)
              if (r.ok && r.salesOrderId) navigate(resolveSalesOrderDetailPath(r.salesOrderId, true))
              else setToast(r.error ?? 'Failed')
            }}
          >
            Create Sales Order
          </Button>
        )}
        {quotation.salesOrderId && (
          <AppLink to={resolveSalesOrderDetailPath(quotation.salesOrderId, true)}>
            View Sales Order {quotation.salesOrderNo}
          </AppLink>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Pricing & Terms">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-erp-muted">Company</dt>
            <dd>{customerName(quotation.customerId)}</dd>
            <dt className="text-erp-muted">Product</dt>
            <dd>{productName(quotation.productId)} × {quotation.qty}</dd>
            <dt className="text-erp-muted">Unit Price</dt>
            <dd>{formatCurrency(quotation.pricing.unitPrice)}</dd>
            <dt className="text-erp-muted">Discount</dt>
            <dd>{quotation.pricing.discountPct}%</dd>
            <dt className="text-erp-muted">Subtotal</dt>
            <dd>{formatCurrency(quotation.pricing.subtotal)}</dd>
            <dt className="text-erp-muted">GST ({quotation.pricing.gstPct}%)</dt>
            <dd>{formatCurrency(quotation.pricing.gstAmount)}</dd>
            <dt className="text-erp-muted font-semibold">Grand Total</dt>
            <dd className="font-semibold">{formatCurrency(quotation.pricing.grandTotal)}</dd>
            <dt className="text-erp-muted">Validity</dt>
            <dd>{formatDate(quotation.validityDate)}</dd>
            <dt className="text-erp-muted">Payment</dt>
            <dd>
              {quotation.status === 'draft' && !quotation.locked ? (
                <QuickCreateSelect
                  entityType="paymentTerms"
                  value={paymentTermId}
                  onChange={(id) => {
                    setPaymentTermId(id)
                    const term = getCommercialTermById(id)
                    if (term) updateQuotationDraft(quotation.id, { paymentTerms: term.name })
                  }}
                  options={commercialTerms.map((t: { id: string; name: string }) => ({ id: t.id, label: t.name }))}
                  placeholder="Search payment terms…"
                  allowEmpty
                  emptyOptionLabel={quotation.paymentTerms}
                />
              ) : (
                quotation.paymentTerms
              )}
            </dd>
            <dt className="text-erp-muted">Delivery</dt>
            <dd>{quotation.deliveryTerms}</dd>
            <dt className="text-erp-muted">Company Approval</dt>
            <dd><Badge color={statusColor(quotation.customerApproval)}>{formatStatus(quotation.customerApproval)}</Badge></dd>
            <dt className="text-erp-muted">Status</dt>
            <dd><Badge color={statusColor(quotation.status)}>{formatStatus(quotation.status)}</Badge></dd>
          </dl>
        </SectionCard>
        <SectionCard title="Revision History" subtitle={`${chain.length} revision(s)`}>
          <ul className="space-y-2 text-sm">
            {chain.map((q) => (
              <li key={q.id} className="flex items-center justify-between border-b border-erp-border pb-2">
                <Link to={crmQuotationPath(q.id)} className={q.id === quotation.id ? 'font-semibold text-erp-primary' : 'text-erp-text hover:underline'}>
                  Rev {q.revisionNo} {q.locked ? '(locked)' : q.isLatestRevision ? '(latest)' : ''}
                </Link>
                <span>{formatCurrency(q.pricing.grandTotal)}</span>
              </li>
            ))}
          </ul>
          {quotation.isLatestRevision && quotation.status !== 'converted' && quotation.customerApproval !== 'approved' && (
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-erp-border pt-4">
              <label className="text-sm">
                New unit price (₹)
                <input
                  className="erp-input mt-1 block w-36"
                  placeholder={String(quotation.pricing.unitPrice)}
                  value={revPrice}
                  onChange={(e) => setRevPrice(e.target.value)}
                />
              </label>
              <Button
                size="sm"
                onClick={() => {
                  const r = createQuotationRevision(quotation.id, {
                    unitPrice: revPrice ? Number(revPrice) : undefined,
                    summary: revPrice ? `Price revised to ₹${revPrice}` : 'Terms revised',
                  })
                  if (r.ok && r.quotationId) navigate(crmQuotationPath(r.quotationId))
                  else setToast(r.error ?? 'Failed')
                }}
              >
                Create Rev {quotation.revisionNo + 1}
              </Button>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Change Log" className="mt-4">
        <ul className="space-y-2 text-sm">
          {quotation.changeHistory.map((c) => (
            <li key={`${c.revisionNo}-${c.changedAt}`}>
              <span className="font-medium">Rev {c.revisionNo}</span> · {c.summary} · {c.changedByName} · {formatDate(c.changedAt.slice(0, 10))}
            </li>
          ))}
        </ul>
      </SectionCard>
      {toast && <Toast message={toast} />}
    </div>
  )
}

const CRM_SO_FILTER_FIELDS: CrmFilterField[] = [
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'pending_so', label: 'Pending SO' },
      { value: 'open', label: 'Draft SO' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'in_production', label: 'In Production' },
      { value: 'ready_dispatch', label: 'Dispatch Ready' },
      { value: 'dispatched', label: 'Dispatched' },
      { value: 'invoiced', label: 'Invoiced' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  {
    type: 'select',
    key: 'source',
    label: 'Source',
    options: [
      { value: 'quotation', label: 'Quotation' },
      { value: 'direct', label: 'Direct' },
    ],
  },
]

const SALES_ORDER_SORT_OPTIONS: { value: SalesOrderSortKey; label: string }[] = [
  { value: 'orderDate', label: 'Sort: Order Date' },
  { value: 'requiredDate', label: 'Sort: Required Date' },
  { value: 'value', label: 'Sort: Order Value' },
  { value: 'customer', label: 'Sort: Customer' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'soNo', label: 'Sort: SO Number' },
]

export function SalesOrderListPage({ crmMode = false }: { crmMode?: boolean } = {}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const salesOrders = useMrpStore((s) => s.salesOrders) ?? []
  const deleteSalesOrderDraft = useMrpStore((s) => s.deleteSalesOrderDraft)
  const triggerProduction = useSalesStore((s) => s.triggerProductionForOrder)
  const quotations = useSalesStore((s) => s.quotations) ?? []
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments) ?? []
  const opportunities = useCrmStore((s) => s.opportunities) ?? []
  const { customerName, productName, products } = useMasterLabels()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const pendingApprovals = useMemo(
    () => quotationDocuments.filter((d) => d.status === 'pending_approval').length,
    [quotationDocuments],
  )
  const pendingHandoverRows = useMemo(
    () => listPendingQuotationSoHandovers({
      quotationDocuments,
      quotations,
      opportunities,
      salesOrders,
    }),
    [quotationDocuments, quotations, opportunities, salesOrders],
  )
  const registerRows = useMemo(
    () => [...pendingHandoverRows, ...salesOrders],
    [pendingHandoverRows, salesOrders],
  )
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SalesOrderSortKey>('orderDate')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    if (status) setStatusFilter(status)
    if (source) setSourceFilter(source)
  }, [searchParams])

  const soFiltersRecord = useMemo(
    () => ({ search, status: statusFilter, source: sourceFilter, sortBy }),
    [search, statusFilter, sourceFilter, sortBy],
  )

  const applySoFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setStatusFilter(saved.status ?? '')
    setSourceFilter(saved.source ?? '')
    const sb = saved.sortBy
    if (
      sb === 'orderDate' || sb === 'requiredDate' || sb === 'value'
      || sb === 'customer' || sb === 'status' || sb === 'soNo'
    ) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: crmMode ? '/crm/sales-orders' : '/sales/orders',
    filters: soFiltersRecord,
    onApply: applySoFilters,
    systemPresets: SALES_ORDER_REGISTER_PRESETS,
  })

  const fromQuotation = salesOrders.filter((o) => o.source === 'quotation' || Boolean(o.quotationId)).length
  const directOrders = salesOrders.filter((o) => o.source === 'direct' && !o.quotationId).length
  const draftCount = salesOrders.filter((o) => o.status === 'open').length
  const confirmedCount = salesOrders.filter((o) => o.status === 'confirmed').length
  const pendingSoCount = pendingHandoverRows.length
  const totalValue = registerRows.reduce(
    (s, o) => s + resolveSalesOrderValue(o, products.find((p) => p.id === o.productId)),
    0,
  )

  const filtered = useMemo(() => {
    let list = [...registerRows]
    if (statusFilter) list = list.filter((o) => o.status === statusFilter)
    if (sourceFilter === 'quotation') {
      list = list.filter((o) => o.source === 'quotation' || Boolean(o.quotationId))
    }
    if (sourceFilter === 'direct') {
      list = list.filter((o) => o.source === 'direct' && !o.quotationId && !isPendingSalesOrderHandover(o))
    }
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.salesOrderNo.toLowerCase().includes(s) ||
          customerName(o.customerId).toLowerCase().includes(s) ||
          productName(o.productId).toLowerCase().includes(s) ||
          (o.quotationNo ?? '').toLowerCase().includes(s) ||
          (o.customerPoNumber ?? '').toLowerCase().includes(s),
      )
    }
    return list
  }, [registerRows, statusFilter, sourceFilter, search, customerName, productName])

  const sorted = useMemo(() => {
    const resolveValue = (so: SalesOrder) =>
      resolveSalesOrderValue(so, products.find((p) => p.id === so.productId))
    return sortSalesOrders(filtered, sortBy, resolveValue, customerName)
  }, [filtered, sortBy, products, customerName])

  const crmFilterDrawer = useCrmFilterDrawer({
    values: { search, status: statusFilter, source: sourceFilter },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') setStatusFilter(next.status)
      if (typeof next.source === 'string') setSourceFilter(next.source)
    },
    fields: CRM_SO_FILTER_FIELDS,
    defaults: { search: '', status: '', source: '' },
    chipLabelResolver: (key, value) => {
      if (key === 'status') {
        if (value === PENDING_SO_STATUS) return 'Pending SO'
        if (value === 'open') return 'Draft SO'
        return formatStatus(value)
      }
      if (key === 'source') return `Source: ${value}`
      return undefined
    },
  })

  const clearCrmFilters = useCallback(() => {
    crmFilterDrawer.clearAll()
    setSortBy('orderDate')
  }, [crmFilterDrawer])

  const hasActiveCrmSoFilters = useMemo(
    () => Boolean(search.trim() || statusFilter || sourceFilter),
    [search, statusFilter, sourceFilter],
  )

  const salesOrderKpiStrip = useMemo(
    () =>
      buildSalesOrderRegisterKpis({
        total: salesOrders.length + pendingSoCount,
        draftCount,
        confirmedCount,
        pendingSoCount,
        fromQuotation,
        directOrders,
        totalValue,
        filters: { status: statusFilter, source: sourceFilter },
        onFilter: (patch) => {
          if (patch.status !== undefined) setStatusFilter(patch.status)
          if (patch.source !== undefined) setSourceFilter(patch.source)
        },
      }),
    [
      salesOrders.length,
      pendingSoCount,
      draftCount,
      confirmedCount,
      fromQuotation,
      directOrders,
      totalValue,
      statusFilter,
      sourceFilter,
    ],
  )

  function openSalesOrderPreview(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      const product = products.find((p) => p.id === so.productId)
      const value = resolveSalesOrderValue(so, product)
      openDetailPanel({
        title: so.quotationNo ?? so.salesOrderNo,
        subtitle: customerName(so.customerId),
        fields: [
          { label: 'Status', value: 'Pending SO' },
          { label: 'Fulfillment', value: 'Awaiting SO' },
          { label: 'Company', value: customerName(so.customerId) },
          { label: 'Product', value: productName(so.productId) },
          { label: 'Qty', value: formatNumber(so.qty) },
          { label: 'Value', value: value > 0 ? formatCurrency(value) : '—' },
          { label: 'Source', value: 'Won / approved quotation' },
          { label: 'Quotation', value: so.quotationNo ? `${so.quotationNo} Rev ${so.quotationRevisionNo ?? 1}` : '—' },
        ],
        links: [
          ...(so.quotationId
            ? [{ label: 'Open Quotation', href: crmQuotationPath(so.quotationId) }]
            : []),
        ],
        timeline: [
          {
            id: 'status',
            label: 'Pending SO',
            time: formatDate(so.orderDate ?? so.createdAt),
            status: 'current',
          },
        ],
        aiSummary: `Approved quotation ${so.quotationNo ?? ''} for ${customerName(so.customerId)} is awaiting sales order conversion (${value > 0 ? formatCurrency(value) : 'TBD'}).`,
        actions: [
          {
            label: 'Create Sales Order',
            onClick: () => navigate(buildPendingSoCreateUrl(so, { fromCrm: crmMode })),
            primary: true,
          },
          ...(so.quotationId
            ? [{ label: 'View Quotation', onClick: () => navigate(crmQuotationPath(so.quotationId!)) }]
            : []),
        ],
      })
      return
    }
    const product = products.find((p) => p.id === so.productId)
    const value = resolveSalesOrderValue(so, product)
    const woCount = workOrders.filter((w) => w.salesOrderId === so.id).length
    openDetailPanel({
      title: so.salesOrderNo,
      subtitle: customerName(so.customerId),
      fields: [
        { label: 'Status', value: salesOrderStatusLabel(so.status) },
        { label: 'Fulfillment', value: getSalesOrderFulfillmentLabel(so, workOrders) },
        { label: 'Company', value: customerName(so.customerId) },
        { label: 'Product', value: productName(so.productId) },
        { label: 'Qty', value: formatNumber(so.qty) },
        { label: 'Required', value: formatDate(so.requiredDate) },
        { label: 'SO Date', value: formatDate(so.orderDate ?? so.createdAt) },
        { label: 'Value', value: value > 0 ? formatCurrency(value) : '—' },
        { label: 'Source', value: so.quotationId ? 'Quotation' : so.source === 'direct' ? 'Direct' : '—' },
        { label: 'Quotation', value: so.quotationNo ? `${so.quotationNo} Rev ${so.quotationRevisionNo ?? 1}` : '—' },
        { label: 'Customer PO', value: so.customerPoNumber ?? '—' },
        { label: 'Work orders', value: String(woCount) },
      ],
      links: [
        { label: crmMode ? 'Open CRM Sales Order' : 'Open Sales Order 360', href: resolveSalesOrderDetailPath(so.id, crmMode) },
        ...(so.quotationId
          ? [{
              label: crmMode ? 'CRM Quotation' : 'Quotation',
              href: crmQuotationPath(so.quotationId),
            }]
          : []),
      ],
      timeline: [
        {
          id: 'status',
          label: salesOrderStatusLabel(so.status),
          time: formatDate(so.requiredDate),
          status: 'current',
        },
      ],
      aiSummary: `${so.salesOrderNo} for ${customerName(so.customerId)} is ${salesOrderStatusLabel(so.status).toLowerCase()} worth ${value > 0 ? formatCurrency(value) : 'TBD'}. Fulfillment: ${getSalesOrderFulfillmentLabel(so, workOrders).toLowerCase()}.`,
      actions: [
        { label: 'Open 360', onClick: () => navigate(resolveSalesOrderDetailPath(so.id, crmMode)), primary: true },
        ...(so.status === 'open'
          ? [{ label: 'Edit', onClick: () => navigate(buildSalesOrderEditUrl(so.id, { fromCrm: crmMode })) }]
          : []),
      ],
    })
  }

  function handleDeleteSalesOrder(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) return
    void systemConfirm({
      title: 'Delete draft sales order?',
      description: `Delete draft ${so.salesOrderNo}? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    }).then((ok) => {
      if (!ok) return
      void (async () => {
        const { isApiMode } = await import('../../config/apiConfig')
        if (isApiMode()) {
          const { apiDeleteSalesOrder } = await import('../../services/bridges/salesOrderApiBridge')
          const r = await apiDeleteSalesOrder(so.id)
          setToast(r.ok ? `${so.salesOrderNo} deleted` : r.error ?? 'Delete failed')
          return
        }
        const r = deleteSalesOrderDraft(so.id)
        setToast(r.ok ? `${so.salesOrderNo} deleted` : r.error ?? 'Delete failed')
      })()
    })
  }

  function handlePrintSalesOrder(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      if (so.quotationId) navigate(crmQuotationPath(so.quotationId))
      return
    }
    navigate(resolveSalesOrderPrintPath(so.id, crmMode))
  }

  function handleCreateProforma(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      setToast('Create the sales order from this quotation before raising a proforma.')
      return
    }
    const active = useProformaInvoiceStore
      .getState()
      .proformaInvoices.find((p) => p.salesOrderId === so.id && p.status !== 'cancelled')
    if (active) {
      navigate(`/sales/proforma-invoices/${active.id}`)
      return
    }
    if (so.status === 'open') {
      setToast('Confirm the sales order before creating a proforma invoice.')
      return
    }
    if (so.status === 'closed') {
      setToast('Cannot create proforma for a closed sales order.')
      return
    }
    navigate(buildProformaNewUrl(so.id))
  }

  function handleConvertSalesOrder(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      navigate(buildPendingSoCreateUrl(so, { fromCrm: crmMode }))
      return
    }
    if (so.status === 'open') {
      navigate(`${resolveSalesOrderDetailPath(so.id, crmMode)}?confirm=1`)
      return
    }
    if (so.status === 'confirmed') {
      const r = triggerProduction(so.id)
      setToast(r.ok ? `Production triggered for ${so.salesOrderNo}` : r.error ?? 'Convert failed')
      return
    }
    navigate(resolveSalesOrderDetailPath(so.id, crmMode))
  }

  function handleDuplicateSalesOrder(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      navigate(buildPendingSoCreateUrl(so, { fromCrm: crmMode }))
      return
    }
    // Duplicate is always a Sales-side create — never a CRM blank Direct funnel bypass.
    const params = new URLSearchParams({
      customerId: so.customerId,
      productId: so.productId || '',
      qty: String(so.qty),
    })
    if (so.quotationId) params.set('quotationId', so.quotationId)
    navigate(`/sales/orders/new?${params.toString()}`)
  }

  function handleViewSalesOrder(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      if (so.quotationId) navigate(crmQuotationPath(so.quotationId))
      else navigate(buildPendingSoCreateUrl(so, { fromCrm: crmMode }))
      return
    }
    navigate(resolveSalesOrderDetailPath(so.id, crmMode))
  }

  function handleEditSalesOrder(so: SalesOrder) {
    if (isPendingSalesOrderHandover(so)) {
      navigate(buildPendingSoCreateUrl(so, { fromCrm: crmMode }))
      return
    }
    navigate(buildSalesOrderEditUrl(so.id, { fromCrm: crmMode }))
  }

  function exportSelectedSalesOrders(selected: SalesOrder[]) {
    exportRowsToCsv(
      'sales-orders-selected',
      ['SO No', 'Customer', 'Product', 'Qty', 'Status', 'Value'],
      selected.map((so) => {
        const product = products.find((p) => p.id === so.productId)
        const value = resolveSalesOrderValue(so, product)
        return [
          so.salesOrderNo,
          customerName(so.customerId),
          productName(so.productId),
          so.qty,
          so.status,
          value,
        ]
      }),
    )
  }

  const listTitle = crmMode ? 'CRM Sales Orders' : 'Sales Orders'
  const listPath = crmMode ? '/crm/sales-orders' : '/sales/orders'
  const moduleBadge = crmMode ? 'CRM' : 'Sales'
  const listBreadcrumbs = crmMode
    ? crmModuleBreadcrumbs(listTitle, listPath)
    : salesModuleBreadcrumbs(listTitle, listPath)

  return (
    <OperationalPageShell
      title={listTitle}
      description={
        crmMode
          ? 'CRM sales orders — create from quotation or directly when customer and items exist. Fulfilment, MRP, and dispatch live under Sales → Sales Orders.'
          : 'Sales fulfilment — confirm orders, MRP, production, and dispatch (CRM → Sales Orders is the commercial register).'
      }
      favoritePath={listPath}
      badge={moduleBadge}
      variant="dynamics"
      autoBreadcrumbs={false}
      breadcrumbs={listBreadcrumbs}
      pageGuide={
        crmMode
          ? {
              purpose: 'CRM sales orders — create from an approved quotation or directly when the customer and product lines exist. Fulfilment lives under Sales → Sales Orders.',
              nextStep: 'Use New Sales Order for a direct draft (customer + items), or Create from Quotation for pipeline handover.',
            }
          : {
              purpose: 'Sales order fulfilment — confirm orders, run MRP, production, and dispatch. CRM → Sales Orders is the commercial register.',
              nextStep: 'Confirm an open SO, then run MRP for production planning.',
            }
      }
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'new-so',
            label: 'New Sales Order',
            icon: Plus,
            onClick: () => navigate(crmMode ? buildBlankSalesOrderNewUrl({ fromCrm: true }) : '/sales/orders/new'),
          }}
          secondaryActions={
            crmMode
              ? [
                  {
                    id: 'from-quotation',
                    label: 'Create from Quotation',
                    icon: FileText,
                    onClick: () => navigate(CRM_QUOTATIONS_PATH),
                  },
                  { id: 'opportunities', label: 'Opportunities', icon: Handshake, onClick: () => navigate('/crm/opportunities') },
                ]
              : [
                  { id: 'quotations', label: 'Quotations', icon: FileText, onClick: () => navigate(CRM_QUOTATIONS_PATH) },
                  { id: 'opportunities', label: 'Opportunities', icon: Handshake, onClick: () => navigate('/crm/opportunities') },
                  {
                    id: 'approvals',
                    label: pendingApprovals > 0 ? `Approvals (${pendingApprovals})` : 'Approvals',
                    icon: Handshake,
                    onClick: () => navigate(CRM_QUOTATIONS_PENDING_APPROVAL_PATH),
                  },
                ]
          }
          moreActions={[
            { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
          ]}
        />
      }
      kpiStrip={salesOrderKpiStrip}
    >
      <EnterpriseRegisterTableShell>
        <SalesOrdersTable
          rows={sorted}
          crmMode={crmMode}
          search={search}
          onSearchChange={setSearch}
          showCompactSearch={false}
          hasActiveFilters={hasActiveCrmSoFilters}
          onClearFilters={clearCrmFilters}
          registerFilter={{
            search,
            onSearchChange: setSearch,
            searchPlaceholder: 'Search SO, customer, product, PO…',
            activeFilterCount: crmFilterDrawer.activeCount,
            onOpenFilters: crmFilterDrawer.openDrawer,
            chips: crmFilterDrawer.chips,
            onRemoveChip: crmFilterDrawer.removeChip,
            onClearAll: clearCrmFilters,
            savedView: savedViews.activeView,
            onSavedViewChange: savedViews.selectView,
            savedViews: savedViews.viewNames,
            onSaveView: savedViews.openSaveDialog,
            sort: (
              <CrmListSortSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as SalesOrderSortKey)}
                aria-label="Sort sales orders"
                options={SALES_ORDER_SORT_OPTIONS}
              />
            ),
          }}
          emptyAction={
            sorted.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="erp-btn erp-btn--primary text-[13px]"
                  onClick={() => navigate(crmMode ? buildBlankSalesOrderNewUrl({ fromCrm: true }) : '/sales/orders/new')}
                >
                  New Sales Order
                </button>
                {crmMode ? (
                  <button
                    type="button"
                    className="erp-btn erp-btn--secondary text-[13px]"
                    onClick={() => navigate(CRM_QUOTATIONS_PATH)}
                  >
                    Create from Quotation
                  </button>
                ) : null}
                {hasActiveCrmSoFilters ? (
                  <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearCrmFilters}>
                    Clear Filters
                  </button>
                ) : null}
              </div>
            ) : undefined
          }
          onView={handleViewSalesOrder}
          onEdit={handleEditSalesOrder}
          onPreview={openSalesOrderPreview}
          onBulkExport={exportSelectedSalesOrders}
          onDelete={handleDeleteSalesOrder}
          onPrint={handlePrintSalesOrder}
          onConvert={handleConvertSalesOrder}
          onDuplicate={handleDuplicateSalesOrder}
          onCreateProforma={handleCreateProforma}
        />
      </EnterpriseRegisterTableShell>
      {toast ? <Toast message={toast} /> : null}
      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
      <CrmFilterDrawer
        open={crmFilterDrawer.open}
        onClose={crmFilterDrawer.closeDrawer}
        fields={CRM_SO_FILTER_FIELDS}
        values={crmFilterDrawer.draft}
        onChange={(next) => crmFilterDrawer.setDraft({ ...crmFilterDrawer.draft, ...next })}
        onApply={crmFilterDrawer.applyFilters}
        onReset={crmFilterDrawer.resetDraft}
      />
    </OperationalPageShell>
  )
}

export { SalesOrder360Page as SalesOrderDetailPage } from './SalesOrder360Page'

export { Customer360HubPage, SalesCustomersRouteLayout } from './Customer360HubPage'
