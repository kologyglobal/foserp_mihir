import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Printer, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
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
  buildReturnFilterFields,
  crmValuesToReturnFilters,
  DEFAULT_RETURN_LIST_FILTERS,
  filterReturnRows,
  hasActiveReturnFilters,
  RETURN_SORT_OPTIONS,
  returnFilterChipLabelResolver,
  returnFiltersToCrmValues,
  sortReturnRows,
  type ReturnListFilters,
  type ReturnSortKey,
} from '@/config/returnFilterConfig'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { getPurchaseReturnList } from '@/services/purchase'
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
  const [filters, setFilters] = useState<ReturnListFilters>(DEFAULT_RETURN_LIST_FILTERS)
  const [sortBy, setSortBy] = useState<ReturnSortKey>('documentDate')

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

  const vendorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.vendorName).filter(Boolean))].sort(),
    [rows],
  )
  const filterFields = useMemo(
    () => buildReturnFilterFields({ vendorOptions }),
    [vendorOptions],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: returnFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToReturnFilters(next)),
    fields: filterFields,
    defaults: returnFiltersToCrmValues(DEFAULT_RETURN_LIST_FILTERS),
    chipLabelResolver: returnFilterChipLabelResolver,
  })

  const filtered = useMemo(
    () => sortReturnRows(filterReturnRows(rows, filters), sortBy),
    [rows, filters, sortBy],
  )

  const clearFilters = () => filterDrawer.clearAll()
  const activeFilters = hasActiveReturnFilters(filters)

  const columns = useMemo<ColumnDef<PurchaseReturnListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Return No',
        meta: { columnLabel: 'Return No' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/returns/${row.original.id}`} className="font-mono">
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
        accessorKey: 'vendorName',
        header: 'Vendor',
        meta: { columnLabel: 'Vendor' },
      },
      {
        accessorKey: 'purchaseOrderNumber',
        header: 'PO',
        meta: { columnLabel: 'PO' },
        cell: ({ row }) => row.original.purchaseOrderNumber || '—',
      },
      {
        accessorKey: 'goodsReceiptNumber',
        header: 'GRN',
        meta: { columnLabel: 'GRN' },
        cell: ({ row }) => row.original.goodsReceiptNumber || '—',
      },
      {
        accessorKey: 'returnReasonLabel',
        header: 'Reason',
        meta: { columnLabel: 'Reason' },
      },
      {
        accessorKey: 'originLabel',
        header: 'Origin',
        meta: { columnLabel: 'Origin' },
      },
      {
        accessorKey: 'totalAmount',
        header: 'Amount',
        meta: { columnLabel: 'Amount' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.totalAmount)}</span>
        ),
      },
      {
        accessorKey: 'statusLabel',
        header: 'Status',
        meta: { columnLabel: 'Status' },
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
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          const canEdit = r.status === 'draft' || r.status === 'pending_approval'
          const statusLabel = r.statusLabel || r.status
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/returns/${r.id}`),
            },
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/purchase/returns/${r.id}/edit`),
              disabled: !canEdit,
              disabledReason: `${statusLabel} purchase returns cannot be edited`,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: Trash2,
              danger: true,
              disabled: r.status !== 'draft',
              disabledReason: `${statusLabel} purchase returns cannot be deleted`,
            },
            {
              id: 'print',
              label: 'Print Challan',
              icon: Printer,
              onClick: () => navigate(`/purchase/returns/${r.id}/print`),
            },
          ]
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  const shellProps = {
    title: 'Purchase Returns',
    description: 'Return rejected, damaged, or excess material to vendors',
    badge: 'Purchase' as const,
    variant: 'dynamics' as const,
    breadcrumbs: purchaseBreadcrumbs('Returns'),
    favoritePath: '/purchase/returns',
    pageGuide: null,
  }

  const commandBar = (
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
  )

  const emptyAction = (
    <div className="flex flex-wrap justify-center gap-2">
      {rows.length === 0 && perms.canCreateReturn ? (
        <button
          type="button"
          className="erp-btn erp-btn--primary text-[13px]"
          onClick={() => navigate('/purchase/returns/new')}
        >
          New Return
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
            <EmptyState
              icon={RotateCcw}
              title="Could not load purchase returns"
              description={error}
              action={
                <button
                  type="button"
                  className="erp-btn erp-btn--primary text-[13px]"
                  onClick={() => void load()}
                >
                  Retry
                </button>
              }
            />
          ) : (
            <>
              <ErpPageGuide
                purpose="Purchase returns against GRN or PO."
                nextStep="Create return, approve, then ship back."
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
                      ? 'No purchase returns match current filters.'
                      : 'No purchase returns found. Create a return from GRN rejection, quality inspection, or a reason preset.'
                  }
                  emptyAction={emptyAction}
                  getRowId={(r) => r.id}
                  registerBar={
                    <CrmListFilterBar
                      search={filters.search}
                      onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                      searchPlaceholder="Search return / vendor / PO / GRN"
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
                          onChange={(v) => setSortBy(v as ReturnSortKey)}
                          aria-label="Sort purchase returns"
                          options={RETURN_SORT_OPTIONS}
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
        title="Filter purchase returns"
        fields={filterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
    </>
  )
}
