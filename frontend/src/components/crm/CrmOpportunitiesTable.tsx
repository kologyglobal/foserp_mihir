import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Calendar,
  Eye,
  FileText,
  Pencil,
  ShoppingCart,
  Target,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import type { Opportunity } from '../../types/crm'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDateTime, formatDate } from '../../utils/dates/format'
import { useMasterStore } from '../../store/masterStore'
import { getOpportunityItemSummary } from '../../utils/opportunityLineCalc'
import { opportunityRequirementDisplay } from '../../utils/leadRequirementLines'
import { resolveOpportunityCreateSalesOrderGate } from '../../utils/opportunitySalesOrderDraft'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRecordCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import { ProbabilityBadge, StageBadge } from '../../design-system/list-page'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { CrmListFilterBar, type CrmListFilterBarProps } from './CrmListFilterBar'

export interface CrmOpportunitiesTableProps {
  rows: Opportunity[]
  onPreview?: (row: Opportunity) => void
  onView?: (row: Opportunity) => void
  onEdit?: (row: Opportunity) => void
  onScheduleActivity?: (row: Opportunity) => void
  onCreateQuotation?: (row: Opportunity) => void
  onCreateSalesOrder?: (row: Opportunity) => void
  onLogActivity?: (row: Opportunity) => void
  onMoveStage?: (row: Opportunity) => void
  onBulkExport?: (rows: Opportunity[]) => void
  onBulkAssign?: (rows: Opportunity[]) => void
  onBulkDelete?: (rows: Opportunity[]) => void
  onDelete?: (row: Opportunity) => void
  canEdit?: boolean
  canDelete?: boolean
  search: string
  onSearchChange: (value: string) => void
  filterSlot?: React.ReactNode
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  showCompactSearch?: boolean
  selectable?: boolean
  enableColumnSorting?: boolean
  registerFilter?: CrmListFilterBarProps
}

