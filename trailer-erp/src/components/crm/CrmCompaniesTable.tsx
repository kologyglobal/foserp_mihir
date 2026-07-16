import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Calendar, Copy, Eye, FileText, Mail, Pencil, Phone, Target, Trash2, UserPlus } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate, formatDateTime, formatRelativeTime } from '../../utils/dates/format'
import type { EnrichedCompanyRow } from '../../utils/crmCompaniesPortfolio'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseRowActionsMenu,
  entCenterMeta,
  entNumericMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import { StatusBadge } from '../../design-system/list-page'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { CrmListFilterBar, type CrmListFilterBarProps } from './CrmListFilterBar'

export interface CrmCompaniesTableProps {
  rows: EnrichedCompanyRow[]
  onOpen360: (customerId: string) => void
  onOpportunity: (customerId: string) => void
  onFollowUp: (customerId: string) => void
  onQuotation: (customerId: string) => void
  onPreview?: (row: EnrichedCompanyRow) => void
  onBulkAssign?: (rows: EnrichedCompanyRow[]) => void
  onBulkExport?: (rows: EnrichedCompanyRow[]) => void
  onBulkDelete?: (rows: EnrichedCompanyRow[]) => void
  onDelete?: (row: EnrichedCompanyRow) => void
  onBulkInactive?: (rows: EnrichedCompanyRow[]) => void
  onBulkActive?: (rows: EnrichedCompanyRow[]) => void
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

function companyStatusKey(tone: EnrichedCompanyRow['status']['tone']): string {
  if (tone === 'success' || tone === 'live') return 'open'
  if (tone === 'critical') return 'critical'
  if (tone === 'warning' || tone === 'pending') return 'warning'
  if (tone === 'neutral') return 'neutral'
  return 'qualified'
}

function formatCustomerType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function companyMetaLine(customer: EnrichedCompanyRow['customer']) {
  const location = [customer.city, customer.state].filter(Boolean).join(', ')
  return [location, customer.salesTerritory, formatCustomerType(customer.customerType)]
    .filter(Boolean)
    .join(' · ')
}

function formatCompactPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return phone
}

