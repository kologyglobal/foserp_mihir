import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { FileText, Plus, Printer, Send, XCircle, Download, FileSpreadsheet } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar } from '../../components/design-system/SmartFilterBar'
import { StatusDot } from '../../components/design-system/StatusDot'
import { DataTable } from '../../components/tables/DataTable'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCardSection, ErpFieldRow } from '../../components/erp/card-form'
import { SearchInput } from '../../components/ui/SearchInput'
import { Select } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { salesCustomer360Path } from '../../config/entity360Routes'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { useMasterStore } from '../../store/masterStore'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { buildProformaRegisterKpis } from '../../utils/salesModuleKpis'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  entNumericMeta,
} from '../../design-system/enterprise'
import type { ProformaInvoice, ProformaInvoiceSource, ProformaInvoiceStatus } from '../../types/proformaInvoice'
import { PROFORMA_STATUS_LABELS } from '../../types/proformaInvoice'
import { ProformaInvoiceDocument } from '../../components/sales/ProformaInvoiceDocument'
import { buildProformaNewUrl } from '../../utils/proformaInvoicePrefill'
import { downloadProformaExcel, downloadProformaPdf } from '../../utils/proformaInvoiceExport'
import type { StatusDotTone } from '../../components/design-system/StatusDot'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'

import { salesModuleBreadcrumbs, salesChildBreadcrumbs } from '../../utils/salesNavigation'

function proformaListBreadcrumbs() {
  return salesModuleBreadcrumbs('Proforma Invoices', '/sales/proforma-invoices')
}

function proformaDetailBreadcrumbs(title: string) {
  return salesChildBreadcrumbs('Proforma Invoices', '/sales/proforma-invoices', title)
}

