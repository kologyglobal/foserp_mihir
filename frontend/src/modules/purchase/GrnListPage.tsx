import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ClipboardCheck,
  Eye,
  Package,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react'
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
  getGrnList,
  GRN_DOMAIN_STATUS_LABELS,
  GRN_DOMAIN_STATUSES,
} from '@/services/purchase'
import { usePurchasePermissions } from '@/utils/permissions'
import type { GrnDomainStatus, GrnListRow } from '@/types/purchaseDomain'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { grnListBreadcrumbs } from '@/utils/purchaseNavigation'

export function GrnListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<GrnListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getGrnList())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GRNs')
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
          r.purchaseOrderNumber.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          r.vendorCode.toLowerCase().includes(q) ||
          (r.gateEntryNo ?? '').toLowerCase().includes(q) ||
          (r.vehicleNo ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, status])

  const columns = useMemo<ColumnDef<GrnListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'GRN Number',
        cell: ({ row }) => (
          <TableLink to={`/purchase/grn/${row.original.id}`} className="font-mono">
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
        accessorKey: 'purchaseOrderNumber',
        header: 'PO Number',
        cell: ({ row }) => (
          <TableLink to={`/purchase/orders/${row.original.purchaseOrderId}`} className="font-mono">
            {row.original.purchaseOrderNumber}
          </TableLink>
        ),
      },
      { accessorKey: 'vendorName', header: 'Vendor' },
      { accessorKey: 'warehouseName', header: 'Warehouse' },
      {
        accessorKey: 'totalReceivedQty',
        header: 'Received Qty',
        cell: ({ row }) => formatNumber(row.original.totalReceivedQty),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Value',
        cell: ({ row }) => formatCurrency(row.original.totalAmount),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot
            tone={statusToneFromLabel(row.original.statusLabel)}
            label={row.original.statusLabel}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/grn/${r.id}`),
            },
          ]
          if (r.status === 'draft' || r.status === 'pending_inspection') {
            actions.push({
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/purchase/grn/${r.id}/edit`),
            })
          }
          if (r.inspectionRequired) {
            actions.push({
              id: 'qi',
              label: 'Quality Inspection',
              icon: ClipboardCheck,
              onClick: () =>
                navigate(
                  r.qualityInspectionId
                    ? `/purchase/quality-inspections/${r.qualityInspectionId}`
                    : `/purchase/quality-inspections?grnId=${r.id}`,
                ),
            })
          }
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  return (
    <OperationalPageShell
      title="Goods Receipt Notes"
      description="Receive against released purchase orders · inspection · post (inventory deferred)"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={grnListBreadcrumbs()}
      favoritePath="/purchase/grn"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateGrn
              ? {
                  id: 'new',
                  label: 'New GRN',
                  icon: Plus,
                  onClick: () => navigate('/purchase/grn/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'qi',
              label: 'Quality Inspections',
              icon: ClipboardCheck,
              onClick: () => navigate('/purchase/quality-inspections'),
              hidden: !perms.canViewQuality,
            },
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
          placeholder="Search GRN / PO / vendor / gate entry"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {GRN_DOMAIN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {GRN_DOMAIN_STATUS_LABELS[s as GrnDomainStatus]}
            </option>
          ))}
        </Select>
      </SmartFilterBar>

      {loading ? (
        <LoadingState variant="table" rows={8} />
      ) : error ? (
        <EmptyState icon={Package} title="Could not load GRNs" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No goods receipts"
          description="Create a GRN from a released purchase order with open quantity."
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </OperationalPageShell>
  )
}
