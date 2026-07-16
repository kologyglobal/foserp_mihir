import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Printer, RefreshCw, RotateCcw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  getPurchaseReturnList,
  PURCHASE_RETURN_DOMAIN_STATUS_LABELS,
} from '@/services/purchase'
import type { PurchaseReturnListRow } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { usePurchasePermissions } from '@/utils/permissions'

export function PurchaseReturnListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<PurchaseReturnListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getPurchaseReturnList())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase returns')
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
          (r.purchaseOrderNumber ?? '').toLowerCase().includes(q) ||
          (r.goodsReceiptNumber ?? '').toLowerCase().includes(q) ||
          r.returnReasonLabel.toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, status])

  const columns = useMemo<ColumnDef<PurchaseReturnListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Return No',
        cell: ({ row }) => (
          <TableLink to={`/purchase/returns/${row.original.id}`} className="font-mono">
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
        accessorKey: 'purchaseOrderNumber',
        header: 'PO',
        cell: ({ row }) => row.original.purchaseOrderNumber || '—',
      },
      {
        accessorKey: 'goodsReceiptNumber',
        header: 'GRN',
        cell: ({ row }) => row.original.goodsReceiptNumber || '—',
      },
      { accessorKey: 'returnReasonLabel', header: 'Reason' },
      { accessorKey: 'originLabel', header: 'Origin' },
      {
        accessorKey: 'totalAmount',
        header: 'Amount',
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
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/returns/${r.id}`),
            },
          ]
          if (r.status === 'draft' || r.status === 'pending_approval') {
            actions.push({
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/purchase/returns/${r.id}/edit`),
            })
          }
          actions.push({
            id: 'print',
            label: 'Print Challan',
            icon: Printer,
            onClick: () => navigate(`/purchase/returns/${r.id}/print`),
          })
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  return (
    <OperationalPageShell
      title="Purchase Returns"
      description="Return rejected, damaged, or excess material to vendors"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Returns')}
      favoritePath="/purchase/returns"
      insights={[
        { label: 'Returns', value: rows.length, accent: 'blue' },
        {
          label: 'Draft',
          value: rows.filter((r) => r.status === 'draft').length,
          accent: 'slate',
        },
        {
          label: 'Posted',
          value: rows.filter((r) => r.status === 'posted').length,
          accent: 'green',
        },
      ]}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateReturn
              ? {
                  id: 'create',
                  label: 'New Return',
                  icon: Plus,
                  onClick: () => navigate('/purchase/returns/new'),
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
      <SmartFilterBar
        className="mb-4"
        onClearAll={() => {
          setSearch('')
          setStatus('')
        }}
        resultCount={filtered.length}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search return / vendor / PO / GRN" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(PURCHASE_RETURN_DOMAIN_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </SmartFilterBar>

      {loading ? (
        <LoadingState variant="table" rows={8} />
      ) : error ? (
        <EmptyState
          icon={RotateCcw}
          title="Could not load purchase returns"
          description={error}
          action={
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => void load()}
            >
              Retry
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No purchase returns found"
          description="Create a return from GRN rejection, quality inspection, or a reason preset."
          action={
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => navigate('/purchase/returns/new')}
            >
              New Return
            </button>
          }
        />
      ) : (
        <DataTable data={filtered} columns={columns} />
      )}
    </OperationalPageShell>
  )
}