export function CrmOpportunitiesTable({
  rows,
  onPreview,
  onView,
  onEdit,
  onScheduleActivity,
  onCreateQuotation,
  onCreateSalesOrder,
  onLogActivity,
  onMoveStage,
  onBulkExport,
  onBulkAssign,
  onBulkDelete,
  onDelete,
  canEdit = true,
  canDelete = false,
  search,
  onSearchChange,
  filterSlot,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  showCompactSearch = false,
  selectable = true,
  enableColumnSorting = false,
  registerFilter,
}: CrmOpportunitiesTableProps) {
  const navigate = useNavigate()
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const densityClass = useDensityClass()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.id))
  }, [rowSelection, rows])

  const columns: ColumnDef<Opportunity>[] = useMemo(
    () => [
      {
        accessorKey: 'opportunityNo',
        header: 'Opp No',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Opp No' },
        cell: ({ row }) => (
          <TableLink to={`/crm/opportunities/${row.original.id}`}>
            <EnterpriseIdCell id={row.original.opportunityNo} />
          </TableLink>
        ),
      },
      {
        id: 'deal',
        header: 'Deal',
        accessorKey: 'opportunityName',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Deal' },
        cell: ({ row }) => (
          <EnterpriseRecordCell
            primary={row.original.opportunityName}
            subtitle={opportunityRequirementDisplay(row.original.productRequirement) || undefined}
          />
        ),
      },
      {
        id: 'customer',
        header: 'Company',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Company' },
        cell: ({ row }) => {
          const c = customers.find((x) => x.id === row.original.customerId)
          return (
            <TableLink to={entity360CustomerPath(row.original.customerId)}>
              <EnterpriseRecordCell
                primary={c?.customerName ?? '—'}
                location={c?.city}
                industry={c?.industry}
                subtitle={c?.isCustomer ? 'Customer' : 'Prospect'}
              />
            </TableLink>
          )
        },
      },
      {
        id: 'items',
        header: 'Primary Item',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Primary Item' },
        cell: ({ row }) => {
          const product = row.original.productId ? products.find((p) => p.id === row.original.productId) : undefined
          const count = row.original.lines?.length || (row.original.productId ? 1 : 0)
          return (
            <EnterpriseRecordCell
              primary={getOpportunityItemSummary(row.original, product)}
              subtitle={`${count} item${count === 1 ? '' : 's'}`}
            />
          )
        },
      },
      {
        id: 'stage',
        header: 'Stage',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Stage' },
        cell: ({ row }) => (
          <StageBadge label={opportunityStageLabel(row.original.stage)} stage={row.original.stage} />
        ),
      },
      {
        id: 'value',
        header: 'Value',
        accessorKey: 'value',
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Value'),
        cell: ({ row }) => (
          <EnterpriseNumericCell
            value={formatCrmCurrency(row.original.value)}
            className="text-erp-primary"
          />
        ),
      },
      {
        id: 'prob',
        header: 'Prob',
        accessorKey: 'probability',
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Probability'),
        cell: ({ row }) => <ProbabilityBadge value={row.original.probability} />,
      },
      {
        accessorKey: 'expectedCloseDate',
        header: 'Close',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Close' },
        cell: ({ row }) => (
          <span className="text-[13px] text-erp-text">
            {formatDate(row.original.expectedCloseDate)}
          </span>
        ),
      },
      {
        accessorKey: 'ownerName',
        header: 'Owner',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Owner' },
        cell: ({ row }) => (
          <span className="text-[13px] text-erp-text">{row.original.ownerName}</span>
        ),
      },
      {
        id: 'lastActivity',
        header: 'Last Activity',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.lastActivityAt ?? '',
        meta: { columnLabel: 'Last Activity' },
        cell: ({ row }) => {
          const { lastActivityAt } = row.original
          if (!lastActivityAt) return <span className="text-[13px] text-erp-muted">No activity</span>
          return <span className="text-[13px] text-erp-text">{formatDateTime(lastActivityAt)}</span>
        },
      },
      {
        id: 'followup',
        header: 'Next F/U',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.nextFollowUpDate ?? '',
        meta: { columnLabel: 'Next Follow-up' },
        cell: ({ row }) => {
          const { nextFollowUpDate } = row.original
          if (!nextFollowUpDate) return <span className="text-[13px] text-erp-muted">—</span>
          const overdue = nextFollowUpDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
          return (
            <span className={cn('text-[13px] text-erp-text', overdue && 'font-semibold text-erp-critical')}>
              {formatDate(nextFollowUpDate)}
              {overdue ? ' · Overdue' : ''}
            </span>
          )
        },
      },
      {
        id: 'weighted',
        header: 'Weighted',
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Weighted'),
        cell: ({ row }) => (
          <EnterpriseNumericCell
            value={formatCrmCurrency(row.original.value * (row.original.probability / 100))}
            className="text-erp-muted"
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'center', columnLabel: 'Actions' },
        cell: ({ row }) => {
          const opp = row.original
          const isOpen = opp.status === 'open'
          const soGate = resolveOpportunityCreateSalesOrderGate(opp.id)
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu
                actions={[
                  { id: 'view', label: 'View', icon: Eye, onClick: () => (onView ? onView(opp) : navigate(`/crm/opportunities/${opp.id}`)) },
                  { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => (onEdit ? onEdit(opp) : navigate(`/crm/opportunities/${opp.id}/edit`)), disabled: !canEdit || !isOpen },
                  { id: 'assign', label: 'Assign', icon: UserPlus, onClick: () => onBulkAssign?.([opp]), disabled: !canEdit || !onBulkAssign },
                  { id: 'sep-workflow', separator: true, label: '' },
                  {
                    id: 'quote',
                    label: 'Create Quotation',
                    icon: FileText,
                    primary: true,
                    onClick: () => onCreateQuotation?.(opp),
                    disabled: !onCreateQuotation || !isOpen,
                  },
                  {
                    id: 'follow-up',
                    label: 'Schedule Activity',
                    icon: Calendar,
                    onClick: () => onScheduleActivity?.(opp),
                    disabled: !onScheduleActivity,
                  },
                  {
                    id: 'so',
                    label: soGate.salesOrderId ? 'View Sales Order' : 'Create Sales Order',
                    icon: ShoppingCart,
                    onClick: () => onCreateSalesOrder?.(opp),
                    disabled: !onCreateSalesOrder || !isOpen || (!soGate.salesOrderId && !soGate.enabled),
                    disabledReason: soGate.salesOrderId ? undefined : (soGate.disabledReason ?? undefined),
                  },
                  {
                    id: 'log',
                    label: 'Log Activity',
                    icon: Activity,
                    onClick: () => onLogActivity?.(opp),
                    disabled: !onLogActivity,
                  },
                  {
                    id: 'stage',
                    label: 'Move Stage',
                    icon: Target,
                    onClick: () => onMoveStage?.(opp),
                    disabled: !onMoveStage || !isOpen,
                  },
                  { id: 'sep-danger', separator: true, label: '' },
                  {
                    id: 'delete',
                    label: 'Delete Opportunity',
                    icon: Trash2,
                    danger: true,
                    onClick: () => onDelete?.(opp),
                    disabled: !canDelete || !onDelete,
                  },
                ]}
              />
            </div>
          )
        },
      },
    ],
    [customers, navigate, products, onView, onEdit, onScheduleActivity, onCreateQuotation, onCreateSalesOrder, onLogActivity, onMoveStage, onBulkAssign, onDelete, canEdit, canDelete, enableColumnSorting],
  )

  const emptyMessage = hasActiveFilters ? 'No opportunities match current filters.' : 'No opportunities found.'

  return (
    <ErpDataGrid
      className={cn('erp-opportunities-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Opportunities"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search deal, opp no, company, owner…"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      showToolbarExport={false}
      exportFileName="crm-opportunities"
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
      enableColumnSorting={enableColumnSorting}
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
      selectable={selectable}
      getRowId={(row) => row.id}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowQuickView={onPreview ?? onView}
      bulkActions={
        <BulkActionToolbar
          count={selectedRows.length}
          entityLabel="selected"
          onClear={() => setRowSelection({})}
          actions={buildEnterpriseBulkActions(selectedRows, {
            onAssign: onBulkAssign,
            onChangeOwner: onBulkAssign,
            onExport: onBulkExport,
            onDelete: onBulkDelete,
            canAssign: canEdit,
            canDelete,
          })}
        />
      }
    />
  )
}
