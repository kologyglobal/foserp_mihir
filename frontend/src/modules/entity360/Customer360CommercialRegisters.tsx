import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, Eye, Plus, Printer, Wallet } from 'lucide-react'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Entity360Panel } from '../../components/design-system/Entity360Shell'
import { ErpButton } from '../../components/erp/ErpButton'
import { TableLink } from '../../components/ui/AppLink'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRecordCell,
  EnterpriseRowActionsMenu,
  EnterpriseStatusChip,
  entNumericMeta,
} from '../../design-system/enterprise'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { DynamicsKpiRow, DynamicsKpiTile } from '../../components/dynamics/DynamicsKpiTile'
import {
  CRM_INVOICE_PAYMENT_STATUS_LABELS,
  CRM_PAYMENT_MODE_LABELS,
  CRM_RECEIPT_MIGRATION_STATUS_LABELS,
  CRM_TAX_INVOICE_STATUS_LABELS,
  type CrmPaymentAllocation,
  type CrmPaymentReceipt,
  type CrmTaxInvoice,
  type ProformaPaymentStatus,
} from '../../types/crmCommercial'
import { PROFORMA_STATUS_LABELS } from '../../types/proformaInvoice'
import type { ProformaInvoice } from '../../types/proformaInvoice'
import { cn } from '../../utils/cn'

function receiptAllocationStatus(receipt: CrmPaymentReceipt): {
  label: string
  status: string
} {
  if (receipt.unallocatedAmount <= 0.009) {
    return { label: 'Fully allocated', status: 'paid' }
  }
  if (receipt.amount - receipt.unallocatedAmount <= 0.009) {
    return { label: 'Unallocated', status: 'unpaid' }
  }
  return { label: 'Partially allocated', status: 'partially_paid' }
}

export function Customer360ProformaRegister({
  rows,
  getPaymentStatus,
}: {
  rows: ProformaInvoice[]
  getPaymentStatus: (proformaId: string) => ProformaPaymentStatus | null
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const columns = useMemo<ColumnDef<ProformaInvoice>[]>(
    () => [
      {
        id: 'proforma',
        header: 'Proforma',
        accessorKey: 'proformaNo',
        meta: { columnLabel: 'Proforma' },
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left"
            onClick={() => navigate(`/sales/proforma-invoices/${row.original.id}`)}
          >
            <EnterpriseIdCell id={row.original.proformaNo} />
            {row.original.salesOrderNo ? (
              <p className="mt-0.5 text-[11px] text-erp-muted">SO {row.original.salesOrderNo}</p>
            ) : null}
          </button>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <EnterpriseStatusChip
            label={PROFORMA_STATUS_LABELS[row.original.status] ?? row.original.status}
            status={row.original.status}
          />
        ),
      },
      {
        id: 'payment',
        header: 'Payment',
        accessorFn: (r) => getPaymentStatus(r.id) ?? '',
        meta: { columnLabel: 'Payment' },
        cell: ({ row }) => {
          const status = getPaymentStatus(row.original.id)
          if (!status) return <span className="text-erp-muted">-</span>
          const label =
            status === 'fully_paid'
              ? 'Fully Paid'
              : status === 'partially_paid'
                ? 'Partially Paid'
                : 'Unpaid'
          return <EnterpriseStatusChip label={label} status={status} />
        },
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (r) => r.gst.grandTotal,
        meta: entNumericMeta('Amount'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.gst.grandTotal)} className="font-semibold" />
        ),
      },
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'proformaDate',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[13px] text-erp-text">{formatDate(row.original.proformaDate)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => (
          <EnterpriseRowActionsMenu
            actions={[
              {
                id: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => navigate(`/sales/proforma-invoices/${row.original.id}`),
              },
              {
                id: 'receive',
                label: 'Receive payment',
                icon: Wallet,
                onClick: () => navigate(`/sales/proforma-invoices/${row.original.id}/receive-payment`),
              },
            ]}
          />
        ),
      },
    ],
    [getPaymentStatus, navigate],
  )

  return (
    <Entity360Panel title="Proforma Invoices" subtitle="Commercial proformas for this company">
      <EnterpriseRegisterTableShell className="border-0 shadow-none">
        <DataGrid
          data={rows}
          columns={columns}
          compact
          zebra
          stickyHeader
          stickyFirstColumn
          enableColumnSorting
          toolbar="compact"
          showCompactSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search proforma #, SO…"
          recordLabel="Proformas"
          getRowId={(r) => r.id}
          onRowView={(r) => navigate(`/sales/proforma-invoices/${r.id}`)}
          emptyMessage="No proforma invoices for this customer."
        />
      </EnterpriseRegisterTableShell>
    </Entity360Panel>
  )
}

