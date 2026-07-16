import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { RowSelectionState } from '@tanstack/react-table'
import { Calendar, Eye, FileText, Handshake, Pencil, Trash2, UserPlus } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDateTime } from '../../utils/dates/format'
import type { EnrichedLeadRow } from '../../utils/leadListUtils'
import { leadDisplayStatusLabel } from '../../utils/leadListUtils'
import { isLeadStageLocked } from '../../utils/leadUtils'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRecordCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import { StatusBadge, StageBadge, ProbabilityBadge } from '../../design-system/list-page'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { CrmListFilterBar, type CrmListFilterBarProps } from './CrmListFilterBar'

export interface CrmLeadsTableProps {
  rows: EnrichedLeadRow[]
  routes: {
    view: (id: string) => string
    edit: (id: string) => string
  }
  onView: (row: EnrichedLeadRow) => void
  onEdit: (row: EnrichedLeadRow) => void
  onDelete: (row: EnrichedLeadRow) => void
  onAssign?: (rows: EnrichedLeadRow[]) => void
  onCreateOpportunity?: (row: EnrichedLeadRow) => void
  onScheduleActivity?: (row: EnrichedLeadRow) => void
  onCreateQuotation?: (row: EnrichedLeadRow) => void
  /** Linked opportunity used to hint Create Quotation primary styling. */
  linkedOpportunityId?: (row: EnrichedLeadRow) => string | null
  onBulkExport?: (rows: EnrichedLeadRow[]) => void
  onBulkDelete?: (rows: EnrichedLeadRow[]) => void
  onBulkInactive?: (rows: EnrichedLeadRow[]) => void
  onBulkActive?: (rows: EnrichedLeadRow[]) => void
  onBulkChangeOwner?: (rows: EnrichedLeadRow[]) => void
  onBulkEmail?: (rows: EnrichedLeadRow[]) => void
  canDelete: boolean
  canEdit: boolean
  search: string
  onSearchChange: (value: string) => void
  filterSlot?: React.ReactNode
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  showCompactSearch?: boolean
  selectable?: boolean
  /** When false, defers sorting to page-level controls */
  enableColumnSorting?: boolean
  /** Embedded search / filters / sort / view row above the grid */
  registerFilter?: CrmListFilterBarProps
}

