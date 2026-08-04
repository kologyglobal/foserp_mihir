/**
 * Money In credit notes register — header/toolbar aligned with Invoices register.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, RefreshCw, Save } from 'lucide-react'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { StatusDot } from '@/components/design-system/StatusDot'
import type { StatusDotTone } from '@/components/design-system/StatusDot'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  useDensityClass,
} from '@/design-system/enterprise'
import { MONEY_IN_CREDIT_NOTE_REGISTER_PRESETS } from '@/config/savedViewPresets'
import { useSavedViews } from '@/hooks/useSavedViews'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { listCustomerCreditNotes } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { CustomerCreditNoteListItemDto, CustomerCreditNoteStatus } from '@/types/moneyIn'
import type { CrmFilterField } from '@/types/crmListFilters'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  CREDIT_NOTE_STATUS_LABELS,
  creditNoteDisplayNumber,
  creditNoteStatusTone,
  parseDecimal,
} from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

type CreditNoteSortKey = 'creditNoteDate' | 'customer' | 'amount' | 'status' | 'creditNoteNo'

const CREDIT_NOTE_FILTER_DEFAULTS = {
  search: '',
  status: '',
}

const CREDIT_NOTE_FILTER_FIELDS: CrmFilterField[] = [
  { type: 'section', label: 'Status' },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'All',
    options: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
      { value: 'READY_TO_POST', label: 'Ready to Post' },
      { value: 'POSTED', label: 'Posted' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'CANCELLED', label: 'Cancelled' },
      { value: 'REVERSED', label: 'Reversed' },
    ],
  },
]

const CREDIT_NOTE_SORT_OPTIONS: { value: CreditNoteSortKey; label: string }[] = [
  { value: 'creditNoteDate', label: 'Sort: Credit Note Date' },
  { value: 'customer', label: 'Sort: Customer' },
  { value: 'amount', label: 'Sort: Amount' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'creditNoteNo', label: 'Sort: Credit Note No.' },
]

function chipToneFromErp(tone: string): StatusDotTone {
  if (tone === 'critical') return 'danger'
  if (tone === 'success' || tone === 'warning' || tone === 'info' || tone === 'neutral') return tone
  return 'neutral'
}

function sortRows(
  list: CustomerCreditNoteListItemDto[],
  sortBy: CreditNoteSortKey,
): CustomerCreditNoteListItemDto[] {
  const next = [...list]
  next.sort((a, b) => {
    switch (sortBy) {
      case 'customer':
        return (
          a.customerNameSnapshot.localeCompare(b.customerNameSnapshot)
          || creditNoteDisplayNumber(b).localeCompare(creditNoteDisplayNumber(a))
        )
      case 'amount':
        return parseDecimal(b.grandTotal) - parseDecimal(a.grandTotal)
      case 'status':
        return (
          CREDIT_NOTE_STATUS_LABELS[a.status].localeCompare(CREDIT_NOTE_STATUS_LABELS[b.status])
          || b.creditNoteDate.localeCompare(a.creditNoteDate)
        )
      case 'creditNoteNo':
        return creditNoteDisplayNumber(b).localeCompare(creditNoteDisplayNumber(a))
      case 'creditNoteDate':
      default:
        return (
          b.creditNoteDate.localeCompare(a.creditNoteDate)
          || creditNoteDisplayNumber(b).localeCompare(creditNoteDisplayNumber(a))
        )
    }
  })
  return next
}

function parseInitialStatus(searchParams: URLSearchParams): '' | CustomerCreditNoteStatus {
  const raw = searchParams.get('status') as CustomerCreditNoteStatus | null
  if (raw && raw in CREDIT_NOTE_STATUS_LABELS) return raw
  return ''
}

export function CreditNoteListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const densityClass = useDensityClass()
  const canCreate = mergeAllowedAction(perms.canCreateCreditNote)
  const canEdit = perms.canEditCreditNote

  const [rows, setRows] = useState<CustomerCreditNoteListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | CustomerCreditNoteStatus>(() =>
    parseInitialStatus(searchParams),
  )
  const [sortBy, setSortBy] = useState<CreditNoteSortKey>('creditNoteDate')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCustomerCreditNotes({
        legalEntityId: resolveLegalEntityId(),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load credit notes')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    if (perms.canViewCreditNote) void load()
  }, [load, perms.canViewCreditNote])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (statusFilter) params.set('status', statusFilter)
        else params.delete('status')
        return params
      },
      { replace: true },
    )
  }, [statusFilter, setSearchParams])

  const filtersRecord = useMemo(
    () => ({
      search,
      status: statusFilter,
      sortBy,
    }),
    [search, statusFilter, sortBy],
  )

  const applyFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    const nextStatus = (saved.status ?? '') as '' | CustomerCreditNoteStatus
    setStatusFilter(nextStatus && nextStatus in CREDIT_NOTE_STATUS_LABELS ? nextStatus : '')
    const sb = saved.sortBy as CreditNoteSortKey
    if (CREDIT_NOTE_SORT_OPTIONS.some((o) => o.value === sb)) setSortBy(sb)
  }, [])

  const savedViews = useSavedViews({
    pageId: '/accounting/money-in/credit-notes',
    filters: filtersRecord,
    onApply: applyFilters,
    systemPresets: MONEY_IN_CREDIT_NOTE_REGISTER_PRESETS,
  })

  const filterDrawer = useCrmFilterDrawer({
    values: {
      search,
      status: statusFilter,
    },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') {
        const nextStatus = next.status as '' | CustomerCreditNoteStatus
        setStatusFilter(nextStatus && nextStatus in CREDIT_NOTE_STATUS_LABELS ? nextStatus : '')
      }
    },
    fields: CREDIT_NOTE_FILTER_FIELDS,
    defaults: CREDIT_NOTE_FILTER_DEFAULTS,
    chipLabelResolver: (key, value) => {
      if (key === 'status') {
        return CREDIT_NOTE_STATUS_LABELS[value as CustomerCreditNoteStatus] ?? value
      }
      return undefined
    },
  })

  const clearFilters = useCallback(() => {
    filterDrawer.clearAll()
    setSortBy('creditNoteDate')
  }, [filterDrawer])

  const hasActiveFilters = Boolean(search.trim() || statusFilter)

  const filtered = useMemo(() => sortRows(rows, sortBy), [rows, sortBy])

  const columns = useMemo<ColumnDef<CustomerCreditNoteListItemDto, unknown>[]>(
    () => [
      {
        id: 'creditNoteNo',
        header: 'No.',
        meta: { columnLabel: 'Credit Note No.' },
        enableSorting: false,
        cell: ({ row }) => (
          <TableLink to={`/accounting/money-in/credit-notes/${row.original.id}`}>
            <EnterpriseIdCell id={creditNoteDisplayNumber(row.original)} />
          </TableLink>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        enableSorting: false,
        cell: ({ row }) => (
          <StatusDot
            label={CREDIT_NOTE_STATUS_LABELS[row.original.status]}
            tone={chipToneFromErp(creditNoteStatusTone(row.original.status))}
          />
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        meta: { columnLabel: 'Customer' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate" title={row.original.customerNameSnapshot}>
            {row.original.customerNameSnapshot}
          </span>
        ),
      },
      {
        id: 'creditNoteDate',
        header: 'Date',
        meta: { columnLabel: 'Credit Note Date' },
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.creditNoteDate),
      },
      {
        id: 'purpose',
        header: 'Purpose',
        meta: { columnLabel: 'Purpose' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[160px] truncate" title={row.original.purpose}>
            {row.original.purpose.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Total',
        meta: entNumericMeta('Total'),
        enableSorting: false,
        cell: ({ row }) => (
          <EnterpriseNumericCell
            value={formatCurrency(parseDecimal(row.original.grandTotal))}
            className="font-semibold"
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => {
          const note = row.original
          const actions = note.allowedActions
          return (
            <EnterpriseRowActionsMenu
              actions={[
                {
                  id: 'view',
                  label: 'View',
                  icon: Eye,
                  onClick: () => navigate(`/accounting/money-in/credit-notes/${note.id}`),
                },
                ...(mergeAllowedAction(canEdit, actions?.edit)
                  ? [{
                      id: 'edit',
                      label: 'Edit',
                      icon: Pencil,
                      onClick: () => navigate(`/accounting/money-in/credit-notes/${note.id}/edit`),
                    }]
                  : []),
              ]}
            />
          )
        },
      },
    ],
    [canEdit, navigate],
  )

  if (!perms.canViewCreditNote) {
    return (
      <MoneyInWorkspaceShell title="Credit Notes">
        <p className="text-[13px] text-erp-muted">You do not have permission to view credit notes.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <>
      <MoneyInWorkspaceShell
        title="Credit Notes"
        description="Customer credit notes — draft, approve, post, and allocate against open invoices"
        contentClassName="border-0 bg-transparent p-0 shadow-none"
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              canCreate
                ? {
                    id: 'new',
                    label: 'New Credit Note',
                    icon: Plus,
                    onClick: () => navigate('/accounting/money-in/credit-notes/new'),
                  }
                : undefined
            }
            secondaryActions={[
              { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        )}
      >
        {loading && rows.length === 0 ? (
          <LoadingState variant="table" />
        ) : (
          <EnterpriseRegisterTableShell>
            <ErpDataGrid
              className={cn('erp-money-in-credit-notes-table', densityClass)}
              data={filtered}
              columns={columns}
              recordLabel="Credit Notes"
              stickyFirstColumn
              showCompactSearch={false}
              showToolbarExport={false}
              enableColumnSorting={false}
              emptyMessage={
                hasActiveFilters
                  ? 'No credit notes match the current filters.'
                  : 'No credit notes yet. Create one to adjust customer balances.'
              }
              emptyAction={
                filtered.length === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {canCreate ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--primary text-[13px]"
                        onClick={() => navigate('/accounting/money-in/credit-notes/new')}
                      >
                        New Credit Note
                      </button>
                    ) : null}
                    {hasActiveFilters ? (
                      <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    ) : null}
                  </div>
                ) : undefined
              }
              getRowId={(row) => row.id}
              onRowView={(row) => navigate(`/accounting/money-in/credit-notes/${row.id}`)}
              registerBar={(
                <CrmListFilterBar
                  className="crm-list-filter-bar--embedded"
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search credit note / customer…"
                  activeFilterCount={filterDrawer.activeCount}
                  onOpenFilters={filterDrawer.openDrawer}
                  chips={filterDrawer.chips}
                  onRemoveChip={filterDrawer.removeChip}
                  onClearAll={clearFilters}
                  savedView={savedViews.activeView}
                  onSavedViewChange={savedViews.selectView}
                  savedViews={savedViews.viewNames}
                  onSaveView={savedViews.openSaveDialog}
                  sort={(
                    <CrmListSortSelect
                      value={sortBy}
                      onChange={(v) => setSortBy(v as CreditNoteSortKey)}
                      aria-label="Sort credit notes"
                      options={CREDIT_NOTE_SORT_OPTIONS}
                    />
                  )}
                />
              )}
            />
          </EnterpriseRegisterTableShell>
        )}
      </MoneyInWorkspaceShell>

      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={CREDIT_NOTE_FILTER_FIELDS}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
        title="Filter credit notes"
      />
    </>
  )
}