export function Customer360TaxInvoiceRegister({
  rows,
  customerId,
  canCreate,
  onCreate,
}: {
  rows: CrmTaxInvoice[]
  customerId: string
  canCreate: boolean
  onCreate: () => void
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const columns = useMemo<ColumnDef<CrmTaxInvoice>[]>(
    () => [
      {
        id: 'invoice',
        header: 'Invoice',
        accessorKey: 'invoiceNo',
        meta: { columnLabel: 'Invoice' },
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => navigate(`/sales/invoices/${row.original.id}`)}>
            <EnterpriseIdCell id={row.original.invoiceNo} />
          </button>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <EnterpriseStatusChip
            label={CRM_TAX_INVOICE_STATUS_LABELS[row.original.status]}
            status={row.original.status}
          />
        ),
      },
      {
        id: 'payment',
        header: 'Payment',
        accessorKey: 'paymentStatus',
        meta: { columnLabel: 'Payment' },
        cell: ({ row }) => (
          <EnterpriseStatusChip
            label={CRM_INVOICE_PAYMENT_STATUS_LABELS[row.original.paymentStatus]}
            status={row.original.paymentStatus}
          />
        ),
      },
      {
        id: 'accounting',
        header: 'Accounting',
        accessorFn: (r) => r.accountingStatus ?? 'none',
        meta: { columnLabel: 'Accounting' },
        cell: ({ row }) => {
          const status = row.original.accountingStatus ?? 'none'
          if (status === 'converted' && row.original.salesInvoiceId) {
            return (
              <TableLink to={`/accounting/money-in/invoices/${row.original.salesInvoiceId}`}>
                <EnterpriseIdCell id={row.original.salesInvoiceNumber || 'Money In'} />
              </TableLink>
            )
          }
          if (status === 'pending_review') {
            return <EnterpriseStatusChip label="Pending Accounting" status="pending" />
          }
          return <span className="text-erp-muted">-</span>
        },
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (r) => r.gst.grandTotal,
        meta: entNumericMeta('Amount'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.gst.grandTotal)} className="font-semibold" />
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorFn: (r) => r.balanceDue,
        meta: entNumericMeta('Balance'),
        cell: ({ row }) => (
          <EnterpriseNumericCell
            value={formatCurrency(row.original.balanceDue)}
            className={cn(row.original.balanceDue > 0.009 && 'font-semibold text-amber-800')}
          />
        ),
      },
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'invoiceDate',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[13px] text-erp-text">{formatDate(row.original.invoiceDate)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => (
          <EnterpriseRowActionsMenu
            actions={[
              {
                id: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => navigate(`/sales/invoices/${row.original.id}`),
              },
              ...(row.original.balanceDue > 0.009
                ? [
                    {
                      id: 'alloc',
                      label: 'Allocate payment',
                      icon: ArrowLeftRight,
                      onClick: () => navigate(`/sales/payment-allocation?customerId=${customerId}`),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [customerId, navigate],
  )

  return (
    <Entity360Panel title="Tax Invoices" subtitle="CRM commercial invoices and collection status">
      {canCreate ? (
        <div className="mb-3 px-1">
          <ErpButton variant="secondary" icon={Plus} onClick={onCreate}>
            Create Invoice
          </ErpButton>
        </div>
      ) : null}
      <EnterpriseRegisterTableShell className="border-0 shadow-none">
        <DataGrid
          data={rows}
          columns={columns}
          compact
          zebra
          stickyHeader
          stickyFirstColumn
          enableColumnSorting
          toolbar="compact"
          showCompactSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search invoice #…"
          recordLabel="Invoices"
          getRowId={(r) => r.id}
          onRowView={(r) => navigate(`/sales/invoices/${r.id}`)}
          emptyMessage="No CRM tax invoices yet."
        />
      </EnterpriseRegisterTableShell>
    </Entity360Panel>
  )
}

export function Customer360PaymentReceiptRegister({ rows }: { rows: CrmPaymentReceipt[] }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const columns = useMemo<ColumnDef<CrmPaymentReceipt>[]>(
    () => [
      {
        id: 'receipt',
        header: 'Receipt',
        accessorKey: 'receiptNo',
        meta: { columnLabel: 'Receipt' },
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => navigate(`/sales/receipts/${row.original.id}`)}>
            <EnterpriseIdCell id={row.original.receiptNo} />
            {row.original.transactionRef ? (
              <p className="mt-0.5 max-w-[11rem] truncate text-[11px] text-erp-muted" title={row.original.transactionRef}>
                Ref {row.original.transactionRef}
              </p>
            ) : null}
          </button>
        ),
      },
      {
        id: 'mode',
        header: 'Mode',
        accessorKey: 'paymentMode',
        meta: { columnLabel: 'Mode' },
        cell: ({ row }) => (
          <EnterpriseStatusChip
            label={CRM_PAYMENT_MODE_LABELS[row.original.paymentMode] ?? row.original.paymentMode}
            status={row.original.paymentMode}
          />
        ),
      },
      {
        id: 'allocation',
        header: 'Allocation',
        accessorFn: (r) => receiptAllocationStatus(r).label,
        meta: { columnLabel: 'Allocation' },
        cell: ({ row }) => {
          const alloc = receiptAllocationStatus(row.original)
          return <EnterpriseStatusChip label={alloc.label} status={alloc.status} />
        },
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorKey: 'amount',
        meta: entNumericMeta('Amount'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.amount)} className="font-semibold" />
        ),
      },
      {
        id: 'unallocated',
        header: 'Unallocated',
        accessorKey: 'unallocatedAmount',
        meta: entNumericMeta('Unallocated'),
        cell: ({ row }) => (
          <EnterpriseNumericCell
            value={formatCurrency(row.original.unallocatedAmount)}
            className={cn(row.original.unallocatedAmount > 0.009 && 'font-semibold text-amber-800')}
          />
        ),
      },
      {
        id: 'proforma',
        header: 'Proforma',
        accessorFn: (r) => r.proformaNo ?? '',
        meta: { columnLabel: 'Proforma' },
        cell: ({ row }) =>
          row.original.proformaInvoiceId ? (
            <TableLink to={`/sales/proforma-invoices/${row.original.proformaInvoiceId}`}>
              <EnterpriseIdCell id={row.original.proformaNo || '-'} />
            </TableLink>
          ) : (
            <span className="text-erp-muted">-</span>
          ),
      },
      {
        id: 'accounting',
        header: 'Books',
        accessorFn: (r) => r.accountingMigrationStatus ?? 'UNREVIEWED',
        meta: { columnLabel: 'Books' },
        cell: ({ row }) => {
          const status = row.original.accountingMigrationStatus ?? 'UNREVIEWED'
          if (row.original.accountingReceiptId) {
            return (
              <TableLink to={`/accounting/money-in/receipts/${row.original.accountingReceiptId}`}>
                <EnterpriseRecordCell
                  primary={<EnterpriseIdCell id="Money In" />}
                  subtitle={CRM_RECEIPT_MIGRATION_STATUS_LABELS[status]}
                />
              </TableLink>
            )
          }
          return (
            <EnterpriseStatusChip
              label={CRM_RECEIPT_MIGRATION_STATUS_LABELS[status] ?? status}
              status={status}
            />
          )
        },
      },
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'receiptDate',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[13px] text-erp-text">{formatDate(row.original.receiptDate)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => (
          <EnterpriseRowActionsMenu
            actions={[
              {
                id: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => navigate(`/sales/receipts/${row.original.id}`),
              },
              {
                id: 'print',
                label: 'Print / PDF',
                icon: Printer,
                onClick: () => navigate(`/sales/receipts/${row.original.id}/print`),
              },
              ...(row.original.unallocatedAmount > 0.009
                ? [
                    {
                      id: 'alloc',
                      label: 'Allocate',
                      icon: ArrowLeftRight,
                      onClick: () =>
                        navigate(`/sales/payment-allocation?customerId=${row.original.customerId}&receiptId=${row.original.id}`),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [navigate],
  )

  return (
    <Entity360Panel title="Payment Receipts" subtitle="Customer remittances against proformas and open invoices">
      <EnterpriseRegisterTableShell className="border-0 shadow-none">
        <DataGrid
          data={rows}
          columns={columns}
          compact
          zebra
          stickyHeader
          stickyFirstColumn
          enableColumnSorting
          toolbar="compact"
          showCompactSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search receipt #, ref, proforma…"
          recordLabel="Receipts"
          getRowId={(r) => r.id}
          onRowView={(r) => navigate(`/sales/receipts/${r.id}`)}
          emptyMessage="No payment receipts recorded."
        />
      </EnterpriseRegisterTableShell>
    </Entity360Panel>
  )
}

export function Customer360OutstandingRegister({
  invoices,
  summary,
}: {
  invoices: CrmTaxInvoice[]
  summary: {
    invoiceTotal: number
    amountPaid: number
    outstanding: number
    openInvoiceCount: number
  }
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const openInvoices = useMemo(
    () => invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled' && i.balanceDue > 0.009),
    [invoices],
  )

  const columns = useMemo<ColumnDef<CrmTaxInvoice>[]>(
    () => [
      {
        id: 'invoice',
        header: 'Invoice',
        accessorKey: 'invoiceNo',
        meta: { columnLabel: 'Invoice' },
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => navigate(`/sales/invoices/${row.original.id}`)}>
            <EnterpriseIdCell id={row.original.invoiceNo} />
          </button>
        ),
      },
      {
        id: 'payment',
        header: 'Payment',
        accessorKey: 'paymentStatus',
        meta: { columnLabel: 'Payment' },
        cell: ({ row }) => (
          <EnterpriseStatusChip
            label={CRM_INVOICE_PAYMENT_STATUS_LABELS[row.original.paymentStatus]}
            status={row.original.paymentStatus}
          />
        ),
      },
      {
        id: 'total',
        header: 'Invoice amount',
        accessorFn: (r) => r.gst.grandTotal,
        meta: entNumericMeta('Invoice amount'),
        cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.gst.grandTotal)} />,
      },
      {
        id: 'paid',
        header: 'Allocated',
        accessorKey: 'amountPaid',
        meta: entNumericMeta('Allocated'),
        cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.amountPaid)} />,
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorKey: 'balanceDue',
        meta: entNumericMeta('Balance outstanding'),
        cell: ({ row }) => (
          <EnterpriseNumericCell
            value={formatCurrency(row.original.balanceDue)}
            className="font-semibold text-amber-800"
          />
        ),
      },
    ],
    [navigate],
  )

  return (
    <Entity360Panel title="Outstanding Summary" subtitle="Open tax invoices with remaining balance">
      <div className="mb-3 px-1">
        <DynamicsKpiRow columns={4}>
          <DynamicsKpiTile label="Invoice Total" value={formatCurrency(summary.invoiceTotal)} tone="primary" />
          <DynamicsKpiTile label="Amount Paid" value={formatCurrency(summary.amountPaid)} tone="success" />
          <DynamicsKpiTile label="Outstanding" value={formatCurrency(summary.outstanding)} tone="warning" />
          <DynamicsKpiTile label="Open Invoices" value={summary.openInvoiceCount} tone="primary" />
        </DynamicsKpiRow>
      </div>
      <EnterpriseRegisterTableShell className="border-0 shadow-none">
        <DataGrid
          data={openInvoices}
          columns={columns}
          compact
          zebra
          stickyHeader
          stickyFirstColumn
          enableColumnSorting
          toolbar="compact"
          showCompactSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search open invoice #…"
          recordLabel="Open invoices"
          getRowId={(r) => r.id}
          onRowView={(r) => navigate(`/sales/invoices/${r.id}`)}
          emptyMessage="No outstanding invoices."
        />
      </EnterpriseRegisterTableShell>
    </Entity360Panel>
  )
}

export type Customer360LedgerRow = {
  id: string
  date: string
  type: string
  reference: string
  debit: number
  credit: number
  balance: number
}

export function Customer360LedgerRegister({
  rows,
  timeline,
}: {
  rows: Customer360LedgerRow[]
  timeline: Array<{
    id: string
    title: string
    subtitle: string
    amount: number | null
    refPath: string | null
    at: string
  }>
}) {
  const [search, setSearch] = useState('')

  const columns = useMemo<ColumnDef<Customer360LedgerRow>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'date',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[13px] text-erp-text">{formatDate(row.original.date)}</span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        meta: { columnLabel: 'Type' },
        cell: ({ row }) => <EnterpriseStatusChip label={row.original.type} status={row.original.type} />,
      },
      {
        id: 'reference',
        header: 'Reference',
        accessorKey: 'reference',
        meta: { columnLabel: 'Reference' },
        cell: ({ row }) => <EnterpriseIdCell id={row.original.reference} />,
      },
      {
        id: 'debit',
        header: 'Debit',
        accessorKey: 'debit',
        meta: entNumericMeta('Debit'),
        cell: ({ row }) =>
          row.original.debit ? (
            <EnterpriseNumericCell value={formatCurrency(row.original.debit)} />
          ) : (
            <span className="block text-right text-erp-muted">-</span>
          ),
      },
      {
        id: 'credit',
        header: 'Credit',
        accessorKey: 'credit',
        meta: entNumericMeta('Credit'),
        cell: ({ row }) =>
          row.original.credit ? (
            <EnterpriseNumericCell value={formatCurrency(row.original.credit)} />
          ) : (
            <span className="block text-right text-erp-muted">-</span>
          ),
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorKey: 'balance',
        meta: entNumericMeta('Balance'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.balance)} className="font-semibold" />
        ),
      },
    ],
    [],
  )

  return (
    <Entity360Panel title="Customer Ledger" subtitle="Running invoice and receipt position">
      <EnterpriseRegisterTableShell className="border-0 shadow-none">
        <DataGrid
          data={rows}
          columns={columns}
          compact
          zebra
          stickyHeader
          stickyFirstColumn
          enableColumnSorting
          toolbar="compact"
          showCompactSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search type or reference…"
          recordLabel="Ledger lines"
          getRowId={(r) => `${r.type}-${r.id}-${r.date}`}
          emptyMessage="Ledger is empty — invoices and receipts will appear here."
        />
      </EnterpriseRegisterTableShell>
      {timeline.length > 0 ? (
        <div className="mt-4 space-y-2 px-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Commercial timeline</p>
          {timeline.slice(0, 12).map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-erp-border bg-erp-surface px-3 py-2 text-[13px]"
            >
              <div className="min-w-0">
                {ev.refPath ? <TableLink to={ev.refPath}>{ev.title}</TableLink> : ev.title}
                <div className="text-[12px] text-erp-muted">{ev.subtitle}</div>
              </div>
              <span className="tabular-nums text-erp-text">
                {ev.amount != null ? formatCurrency(ev.amount) : formatDate(ev.at.slice(0, 10))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Entity360Panel>
  )
}

export function Customer360PaymentAllocationRegister({
  rows,
  customerId,
  isServices,
}: {
  rows: CrmPaymentAllocation[]
  customerId: string
  isServices: boolean
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const columns = useMemo<ColumnDef<CrmPaymentAllocation>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'allocationDate',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[13px] text-erp-text">{formatDate(row.original.allocationDate)}</span>
        ),
      },
      {
        id: 'receipt',
        header: 'Receipt',
        accessorKey: 'receiptNo',
        meta: { columnLabel: 'Receipt' },
        cell: ({ row }) => (
          <TableLink to={`/sales/receipts/${row.original.receiptId}`}>
            <EnterpriseIdCell id={row.original.receiptNo} />
          </TableLink>
        ),
      },
      {
        id: 'invoice',
        header: 'Invoice',
        accessorKey: 'invoiceNo',
        meta: { columnLabel: 'Invoice' },
        cell: ({ row }) =>
          row.original.invoiceId ? (
            <TableLink to={`/sales/invoices/${row.original.invoiceId}`}>
              <EnterpriseIdCell id={row.original.invoiceNo} />
            </TableLink>
          ) : (
            <EnterpriseIdCell id={row.original.invoiceNo} />
          ),
      },
      {
        id: 'amount',
        header: 'Allocated',
        accessorKey: 'amount',
        meta: entNumericMeta('Allocated'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.amount)} className="font-semibold" />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => (r.reversedAt ? 'reversed' : 'posted'),
        meta: { columnLabel: 'Status' },
        cell: ({ row }) =>
          row.original.reversedAt ? (
            <EnterpriseStatusChip label="Reversed" status="cancelled" />
          ) : (
            <EnterpriseStatusChip label="Posted" status="posted" />
          ),
      },
    ],
    [],
  )

  return (
    <Entity360Panel title="Payment Allocations" subtitle="How receipts were applied to tax invoices">
      <div className="mb-3 px-1">
        <ErpButton
          variant="secondary"
          icon={ArrowLeftRight}
          onClick={() =>
            navigate(
              isServices
                ? `/accounting/money-in/customers/${customerId}`
                : `/sales/payment-allocation?customerId=${customerId}`,
            )
          }
        >
          Open Allocation Workspace
        </ErpButton>
      </div>
      <EnterpriseRegisterTableShell className="border-0 shadow-none">
        <DataGrid
          data={rows}
          columns={columns}
          compact
          zebra
          stickyHeader
          stickyFirstColumn
          enableColumnSorting
          toolbar="compact"
          showCompactSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search receipt or invoice…"
          recordLabel="Allocations"
          getRowId={(r) => r.id}
          emptyMessage="No payment allocations yet."
        />
      </EnterpriseRegisterTableShell>
    </Entity360Panel>
  )
}