export function CrmLeadsTable({
  rows,
  routes,
  onView,
  onEdit,
  onDelete,
  onAssign,
  onCreateOpportunity,
  onScheduleActivity,
  onCreateQuotation,
  linkedOpportunityId,
  onBulkExport,
  onBulkDelete,
  onBulkInactive,
  onBulkActive,
  onBulkChangeOwner,
  onBulkEmail,
  canDelete,
  canEdit,
  search,
  onSearchChange,
  filterSlot,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  showCompactSearch = true,
  selectable = true,
  enableColumnSorting = false,
  registerFilter,
}: CrmLeadsTableProps) {
  const densityClass = useDensityClass()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.lead.id))
  }, [rowSelection, rows])

  const columns: ColumnDef<EnrichedLeadRow>[] = useMemo(
    () => [
      {
        id: 'leadNo',
        accessorFn: (r) => r.lead.leadNo,
        header: 'Lead No',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Lead No' },
        cell: ({ row }) => (
          <TableLink to={routes.view(row.original.lead.id)}>
            <EnterpriseIdCell id={row.original.lead.leadNo} />
          </TableLink>
        ),
      },
      {
        id: 'prospect',
        accessorFn: (r) => r.prospectDisplay,
        header: 'Prospect',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Prospect' },
        cell: ({ row }) => (
          <EnterpriseRecordCell
            primary={row.original.prospectDisplay}
            location={row.original.locationDisplay !== '—' ? row.original.locationDisplay : undefined}
            industry={row.original.industryDisplay !== '—' ? row.original.industryDisplay : undefined}
            subtitle={row.original.accountTypeDisplay}
          />
        ),
      },
      {
        id: 'source',
        accessorFn: (r) => r.sourceDisplay,
        header: 'Source',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Source' },
        cell: ({ row }) => <StatusBadge label={row.original.sourceDisplay} status="open" />,
      },
      {
        id: 'leadOwner',
        accessorFn: (r) => r.lead.leadOwnerName,
        header: 'Lead Owner',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Lead Owner' },
      },
      {
        id: 'expectedValue',
        accessorFn: (r) => r.lead.expectedValue,
        header: 'Expected Value',
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Expected Value'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.lead.expectedValue)} />
        ),
      },
      {
        id: 'probability',
        accessorFn: (r) => r.lead.probability,
        header: 'Probability',
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Probability'),
        cell: ({ row }) => <ProbabilityBadge value={row.original.lead.probability} />,
      },
      {
        id: 'status',
        accessorFn: (r) => r.displayStatus,
        header: 'Status',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusBadge
            label={leadDisplayStatusLabel(row.original.displayStatus)}
            status={row.original.displayStatus}
          />
        ),
      },
      {
        id: 'stage',
        accessorFn: (r) => r.lead.stage,
        header: 'Stage',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Stage' },
        cell: ({ row }) => <StageBadge stage={row.original.lead.stage} />,
      },
      {
        id: 'lastModified',
        accessorFn: (r) => r.lastModified,
        header: 'Last Modified On',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Last Modified On' },
        cell: ({ row }) => <span>{formatDateTime(row.original.lastModified)}</span>,
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'center', columnLabel: 'Actions' },
        cell: ({ row }) => {
          const lead = row.original.lead
          const locked = isLeadStageLocked(lead.stage)
          const quoteOppId = linkedOpportunityId?.(row.original) ?? lead.opportunityId
          const canConvertHint =
            !locked
            && lead.stage === 'qualified'
            && Boolean(lead.customerId)
            && !lead.opportunityId
            && lead.lifecycleStatus !== 'converted'
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu
                actions={[
                  { id: 'view', label: 'View', icon: Eye, onClick: () => onView(row.original) },
                  {
                    id: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onClick: () => onEdit(row.original),
                    disabled: !canEdit,
                    disabledReason: !canEdit ? 'No edit permission' : undefined,
                    title: locked ? 'Lead stage is locked — edits may be blocked' : undefined,
                  },
                  {
                    id: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    onClick: () => onDelete(row.original),
                    danger: true,
                    disabled: !canDelete,
                    disabledReason: !canDelete ? 'No delete permission' : undefined,
                  },
                  {
                    id: 'assign',
                    label: 'Assign',
                    icon: UserPlus,
                    onClick: () => onAssign?.([row.original]),
                    disabled: !canEdit || !onAssign,
                    disabledReason: !canEdit ? 'No edit permission' : undefined,
                  },
                  { id: 'sep-workflow', separator: true, label: '' },
                  {
                    id: 'create-opportunity',
                    label: 'Create Opportunity',
                    icon: Handshake,
                    primary: canConvertHint,
                    // Business rules (qualified / company / already converted) are enforced in
                    // the page handler with a toast — do not hard-disable (looks clickable with no feedback).
                    onClick: () => onCreateOpportunity?.(row.original),
                    disabled: !onCreateOpportunity || !canEdit,
                    disabledReason: !canEdit ? 'No edit permission' : undefined,
                  },
                  {
                    id: 'schedule-activity',
                    label: 'Schedule Activity',
                    icon: Calendar,
                    onClick: () => onScheduleActivity?.(row.original),
                    disabled: !canEdit || !onScheduleActivity,
                    disabledReason: !canEdit ? 'No edit permission' : undefined,
                  },
                  {
                    id: 'create-quotation',
                    label: 'Create Quotation',
                    icon: FileText,
                    primary: Boolean(quoteOppId),
                    onClick: () => onCreateQuotation?.(row.original),
                    disabled: !onCreateQuotation,
                    title: quoteOppId
                      ? undefined
                      : 'Requires a linked opportunity — convert the lead first',
                  },
                ]}
              />
            </div>
          )
        },
      },
    ],
    [onView, onEdit, onDelete, onAssign, onCreateOpportunity, onScheduleActivity, onCreateQuotation, linkedOpportunityId, canDelete, canEdit, enableColumnSorting, routes.view],
  )

  const emptyMessage = hasActiveFilters ? 'No leads match current filters.' : 'No leads found.'

  return (
    <ErpDataGrid
      className={cn('erp-leads-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Leads"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search lead no, prospect, owner…"
      emptyMessage={emptyMessage}
      emptyAction={
        emptyAction ?? (
          hasActiveFilters && onClearFilters ? (
            <button type="button" className="text-[13px] font-semibold text-erp-primary" onClick={onClearFilters}>
              Clear Filters
            </button>
          ) : undefined
        )
      }
      filterSlot={filterSlot}
      exportFileName="leads"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      enableColumnSorting={enableColumnSorting}
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
      selectable={selectable}
      getRowId={(row) => row.lead.id}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowQuickView={onView}
      bulkActions={
        <BulkActionToolbar
          count={selectedRows.length}
          entityLabel="selected"
          onClear={() => setRowSelection({})}
          actions={buildEnterpriseBulkActions(selectedRows, {
            onAssign,
            onChangeOwner: onBulkChangeOwner ?? onAssign,
            onEmail: onBulkEmail,
            onExport: onBulkExport,
            onDelete: onBulkDelete,
            onInactive: onBulkInactive,
            onActive: onBulkActive,
            canAssign: canEdit,
            canDelete,
            canSetStatus: canEdit,
          })}
        />
      }
    />
  )
}
