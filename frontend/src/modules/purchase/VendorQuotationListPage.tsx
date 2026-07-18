import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, FileText, GitCompare, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  buildVqFilterFields,
  crmValuesToVqFilters,
  DEFAULT_VQ_LIST_FILTERS,
  filterVqRows,
  hasActiveVqFilters,
  VQ_SORT_OPTIONS,
  vqFilterChipLabelResolver,
  vqFiltersToCrmValues,
  sortVqRows,
  type VqListFilters,
  type VqSortKey,
} from '@/config/vqFilterConfig'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { getVendorQuotationList } from '@/services/purchase'
import type { VendorQuotationListRow } from '@/types/purchaseDomain'
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
  const [filters, setFilters] = useState<VqListFilters>(DEFAULT_VQ_LIST_FILTERS)
  const [sortBy, setSortBy] = useState<VqSortKey>('documentDate')

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

  const vendorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.vendorName).filter(Boolean))].sort(),
    [rows],
  )
  const filterFields = useMemo(() => buildVqFilterFields({ vendorOptions }), [vendorOptions])

  const filterDrawer = useCrmFilterDrawer({
    values: vqFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToVqFilters(next)),
    fields: filterFields,
    defaults: vqFiltersToCrmValues(DEFAULT_VQ_LIST_FILTERS),
    chipLabelResolver: vqFilterChipLabelResolver,
  })

  const filtered = useMemo(
    () => sortVqRows(filterVqRows(rows, filters), sortBy),
    [rows, filters, sortBy],
  )

  const clearFilters = () => filterDrawer.clearAll()
  const activeFilters = hasActiveVqFilters(filters)

  const columns = useMemo<ColumnDef<VendorQuotationListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'VQ Number',
        meta: { columnLabel: 'VQ Number' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/vendor-quotations/${row.original.id}`} className="font-mono">
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
        accessorKey: 'rfqNumber',
        header: 'RFQ',
        meta: { columnLabel: 'RFQ' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/rfqs/${row.original.rfqId}`} className="font-mono">
            {row.original.rfqNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'vendorName',
        header: 'Vendor',
        meta: { columnLabel: 'Vendor' },
      },
      {
        accessorKey: 'vendorReferenceNumber',
        header: 'Vendor Ref',
        meta: { columnLabel: 'Vendor Ref' },
        cell: ({ row }) => row.original.vendorReferenceNumber || '—',
      },
      {
        accessorKey: 'validTill',
        header: 'Valid Until',
        meta: { columnLabel: 'Valid Until' },
        cell: ({ row }) => formatDate(row.original.validTill),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Total',
        meta: { columnLabel: 'Total' },
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
          const isDraft = r.status === 'draft'
          const statusLabel = r.statusLabel || r.status
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/vendor-quotations/${r.id}`),
            },
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/purchase/vendor-quotations/${r.id}/edit`),
              disabled: !isDraft,
              disabledReason: `${statusLabel} vendor quotations cannot be edited`,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: Trash2,
              danger: true,
              disabled: true,
              disabledReason: `${statusLabel} vendor quotations cannot be deleted`,
            },
            {
              id: 'compare',
              label: 'Open Comparison',
              icon: GitCompare,
              onClick: () => navigate(`/purchase/comparison/${r.rfqId}`),
            },
          ]
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  const shellProps = {
    title: 'Vendor Quotations',
    description: 'Record and review vendor responses against RFQs',
    badge: 'Purchase' as const,
    variant: 'dynamics' as const,
    breadcrumbs: purchaseBreadcrumbs('Vendor Quotations'),
    favoritePath: '/purchase/vendor-quotations',
    pageGuide: null,
  }

  const commandBar = (
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
  )

  const emptyAction = (
    <div className="flex flex-wrap justify-center gap-2">
      {rows.length === 0 && perms.canCreateQuotation ? (
        <button
          type="button"
          className="erp-btn erp-btn--primary text-[13px]"
          onClick={() => navigate('/purchase/vendor-quotations/new')}
        >
          New Vendor Quotation
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
              icon={FileText}
              title="Could not load vendor quotations"
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
              <EnterpriseRegisterTableShell className="min-w-0">
                <ErpDataGrid
                  data={filtered}
                  columns={columns}
                  showCompactSearch={false}
                  enableColumnSorting={false}
                  stickyFirstColumn
                  emptyMessage={
                    activeFilters
                      ? 'No vendor quotations match current filters.'
                      : 'No vendor quotations found. Create a quotation entry against an RFQ when a vendor responds.'
                  }
                  emptyAction={emptyAction}
                  getRowId={(r) => r.id}
                  registerBar={
                    <CrmListFilterBar
                      search={filters.search}
                      onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                      searchPlaceholder="Search VQ / RFQ / vendor"
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
                          onChange={(v) => setSortBy(v as VqSortKey)}
                          aria-label="Sort vendor quotations"
                          options={VQ_SORT_OPTIONS}
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
        title="Filter vendor quotations"
        fields={filterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
    </>
  )
}
