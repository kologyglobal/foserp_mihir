import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, FilePlus2, GitCompare, Plus, RefreshCw } from 'lucide-react'
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
import { getVendorQuotationList } from '@/services/purchase'
import {
  VENDOR_QUOTATION_DOMAIN_STATUS_LABELS,
  type VendorQuotationListRow,
} from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { usePurchasePermissions } from '@/utils/permissions'

export function VendorQuotationListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<VendorQuotationListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getVendorQuotationList())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor quotations')
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
          r.rfqNumber.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          r.vendorCode.toLowerCase().includes(q) ||
          r.vendorReferenceNumber.toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, status])

  const columns = useMemo<ColumnDef<VendorQuotationListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'VQ Number',
        cell: ({ row }) => (
          <TableLink to={`/purchase/vendor-quotations/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      {
        accessorKey: 'rfqNumber',
        header: 'RFQ',
        cell: ({ row }) => (
          <TableLink to={`/purchase/rfqs/${row.original.rfqId}`} className="font-mono">
            {row.original.rfqNumber}
          </TableLink>
        ),
      },
      { accessorKey: 'vendorName', header: 'Vendor' },
      {
        accessorKey: 'vendorReferenceNumber',
        header: 'Vendor Ref',
        cell: ({ row }) => row.original.vendorReferenceNumber || '—',
      },
      {
        accessorKey: 'validTill',
        header: 'Valid Until',
        cell: ({ row }) => formatDate(row.original.validTill),
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
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/vendor-quotations/${r.id}`),
            },
          ]
          if (r.status === 'draft') {
            actions.push({
              id: 'edit',
              label: 'Edit',
              icon: FilePlus2,
              onClick: () => navigate(`/purchase/vendor-quotations/${r.id}/edit`),
            })
          }
          actions.push({
            id: 'compare',
            label: 'Open Comparison',
            icon: GitCompare,
            onClick: () => navigate(`/purchase/comparison/${r.rfqId}`),
          })
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  return (
    <OperationalPageShell
      title="Vendor Quotations"
      description="Record and review vendor responses against RFQs"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Vendor Quotations')}
      favoritePath="/purchase/vendor-quotations"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateQuotation
              ? {
                  id: 'create',
                  label: 'New Vendor Quotation',
                  icon: Plus,
                  onClick: () => navigate('/purchase/vendor-quotations/new'),
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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search VQ / RFQ / vendor"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(VENDOR_QUOTATION_DOMAIN_STATUS_LABELS).map(([value, label]) => (
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
          icon={FilePlus2}
          title="Could not load vendor quotations"
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
          icon={FilePlus2}
          title="No vendor quotations found"
          description="Create a quotation entry against an RFQ when a vendor responds."
          action={
            <button
              type="button"
              className="rounded-md bg-erp-primary px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => navigate('/purchase/vendor-quotations/new')}
            >
              New Vendor Quotation
            </button>
          }
        />
      ) : (
        <DataTable data={filtered} columns={columns} />
      )}
    </OperationalPageShell>
  )
}
