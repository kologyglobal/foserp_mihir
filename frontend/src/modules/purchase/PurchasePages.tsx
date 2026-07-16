import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileText, PackageCheck, Plus, Printer, RefreshCw, Share2, ShoppingCart, SlidersHorizontal, Truck } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../../components/tables/DataTable'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar } from '../../components/design-system/SmartFilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Select } from '../../components/forms/Inputs'
import { useUIStore } from '../../store/uiStore'
import { SectionCard } from '../../components/ui/SectionCard'
import { StatCard } from '../../components/ui/StatCard'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { TableLink } from '../../components/ui/AppLink'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'
import type { PurchaseOrder, PurchaseRequisition, RequestForQuotation } from '../../types/purchase'
import { MANUAL_PR_PURPOSE_LABELS, PR_SOURCE_LABELS } from '../../types/purchase'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { downloadTextFile, exportPurchaseOrderListTsv } from '../../utils/purchaseOrderExport'
import { prStatusLabel, poStatusLabel } from '../../utils/purchaseStatusLabels'
import { PurchaseOrderDocumentPage } from './PurchaseDocumentPages'
import { PurchaseRequisitionDomainDetailPage } from './PurchaseRequisitionDomainDetailPage'

export { PurchaseRequisitionListPage } from './PurchaseRequisitionListPage'
export { RfqListPage } from './RfqListPage'
export { RfqDetailPage } from './RfqDetailPage'

export function PurchaseDashboardPage() {
  const navigate = useNavigate()
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const grns = usePurchaseStore((s) => s.grns)
  const rfqs = usePurchaseStore((s) => s.rfqs)

  return (
    <div className="erp-page">
      <PageHeader
        title="Purchase Hub"
        description="Procurement flow â€” PR â†’ RFQ â†’ vendor comparison â†’ PO â†’ GRN with inventory posting."
        breadcrumbs={[
          { label: 'Home', to: '/masters' },
          { label: 'Purchase', to: '/purchase' },
          { label: 'Purchase Hub' },
        ]}
        commandBar={
          <CommandBar>
            <CommandBarGroup label="Actions">
              <CommandBarButton icon={Plus} label="Create Manual PR" onClick={() => navigate('/purchase/requisitions/new')} primary />
            </CommandBarGroup>
            <CommandBarGroup label="Navigate">
              <CommandBarButton icon={FileText} label="Requisitions" onClick={() => navigate('/purchase/requisitions')} />
              <CommandBarButton icon={Truck} label="Orders" onClick={() => navigate('/purchase/orders')} />
            </CommandBarGroup>
          </CommandBar>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Requisitions"
          value={requisitions.length}
          icon={FileText}
          accent="blue"
          helper="MRP + manual PRs"
          onClick={() => navigate('/purchase/requisitions')}
        />
        <StatCard title="RFQs" value={rfqs.length} icon={ShoppingCart} accent="purple" helper="Vendor quotes" />
        <StatCard
          title="Purchase Orders"
          value={purchaseOrders.length}
          icon={Truck}
          accent="green"
          helper="Released to vendors"
          onClick={() => navigate('/purchase/orders')}
        />
        <StatCard title="GRNs Posted" value={grns.length} icon={PackageCheck} accent="amber" helper="Stock received" />
      </div>

      <SectionCard title="Recent Requisitions" subtitle="MRP and manual purchase requests" noPadding>
        <PrTable data={requisitions.slice(0, 10)} />
      </SectionCard>
    </div>
  )
}

function sourceBadgeColor(source: PurchaseRequisition['source']): 'blue' | 'orange' | 'purple' {
  if (source === 'mrp') return 'blue'
  if (source === 'reorder') return 'orange'
  return 'purple'
}

function PrTable({ data }: { data: PurchaseRequisition[] }) {
  const columns: ColumnDef<PurchaseRequisition, unknown>[] = [
    {
      accessorKey: 'prNo',
      header: 'PR No',
      cell: ({ row }) => (
        <TableLink to={`/purchase/requisitions/${row.original.id}`}>{row.original.prNo}</TableLink>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge color={sourceBadgeColor(row.original.source)}>{PR_SOURCE_LABELS[row.original.source]}</Badge>
          {row.original.purpose && (
            <Badge color="gray">{MANUAL_PR_PURPOSE_LABELS[row.original.purpose]}</Badge>
          )}
        </div>
      ),
    },
    { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => row.original.salesOrderNo ?? 'â€”' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{prStatusLabel(row.original.status)}</Badge>,
    },
    { accessorKey: 'lines', header: 'Lines', cell: ({ row }) => row.original.lines.length, meta: { align: 'right' } },
    { accessorKey: 'requestedBy', header: 'Requested By' },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt.slice(0, 10)) },
  ]
  return (
    <DataTable
      data={data}
      columns={columns}
      emptyMessage="No purchase requisitions yet. Run MRP or create a manual PR for office supplies, emergency material, maintenance parts, or tooling."
    />
  )
}