function proformaStatusTone(status: ProformaInvoiceStatus): StatusDotTone {
  if (status === 'issued') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

function proformaSourceLabel(source: ProformaInvoiceSource): string {
  return source === 'sales_order' ? 'From SO' : 'Direct'
}

function isProformaExpired(pi: ProformaInvoice): boolean {
  if (pi.status !== 'issued') return false
  return pi.validUntil.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

function proformaTotalQty(pi: ProformaInvoice): number {
  return pi.lines.reduce((sum, line) => sum + line.qty, 0)
}

function truncateCell(value: string | null | undefined, max = 28): string {
  const text = (value ?? '').trim()
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function ProformaInvoiceTable({
  data,
  getCustomer,
  onRowView,
  onRowPrint,
}: {
  data: ProformaInvoice[]
  getCustomer: ReturnType<typeof useMasterStore.getState>['getCustomer']
  onRowView?: (row: ProformaInvoice) => void
  onRowPrint?: (row: ProformaInvoice) => void
}) {
  const columns = useMemo<ColumnDef<ProformaInvoice, unknown>[]>(
    () => [
      {
        accessorKey: 'proformaNo',
        header: 'No.',
        meta: { columnLabel: 'Proforma No.' },
        cell: ({ row }) => (
          <TableLink to={`/sales/proforma-invoices/${row.original.id}`}>
            <EnterpriseIdCell id={row.original.proformaNo} />
          </TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot
            label={PROFORMA_STATUS_LABELS[row.original.status]}
            tone={proformaStatusTone(row.original.status)}
          />
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer Name',
        meta: { columnLabel: 'Customer' },
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate" title={row.original.customerName}>
            <TableLink to={salesCustomer360Path(row.original.customerId)}>
              {row.original.customerName}
            </TableLink>
          </span>
        ),
      },
      {
        id: 'customerNo',
        header: 'Customer No.',
        meta: { columnLabel: 'Customer No.' },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-erp-muted">
            {getCustomer(row.original.customerId)?.customerCode ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'proformaDate',
        header: 'Document Date',
        meta: { columnLabel: 'Document Date' },
        cell: ({ row }) => formatDate(row.original.proformaDate),
      },
      {
        accessorKey: 'validUntil',
        header: 'Valid Until',
        meta: { columnLabel: 'Valid Until' },
        cell: ({ row }) => {
          const expired = isProformaExpired(row.original)
          return (
            <span className={cn(expired && 'font-semibold text-erp-danger')} title={expired ? 'Validity expired' : undefined}>
              {formatDate(row.original.validUntil)}
            </span>
          )
        },
      },
      {
        id: 'salesOrderNo',
        header: 'SO No.',
        meta: { columnLabel: 'Sales Order' },
        cell: ({ row }) =>
          row.original.salesOrderNo && row.original.salesOrderId
            ? <TableLink to={`/sales/orders/${row.original.salesOrderId}`}>{row.original.salesOrderNo}</TableLink>
            : '—',
      },
      {
        id: 'quotationNo',
        header: 'Quotation No.',
        meta: { columnLabel: 'Quotation' },
        cell: ({ row }) =>
          row.original.quotationNo && row.original.quotationId
            ? <TableLink to={`/crm/quotations/${row.original.quotationId}`}>{row.original.quotationNo}</TableLink>
            : '—',
      },
      {
        accessorKey: 'customerPoNumber',
        header: 'Customer PO',
        meta: { columnLabel: 'Customer PO' },
        cell: ({ row }) => row.original.customerPoNumber ?? '—',
      },
      {
        accessorKey: 'placeOfSupply',
        header: 'Place of Supply',
        meta: { columnLabel: 'Place of Supply' },
        cell: ({ row }) => truncateCell(row.original.placeOfSupply, 22),
      },
      {
        accessorKey: 'customerGstin',
        header: 'Customer GSTIN',
        meta: { columnLabel: 'GSTIN' },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-erp-muted">{row.original.customerGstin || '—'}</span>
        ),
      },
      {
        id: 'lines',
        header: 'Lines',
        meta: entNumericMeta('Lines'),
        cell: ({ row }) => <EnterpriseNumericCell value={row.original.lines.length} />,
      },
      {
        id: 'totalQty',
        header: 'Total Qty',
        meta: entNumericMeta('Total Qty'),
        cell: ({ row }) => <EnterpriseNumericCell value={formatNumber(proformaTotalQty(row.original))} />,
      },
      {
        id: 'taxableAmount',
        header: 'Amount Excl. Tax',
        meta: entNumericMeta('Amount Excl. Tax'),
        cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.gst.taxableAmount)} />,
      },
      {
        id: 'gstAmount',
        header: 'GST Amount',
        meta: entNumericMeta('GST Amount'),
        cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.gst.totalTax)} />,
      },
      {
        id: 'grandTotal',
        header: 'Amount Incl. Tax',
        meta: entNumericMeta('Amount Incl. Tax'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.gst.grandTotal)} className="font-semibold" />
        ),
      },
      {
        id: 'gstScheme',
        header: 'GST Scheme',
        meta: { columnLabel: 'GST Scheme' },
        cell: ({ row }) => gstSchemeLabel(row.original.gst.scheme),
      },
      {
        accessorKey: 'paymentTerms',
        header: 'Payment Terms',
        meta: { columnLabel: 'Payment Terms' },
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.paymentTerms}>
            {truncateCell(row.original.paymentTerms, 36)}
          </span>
        ),
      },
      {
        accessorKey: 'deliveryTerms',
        header: 'Delivery Terms',
        meta: { columnLabel: 'Delivery Terms' },
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.deliveryTerms}>
            {truncateCell(row.original.deliveryTerms, 36)}
          </span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        cell: ({ row }) => proformaSourceLabel(row.original.source),
      },
      {
        accessorKey: 'issuedAt',
        header: 'Issued Date',
        meta: { columnLabel: 'Issued Date' },
        cell: ({ row }) => (row.original.issuedAt ? formatDate(row.original.issuedAt.slice(0, 10)) : '—'),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        meta: { columnLabel: 'Created' },
        cell: ({ row }) => formatDate(row.original.createdAt.slice(0, 10)),
      },
    ],
    [getCustomer],
  )

  return (
    <DataTable
      data={data}
      columns={columns}
      stickyFirstColumn
      zebra
      toolbar="compact"
      showCompactSearch={false}
      showToolbarExport
      pageSize={50}
      showPagination
      getRowId={(row) => row.id}
      onRowView={onRowView}
      onRowPrint={onRowPrint}
      emptyMessage="No proforma invoices yet. Create one direct or from a sales order."
      exportFileName="proforma-invoices"
    />
  )
}