export function CrmCompaniesTable({
  rows,
  onOpen360,
  onOpportunity,
  onFollowUp,
  onQuotation,
  onPreview,
  onBulkAssign,
  onBulkExport,
  onBulkDelete,
  onDelete,
  onBulkInactive,
  onBulkActive,
  canEdit = false,
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
}: CrmCompaniesTableProps) {
  const densityClass = useDensityClass()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.customer.id))
  }, [rowSelection, rows])

  const columns: ColumnDef<EnrichedCompanyRow>[] = useMemo(
    () => [
      {
        id: 'code',
        accessorFn: (row) => row.customer.customerCode,
        header: 'Code',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Company Code' },
        cell: ({ row }) => (
          <TableLink to={entity360CustomerPath(row.original.customer.id)}>
            <EnterpriseIdCell id={row.original.customer.customerCode} />
          </TableLink>
        ),
      },
      {
        id: 'company',
        accessorFn: (row) => row.customer.customerName,
        header: 'Company',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Company Name' },
        cell: ({ row }) => {
          const { customer } = row.original
          return (
            <div className="crm-companies-table__company">
              <span className="crm-companies-table__avatar" aria-hidden>
                {companyInitials(customer.customerName)}
              </span>
              <div className="min-w-0">
                <TableLink
                  to={entity360CustomerPath(customer.id)}
                  className="crm-companies-table__name"
                >
                  {customer.customerName}
                </TableLink>
                <p className="crm-companies-table__sub" title={companyMetaLine(customer)}>
                  {companyMetaLine(customer)}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'ownerName',
        header: 'Owner',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Account Owner' },
        cell: ({ row }) => (
          <span className={cn(
            'crm-companies-table__text',
            row.original.ownerName === 'Unassigned' && 'crm-companies-table__muted italic',
          )}
          >
            {row.original.ownerName}
          </span>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.primaryContact,
        meta: { columnLabel: 'Primary Contact' },
        cell: ({ row }) => {
          const { customer, primaryContact } = row.original
          if (primaryContact === '—' && !customer.contactPhone && !customer.contactEmail) {
            return <span className="crm-companies-table__muted">—</span>
          }
          return (
            <div className="min-w-0">
              <span className="crm-companies-table__text">{primaryContact}</span>
              {(customer.contactPhone || customer.contactEmail) ? (
                <div className="crm-companies-table__contact-meta">
                  {customer.contactPhone ? (
                    <a
                      href={`tel:${customer.contactPhone}`}
                      className="crm-companies-table__contact-link"
                      onClick={(e) => e.stopPropagation()}
                      title={customer.contactPhone}
                    >
                      <Phone className="h-3 w-3" aria-hidden />
                      {formatCompactPhone(customer.contactPhone)}
                    </a>
                  ) : null}
                  {customer.contactEmail ? (
                    <a
                      href={`mailto:${customer.contactEmail}`}
                      className="crm-companies-table__contact-link"
                      onClick={(e) => e.stopPropagation()}
                      title={customer.contactEmail}
                    >
                      <Mail className="h-3 w-3" aria-hidden />
                      Email
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'pipeline',
        header: 'Pipeline',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.summary.pipelineValue,
        meta: entNumericMeta('Pipeline Value'),
        cell: ({ row }) => {
          const value = row.original.summary.pipelineValue
          return (
            <span className={cn(
              'crm-companies-table__money block text-right',
              value > 0 && 'crm-companies-table__money--strong',
            )}
            >
              {formatCrmCurrency(value)}
            </span>
          )
        },
      },
      {
        id: 'opps',
        header: 'Opps',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.summary.openOpportunities,
        meta: entCenterMeta('Open Opportunities'),
        cell: ({ row }) => {
          const count = row.original.summary.openOpportunities
          return (
            <span className={cn(
              'crm-companies-table__count',
              count > 0 && 'crm-companies-table__count--active',
            )}
            >
              {count}
            </span>
          )
        },
      },
      {
        id: 'quotes',
        header: 'Quotes',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.openQuotations,
        meta: entCenterMeta('Active Quotations'),
        cell: ({ row }) => {
          const { openQuotations, quotationValue } = row.original
          if (openQuotations <= 0) return <span className="crm-companies-table__muted">—</span>
          return (
            <span className="crm-companies-table__text whitespace-nowrap" title={formatCrmCurrency(quotationValue)}>
              {openQuotations}
              {quotationValue > 0 ? ` · ${formatCrmCurrency(quotationValue)}` : ''}
            </span>
          )
        },
      },
      {
        id: 'ar',
        header: 'Outstanding AR',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.outstandingAr,
        meta: entNumericMeta('Outstanding AR'),
        cell: ({ row }) => {
          const value = row.original.outstandingAr
          return (
            <span className={cn(
              'crm-companies-table__money block text-right',
              value > 0 && 'crm-companies-table__money--warn',
            )}
            >
              {formatCrmCurrency(value)}
            </span>
          )
        },
      },
      {
        id: 'lastActivity',
        header: 'Last Activity',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.summary.lastActivityAt ?? '',
        meta: { columnLabel: 'Last Activity' },
        cell: ({ row }) => {
          const { lastActivityAt } = row.original.summary
          if (!lastActivityAt) return <span className="crm-companies-table__muted">No activity</span>
          return (
            <span className="crm-companies-table__date" title={formatDateTime(lastActivityAt)}>
              {formatRelativeTime(lastActivityAt)}
            </span>
          )
        },
      },
      {
        id: 'nextFu',
        header: 'Next Follow-up',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.summary.nextFollowUpDate ?? '',
        meta: { columnLabel: 'Next Follow-up' },
        cell: ({ row }) => {
          const { nextFollowUpDate, hasOverdueFollowUp } = row.original.summary
          if (!nextFollowUpDate) return <span className="crm-companies-table__muted">—</span>
          return (
            <span
              className={cn(
                'crm-companies-table__date',
                hasOverdueFollowUp && 'crm-companies-table__date--overdue',
              )}
              title={formatDateTime(nextFollowUpDate)}
            >
              {formatDate(nextFollowUpDate)}
              {hasOverdueFollowUp ? ' · Overdue' : ''}
            </span>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: enableColumnSorting,
        accessorFn: (row) => row.status.label,
        meta: { columnLabel: 'CRM Status' },
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.status.label}
            status={companyStatusKey(row.original.status.tone)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'center', columnLabel: 'Actions' },
        cell: ({ row }) => {
          const id = row.original.customer.id
          const { contactPhone, contactEmail } = row.original.customer
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu
                actions={[
                  { id: 'view', label: 'Open 360', icon: Eye, onClick: () => onOpen360(id) },
                  { id: 'preview', label: 'Quick Preview', icon: Eye, onClick: () => onPreview?.(row.original), disabled: !onPreview },
                  { id: 'edit', label: 'Edit Company', icon: Pencil, onClick: () => onOpen360(id), disabled: !canEdit },
                  { id: 'assign', label: 'Assign Owner', icon: UserPlus, onClick: () => onFollowUp(id), disabled: !canEdit },
                  { id: 'sep-workflow', separator: true, label: '' },
                  {
                    id: 'opp',
                    label: 'Create Opportunity',
                    icon: Target,
                    primary: true,
                    onClick: () => onOpportunity(id),
                  },
                  {
                    id: 'follow-up',
                    label: 'Schedule Follow-up',
                    icon: Calendar,
                    onClick: () => onFollowUp(id),
                  },
                  {
                    id: 'quote',
                    label: 'Create Quotation',
                    icon: FileText,
                    onClick: () => onQuotation(id),
                  },
                  { id: 'call', label: 'Call Contact', icon: Phone, onClick: () => contactPhone && window.open(`tel:${contactPhone}`), disabled: !contactPhone },
                  { id: 'email', label: 'Email Contact', icon: Mail, onClick: () => contactEmail && window.open(`mailto:${contactEmail}`), disabled: !contactEmail },
                  { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => onOpportunity(id), disabled: !canEdit },
                  { id: 'sep-danger', separator: true, label: '' },
                  {
                    id: 'delete',
                    label: 'Delete Company',
                    icon: Trash2,
                    danger: true,
                    onClick: () => onDelete?.(row.original),
                    disabled: !canDelete || !onDelete,
                  },
                ]}
              />
            </div>
          )
        },
      },
    ],
    [onOpen360, onOpportunity, onFollowUp, onQuotation, onPreview, onDelete, canEdit, canDelete, enableColumnSorting],
  )

  const emptyMessage = hasActiveFilters ? 'No companies match current filters.' : 'No companies found.'

  return (
    <ErpDataGrid
      className={cn('erp-companies-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Companies"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search company, contact, city, owner…"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      showToolbarExport={false}
      exportFileName="crm-companies"
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
      getRowId={(row) => row.customer.id}
      selectable={selectable}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowQuickView={(row) => onOpen360(row.customer.id)}
      bulkActions={
        <BulkActionToolbar
          count={selectedRows.length}
          entityLabel="selected"
          onClear={() => setRowSelection({})}
          actions={buildEnterpriseBulkActions(selectedRows, {
            onAssign: onBulkAssign,
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