export function PurchaseRequisitionDetailPage() {
  return <PurchaseRequisitionDomainDetailPage mode="view" />
}

const PO_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'PO Draft' },
  { value: 'submitted', label: 'Awaiting PO Approval' },
  { value: 'approved', label: 'PO Approved' },
  { value: 'released', label: 'PO Released' },
  { value: 'sent', label: 'Awaiting Vendor Confirmation' },
  { value: 'partial', label: 'Material Partially Delivered' },
  { value: 'received', label: 'Material Delivered' },
  { value: 'amended', label: 'PO Amended' },
  { value: 'closed', label: 'Purchase Order Closed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

const PO_SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'manual', label: 'Manual PO' },
  { value: 'pr', label: 'From PR' },
  { value: 'rfq', label: 'From RFQ' },
] as const

function poAmount(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + l.qty * l.rate, 0)
}

function poOpenQty(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + Math.max(0, l.qty - l.receivedQty), 0)
}

function poReceiptPct(po: PurchaseOrder): number {
  const ordered = po.lines.reduce((s, l) => s + l.qty, 0)
  const received = po.lines.reduce((s, l) => s + l.receivedQty, 0)
  return ordered > 0 ? Math.round((received / ordered) * 100) : 0
}

function poSourceLabel(po: PurchaseOrder): string {
  if (po.rfqId) return 'From RFQ'
  if (po.prId) return 'From PR'
  return 'Manual'
}

function poSourceKey(po: PurchaseOrder): 'manual' | 'pr' | 'rfq' {
  if (po.rfqId) return 'rfq'
  if (po.prId) return 'pr'
  return 'manual'
}

function isPoOverdue(po: PurchaseOrder): boolean {
  if (['closed', 'cancelled', 'received'].includes(po.status)) return false
  return po.expectedDate < new Date().toISOString().slice(0, 10)
}

