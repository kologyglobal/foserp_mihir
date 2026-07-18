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
  Trash2,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { ErpPageGuide } from '@/components/erp/ErpPageGuide'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  buildGrnFilterFields,
  crmValuesToGrnFilters,
  DEFAULT_GRN_LIST_FILTERS,
  filterGrnRows,
  GRN_SORT_OPTIONS,
  grnFilterChipLabelResolver,
  grnFiltersToCrmValues,
  hasActiveGrnFilters,
  sortGrnRows,
  type GrnListFilters,
  type GrnSortKey,
} from '@/config/grnFilterConfig'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { getGrnList } from '@/services/purchase'
import { usePurchasePermissions } from '@/utils/permissions'
import type { GrnListRow } from '@/types/purchaseDomain'
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
  const [filters, setFilters] = useState<GrnListFilters>(() => ({
    ...DEFAULT_GRN_LIST_FILTERS,
    status: searchParams.get('status') ?? '',
  }))
  const [sortBy, setSortBy] = useState<GrnSortKey>('documentDate')

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

  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return
    setFilters((f) => ({ ...f, status }))
  }, [searchParams])

  const vendorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.vendorName).filter(Boolean))].sort(),
    [rows],
  )
  const filterFields = useMemo(
    () => buildGrnFilterFields({ vendorOptions }),
    [vendorOptions],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: grnFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToGrnFilters(next)),
    fields: filterFields,
    defaults: grnFiltersToCrmValues(DEFAULT_GRN_LIST_FILTERS),
    chipLabelResolver: grnFilterChipLabelResolver,
  })

  const filtered = useMemo(
    () => sortGrnRows(filterGrnRows(rows, filters), sortBy),
    [rows, filters, sortBy],
  )

  const clearFilters = () => filterDrawer.clearAll()
  const activeFilters = hasActiveGrnFilters(filters)

  const columns = useMemo<ColumnDef<GrnListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'GRN Number',
        meta: { columnLabel: 'GRN Number' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/grn/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      {
        accessorKey: 'purchaseOrderNumber',
        header: 'PO Number',
        meta: { columnLabel: 'PO Number' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/orders/${row.original.purchaseOrderId}`} className="font-mono">
            {row.original.purchaseOrderNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'vendorName',
        header: 'Vendor',
        meta: { columnLabel: 'Vendor' },
      },
      {
        accessorKey: 'warehouseName',
        header: 'Warehouse',
        meta: { columnLabel: 'Warehouse' },
      },
      {
        accessorKey: 'totalReceivedQty',
        header: 'Received Qty',
        meta: { columnLabel: 'Received Qty' },
        cell: ({ row }) => formatNumber(row.original.totalReceivedQty),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Value',
        meta: { columnLabel: 'Value' },
        cell: ({ row }) => formatCurrency(row.original.totalAmount),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
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
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          const canEdit = r.status === 'draft' || r.status === 'pending_inspection'
          const statusLabel = r.statusLabel || r.status
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/grn/${r.id}`),
            },
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/purchase/grn/${r.id}/edit`),
              disabled: !canEdit,
              disabledReason: `${statusLabel} GRNs cannot be edited`,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: Trash2,
              danger: true,
              disabled: r.status !== 'draft',
              disabledReason: `${statusLabel} GRNs cannot be deleted`,
            },
          ]
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

  const shellProps = {
    title: 'Goods Receipt Notes',
    description: 'Receive against released purchase orders · inspection · post (inventory deferred)',
    badge: 'Purchase' as const,
    variant: 'dynamics' as const,
    breadcrumbs: grnListBreadcrumbs(),
    favoritePath: '/purchase/grn',
    pageGuide: null,
  }

  const commandBar = (
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
  )

  const emptyAction = (
    <div className="flex flex-wrap justify-center gap-2">
      {rows.length === 0 && perms.canCreateGrn ? (
        <button
          type="button"
          className="erp-btn erp-btn--primary text-[13px]"
          onClick={() => navigate('/purchase/grn/new')}
        >
          New GRN
        </button>
      ) : null}
      {activeFilters ? (
        <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
          Clear Filters
        </button>
      ) : null}
    </div>
  )

  return (
    <>
      {loading && rows.length === 0 ? (
        <OperationalPageShell {...shellProps}>
          <LoadingState variant="table" rows={8} cols={7} />
        </OperationalPageShell>
      ) : (
        <OperationalPageShell {...shellProps} commandBar={commandBar}>
          {error ? (
            <EmptyState icon={Package} title="Could not load GRNs" description={error} />
          ) : (
            <>
              <ErpPageGuide
                purpose="Goods receipt notes against purchase orders."
                nextStep="Inspect if required, then post the GRN."
              />
              <EnterpriseRegisterTableShell className="min-w-0">
                <ErpDataGrid
                  data={filtered}
                  columns={columns}
                  showCompactSearch={false}
                  enableColumnSorting={false}
                  stickyFirstColumn
                  emptyMessage={
                    activeFilters
                      ? 'No GRNs match current filters.'
                      : 'No goods receipts. Create a GRN from a released purchase order with open quantity.'
                  }
                  emptyAction={emptyAction}
                  getRowId={(r) => r.id}
                  registerBar={
                    <CrmListFilterBar
                      search={filters.search}
                      onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                      searchPlaceholder="Search GRN / PO / vendor / gate entry"
                      activeFilterCount={filterDrawer.activeCount}
                      onOpenFilters={filterDrawer.openDrawer}
                      chips={filterDrawer.chips}
                      onRemoveChip={filterDrawer.removeChip}
                      onClearAll={clearFilters}
                      className="crm-list-filter-bar--embedded"
                      showCommandPaletteHint={false}
                      sort={
                        <CrmListSortSelect
                          value={sortBy}
                          onChange={(v) => setSortBy(v as GrnSortKey)}
                          aria-label="Sort GRNs"
                          options={GRN_SORT_OPTIONS}
                        />
                      }
                    />
                  }
                />
              </EnterpriseRegisterTableShell>
            </>
          )}
        </OperationalPageShell>
      )}

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        title="Filter GRNs"
        fields={filterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
    </>
  )
}
