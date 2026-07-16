import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Calendar, Copy, Eye, FileText, Handshake, History, Mail, Pencil, Phone, Trash2, UserPlus, Building2 } from 'lucide-react'
import type { CrmContact, CrmActivity, FollowUp } from '../../types/crm'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { TableLink } from '../ui/AppLink'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { cn } from '../../utils/cn'
import {
  EnterpriseRowActionsMenu,
  entCenterMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { CrmListFilterBar, type CrmListFilterBarProps } from './CrmListFilterBar'

export interface EnrichedContactRow {
  contact: CrmContact
  customerId: string
  customerName: string
  customerCode: string
  city: string
  state: string
  territory: string
  industry: string
  customerType: string
  lastAct?: CrmActivity
  nextFu?: FollowUp
  openOpportunities: number
  daysSinceActivity: number | null
}

export interface CrmContactsTableProps {
  rows: EnrichedContactRow[]
  companyLabel: string
  onPreview?: (row: EnrichedContactRow) => void
  onEdit?: (row: EnrichedContactRow) => void
  onFollowUp: (contact: CrmContact) => void
  onCreateOpportunity?: (row: EnrichedContactRow) => void
  onCreateQuotation?: (row: EnrichedContactRow) => void
  onView?: (row: EnrichedContactRow) => void
  onDuplicate?: (row: EnrichedContactRow) => void
  onOpen360: (customerId: string) => void
  onBulkAssign?: (rows: EnrichedContactRow[]) => void
  onBulkExport?: (rows: EnrichedContactRow[]) => void
  onBulkDelete?: (rows: EnrichedContactRow[]) => void
  onDelete?: (row: EnrichedContactRow) => void
  onBulkInactive?: (rows: EnrichedContactRow[]) => void
  onBulkActive?: (rows: EnrichedContactRow[]) => void
  canEdit?: boolean
  canDelete?: boolean
  emptyMessage?: string
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

function contactInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatTableDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function formatCustomerType(type: string) {
  if (!type || type === '—') return '—'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function activityAgeLabel(days: number | null) {
  if (days == null) return null
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} mo ago`
  return `${Math.floor(days / 365)} yr ago`
}

function followUpStatusLabel(nextFu?: FollowUp) {
  if (!nextFu) return { label: 'No follow-up', tone: 'neutral' as const }
  if (nextFu.status === 'overdue') return { label: 'Overdue', tone: 'critical' as const }
  if (nextFu.status === 'pending') return { label: 'Scheduled', tone: 'warning' as const }
  return { label: 'Active', tone: 'success' as const }
}

function activityTypeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
}

export function CrmContactsTable({
  rows,
  companyLabel,
  onPreview,
  onEdit,
  onFollowUp,
  onCreateOpportunity,
  onCreateQuotation,
  onView,
  onDuplicate,
  onOpen360,
  onBulkAssign,
  onBulkExport,
  onBulkDelete,
  onDelete,
  onBulkInactive,
  onBulkActive,
  canEdit = false,
  canDelete = false,
  emptyMessage = 'No contacts — CRM data will load automatically.',
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
}: CrmContactsTableProps) {
  const densityClass = useDensityClass()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.contact.id))
  }, [rowSelection, rows])

  const columns: ColumnDef<EnrichedContactRow>[] = useMemo(
    () => [
      {
        id: 'contact',
        accessorKey: 'contact.name',
        header: 'Contact',
        enableSorting: true,
        meta: { columnLabel: 'Contact Name' },
        cell: ({ row }) => {
          const { contact } = row.original
          return (
            <div className="crm-contacts-table__contact">
              <span className="crm-contacts-table__avatar" aria-hidden>
                {contactInitials(contact.name)}
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  className="crm-contacts-table__name"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onView) onView(row.original)
                    else onPreview?.(row.original)
                  }}
                >
                  {contact.name}
                </button>
                {contact.isPrimary ? (
                  <span className="crm-contacts-table__badge-primary">Primary</span>
                ) : null}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'customerName',
        header: companyLabel,
        enableSorting: true,
        meta: { columnLabel: companyLabel },
        cell: ({ row }) => (
          <div className="min-w-0">
            <TableLink
              to={entity360CustomerPath(row.original.customerId)}
              className="crm-contacts-table__company-link"
            >
              {row.original.customerName}
            </TableLink>
            <p className="crm-contacts-table__code">{row.original.customerCode}</p>
          </div>
        ),
      },
      {
        accessorKey: 'contact.designation',
        header: 'Designation',
        enableSorting: true,
        meta: { columnLabel: 'Designation', cellClass: 'crm-contacts-table__text' },
        cell: ({ row }) => (
          <span className="crm-contacts-table__text">{row.original.contact.designation || '—'}</span>
        ),
      },
      {
        id: 'location',
        header: 'Location',
        enableSorting: true,
        accessorFn: (row) => row.city,
        meta: { columnLabel: 'City & Territory' },
        cell: ({ row }) => {
          const { city, state, territory } = row.original
          const location = city !== '—' ? `${city}${state && state !== '—' ? `, ${state}` : ''}` : '—'
          return (
            <div className="min-w-0">
              <span className="crm-contacts-table__text">{location}</span>
              {territory !== '—' ? (
                <p className="crm-contacts-table__sub">{territory} territory</p>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'industry',
        header: 'Industry',
        enableSorting: true,
        meta: { columnLabel: 'Industry' },
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="crm-contacts-table__text">{row.original.industry}</span>
            <p className="crm-contacts-table__sub">{formatCustomerType(row.original.customerType)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'contact.email',
        header: 'Email',
        enableSorting: true,
        meta: { columnLabel: 'Email' },
        cell: ({ row }) => {
          const email = row.original.contact.email
          if (!email) return <span className="crm-contacts-table__muted">—</span>
          return (
            <a
              href={`mailto:${email}`}
              className="crm-contacts-table__link"
              onClick={(e) => e.stopPropagation()}
              title={email}
            >
              <Mail className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{email}</span>
            </a>
          )
        },
      },
      {
        accessorKey: 'contact.phone',
        header: 'Phone',
        enableSorting: true,
        meta: { columnLabel: 'Phone' },
        cell: ({ row }) => {
          const phone = row.original.contact.phone
          if (!phone) return <span className="crm-contacts-table__muted">—</span>
          return (
            <a
              href={`tel:${phone}`}
              className="crm-contacts-table__link"
              onClick={(e) => e.stopPropagation()}
              title={phone}
            >
              <Phone className="h-3 w-3 shrink-0" aria-hidden />
              {phone}
            </a>
          )
        },
      },
      {
        id: 'openOpps',
        header: 'Opps',
        enableSorting: true,
        accessorFn: (row) => row.openOpportunities,
        meta: entCenterMeta('Open Opportunities'),
        cell: ({ row }) => {
          const count = row.original.openOpportunities
          return (
            <span className={cn('crm-contacts-table__count', count > 0 && 'crm-contacts-table__count--active')}>
              {count}
            </span>
          )
        },
      },
      {
        id: 'lastActivity',
        header: 'Last Activity',
        enableSorting: true,
        accessorFn: (row) => row.lastAct?.activityDate ?? '',
        meta: { columnLabel: 'Last Activity' },
        cell: ({ row }) => {
          const { lastAct, daysSinceActivity } = row.original
          if (!lastAct) return <span className="crm-contacts-table__muted">No activity</span>
          const age = activityAgeLabel(daysSinceActivity)
          return (
            <div className="min-w-0">
              <span className="crm-contacts-table__date">{formatTableDate(lastAct.activityDate)}</span>
              <p className="crm-contacts-table__sub">{activityTypeLabel(lastAct.type)}</p>
              {age ? <p className="crm-contacts-table__sub">{age}</p> : null}
            </div>
          )
        },
      },
      {
        id: 'nextFollowUp',
        header: 'Next Follow-up',
        enableSorting: true,
        accessorFn: (row) => row.nextFu?.dueDate ?? '',
        meta: { columnLabel: 'Next Follow-up' },
        cell: ({ row }) => {
          const nextFu = row.original.nextFu
          if (!nextFu) return <span className="crm-contacts-table__muted">—</span>
          const overdue = nextFu.status === 'overdue'
          return (
            <div className="min-w-0">
              <span className={cn('crm-contacts-table__date', overdue && 'crm-contacts-table__date--overdue')}>
                {formatTableDate(nextFu.dueDate)}
                {overdue ? ' · Overdue' : ''}
              </span>
              {nextFu.assignedToName ? (
                <p className="crm-contacts-table__sub">{nextFu.assignedToName}</p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: true,
        accessorFn: (row) => row.nextFu?.status ?? 'active',
        meta: { columnLabel: 'Follow-up Status' },
        cell: ({ row }) => {
          const status = followUpStatusLabel(row.original.nextFu)
          return <DynamicsStatusChip label={status.label} tone={status.tone} />
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'center', columnLabel: 'Actions', cellClass: 'crm-contacts-table__actions-cell' },
        cell: ({ row }) => {
          const c = row.original.contact
          return (
            <div className="crm-contacts-table__actions" onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu
                actions={[
                  { id: 'view', label: 'View Contact', icon: Eye, onClick: () => (onView ? onView(row.original) : onPreview?.(row.original)) },
                  { id: 'company-360', label: 'Company 360', icon: Building2, onClick: () => onOpen360(c.customerId) },
                  { id: 'preview', label: 'Quick Preview', icon: Eye, onClick: () => onPreview?.(row.original), disabled: !onPreview },
                  { id: 'edit', label: 'Edit Contact', icon: Pencil, onClick: () => onEdit?.(row.original), disabled: !canEdit || !onEdit },
                  { id: 'assign', label: 'Assign', icon: UserPlus, onClick: () => onBulkAssign?.([row.original]), disabled: !canEdit || !onBulkAssign },
                  { id: 'sep-workflow', separator: true, label: '' },
                  {
                    id: 'follow-up',
                    label: 'Schedule Follow-up',
                    icon: Calendar,
                    primary: true,
                    onClick: () => onFollowUp(c),
                  },
                  {
                    id: 'opp',
                    label: 'Create Opportunity',
                    icon: Handshake,
                    onClick: () => onCreateOpportunity?.(row.original),
                    disabled: !onCreateOpportunity,
                  },
                  {
                    id: 'quote',
                    label: 'Create Quotation',
                    icon: FileText,
                    onClick: () => onCreateQuotation?.(row.original),
                    disabled: !onCreateQuotation,
                  },
                  { id: 'call', label: 'Call', icon: Phone, onClick: () => c.phone && window.open(`tel:${c.phone}`), disabled: !c.phone },
                  { id: 'email', label: 'Email', icon: Mail, onClick: () => c.email && window.open(`mailto:${c.email}`), disabled: !c.email },
                  { id: 'timeline', label: 'View History', icon: History, onClick: () => onPreview?.(row.original) },
                  { id: 'duplicate', label: 'Duplicate Contact', icon: Copy, onClick: () => onDuplicate?.(row.original), disabled: !canEdit || !onDuplicate },
                  { id: 'sep-danger', separator: true, label: '' },
                  {
                    id: 'delete',
                    label: 'Delete Contact',
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
    [companyLabel, onFollowUp, onOpen360, onPreview, onEdit, onView, onDuplicate, onCreateOpportunity, onCreateQuotation, onBulkAssign, onDelete, canEdit, canDelete, enableColumnSorting],
  )

  const resolvedEmptyMessage = hasActiveFilters ? 'No contacts match current filters.' : emptyMessage

  return (
    <ErpDataGrid
      className={cn('erp-contacts-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Contacts"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search name, email, phone, company…"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      showToolbarExport={false}
      exportFileName="crm-contacts"
      emptyMessage={resolvedEmptyMessage}
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
      getRowId={(row) => row.contact.id}
      selectable={selectable}
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