export function ProformaInvoiceListPage() {
  const navigate = useNavigate()
  const proformas = useProformaInvoiceStore((s) => s.proformaInvoices)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProformaInvoiceStatus | ''>('')
  const [sourceFilter, setSourceFilter] = useState<ProformaInvoiceSource | ''>('')

  const filtered = useMemo(() => {
    let list = [...proformas]
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    if (sourceFilter) list = list.filter((p) => p.source === sourceFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => {
        const customerCode = getCustomer(p.customerId)?.customerCode ?? ''
        return (
          p.proformaNo.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          customerCode.toLowerCase().includes(q) ||
          (p.salesOrderNo ?? '').toLowerCase().includes(q) ||
          (p.quotationNo ?? '').toLowerCase().includes(q) ||
          (p.customerPoNumber ?? '').toLowerCase().includes(q) ||
          (p.customerGstin ?? '').toLowerCase().includes(q) ||
          p.placeOfSupply.toLowerCase().includes(q)
        )
      })
    }
    return list.sort((a, b) => b.proformaDate.localeCompare(a.proformaDate) || b.proformaNo.localeCompare(a.proformaNo))
  }, [proformas, search, statusFilter, sourceFilter, getCustomer])

  const draftCount = proformas.filter((p) => p.status === 'draft').length
  const issuedCount = proformas.filter((p) => p.status === 'issued').length
  const expiredCount = proformas.filter((p) => isProformaExpired(p)).length
  const totalValue = proformas.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + p.gst.grandTotal, 0)

  const proformaInsights = useMemo(
    () =>
      buildProformaRegisterKpis(
        { total: proformas.length, draft: draftCount, issued: issuedCount, expired: expiredCount, totalValue },
        statusFilter,
        (s) => setStatusFilter(s as ProformaInvoiceStatus | ''),
      ),
    [proformas.length, draftCount, issuedCount, expiredCount, totalValue, statusFilter],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Sales"
      title="Proforma Invoices"
      description="Advance billing documents — create direct or from confirmed sales orders"
      breadcrumbs={proformaListBreadcrumbs()}
      autoBreadcrumbs={false}
      favoritePath="/sales/proforma-invoices"
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{ id: 'new', label: 'New Proforma', icon: Plus, onClick: () => navigate('/sales/proforma-invoices/new') }}
          secondaryActions={[
            { id: 'orders', label: 'Sales Orders', icon: FileText, onClick: () => navigate('/sales/orders') },
          ]}
        />
      )}
      kpiStrip={proformaInsights}
      filterBar={(
        <SmartFilterBar resultCount={filtered.length}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search no., customer, SO, quotation, PO, GSTIN…" className="w-72" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProformaInvoiceStatus | '')} className="h-9 w-36 text-[13px]">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as ProformaInvoiceSource | '')} className="h-9 w-36 text-[13px]">
            <option value="">All sources</option>
            <option value="direct">Direct</option>
            <option value="sales_order">From SO</option>
          </Select>
        </SmartFilterBar>
      )}
    >
      <ProformaInvoiceTable
        data={filtered}
        getCustomer={getCustomer}
        onRowView={(row) => navigate(`/sales/proforma-invoices/${row.id}`)}
        onRowPrint={(row) => navigate(`/sales/proforma-invoices/${row.id}/print`)}
      />
    </OperationalPageShell>
  )
}

