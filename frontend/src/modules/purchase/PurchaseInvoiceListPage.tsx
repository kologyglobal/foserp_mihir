import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, FileWarning, Plus, Printer, Receipt, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  getPurchaseInvoiceList,
  PURCHASE_INVOICE_STATUSES,
  PURCHASE_INVOICE_STATUS_LABELS,
} from '@/services/purchase'
import type { PurchaseInvoiceListRow, PurchaseInvoiceStatus } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { invoiceListBreadcrumbs } from '@/utils/purchaseNavigation'
import { usePurchasePermissions } from '@/utils/permissions'

function matchBadgeColor(
  status: PurchaseInvoiceListRow['matchingResultStatus'],
): 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (status === 'fully_matched') return 'green'
  if (status === 'within_tolerance') return 'blue'
  if (status === 'missing_grn' || status === 'duplicate_invoice') return 'red'
  if (
    status === 'quantity_mismatch' ||
    status === 'rate_mismatch' ||
    status === 'tax_mismatch' ||
    status === 'amount_mismatch'
  )
    return 'yellow'
  return 'gray'
}

export function PurchaseInvoiceListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<PurchaseInvoiceListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getPurchaseInvoiceList())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = [...rows]
    if (status) list = list.filter((r) => r.status === status)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.documentNumber.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          r.vendorInvoiceNumber.toLowerCase().includes(q) ||
          (r.purchaseOrderNumber ?? '').toLowerCase().includes(q) ||
          (r.goodsReceiptNumber ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, status])

  const columns = useMemo<ColumnDef<PurchaseInvoiceListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Invoice No',
        cell: ({ row }) => (
          <TableLink to={`/purchase/invoices/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      { accessorKey: 'vendorName', header: 'Vendor' },
      {
        accessorKey: 'vendorInvoiceNumber',
        header: 'Vendor Inv #',
        cell: ({ row }) => row.original.vendorInvoiceNumber || '—',
      },
      {
        accessorKey: 'purchaseOrderNumber',
        header: 'PO',
        cell: ({ row }) => row.original.purchaseOrderNumber || '—',
      },
      {
        accessorKey: 'goodsReceiptNumber',
        header: 'GRN',
        cell: ({ row }) => row.original.goodsReceiptNumber || '—',
      },
      {
        accessorKey: 'originLabel',
        header: 'Origin',
      },
      {
        accessorKey: 'matchingResultStatusLabel',
        header: 'Matching',
        cell: ({ row }) => (
          <Badge color={matchBadgeColor(row.original.matchingResultStatus)}>
            {row.original.matchingResultStatusLabel}
          </Badge>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Total',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.totalAmount)}</span>
        ),
      },
      {
        accessorKey: 'statusLabel',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot
            label={row.original.statusLabel}
            tone={statusToneFromLabel(row.original.statusLabel)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/invoices/${row.original.id}`),
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => navigate(`/purchase/invoices/${row.original.id}/print`),
            },
          ]
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  return (
    <OperationalPageShell
      title="Purchase Invoices"
      description="Three-way match purchase invoices against PO and GRN"
      favoritePath="/purchase/invoices"
      breadcrumbs={invoiceListBreadcrumbs()}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateInvoice
              ? {
                  id: 'new',
                  label: 'New Invoice',
                  icon: Plus,
                  onClick: () => navigate('/purchase/invoices/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      <SmartFilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search invoice, vendor, PO, GRN…"
          className="min-w-[16rem] flex-1"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="">All statuses</option>
          {PURCHASE_INVOICE_STATUSES.map((s: PurchaseInvoiceStatus) => (
            <option key={s} value={s}>
              {PURCHASE_INVOICE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </SmartFilterBar>

      {loading ? (
        <LoadingState variant="table" rows={8} />
      ) : error ? (
        <EmptyState icon={FileWarning} title="Could not load invoices" description={error} />
      ) : !filtered.length ? (
        <EmptyState
          icon={Receipt}
          title="No purchase invoices"
          description="Create from PO, posted GRN, vendor bill, service PO, or direct (admin)."
        />
      ) : (
        <DataTable data={filtered} columns={columns} />
      )}
    </OperationalPageShell>
  )
}
