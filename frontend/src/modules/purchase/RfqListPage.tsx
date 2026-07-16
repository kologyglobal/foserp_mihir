import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, FilePlus2, Plus, Printer, RefreshCw, Send, XCircle } from 'lucide-react'
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
  cancelRFQ,
  getRfqList,
  PurchaseServiceError,
  RFQ_DOMAIN_STATUS_LABELS,
} from '@/services/purchase'
import type { RfqListRow } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'

export function RfqListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<RfqListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getRfqList())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RFQs')
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
          r.buyerName.toLowerCase().includes(q) ||
          r.locationName.toLowerCase().includes(q) ||
          r.purchaseRequisitionNumbers.some((n) => n.toLowerCase().includes(q)),
      )
    }
    return list
  }, [rows, search, status])

  const columns = useMemo<ColumnDef<RfqListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'RFQ Number',
        cell: ({ row }) => (
          <TableLink to={`/purchase/rfqs/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'RFQ Date',
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      {
        accessorKey: 'bidDueDate',
        header: 'Enquiry Due Date',
        cell: ({ row }) => formatDate(row.original.bidDueDate),
      },
      { accessorKey: 'buyerName', header: 'Buyer' },
      { accessorKey: 'locationName', header: 'Location' },
      {
        accessorKey: 'vendorCount',
        header: 'Vendor Count',
        cell: ({ row }) => row.original.vendorCount,
      },
      {
        accessorKey: 'itemCount',
        header: 'Item Count',
        cell: ({ row }) => row.original.itemCount,
      },
      {
        accessorKey: 'estimatedValue',
        header: 'Estimated Value',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.estimatedValue)}</span>
        ),
      },
      {
        accessorKey: 'responsesReceived',
        header: 'Responses Received',
        cell: ({ row }) =>
          `${row.original.responsesReceived}/${row.original.vendorCount || 0}`,
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
              onClick: () => navigate(`/purchase/rfqs/${r.id}`),
            },
          ]
          if (r.status === 'draft') {
            actions.push(
              {
                id: 'edit',
                label: 'Edit',
                icon: FilePlus2,
                onClick: () => navigate(`/purchase/rfqs/${r.id}/edit`),
              },
              {
                id: 'send',
                label: 'Send RFQ',
                icon: Send,
                onClick: () => navigate(`/purchase/rfqs/${r.id}?send=1`),
              },
              {
                id: 'cancel',
                label: 'Cancel',
                icon: XCircle,
                danger: true,
                onClick: () => {
                  void (async () => {
                    try {
                      await cancelRFQ(r.id)
                      notify.success(`${r.documentNumber} cancelled`)
                      await load()
                    } catch (err) {
                      notify.error(
                        err instanceof PurchaseServiceError ? err.message : 'Cancel failed',
                      )
                    }
                  })()
                },
              },
            )
          }
          actions.push({
            id: 'print',
            label: 'Print',
            icon: Printer,
            onClick: () => navigate(`/purchase/rfqs/${r.id}?print=1`),
          })
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [load, navigate],
  )

  return (
    <OperationalPageShell
      title="Requests for Quotation"
      description="Vendor enquiry documents — from approved PRs, manual entry, or combined requisitions"
      badge="Purchase"
      variant="dynamics"
      favoritePath="/purchase/rfqs"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateRfq
              ? {
                  id: 'create',
                  label: 'Create RFQ',
                  icon: Plus,
                  onClick: () => navigate('/purchase/rfqs/new'),
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search RFQ / buyer / PR" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(RFQ_DOMAIN_STATUS_LABELS).map(([value, label]) => (
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
          icon={Send}
          title="Could not load RFQs"
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
          icon={Send}
          title="No RFQs found"
          description="Create from an approved PR, manually, or combine multiple requisitions."
          action={
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => navigate('/purchase/rfqs/new')}
            >
              Create RFQ
            </button>
          }
        />
      ) : (
        <DataTable data={filtered} columns={columns} />
      )}
    </OperationalPageShell>
  )
}