export function ProformaInvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const proforma = useProformaInvoiceStore((s) => (id ? s.getProforma(id) : undefined))
  const issue = useProformaInvoiceStore((s) => s.issue)
  const cancel = useProformaInvoiceStore((s) => s.cancel)
  const [toast, setToast] = useState<string | null>(null)

  if (!proforma) {
    return (
      <OperationalPageShell title="Proforma not found" breadcrumbs={proformaDetailBreadcrumbs('Not Found')}>
        <Link to="/sales/proforma-invoices" className="text-sm font-semibold text-erp-primary">Back to register</Link>
      </OperationalPageShell>
    )
  }

  function act(label: string, fn: () => { ok: boolean; error?: string }) {
    const r = fn()
    setToast(r.ok ? label : (r.error ?? 'Action failed'))
  }

  return (
    <>
      <Toast message={toast} />
      <OperationalPageShell
        variant="dynamics"
        badge="Sales"
        title={proforma.proformaNo}
        description={`${proforma.customerName} · ${PROFORMA_STATUS_LABELS[proforma.status]}`}
        breadcrumbs={proformaDetailBreadcrumbs(proforma.proformaNo)}
        favoritePath={`/sales/proforma-invoices/${proforma.id}`}
        commandBar={(
          <ErpCommandBar
            sticky={false}
            primaryAction={
              proforma.status === 'draft'
                ? { id: 'issue', label: 'Issue Proforma', icon: Send, onClick: () => act('Proforma issued', () => issue(proforma.id)) }
                : { id: 'print', label: 'Print', icon: Printer, onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}/print`) }
            }
            secondaryActions={[
              { id: 'print', label: 'Print', icon: Printer, onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}/print`) },
              { id: 'pdf', label: 'Download PDF', icon: Download, onClick: () => downloadProformaPdf(proforma) },
              { id: 'excel', label: 'Export Excel', icon: FileSpreadsheet, onClick: () => downloadProformaExcel(proforma) },
              ...(proforma.status !== 'cancelled'
                ? [{ id: 'cancel', label: 'Cancel', icon: XCircle, onClick: () => act('Proforma cancelled', () => cancel(proforma.id)) }]
                : []),
              ...(proforma.salesOrderId
                ? [{ id: 'so', label: 'Sales Order', icon: FileText, onClick: () => navigate(`/sales/orders/${proforma.salesOrderId}`) }]
                : []),
            ]}
          />
        )}
        insights={[
          { label: 'Status', value: PROFORMA_STATUS_LABELS[proforma.status], accent: proforma.status === 'issued' ? 'green' : 'amber' },
          { label: 'Grand Total', value: formatCurrency(proforma.gst.grandTotal), accent: 'blue' },
          { label: 'Valid Until', value: formatDate(proforma.validUntil), accent: 'slate' },
          { label: 'Source', value: proforma.source === 'sales_order' ? 'From SO' : 'Direct', accent: 'slate' },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <ProformaInvoiceDocument proforma={proforma} />
          <aside className="space-y-4">
            <ErpCardSection title="Document links">
              {proforma.salesOrderId ? (
                <ErpFieldRow label="Sales Order">
                  <TableLink to={`/sales/orders/${proforma.salesOrderId}`}>{proforma.salesOrderNo}</TableLink>
                </ErpFieldRow>
              ) : null}
              {proforma.quotationId ? (
                <ErpFieldRow label="Quotation">
                  <TableLink to={`/crm/quotations/${proforma.quotationId}`}>{proforma.quotationNo ?? proforma.quotationId}</TableLink>
                </ErpFieldRow>
              ) : null}
              <ErpFieldRow label="Customer">
                <TableLink to={salesCustomer360Path(proforma.customerId)}>{proforma.customerName}</TableLink>
              </ErpFieldRow>
            </ErpCardSection>
            <ErpCardSection title="Export">
              <div className="col-span-2 flex flex-wrap gap-2">
                <ErpButton variant="secondary" icon={Printer} onClick={() => navigate(`/sales/proforma-invoices/${proforma.id}/print`)}>
                  Print
                </ErpButton>
                <ErpButton variant="secondary" icon={Download} onClick={() => downloadProformaPdf(proforma)}>
                  Download PDF
                </ErpButton>
                <ErpButton variant="secondary" icon={FileSpreadsheet} onClick={() => downloadProformaExcel(proforma)}>
                  Export Excel
                </ErpButton>
              </div>
            </ErpCardSection>
            <ErpCardSection title="Commercial">
              <ErpFieldRow label="Payment Terms" readOnly>{proforma.paymentTerms}</ErpFieldRow>
              <ErpFieldRow label="Delivery Terms" readOnly>{proforma.deliveryTerms}</ErpFieldRow>
              {proforma.customerPoNumber ? <ErpFieldRow label="Customer PO" readOnly>{proforma.customerPoNumber}</ErpFieldRow> : null}
            </ErpCardSection>
            {proforma.salesOrderId && proforma.status === 'draft' ? (
              <div className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-4 text-[12px] text-erp-muted">
                Need another proforma? Cancel this draft first, or create from a different sales order.
              </div>
            ) : null}
            {!proforma.salesOrderId ? (
              <ErpButton variant="secondary" className="w-full" onClick={() => navigate('/sales/proforma-invoices/new')}>
                Create another direct PI
              </ErpButton>
            ) : null}
          </aside>
        </div>
      </OperationalPageShell>
    </>
  )
}

export function ProformaInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const proforma = useProformaInvoiceStore((s) => (id ? s.getProforma(id) : undefined))

  if (!proforma) {
    return (
      <OperationalPageShell title="Proforma not found" breadcrumbs={proformaDetailBreadcrumbs('Print')}>
        <Link to="/sales/proforma-invoices" className="text-sm font-semibold text-erp-primary">Back</Link>
      </OperationalPageShell>
    )
  }

  return (
    <DocumentPrintShell
      title={proforma.proformaNo}
      subtitle="Proforma invoice — print-ready / Save as PDF"
      backLabel="Back to Proforma"
      onBack={() => navigate(`/sales/proforma-invoices/${proforma.id}`)}
      extraActions={
        <ErpButton type="button" variant="secondary" icon={FileSpreadsheet} onClick={() => downloadProformaExcel(proforma)}>
          Export Excel
        </ErpButton>
      }
    >
      <ProformaInvoiceDocument proforma={proforma} className="print:mx-auto print:max-w-[210mm]" />
    </DocumentPrintShell>
  )
}

export { buildProformaNewUrl }