function PurchaseOrderTable({
  data,
  prById,
  rfqById,
  getVendor,
  selectedRowId,
  onRowSelect,
  onRowQuickView,
  onRowView,
  onRowPrint,
  onExport,
}: {
  data: PurchaseOrder[]
  prById: Map<string, PurchaseRequisition>
  rfqById: Map<string, RequestForQuotation>
  getVendor: ReturnType<typeof useMasterStore.getState>['getVendor']
  selectedRowId?: string | null
  onRowSelect?: (row: PurchaseOrder) => void
  onRowQuickView?: (row: PurchaseOrder) => void
  onRowView?: (row: PurchaseOrder) => void
  onRowPrint?: (row: PurchaseOrder) => void
  onExport?: () => void
}) {
  const columns = useMemo<ColumnDef<PurchaseOrder, unknown>[]>(
    () => [
      {
        accessorKey: 'poNo',
        header: 'No.',
        meta: { columnLabel: 'PO No.' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/orders/${row.original.id}`} className="erp-cell-key font-mono text-[13px]">
            {row.original.poNo}
          </TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot label={poStatusLabel(row.original.status)} tone={statusToneFromLabel(row.original.status)} />
        ),
      },
      {
        accessorKey: 'vendorId',
        header: 'Vendor Name',
        meta: { columnLabel: 'Vendor' },
        cell: ({ row }) => {
          const vendor = getVendor(row.original.vendorId)
          return (
            <span className="block max-w-[180px] truncate" title={vendor?.vendorName}>
              {vendor?.vendorName ?? 'â€”'}
            </span>
          )
        },
      },
      {
        id: 'vendorCode',
        header: 'Vendor No.',
        meta: { columnLabel: 'Vendor No.' },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-erp-muted">{getVendor(row.original.vendorId)?.vendorCode ?? 'â€”'}</span>
        ),
      },
      {
        accessorKey: 'orderDate',
        header: 'Order Date',
        meta: { columnLabel: 'Order Date' },
        cell: ({ row }) => formatDate(row.original.orderDate),
      },
      {
        accessorKey: 'expectedDate',
        header: 'Expected Receipt',
        meta: { columnLabel: 'Expected Receipt' },
        cell: ({ row }) => {
          const overdue = isPoOverdue(row.original)
          return (
            <span className={cn(overdue && 'font-semibold text-erp-danger')}>
              {formatDate(row.original.expectedDate)}
            </span>
          )
        },
      },
      {
        id: 'prRef',
        header: 'PR No.',
        meta: { columnLabel: 'PR No.' },
        cell: ({ row }) => {
          const pr = row.original.prId ? prById.get(row.original.prId) : undefined
          return pr ? <TableLink to={`/purchase/requisitions/${pr.id}`}>{pr.prNo}</TableLink> : 'â€”'
        },
      },
      {
        id: 'rfqRef',
        header: 'RFQ No.',
        meta: { columnLabel: 'RFQ No.' },
        cell: ({ row }) => {
          const rfq = row.original.rfqId ? rfqById.get(row.original.rfqId) : undefined
          return rfq ? <TableLink to={`/purchase/rfqs/${rfq.id}`}>{rfq.rfqNo}</TableLink> : 'â€”'
        },
      },
      {
        accessorKey: 'revisionNo',
        header: 'Rev.',
        meta: { align: 'center', columnLabel: 'Revision' },
        cell: ({ row }) => row.original.revisionNo,
      },
      {
        id: 'lines',
        header: 'Lines',
        meta: { align: 'right', columnLabel: 'Lines' },
        cell: ({ row }) => row.original.lines.length,
      },
      {
        id: 'amount',
        header: 'Amount',
        meta: { align: 'right', columnLabel: 'Amount' },
        cell: ({ row }) => formatCurrency(poAmount(row.original)),
      },
      {
        id: 'receivedPct',
        header: 'Received %',
        meta: { align: 'right', columnLabel: 'Received %' },
        cell: ({ row }) => `${poReceiptPct(row.original)}%`,
      },
      {
        id: 'openQty',
        header: 'Open Qty',
        meta: { align: 'right', columnLabel: 'Open Qty' },
        cell: ({ row }) => formatNumber(poOpenQty(row.original)),
      },
      {
        id: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        cell: ({ row }) => poSourceLabel(row.original),
      },
      {
        accessorKey: 'paymentTerms',
        header: 'Payment Terms',
        meta: { columnLabel: 'Payment Terms' },
        cell: ({ row }) => row.original.paymentTerms || 'Net 30',
      },
      {
        accessorKey: 'createdByName',
        header: 'Created By',
        meta: { columnLabel: 'Created By' },
      },
      {
        accessorKey: 'approvedByName',
        header: 'Approved By',
        meta: { columnLabel: 'Approved By' },
        cell: ({ row }) => row.original.approvedByName ?? 'â€”',
      },
      {
        accessorKey: 'sentAt',
        header: 'Sent Date',
        meta: { columnLabel: 'Sent Date' },
        cell: ({ row }) => (row.original.sentAt ? formatDate(row.original.sentAt) : 'â€”'),
      },
    ],
    [getVendor, prById, rfqById],
  )

  return (
    <DataTable
      data={data}
      columns={columns}
      stickyFirstColumn
      zebra
      selectable
      getRowId={(po) => po.id}
      toolbar="compact"
      showCompactSearch={false}
      pageSize={50}
      showPagination
      selectedRowId={selectedRowId}
      onRowSelect={onRowSelect}
      onRowQuickView={onRowQuickView}
      onRowView={onRowView}
      onRowPrint={onRowPrint}
      onExport={onExport}
      showToolbarExport
      emptyMessage="No purchase orders match your filters. Create PO from PR, RFQ award, or manually â€” then approve and release."
      exportFileName="purchase-orders"
    />
  )
}

export function PurchaseOrderListPage() {
  const navigate = useNavigate()
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const rfqs = usePurchaseStore((s) => s.rfqs)
  const getVendor = useMasterStore((s) => s.getVendor)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [savedView, setSavedView] = useState('All Purchase Orders')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const prById = useMemo(() => new Map(requisitions.map((p) => [p.id, p])), [requisitions])
  const rfqById = useMemo(() => new Map(rfqs.map((r) => [r.id, r])), [rfqs])

  const delayedCount = useMemo(
    () => purchaseOrders.filter((p) => isPoOverdue(p)).length,
    [purchaseOrders, refreshKey],
  )

  const totalValue = useMemo(
    () => purchaseOrders.reduce((s, p) => s + poAmount(p), 0),
    [purchaseOrders, refreshKey],
  )

  const openPoValue = useMemo(
    () =>
      purchaseOrders
        .filter((p) => !['closed', 'cancelled'].includes(p.status))
        .reduce((s, p) => s + poAmount(p), 0),
    [purchaseOrders, refreshKey],
  )

  const filtered = useMemo(() => {
    let list = [...purchaseOrders]
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    if (sourceFilter) list = list.filter((p) => poSourceKey(p) === sourceFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((p) => {
        const vendor = getVendor(p.vendorId)
        const pr = p.prId ? prById.get(p.prId) : undefined
        const rfq = p.rfqId ? rfqById.get(p.rfqId) : undefined
        return (
          p.poNo.toLowerCase().includes(s) ||
          (vendor?.vendorName ?? '').toLowerCase().includes(s) ||
          (vendor?.vendorCode ?? '').toLowerCase().includes(s) ||
          (pr?.prNo ?? '').toLowerCase().includes(s) ||
          (rfq?.rfqNo ?? '').toLowerCase().includes(s) ||
          (p.createdByName ?? '').toLowerCase().includes(s)
        )
      })
    }
    list.sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.poNo.localeCompare(a.poNo))
    return list
  }, [purchaseOrders, statusFilter, sourceFilter, search, getVendor, prById, rfqById, refreshKey])

  const handleExport = useCallback(() => {
    const tsv = exportPurchaseOrderListTsv(filtered, { getVendor, prById, rfqById })
    downloadTextFile('purchase-orders.xls', tsv, 'application/vnd.ms-excel')
  }, [filtered, getVendor, prById, rfqById])

  function openQuickView(po: PurchaseOrder) {
    setSelectedRowId(po.id)
    const vendor = getVendor(po.vendorId)
    const pr = po.prId ? prById.get(po.prId) : undefined
    const rfq = po.rfqId ? rfqById.get(po.rfqId) : undefined
    const amount = poAmount(po)
    openDetailPanel({
      title: po.poNo,
      subtitle: vendor?.vendorName ?? po.vendorId,
      fields: [
        { label: 'Status', value: poStatusLabel(po.status) },
        { label: 'Vendor', value: vendor?.vendorName ?? 'â€”' },
        { label: 'Order Date', value: formatDate(po.orderDate) },
        { label: 'Expected', value: formatDate(po.expectedDate) },
        { label: 'Lines', value: String(po.lines.length) },
        { label: 'Amount', value: formatCurrency(amount) },
        { label: 'Received', value: `${poReceiptPct(po)}%` },
        { label: 'Open Qty', value: formatNumber(poOpenQty(po)) },
        { label: 'Source', value: poSourceLabel(po) },
        { label: 'PR Ref', value: pr?.prNo ?? 'â€”' },
        { label: 'RFQ Ref', value: rfq?.rfqNo ?? 'â€”' },
        { label: 'Revision', value: `Rev ${po.revisionNo}` },
        { label: 'Payment Terms', value: po.paymentTerms || 'Net 30' },
        { label: 'Approved By', value: po.approvedByName ?? 'â€”' },
      ],
      links: [
        { label: 'Open Purchase Order', href: `/purchase/orders/${po.id}` },
        { label: 'Print PO', href: `/purchase/orders/${po.id}/print` },
      ],
      timeline: [
        { id: 'created', label: 'Created', time: formatDate(po.createdAt), status: 'done' },
        { id: 'status', label: poStatusLabel(po.status), time: formatDate(po.orderDate), status: 'current' },
      ],
    })
  }

  return (
    <OperationalPageShell
      title="Purchase Orders"
      description="All purchase orders â€” vendor commitments, receipts, and open quantities"
      badge="Purchase"
      variant="dynamics"
      favoritePath="/purchase/orders"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={Plus} label="New PO" onClick={() => navigate('/purchase/orders/new')} primary />
            <CommandBarButton icon={FileText} label="From PR" onClick={() => navigate('/purchase/orders/new?mode=pr')} />
            <CommandBarButton icon={Download} label="Export Excel" onClick={handleExport} />
            <CommandBarButton icon={Printer} label="Print List" onClick={() => window.print()} />
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => setRefreshKey((k) => k + 1)} />
          </CommandBarGroup>
          <CommandBarGroup label="Navigate">
            <CommandBarButton icon={FileText} label="Requisitions" onClick={() => navigate('/purchase/requisitions')} />
            <CommandBarButton icon={ShoppingCart} label="RFQs" onClick={() => navigate('/purchase/rfqs')} />
            <CommandBarButton icon={PackageCheck} label="GRN Register" onClick={() => navigate('/purchase/grns')} />
          </CommandBarGroup>
          <CommandBarGroup label="Views">
            <CommandBarButton icon={SlidersHorizontal} label="Save View" onClick={() => setSavedView('All Purchase Orders')} />
            <CommandBarButton icon={Share2} label="Share View" onClick={() => undefined} />
          </CommandBarGroup>
        </CommandBar>
      }
      insights={[
        { label: 'Total POs', value: purchaseOrders.length, accent: 'blue' },
        { label: 'Open POs', value: purchaseOrders.filter((p) => !['closed', 'cancelled'].includes(p.status)).length, accent: 'green' },
        { label: 'Open Value', value: formatCurrency(openPoValue), accent: 'amber' },
        { label: 'Total Value', value: formatCurrency(totalValue), accent: 'slate' },
        { label: 'Delayed', value: delayedCount, accent: delayedCount > 0 ? 'red' : 'green' },
        { label: 'Awaiting Receipt', value: purchaseOrders.filter((p) => ['sent', 'partial', 'released'].includes(p.status)).length, accent: 'blue' },
      ]}
      filterBar={
        <SmartFilterBar
          chips={[
            ...(statusFilter ? [{ id: 'status', label: formatStatus(statusFilter) }] : []),
            ...(sourceFilter ? [{ id: 'source', label: PO_SOURCE_OPTIONS.find((o) => o.value === sourceFilter)?.label ?? sourceFilter }] : []),
            ...(search ? [{ id: 'search', label: `Search: ${search}` }] : []),
          ]}
          onRemoveChip={(id) => {
            if (id === 'status') setStatusFilter('')
            if (id === 'source') setSourceFilter('')
            if (id === 'search') setSearch('')
          }}
          onClearAll={() => {
            setStatusFilter('')
            setSourceFilter('')
            setSearch('')
          }}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={filtered.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search PO, vendor, PR, RFQâ€¦" className="w-full sm:w-72" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-44 text-[13px]">
            {PO_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 w-36 text-[13px]">
            {PO_SOURCE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </SmartFilterBar>
      }
    >
      <PurchaseOrderTable
        data={filtered}
        prById={prById}
        rfqById={rfqById}
        getVendor={getVendor}
        selectedRowId={selectedRowId}
        onRowSelect={(row) => setSelectedRowId(row.id)}
        onRowQuickView={openQuickView}
        onRowView={(po) => navigate(`/purchase/orders/${po.id}`)}
        onRowPrint={(po) => navigate(`/purchase/orders/${po.id}/print`)}
        onExport={handleExport}
      />
    </OperationalPageShell>
  )
}

export function PurchaseOrderDetailPage() {
  return <PurchaseOrderDocumentPage />
}
